import cds = require('@sap/cds');
import { CanonicalTransaction, TenantThresholds } from '../types';

// ============================================================================
// Interfaces
// ============================================================================

/** Represents a Segregation of Duties rule */
export interface SoDRule {
  ID: string;
  tenantId: string;
  ruleName: string;
  ruleType: 'PREDEFINED' | 'CUSTOM';
  activity1: string;
  activity2: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  isActive: boolean;
  lookbackDays: number;
}

/** Represents a detected SoD violation */
export interface SoDViolation {
  ID?: string;
  tenantId: string;
  rule_ID: string;
  userId: string;
  activity1Time: Date;
  activity2Time: Date;
  activity1Obj: string;
  activity2Obj: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'ACTIVE' | 'ACKNOWLEDGED';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  alertId?: string;
}

/** Result of custom rule validation */
export interface RuleValidationResult {
  valid: boolean;
  error?: string;
}

/** Result of SoD detection check */
export interface SoDCheckResult {
  violations: SoDViolation[];
  detectedAt: Date;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum custom rules per tenant */
export const MAX_CUSTOM_RULES_PER_TENANT = 50;

/** Detection must complete within 30 seconds */
const DETECTION_TIMEOUT_MS = 30000;

/** Activities classified as payment/bank operations (for severity CRITICAL) */
export const PAYMENT_BANK_ACTIVITIES: ReadonlySet<string> = new Set([
  'approve_payment',
  'execute_payment_run',
  'maintain_bank_details',
]);

/** Activities classified as financial approval operations (for severity HIGH) */
export const FINANCIAL_APPROVAL_ACTIVITIES: ReadonlySet<string> = new Set([
  'approve_journal_entry',
  'approve_payment',
  'approve_goods_receipt',
]);

/**
 * Predefined SoD rules covering minimum 4 financial process conflicts.
 * Validates: Requirements 5.1
 */
export const PREDEFINED_SOD_RULES: ReadonlyArray<Omit<SoDRule, 'ID' | 'tenantId' | 'isActive' | 'lookbackDays'>> = [
  {
    ruleName: 'Create Vendor / Approve Payment',
    ruleType: 'PREDEFINED',
    activity1: 'create_vendor',
    activity2: 'approve_payment',
    severity: 'CRITICAL',
  },
  {
    ruleName: 'Post Journal Entry / Approve Journal Entry',
    ruleType: 'PREDEFINED',
    activity1: 'post_journal_entry',
    activity2: 'approve_journal_entry',
    severity: 'HIGH',
  },
  {
    ruleName: 'Maintain Bank Details / Execute Payment Run',
    ruleType: 'PREDEFINED',
    activity1: 'maintain_bank_details',
    activity2: 'execute_payment_run',
    severity: 'CRITICAL',
  },
  {
    ruleName: 'Create Purchase Order / Approve Goods Receipt',
    ruleType: 'PREDEFINED',
    activity1: 'create_purchase_order',
    activity2: 'approve_goods_receipt',
    severity: 'HIGH',
  },
];

// ============================================================================
// Mapping from DocumentType to SoD Activity
// ============================================================================

/**
 * Maps document types and metadata to SoD activity identifiers.
 * A single transaction may map to an activity that forms part of an SoD rule pair.
 */
export function mapTransactionToActivity(tx: CanonicalTransaction): string | null {
  const metadata = tx.metadata || {};

  switch (tx.documentType) {
    case 'VENDOR_MASTER_CHANGE':
      if (metadata.changeType === 'BANK_DETAIL') {
        return 'maintain_bank_details';
      }
      return 'create_vendor';

    case 'PAYMENT_DOCUMENT':
      if (metadata.isApproval === true || metadata.action === 'APPROVE') {
        return 'approve_payment';
      }
      if (metadata.isPaymentRun === true || metadata.action === 'EXECUTE_RUN') {
        return 'execute_payment_run';
      }
      return 'approve_payment';

    case 'JOURNAL_ENTRY':
      if (metadata.isApproval === true || metadata.action === 'APPROVE') {
        return 'approve_journal_entry';
      }
      return 'post_journal_entry';

    case 'PURCHASE_ORDER':
      return 'create_purchase_order';

    case 'GOODS_RECEIPT':
      if (metadata.isApproval === true || metadata.action === 'APPROVE') {
        return 'approve_goods_receipt';
      }
      return 'approve_goods_receipt';

    default:
      return null;
  }
}

// ============================================================================
// Severity Classification
// ============================================================================

/**
 * Classify SoD violation severity based on the conflicting activities.
 *
 * - CRITICAL: both conflicting activities involve payment execution or bank detail changes
 * - HIGH: one activity involves financial posting approval
 * - MEDIUM: all other conflicts
 *
 * Validates: Requirements 5.7
 */
export function classifySeverity(activity1: string, activity2: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' {
  const a1IsPaymentBank = PAYMENT_BANK_ACTIVITIES.has(activity1);
  const a2IsPaymentBank = PAYMENT_BANK_ACTIVITIES.has(activity2);

  // CRITICAL: both involve payment/bank operations
  if (a1IsPaymentBank && a2IsPaymentBank) {
    return 'CRITICAL';
  }

  const a1IsFinancialApproval = FINANCIAL_APPROVAL_ACTIVITIES.has(activity1);
  const a2IsFinancialApproval = FINANCIAL_APPROVAL_ACTIVITIES.has(activity2);

  // HIGH: at least one involves financial posting approval
  if (a1IsFinancialApproval || a2IsFinancialApproval) {
    return 'HIGH';
  }

  // MEDIUM: all other conflicts
  return 'MEDIUM';
}

// ============================================================================
// Rule Validation
// ============================================================================

/**
 * Validate a custom SoD rule before creation.
 * Rejects if:
 * - activity1 == activity2 (same action)
 * - An identical rule (same activity pair in any order) already exists
 * - Max 50 custom rules per tenant would be exceeded
 *
 * Validates: Requirements 5.4
 */
export function validateCustomRule(
  activity1: string,
  activity2: string,
  existingRules: SoDRule[],
  tenantId: string
): RuleValidationResult {
  // Check same-activity conflict
  if (activity1 === activity2) {
    return {
      valid: false,
      error: 'Both activities are the same action. An SoD rule must define two different conflicting activities.',
    };
  }

  // Check for duplicate rule (same pair in any order)
  const isDuplicate = existingRules.some(
    (rule) =>
      rule.tenantId === tenantId &&
      ((rule.activity1 === activity1 && rule.activity2 === activity2) ||
        (rule.activity1 === activity2 && rule.activity2 === activity1))
  );

  if (isDuplicate) {
    return {
      valid: false,
      error: 'A rule with the same conflicting activity pair already exists.',
    };
  }

  // Check max custom rules limit
  const customRuleCount = existingRules.filter(
    (rule) => rule.tenantId === tenantId && rule.ruleType === 'CUSTOM'
  ).length;

  if (customRuleCount >= MAX_CUSTOM_RULES_PER_TENANT) {
    return {
      valid: false,
      error: `Maximum of ${MAX_CUSTOM_RULES_PER_TENANT} custom rules per tenant reached.`,
    };
  }

  return { valid: true };
}

// ============================================================================
// SoD Detection Engine
// ============================================================================

/**
 * SoD Detection Engine
 *
 * Provides real-time SoD violation detection, custom rule management,
 * severity classification, and acknowledgment workflow.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7, 5.8
 */
export class SoDDetectionEngine {
  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Detect SoD violations for a given transaction.
   * Checks if the user who performed this transaction has also performed
   * a conflicting activity within the configured lookback window.
   * Must detect violations within 30 seconds of the triggering event.
   *
   * Validates: Requirements 5.2
   */
  async detectViolations(
    tx: CanonicalTransaction,
    thresholds: TenantThresholds
  ): Promise<SoDCheckResult> {
    const logger = cds.log('sod-detection');
    const startTime = Date.now();

    logger.info(`Checking SoD violations for user ${tx.userId}, tenant ${tx.tenantId}`);

    const currentActivity = mapTransactionToActivity(tx);
    if (!currentActivity) {
      logger.info(`Transaction type ${tx.documentType} does not map to an SoD activity`);
      return { violations: [], detectedAt: new Date() };
    }

    try {
      // Load all active rules for the tenant
      const rules = await this.loadActiveRules(tx.tenantId);

      // Find rules where the current activity matches one side of the conflict
      const matchingRules = rules.filter(
        (rule) => rule.activity1 === currentActivity || rule.activity2 === currentActivity
      );

      if (matchingRules.length === 0) {
        return { violations: [], detectedAt: new Date() };
      }

      const violations: SoDViolation[] = [];

      for (const rule of matchingRules) {
        // Determine the conflicting activity
        const conflictingActivity =
          rule.activity1 === currentActivity ? rule.activity2 : rule.activity1;

        // Look for the conflicting activity by the same user within the lookback window
        const lookbackDays = rule.lookbackDays || thresholds.sodLookbackDays;
        const conflictingEvent = await this.findConflictingActivity(
          tx.tenantId,
          tx.userId,
          conflictingActivity,
          lookbackDays,
          tx.transactionId
        );

        if (conflictingEvent) {
          const violation: SoDViolation = {
            tenantId: tx.tenantId,
            rule_ID: rule.ID,
            userId: tx.userId,
            activity1Time: conflictingEvent.timestamp,
            activity2Time: tx.postingDate,
            activity1Obj: conflictingEvent.documentRef,
            activity2Obj: tx.documentNumber,
            severity: rule.severity,
            status: 'ACTIVE',
          };

          violations.push(violation);
          logger.info(
            `SoD violation detected: user ${tx.userId} performed ${conflictingActivity} ` +
            `and ${currentActivity} (rule: ${rule.ruleName})`
          );
        }
      }

      // Persist violations and create alerts
      if (violations.length > 0) {
        await this.persistViolations(violations);
      }

      const elapsed = Date.now() - startTime;
      logger.info(
        `SoD detection completed in ${elapsed}ms. Found ${violations.length} violations.`
      );

      if (elapsed > DETECTION_TIMEOUT_MS) {
        logger.warn(
          `SoD detection exceeded ${DETECTION_TIMEOUT_MS}ms timeout (took ${elapsed}ms)`
        );
      }

      return { violations, detectedAt: new Date() };
    } catch (error: any) {
      logger.error(`SoD detection failed for user ${tx.userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a custom SoD rule for a tenant.
   * Validates the rule before creation.
   *
   * Validates: Requirements 5.3, 5.4
   */
  async createCustomRule(
    tenantId: string,
    ruleName: string,
    activity1: string,
    activity2: string,
    lookbackDays?: number
  ): Promise<{ success: boolean; rule?: SoDRule; error?: string }> {
    const logger = cds.log('sod-detection');

    // Load existing rules for validation
    const existingRules = await this.loadAllRules(tenantId);

    // Validate the rule
    const validation = validateCustomRule(activity1, activity2, existingRules, tenantId);
    if (!validation.valid) {
      logger.warn(`Custom rule creation rejected for tenant ${tenantId}: ${validation.error}`);
      return { success: false, error: validation.error };
    }

    // Calculate severity based on the activity pair
    const severity = classifySeverity(activity1, activity2);

    try {
      const db = await cds.connect.to('db');
      const { SoDRules } = db.entities('finsecure.ai');

      const newRule = {
        tenantId,
        ruleName,
        ruleType: 'CUSTOM',
        activity1,
        activity2,
        severity,
        isActive: true,
        lookbackDays: lookbackDays || 90,
      };

      const result = await INSERT.into(SoDRules).entries(newRule);
      const createdRule: SoDRule = {
        ID: (result as any)?.ID || '',
        ...newRule,
      } as SoDRule;

      logger.info(`Custom SoD rule created for tenant ${tenantId}: ${ruleName}`);
      return { success: true, rule: createdRule };
    } catch (error: any) {
      logger.error(`Failed to create custom rule: ${error.message}`);
      return { success: false, error: `Database error: ${error.message}` };
    }
  }

  /**
   * Acknowledge an SoD violation.
   * Changes status from ACTIVE to ACKNOWLEDGED, records acknowledging user and timestamp.
   *
   * Validates: Requirements 5.8
   */
  async acknowledgeViolation(
    violationId: string,
    acknowledgedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const logger = cds.log('sod-detection');

    try {
      const db = await cds.connect.to('db');
      const { SoDViolations } = db.entities('finsecure.ai');

      // Load the current violation
      const violation = await SELECT.one.from(SoDViolations).where({ ID: violationId });

      if (!violation) {
        return { success: false, error: 'Violation not found.' };
      }

      if (violation.status === 'ACKNOWLEDGED') {
        return { success: false, error: 'Violation is already acknowledged.' };
      }

      // Update status to ACKNOWLEDGED
      await UPDATE(SoDViolations)
        .set({
          status: 'ACKNOWLEDGED',
          acknowledgedBy,
          acknowledgedAt: new Date().toISOString(),
        })
        .where({ ID: violationId });

      logger.info(`SoD violation ${violationId} acknowledged by ${acknowledgedBy}`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to acknowledge violation ${violationId}: ${error.message}`);
      return { success: false, error: `Database error: ${error.message}` };
    }
  }

  /**
   * Initialize predefined SoD rules for a tenant.
   * Called during tenant provisioning to seed the rule library.
   *
   * Validates: Requirements 5.1
   */
  async initializePredefinedRules(tenantId: string): Promise<void> {
    const logger = cds.log('sod-detection');

    try {
      const db = await cds.connect.to('db');
      const { SoDRules } = db.entities('finsecure.ai');

      // Check if predefined rules already exist for this tenant
      const existingPredefined = await SELECT.from(SoDRules).where({
        tenantId,
        ruleType: 'PREDEFINED',
      });

      if (existingPredefined.length > 0) {
        logger.info(`Predefined rules already exist for tenant ${tenantId}`);
        return;
      }

      // Insert all predefined rules
      const rulesToInsert = PREDEFINED_SOD_RULES.map((rule) => ({
        tenantId,
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        activity1: rule.activity1,
        activity2: rule.activity2,
        severity: rule.severity,
        isActive: true,
        lookbackDays: 90,
      }));

      await INSERT.into(SoDRules).entries(rulesToInsert);
      logger.info(`Initialized ${rulesToInsert.length} predefined SoD rules for tenant ${tenantId}`);
    } catch (error: any) {
      logger.error(`Failed to initialize predefined rules for tenant ${tenantId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get active (unacknowledged) SoD violation count for a tenant.
   *
   * Validates: Requirements 5.6
   */
  async getActiveViolationCount(tenantId: string): Promise<number> {
    try {
      const db = await cds.connect.to('db');
      const { SoDViolations } = db.entities('finsecure.ai');

      const result = await SELECT.from(SoDViolations)
        .where({ tenantId, status: 'ACTIVE' })
        .columns('count(ID) as count');

      return (result as any)?.[0]?.count || 0;
    } catch {
      return 0;
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Load all active SoD rules for a tenant (both predefined and custom).
   */
  private async loadActiveRules(tenantId: string): Promise<SoDRule[]> {
    try {
      const db = await cds.connect.to('db');
      const { SoDRules } = db.entities('finsecure.ai');

      const rules = await SELECT.from(SoDRules).where({
        tenantId,
        isActive: true,
      });

      return rules as unknown as SoDRule[];
    } catch (error: any) {
      cds.log('sod-detection').error(`Failed to load rules for tenant ${tenantId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Load all SoD rules for a tenant (for validation purposes).
   */
  private async loadAllRules(tenantId: string): Promise<SoDRule[]> {
    try {
      const db = await cds.connect.to('db');
      const { SoDRules } = db.entities('finsecure.ai');

      const rules = await SELECT.from(SoDRules).where({ tenantId });
      return rules as unknown as SoDRule[];
    } catch (error: any) {
      cds.log('sod-detection').error(`Failed to load all rules for tenant ${tenantId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Find a conflicting activity performed by the same user within the lookback window.
   * Searches transactions for the conflicting activity type.
   */
  private async findConflictingActivity(
    tenantId: string,
    userId: string,
    conflictingActivity: string,
    lookbackDays: number,
    excludeTransactionId: string
  ): Promise<{ timestamp: Date; documentRef: string } | null> {
    try {
      const db = await cds.connect.to('db');
      const { Transactions } = db.entities('finsecure.ai');

      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

      // Map the conflicting activity back to document types and metadata conditions
      const docTypeFilter = this.getDocTypeFilter(conflictingActivity);
      if (!docTypeFilter) {
        return null;
      }

      // Query transactions that match the conflicting activity
      const candidates = await SELECT.from(Transactions)
        .where({
          tenantId,
          userId,
          documentType: docTypeFilter.documentType,
          postingDate: { '>=': lookbackDate.toISOString().split('T')[0] },
          ID: { '!=': excludeTransactionId },
        })
        .orderBy('postingDate desc')
        .limit(10);

      // Filter candidates based on metadata if needed
      for (const candidate of candidates) {
        const mappedActivity = this.mapStoredTransactionToActivity(candidate);
        if (mappedActivity === conflictingActivity) {
          return {
            timestamp: new Date(candidate.postingDate),
            documentRef: candidate.documentNumber,
          };
        }
      }

      return null;
    } catch (error: any) {
      cds.log('sod-detection').warn(
        `Failed to find conflicting activity for user ${userId}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Map a stored transaction record to its SoD activity identifier.
   */
  private mapStoredTransactionToActivity(record: any): string | null {
    const metadata = record.metadata ? JSON.parse(record.metadata) : {};
    const tx: CanonicalTransaction = {
      transactionId: record.ID,
      tenantId: record.tenantId,
      sourceSystem: '',
      sourceEventId: '',
      documentNumber: record.documentNumber || '',
      documentType: record.documentType,
      postingDate: new Date(record.postingDate),
      entryDate: new Date(record.entryDate || record.postingDate),
      amount: Number(record.amount || 0),
      currency: record.currency || 'USD',
      userId: record.userId,
      companyCode: record.companyCode || '',
      debitAccount: record.debitAccount || '',
      creditAccount: record.creditAccount || '',
      businessObjectRef: record.businessObjectRef || '',
      metadata,
      ingestedAt: new Date(),
      normalizedAt: new Date(),
    };
    return mapTransactionToActivity(tx);
  }

  /**
   * Get the document type filter for a given activity.
   */
  private getDocTypeFilter(activity: string): { documentType: string } | null {
    switch (activity) {
      case 'create_vendor':
      case 'maintain_bank_details':
        return { documentType: 'VENDOR_MASTER_CHANGE' };
      case 'approve_payment':
      case 'execute_payment_run':
        return { documentType: 'PAYMENT_DOCUMENT' };
      case 'post_journal_entry':
      case 'approve_journal_entry':
        return { documentType: 'JOURNAL_ENTRY' };
      case 'create_purchase_order':
        return { documentType: 'PURCHASE_ORDER' };
      case 'approve_goods_receipt':
        return { documentType: 'GOODS_RECEIPT' };
      default:
        return null;
    }
  }

  /**
   * Persist detected violations to the database and create associated alerts.
   */
  private async persistViolations(violations: SoDViolation[]): Promise<void> {
    try {
      const db = await cds.connect.to('db');
      const { SoDViolations: SoDViolationsEntity, Alerts } = db.entities('finsecure.ai');

      for (const violation of violations) {
        // Insert violation
        const insertResult = await INSERT.into(SoDViolationsEntity).entries({
          tenantId: violation.tenantId,
          rule_ID: violation.rule_ID,
          userId: violation.userId,
          activity1Time: violation.activity1Time.toISOString(),
          activity2Time: violation.activity2Time.toISOString(),
          activity1Obj: violation.activity1Obj,
          activity2Obj: violation.activity2Obj,
          severity: violation.severity,
          status: 'ACTIVE',
        });

        // Create an alert for the violation
        const alertPriority = violation.severity === 'CRITICAL' ? 'CRITICAL' :
          violation.severity === 'HIGH' ? 'HIGH' : 'MEDIUM';

        await INSERT.into(Alerts).entries({
          tenantId: violation.tenantId,
          priority: alertPriority,
          status: 'OPEN',
          riskCategory: 'SOD_VIOLATION',
          riskScore: violation.severity === 'CRITICAL' ? 90 :
            violation.severity === 'HIGH' ? 75 : 50,
          title: `SoD Violation: ${violation.activity1Obj} conflicts with ${violation.activity2Obj}`,
          description: `User ${violation.userId} performed conflicting activities: ` +
            `${violation.activity1Obj} at ${violation.activity1Time.toISOString()} and ` +
            `${violation.activity2Obj} at ${violation.activity2Time.toISOString()}.`,
          affectedEntities: JSON.stringify([{ type: 'USER', id: violation.userId }]),
          riskIndicators: JSON.stringify([
            {
              indicatorType: 'sod_conflict',
              description: `Conflicting activities detected within lookback window`,
              weight: 1.0,
            },
          ]),
        });
      }
    } catch (error: any) {
      cds.log('sod-detection').error(`Failed to persist violations: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance for use by the Detection Engine
export const sodDetectionEngine = new SoDDetectionEngine();
