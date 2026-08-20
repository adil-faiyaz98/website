import cds = require('@sap/cds');
import {
  SystemRegistration,
  ConnectionConfig,
} from '../types';
import { DeploymentModel, Region, SystemType } from '../types/enums';

const { ApplicationService } = cds;

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of connected systems per tenant */
export const MAX_SYSTEMS_PER_TENANT = 20;

/** Valid BTP deployment regions (Canada and US for data residency) */
export const VALID_REGIONS: Region[] = ['ca10', 'us10', 'us20'];

/** Region display names for validation messages */
export const REGION_DISPLAY_NAMES: Record<Region, string> = {
  ca10: 'Canada (Montreal)',
  us10: 'US East (Virginia)',
  us20: 'US West (Washington)',
};

/** Valid connection types per system type */
export const SYSTEM_CONNECTION_TYPES: Record<SystemType, string[]> = {
  S4HC: ['EVENT_MESH', 'API'],
  S4OP: ['CLOUD_CONNECTOR'],
  ECC: ['CLOUD_CONNECTOR'],
};

/** Valid interfaces per system type */
export const SYSTEM_INTERFACES: Record<SystemType, string[]> = {
  S4HC: ['OData_V4', 'Event_Mesh'],
  S4OP: ['RFC', 'OData', 'SOAP'],
  ECC: ['BAPI', 'RFC', 'IDoc', 'TABLE_READ'],
};

/** Authentication methods supporting principal propagation */
export const PRINCIPAL_PROPAGATION_AUTH_METHODS = ['OAUTH2', 'CERTIFICATE'];

// ============================================================================
// Exported Pure Functions (for testing)
// ============================================================================

/**
 * Validate that a region is a supported BTP deployment region.
 * Supported: ca10 (Montreal), us10 (US East VA), us20 (US West WA).
 *
 * Validates: Requirements 24.7
 */
export function isValidRegion(region: string): boolean {
  return VALID_REGIONS.includes(region as Region);
}

/**
 * Validate deployment model value.
 *
 * Validates: Requirements 24.1, 24.2
 */
export function isValidDeploymentModel(model: string): boolean {
  return model === 'multi-tenant' || model === 'single-tenant';
}

/**
 * Validate that the connection type is compatible with the given system type.
 * - S4HC: EVENT_MESH or API (via SAP Integration Suite OData V4)
 * - S4OP: CLOUD_CONNECTOR (RFC, OData, SOAP with principal propagation)
 * - ECC: CLOUD_CONNECTOR (BAPI, RFC, IDoc, table-read)
 *
 * Validates: Requirements 24.3, 24.4, 24.5
 */
export function isValidConnectionType(systemType: SystemType, connectionType: string): boolean {
  const allowedTypes = SYSTEM_CONNECTION_TYPES[systemType];
  if (!allowedTypes) return false;
  return allowedTypes.includes(connectionType);
}

/**
 * Validate system count does not exceed the maximum of 20 per tenant.
 *
 * Validates: Requirements 24.8
 */
export function canRegisterSystem(currentSystemCount: number): boolean {
  return currentSystemCount < MAX_SYSTEMS_PER_TENANT;
}

/**
 * Validate that a system release version is supported.
 * - S4OP: 1909 and above
 * - ECC: Enhancement Package 7 (EHP7) and above
 * - S4HC: Any cloud edition version
 *
 * Validates: Requirements 24.4, 24.5
 */
export function isValidRelease(systemType: SystemType, release: string): boolean {
  switch (systemType) {
    case 'S4HC':
      // Cloud edition - any version is valid
      return release.length > 0;
    case 'S4OP': {
      // S/4HANA On-Premise: 1909 and above
      const s4opVersion = Number.parseInt(release, 10);
      return !Number.isNaN(s4opVersion) && s4opVersion >= 1909;
    }
    case 'ECC': {
      // ECC 6.0 EHP7 and above
      const ehpMatch = /EHP(\d+)/i.exec(release);
      if (ehpMatch) {
        return Number.parseInt(ehpMatch[1], 10) >= 7;
      }
      // Also accept numeric format (7+)
      const eccVersion = Number.parseInt(release, 10);
      return !Number.isNaN(eccVersion) && eccVersion >= 7;
    }
    default:
      return false;
  }
}

/**
 * Check if an authentication method supports principal propagation
 * for user-context operations (required for S4OP).
 *
 * Validates: Requirements 24.4
 */
export function supportsPrincipalPropagation(authMethod: string): boolean {
  return PRINCIPAL_PROPAGATION_AUTH_METHODS.includes(authMethod);
}

/**
 * Validate Cloud Connector configuration - ensures outbound-only connectivity.
 * No inbound firewall rules required from customer network.
 *
 * Validates: Requirements 24.6
 */
export function isValidCloudConnectorConfig(config: {
  locationId: string;
  virtualHost: string;
  virtualPort: number;
}): boolean {
  if (!config.locationId || config.locationId.trim().length === 0) return false;
  if (!config.virtualHost || config.virtualHost.trim().length === 0) return false;
  if (config.virtualPort <= 0 || config.virtualPort > 65535) return false;
  return true;
}

/**
 * Determine the deployment topology configuration for a tenant.
 *
 * Multi-tenant: Schema-level HANA isolation, shared compute/infrastructure.
 * Single-tenant: Dedicated BTP subaccount resources (HANA, AI Core, network isolation).
 *
 * Validates: Requirements 24.1, 24.2
 */
export function getDeploymentTopologyConfig(deploymentModel: DeploymentModel): DeploymentTopologyConfig {
  switch (deploymentModel) {
    case 'multi-tenant':
      return {
        deploymentModel: 'multi-tenant',
        isolation: 'schema',
        hanaConfig: {
          type: 'shared',
          isolationLevel: 'schema',
          servicePlan: 'hdi-shared',
        },
        aiCoreConfig: {
          type: 'shared',
          resourceGroupIsolation: true,
          dedicatedInstance: false,
        },
        networkConfig: {
          type: 'shared',
          isolatedSegment: false,
        },
        targetMarket: 'mid-market',
        transactionThreshold: 50000,
      };
    case 'single-tenant':
      return {
        deploymentModel: 'single-tenant',
        isolation: 'physical',
        hanaConfig: {
          type: 'dedicated',
          isolationLevel: 'instance',
          servicePlan: 'hana',
        },
        aiCoreConfig: {
          type: 'dedicated',
          resourceGroupIsolation: true,
          dedicatedInstance: true,
        },
        networkConfig: {
          type: 'dedicated',
          isolatedSegment: true,
        },
        targetMarket: 'enterprise',
        complianceFrameworks: ['FedRAMP', 'CMMC', 'OSFI'],
      };
  }
}

/**
 * Validate that parallel monitoring configuration is valid.
 * At least one ECC and one S/4HANA system must be provided.
 *
 * Validates: Requirements 24.9
 */
export function isValidParallelMonitoringConfig(
  eccSystemType: SystemType,
  s4SystemType: SystemType
): boolean {
  const isECC = eccSystemType === 'ECC';
  const isS4 = s4SystemType === 'S4HC' || s4SystemType === 'S4OP';
  return isECC && isS4;
}

// ============================================================================
// Interfaces
// ============================================================================

/** Deployment topology configuration */
export interface DeploymentTopologyConfig {
  deploymentModel: DeploymentModel;
  isolation: 'schema' | 'physical';
  hanaConfig: {
    type: 'shared' | 'dedicated';
    isolationLevel: 'schema' | 'instance';
    servicePlan: string;
  };
  aiCoreConfig: {
    type: 'shared' | 'dedicated';
    resourceGroupIsolation: boolean;
    dedicatedInstance: boolean;
  };
  networkConfig: {
    type: 'shared' | 'dedicated';
    isolatedSegment: boolean;
  };
  targetMarket: string;
  transactionThreshold?: number;
  complianceFrameworks?: string[];
}

/** Cloud Connector virtual mapping for on-premise systems */
export interface CloudConnectorConfig {
  locationId: string;
  virtualHost: string;
  virtualPort: number;
  protocol: 'RFC' | 'HTTP' | 'HTTPS';
  sncEnabled: boolean;
  principalPropagationType: 'X.509' | 'SAP_LOGON_TICKET' | 'OAUTH2_TOKEN';
  /** Outbound-only: no inbound firewall rules needed */
  inboundRequired: false;
}

/** Parallel monitoring configuration for ECC-to-S/4HANA migration */
export interface ParallelMonitoringConfig {
  tenantId: string;
  eccSystemId: string;
  s4SystemId: string;
  unifiedAlerting: boolean;
  unifiedDashboard: boolean;
  migrationStartDate?: string;
  migrationEndDate?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Deployment Topology Service
 *
 * Manages deployment model configuration, system registration with validation,
 * region enforcement, Cloud Connector configuration, and parallel monitoring
 * during ECC-to-S/4HANA migration.
 *
 * Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9
 */
export default class DeploymentTopologyService extends (ApplicationService as any) {
  async init() {
    this.on('validateDeploymentTopology', this.handleValidateDeploymentTopology.bind(this));
    this.on('registerSystem', this.handleRegisterSystem.bind(this));
    this.on('validateRegion', this.handleValidateRegion.bind(this));
    this.on('configureCloudConnector', this.handleConfigureCloudConnector.bind(this));
    this.on('enableParallelMonitoring', this.handleEnableParallelMonitoring.bind(this));
    this.on('getDeploymentStatus', this.handleGetDeploymentStatus.bind(this));

    await super.init();
  }

  /**
   * Validate deployment topology configuration for a tenant.
   * Checks deployment model and region validity.
   *
   * Validates: Requirements 24.1, 24.2, 24.7
   */
  private async handleValidateDeploymentTopology(req: any): Promise<string> {
    const { tenantId, deploymentModel, region } = req.data;
    const logger = cds.log('deployment-topology');

    if (!tenantId) {
      req.error(400, 'tenantId is required');
      return '';
    }

    if (!isValidDeploymentModel(deploymentModel)) {
      req.error(400, `Invalid deployment model: ${deploymentModel}. Must be 'multi-tenant' or 'single-tenant'.`);
      return '';
    }

    if (!isValidRegion(region)) {
      const regionList = VALID_REGIONS.map(r => r + ' (' + REGION_DISPLAY_NAMES[r] + ')').join(', ');
      req.error(400, `Invalid region: ${region}. Supported regions: ${regionList}`);
      return '';
    }

    const topologyConfig = getDeploymentTopologyConfig(deploymentModel as DeploymentModel);
    logger.info(`Validated deployment topology for tenant ${tenantId}: ${deploymentModel} in ${region}`);

    return JSON.stringify(topologyConfig);
  }

  /**
   * Register a connected SAP system with full validation.
   * Enforces max 20 systems per tenant, validates connection type
   * compatibility with system type, and release version.
   *
   * Validates: Requirements 24.3, 24.4, 24.5, 24.8
   */
  private async handleRegisterSystem(req: any): Promise<string> {
    const {
      tenantId, systemId, systemType, release, connectionType,
      endpoint, authMethod, modules, documentTypes,
      iamMonitoring, vulnerabilityScanning,
    } = req.data;
    const logger = cds.log('deployment-topology');

    // Validate required fields
    if (!tenantId || !systemId || !systemType || !release || !connectionType || !endpoint || !authMethod) {
      req.error(400, 'Missing required fields: tenantId, systemId, systemType, release, connectionType, endpoint, authMethod');
      return '';
    }

    // Validate system type
    const validSystemTypes: SystemType[] = ['S4HC', 'S4OP', 'ECC'];
    if (!validSystemTypes.includes(systemType as SystemType)) {
      req.error(400, `Invalid system type: ${systemType}. Must be one of: ${validSystemTypes.join(', ')}`);
      return '';
    }

    // Validate connection type compatibility
    if (!isValidConnectionType(systemType as SystemType, connectionType)) {
      const allowed = SYSTEM_CONNECTION_TYPES[systemType as SystemType];
      req.error(400, `Invalid connection type '${connectionType}' for system type '${systemType}'. Allowed: ${allowed.join(', ')}`);
      return '';
    }

    // Validate release version
    if (!isValidRelease(systemType as SystemType, release)) {
      let releaseHint = '';
      if (systemType === 'S4OP') releaseHint = 'S4OP requires release 1909 or above.';
      if (systemType === 'ECC') releaseHint = 'ECC requires Enhancement Package 7 (EHP7) or above.';
      req.error(400, `Invalid release '${release}' for system type '${systemType}'. ${releaseHint}`);
      return '';
    }

    // Validate principal propagation for S4OP user-context operations
    if (systemType === 'S4OP' && !supportsPrincipalPropagation(authMethod)) {
      req.error(400, `System type S4OP requires principal propagation. Auth method must be one of: ${PRINCIPAL_PROPAGATION_AUTH_METHODS.join(', ')}`);
      return '';
    }

    // Check system count limit
    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    const existingSystems = await SELECT.from(ConnectedSystems).where({ tenant_ID: tenantId });
    if (!canRegisterSystem(existingSystems.length)) {
      req.error(400, `Maximum system limit reached. Tenant can register up to ${MAX_SYSTEMS_PER_TENANT} systems. Current count: ${existingSystems.length}`);
      return '';
    }

    // Check for duplicate system ID
    const duplicate = existingSystems.some((s: any) => s.systemId === systemId);
    if (duplicate) {
      req.error(409, `System '${systemId}' is already registered for tenant '${tenantId}'.`);
      return '';
    }

    // Build system registration
    const registration: SystemRegistration = {
      systemId,
      systemType: systemType as SystemType,
      release,
      connectionConfig: {
        connectionType: connectionType as ConnectionConfig['connectionType'],
        endpoint,
        authMethod: authMethod as ConnectionConfig['authMethod'],
        credentialNamespace: `finsecure/${tenantId}/${systemId}`,
      },
      monitoringScope: {
        modules: modules || [],
        documentTypes: documentTypes || [],
        iamMonitoring: iamMonitoring ?? true,
        vulnerabilityScanning: vulnerabilityScanning ?? true,
      },
    };

    // Persist the system registration
    const systemEntry = {
      tenant_ID: tenantId,
      systemId: registration.systemId,
      systemType: registration.systemType,
      release: registration.release,
      connectionType: registration.connectionConfig.connectionType,
      status: 'active',
      lastSyncAt: new Date().toISOString(),
      monitoringScope: JSON.stringify(registration.monitoringScope),
    };

    await INSERT.into(ConnectedSystems).entries(systemEntry);

    logger.info(`System ${systemId} (${systemType} ${release}) registered for tenant ${tenantId} via ${connectionType}`);
    return `System '${systemId}' registered successfully. Connection: ${connectionType}, Interfaces: ${SYSTEM_INTERFACES[systemType as SystemType].join(', ')}`;
  }

  /**
   * Validate a BTP deployment region.
   *
   * Validates: Requirements 24.7
   */
  private async handleValidateRegion(req: any): Promise<boolean> {
    const { region } = req.data;
    return isValidRegion(region);
  }

  /**
   * Configure Cloud Connector for on-premise connectivity.
   * Ensures outbound-only connections (no inbound firewall rules required).
   *
   * Validates: Requirements 24.6
   */
  private async handleConfigureCloudConnector(req: any): Promise<string> {
    const { tenantId, systemId, locationId, virtualHost, virtualPort } = req.data;
    const logger = cds.log('deployment-topology');

    if (!tenantId || !systemId || !locationId || !virtualHost || !virtualPort) {
      req.error(400, 'Missing required fields: tenantId, systemId, locationId, virtualHost, virtualPort');
      return '';
    }

    // Validate cloud connector config
    if (!isValidCloudConnectorConfig({ locationId, virtualHost, virtualPort })) {
      req.error(400, 'Invalid Cloud Connector configuration. Ensure locationId and virtualHost are non-empty, and virtualPort is between 1 and 65535.');
      return '';
    }

    // Verify the system exists and is of type S4OP or ECC (requires Cloud Connector)
    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    const system = await SELECT.one.from(ConnectedSystems).where({ tenant_ID: tenantId, systemId });
    if (!system) {
      req.error(404, `System '${systemId}' not found for tenant '${tenantId}'.`);
      return '';
    }

    if (system.systemType !== 'S4OP' && system.systemType !== 'ECC') {
      req.error(400, `Cloud Connector is only applicable for on-premise systems (S4OP, ECC). System '${systemId}' is type '${system.systemType}'.`);
      return '';
    }

    // Build Cloud Connector configuration (outbound-only, no inbound firewall rules)
    const ccConfig: CloudConnectorConfig = {
      locationId,
      virtualHost,
      virtualPort,
      protocol: system.systemType === 'S4OP' ? 'HTTP' : 'RFC',
      sncEnabled: true,
      principalPropagationType: 'X.509',
      inboundRequired: false,
    };

    // Update the system with Cloud Connector configuration
    await UPDATE(ConnectedSystems)
      .where({ tenant_ID: tenantId, systemId })
      .set({
        cloudConnectorConfig: JSON.stringify(ccConfig),
      });

    logger.info(`Cloud Connector configured for system ${systemId} (tenant ${tenantId}): ${virtualHost}:${virtualPort} via location ${locationId}. Outbound-only, no inbound firewall rules required.`);
    return `Cloud Connector configured for system '${systemId}'. Location: ${locationId}, Virtual mapping: ${virtualHost}:${virtualPort}. No inbound firewall rules required.`;
  }

  /**
   * Enable parallel monitoring for ECC + S/4HANA during migration.
   * Unified alerting and dashboard views across both source systems.
   *
   * Validates: Requirements 24.9
   */
  private async handleEnableParallelMonitoring(req: any): Promise<string> {
    const { tenantId, eccSystemId, s4SystemId } = req.data;
    const logger = cds.log('deployment-topology');

    if (!tenantId || !eccSystemId || !s4SystemId) {
      req.error(400, 'Missing required fields: tenantId, eccSystemId, s4SystemId');
      return '';
    }

    // Verify both systems exist
    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    const eccSystem = await SELECT.one.from(ConnectedSystems).where({ tenant_ID: tenantId, systemId: eccSystemId });
    const s4System = await SELECT.one.from(ConnectedSystems).where({ tenant_ID: tenantId, systemId: s4SystemId });

    if (!eccSystem) {
      req.error(404, `ECC system '${eccSystemId}' not found for tenant '${tenantId}'.`);
      return '';
    }
    if (!s4System) {
      req.error(404, `S/4HANA system '${s4SystemId}' not found for tenant '${tenantId}'.`);
      return '';
    }

    // Validate system types for parallel monitoring
    if (!isValidParallelMonitoringConfig(eccSystem.systemType as SystemType, s4System.systemType as SystemType)) {
      req.error(400, `Parallel monitoring requires one ECC system and one S/4HANA system (S4HC or S4OP). Got: ${eccSystem.systemType} and ${s4System.systemType}`);
      return '';
    }

    // Configure parallel monitoring
    const parallelConfig: ParallelMonitoringConfig = {
      tenantId,
      eccSystemId,
      s4SystemId,
      unifiedAlerting: true,
      unifiedDashboard: true,
      migrationStartDate: new Date().toISOString(),
    };

    // Update both systems with parallel monitoring flag
    await UPDATE(ConnectedSystems)
      .where({ tenant_ID: tenantId, systemId: eccSystemId })
      .set({ parallelMonitoring: JSON.stringify({ paired: s4SystemId, role: 'source', config: parallelConfig }) });

    await UPDATE(ConnectedSystems)
      .where({ tenant_ID: tenantId, systemId: s4SystemId })
      .set({ parallelMonitoring: JSON.stringify({ paired: eccSystemId, role: 'target' }) });

    logger.info(`Parallel monitoring enabled for tenant ${tenantId}: ECC(${eccSystemId}) <-> S/4(${s4SystemId}). Unified alerting and dashboard active.`);
    return `Parallel monitoring enabled. ECC system '${eccSystemId}' paired with S/4HANA system '${s4SystemId}'. Unified alerting and dashboard views are active.`;
  }

  /**
   * Get the deployment status and topology summary for a tenant.
   */
  private async handleGetDeploymentStatus(req: any): Promise<string> {
    const { tenantId } = req.data;
    const logger = cds.log('deployment-topology');

    if (!tenantId) {
      req.error(400, 'tenantId is required');
      return '';
    }

    const db = await cds.connect.to('db');
    const { Tenants, ConnectedSystems } = db.entities('finsecure.ai');

    const tenant = await SELECT.one.from(Tenants).where({ ID: tenantId });
    if (!tenant) {
      req.error(404, `Tenant '${tenantId}' not found.`);
      return '';
    }

    const systems = await SELECT.from(ConnectedSystems).where({ tenant_ID: tenantId });
    const topologyConfig = getDeploymentTopologyConfig(tenant.deploymentModel as DeploymentModel);

    const status = {
      tenantId,
      deploymentModel: tenant.deploymentModel,
      region: tenant.region,
      regionName: REGION_DISPLAY_NAMES[tenant.region as Region] || tenant.region,
      topology: topologyConfig,
      connectedSystems: {
        count: systems.length,
        maxAllowed: MAX_SYSTEMS_PER_TENANT,
        systems: systems.map((s: any) => ({
          systemId: s.systemId,
          systemType: s.systemType,
          connectionType: s.connectionType,
          status: s.status,
        })),
      },
    };

    logger.info(`Deployment status retrieved for tenant ${tenantId}`);
    return JSON.stringify(status);
  }
}
