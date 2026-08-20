using { finsecure.ai as db } from '../../db/schema';

/**
 * Playbook Executor Service
 * Executes automated response playbooks triggered by alerts.
 * Handles trigger matching, step execution with timeouts/retries,
 * high-impact approval workflows, and execution queuing.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */
service PlaybookExecutorService @(requires: 'system-user') {

  /** Playbooks entity for trigger and step management */
  entity Playbooks as projection on db.Playbooks;
  entity PlaybookExecutions as projection on db.PlaybookExecutions;
  entity Alerts as projection on db.Alerts;
  entity AuditTrailEntries as projection on db.AuditTrailEntries;

  /**
   * Evaluate if any playbook matches the alert and execute.
   * Must complete within 60 seconds of alert generation.
   */
  action evaluateAndExecute(
    alertId  : String(36),
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Create a custom playbook for a tenant.
   * Max 50 playbooks per tenant, max 20 steps per playbook.
   */
  action createPlaybook(
    tenantId          : String(36),
    name              : String(200),
    triggerConditions : LargeString,
    steps             : LargeString,
    requiresApproval  : Boolean,
    approvalTimeout   : Integer
  ) returns LargeString;

  /**
   * Request approval for high-impact actions.
   * 15-minute timeout for confirmation.
   */
  action requestApproval(
    executionId : String(36),
    stepOrder   : Integer,
    actionType  : String(40),
    alertId     : String(36)
  ) returns Boolean;

  /**
   * Submit approval decision for a pending high-impact action.
   */
  action submitApproval(
    executionId : String(36),
    stepOrder   : Integer,
    approved    : Boolean,
    approverId  : String(12)
  ) returns LargeString;
}
