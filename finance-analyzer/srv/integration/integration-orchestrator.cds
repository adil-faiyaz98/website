/**
 * Integration Orchestrator Service
 *
 * Coordinates end-to-end flows between all FinSecure AI services.
 * Acts as the central wiring layer for event-driven pipelines:
 *   - Ingestion → Detection → Alert → Playbook
 *   - Detection ↔ UEBA (bidirectional)
 *   - Alert → Investigation → Report
 *   - All services → Audit Trail
 *   - Data Privacy middleware
 *   - GenAI connections
 *   - Joule ↔ OData
 *   - Agent Extension ↔ Event Mesh
 *   - SuccessFactors → UEBA
 *   - CVA → Vulnerability Scanner
 */
@(requires: 'system-user')
service IntegrationOrchestratorService @(path: '/integration') {

  /** Health check for integration pipeline status */
  function healthCheck() returns String;

  /** Trigger full pipeline processing for a transaction */
  action processTransaction(transactionId: String, tenantId: String) returns String;

  /** Trigger alert-to-investigation escalation */
  action escalateToInvestigation(alertId: String, analystId: String) returns String;

  /** Trigger HR event processing through UEBA pipeline */
  action processHREvent(userId: String, tenantId: String, eventCategory: String) returns String;

  /** Trigger CVA finding enrichment through vulnerability scanner */
  action enrichVulnerabilityFinding(findingId: String, tenantId: String) returns String;
}
