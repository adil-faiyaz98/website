using { finsecure.ai as db } from '../../db/schema';

/**
 * Tenant Manager Service
 * Handles tenant lifecycle (provisioning, configuration, deletion)
 * via SAP SaaS Provisioning Service callbacks.
 */
service TenantManagerService @(requires: 'system-user') {

  /** Tenants entity for registry operations */
  entity Tenants as projection on db.Tenants;
  entity TenantThresholds as projection on db.TenantThresholds;
  entity ConnectedSystems as projection on db.ConnectedSystems;
  entity TenantCompliancePacks as projection on db.TenantCompliancePacks;

  /** Register a connected SAP system for a tenant */
  action registerSystem(
    tenantId : String(36),
    systemId : String(50),
    systemType : String(10),
    release : String(20),
    connectionType : String(20),
    endpoint : String(500),
    authMethod : String(20),
    modules : array of String,
    documentTypes : array of String,
    iamMonitoring : Boolean,
    vulnerabilityScanning : Boolean
  ) returns String;

  /** Activate/deactivate compliance packs for a tenant */
  action manageCompliancePacks(
    tenantId : String(36),
    packs : array of String
  ) returns String;

  /** Update tenant-specific thresholds */
  action updateThresholds(
    tenantId : String(36),
    riskScoreAlertThreshold : Integer,
    behavioralSensitivity : Integer,
    sodLookbackDays : Integer,
    vendorBankChangeHours : Integer,
    dormantAccountDays : Integer,
    roundNumberThreshold : Decimal(15,2),
    dormancyPeriodDays : Integer,
    businessHoursStart : Integer,
    businessHoursEnd : Integer,
    paymentFlagThreshold : Integer,
    paymentAmountFactor : Decimal(5,2),
    massDataRecordLimit : Integer,
    massDataVolumeMB : Integer,
    maxFirefighterHours : Integer,
    threeWayMatchTolerance : Decimal(5,4),
    grirClearingDays : Integer
  ) returns String;
}
