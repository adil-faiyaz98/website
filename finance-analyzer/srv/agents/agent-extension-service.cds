using { finsecure.ai as db } from '../../db/schema';

/**
 * Agent Extension Service
 * Provides extension API for custom AI agents built with SAP Cloud SDK for AI.
 * Handles agent registration, output processing, rate limiting, quarantine,
 * event stream subscriptions, and pre-built agent templates.
 *
 * Validates: Requirements 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8
 */
service AgentExtensionService @(requires: 'system-user') {

  /** Custom Agents entity */
  entity CustomAgents as projection on db.CustomAgents;

  /** Alerts entity for creating agent-generated alerts */
  entity Alerts as projection on db.Alerts;

  /** Audit Trail for logging agent actions */
  entity AuditTrailEntries as projection on db.AuditTrailEntries;

  /**
   * Register a custom AI agent (Joule Studio or SDK pro-code).
   * Configures event subscriptions and output schema.
   */
  action registerAgent(
    tenantId           : String(36),
    name               : String(200),
    agentType          : String(20),
    eventSubscriptions : LargeString,
    outputSchema       : LargeString,
    rateLimitPerHour   : Integer
  ) returns LargeString;

  /**
   * Process agent output through the standard Alert Management workflow.
   * Applies same RBAC and data governance controls.
   */
  action processAgentOutput(
    agentId         : String(36),
    tenantId        : String(36),
    riskCategory    : String(30),
    confidenceScore : Integer,
    payload         : LargeString,
    title           : String(500),
    description     : LargeString
  ) returns LargeString;

  /**
   * Check rate limit for an agent.
   * Returns whether the agent is within its allowed alert rate.
   */
  action checkRateLimit(
    agentId : String(36)
  ) returns LargeString;

  /**
   * Quarantine an agent due to rate limit breach, schema failure, or errors.
   * Stops processing and generates system health alert.
   */
  action quarantineAgent(
    agentId : String(36),
    reason  : String(500)
  ) returns LargeString;

  /**
   * Subscribe an agent to event stream topics.
   * Integrates with SAP Event Mesh for real-time transaction events.
   */
  action subscribeToEvents(
    agentId    : String(36),
    eventTypes : LargeString
  ) returns LargeString;

  /**
   * Get available pre-built agent templates.
   * Returns templates for common extension scenarios.
   */
  action getAgentTemplates() returns LargeString;

  /**
   * Send a message to another agent via A2A protocol.
   * Enables multi-agent investigation workflows.
   */
  action sendA2AMessage(
    sourceAgentId : String(36),
    targetAgentId : String(36),
    messageType   : String(50),
    payload       : LargeString
  ) returns LargeString;
}
