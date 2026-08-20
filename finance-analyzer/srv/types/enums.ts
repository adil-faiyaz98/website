/**
 * Type unions and enumerations for FinSecure AI service contracts.
 * Validates: Requirements 2.2, 3.1, 9.1, 9.4
 */

/** Document types ingested from SAP source systems */
export type DocumentType =
  | 'JOURNAL_ENTRY'
  | 'PAYMENT_DOCUMENT'
  | 'VENDOR_MASTER_CHANGE'
  | 'GOODS_RECEIPT'
  | 'INVOICE_RECEIPT'
  | 'PURCHASE_ORDER'
  | 'ROLE_ASSIGNMENT'
  | 'AUTH_CHANGE'
  | 'TRANSPORT_IMPORT'
  | 'SECURITY_AUDIT_EVENT'
  | 'PARAMETER_CHANGE';

/** Risk categories detected by the detection engine */
export type RiskCategory =
  | 'ANOMALY'
  | 'SOD_VIOLATION'
  | 'FRAUD_PATTERN'
  | 'IAM_VIOLATION'
  | 'PRIVILEGE_ESCALATION'
  | 'INSIDER_THREAT'
  | 'COMPLIANCE_BREACH'
  | 'VULNERABILITY'
  | 'VENDOR_TAMPERING'
  | 'P2P_CONTROL_GAP';

/** Methods used to detect risk events */
export type DetectionMethod =
  | 'ML_SCORING'
  | 'RULE_BASED'
  | 'BEHAVIORAL_DEVIATION'
  | 'PATTERN_MATCHING'
  | 'CORRELATION'
  | 'THRESHOLD_BREACH';

/** Automated actions available in playbook steps */
export type PlaybookActionType =
  | 'BLOCK_PAYMENT'
  | 'NOTIFY_APPROVER_CHAIN'
  | 'CREATE_INCIDENT_TICKET'
  | 'REQUEST_ADDITIONAL_APPROVAL'
  | 'SEND_NOTIFICATION'
  | 'LOCK_USER_ACCOUNT'
  | 'REVOKE_ROLE'
  | 'ESCALATE_ALERT'
  | 'CUSTOM_API_CALL';

/** IAM event types monitored across connected SAP systems */
export type IAMEventType =
  | 'ROLE_ASSIGNMENT'
  | 'ROLE_REMOVAL'
  | 'PROFILE_CHANGE'
  | 'CRITICAL_AUTH_GRANT'
  | 'SELF_ESCALATION'
  | 'SERVICE_ACCOUNT_DIALOG_LOGON'
  | 'DORMANT_ACCOUNT_DETECTED'
  | 'FIREFIGHTER_ACTIVATION'
  | 'FIREFIGHTER_OVERDUE'
  | 'TEMPORARY_ACCESS_EXPIRED';

/** Categories of vulnerability findings from code and config scans */
export type VulnerabilityCategory =
  | 'SQL_INJECTION'
  | 'AUTH_CHECK_BYPASS'
  | 'HARDCODED_CREDENTIALS'
  | 'INSECURE_RFC'
  | 'DIRECTORY_TRAVERSAL'
  | 'EXPOSED_CREDENTIALS'
  | 'MALWARE_SIGNATURE'
  | 'TRANSPORT_SECURITY_VIOLATION';

/** Data classification levels for privacy and masking controls */
export type DataClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

/** Alert priority levels */
export type AlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Alert lifecycle states */
export type AlertStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'RESOLVED_TRUE_POSITIVE'
  | 'RESOLVED_FALSE_POSITIVE';

/** Investigation lifecycle states */
export type InvestigationStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'RESOLVED_TRUE_POSITIVE'
  | 'RESOLVED_FALSE_POSITIVE';

/** Behavioral profile states */
export type BehavioralProfileStatus = 'LEARNING' | 'ACTIVE';

/** Compliance control states */
export type ComplianceControlStatus = 'ACTIVE' | 'INACTIVE';

/** Control evidence evaluation result */
export type ControlEvidenceResult = 'PASS' | 'FAIL' | 'WARNING';

/** Vulnerability lifecycle states */
export type VulnerabilityLifecycle =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_REMEDIATION'
  | 'RESOLVED'
  | 'RISK_ACCEPTED';

/** ML Model lifecycle states */
export type MLModelStatus = 'TRAINING' | 'ACTIVE' | 'SHADOW' | 'DEPRECATED';

/** ML Model types */
export type MLModelType = 'ANOMALY' | 'FRAUD' | 'BEHAVIORAL';

/** Vulnerability severity levels */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Playbook step failure handling strategy */
export type PlaybookOnFailure = 'RETRY_ONCE' | 'HALT';

/** Compliance pack identifiers */
export type CompliancePackId =
  | 'NERC_CIP'
  | 'CMMC_ITAR'
  | 'FEDRAMP_NIST'
  | 'SOX_DORA_PCI'
  | 'PIPEDA_OSFI';

/** Deployment model for tenants */
export type DeploymentModel = 'multi-tenant' | 'single-tenant';

/** Supported BTP regions */
export type Region = 'ca10' | 'us10' | 'us20';

/** Connected SAP system types */
export type SystemType = 'S4HC' | 'S4OP' | 'ECC';
