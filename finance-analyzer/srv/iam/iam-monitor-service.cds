using { finsecure.ai as db } from '../../db/schema';

/**
 * IAM Monitor Service
 * Monitors identity and access management across connected SAP systems.
 * Detects critical authorization grants, dormant accounts, service account misuse,
 * IAM misconfigurations, and calculates privilege risk scores.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8
 */
service IAMMonitorService @(requires: 'system-user') {

  /** Behavioral profiles for privilege analysis */
  entity BehavioralProfiles as projection on db.BehavioralProfiles;
  entity AuditTrailEntries as projection on db.AuditTrailEntries;
  entity TenantThresholds as projection on db.TenantThresholds;
  entity Alerts as projection on db.Alerts;

  /**
   * Process IAM event from ingestion pipeline.
   * Handles role assignments, auth changes, profile modifications,
   * service account dialog logons, and IAM misconfigurations.
   */
  action processIAMEvent(
    eventId     : String(36),
    tenantId    : String(36),
    eventType   : String(50),
    userId      : String(12),
    performedBy : String(12),
    systemId    : String(50),
    details     : LargeString,
    timestamp   : String(30)
  ) returns LargeString;

  /**
   * Detect critical authorization grants.
   * Alerts within 60 seconds for SAP_ALL, S_DEVELOP, unrestricted access.
   */
  action detectCriticalAuthGrant(
    eventId     : String(36),
    tenantId    : String(36),
    eventType   : String(50),
    userId      : String(12),
    performedBy : String(12),
    systemId    : String(50),
    details     : LargeString,
    timestamp   : String(30)
  ) returns LargeString;

  /**
   * Identify dormant accounts with active authorizations.
   * Detects accounts with no logon within configurable period (default 90 days).
   */
  action identifyDormantAccounts(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Calculate IAM privilege risk scores for all users in a tenant.
   * Produces an IAM risk heatmap ranked by accumulated privilege risk.
   */
  action calculatePrivilegeRiskScores(
    tenantId : String(36)
  ) returns LargeString;
}
