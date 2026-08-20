using { finsecure.ai as db } from '../../db/schema';

/**
 * Data Privacy Service
 * Enforces data classification, field-level masking, retention policies,
 * data residency controls, and access logging for privacy governance.
 *
 * Validates: Requirements 29.1, 29.2, 29.3, 29.4, 29.5, 29.6, 29.7, 29.8
 */
service DataPrivacyService @(requires: 'system-user') {

  /** Tenants entity for residency and configuration lookup */
  entity Tenants as projection on db.Tenants;

  /** Audit trail for data access logging */
  entity AuditTrailEntries as projection on db.AuditTrailEntries;

  /**
   * Apply field-level data masking based on user role and data classification.
   * Returns the masked data object with sensitive fields redacted per role permissions.
   */
  action applyDataMasking(
    data          : LargeString,
    userRole      : String(30),
    context       : String(50)
  ) returns LargeString;

  /**
   * Verify data residency compliance for a tenant.
   * Ensures no cross-region replication has occurred.
   */
  action verifyDataResidency(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Execute data retention policy for a tenant.
   * Anonymizes user identities after configured period (default 24 months),
   * purges detailed transaction data while retaining aggregated metrics.
   */
  action executeRetentionPolicy(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Log a data access event for Confidential/Restricted data.
   * Records accessing user, classification tier, fields accessed, and timestamp.
   */
  action logDataAccess(
    userId             : String(12),
    tenantId           : String(36),
    dataClassification : String(20),
    fieldsAccessed     : LargeString,
    accessContext      : String(100)
  ) returns LargeString;
}
