import cds = require('@sap/cds');
import { CanonicalTransaction, RiskEvent, RiskIndicator, AffectedEntity, TenantThresholds } from '../types';
import { DetectionMethod, RiskCategory } from '../types/enums';

// ============================================================================
// Interfaces
// ============================================================================

/** Recorded vendor bank detail change event */
export interface VendorBankChange {
  /** Unique ID */
  ID: string;
  /** Tenant owning this record */
  tenantId: string;
  /** SAP vendor number */
  vendorId: string;
  /** User who performed the change */
  changingUser: string;
  /** Hash of previous bank details */
  previousBankHash: string;
  /** Hash of new bank details */
  newBankHash: string;
  /** Optional justification text */
  changeJustification?: string;
  /** Computed risk level: LOW, MEDIUM, HIGH, CRITICAL */
  riskLevel: VendorRiskLevel;
  /** Computed vendor risk score 0-100 */
  vendorRiskScore: number;
  /** When the change occurred */
  changedAt: Date;
  /** Alert ID if correlated with a payment */
  correlatedPayment?: string;
}

/** Vendor risk assessment result */
export interface VendorRiskAssessment {
  /** Vendor ID assessed */
  vendorId: string;
  /** Computed risk score 0-100 */
  riskScore: number;
  /** Risk level derived from score */
  riskLevel: VendorRiskLevel;
  /** Whether the change was by a first-time maintainer */
  isFirstTimeMaintainer: boolean;
  /** Number of bank changes in the lookback period */
  changeFrequency: number;
  /** Hours between last bank change and payment (if applicable) */
  timeProximityHours?: number;
  /** Past correlation count */
  correlationHistory: number;
  /** Risk indicators explaining the score */
  riskIndicators: RiskIndicator[];
}

/** Risk levels for vendor bank changes */
export type VendorRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Configuration for the vendor tampering detection window */
export interface VendorTamperingConfig {
  /** Hours to look back for bank changes when a payment occurs (default 48) */
  bankChangeHours: number;
  /** Days to look back for change frequency (default 90) */
  frequencyLookbackDays: number;
  /** Days to determine if a user is a first-time maintainer (default 90) */
  firstTimeMaintainerDays: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default detection window in hours */
const DEFAULT_BANK_CHANGE_HOURS = 48;

/** Lookback for change frequency calculation */
const FREQUENCY_LOOKBACK_DAYS = 90;

/** Lookback for first-time maintainer determination */
const FIRST_TIME_MAINTAINER_DAYS = 90;

/** Score weights for vendor risk calculation */
const VENDOR_RISK_WEIGHTS = {
  changeFrequency: 0.25,
  timeProximity: 0.30,
  correlationHistory: 0.25,
  unusualMaintainer: 0.20,
};

/** Risk level thresholds derived from the 0-100 score */
const RISK_LEVEL_THRESHOLDS = {
  CRITICAL: 80,
  HIGH: 60,
  MEDIUM: 40,
};

// ============================================================================
// Vendor Tampering Detection Implementation
// ============================================================================

/**
 * Vendor Master Tampering Detection Module
 *
 * Detects vendor bank detail changes correlated with subsequent payments.
 * This is one of the most common accounts payable fraud vectors:
 * an attacker changes vendor bank details and then triggers a payment
 * to the new (fraudulent) bank account.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */
export class VendorTamperingDetection {
  private readonly logger = cds.log('vendor-tampering');

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Record a vendor bank detail change event.
   * Must complete within 5 seconds of receipt per Requirement 14.1.
   *
   * Captures: changing user identity, previous/new bank detail hashes,
   * timestamp, and change justification.
   *
   * Validates: Requirements 14.1, 14.4, 14.5
   */
  async recordBankChange(
    tenantId: string,
    vendorId: string,
    changingUser: string,
    previousBankHash: string,
    newBankHash: string,
    changeJustification?: string,
    changedAt?: Date
  ): Promise<VendorBankChange> {
    const timestamp = changedAt || new Date();

    this.logger.info(
      `Recording bank change for vendor ${vendorId} by user ${changingUser} in tenant ${tenantId}`
    );

    // Assess risk for this change
    const assessment = await this.assessVendorRisk(
      tenantId,
      vendorId,
      changingUser,
      timestamp
    );

    // Build the change record
    const changeRecord: VendorBankChange = {
      ID: cds.utils.uuid(),
      tenantId,
      vendorId,
      changingUser,
      previousBankHash,
      newBankHash,
      changeJustification,
      riskLevel: assessment.riskLevel,
      vendorRiskScore: assessment.riskScore,
      changedAt: timestamp,
    };

    // Store in VendorBankChanges entity
    await this.storeChangeRecord(changeRecord);

    // If first-time maintainer, flag immediately as HIGH risk regardless
    // Validates: Requirement 14.5
    if (assessment.isFirstTimeMaintainer && assessment.riskLevel !== 'CRITICAL') {
      changeRecord.riskLevel = 'HIGH';
      changeRecord.vendorRiskScore = Math.max(assessment.riskScore, 60);
      await this.updateChangeRecord(changeRecord.ID, {
        riskLevel: changeRecord.riskLevel,
        vendorRiskScore: changeRecord.vendorRiskScore,
      });

      this.logger.warn(
        `First-time maintainer ${changingUser} changed bank details for vendor ${vendorId} - flagged HIGH`
      );
    }

    return changeRecord;
  }

  /**
   * Correlate a payment with recent vendor bank changes.
   * Must generate a critical Alert within 10 seconds of the payment event
   * if the vendor's bank details were changed within the configured window.
   *
   * Validates: Requirements 14.2
   */
  async correlatePaymentWithBankChanges(
    tenantId: string,
    paymentTransaction: CanonicalTransaction,
    thresholds: TenantThresholds
  ): Promise<RiskEvent | null> {
    const vendorId = paymentTransaction.vendorId;
    if (!vendorId) {
      return null;
    }

    const bankChangeHours = thresholds.vendorBankChangeHours || DEFAULT_BANK_CHANGE_HOURS;

    this.logger.info(
      `Correlating payment ${paymentTransaction.transactionId} for vendor ${vendorId} with bank changes (window: ${bankChangeHours}h)`
    );

    // Find recent bank changes within the configured window
    const recentChanges = await this.findRecentBankChanges(
      tenantId,
      vendorId,
      bankChangeHours,
      paymentTransaction.postingDate
    );

    if (recentChanges.length === 0) {
      return null;
    }

    // Calculate time proximity to the most recent change
    const mostRecentChange = recentChanges[0];
    const timeProximityMs = paymentTransaction.postingDate.getTime() - new Date(mostRecentChange.changedAt).getTime();
    const timeProximityHours = timeProximityMs / (1000 * 60 * 60);

    // Get full vendor risk assessment with correlation context
    const assessment = await this.assessVendorRisk(
      tenantId,
      vendorId,
      mostRecentChange.changingUser,
      paymentTransaction.postingDate,
      timeProximityHours
    );

    // Generate critical risk event
    const riskEvent = this.createVendorTamperingRiskEvent(
      tenantId,
      paymentTransaction,
      mostRecentChange,
      assessment,
      timeProximityHours
    );

    // Update the bank change record with the correlated payment alert
    await this.updateChangeRecord(mostRecentChange.ID, {
      correlatedPayment: riskEvent.riskEventId,
    });

    this.logger.warn(
      `VENDOR TAMPERING DETECTED: Vendor ${vendorId} bank change by ${mostRecentChange.changingUser} ` +
      `correlated with payment ${paymentTransaction.transactionId} (${timeProximityHours.toFixed(1)}h gap). ` +
      `Risk score: ${assessment.riskScore}`
    );

    return riskEvent;
  }

  /**
   * Calculate vendor risk score (0-100) based on multiple factors.
   *
   * Factors (from Requirement 14.4):
   * - Change frequency: more than 2 changes in 90 days increases score
   * - Time proximity: change-to-payment gap less than 48 hours increases score
   * - Correlation history: past instances of bank-change-then-payment pattern
   * - Unusual maintainer: first-time maintainers flagged as higher risk
   *
   * Validates: Requirements 14.4, 14.5
   */
  async assessVendorRisk(
    tenantId: string,
    vendorId: string,
    changingUser: string,
    referenceDate: Date,
    timeProximityHours?: number
  ): Promise<VendorRiskAssessment> {
    // 1. Calculate change frequency (changes in last 90 days)
    const changeFrequency = await this.getChangeFrequency(tenantId, vendorId, referenceDate);

    // 2. Determine if this is a first-time maintainer
    const isFirstTimeMaintainer = await this.isFirstTimeMaintainer(
      tenantId,
      vendorId,
      changingUser,
      referenceDate
    );

    // 3. Get correlation history count
    const correlationHistory = await this.getCorrelationHistory(tenantId, vendorId);

    // 4. Calculate component scores
    const frequencyScore = this.calculateFrequencyScore(changeFrequency);
    const proximityScore = this.calculateProximityScore(timeProximityHours);
    const correlationScore = this.calculateCorrelationScore(correlationHistory);
    const maintainerScore = this.calculateMaintainerScore(isFirstTimeMaintainer);

    // 5. Combine weighted scores
    const rawScore =
      frequencyScore * VENDOR_RISK_WEIGHTS.changeFrequency +
      proximityScore * VENDOR_RISK_WEIGHTS.timeProximity +
      correlationScore * VENDOR_RISK_WEIGHTS.correlationHistory +
      maintainerScore * VENDOR_RISK_WEIGHTS.unusualMaintainer;

    const riskScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    const riskLevel = this.deriveRiskLevel(riskScore);

    // Build risk indicators for explainability
    const riskIndicators: RiskIndicator[] = [];

    if (frequencyScore > 0) {
      riskIndicators.push({
        indicatorType: 'vendor_bank_change_frequency',
        description: `${changeFrequency} bank detail changes in last ${FREQUENCY_LOOKBACK_DAYS} days (threshold: 2)`,
        observedValue: changeFrequency,
        expectedRange: { min: 0, max: 2 },
        weight: VENDOR_RISK_WEIGHTS.changeFrequency,
      });
    }

    if (proximityScore > 0 && timeProximityHours !== undefined) {
      riskIndicators.push({
        indicatorType: 'change_payment_time_proximity',
        description: `Payment occurred ${timeProximityHours.toFixed(1)} hours after bank detail change`,
        observedValue: timeProximityHours,
        expectedRange: { min: DEFAULT_BANK_CHANGE_HOURS, max: undefined as unknown },
        weight: VENDOR_RISK_WEIGHTS.timeProximity,
      });
    }

    if (correlationScore > 0) {
      riskIndicators.push({
        indicatorType: 'bank_change_payment_correlation_history',
        description: `${correlationHistory} previous bank-change-then-payment correlations for this vendor`,
        observedValue: correlationHistory,
        expectedRange: { min: 0, max: 0 },
        weight: VENDOR_RISK_WEIGHTS.correlationHistory,
      });
    }

    if (isFirstTimeMaintainer) {
      riskIndicators.push({
        indicatorType: 'first_time_maintainer',
        description: `User has not maintained bank details for this vendor in the preceding ${FIRST_TIME_MAINTAINER_DAYS} days`,
        observedValue: true,
        expectedRange: { min: false as unknown, max: false as unknown },
        weight: VENDOR_RISK_WEIGHTS.unusualMaintainer,
      });
    }

    return {
      vendorId,
      riskScore,
      riskLevel,
      isFirstTimeMaintainer,
      changeFrequency,
      timeProximityHours,
      correlationHistory,
      riskIndicators,
    };
  }

  // ==========================================================================
  // Score Calculation Helpers
  // ==========================================================================

  /**
   * Calculate frequency component score (0-100).
   * More than 2 changes in 90 days increases risk.
   */
  calculateFrequencyScore(changeCount: number): number {
    if (changeCount <= 1) return 0;
    if (changeCount === 2) return 30;
    if (changeCount === 3) return 60;
    if (changeCount === 4) return 80;
    return 100; // 5+ changes
  }

  /**
   * Calculate time proximity component score (0-100).
   * Closer proximity = higher score.
   * Gap < 48 hours is the key indicator per Requirement 14.4.
   */
  calculateProximityScore(timeProximityHours: number | undefined): number {
    if (timeProximityHours === undefined) return 0;
    if (timeProximityHours < 0) return 0;

    // Closer to the change = higher risk
    if (timeProximityHours <= 1) return 100;
    if (timeProximityHours <= 4) return 90;
    if (timeProximityHours <= 12) return 75;
    if (timeProximityHours <= 24) return 60;
    if (timeProximityHours <= 48) return 40;
    // Beyond the window but still noteworthy
    if (timeProximityHours <= 72) return 20;
    return 0;
  }

  /**
   * Calculate correlation history component score (0-100).
   * More past correlations = higher risk.
   */
  calculateCorrelationScore(correlationCount: number): number {
    if (correlationCount === 0) return 0;
    if (correlationCount === 1) return 40;
    if (correlationCount === 2) return 65;
    if (correlationCount === 3) return 80;
    return 100; // 4+ previous correlations
  }

  /**
   * Calculate maintainer component score (0-100).
   * First-time maintainers get a full 100 score on this dimension.
   */
  calculateMaintainerScore(isFirstTimeMaintainer: boolean): number {
    return isFirstTimeMaintainer ? 100 : 0;
  }

  /**
   * Derive risk level from the overall score.
   */
  deriveRiskLevel(score: number): VendorRiskLevel {
    if (score >= RISK_LEVEL_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (score >= RISK_LEVEL_THRESHOLDS.HIGH) return 'HIGH';
    if (score >= RISK_LEVEL_THRESHOLDS.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  // ==========================================================================
  // Data Access Methods
  // ==========================================================================

  /**
   * Store a bank change record in the VendorBankChanges entity.
   */
  private async storeChangeRecord(record: VendorBankChange): Promise<void> {
    try {
      const db = await cds.connect.to('db');
      const { VendorBankChanges } = db.entities('finsecure.ai');

      await INSERT.into(VendorBankChanges).entries({
        ID: record.ID,
        tenantId: record.tenantId,
        vendorId: record.vendorId,
        changingUser: record.changingUser,
        previousBankHash: record.previousBankHash,
        newBankHash: record.newBankHash,
        changeJustification: record.changeJustification || null,
        riskLevel: record.riskLevel,
        vendorRiskScore: record.vendorRiskScore,
        changedAt: record.changedAt.toISOString(),
        correlatedPayment: record.correlatedPayment || null,
      });
    } catch (error: any) {
      this.logger.error(`Failed to store bank change record: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a bank change record with new data.
   */
  private async updateChangeRecord(
    changeId: string,
    updates: Partial<{
      riskLevel: string;
      vendorRiskScore: number;
      correlatedPayment: string;
    }>
  ): Promise<void> {
    try {
      const db = await cds.connect.to('db');
      const { VendorBankChanges } = db.entities('finsecure.ai');

      await UPDATE(VendorBankChanges).set(updates).where({ ID: changeId });
    } catch (error: any) {
      this.logger.error(`Failed to update bank change record ${changeId}: ${error.message}`);
    }
  }

  /**
   * Find recent bank changes for a vendor within the configured window.
   * Returns changes ordered by most recent first.
   */
  private async findRecentBankChanges(
    tenantId: string,
    vendorId: string,
    windowHours: number,
    referenceDate: Date
  ): Promise<VendorBankChange[]> {
    try {
      const db = await cds.connect.to('db');
      const { VendorBankChanges } = db.entities('finsecure.ai');

      const windowStart = new Date(referenceDate.getTime() - windowHours * 60 * 60 * 1000);

      const changes = await SELECT.from(VendorBankChanges)
        .where({
          tenantId,
          vendorId,
          changedAt: { '>=': windowStart.toISOString() },
        })
        .orderBy('changedAt desc');

      // Filter out changes that occurred after the reference date
      return (changes || []).filter((c: any) => new Date(c.changedAt) <= referenceDate).map((c: any) => ({
        ID: c.ID,
        tenantId: c.tenantId,
        vendorId: c.vendorId,
        changingUser: c.changingUser,
        previousBankHash: c.previousBankHash,
        newBankHash: c.newBankHash,
        changeJustification: c.changeJustification,
        riskLevel: c.riskLevel,
        vendorRiskScore: c.vendorRiskScore,
        changedAt: new Date(c.changedAt),
        correlatedPayment: c.correlatedPayment,
      }));
    } catch (error: any) {
      this.logger.error(`Failed to find recent bank changes for vendor ${vendorId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Get the number of bank detail changes for a vendor in the last 90 days.
   */
  private async getChangeFrequency(
    tenantId: string,
    vendorId: string,
    referenceDate: Date
  ): Promise<number> {
    try {
      const db = await cds.connect.to('db');
      const { VendorBankChanges } = db.entities('finsecure.ai');

      const lookbackStart = new Date(referenceDate.getTime() - FREQUENCY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

      const result = await SELECT.from(VendorBankChanges)
        .columns('count(ID) as count')
        .where({
          tenantId,
          vendorId,
          changedAt: { '>=': lookbackStart.toISOString() },
        });

      return result?.[0]?.count || 0;
    } catch (error: any) {
      this.logger.warn(`Failed to get change frequency for vendor ${vendorId}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Determine if the changing user is a first-time maintainer.
   * A user is first-time if they have NOT performed a bank detail change
   * for this specific vendor in the preceding 90 days.
   *
   * Validates: Requirement 14.5
   */
  private async isFirstTimeMaintainer(
    tenantId: string,
    vendorId: string,
    changingUser: string,
    referenceDate: Date
  ): Promise<boolean> {
    try {
      const db = await cds.connect.to('db');
      const { VendorBankChanges } = db.entities('finsecure.ai');

      const lookbackStart = new Date(
        referenceDate.getTime() - FIRST_TIME_MAINTAINER_DAYS * 24 * 60 * 60 * 1000
      );

      const previousChange = await SELECT.one.from(VendorBankChanges).where({
        tenantId,
        vendorId,
        changingUser,
        changedAt: { '>=': lookbackStart.toISOString(), '<': referenceDate.toISOString() },
      });

      return !previousChange;
    } catch (error: any) {
      this.logger.warn(`Failed to check first-time maintainer for user ${changingUser}: ${error.message}`);
      // Default to flagging as first-time (safer to over-flag)
      return true;
    }
  }

  /**
   * Get the number of past bank-change-then-payment correlations for a vendor.
   */
  private async getCorrelationHistory(tenantId: string, vendorId: string): Promise<number> {
    try {
      const db = await cds.connect.to('db');
      const { VendorBankChanges } = db.entities('finsecure.ai');

      const result = await SELECT.from(VendorBankChanges)
        .columns('count(ID) as count')
        .where({
          tenantId,
          vendorId,
          correlatedPayment: { '!=': null },
        });

      return result?.[0]?.count || 0;
    } catch (error: any) {
      this.logger.warn(`Failed to get correlation history for vendor ${vendorId}: ${error.message}`);
      return 0;
    }
  }

  // ==========================================================================
  // Risk Event Generation
  // ==========================================================================

  /**
   * Create a critical risk event for vendor tampering correlation.
   *
   * Validates: Requirement 14.2 (generate critical Alert)
   */
  private createVendorTamperingRiskEvent(
    tenantId: string,
    paymentTransaction: CanonicalTransaction,
    bankChange: VendorBankChange,
    assessment: VendorRiskAssessment,
    timeProximityHours: number
  ): RiskEvent {
    const riskIndicators: RiskIndicator[] = [
      ...assessment.riskIndicators,
      {
        indicatorType: 'vendor_bank_change_payment_correlation',
        description: `Payment to vendor ${bankChange.vendorId} detected ${timeProximityHours.toFixed(1)} hours after bank detail change by ${bankChange.changingUser}`,
        observedValue: timeProximityHours,
        expectedRange: { min: DEFAULT_BANK_CHANGE_HOURS, max: undefined as unknown },
        weight: 1.0,
      },
    ];

    const affectedEntities: AffectedEntity[] = [
      {
        entityType: 'vendor',
        entityId: bankChange.vendorId,
        entityName: `Vendor ${bankChange.vendorId}`,
      },
      {
        entityType: 'user',
        entityId: bankChange.changingUser,
        entityName: `Bank detail maintainer`,
      },
      {
        entityType: 'user',
        entityId: paymentTransaction.userId,
        entityName: `Payment executor`,
      },
    ];

    // The risk score for the event is at least the assessment score,
    // but bank-change + payment correlation always produces CRITICAL
    const riskScore = Math.max(assessment.riskScore, RISK_LEVEL_THRESHOLDS.CRITICAL);

    return {
      riskEventId: cds.utils.uuid(),
      tenantId,
      transactionId: paymentTransaction.transactionId,
      riskCategory: 'VENDOR_TAMPERING' as RiskCategory,
      riskScore,
      confidence: 95, // Rule-based correlation has high confidence
      detectionMethod: 'CORRELATION' as DetectionMethod,
      riskIndicators,
      affectedEntities,
      financialExposure: Math.abs(paymentTransaction.amount),
      detectedAt: new Date(),
    };
  }

  /**
   * Generate a system health alert when processing exceeds 30 seconds.
   *
   * Validates: Requirement 14.6
   */
  async generateProcessingDelayAlert(
    tenantId: string,
    vendorId: string,
    eventId: string,
    delaySeconds: number
  ): Promise<RiskEvent> {
    this.logger.error(
      `Processing delay alert: vendor ${vendorId} bank change event ${eventId} ` +
      `exceeded 30s threshold (actual: ${delaySeconds}s)`
    );

    return {
      riskEventId: cds.utils.uuid(),
      tenantId,
      transactionId: eventId,
      riskCategory: 'VENDOR_TAMPERING' as RiskCategory,
      riskScore: 50, // System health issue, not necessarily fraud
      confidence: 100,
      detectionMethod: 'THRESHOLD_BREACH' as DetectionMethod,
      riskIndicators: [
        {
          indicatorType: 'processing_delay',
          description: `Vendor bank change processing exceeded 30 second threshold (${delaySeconds}s)`,
          observedValue: delaySeconds,
          expectedRange: { min: 0, max: 30 },
          weight: 1.0,
        },
      ],
      affectedEntities: [
        {
          entityType: 'vendor',
          entityId: vendorId,
          entityName: `Vendor ${vendorId}`,
        },
      ],
      detectedAt: new Date(),
    };
  }
}
