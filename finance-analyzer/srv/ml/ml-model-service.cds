using { finsecure.ai as db } from '../../db/schema';

/**
 * ML Model Management Service
 * Manages ML model lifecycle: training triggers, retraining schedules,
 * performance metrics tracking, promotion gates, A/B testing (shadow mode),
 * training failure handling, analyst feedback loops, and baseline fallback.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 */
service MLModelManagementService @(requires: 'system-user') {

  /** ML Models entity for lifecycle management */
  entity MLModels as projection on db.MLModels;
  entity MLModelFeedback as projection on db.MLModelFeedback;
  entity Transactions as projection on db.Transactions;
  entity Tenants as projection on db.Tenants;
  entity Alerts as projection on db.Alerts;

  /**
   * Check if a tenant meets the minimum training threshold
   * (90 days of data + 1000 transactions) and trigger initial training.
   */
  action checkAndTriggerInitialTraining(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Trigger a model retraining job for a tenant.
   * Incorporates new transaction data and analyst feedback.
   */
  action triggerRetraining(
    tenantId  : String(36),
    modelType : String(30)
  ) returns LargeString;

  /**
   * Evaluate a candidate model against the promotion gate.
   * Rejects if any metric drops > 5% or FPR increases > 10%.
   */
  action evaluatePromotionGate(
    candidateModelId : String(36)
  ) returns LargeString;

  /**
   * Promote a shadow model to production after A/B testing completes.
   * Requires minimum 7 days or 500 scored transactions in shadow mode.
   */
  action promoteShadowModel(
    shadowModelId : String(36)
  ) returns LargeString;

  /**
   * Record analyst feedback (true positive / false positive) for a model.
   * Used to improve future model training.
   */
  action recordFeedback(
    modelId      : String(36),
    tenantId     : String(36),
    alertId      : String(36),
    feedbackType : String(20),
    providedBy   : String(12)
  ) returns LargeString;

  /**
   * Get model metrics and status for the administrative dashboard.
   */
  action getModelStatus(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Handle a training failure: retain production model, alert admin, schedule retry.
   */
  action handleTrainingFailure(
    tenantId     : String(36),
    modelType    : String(30),
    failureReason: LargeString,
    attemptNumber: Integer
  ) returns LargeString;

  /**
   * Configure the retraining schedule for a tenant.
   * Min: daily, Max: monthly, Default: weekly.
   */
  action configureRetrainingSchedule(
    tenantId       : String(36),
    intervalDays   : Integer
  ) returns LargeString;
}
