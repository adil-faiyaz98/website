using { finsecure.ai as db } from '../db/schema';
using from './deployment/deployment-topology-service';
using from './integration/integration-orchestrator';

// ============================================================================
// SecurityAnalystService
// For SecurityAnalyst and SOCOperator roles
// Provides alert triage, investigation management, and transaction review
// ============================================================================

@(requires: 'SecurityAnalyst')
service SecurityAnalystService @(path: '/analyst') {

  // Alerts: read + update status
  @odata.draft.enabled
  entity Alerts as projection on db.Alerts;

  // Investigations: full CRUD with draft support
  @odata.draft.enabled
  entity Investigations as projection on db.Investigations;

  @readonly
  entity InvestigationNotes as projection on db.InvestigationNotes;

  @readonly
  entity EvidenceItems as projection on db.EvidenceItems;

  // Transactions: read-only for analysis
  @readonly
  entity Transactions as projection on db.Transactions;

  // Behavioral Profiles: read-only for context
  @readonly
  entity BehavioralProfiles as projection on db.BehavioralProfiles;

  @readonly
  entity ProfileDimensions as projection on db.ProfileDimensions;

  // SoD Violations: read + acknowledge
  @(Capabilities.DefaultPageSize: 50)
  @odata.draft.enabled
  entity SoDViolations as projection on db.SoDViolations;

  // Playbook executions: read-only for visibility
  @readonly
  entity PlaybookExecutions as projection on db.PlaybookExecutions;

  // Vendor bank changes: read-only for fraud correlation
  @readonly
  entity VendorBankChanges as projection on db.VendorBankChanges;

  // AI Generated Content: read-only summaries
  @readonly
  entity AIGeneratedContent as projection on db.AIGeneratedContent;
}

// ============================================================================
// SecurityAdminService
// For SecurityAdmin role
// Provides rule configuration, playbook management, and system tuning
// ============================================================================

@(requires: 'SecurityAdmin')
service SecurityAdminService @(path: '/admin') {

  // SoD Rules: full CRUD
  @odata.draft.enabled
  entity SoDRules as projection on db.SoDRules;

  // Playbooks: full CRUD
  @odata.draft.enabled
  entity Playbooks as projection on db.Playbooks;

  @readonly
  entity PlaybookExecutions as projection on db.PlaybookExecutions;

  // Tenant Thresholds: read + update
  @odata.draft.enabled
  entity TenantThresholds as projection on db.TenantThresholds;

  // Connected Systems: full CRUD
  @odata.draft.enabled
  entity ConnectedSystems as projection on db.ConnectedSystems;

  // Custom Agents: full CRUD
  @odata.draft.enabled
  entity CustomAgents as projection on db.CustomAgents;

  // ML Models: read-only monitoring
  @readonly
  entity MLModels as projection on db.MLModels;

  @readonly
  entity MLModelFeedback as projection on db.MLModelFeedback;

  // Dead Letter Queue: read for troubleshooting
  @readonly
  entity DeadLetterQueue as projection on db.DeadLetterQueue;

  // Event Processing Metrics: read for monitoring
  @readonly
  entity EventProcessingMetrics as projection on db.EventProcessingMetrics;
}

// ============================================================================
// AuditorService
// For Auditor role
// Provides compliance evidence, audit trail, and report access
// ============================================================================

@(requires: 'Auditor')
service AuditorService @(path: '/auditor') {

  // Compliance Controls: read-only
  @readonly
  entity ComplianceControls as projection on db.ComplianceControls;

  // Control Evidence: read-only
  @readonly
  entity ControlEvidence as projection on db.ControlEvidence;

  // Audit Trail Entries: read-only with pagination max 200 per page
  @readonly
  @(Capabilities.DefaultPageSize: 200)
  entity AuditTrailEntries as projection on db.AuditTrailEntries;

  // Generated Reports: read + create (generate new reports)
  @odata.draft.enabled
  entity GeneratedReports as projection on db.GeneratedReports;

  // Scheduled Reports: read-only
  @readonly
  entity ScheduledReports as projection on db.ScheduledReports;

  // Investigations: read-only for audit review
  @readonly
  entity Investigations as projection on db.Investigations;

  @readonly
  entity InvestigationNotes as projection on db.InvestigationNotes;

  @readonly
  entity EvidenceItems as projection on db.EvidenceItems;

  // Alerts: read-only for audit context
  @readonly
  entity Alerts as projection on db.Alerts;

  // SoD Violations: read-only for compliance review
  @readonly
  @(Capabilities.DefaultPageSize: 50)
  entity SoDViolations as projection on db.SoDViolations;

  // Tenant Compliance Packs: read-only
  @readonly
  entity TenantCompliancePacks as projection on db.TenantCompliancePacks;
}

// ============================================================================
// ExecutiveService
// For Executive role
// Provides aggregated views, summaries, and high-level reports
// ============================================================================

@(requires: 'Executive')
service ExecutiveService @(path: '/executive') {

  // Alerts: read-only aggregated view
  @readonly
  entity Alerts as projection on db.Alerts;

  // Transactions: read-only for trend analysis
  @readonly
  entity Transactions as projection on db.Transactions;

  // Compliance Controls: read-only for status overview
  @readonly
  entity ComplianceControls as projection on db.ComplianceControls;

  // Event Processing Metrics: read-only for system health
  @readonly
  entity EventProcessingMetrics as projection on db.EventProcessingMetrics;

  // Generated Reports: read-only
  @readonly
  entity GeneratedReports as projection on db.GeneratedReports;

  // SoD Violations: read-only summary
  @readonly
  @(Capabilities.DefaultPageSize: 50)
  entity SoDViolations as projection on db.SoDViolations;

  // AI Generated Content: read executive briefings
  @readonly
  entity AIGeneratedContent as projection on db.AIGeneratedContent;
}

// ============================================================================
// IAMAdminService
// For IAMAdmin role
// Provides access governance, review campaigns, and vulnerability oversight
// ============================================================================

@(requires: 'IAMAdmin')
service IAMAdminService @(path: '/iam') {

  // Access Review Campaigns: full CRUD
  @odata.draft.enabled
  entity AccessReviewCampaigns as projection on db.AccessReviewCampaigns;

  // Access Review Tasks: read + update (decisions)
  @odata.draft.enabled
  entity AccessReviewTasks as projection on db.AccessReviewTasks;

  // Vulnerability Findings: read-only
  @readonly
  entity VulnerabilityFindings as projection on db.VulnerabilityFindings;

  // Behavioral Profiles: read-only for access risk context
  @readonly
  entity BehavioralProfiles as projection on db.BehavioralProfiles;

  // Alerts: read-only (IAM-related)
  @readonly
  entity Alerts as projection on db.Alerts;
}

// ============================================================================
// TenantAdminService
// For TenantAdmin role
// Provides tenant configuration, system management, and compliance pack setup
// ============================================================================

@(requires: 'TenantAdmin')
service TenantAdminService @(path: '/tenant') {

  // Tenants: read + update
  @odata.draft.enabled
  entity Tenants as projection on db.Tenants;

  // Connected Systems: full CRUD
  @odata.draft.enabled
  entity ConnectedSystems as projection on db.ConnectedSystems;

  // Tenant Compliance Packs: full CRUD
  @odata.draft.enabled
  entity TenantCompliancePacks as projection on db.TenantCompliancePacks;

  // Tenant Thresholds: update
  @odata.draft.enabled
  entity TenantThresholds as projection on db.TenantThresholds;

  // Scheduled Reports: full CRUD
  @odata.draft.enabled
  entity ScheduledReports as projection on db.ScheduledReports;

  // Event Processing Metrics: read-only for system health
  @readonly
  entity EventProcessingMetrics as projection on db.EventProcessingMetrics;

  // Dead Letter Queue: read for troubleshooting
  @readonly
  entity DeadLetterQueue as projection on db.DeadLetterQueue;
}
