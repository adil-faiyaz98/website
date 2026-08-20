import cds = require('@sap/cds');
import { CanonicalTransaction, RiskEvent, RiskIndicator, AffectedEntity, TenantThresholds } from '../types';
import { DetectionMethod, RiskCategory } from '../types/enums';

// ============================================================================
// Interfaces
// ============================================================================

/** Types of insider threat indicators */
export type InsiderThreatIndicatorType =
  | 'MASS_DATA_EXTRACTION'
  | 'TEMPORAL_ANOMALY'
  | 'SENSITIVE_DATA_ACCESS'
  | 'AUTHORIZATION_DEVIATION'
  | 'SPOOL_FILE_ANOMALY'
  | 'ABNORMAL_TCODE_USAGE';

/** Result of insider threat evaluation for a user */
export interface InsiderThreatAssessment {
  /** User being assessed */
  userId: string;
  /** Computed insider threat score (0-100) */
  insiderThreatScore: number;
  /** Individual indicator results */
  indicators: InsiderThreatIndicator[];
  /** Whether the HR risk multiplier is active */
  hrRiskMultiplierActive: boolean;
  /** Effective multiplier value */
  effectiveHrMultiplier: number;
  /** Generated risk events (if any thresholds breached) */
  riskEvents: RiskEvent[];
}

/** Individual insider threat indicator detail */
export interface InsiderThreatIndicator {
  /** Type of indicator */
  indicatorType: InsiderThreatIndicatorType;
  /** Whether this indicator was triggered */
  triggered: boolean;
  /** Score contribution (0-25 before multiplier) */
  scoreContribution: number;
  /** Description of the finding */
  description: string;
  /** Observed value */
  observedValue: number;
  /** Expected baseline value */
  expectedValue: number;
  /** Deviation magnitude */
  deviationMagnitude: number;
}

/** Configuration for insider threat detection */
export interface InsiderThreatConfig {
  /** Record count limit for mass data detection (default 10000) */
  massDataRecordLimit: number;
  /** Volume limit in MB for mass data detection (default 50) */
  massDataVolumeMB: number;
  /** HR risk multiplier value (default 1.5) */
  hrRiskMultiplier: number;
  /** HR risk elevation period in days (default 30) */
  hrRiskPeriodDays: number;
  /** Spool file access threshold within 1 hour (default 10) */
  spoolFileAccessThreshold: number;
  /** Transaction code deviation factor (default 3x 30-day average) */
  tcodeDeviationFactor: number;
  /** Rolling window in hours for mass data extraction detection */
  massDataWindowHours: number;
  /** Sensitive tables to monitor */
  sensitiveTables: string[];
}

/** Data access event tracked for mass extraction detection */
export interface DataAccessEvent {
  /** User who accessed data */
  userId: string;
  /** Timestamp of access */
  timestamp: Date;
  /** Number of records accessed */
  recordCount: number;
  /** Volume in bytes */
  volumeBytes: number;
  /** Table accessed */
  tableName?: string;
  /** Transaction code used */
  transactionCode?: string;
  /** Whether spool was generated */
  spoolGenerated?: boolean;
}

/** Spool file access event */
export interface SpoolAccessEvent {
  /** User accessing the spool */
  userId: string;
  /** Timestamp of access */
  timestamp: Date;
  /** Owner of the spool file */
  spoolOwner: string;
  /** Spool ID */
  spoolId: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default insider threat detection configuration */
const DEFAULT_CONFIG: InsiderThreatConfig = {
  massDataRecordLimit: 10000,
  massDataVolumeMB: 50,
  hrRiskMultiplier: 1.5,
  hrRiskPeriodDays: 30,
  spoolFileAccessThreshold: 10,
  tcodeDeviationFactor: 3,
  massDataWindowHours: 1,
  sensitiveTables: ['PA0008', 'BSEG', 'LFA1', 'KNA1', 'BKPF'],
};

/** Weights for each insider threat dimension (sum = 100) */
const DIMENSION_WEIGHTS = {
  dataAccessAnomaly: 30,
  temporalAnomaly: 20,
  sensitiveDataAccess: 25,
  authorizationDeviation: 25,
};

/** Critical transaction codes that require elevated monitoring */
const CRITICAL_TCODES = [
  'SU01', 'PFCG', 'SE38', 'SM49', 'SM69', 'SE16', 'SE16N',
  'SA38', 'SE80', 'ST01', 'SM37', 'SP01', 'SP02', 'STMS',
];

// ============================================================================
// Insider Threat Detection Module
// ============================================================================

/**
 * Insider Threat Detection module.
 *
 * Provides advanced detection of insider threat indicators including:
 * - Mass data extraction (records or volume exceeding thresholds in 1 hour)
 * - Temporal anomalies (off-hours sensitive access)
 * - Sensitive data access patterns
 * - Authorization usage deviations (abnormal transaction code usage)
 * - Spool file access anomalies
 * - HR risk correlation multiplier
 *
 * Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8
 */
export class InsiderThreatDetector {
  private readonly config: InsiderThreatConfig;

  constructor(config?: Partial<InsiderThreatConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Calculate insider threat score from weighted combination of dimensions.
   * Combines data access anomalies, temporal anomalies, sensitive data access,
   * and authorization usage deviations.
   *
   * Score breakdown (before HR multiplier):
   * - Data access anomaly: 0-30 points
   * - Temporal anomaly: 0-20 points
   * - Sensitive data access: 0-25 points
   * - Authorization deviation: 0-25 points
   *
   * HR risk multiplier is applied when active (default 1.5x for 30 days).
   * Final score is clamped to [0, 100].
   *
   * Validates: Requirements 20.1, 20.4, 20.5, 20.8
   */
  calculateInsiderThreatScore(
    dataAccessAnomalyScore: number,
    temporalAnomalyScore: number,
    sensitiveDataAccessScore: number,
    authorizationDeviationScore: number,
    hrMultiplier: number = 1.0
  ): number {
    // Normalize each component to its weight (each input is 0-100 scale)
    const weightedDataAccess =
      (Math.min(100, Math.max(0, dataAccessAnomalyScore)) / 100) * DIMENSION_WEIGHTS.dataAccessAnomaly;
    const weightedTemporal =
      (Math.min(100, Math.max(0, temporalAnomalyScore)) / 100) * DIMENSION_WEIGHTS.temporalAnomaly;
    const weightedSensitive =
      (Math.min(100, Math.max(0, sensitiveDataAccessScore)) / 100) * DIMENSION_WEIGHTS.sensitiveDataAccess;
    const weightedAuth =
      (Math.min(100, Math.max(0, authorizationDeviationScore)) / 100) * DIMENSION_WEIGHTS.authorizationDeviation;

    const baseScore = weightedDataAccess + weightedTemporal + weightedSensitive + weightedAuth;

    // Apply HR risk multiplier (clamped to valid range)
    const effectiveMultiplier = Math.max(1.0, hrMultiplier);
    const finalScore = Math.min(100, Math.round(baseScore * effectiveMultiplier));

    return Math.max(0, finalScore);
  }

  /**
   * Detect mass data extraction attempts.
   * Triggers when a user accesses more than configurable records or volume in 1 hour.
   *
   * Validates: Requirements 20.2
   *
   * @param accessEvents - Data access events within the rolling 1-hour window
   * @param thresholds - Tenant-configured thresholds (massDataRecordLimit, massDataVolumeMB)
   * @returns Detection result with indicator details
   */
  detectMassDataExtraction(
    accessEvents: DataAccessEvent[],
    thresholds?: Partial<Pick<TenantThresholds, 'massDataRecordLimit' | 'massDataVolumeLimit'>>
  ): InsiderThreatIndicator {
    const recordLimit = thresholds?.massDataRecordLimit ?? this.config.massDataRecordLimit;
    const volumeLimitBytes = (thresholds?.massDataVolumeLimit ?? this.config.massDataVolumeMB) * 1024 * 1024;

    // Filter events within 1-hour window from the most recent event
    const windowEvents = this.filterEventsInWindow(accessEvents, this.config.massDataWindowHours);

    // Aggregate totals within the window
    const totalRecords = windowEvents.reduce((sum, evt) => sum + evt.recordCount, 0);
    const totalVolume = windowEvents.reduce((sum, evt) => sum + evt.volumeBytes, 0);

    const recordsExceeded = totalRecords > recordLimit;
    const volumeExceeded = totalVolume > volumeLimitBytes;
    const triggered = recordsExceeded || volumeExceeded;

    // Calculate score contribution (0-100 scale input for weighting)
    let scoreContribution = 0;
    if (triggered) {
      if (recordsExceeded) {
        scoreContribution = Math.min(100, Math.round((totalRecords / recordLimit) * 50));
      }
      if (volumeExceeded) {
        const volumeScore = Math.min(100, Math.round((totalVolume / volumeLimitBytes) * 50));
        scoreContribution = Math.max(scoreContribution, volumeScore);
      }
    }

    const description = triggered
      ? `Mass data extraction detected: ${totalRecords} records (limit: ${recordLimit}), ` +
        `${(totalVolume / (1024 * 1024)).toFixed(2)} MB (limit: ${this.config.massDataVolumeMB} MB) in 1 hour`
      : 'No mass data extraction detected';

    return {
      indicatorType: 'MASS_DATA_EXTRACTION',
      triggered,
      scoreContribution,
      description,
      observedValue: recordsExceeded ? totalRecords : totalVolume,
      expectedValue: recordsExceeded ? recordLimit : volumeLimitBytes,
      deviationMagnitude: recordsExceeded
        ? totalRecords / recordLimit
        : totalVolume / volumeLimitBytes,
    };
  }

  /**
   * Detect temporal anomalies - access outside normal working hours combined
   * with volume exceeding the user's 90th percentile historical pattern.
   *
   * Validates: Requirements 20.4
   *
   * @param accessHour - Hour of the day (0-23) when access occurred
   * @param peakHours - User's established peak activity hours from profile
   * @param businessHoursStart - Tenant-configured business hours start
   * @param businessHoursEnd - Tenant-configured business hours end
   * @param currentVolume - Current access volume (records)
   * @param p90Volume - User's 90th percentile historical access volume
   */
  detectTemporalAnomaly(
    accessHour: number,
    peakHours: number[],
    businessHoursStart: number,
    businessHoursEnd: number,
    currentVolume: number,
    p90Volume: number
  ): InsiderThreatIndicator {
    const isOutsideBusinessHours = accessHour < businessHoursStart || accessHour >= businessHoursEnd;
    const isOutsidePeakHours = peakHours.length > 0 && !peakHours.includes(accessHour);
    const volumeExceedsP90 = p90Volume > 0 && currentVolume > p90Volume;

    // Temporal anomaly triggers when access is outside normal hours AND volume exceeds P90
    const triggered = (isOutsideBusinessHours || isOutsidePeakHours) && volumeExceedsP90;

    let scoreContribution = 0;
    if (triggered) {
      // Higher score for off-business-hours vs just off-peak
      const timeWeight = isOutsideBusinessHours ? 60 : 30;
      const volumeDeviation = p90Volume > 0 ? (currentVolume / p90Volume) : 1;
      scoreContribution = Math.min(100, Math.round(timeWeight + volumeDeviation * 20));
    }

    const description = triggered
      ? `Sensitive access at hour ${accessHour} (outside ${isOutsideBusinessHours ? 'business' : 'peak'} hours) ` +
        `with volume ${currentVolume} exceeding P90 baseline ${p90Volume}`
      : 'No temporal anomaly detected';

    return {
      indicatorType: 'TEMPORAL_ANOMALY',
      triggered,
      scoreContribution,
      description,
      observedValue: currentVolume,
      expectedValue: p90Volume,
      deviationMagnitude: p90Volume > 0 ? currentVolume / p90Volume : 0,
    };
  }

  /**
   * Detect abnormal sensitive data access patterns.
   * Monitors access to sensitive tables (PA0008, BSEG, LFA1, KNA1, BKPF, etc.)
   *
   * Validates: Requirements 20.3
   *
   * @param accessedTables - Tables accessed by the user in the evaluation window
   * @param historicalSensitiveAccess - Historical frequency of sensitive table access per day
   * @param currentDayCount - Number of sensitive table accesses today
   */
  detectSensitiveDataAccess(
    accessedTables: string[],
    historicalSensitiveAccess: { mean: number; stdDev: number },
    currentDayCount: number
  ): InsiderThreatIndicator {
    const sensitiveTables = this.config.sensitiveTables;
    const sensitiveAccess = accessedTables.filter(t =>
      sensitiveTables.includes(t.toUpperCase())
    );

    const hasSensitiveAccess = sensitiveAccess.length > 0;
    const { mean, stdDev } = historicalSensitiveAccess;

    // Trigger if accessing sensitive tables significantly beyond baseline
    let triggered = false;
    let deviationMagnitude = 0;

    if (hasSensitiveAccess && mean > 0 && stdDev > 0) {
      deviationMagnitude = (currentDayCount - mean) / stdDev;
      triggered = deviationMagnitude > 2; // More than 2 std deviations above mean
    } else if (hasSensitiveAccess && mean === 0) {
      // User has no historical sensitive access — any access is significant
      triggered = true;
      deviationMagnitude = currentDayCount > 0 ? 5 : 0; // High deviation for no baseline
    }

    let scoreContribution = 0;
    if (triggered) {
      scoreContribution = Math.min(100, Math.round(30 + deviationMagnitude * 15));
    }

    const description = triggered
      ? `Abnormal sensitive data access: ${sensitiveAccess.join(', ')} — ` +
        `${currentDayCount} accesses today (baseline mean: ${mean.toFixed(1)}, deviation: ${deviationMagnitude.toFixed(1)} σ)`
      : 'Sensitive data access within normal range';

    return {
      indicatorType: 'SENSITIVE_DATA_ACCESS',
      triggered,
      scoreContribution,
      description,
      observedValue: currentDayCount,
      expectedValue: mean,
      deviationMagnitude,
    };
  }

  /**
   * Detect abnormal transaction code usage.
   * Triggers when a user who normally executes fewer than 10 distinct transaction codes
   * per day executes more than 3x their 30-day average distinct count in a single day.
   *
   * Also flags usage of critical transaction codes by users without historical profile
   * for those codes.
   *
   * Validates: Requirements 20.5
   *
   * @param currentDayDistinctCodes - Number of distinct transaction codes used today
   * @param thirtyDayAverage - Average distinct transaction codes per day over 30 days
   * @param usedCodes - Transaction codes used today
   * @param historicalCodes - Transaction codes in user's historical profile
   */
  detectAbnormalTransactionCodeUsage(
    currentDayDistinctCodes: number,
    thirtyDayAverage: number,
    usedCodes: string[],
    historicalCodes: string[]
  ): InsiderThreatIndicator {
    const deviationFactor = this.config.tcodeDeviationFactor;

    // Check if user normally uses fewer than 10 distinct codes per day
    const isLowActivityUser = thirtyDayAverage < 10;

    // Check for volume deviation: > 3x average distinct codes in a single day
    const volumeDeviation = thirtyDayAverage > 0
      ? currentDayDistinctCodes / thirtyDayAverage
      : (currentDayDistinctCodes > 0 ? Infinity : 0);
    const volumeTriggered = isLowActivityUser && volumeDeviation > deviationFactor;

    // Check for critical transaction codes used without historical profile
    const criticalCodesUsed = usedCodes.filter(code =>
      CRITICAL_TCODES.includes(code.toUpperCase())
    );
    const newCriticalCodes = criticalCodesUsed.filter(code =>
      !historicalCodes.includes(code)
    );
    const criticalTriggered = newCriticalCodes.length > 0;

    const triggered = volumeTriggered || criticalTriggered;

    let scoreContribution = 0;
    if (volumeTriggered) {
      scoreContribution = Math.min(100, Math.round(40 + volumeDeviation * 10));
    }
    if (criticalTriggered) {
      scoreContribution = Math.max(scoreContribution, Math.min(100, 60 + newCriticalCodes.length * 15));
    }

    const description = triggered
      ? volumeTriggered && criticalTriggered
        ? `Abnormal transaction code usage: ${currentDayDistinctCodes} distinct codes ` +
          `(${deviationFactor}x threshold: ${Math.round(thirtyDayAverage * deviationFactor)}), ` +
          `critical codes without profile: ${newCriticalCodes.join(', ')}`
        : volumeTriggered
          ? `Abnormal transaction code usage: ${currentDayDistinctCodes} distinct codes ` +
            `(${deviationFactor}x threshold: ${Math.round(thirtyDayAverage * deviationFactor)})`
          : `Critical transaction codes used without historical profile: ${newCriticalCodes.join(', ')}`
      : 'Transaction code usage within normal range';

    return {
      indicatorType: 'ABNORMAL_TCODE_USAGE',
      triggered,
      scoreContribution,
      description,
      observedValue: currentDayDistinctCodes,
      expectedValue: thirtyDayAverage * deviationFactor,
      deviationMagnitude: volumeDeviation === Infinity ? 10 : volumeDeviation,
    };
  }

  /**
   * Detect spool file access anomalies.
   * Triggers when:
   * - A user accesses spool files belonging to other users
   * - A user accesses more than 10 spool files within a 1-hour window
   *
   * Validates: Requirements 20.7
   *
   * @param spoolEvents - Spool access events within the evaluation window
   * @param userId - User being evaluated
   */
  detectSpoolFileAnomalies(
    spoolEvents: SpoolAccessEvent[],
    userId: string
  ): InsiderThreatIndicator {
    // Filter events within 1-hour window
    const windowEvents = this.filterSpoolEventsInWindow(spoolEvents, 1);

    // Check for accessing other users' spool files
    const foreignSpoolAccess = windowEvents.filter(evt =>
      evt.spoolOwner !== userId
    );

    // Check for excessive spool access count
    const totalSpoolAccess = windowEvents.length;
    const excessiveAccess = totalSpoolAccess > this.config.spoolFileAccessThreshold;

    const triggered = foreignSpoolAccess.length > 0 || excessiveAccess;

    let scoreContribution = 0;
    if (foreignSpoolAccess.length > 0) {
      scoreContribution = Math.min(100, 50 + foreignSpoolAccess.length * 10);
    }
    if (excessiveAccess) {
      const excessScore = Math.min(100, Math.round(
        (totalSpoolAccess / this.config.spoolFileAccessThreshold) * 40
      ));
      scoreContribution = Math.max(scoreContribution, excessScore);
    }

    const description = triggered
      ? foreignSpoolAccess.length > 0
        ? `Spool file anomaly: accessed ${foreignSpoolAccess.length} spool file(s) ` +
          `belonging to other users within 1 hour`
        : `Spool file anomaly: accessed ${totalSpoolAccess} spool files within 1 hour ` +
          `(threshold: ${this.config.spoolFileAccessThreshold})`
      : 'No spool file anomalies detected';

    return {
      indicatorType: 'SPOOL_FILE_ANOMALY',
      triggered,
      scoreContribution,
      description,
      observedValue: foreignSpoolAccess.length > 0 ? foreignSpoolAccess.length : totalSpoolAccess,
      expectedValue: foreignSpoolAccess.length > 0 ? 0 : this.config.spoolFileAccessThreshold,
      deviationMagnitude: foreignSpoolAccess.length > 0
        ? foreignSpoolAccess.length
        : totalSpoolAccess / this.config.spoolFileAccessThreshold,
    };
  }

  /**
   * Get the effective HR risk multiplier for a user.
   * Returns the multiplier if the HR risk period is still active, otherwise 1.0.
   *
   * Only stores risk classification and monitoring period — NOT HR event details (privacy).
   *
   * Validates: Requirements 20.6
   *
   * @param hrRiskMultiplier - Configured multiplier from the behavioral profile
   * @param hrRiskExpiresAt - Expiration timestamp for the HR risk elevation
   */
  getEffectiveHRMultiplier(
    hrRiskMultiplier: number,
    hrRiskExpiresAt: Date | null
  ): number {
    if (!hrRiskExpiresAt) {
      return 1.0;
    }
    const now = new Date();
    if (hrRiskExpiresAt > now) {
      return Math.max(1.0, hrRiskMultiplier);
    }
    return 1.0;
  }

  /**
   * Perform a full insider threat assessment for a user.
   * Combines all detection dimensions and applies the HR multiplier.
   *
   * Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8
   */
  async assessUser(
    tenantId: string,
    userId: string,
    dataAccessEvents: DataAccessEvent[],
    spoolEvents: SpoolAccessEvent[],
    currentHour: number,
    thresholds: Partial<TenantThresholds>
  ): Promise<InsiderThreatAssessment> {
    const logger = cds.log('insider-threat');
    logger.info(`Assessing insider threat for user ${userId} in tenant ${tenantId}`);

    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles, ProfileDimensions } = db.entities('finsecure.ai');

      // Load user's behavioral profile
      const profile = await SELECT.one.from(BehavioralProfiles).where({ tenantId, userId });

      if (!profile || profile.status === 'LEARNING') {
        return {
          userId,
          insiderThreatScore: 0,
          indicators: [],
          hrRiskMultiplierActive: false,
          effectiveHrMultiplier: 1.0,
          riskEvents: [],
        };
      }

      const dimensions = await SELECT.one.from(ProfileDimensions).where({
        profile_ID: profile.ID,
      });

      // Get HR risk multiplier
      const hrMultiplier = this.getEffectiveHRMultiplier(
        Number(profile.hrRiskMultiplier) || 1.0,
        profile.hrRiskExpiresAt ? new Date(profile.hrRiskExpiresAt) : null
      );
      const hrRiskMultiplierActive = hrMultiplier > 1.0;

      // Evaluate each dimension
      const indicators: InsiderThreatIndicator[] = [];

      // 1. Mass data extraction
      const massDataIndicator = this.detectMassDataExtraction(dataAccessEvents, {
        massDataRecordLimit: thresholds.massDataRecordLimit ?? this.config.massDataRecordLimit,
        massDataVolumeLimit: thresholds.massDataVolumeLimit ?? this.config.massDataVolumeMB,
      });
      indicators.push(massDataIndicator);

      // 2. Temporal anomaly
      const peakHours = dimensions
        ? this.parseJsonArray(dimensions.hourDistribution)
            .map((count: number, hour: number) => ({ count, hour }))
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, 3)
            .filter((h: any) => h.count > 0)
            .map((h: any) => h.hour)
        : [];
      const currentVolume = dataAccessEvents.reduce((sum, evt) => sum + evt.recordCount, 0);
      const p90Volume = dimensions ? Number(dimensions.dataAccessP90) || 0 : 0;

      const temporalIndicator = this.detectTemporalAnomaly(
        currentHour,
        peakHours,
        thresholds.businessHoursStart ?? 8,
        thresholds.businessHoursEnd ?? 18,
        currentVolume,
        p90Volume
      );
      indicators.push(temporalIndicator);

      // 3. Sensitive data access
      const accessedTables = dataAccessEvents
        .map(evt => evt.tableName)
        .filter((t): t is string => t !== undefined);
      const sensitiveBaseline = dimensions
        ? { mean: Number(dimensions.dataAccessMeanPerDay) || 0, stdDev: Number(dimensions.dataAccessStdDev) || 0 }
        : { mean: 0, stdDev: 0 };
      const sensitiveAccessCount = accessedTables.filter(t =>
        this.config.sensitiveTables.includes(t.toUpperCase())
      ).length;

      const sensitiveIndicator = this.detectSensitiveDataAccess(
        accessedTables,
        sensitiveBaseline,
        sensitiveAccessCount
      );
      indicators.push(sensitiveIndicator);

      // 4. Authorization deviation (transaction code usage)
      const usedCodes = dataAccessEvents
        .map(evt => evt.transactionCode)
        .filter((t): t is string => t !== undefined);
      const distinctCodes = [...new Set(usedCodes)];
      const historicalCodes = dimensions
        ? this.parseJsonArray(dimensions.transactionCodes)
        : [];
      const avgDailyCodes = dimensions
        ? Number(dimensions.postingFreqMean) || 0
        : 0;

      const authIndicator = this.detectAbnormalTransactionCodeUsage(
        distinctCodes.length,
        avgDailyCodes,
        distinctCodes,
        historicalCodes
      );
      indicators.push(authIndicator);

      // 5. Spool file anomalies
      const spoolIndicator = this.detectSpoolFileAnomalies(spoolEvents, userId);
      indicators.push(spoolIndicator);

      // Calculate composite insider threat score
      const insiderThreatScore = this.calculateInsiderThreatScore(
        massDataIndicator.scoreContribution,
        temporalIndicator.scoreContribution,
        sensitiveIndicator.scoreContribution,
        authIndicator.scoreContribution,
        hrMultiplier
      );

      // Generate risk events for triggered indicators
      const riskEvents: RiskEvent[] = [];

      if (insiderThreatScore >= (thresholds.riskScoreAlertThreshold ?? 70)) {
        riskEvents.push(this.createRiskEvent(tenantId, userId, insiderThreatScore, indicators));
      }

      // Special high-priority alert for mass data extraction
      if (massDataIndicator.triggered) {
        riskEvents.push(this.createMassDataExtractionRiskEvent(tenantId, userId, massDataIndicator));
      }

      // Alert for spool anomalies
      if (spoolIndicator.triggered) {
        riskEvents.push(this.createSpoolAnomalyRiskEvent(tenantId, userId, spoolIndicator));
      }

      return {
        userId,
        insiderThreatScore,
        indicators,
        hrRiskMultiplierActive,
        effectiveHrMultiplier: hrMultiplier,
        riskEvents,
      };
    } catch (error: any) {
      logger.error(`Insider threat assessment failed for user ${userId}: ${error.message}`);
      return {
        userId,
        insiderThreatScore: 0,
        indicators: [],
        hrRiskMultiplierActive: false,
        effectiveHrMultiplier: 1.0,
        riskEvents: [],
      };
    }
  }

  /**
   * Apply HR risk multiplier elevation for a user.
   * Stores only risk classification and monitoring period — NOT HR event details (privacy).
   *
   * Validates: Requirements 20.6, 27.2, 27.7
   *
   * @param tenantId - Tenant context
   * @param userId - User to elevate monitoring for
   * @param multiplier - Risk multiplier to apply (default from config)
   * @param periodDays - Duration in days (default from config)
   */
  async applyHRRiskElevation(
    tenantId: string,
    userId: string,
    multiplier?: number,
    periodDays?: number
  ): Promise<void> {
    const logger = cds.log('insider-threat');
    const effectiveMultiplier = multiplier ?? this.config.hrRiskMultiplier;
    const effectivePeriod = periodDays ?? this.config.hrRiskPeriodDays;

    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles } = db.entities('finsecure.ai');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + effectivePeriod);

      // Store ONLY risk classification (multiplier) and monitoring period (expiry).
      // Never store HR event details (termination reason, PIP, etc.) for privacy.
      await UPDATE(BehavioralProfiles)
        .set({
          hrRiskMultiplier: effectiveMultiplier,
          hrRiskExpiresAt: expiresAt.toISOString(),
        })
        .where({ tenantId, userId });

      logger.info(
        `HR risk elevation applied for user ${userId}: ` +
        `multiplier=${effectiveMultiplier}, expires=${expiresAt.toISOString()}`
      );
    } catch (error: any) {
      logger.error(`Failed to apply HR risk elevation for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Filter data access events within the specified rolling window (hours).
   */
  private filterEventsInWindow(events: DataAccessEvent[], windowHours: number): DataAccessEvent[] {
    if (events.length === 0) return [];

    // Find the most recent event timestamp
    const latestTime = Math.max(...events.map(e => e.timestamp.getTime()));
    const windowStart = latestTime - windowHours * 60 * 60 * 1000;

    return events.filter(e => e.timestamp.getTime() >= windowStart);
  }

  /**
   * Filter spool access events within the specified window (hours).
   */
  private filterSpoolEventsInWindow(events: SpoolAccessEvent[], windowHours: number): SpoolAccessEvent[] {
    if (events.length === 0) return [];

    const latestTime = Math.max(...events.map(e => e.timestamp.getTime()));
    const windowStart = latestTime - windowHours * 60 * 60 * 1000;

    return events.filter(e => e.timestamp.getTime() >= windowStart);
  }

  /**
   * Create a general insider threat risk event.
   */
  private createRiskEvent(
    tenantId: string,
    userId: string,
    score: number,
    indicators: InsiderThreatIndicator[]
  ): RiskEvent {
    const triggeredIndicators = indicators.filter(i => i.triggered);

    const riskIndicators: RiskIndicator[] = triggeredIndicators.map(ind => ({
      indicatorType: ind.indicatorType,
      description: ind.description,
      observedValue: ind.observedValue,
      expectedRange: { min: 0, max: ind.expectedValue },
      weight: ind.scoreContribution / 100,
    }));

    const affectedEntities: AffectedEntity[] = [{
      entityType: 'USER',
      entityId: userId,
      entityName: userId,
    }];

    return {
      riskEventId: cds.utils.uuid(),
      tenantId,
      transactionId: '',
      riskCategory: 'INSIDER_THREAT' as RiskCategory,
      riskScore: score,
      confidence: Math.min(100, Math.round(score * 0.9)),
      detectionMethod: 'BEHAVIORAL_DEVIATION' as DetectionMethod,
      riskIndicators,
      affectedEntities,
      detectedAt: new Date(),
    };
  }

  /**
   * Create a specific mass data extraction risk event (high priority).
   */
  private createMassDataExtractionRiskEvent(
    tenantId: string,
    userId: string,
    indicator: InsiderThreatIndicator
  ): RiskEvent {
    return {
      riskEventId: cds.utils.uuid(),
      tenantId,
      transactionId: '',
      riskCategory: 'INSIDER_THREAT' as RiskCategory,
      riskScore: Math.min(100, Math.max(75, indicator.scoreContribution)),
      confidence: 85,
      detectionMethod: 'THRESHOLD_BREACH' as DetectionMethod,
      riskIndicators: [{
        indicatorType: 'MASS_DATA_EXTRACTION',
        description: indicator.description,
        observedValue: indicator.observedValue,
        expectedRange: { min: 0, max: indicator.expectedValue },
        weight: 1.0,
      }],
      affectedEntities: [{
        entityType: 'USER',
        entityId: userId,
        entityName: userId,
      }],
      detectedAt: new Date(),
    };
  }

  /**
   * Create a spool anomaly risk event.
   */
  private createSpoolAnomalyRiskEvent(
    tenantId: string,
    userId: string,
    indicator: InsiderThreatIndicator
  ): RiskEvent {
    return {
      riskEventId: cds.utils.uuid(),
      tenantId,
      transactionId: '',
      riskCategory: 'INSIDER_THREAT' as RiskCategory,
      riskScore: Math.min(100, Math.max(60, indicator.scoreContribution)),
      confidence: 80,
      detectionMethod: 'PATTERN_MATCHING' as DetectionMethod,
      riskIndicators: [{
        indicatorType: 'SPOOL_FILE_ANOMALY',
        description: indicator.description,
        observedValue: indicator.observedValue,
        expectedRange: { min: 0, max: indicator.expectedValue },
        weight: 1.0,
      }],
      affectedEntities: [{
        entityType: 'USER',
        entityId: userId,
        entityName: userId,
      }],
      detectedAt: new Date(),
    };
  }

  /**
   * Parse a JSON string or array safely.
   */
  private parseJsonArray(value: any): any[] {
    if (Array.isArray(value)) return value;
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

// Export singleton factory
let instance: InsiderThreatDetector | null = null;

/**
 * Get the Insider Threat Detector singleton instance.
 */
export function getInsiderThreatDetector(config?: Partial<InsiderThreatConfig>): InsiderThreatDetector {
  if (!instance) {
    instance = new InsiderThreatDetector(config);
  }
  return instance;
}
