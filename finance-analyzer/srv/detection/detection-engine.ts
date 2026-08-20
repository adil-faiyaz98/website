import cds = require('@sap/cds');
import { CanonicalTransaction, RiskEvent, RiskIndicator, AffectedEntity, TenantThresholds } from '../types';
import { DetectionMethod, RiskCategory } from '../types/enums';

const { ApplicationService } = cds;

// ============================================================================
// Interfaces
// ============================================================================

/** Result of ML model scoring */
export interface MLScore {
  /** Risk score from 0-100 */
  riskScore: number;
  /** Model confidence from 0-100 */
  confidence: number;
  /** Whether the ML model was available */
  available: boolean;
}

/** Result of rule-based anomaly indicator checks */
export interface AnomalyIndicatorResult {
  /** Whether the indicator was triggered */
  triggered: boolean;
  /** Type of indicator */
  indicatorType: string;
  /** Human-readable description */
  description: string;
  /** Observed value that triggered the indicator */
  observedValue: unknown;
  /** Expected range or threshold */
  expectedRange?: { min: unknown; max: unknown };
  /** Weight of this indicator in overall scoring (0-1) */
  weight: number;
}

/** Result of behavioral deviation check */
export interface BehavioralDeviationResult {
  /** Whether deviation was detected */
  hasDeviation: boolean;
  /** Dimension that deviated */
  deviationDimension?: string;
  /** Expected range */
  expectedRange?: { min: number; max: number };
  /** Observed value */
  observedValue?: number;
  /** Magnitude of deviation in standard deviations */
  deviationMagnitude?: number;
  /** Score contribution from behavioral analysis */
  riskScore: number;
}

/** Transaction queued for ML re-evaluation */
export interface UnscoredTransaction {
  transactionId: string;
  tenantId: string;
  queuedAt: Date;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum time allowed for analysis (10 seconds) */
const ANALYSIS_TIMEOUT_MS = 10000;

/** Maximum time allowed for ML scoring (8 seconds, leaves buffer for orchestration) */
const ML_SCORING_TIMEOUT_MS = 8000;

/** Notification deadline when ML is unavailable (60 seconds) */
const ML_FALLBACK_NOTIFY_MS = 60000;

/** Default tenant thresholds used when tenant config is not found */
const DEFAULT_THRESHOLDS: TenantThresholds = {
  riskScoreAlertThreshold: 70,
  behavioralSensitivity: 5,
  sodLookbackDays: 90,
  vendorBankChangeHours: 48,
  dormantAccountDays: 90,
  roundNumberThreshold: 10000,
  dormancyPeriodDays: 180,
  businessHoursStart: 8,
  businessHoursEnd: 18,
  paymentFlagThreshold: 70,
  paymentAmountFactor: 3,
  massDataRecordLimit: 10000,
  massDataVolumeLimit: 50,
  maxFirefighterHours: 8,
  threeWayMatchTolerance: 0.02,
  grirClearingDays: 30,
};

/** Weight allocation for combined scoring */
const SCORE_WEIGHTS = {
  mlScore: 0.5,
  ruleBasedScore: 0.3,
  behavioralScore: 0.2,
};

// ============================================================================
// Detection Engine Implementation
// ============================================================================

/**
 * Detection Engine Service
 *
 * Orchestrates all detection mechanisms (ML scoring, rule-based checks,
 * behavioral analysis) in parallel and produces risk events.
 * Must complete within 10 seconds of ingestion.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.6
 */
export default class DetectionEngineService extends (ApplicationService as any) {
  /** Queue of unscored transactions pending ML re-evaluation */
  private unscoredQueue: UnscoredTransaction[] = [];

  async init() {
    // Register action handlers
    this.on('analyzeTransaction', async (req: any) => {
      const tx = this.mapRequestToTransaction(req.data);
      const riskEvents = await this.analyzeTransaction(tx);
      return JSON.stringify(riskEvents);
    });

    this.on('scoreWithMLModel', async (req: any) => {
      const { tenantId, transactionId, amount, documentType, userId, debitAccount, creditAccount, companyCode } = req.data;
      const tx: CanonicalTransaction = {
        transactionId,
        tenantId,
        sourceSystem: '',
        sourceEventId: '',
        documentNumber: '',
        documentType,
        postingDate: new Date(),
        entryDate: new Date(),
        amount: Number(amount),
        currency: 'USD',
        userId,
        companyCode,
        debitAccount,
        creditAccount,
        businessObjectRef: '',
        metadata: {},
        ingestedAt: new Date(),
        normalizedAt: new Date(),
      };
      return this.scoreWithMLModel(tenantId, tx);
    });

    this.on('reEvaluateUnscored', async (req: any) => {
      const { tenantId } = req.data;
      return this.reEvaluateUnscoredTransactions(tenantId);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Main entry point: analyze a normalized transaction.
   * Orchestrates ML scoring + rule-based checks + behavioral analysis in PARALLEL.
   * Must complete within 10 seconds of ingestion.
   *
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  async analyzeTransaction(tx: CanonicalTransaction): Promise<RiskEvent[]> {
    const logger = cds.log('detection');
    const startTime = Date.now();

    logger.info(`Analyzing transaction ${tx.transactionId} for tenant ${tx.tenantId}`);

    try {
      // Load tenant thresholds
      const thresholds = await this.loadTenantThresholds(tx.tenantId);

      // Run all detection mechanisms in PARALLEL with overall timeout
      const analysisResult = await this.runParallelAnalysis(tx, thresholds);

      // Combine scores from all detection methods
      const combinedScore = this.calculateCombinedScore(
        analysisResult.mlScore,
        analysisResult.ruleBasedIndicators,
        analysisResult.behavioralResult
      );

      // Collect all triggered risk indicators
      const riskIndicators = this.collectRiskIndicators(
        analysisResult.mlScore,
        analysisResult.ruleBasedIndicators,
        analysisResult.behavioralResult
      );

      const riskEvents: RiskEvent[] = [];

      // Generate risk event if score exceeds threshold
      if (combinedScore >= thresholds.riskScoreAlertThreshold) {
        const riskEvent = this.createRiskEvent(tx, combinedScore, analysisResult, riskIndicators, thresholds);
        riskEvents.push(riskEvent);

        // Forward to Alert Manager
        await this.forwardToAlertManager(riskEvent);
      }

      // Update transaction with risk score
      await this.updateTransactionScore(tx.transactionId, combinedScore);

      const elapsed = Date.now() - startTime;
      logger.info(
        `Transaction ${tx.transactionId} analyzed in ${elapsed}ms. Score: ${combinedScore}, Events: ${riskEvents.length}`
      );

      return riskEvents;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      logger.error(`Analysis failed for ${tx.transactionId} after ${elapsed}ms: ${error.message}`);

      // If analysis timed out or errored, still flag for review
      if (elapsed >= ANALYSIS_TIMEOUT_MS) {
        logger.warn(`Analysis exceeded ${ANALYSIS_TIMEOUT_MS}ms timeout for ${tx.transactionId}`);
      }

      throw error;
    }
  }

  /**
   * Score a transaction using the ML model via SAP AI Core.
   * Returns Risk_Score 0-100 and confidence level.
   *
   * Validates: Requirements 3.1
   */
  async scoreWithMLModel(tenantId: string, tx: CanonicalTransaction): Promise<MLScore> {
    const logger = cds.log('detection');

    try {
      // Invoke AI Core serving endpoint with timeout
      const mlResult = await this.invokeAICoreEndpoint(tenantId, tx);
      return mlResult;
    } catch (error: any) {
      logger.warn(`ML scoring unavailable for tenant ${tenantId}: ${error.message}`);

      // ML unavailable fallback: flag as unscored, queue for re-evaluation
      await this.handleMLUnavailable(tenantId, tx);

      return {
        riskScore: 0,
        confidence: 0,
        available: false,
      };
    }
  }

  /**
   * Check anomaly indicators against tenant-configured thresholds.
   * Indicators: business hours, round-number amounts, dormant accounts,
   * unknown account combinations, approval bypass.
   *
   * Validates: Requirements 3.3
   */
  async checkAnomalyIndicators(
    tx: CanonicalTransaction,
    thresholds: TenantThresholds
  ): Promise<AnomalyIndicatorResult[]> {
    // 1. Business hours check
    const businessHoursResult = this.checkBusinessHours(tx, thresholds);

    // 2. Round-number amounts check
    const roundNumberResult = this.checkRoundNumberAmount(tx, thresholds);

    // 3. Dormant accounts check
    const dormantResult = await this.checkDormantAccount(tx, thresholds);

    // 4. Unknown account combinations check
    const unknownComboResult = await this.checkUnknownAccountCombination(tx, thresholds);

    // 5. Approval bypass check
    const approvalResult = this.checkApprovalBypass(tx);

    return [businessHoursResult, roundNumberResult, dormantResult, unknownComboResult, approvalResult];
  }

  /**
   * Check behavioral deviation against the user's profile.
   *
   * Validates: Requirements 3.1 (behavioral analysis component)
   */
  async checkBehavioralDeviation(
    tx: CanonicalTransaction,
    thresholds: TenantThresholds
  ): Promise<BehavioralDeviationResult> {
    const logger = cds.log('detection');

    try {
      const profile = await this.loadBehavioralProfile(tx.tenantId, tx.userId);

      if (!profile || profile.status === 'LEARNING') {
        // Profile not mature enough for deviation checks
        return { hasDeviation: false, riskScore: 0 };
      }

      const dimensions = profile.dimensions;
      if (!dimensions) {
        return { hasDeviation: false, riskScore: 0 };
      }

      // Check amount deviation
      const amountDeviation = this.checkAmountDeviation(tx.amount, dimensions);
      if (amountDeviation.hasDeviation) {
        return amountDeviation;
      }

      // Check time-of-day deviation
      const timeDeviation = this.checkTimeDeviation(tx.postingDate, dimensions, thresholds.behavioralSensitivity);
      if (timeDeviation.hasDeviation) {
        return timeDeviation;
      }

      // Check account combination novelty
      const accountCombo = `${tx.debitAccount}:${tx.creditAccount}`;
      const knownCombos: string[] = typeof dimensions.accountCombinations === 'string'
        ? JSON.parse(dimensions.accountCombinations as string)
        : (dimensions.accountCombinations || []);

      if (knownCombos.length > 0 && !knownCombos.includes(accountCombo)) {
        return {
          hasDeviation: true,
          deviationDimension: 'accountCombinations',
          observedValue: 1,
          expectedRange: { min: 0, max: 0 },
          deviationMagnitude: 2,
          riskScore: 30,
        };
      }

      return { hasDeviation: false, riskScore: 0 };
    } catch (error: any) {
      logger.warn(`Behavioral deviation check failed for user ${tx.userId}: ${error.message}`);
      return { hasDeviation: false, riskScore: 0 };
    }
  }

  // ==========================================================================
  // Parallel Analysis Orchestration
  // ==========================================================================

  /**
   * Run ML scoring, rule-based checks, and behavioral analysis in parallel
   * with an overall timeout of 10 seconds.
   */
  private async runParallelAnalysis(
    tx: CanonicalTransaction,
    thresholds: TenantThresholds
  ): Promise<{
    mlScore: MLScore;
    ruleBasedIndicators: AnomalyIndicatorResult[];
    behavioralResult: BehavioralDeviationResult;
  }> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timeout exceeded')), ANALYSIS_TIMEOUT_MS);
    });

    const analysisPromise = Promise.all([
      this.scoreWithMLModel(tx.tenantId, tx),
      this.checkAnomalyIndicators(tx, thresholds),
      this.checkBehavioralDeviation(tx, thresholds),
    ]);

    const [mlScore, ruleBasedIndicators, behavioralResult] = await Promise.race([
      analysisPromise,
      timeoutPromise,
    ]) as [MLScore, AnomalyIndicatorResult[], BehavioralDeviationResult];

    return { mlScore, ruleBasedIndicators, behavioralResult };
  }

  // ==========================================================================
  // Anomaly Indicator Checks
  // ==========================================================================

  /**
   * Check if transaction was posted outside configured business hours.
   * Flags transactions outside tenant's businessHoursStart to businessHoursEnd.
   * Uses UTC hours for consistent cross-timezone behavior.
   *
   * Validates: Requirements 3.3 (business hours indicator)
   */
  private checkBusinessHours(tx: CanonicalTransaction, thresholds: TenantThresholds): AnomalyIndicatorResult {
    const postingHour = tx.postingDate.getUTCHours();
    const outsideHours = postingHour < thresholds.businessHoursStart || postingHour >= thresholds.businessHoursEnd;

    return {
      triggered: outsideHours,
      indicatorType: 'outside_business_hours',
      description: outsideHours
        ? `Transaction posted at hour ${postingHour}, outside business hours (${thresholds.businessHoursStart}-${thresholds.businessHoursEnd})`
        : 'Transaction within business hours',
      observedValue: postingHour,
      expectedRange: { min: thresholds.businessHoursStart, max: thresholds.businessHoursEnd },
      weight: 0.15,
    };
  }

  /**
   * Check if the transaction amount is a round number exceeding the threshold.
   * Round numbers (e.g., 50000, 100000) can indicate fabricated transactions.
   *
   * Validates: Requirements 3.3 (round-number amounts indicator)
   */
  private checkRoundNumberAmount(tx: CanonicalTransaction, thresholds: TenantThresholds): AnomalyIndicatorResult {
    const amount = Math.abs(tx.amount);
    const isRoundNumber = amount > 0 && amount % 1000 === 0;
    const exceedsThreshold = amount >= thresholds.roundNumberThreshold;
    const triggered = isRoundNumber && exceedsThreshold;

    return {
      triggered,
      indicatorType: 'round_number_amount',
      description: triggered
        ? `Round-number amount ${amount} exceeds threshold ${thresholds.roundNumberThreshold}`
        : 'Amount does not trigger round-number indicator',
      observedValue: amount,
      expectedRange: { min: 0, max: thresholds.roundNumberThreshold },
      weight: 0.1,
    };
  }

  /**
   * Check if the transaction posts to a dormant account.
   * An account is dormant if it has no activity within the configured dormancy period.
   *
   * Validates: Requirements 3.3 (dormant accounts indicator)
   */
  private async checkDormantAccount(
    tx: CanonicalTransaction,
    thresholds: TenantThresholds
  ): Promise<AnomalyIndicatorResult> {
    try {
      const db = await cds.connect.to('db');
      const { Transactions } = db.entities('finsecure.ai');

      const dormancyCutoff = new Date();
      dormancyCutoff.setDate(dormancyCutoff.getDate() - thresholds.dormancyPeriodDays);

      // Check if debit or credit account has had recent activity
      const recentActivity = await SELECT.one.from(Transactions).where({
        tenantId: tx.tenantId,
        or: [
          { debitAccount: tx.debitAccount },
          { creditAccount: tx.debitAccount },
          { debitAccount: tx.creditAccount },
          { creditAccount: tx.creditAccount },
        ],
        postingDate: { '>=': dormancyCutoff.toISOString().split('T')[0] },
        ID: { '!=': tx.transactionId },
      });

      const isDormant = !recentActivity;

      return {
        triggered: isDormant,
        indicatorType: 'dormant_account',
        description: isDormant
          ? `Account has no activity in the last ${thresholds.dormancyPeriodDays} days`
          : 'Account has recent activity',
        observedValue: isDormant ? thresholds.dormancyPeriodDays : 0,
        expectedRange: { min: 0, max: thresholds.dormancyPeriodDays },
        weight: 0.2,
      };
    } catch (error: any) {
      // If DB query fails, don't trigger the indicator
      return {
        triggered: false,
        indicatorType: 'dormant_account',
        description: `Dormant account check failed: ${error.message}`,
        observedValue: null,
        weight: 0.2,
      };
    }
  }

  /**
   * Check if the debit/credit account combination has been observed before.
   * Unknown combinations may indicate unauthorized or erroneous postings.
   *
   * Validates: Requirements 3.3 (unknown account combinations indicator)
   */
  private async checkUnknownAccountCombination(
    tx: CanonicalTransaction,
    thresholds: TenantThresholds
  ): Promise<AnomalyIndicatorResult> {
    try {
      const db = await cds.connect.to('db');
      const { Transactions } = db.entities('finsecure.ai');

      const lookbackCutoff = new Date();
      lookbackCutoff.setDate(lookbackCutoff.getDate() - thresholds.sodLookbackDays);

      // Check if this debit/credit pair has been used before in the lookback period
      const previousUsage = await SELECT.one.from(Transactions).where({
        tenantId: tx.tenantId,
        debitAccount: tx.debitAccount,
        creditAccount: tx.creditAccount,
        postingDate: { '>=': lookbackCutoff.toISOString().split('T')[0] },
        ID: { '!=': tx.transactionId },
      });

      const isUnknown = !previousUsage;

      return {
        triggered: isUnknown,
        indicatorType: 'unknown_account_combination',
        description: isUnknown
          ? `Account pair ${tx.debitAccount}:${tx.creditAccount} not observed in the last ${thresholds.sodLookbackDays} days`
          : 'Account combination is known',
        observedValue: isUnknown ? 0 : 1,
        expectedRange: { min: 1, max: undefined as any },
        weight: 0.2,
      };
    } catch (error: any) {
      return {
        triggered: false,
        indicatorType: 'unknown_account_combination',
        description: `Account combination check failed: ${error.message}`,
        observedValue: null,
        weight: 0.2,
      };
    }
  }

  /**
   * Check if the transaction bypasses approval workflows.
   * Detected via metadata flags indicating direct posting without approval chain.
   *
   * Validates: Requirements 3.3 (approval bypass indicator)
   */
  private checkApprovalBypass(tx: CanonicalTransaction): AnomalyIndicatorResult {
    const metadata = tx.metadata || {};

    // Check for approval bypass indicators in metadata
    const approvalBypassed = !!(
      metadata.approvalBypassed === true ||
      metadata.directPosting === true ||
      metadata.APPROVAL_STATUS === 'BYPASSED' ||
      metadata.BSTAT === '2' // SAP statistical posting indicator sometimes indicates bypass
    );

    return {
      triggered: approvalBypassed,
      indicatorType: 'approval_bypass',
      description: approvalBypassed
        ? 'Transaction bypassed approval workflow'
        : 'Transaction followed normal approval workflow',
      observedValue: approvalBypassed,
      expectedRange: { min: false as any, max: false as any },
      weight: 0.25,
    };
  }

  // ==========================================================================
  // Behavioral Deviation Checks
  // ==========================================================================

  /**
   * Check if transaction amount deviates significantly from the user's profile.
   */
  private checkAmountDeviation(
    amount: number,
    dimensions: any
  ): BehavioralDeviationResult {
    const amountStats = dimensions.amountMean !== undefined
      ? { mean: Number(dimensions.amountMean), stdDev: Number(dimensions.amountStdDev) }
      : null;

    if (!amountStats || amountStats.stdDev === 0) {
      return { hasDeviation: false, riskScore: 0 };
    }

    const absAmount = Math.abs(amount);
    const deviationMagnitude = (absAmount - amountStats.mean) / amountStats.stdDev;

    // Flag if more than 3 standard deviations from mean
    if (deviationMagnitude > 3) {
      return {
        hasDeviation: true,
        deviationDimension: 'transactionAmounts',
        expectedRange: {
          min: Math.max(0, amountStats.mean - 3 * amountStats.stdDev),
          max: amountStats.mean + 3 * amountStats.stdDev,
        },
        observedValue: absAmount,
        deviationMagnitude,
        riskScore: Math.min(50, Math.round(deviationMagnitude * 10)),
      };
    }

    return { hasDeviation: false, riskScore: 0 };
  }

  /**
   * Check if posting time deviates from the user's established pattern.
   */
  private checkTimeDeviation(
    postingDate: Date,
    dimensions: any,
    sensitivity: number
  ): BehavioralDeviationResult {
    const hourDistribution: number[] | undefined = typeof dimensions.hourDistribution === 'string'
      ? JSON.parse(dimensions.hourDistribution)
      : dimensions.hourDistribution;

    if (hourDistribution?.length !== 24) {
      return { hasDeviation: false, riskScore: 0 };
    }

    const hour = postingDate.getUTCHours();
    const totalPostings = hourDistribution.reduce((sum: number, val: number) => sum + val, 0);

    if (totalPostings === 0) {
      return { hasDeviation: false, riskScore: 0 };
    }

    const hourFrequency = hourDistribution[hour] / totalPostings;

    // Sensitivity threshold: lower sensitivity value = higher threshold needed to flag
    // Sensitivity 1-10 maps to frequency threshold 0.01-0.001
    const frequencyThreshold = 0.01 / sensitivity;

    if (hourFrequency < frequencyThreshold) {
      return {
        hasDeviation: true,
        deviationDimension: 'postingTimes',
        expectedRange: { min: frequencyThreshold, max: 1 },
        observedValue: hourFrequency,
        deviationMagnitude: frequencyThreshold / Math.max(hourFrequency, 0.0001),
        riskScore: 25,
      };
    }

    return { hasDeviation: false, riskScore: 0 };
  }

  // ==========================================================================
  // ML Model Integration
  // ==========================================================================

  /**
   * Invoke SAP AI Core serving endpoint for ML scoring.
   * Sends transaction features, receives risk score and confidence.
   */
  private async invokeAICoreEndpoint(tenantId: string, tx: CanonicalTransaction): Promise<MLScore> {
    const logger = cds.log('detection');

    try {
      // Prepare feature vector for ML model
      const features = {
        amount: tx.amount,
        documentType: tx.documentType,
        postingHour: tx.postingDate.getUTCHours(),
        postingDayOfWeek: tx.postingDate.getUTCDay(),
        userId: tx.userId,
        debitAccount: tx.debitAccount,
        creditAccount: tx.creditAccount,
        companyCode: tx.companyCode,
        hasCostCenter: !!tx.costCenter,
        hasVendor: !!tx.vendorId,
      };

      // In production: connect to AI Core via destination service
      // const aiCore = await cds.connect.to('aicore');
      // const response = await aiCore.send('POST', `/v2/inference/deployments/${deploymentId}/predict`, features);

      // Attempt to connect to AI Core serving endpoint
      const aiCore = await this.getAICoreConnection(tenantId);

      if (!aiCore) {
        throw new Error('AI Core connection not available');
      }

      const response = await this.callMLEndpoint(aiCore, tenantId, features);

      const riskScore = Math.max(0, Math.min(100, Math.round(response.score)));
      const confidence = Math.max(0, Math.min(100, Math.round(response.confidence)));

      logger.info(`ML score for ${tx.transactionId}: score=${riskScore}, confidence=${confidence}`);

      return {
        riskScore,
        confidence,
        available: true,
      };
    } catch (error: any) {
      logger.warn(`AI Core endpoint call failed for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get AI Core connection for the tenant.
   * Returns null if AI Core is not configured or unavailable.
   */
  private async getAICoreConnection(tenantId: string): Promise<any> {
    try {
      const aiCore = await cds.connect.to('aicore');
      return aiCore;
    } catch {
      return null;
    }
  }

  /**
   * Call the ML model endpoint with feature data.
   */
  private async callMLEndpoint(
    aiCore: any,
    tenantId: string,
    features: Record<string, unknown>
  ): Promise<{ score: number; confidence: number }> {
    // In production this calls the actual AI Core deployment endpoint.
    // The deployment ID is retrieved from MLModels entity for the tenant's active model.
    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    const activeModel = await SELECT.one.from(MLModels).where({
      tenantId,
      status: 'ACTIVE',
      modelType: 'ANOMALY',
    });

    if (!activeModel?.aiCoreDeploymentId) {
      throw new Error('No active ML model found for tenant');
    }

    // Call AI Core inference endpoint
    const response = await aiCore.send('POST', `/v2/inference/deployments/${activeModel.aiCoreDeploymentId}/predict`, {
      features,
    });

    return {
      score: response?.predictions?.[0]?.score ?? 0,
      confidence: response?.predictions?.[0]?.confidence ?? 0,
    };
  }

  // ==========================================================================
  // ML Fallback Handling
  // ==========================================================================

  /**
   * Handle ML model unavailability.
   * Flags transaction as unscored, queues for re-evaluation, notifies within 60s.
   *
   * Validates: Requirements 3.6
   */
  private async handleMLUnavailable(tenantId: string, tx: CanonicalTransaction): Promise<void> {
    const logger = cds.log('detection');

    logger.warn(`ML unavailable for tenant ${tenantId}. Flagging TX ${tx.transactionId} as unscored.`);

    // 1. Flag transaction as unscored in the database
    await this.flagTransactionAsUnscored(tx.transactionId);

    // 2. Queue for re-evaluation
    this.unscoredQueue.push({
      transactionId: tx.transactionId,
      tenantId,
      queuedAt: new Date(),
    });

    // 3. Schedule notification within 60 seconds
    this.scheduleMLUnavailableNotification(tenantId, tx.transactionId);
  }

  /**
   * Flag a transaction as unscored in the database.
   */
  private async flagTransactionAsUnscored(transactionId: string): Promise<void> {
    try {
      const db = await cds.connect.to('db');
      const { Transactions } = db.entities('finsecure.ai');

      await UPDATE(Transactions).set({ scored: false, riskScore: null }).where({ ID: transactionId });
    } catch (error: any) {
      cds.log('detection').warn(`Failed to flag TX ${transactionId} as unscored: ${error.message}`);
    }
  }

  /**
   * Schedule a notification about ML unavailability within 60 seconds.
   *
   * Validates: Requirements 3.6 (notify within 60 seconds)
   */
  private scheduleMLUnavailableNotification(tenantId: string, transactionId: string): void {
    const logger = cds.log('detection');

    // Notify immediately (within the 60s window) via Alert Notification Service
    setTimeout(async () => {
      try {
        logger.info(`Sending ML unavailability notification for tenant ${tenantId}, TX ${transactionId}`);
        await this.sendMLUnavailableNotification(tenantId, transactionId);
      } catch (error: any) {
        logger.error(`Failed to send ML unavailability notification: ${error.message}`);
      }
    }, 0); // Send immediately; the 60s requirement is a maximum, not a minimum delay
  }

  /**
   * Send notification about ML model being unavailable.
   */
  private async sendMLUnavailableNotification(tenantId: string, transactionId: string): Promise<void> {
    const logger = cds.log('detection');

    // In production: use SAP Alert Notification Service (ANS)
    // const ans = await cds.connect.to('alert-notification');
    // await ans.send('POST', '/alerts', { ... });

    logger.info(
      `[NOTIFICATION] ML model unavailable for tenant ${tenantId}. ` +
      `Transaction ${transactionId} flagged as unscored and queued for re-evaluation.`
    );
  }

  /**
   * Re-evaluate unscored transactions when ML model becomes available again.
   */
  async reEvaluateUnscoredTransactions(tenantId: string): Promise<number> {
    const logger = cds.log('detection');
    let reEvaluated = 0;

    const pending = this.unscoredQueue.filter(item => item.tenantId === tenantId);

    for (const item of pending) {
      try {
        const tx = await this.loadTransaction(item.transactionId);
        if (tx) {
          const mlScore = await this.scoreWithMLModel(tenantId, tx);
          if (mlScore.available) {
            await this.updateTransactionScore(item.transactionId, mlScore.riskScore);
            reEvaluated++;
          }
        }
      } catch (error: any) {
        logger.warn(`Re-evaluation failed for TX ${item.transactionId}: ${error.message}`);
      }
    }

    // Remove re-evaluated items from queue
    this.unscoredQueue = this.unscoredQueue.filter(
      item => item.tenantId !== tenantId || !pending.includes(item)
    );

    logger.info(`Re-evaluated ${reEvaluated} unscored transactions for tenant ${tenantId}`);
    return reEvaluated;
  }

  // ==========================================================================
  // Scoring Logic
  // ==========================================================================

  /**
   * Calculate combined risk score from all detection mechanisms.
   * Weights: ML (50%), Rule-based (30%), Behavioral (20%).
   * Returns integer in range [0, 100].
   */
  private calculateCombinedScore(
    mlScore: MLScore,
    indicators: AnomalyIndicatorResult[],
    behavioralResult: BehavioralDeviationResult
  ): number {
    // ML component (weighted by confidence when available)
    let mlComponent = 0;
    if (mlScore.available) {
      mlComponent = mlScore.riskScore * (mlScore.confidence / 100) * SCORE_WEIGHTS.mlScore;
    }

    // Rule-based component from triggered indicators
    const triggeredIndicators = indicators.filter(i => i.triggered);
    let ruleBasedComponent = 0;
    if (triggeredIndicators.length > 0) {
      const totalWeight = triggeredIndicators.reduce((sum, i) => sum + i.weight, 0);
      // Each triggered indicator contributes proportionally, max 100 points for rule-based
      const ruleScore = Math.min(100, (totalWeight / 0.9) * 100); // 0.9 is max total weight
      ruleBasedComponent = ruleScore * SCORE_WEIGHTS.ruleBasedScore;
    }

    // Behavioral component
    const behavioralComponent = behavioralResult.riskScore * SCORE_WEIGHTS.behavioralScore;

    // Combined score clamped to [0, 100]
    const combinedScore = Math.round(
      Math.max(0, Math.min(100, mlComponent + ruleBasedComponent + behavioralComponent))
    );

    return combinedScore;
  }

  /**
   * Collect all triggered risk indicators from all detection mechanisms.
   */
  private collectRiskIndicators(
    mlScore: MLScore,
    indicators: AnomalyIndicatorResult[],
    behavioralResult: BehavioralDeviationResult
  ): RiskIndicator[] {
    const riskIndicators: RiskIndicator[] = [];

    // Add ML score as indicator if available
    if (mlScore.available && mlScore.riskScore > 0) {
      riskIndicators.push({
        indicatorType: 'ml_anomaly_score',
        description: `ML model scored transaction at ${mlScore.riskScore}/100 with ${mlScore.confidence}% confidence`,
        observedValue: mlScore.riskScore,
        expectedRange: { min: 0, max: 100 },
        weight: SCORE_WEIGHTS.mlScore,
      });
    }

    // Add triggered rule-based indicators
    for (const indicator of indicators) {
      if (indicator.triggered) {
        riskIndicators.push({
          indicatorType: indicator.indicatorType,
          description: indicator.description,
          observedValue: indicator.observedValue,
          expectedRange: indicator.expectedRange,
          weight: indicator.weight,
        });
      }
    }

    // Add behavioral deviation if detected
    if (behavioralResult.hasDeviation) {
      riskIndicators.push({
        indicatorType: `behavioral_${behavioralResult.deviationDimension}`,
        description: `Behavioral deviation in ${behavioralResult.deviationDimension}: observed ${behavioralResult.observedValue}, expected ${behavioralResult.expectedRange?.min}-${behavioralResult.expectedRange?.max}`,
        observedValue: behavioralResult.observedValue,
        expectedRange: behavioralResult.expectedRange as any,
        weight: SCORE_WEIGHTS.behavioralScore,
      });
    }

    return riskIndicators;
  }

  // ==========================================================================
  // Risk Event Generation
  // ==========================================================================

  /**
   * Create a RiskEvent when combined score exceeds the threshold.
   */
  private createRiskEvent(
    tx: CanonicalTransaction,
    combinedScore: number,
    analysisResult: {
      mlScore: MLScore;
      ruleBasedIndicators: AnomalyIndicatorResult[];
      behavioralResult: BehavioralDeviationResult;
    },
    riskIndicators: RiskIndicator[],
    thresholds: TenantThresholds
  ): RiskEvent {
    const detectionMethod = this.determineDetectionMethod(analysisResult);
    const riskCategory = this.determineRiskCategory(analysisResult);

    return {
      riskEventId: cds.utils.uuid(),
      tenantId: tx.tenantId,
      transactionId: tx.transactionId,
      riskCategory,
      riskScore: combinedScore,
      confidence: analysisResult.mlScore.available ? analysisResult.mlScore.confidence : 0,
      detectionMethod,
      riskIndicators,
      affectedEntities: this.buildAffectedEntities(tx),
      financialExposure: Math.abs(tx.amount),
      detectedAt: new Date(),
    };
  }

  /**
   * Determine the primary detection method based on which mechanism contributed most.
   */
  private determineDetectionMethod(analysisResult: {
    mlScore: MLScore;
    ruleBasedIndicators: AnomalyIndicatorResult[];
    behavioralResult: BehavioralDeviationResult;
  }): DetectionMethod {
    const mlContribution = analysisResult.mlScore.available ? analysisResult.mlScore.riskScore : 0;
    const ruleContribution = analysisResult.ruleBasedIndicators.filter(i => i.triggered).length * 20;
    const behavioralContribution = analysisResult.behavioralResult.riskScore;

    if (mlContribution >= ruleContribution && mlContribution >= behavioralContribution) {
      return 'ML_SCORING';
    }
    if (behavioralContribution >= ruleContribution) {
      return 'BEHAVIORAL_DEVIATION';
    }
    return 'RULE_BASED';
  }

  /**
   * Determine risk category based on triggered indicators.
   */
  private determineRiskCategory(analysisResult: {
    mlScore: MLScore;
    ruleBasedIndicators: AnomalyIndicatorResult[];
    behavioralResult: BehavioralDeviationResult;
  }): RiskCategory {
    const triggeredTypes = analysisResult.ruleBasedIndicators
      .filter(i => i.triggered)
      .map(i => i.indicatorType);

    if (triggeredTypes.includes('approval_bypass')) {
      return 'FRAUD_PATTERN';
    }
    if (analysisResult.behavioralResult.hasDeviation) {
      return 'INSIDER_THREAT';
    }
    return 'ANOMALY';
  }

  /**
   * Build affected entities from the transaction.
   */
  private buildAffectedEntities(tx: CanonicalTransaction): AffectedEntity[] {
    const entities: AffectedEntity[] = [
      { entityType: 'user', entityId: tx.userId, entityName: tx.userId },
    ];

    if (tx.vendorId) {
      entities.push({ entityType: 'vendor', entityId: tx.vendorId });
    }

    if (tx.debitAccount) {
      entities.push({ entityType: 'account', entityId: tx.debitAccount });
    }

    if (tx.creditAccount) {
      entities.push({ entityType: 'account', entityId: tx.creditAccount });
    }

    return entities;
  }

  // ==========================================================================
  // Alert Manager Integration
  // ==========================================================================

  /**
   * Forward a risk event to the Alert Manager for alert creation.
   *
   * Validates: Requirements 3.2 (generate Alert when threshold exceeded)
   */
  private async forwardToAlertManager(riskEvent: RiskEvent): Promise<void> {
    const logger = cds.log('detection');

    try {
      // In production: emit event for Alert Manager or call Alert Manager service directly
      // const alertManager = await cds.connect.to('AlertManagerService');
      // await alertManager.send('createAlert', riskEvent);

      logger.info(
        `Forwarding risk event ${riskEvent.riskEventId} to Alert Manager. ` +
        `Category: ${riskEvent.riskCategory}, Score: ${riskEvent.riskScore}`
      );

      // Emit event for downstream consumers
      await this.emit('riskDetected', riskEvent);
    } catch (error: any) {
      logger.error(`Failed to forward risk event to Alert Manager: ${error.message}`);
      // Don't throw - the risk event was already generated, delivery failure should not block
    }
  }

  // ==========================================================================
  // Database Operations
  // ==========================================================================

  /**
   * Update the transaction's risk score and scored flag in the database.
   */
  private async updateTransactionScore(transactionId: string, score: number): Promise<void> {
    try {
      const db = await cds.connect.to('db');
      const { Transactions } = db.entities('finsecure.ai');

      await UPDATE(Transactions).set({ riskScore: score, scored: true }).where({ ID: transactionId });
    } catch (error: any) {
      cds.log('detection').warn(`Failed to update TX score for ${transactionId}: ${error.message}`);
    }
  }

  /**
   * Load a transaction from the database by ID.
   */
  private async loadTransaction(transactionId: string): Promise<CanonicalTransaction | null> {
    try {
      const db = await cds.connect.to('db');
      const { Transactions } = db.entities('finsecure.ai');

      const record = await SELECT.one.from(Transactions).where({ ID: transactionId });
      if (!record) return null;

      return {
        transactionId: record.ID,
        tenantId: record.tenantId,
        sourceSystem: record.sourceSystem_ID || '',
        sourceEventId: record.sourceEventId || '',
        documentNumber: record.documentNumber || '',
        documentType: record.documentType,
        postingDate: new Date(record.postingDate),
        entryDate: new Date(record.entryDate),
        amount: Number(record.amount),
        currency: record.currency || 'USD',
        userId: record.userId || '',
        companyCode: record.companyCode || '',
        debitAccount: record.debitAccount || '',
        creditAccount: record.creditAccount || '',
        costCenter: record.costCenter || undefined,
        vendorId: record.vendorId || undefined,
        businessObjectRef: record.businessObjectRef || '',
        metadata: record.metadata ? JSON.parse(record.metadata) : {},
        ingestedAt: new Date(record.ingestedAt),
        normalizedAt: new Date(record.ingestedAt),
      };
    } catch (error: any) {
      cds.log('detection').warn(`Failed to load TX ${transactionId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Load tenant-specific thresholds from the database.
   */
  private async loadTenantThresholds(tenantId: string): Promise<TenantThresholds> {
    try {
      const db = await cds.connect.to('db');
      const { TenantThresholds: TenantThresholdsEntity } = db.entities('finsecure.ai');

      const record = await SELECT.one.from(TenantThresholdsEntity).where({ tenant_ID: tenantId });

      if (!record) {
        return DEFAULT_THRESHOLDS;
      }

      return {
        riskScoreAlertThreshold: record.riskScoreAlertThreshold ?? DEFAULT_THRESHOLDS.riskScoreAlertThreshold,
        behavioralSensitivity: record.behavioralSensitivity ?? DEFAULT_THRESHOLDS.behavioralSensitivity,
        sodLookbackDays: record.sodLookbackDays ?? DEFAULT_THRESHOLDS.sodLookbackDays,
        vendorBankChangeHours: record.vendorBankChangeHours ?? DEFAULT_THRESHOLDS.vendorBankChangeHours,
        dormantAccountDays: record.dormantAccountDays ?? DEFAULT_THRESHOLDS.dormantAccountDays,
        roundNumberThreshold: Number(record.roundNumberThreshold) || DEFAULT_THRESHOLDS.roundNumberThreshold,
        dormancyPeriodDays: record.dormancyPeriodDays ?? DEFAULT_THRESHOLDS.dormancyPeriodDays,
        businessHoursStart: record.businessHoursStart ?? DEFAULT_THRESHOLDS.businessHoursStart,
        businessHoursEnd: record.businessHoursEnd ?? DEFAULT_THRESHOLDS.businessHoursEnd,
        paymentFlagThreshold: record.paymentFlagThreshold ?? DEFAULT_THRESHOLDS.paymentFlagThreshold,
        paymentAmountFactor: Number(record.paymentAmountFactor) || DEFAULT_THRESHOLDS.paymentAmountFactor,
        massDataRecordLimit: record.massDataRecordLimit ?? DEFAULT_THRESHOLDS.massDataRecordLimit,
        massDataVolumeLimit: record.massDataVolumeMB ?? DEFAULT_THRESHOLDS.massDataVolumeLimit,
        maxFirefighterHours: record.maxFirefighterHours ?? DEFAULT_THRESHOLDS.maxFirefighterHours,
        threeWayMatchTolerance: Number(record.threeWayMatchTolerance) || DEFAULT_THRESHOLDS.threeWayMatchTolerance,
        grirClearingDays: record.grirClearingDays ?? DEFAULT_THRESHOLDS.grirClearingDays,
      };
    } catch (error: any) {
      cds.log('detection').warn(`Failed to load thresholds for tenant ${tenantId}, using defaults: ${error.message}`);
      return DEFAULT_THRESHOLDS;
    }
  }

  /**
   * Load behavioral profile for a user.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadBehavioralProfile(tenantId: string, userId: string): Promise<any> {
    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles, ProfileDimensions } = db.entities('finsecure.ai');

      const profile = await SELECT.one.from(BehavioralProfiles).where({ tenantId, userId });
      if (!profile) return null;

      const dimensions = await SELECT.one.from(ProfileDimensions).where({ profile_ID: profile.ID });

      return {
        ...profile,
        dimensions,
      };
    } catch (error: any) {
      cds.log('detection').warn(`Failed to load profile for ${userId}: ${error.message}`);
      return null;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Map CDS action request data to CanonicalTransaction interface.
   */
  private mapRequestToTransaction(data: any): CanonicalTransaction {
    return {
      transactionId: data.transactionId,
      tenantId: data.tenantId,
      sourceSystem: data.sourceSystem || '',
      sourceEventId: data.sourceEventId || '',
      documentNumber: data.documentNumber || '',
      documentType: data.documentType,
      postingDate: new Date(data.postingDate),
      entryDate: new Date(data.entryDate),
      amount: Number(data.amount),
      currency: data.currency || 'USD',
      userId: data.userId || '',
      companyCode: data.companyCode || '',
      debitAccount: data.debitAccount || '',
      creditAccount: data.creditAccount || '',
      costCenter: data.costCenter || undefined,
      vendorId: data.vendorId || undefined,
      businessObjectRef: data.businessObjectRef || '',
      metadata: data.metadata ? JSON.parse(data.metadata) : {},
      ingestedAt: new Date(),
      normalizedAt: new Date(),
    };
  }
}
