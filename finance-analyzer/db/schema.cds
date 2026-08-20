namespace finsecure.ai;

using { cuid, managed } from '@sap/cds/common';

// ============ TYPE DEFINITIONS (ENUMS) ============

type RiskCategory : String(30) enum {
  ANOMALY;
  SOD_VIOLATION;
  FRAUD_PATTERN;
  IAM_VIOLATION;
  PRIVILEGE_ESCALATION;
  INSIDER_THREAT;
  COMPLIANCE_BREACH;
  VULNERABILITY;
  VENDOR_TAMPERING;
  P2P_CONTROL_GAP;
}

type DocumentType : String(30) enum {
  JOURNAL_ENTRY;
  PAYMENT_DOCUMENT;
  VENDOR_MASTER_CHANGE;
  GOODS_RECEIPT;
  INVOICE_RECEIPT;
  PURCHASE_ORDER;
  ROLE_ASSIGNMENT;
  AUTH_CHANGE;
  TRANSPORT_IMPORT;
  SECURITY_AUDIT_EVENT;
  PARAMETER_CHANGE;
}

type DetectionMethod : String(25) enum {
  ML_SCORING;
  RULE_BASED;
  BEHAVIORAL_DEVIATION;
  PATTERN_MATCHING;
  CORRELATION;
  THRESHOLD_BREACH;
}

type AlertPriority : String(10) enum {
  CRITICAL;
  HIGH;
  MEDIUM;
  LOW;
}

type AlertStatus : String(25) enum {
  OPEN;
  IN_PROGRESS;
  ESCALATED;
  RESOLVED_TRUE_POSITIVE;
  RESOLVED_FALSE_POSITIVE;
}

type InvestigationStatus : String(25) enum {
  OPEN;
  IN_PROGRESS;
  ESCALATED;
  RESOLVED_TRUE_POSITIVE;
  RESOLVED_FALSE_POSITIVE;
}

type ProfileStatus : String(10) enum {
  LEARNING;
  ACTIVE;
}

type PlaybookActionType : String(30) enum {
  BLOCK_PAYMENT;
  NOTIFY_APPROVER_CHAIN;
  CREATE_INCIDENT_TICKET;
  REQUEST_ADDITIONAL_APPROVAL;
  SEND_NOTIFICATION;
  LOCK_USER_ACCOUNT;
  REVOKE_ROLE;
  ESCALATE_ALERT;
  CUSTOM_API_CALL;
}

type VulnerabilityCategory : String(30) enum {
  SQL_INJECTION;
  AUTH_CHECK_BYPASS;
  HARDCODED_CREDENTIAL;
  INSECURE_RFC;
  DIRECTORY_TRAVERSAL;
  EXPOSED_API_KEY;
  UNENCRYPTED_TOKEN;
  MALWARE_SIGNATURE;
  CVA_FINDING;
}

type VulnerabilitySeverity : String(10) enum {
  CRITICAL;
  HIGH;
  MEDIUM;
  LOW;
}

type VulnerabilityLifecycle : String(20) enum {
  OPEN;
  ACKNOWLEDGED;
  IN_REMEDIATION;
  RESOLVED;
  RISK_ACCEPTED;
}

type CompliancePackId : String(20) enum {
  NERC_CIP;
  CMMC_ITAR;
  FEDRAMP_NIST;
  SOX_DORA_PCI;
  PIPEDA_OSFI;
}

type PlaybookExecutionStatus : String(20) enum {
  RUNNING;
  COMPLETED;
  FAILED;
  AWAITING_APPROVAL;
  QUEUED;
}

type ControlEvidenceResult : String(10) enum {
  PASS;
  FAIL;
  WARNING;
}

type AuditOutcome : String(10) enum {
  SUCCESS;
  FAILURE;
  DENIED;
}

type ReviewDecision : String(20) enum {
  APPROVE;
  REVOKE;
  FLAG_FOR_REVIEW;
}

type AgentType : String(20) enum {
  JOULE_STUDIO;
  SDK_PRO_CODE;
}

type AgentStatus : String(15) enum {
  ACTIVE;
  QUARANTINED;
}

type AIContentType : String(30) enum {
  ALERT_SUMMARY;
  TRIAGE_RECOMMENDATION;
  INVESTIGATION_BRIEF;
  COMPLIANCE_NARRATIVE;
  RISK_EXPLANATION;
}

type ReportType : String(30) enum {
  RISK_SUMMARY;
  COMPLIANCE;
  FRAUD_DETECTION;
  SOD_VIOLATIONS;
  INVESTIGATION_EVIDENCE;
  ACCESS_REVIEW;
  EXECUTIVE_BRIEFING;
  VULNERABILITY;
}

type ReportFrequency : String(10) enum {
  DAILY;
  WEEKLY;
  MONTHLY;
}

type ReportFormat : String(5) enum {
  PDF;
  CSV;
}

// ============ TENANT MANAGEMENT ============

entity Tenants : cuid, managed {
  subdomain         : String(63);
  displayName       : String(255);
  region            : String(4);      // ca10, us10, us20
  deploymentModel   : String(20);     // multi-tenant, single-tenant
  status            : String(20);     // active, provisioning, deprovisioning, error
  provisionedAt     : Timestamp;
  deletionScheduled : Timestamp;
  thresholds        : Composition of one TenantThresholds;
  systems           : Composition of many ConnectedSystems;
  compliancePacks   : Composition of many TenantCompliancePacks;
}

entity TenantThresholds : cuid {
  tenant                    : Association to Tenants;
  riskScoreAlertThreshold   : Integer default 70;
  behavioralSensitivity     : Integer default 5;
  sodLookbackDays           : Integer default 90;
  vendorBankChangeHours     : Integer default 48;
  dormantAccountDays        : Integer default 90;
  roundNumberThreshold      : Decimal(15,2) default 10000;
  dormancyPeriodDays        : Integer default 180;
  businessHoursStart        : Integer default 8;
  businessHoursEnd          : Integer default 18;
  paymentFlagThreshold      : Integer default 70;
  paymentAmountFactor       : Decimal(5,2) default 3.0;
  massDataRecordLimit       : Integer default 10000;
  massDataVolumeMB          : Integer default 50;
  maxFirefighterHours       : Integer default 8;
  threeWayMatchTolerance    : Decimal(5,4) default 0.02;
  grirClearingDays          : Integer default 30;
  mlRetrainingFrequency     : String(10) default 'WEEKLY';
  scanFrequency             : String(10) default 'WEEKLY';
}

entity ConnectedSystems : cuid, managed {
  tenant          : Association to Tenants;
  systemId        : String(50);
  systemType      : String(10);       // S4HC, S4OP, ECC
  release         : String(20);
  connectionType  : String(20);       // EVENT_MESH, CLOUD_CONNECTOR, API
  status          : String(20);       // active, error, disconnected
  lastSyncAt      : Timestamp;
  monitoringScope : String(500);      // JSON of monitored modules
}

entity TenantCompliancePacks : cuid {
  tenant      : Association to Tenants;
  packId      : CompliancePackId;
  activated   : Boolean default false;
  activatedAt : Timestamp;
}

// ============ TRANSACTIONS & INGESTION ============

entity Transactions : cuid, managed {
  tenantId          : String(36);
  sourceSystem      : Association to ConnectedSystems;
  sourceEventId     : String(100);
  documentNumber    : String(20);
  documentType      : DocumentType;
  postingDate       : Date;
  entryDate         : Date;
  amount            : Decimal(23,2);
  currency          : String(3);
  userId            : String(12);
  companyCode       : String(4);
  debitAccount      : String(10);
  creditAccount     : String(10);
  costCenter        : String(10);
  vendorId          : String(10);
  businessObjectRef : String(100);
  riskScore         : Integer;
  scored            : Boolean default false;
  metadata          : LargeString;    // JSON
  ingestedAt        : Timestamp;
}

entity DeduplicationLog : cuid {
  tenantId      : String(36);
  sourceEventId : String(100);
  eventTimestamp: Timestamp;
  transactionId : String(36);
  processedAt   : Timestamp;
}

entity DeadLetterQueue : cuid, managed {
  tenantId      : String(36);
  eventPayload  : LargeString;
  failureReason : String(1000);
  receivedAt    : Timestamp;
  retainUntil   : Timestamp;
  processed     : Boolean default false;
}

// ============ BEHAVIORAL PROFILES (UEBA) ============

entity BehavioralProfiles : cuid, managed {
  tenantId          : String(36);
  userId            : String(12);
  status            : ProfileStatus;
  windowStartDate   : Date;
  windowEndDate     : Date;
  daysCovered       : Integer;
  hrRiskMultiplier  : Decimal(3,2) default 1.0;
  hrRiskExpiresAt   : Timestamp;
  lastUpdated       : Timestamp;
  dimensions        : Composition of one ProfileDimensions;
}

entity ProfileDimensions : cuid {
  profile               : Association to BehavioralProfiles;
  postingFreqMean       : Decimal(10,4);
  postingFreqStdDev     : Decimal(10,4);
  hourDistribution      : LargeString;   // JSON array[24]
  accountCombinations   : LargeString;   // JSON set
  amountMean            : Decimal(23,2);
  amountStdDev          : Decimal(23,2);
  amountP90             : Decimal(23,2);
  amountP99             : Decimal(23,2);
  costCenters           : LargeString;   // JSON set
  vendorRelationships   : LargeString;   // JSON set
  transactionCodes      : LargeString;   // JSON set
  dataAccessMeanPerDay  : Decimal(10,2);
  dataAccessStdDev      : Decimal(10,2);
  dataAccessP90         : Decimal(10,2);
}

// ============ SOD RULES & VIOLATIONS ============

entity SoDRules : cuid, managed {
  tenantId      : String(36);
  ruleName      : String(200);
  ruleType      : String(10);         // PREDEFINED, CUSTOM
  activity1     : String(100);
  activity2     : String(100);
  severity      : String(10);         // CRITICAL, HIGH, MEDIUM
  isActive      : Boolean default true;
  lookbackDays  : Integer default 90;
}

entity SoDViolations : cuid, managed {
  tenantId      : String(36);
  rule          : Association to SoDRules;
  userId        : String(12);
  activity1Time : Timestamp;
  activity2Time : Timestamp;
  activity1Obj  : String(100);
  activity2Obj  : String(100);
  severity      : String(10);
  status        : String(15);         // ACTIVE, ACKNOWLEDGED
  acknowledgedBy: String(12);
  acknowledgedAt: Timestamp;
  alertId       : String(36);
}

// ============ ALERTS & INVESTIGATIONS ============

entity Alerts : cuid, managed {
  tenantId            : String(36);
  priority            : AlertPriority;
  status              : AlertStatus;
  riskCategory        : RiskCategory;
  riskScore           : Integer;
  financialExposure   : Decimal(23,2);
  title               : String(500);
  description         : LargeString;
  triggeringTxId      : String(36);
  riskIndicators      : LargeString;  // JSON
  affectedEntities    : LargeString;  // JSON
  recommendedActions  : LargeString;  // JSON
  assignedAnalyst     : String(12);
  aiSummary           : LargeString;
  aiTriageRec         : String(100);
  aiConfidenceScore   : Integer;
  clusterId           : String(36);
  slaDeadline         : Timestamp;
  escalatedAt         : Timestamp;
  resolvedAt          : Timestamp;
  resolutionType      : String(30);
  resolutionNotes     : LargeString;
  investigation       : Association to Investigations;
}

entity Investigations : cuid, managed {
  tenantId          : String(36);
  alert             : Association to Alerts;
  status            : InvestigationStatus;
  assignedAnalyst   : String(12);
  resolutionType    : String(30);
  resolutionNotes   : LargeString;
  aiInvestBrief     : LargeString;
  startedAt         : Timestamp;
  resolvedAt        : Timestamp;
  elapsedTimeMs     : Integer64;
  notes             : Composition of many InvestigationNotes;
  evidence          : Composition of many EvidenceItems;
}

entity InvestigationNotes : cuid, managed {
  investigation : Association to Investigations;
  author        : String(12);
  content       : LargeString;        // 1-5000 chars
}

entity EvidenceItems : cuid, managed {
  investigation : Association to Investigations;
  evidenceType  : String(30);
  content       : LargeString;
  reference     : String(200);
}

// ============ PLAYBOOKS ============

entity Playbooks : cuid, managed {
  tenantId          : String(36);
  name              : String(200);
  triggerConditions : LargeString;     // JSON
  steps             : LargeString;     // JSON (max 20 steps)
  requiresApproval  : Boolean default false;
  approvalTimeoutMin: Integer default 15;
  isActive          : Boolean default true;
  playbookType      : String(10);     // PREDEFINED, CUSTOM
}

entity PlaybookExecutions : cuid, managed {
  playbook      : Association to Playbooks;
  tenantId      : String(36);
  alertId       : String(36);
  status        : PlaybookExecutionStatus;
  entityId      : String(100);
  stepsExecuted : LargeString;        // JSON
  startedAt     : Timestamp;
  completedAt   : Timestamp;
  failureReason : String(1000);
}

// ============ COMPLIANCE ============

entity ComplianceControls : cuid, managed {
  tenantId          : String(36);
  controlId         : String(50);
  frameworkRef      : String(50);
  name              : String(200);
  objective         : LargeString;
  testProcedure     : LargeString;
  expectedResult    : LargeString;
  evaluationHours   : Integer default 24;
  status            : String(10);     // ACTIVE, INACTIVE
  compliancePack    : CompliancePackId;
  severity          : String(10);
}

entity ControlEvidence : cuid, managed {
  control         : Association to ComplianceControls;
  tenantId        : String(36);
  result          : ControlEvidenceResult;
  details         : LargeString;
  dataSnapshot    : LargeString;
  evaluatedAt     : Timestamp;
  retentionExpiry : Timestamp;        // Min 7 years
}

// ============ VULNERABILITIES ============

entity VulnerabilityFindings : cuid, managed {
  tenantId            : String(36);
  systemId            : String(50);
  category            : VulnerabilityCategory;
  severity            : VulnerabilitySeverity;
  programName         : String(100);
  lineNumber          : Integer;
  tableName           : String(30);
  fieldName           : String(30);
  transportRequest    : String(20);
  description         : LargeString;
  remediationGuidance : LargeString;
  exploitRiskScore    : Integer;
  lifecycle           : VulnerabilityLifecycle;
  slaDeadline         : Timestamp;
  detectedAt          : Timestamp;
  resolvedAt          : Timestamp;
}

// ============ ML MODELS ============

entity MLModels : cuid, managed {
  tenantId          : String(36);
  modelType         : String(30);     // ANOMALY, FRAUD, BEHAVIORAL
  version           : Integer;
  status            : String(15);     // TRAINING, ACTIVE, SHADOW, DEPRECATED
  precision         : Decimal(5,4);
  recall            : Decimal(5,4);
  f1Score           : Decimal(5,4);
  falsePositiveRate : Decimal(5,4);
  trainedAt         : Timestamp;
  promotedAt        : Timestamp;
  trainingDataDays  : Integer;
  trainingTxCount   : Integer;
  aiCoreDeploymentId: String(100);
}

entity MLModelFeedback : cuid, managed {
  model           : Association to MLModels;
  tenantId        : String(36);
  alertId         : String(36);
  feedbackType    : String(20);       // TRUE_POSITIVE, FALSE_POSITIVE
  providedBy      : String(12);
  providedAt      : Timestamp;
}

// ============ VENDOR MONITORING ============

entity VendorBankChanges : cuid, managed {
  tenantId            : String(36);
  vendorId            : String(10);
  changingUser        : String(12);
  previousBankHash    : String(64);
  newBankHash         : String(64);
  changeJustification : String(500);
  riskLevel           : String(10);   // LOW, MEDIUM, HIGH, CRITICAL
  vendorRiskScore     : Integer;
  changedAt           : Timestamp;
  correlatedPayment   : String(36);   // Alert ID if correlated
}

// ============ ACCESS GOVERNANCE ============

entity AccessReviewCampaigns : cuid, managed {
  tenantId        : String(36);
  triggerType     : String(20);
  status          : String(15);       // ACTIVE, COMPLETED, OVERDUE
  deadline        : Timestamp;
  completionRate  : Decimal(5,2);
  tasks           : Composition of many AccessReviewTasks;
}

entity AccessReviewTasks : cuid, managed {
  campaign      : Association to AccessReviewCampaigns;
  reviewerId    : String(12);
  userId        : String(12);
  roles         : LargeString;        // JSON
  decision      : ReviewDecision;
  justification : String(1000);
  completedAt   : Timestamp;
}

// ============ CUSTOM AGENTS ============

entity CustomAgents : cuid, managed {
  tenantId            : String(36);
  name                : String(200);
  agentType           : AgentType;
  eventSubscriptions  : LargeString;  // JSON
  outputSchema        : LargeString;  // JSON
  rateLimitPerHour    : Integer default 100;
  status              : AgentStatus;
  quarantineReason    : String(500);
  lastActiveAt        : Timestamp;
}

// ============ AUDIT TRAIL ============

entity AuditTrailEntries : cuid {
  tenantId      : String(36);
  timestamp     : Timestamp;          // UTC, millisecond precision
  userId        : String(100);
  action        : String(100);
  affectedObject: String(200);
  sourceIP      : String(45);
  outcome       : AuditOutcome;
  details       : LargeString;
  integrityHash : String(64);
}

// ============ REPORTING ============

entity ScheduledReports : cuid, managed {
  tenantId    : String(36);
  reportType  : ReportType;
  framework   : String(30);
  frequency   : ReportFrequency;
  recipients  : LargeString;          // JSON, max 50
  lastRun     : Timestamp;
  nextRun     : Timestamp;
  status      : String(10);
}

entity GeneratedReports : cuid, managed {
  tenantId        : String(36);
  reportType      : ReportType;
  periodStart     : Date;
  periodEnd       : Date;
  format          : ReportFormat;
  digitalSignature: String(500);
  fileSizeBytes   : Integer64;
  generatedAt     : Timestamp;
  content         : LargeBinary;
}

// ============ AI GENERATED CONTENT ============

entity AIGeneratedContent : cuid, managed {
  tenantId        : String(36);
  contentType     : AIContentType;
  relatedEntityId : String(36);
  content         : LargeString;
  confidenceScore : Integer;
  modelUsed       : String(50);
  generatedAt     : Timestamp;
  version         : Integer;
  feedbackCorrect : Boolean;
}

// ============ EVENT PROCESSING METRICS ============

entity EventProcessingMetrics : cuid {
  tenantId          : String(36);
  timestamp         : Timestamp;
  throughputPerSec  : Decimal(10,2);
  latencyP50Ms      : Integer;
  latencyP95Ms      : Integer;
  latencyP99Ms      : Integer;
  dlqDepth          : Integer;
  consumerInstances : Integer;
  backPressureActive: Boolean;
}
