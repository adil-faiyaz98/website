/**
 * FinSecure AI - TypeScript service contract types.
 * Barrel file exporting all interfaces, type unions, and state machines.
 */

// Type unions and enumerations
export {
  DocumentType,
  RiskCategory,
  DetectionMethod,
  PlaybookActionType,
  IAMEventType,
  VulnerabilityCategory,
  DataClassification,
  AlertPriority,
  AlertStatus,
  InvestigationStatus,
  BehavioralProfileStatus,
  ComplianceControlStatus,
  ControlEvidenceResult,
  VulnerabilityLifecycle,
  MLModelStatus,
  MLModelType,
  Severity,
  PlaybookOnFailure,
  CompliancePackId,
  DeploymentModel,
  Region,
  SystemType,
} from './enums';

// State machines
export {
  ALERT_VALID_TRANSITIONS,
  INVESTIGATION_VALID_TRANSITIONS,
  isValidAlertTransition,
  isValidInvestigationTransition,
} from './state-machines';

// Canonical transaction
export { CanonicalTransaction } from './canonical-transaction';

// Risk events
export { RiskEvent, RiskIndicator, AffectedEntity } from './risk-event';

// Alerts
export { Alert } from './alert';

// Investigations
export { Investigation, InvestigationNote, EvidenceItem } from './investigation';

// Playbooks
export { Playbook, PlaybookStep, TriggerCondition } from './playbook';

// Compliance
export { ComplianceControl, ControlEvidence } from './compliance-control';

// Behavioral profiles
export { BehavioralProfile, BehavioralDimensions } from './behavioral-profile';

// Vulnerability findings
export { VulnerabilityFinding, VulnerabilityLocation } from './vulnerability-finding';

// IAM events
export { IAMEvent } from './iam-event';

// ML models
export { MLModel, MLModelMetrics } from './ml-model';

// Tenant configuration
export {
  TenantConfig,
  TenantThresholds,
  SystemRegistration,
  ConnectionConfig,
  MonitoringScope,
} from './tenant-config';
