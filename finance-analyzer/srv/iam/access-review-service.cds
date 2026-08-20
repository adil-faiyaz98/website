using { finsecure.ai as db } from '../../db/schema';

/**
 * Access Review Service
 * Manages access governance and review workflows.
 * Handles campaign triggers, review task generation, reviewer decisions,
 * automatic role removal, peer group analysis, and completion tracking.
 *
 * Validates: Requirements 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8
 */
service AccessReviewService @(requires: 'system-user') {

  /** Access review entities */
  entity AccessReviewCampaigns as projection on db.AccessReviewCampaigns;
  entity AccessReviewTasks as projection on db.AccessReviewTasks;
  entity Alerts as projection on db.Alerts;
  entity BehavioralProfiles as projection on db.BehavioralProfiles;

  /**
   * Trigger an access review campaign.
   * Supports triggers: SCHEDULED, ROLE_CHANGE, COMPLIANCE_DEADLINE, ALERT_THRESHOLD
   */
  action triggerCampaign(
    tenantId    : String(36),
    trigger     : String(20),
    deadline    : Timestamp,
    targetUsers : LargeString
  ) returns LargeString;

  /**
   * Submit a reviewer decision for a review task.
   * Supports decisions: APPROVE, REVOKE, FLAG_FOR_REVIEW.
   * Requires min 10 char justification for high-risk APPROVE decisions.
   */
  action submitDecision(
    taskId        : String(36),
    decision      : String(20),
    justification : String(1000)
  ) returns LargeString;

  /**
   * Identify access outliers using peer group analysis.
   * Flags users > 2 std dev above peer group median.
   */
  action identifyAccessOutliers(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Check completion rates and generate escalation alerts.
   */
  action checkCompletionRates(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Get access review history for a user.
   */
  action getReviewHistory(
    tenantId : String(36),
    userId   : String(12)
  ) returns LargeString;

  /**
   * Calculate access governance KPIs for the dashboard.
   */
  action calculateGovernanceKPIs(
    tenantId : String(36)
  ) returns LargeString;
}
