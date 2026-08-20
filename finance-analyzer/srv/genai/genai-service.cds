using { finsecure.ai as db } from '../../db/schema';

/**
 * GenAI Service
 * Interfaces with SAP Generative AI Hub for alert summaries, triage recommendations,
 * investigation assistance, compliance narratives, and executive briefings.
 * All outputs include AI-generated indicator, model used, timestamp, disclaimer,
 * and confidence score (0-100).
 *
 * Validates: Requirements 33.1, 33.2, 33.3, 33.5, 33.6, 33.7, 33.8,
 *            34.1, 34.2, 34.3, 34.4, 34.5, 34.6, 34.7
 */
service GenAIService @(requires: 'system-user') {

  /** AI-generated content entity for versioning and audit */
  entity AIGeneratedContent as projection on db.AIGeneratedContent;
  entity Alerts as projection on db.Alerts;
  entity Investigations as projection on db.Investigations;

  /**
   * Generate alert summary with triage recommendation.
   * Uses RAG pipeline grounded in tenant's historical data.
   */
  action generateAlertSummary(
    tenantId : String(36),
    alertId  : String(36)
  ) returns LargeString;

  /**
   * Generate investigation brief with timeline reconstruction,
   * affected objects, and evidence suggestions.
   */
  action generateInvestigationBrief(
    tenantId        : String(36),
    investigationId : String(36)
  ) returns LargeString;

  /**
   * Explain why a transaction was flagged (natural language).
   * Combines ML feature importance + rules + historical context.
   */
  action explainRiskScore(
    tenantId : String(36),
    alertId  : String(36)
  ) returns LargeString;

  /**
   * Generate compliance narrative report for a framework and period.
   * Includes executive summary, control-by-control assessment, gaps, and trends.
   */
  action generateComplianceNarrative(
    tenantId  : String(36),
    framework : String(30),
    periodStart : DateTime,
    periodEnd   : DateTime
  ) returns LargeString;

  /**
   * Generate root cause analysis for compliance control failures.
   * Explains what failed, why, business impact, and remediation steps.
   */
  action generateRootCauseAnalysis(
    tenantId   : String(36),
    evidenceId : String(36)
  ) returns LargeString;

  /**
   * RAG query against tenant's HANA vector store.
   * Returns contextually grounded responses from tenant historical data.
   */
  action ragQuery(
    tenantId : String(36),
    query    : LargeString,
    context  : LargeString
  ) returns LargeString;

  /**
   * Generate AI-drafted auditor question responses.
   * Grounded in tenant's actual control evidence and configuration.
   */
  action generateAuditResponse(
    tenantId : String(36),
    question : LargeString
  ) returns LargeString;

  /**
   * Generate executive risk briefing.
   * Summarizes top risks, new threats, compliance changes, and recommendations.
   */
  action generateExecutiveBriefing(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * Submit feedback on AI-generated content quality.
   * Used to improve future triage accuracy.
   */
  action submitFeedback(
    contentId : String(36),
    isCorrect : Boolean
  ) returns LargeString;
}
