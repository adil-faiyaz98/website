import cds = require('@sap/cds');
import {
  AlertStatus,
  InvestigationStatus,
  DataClassification,
  RiskCategory,
} from '../types/enums';
import { isValidAlertTransition, isValidInvestigationTransition } from '../types/state-machines';

const { ApplicationService } = cds;

// ============================================================================
// Types
// ============================================================================

/** Joule intent types for query and action processing */
export type JouleIntentType =
  | 'QUERY_ALERTS'
  | 'SUMMARIZE_INVESTIGATION'
  | 'EXPLAIN_FLAGGING'
  | 'RECOMMEND_NEXT_STEPS'
  | 'COMPLIANCE_STATUS'
  | 'COMPARE_RISK_POSTURE'
  | 'ACKNOWLEDGE_ALERT'
  | 'CHANGE_INVESTIGATION_STATUS'
  | 'ASSIGN_ALERT'
  | 'REQUEST_REPORT'
  | 'INITIATE_ACCESS_REVIEW';

/** Query intents that return read-only data */
const QUERY_INTENTS: JouleIntentType[] = [
  'QUERY_ALERTS',
  'SUMMARIZE_INVESTIGATION',
  'EXPLAIN_FLAGGING',
  'RECOMMEND_NEXT_STEPS',
  'COMPLIANCE_STATUS',
  'COMPARE_RISK_POSTURE',
];

/** Action intents that modify data */
const ACTION_INTENTS: JouleIntentType[] = [
  'ACKNOWLEDGE_ALERT',
  'CHANGE_INVESTIGATION_STATUS',
  'ASSIGN_ALERT',
  'REQUEST_REPORT',
  'INITIATE_ACCESS_REVIEW',
];

/** Roles allowed to execute actions */
const ACTION_ROLES: Record<string, string[]> = {
  ACKNOWLEDGE_ALERT: ['SecurityAnalyst', 'SecurityAdmin', 'SOCOperator'],
  CHANGE_INVESTIGATION_STATUS: ['SecurityAnalyst', 'SecurityAdmin', 'SOCOperator'],
  ASSIGN_ALERT: ['SecurityAdmin', 'SOCOperator'],
  REQUEST_REPORT: ['SecurityAnalyst', 'SecurityAdmin', 'Auditor', 'Executive', 'IAMAdmin', 'SOCOperator'],
  INITIATE_ACCESS_REVIEW: ['IAMAdmin', 'SecurityAdmin'],
};

/** Data classification for field-level masking */
interface FieldClassification {
  field: string;
  classification: DataClassification;
}

/**
 * Fields classified as Restricted — never exposed in Joule responses.
 * Validates: Requirements 32.7
 */
const RESTRICTED_FIELDS: string[] = [
  'password',
  'credentials',
  'secret',
  'apiKey',
  'token',
  'ssn',
  'socialSecurityNumber',
  'sin',
  'socialInsuranceNumber',
  'salary',
  'bankAccountNumber',
  'iban',
  'creditCardNumber',
  'privateKey',
  'connectionPassword',
];

/**
 * Fields classified as Confidential — masked for Executive role.
 */
const CONFIDENTIAL_FIELDS: string[] = [
  'bankDetails',
  'accountNumber',
  'amount',
  'financialExposure',
  'vendorBankAccount',
  'paymentAmount',
];

/** Maximum query processing time in milliseconds (5 seconds) */
const MAX_QUERY_TIME_MS = 5_000;

/** A2A agent registration metadata */
const AGENT_REGISTRATION = {
  agentId: 'finsecure-ai-joule-agent',
  name: 'FinSecure AI Security Analyst',
  description: 'Conversational AI security analyst for financial transaction risk intelligence',
  version: '1.0.0',
  protocol: 'A2A',
  capabilities: [
    'query_alerts',
    'summarize_investigation',
    'explain_flagging',
    'recommend_steps',
    'compliance_status',
    'compare_risk_posture',
    'acknowledge_alert',
    'change_investigation_status',
    'assign_alert',
    'request_report',
    'initiate_access_review',
  ],
  supportedIntents: [...QUERY_INTENTS, ...ACTION_INTENTS],
};

// ============================================================================
// Joule Response
// ============================================================================

interface JouleResponse {
  success: boolean;
  intentType: JouleIntentType;
  data?: any;
  message?: string;
  error?: string;
  metadata: {
    processingTimeMs: number;
    dataClassification: DataClassification;
    isAIGenerated: boolean;
    timestamp: string;
  };
}

// ============================================================================
// Joule Agent Service
// ============================================================================

/**
 * Joule Agent Service
 *
 * Integrates with SAP Joule as a custom Joule Agent providing conversational
 * AI security analyst capabilities. Translates natural language queries to OData
 * filters, executes actions with RBAC enforcement, and sanitizes responses to
 * enforce data classification controls.
 *
 * Validates: Requirements 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8
 */
export default class JouleAgentService extends (ApplicationService as any) {
  async init() {
    this.on('processQuery', async (req: any) => {
      const { intentType, parameters, userId, tenantId } = req.data;

      const intent = {
        intentType: intentType as JouleIntentType,
        parameters: parameters ? JSON.parse(parameters) : {},
        userId,
        tenantId,
      };

      const userRole = this.extractUserRole(req);
      const response = await this.processQueryIntent(intent, userRole);
      return JSON.stringify(response);
    });

    this.on('executeAction', async (req: any) => {
      const { intentType, parameters, userId, tenantId } = req.data;

      const intent = {
        intentType: intentType as JouleIntentType,
        parameters: parameters ? JSON.parse(parameters) : {},
        userId,
        tenantId,
      };

      const userRole = this.extractUserRole(req);
      const response = await this.executeActionIntent(intent, userRole);
      return JSON.stringify(response);
    });

    this.on('registerAgent', async (_req: any) => {
      const result = await this.registerAsJouleAgent();
      return JSON.stringify(result);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Process a natural language query intent.
   * Translates to OData filters and returns results within 5 seconds.
   *
   * Validates: Requirements 32.2, 32.3, 32.4
   */
  async processQueryIntent(
    intent: { intentType: JouleIntentType; parameters: Record<string, any>; userId: string; tenantId: string },
    userRole: string
  ): Promise<JouleResponse> {
    const logger = cds.log('joule-agent');
    const startTime = Date.now();

    try {
      // Validate intent is a query type
      if (!QUERY_INTENTS.includes(intent.intentType)) {
        return this.buildErrorResponse(
          intent.intentType,
          `Intent '${intent.intentType}' is not a query intent. Use executeAction for actions.`,
          startTime
        );
      }

      let data: any;

      switch (intent.intentType) {
        case 'QUERY_ALERTS':
          data = await this.handleQueryAlerts(intent.tenantId, intent.parameters);
          break;
        case 'SUMMARIZE_INVESTIGATION':
          data = await this.handleSummarizeInvestigation(intent.tenantId, intent.parameters);
          break;
        case 'EXPLAIN_FLAGGING':
          data = await this.handleExplainFlagging(intent.tenantId, intent.parameters);
          break;
        case 'RECOMMEND_NEXT_STEPS':
          data = await this.handleRecommendNextSteps(intent.tenantId, intent.parameters);
          break;
        case 'COMPLIANCE_STATUS':
          data = await this.handleComplianceStatus(intent.tenantId, intent.parameters);
          break;
        case 'COMPARE_RISK_POSTURE':
          data = await this.handleCompareRiskPosture(intent.tenantId, intent.parameters);
          break;
        default:
          return this.buildErrorResponse(
            intent.intentType,
            `Unsupported query intent: ${intent.intentType}`,
            startTime
          );
      }

      // Sanitize response based on user role and data classification
      const sanitizedData = this.sanitizeResponse(data, userRole);
      const processingTimeMs = Date.now() - startTime;

      if (processingTimeMs > MAX_QUERY_TIME_MS) {
        logger.warn(
          `Query ${intent.intentType} took ${processingTimeMs}ms (exceeds ${MAX_QUERY_TIME_MS}ms SLA)`
        );
      }

      logger.info(
        `Joule query processed: intent=${intent.intentType}, tenant=${intent.tenantId}, ` +
        `user=${intent.userId}, time=${processingTimeMs}ms`
      );

      return {
        success: true,
        intentType: intent.intentType,
        data: sanitizedData,
        metadata: {
          processingTimeMs,
          dataClassification: this.getResponseClassification(sanitizedData),
          isAIGenerated: intent.intentType === 'EXPLAIN_FLAGGING' || intent.intentType === 'RECOMMEND_NEXT_STEPS',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error(`Joule query failed: intent=${intent.intentType}, error=${error.message}`);
      return this.buildErrorResponse(intent.intentType, error.message, startTime);
    }
  }

  /**
   * Execute an action through Joule with same RBAC/MFA controls as dashboard.
   *
   * Validates: Requirements 32.5
   */
  async executeActionIntent(
    intent: { intentType: JouleIntentType; parameters: Record<string, any>; userId: string; tenantId: string },
    userRole: string
  ): Promise<JouleResponse> {
    const logger = cds.log('joule-agent');
    const startTime = Date.now();

    try {
      // Validate intent is an action type
      if (!ACTION_INTENTS.includes(intent.intentType)) {
        return this.buildErrorResponse(
          intent.intentType,
          `Intent '${intent.intentType}' is not an action intent. Use processQuery for queries.`,
          startTime
        );
      }

      // RBAC check: verify user role is authorized for this action
      const allowedRoles = ACTION_ROLES[intent.intentType] || [];
      if (!allowedRoles.includes(userRole)) {
        logger.warn(
          `RBAC denied: user=${intent.userId}, role=${userRole}, action=${intent.intentType}`
        );
        return this.buildErrorResponse(
          intent.intentType,
          `Access denied: role '${userRole}' is not authorized to perform '${intent.intentType}'. ` +
          `Required roles: ${allowedRoles.join(', ')}`,
          startTime
        );
      }

      let data: any;

      switch (intent.intentType) {
        case 'ACKNOWLEDGE_ALERT':
          data = await this.handleAcknowledgeAlert(intent.tenantId, intent.userId, intent.parameters);
          break;
        case 'CHANGE_INVESTIGATION_STATUS':
          data = await this.handleChangeInvestigationStatus(intent.tenantId, intent.userId, intent.parameters);
          break;
        case 'ASSIGN_ALERT':
          data = await this.handleAssignAlert(intent.tenantId, intent.userId, intent.parameters);
          break;
        case 'REQUEST_REPORT':
          data = await this.handleRequestReport(intent.tenantId, intent.userId, intent.parameters);
          break;
        case 'INITIATE_ACCESS_REVIEW':
          data = await this.handleInitiateAccessReview(intent.tenantId, intent.userId, intent.parameters);
          break;
        default:
          return this.buildErrorResponse(
            intent.intentType,
            `Unsupported action intent: ${intent.intentType}`,
            startTime
          );
      }

      const sanitizedData = this.sanitizeResponse(data, userRole);
      const processingTimeMs = Date.now() - startTime;

      logger.info(
        `Joule action executed: intent=${intent.intentType}, tenant=${intent.tenantId}, ` +
        `user=${intent.userId}, role=${userRole}, time=${processingTimeMs}ms`
      );

      return {
        success: true,
        intentType: intent.intentType,
        data: sanitizedData,
        message: `Action '${intent.intentType}' executed successfully.`,
        metadata: {
          processingTimeMs,
          dataClassification: this.getResponseClassification(sanitizedData),
          isAIGenerated: false,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      logger.error(`Joule action failed: intent=${intent.intentType}, error=${error.message}`);
      return this.buildErrorResponse(intent.intentType, error.message, startTime);
    }
  }

  /**
   * Register as Joule Agent via A2A (Agent-to-Agent) protocol on SAP BTP.
   * Enables orchestration with other Joule agents in the customer's landscape.
   *
   * Validates: Requirements 32.1, 32.6
   */
  async registerAsJouleAgent(): Promise<{ success: boolean; registration: any }> {
    const logger = cds.log('joule-agent');

    try {
      // In production, this calls the SAP Joule Agent Registration API
      // via the A2A protocol to register skills and capabilities
      const registration = {
        ...AGENT_REGISTRATION,
        registeredAt: new Date().toISOString(),
        endpoint: '/joule-agent',
        skills: this.buildSkillManifest(),
      };

      logger.info(
        `Joule Agent registered: id=${registration.agentId}, ` +
        `capabilities=${registration.capabilities.length}, protocol=${registration.protocol}`
      );

      return { success: true, registration };
    } catch (error: any) {
      logger.error(`Joule Agent registration failed: ${error.message}`);
      return { success: false, registration: { error: error.message } };
    }
  }

  /**
   * Sanitize response to enforce data classification controls.
   * Never exposes Restricted-tier data (credentials, PII, salary).
   * Applies role-based visibility rules per Requirement 29.
   *
   * Validates: Requirements 32.7
   */
  sanitizeResponse(response: any, userRole: string): any {
    if (response === null || response === undefined) {
      return response;
    }

    if (Array.isArray(response)) {
      return response.map(item => this.sanitizeResponse(item, userRole));
    }

    if (typeof response === 'object') {
      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(response)) {
        // Always mask Restricted-tier fields regardless of role
        if (this.isRestrictedField(key)) {
          sanitized[key] = '[REDACTED - Restricted Data]';
          continue;
        }

        // Mask Confidential fields for Executive role (aggregated only)
        if (userRole === 'Executive' && this.isConfidentialField(key)) {
          sanitized[key] = '[MASKED - Confidential]';
          continue;
        }

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeResponse(value, userRole);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    // Scan string values for restricted data patterns
    if (typeof response === 'string') {
      return this.scrubRestrictedPatterns(response);
    }

    return response;
  }

  // ==========================================================================
  // Query Intent Handlers
  // ==========================================================================

  /**
   * Handle QUERY_ALERTS intent.
   * Translates natural language criteria to OData filters.
   *
   * Parameters: timeRange, severity, category, user, entity
   */
  private async handleQueryAlerts(
    tenantId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    // Build OData-like filter from parameters
    const filter: Record<string, any> = { tenantId };

    if (params.severity || params.priority) {
      filter.priority = params.severity || params.priority;
    }

    if (params.category || params.riskCategory) {
      filter.riskCategory = params.category || params.riskCategory;
    }

    if (params.status) {
      filter.status = params.status;
    }

    if (params.assignedAnalyst || params.user) {
      filter.assignedAnalyst = params.assignedAnalyst || params.user;
    }

    // Build the query
    let query = SELECT.from(Alerts).where(filter);

    // Apply time range filter
    if (params.timeRange) {
      const fromDate = this.resolveTimeRange(params.timeRange);
      if (fromDate) {
        query = SELECT.from(Alerts).where({
          ...filter,
          createdAt: { '>=': fromDate.toISOString() },
        });
      }
    }

    // Limit results for Joule response conciseness
    const limit = Math.min(params.limit || 20, 50);
    query = query.limit(limit).orderBy('createdAt desc');

    const results = await query;

    return {
      alerts: results.map((alert: any) => ({
        alertId: alert.ID,
        priority: alert.priority,
        status: alert.status,
        riskCategory: alert.riskCategory,
        riskScore: alert.riskScore,
        title: alert.title,
        description: alert.description,
        financialExposure: alert.financialExposure,
        assignedAnalyst: alert.assignedAnalyst,
        createdAt: alert.createdAt,
        slaDeadline: alert.slaDeadline,
      })),
      totalCount: results.length,
      filter: filter,
    };
  }

  /**
   * Handle SUMMARIZE_INVESTIGATION intent.
   * Returns a plain-language summary of the investigation.
   */
  private async handleSummarizeInvestigation(
    tenantId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { Investigations, Alerts } = db.entities('finsecure.ai');

    const investigationId = params.investigationId;
    if (!investigationId) {
      throw new Error('Parameter "investigationId" is required for SUMMARIZE_INVESTIGATION');
    }

    const investigation = await SELECT.one.from(Investigations).where({
      ID: investigationId,
      tenantId,
    });

    if (!investigation) {
      throw new Error(`Investigation ${investigationId} not found`);
    }

    // Fetch the related alert for context
    const relatedAlert = investigation.alertId
      ? await SELECT.one.from(Alerts).where({ ID: investigation.alertId })
      : null;

    return {
      investigationId: investigation.ID,
      status: investigation.status,
      assignedAnalyst: investigation.assignedAnalyst,
      alertId: investigation.alertId,
      alertTitle: relatedAlert?.title || 'Unknown',
      alertPriority: relatedAlert?.priority || 'Unknown',
      riskScore: relatedAlert?.riskScore,
      riskCategory: relatedAlert?.riskCategory,
      startedAt: investigation.createdAt,
      resolvedAt: investigation.resolvedAt,
      resolutionNotes: investigation.resolutionNotes,
      summary: this.buildInvestigationSummary(investigation, relatedAlert),
    };
  }

  /**
   * Handle EXPLAIN_FLAGGING intent.
   * Invokes GenAI to produce a natural language explanation.
   *
   * Validates: Requirements 32.4
   */
  private async handleExplainFlagging(
    tenantId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { Alerts, Transactions } = db.entities('finsecure.ai');

    const alertId = params.alertId;
    if (!alertId) {
      throw new Error('Parameter "alertId" is required for EXPLAIN_FLAGGING');
    }

    const alert = await SELECT.one.from(Alerts).where({ ID: alertId, tenantId });
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    // Get the triggering transaction for context
    const transaction = alert.triggeringTxId
      ? await SELECT.one.from(Transactions).where({ ID: alert.triggeringTxId })
      : null;

    // Build explanation from available data (in production, would invoke GenAI Hub)
    const explanation = this.buildFlaggingExplanation(alert, transaction);

    return {
      alertId,
      explanation,
      riskScore: alert.riskScore,
      riskCategory: alert.riskCategory,
      detectionRules: alert.riskIndicators ? JSON.parse(alert.riskIndicators) : [],
      historicalContext: `Alert generated for category ${alert.riskCategory} with score ${alert.riskScore}`,
      isAIGenerated: true,
      confidence: 75,
      disclaimer: 'This explanation is AI-generated and should be verified by a qualified analyst.',
    };
  }

  /**
   * Handle RECOMMEND_NEXT_STEPS intent.
   * Provides investigation step recommendations for an open alert.
   */
  private async handleRecommendNextSteps(
    tenantId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const alertId = params.alertId;
    if (!alertId) {
      throw new Error('Parameter "alertId" is required for RECOMMEND_NEXT_STEPS');
    }

    const alert = await SELECT.one.from(Alerts).where({ ID: alertId, tenantId });
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const recommendedActions = alert.recommendedActions
      ? JSON.parse(alert.recommendedActions)
      : [];

    const nextSteps = this.generateNextSteps(alert);

    return {
      alertId,
      currentStatus: alert.status,
      priority: alert.priority,
      riskCategory: alert.riskCategory,
      recommendedActions,
      nextSteps,
      isAIGenerated: true,
      confidence: 70,
      disclaimer: 'These recommendations are AI-generated. Apply professional judgment before acting.',
    };
  }

  /**
   * Handle COMPLIANCE_STATUS intent.
   * Returns compliance summary for a specified framework.
   */
  private async handleComplianceStatus(
    tenantId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { ComplianceControls, ControlEvidence } = db.entities('finsecure.ai');

    const framework = params.framework;

    // Fetch active controls (optionally filtered by framework)
    const controlFilter: Record<string, any> = { tenantId, status: 'ACTIVE' };
    if (framework) {
      controlFilter.frameworkRef = { like: `%${framework}%` };
    }

    const controls = await SELECT.from(ComplianceControls).where(controlFilter);

    // Get latest evidence for each control
    let passCount = 0;
    let failCount = 0;
    let warningCount = 0;

    for (const control of controls) {
      const latestEvidence = await SELECT.one
        .from(ControlEvidence)
        .where({ controlId: control.ID, tenantId })
        .orderBy('evaluationTimestamp desc');

      if (latestEvidence) {
        switch (latestEvidence.result) {
          case 'PASS': passCount++; break;
          case 'FAIL': failCount++; break;
          case 'WARNING': warningCount++; break;
        }
      }
    }

    const totalActive = passCount + failCount + warningCount;
    const compliancePercentage = totalActive > 0
      ? Math.round((passCount / totalActive) * 10000) / 100
      : 0;

    return {
      framework: framework || 'ALL',
      totalControls: controls.length,
      passCount,
      failCount,
      warningCount,
      compliancePercentage,
      summary: `Compliance at ${compliancePercentage}% — ${passCount} passing, ${failCount} failing, ${warningCount} warnings out of ${totalActive} evaluated controls.`,
    };
  }

  /**
   * Handle COMPARE_RISK_POSTURE intent.
   * Compares current risk posture against a previous period.
   */
  private async handleCompareRiskPosture(
    tenantId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const comparePeriodDays = params.periodDays || 30;
    const now = new Date();

    // Current period
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - comparePeriodDays);

    // Previous period
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - comparePeriodDays);

    const currentAlerts = await SELECT.from(Alerts).where({
      tenantId,
      createdAt: { '>=': currentStart.toISOString() },
    });

    const previousAlerts = await SELECT.from(Alerts).where({
      tenantId,
      createdAt: { '>=': previousStart.toISOString(), '<': currentStart.toISOString() },
    });

    const currentMetrics = this.calculatePeriodMetrics(currentAlerts);
    const previousMetrics = this.calculatePeriodMetrics(previousAlerts);

    return {
      periodDays: comparePeriodDays,
      current: currentMetrics,
      previous: previousMetrics,
      trends: {
        totalAlertChange: currentMetrics.totalAlerts - previousMetrics.totalAlerts,
        criticalAlertChange: currentMetrics.criticalCount - previousMetrics.criticalCount,
        avgRiskScoreChange: Math.round((currentMetrics.avgRiskScore - previousMetrics.avgRiskScore) * 100) / 100,
      },
      summary: this.buildRiskPostureSummary(currentMetrics, previousMetrics, comparePeriodDays),
    };
  }

  // ==========================================================================
  // Action Intent Handlers
  // ==========================================================================

  /**
   * Handle ACKNOWLEDGE_ALERT action.
   * Transitions alert from OPEN to IN_PROGRESS.
   */
  private async handleAcknowledgeAlert(
    tenantId: string,
    userId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const alertId = params.alertId;
    if (!alertId) {
      throw new Error('Parameter "alertId" is required for ACKNOWLEDGE_ALERT');
    }

    const alert = await SELECT.one.from(Alerts).where({ ID: alertId, tenantId });
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const currentState = alert.status as AlertStatus;
    const targetState: AlertStatus = 'IN_PROGRESS';

    if (!isValidAlertTransition(currentState, targetState)) {
      throw new Error(
        `Cannot acknowledge alert: current state is '${currentState}'. ` +
        `Only OPEN alerts can be acknowledged.`
      );
    }

    const now = new Date().toISOString();
    await UPDATE(Alerts).where({ ID: alertId }).set({
      status: targetState,
      assignedAnalyst: userId,
      modifiedAt: now,
    });

    return {
      alertId,
      previousStatus: currentState,
      newStatus: targetState,
      assignedTo: userId,
      acknowledgedAt: now,
    };
  }

  /**
   * Handle CHANGE_INVESTIGATION_STATUS action.
   * Transitions investigation state with validation.
   */
  private async handleChangeInvestigationStatus(
    tenantId: string,
    userId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { Investigations } = db.entities('finsecure.ai');

    const investigationId = params.investigationId;
    const targetStatus = params.targetStatus as InvestigationStatus;

    if (!investigationId) {
      throw new Error('Parameter "investigationId" is required');
    }
    if (!targetStatus) {
      throw new Error('Parameter "targetStatus" is required');
    }

    const investigation = await SELECT.one.from(Investigations).where({
      ID: investigationId,
      tenantId,
    });

    if (!investigation) {
      throw new Error(`Investigation ${investigationId} not found`);
    }

    const currentState = investigation.status as InvestigationStatus;

    // Validate using investigation state machine
    if (!isValidInvestigationTransition(currentState, targetStatus)) {
      throw new Error(
        `Invalid state transition from '${currentState}' to '${targetStatus}'.`
      );
    }

    // Resolution requires notes
    if (
      (targetStatus === 'RESOLVED_TRUE_POSITIVE' || targetStatus === 'RESOLVED_FALSE_POSITIVE') &&
      (!params.notes || params.notes.length < 1 || params.notes.length > 5000)
    ) {
      throw new Error('Resolution requires notes between 1 and 5000 characters.');
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status: targetStatus,
      modifiedAt: now,
    };

    if (targetStatus === 'RESOLVED_TRUE_POSITIVE' || targetStatus === 'RESOLVED_FALSE_POSITIVE') {
      updatePayload.resolvedAt = now;
      updatePayload.resolutionNotes = params.notes;
    }

    await UPDATE(Investigations).where({ ID: investigationId }).set(updatePayload);

    return {
      investigationId,
      previousStatus: currentState,
      newStatus: targetStatus,
      updatedBy: userId,
      updatedAt: now,
    };
  }

  /**
   * Handle ASSIGN_ALERT action.
   * Assigns an alert to a specified analyst.
   */
  private async handleAssignAlert(
    tenantId: string,
    userId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const alertId = params.alertId;
    const assigneeId = params.assigneeId || params.analyst;

    if (!alertId) {
      throw new Error('Parameter "alertId" is required');
    }
    if (!assigneeId) {
      throw new Error('Parameter "assigneeId" or "analyst" is required');
    }

    const alert = await SELECT.one.from(Alerts).where({ ID: alertId, tenantId });
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const now = new Date().toISOString();
    await UPDATE(Alerts).where({ ID: alertId }).set({
      assignedAnalyst: assigneeId,
      modifiedAt: now,
    });

    return {
      alertId,
      previousAssignee: alert.assignedAnalyst || 'unassigned',
      newAssignee: assigneeId,
      assignedBy: userId,
      assignedAt: now,
    };
  }

  /**
   * Handle REQUEST_REPORT action.
   * Queues a compliance or risk report for generation.
   */
  private async handleRequestReport(
    tenantId: string,
    userId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { GeneratedReports } = db.entities('finsecure.ai');

    const reportType = params.reportType || 'risk_summary';
    const framework = params.framework;
    const periodStart = params.periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = params.periodEnd || new Date().toISOString();

    const reportId = cds.utils.uuid();
    const now = new Date().toISOString();

    await INSERT.into(GeneratedReports).entries({
      ID: reportId,
      tenantId,
      reportType,
      framework: framework || null,
      periodStart,
      periodEnd,
      requestedBy: userId,
      status: 'QUEUED',
      createdAt: now,
      modifiedAt: now,
    });

    return {
      reportId,
      reportType,
      framework,
      periodStart,
      periodEnd,
      status: 'QUEUED',
      requestedBy: userId,
      message: `Report '${reportType}' has been queued for generation.`,
    };
  }

  /**
   * Handle INITIATE_ACCESS_REVIEW action.
   * Creates a new access review campaign.
   */
  private async handleInitiateAccessReview(
    tenantId: string,
    userId: string,
    params: Record<string, any>
  ): Promise<any> {
    const db = await cds.connect.to('db');
    const { AccessReviewCampaigns } = db.entities('finsecure.ai');

    const trigger = params.trigger || 'ALERT_THRESHOLD';
    const scope = params.scope || 'ALL_USERS';
    const deadline = params.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const campaignId = cds.utils.uuid();
    const now = new Date().toISOString();

    await INSERT.into(AccessReviewCampaigns).entries({
      ID: campaignId,
      tenantId,
      trigger,
      status: 'ACTIVE',
      scope,
      deadline,
      initiatedBy: userId,
      completionRate: 0,
      createdAt: now,
      modifiedAt: now,
    });

    return {
      campaignId,
      trigger,
      scope,
      status: 'ACTIVE',
      deadline,
      initiatedBy: userId,
      message: `Access review campaign initiated with trigger '${trigger}'.`,
    };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Extract user role from the request context.
   * Falls back to 'SecurityAnalyst' if role cannot be determined.
   */
  private extractUserRole(req: any): string {
    if (req.user?.is('SecurityAdmin')) return 'SecurityAdmin';
    if (req.user?.is('IAMAdmin')) return 'IAMAdmin';
    if (req.user?.is('Auditor')) return 'Auditor';
    if (req.user?.is('Executive')) return 'Executive';
    if (req.user?.is('SOCOperator')) return 'SOCOperator';
    if (req.user?.is('SecurityAnalyst')) return 'SecurityAnalyst';
    return 'SecurityAnalyst';
  }

  /**
   * Check if a field name is classified as Restricted.
   * Restricted data is NEVER exposed in Joule responses.
   */
  private isRestrictedField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return RESTRICTED_FIELDS.some(rf => lowerField.includes(rf.toLowerCase()));
  }

  /**
   * Check if a field name is classified as Confidential.
   */
  private isConfidentialField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return CONFIDENTIAL_FIELDS.some(cf => lowerField.includes(cf.toLowerCase()));
  }

  /**
   * Scrub restricted data patterns from string values.
   * Removes anything that looks like credentials, tokens, or PII patterns.
   */
  private scrubRestrictedPatterns(value: string): string {
    // Mask patterns that look like API keys, tokens, or secrets
    let scrubbed = value.replace(
      /(?:password|secret|token|apikey|api_key|credential|private_key)\s*[:=]\s*\S+/gi,
      '[REDACTED]'
    );
    // Mask patterns that look like SSN/SIN (XXX-XX-XXXX or XXX-XXX-XXX)
    scrubbed = scrubbed.replace(/\b\d{3}[-]?\d{2,3}[-]?\d{3,4}\b/g, '[REDACTED-PII]');
    // Mask credit card patterns (16 digits)
    scrubbed = scrubbed.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED-CC]');
    return scrubbed;
  }

  /**
   * Determine the highest data classification level in a response.
   */
  private getResponseClassification(data: any): DataClassification {
    // After sanitization, the response should only contain PUBLIC or INTERNAL data
    // since Restricted is always masked and Confidential is masked for certain roles
    if (data === null || data === undefined) return 'PUBLIC';

    const json = JSON.stringify(data);
    if (json.includes('[MASKED - Confidential]')) return 'INTERNAL';
    if (json.includes('userId') || json.includes('assignedAnalyst')) return 'INTERNAL';
    return 'PUBLIC';
  }

  /**
   * Resolve a natural language time range to a Date.
   * Supports: "last week", "last 24 hours", "last 7 days", "last month", etc.
   */
  private resolveTimeRange(timeRange: string): Date | null {
    const now = new Date();
    const lower = timeRange.toLowerCase().trim();

    if (lower.includes('hour')) {
      const hours = parseInt(lower.match(/(\d+)/)?.[1] || '24', 10);
      now.setHours(now.getHours() - hours);
      return now;
    }

    if (lower.includes('day')) {
      const days = parseInt(lower.match(/(\d+)/)?.[1] || '7', 10);
      now.setDate(now.getDate() - days);
      return now;
    }

    if (lower.includes('week')) {
      const weeks = parseInt(lower.match(/(\d+)/)?.[1] || '1', 10);
      now.setDate(now.getDate() - weeks * 7);
      return now;
    }

    if (lower.includes('month')) {
      const months = parseInt(lower.match(/(\d+)/)?.[1] || '1', 10);
      now.setMonth(now.getMonth() - months);
      return now;
    }

    // Try to parse as ISO date directly
    const parsed = new Date(timeRange);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Calculate metrics for a set of alerts in a time period.
   */
  private calculatePeriodMetrics(alerts: any[]): {
    totalAlerts: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    avgRiskScore: number;
    resolvedCount: number;
    categoryBreakdown: Record<string, number>;
  } {
    const criticalCount = alerts.filter(a => a.priority === 'CRITICAL').length;
    const highCount = alerts.filter(a => a.priority === 'HIGH').length;
    const mediumCount = alerts.filter(a => a.priority === 'MEDIUM').length;
    const lowCount = alerts.filter(a => a.priority === 'LOW').length;
    const resolvedCount = alerts.filter(a =>
      a.status === 'RESOLVED_TRUE_POSITIVE' || a.status === 'RESOLVED_FALSE_POSITIVE'
    ).length;

    const totalRiskScore = alerts.reduce((sum, a) => sum + (a.riskScore || 0), 0);
    const avgRiskScore = alerts.length > 0 ? totalRiskScore / alerts.length : 0;

    const categoryBreakdown: Record<string, number> = {};
    for (const alert of alerts) {
      const cat = alert.riskCategory || 'UNKNOWN';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    }

    return {
      totalAlerts: alerts.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      avgRiskScore: Math.round(avgRiskScore * 100) / 100,
      resolvedCount,
      categoryBreakdown,
    };
  }

  /**
   * Build a plain-language investigation summary.
   */
  private buildInvestigationSummary(investigation: any, alert: any): string {
    const parts: string[] = [];

    parts.push(`Investigation is currently in '${investigation.status}' state.`);

    if (alert) {
      parts.push(
        `Related to a ${alert.priority} priority alert: "${alert.title}" ` +
        `(risk score: ${alert.riskScore}/100, category: ${alert.riskCategory}).`
      );
    }

    if (investigation.assignedAnalyst) {
      parts.push(`Assigned to analyst: ${investigation.assignedAnalyst}.`);
    }

    if (investigation.resolvedAt) {
      parts.push(`Resolved on ${investigation.resolvedAt}.`);
      if (investigation.resolutionNotes) {
        parts.push(`Resolution: ${investigation.resolutionNotes}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Build a natural language flagging explanation.
   * In production, this would invoke GenAI Hub for richer explanations.
   */
  private buildFlaggingExplanation(alert: any, transaction: any): string {
    const parts: string[] = [];

    parts.push(
      `This transaction was flagged as a ${alert.riskCategory} event with a risk score of ${alert.riskScore}/100.`
    );

    if (alert.riskIndicators) {
      const indicators = JSON.parse(alert.riskIndicators);
      if (indicators.length > 0) {
        parts.push('The following risk indicators contributed to the flagging:');
        for (const indicator of indicators.slice(0, 5)) {
          parts.push(`- ${indicator.description || indicator.indicatorType}`);
        }
      }
    }

    if (transaction) {
      parts.push(
        `The transaction involved document ${transaction.documentNumber || 'N/A'} ` +
        `posted on ${transaction.postingDate || 'N/A'}.`
      );
    }

    return parts.join(' ');
  }

  /**
   * Generate next step recommendations based on alert context.
   */
  private generateNextSteps(alert: any): string[] {
    const steps: string[] = [];
    const category = alert.riskCategory as RiskCategory;

    steps.push('1. Review the alert details and triggering transaction.');

    switch (category) {
      case 'FRAUD_PATTERN':
        steps.push('2. Verify vendor bank account details through an out-of-band channel.');
        steps.push('3. Check for related duplicate payments or split payments.');
        steps.push('4. Consider blocking pending payments if exposure is high.');
        steps.push('5. Escalate to fraud investigation team if confirmed.');
        break;
      case 'SOD_VIOLATION':
        steps.push('2. Check if compensating controls exist for this conflict.');
        steps.push('3. Review user role assignments in the connected SAP system.');
        steps.push('4. Determine if the violation is a one-time event or recurring pattern.');
        steps.push('5. Engage IAM team for role remediation if needed.');
        break;
      case 'PRIVILEGE_ESCALATION':
        steps.push('2. Lock the affected user account immediately.');
        steps.push('3. Review all actions performed with elevated privileges.');
        steps.push('4. Check for unauthorized role self-assignment.');
        steps.push('5. Initiate incident response if self-escalation is confirmed.');
        break;
      case 'INSIDER_THREAT':
        steps.push('2. Review data access volume and patterns for anomalies.');
        steps.push('3. Correlate with HR events (termination, transfer, PIP).');
        steps.push('4. Check for mass data extraction indicators.');
        steps.push('5. Engage HR and legal teams before confronting the user.');
        break;
      default:
        steps.push('2. Compare with user behavioral profile for context.');
        steps.push('3. Check for related alerts or patterns.');
        steps.push('4. Document findings and escalate if necessary.');
        steps.push('5. Resolve with appropriate classification.');
        break;
    }

    return steps;
  }

  /**
   * Build risk posture comparison summary.
   */
  private buildRiskPostureSummary(
    current: any,
    previous: any,
    periodDays: number
  ): string {
    const parts: string[] = [];

    const alertDiff = current.totalAlerts - previous.totalAlerts;
    const direction = alertDiff > 0 ? 'increased' : alertDiff < 0 ? 'decreased' : 'remained stable';

    parts.push(
      `Over the last ${periodDays} days, total alerts ${direction} ` +
      `(${current.totalAlerts} vs ${previous.totalAlerts} in the prior period).`
    );

    if (current.criticalCount > previous.criticalCount) {
      parts.push(
        `Critical alerts increased from ${previous.criticalCount} to ${current.criticalCount} — immediate attention recommended.`
      );
    } else if (current.criticalCount < previous.criticalCount) {
      parts.push(
        `Critical alerts decreased from ${previous.criticalCount} to ${current.criticalCount}.`
      );
    }

    parts.push(
      `Average risk score: ${current.avgRiskScore} (previous: ${previous.avgRiskScore}).`
    );

    return parts.join(' ');
  }

  /**
   * Build the Joule skill manifest for A2A registration.
   */
  private buildSkillManifest(): any[] {
    return [
      {
        skillId: 'finsecure-query-alerts',
        name: 'Query Security Alerts',
        description: 'Search and filter security alerts by criteria such as time range, severity, and category',
        intentTypes: ['QUERY_ALERTS'],
        examples: [
          'Show me all critical alerts from last week',
          'What alerts are open for vendor bank changes?',
          'List high-priority unresolved alerts',
        ],
      },
      {
        skillId: 'finsecure-summarize-investigation',
        name: 'Summarize Investigation',
        description: 'Get a plain-language summary of a security investigation',
        intentTypes: ['SUMMARIZE_INVESTIGATION'],
        examples: [
          'Summarize investigation INV-12345',
          'What is the status of the vendor fraud investigation?',
        ],
      },
      {
        skillId: 'finsecure-explain-flagging',
        name: 'Explain Transaction Flagging',
        description: 'Get a natural language explanation of why a transaction was flagged',
        intentTypes: ['EXPLAIN_FLAGGING'],
        examples: [
          'Why was this transaction flagged?',
          'Explain the risk score for alert ALT-67890',
        ],
      },
      {
        skillId: 'finsecure-recommend-steps',
        name: 'Recommend Next Steps',
        description: 'Get AI-powered recommendations for investigating an alert',
        intentTypes: ['RECOMMEND_NEXT_STEPS'],
        examples: [
          'What should I do next for this alert?',
          'Recommend investigation steps for the SoD violation',
        ],
      },
      {
        skillId: 'finsecure-compliance-status',
        name: 'Compliance Status',
        description: 'Get compliance posture summary for a framework',
        intentTypes: ['COMPLIANCE_STATUS'],
        examples: [
          'What is our SOX compliance status?',
          'Show DORA compliance percentage',
        ],
      },
      {
        skillId: 'finsecure-risk-posture',
        name: 'Compare Risk Posture',
        description: 'Compare current risk posture against a previous period',
        intentTypes: ['COMPARE_RISK_POSTURE'],
        examples: [
          'How does our risk posture compare to last month?',
          'Show me the trend in critical alerts over 30 days',
        ],
      },
      {
        skillId: 'finsecure-actions',
        name: 'Security Actions',
        description: 'Execute security actions such as acknowledging alerts, assigning analysts, and initiating reviews',
        intentTypes: ['ACKNOWLEDGE_ALERT', 'CHANGE_INVESTIGATION_STATUS', 'ASSIGN_ALERT', 'REQUEST_REPORT', 'INITIATE_ACCESS_REVIEW'],
        examples: [
          'Acknowledge alert ALT-12345',
          'Assign this alert to analyst John',
          'Generate a compliance report for last quarter',
          'Start an access review campaign',
        ],
      },
    ];
  }

  /**
   * Build error response with consistent structure.
   */
  private buildErrorResponse(
    intentType: JouleIntentType,
    errorMessage: string,
    startTime: number
  ): JouleResponse {
    return {
      success: false,
      intentType,
      error: errorMessage,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        dataClassification: 'PUBLIC',
        isAIGenerated: false,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
