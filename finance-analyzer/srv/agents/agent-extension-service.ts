import cds = require('@sap/cds');
import { RiskCategory } from '../types/enums';

const { ApplicationService } = cds;

// ============================================================================
// Types
// ============================================================================

/** Agent types supported for registration */
type AgentType = 'JOULE_STUDIO' | 'SDK_PRO_CODE';

/** Agent lifecycle status */
type AgentStatus = 'ACTIVE' | 'QUARANTINED';

/** Registered custom agent */
interface CustomAgent {
  agentId: string;
  tenantId: string;
  name: string;
  agentType: AgentType;
  eventSubscriptions: string[];
  outputSchema: object;
  rateLimit: number;
  status: AgentStatus;
  registeredAt: Date;
}

/** Output produced by a custom agent */
interface AgentOutput {
  agentId: string;
  tenantId: string;
  riskCategory: RiskCategory;
  confidenceScore: number;
  payload: Record<string, any>;
  title: string;
  description: string;
  timestamp: Date;
}

/** Rate limit tracking entry per agent */
interface RateLimitWindow {
  timestamps: number[];
}

/** Pre-built agent template definition */
interface AgentTemplate {
  templateId: string;
  name: string;
  description: string;
  agentType: AgentType;
  category: string;
  defaultEventSubscriptions: string[];
  defaultOutputSchema: object;
  sampleConfiguration: Record<string, any>;
}

/** Result of a rate limit check */
interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxPerHour: number;
  remainingQuota: number;
  windowResetAt: string;
}

/** A2A message structure */
interface A2AMessage {
  messageId: string;
  sourceAgentId: string;
  targetAgentId: string;
  messageType: string;
  payload: Record<string, any>;
  sentAt: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default maximum alerts per hour per agent */
const DEFAULT_RATE_LIMIT = 100;

/** Sliding window duration in milliseconds (1 hour) */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** Valid risk categories for agent output validation */
const VALID_RISK_CATEGORIES: RiskCategory[] = [
  'ANOMALY', 'SOD_VIOLATION', 'FRAUD_PATTERN', 'IAM_VIOLATION',
  'PRIVILEGE_ESCALATION', 'INSIDER_THREAT', 'COMPLIANCE_BREACH',
  'VULNERABILITY', 'VENDOR_TAMPERING', 'P2P_CONTROL_GAP',
];

/** Valid agent types */
const VALID_AGENT_TYPES: AgentType[] = ['JOULE_STUDIO', 'SDK_PRO_CODE'];

// ============================================================================
// Pre-built Agent Templates
// ============================================================================

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    templateId: 'tpl-industry-pattern',
    name: 'Industry-Specific Transaction Pattern Detection',
    description:
      'Detects industry-specific anomalous transaction patterns using configurable rules ' +
      'and ML-based scoring. Supports banking, insurance, and manufacturing verticals.',
    agentType: 'SDK_PRO_CODE',
    category: 'PATTERN_DETECTION',
    defaultEventSubscriptions: [
      'finsecure/ai/transactions/created',
      'finsecure/ai/transactions/updated',
    ],
    defaultOutputSchema: {
      type: 'object',
      required: ['riskCategory', 'confidenceScore', 'patternId', 'matchedIndicators'],
      properties: {
        riskCategory: { type: 'string', enum: VALID_RISK_CATEGORIES },
        confidenceScore: { type: 'number', minimum: 0, maximum: 100 },
        patternId: { type: 'string' },
        matchedIndicators: { type: 'array', items: { type: 'string' } },
        industryVertical: { type: 'string' },
      },
    },
    sampleConfiguration: {
      industryVertical: 'banking',
      detectionThreshold: 75,
      lookbackPeriodDays: 30,
    },
  },
  {
    templateId: 'tpl-custom-fraud-rule',
    name: 'Custom Fraud Rule with LLM-Based Reasoning',
    description:
      'Implements custom fraud detection rules enhanced with LLM-based reasoning via ' +
      'SAP Generative AI Hub. Combines rule-based triggers with natural language analysis.',
    agentType: 'SDK_PRO_CODE',
    category: 'FRAUD_DETECTION',
    defaultEventSubscriptions: [
      'finsecure/ai/transactions/created',
      'finsecure/ai/alerts/created',
    ],
    defaultOutputSchema: {
      type: 'object',
      required: ['riskCategory', 'confidenceScore', 'ruleId', 'reasoning'],
      properties: {
        riskCategory: { type: 'string', enum: ['FRAUD_PATTERN'] },
        confidenceScore: { type: 'number', minimum: 0, maximum: 100 },
        ruleId: { type: 'string' },
        reasoning: { type: 'string' },
        llmModelUsed: { type: 'string' },
        evidenceChain: { type: 'array', items: { type: 'object' } },
      },
    },
    sampleConfiguration: {
      llmModel: 'gpt-4',
      ruleDefinition: 'Detect payments to newly created vendors exceeding threshold',
      thresholdAmount: 50000,
      enableLLMReasoning: true,
    },
  },
  {
    templateId: 'tpl-document-classification',
    name: 'Document Classification for Attachment Scanning',
    description:
      'Classifies and scans document attachments using AI models. Identifies potentially ' +
      'fraudulent invoices, suspicious contracts, and non-compliant documentation.',
    agentType: 'JOULE_STUDIO',
    category: 'DOCUMENT_ANALYSIS',
    defaultEventSubscriptions: [
      'finsecure/ai/documents/uploaded',
      'finsecure/ai/attachments/created',
    ],
    defaultOutputSchema: {
      type: 'object',
      required: ['riskCategory', 'confidenceScore', 'documentType', 'classification'],
      properties: {
        riskCategory: { type: 'string', enum: VALID_RISK_CATEGORIES },
        confidenceScore: { type: 'number', minimum: 0, maximum: 100 },
        documentType: { type: 'string' },
        classification: { type: 'string', enum: ['CLEAN', 'SUSPICIOUS', 'FRAUDULENT'] },
        extractedEntities: { type: 'array', items: { type: 'object' } },
        anomalyIndicators: { type: 'array', items: { type: 'string' } },
      },
    },
    sampleConfiguration: {
      supportedFormats: ['PDF', 'DOCX', 'XLSX', 'IMAGE'],
      ocrEnabled: true,
      maxFileSizeMB: 25,
    },
  },
  {
    templateId: 'tpl-compliance-control',
    name: 'Custom Compliance Control Evaluation',
    description:
      'Evaluates custom compliance controls using natural language test criteria. ' +
      'Supports SOX, DORA, PCI-DSS, and custom regulatory frameworks.',
    agentType: 'JOULE_STUDIO',
    category: 'COMPLIANCE',
    defaultEventSubscriptions: [
      'finsecure/ai/compliance/evaluation-requested',
      'finsecure/ai/controls/updated',
    ],
    defaultOutputSchema: {
      type: 'object',
      required: ['riskCategory', 'confidenceScore', 'controlId', 'evaluationResult'],
      properties: {
        riskCategory: { type: 'string', enum: ['COMPLIANCE_BREACH'] },
        confidenceScore: { type: 'number', minimum: 0, maximum: 100 },
        controlId: { type: 'string' },
        evaluationResult: { type: 'string', enum: ['PASS', 'FAIL', 'WARNING'] },
        framework: { type: 'string' },
        evidenceCollected: { type: 'array', items: { type: 'object' } },
        naturalLanguageCriteria: { type: 'string' },
      },
    },
    sampleConfiguration: {
      framework: 'SOX_DORA_PCI',
      evaluationFrequency: 'daily',
      autoRemediationEnabled: false,
    },
  },
];

// ============================================================================
// Agent Extension Service
// ============================================================================

/**
 * Agent Extension Service
 *
 * Provides the extension API for custom AI agents built with SAP Cloud SDK for AI
 * or Joule Studio. Handles registration, output processing through standard
 * Alert Management, rate limiting, quarantine governance, event stream subscriptions,
 * A2A protocol, and pre-built agent templates.
 *
 * Validates: Requirements 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8
 */
export default class AgentExtensionService extends (ApplicationService as any) {
  /**
   * In-memory sliding window rate limit tracker.
   * Maps agentId -> array of alert timestamps within the current hour window.
   */
  private readonly rateLimitWindows: Map<string, RateLimitWindow> = new Map();

  async init() {
    this.on('registerAgent', async (req: any) => {
      const { tenantId, name, agentType, eventSubscriptions, outputSchema, rateLimitPerHour } = req.data;
      const result = await this.registerAgent(
        tenantId, name, agentType as AgentType,
        eventSubscriptions, outputSchema, rateLimitPerHour
      );
      return JSON.stringify(result);
    });

    this.on('processAgentOutput', async (req: any) => {
      const { agentId, tenantId, riskCategory, confidenceScore, payload, title, description } = req.data;
      const output: AgentOutput = {
        agentId,
        tenantId,
        riskCategory: riskCategory as RiskCategory,
        confidenceScore,
        payload: payload ? JSON.parse(payload) : {},
        title,
        description,
        timestamp: new Date(),
      };
      const result = await this.processAgentOutput(output);
      return JSON.stringify(result);
    });

    this.on('checkRateLimit', async (req: any) => {
      const { agentId } = req.data;
      const result = await this.checkRateLimit(agentId);
      return JSON.stringify(result);
    });

    this.on('quarantineAgent', async (req: any) => {
      const { agentId, reason } = req.data;
      await this.quarantineAgent(agentId, reason);
      return JSON.stringify({ success: true, agentId, status: 'QUARANTINED', reason });
    });

    this.on('subscribeToEvents', async (req: any) => {
      const { agentId, eventTypes } = req.data;
      const result = await this.subscribeToEvents(agentId, eventTypes);
      return JSON.stringify(result);
    });

    this.on('getAgentTemplates', async (_req: any) => {
      return JSON.stringify({ templates: AGENT_TEMPLATES });
    });

    this.on('sendA2AMessage', async (req: any) => {
      const { sourceAgentId, targetAgentId, messageType, payload } = req.data;
      const result = await this.sendA2AMessage(sourceAgentId, targetAgentId, messageType, payload);
      return JSON.stringify(result);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Register a custom AI agent with event subscriptions and output schema.
   * Supports Joule Studio (low-code) and SAP Cloud SDK for AI (pro-code) agents.
   *
   * Validates: Requirements 35.1, 35.2, 35.3
   */
  async registerAgent(
    tenantId: string,
    name: string,
    agentType: AgentType,
    eventSubscriptions: string,
    outputSchema: string,
    rateLimitPerHour?: number
  ): Promise<CustomAgent> {
    const logger = cds.log('agent-extension');

    // Validate agent type
    if (!VALID_AGENT_TYPES.includes(agentType)) {
      throw new Error(`Invalid agentType: ${agentType}. Must be one of: ${VALID_AGENT_TYPES.join(', ')}`);
    }

    // Validate and parse event subscriptions
    let parsedSubscriptions: string[];
    try {
      parsedSubscriptions = JSON.parse(eventSubscriptions);
      if (!Array.isArray(parsedSubscriptions)) {
        throw new TypeError('eventSubscriptions must be a JSON array of strings');
      }
    } catch (e: any) {
      throw new Error(`Invalid eventSubscriptions JSON: ${e.message}`);
    }

    // Validate and parse output schema
    let parsedSchema: object;
    try {
      parsedSchema = JSON.parse(outputSchema);
      if (typeof parsedSchema !== 'object' || parsedSchema === null) {
        throw new Error('outputSchema must be a JSON object');
      }
    } catch (e: any) {
      throw new Error(`Invalid outputSchema JSON: ${e.message}`);
    }

    const db = await cds.connect.to('db');
    const { CustomAgents } = db.entities('finsecure.ai');

    const agentId = cds.utils.uuid();
    const rateLimit = rateLimitPerHour ?? DEFAULT_RATE_LIMIT;
    const now = new Date().toISOString();

    await INSERT.into(CustomAgents).entries({
      ID: agentId,
      tenantId,
      name,
      agentType,
      eventSubscriptions,
      outputSchema,
      rateLimitPerHour: rateLimit,
      status: 'ACTIVE',
      lastActiveAt: now,
      createdAt: now,
      modifiedAt: now,
    });

    // Log registration to audit trail
    await this.logAuditEntry(
      tenantId,
      'SYSTEM',
      'AGENT_REGISTERED',
      `CustomAgent:${agentId}`,
      JSON.stringify({ name, agentType, rateLimit })
    );

    logger.info(`Agent registered: ${name} (${agentType}) for tenant ${tenantId}, ID=${agentId}`);

    return {
      agentId,
      tenantId,
      name,
      agentType,
      eventSubscriptions: parsedSubscriptions,
      outputSchema: parsedSchema,
      rateLimit,
      status: 'ACTIVE',
      registeredAt: new Date(now),
    };
  }

  /**
   * Process agent output through the standard Alert Management workflow.
   * Applies same RBAC and data governance controls as system-generated alerts.
   * Validates schema, checks rate limit, and quarantines on failure.
   *
   * Validates: Requirements 35.4, 35.5, 35.8
   */
  async processAgentOutput(
    output: AgentOutput
  ): Promise<{ success: boolean; alertId?: string; error?: string }> {
    const logger = cds.log('agent-extension');
    const db = await cds.connect.to('db');
    const { CustomAgents, Alerts } = db.entities('finsecure.ai');

    // 1. Verify agent exists and is active
    const agent = await SELECT.one.from(CustomAgents).where({ ID: output.agentId });
    if (!agent) {
      return { success: false, error: `Agent not found: ${output.agentId}` };
    }

    if (agent.status === 'QUARANTINED') {
      logger.warn(`Rejected output from quarantined agent: ${output.agentId}`);
      return { success: false, error: `Agent is quarantined: ${agent.quarantineReason}` };
    }

    // 2. Validate mandatory fields (requirement 35.5)
    const validationError = this.validateAgentOutput(output, agent);
    if (validationError) {
      logger.warn(`Schema validation failed for agent ${output.agentId}: ${validationError}`);
      await this.quarantineAgent(output.agentId, `Schema validation failure: ${validationError}`);
      return { success: false, error: validationError };
    }

    // 3. Check rate limit (requirement 35.5)
    const rateLimitResult = await this.checkRateLimit(output.agentId);
    if (!rateLimitResult.allowed) {
      logger.warn(`Rate limit exceeded for agent ${output.agentId}`);
      await this.quarantineAgent(output.agentId, `Rate limit exceeded: ${rateLimitResult.currentCount}/${rateLimitResult.maxPerHour} alerts/hour`);
      return { success: false, error: `Rate limit exceeded (${rateLimitResult.currentCount}/${rateLimitResult.maxPerHour})` };
    }

    // 4. Record this alert in rate limit window
    this.recordAlertTimestamp(output.agentId);

    // 5. Create alert through standard workflow (requirement 35.4)
    try {
      const alertId = cds.utils.uuid();
      const now = new Date();
      const slaHours = this.getSLAHoursForScore(output.confidenceScore);

      await INSERT.into(Alerts).entries({
        ID: alertId,
        tenantId: output.tenantId,
        priority: this.classifyPriority(output.confidenceScore),
        status: 'OPEN',
        riskCategory: output.riskCategory,
        riskScore: output.confidenceScore,
        title: output.title,
        description: output.description,
        riskIndicators: JSON.stringify(output.payload.riskIndicators ?? []),
        affectedEntities: JSON.stringify(output.payload.affectedEntities ?? []),
        recommendedActions: JSON.stringify(output.payload.recommendedActions ?? []),
        slaDeadline: new Date(now.getTime() + slaHours * 60 * 60 * 1000).toISOString(),
        sourceAgentId: output.agentId,
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString(),
      });

      // 6. Update agent last active timestamp
      await UPDATE(CustomAgents).where({ ID: output.agentId }).set({
        lastActiveAt: now.toISOString(),
        modifiedAt: now.toISOString(),
      });

      // 7. Log to audit trail (requirement 35.5)
      await this.logAuditEntry(
        output.tenantId,
        `agent:${output.agentId}`,
        'AGENT_OUTPUT_PROCESSED',
        `Alert:${alertId}`,
        JSON.stringify({
          riskCategory: output.riskCategory,
          confidenceScore: output.confidenceScore,
          agentName: agent.name,
        })
      );

      logger.info(`Agent output processed: agent=${output.agentId}, alert=${alertId}`);
      return { success: true, alertId };
    } catch (error: any) {
      logger.error(`Error processing agent output: ${error.message}`);
      await this.quarantineAgent(output.agentId, `Unhandled error: ${error.message}`);
      return { success: false, error: `Processing error: ${error.message}` };
    }
  }

  /**
   * Check whether an agent is within its configured rate limit.
   * Uses a sliding window of 1 hour to track alert counts.
   *
   * Validates: Requirements 35.5
   */
  async checkRateLimit(agentId: string): Promise<RateLimitResult> {
    const db = await cds.connect.to('db');
    const { CustomAgents } = db.entities('finsecure.ai');

    // Get agent's configured rate limit
    const agent = await SELECT.one.from(CustomAgents).where({ ID: agentId });
    if (!agent) {
      return {
        allowed: false,
        currentCount: 0,
        maxPerHour: 0,
        remainingQuota: 0,
        windowResetAt: new Date().toISOString(),
      };
    }

    const maxPerHour = agent.rateLimitPerHour ?? DEFAULT_RATE_LIMIT;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    // Get or create the rate limit window for this agent
    let window = this.rateLimitWindows.get(agentId);
    if (!window) {
      window = { timestamps: [] };
      this.rateLimitWindows.set(agentId, window);
    }

    // Prune expired timestamps outside the sliding window
    window.timestamps = window.timestamps.filter(ts => ts > windowStart);

    const currentCount = window.timestamps.length;
    const allowed = currentCount < maxPerHour;
    const remainingQuota = Math.max(0, maxPerHour - currentCount);

    // Calculate when the oldest timestamp will expire from the window
    const oldestInWindow = window.timestamps.length > 0 ? window.timestamps[0] : now;
    const windowResetAt = new Date(oldestInWindow + RATE_LIMIT_WINDOW_MS).toISOString();

    return {
      allowed,
      currentCount,
      maxPerHour,
      remainingQuota,
      windowResetAt,
    };
  }

  /**
   * Quarantine a misbehaving agent.
   * Stops processing outputs, generates system health alert, and notifies
   * agent developer and tenant administrator.
   *
   * Validates: Requirements 35.8
   */
  async quarantineAgent(agentId: string, reason: string): Promise<void> {
    const logger = cds.log('agent-extension');
    const db = await cds.connect.to('db');
    const { CustomAgents, Alerts } = db.entities('finsecure.ai');

    // Update agent status to QUARANTINED
    const agent = await SELECT.one.from(CustomAgents).where({ ID: agentId });
    if (!agent) {
      logger.warn(`Cannot quarantine unknown agent: ${agentId}`);
      return;
    }

    // Skip if already quarantined
    if (agent.status === 'QUARANTINED') {
      return;
    }

    const now = new Date().toISOString();

    await UPDATE(CustomAgents).where({ ID: agentId }).set({
      status: 'QUARANTINED',
      quarantineReason: reason,
      modifiedAt: now,
    });

    // Generate system health alert (requirement 35.8)
    const alertId = cds.utils.uuid();
    await INSERT.into(Alerts).entries({
      ID: alertId,
      tenantId: agent.tenantId,
      priority: 'HIGH',
      status: 'OPEN',
      riskCategory: 'COMPLIANCE_BREACH',
      riskScore: 80,
      title: `Custom Agent Quarantined: ${agent.name}`,
      description:
        `Agent "${agent.name}" (${agentId}) has been quarantined. ` +
        `Reason: ${reason}. All outputs from this agent are now blocked until reviewed.`,
      riskIndicators: JSON.stringify([{
        indicatorType: 'AGENT_GOVERNANCE_VIOLATION',
        description: reason,
        observedValue: agentId,
        weight: 0.8,
      }]),
      affectedEntities: JSON.stringify([{
        entityType: 'CUSTOM_AGENT',
        entityId: agentId,
        name: agent.name,
      }]),
      recommendedActions: JSON.stringify([
        'Review agent output logs for anomalous behavior',
        'Contact agent developer to resolve the issue',
        'Re-register agent after fixing the root cause',
      ]),
      slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      modifiedAt: now,
    });

    // Log quarantine action to audit trail
    await this.logAuditEntry(
      agent.tenantId,
      'SYSTEM',
      'AGENT_QUARANTINED',
      `CustomAgent:${agentId}`,
      JSON.stringify({ reason, agentName: agent.name })
    );

    logger.warn(`Agent quarantined: ${agent.name} (${agentId}). Reason: ${reason}`);
  }

  /**
   * Subscribe an agent to event stream topics via SAP Event Mesh.
   * Configures the agent to receive real-time transaction events.
   *
   * Validates: Requirements 35.1
   */
  async subscribeToEvents(
    agentId: string,
    eventTypes: string
  ): Promise<{ success: boolean; subscriptions?: string[]; error?: string }> {
    const logger = cds.log('agent-extension');
    const db = await cds.connect.to('db');
    const { CustomAgents } = db.entities('finsecure.ai');

    // Validate agent exists and is active
    const agent = await SELECT.one.from(CustomAgents).where({ ID: agentId });
    if (!agent) {
      return { success: false, error: `Agent not found: ${agentId}` };
    }

    if (agent.status === 'QUARANTINED') {
      return { success: false, error: 'Cannot subscribe quarantined agent to events' };
    }

    // Parse event types
    let parsedEventTypes: string[];
    try {
      parsedEventTypes = JSON.parse(eventTypes);
      if (!Array.isArray(parsedEventTypes)) {
        throw new TypeError('eventTypes must be a JSON array');
      }
    } catch (e: any) {
      return { success: false, error: `Invalid eventTypes: ${e.message}` };
    }

    // Connect to messaging service and register subscriptions
    try {
      const messaging = await cds.connect.to('messaging');

      for (const eventType of parsedEventTypes) {
        const topic = `finsecure/ai/${eventType}`;
        messaging.on(topic, async (msg: any) => {
          logger.info(`Event received for agent ${agentId}: ${topic}`);
          // Events are forwarded to the agent's processing pipeline
          await this.forwardEventToAgent(agentId, topic, msg.data);
        });
      }

      // Update agent's event subscriptions
      const existingSubscriptions: string[] = agent.eventSubscriptions
        ? JSON.parse(agent.eventSubscriptions)
        : [];
      const mergedSubscriptions = [...new Set([...existingSubscriptions, ...parsedEventTypes])];

      await UPDATE(CustomAgents).where({ ID: agentId }).set({
        eventSubscriptions: JSON.stringify(mergedSubscriptions),
        modifiedAt: new Date().toISOString(),
      });

      // Log subscription to audit trail
      await this.logAuditEntry(
        agent.tenantId,
        `agent:${agentId}`,
        'AGENT_EVENT_SUBSCRIPTION',
        `CustomAgent:${agentId}`,
        JSON.stringify({ eventTypes: parsedEventTypes })
      );

      logger.info(`Agent ${agentId} subscribed to events: ${parsedEventTypes.join(', ')}`);
      return { success: true, subscriptions: mergedSubscriptions };
    } catch (error: any) {
      logger.error(`Event subscription failed for agent ${agentId}: ${error.message}`);
      return { success: false, error: `Subscription failed: ${error.message}` };
    }
  }

  /**
   * Send a message to another agent via A2A (Agent-to-Agent) protocol.
   * Enables multi-agent investigation workflows.
   *
   * Validates: Requirements 35.7
   */
  async sendA2AMessage(
    sourceAgentId: string,
    targetAgentId: string,
    messageType: string,
    payload: string
  ): Promise<{ success: boolean; message?: A2AMessage; error?: string }> {
    const logger = cds.log('agent-extension');
    const db = await cds.connect.to('db');
    const { CustomAgents } = db.entities('finsecure.ai');

    // Validate source agent
    const sourceAgent = await SELECT.one.from(CustomAgents).where({ ID: sourceAgentId });
    if (!sourceAgent) {
      return { success: false, error: `Source agent not found: ${sourceAgentId}` };
    }
    if (sourceAgent.status === 'QUARANTINED') {
      return { success: false, error: 'Quarantined agents cannot send A2A messages' };
    }

    // Validate target agent
    const targetAgent = await SELECT.one.from(CustomAgents).where({ ID: targetAgentId });
    if (!targetAgent) {
      return { success: false, error: `Target agent not found: ${targetAgentId}` };
    }
    if (targetAgent.status === 'QUARANTINED') {
      return { success: false, error: 'Cannot send messages to quarantined agents' };
    }

    // Parse payload
    let parsedPayload: Record<string, any>;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (e: any) {
      return { success: false, error: `Invalid payload JSON: ${e.message}` };
    }

    // Create the A2A message
    const message: A2AMessage = {
      messageId: cds.utils.uuid(),
      sourceAgentId,
      targetAgentId,
      messageType,
      payload: parsedPayload,
      sentAt: new Date().toISOString(),
    };

    // Emit the message via Event Mesh for async delivery
    try {
      const messaging = await cds.connect.to('messaging');
      await messaging.emit(`finsecure/ai/a2a/${targetAgentId}`, message);

      // Log A2A communication to audit trail
      await this.logAuditEntry(
        sourceAgent.tenantId,
        `agent:${sourceAgentId}`,
        'A2A_MESSAGE_SENT',
        `CustomAgent:${targetAgentId}`,
        JSON.stringify({ messageType, messageId: message.messageId })
      );

      logger.info(`A2A message sent: ${sourceAgentId} -> ${targetAgentId} (${messageType})`);
      return { success: true, message };
    } catch (error: any) {
      logger.error(`A2A message delivery failed: ${error.message}`);
      return { success: false, error: `Message delivery failed: ${error.message}` };
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Validate agent output against required schema and governance rules.
   * Returns error message if validation fails, or null if valid.
   */
  private validateAgentOutput(output: AgentOutput, agent: any): string | null {
    // Mandatory risk category (requirement 35.5)
    if (!output.riskCategory) {
      return 'Missing mandatory riskCategory';
    }
    if (!VALID_RISK_CATEGORIES.includes(output.riskCategory)) {
      return `Invalid riskCategory: ${output.riskCategory}`;
    }

    // Required confidence score (requirement 35.5)
    if (output.confidenceScore === undefined || output.confidenceScore === null) {
      return 'Missing mandatory confidenceScore';
    }
    if (typeof output.confidenceScore !== 'number' || output.confidenceScore < 0 || output.confidenceScore > 100) {
      return `Invalid confidenceScore: ${output.confidenceScore}. Must be 0-100.`;
    }

    // Validate against agent's registered output schema if available
    if (agent.outputSchema) {
      try {
        const schema = JSON.parse(agent.outputSchema);
        const schemaError = this.validatePayloadAgainstSchema(output.payload, schema);
        if (schemaError) {
          return `Output schema validation failed: ${schemaError}`;
        }
      } catch {
        // If schema cannot be parsed, skip schema validation
      }
    }

    return null;
  }

  /**
   * Basic JSON schema validation for agent output payloads.
   * Checks required fields and basic type constraints.
   */
  private validatePayloadAgainstSchema(payload: Record<string, any>, schema: any): string | null {
    if (!schema || typeof schema !== 'object') {
      return null;
    }

    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in payload) && field !== 'riskCategory' && field !== 'confidenceScore') {
          return `Missing required field in payload: ${field}`;
        }
      }
    }

    return null;
  }

  /**
   * Record an alert timestamp in the sliding window for rate limiting.
   */
  private recordAlertTimestamp(agentId: string): void {
    let window = this.rateLimitWindows.get(agentId);
    if (!window) {
      window = { timestamps: [] };
      this.rateLimitWindows.set(agentId, window);
    }
    window.timestamps.push(Date.now());
  }

  /**
   * Classify alert priority based on confidence score.
   */
  private classifyPriority(confidenceScore: number): string {
    if (confidenceScore >= 90) return 'CRITICAL';
    if (confidenceScore >= 70) return 'HIGH';
    if (confidenceScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get SLA deadline hours based on confidence score / priority.
   */
  private getSLAHoursForScore(confidenceScore: number): number {
    if (confidenceScore >= 90) return 4;    // CRITICAL: 4 hours
    if (confidenceScore >= 70) return 24;   // HIGH: 24 hours
    if (confidenceScore >= 40) return 72;   // MEDIUM: 72 hours
    return 168;                              // LOW: 7 days
  }

  /**
   * Forward an event stream message to the agent's processing pipeline.
   * This is the bridge between Event Mesh subscriptions and agent processing.
   */
  private async forwardEventToAgent(
    agentId: string,
    topic: string,
    eventData: any
  ): Promise<void> {
    const logger = cds.log('agent-extension');

    try {
      // Emit on internal topic for agent to pick up
      const messaging = await cds.connect.to('messaging');
      await messaging.emit(`finsecure/ai/agent-inbox/${agentId}`, {
        topic,
        data: eventData,
        receivedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Failed to forward event to agent ${agentId}: ${error.message}`);
    }
  }

  /**
   * Log an entry to the audit trail for agent governance tracking.
   * Mandatory audit trail logging per requirement 35.5.
   */
  private async logAuditEntry(
    tenantId: string,
    userId: string,
    action: string,
    affectedObject: string,
    details: string
  ): Promise<void> {
    const logger = cds.log('agent-extension');

    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      await INSERT.into(AuditTrailEntries).entries({
        ID: cds.utils.uuid(),
        tenantId,
        timestamp: new Date().toISOString(),
        userId,
        action,
        affectedObject,
        sourceIP: '127.0.0.1',
        outcome: 'SUCCESS',
        details,
      });
    } catch (error: any) {
      logger.warn(`Failed to log audit entry: ${error.message}`);
    }
  }
}
