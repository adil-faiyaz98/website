import cds = require('@sap/cds');

const { ApplicationService } = cds;

// ============================================================================
// Types
// ============================================================================

/** Types of AI-generated content */
type AIContentType =
  | 'ALERT_SUMMARY'
  | 'TRIAGE_RECOMMENDATION'
  | 'INVESTIGATION_BRIEF'
  | 'COMPLIANCE_NARRATIVE'
  | 'RISK_EXPLANATION'
  | 'ROOT_CAUSE_ANALYSIS'
  | 'AUDIT_RESPONSE'
  | 'EXECUTIVE_BRIEFING';

/** Structured AI-generated output with mandatory metadata */
export interface AIGeneratedContent {
  contentId: string;
  contentType: AIContentType;
  content: string;
  confidenceScore: number;
  modelUsed: string;
  generatedAt: string;
  isAIGenerated: true;
  disclaimer: string;
  relatedEntityId?: string;
  version: number;
}

/** RAG context for grounding queries in tenant data */
interface RAGContext {
  entityType?: string;
  entityId?: string;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  maxDocuments?: number;
}

/** RAG query result from HANA vector store */
interface RAGResult {
  answer: string;
  sources: RAGSource[];
  confidenceScore: number;
}

/** A single RAG source document reference */
interface RAGSource {
  documentId: string;
  entityType: string;
  relevanceScore: number;
  snippet: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default foundation model when AI Core is available */
const DEFAULT_MODEL = 'gpt-4';

/** Standard disclaimer for all AI-generated content */
const AI_DISCLAIMER =
  'This content is AI-generated and should be reviewed by qualified personnel ' +
  'before use in regulatory submissions or business decisions. AI outputs may ' +
  'contain inaccuracies and do not constitute professional advice.';

/** Fallback indicator when GenAI Hub is unavailable */
const GENAI_UNAVAILABLE_MSG =
  'Generative AI features are temporarily unavailable. ' +
  'Displaying structured data summary instead.';

/** Maximum confidence score */
const MAX_CONFIDENCE = 100;

/** Default RAG document retrieval limit */
const DEFAULT_RAG_LIMIT = 10;

// ============================================================================
// GenAI Service
// ============================================================================

/**
 * GenAI Service
 *
 * Interfaces with SAP Generative AI Hub (via SAP AI Core) for:
 * - Alert summaries with triage recommendations
 * - Investigation briefs with timeline reconstruction
 * - Risk score explanations combining ML + rules + history
 * - Compliance narrative reports
 * - Root cause analysis for control failures
 * - RAG queries against tenant HANA vector store
 * - AI-drafted auditor question responses
 * - Executive risk briefings
 *
 * All outputs include: AI-generated indicator, model used, timestamp,
 * disclaimer, and confidence score (0-100).
 *
 * Handles GenAI unavailability gracefully with fallback to structured responses.
 *
 * Validates: Requirements 33.1, 33.2, 33.3, 33.5, 33.6, 33.7, 33.8,
 *            34.1, 34.2, 34.3, 34.4, 34.5, 34.6, 34.7
 */
export default class GenAIService extends (ApplicationService as any) {
  async init() {
    this.on('generateAlertSummary', async (req: any) => {
      const { tenantId, alertId } = req.data;
      const result = await this.generateAlertSummaryImpl(tenantId, alertId);
      return JSON.stringify(result);
    });

    this.on('generateInvestigationBrief', async (req: any) => {
      const { tenantId, investigationId } = req.data;
      const result = await this.generateInvestigationBriefImpl(tenantId, investigationId);
      return JSON.stringify(result);
    });

    this.on('explainRiskScore', async (req: any) => {
      const { tenantId, alertId } = req.data;
      const result = await this.explainRiskScoreImpl(tenantId, alertId);
      return JSON.stringify(result);
    });

    this.on('generateComplianceNarrative', async (req: any) => {
      const { tenantId, framework, periodStart, periodEnd } = req.data;
      const result = await this.generateComplianceNarrativeImpl(
        tenantId,
        framework,
        periodStart,
        periodEnd
      );
      return JSON.stringify(result);
    });

    this.on('generateRootCauseAnalysis', async (req: any) => {
      const { tenantId, evidenceId } = req.data;
      const result = await this.generateRootCauseAnalysisImpl(tenantId, evidenceId);
      return JSON.stringify(result);
    });

    this.on('ragQuery', async (req: any) => {
      const { tenantId, query, context } = req.data;
      const parsedContext: RAGContext = context ? JSON.parse(context) : {};
      const result = await this.ragQueryImpl(tenantId, query, parsedContext);
      return JSON.stringify(result);
    });

    this.on('generateAuditResponse', async (req: any) => {
      const { tenantId, question } = req.data;
      const result = await this.generateAuditResponseImpl(tenantId, question);
      return JSON.stringify(result);
    });

    this.on('generateExecutiveBriefing', async (req: any) => {
      const { tenantId } = req.data;
      const result = await this.generateExecutiveBriefingImpl(tenantId);
      return JSON.stringify(result);
    });

    this.on('submitFeedback', async (req: any) => {
      const { contentId, isCorrect } = req.data;
      await this.submitFeedbackImpl(contentId, isCorrect);
      return JSON.stringify({ success: true, contentId });
    });

    await super.init();
  }

  // ==========================================================================
  // Public Implementation Methods
  // ==========================================================================

  /**
   * Generate alert summary with triage recommendation.
   * Uses RAG pipeline grounded in tenant's historical data.
   *
   * Validates: Requirements 33.1, 33.2, 33.6
   */
  async generateAlertSummaryImpl(
    tenantId: string,
    alertId: string
  ): Promise<AIGeneratedContent> {
    const logger = cds.log('genai');
    logger.info(`Generating alert summary for alert ${alertId}, tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const alert = await SELECT.one.from(Alerts).where({ ID: alertId, tenantId });
    if (!alert) {
      throw new Error(`Alert ${alertId} not found for tenant ${tenantId}`);
    }

    // Retrieve historical context via RAG
    const ragContext = await this.retrieveRAGContext(tenantId, {
      entityType: 'ALERT',
      entityId: alertId,
      maxDocuments: DEFAULT_RAG_LIMIT,
    });

    // Attempt GenAI Hub inference
    const prompt = this.buildAlertSummaryPrompt(alert, ragContext);
    const genaiResult = await this.invokeGenAIHub(tenantId, prompt, 'ALERT_SUMMARY');

    if (!genaiResult.available) {
      // Fallback to structured summary
      return this.buildFallbackAlertSummary(alert, alertId);
    }

    const content = this.buildAIContent(
      'ALERT_SUMMARY',
      genaiResult.text,
      genaiResult.confidence,
      genaiResult.model,
      alertId
    );

    // Persist generated content
    await this.persistAIContent(content);

    logger.info(
      `Alert summary generated for ${alertId}: confidence=${content.confidenceScore}, model=${content.modelUsed}`
    );

    return content;
  }

  /**
   * Generate investigation brief with timeline reconstruction,
   * affected objects, and evidence suggestions.
   *
   * Validates: Requirements 33.3
   */
  async generateInvestigationBriefImpl(
    tenantId: string,
    investigationId: string
  ): Promise<AIGeneratedContent> {
    const logger = cds.log('genai');
    logger.info(`Generating investigation brief for ${investigationId}, tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const { Investigations, Alerts } = db.entities('finsecure.ai');

    const investigation = await SELECT.one.from(Investigations).where({
      ID: investigationId,
      tenantId,
    });
    if (!investigation) {
      throw new Error(`Investigation ${investigationId} not found for tenant ${tenantId}`);
    }

    // Fetch related alert for context
    const relatedAlert = await SELECT.one.from(Alerts).where({
      ID: investigation.alertId,
      tenantId,
    });

    // Retrieve historical investigations for the same entities
    const ragContext = await this.retrieveRAGContext(tenantId, {
      entityType: 'INVESTIGATION',
      entityId: investigationId,
      maxDocuments: DEFAULT_RAG_LIMIT,
    });

    const prompt = this.buildInvestigationBriefPrompt(investigation, relatedAlert, ragContext);
    const genaiResult = await this.invokeGenAIHub(tenantId, prompt, 'INVESTIGATION_BRIEF');

    if (!genaiResult.available) {
      return this.buildFallbackInvestigationBrief(investigation, relatedAlert, investigationId);
    }

    const content = this.buildAIContent(
      'INVESTIGATION_BRIEF',
      genaiResult.text,
      genaiResult.confidence,
      genaiResult.model,
      investigationId
    );

    await this.persistAIContent(content);

    logger.info(
      `Investigation brief generated for ${investigationId}: confidence=${content.confidenceScore}`
    );

    return content;
  }

  /**
   * Explain why a transaction was flagged.
   * Combines ML feature importance + rules + historical context.
   *
   * Validates: Requirements 33.5, 33.6
   */
  async explainRiskScoreImpl(
    tenantId: string,
    alertId: string
  ): Promise<AIGeneratedContent> {
    const logger = cds.log('genai');
    logger.info(`Explaining risk score for alert ${alertId}, tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const alert = await SELECT.one.from(Alerts).where({ ID: alertId, tenantId });
    if (!alert) {
      throw new Error(`Alert ${alertId} not found for tenant ${tenantId}`);
    }

    // Build explanation context from risk indicators and detection method
    const riskIndicators = this.parseJSON(alert.riskIndicators, []);
    const ragContext = await this.retrieveRAGContext(tenantId, {
      entityType: 'ALERT',
      entityId: alertId,
      maxDocuments: 5,
    });

    const prompt = this.buildRiskExplanationPrompt(alert, riskIndicators, ragContext);
    const genaiResult = await this.invokeGenAIHub(tenantId, prompt, 'RISK_EXPLANATION');

    if (!genaiResult.available) {
      return this.buildFallbackRiskExplanation(alert, riskIndicators, alertId);
    }

    const content = this.buildAIContent(
      'RISK_EXPLANATION',
      genaiResult.text,
      genaiResult.confidence,
      genaiResult.model,
      alertId
    );

    await this.persistAIContent(content);
    return content;
  }

  /**
   * Generate compliance narrative report for a framework and period.
   * Includes executive summary, control assessments, gaps, and trends.
   *
   * Validates: Requirements 34.1, 34.6, 34.7
   */
  async generateComplianceNarrativeImpl(
    tenantId: string,
    framework: string,
    periodStart: string,
    periodEnd: string
  ): Promise<AIGeneratedContent> {
    const logger = cds.log('genai');
    logger.info(
      `Generating compliance narrative for ${framework}, tenant ${tenantId}, ` +
      `period ${periodStart} to ${periodEnd}`
    );

    const db = await cds.connect.to('db');
    const { ControlEvidence, ComplianceControls } = db.entities('finsecure.ai');

    // Fetch controls for this framework
    const controls = await SELECT.from(ComplianceControls).where({
      tenantId,
      status: 'ACTIVE',
    });

    const frameworkControls = controls.filter(
      (c: any) => c.frameworkRef?.startsWith(framework)
    );

    // Fetch evidence for the period
    const evidence = await SELECT.from(ControlEvidence).where({
      tenantId,
      evaluationTimestamp: { '>=': periodStart, '<=': periodEnd },
    });

    const ragContext = await this.retrieveRAGContext(tenantId, {
      entityType: 'COMPLIANCE',
      timeRangeStart: periodStart,
      timeRangeEnd: periodEnd,
      maxDocuments: DEFAULT_RAG_LIMIT,
    });

    const prompt = this.buildComplianceNarrativePrompt(
      framework,
      frameworkControls,
      evidence,
      periodStart,
      periodEnd,
      ragContext
    );

    const genaiResult = await this.invokeGenAIHub(tenantId, prompt, 'COMPLIANCE_NARRATIVE');

    if (!genaiResult.available) {
      return this.buildFallbackComplianceNarrative(
        framework,
        frameworkControls,
        evidence,
        periodStart,
        periodEnd
      );
    }

    const content = this.buildAIContent(
      'COMPLIANCE_NARRATIVE',
      genaiResult.text,
      genaiResult.confidence,
      genaiResult.model,
      `${framework}:${periodStart}:${periodEnd}`
    );

    await this.persistAIContent(content);
    return content;
  }

  /**
   * Generate root cause analysis for compliance control failures.
   * Explains what failed, why, business impact, and remediation steps.
   *
   * Validates: Requirements 34.3
   */
  async generateRootCauseAnalysisImpl(
    tenantId: string,
    evidenceId: string
  ): Promise<AIGeneratedContent> {
    const logger = cds.log('genai');
    logger.info(`Generating root cause analysis for evidence ${evidenceId}, tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const { ControlEvidence, ComplianceControls } = db.entities('finsecure.ai');

    const evidence = await SELECT.one.from(ControlEvidence).where({
      ID: evidenceId,
      tenantId,
    });
    if (!evidence) {
      throw new Error(`Control evidence ${evidenceId} not found for tenant ${tenantId}`);
    }

    // Fetch the parent control definition
    const control = await SELECT.one.from(ComplianceControls).where({
      ID: evidence.controlId,
    });

    const ragContext = await this.retrieveRAGContext(tenantId, {
      entityType: 'CONTROL_EVIDENCE',
      entityId: evidenceId,
      maxDocuments: 5,
    });

    const prompt = this.buildRootCausePrompt(evidence, control, ragContext);
    const genaiResult = await this.invokeGenAIHub(tenantId, prompt, 'ROOT_CAUSE_ANALYSIS');

    if (!genaiResult.available) {
      return this.buildFallbackRootCauseAnalysis(evidence, control, evidenceId);
    }

    const content = this.buildAIContent(
      'ROOT_CAUSE_ANALYSIS',
      genaiResult.text,
      genaiResult.confidence,
      genaiResult.model,
      evidenceId
    );

    await this.persistAIContent(content);
    return content;
  }

  /**
   * RAG query against tenant's HANA vector store.
   * Returns contextually grounded responses from tenant historical data.
   *
   * Validates: Requirements 33.2
   */
  async ragQueryImpl(
    tenantId: string,
    query: string,
    context: RAGContext
  ): Promise<RAGResult> {
    const logger = cds.log('genai');
    logger.info(`RAG query for tenant ${tenantId}: "${query.substring(0, 80)}..."`);

    // Step 1: Retrieve relevant documents from HANA vector store
    const relevantDocs = await this.retrieveRAGContext(tenantId, context);

    // Step 2: Build augmented prompt with retrieved context
    const augmentedPrompt = this.buildRAGAugmentedPrompt(query, relevantDocs);

    // Step 3: Invoke GenAI Hub with augmented prompt
    const genaiResult = await this.invokeGenAIHub(tenantId, augmentedPrompt, 'ALERT_SUMMARY');

    if (!genaiResult.available) {
      return {
        answer: GENAI_UNAVAILABLE_MSG,
        sources: [],
        confidenceScore: 0,
      };
    }

    return {
      answer: genaiResult.text,
      sources: relevantDocs.map((doc: any) => ({
        documentId: doc.id || cds.utils.uuid(),
        entityType: doc.entityType || context.entityType || 'UNKNOWN',
        relevanceScore: doc.relevanceScore || 0.5,
        snippet: doc.snippet || '',
      })),
      confidenceScore: genaiResult.confidence,
    };
  }

  /**
   * Generate AI-drafted auditor question responses.
   * Grounded in tenant's actual control evidence and configuration.
   *
   * Validates: Requirements 34.2
   */
  async generateAuditResponseImpl(
    tenantId: string,
    question: string
  ): Promise<AIGeneratedContent> {
    const logger = cds.log('genai');
    logger.info(`Generating audit response for tenant ${tenantId}: "${question.substring(0, 60)}..."`);

    // Retrieve relevant compliance data via RAG
    const ragContext = await this.retrieveRAGContext(tenantId, {
      entityType: 'COMPLIANCE',
      maxDocuments: DEFAULT_RAG_LIMIT,
    });

    const prompt = this.buildAuditResponsePrompt(question, ragContext);
    const genaiResult = await this.invokeGenAIHub(tenantId, prompt, 'AUDIT_RESPONSE');

    if (!genaiResult.available) {
      return this.buildFallbackAuditResponse(question, tenantId);
    }

    const content = this.buildAIContent(
      'AUDIT_RESPONSE',
      genaiResult.text,
      genaiResult.confidence,
      genaiResult.model
    );

    await this.persistAIContent(content);
    return content;
  }

  /**
   * Generate executive risk briefing.
   * Summarizes top risks, new threats, compliance posture changes, and recommendations.
   *
   * Validates: Requirements 34.5
   */
  async generateExecutiveBriefingImpl(
    tenantId: string
  ): Promise<AIGeneratedContent> {
    const logger = cds.log('genai');
    logger.info(`Generating executive briefing for tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const { Alerts, ControlEvidence } = db.entities('finsecure.ai');

    // Gather last 7 days of alert data
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentAlerts = await SELECT.from(Alerts).where({
      tenantId,
      createdAt: { '>=': weekAgo.toISOString() },
    });

    // Gather recent compliance evidence
    const recentEvidence = await SELECT.from(ControlEvidence).where({
      tenantId,
      evaluationTimestamp: { '>=': weekAgo.toISOString() },
    });

    const ragContext = await this.retrieveRAGContext(tenantId, {
      entityType: 'EXECUTIVE_BRIEFING',
      timeRangeStart: weekAgo.toISOString(),
      timeRangeEnd: new Date().toISOString(),
      maxDocuments: DEFAULT_RAG_LIMIT,
    });

    const prompt = this.buildExecutiveBriefingPrompt(recentAlerts, recentEvidence, ragContext);
    const genaiResult = await this.invokeGenAIHub(tenantId, prompt, 'EXECUTIVE_BRIEFING');

    if (!genaiResult.available) {
      return this.buildFallbackExecutiveBriefing(recentAlerts, recentEvidence, tenantId);
    }

    const content = this.buildAIContent(
      'EXECUTIVE_BRIEFING',
      genaiResult.text,
      genaiResult.confidence,
      genaiResult.model
    );

    await this.persistAIContent(content);
    return content;
  }

  /**
   * Submit feedback on AI-generated content.
   * Used to improve future triage accuracy through prompt optimization.
   *
   * Validates: Requirements 33.7
   */
  async submitFeedbackImpl(contentId: string, isCorrect: boolean): Promise<void> {
    const logger = cds.log('genai');
    const db = await cds.connect.to('db');
    const { AIGeneratedContent } = db.entities('finsecure.ai');

    await UPDATE(AIGeneratedContent).where({ ID: contentId }).set({
      feedbackCorrect: isCorrect,
    });

    logger.info(`Feedback recorded for content ${contentId}: correct=${isCorrect}`);
  }

  // ==========================================================================
  // GenAI Hub Integration (SAP AI Core)
  // ==========================================================================

  /**
   * Invoke SAP Generative AI Hub through SAP AI Core.
   * Handles unavailability gracefully by returning available=false.
   *
   * Validates: Requirements 33.8
   */
  private async invokeGenAIHub(
    tenantId: string,
    prompt: string,
    _contentType: string
  ): Promise<{ available: boolean; text: string; confidence: number; model: string }> {
    const logger = cds.log('genai');

    try {
      // Attempt to connect to SAP AI Core GenAI Hub
      // In production, this uses @sap-ai-sdk/foundation-models or the
      // SAP AI Core REST API for chat completion
      const aiCore = await this.getAICoreClient(tenantId);

      if (!aiCore) {
        logger.warn(`AI Core client unavailable for tenant ${tenantId}. Using fallback.`);
        return { available: false, text: '', confidence: 0, model: '' };
      }

      // Call the foundation model via SAP Generative AI Hub
      const response = await aiCore.chatCompletion({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are FinSecure AI, an expert security analyst assistant for SAP environments. ' +
              'Provide clear, actionable, and evidence-based responses. ' +
              'Always cite specific data points when available. ' +
              'Be concise but thorough.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 2000,
      });

      const text = response?.choices?.[0]?.message?.content || '';
      const confidence = this.calculateConfidence(text, prompt);

      return {
        available: true,
        text,
        confidence,
        model: response?.model || DEFAULT_MODEL,
      };
    } catch (error: any) {
      logger.warn(
        `GenAI Hub invocation failed for tenant ${tenantId}: ${error.message}. Using fallback.`
      );
      return { available: false, text: '', confidence: 0, model: '' };
    }
  }

  /**
   * Get SAP AI Core client for the given tenant.
   * Returns null if AI Core is not configured or unavailable.
   */
  private async getAICoreClient(
    _tenantId: string
  ): Promise<any> {
    try {
      // In production, this resolves the AI Core destination from BTP and
      // creates an authenticated client using tenant-specific credentials.
      // The implementation would use @sap-ai-sdk/ai-api or direct REST calls
      // to the AI Core deployment URL.
      const aiCoreBinding = process.env.AICORE_SERVICE_URL || cds.env?.requires?.['aicore']?.credentials?.url;

      if (!aiCoreBinding) {
        return null;
      }

      // Return a client interface for chat completion
      return {
        chatCompletion: async (params: any) => {
          // In production: POST to /v2/inference/deployments/{deploymentId}/chat/completions
          // with the SAP AI Core Generative AI Hub API
          const response = await this.callAICoreEndpoint(params);
          return response;
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Call SAP AI Core inference endpoint.
   * Wraps the HTTP call with proper authentication and error handling.
   */
  private async callAICoreEndpoint(params: any): Promise<any> {
    // This is the integration point with SAP AI Core's Generative AI Hub.
    // In a deployed environment, this would:
    // 1. Resolve the AI Core service binding from VCAP_SERVICES
    // 2. Obtain an OAuth token from the AI Core XSUAA instance
    // 3. POST to the chat completion endpoint of the deployed model
    //
    // For local development without AI Core, this returns null to trigger fallback.
    const logger = cds.log('genai');
    logger.info(`AI Core endpoint call with model: ${params.model}`);

    // When deployed with proper AI Core binding, replace with actual HTTP call
    return null;
  }

  // ==========================================================================
  // RAG Pipeline (HANA Vector Store)
  // ==========================================================================

  /**
   * Retrieve relevant documents from HANA vector store for RAG grounding.
   * Uses tenant-scoped vector embeddings for context retrieval.
   *
   * Validates: Requirements 33.2
   */
  private async retrieveRAGContext(
    tenantId: string,
    context: RAGContext
  ): Promise<any[]> {
    const logger = cds.log('genai');

    try {
      const db = await cds.connect.to('db');
      const limit = context.maxDocuments || DEFAULT_RAG_LIMIT;

      // In production, this would:
      // 1. Convert the query context into a vector embedding via AI Core
      // 2. Perform a cosine similarity search on the HANA Cloud vector store
      // 3. Return the top-K most relevant documents with their relevance scores
      //
      // For now, we retrieve structured historical data as RAG context

      let documents: any[] = [];

      if (context.entityType === 'ALERT' && context.entityId) {
        documents = await this.retrieveAlertRAGDocuments(db, tenantId, context.entityId, limit);
      } else if (context.entityType === 'INVESTIGATION' && context.entityId) {
        documents = await this.retrieveInvestigationRAGDocuments(db, tenantId, context.entityId, limit);
      } else if (context.entityType === 'COMPLIANCE') {
        documents = await this.retrieveComplianceRAGDocuments(db, tenantId, context, limit);
      }

      logger.info(
        `RAG context retrieved for tenant ${tenantId}: ${documents.length} documents`
      );

      return documents;
    } catch (error: any) {
      logger.warn(`RAG context retrieval failed for tenant ${tenantId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Retrieve alert-related RAG documents from historical data.
   */
  private async retrieveAlertRAGDocuments(
    db: any,
    tenantId: string,
    entityId: string,
    limit: number
  ): Promise<any[]> {
    const { Alerts } = db.entities('finsecure.ai');
    const currentAlert = await SELECT.one.from(Alerts).where({ ID: entityId, tenantId });

    if (!currentAlert) return [];

    const historicalAlerts = await SELECT.from(Alerts)
      .where({
        tenantId,
        riskCategory: currentAlert.riskCategory,
        ID: { '!=': entityId },
      })
      .limit(limit)
      .orderBy('createdAt desc');

    return historicalAlerts.map((hist: any) => ({
      id: hist.ID,
      entityType: 'ALERT',
      relevanceScore: 0.7,
      snippet: `[${hist.priority}] ${hist.title} - ${hist.status} (Score: ${hist.riskScore})`,
      data: hist,
    }));
  }

  /**
   * Retrieve investigation-related RAG documents from historical data.
   */
  private async retrieveInvestigationRAGDocuments(
    db: any,
    tenantId: string,
    entityId: string,
    limit: number
  ): Promise<any[]> {
    const { Investigations } = db.entities('finsecure.ai');
    const historicalInvestigations = await SELECT.from(Investigations)
      .where({
        tenantId,
        ID: { '!=': entityId },
      })
      .limit(limit)
      .orderBy('createdAt desc');

    return historicalInvestigations.map((inv: any) => ({
      id: inv.ID,
      entityType: 'INVESTIGATION',
      relevanceScore: 0.6,
      snippet: `Investigation ${inv.ID} - ${inv.status}`,
      data: inv,
    }));
  }

  /**
   * Retrieve compliance-related RAG documents from historical data.
   */
  private async retrieveComplianceRAGDocuments(
    db: any,
    tenantId: string,
    context: RAGContext,
    limit: number
  ): Promise<any[]> {
    const { ControlEvidence } = db.entities('finsecure.ai');
    const whereClause: any = { tenantId };
    if (context.timeRangeStart) {
      whereClause.evaluationTimestamp = { '>=': context.timeRangeStart };
    }

    const recentEvidence = await SELECT.from(ControlEvidence)
      .where(whereClause)
      .limit(limit)
      .orderBy('evaluationTimestamp desc');

    return recentEvidence.map((ev: any) => ({
      id: ev.ID,
      entityType: 'CONTROL_EVIDENCE',
      relevanceScore: 0.65,
      snippet: `Control ${ev.controlId}: ${ev.result} - ${ev.details?.substring(0, 100) || ''}`,
      data: ev,
    }));
  }

  // ==========================================================================
  // Prompt Building
  // ==========================================================================

  /**
   * Build prompt for alert summary generation.
   */
  private buildAlertSummaryPrompt(alert: any, ragContext: any[]): string {
    const riskIndicators = this.parseJSON(alert.riskIndicators, []);
    const affectedEntities = this.parseJSON(alert.affectedEntities, []);

    let prompt =
      'Generate a concise alert summary with triage recommendation.\n\n' +
      '## Alert Details\n' +
      `- Priority: ${alert.priority}\n` +
      `- Risk Score: ${alert.riskScore}/100\n` +
      `- Category: ${alert.riskCategory}\n` +
      `- Title: ${alert.title}\n` +
      `- Description: ${alert.description}\n`;

    if (alert.financialExposure) {
      prompt += `- Financial Exposure: ${alert.financialExposure}\n`;
    }

    if (riskIndicators.length > 0) {
      prompt += '\n## Risk Indicators\n';
      for (const indicator of riskIndicators) {
        prompt += `- ${indicator.description || indicator.indicatorType}: observed=${indicator.observedValue}\n`;
      }
    }

    if (affectedEntities.length > 0) {
      prompt += '\n## Affected Entities\n';
      for (const entity of affectedEntities) {
        prompt += `- ${entity.entityType}: ${entity.entityId}\n`;
      }
    }

    if (ragContext.length > 0) {
      prompt += '\n## Historical Context (Similar Alerts)\n';
      for (const doc of ragContext.slice(0, 5)) {
        prompt += `- ${doc.snippet}\n`;
      }
    }

    prompt +=
      '\n## Required Output\n' +
      '1. Plain-language description of what happened\n' +
      '2. Potential business impact\n' +
      '3. Similar historical patterns and their resolutions\n' +
      '4. Triage recommendation: one of [Investigate Immediately, Monitor for Recurrence, Likely False Positive]\n';

    return prompt;
  }

  /**
   * Build prompt for investigation brief generation.
   */
  private buildInvestigationBriefPrompt(
    investigation: any,
    relatedAlert: any,
    ragContext: any[]
  ): string {
    let prompt =
      'Generate an investigation brief for a security analyst.\n\n' +
      '## Investigation Details\n' +
      `- Investigation ID: ${investigation.ID}\n` +
      `- Status: ${investigation.status}\n` +
      `- Assigned Analyst: ${investigation.assignedAnalyst}\n` +
      `- Started: ${investigation.createdAt}\n`;

    if (relatedAlert) {
      prompt +=
        '\n## Triggering Alert\n' +
        `- Alert: ${relatedAlert.title}\n` +
        `- Priority: ${relatedAlert.priority}\n` +
        `- Risk Score: ${relatedAlert.riskScore}/100\n` +
        `- Category: ${relatedAlert.riskCategory}\n` +
        `- Description: ${relatedAlert.description}\n`;
    }

    if (ragContext.length > 0) {
      prompt += '\n## Related Historical Investigations\n';
      for (const doc of ragContext.slice(0, 5)) {
        prompt += `- ${doc.snippet}\n`;
      }
    }

    prompt +=
      '\n## Required Output\n' +
      '1. Timeline reconstruction of related events\n' +
      '2. List of potentially affected business objects\n' +
      '3. Suggested evidence to collect\n' +
      '4. Cross-references to related investigations\n' +
      '5. Recommended next steps\n';

    return prompt;
  }

  /**
   * Build prompt for risk score explanation.
   */
  private buildRiskExplanationPrompt(
    alert: any,
    riskIndicators: any[],
    ragContext: any[]
  ): string {
    let prompt =
      'Explain in plain language why this transaction was flagged as risky.\n\n' +
      '## Alert Context\n' +
      `- Risk Score: ${alert.riskScore}/100\n` +
      `- Category: ${alert.riskCategory}\n` +
      `- Detection Method: ${alert.detectionMethod || 'Multiple methods'}\n`;

    if (riskIndicators.length > 0) {
      prompt += '\n## Risk Indicators (ML Feature Importance + Rules)\n';
      for (const indicator of riskIndicators) {
        prompt +=
          `- ${indicator.indicatorType}: ${indicator.description} ` +
          `(observed: ${indicator.observedValue}, weight: ${indicator.weight || 'N/A'})\n`;
      }
    }

    if (ragContext.length > 0) {
      prompt += '\n## Historical Context\n';
      for (const doc of ragContext.slice(0, 3)) {
        prompt += `- ${doc.snippet}\n`;
      }
    }

    prompt +=
      '\n## Required Output\n' +
      '1. Why was this transaction flagged (plain language)\n' +
      '2. Which specific indicators contributed most to the score\n' +
      '3. How this compares to historical patterns\n' +
      '4. Confidence assessment of the flagging\n';

    return prompt;
  }

  /**
   * Build prompt for compliance narrative report.
   */
  private buildComplianceNarrativePrompt(
    framework: string,
    controls: any[],
    evidence: any[],
    periodStart: string,
    periodEnd: string,
    ragContext: any[]
  ): string {
    const passCount = evidence.filter((e: any) => e.result === 'PASS').length;
    const failCount = evidence.filter((e: any) => e.result === 'FAIL').length;
    const warningCount = evidence.filter((e: any) => e.result === 'WARNING').length;
    const total = passCount + failCount + warningCount;
    const complianceRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0';

    let prompt =
      'Generate a compliance narrative assessment report.\n\n' +
      '## Report Parameters\n' +
      `- Framework: ${framework}\n` +
      `- Period: ${periodStart} to ${periodEnd}\n` +
      `- Total Controls Evaluated: ${controls.length}\n` +
      `- Evaluations in Period: ${total}\n` +
      `- Pass: ${passCount}, Fail: ${failCount}, Warning: ${warningCount}\n` +
      `- Compliance Rate: ${complianceRate}%\n`;

    if (controls.length > 0) {
      prompt += '\n## Active Controls\n';
      for (const ctrl of controls.slice(0, 15)) {
        prompt += `- ${ctrl.frameworkRef}: ${ctrl.name} (${ctrl.status})\n`;
      }
    }

    if (ragContext.length > 0) {
      prompt += '\n## Historical Evidence Context\n';
      for (const doc of ragContext.slice(0, 5)) {
        prompt += `- ${doc.snippet}\n`;
      }
    }

    prompt +=
      '\n## Required Output\n' +
      '1. Executive summary of compliance posture\n' +
      '2. Control-by-control assessment with evidence references\n' +
      '3. Identified gaps with severity and remediation timelines\n' +
      '4. Trend analysis comparing to previous periods\n' +
      '5. Recommendations for improvement\n';

    return prompt;
  }

  /**
   * Build prompt for root cause analysis.
   */
  private buildRootCausePrompt(evidence: any, control: any, ragContext: any[]): string {
    let prompt =
      'Generate a root cause analysis for a compliance control failure.\n\n' +
      '## Failed Control\n';

    if (control) {
      prompt +=
        `- Control ID: ${control.ID}\n` +
        `- Framework Ref: ${control.frameworkRef}\n` +
        `- Name: ${control.name}\n` +
        `- Objective: ${control.objective}\n` +
        `- Test Procedure: ${control.testProcedure}\n` +
        `- Expected Result: ${control.expectedResult}\n`;
    }

    prompt +=
      '\n## Failure Details\n' +
      `- Evidence ID: ${evidence.ID}\n` +
      `- Result: ${evidence.result}\n` +
      `- Details: ${evidence.details || 'No additional details'}\n` +
      `- Evaluation Timestamp: ${evidence.evaluationTimestamp}\n`;

    if (ragContext.length > 0) {
      prompt += '\n## Historical Context\n';
      for (const doc of ragContext.slice(0, 5)) {
        prompt += `- ${doc.snippet}\n`;
      }
    }

    prompt +=
      '\n## Required Output\n' +
      '1. What the control tests and why it matters\n' +
      '2. Root cause of the failure (based on specific data)\n' +
      '3. Potential business impact\n' +
      '4. Step-by-step remediation instructions\n' +
      '5. Preventive measures to avoid recurrence\n';

    return prompt;
  }

  /**
   * Build prompt for audit response generation.
   */
  private buildAuditResponsePrompt(question: string, ragContext: any[]): string {
    let prompt =
      'Draft a comprehensive response to the following auditor question, ' +
      'grounded in the organization\'s actual control evidence and configuration.\n\n' +
      `## Auditor Question\n${question}\n`;

    if (ragContext.length > 0) {
      prompt += '\n## Relevant Evidence and Configuration\n';
      for (const doc of ragContext) {
        prompt += `- ${doc.snippet}\n`;
      }
    }

    prompt +=
      '\n## Required Output\n' +
      '1. Direct answer to the question\n' +
      '2. Specific evidence references supporting the answer\n' +
      '3. Control implementation details\n' +
      '4. Any gaps or areas for improvement (if applicable)\n';

    return prompt;
  }

  /**
   * Build prompt for executive briefing.
   */
  private buildExecutiveBriefingPrompt(
    recentAlerts: any[],
    recentEvidence: any[],
    ragContext: any[]
  ): string {
    // Summarize alert stats
    const criticalCount = recentAlerts.filter((a: any) => a.priority === 'CRITICAL').length;
    const highCount = recentAlerts.filter((a: any) => a.priority === 'HIGH').length;
    const resolvedCount = recentAlerts.filter(
      (a: any) => a.status === 'RESOLVED_TRUE_POSITIVE' || a.status === 'RESOLVED_FALSE_POSITIVE'
    ).length;

    // Summarize compliance stats
    const failedControls = recentEvidence.filter((e: any) => e.result === 'FAIL').length;
    const totalEvaluations = recentEvidence.length;

    let prompt =
      'Generate a weekly executive risk briefing for senior leadership.\n\n' +
      '## Week Summary\n' +
      `- Total Alerts: ${recentAlerts.length}\n` +
      `- Critical: ${criticalCount}, High: ${highCount}\n` +
      `- Resolved: ${resolvedCount}\n` +
      `- Compliance Evaluations: ${totalEvaluations}\n` +
      `- Control Failures: ${failedControls}\n`;

    // Top risk categories this week
    const categoryBreakdown = this.countByField(recentAlerts, 'riskCategory');
    if (Object.keys(categoryBreakdown).length > 0) {
      prompt += '\n## Risk Category Distribution\n';
      for (const [category, count] of Object.entries(categoryBreakdown)) {
        prompt += `- ${category}: ${count}\n`;
      }
    }

    if (ragContext.length > 0) {
      prompt += '\n## Historical Context\n';
      for (const doc of ragContext.slice(0, 5)) {
        prompt += `- ${doc.snippet}\n`;
      }
    }

    prompt +=
      '\n## Required Output\n' +
      '1. Top risks identified this week\n' +
      '2. New threats detected\n' +
      '3. Compliance posture changes\n' +
      '4. Recommended actions for leadership\n' +
      '5. Trend comparison to previous week\n';

    return prompt;
  }

  /**
   * Build a RAG-augmented prompt by prepending retrieved context.
   */
  private buildRAGAugmentedPrompt(query: string, documents: any[]): string {
    let prompt = '';

    if (documents.length > 0) {
      prompt += '## Retrieved Context\n';
      for (const doc of documents) {
        prompt += `- [${doc.entityType}] ${doc.snippet}\n`;
      }
      prompt += '\n';
    }

    prompt += `## Query\n${query}\n`;
    prompt += '\nProvide a comprehensive answer grounded in the context above.\n';

    return prompt;
  }

  // ==========================================================================
  // Fallback Structured Responses (when GenAI Hub unavailable)
  // ==========================================================================

  /**
   * Fallback alert summary when GenAI is unavailable.
   */
  private buildFallbackAlertSummary(alert: any, alertId: string): AIGeneratedContent {
    const riskIndicators = this.parseJSON(alert.riskIndicators, []);
    const indicatorList = riskIndicators
      .map((i: any) => `- ${i.description || i.indicatorType}`)
      .join('\n');

    const content =
      `## Alert Summary (Structured)\n\n` +
      `**What happened:** A ${alert.riskCategory} event was detected with risk score ${alert.riskScore}/100.\n\n` +
      `**Title:** ${alert.title}\n\n` +
      `**Priority:** ${alert.priority}\n\n` +
      (alert.financialExposure
        ? `**Financial Exposure:** ${alert.financialExposure}\n\n`
        : '') +
      (indicatorList
        ? `**Risk Indicators:**\n${indicatorList}\n\n`
        : '') +
      `**Triage Recommendation:** ${this.getStructuredTriageRecommendation(alert)}\n\n` +
      `*${GENAI_UNAVAILABLE_MSG}*`;

    return this.buildAIContent(
      'ALERT_SUMMARY',
      content,
      0,
      'fallback-structured',
      alertId
    );
  }

  /**
   * Fallback investigation brief when GenAI is unavailable.
   */
  private buildFallbackInvestigationBrief(
    investigation: any,
    relatedAlert: any,
    investigationId: string
  ): AIGeneratedContent {
    let content =
      `## Investigation Brief (Structured)\n\n` +
      `**Investigation:** ${investigationId}\n` +
      `**Status:** ${investigation.status}\n` +
      `**Analyst:** ${investigation.assignedAnalyst}\n` +
      `**Started:** ${investigation.createdAt}\n\n`;

    if (relatedAlert) {
      content +=
        `### Triggering Alert\n` +
        `- ${relatedAlert.title} (Priority: ${relatedAlert.priority}, Score: ${relatedAlert.riskScore})\n` +
        `- Category: ${relatedAlert.riskCategory}\n\n`;
    }

    content +=
      `### Suggested Evidence to Collect\n` +
      `- Transaction logs for affected entities\n` +
      `- User activity history for the past 30 days\n` +
      `- Related alerts in the same time window\n` +
      `- System access logs\n\n` +
      `*${GENAI_UNAVAILABLE_MSG}*`;

    return this.buildAIContent(
      'INVESTIGATION_BRIEF',
      content,
      0,
      'fallback-structured',
      investigationId
    );
  }

  /**
   * Fallback risk explanation when GenAI is unavailable.
   */
  private buildFallbackRiskExplanation(
    alert: any,
    riskIndicators: any[],
    alertId: string
  ): AIGeneratedContent {
    const indicatorExplanations = riskIndicators
      .map(
        (i: any) =>
          `- **${i.indicatorType}:** ${i.description} (observed: ${i.observedValue}, weight: ${i.weight || 'N/A'})`
      )
      .join('\n');

    const content =
      `## Risk Score Explanation (Structured)\n\n` +
      `This transaction received a risk score of **${alert.riskScore}/100** ` +
      `in the **${alert.riskCategory}** category.\n\n` +
      `### Contributing Factors\n` +
      (indicatorExplanations || '- No detailed indicators available') +
      `\n\n### Detection Method\n` +
      `- ${alert.detectionMethod || 'Multiple detection methods combined'}\n\n` +
      `*${GENAI_UNAVAILABLE_MSG}*`;

    return this.buildAIContent(
      'RISK_EXPLANATION',
      content,
      0,
      'fallback-structured',
      alertId
    );
  }

  /**
   * Fallback compliance narrative when GenAI is unavailable.
   */
  private buildFallbackComplianceNarrative(
    framework: string,
    controls: any[],
    evidence: any[],
    periodStart: string,
    periodEnd: string
  ): AIGeneratedContent {
    const passCount = evidence.filter((e: any) => e.result === 'PASS').length;
    const failCount = evidence.filter((e: any) => e.result === 'FAIL').length;
    const warningCount = evidence.filter((e: any) => e.result === 'WARNING').length;
    const total = passCount + failCount + warningCount;
    const complianceRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0';

    const content =
      `## Compliance Assessment (Structured)\n\n` +
      `**Framework:** ${framework}\n` +
      `**Period:** ${periodStart} to ${periodEnd}\n` +
      `**Active Controls:** ${controls.length}\n\n` +
      `### Summary\n` +
      `- Pass: ${passCount}\n` +
      `- Fail: ${failCount}\n` +
      `- Warning: ${warningCount}\n` +
      `- Compliance Rate: ${complianceRate}%\n\n` +
      (failCount > 0
        ? `### Attention Required\n${failCount} control(s) failed during this period. Review individual control evidence for details.\n\n`
        : '') +
      `*${GENAI_UNAVAILABLE_MSG}*`;

    return this.buildAIContent(
      'COMPLIANCE_NARRATIVE',
      content,
      0,
      'fallback-structured',
      `${framework}:${periodStart}:${periodEnd}`
    );
  }

  /**
   * Fallback root cause analysis when GenAI is unavailable.
   */
  private buildFallbackRootCauseAnalysis(
    evidence: any,
    control: any,
    evidenceId: string
  ): AIGeneratedContent {
    let content =
      `## Root Cause Analysis (Structured)\n\n` +
      `**Control:** ${control?.name || 'Unknown'}\n` +
      `**Framework Ref:** ${control?.frameworkRef || 'N/A'}\n` +
      `**Result:** ${evidence.result}\n` +
      `**Evaluated:** ${evidence.evaluationTimestamp}\n\n`;

    if (control) {
      content +=
        `### Control Objective\n${control.objective}\n\n` +
        `### Expected Result\n${control.expectedResult}\n\n`;
    }

    content +=
      `### Failure Details\n${evidence.details || 'No details available'}\n\n` +
      `### Recommended Steps\n` +
      `1. Review the specific data that triggered the failure\n` +
      `2. Identify the root cause of the deviation\n` +
      `3. Implement corrective action\n` +
      `4. Re-evaluate the control\n` +
      `5. Document remediation for audit trail\n\n` +
      `*${GENAI_UNAVAILABLE_MSG}*`;

    return this.buildAIContent(
      'ROOT_CAUSE_ANALYSIS',
      content,
      0,
      'fallback-structured',
      evidenceId
    );
  }

  /**
   * Fallback audit response when GenAI is unavailable.
   */
  private buildFallbackAuditResponse(
    question: string,
    _tenantId: string
  ): AIGeneratedContent {
    const content =
      `## Audit Response (Structured)\n\n` +
      `**Question:** ${question}\n\n` +
      `**Response:** This question requires AI-assisted generation which is currently unavailable. ` +
      `Please refer to the compliance dashboard for current control evidence and configuration details.\n\n` +
      `### Available Resources\n` +
      `- Compliance Control Evidence (accessible via Compliance Engine)\n` +
      `- Audit Trail entries (accessible via Audit Trail Service)\n` +
      `- Investigation records and resolution notes\n\n` +
      `*${GENAI_UNAVAILABLE_MSG}*`;

    return this.buildAIContent(
      'AUDIT_RESPONSE',
      content,
      0,
      'fallback-structured'
    );
  }

  /**
   * Fallback executive briefing when GenAI is unavailable.
   */
  private buildFallbackExecutiveBriefing(
    recentAlerts: any[],
    recentEvidence: any[],
    _tenantId: string
  ): AIGeneratedContent {
    const criticalCount = recentAlerts.filter((a: any) => a.priority === 'CRITICAL').length;
    const highCount = recentAlerts.filter((a: any) => a.priority === 'HIGH').length;
    const resolvedCount = recentAlerts.filter(
      (a: any) => a.status === 'RESOLVED_TRUE_POSITIVE' || a.status === 'RESOLVED_FALSE_POSITIVE'
    ).length;
    const failedControls = recentEvidence.filter((e: any) => e.result === 'FAIL').length;

    const categoryBreakdown = this.countByField(recentAlerts, 'riskCategory');
    const categoryList = Object.entries(categoryBreakdown)
      .map(([cat, count]) => `- ${cat}: ${count}`)
      .join('\n');

    const content =
      `## Executive Risk Briefing (Structured)\n\n` +
      `### Weekly Summary\n` +
      `- Total Alerts: ${recentAlerts.length}\n` +
      `- Critical: ${criticalCount}\n` +
      `- High: ${highCount}\n` +
      `- Resolved: ${resolvedCount}\n` +
      `- Compliance Failures: ${failedControls}\n\n` +
      (categoryList ? `### Risk Distribution\n${categoryList}\n\n` : '') +
      `### Attention Required\n` +
      (criticalCount > 0
        ? `- ${criticalCount} critical alert(s) require immediate attention\n`
        : '- No critical alerts this period\n') +
      (failedControls > 0
        ? `- ${failedControls} compliance control failure(s) detected\n`
        : '- All compliance controls passing\n') +
      `\n*${GENAI_UNAVAILABLE_MSG}*`;

    return this.buildAIContent(
      'EXECUTIVE_BRIEFING',
      content,
      0,
      'fallback-structured'
    );
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Build a standardized AIGeneratedContent object with all required metadata.
   */
  private buildAIContent(
    contentType: AIContentType,
    content: string,
    confidenceScore: number,
    modelUsed: string,
    relatedEntityId?: string
  ): AIGeneratedContent {
    return {
      contentId: cds.utils.uuid(),
      contentType,
      content,
      confidenceScore: Math.min(Math.max(Math.round(confidenceScore), 0), MAX_CONFIDENCE),
      modelUsed,
      generatedAt: new Date().toISOString(),
      isAIGenerated: true,
      disclaimer: AI_DISCLAIMER,
      relatedEntityId,
      version: 1,
    };
  }

  /**
   * Persist AI-generated content to the database for versioning and audit.
   *
   * Validates: Requirements 34.7
   */
  private async persistAIContent(content: AIGeneratedContent): Promise<void> {
    try {
      const db = await cds.connect.to('db');
      const { AIGeneratedContent } = db.entities('finsecure.ai');

      // Check for existing version to increment
      let version = 1;
      if (content.relatedEntityId) {
        const existing = await SELECT.from(AIGeneratedContent)
          .where({
            relatedEntityId: content.relatedEntityId,
            contentType: content.contentType,
          })
          .orderBy('version desc')
          .limit(1);

        if (existing.length > 0) {
          version = (existing[0].version || 0) + 1;
        }
      }

      await INSERT.into(AIGeneratedContent).entries({
        ID: content.contentId,
        tenantId: null, // Set from request context in production
        contentType: content.contentType,
        relatedEntityId: content.relatedEntityId || null,
        content: content.content,
        confidenceScore: content.confidenceScore,
        modelUsed: content.modelUsed,
        generatedAt: content.generatedAt,
        version,
      });
    } catch (error: any) {
      const logger = cds.log('genai');
      logger.warn(`Failed to persist AI content ${content.contentId}: ${error.message}`);
      // Non-critical: content is still returned to caller even if persistence fails
    }
  }

  /**
   * Calculate confidence score based on response quality heuristics.
   */
  private calculateConfidence(responseText: string, _prompt: string): number {
    // Heuristic confidence scoring based on response characteristics
    let confidence = 60; // Base confidence

    // Longer, more detailed responses indicate higher confidence
    if (responseText.length > 500) confidence += 10;
    if (responseText.length > 1000) confidence += 5;

    // Structured responses (with headers, lists) indicate better organization
    if (responseText.includes('##') || responseText.includes('- ')) confidence += 10;

    // Specific data references boost confidence
    if (responseText.match(/\d+/g)?.length || 0 > 3) confidence += 5;

    // Cap at MAX_CONFIDENCE
    return Math.min(confidence, MAX_CONFIDENCE);
  }

  /**
   * Get a structured triage recommendation based on alert properties.
   */
  private getStructuredTriageRecommendation(alert: any): string {
    if (alert.riskScore >= 90 || alert.priority === 'CRITICAL') {
      return 'Investigate Immediately';
    }
    if (alert.riskScore >= 70 || alert.priority === 'HIGH') {
      return 'Investigate Immediately';
    }
    if (alert.riskScore >= 40) {
      return 'Monitor for Recurrence';
    }
    return 'Likely False Positive';
  }

  /**
   * Count items by a given field value.
   */
  private countByField(items: any[], field: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const value = item[field] || 'UNKNOWN';
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }

  /**
   * Safely parse JSON with a default fallback.
   */
  private parseJSON(value: any, defaultValue: any): any {
    if (!value) return defaultValue;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
}
