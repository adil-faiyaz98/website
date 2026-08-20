/**
 * Tenant configuration interfaces.
 * Validates: Requirements 9.4
 */

import { CompliancePackId, DeploymentModel, Region, SystemType } from './enums';

/** Configuration for a connected SAP system */
export interface SystemRegistration {
  /** Unique system identifier */
  systemId: string;
  /** Type of SAP system */
  systemType: SystemType;
  /** SAP release version */
  release: string;
  /** Connection configuration */
  connectionConfig: ConnectionConfig;
  /** Scope of monitoring for this system */
  monitoringScope: MonitoringScope;
}

/** Connection configuration for a registered system */
export interface ConnectionConfig {
  /** Connection type */
  connectionType: 'EVENT_MESH' | 'CLOUD_CONNECTOR' | 'API';
  /** Endpoint URL or destination name */
  endpoint: string;
  /** Authentication method */
  authMethod: 'OAUTH2' | 'BASIC' | 'CERTIFICATE';
  /** Credential store namespace */
  credentialNamespace: string;
}

/** Monitoring scope for a connected system */
export interface MonitoringScope {
  /** SAP modules to monitor */
  modules: string[];
  /** Document types to ingest */
  documentTypes: string[];
  /** Whether to monitor IAM events */
  iamMonitoring: boolean;
  /** Whether to run vulnerability scans */
  vulnerabilityScanning: boolean;
}

/** Tenant-specific threshold configuration */
export interface TenantThresholds {
  /** Risk score threshold for generating alerts (1-99, default 70) */
  riskScoreAlertThreshold: number;
  /** Behavioral deviation sensitivity (1-10, default 5) */
  behavioralSensitivity: number;
  /** SoD violation lookback period in days (1-365, default 90) */
  sodLookbackDays: number;
  /** Hours to correlate vendor bank changes with payments (1-720, default 48) */
  vendorBankChangeHours: number;
  /** Days of inactivity before account is dormant (default 90) */
  dormantAccountDays: number;
  /** Amount threshold for round number detection (default 10000) */
  roundNumberThreshold: number;
  /** Days of dormancy before escalation (default 180) */
  dormancyPeriodDays: number;
  /** Business hours start (0-23) */
  businessHoursStart: number;
  /** Business hours end (0-23) */
  businessHoursEnd: number;
  /** Risk score threshold for flagging payments (default 70) */
  paymentFlagThreshold: number;
  /** Factor above average for unusual payment amounts (default 3) */
  paymentAmountFactor: number;
  /** Record count limit for mass data access detection (default 10000) */
  massDataRecordLimit: number;
  /** Volume limit in MB for mass data access detection (default 50) */
  massDataVolumeLimit: number;
  /** Maximum hours for firefighter access (1-72, default 8) */
  maxFirefighterHours: number;
  /** Tolerance for three-way match verification (default 0.02 = 2%) */
  threeWayMatchTolerance: number;
  /** Days for GRIR clearing deadline (7-180, default 30) */
  grirClearingDays: number;
}

/** Complete tenant configuration */
export interface TenantConfig {
  /** Unique tenant ID */
  tenantId: string;
  /** Tenant subdomain */
  subdomain: string;
  /** Deployment region */
  region: Region;
  /** Deployment model (multi-tenant or single-tenant) */
  deploymentModel: DeploymentModel;
  /** Connected SAP systems */
  connectedSystems: SystemRegistration[];
  /** Active compliance packs */
  compliancePacks: CompliancePackId[];
  /** Tenant-specific thresholds */
  thresholds: TenantThresholds;
}
