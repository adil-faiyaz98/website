/**
 * Behavioral profile interfaces for UEBA (User Entity Behavior Analytics).
 * Validates: Requirements 3.1
 */

import { BehavioralProfileStatus } from './enums';

/** Statistical dimensions tracked for each user's behavior */
export interface BehavioralDimensions {
  /** Posting frequency statistics */
  postingFrequency: {
    mean: number;
    stdDev: number;
    dailyCounts: number[];
  };
  /** Time-of-day posting patterns */
  postingTimes: {
    /** 24-element array: count per hour */
    hourDistribution: number[];
    /** Peak activity hours */
    peakHours: number[];
  };
  /** Known debit:credit account combination pairs */
  accountCombinations: string[];
  /** Transaction amount statistics */
  transactionAmounts: {
    mean: number;
    stdDev: number;
    p90: number;
    p99: number;
  };
  /** Known cost centers for this user */
  costCenters: string[];
  /** Known vendor relationships */
  vendorRelationships: string[];
  /** Transaction codes used (for privilege escalation detection) */
  transactionCodes: string[];
  /** Data access volume statistics */
  dataAccessVolume: {
    meanRecordsPerDay: number;
    stdDev: number;
    p90: number;
  };
}

/** Behavioral profile maintained per user for anomaly detection */
export interface BehavioralProfile {
  /** Unique profile ID */
  profileId: string;
  /** Tenant this profile belongs to */
  tenantId: string;
  /** SAP user ID */
  userId: string;
  /** Profile status (LEARNING during baseline, ACTIVE when ready) */
  status: BehavioralProfileStatus;
  /** Statistical dimensions of the user's behavior */
  dimensions: BehavioralDimensions;
  /** Number of days of data in the profile */
  daysCovered: number;
  /** When the profile was last updated */
  lastUpdated: Date;
}
