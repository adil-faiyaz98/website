import * as fc from 'fast-check';

/**
 * Unit and property-based tests for DeploymentTopologyService.
 *
 * Tests the core deployment topology logic:
 * - Region validation (ca10, us10, us20)
 * - Deployment model validation (multi-tenant, single-tenant)
 * - System registration limits (max 20 per tenant)
 * - Connection type compatibility per system type
 * - Release version validation
 * - Principal propagation support
 * - Cloud Connector configuration validation
 * - Parallel monitoring configuration
 * - Deployment topology configuration
 *
 * Validates: Requirements 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9
 */

import {
  isValidRegion,
  isValidDeploymentModel,
  isValidConnectionType,
  canRegisterSystem,
  isValidRelease,
  supportsPrincipalPropagation,
  isValidCloudConnectorConfig,
  getDeploymentTopologyConfig,
  isValidParallelMonitoringConfig,
  MAX_SYSTEMS_PER_TENANT,
  VALID_REGIONS,
  SYSTEM_CONNECTION_TYPES,
  REGION_DISPLAY_NAMES,
} from '../../srv/deployment/deployment-topology-service';

// ============================================================================
// Unit Tests - Region Validation
// ============================================================================

describe('DeploymentTopologyService - Region Validation', () => {
  /**
   * Validates: Requirements 24.7
   */
  it('should accept valid BTP regions (ca10, us10, us20)', () => {
    expect(isValidRegion('ca10')).toBe(true);
    expect(isValidRegion('us10')).toBe(true);
    expect(isValidRegion('us20')).toBe(true);
  });

  it('should reject invalid regions', () => {
    expect(isValidRegion('eu10')).toBe(false);
    expect(isValidRegion('ap10')).toBe(false);
    expect(isValidRegion('')).toBe(false);
    expect(isValidRegion('CA10')).toBe(false); // case-sensitive
    expect(isValidRegion('us30')).toBe(false);
  });

  it('should have exactly 3 valid regions', () => {
    expect(VALID_REGIONS).toHaveLength(3);
    expect(VALID_REGIONS).toContain('ca10');
    expect(VALID_REGIONS).toContain('us10');
    expect(VALID_REGIONS).toContain('us20');
  });

  it('should have display names for all valid regions', () => {
    for (const region of VALID_REGIONS) {
      expect(REGION_DISPLAY_NAMES[region]).toBeDefined();
      expect(REGION_DISPLAY_NAMES[region].length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Unit Tests - Deployment Model Validation
// ============================================================================

describe('DeploymentTopologyService - Deployment Model Validation', () => {
  /**
   * Validates: Requirements 24.1, 24.2
   */
  it('should accept valid deployment models', () => {
    expect(isValidDeploymentModel('multi-tenant')).toBe(true);
    expect(isValidDeploymentModel('single-tenant')).toBe(true);
  });

  it('should reject invalid deployment models', () => {
    expect(isValidDeploymentModel('')).toBe(false);
    expect(isValidDeploymentModel('dedicated')).toBe(false);
    expect(isValidDeploymentModel('shared')).toBe(false);
    expect(isValidDeploymentModel('Multi-Tenant')).toBe(false);
  });
});

// ============================================================================
// Unit Tests - System Registration Limit
// ============================================================================

describe('DeploymentTopologyService - System Registration Limit', () => {
  /**
   * Validates: Requirements 24.8
   */
  it('should allow registration when under limit', () => {
    expect(canRegisterSystem(0)).toBe(true);
    expect(canRegisterSystem(10)).toBe(true);
    expect(canRegisterSystem(19)).toBe(true);
  });

  it('should reject registration at limit', () => {
    expect(canRegisterSystem(20)).toBe(false);
  });

  it('should reject registration over limit', () => {
    expect(canRegisterSystem(21)).toBe(false);
    expect(canRegisterSystem(100)).toBe(false);
  });

  it('should enforce maximum of 20 systems', () => {
    expect(MAX_SYSTEMS_PER_TENANT).toBe(20);
  });
});

// ============================================================================
// Unit Tests - Connection Type Compatibility
// ============================================================================

describe('DeploymentTopologyService - Connection Type Compatibility', () => {
  /**
   * Validates: Requirements 24.3
   */
  it('should allow EVENT_MESH and API for S4HC', () => {
    expect(isValidConnectionType('S4HC', 'EVENT_MESH')).toBe(true);
    expect(isValidConnectionType('S4HC', 'API')).toBe(true);
  });

  it('should reject CLOUD_CONNECTOR for S4HC', () => {
    expect(isValidConnectionType('S4HC', 'CLOUD_CONNECTOR')).toBe(false);
  });

  /**
   * Validates: Requirements 24.4
   */
  it('should allow CLOUD_CONNECTOR for S4OP', () => {
    expect(isValidConnectionType('S4OP', 'CLOUD_CONNECTOR')).toBe(true);
  });

  it('should reject EVENT_MESH and API for S4OP', () => {
    expect(isValidConnectionType('S4OP', 'EVENT_MESH')).toBe(false);
    expect(isValidConnectionType('S4OP', 'API')).toBe(false);
  });

  /**
   * Validates: Requirements 24.5
   */
  it('should allow CLOUD_CONNECTOR for ECC', () => {
    expect(isValidConnectionType('ECC', 'CLOUD_CONNECTOR')).toBe(true);
  });

  it('should reject EVENT_MESH and API for ECC', () => {
    expect(isValidConnectionType('ECC', 'EVENT_MESH')).toBe(false);
    expect(isValidConnectionType('ECC', 'API')).toBe(false);
  });

  it('should reject unknown system types', () => {
    expect(isValidConnectionType('UNKNOWN' as any, 'API')).toBe(false);
  });
});

// ============================================================================
// Unit Tests - Release Version Validation
// ============================================================================

describe('DeploymentTopologyService - Release Version Validation', () => {
  /**
   * Validates: Requirements 24.3
   */
  it('should accept any non-empty release for S4HC', () => {
    expect(isValidRelease('S4HC', '2302')).toBe(true);
    expect(isValidRelease('S4HC', '2023.01')).toBe(true);
    expect(isValidRelease('S4HC', 'latest')).toBe(true);
  });

  it('should reject empty release for S4HC', () => {
    expect(isValidRelease('S4HC', '')).toBe(false);
  });

  /**
   * Validates: Requirements 24.4
   */
  it('should accept S4OP releases 1909 and above', () => {
    expect(isValidRelease('S4OP', '1909')).toBe(true);
    expect(isValidRelease('S4OP', '2020')).toBe(true);
    expect(isValidRelease('S4OP', '2021')).toBe(true);
    expect(isValidRelease('S4OP', '2023')).toBe(true);
  });

  it('should reject S4OP releases below 1909', () => {
    expect(isValidRelease('S4OP', '1809')).toBe(false);
    expect(isValidRelease('S4OP', '1610')).toBe(false);
    expect(isValidRelease('S4OP', '1511')).toBe(false);
  });

  /**
   * Validates: Requirements 24.5
   */
  it('should accept ECC EHP7 and above', () => {
    expect(isValidRelease('ECC', 'EHP7')).toBe(true);
    expect(isValidRelease('ECC', 'EHP8')).toBe(true);
    expect(isValidRelease('ECC', '7')).toBe(true);
    expect(isValidRelease('ECC', '8')).toBe(true);
  });

  it('should reject ECC below EHP7', () => {
    expect(isValidRelease('ECC', 'EHP6')).toBe(false);
    expect(isValidRelease('ECC', 'EHP5')).toBe(false);
    expect(isValidRelease('ECC', '6')).toBe(false);
    expect(isValidRelease('ECC', '5')).toBe(false);
  });
});

// ============================================================================
// Unit Tests - Principal Propagation
// ============================================================================

describe('DeploymentTopologyService - Principal Propagation', () => {
  /**
   * Validates: Requirements 24.4
   */
  it('should support OAUTH2 for principal propagation', () => {
    expect(supportsPrincipalPropagation('OAUTH2')).toBe(true);
  });

  it('should support CERTIFICATE for principal propagation', () => {
    expect(supportsPrincipalPropagation('CERTIFICATE')).toBe(true);
  });

  it('should not support BASIC auth for principal propagation', () => {
    expect(supportsPrincipalPropagation('BASIC')).toBe(false);
  });
});

// ============================================================================
// Unit Tests - Cloud Connector Configuration
// ============================================================================

describe('DeploymentTopologyService - Cloud Connector Configuration', () => {
  /**
   * Validates: Requirements 24.6
   */
  it('should accept valid Cloud Connector config', () => {
    expect(isValidCloudConnectorConfig({
      locationId: 'LOC1',
      virtualHost: 'sap-erp.internal',
      virtualPort: 443,
    })).toBe(true);
  });

  it('should reject empty locationId', () => {
    expect(isValidCloudConnectorConfig({
      locationId: '',
      virtualHost: 'sap-erp.internal',
      virtualPort: 443,
    })).toBe(false);
  });

  it('should reject empty virtualHost', () => {
    expect(isValidCloudConnectorConfig({
      locationId: 'LOC1',
      virtualHost: '',
      virtualPort: 443,
    })).toBe(false);
  });

  it('should reject invalid port numbers', () => {
    expect(isValidCloudConnectorConfig({
      locationId: 'LOC1',
      virtualHost: 'sap-erp.internal',
      virtualPort: 0,
    })).toBe(false);

    expect(isValidCloudConnectorConfig({
      locationId: 'LOC1',
      virtualHost: 'sap-erp.internal',
      virtualPort: -1,
    })).toBe(false);

    expect(isValidCloudConnectorConfig({
      locationId: 'LOC1',
      virtualHost: 'sap-erp.internal',
      virtualPort: 65536,
    })).toBe(false);
  });

  it('should accept port at boundaries (1, 65535)', () => {
    expect(isValidCloudConnectorConfig({
      locationId: 'LOC1',
      virtualHost: 'sap-erp.internal',
      virtualPort: 1,
    })).toBe(true);

    expect(isValidCloudConnectorConfig({
      locationId: 'LOC1',
      virtualHost: 'sap-erp.internal',
      virtualPort: 65535,
    })).toBe(true);
  });
});

// ============================================================================
// Unit Tests - Deployment Topology Configuration
// ============================================================================

describe('DeploymentTopologyService - Deployment Topology Config', () => {
  /**
   * Validates: Requirements 24.1
   */
  it('should configure multi-tenant with schema isolation', () => {
    const config = getDeploymentTopologyConfig('multi-tenant');
    expect(config.deploymentModel).toBe('multi-tenant');
    expect(config.isolation).toBe('schema');
    expect(config.hanaConfig.type).toBe('shared');
    expect(config.hanaConfig.isolationLevel).toBe('schema');
    expect(config.hanaConfig.servicePlan).toBe('hdi-shared');
    expect(config.aiCoreConfig.dedicatedInstance).toBe(false);
    expect(config.networkConfig.isolatedSegment).toBe(false);
    expect(config.targetMarket).toBe('mid-market');
    expect(config.transactionThreshold).toBe(50000);
  });

  /**
   * Validates: Requirements 24.2
   */
  it('should configure single-tenant with physical isolation', () => {
    const config = getDeploymentTopologyConfig('single-tenant');
    expect(config.deploymentModel).toBe('single-tenant');
    expect(config.isolation).toBe('physical');
    expect(config.hanaConfig.type).toBe('dedicated');
    expect(config.hanaConfig.isolationLevel).toBe('instance');
    expect(config.hanaConfig.servicePlan).toBe('hana');
    expect(config.aiCoreConfig.dedicatedInstance).toBe(true);
    expect(config.networkConfig.isolatedSegment).toBe(true);
    expect(config.targetMarket).toBe('enterprise');
    expect(config.complianceFrameworks).toContain('FedRAMP');
    expect(config.complianceFrameworks).toContain('CMMC');
    expect(config.complianceFrameworks).toContain('OSFI');
  });
});

// ============================================================================
// Unit Tests - Parallel Monitoring
// ============================================================================

describe('DeploymentTopologyService - Parallel Monitoring', () => {
  /**
   * Validates: Requirements 24.9
   */
  it('should validate ECC + S4HC as valid parallel config', () => {
    expect(isValidParallelMonitoringConfig('ECC', 'S4HC')).toBe(true);
  });

  it('should validate ECC + S4OP as valid parallel config', () => {
    expect(isValidParallelMonitoringConfig('ECC', 'S4OP')).toBe(true);
  });

  it('should reject ECC + ECC (not a migration)', () => {
    expect(isValidParallelMonitoringConfig('ECC', 'ECC')).toBe(false);
  });

  it('should reject S4HC + S4OP (no ECC source)', () => {
    expect(isValidParallelMonitoringConfig('S4HC', 'S4OP')).toBe(false);
  });

  it('should reject S4OP + S4HC (no ECC source)', () => {
    expect(isValidParallelMonitoringConfig('S4OP', 'S4HC')).toBe(false);
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('DeploymentTopologyService - Property-Based Tests', () => {
  /**
   * **Validates: Requirements 24.7**
   * Only ca10, us10, us20 are valid regions - all others must be rejected.
   */
  it('only the three specified regions are valid', () => {
    const validSet = new Set(['ca10', 'us10', 'us20']);
    const result = fc.check(
      fc.property(
        fc.string({ minLength: 0, maxLength: 10 }),
        (region) => {
          return isValidRegion(region) === validSet.has(region);
        }
      ),
      { numRuns: 500 }
    );
    expect(result.failed).toBe(false);
  });

  /**
   * **Validates: Requirements 24.8**
   * System registration is allowed if and only if currentCount < 20.
   */
  it('system registration respects 20-system limit', () => {
    const result = fc.check(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (count) => {
          return canRegisterSystem(count) === (count < MAX_SYSTEMS_PER_TENANT);
        }
      )
    );
    expect(result.failed).toBe(false);
  });

  /**
   * **Validates: Requirements 24.1, 24.2**
   * Deployment model is valid if and only if it's 'multi-tenant' or 'single-tenant'.
   */
  it('only multi-tenant and single-tenant are valid deployment models', () => {
    const validModels = new Set(['multi-tenant', 'single-tenant']);
    const result = fc.check(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }),
        (model) => {
          return isValidDeploymentModel(model) === validModels.has(model);
        }
      ),
      { numRuns: 500 }
    );
    expect(result.failed).toBe(false);
  });

  /**
   * **Validates: Requirements 24.3, 24.4, 24.5**
   * Connection type validation is consistent with the defined mapping.
   */
  it('connection type validation matches system type mapping', () => {
    const systemTypes: Array<'S4HC' | 'S4OP' | 'ECC'> = ['S4HC', 'S4OP', 'ECC'];
    const connectionTypes = ['EVENT_MESH', 'CLOUD_CONNECTOR', 'API'];

    const result = fc.check(
      fc.property(
        fc.constantFrom(...systemTypes),
        fc.constantFrom(...connectionTypes),
        (systemType, connectionType) => {
          const expected = SYSTEM_CONNECTION_TYPES[systemType].includes(connectionType);
          return isValidConnectionType(systemType, connectionType) === expected;
        }
      )
    );
    expect(result.failed).toBe(false);
  });

  /**
   * **Validates: Requirements 24.4**
   * S4OP releases 1909+ are valid, below 1909 are invalid.
   */
  it('S4OP release validation accepts only 1909 and above', () => {
    const result = fc.check(
      fc.property(
        fc.integer({ min: 1000, max: 3000 }),
        (version) => {
          const release = version.toString();
          return isValidRelease('S4OP', release) === (version >= 1909);
        }
      )
    );
    expect(result.failed).toBe(false);
  });

  /**
   * **Validates: Requirements 24.5**
   * ECC EHP validation accepts only EHP7 and above.
   */
  it('ECC release validation accepts EHP7+ only', () => {
    const result = fc.check(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        (ehpNum) => {
          const release = `EHP${ehpNum}`;
          return isValidRelease('ECC', release) === (ehpNum >= 7);
        }
      )
    );
    expect(result.failed).toBe(false);
  });

  /**
   * **Validates: Requirements 24.6**
   * Cloud Connector config requires valid locationId, virtualHost, and port in [1, 65535].
   */
  it('Cloud Connector config validates port range [1, 65535]', () => {
    const result = fc.check(
      fc.property(
        fc.integer({ min: -100, max: 70000 }),
        (port) => {
          const config = {
            locationId: 'LOC1',
            virtualHost: 'host.internal',
            virtualPort: port,
          };
          const expected = port >= 1 && port <= 65535;
          return isValidCloudConnectorConfig(config) === expected;
        }
      )
    );
    expect(result.failed).toBe(false);
  });

  /**
   * **Validates: Requirements 24.1, 24.2**
   * Multi-tenant always produces schema isolation; single-tenant always produces physical isolation.
   */
  it('deployment topology config matches isolation model', () => {
    const result = fc.check(
      fc.property(
        fc.constantFrom('multi-tenant' as const, 'single-tenant' as const),
        (model) => {
          const config = getDeploymentTopologyConfig(model);
          if (model === 'multi-tenant') {
            return config.isolation === 'schema' &&
              config.hanaConfig.type === 'shared' &&
              config.aiCoreConfig.dedicatedInstance === false;
          } else {
            return config.isolation === 'physical' &&
              config.hanaConfig.type === 'dedicated' &&
              config.aiCoreConfig.dedicatedInstance === true;
          }
        }
      )
    );
    expect(result.failed).toBe(false);
  });

  /**
   * **Validates: Requirements 24.9**
   * Parallel monitoring requires exactly one ECC and one S/4 system.
   */
  it('parallel monitoring requires ECC + S4 combination', () => {
    const allTypes: Array<'S4HC' | 'S4OP' | 'ECC'> = ['S4HC', 'S4OP', 'ECC'];
    const result = fc.check(
      fc.property(
        fc.constantFrom(...allTypes),
        fc.constantFrom(...allTypes),
        (type1, type2) => {
          const valid = isValidParallelMonitoringConfig(type1, type2);
          const expected = type1 === 'ECC' && (type2 === 'S4HC' || type2 === 'S4OP');
          return valid === expected;
        }
      )
    );
    expect(result.failed).toBe(false);
  });
});
