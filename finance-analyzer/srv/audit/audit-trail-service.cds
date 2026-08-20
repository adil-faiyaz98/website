using { finsecure.ai as db } from '../../db/schema';

/**
 * Audit Trail Service
 * Logs all system activities to SAP Audit Log Service with cryptographic integrity,
 * local buffering for availability, 7-year retention, and paginated querying.
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */
service AuditTrailService @(requires: 'system-user') {

  /** Audit trail entries for querying */
  @readonly
  entity AuditTrailEntries as projection on db.AuditTrailEntries;

  /** Tenants for configuration lookup */
  entity Tenants as projection on db.Tenants;

  /** Alerts entity for generating buffer capacity alerts */
  entity Alerts as projection on db.Alerts;

  /**
   * Log an audit event to the SAP Audit Log Service.
   * Includes cryptographic integrity hash (tamper-evident chain).
   * Buffers locally if the Audit Log Service is unavailable.
   */
  action logEvent(
    tenantId       : String(36),
    userId         : String(100),
    action         : String(100),
    affectedObject : String(200),
    sourceIP       : String(45),
    outcome        : String(10),
    details        : LargeString
  ) returns LargeString;

  /**
   * Verify cryptographic integrity of audit trail entries.
   * Detects tampering by validating the hash chain.
   * Generates a security alert within 60 seconds if tampering is detected.
   */
  action verifyIntegrity(
    tenantId  : String(36),
    startDate : String,
    endDate   : String
  ) returns LargeString;

  /**
   * Query audit trail with filtering and pagination.
   * Supports filtering by date range, user, event type, risk category, and object.
   * Returns max 200 entries per page; first page within 5 seconds.
   */
  action queryAuditTrail(
    tenantId       : String(36),
    startDate      : String,
    endDate        : String,
    userId         : String(100),
    eventType      : String(100),
    riskCategory   : String(30),
    affectedObject : String(200),
    page           : Integer,
    pageSize       : Integer
  ) returns LargeString;

  /**
   * Replay buffered audit events to SAP Audit Log Service.
   * Called when the service recovers from unavailability.
   * Replays in original chronological order.
   */
  action replayBuffer(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Get buffer status including capacity utilization.
   * Alerts at 90% capacity.
   */
  action getBufferStatus() returns LargeString;

  /**
   * Execute retention policy enforcement.
   * Ensures audit data older than 7 years is managed per retention rules.
   */
  action enforceRetention(
    tenantId : String(36)
  ) returns LargeString;
}
