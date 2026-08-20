/**
 * Compliance control and evidence interfaces.
 * Validates: Requirements 9.1, 9.4
 */

import { ComplianceControlStatus, CompliancePackId, ControlEvidenceResult } from './enums';

/** A compliance control definition for automated evaluation */
export interface ComplianceControl {
  /** Unique control ID */
  controlId: string;
  /** Framework reference (e.g., "SOX-404-3.1", "DORA-Art6-2") */
  frameworkRef: string;
  /** Control name */
  name: string;
  /** Control objective description */
  objective: string;
  /** Automated test procedure */
  testProcedure: string;
  /** Expected result for pass */
  expectedResult: string;
  /** Evaluation interval in hours (1-720) */
  evaluationInterval: number;
  /** Whether the control is active */
  status: ComplianceControlStatus;
  /** Associated compliance pack */
  compliancePack?: CompliancePackId;
}

/** Evidence recorded from a compliance control evaluation */
export interface ControlEvidence {
  /** Unique evidence ID */
  evidenceId: string;
  /** ID of the control evaluated */
  controlId: string;
  /** Tenant this evaluation belongs to */
  tenantId: string;
  /** When the evaluation was performed */
  evaluationTimestamp: Date;
  /** Evaluation result */
  result: ControlEvidenceResult;
  /** Details of the evaluation */
  details: string;
  /** Snapshot of relevant data at evaluation time */
  dataSnapshot?: unknown;
  /** Retention expiry date (minimum 7 years from evaluation) */
  retentionExpiry: Date;
}
