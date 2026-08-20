/**
 * ML Model interfaces for AI Core integration.
 * Validates: Requirements 3.1
 */

import { MLModelStatus, MLModelType } from './enums';

/** Performance metrics for a trained ML model */
export interface MLModelMetrics {
  /** Precision score (0-1) */
  precision: number;
  /** Recall score (0-1) */
  recall: number;
  /** F1 score (0-1) */
  f1Score: number;
  /** False positive rate (0-1) */
  falsePositiveRate: number;
}

/** A tenant-specific ML model managed through AI Core */
export interface MLModel {
  /** Unique model ID */
  modelId: string;
  /** Tenant this model belongs to */
  tenantId: string;
  /** Type of model (anomaly, fraud, behavioral) */
  modelType: MLModelType;
  /** Model version number */
  version: number;
  /** Current lifecycle status */
  status: MLModelStatus;
  /** Performance metrics from validation */
  metrics: MLModelMetrics;
  /** When the model was trained */
  trainedAt: Date;
  /** When the model was promoted to production */
  promotedAt?: Date;
  /** Number of days of training data */
  trainingDataDays?: number;
  /** Number of transactions used for training */
  trainingTransactionCount?: number;
  /** AI Core deployment ID */
  aiCoreDeploymentId?: string;
}
