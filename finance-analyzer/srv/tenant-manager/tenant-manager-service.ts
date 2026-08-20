import cds = require('@sap/cds');
import {
  TenantThresholds,
  SystemRegistration,
} from '../types';
import { CompliancePackId, Region, SystemType } from '../types/enums';
import {
  createTenantSchema,
  dropTenantSchema,
  provisionAICorePipeline,
  deprovisionAICorePipeline,
  storeCredentials,
  deleteCredentials,
} from './provisioning-helpers';

// Use any for CDS service class as @cap-js/cds-types may not be installed
const { ApplicationService } = cds;

/** Payload received from SAP SaaS Provisioning Service on subscribe */
export interface SubscriptionPayload {
  subscribedTenantId: string;
  subscribedSubdomain: string;
  subscribedSubaccountId: string;
  eventType: string;
  globalAccountGUID?: string;
  subscribedLicenseType?: string;
  subscribedCrmData?: Record<string, string>;
}

/** Status of a tenant in the registry */
export type TenantStatus = 'active' | 'provisioning' | 'deprovisioning' | 'error' | 'pending_deletion';

/** Result of a deletion operation step */
interface DeletionStepResult {
  step: string;
  success: boolean;
  error?: string;
}

/** Maximum time in milliseconds allowed for provisioning (300 seconds) */
const PROVISIONING_TIMEOUT_MS = 300_000;

/** Maximum time in milliseconds allowed for rollback (120 seconds) */
const ROLLBACK_TIMEOUT_MS = 120_000;

/** Maximum retry attempts for deletion steps */
const MAX_DELETION_RETRIES = 3;

/** Default deletion window in hours */
const DELETION_WINDOW_HOURS = 72;

/** Default region for new tenants */
const DEFAULT_REGION: Region = 'us10';

/**
 * Tenant Manager Service
 *
 * Handles tenant lifecycle (provisioning, configuration, deletion)
 * via SAP SaaS Provisioning Service callbacks.
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6
 */
export default class TenantManagerService extends (ApplicationService as any) {
  async init() {
    // Register SaaS Provisioning callbacks
    this.on('UPDATE', 'tenant', async (req: any) => {
      // Handles subscription via mtxs dependency mechanism
      const { subscribedTenantId } = req.data;
      return this.onSubscribe(subscribedTenantId, req.data);
    });

    this.on('DELETE', 'tenant', async (req: any) => {
      const { subscribedTenantId } = req.data;
      return this.onUnsubscribe(subscribedTenantId);
    });

    // Register custom actions
    this.on('registerSystem', async (req: any) => {
      const { tenantId, systemId, systemType, release, connectionType, endpoint, authMethod, modules, documentTypes, iamMonitoring, vulnerabilityScanning } = req.data;
      const config: SystemRegistration = {
        systemId,
        systemType: systemType as SystemType,
        release,
        connectionConfig: {
          connectionType: connectionType as 'EVENT_MESH' | 'CLOUD_CONNECTOR' | 'API',
          endpoint,
          authMethod: authMethod as 'OAUTH2' | 'BASIC' | 'CERTIFICATE',
          credentialNamespace: `finsecure/${tenantId}/${systemId}`,
        },
        monitoringScope: {
          modules: modules || [],
          documentTypes: documentTypes || [],
          iamMonitoring: iamMonitoring ?? true,
          vulnerabilityScanning: vulnerabilityScanning ?? true,
        },
      };
      await this.registerSystem(tenantId, config);
      return `System ${systemId} registered for tenant ${tenantId}`;
    });

    this.on('manageCompliancePacks', async (req: any) => {
      const { tenantId, packs } = req.data;
      await this.manageCompliancePacks(tenantId, packs as CompliancePackId[]);
      return `Compliance packs updated for tenant ${tenantId}`;
    });

    this.on('updateThresholds', async (req: any) => {
      const { tenantId, ...thresholds } = req.data;
      // Filter out null/undefined values
      const filteredThresholds: Partial<TenantThresholds> = {};
      for (const [key, value] of Object.entries(thresholds)) {
        if (value !== null && value !== undefined) {
          (filteredThresholds as any)[key] = value;
        }
      }
      await this.updateThresholds(tenantId, filteredThresholds);
      return `Thresholds updated for tenant ${tenantId}`;
    });

    await super.init();
  }

  /**
   * SaaS Provisioning callback: provision new tenant.
   * Creates HANA schema, registers in tenant registry, provisions AI Core pipeline.
   * Must complete within 300 seconds or rollback.
   *
   * Validates: Requirements 1.1, 1.5
   */
  async onSubscribe(tenantId: string, payload: SubscriptionPayload): Promise<string> {
    const logger = cds.log('tenant-manager');
    logger.info(`Provisioning tenant: ${tenantId}, subdomain: ${payload.subscribedSubdomain}`);

    const startTime = Date.now();
    const provisioned: { schema: boolean; registry: boolean; aiCore: boolean } = {
      schema: false,
      registry: false,
      aiCore: false,
    };

    try {
      // Create a timeout promise that rejects after 300 seconds
      const result = await this.withTimeout(
        this.provisionTenant(tenantId, payload, provisioned),
        PROVISIONING_TIMEOUT_MS,
        `Provisioning exceeded ${PROVISIONING_TIMEOUT_MS / 1000}s timeout`
      );

      const elapsed = Date.now() - startTime;
      logger.info(`Tenant ${tenantId} provisioned in ${elapsed}ms`);

      return result;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      logger.error(`Provisioning failed for tenant ${tenantId} after ${elapsed}ms: ${error.message}`);

      // Rollback partially created resources within 120 seconds
      await this.rollbackProvisioning(tenantId, provisioned);

      throw new Error(`Tenant provisioning failed: ${error.message}`);
    }
  }

  /**
   * Internal provisioning workflow: create schema, register, provision AI Core.
   */
  private async provisionTenant(
    tenantId: string,
    payload: SubscriptionPayload,
    provisioned: { schema: boolean; registry: boolean; aiCore: boolean }
  ): Promise<string> {
    const db = await cds.connect.to('db');
    const { Tenants, TenantThresholds: TenantThresholdsEntity } = db.entities('finsecure.ai');

    // Step 1: Create HANA schema for tenant isolation
    await createTenantSchema(tenantId);
    provisioned.schema = true;

    // Step 2: Register tenant in the tenant registry
    const tenantEntry = {
      ID: tenantId,
      subdomain: payload.subscribedSubdomain,
      displayName: payload.subscribedSubdomain,
      region: DEFAULT_REGION,
      deploymentModel: 'multi-tenant',
      status: 'provisioning',
      provisionedAt: new Date().toISOString(),
    };

    await INSERT.into(Tenants).entries(tenantEntry);
    provisioned.registry = true;

    // Step 3: Create default thresholds for the tenant
    const defaultThresholds = {
      tenant_ID: tenantId,
      riskScoreAlertThreshold: 70,
      behavioralSensitivity: 5,
      sodLookbackDays: 90,
      vendorBankChangeHours: 48,
      dormantAccountDays: 90,
      roundNumberThreshold: 10000,
      dormancyPeriodDays: 180,
      businessHoursStart: 8,
      businessHoursEnd: 18,
      paymentFlagThreshold: 70,
      paymentAmountFactor: 3.0,
      massDataRecordLimit: 10000,
      massDataVolumeMB: 50,
      maxFirefighterHours: 8,
      threeWayMatchTolerance: 0.02,
      grirClearingDays: 30,
      mlRetrainingFrequency: 'WEEKLY',
      scanFrequency: 'WEEKLY',
    };

    await INSERT.into(TenantThresholdsEntity).entries(defaultThresholds);

    // Step 4: Provision AI Core training pipeline
    await provisionAICorePipeline(tenantId);
    provisioned.aiCore = true;

    // Step 5: Update tenant status to active
    await UPDATE(Tenants).where({ ID: tenantId }).set({ status: 'active' });

    // Return the tenant URL (used by SaaS Provisioning Service)
    return `https://${payload.subscribedSubdomain}.finsecure-ai.cfapps.${DEFAULT_REGION}.hana.ondemand.com`;
  }

  /**
   * Rollback partially created resources within 120 seconds.
   *
   * Validates: Requirements 1.5
   */
  private async rollbackProvisioning(
    tenantId: string,
    provisioned: { schema: boolean; registry: boolean; aiCore: boolean }
  ): Promise<void> {
    const logger = cds.log('tenant-manager');
    logger.warn(`Rolling back provisioning for tenant ${tenantId}`);

    try {
      await this.withTimeout(
        this.executeRollback(tenantId, provisioned),
        ROLLBACK_TIMEOUT_MS,
        `Rollback exceeded ${ROLLBACK_TIMEOUT_MS / 1000}s timeout`
      );
      logger.info(`Rollback completed for tenant ${tenantId}`);
    } catch (rollbackError: any) {
      logger.error(`Rollback failed for tenant ${tenantId}: ${rollbackError.message}`);
      // Mark tenant as error state for manual intervention
      try {
        const db = await cds.connect.to('db');
        const { Tenants } = db.entities('finsecure.ai');
        await UPDATE(Tenants).where({ ID: tenantId }).set({ status: 'error' });
      } catch {
        // Best effort - if we can't update the registry either, log and continue
        logger.error(`Failed to update tenant ${tenantId} status to error`);
      }
    }
  }

  /**
   * Execute the actual rollback steps in reverse order.
   */
  private async executeRollback(
    tenantId: string,
    provisioned: { schema: boolean; registry: boolean; aiCore: boolean }
  ): Promise<void> {
    const logger = cds.log('tenant-manager');

    // Rollback in reverse order
    if (provisioned.aiCore) {
      try {
        await deprovisionAICorePipeline(tenantId);
        logger.info(`Rolled back AI Core pipeline for tenant ${tenantId}`);
      } catch (e: any) {
        logger.error(`Failed to rollback AI Core pipeline: ${e.message}`);
      }
    }

    if (provisioned.registry) {
      try {
        const db = await cds.connect.to('db');
        const { Tenants, TenantThresholds: TenantThresholdsEntity } = db.entities('finsecure.ai');
        await DELETE.from(TenantThresholdsEntity).where({ tenant_ID: tenantId });
        await DELETE.from(Tenants).where({ ID: tenantId });
        logger.info(`Rolled back registry entry for tenant ${tenantId}`);
      } catch (e: any) {
        logger.error(`Failed to rollback registry: ${e.message}`);
      }
    }

    if (provisioned.schema) {
      try {
        await dropTenantSchema(tenantId);
        logger.info(`Rolled back HANA schema for tenant ${tenantId}`);
      } catch (e: any) {
        logger.error(`Failed to rollback schema: ${e.message}`);
      }
    }
  }

  /**
   * SaaS Provisioning callback: deprovision tenant.
   * Schedules tenant data removal within 72 hours.
   * Retries up to 3 times on failure, flags for manual remediation if exhausted.
   *
   * Validates: Requirements 1.4, 1.6
   */
  async onUnsubscribe(tenantId: string): Promise<void> {
    const logger = cds.log('tenant-manager');
    logger.info(`Unsubscribing tenant: ${tenantId}`);

    const db = await cds.connect.to('db');
    const { Tenants } = db.entities('finsecure.ai');

    // Schedule deletion within 72 hours
    const deletionDeadline = new Date();
    deletionDeadline.setHours(deletionDeadline.getHours() + DELETION_WINDOW_HOURS);

    await UPDATE(Tenants).where({ ID: tenantId }).set({
      status: 'deprovisioning',
      deletionScheduled: deletionDeadline.toISOString(),
    });

    // Execute deletion with retry logic
    const deletionSteps: Array<{ name: string; fn: () => Promise<void> }> = [
      {
        name: 'delete_credentials',
        fn: () => deleteCredentials(tenantId),
      },
      {
        name: 'deprovision_ai_core',
        fn: () => deprovisionAICorePipeline(tenantId),
      },
      {
        name: 'delete_tenant_data',
        fn: () => this.deleteTenantData(tenantId),
      },
      {
        name: 'drop_schema',
        fn: () => dropTenantSchema(tenantId),
      },
    ];

    const failedSteps: DeletionStepResult[] = [];

    for (const step of deletionSteps) {
      const result = await this.executeWithRetry(step.name, step.fn, MAX_DELETION_RETRIES);
      if (!result.success) {
        failedSteps.push(result);
      }
    }

    if (failedSteps.length > 0) {
      // Flag for manual remediation
      logger.error(
        `Tenant ${tenantId} deletion partially failed. Failed steps: ${failedSteps.map(s => s.step).join(', ')}`
      );

      await UPDATE(Tenants).where({ ID: tenantId }).set({
        status: 'error',
      });

      // Notify platform administrator
      await this.notifyAdminDeletionFailure(tenantId, failedSteps);
    } else {
      // Record deletion confirmation
      await UPDATE(Tenants).where({ ID: tenantId }).set({
        status: 'pending_deletion',
      });

      // Remove tenant registry entry
      await DELETE.from(Tenants).where({ ID: tenantId });
      logger.info(`Tenant ${tenantId} fully deprovisioned`);
    }
  }

  /**
   * Execute a function with retry logic.
   * Retries up to maxRetries times on failure.
   *
   * Validates: Requirements 1.6
   */
  private async executeWithRetry(
    stepName: string,
    fn: () => Promise<void>,
    maxRetries: number
  ): Promise<DeletionStepResult> {
    const logger = cds.log('tenant-manager');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await fn();
        return { step: stepName, success: true };
      } catch (error: any) {
        logger.warn(
          `Step "${stepName}" failed (attempt ${attempt}/${maxRetries}): ${error.message}`
        );

        if (attempt === maxRetries) {
          return { step: stepName, success: false, error: error.message };
        }

        // Brief pause between retries (exponential backoff)
        await this.delay(1000 * Math.pow(2, attempt - 1));
      }
    }

    return { step: stepName, success: false, error: 'Max retries exhausted' };
  }

  /**
   * Delete all tenant-specific data from the database.
   */
  private async deleteTenantData(tenantId: string): Promise<void> {
    const db = await cds.connect.to('db');
    const entities = db.entities('finsecure.ai');

    // Delete all tenant-scoped data in dependency order
    const tenantScopedEntities = [
      'TenantCompliancePacks',
      'ConnectedSystems',
      'TenantThresholds',
      'MLModelFeedback',
      'MLModels',
      'PlaybookExecutions',
      'Playbooks',
      'ControlEvidence',
      'ComplianceControls',
      'InvestigationNotes',
      'EvidenceItems',
      'Investigations',
      'Alerts',
      'SoDViolations',
      'SoDRules',
      'ProfileDimensions',
      'BehavioralProfiles',
      'DeadLetterQueue',
      'DeduplicationLog',
      'Transactions',
      'VendorBankChanges',
      'AccessReviewTasks',
      'AccessReviewCampaigns',
      'VulnerabilityFindings',
      'CustomAgents',
      'AuditTrailEntries',
      'ScheduledReports',
      'GeneratedReports',
      'AIGeneratedContent',
      'EventProcessingMetrics',
    ];

    for (const entityName of tenantScopedEntities) {
      const entity = entities[entityName];
      if (entity) {
        try {
          // Some entities use tenantId field, others use tenant_ID association
          if (entityName === 'TenantCompliancePacks' || entityName === 'ConnectedSystems' || entityName === 'TenantThresholds') {
            await DELETE.from(entity).where({ tenant_ID: tenantId });
          } else {
            await DELETE.from(entity).where({ tenantId });
          }
        } catch {
          // Entity may not have tenantId field - skip silently
        }
      }
    }
  }

  /**
   * Register a connected SAP system for a tenant.
   * Stores credentials in Credential Store with tenant-scoped namespace.
   *
   * Validates: Requirements 1.2
   */
  async registerSystem(tenantId: string, config: SystemRegistration): Promise<void> {
    const logger = cds.log('tenant-manager');
    logger.info(`Registering system ${config.systemId} for tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    // Store credentials in Credential Store with tenant-scoped namespace
    const credentialNamespace = `finsecure/${tenantId}/${config.systemId}`;
    await storeCredentials(credentialNamespace, {
      connectionType: config.connectionConfig.connectionType,
      endpoint: config.connectionConfig.endpoint,
      authMethod: config.connectionConfig.authMethod,
    });

    // Register the system in the database
    const systemEntry = {
      tenant_ID: tenantId,
      systemId: config.systemId,
      systemType: config.systemType,
      release: config.release,
      connectionType: config.connectionConfig.connectionType,
      status: 'active',
      lastSyncAt: new Date().toISOString(),
      monitoringScope: JSON.stringify({
        modules: config.monitoringScope.modules,
        documentTypes: config.monitoringScope.documentTypes,
        iamMonitoring: config.monitoringScope.iamMonitoring,
        vulnerabilityScanning: config.monitoringScope.vulnerabilityScanning,
      }),
    };

    await INSERT.into(ConnectedSystems).entries(systemEntry);
    logger.info(`System ${config.systemId} registered with namespace ${credentialNamespace}`);
  }

  /**
   * Activate/deactivate compliance packs for a tenant.
   * Manages which compliance frameworks are active for the tenant.
   *
   * Validates: Requirements 1.1
   */
  async manageCompliancePacks(tenantId: string, packs: CompliancePackId[]): Promise<void> {
    const logger = cds.log('tenant-manager');
    logger.info(`Managing compliance packs for tenant ${tenantId}: ${packs.join(', ')}`);

    const db = await cds.connect.to('db');
    const { TenantCompliancePacks } = db.entities('finsecure.ai');

    // Get current packs
    const currentPacks = await SELECT.from(TenantCompliancePacks).where({ tenant_ID: tenantId });
    const currentPackIds = new Set(currentPacks.map((p: any) => p.packId));

    // Deactivate packs not in the new list
    for (const current of currentPacks) {
      if (!packs.includes(current.packId as CompliancePackId)) {
        await UPDATE(TenantCompliancePacks)
          .where({ ID: current.ID })
          .set({ activated: false });
      }
    }

    // Activate or add packs in the new list
    const now = new Date().toISOString();
    for (const packId of packs) {
      if (currentPackIds.has(packId)) {
        // Activate existing pack
        await UPDATE(TenantCompliancePacks)
          .where({ tenant_ID: tenantId, packId })
          .set({ activated: true, activatedAt: now });
      } else {
        // Add new pack
        await INSERT.into(TenantCompliancePacks).entries({
          tenant_ID: tenantId,
          packId,
          activated: true,
          activatedAt: now,
        });
      }
    }

    logger.info(`Compliance packs updated for tenant ${tenantId}`);
  }

  /**
   * Update tenant-specific thresholds.
   * Validates threshold ranges and applies partial updates.
   *
   * Validates: Requirements 1.1
   */
  async updateThresholds(tenantId: string, thresholds: Partial<TenantThresholds>): Promise<void> {
    const logger = cds.log('tenant-manager');
    logger.info(`Updating thresholds for tenant ${tenantId}`);

    // Validate threshold ranges
    this.validateThresholds(thresholds);

    const db = await cds.connect.to('db');
    const { TenantThresholds: TenantThresholdsEntity } = db.entities('finsecure.ai');

    // Build update payload from provided thresholds
    const updatePayload = this.buildThresholdUpdatePayload(thresholds);

    if (Object.keys(updatePayload).length > 0) {
      await UPDATE(TenantThresholdsEntity)
        .where({ tenant_ID: tenantId })
        .set(updatePayload);
    }

    logger.info(`Thresholds updated for tenant ${tenantId}`);
  }

  /**
   * Build the database update payload from threshold input.
   * Maps interface field names to database column names.
   */
  private buildThresholdUpdatePayload(thresholds: Partial<TenantThresholds>): Record<string, any> {
    // Mapping from TenantThresholds interface fields to DB columns
    const fieldMapping: Record<string, string> = {
      riskScoreAlertThreshold: 'riskScoreAlertThreshold',
      behavioralSensitivity: 'behavioralSensitivity',
      sodLookbackDays: 'sodLookbackDays',
      vendorBankChangeHours: 'vendorBankChangeHours',
      dormantAccountDays: 'dormantAccountDays',
      roundNumberThreshold: 'roundNumberThreshold',
      dormancyPeriodDays: 'dormancyPeriodDays',
      businessHoursStart: 'businessHoursStart',
      businessHoursEnd: 'businessHoursEnd',
      paymentFlagThreshold: 'paymentFlagThreshold',
      paymentAmountFactor: 'paymentAmountFactor',
      massDataRecordLimit: 'massDataRecordLimit',
      massDataVolumeLimit: 'massDataVolumeMB',
      maxFirefighterHours: 'maxFirefighterHours',
      threeWayMatchTolerance: 'threeWayMatchTolerance',
      grirClearingDays: 'grirClearingDays',
    };

    const updatePayload: Record<string, any> = {};
    for (const [interfaceField, dbColumn] of Object.entries(fieldMapping)) {
      const value = (thresholds as any)[interfaceField];
      if (value !== undefined && value !== null) {
        updatePayload[dbColumn] = value;
      }
    }

    return updatePayload;
  }

  /**
   * Validate threshold values against their allowed ranges.
   * Throws error if any threshold is out of range.
   */
  private validateThresholds(thresholds: Partial<TenantThresholds>): void {
    const validations: Array<{ field: string; value: number | undefined; min: number; max: number }> = [
      { field: 'riskScoreAlertThreshold', value: thresholds.riskScoreAlertThreshold, min: 1, max: 99 },
      { field: 'behavioralSensitivity', value: thresholds.behavioralSensitivity, min: 1, max: 10 },
      { field: 'sodLookbackDays', value: thresholds.sodLookbackDays, min: 1, max: 365 },
      { field: 'vendorBankChangeHours', value: thresholds.vendorBankChangeHours, min: 1, max: 720 },
      { field: 'businessHoursStart', value: thresholds.businessHoursStart, min: 0, max: 23 },
      { field: 'businessHoursEnd', value: thresholds.businessHoursEnd, min: 0, max: 23 },
      { field: 'maxFirefighterHours', value: thresholds.maxFirefighterHours, min: 1, max: 72 },
      { field: 'grirClearingDays', value: thresholds.grirClearingDays, min: 7, max: 180 },
    ];

    for (const { field, value, min, max } of validations) {
      if (value !== undefined && (value < min || value > max)) {
        throw new Error(`${field} must be between ${min} and ${max}, got ${value}`);
      }
    }
  }

  /**
   * Notify platform administrator of deletion failures.
   */
  private async notifyAdminDeletionFailure(tenantId: string, failedSteps: DeletionStepResult[]): Promise<void> {
    const logger = cds.log('tenant-manager');
    logger.error(
      `ADMIN NOTIFICATION: Tenant ${tenantId} requires manual remediation. ` +
      `Failed steps: ${JSON.stringify(failedSteps)}`
    );

    // In production, this would integrate with SAP Alert Notification Service
    // For now, log the failure for monitoring systems to pick up
    try {
      const auditLog = await cds.connect.to('audit-log');
      await (auditLog as any).log('security', {
        action: 'TENANT_DELETION_FAILED',
        data: {
          tenantId,
          failedSteps: failedSteps.map(s => ({ step: s.step, error: s.error })),
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Audit log unavailable - already logged to console
    }
  }

  /**
   * Execute a promise with a timeout.
   * Rejects with an error if the timeout is exceeded.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(message));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Delay execution for the specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
