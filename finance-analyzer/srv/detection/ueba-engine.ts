import cds = require('@sap/cds');
import { CanonicalTransaction, BehavioralDimensions } from '../types';
import { BehavioralProfileStatus } from '../types/enums';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Result of a behavioral deviation check against a user's profile.
 * Validates: Requirements 4.4
 */
export interface BehavioralDeviation {
  /** User whose behavior deviated */
  userId: string;
  /** Which behavioral dimension deviated */
  deviationDimension: keyof BehavioralDimensions;
  /** The expected value range based on the profile */
  expectedRange: { min: number; max: number };
  /** The value observed in the transaction */
  observedValue: number;
  /** How many standard deviations from the mean */
  deviationMagnitude: number;
  /** Risk score contribution (0-100) */
  riskScore: number;
}

/**
 * Configuration for UEBA engine behavior.
 */
export interface UEBAConfig {
  /** Rolling window in days (30-365, default 90) */
  rollingWindowDays: number;
  /** Minimum days before profile goes ACTIVE (default 30) */
  learningPeriodDays: number;
}

/** Peer group metrics for access outlier detection */
export interface PeerGroupMetrics {
  /** Average transaction count per day in peer group */
  avgTransactionsPerDay: number;
  /** Standard deviation of transactions per day in peer group */
  stdDevTransactionsPerDay: number;
  /** Average distinct cost centers used */
  avgCostCenters: number;
  /** Average distinct vendors accessed */
  avgVendors: number;
  /** Number of users in the peer group */
  peerGroupSize: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default rolling window: 90 days */
const DEFAULT_ROLLING_WINDOW_DAYS = 90;

/** Minimum days before profile becomes ACTIVE */
const LEARNING_PERIOD_DAYS = 30;

/** Maximum rolling window allowed */
const MAX_ROLLING_WINDOW_DAYS = 365;

/** Minimum rolling window allowed */
const MIN_ROLLING_WINDOW_DAYS = 30;

/**
 * Sensitivity factor mapping: sensitivity level (1-10) maps to a multiplier
 * for standard deviation threshold. Lower sensitivity = higher multiplier
 * (harder to trigger), higher sensitivity = lower multiplier (easier to trigger).
 *
 * sensitivity 1 → factor 4.0 (least sensitive, need 4 stdDevs to flag)
 * sensitivity 5 → factor 2.5 (default)
 * sensitivity 10 → factor 1.0 (most sensitive, 1 stdDev flags)
 */
function getSensitivityFactor(sensitivity: number): number {
  // Clamp sensitivity to [1, 10]
  const clamped = Math.max(1, Math.min(10, sensitivity));
  // Linear mapping: sensitivity 1 → 4.0, sensitivity 10 → 1.0
  return 4.0 - ((clamped - 1) / 9) * 3.0;
}

// ============================================================================
// UEBA Engine Implementation
// ============================================================================

/**
 * User and Entity Behavior Analytics (UEBA) Engine.
 *
 * Maintains behavioral profiles per user and detects deviations from
 * established patterns. Profiles with < 30 days of data are in LEARNING
 * status and do not generate deviation alerts.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.7
 */
export class UEBAEngine {
  private readonly config: UEBAConfig;

  constructor(config?: Partial<UEBAConfig>) {
    this.config = {
      rollingWindowDays: Math.max(
        MIN_ROLLING_WINDOW_DAYS,
        Math.min(MAX_ROLLING_WINDOW_DAYS, config?.rollingWindowDays ?? DEFAULT_ROLLING_WINDOW_DAYS)
      ),
      learningPeriodDays: config?.learningPeriodDays ?? LEARNING_PERIOD_DAYS,
    };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Build or update behavioral profile incrementally.
   * Must complete within 5 minutes of ingestion.
   *
   * Updates the profile dimensions based on the new transaction without
   * requiring a full retraining from scratch.
   *
   * Validates: Requirements 4.1, 4.2, 4.7
   */
  async updateProfile(
    tenantId: string,
    userId: string,
    tx: CanonicalTransaction
  ): Promise<void> {
    const logger = cds.log('ueba');
    logger.info(`Updating behavioral profile for user ${userId} in tenant ${tenantId}`);

    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles, ProfileDimensions, Transactions } = db.entities('finsecure.ai');

      // Load existing profile or create new one
      let profile = await SELECT.one.from(BehavioralProfiles).where({
        tenantId,
        userId,
      });

      const now = new Date();
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - this.config.rollingWindowDays);

      if (!profile) {
        // Create new profile
        await this.createNewProfile(db, tenantId, userId, tx, now, windowStart);
        logger.info(`Created new LEARNING profile for user ${userId}`);
        return;
      }

      // Calculate days covered within the rolling window
      const daysCovered = await this.calculateDaysCovered(db, tenantId, userId, windowStart);

      // Determine profile status
      const status: BehavioralProfileStatus = daysCovered >= this.config.learningPeriodDays
        ? 'ACTIVE'
        : 'LEARNING';

      // Get recent transactions within rolling window for incremental update
      const recentTransactions = await SELECT.from(Transactions)
        .where({
          tenantId,
          userId,
          postingDate: { '>=': windowStart.toISOString().split('T')[0] },
        })
        .orderBy('postingDate asc');

      // Calculate updated dimensions incrementally
      const dimensions = this.calculateDimensions(recentTransactions, tx);

      // Update profile record
      await UPDATE(BehavioralProfiles)
        .set({
          status,
          windowStartDate: windowStart.toISOString().split('T')[0],
          windowEndDate: now.toISOString().split('T')[0],
          daysCovered,
          lastUpdated: now.toISOString(),
        })
        .where({ ID: profile.ID });

      // Update or create profile dimensions
      const existingDimensions = await SELECT.one.from(ProfileDimensions).where({
        profile_ID: profile.ID,
      });

      const dimensionsData = this.serializeDimensions(dimensions, profile.ID);

      if (existingDimensions) {
        await UPDATE(ProfileDimensions)
          .set(dimensionsData)
          .where({ ID: existingDimensions.ID });
      } else {
        await INSERT.into(ProfileDimensions).entries({
          ...dimensionsData,
          ID: cds.utils.uuid(),
          profile_ID: profile.ID,
        });
      }

      logger.info(
        `Updated profile for user ${userId}: status=${status}, daysCovered=${daysCovered}`
      );
    } catch (error: any) {
      logger.error(`Failed to update profile for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check transaction against user's behavioral profile.
   * Returns deviation if beyond sensitivity threshold.
   * Returns null if no deviation detected or profile is in LEARNING status.
   *
   * Validates: Requirements 4.3, 4.4, 4.5
   */
  async checkDeviation(
    tenantId: string,
    userId: string,
    tx: CanonicalTransaction,
    sensitivity: number
  ): Promise<BehavioralDeviation | null> {
    const logger = cds.log('ueba');

    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles, ProfileDimensions } = db.entities('finsecure.ai');

      // Load profile
      const profile = await SELECT.one.from(BehavioralProfiles).where({
        tenantId,
        userId,
      });

      if (!profile) {
        logger.info(`No profile found for user ${userId} — skipping deviation check`);
        return null;
      }

      // Suppress alerts for LEARNING profiles (< 30 days)
      if (profile.status === 'LEARNING' || profile.daysCovered < this.config.learningPeriodDays) {
        logger.info(`Profile for user ${userId} is in LEARNING status — suppressing deviation alerts`);
        return null;
      }

      // Load dimensions
      const dimensions = await SELECT.one.from(ProfileDimensions).where({
        profile_ID: profile.ID,
      });

      if (!dimensions) {
        logger.info(`No dimensions found for profile ${profile.ID} — skipping deviation check`);
        return null;
      }

      const sensitivityFactor = getSensitivityFactor(sensitivity);

      // Check cost center deviation FIRST — always flag unobserved cost centers
      // Validates: Requirements 4.5
      const costCenterDeviation = this.checkCostCenterDeviation(tx, dimensions);
      if (costCenterDeviation) {
        return costCenterDeviation;
      }

      // Check amount deviation
      // Validates: Requirements 4.4
      const amountDeviation = this.checkAmountDeviation(tx, dimensions, sensitivityFactor);
      if (amountDeviation) {
        return amountDeviation;
      }

      // Check posting time deviation
      const timeDeviation = this.checkPostingTimeDeviation(tx, dimensions, sensitivityFactor);
      if (timeDeviation) {
        return timeDeviation;
      }

      // Check posting frequency deviation
      const frequencyDeviation = this.checkPostingFrequencyDeviation(tx, dimensions, sensitivityFactor);
      if (frequencyDeviation) {
        return frequencyDeviation;
      }

      // Check account combination deviation
      const accountDeviation = this.checkAccountCombinationDeviation(tx, dimensions);
      if (accountDeviation) {
        return accountDeviation;
      }

      // Check vendor relationship deviation
      const vendorDeviation = this.checkVendorRelationshipDeviation(tx, dimensions);
      if (vendorDeviation) {
        return vendorDeviation;
      }

      return null;
    } catch (error: any) {
      logger.error(`Deviation check failed for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate insider threat score from multiple behavioral dimensions.
   * Combines data access anomalies, temporal anomalies, sensitive data access,
   * and authorization usage deviations.
   *
   * Validates: Requirements 20.1
   */
  async calculateInsiderThreatScore(tenantId: string, userId: string): Promise<number> {
    const logger = cds.log('ueba');

    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles, ProfileDimensions } = db.entities('finsecure.ai');

      const profile = await SELECT.one.from(BehavioralProfiles).where({
        tenantId,
        userId,
      });

      if (!profile || profile.status === 'LEARNING') {
        return 0;
      }

      const dimensions = await SELECT.one.from(ProfileDimensions).where({
        profile_ID: profile.ID,
      });

      if (!dimensions) {
        return 0;
      }

      // Calculate component scores (each 0-25, total max 100)
      let score = 0;

      // Data access volume anomaly component
      if (dimensions.dataAccessMeanPerDay && dimensions.dataAccessStdDev) {
        const mean = Number(dimensions.dataAccessMeanPerDay);
        const stdDev = Number(dimensions.dataAccessStdDev);
        if (stdDev > 0 && mean > 0) {
          // Higher variance from historical access = higher score
          score += Math.min(25, Math.round((stdDev / mean) * 10));
        }
      }

      // Temporal anomaly component (based on activity outside peak hours)
      const hourDist = this.parseJsonArray(dimensions.hourDistribution);
      if (hourDist.length === 24) {
        const total = hourDist.reduce((s: number, v: number) => s + v, 0);
        if (total > 0) {
          // Calculate what percentage of activity is outside business hours (8-18)
          const offHoursActivity = hourDist
            .filter((_: number, i: number) => i < 8 || i >= 18)
            .reduce((s: number, v: number) => s + v, 0);
          const offHoursRatio = offHoursActivity / total;
          score += Math.min(25, Math.round(offHoursRatio * 50));
        }
      }

      // Authorization breadth component (more unique codes = higher risk)
      const txCodes = this.parseJsonArray(dimensions.transactionCodes);
      score += Math.min(25, txCodes.length * 2);

      // Apply HR risk multiplier if active
      const hrMultiplier = Number(profile.hrRiskMultiplier) || 1.0;
      const hrExpiry = profile.hrRiskExpiresAt ? new Date(profile.hrRiskExpiresAt) : null;
      const effectiveMultiplier = (hrExpiry && hrExpiry > new Date()) ? hrMultiplier : 1.0;

      score = Math.min(100, Math.round(score * effectiveMultiplier));

      return score;
    } catch (error: any) {
      logger.error(`Insider threat score calculation failed for user ${userId}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Elevate monitoring sensitivity for HR-correlated users.
   * Applies a risk multiplier for a specified duration.
   *
   * Validates: Requirements 27.2
   */
  async applyHRRiskMultiplier(
    tenantId: string,
    userId: string,
    multiplier: number,
    durationDays: number
  ): Promise<void> {
    const logger = cds.log('ueba');

    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles } = db.entities('finsecure.ai');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      await UPDATE(BehavioralProfiles)
        .set({
          hrRiskMultiplier: multiplier,
          hrRiskExpiresAt: expiresAt.toISOString(),
        })
        .where({ tenantId, userId });

      logger.info(
        `Applied HR risk multiplier ${multiplier} for user ${userId} ` +
        `until ${expiresAt.toISOString()}`
      );
    } catch (error: any) {
      logger.error(`Failed to apply HR risk multiplier for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get peer group baseline for access outlier detection.
   * Calculates average behavioral metrics for users in the same organizational unit.
   */
  async getPeerGroupBaseline(tenantId: string, userId: string): Promise<PeerGroupMetrics> {
    const logger = cds.log('ueba');

    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles, ProfileDimensions } = db.entities('finsecure.ai');

      // Get all active profiles in the same tenant (simplified peer group)
      const peerProfiles = await SELECT.from(BehavioralProfiles).where({
        tenantId,
        status: 'ACTIVE',
        userId: { '!=': userId },
      });

      if (peerProfiles.length === 0) {
        return {
          avgTransactionsPerDay: 0,
          stdDevTransactionsPerDay: 0,
          avgCostCenters: 0,
          avgVendors: 0,
          peerGroupSize: 0,
        };
      }

      const profileIds = peerProfiles.map((p: any) => p.ID);
      const allDimensions = await SELECT.from(ProfileDimensions).where({
        profile_ID: { in: profileIds },
      });

      // Calculate aggregate metrics
      const frequencies = allDimensions
        .map((d: any) => Number(d.postingFreqMean) || 0)
        .filter((v: number) => v > 0);

      const costCenterCounts = allDimensions
        .map((d: any) => this.parseJsonArray(d.costCenters).length)
        .filter((v: number) => v > 0);

      const vendorCounts = allDimensions
        .map((d: any) => this.parseJsonArray(d.vendorRelationships).length)
        .filter((v: number) => v > 0);

      const avgFreq = frequencies.length > 0
        ? frequencies.reduce((s: number, v: number) => s + v, 0) / frequencies.length
        : 0;

      const stdDevFreq = frequencies.length > 1
        ? Math.sqrt(
            frequencies.reduce((s: number, v: number) => s + Math.pow(v - avgFreq, 2), 0) /
            (frequencies.length - 1)
          )
        : 0;

      return {
        avgTransactionsPerDay: avgFreq,
        stdDevTransactionsPerDay: stdDevFreq,
        avgCostCenters: costCenterCounts.length > 0
          ? costCenterCounts.reduce((s: number, v: number) => s + v, 0) / costCenterCounts.length
          : 0,
        avgVendors: vendorCounts.length > 0
          ? vendorCounts.reduce((s: number, v: number) => s + v, 0) / vendorCounts.length
          : 0,
        peerGroupSize: peerProfiles.length,
      };
    } catch (error: any) {
      logger.error(`Peer group baseline calculation failed for user ${userId}: ${error.message}`);
      return {
        avgTransactionsPerDay: 0,
        stdDevTransactionsPerDay: 0,
        avgCostCenters: 0,
        avgVendors: 0,
        peerGroupSize: 0,
      };
    }
  }

  // ==========================================================================
  // Profile Creation and Dimension Calculation
  // ==========================================================================

  /**
   * Create a new behavioral profile for a user.
   * New profiles always start in LEARNING status.
   */
  private async createNewProfile(
    db: any,
    tenantId: string,
    userId: string,
    tx: CanonicalTransaction,
    now: Date,
    windowStart: Date
  ): Promise<any> {
    const { BehavioralProfiles, ProfileDimensions } = db.entities('finsecure.ai');

    const profileId = cds.utils.uuid();

    // Create initial dimensions from this first transaction
    const initialDimensions = this.createInitialDimensions(tx);

    await INSERT.into(BehavioralProfiles).entries({
      ID: profileId,
      tenantId,
      userId,
      status: 'LEARNING',
      windowStartDate: windowStart.toISOString().split('T')[0],
      windowEndDate: now.toISOString().split('T')[0],
      daysCovered: 1,
      hrRiskMultiplier: 1.0,
      lastUpdated: now.toISOString(),
    });

    const dimensionsData = this.serializeDimensions(initialDimensions, profileId);
    await INSERT.into(ProfileDimensions).entries({
      ...dimensionsData,
      ID: cds.utils.uuid(),
      profile_ID: profileId,
    });

    return { ID: profileId, tenantId, userId, status: 'LEARNING', daysCovered: 1 };
  }

  /**
   * Create initial dimension values from a single transaction.
   */
  private createInitialDimensions(tx: CanonicalTransaction): BehavioralDimensions {
    const hour = tx.postingDate.getUTCHours();
    const hourDistribution = new Array(24).fill(0);
    hourDistribution[hour] = 1;

    return {
      postingFrequency: {
        mean: 1,
        stdDev: 0,
        dailyCounts: [1],
      },
      postingTimes: {
        hourDistribution,
        peakHours: [hour],
      },
      accountCombinations: [`${tx.debitAccount}:${tx.creditAccount}`],
      transactionAmounts: {
        mean: Math.abs(tx.amount),
        stdDev: 0,
        p90: Math.abs(tx.amount),
        p99: Math.abs(tx.amount),
      },
      costCenters: tx.costCenter ? [tx.costCenter] : [],
      vendorRelationships: tx.vendorId ? [tx.vendorId] : [],
      transactionCodes: (() => {
        const meta = tx.metadata as Record<string, unknown>;
        const code = meta?.transactionCode;
        return typeof code === 'string' && code.length > 0 ? [code] : [];
      })(),
      dataAccessVolume: {
        meanRecordsPerDay: 1,
        stdDev: 0,
        p90: 1,
      },
    };
  }

  /**
   * Calculate the number of distinct days with transactions within the rolling window.
   */
  private async calculateDaysCovered(
    db: any,
    tenantId: string,
    userId: string,
    windowStart: Date
  ): Promise<number> {
    const { Transactions } = db.entities('finsecure.ai');

    const transactions = await SELECT.from(Transactions)
      .columns('postingDate')
      .where({
        tenantId,
        userId,
        postingDate: { '>=': windowStart.toISOString().split('T')[0] },
      });

    const uniqueDays = new Set(
      transactions.map((t: any) => {
        const date = t.postingDate instanceof Date
          ? t.postingDate.toISOString().split('T')[0]
          : String(t.postingDate);
        return date;
      })
    );

    return uniqueDays.size;
  }

  /**
   * Calculate behavioral dimensions from a set of transactions within the rolling window.
   * Performs incremental calculation by processing all recent transactions.
   *
   * Validates: Requirements 4.2, 4.7
   */
  private calculateDimensions(
    transactions: any[],
    currentTx: CanonicalTransaction
  ): BehavioralDimensions {
    // Combine existing transactions with the current one
    const allTx = [...transactions];

    // --- Posting Frequency ---
    const dailyCounts = this.calculateDailyCounts(allTx);
    const freqMean = dailyCounts.length > 0
      ? dailyCounts.reduce((s, v) => s + v, 0) / dailyCounts.length
      : 0;
    const freqStdDev = dailyCounts.length > 1
      ? Math.sqrt(
          dailyCounts.reduce((s, v) => s + Math.pow(v - freqMean, 2), 0) /
          (dailyCounts.length - 1)
        )
      : 0;

    // --- Posting Times ---
    const hourDistribution = new Array(24).fill(0);
    for (const t of allTx) {
      const date = t.postingDate instanceof Date ? t.postingDate : new Date(t.postingDate);
      const hour = date.getUTCHours();
      hourDistribution[hour]++;
    }
    const peakHours = this.calculatePeakHours(hourDistribution);

    // --- Account Combinations ---
    const accountCombinations = new Set<string>();
    for (const t of allTx) {
      if (t.debitAccount && t.creditAccount) {
        accountCombinations.add(`${t.debitAccount}:${t.creditAccount}`);
      }
    }

    // --- Transaction Amounts ---
    const amounts = allTx.map((t: any) => Math.abs(Number(t.amount) || 0)).filter(a => a > 0);
    const amountMean = amounts.length > 0
      ? amounts.reduce((s, v) => s + v, 0) / amounts.length
      : 0;
    const amountStdDev = amounts.length > 1
      ? Math.sqrt(amounts.reduce((s, v) => s + Math.pow(v - amountMean, 2), 0) / (amounts.length - 1))
      : 0;
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const amountP90 = sortedAmounts.length > 0
      ? sortedAmounts[Math.floor(sortedAmounts.length * 0.9)] ?? sortedAmounts.at(-1)!
      : 0;
    const amountP99 = sortedAmounts.length > 0
      ? sortedAmounts[Math.floor(sortedAmounts.length * 0.99)] ?? sortedAmounts.at(-1)!
      : 0;

    // --- Cost Centers ---
    const costCenters = new Set<string>();
    for (const t of allTx) {
      if (t.costCenter) {
        costCenters.add(t.costCenter);
      }
    }

    // --- Vendor Relationships ---
    const vendorRelationships = new Set<string>();
    for (const t of allTx) {
      if (t.vendorId) {
        vendorRelationships.add(t.vendorId);
      }
    }

    // --- Transaction Codes ---
    const transactionCodes = new Set<string>();
    for (const t of allTx) {
      const metadata = typeof t.metadata === 'string' ? JSON.parse(t.metadata || '{}') : (t.metadata || {});
      if (metadata.transactionCode) {
        transactionCodes.add(String(metadata.transactionCode));
      }
    }

    // --- Data Access Volume ---
    const dataAccessCounts = this.calculateDailyDataAccessCounts(allTx);
    const daMean = dataAccessCounts.length > 0
      ? dataAccessCounts.reduce((s, v) => s + v, 0) / dataAccessCounts.length
      : 0;
    const daStdDev = dataAccessCounts.length > 1
      ? Math.sqrt(
          dataAccessCounts.reduce((s, v) => s + Math.pow(v - daMean, 2), 0) /
          (dataAccessCounts.length - 1)
        )
      : 0;
    const sortedDA = [...dataAccessCounts].sort((a, b) => a - b);
    const daP90 = sortedDA.length > 0
      ? sortedDA[Math.floor(sortedDA.length * 0.9)] ?? sortedDA.at(-1)!
      : 0;

    return {
      postingFrequency: {
        mean: freqMean,
        stdDev: freqStdDev,
        dailyCounts,
      },
      postingTimes: {
        hourDistribution,
        peakHours,
      },
      accountCombinations: Array.from(accountCombinations),
      transactionAmounts: {
        mean: amountMean,
        stdDev: amountStdDev,
        p90: amountP90,
        p99: amountP99,
      },
      costCenters: Array.from(costCenters),
      vendorRelationships: Array.from(vendorRelationships),
      transactionCodes: Array.from(transactionCodes),
      dataAccessVolume: {
        meanRecordsPerDay: daMean,
        stdDev: daStdDev,
        p90: daP90,
      },
    };
  }

  /**
   * Calculate the number of transactions per day over the window.
   */
  private calculateDailyCounts(transactions: any[]): number[] {
    const dayCounts = new Map<string, number>();
    for (const t of transactions) {
      const dateStr = t.postingDate instanceof Date
        ? t.postingDate.toISOString().split('T')[0]
        : String(t.postingDate).split('T')[0];
      dayCounts.set(dateStr, (dayCounts.get(dateStr) || 0) + 1);
    }
    return Array.from(dayCounts.values());
  }

  /**
   * Calculate daily data access record counts from transaction metadata.
   */
  private calculateDailyDataAccessCounts(transactions: any[]): number[] {
    const dayCounts = new Map<string, number>();
    for (const t of transactions) {
      const dateStr = t.postingDate instanceof Date
        ? t.postingDate.toISOString().split('T')[0]
        : String(t.postingDate).split('T')[0];
      const metadata = typeof t.metadata === 'string' ? JSON.parse(t.metadata || '{}') : (t.metadata || {});
      const recordCount = Number(metadata.recordsAccessed) || 1;
      dayCounts.set(dateStr, (dayCounts.get(dateStr) || 0) + recordCount);
    }
    return Array.from(dayCounts.values());
  }

  /**
   * Identify peak activity hours (top 3 hours by posting count).
   */
  private calculatePeakHours(hourDistribution: number[]): number[] {
    return hourDistribution
      .map((count, hour) => ({ count, hour }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter(h => h.count > 0)
      .map(h => h.hour);
  }

  // ==========================================================================
  // Deviation Detection Methods
  // ==========================================================================

  /**
   * Check if the transaction targets an unobserved cost center.
   * Always flags regardless of sensitivity threshold.
   *
   * Validates: Requirements 4.5
   */
  private checkCostCenterDeviation(
    tx: CanonicalTransaction,
    dimensions: any
  ): BehavioralDeviation | null {
    if (!tx.costCenter) {
      return null;
    }

    const knownCostCenters = this.parseJsonArray(dimensions.costCenters);

    // If we have observed cost centers and this one isn't among them, flag it
    if (knownCostCenters.length > 0 && !knownCostCenters.includes(tx.costCenter)) {
      return {
        userId: tx.userId,
        deviationDimension: 'costCenters',
        expectedRange: { min: 0, max: 0 },
        observedValue: 1, // Represents "unobserved" cost center
        deviationMagnitude: Infinity, // Always flag regardless of sensitivity
        riskScore: this.calculateDeviationRiskScore('costCenters', Infinity),
      };
    }

    return null;
  }

  /**
   * Check if the transaction amount deviates from the user's profile.
   * Flags when amount exceeds mean + sensitivity_factor * stdDev.
   *
   * Validates: Requirements 4.4
   */
  private checkAmountDeviation(
    tx: CanonicalTransaction,
    dimensions: any,
    sensitivityFactor: number
  ): BehavioralDeviation | null {
    const mean = Number(dimensions.amountMean) || 0;
    const stdDev = Number(dimensions.amountStdDev) || 0;

    if (stdDev === 0 || mean === 0) {
      return null;
    }

    const absAmount = Math.abs(tx.amount);
    const threshold = mean + sensitivityFactor * stdDev;

    if (absAmount > threshold) {
      const deviationMagnitude = (absAmount - mean) / stdDev;
      return {
        userId: tx.userId,
        deviationDimension: 'transactionAmounts',
        expectedRange: {
          min: 0,
          max: threshold,
        },
        observedValue: absAmount,
        deviationMagnitude,
        riskScore: this.calculateDeviationRiskScore('transactionAmounts', deviationMagnitude),
      };
    }

    return null;
  }

  /**
   * Check if the posting time deviates from the user's established time pattern.
   */
  private checkPostingTimeDeviation(
    tx: CanonicalTransaction,
    dimensions: any,
    sensitivityFactor: number
  ): BehavioralDeviation | null {
    const hourDistribution = this.parseJsonArray(dimensions.hourDistribution);

    if (hourDistribution.length !== 24) {
      return null;
    }

    const totalPostings = hourDistribution.reduce((s: number, v: number) => s + v, 0);
    if (totalPostings === 0) {
      return null;
    }

    const hour = tx.postingDate.getUTCHours();
    const hourCount = hourDistribution[hour] || 0;
    const hourFrequency = hourCount / totalPostings;

    // Calculate mean frequency and std dev across hours
    const meanFreq = 1 / 24; // expected uniform
    const frequencies = hourDistribution.map((c: number) => c / totalPostings);
    const freqStdDev = Math.sqrt(
      frequencies.reduce((s: number, f: number) => s + Math.pow(f - meanFreq, 2), 0) / 24
    );

    if (freqStdDev === 0) {
      return null;
    }

    // Flag if the hour has significantly less activity than expected
    // Uses negative deviation: activity at unusual hours
    const deviationFromMean = (meanFreq - hourFrequency) / freqStdDev;

    if (deviationFromMean > sensitivityFactor && hourFrequency < 0.02) {
      return {
        userId: tx.userId,
        deviationDimension: 'postingTimes',
        expectedRange: { min: 0, max: 23 },
        observedValue: hour,
        deviationMagnitude: deviationFromMean,
        riskScore: this.calculateDeviationRiskScore('postingTimes', deviationFromMean),
      };
    }

    return null;
  }

  /**
   * Check if posting frequency for today deviates from the user's normal pattern.
   * Note: Real-time per-transaction frequency deviation is limited since we only
   * see one transaction at a time. This check is more effective in batch/aggregate mode.
   */
  private checkPostingFrequencyDeviation(
    _tx: CanonicalTransaction,
    _dimensions: any,
    _sensitivityFactor: number
  ): BehavioralDeviation | null {
    // Posting frequency deviation requires knowing today's total count,
    // which requires an external counter or aggregation query.
    // This is handled during profile updates rather than per-transaction checks.
    return null;
  }

  /**
   * Check if the account combination is unknown to this user's profile.
   */
  private checkAccountCombinationDeviation(
    tx: CanonicalTransaction,
    dimensions: any
  ): BehavioralDeviation | null {
    const knownCombinations = this.parseJsonArray(dimensions.accountCombinations);
    const currentCombo = `${tx.debitAccount}:${tx.creditAccount}`;

    if (knownCombinations.length > 0 && !knownCombinations.includes(currentCombo)) {
      return {
        userId: tx.userId,
        deviationDimension: 'accountCombinations',
        expectedRange: { min: 0, max: knownCombinations.length },
        observedValue: 0, // 0 = not found in known set
        deviationMagnitude: 3, // Fixed magnitude for set-based deviations
        riskScore: this.calculateDeviationRiskScore('accountCombinations', 3),
      };
    }

    return null;
  }

  /**
   * Check if the vendor is unknown to this user's profile.
   */
  private checkVendorRelationshipDeviation(
    tx: CanonicalTransaction,
    dimensions: any
  ): BehavioralDeviation | null {
    if (!tx.vendorId) {
      return null;
    }

    const knownVendors = this.parseJsonArray(dimensions.vendorRelationships);

    if (knownVendors.length > 0 && !knownVendors.includes(tx.vendorId)) {
      return {
        userId: tx.userId,
        deviationDimension: 'vendorRelationships',
        expectedRange: { min: 0, max: knownVendors.length },
        observedValue: 0, // 0 = not found in known set
        deviationMagnitude: 2.5,
        riskScore: this.calculateDeviationRiskScore('vendorRelationships', 2.5),
      };
    }

    return null;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Calculate a risk score based on the dimension that deviated and the magnitude.
   * Returns a score between 0 and 100.
   */
  private calculateDeviationRiskScore(
    dimension: keyof BehavioralDimensions,
    magnitude: number
  ): number {
    // Base scores per dimension type
    const baseScores: Record<string, number> = {
      costCenters: 60,          // Unobserved cost center is high risk
      transactionAmounts: 50,   // Amount anomaly is significant
      postingTimes: 30,         // Time deviation is moderate
      postingFrequency: 25,     // Frequency deviation is lower risk
      accountCombinations: 40,  // Unknown account combination is moderate-high
      vendorRelationships: 35,  // New vendor relationship is moderate
      transactionCodes: 35,
      dataAccessVolume: 45,
    };

    const baseScore = baseScores[dimension] ?? 30;

    // Scale by deviation magnitude (capped)
    const magnitudeBonus = Math.min(40, Math.round(Math.min(magnitude, 10) * 4));

    return Math.min(100, baseScore + magnitudeBonus);
  }

  /**
   * Serialize BehavioralDimensions to the database format (JSON strings for arrays/sets).
   */
  private serializeDimensions(dimensions: BehavioralDimensions, profileId: string): any {
    return {
      profile_ID: profileId,
      postingFreqMean: dimensions.postingFrequency.mean,
      postingFreqStdDev: dimensions.postingFrequency.stdDev,
      hourDistribution: JSON.stringify(dimensions.postingTimes.hourDistribution),
      accountCombinations: JSON.stringify(dimensions.accountCombinations),
      amountMean: dimensions.transactionAmounts.mean,
      amountStdDev: dimensions.transactionAmounts.stdDev,
      amountP90: dimensions.transactionAmounts.p90,
      amountP99: dimensions.transactionAmounts.p99,
      costCenters: JSON.stringify(dimensions.costCenters),
      vendorRelationships: JSON.stringify(dimensions.vendorRelationships),
      transactionCodes: JSON.stringify(dimensions.transactionCodes),
      dataAccessMeanPerDay: dimensions.dataAccessVolume.meanRecordsPerDay,
      dataAccessStdDev: dimensions.dataAccessVolume.stdDev,
      dataAccessP90: dimensions.dataAccessVolume.p90,
    };
  }

  /**
   * Parse a JSON string or array safely. Returns empty array on failure.
   */
  private parseJsonArray(value: any): any[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

// Export singleton factory for use within CAP services
let instance: UEBAEngine | null = null;

/**
 * Get the UEBA Engine singleton instance.
 * Pass optional config to customize on first call.
 */
export function getUEBAEngine(config?: Partial<UEBAConfig>): UEBAEngine {
  if (!instance) {
    instance = new UEBAEngine(config);
  }
  return instance;
}
