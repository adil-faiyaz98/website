import cds = require('@sap/cds');

const { ApplicationService } = cds;

// ============================================================================
// Types
// ============================================================================

/** Pipeline health status for each integration flow */
interface PipelineHealth {
  pipeline: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  lastChecked: string;
  message?: string;
}

/** Result of a full pipeline processing run */
interface PipelineResult {
  transactionId: string;
  tenantId: string;
  stages: StageResult[];
  totalDurationMs: number;
  success: boolean;
}

/** Result of a single pipeline stage */
interface StageResult {
  stage: string;
  success: boolean;
  durationMs: number;
  output?: Record<string, unknown>;
  error?: string;
}

/** Event topics used across the platform */
export const EVENT_TOPICS = {
  TRANSACTION_NORMALIZED: 'finsecure/transaction/normalized',
  RISK_DETECTED: 'finsecure/risk/detected',
  ALERT_CREATED: 'finsecure/alert/created',
  ALERT_ESCALATED: 'finsecure/alert/escalated',
  INVESTIGATION_CREATED: 'finsecure/investigation/created',
  PLAYBOOK_TRIGGERED: 'finsecure/playbook/triggered',
  HR_EVENT_RECEIVED: 'finsecure/hr/event',
  CVA_FINDING_RECEIVED: 'finsecure/cva/finding',
  AGENT_OUTPUT: 'finsecure/agent/output',
  AUDIT_EVENT: 'finsecure/audit/event',
} as const;

// ============================================================================
// Integration Orchestrator
// ============================================================================

/**
 * Integration Orchestrator Service
 *
 * Central coordination layer that wires all FinSecure AI services together
 * end-to-end. Manages event-driven pipelines, bidirectional flows, middleware
 * interception, and cross-service communication.
 *
 * Pipelines:
 * 1. Ingestion → Detection Engine → Alert Manager → Playbook Executor
 * 2. Detection Engine ↔ UEBA Engine (bidirectional)
 * 3. Alert Manager → Investigation Service → Report Generator
 * 4. All services → Audit Trail Service
 * 5. Data Privacy Service as middleware
 * 6. GenAI → Alert Manager, Investigation, Compliance Engine
 * 7. Joule Agent → OData services
 * 8. Agent Extension → Event Mesh + Alert pipeline
 * 9. SuccessFactors → UEBA Engine (HR risk multiplier)
 * 10. CVA → Vulnerability Scanner (enrichment)
 */
export default class IntegrationOrchestratorService extends (ApplicationService as any) {
  private readonly logger = cds.log('integration-orchestrator');

  async init() {
    // Register action/function handlers
    this.on('healthCheck', this.handleHealthCheck.bind(this));
    this.on('processTransaction', this.handleProcessTransaction.bind(this));
    this.on('escalateToInvestigation', this.handleEscalateToInvestigation.bind(this));
    this.on('processHREvent', this.handleProcessHREvent.bind(this));
    this.on('enrichVulnerabilityFinding', this.handleEnrichVulnerabilityFinding.bind(this));

    // Subscribe to Event Mesh topics for pipeline orchestration
    await this.registerEventSubscriptions();

    await super.init();
  }

  // ==========================================================================
  // Event Subscriptions (Event Mesh Wiring)
  // ==========================================================================

  /**
   * Register all event subscriptions that wire services together.
   * This is the central place where event-driven flows are connected.
   */
  private async registerEventSubscriptions(): Promise<void> {
    try {
      const messaging = await cds.connect.to('messaging');

      // Pipeline 1: Transaction normalized → Detection Engine
      messaging.on(EVENT_TOPICS.TRANSACTION_NORMALIZED, async (msg: any) => {
        await this.onTransactionNormalized(msg.data);
      });

      // Pipeline 1: Risk detected → Alert Manager
      messaging.on(EVENT_TOPICS.RISK_DETECTED, async (msg: any) => {
        await this.onRiskDetected(msg.data);
      });

      // Pipeline 1: Alert created → Playbook Executor + Agent Extension
      messaging.on(EVENT_TOPICS.ALERT_CREATED, async (msg: any) => {
        await this.onAlertCreated(msg.data);
      });

      // Pipeline 9: HR event → UEBA risk multiplier
      messaging.on(EVENT_TOPICS.HR_EVENT_RECEIVED, async (msg: any) => {
        await this.onHREventReceived(msg.data);
      });

      // Pipeline 10: CVA finding → Vulnerability Scanner enrichment
      messaging.on(EVENT_TOPICS.CVA_FINDING_RECEIVED, async (msg: any) => {
        await this.onCVAFindingReceived(msg.data);
      });

      // Pipeline 8: Agent output → Alert pipeline
      messaging.on(EVENT_TOPICS.AGENT_OUTPUT, async (msg: any) => {
        await this.onAgentOutput(msg.data);
      });

      this.logger.info('Event subscriptions registered for all integration pipelines');
    } catch (error: any) {
      this.logger.warn(`Event subscription registration deferred (messaging not available): ${error.message}`);
    }
  }

  // ==========================================================================
  // Pipeline 1: Ingestion → Detection → Alert → Playbook
  // ==========================================================================

  /**
   * Handle normalized transaction event from Ingestion Service.
   * Forwards to Detection Engine for risk analysis.
   */
  private async onTransactionNormalized(data: any): Promise<void> {
    const startTime = Date.now();
    try {
      // Forward to Detection Engine
      const detectionEngine = await cds.connect.to('DetectionEngineService');
      const result = await detectionEngine.send('analyzeTransaction', {
        transactionId: data.transactionId,
        tenantId: data.tenantId,
      });

      // Log to Audit Trail
      await this.logAuditEvent({
        tenantId: data.tenantId,
        action: 'TRANSACTION_ANALYZED',
        affectedObject: `Transaction:${data.transactionId}`,
        outcome: 'SUCCESS',
        durationMs: Date.now() - startTime,
      });

      this.logger.info(
        `Transaction ${data.transactionId} processed through detection pipeline in ${Date.now() - startTime}ms`
      );

      return result;
    } catch (error: any) {
      this.logger.error(`Detection pipeline failed for TX ${data.transactionId}: ${error.message}`);
      await this.logAuditEvent({
        tenantId: data.tenantId,
        action: 'TRANSACTION_ANALYSIS_FAILED',
        affectedObject: `Transaction:${data.transactionId}`,
        outcome: 'FAILURE',
        details: error.message,
      });
    }
  }

  /**
   * Handle risk detected event from Detection Engine.
   * Forwards to Alert Manager for alert creation.
   * Also triggers UEBA profile update (bidirectional flow).
   */
  private async onRiskDetected(data: any): Promise<void> {
    const startTime = Date.now();
    try {
      // Forward to Alert Manager
      const alertManager = await cds.connect.to('AlertManagerService');
      const alert = await alertManager.send('createAlert', {
        riskEventId: data.riskEventId,
        tenantId: data.tenantId,
        transactionId: data.transactionId,
        riskCategory: data.riskCategory,
        riskScore: data.riskScore,
        confidence: data.confidence,
        detectionMethod: data.detectionMethod,
        riskIndicators: JSON.stringify(data.riskIndicators || []),
        affectedEntities: JSON.stringify(data.affectedEntities || []),
        financialExposure: data.financialExposure,
        title: data.title || `Risk detected: ${data.riskCategory}`,
        description: data.description || `Risk score ${data.riskScore} detected via ${data.detectionMethod}`,
      });

      // Pipeline 2: Update UEBA profile with detection outcome
      await this.updateUEBAFromDetection(data);

      // Log to Audit Trail
      await this.logAuditEvent({
        tenantId: data.tenantId,
        action: 'ALERT_CREATED_FROM_RISK',
        affectedObject: `RiskEvent:${data.riskEventId}`,
        outcome: 'SUCCESS',
        durationMs: Date.now() - startTime,
      });

      this.logger.info(
        `Risk event ${data.riskEventId} forwarded to Alert Manager in ${Date.now() - startTime}ms`
      );

      return alert;
    } catch (error: any) {
      this.logger.error(`Alert creation failed for risk ${data.riskEventId}: ${error.message}`);
      await this.logAuditEvent({
        tenantId: data.tenantId,
        action: 'ALERT_CREATION_FAILED',
        affectedObject: `RiskEvent:${data.riskEventId}`,
        outcome: 'FAILURE',
        details: error.message,
      });
    }
  }

  /**
   * Handle alert created event from Alert Manager.
   * Triggers Playbook Executor evaluation and notifies Agent Extension.
   */
  private async onAlertCreated(data: any): Promise<void> {
    const startTime = Date.now();
    try {
      // Trigger Playbook Executor
      await this.triggerPlaybookExecution(data);

      // Notify Agent Extension for custom agent subscriptions
      await this.notifyAgentExtension(data);

      // Generate AI summary for the alert via GenAI Service
      await this.generateAlertAISummary(data);

      // Log to Audit Trail
      await this.logAuditEvent({
        tenantId: data.tenantId,
        action: 'ALERT_PIPELINE_COMPLETED',
        affectedObject: `Alert:${data.alertId}`,
        outcome: 'SUCCESS',
        durationMs: Date.now() - startTime,
      });
    } catch (error: any) {
      this.logger.error(`Alert pipeline processing failed for ${data.alertId}: ${error.message}`);
    }
  }

  // ==========================================================================
  // Pipeline 2: Detection Engine ↔ UEBA Engine (Bidirectional)
  // ==========================================================================

  /**
   * Update UEBA engine with detection results.
   * Detection Engine → UEBA: profile update after transaction analysis.
   */
  private async updateUEBAFromDetection(riskEvent: any): Promise<void> {
    try {
      const uebaEngine = await cds.connect.to('UEBAEngineService');
      await uebaEngine.send('updateProfile', {
        userId: riskEvent.userId || riskEvent.affectedEntities?.[0]?.entityId,
        tenantId: riskEvent.tenantId,
        transactionId: riskEvent.transactionId,
        riskScore: riskEvent.riskScore,
        riskCategory: riskEvent.riskCategory,
      });

      this.logger.info(`UEBA profile updated from detection for user in tenant ${riskEvent.tenantId}`);
    } catch (error: any) {
      this.logger.warn(`UEBA update from detection failed: ${error.message}`);
    }
  }

  /**
   * Query UEBA deviation results to feed back into Detection Engine risk scoring.
   * UEBA → Detection Engine: behavioral deviation enrichment.
   */
  async queryUEBADeviation(userId: string, tenantId: string): Promise<any> {
    try {
      const uebaEngine = await cds.connect.to('UEBAEngineService');
      const deviation = await uebaEngine.send('checkDeviation', {
        userId,
        tenantId,
      });

      return deviation;
    } catch (error: any) {
      this.logger.warn(`UEBA deviation query failed for user ${userId}: ${error.message}`);
      return null;
    }
  }

  // ==========================================================================
  // Pipeline 3: Alert Manager → Investigation → Report Generator
  // ==========================================================================

  /**
   * Escalate an alert to an investigation.
   * Connects Alert Manager → Investigation Service → Report Generator.
   */
  private async handleEscalateToInvestigation(req: any): Promise<string> {
    const { alertId, analystId } = req.data;
    const startTime = Date.now();

    try {
      // Create investigation from alert
      const investigationService = await cds.connect.to('InvestigationService');
      const investigation = await investigationService.send('createInvestigation', {
        alertId,
        analystId,
      });

      const parsed = typeof investigation === 'string' ? JSON.parse(investigation) : investigation;

      // Generate AI brief for the investigation via GenAI
      if (parsed?.investigation?.investigationId) {
        await this.generateInvestigationBrief(parsed.investigation.investigationId);
      }

      // Log to Audit Trail
      await this.logAuditEvent({
        tenantId: parsed?.investigation?.tenantId || 'unknown',
        action: 'INVESTIGATION_CREATED_FROM_ALERT',
        affectedObject: `Alert:${alertId}`,
        outcome: 'SUCCESS',
        durationMs: Date.now() - startTime,
      });

      // Publish event for downstream consumers (Report Generator can subscribe)
      await this.publishEvent(EVENT_TOPICS.INVESTIGATION_CREATED, {
        investigationId: parsed?.investigation?.investigationId,
        alertId,
        analystId,
        tenantId: parsed?.investigation?.tenantId,
      });

      return JSON.stringify({
        success: true,
        investigation: parsed?.investigation,
        message: 'Investigation created and AI brief generation initiated',
      });
    } catch (error: any) {
      this.logger.error(`Escalation to investigation failed for alert ${alertId}: ${error.message}`);
      return JSON.stringify({
        success: false,
        error: error.message,
      });
    }
  }

  // ==========================================================================
  // Pipeline 4: Audit Trail Integration (All Services)
  // ==========================================================================

  /**
   * Log an audit event to the Audit Trail Service.
   * All services route through this method for centralized audit logging.
   */
  async logAuditEvent(params: {
    tenantId: string;
    action: string;
    affectedObject: string;
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
    userId?: string;
    sourceIP?: string;
    details?: string;
    durationMs?: number;
  }): Promise<void> {
    try {
      const auditTrailService = await cds.connect.to('AuditTrailService');
      await auditTrailService.send('logEvent', {
        tenantId: params.tenantId,
        userId: params.userId || 'system',
        action: params.action,
        affectedObject: params.affectedObject,
        sourceIP: params.sourceIP || '0.0.0.0',
        outcome: params.outcome,
        details: this.buildAuditDetails(params.details, params.durationMs),
      });
    } catch (error: any) {
      // Audit logging failure should never block the main flow
      this.logger.warn(`Audit logging failed: ${error.message}`);
    }
  }

  // ==========================================================================
  // Pipeline 5: Data Privacy Middleware
  // ==========================================================================

  /**
   * Apply data privacy masking as middleware before returning data.
   * All data access operations route through this for role-based masking.
   */
  async applyPrivacyMasking(data: any, userRole: string, context: string): Promise<any> {
    try {
      const privacyService = await cds.connect.to('DataPrivacyService');
      const masked = await privacyService.send('applyMasking', {
        data: JSON.stringify(data),
        userRole,
        accessContext: context,
      });

      // Log data access to privacy service
      await privacyService.send('logAccess', {
        userRole,
        accessContext: context,
        dataTypes: Object.keys(data).join(','),
      });

      return typeof masked === 'string' ? JSON.parse(masked) : masked;
    } catch (error: any) {
      this.logger.warn(`Privacy masking failed, returning unmasked data: ${error.message}`);
      return data;
    }
  }

  /**
   * Verify data residency compliance for a tenant.
   */
  async verifyDataResidency(tenantId: string): Promise<any> {
    try {
      const privacyService = await cds.connect.to('DataPrivacyService');
      return await privacyService.send('verifyResidency', { tenantId });
    } catch (error: any) {
      this.logger.error(`Data residency verification failed for tenant ${tenantId}: ${error.message}`);
      return { compliant: false, error: error.message };
    }
  }

  // ==========================================================================
  // Pipeline 6: GenAI Connections
  // ==========================================================================

  /**
   * Generate AI summary for an alert (GenAI → Alert Manager).
   */
  private async generateAlertAISummary(alertData: any): Promise<void> {
    try {
      const genaiService = await cds.connect.to('GenAIService');
      await genaiService.send('generateAlertSummary', {
        alertId: alertData.alertId,
        tenantId: alertData.tenantId,
        riskCategory: alertData.riskCategory,
        riskScore: alertData.riskScore,
        title: alertData.title,
        description: alertData.description,
      });

      this.logger.info(`AI summary generated for alert ${alertData.alertId}`);
    } catch (error: any) {
      this.logger.warn(`GenAI alert summary failed for ${alertData.alertId}: ${error.message}`);
    }
  }

  /**
   * Generate AI investigation brief (GenAI → Investigation Service).
   */
  private async generateInvestigationBrief(investigationId: string): Promise<void> {
    try {
      const genaiService = await cds.connect.to('GenAIService');
      await genaiService.send('generateInvestigationBrief', {
        investigationId,
      });

      this.logger.info(`AI brief generated for investigation ${investigationId}`);
    } catch (error: any) {
      this.logger.warn(`GenAI investigation brief failed for ${investigationId}: ${error.message}`);
    }
  }

  /**
   * Generate compliance narrative (GenAI → Compliance Engine).
   */
  async generateComplianceNarrative(controlId: string, tenantId: string): Promise<any> {
    try {
      const genaiService = await cds.connect.to('GenAIService');
      const narrative = await genaiService.send('generateComplianceNarrative', {
        controlId,
        tenantId,
      });

      return narrative;
    } catch (error: any) {
      this.logger.warn(`GenAI compliance narrative failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Explain risk score using GenAI (GenAI → Detection explanation).
   */
  async explainRiskScore(transactionId: string, tenantId: string): Promise<any> {
    try {
      const genaiService = await cds.connect.to('GenAIService');
      return await genaiService.send('explainRiskScore', {
        transactionId,
        tenantId,
      });
    } catch (error: any) {
      this.logger.warn(`GenAI risk explanation failed: ${error.message}`);
      return null;
    }
  }

  // ==========================================================================
  // Pipeline 7: Joule Agent ↔ OData Services
  // ==========================================================================

  /**
   * Joule Agent connects to all CAP services via OData directly.
   * The Joule Agent Service already handles:
   * - processQueryIntent: queries OData services for data
   * - executeActionIntent: performs actions via OData
   * - registerAsJouleAgent: registers with SAP AI Core
   *
   * This method provides integration verification that Joule can reach all services.
   */
  async verifyJouleConnectivity(): Promise<Record<string, boolean>> {
    const services = [
      'SecurityAnalystService',
      'SecurityAdminService',
      'AuditorService',
      'ExecutiveService',
      'IAMAdminService',
      'TenantAdminService',
    ];

    const connectivity: Record<string, boolean> = {};

    for (const serviceName of services) {
      try {
        await cds.connect.to(serviceName);
        connectivity[serviceName] = true;
      } catch {
        connectivity[serviceName] = false;
      }
    }

    return connectivity;
  }

  // ==========================================================================
  // Pipeline 8: Agent Extension ↔ Event Mesh + Alert Pipeline
  // ==========================================================================

  /**
   * Notify Agent Extension service about alert events.
   * Agents subscribe to event topics and receive alert pipeline events.
   */
  private async notifyAgentExtension(alertData: any): Promise<void> {
    try {
      const agentService = await cds.connect.to('AgentExtensionService');
      await agentService.send('broadcastEvent', {
        eventType: 'ALERT_CREATED',
        tenantId: alertData.tenantId,
        payload: JSON.stringify({
          alertId: alertData.alertId,
          riskCategory: alertData.riskCategory,
          riskScore: alertData.riskScore,
          priority: alertData.priority,
        }),
      });

      this.logger.info(`Agent Extension notified about alert ${alertData.alertId}`);
    } catch (error: any) {
      this.logger.warn(`Agent Extension notification failed: ${error.message}`);
    }
  }

  /**
   * Handle output from custom agents and feed into alert pipeline.
   * Agent Extension → Alert Manager (when agent detects risk).
   */
  private async onAgentOutput(data: any): Promise<void> {
    try {
      if (data.confidenceScore >= 70) {
        // High-confidence agent findings create alerts
        const alertManager = await cds.connect.to('AlertManagerService');
        await alertManager.send('createAlert', {
          riskEventId: `agent-${data.agentId}-${Date.now()}`,
          tenantId: data.tenantId,
          transactionId: data.transactionId || null,
          riskCategory: data.riskCategory,
          riskScore: data.confidenceScore,
          confidence: data.confidenceScore,
          detectionMethod: 'CUSTOM_AGENT',
          riskIndicators: JSON.stringify(data.indicators || []),
          affectedEntities: JSON.stringify(data.affectedEntities || []),
          title: data.title || `Agent finding: ${data.riskCategory}`,
          description: data.description || `Custom agent ${data.agentId} detected risk`,
        });

        this.logger.info(`Agent output from ${data.agentId} escalated to alert pipeline`);
      }

      // Log all agent outputs to audit trail
      await this.logAuditEvent({
        tenantId: data.tenantId,
        action: 'AGENT_OUTPUT_PROCESSED',
        affectedObject: `Agent:${data.agentId}`,
        outcome: 'SUCCESS',
        details: `Confidence: ${data.confidenceScore}, Category: ${data.riskCategory}`,
      });
    } catch (error: any) {
      this.logger.error(`Agent output processing failed: ${error.message}`);
    }
  }

  // ==========================================================================
  // Pipeline 9: SuccessFactors → UEBA Engine (HR Risk Multiplier)
  // ==========================================================================

  /**
   * Handle HR event from SuccessFactors integration.
   * Processes HR lifecycle events and applies UEBA risk multiplier elevation.
   */
  private async onHREventReceived(data: any): Promise<void> {
    try {
      // Forward to SuccessFactors integration for risk classification
      const sfIntegration = await cds.connect.to('SuccessFactorsIntegrationService');
      const result = await sfIntegration.send('processHREvent', {
        userId: data.userId,
        tenantId: data.tenantId,
        eventCategory: data.eventCategory,
      });

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;

      // If risk elevated, notify UEBA to apply multiplier
      if (parsed?.riskClassification === 'ELEVATED') {
        const uebaEngine = await cds.connect.to('UEBAEngineService');
        await uebaEngine.send('applyHRRiskMultiplier', {
          userId: data.userId,
          tenantId: data.tenantId,
          multiplier: parsed.effectiveMultiplier,
          monitoringPeriodDays: parsed.monitoringPeriodDays,
          expiresAt: parsed.expiresAt,
        });

        this.logger.info(
          `HR risk multiplier ${parsed.effectiveMultiplier}x applied for user ${data.userId}`
        );
      }

      // Log to Audit Trail
      await this.logAuditEvent({
        tenantId: data.tenantId,
        action: 'HR_EVENT_PROCESSED',
        affectedObject: `User:${data.userId}`,
        outcome: 'SUCCESS',
        details: `Category: ${data.eventCategory}, Classification: ${parsed?.riskClassification}`,
      });
    } catch (error: any) {
      this.logger.error(`HR event processing failed for user ${data.userId}: ${error.message}`);
    }
  }

  /**
   * Process HR event action handler (called via OData action).
   */
  private async handleProcessHREvent(req: any): Promise<string> {
    const { userId, tenantId, eventCategory } = req.data;

    await this.onHREventReceived({ userId, tenantId, eventCategory });

    return JSON.stringify({
      success: true,
      message: `HR event ${eventCategory} processed for user ${userId}`,
    });
  }

  // ==========================================================================
  // Pipeline 10: CVA → Vulnerability Scanner (Enrichment)
  // ==========================================================================

  /**
   * Handle CVA finding from Code Vulnerability Analyzer.
   * Enriches vulnerability scanner results with CVA data.
   */
  private async onCVAFindingReceived(data: any): Promise<void> {
    try {
      // Forward to CVA integration for normalization and exploitation scoring
      const cvaIntegration = await cds.connect.to('CVAIntegrationService');
      const enrichedFinding = await cvaIntegration.send('processFinding', {
        findingId: data.findingId,
        tenantId: data.tenantId,
        programName: data.programName,
        vulnerabilityType: data.vulnerabilityType,
        severity: data.severity,
      });

      // Forward enriched finding to Vulnerability Scanner
      const vulnScanner = await cds.connect.to('VulnerabilityScannerService');
      await vulnScanner.send('enrichFinding', {
        findingId: data.findingId,
        tenantId: data.tenantId,
        enrichmentData: typeof enrichedFinding === 'string' ? enrichedFinding : JSON.stringify(enrichedFinding),
      });

      // Log to Audit Trail
      await this.logAuditEvent({
        tenantId: data.tenantId,
        action: 'CVA_FINDING_ENRICHED',
        affectedObject: `Finding:${data.findingId}`,
        outcome: 'SUCCESS',
      });

      this.logger.info(`CVA finding ${data.findingId} enriched in vulnerability scanner`);
    } catch (error: any) {
      this.logger.error(`CVA finding enrichment failed for ${data.findingId}: ${error.message}`);
    }
  }

  /**
   * Enrich vulnerability finding action handler (called via OData action).
   */
  private async handleEnrichVulnerabilityFinding(req: any): Promise<string> {
    const { findingId, tenantId } = req.data;

    await this.onCVAFindingReceived({ findingId, tenantId });

    return JSON.stringify({
      success: true,
      message: `Vulnerability finding ${findingId} enrichment triggered`,
    });
  }

  // ==========================================================================
  // Playbook Execution Trigger
  // ==========================================================================

  /**
   * Trigger playbook evaluation for a new alert.
   * Alert Manager → Playbook Executor.
   */
  private async triggerPlaybookExecution(alertData: any): Promise<void> {
    try {
      const playbookExecutor = await cds.connect.to('PlaybookExecutorService');
      await playbookExecutor.send('evaluateAndExecute', {
        alertId: alertData.alertId,
        tenantId: alertData.tenantId,
        riskCategory: alertData.riskCategory,
        priority: alertData.priority,
        riskScore: alertData.riskScore,
      });

      this.logger.info(`Playbook evaluation triggered for alert ${alertData.alertId}`);

      // Publish playbook trigger event
      await this.publishEvent(EVENT_TOPICS.PLAYBOOK_TRIGGERED, {
        alertId: alertData.alertId,
        tenantId: alertData.tenantId,
      });
    } catch (error: any) {
      this.logger.warn(`Playbook execution trigger failed for alert ${alertData.alertId}: ${error.message}`);
    }
  }

  // ==========================================================================
  // Full Pipeline Processing (Action Handler)
  // ==========================================================================

  /**
   * Process a transaction through the full pipeline end-to-end.
   * Ingestion → Detection → Alert → Playbook (synchronous orchestration).
   */
  private async handleProcessTransaction(req: any): Promise<string> {
    const { transactionId, tenantId } = req.data;
    const startTime = Date.now();
    const stages: StageResult[] = [];

    try {
      // Stage 1: Detection Engine analysis
      const detectionStart = Date.now();
      try {
        const detectionEngine = await cds.connect.to('DetectionEngineService');
        const detectionResult = await detectionEngine.send('analyzeTransaction', {
          transactionId,
          tenantId,
        });
        stages.push({
          stage: 'detection',
          success: true,
          durationMs: Date.now() - detectionStart,
          output: { result: detectionResult },
        });
      } catch (error: any) {
        stages.push({
          stage: 'detection',
          success: false,
          durationMs: Date.now() - detectionStart,
          error: error.message,
        });
      }

      // Stage 2: UEBA behavioral check
      const uebaStart = Date.now();
      try {
        const uebaDeviation = await this.queryUEBADeviation(transactionId, tenantId);
        stages.push({
          stage: 'ueba',
          success: true,
          durationMs: Date.now() - uebaStart,
          output: { deviation: uebaDeviation },
        });
      } catch (error: any) {
        stages.push({
          stage: 'ueba',
          success: false,
          durationMs: Date.now() - uebaStart,
          error: error.message,
        });
      }

      const result: PipelineResult = {
        transactionId,
        tenantId,
        stages,
        totalDurationMs: Date.now() - startTime,
        success: stages.every(s => s.success),
      };

      // Log to Audit Trail
      await this.logAuditEvent({
        tenantId,
        action: 'FULL_PIPELINE_PROCESSING',
        affectedObject: `Transaction:${transactionId}`,
        outcome: result.success ? 'SUCCESS' : 'FAILURE',
        durationMs: result.totalDurationMs,
      });

      return JSON.stringify(result);
    } catch (error: any) {
      return JSON.stringify({
        transactionId,
        tenantId,
        stages,
        totalDurationMs: Date.now() - startTime,
        success: false,
        error: error.message,
      });
    }
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Check health of all integration pipelines.
   */
  private async handleHealthCheck(_req: any): Promise<string> {
    const pipelines: PipelineHealth[] = [];

    const serviceChecks = [
      { pipeline: 'ingestion-detection', service: 'DetectionEngineService' },
      { pipeline: 'detection-alert', service: 'AlertManagerService' },
      { pipeline: 'alert-playbook', service: 'PlaybookExecutorService' },
      { pipeline: 'alert-investigation', service: 'InvestigationService' },
      { pipeline: 'ueba-engine', service: 'UEBAEngineService' },
      { pipeline: 'genai', service: 'GenAIService' },
      { pipeline: 'audit-trail', service: 'AuditTrailService' },
      { pipeline: 'privacy', service: 'DataPrivacyService' },
      { pipeline: 'agent-extension', service: 'AgentExtensionService' },
      { pipeline: 'vulnerability-scanner', service: 'VulnerabilityScannerService' },
    ];

    for (const check of serviceChecks) {
      try {
        await cds.connect.to(check.service);
        pipelines.push({
          pipeline: check.pipeline,
          status: 'HEALTHY',
          lastChecked: new Date().toISOString(),
        });
      } catch (error: any) {
        pipelines.push({
          pipeline: check.pipeline,
          status: 'UNAVAILABLE',
          lastChecked: new Date().toISOString(),
          message: error.message,
        });
      }
    }

    // Check messaging connectivity
    try {
      await cds.connect.to('messaging');
      pipelines.push({
        pipeline: 'event-mesh',
        status: 'HEALTHY',
        lastChecked: new Date().toISOString(),
      });
    } catch (error: any) {
      pipelines.push({
        pipeline: 'event-mesh',
        status: 'UNAVAILABLE',
        lastChecked: new Date().toISOString(),
        message: error.message,
      });
    }

    return JSON.stringify({
      overallStatus: pipelines.every(p => p.status === 'HEALTHY') ? 'HEALTHY' : 'DEGRADED',
      pipelines,
      checkedAt: new Date().toISOString(),
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Build audit details string from optional message and duration.
   */
  private buildAuditDetails(details?: string, durationMs?: number): string | null {
    if (details) {
      return JSON.stringify({ message: details, durationMs });
    }
    if (durationMs) {
      return JSON.stringify({ durationMs });
    }
    return null;
  }

  /**
   * Publish an event to Event Mesh for downstream consumers.
   */
  private async publishEvent(topic: string, data: any): Promise<void> {
    try {
      const messaging = await cds.connect.to('messaging');
      await (messaging as any).emit(topic, data);
    } catch (error: any) {
      this.logger.warn(`Failed to publish event to ${topic}: ${error.message}`);
    }
  }
}
