using { finsecure.ai as db } from '../../db/schema';

/**
 * Compliance Engine Service
 * Evaluates compliance controls, manages compliance packs, generates evidence,
 * produces audit-ready reports, and calculates GRC maturity scores.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 25.4, 25.5, 25.7
 */
service ComplianceEngineService @(requires: 'system-user') {

  /** Compliance controls for evaluation */
  entity ComplianceControls as projection on db.ComplianceControls;
  entity ControlEvidence as projection on db.ControlEvidence;
  entity Tenants as projection on db.Tenants;
  entity TenantCompliancePacks as projection on db.TenantCompliancePacks;
  entity Alerts as projection on db.Alerts;

  /**
   * Evaluate a single compliance control and record evidence.
   * Records PASS, FAIL, or WARNING status with evidence details.
   */
  action evaluateControl(
    tenantId  : String(36),
    controlId : String(36)
  ) returns LargeString;

  /**
   * Run scheduled evaluations for all active controls for a tenant.
   * Respects configurable intervals (1 hour to 30 days, default daily).
   */
  action runScheduledEvaluations(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Generate compliance report for a framework and reporting period.
   * Within 60s for <= 12 months, within 5 min for > 12 months.
   */
  action generateReport(
    tenantId  : String(36),
    framework : String(50),
    startDate : String,
    endDate   : String
  ) returns LargeString;

  /**
   * Calculate compliance percentage per framework.
   * Formula: pass / (pass + fail + warning) * 100
   */
  action calculateCompliancePercentage(
    tenantId  : String(36),
    framework : String(50)
  ) returns Decimal(5,2);

  /**
   * Calculate GRC maturity score on CMMI 1-5 scale.
   */
  action calculateGRCMaturityScore(
    tenantId : String(36)
  ) returns Decimal(3,2);

  /**
   * Activate a compliance pack for a tenant.
   * Provisions predefined controls for the selected framework.
   */
  action activateCompliancePack(
    tenantId : String(36),
    packId   : String(20)
  ) returns LargeString;
}
