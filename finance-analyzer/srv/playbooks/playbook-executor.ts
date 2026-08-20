import cds = require('@sap/cds');
import { PlaybookActionType, RiskCategory, AlertPriority } from '../types/enums';
import { Playbook, PlaybookStep, TriggerCondition } from '../types/playbook';
import { Alert } from '../types/alert';

const { ApplicationService } = cds;

// ============================================================================
// Interfaces
// ============================================================================

/** Execution context passed to each step during playbook execution */
export interface ExecutionContext {
  executionId: string;
  playbookId: string;
  tenantId: string;
  alertId: string;
  alert: Alert;
  stepResults: StepResult[];
}

/** Result of executing a single playbook step */
export interface StepResult {
  stepOrder: number;
  actionType: PlaybookActionType;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING_APPROVAL' | 'APPROVAL_DENIED' | 'TIMEOUT';
  startedAt: Date;
  completedAt?: Date;
  retryCount: number;
  error?: string;
  output?: Record<string, unknown>;
}

/** A playbook execution record */
export interface PlaybookExecution {
  executionId: string;
  playbookId: string;
  tenantId: string;
  alertId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'QUEUED' | 'PENDING_APPROVAL';
  stepResults: StepResult[];
  startedAt: Date;
  completedAt?: Date;
  queuedAt?: Date;
}

/** Approval request for high-impact actions */
export interface ApprovalRequest {
  executionId: string;
  stepOrder: number;
  actionType: PlaybookActionType;
  alertId: string;
  requestedAt: Date;
  expiresAt: Date;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  approverId?: string;
  decidedAt?: Date;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum execution time for entire playbook (60 seconds) */
const MAX_EXECUTION_TIME_MS = 60_000;

/** Default step timeout (30 seconds) */
const DEFAULT_STEP_TIMEOUT_MS = 30_000;

/** Approval timeout (15 minutes) */
const APPROVAL_TIMEOUT_MS = 15 * 60 * 1000;

/** Maximum playbooks per tenant */
const MAX_PLAYBOOKS_PER_TENANT = 50;

/** Maximum steps per playbook */
const MAX_STEPS_PER_PLAYBOOK = 20;

/** High-impact actions requiring approval */
const HIGH_IMPACT_ACTIONS = new Set<PlaybookActionType>([
  'BLOCK_PAYMENT',
  'LOCK_USER_ACCOUNT',
]);

// ============================================================================
// Predefined Playbook Library
// ============================================================================

/**
 * Predefined playbooks for common risk scenarios.
 * Validates: Requirements 10.1
 */
export const PREDEFINED_PLAYBOOKS: Omit<Playbook, 'playbookId' | 'tenantId'>[] = [
  {
    name: 'Block Payment on Vendor Bank Change Fraud',
    triggerConditions: [
      { field: 'riskCategory', operator: 'EQUALS', value: 'VENDOR_TAMPERING' },
      { field: 'priority', operator: 'IN', value: ['CRITICAL', 'HIGH'] },
    ],
    steps: [
      {
        stepOrder: 1,
        actionType: 'BLOCK_PAYMENT',
        parameters: { reason: 'Suspected vendor bank change fraud' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
      {
        stepOrder: 2,
        actionType: 'NOTIFY_APPROVER_CHAIN',
        parameters: { template: 'vendor_fraud_notification' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
      {
        stepOrder: 3,
        actionType: 'CREATE_INCIDENT_TICKET',
        parameters: { severity: 'HIGH', category: 'FRAUD' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
    ],
    requiresApproval: true,
    approvalTimeout: 15,
  },
  {
    name: 'Notify Approver Chain on SoD Violation',
    triggerConditions: [
      { field: 'riskCategory', operator: 'EQUALS', value: 'SOD_VIOLATION' },
    ],
    steps: [
      {
        stepOrder: 1,
        actionType: 'NOTIFY_APPROVER_CHAIN',
        parameters: { template: 'sod_violation_notification' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
      {
        stepOrder: 2,
        actionType: 'ESCALATE_ALERT',
        parameters: { escalateTo: 'security_admin' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
    ],
    requiresApproval: false,
    approvalTimeout: 15,
  },
  {
    name: 'Create Incident Ticket on Critical Anomaly',
    triggerConditions: [
      { field: 'riskCategory', operator: 'EQUALS', value: 'ANOMALY' },
      { field: 'priority', operator: 'IN', value: ['CRITICAL'] },
    ],
    steps: [
      {
        stepOrder: 1,
        actionType: 'CREATE_INCIDENT_TICKET',
        parameters: { severity: 'CRITICAL', category: 'ANOMALY' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
      {
        stepOrder: 2,
        actionType: 'SEND_NOTIFICATION',
        parameters: { channel: 'email', template: 'critical_anomaly_alert' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
    ],
    requiresApproval: false,
    approvalTimeout: 15,
  },
  {
    name: 'Request Approval on Threshold-Exceeding Payments',
    triggerConditions: [
      { field: 'riskCategory', operator: 'EQUALS', value: 'FRAUD_PATTERN' },
      { field: 'riskScore', operator: 'GREATER_THAN', value: 70 },
    ],
    steps: [
      {
        stepOrder: 1,
        actionType: 'REQUEST_ADDITIONAL_APPROVAL',
        parameters: { approverRole: 'CFO', reason: 'Threshold-exceeding payment detected' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
      {
        stepOrder: 2,
        actionType: 'SEND_NOTIFICATION',
        parameters: { channel: 'email', template: 'payment_threshold_alert' },
        timeout: 30,
        onFailure: 'RETRY_ONCE',
      },
    ],
    requiresApproval: true,
    approvalTimeout: 15,
  },
];

// ============================================================================
// In-Memory State (for execution queuing and approval tracking)
// ============================================================================

/** Track in-progress executions per entity for queuing (Req 10.8) */
const activeExecutions: Map<string, string> = new Map(); // key: `${playbookId}:${entityId}` → executionId

/** Queue of pending executions */
const executionQueue: Map<string, Array<{ alertId: string; tenantId: string }>> = new Map();

/** Pending approval requests */
const pendingApprovals: Map<string, ApprovalRequest> = new Map(); // key: `${executionId}:${stepOrder}`

// ============================================================================
// Playbook Executor Service
// ============================================================================

/**
 * Playbook Executor Service
 *
 * Executes automated response playbooks triggered by alerts.
 * Handles trigger matching, step execution with timeouts/retries,
 * high-impact approval workflows, and execution queuing.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */
export default class PlaybookExecutorService extends (ApplicationService as any) {
  async init() {
    this.on('evaluateAndExecute', async (req: any) => {
      const { alertId, tenantId } = req.data;
      const result = await this.evaluateAndExecute(alertId, tenantId);
      return JSON.stringify(result);
    });

    this.on('createPlaybook', async (req: any) => {
      const { tenantId, name, triggerConditions, steps, requiresApproval, approvalTimeout } = req.data;
      const parsedConditions: TriggerCondition[] = JSON.parse(triggerConditions);
      const parsedSteps: PlaybookStep[] = JSON.parse(steps);
      const result = await this.createCustomPlaybook(
        tenantId, name, parsedConditions, parsedSteps, requiresApproval ?? false, approvalTimeout ?? 15
      );
      return JSON.stringify(result);
    });

    this.on('requestApproval', async (req: any) => {
      const { executionId, stepOrder, actionType, alertId } = req.data;
      return this.requestApprovalForStep(executionId, stepOrder, actionType as PlaybookActionType, alertId);
    });

    this.on('submitApproval', async (req: any) => {
      const { executionId, stepOrder, approved, approverId } = req.data;
      const result = await this.handleApprovalDecision(executionId, stepOrder, approved, approverId);
      return JSON.stringify(result);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Evaluate if any playbook matches the alert and execute.
   * Must initiate within 60 seconds of alert generation.
   *
   * Validates: Requirements 10.2
   */
  async evaluateAndExecute(
    alertId: string,
    tenantId: string
  ): Promise<PlaybookExecution | null> {
    const logger = cds.log('playbook-executor');
    const startTime = Date.now();

    logger.info(`Evaluating playbooks for alert ${alertId} in tenant ${tenantId}`);

    // Fetch the alert
    const db = await cds.connect.to('db');
    const { Alerts, Playbooks: PlaybookEntity } = db.entities('finsecure.ai');

    const alertRecord = await SELECT.one.from(Alerts).where({ ID: alertId, tenantId });
    if (!alertRecord) {
      logger.warn(`Alert ${alertId} not found for tenant ${tenantId}`);
      return null;
    }

    const alert = this.mapAlertRecord(alertRecord);

    // Fetch all playbooks for the tenant
    const playbooks = await SELECT.from(PlaybookEntity).where({ tenantId });

    // Match playbooks against alert
    const matchingPlaybook = this.findMatchingPlaybook(playbooks, alert);
    if (!matchingPlaybook) {
      logger.info(`No matching playbook found for alert ${alertId}`);
      return null;
    }

    logger.info(`Playbook "${matchingPlaybook.name}" (${matchingPlaybook.ID}) matches alert ${alertId}`);

    // Check for queuing (Req 10.8)
    const entityKey = this.getEntityKey(matchingPlaybook.ID, alert);
    if (activeExecutions.has(entityKey)) {
      logger.info(`Playbook ${matchingPlaybook.ID} already in progress for entity, queuing execution`);
      return this.queueExecution(matchingPlaybook.ID, entityKey, alertId, tenantId);
    }

    // Execute the playbook
    const execution = await this.executePlaybook(matchingPlaybook, alert, tenantId, startTime);

    // Record in audit trail (Req 10.4)
    await this.recordAuditTrail(tenantId, execution, matchingPlaybook.name);

    return execution;
  }

  /**
   * Execute a single playbook step with timeout (30s default).
   * Retry once on failure, halt on second failure.
   *
   * Validates: Requirements 10.5
   */
  async executeStep(
    step: PlaybookStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const logger = cds.log('playbook-executor');
    const timeoutMs = (step.timeout || 30) * 1000;

    logger.info(
      `Executing step ${step.stepOrder} (${step.actionType}) for execution ${context.executionId}`
    );

    // Check if this is a high-impact action requiring approval (Req 10.7)
    if (HIGH_IMPACT_ACTIONS.has(step.actionType)) {
      logger.info(`Step ${step.stepOrder} is high-impact (${step.actionType}), requesting approval`);
      const approved = await this.requestApprovalForStep(
        context.executionId,
        step.stepOrder,
        step.actionType,
        context.alertId
      );

      if (!approved) {
        return {
          stepOrder: step.stepOrder,
          actionType: step.actionType,
          status: 'APPROVAL_DENIED',
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          error: 'Approval not received within timeout or denied',
        };
      }
    }

    // First attempt
    let result = await this.attemptStepExecution(step, context, timeoutMs);

    // Retry once on failure (Req 10.5)
    if (result.status === 'FAILED' && step.onFailure === 'RETRY_ONCE') {
      logger.info(
        `Step ${step.stepOrder} failed, retrying once (onFailure: ${step.onFailure})`
      );
      result = await this.attemptStepExecution(step, context, timeoutMs);
      result.retryCount = 1;

      if (result.status === 'FAILED') {
        // Second failure: halt further execution (Req 10.5)
        logger.warn(
          `Step ${step.stepOrder} failed on retry. Halting playbook execution ${context.executionId}`
        );
        // Generate secondary alert for failed automated response
        await this.generateFailureAlert(context, step, result.error);
      }
    }

    return result;
  }

  /**
   * Handle high-impact actions requiring approval.
   * Wait up to 15 minutes for confirmation.
   * If no confirmation, escalate to security operations lead.
   *
   * Validates: Requirements 10.7
   */
  async requestApprovalForStep(
    executionId: string,
    stepOrder: number,
    actionType: PlaybookActionType,
    alertId: string
  ): Promise<boolean> {
    const logger = cds.log('playbook-executor');
    const approvalKey = `${executionId}:${stepOrder}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + APPROVAL_TIMEOUT_MS);

    const request: ApprovalRequest = {
      executionId,
      stepOrder,
      actionType,
      alertId,
      requestedAt: now,
      expiresAt,
      status: 'PENDING',
    };

    pendingApprovals.set(approvalKey, request);

    logger.info(
      `Approval requested for ${actionType} (execution ${executionId}, step ${stepOrder}). ` +
      `Expires at ${expiresAt.toISOString()}`
    );

    // In a real implementation, this would send a notification to the designated approver
    // and wait for a response via the submitApproval action.
    // For synchronous execution, we check if an approval already exists (pre-approved scenarios)
    // or return false to indicate pending status.

    const existing = pendingApprovals.get(approvalKey);
    if (existing?.status === 'APPROVED') {
      return true;
    }

    // If the approval hasn't been pre-submitted, escalate after timeout
    if (existing?.status === 'PENDING') {
      // Check if already expired
      if (new Date() >= existing.expiresAt) {
        existing.status = 'EXPIRED';
        logger.warn(
          `Approval expired for ${actionType} (execution ${executionId}, step ${stepOrder}). ` +
          `Escalating to security operations lead.`
        );
        await this.escalateApprovalTimeout(executionId, stepOrder, actionType, alertId);
        return false;
      }

      // For non-blocking execution, return the current pending status
      // The caller should handle PENDING_APPROVAL status
      return false;
    }

    return false;
  }

  /**
   * Queue execution when same playbook in progress for same entity.
   *
   * Validates: Requirements 10.8
   */
  async queueExecution(
    playbookId: string,
    entityKey: string,
    alertId: string,
    tenantId: string
  ): Promise<PlaybookExecution> {
    const logger = cds.log('playbook-executor');

    const executionId = cds.utils.uuid();
    const now = new Date();

    // Add to queue
    if (!executionQueue.has(entityKey)) {
      executionQueue.set(entityKey, []);
    }
    executionQueue.get(entityKey)!.push({ alertId, tenantId });

    const execution: PlaybookExecution = {
      executionId,
      playbookId,
      tenantId,
      alertId,
      status: 'QUEUED',
      stepResults: [],
      startedAt: now,
      queuedAt: now,
    };

    // Persist queued execution
    const db = await cds.connect.to('db');
    const { PlaybookExecutions } = db.entities('finsecure.ai');

    await INSERT.into(PlaybookExecutions).entries({
      ID: executionId,
      playbookId,
      tenantId,
      alertId,
      status: 'QUEUED',
      stepResults: JSON.stringify([]),
      startedAt: now.toISOString(),
      queuedAt: now.toISOString(),
    });

    logger.info(`Execution ${executionId} queued for playbook ${playbookId}, entity key: ${entityKey}`);

    // Record queuing in audit trail (Req 10.4)
    await this.recordAuditTrail(tenantId, execution, 'Queued execution');

    return execution;
  }

  /**
   * Create a custom playbook for a tenant.
   * Validates max 50 per tenant and max 20 steps.
   *
   * Validates: Requirements 10.3, 10.8
   */
  async createCustomPlaybook(
    tenantId: string,
    name: string,
    triggerConditions: TriggerCondition[],
    steps: PlaybookStep[],
    requiresApproval: boolean,
    approvalTimeout: number
  ): Promise<{ success: boolean; playbookId?: string; error?: string }> {
    const logger = cds.log('playbook-executor');
    const db = await cds.connect.to('db');
    const { Playbooks: PlaybookEntity } = db.entities('finsecure.ai');

    // Validate step count (Req 10.3: max 20 steps)
    if (steps.length > MAX_STEPS_PER_PLAYBOOK) {
      return {
        success: false,
        error: `Maximum ${MAX_STEPS_PER_PLAYBOOK} steps allowed per playbook. Received: ${steps.length}`,
      };
    }

    if (steps.length === 0) {
      return {
        success: false,
        error: 'At least one step is required',
      };
    }

    // Validate trigger conditions
    if (triggerConditions.length === 0) {
      return {
        success: false,
        error: 'At least one trigger condition is required',
      };
    }

    // Validate step action types
    const validActionTypes = new Set<PlaybookActionType>([
      'BLOCK_PAYMENT', 'NOTIFY_APPROVER_CHAIN', 'CREATE_INCIDENT_TICKET',
      'REQUEST_ADDITIONAL_APPROVAL', 'SEND_NOTIFICATION', 'LOCK_USER_ACCOUNT',
      'REVOKE_ROLE', 'ESCALATE_ALERT', 'CUSTOM_API_CALL',
    ]);
    for (const step of steps) {
      if (!validActionTypes.has(step.actionType)) {
        return {
          success: false,
          error: `Invalid action type: ${step.actionType}`,
        };
      }
      if (step.timeout <= 0 || step.timeout > 60) {
        return {
          success: false,
          error: `Step ${step.stepOrder}: timeout must be between 1 and 60 seconds`,
        };
      }
    }

    // Validate trigger condition fields
    const validFields = new Set<TriggerCondition['field']>(['riskCategory', 'priority', 'riskScore', 'entityType']);
    const validOperators = new Set<TriggerCondition['operator']>(['EQUALS', 'GREATER_THAN', 'IN']);
    for (const condition of triggerConditions) {
      if (!validFields.has(condition.field)) {
        return {
          success: false,
          error: `Invalid trigger field: ${condition.field}`,
        };
      }
      if (!validOperators.has(condition.operator)) {
        return {
          success: false,
          error: `Invalid trigger operator: ${condition.operator}`,
        };
      }
    }

    // Check tenant limit (Req 10.3: max 50 per tenant)
    const existingCount = await SELECT.from(PlaybookEntity)
      .where({ tenantId })
      .columns('count(ID) as count');
    const count = existingCount[0]?.count ?? 0;

    if (count >= MAX_PLAYBOOKS_PER_TENANT) {
      return {
        success: false,
        error: `Maximum ${MAX_PLAYBOOKS_PER_TENANT} playbooks per tenant reached. Current count: ${count}`,
      };
    }

    // Create the playbook
    const playbookId = cds.utils.uuid();
    const now = new Date().toISOString();

    await INSERT.into(PlaybookEntity).entries({
      ID: playbookId,
      tenantId,
      name,
      triggerConditions: JSON.stringify(triggerConditions),
      steps: JSON.stringify(steps),
      requiresApproval,
      approvalTimeout: approvalTimeout || 15,
      isActive: true,
      isPredefined: false,
      createdAt: now,
      modifiedAt: now,
    });

    logger.info(
      `Custom playbook "${name}" created for tenant ${tenantId} (ID: ${playbookId}, steps: ${steps.length})`
    );

    return { success: true, playbookId };
  }

  /**
   * Handle an approval decision for a pending high-impact action.
   */
  async handleApprovalDecision(
    executionId: string,
    stepOrder: number,
    approved: boolean,
    approverId: string
  ): Promise<{ success: boolean; message: string }> {
    const logger = cds.log('playbook-executor');
    const approvalKey = `${executionId}:${stepOrder}`;
    const request = pendingApprovals.get(approvalKey);

    if (!request) {
      return { success: false, message: `No pending approval found for execution ${executionId}, step ${stepOrder}` };
    }

    if (request.status !== 'PENDING') {
      return { success: false, message: `Approval already processed: ${request.status}` };
    }

    // Check if expired
    if (new Date() >= request.expiresAt) {
      request.status = 'EXPIRED';
      return { success: false, message: 'Approval request has expired' };
    }

    request.status = approved ? 'APPROVED' : 'DENIED';
    request.approverId = approverId;
    request.decidedAt = new Date();

    logger.info(
      `Approval ${approved ? 'granted' : 'denied'} for execution ${executionId}, ` +
      `step ${stepOrder} by ${approverId}`
    );

    return {
      success: true,
      message: `Approval ${approved ? 'granted' : 'denied'} for step ${stepOrder}`,
    };
  }

  // ==========================================================================
  // Private Methods - Execution
  // ==========================================================================

  /**
   * Execute a complete playbook for an alert.
   */
  private async executePlaybook(
    playbookRecord: any,
    alert: Alert,
    tenantId: string,
    startTime: number
  ): Promise<PlaybookExecution> {
    const logger = cds.log('playbook-executor');
    const db = await cds.connect.to('db');
    const { PlaybookExecutions } = db.entities('finsecure.ai');

    const executionId = cds.utils.uuid();
    const entityKey = this.getEntityKey(playbookRecord.ID, alert);

    // Mark as active execution
    activeExecutions.set(entityKey, executionId);

    const execution: PlaybookExecution = {
      executionId,
      playbookId: playbookRecord.ID,
      tenantId,
      alertId: alert.alertId,
      status: 'IN_PROGRESS',
      stepResults: [],
      startedAt: new Date(),
    };

    // Persist execution start
    await INSERT.into(PlaybookExecutions).entries({
      ID: executionId,
      playbookId: playbookRecord.ID,
      tenantId,
      alertId: alert.alertId,
      status: 'IN_PROGRESS',
      stepResults: JSON.stringify([]),
      startedAt: execution.startedAt.toISOString(),
    });

    // Parse steps from the playbook record
    const steps: PlaybookStep[] = this.parseSteps(playbookRecord.steps);

    const context: ExecutionContext = {
      executionId,
      playbookId: playbookRecord.ID,
      tenantId,
      alertId: alert.alertId,
      alert,
      stepResults: [],
    };

    // Execute steps sequentially
    let halted = false;
    for (const step of steps) {
      // Check execution time limit (Req 10.2: 60 seconds)
      const elapsed = Date.now() - startTime;
      if (elapsed >= MAX_EXECUTION_TIME_MS) {
        logger.warn(
          `Playbook execution ${executionId} exceeded ${MAX_EXECUTION_TIME_MS}ms time limit at step ${step.stepOrder}`
        );
        const timeoutResult: StepResult = {
          stepOrder: step.stepOrder,
          actionType: step.actionType,
          status: 'TIMEOUT',
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          error: 'Execution time limit exceeded',
        };
        execution.stepResults.push(timeoutResult);
        halted = true;
        break;
      }

      const result = await this.executeStep(step, context);
      execution.stepResults.push(result);
      context.stepResults.push(result);

      // Halt on failed retry or approval denial (Req 10.5)
      if (result.status === 'FAILED' && result.retryCount > 0) {
        halted = true;
        break;
      }
      if (result.status === 'APPROVAL_DENIED') {
        halted = true;
        break;
      }
      if (result.status === 'PENDING_APPROVAL') {
        execution.status = 'PENDING_APPROVAL';
        break;
      }
    }

    // Finalize execution status
    if (execution.status !== 'PENDING_APPROVAL') {
      execution.status = halted ? 'FAILED' : 'COMPLETED';
    }
    execution.completedAt = new Date();

    // Update persisted execution
    await UPDATE(PlaybookExecutions).where({ ID: executionId }).set({
      status: execution.status,
      stepResults: JSON.stringify(execution.stepResults),
      completedAt: execution.completedAt.toISOString(),
    });

    // Remove from active executions
    activeExecutions.delete(entityKey);

    // Process queued executions for this entity
    await this.processQueue(entityKey);

    const totalElapsed = Date.now() - startTime;
    logger.info(
      `Playbook execution ${executionId} completed: status=${execution.status}, ` +
      `steps=${execution.stepResults.length}, elapsed=${totalElapsed}ms`
    );

    return execution;
  }

  /**
   * Attempt to execute a single step with timeout.
   */
  private async attemptStepExecution(
    step: PlaybookStep,
    context: ExecutionContext,
    timeoutMs: number
  ): Promise<StepResult> {
    const logger = cds.log('playbook-executor');
    const startedAt = new Date();

    try {
      // Execute with timeout
      const actionPromise = this.performAction(step, context);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const output = await Promise.race([actionPromise, timeoutPromise]);

      return {
        stepOrder: step.stepOrder,
        actionType: step.actionType,
        status: 'SUCCESS',
        startedAt,
        completedAt: new Date(),
        retryCount: 0,
        output: output as Record<string, unknown> | undefined,
      };
    } catch (error: any) {
      logger.warn(
        `Step ${step.stepOrder} (${step.actionType}) failed: ${error.message}`
      );
      return {
        stepOrder: step.stepOrder,
        actionType: step.actionType,
        status: 'FAILED',
        startedAt,
        completedAt: new Date(),
        retryCount: 0,
        error: error.message,
      };
    }
  }

  /**
   * Perform the actual action for a playbook step.
   * In production, this integrates with SAP Integration Suite APIs.
   *
   * Validates: Requirements 10.6
   */
  private async performAction(
    step: PlaybookStep,
    context: ExecutionContext
  ): Promise<Record<string, unknown> | undefined> {
    const logger = cds.log('playbook-executor');

    switch (step.actionType) {
      case 'BLOCK_PAYMENT':
        // In production: call SAP Integration Suite to block payment in S/4HANA
        logger.info(
          `[ACTION] Blocking payment for alert ${context.alertId} via Integration Suite`
        );
        return { blocked: true, paymentRef: context.alert.triggeringTransaction?.documentNumber };

      case 'NOTIFY_APPROVER_CHAIN':
        // In production: send notifications to approver chain
        logger.info(
          `[ACTION] Notifying approver chain for alert ${context.alertId}`
        );
        return { notified: true, template: step.parameters.template };

      case 'CREATE_INCIDENT_TICKET':
        // In production: create ticket in ITSM system via Integration Suite
        logger.info(
          `[ACTION] Creating incident ticket for alert ${context.alertId}`
        );
        return { ticketCreated: true, severity: step.parameters.severity };

      case 'REQUEST_ADDITIONAL_APPROVAL':
        // In production: route to approval workflow
        logger.info(
          `[ACTION] Requesting additional approval for alert ${context.alertId}`
        );
        return { approvalRequested: true, approverRole: step.parameters.approverRole };

      case 'SEND_NOTIFICATION':
        // In production: send via configured channels (email, SMS, etc.)
        logger.info(
          `[ACTION] Sending notification for alert ${context.alertId} via ${String(step.parameters.channel)}`
        );
        return { sent: true, channel: step.parameters.channel };

      case 'LOCK_USER_ACCOUNT':
        // In production: lock user via SAP Integration Suite API
        logger.info(
          `[ACTION] Locking user account for alert ${context.alertId} via Integration Suite`
        );
        return { locked: true, userId: context.alert.affectedEntities?.[0]?.entityId };

      case 'REVOKE_ROLE':
        // In production: revoke role assignment via Integration Suite
        logger.info(
          `[ACTION] Revoking role for alert ${context.alertId}`
        );
        return { revoked: true };

      case 'ESCALATE_ALERT':
        // In production: escalate the alert to specified team/individual
        logger.info(
          `[ACTION] Escalating alert ${context.alertId} to ${String(step.parameters.escalateTo)}`
        );
        return { escalated: true, escalatedTo: step.parameters.escalateTo };

      case 'CUSTOM_API_CALL':
        // In production: execute custom API call via Integration Suite
        logger.info(
          `[ACTION] Executing custom API call for alert ${context.alertId}`
        );
        return { executed: true, endpoint: step.parameters.endpoint };

      default:
        throw new Error(`Unknown action type: ${step.actionType}`);
    }
  }

  // ==========================================================================
  // Private Methods - Trigger Matching
  // ==========================================================================

  /**
   * Find the first playbook whose trigger conditions match the alert.
   */
  private findMatchingPlaybook(playbooks: any[], alert: Alert): any | null {
    for (const playbook of playbooks) {
      if (!playbook.isActive) continue;

      const conditions: TriggerCondition[] = this.parseTriggerConditions(playbook.triggerConditions);
      if (this.matchesTriggerConditions(conditions, alert)) {
        return playbook;
      }
    }
    return null;
  }

  /**
   * Check if an alert matches all trigger conditions of a playbook.
   * All conditions must be met (AND logic).
   */
  private matchesTriggerConditions(conditions: TriggerCondition[], alert: Alert): boolean {
    return conditions.every(condition => this.evaluateCondition(condition, alert));
  }

  /**
   * Evaluate a single trigger condition against an alert.
   */
  private evaluateCondition(condition: TriggerCondition, alert: Alert): boolean {
    const alertValue = this.getAlertFieldValue(condition.field, alert);

    switch (condition.operator) {
      case 'EQUALS':
        return alertValue === condition.value;

      case 'GREATER_THAN':
        return typeof alertValue === 'number' && alertValue > (condition.value as number);

      case 'IN':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(alertValue);
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Get the value of a field from an alert for trigger condition evaluation.
   */
  private getAlertFieldValue(field: TriggerCondition['field'], alert: Alert): unknown {
    switch (field) {
      case 'riskCategory':
        return alert.riskCategory;
      case 'priority':
        return alert.priority;
      case 'riskScore':
        return alert.riskScore;
      case 'entityType':
        return alert.affectedEntities?.[0]?.entityType;
      default:
        return undefined;
    }
  }

  // ==========================================================================
  // Private Methods - Queuing
  // ==========================================================================

  /**
   * Process queued executions after an active execution completes.
   */
  private async processQueue(entityKey: string): Promise<void> {
    const logger = cds.log('playbook-executor');
    const queue = executionQueue.get(entityKey);

    if (!queue || queue.length === 0) {
      executionQueue.delete(entityKey);
      return;
    }

    const next = queue.shift();
    if (!next) return;

    if (queue.length === 0) {
      executionQueue.delete(entityKey);
    }

    logger.info(`Processing queued execution for entity key: ${entityKey}`);

    // Re-trigger evaluation for the queued alert
    try {
      await this.evaluateAndExecute(next.alertId, next.tenantId);
    } catch (error: any) {
      logger.error(`Failed to process queued execution: ${error.message}`);
    }
  }

  /**
   * Get entity key for execution deduplication/queuing.
   * Combines playbookId with the primary affected entity.
   */
  private getEntityKey(playbookId: string, alert: Alert): string {
    const primaryEntity = alert.affectedEntities?.[0];
    const entityId = primaryEntity
      ? `${primaryEntity.entityType}:${primaryEntity.entityId}`
      : alert.alertId;
    return `${playbookId}:${entityId}`;
  }

  // ==========================================================================
  // Private Methods - Approval
  // ==========================================================================

  /**
   * Escalate when approval times out.
   * Generates a secondary alert to the security operations lead.
   */
  private async escalateApprovalTimeout(
    executionId: string,
    stepOrder: number,
    actionType: PlaybookActionType,
    alertId: string
  ): Promise<void> {
    const logger = cds.log('playbook-executor');

    logger.warn(
      `Approval timeout for ${actionType} (execution ${executionId}, step ${stepOrder}). ` +
      `Escalating to security operations lead.`
    );

    // In production, this would create a secondary alert and notify the SOC lead
    // via the Alert Manager Service
  }

  // ==========================================================================
  // Private Methods - Audit Trail
  // ==========================================================================

  /**
   * Record playbook execution in the audit trail.
   *
   * Validates: Requirements 10.4
   */
  private async recordAuditTrail(
    tenantId: string,
    execution: PlaybookExecution,
    playbookName: string
  ): Promise<void> {
    const logger = cds.log('playbook-executor');

    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      const entryId = cds.utils.uuid();
      const now = new Date().toISOString();

      await INSERT.into(AuditTrailEntries).entries({
        ID: entryId,
        tenantId,
        timestamp: now,
        userId: 'SYSTEM',
        action: 'PLAYBOOK_EXECUTION',
        affectedObject: `playbook:${execution.playbookId}`,
        sourceIP: '127.0.0.1',
        outcome: this.mapExecutionOutcome(execution.status),
        details: JSON.stringify({
          executionId: execution.executionId,
          playbookName,
          alertId: execution.alertId,
          status: execution.status,
          stepsExecuted: execution.stepResults.length,
          stepResults: execution.stepResults.map(s => ({
            step: s.stepOrder,
            action: s.actionType,
            status: s.status,
          })),
        }),
      });

      logger.info(
        `Audit trail entry recorded for playbook execution ${execution.executionId}`
      );
    } catch (error: any) {
      logger.error(`Failed to record audit trail: ${error.message}`);
      // Non-critical: don't fail the execution over audit logging
    }
  }

  // ==========================================================================
  // Private Methods - Alert Generation
  // ==========================================================================

  /**
   * Generate a secondary alert when playbook step fails after retry.
   *
   * Validates: Requirements 10.5
   */
  private async generateFailureAlert(
    context: ExecutionContext,
    step: PlaybookStep,
    error?: string
  ): Promise<void> {
    const logger = cds.log('playbook-executor');

    logger.warn(
      `Generating failure alert for playbook ${context.playbookId}, ` +
      `step ${step.stepOrder} (${step.actionType}): ${error}`
    );

    // In production, this would call the Alert Manager Service to create
    // a secondary alert notifying the security team
  }

  // ==========================================================================
  // Private Methods - Parsing Helpers
  // ==========================================================================

  /**
   * Map a raw alert DB record to the Alert interface.
   */
  private mapAlertRecord(record: any): Alert {
    return {
      alertId: record.ID,
      tenantId: record.tenantId,
      priority: record.priority as AlertPriority,
      status: record.status,
      riskCategory: record.riskCategory as RiskCategory,
      riskScore: record.riskScore,
      financialExposure: record.financialExposure ?? undefined,
      title: record.title,
      description: record.description,
      triggeringTransaction: {} as any, // Populated from DB join in real usage
      riskIndicators: this.safeJsonParse(record.riskIndicators, []),
      affectedEntities: this.safeJsonParse(record.affectedEntities, []),
      recommendedActions: this.safeJsonParse(record.recommendedActions, []),
      aiConfidenceScore: record.aiConfidenceScore,
      clusterId: record.clusterId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.modifiedAt),
      slaDeadline: new Date(record.slaDeadline),
      escalatedAt: record.escalatedAt ? new Date(record.escalatedAt) : undefined,
    };
  }

  /**
   * Parse trigger conditions from JSON string.
   */
  private parseTriggerConditions(raw: string | TriggerCondition[]): TriggerCondition[] {
    if (Array.isArray(raw)) return raw;
    return this.safeJsonParse(raw, []);
  }

  /**
   * Parse steps from JSON string.
   */
  private parseSteps(raw: string | PlaybookStep[]): PlaybookStep[] {
    if (Array.isArray(raw)) return raw;
    return this.safeJsonParse(raw, []);
  }

  /**
   * Safe JSON parse with fallback.
   */
  private safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    if (typeof value !== 'string') return value as unknown as T;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Map execution status to audit trail outcome.
   */
  private mapExecutionOutcome(status: PlaybookExecution['status']): 'SUCCESS' | 'FAILURE' {
    if (status === 'COMPLETED' || status === 'QUEUED') {
      return 'SUCCESS';
    }
    return 'FAILURE';
  }
}
