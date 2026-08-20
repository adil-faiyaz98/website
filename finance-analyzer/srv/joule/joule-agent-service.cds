using { finsecure.ai as db } from '../../db/schema';

/**
 * Joule Agent Service
 * Conversational AI security analyst via SAP Joule integration.
 * Provides natural language query processing, action execution,
 * A2A protocol registration, and data classification enforcement.
 *
 * Validates: Requirements 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8
 */
service JouleAgentService @(requires: ['SecurityAnalyst', 'SecurityAdmin', 'Auditor', 'Executive', 'IAMAdmin', 'SOCOperator']) {

  /** Read-only projections for query resolution */
  @readonly entity Alerts as projection on db.Alerts;
  @readonly entity Investigations as projection on db.Investigations;
  @readonly entity Transactions as projection on db.Transactions;
  @readonly entity ComplianceControls as projection on db.ComplianceControls;
  @readonly entity ControlEvidence as projection on db.ControlEvidence;
  @readonly entity SoDViolations as projection on db.SoDViolations;
  @readonly entity AccessReviewCampaigns as projection on db.AccessReviewCampaigns;

  /**
   * Process a natural language query from Joule.
   * Translates to OData filters, returns structured results within 5 seconds.
   */
  action processQuery(
    intentType  : String(40),
    parameters  : LargeString,
    userId      : String(12),
    tenantId    : String(36)
  ) returns LargeString;

  /**
   * Execute an action through Joule with same RBAC/MFA controls.
   * Supports: acknowledge alert, change investigation status, assign alert,
   * request report, initiate access review.
   */
  action executeAction(
    intentType  : String(40),
    parameters  : LargeString,
    userId      : String(12),
    tenantId    : String(36)
  ) returns LargeString;

  /**
   * Register as Joule Agent via A2A protocol on SAP BTP.
   */
  action registerAgent() returns LargeString;
}
