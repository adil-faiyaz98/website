import cds = require('@sap/cds');
import { TenantThresholds, RiskIndicator, AffectedEntity } from '../types';
import { AlertPriority } from '../types/enums';

// ============================================================================
// Interfaces
// ============================================================================

/** A single payment within a payment run */
export interface PaymentRunPayment {
  /** Unique payment identifier */
  paymentId: string;
  /** Vendor identifier */
  vendorId: string;
  /** Payment amount */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Company code */
  companyCode: string;
  /** Payment document reference */
  documentNumber?: string;
}

/** Payment run event received from Event Mesh */
export interface PaymentRunEvent {
  /** Unique payment run identifier */
  paymentRunId: string;
  /** Tenant this payment run belongs to */
  tenantId: string;
  /** List of payments in this run */
  payments: PaymentRunPayment[];
  /** When the payment run was initiated */
  initiatedAt: Date;
  /** User who initiated the payment run */
  initiatedBy: string;
  /** Company code for the payment run */
  companyCode: string;
}

/** Result of scoring a single payment */
export interface PaymentScoreResult {
  /** Payment identifier */
  paymentId: string;
  /** Vendor identifier */
  vendorId: string;
  /** Payment amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Assigned risk score (0-100) */
  riskScore: number;
  /** Whether this payment is flagged */
  flagged: boolean;
  /** Reasons for flagging */
  riskReasons: string[];
  /** Historical average payment for this vendor */
  historicalAverage?: number;
  /** Number of historical payments for this vendor */
  historicalCount: number;
}

/** Complete payment run analysis result */
export interface PaymentRunAnalysis {
  /** Payment run identifier */
  paymentRunId: string;
  /** Tenant identifier */
  tenantId: string;
  /** Whether the run is cleared for execution */
  cleared: boolean;
  /** Whether the entire run is flagged for manual review (ML unavailable) */
  flaggedForManualReview: boolean;
  /** Individual payment score results */
  paymentResults: PaymentScoreResult[];
  /** Pre-execution risk summary */
  riskSummary: PaymentRunRiskSummary;
  /** Alert generated for flagged payments (if any) */
  alert?: PaymentRunAlert;
  /** Analysis completion timestamp */
  analyzedAt: Date;
  /** Analysis duration in milliseconds */
  analysisDurationMs: number;
}

/** Pre-execution risk summary for the Dashboard */
export interface PaymentRunRiskSummary {
  /** Total payment run amount */
  totalAmount: number;
  /** Number of payments in the run */
  numberOfPayments: number;
  /** Number of flagged payments */
  numberOfFlagged: number;
  /** Highest individual Risk_Score */
  highestRiskScore: number;
  /** Aggregate Risk_Score (maximum across all payments) */
  aggregateRiskScore: number;
}

/** Alert generated for flagged payments */
export interface PaymentRunAlert {
  /** Alert identifier */
  alertId: string;
  /** Alert priority */
  priority: AlertPriority;
  /** Flagged payment details */
  flaggedPayments: FlaggedPaymentDetail[];
  /** Payment run reference */
  paymentRunId: string;
  /** Alert title */
  title: string;
  /** Alert description */
  description: string;
  /** Risk indicators */
  riskIndicators: RiskIndicator[];
  /** Affected entities */
  affectedEntities: AffectedEntity[];
  /** Financial exposure (sum of flagged payment amounts) */
  financialExposure: number;
}

/** Detail for a single flagged payment within an alert */
export interface FlaggedPaymentDetail {
  /** Payment identifier */
  paymentId: string;
  /** Payment amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Vendor identifier */
  vendorId: string;
  /** Individual Risk_Score */
  riskScore: number;
  /** Risk reasons */
  riskReasons: string[];
}

/** Historical vendor payment data */
interface VendorPaymentHistory {
  /** Average payment amount over rolling 12 months */
  averageAmount: number;
  /** Number of historical payments in the lookback period */
  count: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum time allowed for payment run analysis (60 seconds) */
const PAYMENT_RUN_ANALYSIS_TIMEOUT_MS = 60000;

/** Lookback period for rolling historical average (12 months) */
const HISTORICAL_LOOKBACK_MONTHS = 12;

/** Minimum number of historical payments required to use average comparison */
const MIN_HISTORICAL_PAYMENTS = 3;

/** Default thresholds used when tenant config is not found */
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

// ============================================================================
// Payment Run Analysis Implementation
// ============================================================================

/**
 * Analyze a payment run for fraud indicators before execution.
 * Scores all payments within 60 seconds and generates appropriate events.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 *
 * @param tenantId - Tenant identifier
 * @param paymentRun - Payment run event from Event Mesh
 * @returns Payment run analysis result including scores, flags, and alerts
 */
export async function analyzePaymentRun(
  tenantId: string,
  paymentRun: PaymentRunEvent
): Promise<PaymentRunAnalysis> {
  const logger = cds.log('payment-run-analysis');
  const startTime = Date.now();

  logger.info(
    `Analyzing payment run ${paymentRun.paymentRunId} for tenant ${tenantId} ` +
    `with ${paymentRun.payments.length} payments`
  );

  try {
    // Load tenant-specific thresholds
    const thresholds = await loadTenantThresholds(tenantId);

    // Score all payments with timeout enforcement
    // Validates: Requirement 7.1 (score ALL payments within 60 seconds)
    const paymentResults = await scorePaymentsWithTimeout(
      tenantId,
      paymentRun,
      thresholds
    );

    const analysisDurationMs = Date.now() - startTime;
    const flaggedPayments = paymentResults.filter(p => p.flagged);

    // Build the pre-execution risk summary
    // Validates: Requirement 7.5
    const riskSummary = buildRiskSummary(paymentResults);

    // Determine if the run is cleared
    // Validates: Requirement 7.2
    const cleared = flaggedPayments.length === 0;

    let alert: PaymentRunAlert | undefined;

    if (cleared) {
      // Publish clearance event
      // Validates: Requirement 7.2
      await publishClearanceEvent(tenantId, paymentRun.paymentRunId);
      logger.info(`Payment run ${paymentRun.paymentRunId} cleared for execution`);
    } else {
      // Generate aggregate alert for flagged payments
      // Validates: Requirement 7.4
      alert = generateFlaggedPaymentAlert(
        tenantId,
        paymentRun.paymentRunId,
        flaggedPayments,
        riskSummary
      );
      await publishAlert(tenantId, alert);
      logger.warn(
        `Payment run ${paymentRun.paymentRunId}: ${flaggedPayments.length} payment(s) flagged`
      );
    }

    const result: PaymentRunAnalysis = {
      paymentRunId: paymentRun.paymentRunId,
      tenantId,
      cleared,
      flaggedForManualReview: false,
      paymentResults,
      riskSummary,
      alert,
      analyzedAt: new Date(),
      analysisDurationMs,
    };

    logger.info(
      `Payment run ${paymentRun.paymentRunId} analysis complete in ${analysisDurationMs}ms. ` +
      `Cleared: ${cleared}, Flagged: ${flaggedPayments.length}/${paymentResults.length}`
    );

    return result;
  } catch (error: any) {
    const elapsed = Date.now() - startTime;

    // Validates: Requirement 7.7 (ML unavailable or timeout → flag entire run)
    if (elapsed >= PAYMENT_RUN_ANALYSIS_TIMEOUT_MS || error.message === 'ML_UNAVAILABLE') {
      logger.error(
        `Payment run analysis failed/timed out for ${paymentRun.paymentRunId} after ${elapsed}ms: ${error.message}`
      );
      return handleAnalysisFailure(tenantId, paymentRun, elapsed);
    }

    throw error;
  }
}

/**
 * Score all payments in a run within the 60-second timeout.
 * Uses ML models and rule-based checks to assign Risk_Scores.
 *
 * Validates: Requirements 7.1, 7.3
 */
async function scorePaymentsWithTimeout(
  tenantId: string,
  paymentRun: PaymentRunEvent,
  thresholds: TenantThresholds
): Promise<PaymentScoreResult[]> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Payment run analysis timeout exceeded')), PAYMENT_RUN_ANALYSIS_TIMEOUT_MS);
  });

  const scoringPromise = scoreAllPayments(tenantId, paymentRun, thresholds);

  return Promise.race([scoringPromise, timeoutPromise]);
}

/**
 * Score all payments against fraud detection rules and ML models.
 * Checks each payment against vendor historical payment averages.
 *
 * Validates: Requirements 7.1, 7.3
 */
async function scoreAllPayments(
  tenantId: string,
  paymentRun: PaymentRunEvent,
  thresholds: TenantThresholds
): Promise<PaymentScoreResult[]> {
  const logger = cds.log('payment-run-analysis');

  // Load vendor payment histories in batch for efficiency
  const vendorIds = Array.from(new Set(paymentRun.payments.map(p => p.vendorId)));
  const vendorHistories = await loadVendorPaymentHistories(tenantId, vendorIds);

  // Attempt ML scoring for the batch
  const mlAvailable = await checkMLAvailability(tenantId);

  if (!mlAvailable) {
    throw new Error('ML_UNAVAILABLE');
  }

  // Score each payment
  const results: PaymentScoreResult[] = [];

  for (const payment of paymentRun.payments) {
    const result = await scorePayment(
      tenantId,
      payment,
      vendorHistories.get(payment.vendorId) || { averageAmount: 0, count: 0 },
      thresholds,
      mlAvailable
    );
    results.push(result);
  }

  logger.info(`Scored ${results.length} payments for run in tenant ${tenantId}`);
  return results;
}

/**
 * Score an individual payment against historical averages and fraud rules.
 *
 * Validates: Requirements 7.1, 7.3
 */
async function scorePayment(
  tenantId: string,
  payment: PaymentRunPayment,
  vendorHistory: VendorPaymentHistory,
  thresholds: TenantThresholds,
  mlAvailable: boolean
): Promise<PaymentScoreResult> {
  const riskReasons: string[] = [];
  let riskScore = 0;

  // Validates: Requirement 7.3
  // Check if payment exceeds historical average by configurable factor
  const amountAnomaly = checkPaymentAmountAnomaly(
    payment,
    vendorHistory,
    thresholds.paymentAmountFactor
  );

  if (amountAnomaly.flagged) {
    riskReasons.push(...amountAnomaly.reasons);
    riskScore = Math.max(riskScore, amountAnomaly.score);
  }

  // Get ML-based score if available
  if (mlAvailable) {
    const mlScore = await getMLPaymentScore(tenantId, payment);
    if (mlScore > riskScore) {
      riskScore = mlScore;
      if (mlScore >= thresholds.paymentFlagThreshold) {
        riskReasons.push(`ML model assigned risk score of ${mlScore}`);
      }
    }
  }

  // Determine if payment is flagged
  // Validates: Requirement 7.3 (flag if exceeds threshold)
  const flagged = riskScore >= thresholds.paymentFlagThreshold;

  return {
    paymentId: payment.paymentId,
    vendorId: payment.vendorId,
    amount: payment.amount,
    currency: payment.currency,
    riskScore,
    flagged,
    riskReasons,
    historicalAverage: vendorHistory.count >= MIN_HISTORICAL_PAYMENTS ? vendorHistory.averageAmount : undefined,
    historicalCount: vendorHistory.count,
  };
}

/**
 * Check if a payment amount exceeds the vendor's historical average by the configured factor.
 * For vendors with fewer than 3 historical payments, flag any amount.
 *
 * Validates: Requirement 7.3
 */
export function checkPaymentAmountAnomaly(
  payment: PaymentRunPayment,
  vendorHistory: VendorPaymentHistory,
  amountFactor: number
): { flagged: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Vendors with fewer than 3 historical payments: flag any amount
  if (vendorHistory.count < MIN_HISTORICAL_PAYMENTS) {
    const score = 75; // High risk for vendors with insufficient history
    reasons.push(
      `Vendor ${payment.vendorId} has only ${vendorHistory.count} historical payment(s) ` +
      `(minimum ${MIN_HISTORICAL_PAYMENTS} required for average comparison). Flagged for review.`
    );
    return { flagged: true, score, reasons };
  }

  // Check if amount exceeds historical average by configurable factor
  const threshold = vendorHistory.averageAmount * amountFactor;
  if (payment.amount > threshold) {
    // Score proportional to how much it exceeds the threshold
    const excessFactor = payment.amount / vendorHistory.averageAmount;
    const score = Math.min(100, Math.round(50 + (excessFactor - amountFactor) * 10));
    reasons.push(
      `Payment amount ${payment.amount} ${payment.currency} exceeds ${amountFactor}x historical average ` +
      `(${vendorHistory.averageAmount.toFixed(2)} ${payment.currency}) for vendor ${payment.vendorId}. ` +
      `Factor: ${excessFactor.toFixed(2)}x`
    );
    return { flagged: true, score: Math.max(score, 70), reasons };
  }

  return { flagged: false, score: 0, reasons: [] };
}

/**
 * Build the pre-execution risk summary for the Dashboard.
 *
 * Validates: Requirement 7.5
 * Shows: total amount, number of payments, number flagged, highest Risk_Score, aggregate score
 */
export function buildRiskSummary(paymentResults: PaymentScoreResult[]): PaymentRunRiskSummary {
  const totalAmount = paymentResults.reduce((sum, p) => sum + p.amount, 0);
  const numberOfPayments = paymentResults.length;
  const numberOfFlagged = paymentResults.filter(p => p.flagged).length;
  const highestRiskScore = paymentResults.length > 0
    ? Math.max(...paymentResults.map(p => p.riskScore))
    : 0;
  // Aggregate Risk_Score is the maximum Risk_Score across all payments (Requirement 7.5)
  const aggregateRiskScore = highestRiskScore;

  return {
    totalAmount,
    numberOfPayments,
    numberOfFlagged,
    highestRiskScore,
    aggregateRiskScore,
  };
}

/**
 * Generate an alert for flagged payments within a payment run.
 *
 * Validates: Requirement 7.4
 * Contains: flagged payment identifiers, amounts, vendor IDs, individual Risk_Scores,
 * risk reasons, and overall payment run reference
 */
export function generateFlaggedPaymentAlert(
  tenantId: string,
  paymentRunId: string,
  flaggedPayments: PaymentScoreResult[],
  riskSummary: PaymentRunRiskSummary
): PaymentRunAlert {
  const flaggedDetails: FlaggedPaymentDetail[] = flaggedPayments.map(p => ({
    paymentId: p.paymentId,
    amount: p.amount,
    currency: p.currency,
    vendorId: p.vendorId,
    riskScore: p.riskScore,
    riskReasons: p.riskReasons,
  }));

  const financialExposure = flaggedPayments.reduce((sum, p) => sum + p.amount, 0);

  // Determine priority based on highest risk score and financial exposure
  const priority = calculateAlertPriority(riskSummary.highestRiskScore, financialExposure);

  const riskIndicators: RiskIndicator[] = flaggedPayments.map(p => ({
    indicatorType: 'payment_amount_anomaly',
    description: p.riskReasons.join('; '),
    observedValue: p.amount,
    expectedRange: p.historicalAverage
      ? { min: 0, max: p.historicalAverage * 3 }
      : undefined,
    weight: 0.8,
  }));

  const affectedEntities: AffectedEntity[] = [
    ...flaggedPayments.map(p => ({
      entityType: 'vendor',
      entityId: p.vendorId,
      entityName: `Vendor ${p.vendorId}`,
    })),
  ];

  // Deduplicate affected entities
  const uniqueEntities = affectedEntities.filter(
    (entity, index, arr) =>
      arr.findIndex(e => e.entityType === entity.entityType && e.entityId === entity.entityId) === index
  );

  return {
    alertId: cds.utils.uuid(),
    priority,
    flaggedPayments: flaggedDetails,
    paymentRunId,
    title: `Payment Run ${paymentRunId}: ${flaggedPayments.length} payment(s) flagged for review`,
    description:
      `Payment run analysis detected ${flaggedPayments.length} suspicious payment(s) ` +
      `with total exposure of ${financialExposure.toFixed(2)}. ` +
      `Highest risk score: ${riskSummary.highestRiskScore}. ` +
      `Review required before execution.`,
    riskIndicators,
    affectedEntities: uniqueEntities,
    financialExposure,
  };
}

/**
 * Handle analysis failure due to timeout or ML unavailability.
 * Flags the entire payment run for manual review.
 *
 * Validates: Requirement 7.7
 */
async function handleAnalysisFailure(
  tenantId: string,
  paymentRun: PaymentRunEvent,
  elapsedMs: number
): Promise<PaymentRunAnalysis> {
  const logger = cds.log('payment-run-analysis');

  logger.warn(
    `Flagging entire payment run ${paymentRun.paymentRunId} for manual review ` +
    `due to analysis failure after ${elapsedMs}ms`
  );

  // Create results with all payments flagged
  const paymentResults: PaymentScoreResult[] = paymentRun.payments.map(p => ({
    paymentId: p.paymentId,
    vendorId: p.vendorId,
    amount: p.amount,
    currency: p.currency,
    riskScore: 100, // Maximum risk when unable to score
    flagged: true,
    riskReasons: ['ML models unavailable or analysis timed out. Flagged for manual review.'],
    historicalCount: 0,
  }));

  const riskSummary = buildRiskSummary(paymentResults);

  // Generate alert indicating ML unavailability
  const alert: PaymentRunAlert = {
    alertId: cds.utils.uuid(),
    priority: 'HIGH',
    flaggedPayments: paymentResults.map(p => ({
      paymentId: p.paymentId,
      amount: p.amount,
      currency: p.currency,
      vendorId: p.vendorId,
      riskScore: p.riskScore,
      riskReasons: p.riskReasons,
    })),
    paymentRunId: paymentRun.paymentRunId,
    title: `Payment Run ${paymentRun.paymentRunId}: Flagged for manual review - ML unavailable`,
    description:
      `ML models were unavailable or failed to return results within 60 seconds. ` +
      `The entire payment run (${paymentRun.payments.length} payments, ` +
      `total ${riskSummary.totalAmount.toFixed(2)}) has been flagged for manual review.`,
    riskIndicators: [{
      indicatorType: 'ml_unavailable',
      description: 'ML models unavailable within 60 second timeout',
      observedValue: elapsedMs,
      expectedRange: { min: 0, max: PAYMENT_RUN_ANALYSIS_TIMEOUT_MS },
      weight: 1.0,
    }],
    affectedEntities: [{
      entityType: 'payment_run',
      entityId: paymentRun.paymentRunId,
      entityName: `Payment Run ${paymentRun.paymentRunId}`,
    }],
    financialExposure: riskSummary.totalAmount,
  };

  await publishAlert(tenantId, alert);

  return {
    paymentRunId: paymentRun.paymentRunId,
    tenantId,
    cleared: false,
    flaggedForManualReview: true,
    paymentResults,
    riskSummary,
    alert,
    analyzedAt: new Date(),
    analysisDurationMs: elapsedMs,
  };
}

// ============================================================================
// Data Access Helpers
// ============================================================================

/**
 * Load vendor payment histories for the rolling 12-month period.
 * Returns a map of vendorId → { averageAmount, count }.
 */
async function loadVendorPaymentHistories(
  tenantId: string,
  vendorIds: string[]
): Promise<Map<string, VendorPaymentHistory>> {
  const logger = cds.log('payment-run-analysis');
  const histories = new Map<string, VendorPaymentHistory>();

  if (vendorIds.length === 0) return histories;

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - HISTORICAL_LOOKBACK_MONTHS);

    for (const vendorId of vendorIds) {
      const payments = await SELECT.from(Transactions).where({
        tenantId,
        vendorId,
        documentType: 'PAYMENT_DOCUMENT',
        postingDate: { '>=': lookbackDate.toISOString().split('T')[0] },
      });

      if (payments && payments.length > 0) {
        const totalAmount = payments.reduce((sum: number, p: any) => sum + Math.abs(Number(p.amount)), 0);
        histories.set(vendorId, {
          averageAmount: totalAmount / payments.length,
          count: payments.length,
        });
      } else {
        histories.set(vendorId, { averageAmount: 0, count: 0 });
      }
    }
  } catch (error: any) {
    logger.warn(`Failed to load vendor payment histories: ${error.message}`);
    // Return empty histories - vendors will be treated as having no history
    for (const vendorId of vendorIds) {
      if (!histories.has(vendorId)) {
        histories.set(vendorId, { averageAmount: 0, count: 0 });
      }
    }
  }

  return histories;
}

/**
 * Check if ML models are available for the tenant.
 * Returns false if models are not reachable, triggering Requirement 7.7.
 */
async function checkMLAvailability(tenantId: string): Promise<boolean> {
  try {
    const aiCore = await cds.connect.to('aicore');
    if (!aiCore) return false;

    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    const activeModel = await SELECT.one.from(MLModels).where({
      tenantId,
      status: 'ACTIVE',
      modelType: 'FRAUD',
    });

    return !!activeModel?.aiCoreDeploymentId;
  } catch {
    return false;
  }
}

/**
 * Get ML-based risk score for a single payment.
 */
async function getMLPaymentScore(tenantId: string, payment: PaymentRunPayment): Promise<number> {
  try {
    const aiCore = await cds.connect.to('aicore');
    const db = await cds.connect.to('db');
    const { MLModels } = db.entities('finsecure.ai');

    const activeModel = await SELECT.one.from(MLModels).where({
      tenantId,
      status: 'ACTIVE',
      modelType: 'FRAUD',
    });

    if (!activeModel?.aiCoreDeploymentId) return 0;

    const response = await aiCore.send(
      'POST',
      `/v2/inference/deployments/${activeModel.aiCoreDeploymentId}/predict`,
      {
        features: {
          amount: payment.amount,
          vendorId: payment.vendorId,
          currency: payment.currency,
          companyCode: payment.companyCode,
          documentType: 'PAYMENT_DOCUMENT',
        },
      }
    );

    return Math.max(0, Math.min(100, Math.round(response?.predictions?.[0]?.score ?? 0)));
  } catch {
    // ML scoring failure for individual payment returns 0 (not a full failure)
    return 0;
  }
}

/**
 * Load tenant-specific thresholds from the database.
 */
async function loadTenantThresholds(tenantId: string): Promise<TenantThresholds> {
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
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

// ============================================================================
// Event Publishing
// ============================================================================

/**
 * Publish a clearance event to the Event Stream when no payments are flagged.
 *
 * Validates: Requirement 7.2
 */
async function publishClearanceEvent(tenantId: string, paymentRunId: string): Promise<void> {
  const logger = cds.log('payment-run-analysis');

  try {
    const messaging = await cds.connect.to('messaging');
    await messaging.emit('finsecure/payment-run/cleared', {
      tenantId,
      paymentRunId,
      clearedAt: new Date().toISOString(),
      status: 'CLEARED',
    });

    logger.info(`Published clearance event for payment run ${paymentRunId}`);
  } catch (error: any) {
    logger.warn(`Failed to publish clearance event: ${error.message}`);
    // Non-critical: log but don't throw
  }
}

/**
 * Publish an alert for flagged payments.
 *
 * Validates: Requirement 7.4
 */
async function publishAlert(tenantId: string, alert: PaymentRunAlert): Promise<void> {
  const logger = cds.log('payment-run-analysis');

  try {
    const messaging = await cds.connect.to('messaging');
    await messaging.emit('finsecure/payment-run/alert', {
      tenantId,
      alertId: alert.alertId,
      paymentRunId: alert.paymentRunId,
      priority: alert.priority,
      title: alert.title,
      flaggedCount: alert.flaggedPayments.length,
      financialExposure: alert.financialExposure,
      createdAt: new Date().toISOString(),
    });

    logger.info(`Published alert ${alert.alertId} for payment run ${alert.paymentRunId}`);
  } catch (error: any) {
    logger.warn(`Failed to publish payment run alert: ${error.message}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate alert priority based on risk score and financial exposure.
 * Follows the same rules as the Alert Manager:
 * - Critical: Risk_Score >= 90 or exposure >= 1,000,000
 * - High: Risk_Score >= 70 or exposure >= 100,000
 * - Medium: Risk_Score >= 40
 * - Low: otherwise
 */
export function calculateAlertPriority(
  riskScore: number,
  financialExposure: number
): AlertPriority {
  if (riskScore >= 90 || financialExposure >= 1000000) {
    return 'CRITICAL';
  }
  if (riskScore >= 70 || financialExposure >= 100000) {
    return 'HIGH';
  }
  if (riskScore >= 40) {
    return 'MEDIUM';
  }
  return 'LOW';
}
