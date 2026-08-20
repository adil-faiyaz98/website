using { finsecure.ai as db } from '../../db/schema';

/**
 * SuccessFactors HCM Integration Service
 * Integrates SAP SuccessFactors HCM Core via SAP Integration Suite to receive
 * HR lifecycle events and correlate them with threat detection sensitivity.
 * Privacy-preserving: stores only risk classification and monitoring period,
 * NOT specific HR event type.
 *
 * Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7
 */
service SuccessFactorsIntegrationService @(requires: 'system-user') {

  /** Behavioral profiles for HR risk multiplier elevation */
  entity BehavioralProfiles as projection on db.BehavioralProfiles;
  entity Alerts as projection on db.Alerts;
  entity AuditTrailEntries as projection on db.AuditTrailEntries;
  entity ConnectedSystems as projection on db.ConnectedSystems;

  /**
   * Receive an HR lifecycle event from SuccessFactors via Integration Suite.
   * Supported events: termination, resignation, PIP, demotion, transfer,
   * leave, contractor end-date.
   * Privacy: only risk classification and monitoring period are stored.
   */
  action processHREvent(
    tenantId          : String(36),
    employeeId        : String(100),
    sapUserId         : String(12),
    eventCategory     : String(30),
    eventDate         : String(30),
    monitoringDays    : Integer,
    riskMultiplier    : Decimal(3,2)
  ) returns LargeString;

  /**
   * Verify offboarding compliance: check that terminated user accounts
   * are locked/deleted within SLA (default 24 hours).
   * Generates critical alert if access persists beyond the window.
   */
  action verifyOffboardingCompliance(
    tenantId   : String(36),
    sapUserId  : String(12),
    eventDate  : String(30),
    slaHours   : Integer
  ) returns LargeString;

  /**
   * Cross-reference SuccessFactors org assignments with SAP authorizations
   * to detect over-provisioned users retaining access no longer relevant
   * to their current organizational position.
   */
  action detectOverProvisionedAccess(
    tenantId        : String(36),
    sapUserId       : String(12),
    currentDept     : String(100),
    currentCostCenter : String(10),
    currentManager  : String(100),
    currentJobRole  : String(100)
  ) returns LargeString;

  /**
   * Get HR-correlated risk dashboard data.
   * Shows: users with active HR risk events, pending offboarding,
   * access outliers, temporal correlations.
   */
  action getHRRiskDashboard(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Check integration health and availability.
   * Returns status of the SuccessFactors connection.
   */
  action checkIntegrationHealth(
    tenantId : String(36)
  ) returns LargeString;
}
