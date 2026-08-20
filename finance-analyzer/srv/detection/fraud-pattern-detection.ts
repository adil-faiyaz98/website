import cds = require('@sap/cds');
import { CanonicalTransaction, RiskEvent, RiskIndicator, AffectedEntity, TenantThresholds } from '../types';
import { DetectionMethod, RiskCategory } from '../types/enums';

// ============================================================================
// Interfaces
// ============================================================================

/** Type of fraud pattern detected */
export type FraudPatternType =
  | 'DUPLICATE_PAYMENT'
  | 'VENDOR_BANK_MANIPULATION'
  | 'ROUND_TRIPPING'
  | 'SPLIT_PAYMENT'
  | 'NO_PO_VENDOR';

/** A detected fraud pattern match */
export interface FraudMatch {
  /** Type of fraud pattern */
  patternType: FraudPatternType;
  /** ML model confidence (0-100) */
  confidence: number;
  /** Financial exposure amount */
  financialExposure: number;
  /** Calculated fraud risk score (0-100) */
  riskScore: number;
  /** Human-readable description of the match */
  description: string;
  /** Whether this is a low-confidence finding routed to manual review */
  lowConfidence: boolean;
  /** Related transaction IDs involved in the pattern */
  relatedTransactionIds: string[];
  /** Risk indicators contributing to the detection */
  riskIndicators: RiskIndicator[];
  /** Affected entities */
  affectedEntities: AffectedEntity[];
}

/** Configuration for fraud detection thresholds */
export interface FraudDetectionConfig {
  /** Window for duplicate payment detection in days (default 30) */
  duplicatePaymentWindowDays: number;
  /** Hours after bank change to correlate with payment (default 48) */
  vendorBankChangeHours: number;
  /** Window for round-tripping detection in days (default 90) */
  roundTrippingWindowDays: number;
  /** Business days window for split payment detection (default 5) */
  splitPaymentWindowDays: number;
  /** Months to look back for PO history (default 12) */
  noPOLookbackMonths: number;
  /** Approval threshold amount for split payment detection */
  approvalThreshold: number;
  /** ML confidence threshold below which findings are low-confidence (default 50) */
  lowConfidenceThreshold: number;
  /** Financial exposure threshold for critical classification (default 10000) */
  criticalExposureThreshold: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default fraud detection configuration */
const DEFAULT_FRAUD_CONFIG: FraudDetectionConfig = {
  duplicatePaymentWindowDays: 30,
  vendorBankChangeHours: 48,
  roundTrippingWindowDays: 90,
  splitPaymentWindowDays: 5,
  noPOLookbackMonths: 12,
  approvalThreshold: 10000,
  lowConfidenceThreshold: 50,
  criticalExposureThreshold: 10000,
};

// ============================================================================
// Fraud Pattern Detection Module
// ============================================================================

/**
 * Detect fraud patterns in a transaction.
 * Runs all five fraud pattern checks in parallel and returns matches.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * @param tenantId - Tenant identifier
 * @param tx - Canonical transaction to analyze
 * @param thresholds - Tenant-specific thresholds
 * @returns Array of fraud pattern matches
 */
export async function detectFraudPatterns(
  tenantId: string,
  tx: CanonicalTransaction,
  thresholds: TenantThresholds
): Promise<FraudMatch[]> {
  const logger = cds.log('fraud-detection');
  logger.info(`Detecting fraud patterns for TX ${tx.transactionId}, tenant ${tenantId}`);

  const config = buildFraudConfig(thresholds);

  // Only check payment-related documents for fraud patterns
  if (!isPaymentRelatedDocument(tx)) {
    return [];
  }

  // Run all pattern detections in parallel
  const [duplicates, bankManipulation, roundTripping, splitPayments, noPOVendor] = await Promise.all([
    detectDuplicatePayments(tenantId, tx, config),
    detectVendorBankManipulation(tenantId, tx, config),
    detectRoundTripping(tenantId, tx, config),
    detectSplitPayments(tenantId, tx, config),
    detectNoPOVendor(tenantId, tx, config),
  ]);

  const matches: FraudMatch[] = [
    ...duplicates,
    ...bankManipulation,
    ...roundTripping,
    ...splitPayments,
    ...noPOVendor,
  ];

  logger.info(`Found ${matches.length} fraud pattern match(es) for TX ${tx.transactionId}`);
  return matches;
}

/**
 * Convert fraud matches into RiskEvents for the detection engine.
 *
 * Validates: Requirements 6.4, 6.5, 6.6
 *
 * @param tx - Source transaction
 * @param matches - Fraud matches detected
 * @param config - Fraud detection configuration
 * @returns Array of risk events
 */
export function convertToRiskEvents(
  tx: CanonicalTransaction,
  matches: FraudMatch[],
  config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG
): RiskEvent[] {
  return matches.map((match) => ({
    riskEventId: cds.utils.uuid(),
    tenantId: tx.tenantId,
    transactionId: tx.transactionId,
    riskCategory: 'FRAUD_PATTERN' as RiskCategory,
    riskScore: match.riskScore,
    confidence: match.confidence,
    detectionMethod: 'PATTERN_MATCHING' as DetectionMethod,
    riskIndicators: match.riskIndicators,
    affectedEntities: match.affectedEntities,
    financialExposure: match.financialExposure,
    detectedAt: new Date(),
  }));
}

/**
 * Determine if a fraud match should trigger a playbook or route to manual review.
 *
 * Low-confidence findings (confidence < threshold, default 50) are routed to
 * manual review WITHOUT triggering a playbook.
 *
 * Validates: Requirements 6.5, 6.6
 *
 * @param match - Fraud match to evaluate
 * @param config - Fraud detection configuration
 * @returns Whether the match should trigger a playbook
 */
export function shouldTriggerPlaybook(
  match: FraudMatch,
  config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG
): boolean {
  // Low-confidence findings are routed to manual review, no playbook
  if (match.lowConfidence) {
    return false;
  }

  // High financial exposure triggers playbook
  if (match.financialExposure >= config.criticalExposureThreshold) {
    return true;
  }

  // High risk score triggers playbook
  if (match.riskScore >= 70) {
    return true;
  }

  return false;
}

// ============================================================================
// Individual Pattern Detection Functions
// ============================================================================

/**
 * Detect duplicate payments: same amount, vendor, and reference within a
 * configurable window (default 30 days).
 *
 * Validates: Requirements 6.1, 6.3
 */
export async function detectDuplicatePayments(
  tenantId: string,
  tx: CanonicalTransaction,
  config: FraudDetectionConfig
): Promise<FraudMatch[]> {
  const logger = cds.log('fraud-detection');

  // Must have vendor and amount to check for duplicates
  if (!tx.vendorId || tx.amount === 0) {
    return [];
  }

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    const windowStart = new Date(tx.postingDate);
    windowStart.setDate(windowStart.getDate() - config.duplicatePaymentWindowDays);

    // Find other payments with same amount, vendor, and reference in the window
    const duplicateCandidates = await SELECT.from(Transactions).where({
      tenantId,
      vendorId: tx.vendorId,
      amount: tx.amount,
      documentType: 'PAYMENT_DOCUMENT',
      postingDate: { '>=': windowStart.toISOString().split('T')[0] },
      ID: { '!=': tx.transactionId },
    });

    if (!duplicateCandidates || duplicateCandidates.length === 0) {
      return [];
    }

    // Filter by matching business object reference (payment reference)
    const matchingRef = duplicateCandidates.filter(
      (candidate: any) =>
        candidate.businessObjectRef &&
        tx.businessObjectRef &&
        candidate.businessObjectRef === tx.businessObjectRef
    );

    const duplicates = matchingRef.length > 0 ? matchingRef : [];

    if (duplicates.length === 0) {
      return [];
    }

    const financialExposure = Math.abs(tx.amount);
    const mlConfidence = calculatePatternConfidence('DUPLICATE_PAYMENT', duplicates.length, financialExposure);
    const riskScore = calculateFraudRiskScore(mlConfidence, financialExposure, config);
    const isLowConfidence = mlConfidence < config.lowConfidenceThreshold;

    logger.info(
      `Duplicate payment detected for TX ${tx.transactionId}: ${duplicates.length} match(es), ` +
      `confidence=${mlConfidence}, exposure=${financialExposure}`
    );

    return [{
      patternType: 'DUPLICATE_PAYMENT',
      confidence: mlConfidence,
      financialExposure,
      riskScore,
      description: `Potential duplicate payment: amount ${tx.amount} ${tx.currency} to vendor ${tx.vendorId} ` +
        `with same reference. ${duplicates.length} matching transaction(s) within ${config.duplicatePaymentWindowDays} days.`,
      lowConfidence: isLowConfidence,
      relatedTransactionIds: duplicates.map((d: any) => d.ID),
      riskIndicators: [
        {
          indicatorType: 'duplicate_payment',
          description: `${duplicates.length} payment(s) with same amount, vendor, and reference within ${config.duplicatePaymentWindowDays} days`,
          observedValue: duplicates.length,
          expectedRange: { min: 0, max: 0 },
          weight: 0.9,
        },
      ],
      affectedEntities: [
        { entityType: 'vendor', entityId: tx.vendorId! },
        { entityType: 'user', entityId: tx.userId, entityName: tx.userId },
      ],
    }];
  } catch (error: any) {
    logger.warn(`Duplicate payment check failed for TX ${tx.transactionId}: ${error.message}`);
    return [];
  }
}

/**
 * Detect vendor bank manipulation: bank detail change followed by payment
 * within configurable period (default 48 hours).
 *
 * Validates: Requirements 6.1, 6.2
 */
export async function detectVendorBankManipulation(
  tenantId: string,
  tx: CanonicalTransaction,
  config: FraudDetectionConfig
): Promise<FraudMatch[]> {
  const logger = cds.log('fraud-detection');

  // Must be a payment document to a vendor
  if (!tx.vendorId || tx.documentType !== 'PAYMENT_DOCUMENT') {
    return [];
  }

  try {
    const db = await cds.connect.to('db');
    const { VendorBankChanges } = db.entities('finsecure.ai');

    // Look for recent bank detail changes for this vendor
    const changeWindowStart = new Date(tx.postingDate);
    changeWindowStart.setHours(changeWindowStart.getHours() - config.vendorBankChangeHours);

    const recentBankChanges = await SELECT.from(VendorBankChanges).where({
      tenantId,
      vendorId: tx.vendorId,
      changedAt: { '>=': changeWindowStart.toISOString() },
    });

    if (!recentBankChanges || recentBankChanges.length === 0) {
      return [];
    }

    const financialExposure = Math.abs(tx.amount);
    // Bank manipulation is high confidence when there's direct temporal correlation
    const mlConfidence = calculatePatternConfidence(
      'VENDOR_BANK_MANIPULATION',
      recentBankChanges.length,
      financialExposure
    );
    const riskScore = calculateFraudRiskScore(mlConfidence, financialExposure, config);
    const isLowConfidence = mlConfidence < config.lowConfidenceThreshold;

    logger.info(
      `Vendor bank manipulation detected for TX ${tx.transactionId}: ` +
      `${recentBankChanges.length} bank change(s) within ${config.vendorBankChangeHours}h, ` +
      `confidence=${mlConfidence}, exposure=${financialExposure}`
    );

    return [{
      patternType: 'VENDOR_BANK_MANIPULATION',
      confidence: mlConfidence,
      financialExposure,
      riskScore,
      description: `Payment to vendor ${tx.vendorId} within ${config.vendorBankChangeHours} hours of bank detail change. ` +
        `Amount: ${tx.amount} ${tx.currency}. ${recentBankChanges.length} recent bank change(s) detected.`,
      lowConfidence: isLowConfidence,
      relatedTransactionIds: recentBankChanges.map((c: any) => c.ID),
      riskIndicators: [
        {
          indicatorType: 'vendor_bank_manipulation',
          description: `Payment within ${config.vendorBankChangeHours}h of bank detail change for vendor ${tx.vendorId}`,
          observedValue: recentBankChanges.length,
          expectedRange: { min: 0, max: 0 },
          weight: 0.95,
        },
      ],
      affectedEntities: [
        { entityType: 'vendor', entityId: tx.vendorId! },
        { entityType: 'user', entityId: tx.userId, entityName: tx.userId },
        ...recentBankChanges.map((c: any) => ({
          entityType: 'user' as const,
          entityId: c.changingUser,
          entityName: `Bank change by ${c.changingUser}`,
        })),
      ],
    }];
  } catch (error: any) {
    logger.warn(`Vendor bank manipulation check failed for TX ${tx.transactionId}: ${error.message}`);
    return [];
  }
}

/**
 * Detect round-tripping: funds paid to a vendor and returned within
 * configurable window (default 90 days).
 *
 * Validates: Requirements 6.1
 */
export async function detectRoundTripping(
  tenantId: string,
  tx: CanonicalTransaction,
  config: FraudDetectionConfig
): Promise<FraudMatch[]> {
  const logger = cds.log('fraud-detection');

  // Must have a vendor to check for round-tripping
  if (!tx.vendorId) {
    return [];
  }

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    const windowStart = new Date(tx.postingDate);
    windowStart.setDate(windowStart.getDate() - config.roundTrippingWindowDays);

    // Look for returns/credits from the same vendor within the window
    // Round-tripping: outbound payment followed by inbound return (negative amount or credit)
    const returnTransactions = await SELECT.from(Transactions).where({
      tenantId,
      vendorId: tx.vendorId,
      postingDate: { '>=': windowStart.toISOString().split('T')[0] },
      ID: { '!=': tx.transactionId },
    });

    if (!returnTransactions || returnTransactions.length === 0) {
      return [];
    }

    // Identify potential round-trip: look for opposite-sign transactions
    // If current is a payment (positive), look for credits/returns (negative)
    // If current is negative, look for positive payments
    const currentSign = tx.amount >= 0 ? 1 : -1;
    const oppositeTransactions = returnTransactions.filter(
      (rt: any) => {
        const rtAmount = Number(rt.amount);
        const rtSign = rtAmount >= 0 ? 1 : -1;
        return rtSign !== currentSign && Math.abs(Math.abs(rtAmount) - Math.abs(tx.amount)) / Math.abs(tx.amount) < 0.1;
      }
    );

    if (oppositeTransactions.length === 0) {
      return [];
    }

    const financialExposure = Math.abs(tx.amount);
    const mlConfidence = calculatePatternConfidence('ROUND_TRIPPING', oppositeTransactions.length, financialExposure);
    const riskScore = calculateFraudRiskScore(mlConfidence, financialExposure, config);
    const isLowConfidence = mlConfidence < config.lowConfidenceThreshold;

    logger.info(
      `Round-tripping detected for TX ${tx.transactionId}: ` +
      `${oppositeTransactions.length} return transaction(s), confidence=${mlConfidence}`
    );

    return [{
      patternType: 'ROUND_TRIPPING',
      confidence: mlConfidence,
      financialExposure,
      riskScore,
      description: `Potential round-tripping: payment of ${Math.abs(tx.amount)} ${tx.currency} to vendor ${tx.vendorId} ` +
        `with ${oppositeTransactions.length} matching return(s) within ${config.roundTrippingWindowDays} days.`,
      lowConfidence: isLowConfidence,
      relatedTransactionIds: oppositeTransactions.map((rt: any) => rt.ID),
      riskIndicators: [
        {
          indicatorType: 'round_tripping',
          description: `Funds returned from vendor ${tx.vendorId} within ${config.roundTrippingWindowDays} days`,
          observedValue: oppositeTransactions.length,
          expectedRange: { min: 0, max: 0 },
          weight: 0.8,
        },
      ],
      affectedEntities: [
        { entityType: 'vendor', entityId: tx.vendorId! },
        { entityType: 'user', entityId: tx.userId, entityName: tx.userId },
      ],
    }];
  } catch (error: any) {
    logger.warn(`Round-tripping check failed for TX ${tx.transactionId}: ${error.message}`);
    return [];
  }
}

/**
 * Detect split payments: two or more payments to same vendor within 5 business
 * days that individually fall below approval threshold but collectively exceed it.
 *
 * Validates: Requirements 6.1
 */
export async function detectSplitPayments(
  tenantId: string,
  tx: CanonicalTransaction,
  config: FraudDetectionConfig
): Promise<FraudMatch[]> {
  const logger = cds.log('fraud-detection');

  // Must be a payment to a vendor
  if (!tx.vendorId || tx.documentType !== 'PAYMENT_DOCUMENT') {
    return [];
  }

  // If this payment already exceeds the approval threshold, it's not split
  if (Math.abs(tx.amount) >= config.approvalThreshold) {
    return [];
  }

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    // 5 business days ≈ 7 calendar days to account for weekends
    const windowStart = new Date(tx.postingDate);
    windowStart.setDate(windowStart.getDate() - 7);

    // Find other payments to the same vendor in the window
    const recentPayments = await SELECT.from(Transactions).where({
      tenantId,
      vendorId: tx.vendorId,
      documentType: 'PAYMENT_DOCUMENT',
      postingDate: { '>=': windowStart.toISOString().split('T')[0] },
      ID: { '!=': tx.transactionId },
    });

    if (!recentPayments || recentPayments.length === 0) {
      return [];
    }

    // Filter payments below the approval threshold
    const belowThresholdPayments = recentPayments.filter(
      (p: any) => Math.abs(Number(p.amount)) < config.approvalThreshold
    );

    if (belowThresholdPayments.length === 0) {
      return [];
    }

    // Calculate collective total including current transaction
    const collectiveTotal = belowThresholdPayments.reduce(
      (sum: number, p: any) => sum + Math.abs(Number(p.amount)), Math.abs(tx.amount)
    );

    // Split payment detected if collective total exceeds the approval threshold
    if (collectiveTotal <= config.approvalThreshold) {
      return [];
    }

    const financialExposure = collectiveTotal;
    const paymentCount = belowThresholdPayments.length + 1; // including current
    const mlConfidence = calculatePatternConfidence('SPLIT_PAYMENT', paymentCount, financialExposure);
    const riskScore = calculateFraudRiskScore(mlConfidence, financialExposure, config);
    const isLowConfidence = mlConfidence < config.lowConfidenceThreshold;

    logger.info(
      `Split payment detected for TX ${tx.transactionId}: ` +
      `${paymentCount} payments totaling ${collectiveTotal}, threshold=${config.approvalThreshold}`
    );

    return [{
      patternType: 'SPLIT_PAYMENT',
      confidence: mlConfidence,
      financialExposure,
      riskScore,
      description: `Potential split payments to vendor ${tx.vendorId}: ${paymentCount} payments within 5 business days ` +
        `totaling ${collectiveTotal} ${tx.currency} (each below approval threshold of ${config.approvalThreshold}).`,
      lowConfidence: isLowConfidence,
      relatedTransactionIds: belowThresholdPayments.map((p: any) => p.ID),
      riskIndicators: [
        {
          indicatorType: 'split_payment',
          description: `${paymentCount} payments below ${config.approvalThreshold} threshold collectively total ${collectiveTotal}`,
          observedValue: collectiveTotal,
          expectedRange: { min: 0, max: config.approvalThreshold },
          weight: 0.75,
        },
      ],
      affectedEntities: [
        { entityType: 'vendor', entityId: tx.vendorId! },
        { entityType: 'user', entityId: tx.userId, entityName: tx.userId },
      ],
    }];
  } catch (error: any) {
    logger.warn(`Split payment check failed for TX ${tx.transactionId}: ${error.message}`);
    return [];
  }
}

/**
 * Detect payments to vendors with no purchase order history in the
 * preceding 12 months.
 *
 * Validates: Requirements 6.1
 */
export async function detectNoPOVendor(
  tenantId: string,
  tx: CanonicalTransaction,
  config: FraudDetectionConfig
): Promise<FraudMatch[]> {
  const logger = cds.log('fraud-detection');

  // Must be a payment to a vendor
  if (!tx.vendorId || tx.documentType !== 'PAYMENT_DOCUMENT') {
    return [];
  }

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    const lookbackStart = new Date(tx.postingDate);
    lookbackStart.setMonth(lookbackStart.getMonth() - config.noPOLookbackMonths);

    // Check for purchase orders to this vendor in the lookback period
    const purchaseOrders = await SELECT.one.from(Transactions).where({
      tenantId,
      vendorId: tx.vendorId,
      documentType: 'PURCHASE_ORDER',
      postingDate: { '>=': lookbackStart.toISOString().split('T')[0] },
    });

    // If PO exists, this is not a no-PO vendor pattern
    if (purchaseOrders) {
      return [];
    }

    const financialExposure = Math.abs(tx.amount);
    const mlConfidence = calculatePatternConfidence('NO_PO_VENDOR', 1, financialExposure);
    const riskScore = calculateFraudRiskScore(mlConfidence, financialExposure, config);
    const isLowConfidence = mlConfidence < config.lowConfidenceThreshold;

    logger.info(
      `No-PO vendor detected for TX ${tx.transactionId}: ` +
      `vendor ${tx.vendorId} has no PO history in ${config.noPOLookbackMonths} months`
    );

    return [{
      patternType: 'NO_PO_VENDOR',
      confidence: mlConfidence,
      financialExposure,
      riskScore,
      description: `Payment to vendor ${tx.vendorId} with no purchase order history in the preceding ` +
        `${config.noPOLookbackMonths} months. Amount: ${tx.amount} ${tx.currency}.`,
      lowConfidence: isLowConfidence,
      relatedTransactionIds: [],
      riskIndicators: [
        {
          indicatorType: 'no_po_vendor',
          description: `Vendor ${tx.vendorId} has no PO in ${config.noPOLookbackMonths} months`,
          observedValue: 0,
          expectedRange: { min: 1, max: undefined as unknown },
          weight: 0.6,
        },
      ],
      affectedEntities: [
        { entityType: 'vendor', entityId: tx.vendorId! },
        { entityType: 'user', entityId: tx.userId, entityName: tx.userId },
      ],
    }];
  } catch (error: any) {
    logger.warn(`No-PO vendor check failed for TX ${tx.transactionId}: ${error.message}`);
    return [];
  }
}

// ============================================================================
// Risk Score Calculation
// ============================================================================

/**
 * Calculate fraud Risk_Score from ML confidence and financial exposure.
 * Score is on a scale of 0-100 where:
 * - ML confidence contributes 60% weight
 * - Financial exposure contributes 40% weight (normalized against critical threshold)
 *
 * Validates: Requirements 6.4
 *
 * @param mlConfidence - ML model confidence (0-100)
 * @param financialExposure - Financial exposure amount
 * @param config - Fraud detection configuration
 * @returns Risk score between 0-100
 */
export function calculateFraudRiskScore(
  mlConfidence: number,
  financialExposure: number,
  config: FraudDetectionConfig = DEFAULT_FRAUD_CONFIG
): number {
  const ML_WEIGHT = 0.6;
  const EXPOSURE_WEIGHT = 0.4;

  // Normalize confidence to 0-100 range
  const normalizedConfidence = Math.max(0, Math.min(100, mlConfidence));

  // Normalize financial exposure: 100 when at or above critical threshold
  // Linear scaling below the threshold
  const normalizedExposure = Math.min(
    100,
    (financialExposure / config.criticalExposureThreshold) * 100
  );

  // Weighted combination
  const rawScore = (normalizedConfidence * ML_WEIGHT) + (normalizedExposure * EXPOSURE_WEIGHT);

  // Clamp to [0, 100] integer range
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Calculate pattern-specific ML confidence based on evidence strength.
 * In production, this would be replaced by an actual ML model inference.
 * For now, uses heuristic-based confidence estimation.
 *
 * @param patternType - Type of fraud pattern
 * @param evidenceCount - Number of supporting evidence items
 * @param financialExposure - Financial amount involved
 * @returns Confidence score (0-100)
 */
export function calculatePatternConfidence(
  patternType: FraudPatternType,
  evidenceCount: number,
  financialExposure: number
): number {
  // Base confidence varies by pattern type severity
  const baseConfidence: Record<FraudPatternType, number> = {
    DUPLICATE_PAYMENT: 70,
    VENDOR_BANK_MANIPULATION: 80,
    ROUND_TRIPPING: 55,
    SPLIT_PAYMENT: 60,
    NO_PO_VENDOR: 40,
  };

  let confidence = baseConfidence[patternType];

  // Boost confidence with more evidence
  if (evidenceCount > 1) {
    confidence += Math.min(15, (evidenceCount - 1) * 5);
  }

  // Boost confidence for higher financial exposure (up to 10 points)
  if (financialExposure > 50000) {
    confidence += 10;
  } else if (financialExposure > 10000) {
    confidence += 5;
  }

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, confidence));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build fraud detection config from tenant thresholds.
 */
export function buildFraudConfig(thresholds: TenantThresholds): FraudDetectionConfig {
  return {
    duplicatePaymentWindowDays: 30,
    vendorBankChangeHours: thresholds.vendorBankChangeHours,
    roundTrippingWindowDays: 90,
    splitPaymentWindowDays: 5,
    noPOLookbackMonths: 12,
    approvalThreshold: thresholds.roundNumberThreshold, // Use round number threshold as approval threshold
    lowConfidenceThreshold: 50,
    criticalExposureThreshold: thresholds.roundNumberThreshold, // Default 10000
  };
}

/**
 * Check if a transaction is payment-related and worth checking for fraud.
 */
function isPaymentRelatedDocument(tx: CanonicalTransaction): boolean {
  const paymentTypes: string[] = [
    'PAYMENT_DOCUMENT',
    'JOURNAL_ENTRY',
    'VENDOR_MASTER_CHANGE',
  ];
  return paymentTypes.includes(tx.documentType);
}
