using { finsecure.ai as db } from '../../db/schema';

/**
 * GRC Automation Service
 * Continuous monitoring of SAP security parameters, transport management,
 * and security audit logs with MITRE ATT&CK for SAP threat mapping.
 *
 * Validates: Requirements 25.1, 25.2, 25.3, 25.6, 25.8
 */
service GRCAutomationService @(requires: 'system-user') {

  /** Alerts entity for generating security alerts */
  entity Alerts as projection on db.Alerts;
  entity TenantThresholds as projection on db.TenantThresholds;
  entity ComplianceControls as projection on db.ComplianceControls;
  entity ControlEvidence as projection on db.ControlEvidence;

  /**
   * Monitor security parameters against baseline configuration.
   * Alerts within 5 minutes of deviation from expected values.
   */
  action checkSecurityParameters(
    tenantId : String(36),
    systemId : String(50),
    parameters : LargeString
  ) returns LargeString;

  /**
   * Analyze security audit log events (SM20/RSAU_READ_LOG).
   * Detects failed logons, unusual client logons, user lock/unlock,
   * RFC rejections, and critical transaction starts.
   */
  action analyzeSecurityAuditLog(
    tenantId : String(36),
    systemId : String(50),
    events   : LargeString
  ) returns LargeString;

  /**
   * Monitor transport management events.
   * Detects production bypass, auth table modifications, and
   * security code changes.
   */
  action monitorTransports(
    tenantId   : String(36),
    systemId   : String(50),
    transports : LargeString
  ) returns LargeString;

  /**
   * Map a security finding to MITRE ATT&CK for SAP framework.
   * Returns technique IDs, descriptions, and remediation recommendations.
   */
  action mapToMitreAttack(
    riskCategory    : String(30),
    riskIndicators  : LargeString,
    detectionMethod : String(25)
  ) returns LargeString;

  /**
   * Generate automated remediation recommendations for a finding.
   */
  action generateRemediationRecommendations(
    tenantId     : String(36),
    findingType  : String(50),
    findingDetails : LargeString
  ) returns LargeString;
}
