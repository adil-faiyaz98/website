/**
 * Playbook interfaces - automated response orchestration.
 * Validates: Requirements 3.1
 */

import { PlaybookActionType, PlaybookOnFailure } from './enums';

/** Condition that triggers a playbook */
export interface TriggerCondition {
  /** Field to evaluate */
  field: 'riskCategory' | 'priority' | 'riskScore' | 'entityType';
  /** Comparison operator */
  operator: 'EQUALS' | 'GREATER_THAN' | 'IN';
  /** Value to compare against */
  value: unknown;
}

/** A single step in a playbook execution sequence */
export interface PlaybookStep {
  /** Execution order (1-based) */
  stepOrder: number;
  /** Type of action to execute */
  actionType: PlaybookActionType;
  /** Action-specific parameters */
  parameters: Record<string, unknown>;
  /** Timeout in seconds (default 30) */
  timeout: number;
  /** Strategy when step fails */
  onFailure: PlaybookOnFailure;
}

/** Automated response playbook triggered by alerts */
export interface Playbook {
  /** Unique playbook ID */
  playbookId: string;
  /** Tenant this playbook belongs to */
  tenantId: string;
  /** Human-readable playbook name */
  name: string;
  /** Conditions that trigger this playbook */
  triggerConditions: TriggerCondition[];
  /** Ordered steps to execute (max 20) */
  steps: PlaybookStep[];
  /** Whether high-impact actions require approval */
  requiresApproval: boolean;
  /** Approval timeout in minutes (default 15) */
  approvalTimeout: number;
}
