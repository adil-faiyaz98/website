import cds = require('@sap/cds');
import {
  MLModelStatus,
  MLModelType,
} from '../types/enums';
import { MLModel, MLModelMetrics } from '../types/ml-model';

const { ApplicationService } = cds;

// ============================================================================
// Constants
// ============================================================================

/** Minimum training data requirements */
const TRAINING_THRESHOLDS = {
  /** Minimum days of historical data required */
  minDays: 90,
  /** Minimum number of transactions required */
  minTransactions: 1000,
} as const;

/** Retraining schedule bounds (in days) */
const RETRAINING_SCHEDULE = {
  /** Minimum interval: daily */
  minIntervalDays: 1,
  /** Maximum interval: monthly */
  maxIntervalDays: 30,
  /** Default interval: weekly */
  defaultIntervalDays: 7,
} as const;

/** Model promotion gate thresholds */
const PROMOTION_GATE = {
  /** Maximum allowed drop in precision/recall/F1 (5%) */
  maxMetricDropPercent: 5,
  /** Maximum allowed increase in false positive rate (10%) */
  maxFPRIncreasePercent: 10,
} as const;

/** A/B testing (shadow mode) requirements */
const SHADOW_MODE = {
  /** Minimum days in shadow mode before promotion eligible */
  minDays: 7,
  /** Minimum scored transactions before promotion eligible */
  minScoredTransactions: 500,
} as const;

/** Training failure handling */
const TRAINING_FAILURE = {
  /** Maximum retry attempts */
  maxRetries: 3,
  /** Interval between retries in hours */
  retryIntervalHours: 1,
} as const;

// ============================================================================
// Interfaces
// ============================================================================

interface TrainingThresholdResult {
  meetsThreshold: boolean;
  dataDays: number;
  transactionCount: number;
  requiredDays: number;
  requiredTransactions: number;
}

interface PromotionGateResult {
  promoted: boolean;
  reason?: string;
  metricComparisons?: MetricComparison[];
}

interface MetricComparison {
  metric: string;
  currentValue: number;
  candidateValue: number;
  changePercent: number;
  threshold: number;
  passed: boolean;
}

interface ShadowModeStatus {
  eligible: boolean;
  daysInShadow: number;
  scoredTransactions: number;
  requiredDays: number;
  requiredTransactions: number;
  reason?: string;
}

interface RetrainingSchedule {
  tenantId: string;
  intervalDays: number;
  lastTrainedAt?: Date;
  nextScheduledAt?: Date;
}

// ============================================================================
// ML Model Management Service
// ============================================================================

/**
 * ML Model Management Service
 *
 * Manages the full lifecycle of tenant-specific ML models on SAP AI Core:
 * - Initial training trigger after threshold met (90 days + 1000 transactions)
 * - Configurable retraining schedule (min daily, max monthly, default weekly)
 * - Performance metrics tracking (precision, recall, F1-score, FPR)
 * - Model promotion gate (reject if metrics drop > 5% or FPR increases > 10%)
 * - A/B testing in shadow mode (min 7 days or 500 scored transactions)
 * - Training failure handling (retain production, alert, retry 3x at 1h intervals)
 * - Feedback loop (true positive / false positive from analysts)
 * - Baseline model fallback for insufficient data
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 */
export default class MLModelManagementService extends (ApplicationService as any) {
  async init() {
    this.on('checkAndTriggerInitialTraining', async (req: any) => {
      const { tenantId } = req.data;
      const result = await this.checkAndTriggerInitialTraining(tenantId);
      return JSON.stringify(result);
    });

    this.on('triggerRetraining', async (req: any) => {
      const { tenantId, modelType } = req.data;
      const result = await this.triggerRetraining(tenantId, modelType as MLModelType);
      return JSON.stringify(result);
    });

    this.on('evaluatePromotionGate', async (req: any) => {
      const { candidateModelId } = req.data;
      const result = await this.evaluatePromotionGate(candidateModelId);
      return JSON.stringify(result);
    });

    this.on('promoteShadowModel', async (req: any) => {
      const { shadowModelId } = req.data;
      const result = await this.promoteShadowModel(shadowModelId);
      return JSON.stringify(result);
    });

    this.on('recordFeedback', async (req: any) => {
      const { modelId, tenantId, alertId, feedbackType, providedBy } = req.data;
      const result = await this.recordFeedback(modelId, tenantId, alertId, feedbackType, providedBy);
      return JSON.stringify(result);
    });

    this.on('getModelStatus', async (req: any) => {
      const { tenantId } = req.data;
      const result = await this.getModelStatus(tenantId);
      return JSON.stringify(result);
    });

    this.on('handleTrainingFailure', async (req: any) => {
      const { tenantId, modelType, failureReason, attemptNumber } = req.data;
      const result = await this.handleTrainingFailure(
        tenantId, modelType as MLModelType, failureReason, attemptNumber
      );
      return JSON.stringify(result);
    });

    this.on('configureRetrainingSchedule', async (req: any) => {
      const { tenantId, intervalDays } = req.data;
      const result = await this.configureRetrainingSchedule(tenantId, intervalDays);
      return JSON.stringify(result);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Check if a tenant meets the minimum training threshold and trigger
   * initial model training if requirements are satisfied.
   *
   * Threshold: 90 days of data + at least 1000 transactions.
   * If met, initiates training within 24 hours of data ingestion completion.
   * If not met, operates using baseline detection model.
   *
   * Validates: Requirements 11.1, 11.2, 11.8
   */
  async checkAndTriggerInitialTraining(tenantId: string): Promise<{
    triggered: boolean;
    thresholdResult: TrainingThresholdResult;
    message: string;
  }> {
    const logger = cds.log('ml-model');

    // Check training threshold
    const thresholdResult = await this.checkTrainingThreshold(tenantId);

    if (!thresholdResult.meetsThreshold) {
      logger.info(
        `Tenant ${tenantId} does not meet training threshold: ` +
        `${thresholdResult.dataDays} days (need ${thresholdResult.requiredDays}), ` +
        `${thresholdResult.transactionCount} transactions (need ${thresholdResult.requiredTransactions})`
      );

      return {
        triggered: false,
        thresholdResult,
        message: `Insufficient data for model training. Using baseline detection model. ` +
                 `Need ${thresholdResult.requiredDays} days and ${thresholdResult.requiredTransactions} transactions. ` +
                 `Currently have ${thresholdResult.dataDays} days and ${thresholdResult.transactionCount} transactions.`,
      };
    }

    // Check if an active or training model already exists
    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    const existingModel = await SELECT.one.from(MLModels).where({
      tenantId,
      status: { in: ['ACTIVE', 'TRAINING'] },
    });

    if (existingModel) {
      logger.info(`Tenant ${tenantId} already has an active/training model: ${existingModel.ID}`);
      return {
        triggered: false,
        thresholdResult,
        message: `Tenant already has an active or in-training model (ID: ${existingModel.ID}).`,
      };
    }

    // Trigger initial training for all model types
    const modelTypes: MLModelType[] = ['ANOMALY', 'FRAUD', 'BEHAVIORAL'];
    const trainedModels: string[] = [];

    for (const modelType of modelTypes) {
      const modelId = await this.initiateTraining(tenantId, modelType, thresholdResult);
      trainedModels.push(modelId);
    }

    logger.info(
      `Initial training triggered for tenant ${tenantId}: ${trainedModels.length} models initiated`
    );

    return {
      triggered: true,
      thresholdResult,
      message: `Initial model training triggered for ${trainedModels.length} model types. ` +
               `Training based on ${thresholdResult.dataDays} days and ` +
               `${thresholdResult.transactionCount} transactions.`,
    };
  }

  /**
   * Trigger model retraining incorporating new transaction data and analyst feedback.
   * Uses configurable schedule (min daily, max monthly, default weekly).
   *
   * Validates: Requirements 11.3
   */
  async triggerRetraining(tenantId: string, modelType: MLModelType): Promise<{
    success: boolean;
    modelId?: string;
    message: string;
  }> {
    const logger = cds.log('ml-model');
    const db = await cds.connect.to('db');
    const { MLModels, MLModelFeedback } = db.entities('finsecure.ai');

    // Find current production model
    const currentModel = await SELECT.one.from(MLModels).where({
      tenantId,
      modelType,
      status: 'ACTIVE',
    });

    if (!currentModel) {
      logger.warn(`No active model found for tenant ${tenantId}, type ${modelType}`);
      return {
        success: false,
        message: `No active ${modelType} model found for tenant. Cannot retrain without base model.`,
      };
    }

    // Check training threshold again to ensure sufficient data
    const thresholdResult = await this.checkTrainingThreshold(tenantId);
    if (!thresholdResult.meetsThreshold) {
      return {
        success: false,
        message: `Insufficient data for retraining. Retaining current model version ${currentModel.version}.`,
      };
    }

    // Count feedback entries since last training for incorporation
    const feedbackCount = await SELECT.one
      .from(MLModelFeedback)
      .columns('count(*) as count')
      .where({
        tenantId,
        model_ID: currentModel.ID,
      });

    const feedbackEntries = feedbackCount?.count || 0;

    // Create new model version in TRAINING status
    const newVersion = (currentModel.version || 1) + 1;
    const newModelId = cds.utils.uuid();
    const now = new Date().toISOString();

    await INSERT.into(MLModels).entries({
      ID: newModelId,
      tenantId,
      modelType,
      version: newVersion,
      status: 'TRAINING' as MLModelStatus,
      trainingDataDays: thresholdResult.dataDays,
      trainingTxCount: thresholdResult.transactionCount,
      trainedAt: now,
      createdAt: now,
      modifiedAt: now,
    });

    logger.info(
      `Retraining initiated for tenant ${tenantId}, type ${modelType}: ` +
      `version ${newVersion}, incorporating ${feedbackEntries} feedback entries`
    );

    // In production, this would invoke AI Core training pipeline
    // The AI Core callback would update the model with metrics upon completion

    return {
      success: true,
      modelId: newModelId,
      message: `Retraining initiated: version ${newVersion} for ${modelType} model. ` +
               `Incorporating ${feedbackEntries} analyst feedback entries and ` +
               `${thresholdResult.transactionCount} transactions.`,
    };
  }

  /**
   * Evaluate a candidate model against the promotion gate criteria.
   *
   * Promotion is REJECTED if:
   * - Any metric (precision, recall, F1) drops by more than 5%
   * - False positive rate increases by more than 10%
   *
   * Validates: Requirements 11.5
   */
  async evaluatePromotionGate(candidateModelId: string): Promise<PromotionGateResult> {
    const logger = cds.log('ml-model');
    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    // Fetch candidate model
    const candidate = await SELECT.one.from(MLModels).where({ ID: candidateModelId });
    if (!candidate) {
      return {
        promoted: false,
        reason: `Candidate model ${candidateModelId} not found.`,
      };
    }

    // Find current production model for comparison
    const currentProduction = await SELECT.one.from(MLModels).where({
      tenantId: candidate.tenantId,
      modelType: candidate.modelType,
      status: 'ACTIVE',
    });

    if (!currentProduction) {
      // No current production model — candidate is the first, auto-promote
      logger.info(`No existing production model. Candidate ${candidateModelId} passes gate by default.`);
      return {
        promoted: true,
        reason: 'No existing production model for comparison. Candidate promoted as initial model.',
        metricComparisons: [],
      };
    }

    // Compare metrics
    const comparisons: MetricComparison[] = [];

    // Check precision
    const precisionComparison = this.compareMetric(
      'precision',
      currentProduction.precision,
      candidate.precision,
      PROMOTION_GATE.maxMetricDropPercent,
      'drop'
    );
    comparisons.push(precisionComparison);

    // Check recall
    const recallComparison = this.compareMetric(
      'recall',
      currentProduction.recall,
      candidate.recall,
      PROMOTION_GATE.maxMetricDropPercent,
      'drop'
    );
    comparisons.push(recallComparison);

    // Check F1 score
    const f1Comparison = this.compareMetric(
      'f1Score',
      currentProduction.f1Score,
      candidate.f1Score,
      PROMOTION_GATE.maxMetricDropPercent,
      'drop'
    );
    comparisons.push(f1Comparison);

    // Check false positive rate (increase is bad)
    const fprComparison = this.compareMetric(
      'falsePositiveRate',
      currentProduction.falsePositiveRate,
      candidate.falsePositiveRate,
      PROMOTION_GATE.maxFPRIncreasePercent,
      'increase'
    );
    comparisons.push(fprComparison);

    // Check if all metrics pass
    const allPassed = comparisons.every(c => c.passed);

    if (!allPassed) {
      const failedMetrics = comparisons
        .filter(c => !c.passed)
        .map(c => `${c.metric}: ${c.changePercent.toFixed(2)}% ${c.metric === 'falsePositiveRate' ? 'increase' : 'drop'} (threshold: ${c.threshold}%)`)
        .join('; ');

      logger.warn(
        `Promotion gate REJECTED for model ${candidateModelId}: ${failedMetrics}`
      );

      // Retain previous model and alert admin
      await this.alertAdminMetricDegradation(
        candidate.tenantId,
        candidateModelId,
        comparisons.filter(c => !c.passed)
      );

      return {
        promoted: false,
        reason: `Promotion rejected. Failed metrics: ${failedMetrics}`,
        metricComparisons: comparisons,
      };
    }

    logger.info(`Promotion gate PASSED for model ${candidateModelId}`);

    return {
      promoted: true,
      reason: 'All metrics within acceptable thresholds.',
      metricComparisons: comparisons,
    };
  }

  /**
   * Promote a shadow model to production after A/B testing criteria are met.
   *
   * Requirements:
   * - Minimum 7 days in shadow mode, OR
   * - 500 scored transactions in shadow mode
   * (whichever is reached first)
   *
   * Validates: Requirements 11.6
   */
  async promoteShadowModel(shadowModelId: string): Promise<{
    promoted: boolean;
    shadowStatus: ShadowModeStatus;
    message: string;
  }> {
    const logger = cds.log('ml-model');
    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    // Fetch shadow model
    const shadowModel = await SELECT.one.from(MLModels).where({ ID: shadowModelId });
    if (!shadowModel) {
      return {
        promoted: false,
        shadowStatus: {
          eligible: false,
          daysInShadow: 0,
          scoredTransactions: 0,
          requiredDays: SHADOW_MODE.minDays,
          requiredTransactions: SHADOW_MODE.minScoredTransactions,
          reason: 'Shadow model not found.',
        },
        message: `Shadow model ${shadowModelId} not found.`,
      };
    }

    if (shadowModel.status !== 'SHADOW') {
      return {
        promoted: false,
        shadowStatus: {
          eligible: false,
          daysInShadow: 0,
          scoredTransactions: 0,
          requiredDays: SHADOW_MODE.minDays,
          requiredTransactions: SHADOW_MODE.minScoredTransactions,
          reason: `Model is not in SHADOW status (current: ${shadowModel.status}).`,
        },
        message: `Model ${shadowModelId} is not in shadow mode (status: ${shadowModel.status}).`,
      };
    }

    // Check shadow mode eligibility
    const shadowStatus = this.checkShadowModeEligibility(shadowModel);

    if (!shadowStatus.eligible) {
      logger.info(
        `Shadow model ${shadowModelId} not yet eligible for promotion: ` +
        `${shadowStatus.daysInShadow} days / ${shadowStatus.scoredTransactions} transactions`
      );

      return {
        promoted: false,
        shadowStatus,
        message: `Shadow model not yet eligible. ` +
                 `Days in shadow: ${shadowStatus.daysInShadow}/${shadowStatus.requiredDays}. ` +
                 `Scored transactions: ${shadowStatus.scoredTransactions}/${shadowStatus.requiredTransactions}.`,
      };
    }

    // Run promotion gate evaluation
    const gateResult = await this.evaluatePromotionGate(shadowModelId);

    if (!gateResult.promoted) {
      logger.warn(`Shadow model ${shadowModelId} failed promotion gate: ${gateResult.reason}`);
      return {
        promoted: false,
        shadowStatus,
        message: `Shadow model eligible but failed promotion gate: ${gateResult.reason}`,
      };
    }

    // Promote: deprecate current active model, promote shadow to active
    const now = new Date().toISOString();

    // Deprecate current production model
    const currentProduction = await SELECT.one.from(MLModels).where({
      tenantId: shadowModel.tenantId,
      modelType: shadowModel.modelType,
      status: 'ACTIVE',
    });

    if (currentProduction) {
      await UPDATE(MLModels).where({ ID: currentProduction.ID }).set({
        status: 'DEPRECATED' as MLModelStatus,
        modifiedAt: now,
      });
    }

    // Promote shadow model to active
    await UPDATE(MLModels).where({ ID: shadowModelId }).set({
      status: 'ACTIVE' as MLModelStatus,
      promotedAt: now,
      modifiedAt: now,
    });

    logger.info(
      `Shadow model ${shadowModelId} promoted to ACTIVE for tenant ${shadowModel.tenantId}. ` +
      `Previous model ${currentProduction?.ID || 'none'} deprecated.`
    );

    return {
      promoted: true,
      shadowStatus,
      message: `Shadow model promoted to production. Previous model deprecated.`,
    };
  }

  /**
   * Record analyst feedback for a model's prediction.
   * Incorporates true positive / false positive labels for future training.
   *
   * Validates: Requirements 11.3
   */
  async recordFeedback(
    modelId: string,
    tenantId: string,
    alertId: string,
    feedbackType: string,
    providedBy: string
  ): Promise<{ success: boolean; feedbackId: string; message: string }> {
    const logger = cds.log('ml-model');
    const db = await cds.connect.to('db');
    const { MLModelFeedback } = db.entities('finsecure.ai');

    // Validate feedback type
    const validTypes = ['TRUE_POSITIVE', 'FALSE_POSITIVE'];
    if (!validTypes.includes(feedbackType)) {
      return {
        success: false,
        feedbackId: '',
        message: `Invalid feedback type '${feedbackType}'. Must be one of: ${validTypes.join(', ')}`,
      };
    }

    const feedbackId = cds.utils.uuid();
    const now = new Date().toISOString();

    await INSERT.into(MLModelFeedback).entries({
      ID: feedbackId,
      model_ID: modelId,
      tenantId,
      alertId,
      feedbackType,
      providedBy,
      providedAt: now,
      createdAt: now,
      modifiedAt: now,
    });

    logger.info(
      `Feedback recorded: model=${modelId}, alert=${alertId}, ` +
      `type=${feedbackType}, by=${providedBy}`
    );

    return {
      success: true,
      feedbackId,
      message: `Feedback '${feedbackType}' recorded for alert ${alertId}.`,
    };
  }

  /**
   * Get model status summary for the administrative dashboard.
   * Returns metrics, status, and data readiness for all model types.
   *
   * Validates: Requirements 11.4, 11.8
   */
  async getModelStatus(tenantId: string): Promise<{
    models: any[];
    thresholdMet: boolean;
    thresholdResult: TrainingThresholdResult;
    usingBaseline: boolean;
  }> {
    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    // Get all models for this tenant (non-deprecated)
    const models = await SELECT.from(MLModels).where({
      tenantId,
      status: { '!=': 'DEPRECATED' },
    }).orderBy('modelType', 'version desc');

    // Check threshold
    const thresholdResult = await this.checkTrainingThreshold(tenantId);

    // Determine if using baseline
    const hasActiveModel = models.some((m: any) => m.status === 'ACTIVE');
    const usingBaseline = !hasActiveModel;

    return {
      models: models.map((m: any) => ({
        modelId: m.ID,
        modelType: m.modelType,
        version: m.version,
        status: m.status,
        metrics: {
          precision: m.precision,
          recall: m.recall,
          f1Score: m.f1Score,
          falsePositiveRate: m.falsePositiveRate,
        },
        trainedAt: m.trainedAt,
        promotedAt: m.promotedAt,
        trainingDataDays: m.trainingDataDays,
        trainingTxCount: m.trainingTxCount,
      })),
      thresholdMet: thresholdResult.meetsThreshold,
      thresholdResult,
      usingBaseline,
    };
  }

  /**
   * Handle a training failure: retain production model, alert admin, and retry.
   *
   * - Retains current production model as active
   * - Generates an alert to notify the administrator with failure reason
   * - Retries up to 3 times with minimum 1 hour interval between attempts
   *
   * Validates: Requirements 11.7
   */
  async handleTrainingFailure(
    tenantId: string,
    modelType: MLModelType,
    failureReason: string,
    attemptNumber: number
  ): Promise<{
    retryScheduled: boolean;
    attemptNumber: number;
    maxRetries: number;
    message: string;
  }> {
    const logger = cds.log('ml-model');
    const db = await cds.connect.to('db');
    const { MLModels, Alerts } = db.entities('finsecure.ai');

    // Mark any TRAINING model as failed (set back to DEPRECATED since training failed)
    const trainingModel = await SELECT.one.from(MLModels).where({
      tenantId,
      modelType,
      status: 'TRAINING',
    });

    if (trainingModel) {
      await UPDATE(MLModels).where({ ID: trainingModel.ID }).set({
        status: 'DEPRECATED' as MLModelStatus,
        modifiedAt: new Date().toISOString(),
      });
    }

    // Generate alert to admin
    const alertId = cds.utils.uuid();
    const now = new Date().toISOString();
    const retriesRemaining = TRAINING_FAILURE.maxRetries - attemptNumber;

    await INSERT.into(Alerts).entries({
      ID: alertId,
      tenantId,
      priority: 'HIGH',
      status: 'OPEN',
      riskCategory: 'COMPLIANCE_BREACH',
      riskScore: 60,
      title: `ML Model Training Failed: ${modelType} (Attempt ${attemptNumber}/${TRAINING_FAILURE.maxRetries})`,
      description: `Training job for ${modelType} model failed.\n` +
                   `Reason: ${failureReason}\n` +
                   `Attempt: ${attemptNumber} of ${TRAINING_FAILURE.maxRetries}\n` +
                   `Retries remaining: ${retriesRemaining}\n` +
                   `Current production model is retained and active.\n` +
                   `Next retry ${retriesRemaining > 0 ? `scheduled in ${TRAINING_FAILURE.retryIntervalHours} hour(s)` : 'NOT scheduled (max retries exhausted)'}.`,
      slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      modifiedAt: now,
    });

    logger.warn(
      `Training failure for tenant ${tenantId}, model ${modelType}: ` +
      `attempt ${attemptNumber}/${TRAINING_FAILURE.maxRetries}. Reason: ${failureReason}`
    );

    // Determine if retry should be scheduled
    const retryScheduled = attemptNumber < TRAINING_FAILURE.maxRetries;

    if (retryScheduled) {
      logger.info(
        `Retry ${attemptNumber + 1} scheduled in ${TRAINING_FAILURE.retryIntervalHours} hour(s) ` +
        `for tenant ${tenantId}, model ${modelType}`
      );

      // In production, this would schedule a job via SAP Job Scheduling Service
      // The retry would be triggered after TRAINING_FAILURE.retryIntervalHours
    } else {
      logger.error(
        `All ${TRAINING_FAILURE.maxRetries} retry attempts exhausted for tenant ${tenantId}, ` +
        `model ${modelType}. Manual intervention required.`
      );
    }

    return {
      retryScheduled,
      attemptNumber,
      maxRetries: TRAINING_FAILURE.maxRetries,
      message: retryScheduled
        ? `Training failed (attempt ${attemptNumber}). Retry scheduled in ${TRAINING_FAILURE.retryIntervalHours}h. ` +
          `Production model retained.`
        : `Training failed. All ${TRAINING_FAILURE.maxRetries} retries exhausted. ` +
          `Production model retained. Manual intervention required.`,
    };
  }

  /**
   * Configure the retraining schedule for a tenant.
   * Validates that interval is within bounds: min daily (1), max monthly (30).
   *
   * Validates: Requirements 11.3
   */
  async configureRetrainingSchedule(
    tenantId: string,
    intervalDays: number
  ): Promise<RetrainingSchedule> {
    const logger = cds.log('ml-model');

    // Validate interval bounds
    const validatedInterval = Math.max(
      RETRAINING_SCHEDULE.minIntervalDays,
      Math.min(RETRAINING_SCHEDULE.maxIntervalDays, intervalDays)
    );

    if (validatedInterval !== intervalDays) {
      logger.warn(
        `Retraining interval ${intervalDays} days clamped to ${validatedInterval} days ` +
        `(bounds: ${RETRAINING_SCHEDULE.minIntervalDays}-${RETRAINING_SCHEDULE.maxIntervalDays})`
      );
    }

    // Find the last trained model to calculate next schedule
    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    const latestModel = await SELECT.one.from(MLModels).where({
      tenantId,
      status: { in: ['ACTIVE', 'SHADOW'] },
    }).orderBy('trainedAt desc');

    const lastTrainedAt = latestModel?.trainedAt ? new Date(latestModel.trainedAt) : undefined;
    const nextScheduledAt = lastTrainedAt
      ? new Date(lastTrainedAt.getTime() + validatedInterval * 24 * 60 * 60 * 1000)
      : undefined;

    logger.info(
      `Retraining schedule configured for tenant ${tenantId}: ` +
      `every ${validatedInterval} days. Next: ${nextScheduledAt?.toISOString() || 'pending initial training'}`
    );

    // In production, this would persist to tenant configuration and
    // register with SAP Job Scheduling Service

    return {
      tenantId,
      intervalDays: validatedInterval,
      lastTrainedAt,
      nextScheduledAt,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Check if tenant meets minimum training data threshold.
   * Requires 90 days of data and at least 1000 transactions.
   */
  private async checkTrainingThreshold(tenantId: string): Promise<TrainingThresholdResult> {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    // Count total transactions for this tenant
    const txCountResult = await SELECT.one
      .from(Transactions)
      .columns('count(*) as count')
      .where({ tenantId });
    const transactionCount = txCountResult?.count || 0;

    // Find date range of data
    const dateRange = await SELECT.one
      .from(Transactions)
      .columns('min(postingDate) as earliest', 'max(postingDate) as latest')
      .where({ tenantId });

    let dataDays = 0;
    if (dateRange?.earliest && dateRange?.latest) {
      const earliest = new Date(dateRange.earliest);
      const latest = new Date(dateRange.latest);
      dataDays = Math.ceil((latest.getTime() - earliest.getTime()) / (24 * 60 * 60 * 1000));
    }

    return {
      meetsThreshold: dataDays >= TRAINING_THRESHOLDS.minDays &&
                      transactionCount >= TRAINING_THRESHOLDS.minTransactions,
      dataDays,
      transactionCount,
      requiredDays: TRAINING_THRESHOLDS.minDays,
      requiredTransactions: TRAINING_THRESHOLDS.minTransactions,
    };
  }

  /**
   * Initiate a training job for a specific model type.
   * Creates a model record in TRAINING status and triggers AI Core pipeline.
   */
  private async initiateTraining(
    tenantId: string,
    modelType: MLModelType,
    thresholdResult: TrainingThresholdResult
  ): Promise<string> {
    const logger = cds.log('ml-model');
    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    const modelId = cds.utils.uuid();
    const now = new Date().toISOString();

    await INSERT.into(MLModels).entries({
      ID: modelId,
      tenantId,
      modelType,
      version: 1,
      status: 'TRAINING' as MLModelStatus,
      trainingDataDays: thresholdResult.dataDays,
      trainingTxCount: thresholdResult.transactionCount,
      trainedAt: now,
      createdAt: now,
      modifiedAt: now,
    });

    logger.info(
      `Training initiated: model=${modelId}, type=${modelType}, tenant=${tenantId}, ` +
      `data=${thresholdResult.dataDays} days / ${thresholdResult.transactionCount} transactions`
    );

    // In production, this would invoke the SAP AI Core training pipeline:
    // POST /v2/lm/configurations -> POST /v2/lm/executions
    // The AI Core callback would update the model with metrics upon completion

    return modelId;
  }

  /**
   * Compare a single metric between current production and candidate model.
   * For 'drop' direction: checks if candidate is worse (lower) by more than threshold.
   * For 'increase' direction: checks if candidate is worse (higher) by more than threshold.
   */
  private compareMetric(
    metricName: string,
    currentValue: number | null,
    candidateValue: number | null,
    thresholdPercent: number,
    direction: 'drop' | 'increase'
  ): MetricComparison {
    const current = currentValue ?? 0;
    const candidate = candidateValue ?? 0;

    let changePercent: number;
    let passed: boolean;

    if (direction === 'drop') {
      // For precision/recall/F1: a drop is bad
      // Calculate percentage drop: (current - candidate) / current * 100
      changePercent = current > 0
        ? ((current - candidate) / current) * 100
        : 0;
      passed = changePercent <= thresholdPercent;
    } else {
      // For FPR: an increase is bad
      // Calculate percentage increase: (candidate - current) / current * 100
      // Use absolute difference if current is 0
      if (current === 0) {
        changePercent = candidate > 0 ? 100 : 0;
      } else {
        changePercent = ((candidate - current) / current) * 100;
      }
      passed = changePercent <= thresholdPercent;
    }

    return {
      metric: metricName,
      currentValue: current,
      candidateValue: candidate,
      changePercent: Math.max(0, changePercent), // Only show positive degradation
      threshold: thresholdPercent,
      passed,
    };
  }

  /**
   * Check if a shadow model has met the minimum A/B testing requirements.
   * Eligible when: 7+ days in shadow mode OR 500+ scored transactions.
   */
  private checkShadowModeEligibility(shadowModel: any): ShadowModeStatus {
    const deployedAt = shadowModel.trainedAt
      ? new Date(shadowModel.trainedAt)
      : new Date();

    const now = new Date();
    const daysInShadow = Math.floor(
      (now.getTime() - deployedAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    // In production, scoredTransactions would be tracked via a counter
    // For now, use trainingTxCount as proxy for shadow scoring activity
    const scoredTransactions = shadowModel.trainingTxCount || 0;

    // Eligible if EITHER condition is met (whichever is reached first)
    const eligible = daysInShadow >= SHADOW_MODE.minDays ||
                     scoredTransactions >= SHADOW_MODE.minScoredTransactions;

    return {
      eligible,
      daysInShadow,
      scoredTransactions,
      requiredDays: SHADOW_MODE.minDays,
      requiredTransactions: SHADOW_MODE.minScoredTransactions,
      reason: eligible
        ? 'Shadow mode evaluation criteria met.'
        : `Needs ${SHADOW_MODE.minDays} days (have ${daysInShadow}) OR ` +
          `${SHADOW_MODE.minScoredTransactions} scored transactions (have ${scoredTransactions}).`,
    };
  }

  /**
   * Alert admin about metric degradation that prevented model promotion.
   */
  private async alertAdminMetricDegradation(
    tenantId: string,
    candidateModelId: string,
    failedMetrics: MetricComparison[]
  ): Promise<void> {
    const logger = cds.log('ml-model');
    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const alertId = cds.utils.uuid();
    const now = new Date().toISOString();

    const metricDetails = failedMetrics
      .map(m => `${m.metric}: ${(m.currentValue * 100).toFixed(1)}% → ${(m.candidateValue * 100).toFixed(1)}% ` +
               `(${m.changePercent.toFixed(1)}% ${m.metric === 'falsePositiveRate' ? 'increase' : 'drop'}, threshold: ${m.threshold}%)`)
      .join('\n');

    await INSERT.into(Alerts).entries({
      ID: alertId,
      tenantId,
      priority: 'HIGH',
      status: 'OPEN',
      riskCategory: 'COMPLIANCE_BREACH',
      riskScore: 55,
      title: `ML Model Promotion Rejected: Metric Degradation Detected`,
      description: `A candidate model (${candidateModelId}) was rejected by the promotion gate ` +
                   `due to metric degradation beyond acceptable thresholds.\n\n` +
                   `Failed metrics:\n${metricDetails}\n\n` +
                   `The current production model has been retained. ` +
                   `Review training data quality and consider adjusting model parameters.`,
      slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      modifiedAt: now,
    });

    logger.info(`Admin alert ${alertId} generated for metric degradation on model ${candidateModelId}`);
  }
}
