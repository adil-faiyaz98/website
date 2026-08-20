/**
 * Risk event interfaces - output of the detection engine.
 * Validates: Requirements 3.1
 */

import { DetectionMethod, RiskCategory } from './enums';

/** A single risk indicator contributing to the overall risk score */
export interface RiskIndicator {
  /** Type of indicator (e.g., 'amount_anomaly', 'time_deviation') */
  indicatorType: string;
  /** Human-readable description of the indicator */
  description: string;
  /** The value observed in the transaction */
  observedValue: unknown;
  /** Expected range for this indicator */
  expectedRange?: { min: unknown; max: unknown };
  /** Weight of this indicator in the overall score (0-1) */
  weight: number;
}

/** An entity affected by the risk event */
export interface AffectedEntity {
  /** Type of entity (user, vendor, account, etc.) */
  entityType: string;
  /** Identifier of the entity */
  entityId: string;
  /** Human-readable name */
  entityName?: string;
}

/** Risk event generated when detection engine identifies a threat */
export interface RiskEvent {
  /** Unique risk event ID */
  riskEventId: string;
  /** Tenant this risk event belongs to */
  tenantId: string;
  /** ID of the transaction that triggered this risk event */
  transactionId: string;
  /** Category of risk detected */
  riskCategory: RiskCategory;
  /** Risk score from 0-100 */
  riskScore: number;
  /** ML model confidence from 0-100 */
  confidence: number;
  /** Method used to detect this risk */
  detectionMethod: DetectionMethod;
  /** Individual risk indicators contributing to the score */
  riskIndicators: RiskIndicator[];
  /** Entities affected by this risk */
  affectedEntities: AffectedEntity[];
  /** Estimated financial exposure in base currency */
  financialExposure?: number;
  /** When the risk was detected */
  detectedAt: Date;
}
