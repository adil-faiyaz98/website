/**
 * Alert interface - generated from risk events for analyst review.
 * Validates: Requirements 3.1, 9.1
 */

import { AlertPriority, AlertStatus, RiskCategory } from './enums';
import { CanonicalTransaction } from './canonical-transaction';
import { AffectedEntity, RiskIndicator } from './risk-event';

/** Alert created from one or more risk events */
export interface Alert {
  /** Unique alert ID */
  alertId: string;
  /** Tenant this alert belongs to */
  tenantId: string;
  /** Priority classification based on risk score and financial exposure */
  priority: AlertPriority;
  /** Current lifecycle status */
  status: AlertStatus;
  /** Primary risk category */
  riskCategory: RiskCategory;
  /** Composite risk score (0-100) */
  riskScore: number;
  /** Estimated financial exposure in base currency */
  financialExposure?: number;
  /** Short summary title */
  title: string;
  /** Detailed description of the alert */
  description: string;
  /** The transaction that triggered the alert */
  triggeringTransaction: CanonicalTransaction;
  /** Risk indicators from the detection engine */
  riskIndicators: RiskIndicator[];
  /** Entities affected by this alert */
  affectedEntities: AffectedEntity[];
  /** Recommended actions for the analyst */
  recommendedActions: string[];
  /** Currently assigned analyst (SAP user ID) */
  assignedAnalyst?: string;
  /** AI-generated summary of the alert */
  aiSummary?: string;
  /** AI-generated triage recommendation */
  aiTriageRecommendation?: string;
  /** AI confidence score for the triage recommendation */
  aiConfidenceScore?: number;
  /** Cluster ID for related alerts */
  clusterId?: string;
  /** When the alert was created */
  createdAt: Date;
  /** When the alert was last updated */
  updatedAt: Date;
  /** SLA deadline for resolution */
  slaDeadline: Date;
  /** When the alert was escalated (if applicable) */
  escalatedAt?: Date;
}
