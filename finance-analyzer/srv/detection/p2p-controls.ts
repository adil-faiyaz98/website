import cds = require('@sap/cds');
import { CanonicalTransaction, RiskEvent, RiskIndicator, AffectedEntity, TenantThresholds } from '../types';
import { DetectionMethod, RiskCategory } from '../types/enums';

// ============================================================================
// Interfaces
// ============================================================================

/** P2P lifecycle steps in sequential order */
export type P2PStep =
  | 'REQUISITION'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'INVOICE_RECEIPT'
  | 'PAYMENT';

/** Type of P2P control violation detected */
export type P2PViolationType =
  | 'SEGREGATION_VIOLATION'
  | 'THREE_WAY_MATCH_FAILURE'
  | 'RETROACTIVE_PO'
  | 'GRIR_CLEARING_AGING'
  | 'SUSPICIOUS_VENDOR_INVOICE'
  | 'VENDOR_PAYMENT_COLLUSION';

/** A detected P2P control violation */
export interface P2PViolation {
  /** Type of violation */
  violationType: P2PViolationType;
  /** Calculated risk score (0-100) */
  riskScore: number;
  /** Human-readable description */
  description: string;
  /** Financial exposure amount */
  financialExposure: number;
  /** Related transaction IDs in the P2P chain */
  relatedTransactionIds: string[];
  /** Risk indicators contributing to the detection */
  riskIndicators: RiskIndicator[];
  /** Affected entities */
  affectedEntities: AffectedEntity[];
  /** Detection method used */
  detectionMethod: DetectionMethod;
}

/** Three-way match comparison result */
export interface ThreeWayMatchResult {
  /** Whether the match is within tolerance */
  withinTolerance: boolean;
  /** PO amount */
  poAmount: number;
  /** GR amount */
  grAmount: number;
  /** Invoice amount */
  invoiceAmount: number;
  /** Maximum variance percentage between the three */
  maxVariance: number;
  /** Tolerance threshold used */
  tolerance: number;
  /** Specific failure reason if not within tolerance */
  failureReason?: string;
}

/** GR/IR clearing item that has aged beyond threshold */
export interface GRIRAgingItem {
  /** Document number of the uncleared item */
  documentNumber: string;
  /** Vendor associated with the item */
  vendorId: string;
  /** Amount outstanding */
  amount: number;
  /** Date the item was posted */
  postingDate: Date;
  /** Number of days since posting */
  agingDays: number;
}

/** P2P control effectiveness score */
export interface P2PControlEffectivenessScore {
  /** Tenant ID */
  tenantId: string;
  /** Overall control effectiveness percentage (0-100) */
  overallScore: number;
  /** Total transactions analyzed in the period */
  totalTransactions: number;
  /** Number of compliant transactions */
  compliantTransactions: number;
  /** Number of violations detected */
  violationCount: number;
  /** Breakdown by violation type */
  breakdownByType: Record<P2PViolationType, number>;
  /** Period start date */
  periodStart: Date;
  /** Period end date */
  periodEnd: Date;
}

// ============================================================================
// Constants
// ============================================================================

/** P2P lifecycle steps in sequential order for segregation checks */
const P2P_LIFECYCLE_STEPS: P2PStep[] = [
  'REQUISITION',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'INVOICE_RECEIPT',
  'PAYMENT',
];

/** Document type to P2P step mapping */
const DOCUMENT_TYPE_TO_P2P_STEP: Record<string, P2PStep> = {
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  GOODS_RECEIPT: 'GOODS_RECEIPT',
  INVOICE_RECEIPT: 'INVOICE_RECEIPT',
  PAYMENT_DOCUMENT: 'PAYMENT',
};

/** Conflicting P2P step pairs that violate segregation of duties */
const CONFLICTING_STEP_PAIRS: [P2PStep, P2PStep][] = [
  ['REQUISITION', 'PURCHASE_ORDER'],
  ['REQUISITION', 'GOODS_RECEIPT'],
  ['REQUISITION', 'INVOICE_RECEIPT'],
  ['REQUISITION', 'PAYMENT'],
  ['PURCHASE_ORDER', 'GOODS_RECEIPT'],
  ['PURCHASE_ORDER', 'INVOICE_RECEIPT'],
  ['PURCHASE_ORDER', 'PAYMENT'],
  ['GOODS_RECEIPT', 'INVOICE_RECEIPT'],
  ['GOODS_RECEIPT', 'PAYMENT'],
  ['INVOICE_RECEIPT', 'PAYMENT'],
];

/** Default collusion window in days */
const DEFAULT_COLLUSION_WINDOW_DAYS = 180;

/** Default first-time vendor payment threshold */
const DEFAULT_FIRST_TIME_VENDOR_THRESHOLD = 25000;

/** Default days for first-time vendor payment check */
const DEFAULT_FIRST_TIME_VENDOR_DAYS = 30;

/** Percentage below approval threshold to flag */
const APPROVAL_THRESHOLD_PROXIMITY_PERCENT = 0.05;

// ============================================================================
// P2P Controls Module
// ============================================================================

/**
 * Analyze a transaction for P2P control violations.
 * This is the main entry point called by the Detection Engine.
 *
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 21.7
 *
 * @param tenantId - Tenant identifier
 * @param tx - Canonical transaction to analyze
 * @param thresholds - Tenant-specific thresholds
 * @returns Array of P2P violations detected
 */
export async function analyzeP2PControls(
  tenantId: string,
  tx: CanonicalTransaction,
  thresholds: TenantThresholds
): Promise<P2PViolation[]> {
  const logger = cds.log('p2p-controls');
  logger.info(`Analyzing P2P controls for TX ${tx.transactionId}, tenant ${tenantId}`);

  const p2pStep = DOCUMENT_TYPE_TO_P2P_STEP[tx.documentType];

  // Only analyze P2P-relevant document types
  if (!p2pStep) {
    return [];
  }

  const violations: P2PViolation[] = [];

  // Run applicable checks in parallel based on document type
  const checks: Promise<P2PViolation | null>[] = [];

  // Segregation check applies to all P2P steps
  checks.push(checkSegregationViolation(tenantId, tx, p2pStep));

  // Three-way match applies to invoice receipts
  if (p2pStep === 'INVOICE_RECEIPT') {
    checks.push(checkThreeWayMatch(tenantId, tx, thresholds));
  }

  // Retroactive PO check applies to purchase orders
  if (p2pStep === 'PURCHASE_ORDER') {
    checks.push(checkRetroactivePO(tenantId, tx));
  }

  // Vendor-payment collusion check applies to payments and invoices
  if (p2pStep === 'PAYMENT' || p2pStep === 'INVOICE_RECEIPT') {
    checks.push(checkVendorPaymentCollusion(tenantId, tx));
  }

  // Suspicious vendor-invoice patterns apply to invoice receipts
  if (p2pStep === 'INVOICE_RECEIPT') {
    checks.push(checkSuspiciousVendorInvoicePatterns(tenantId, tx, thresholds));
  }

  const results = await Promise.all(checks);

  for (const result of results) {
    if (result) {
      violations.push(result);
    }
  }

  logger.info(`P2P analysis for TX ${tx.transactionId}: ${violations.length} violations found`);
  return violations;
}

/**
 * Monitor GR/IR clearing aging across all open items for a tenant.
 * This is called on a scheduled basis (not per-transaction).
 *
 * Validates: Requirements 21.4
 *
 * @param tenantId - Tenant identifier
 * @param thresholds - Tenant-specific thresholds
 * @returns Array of violations for aged GR/IR items
 */
export async function monitorGRIRClearingAging(
  tenantId: string,
  thresholds: TenantThresholds
): Promise<P2PViolation[]> {
  const logger = cds.log('p2p-controls');
  logger.info(`Monitoring GR/IR clearing aging for tenant ${tenantId}`);

  const clearingDays = thresholds.grirClearingDays;
  const violations: P2PViolation[] = [];

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - clearingDays);

    // Find goods receipts without matching invoice receipts
    const unclearedGR = await SELECT.from(Transactions).where({
      tenantId,
      documentType: 'GOODS_RECEIPT',
      postingDate: { '<=': cutoffDate.toISOString().split('T')[0] },
    });

    for (const gr of unclearedGR) {
      // Check if a matching invoice receipt exists for this vendor/PO reference
      const matchingInvoice = await SELECT.one.from(Transactions).where({
        tenantId,
        documentType: 'INVOICE_RECEIPT',
        vendorId: gr.vendorId,
        businessObjectRef: gr.businessObjectRef,
      });

      if (!matchingInvoice) {
        const agingDays = Math.floor(
          (Date.now() - new Date(gr.postingDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        violations.push({
          violationType: 'GRIR_CLEARING_AGING',
          riskScore: calculateGRIRAgingRiskScore(agingDays, clearingDays),
          description: `GR/IR item ${gr.documentNumber} uncleared for ${agingDays} days (threshold: ${clearingDays} days). Vendor: ${gr.vendorId}`,
          financialExposure: Number(gr.amount) || 0,
          relatedTransactionIds: [gr.ID],
          riskIndicators: [
            {
              indicatorType: 'grir_aging',
              description: `Goods receipt uncleared for ${agingDays} days, exceeding ${clearingDays}-day threshold`,
              observedValue: agingDays,
              expectedRange: { min: 0, max: clearingDays },
              weight: 0.8,
            },
          ],
          affectedEntities: [
            { entityType: 'vendor', entityId: gr.vendorId || 'unknown', entityName: `Vendor ${gr.vendorId}` },
            { entityType: 'document', entityId: gr.documentNumber, entityName: `GR ${gr.documentNumber}` },
          ],
          detectionMethod: 'THRESHOLD_BREACH',
        });
      }
    }

    logger.info(`GR/IR aging check for tenant ${tenantId}: ${violations.length} aged items found`);
    return violations;
  } catch (error: any) {
    logger.error(`GR/IR aging check failed for tenant ${tenantId}: ${error.message}`);
    return [];
  }
}

/**
 * Calculate P2P control effectiveness score for a tenant over a period.
 *
 * Validates: Requirements 21.8
 *
 * @param tenantId - Tenant identifier
 * @param periodStart - Start of the evaluation period
 * @param periodEnd - End of the evaluation period
 * @returns P2P control effectiveness score
 */
export async function calculateP2PControlEffectiveness(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<P2PControlEffectivenessScore> {
  const logger = cds.log('p2p-controls');
  logger.info(`Calculating P2P effectiveness for tenant ${tenantId}`);

  try {
    const db = await cds.connect.to('db');
    const { Transactions, Alerts } = db.entities('finsecure.ai');

    // Count total P2P transactions in the period
    const p2pDocTypes = ['PURCHASE_ORDER', 'GOODS_RECEIPT', 'INVOICE_RECEIPT', 'PAYMENT_DOCUMENT'];

    const totalTxResult = await SELECT.from(Transactions).where({
      tenantId,
      documentType: { in: p2pDocTypes },
      postingDate: {
        '>=': periodStart.toISOString().split('T')[0],
        '<=': periodEnd.toISOString().split('T')[0],
      },
    });

    const totalTransactions = totalTxResult.length;

    // Count P2P-related alerts (violations) in the period
    const p2pAlerts = await SELECT.from(Alerts).where({
      tenantId,
      riskCategory: 'P2P_CONTROL_GAP',
      createdAt: {
        '>=': periodStart.toISOString(),
        '<=': periodEnd.toISOString(),
      },
    });

    const violationCount = p2pAlerts.length;
    const compliantTransactions = Math.max(0, totalTransactions - violationCount);

    // Calculate overall score
    const overallScore = totalTransactions > 0
      ? Math.round((compliantTransactions / totalTransactions) * 100)
      : 100;

    // Build breakdown by type from alert metadata
    const breakdownByType: Record<P2PViolationType, number> = {
      SEGREGATION_VIOLATION: 0,
      THREE_WAY_MATCH_FAILURE: 0,
      RETROACTIVE_PO: 0,
      GRIR_CLEARING_AGING: 0,
      SUSPICIOUS_VENDOR_INVOICE: 0,
      VENDOR_PAYMENT_COLLUSION: 0,
    };

    for (const alert of p2pAlerts) {
      const indicators = typeof alert.riskIndicators === 'string'
        ? JSON.parse(alert.riskIndicators)
        : alert.riskIndicators;

      if (Array.isArray(indicators)) {
        for (const indicator of indicators) {
          const type = indicator.indicatorType as P2PViolationType;
          if (type && type in breakdownByType) {
            breakdownByType[type]++;
            break;
          }
        }
      }
    }

    const result: P2PControlEffectivenessScore = {
      tenantId,
      overallScore,
      totalTransactions,
      compliantTransactions,
      violationCount,
      breakdownByType,
      periodStart,
      periodEnd,
    };

    logger.info(
      `P2P effectiveness for tenant ${tenantId}: ${overallScore}% ` +
      `(${compliantTransactions}/${totalTransactions} compliant, ${violationCount} violations)`
    );

    return result;
  } catch (error: any) {
    logger.error(`P2P effectiveness calculation failed for tenant ${tenantId}: ${error.message}`);
    return {
      tenantId,
      overallScore: 0,
      totalTransactions: 0,
      compliantTransactions: 0,
      violationCount: 0,
      breakdownByType: {
        SEGREGATION_VIOLATION: 0,
        THREE_WAY_MATCH_FAILURE: 0,
        RETROACTIVE_PO: 0,
        GRIR_CLEARING_AGING: 0,
        SUSPICIOUS_VENDOR_INVOICE: 0,
        VENDOR_PAYMENT_COLLUSION: 0,
      },
      periodStart,
      periodEnd,
    };
  }
}

/**
 * Convert P2P violations to risk events for the Detection Engine.
 *
 * @param tenantId - Tenant identifier
 * @param tx - Triggering transaction
 * @param violations - Detected P2P violations
 * @returns Array of risk events
 */
export function convertToRiskEvents(
  tenantId: string,
  tx: CanonicalTransaction,
  violations: P2PViolation[]
): RiskEvent[] {
  return violations.map((violation) => ({
    riskEventId: `p2p-${tx.transactionId}-${violation.violationType}-${Date.now()}`,
    tenantId,
    transactionId: tx.transactionId,
    riskCategory: 'P2P_CONTROL_GAP' as RiskCategory,
    riskScore: violation.riskScore,
    confidence: 90, // Rule-based detection has high confidence
    detectionMethod: violation.detectionMethod,
    riskIndicators: violation.riskIndicators,
    affectedEntities: violation.affectedEntities,
    financialExposure: violation.financialExposure,
    detectedAt: new Date(),
  }));
}

// ============================================================================
// Internal Detection Functions
// ============================================================================

/**
 * Check P2P segregation violation: detect when the same user performs
 * conflicting roles across the P2P lifecycle for the same transaction chain.
 *
 * Validates: Requirements 21.1
 */
async function checkSegregationViolation(
  tenantId: string,
  tx: CanonicalTransaction,
  currentStep: P2PStep
): Promise<P2PViolation | null> {
  const logger = cds.log('p2p-controls');

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    // Find related transactions in the same P2P chain using businessObjectRef
    if (!tx.businessObjectRef) {
      return null;
    }

    const relatedTx = await SELECT.from(Transactions).where({
      tenantId,
      businessObjectRef: tx.businessObjectRef,
      ID: { '!=': tx.transactionId },
    });

    // Check if same user performed conflicting steps
    for (const related of relatedTx) {
      if (related.userId !== tx.userId) {
        continue;
      }

      const relatedStep = DOCUMENT_TYPE_TO_P2P_STEP[related.documentType];
      if (!relatedStep) {
        continue;
      }

      // Check if the two steps are a conflicting pair
      const isConflict = CONFLICTING_STEP_PAIRS.some(
        ([step1, step2]) =>
          (step1 === currentStep && step2 === relatedStep) ||
          (step1 === relatedStep && step2 === currentStep)
      );

      if (isConflict) {
        return {
          violationType: 'SEGREGATION_VIOLATION',
          riskScore: 85,
          description:
            `User ${tx.userId} performed conflicting P2P roles: ` +
            `${currentStep} (${tx.documentNumber}) and ${relatedStep} (${related.documentNumber}) ` +
            `for the same transaction chain (${tx.businessObjectRef})`,
          financialExposure: Math.abs(Number(tx.amount) || 0),
          relatedTransactionIds: [tx.transactionId, related.ID],
          riskIndicators: [
            {
              indicatorType: 'SEGREGATION_VIOLATION',
              description: `Same user performed ${currentStep} and ${relatedStep} in P2P lifecycle`,
              observedValue: tx.userId,
              expectedRange: { min: 'different_user', max: 'different_user' },
              weight: 0.9,
            },
          ],
          affectedEntities: [
            { entityType: 'user', entityId: tx.userId, entityName: `User ${tx.userId}` },
            { entityType: 'document', entityId: tx.documentNumber, entityName: `Doc ${tx.documentNumber}` },
            { entityType: 'document', entityId: related.documentNumber, entityName: `Doc ${related.documentNumber}` },
          ],
          detectionMethod: 'RULE_BASED',
        };
      }
    }

    return null;
  } catch (error: any) {
    logger.error(`Segregation check failed for TX ${tx.transactionId}: ${error.message}`);
    return null;
  }
}

/**
 * Validate three-way match: compare PO amount, GR amount, and invoice amount.
 * Flag when difference exceeds configurable tolerance (default 2%).
 *
 * Validates: Requirements 21.2
 */
async function checkThreeWayMatch(
  tenantId: string,
  tx: CanonicalTransaction,
  thresholds: TenantThresholds
): Promise<P2PViolation | null> {
  const logger = cds.log('p2p-controls');

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    if (!tx.businessObjectRef) {
      return null;
    }

    const tolerance = thresholds.threeWayMatchTolerance;

    // Find the related PO and GR for this invoice
    const relatedPO = await SELECT.one.from(Transactions).where({
      tenantId,
      businessObjectRef: tx.businessObjectRef,
      documentType: 'PURCHASE_ORDER',
    });

    const relatedGR = await SELECT.one.from(Transactions).where({
      tenantId,
      businessObjectRef: tx.businessObjectRef,
      documentType: 'GOODS_RECEIPT',
    });

    // Need both PO and GR for three-way match
    if (!relatedPO || !relatedGR) {
      return null;
    }

    const poAmount = Math.abs(Number(relatedPO.amount));
    const grAmount = Math.abs(Number(relatedGR.amount));
    const invoiceAmount = Math.abs(Number(tx.amount));

    // Calculate variances between all pairs
    const matchResult = performThreeWayMatch(poAmount, grAmount, invoiceAmount, tolerance);

    if (!matchResult.withinTolerance) {
      return {
        violationType: 'THREE_WAY_MATCH_FAILURE',
        riskScore: 75,
        description:
          `Three-way match failure for invoice ${tx.documentNumber}: ` +
          `PO=${poAmount}, GR=${grAmount}, Invoice=${invoiceAmount}. ` +
          `Variance ${(matchResult.maxVariance * 100).toFixed(2)}% exceeds ${(tolerance * 100).toFixed(2)}% tolerance. ` +
          `Reason: ${matchResult.failureReason}. Vendor: ${tx.vendorId}`,
        financialExposure: invoiceAmount,
        relatedTransactionIds: [tx.transactionId, relatedPO.ID, relatedGR.ID],
        riskIndicators: [
          {
            indicatorType: 'THREE_WAY_MATCH_FAILURE',
            description: matchResult.failureReason || 'Three-way match variance exceeds tolerance',
            observedValue: matchResult.maxVariance,
            expectedRange: { min: 0, max: tolerance },
            weight: 0.85,
          },
        ],
        affectedEntities: [
          { entityType: 'vendor', entityId: tx.vendorId || 'unknown', entityName: `Vendor ${tx.vendorId}` },
          { entityType: 'document', entityId: tx.documentNumber, entityName: `Invoice ${tx.documentNumber}` },
          { entityType: 'document', entityId: relatedPO.documentNumber, entityName: `PO ${relatedPO.documentNumber}` },
          { entityType: 'document', entityId: relatedGR.documentNumber, entityName: `GR ${relatedGR.documentNumber}` },
        ],
        detectionMethod: 'THRESHOLD_BREACH',
      };
    }

    return null;
  } catch (error: any) {
    logger.error(`Three-way match check failed for TX ${tx.transactionId}: ${error.message}`);
    return null;
  }
}

/**
 * Detect retroactive PO creation: a PO created AFTER the goods receipt
 * or invoice has already been posted.
 *
 * Validates: Requirements 21.3
 */
async function checkRetroactivePO(
  tenantId: string,
  tx: CanonicalTransaction
): Promise<P2PViolation | null> {
  const logger = cds.log('p2p-controls');

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    if (!tx.businessObjectRef) {
      return null;
    }

    // Find related invoice or GR posted BEFORE this PO
    const earlierDocuments = await SELECT.from(Transactions).where({
      tenantId,
      businessObjectRef: tx.businessObjectRef,
      documentType: { in: ['INVOICE_RECEIPT', 'GOODS_RECEIPT'] },
      postingDate: { '<': tx.postingDate instanceof Date ? tx.postingDate.toISOString().split('T')[0] : tx.postingDate },
    });

    if (earlierDocuments.length > 0) {
      const earliestDoc = earlierDocuments[0];
      return {
        violationType: 'RETROACTIVE_PO',
        riskScore: 90,
        description:
          `Retroactive PO creation detected: PO ${tx.documentNumber} ` +
          `(posted ${formatDate(tx.postingDate)}) created AFTER ` +
          `${earliestDoc.documentType} ${earliestDoc.documentNumber} ` +
          `(posted ${earliestDoc.postingDate}). Potential compliance bypass.`,
        financialExposure: Math.abs(Number(tx.amount) || 0),
        relatedTransactionIds: [tx.transactionId, ...earlierDocuments.map((d: any) => d.ID)],
        riskIndicators: [
          {
            indicatorType: 'RETROACTIVE_PO',
            description: `Purchase order created after ${earliestDoc.documentType} was posted`,
            observedValue: formatDate(tx.postingDate),
            expectedRange: { min: 'before_gr_ir', max: formatDate(new Date(earliestDoc.postingDate)) },
            weight: 0.95,
          },
        ],
        affectedEntities: [
          { entityType: 'user', entityId: tx.userId, entityName: `User ${tx.userId}` },
          { entityType: 'document', entityId: tx.documentNumber, entityName: `PO ${tx.documentNumber}` },
          { entityType: 'document', entityId: earliestDoc.documentNumber, entityName: `${earliestDoc.documentType} ${earliestDoc.documentNumber}` },
        ],
        detectionMethod: 'RULE_BASED',
      };
    }

    return null;
  } catch (error: any) {
    logger.error(`Retroactive PO check failed for TX ${tx.transactionId}: ${error.message}`);
    return null;
  }
}

/**
 * Detect vendor-payment collusion: when the same user creates a vendor
 * master record AND processes a payment to that vendor within a configurable
 * window (default 180 days).
 *
 * Validates: Requirements 21.7
 */
async function checkVendorPaymentCollusion(
  tenantId: string,
  tx: CanonicalTransaction
): Promise<P2PViolation | null> {
  const logger = cds.log('p2p-controls');

  try {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    if (!tx.vendorId) {
      return null;
    }

    const collusionWindowDays = DEFAULT_COLLUSION_WINDOW_DAYS;
    const windowStart = new Date(tx.postingDate instanceof Date ? tx.postingDate : new Date(tx.postingDate));
    windowStart.setDate(windowStart.getDate() - collusionWindowDays);

    // Check if the same user created the vendor master record within the window
    const vendorCreation = await SELECT.one.from(Transactions).where({
      tenantId,
      documentType: 'VENDOR_MASTER_CHANGE',
      vendorId: tx.vendorId,
      userId: tx.userId,
      postingDate: { '>=': windowStart.toISOString().split('T')[0] },
    });

    if (vendorCreation) {
      const creationDate = new Date(vendorCreation.postingDate);
      const txDate = tx.postingDate instanceof Date ? tx.postingDate : new Date(tx.postingDate);
      const daysBetween = Math.floor(
        (txDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        violationType: 'VENDOR_PAYMENT_COLLUSION',
        riskScore: 95,
        description:
          `Vendor-payment collusion risk: User ${tx.userId} created vendor ${tx.vendorId} ` +
          `(${vendorCreation.documentNumber}, ${formatDate(creationDate)}) and processed ` +
          `${tx.documentType === 'PAYMENT_DOCUMENT' ? 'payment' : 'invoice'} ${tx.documentNumber} ` +
          `to the same vendor within ${daysBetween} days (window: ${collusionWindowDays} days)`,
        financialExposure: Math.abs(Number(tx.amount) || 0),
        relatedTransactionIds: [tx.transactionId, vendorCreation.ID],
        riskIndicators: [
          {
            indicatorType: 'VENDOR_PAYMENT_COLLUSION',
            description:
              `Same user created vendor and processed payment/invoice within ${collusionWindowDays}-day window`,
            observedValue: daysBetween,
            expectedRange: { min: collusionWindowDays, max: Infinity },
            weight: 0.95,
          },
        ],
        affectedEntities: [
          { entityType: 'user', entityId: tx.userId, entityName: `User ${tx.userId}` },
          { entityType: 'vendor', entityId: tx.vendorId, entityName: `Vendor ${tx.vendorId}` },
          { entityType: 'document', entityId: tx.documentNumber, entityName: `${tx.documentType} ${tx.documentNumber}` },
        ],
        detectionMethod: 'CORRELATION',
      };
    }

    return null;
  } catch (error: any) {
    logger.error(`Vendor-payment collusion check failed for TX ${tx.transactionId}: ${error.message}`);
    return null;
  }
}

/**
 * Detect suspicious vendor-invoice patterns:
 * - First-time vendors receiving payments exceeding threshold within 30 days of creation
 * - Invoices posted at amounts within 5% below approval thresholds
 * - Multiple invoices from same vendor on same day with sequential reference numbers
 *
 * Validates: Requirements 21.5
 */
async function checkSuspiciousVendorInvoicePatterns(
  tenantId: string,
  tx: CanonicalTransaction,
  thresholds: TenantThresholds
): Promise<P2PViolation | null> {
  const logger = cds.log('p2p-controls');

  try {
    const db = await cds.connect.to('db');

    if (!tx.vendorId) {
      return null;
    }

    const invoiceAmount = Math.abs(Number(tx.amount));

    // Pattern 1: First-time vendor with high-value payment within 30 days
    const firstTimeVendorViolation = await checkFirstTimeVendorPattern(
      db, tenantId, tx, invoiceAmount
    );
    if (firstTimeVendorViolation) {
      return firstTimeVendorViolation;
    }

    // Pattern 2: Invoice amount within 5% below approval threshold
    const approvalThreshold = thresholds.roundNumberThreshold; // Use round number threshold as proxy for approval threshold
    const lowerBound = approvalThreshold * (1 - APPROVAL_THRESHOLD_PROXIMITY_PERCENT);
    if (invoiceAmount >= lowerBound && invoiceAmount < approvalThreshold) {
      return {
        violationType: 'SUSPICIOUS_VENDOR_INVOICE',
        riskScore: 70,
        description:
          `Invoice ${tx.documentNumber} amount ${invoiceAmount} is within 5% below ` +
          `approval threshold ${approvalThreshold} (vendor: ${tx.vendorId}). ` +
          `Possible threshold manipulation.`,
        financialExposure: invoiceAmount,
        relatedTransactionIds: [tx.transactionId],
        riskIndicators: [
          {
            indicatorType: 'SUSPICIOUS_VENDOR_INVOICE',
            description: `Invoice amount ${invoiceAmount} within 5% below approval threshold ${approvalThreshold}`,
            observedValue: invoiceAmount,
            expectedRange: { min: 0, max: lowerBound },
            weight: 0.7,
          },
        ],
        affectedEntities: [
          { entityType: 'vendor', entityId: tx.vendorId, entityName: `Vendor ${tx.vendorId}` },
          { entityType: 'document', entityId: tx.documentNumber, entityName: `Invoice ${tx.documentNumber}` },
        ],
        detectionMethod: 'PATTERN_MATCHING',
      };
    }

    // Pattern 3: Multiple invoices from same vendor on same day with sequential references
    const sequentialViolation = await checkSequentialInvoicePattern(db, tenantId, tx);
    if (sequentialViolation) {
      return sequentialViolation;
    }

    return null;
  } catch (error: any) {
    logger.error(`Suspicious vendor-invoice check failed for TX ${tx.transactionId}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Perform three-way match calculation between PO, GR, and Invoice amounts.
 */
export function performThreeWayMatch(
  poAmount: number,
  grAmount: number,
  invoiceAmount: number,
  tolerance: number
): ThreeWayMatchResult {
  // Calculate pairwise variances
  const poGrVariance = poAmount > 0 ? Math.abs(poAmount - grAmount) / poAmount : 0;
  const poInvVariance = poAmount > 0 ? Math.abs(poAmount - invoiceAmount) / poAmount : 0;
  const grInvVariance = grAmount > 0 ? Math.abs(grAmount - invoiceAmount) / grAmount : 0;

  const maxVariance = Math.max(poGrVariance, poInvVariance, grInvVariance);
  const withinTolerance = maxVariance <= tolerance;

  let failureReason: string | undefined;
  if (!withinTolerance) {
    if (poInvVariance > tolerance && grInvVariance > tolerance) {
      failureReason = `Invoice amount (${invoiceAmount}) exceeds both PO (${poAmount}) and GR (${grAmount}) tolerance`;
    } else if (poInvVariance > tolerance) {
      failureReason = `Invoice amount (${invoiceAmount}) deviates from PO amount (${poAmount}) by ${(poInvVariance * 100).toFixed(2)}%`;
    } else if (grInvVariance > tolerance) {
      failureReason = `Invoice amount (${invoiceAmount}) deviates from GR amount (${grAmount}) by ${(grInvVariance * 100).toFixed(2)}%`;
    } else {
      failureReason = `PO amount (${poAmount}) deviates from GR amount (${grAmount}) by ${(poGrVariance * 100).toFixed(2)}%`;
    }
  }

  return {
    withinTolerance,
    poAmount,
    grAmount,
    invoiceAmount,
    maxVariance,
    tolerance,
    failureReason,
  };
}

/**
 * Check if vendor is first-time and received high-value payment quickly.
 */
async function checkFirstTimeVendorPattern(
  db: any,
  tenantId: string,
  tx: CanonicalTransaction,
  invoiceAmount: number
): Promise<P2PViolation | null> {
  const { Transactions } = db.entities('finsecure.ai');

  if (invoiceAmount < DEFAULT_FIRST_TIME_VENDOR_THRESHOLD) {
    return null;
  }

  // Find vendor creation date
  const vendorCreation = await SELECT.one.from(Transactions)
    .where({
      tenantId,
      documentType: 'VENDOR_MASTER_CHANGE',
      vendorId: tx.vendorId,
    })
    .orderBy('postingDate asc');

  if (!vendorCreation) {
    return null;
  }

  const creationDate = new Date(vendorCreation.postingDate);
  const txDate = tx.postingDate instanceof Date ? tx.postingDate : new Date(tx.postingDate);
  const daysSinceCreation = Math.floor(
    (txDate.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceCreation <= DEFAULT_FIRST_TIME_VENDOR_DAYS) {
    return {
      violationType: 'SUSPICIOUS_VENDOR_INVOICE',
      riskScore: 80,
      description:
        `First-time vendor ${tx.vendorId} received invoice ${tx.documentNumber} ` +
        `for ${invoiceAmount} within ${daysSinceCreation} days of creation ` +
        `(threshold: ${DEFAULT_FIRST_TIME_VENDOR_THRESHOLD} within ${DEFAULT_FIRST_TIME_VENDOR_DAYS} days)`,
      financialExposure: invoiceAmount,
      relatedTransactionIds: [tx.transactionId, vendorCreation.ID],
      riskIndicators: [
        {
          indicatorType: 'SUSPICIOUS_VENDOR_INVOICE',
          description:
            `First-time vendor received ${invoiceAmount} within ${daysSinceCreation} days of creation`,
          observedValue: daysSinceCreation,
          expectedRange: { min: DEFAULT_FIRST_TIME_VENDOR_DAYS, max: Infinity },
          weight: 0.8,
        },
      ],
      affectedEntities: [
        { entityType: 'vendor', entityId: tx.vendorId!, entityName: `Vendor ${tx.vendorId}` },
        { entityType: 'document', entityId: tx.documentNumber, entityName: `Invoice ${tx.documentNumber}` },
      ],
      detectionMethod: 'PATTERN_MATCHING',
    };
  }

  return null;
}

/**
 * Check for multiple invoices from same vendor on same day with sequential references.
 */
async function checkSequentialInvoicePattern(
  db: any,
  tenantId: string,
  tx: CanonicalTransaction
): Promise<P2PViolation | null> {
  const { Transactions } = db.entities('finsecure.ai');

  const txDate = tx.postingDate instanceof Date
    ? tx.postingDate.toISOString().split('T')[0]
    : tx.postingDate;

  // Find other invoices from the same vendor on the same day
  const sameDayInvoices = await SELECT.from(Transactions).where({
    tenantId,
    documentType: 'INVOICE_RECEIPT',
    vendorId: tx.vendorId,
    postingDate: txDate,
    ID: { '!=': tx.transactionId },
  });

  if (sameDayInvoices.length < 2) {
    return null;
  }

  // Check for sequential document numbers
  const allDocNumbers = [tx.documentNumber, ...sameDayInvoices.map((inv: any) => inv.documentNumber)]
    .sort((a: string, b: string) => a.localeCompare(b));
  const hasSequential = detectSequentialNumbers(allDocNumbers);

  if (hasSequential) {
    return {
      violationType: 'SUSPICIOUS_VENDOR_INVOICE',
      riskScore: 75,
      description:
        `Multiple invoices from vendor ${tx.vendorId} on ${txDate} ` +
        `with sequential reference numbers: ${allDocNumbers.join(', ')}`,
      financialExposure: Math.abs(Number(tx.amount)) +
        sameDayInvoices.reduce((sum: number, inv: any) => sum + Math.abs(Number(inv.amount) || 0), 0),
      relatedTransactionIds: [tx.transactionId, ...sameDayInvoices.map((inv: any) => inv.ID)],
      riskIndicators: [
        {
          indicatorType: 'SUSPICIOUS_VENDOR_INVOICE',
          description: `${allDocNumbers.length} invoices from same vendor on same day with sequential references`,
          observedValue: allDocNumbers.length,
          expectedRange: { min: 0, max: 1 },
          weight: 0.75,
        },
      ],
      affectedEntities: [
        { entityType: 'vendor', entityId: tx.vendorId!, entityName: `Vendor ${tx.vendorId}` },
        ...allDocNumbers.map((dn) => ({
          entityType: 'document' as const,
          entityId: dn,
          entityName: `Invoice ${dn}`,
        })),
      ],
      detectionMethod: 'PATTERN_MATCHING',
    };
  }

  return null;
}

/**
 * Detect if an array of sorted document numbers contains sequential entries.
 * Sequential means consecutive numeric portions differ by 1.
 */
function detectSequentialNumbers(sortedDocNumbers: string[]): boolean {
  if (sortedDocNumbers.length < 2) {
    return false;
  }

  for (let i = 0; i < sortedDocNumbers.length - 1; i++) {
    const current = extractNumericSuffix(sortedDocNumbers[i]);
    const next = extractNumericSuffix(sortedDocNumbers[i + 1]);

    if (current !== null && next !== null && next - current === 1) {
      return true;
    }
  }

  return false;
}

/**
 * Extract the numeric suffix from a document number.
 * E.g., "INV-001234" → 1234, "5100000123" → 5100000123
 */
function extractNumericSuffix(docNumber: string): number | null {
  // Find trailing digits
  let i = docNumber.length - 1;
  while (i >= 0 && docNumber[i] >= '0' && docNumber[i] <= '9') {
    i--;
  }
  const numericPart = docNumber.slice(i + 1);
  return numericPart.length > 0 ? Number.parseInt(numericPart, 10) : null;
}

/**
 * Calculate risk score for GR/IR aging based on how far it exceeds the threshold.
 */
function calculateGRIRAgingRiskScore(agingDays: number, thresholdDays: number): number {
  // Base score starts at 60 when at threshold, increases to max 90
  const excessRatio = agingDays / thresholdDays;
  const score = Math.min(90, Math.round(60 + (excessRatio - 1) * 20));
  return Math.max(60, score);
}

/**
 * Format a date for display in descriptions.
 */
function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date;
  }
  return date.toISOString().split('T')[0];
}
