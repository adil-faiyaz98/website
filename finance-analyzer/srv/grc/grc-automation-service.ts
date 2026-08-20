import cds = require('@sap/cds');
import { RiskEvent, RiskIndicator } from '../types/risk-event';
import { RiskCategory, DetectionMethod } from '../types/enums';

const { ApplicationService } = cds;

// ============================================================================
// Interfaces
// ============================================================================

/** A monitored SAP security parameter with baseline comparison */
export interface SecurityParameter {
  /** Unique identifier for the parameter check */
  parameterId: string;
  /** SAP profile parameter name (e.g., "login/fails_to_session_end") */
  parameterName: string;
  /** System where the parameter was checked */
  systemId: string;
  /** Expected baseline value configured for the tenant */
  expectedValue: string;
  /** Current value read from the connected SAP system */
  currentValue: string;
  /** Timestamp of last check */
  lastChecked: Date;
  /** Whether the parameter is compliant with baseline */
  compliant: boolean;
}

/** A deviation detected in a security parameter */
export interface SecurityParameterDeviation {
  /** The parameter that deviated */
  parameter: SecurityParameter;
  /** User or process that performed the change (if available) */
  changedBy?: string;
  /** Timestamp when the change was detected */
  detectedAt: Date;
}

/** Security audit log event from SM20/RSAU_READ_LOG */
export interface SecurityAuditEvent {
  /** Event identifier */
  eventId: string;
  /** SAP user involved */
  userId: string;
  /** SAP client number */
  client: string;
  /** System where the event occurred */
  systemId: string;
  /** Event class (e.g., failed logon, tcode start, RFC rejection) */
  eventClass: SecurityAuditEventClass;
  /** Event timestamp */
  timestamp: Date;
  /** Source terminal/IP */
  terminal?: string;
  /** Transaction code (if applicable) */
  transactionCode?: string;
  /** Additional event details */
  details: Record<string, unknown>;
}

/** Classes of security audit events monitored */
export type SecurityAuditEventClass =
  | 'FAILED_LOGON'
  | 'SUCCESSFUL_LOGON'
  | 'USER_LOCK'
  | 'USER_UNLOCK'
  | 'RFC_REJECTION'
  | 'CRITICAL_TCODE_START'
  | 'REPORT_START'
  | 'AUTHORITY_CHECK_FAILURE';

/** Transport management event for monitoring */
export interface TransportEvent {
  /** Transport request ID (e.g., "DEVK900123") */
  transportId: string;
  /** System where the transport was imported */
  targetSystemId: string;
  /** User who released/imported the transport */
  owner: string;
  /** Transport description */
  description: string;
  /** Whether the transport passed through QA */
  passedQA: boolean;
  /** Objects contained in the transport */
  objects: TransportObject[];
  /** Import timestamp */
  importedAt: Date;
}

/** An object contained in a transport request */
export interface TransportObject {
  /** Object type (e.g., PROG, TABL, AUTH, FUGR) */
  objectType: string;
  /** Object name */
  objectName: string;
  /** Table name if the object modifies a table */
  tableName?: string;
}

/** Transport alert raised by monitoring */
export interface TransportAlert {
  /** Transport request that triggered the alert */
  transportId: string;
  /** System where the issue was detected */
  systemId: string;
  /** Reason for the alert */
  alertReason: TransportAlertReason;
  /** Detailed information about the finding */
  details: Record<string, unknown>;
}

/** Reasons for transport alert generation */
export type TransportAlertReason =
  | 'BYPASSED_QA'
  | 'AUTH_TABLE_MODIFICATION'
  | 'SECURITY_CODE_CHANGE';

/** MITRE ATT&CK mapping result */
export interface MitreMapping {
  /** MITRE technique ID (e.g., "T0800") */
  techniqueId: string;
  /** Technique name */
  techniqueName: string;
  /** Sub-technique ID if applicable */
  subTechniqueId?: string;
  /** Sub-technique name */
  subTechniqueName?: string;
  /** ATT&CK tactic (e.g., "Initial Access", "Lateral Movement") */
  tactic: string;
  /** SAP-specific context for the technique */
  sapContext: string;
  /** Remediation recommendations */
  remediationSteps: string[];
}

/** Remediation recommendation for a security finding */
export interface RemediationRecommendation {
  /** Priority of the remediation (1=immediate, 2=short-term, 3=long-term) */
  priority: 1 | 2 | 3;
  /** Short title of the recommendation */
  title: string;
  /** Detailed description of the remediation action */
  description: string;
  /** Affected SAP object/parameter */
  affectedObject: string;
  /** Whether this can be automated */
  automatable: boolean;
  /** Estimated effort to implement */
  estimatedEffort: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ============================================================================
// Constants
// ============================================================================

/** Critical SAP security parameters to monitor (Req 25.1) */
const CRITICAL_SECURITY_PARAMETERS: Record<string, { description: string; recommendedValue: string }> = {
  'login/fails_to_session_end': {
    description: 'Number of failed logon attempts before session termination',
    recommendedValue: '3',
  },
  'login/no_automatic_user_sapstar': {
    description: 'Disable automatic SAP* user logon',
    recommendedValue: '1',
  },
  'rfc/reject_expired_passwd': {
    description: 'Reject RFC connections with expired passwords',
    recommendedValue: '1',
  },
  'login/password_expiration_time': {
    description: 'Maximum password age in days',
    recommendedValue: '90',
  },
  'rsau/enable': {
    description: 'Security audit log enabled',
    recommendedValue: '1',
  },
  'icm/server_port_0': {
    description: 'ICM server port configuration (HTTPS enforcement)',
    recommendedValue: 'PROT=HTTPS',
  },
} as const;

/** Maximum alert generation time in milliseconds (5 minutes = 300,000ms) */
const MAX_ALERT_TIME_MS = 5 * 60 * 1000;

/** Default failed logon threshold per user within time window */
const DEFAULT_FAILED_LOGON_THRESHOLD = 5;

/** Default time window for failed logon detection (10 minutes) */
const DEFAULT_FAILED_LOGON_WINDOW_MS = 10 * 60 * 1000;

/** SAP authorization-related tables monitored in transports (Req 25.3) */
const AUTH_RELATED_TABLES = [
  'USR02',   // User passwords/logon data
  'USR04',   // User master auth profiles
  'AGR_1251', // Role authorization data
  'AGR_USERS', // Role-to-user assignments
  'USR10',   // User authorization profiles
  'USR12',   // User authorization values
  'USGRP',   // User group assignment
] as const;

/** Critical transaction codes monitored in audit log */
const CRITICAL_TRANSACTION_CODES = [
  'SU01', 'SU10', 'PFCG', 'SE38', 'SE80', 'SM49', 'SM69',
  'SE16', 'SE16N', 'SM30', 'STMS', 'SCC4', 'RZ10', 'RZ11',
] as const;

/** Standard SAP client numbers (unusual clients trigger alerts) */
const STANDARD_CLIENTS = ['000', '001', '100', '200', '300', '800'] as const;

// ============================================================================
// MITRE ATT&CK for SAP Mapping Definitions
// ============================================================================

/** MITRE ATT&CK technique mappings for SAP-specific threats */
const MITRE_ATTACK_SAP_MAPPINGS: Record<string, MitreMapping[]> = {
  'PARAMETER_DEVIATION': [
    {
      techniqueId: 'T0800',
      techniqueName: 'Exploit Public-Facing Application',
      tactic: 'Initial Access',
      sapContext: 'Weakened login parameters may enable brute-force attacks on SAP logon endpoints',
      remediationSteps: [
        'Restore security parameter to baseline value immediately',
        'Review change logs for unauthorized parameter modifications',
        'Implement parameter change monitoring with auto-revert capability',
      ],
    },
  ],
  'FAILED_LOGON_FLOOD': [
    {
      techniqueId: 'T1110',
      techniqueName: 'Brute Force',
      subTechniqueId: 'T1110.001',
      subTechniqueName: 'Password Guessing',
      tactic: 'Credential Access',
      sapContext: 'Multiple failed logon attempts against SAP system indicate credential guessing or brute-force attack',
      remediationSteps: [
        'Lock the targeted user account immediately',
        'Review source IPs and block if external',
        'Verify login/fails_to_session_end parameter is set appropriately',
        'Enable enhanced security audit logging for the affected client',
      ],
    },
  ],
  'UNUSUAL_CLIENT_LOGON': [
    {
      techniqueId: 'T1078',
      techniqueName: 'Valid Accounts',
      subTechniqueId: 'T1078.004',
      subTechniqueName: 'Cloud Accounts',
      tactic: 'Persistence',
      sapContext: 'Logon from unusual SAP client numbers may indicate use of default accounts or lateral movement between clients',
      remediationSteps: [
        'Verify user should have access to the unusual client',
        'Review SCC4 client settings for proper lock status',
        'Audit client copy activities and cross-client access',
      ],
    },
  ],
  'USER_LOCK_UNLOCK': [
    {
      techniqueId: 'T1531',
      techniqueName: 'Account Access Removal',
      tactic: 'Impact',
      sapContext: 'Repeated lock/unlock cycles may indicate account manipulation or cover-up of unauthorized access',
      remediationSteps: [
        'Review who performed the lock/unlock operations',
        'Check for unauthorized activities during the unlock window',
        'Verify the unlock was authorized through proper channels',
      ],
    },
  ],
  'RFC_REJECTION': [
    {
      techniqueId: 'T0882',
      techniqueName: 'SAP RFC Exploitation',
      tactic: 'Lateral Movement',
      sapContext: 'RFC connection rejections may indicate attempts to exploit trusted RFC destinations for lateral movement',
      remediationSteps: [
        'Review RFC destination configurations for overly permissive trust',
        'Validate RFC user authorization assignments',
        'Enable rfc/reject_expired_passwd parameter',
        'Monitor RFC connection attempts from unexpected sources',
      ],
    },
  ],
  'TRANSPORT_BYPASS': [
    {
      techniqueId: 'T1195',
      techniqueName: 'Supply Chain Compromise',
      subTechniqueId: 'T1195.002',
      subTechniqueName: 'Compromise Software Supply Chain',
      tactic: 'Initial Access',
      sapContext: 'Transport imported directly to production bypassing QA indicates unauthorized code deployment',
      remediationSteps: [
        'Immediately review transport contents for malicious code',
        'Lock the transport route to prevent further bypasses',
        'Review STMS configuration for proper transport routes',
        'Investigate who authorized the direct import',
      ],
    },
  ],
  'AUTH_TABLE_MODIFICATION': [
    {
      techniqueId: 'T1098',
      techniqueName: 'Account Manipulation',
      subTechniqueId: 'T1098.001',
      subTechniqueName: 'Additional Cloud Credentials',
      tactic: 'Persistence',
      sapContext: 'Direct modification of authorization tables via transport bypasses normal role management and may indicate privilege escalation attempt',
      remediationSteps: [
        'Audit the specific table changes in the transport',
        'Compare affected user authorizations before and after',
        'Verify changes through proper PFCG role management',
        'Implement table logging for authorization tables',
      ],
    },
  ],
  'SECURITY_CODE_CHANGE': [
    {
      techniqueId: 'T1027',
      techniqueName: 'Obfuscated Files or Information',
      tactic: 'Defense Evasion',
      sapContext: 'Transport modifying security-relevant programs may be attempting to weaken security controls or inject backdoors',
      remediationSteps: [
        'Perform code review on all modified programs',
        'Run vulnerability scan on transported code',
        'Verify changes are documented and approved',
        'Check for hardcoded credentials or backdoor patterns',
      ],
    },
  ],
  'PRIVILEGE_ESCALATION': [
    {
      techniqueId: 'T1078',
      techniqueName: 'Valid Accounts',
      subTechniqueId: 'T1078.003',
      subTechniqueName: 'Local Accounts',
      tactic: 'Privilege Escalation',
      sapContext: 'Self-assignment of critical authorizations or unauthorized role changes in SAP system',
      remediationSteps: [
        'Immediately revoke the escalated privileges',
        'Lock the user account pending investigation',
        'Review all actions performed with elevated access',
        'Audit PFCG and SU01 change logs',
      ],
    },
  ],
  'IAM_VIOLATION': [
    {
      techniqueId: 'T1136',
      techniqueName: 'Create Account',
      tactic: 'Persistence',
      sapContext: 'Unauthorized IAM changes may indicate attempt to establish persistent access',
      remediationSteps: [
        'Review recent role and user master changes',
        'Validate all assignments through access governance workflow',
        'Check for dormant accounts with excessive privileges',
      ],
    },
  ],
  'INSIDER_THREAT': [
    {
      techniqueId: 'T1567',
      techniqueName: 'Exfiltration Over Web Service',
      tactic: 'Exfiltration',
      sapContext: 'Mass data access or unusual download patterns from SAP system by internal user',
      remediationSteps: [
        'Review data access logs for the user',
        'Correlate with HR events (termination, PIP)',
        'Restrict access to sensitive transactions',
        'Enable enhanced monitoring for the user',
      ],
    },
  ],
};

// ============================================================================
// GRC Automation Service
// ============================================================================

/**
 * GRC Automation Service
 *
 * Provides continuous monitoring of SAP security parameters, transport
 * management, and security audit logs. Maps findings to the MITRE ATT&CK
 * framework for SAP and generates automated remediation recommendations.
 *
 * Validates: Requirements 25.1, 25.2, 25.3, 25.6, 25.8
 */
export default class GRCAutomationService extends (ApplicationService as any) {
  async init() {
    this.on('checkSecurityParameters', async (req: any) => {
      const { tenantId, systemId, parameters } = req.data;
      const parsedParams: SecurityParameter[] = parameters ? JSON.parse(parameters) : [];
      const result = await this.checkSecurityParameters(tenantId, systemId, parsedParams);
      return JSON.stringify(result);
    });

    this.on('analyzeSecurityAuditLog', async (req: any) => {
      const { tenantId, systemId, events } = req.data;
      const parsedEvents: SecurityAuditEvent[] = events ? JSON.parse(events) : [];
      const result = await this.analyzeSecurityAuditLog(tenantId, systemId, parsedEvents);
      return JSON.stringify(result);
    });

    this.on('monitorTransports', async (req: any) => {
      const { tenantId, systemId, transports } = req.data;
      const parsedTransports: TransportEvent[] = transports ? JSON.parse(transports) : [];
      const result = await this.monitorTransports(tenantId, systemId, parsedTransports);
      return JSON.stringify(result);
    });

    this.on('mapToMitreAttack', async (req: any) => {
      const { riskCategory, riskIndicators, detectionMethod } = req.data;
      const parsedIndicators: RiskIndicator[] = riskIndicators ? JSON.parse(riskIndicators) : [];
      const result = this.mapToMitreAttack(
        riskCategory as RiskCategory,
        parsedIndicators,
        detectionMethod as DetectionMethod
      );
      return JSON.stringify(result);
    });

    this.on('generateRemediationRecommendations', async (req: any) => {
      const { tenantId, findingType, findingDetails } = req.data;
      const parsedDetails = findingDetails ? JSON.parse(findingDetails) : {};
      const result = this.generateRemediationRecommendations(tenantId, findingType, parsedDetails);
      return JSON.stringify(result);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Monitor security parameters against baseline configuration.
   * Alerts within 5 minutes of deviation from expected values.
   *
   * Validates: Requirements 25.1
   */
  async checkSecurityParameters(
    tenantId: string,
    systemId: string,
    parameters: SecurityParameter[]
  ): Promise<{ deviations: SecurityParameterDeviation[]; riskEvents: RiskEvent[] }> {
    const logger = cds.log('grc-automation');
    const startTime = Date.now();

    logger.info(
      `Checking ${parameters.length} security parameters for tenant ${tenantId}, system ${systemId}`
    );

    const deviations: SecurityParameterDeviation[] = [];
    const riskEvents: RiskEvent[] = [];

    for (const param of parameters) {
      // Determine expected value from baseline or use configured
      const baseline = this.getBaselineValue(param.parameterName, param.expectedValue);

      // Compare current value against baseline
      if (!this.isParameterCompliant(param.currentValue, baseline)) {
        const deviation: SecurityParameterDeviation = {
          parameter: {
            ...param,
            expectedValue: baseline,
            compliant: false,
            lastChecked: new Date(),
          },
          detectedAt: new Date(),
        };
        deviations.push(deviation);

        // Generate a risk event for each deviation
        const riskEvent = this.createParameterDeviationRiskEvent(tenantId, systemId, param, baseline);
        riskEvents.push(riskEvent);

        logger.warn(
          `Security parameter deviation detected: ${param.parameterName} ` +
          `expected="${baseline}" actual="${param.currentValue}" system=${systemId}`
        );
      }
    }

    // Persist alerts for deviations within the 5-minute SLA
    if (riskEvents.length > 0) {
      await this.persistAlerts(tenantId, riskEvents);
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_ALERT_TIME_MS) {
      logger.warn(
        `Security parameter check exceeded 5-minute SLA: ${elapsed}ms for tenant ${tenantId}`
      );
    }

    logger.info(
      `Security parameter check completed in ${elapsed}ms: ` +
      `${deviations.length} deviations found out of ${parameters.length} parameters`
    );

    return { deviations, riskEvents };
  }

  /**
   * Analyze security audit log events (SM20/RSAU_READ_LOG data).
   * Detects: failed logons exceeding threshold, unusual client logons,
   * user lock/unlock events, RFC rejections, and critical transaction starts.
   *
   * Validates: Requirements 25.2
   */
  async analyzeSecurityAuditLog(
    tenantId: string,
    systemId: string,
    events: SecurityAuditEvent[]
  ): Promise<{ findings: RiskEvent[]; summary: AuditLogAnalysisSummary }> {
    const logger = cds.log('grc-automation');

    logger.info(
      `Analyzing ${events.length} security audit log events for tenant ${tenantId}, system ${systemId}`
    );

    const findings: RiskEvent[] = [];

    // Group events by class for analysis
    const failedLogons = events.filter(e => e.eventClass === 'FAILED_LOGON');
    const successfulLogons = events.filter(e => e.eventClass === 'SUCCESSFUL_LOGON');
    const userLocks = events.filter(e => e.eventClass === 'USER_LOCK');
    const userUnlocks = events.filter(e => e.eventClass === 'USER_UNLOCK');
    const rfcRejections = events.filter(e => e.eventClass === 'RFC_REJECTION');
    const criticalTcodes = events.filter(e => e.eventClass === 'CRITICAL_TCODE_START');

    // 1. Detect failed logon floods per user (Req 25.2)
    const failedLogonFindings = this.detectFailedLogonFlood(tenantId, systemId, failedLogons);
    findings.push(...failedLogonFindings);

    // 2. Detect unusual client logons (Req 25.2)
    const unusualClientFindings = this.detectUnusualClientLogons(tenantId, systemId, successfulLogons);
    findings.push(...unusualClientFindings);

    // 3. Detect suspicious lock/unlock patterns (Req 25.2)
    const lockUnlockFindings = this.detectLockUnlockPatterns(tenantId, systemId, userLocks, userUnlocks);
    findings.push(...lockUnlockFindings);

    // 4. Detect RFC rejections (Req 25.2)
    const rfcFindings = this.detectRFCRejections(tenantId, systemId, rfcRejections);
    findings.push(...rfcFindings);

    // 5. Detect critical transaction starts (Req 25.2)
    const tcodeFindings = this.detectCriticalTransactionStarts(tenantId, systemId, criticalTcodes);
    findings.push(...tcodeFindings);

    // Persist alerts for findings
    if (findings.length > 0) {
      await this.persistAlerts(tenantId, findings);
    }

    const summary: AuditLogAnalysisSummary = {
      totalEventsAnalyzed: events.length,
      failedLogonAttempts: failedLogons.length,
      unusualClientLogons: unusualClientFindings.length,
      lockUnlockEvents: userLocks.length + userUnlocks.length,
      rfcRejections: rfcRejections.length,
      criticalTcodeStarts: criticalTcodes.length,
      findingsGenerated: findings.length,
    };

    logger.info(
      `Audit log analysis complete: ${findings.length} findings from ${events.length} events`
    );

    return { findings, summary };
  }

  /**
   * Monitor transport management events for security-relevant issues.
   * Detects: production bypass, auth table modifications, security code changes.
   *
   * Validates: Requirements 25.3
   */
  async monitorTransports(
    tenantId: string,
    systemId: string,
    transports: TransportEvent[]
  ): Promise<{ alerts: TransportAlert[]; riskEvents: RiskEvent[] }> {
    const logger = cds.log('grc-automation');

    logger.info(
      `Monitoring ${transports.length} transport events for tenant ${tenantId}, system ${systemId}`
    );

    const alerts: TransportAlert[] = [];
    const riskEvents: RiskEvent[] = [];

    for (const transport of transports) {
      // 1. Check for QA bypass (Req 25.3)
      if (!transport.passedQA) {
        const alert: TransportAlert = {
          transportId: transport.transportId,
          systemId: transport.targetSystemId,
          alertReason: 'BYPASSED_QA',
          details: {
            owner: transport.owner,
            description: transport.description,
            importedAt: transport.importedAt,
            objectCount: transport.objects.length,
          },
        };
        alerts.push(alert);
        riskEvents.push(this.createTransportRiskEvent(tenantId, transport, 'BYPASSED_QA'));
      }

      // 2. Check for auth table modifications (Req 25.3)
      const authTableObjects = transport.objects.filter(obj =>
        AUTH_RELATED_TABLES.some(table =>
          obj.tableName?.toUpperCase() === table ||
          obj.objectName.toUpperCase().includes(table)
        )
      );

      if (authTableObjects.length > 0) {
        const alert: TransportAlert = {
          transportId: transport.transportId,
          systemId: transport.targetSystemId,
          alertReason: 'AUTH_TABLE_MODIFICATION',
          details: {
            owner: transport.owner,
            modifiedTables: authTableObjects.map(o => o.tableName || o.objectName),
            objectCount: authTableObjects.length,
          },
        };
        alerts.push(alert);
        riskEvents.push(
          this.createTransportRiskEvent(tenantId, transport, 'AUTH_TABLE_MODIFICATION', authTableObjects)
        );
      }

      // 3. Check for security code changes (Req 25.3)
      const securityCodeObjects = transport.objects.filter(obj =>
        this.isSecurityRelevantCode(obj)
      );

      if (securityCodeObjects.length > 0) {
        const alert: TransportAlert = {
          transportId: transport.transportId,
          systemId: transport.targetSystemId,
          alertReason: 'SECURITY_CODE_CHANGE',
          details: {
            owner: transport.owner,
            modifiedPrograms: securityCodeObjects.map(o => o.objectName),
            objectCount: securityCodeObjects.length,
          },
        };
        alerts.push(alert);
        riskEvents.push(
          this.createTransportRiskEvent(tenantId, transport, 'SECURITY_CODE_CHANGE', securityCodeObjects)
        );
      }
    }

    // Persist alerts for findings
    if (riskEvents.length > 0) {
      await this.persistAlerts(tenantId, riskEvents);
    }

    logger.info(
      `Transport monitoring complete: ${alerts.length} alerts from ${transports.length} transports`
    );

    return { alerts, riskEvents };
  }

  /**
   * Map a security finding to MITRE ATT&CK for SAP framework.
   * Returns technique IDs, descriptions, and remediation recommendations.
   *
   * Validates: Requirements 25.6
   */
  mapToMitreAttack(
    riskCategory: RiskCategory,
    riskIndicators: RiskIndicator[],
    _detectionMethod: DetectionMethod
  ): MitreMapping[] {
    const mappings: MitreMapping[] = [];

    // Map based on risk category
    const categoryMappings = MITRE_ATTACK_SAP_MAPPINGS[riskCategory];
    if (categoryMappings) {
      mappings.push(...categoryMappings);
    }

    // Map based on specific risk indicators
    for (const indicator of riskIndicators) {
      const indicatorType = indicator.indicatorType.toUpperCase();

      // Check each mapping key for matches
      for (const [key, techniques] of Object.entries(MITRE_ATTACK_SAP_MAPPINGS)) {
        if (indicatorType.includes(key) || key.includes(indicatorType)) {
          for (const technique of techniques) {
            // Avoid duplicate mappings
            if (!mappings.some(m => m.techniqueId === technique.techniqueId &&
                m.subTechniqueId === technique.subTechniqueId)) {
              mappings.push(technique);
            }
          }
        }
      }
    }

    // If no specific mapping found, use generic based on category
    if (mappings.length === 0) {
      mappings.push(this.getGenericMitreMapping(riskCategory));
    }

    return mappings;
  }

  /**
   * Generate automated remediation recommendations for a finding.
   *
   * Validates: Requirements 25.8
   */
  generateRemediationRecommendations(
    _tenantId: string,
    findingType: string,
    findingDetails: Record<string, unknown>
  ): RemediationRecommendation[] {
    const recommendations: RemediationRecommendation[] = [];

    switch (findingType) {
      case 'PARAMETER_DEVIATION':
        recommendations.push(
          {
            priority: 1,
            title: 'Restore security parameter to baseline',
            description: `Reset parameter "${findingDetails.parameterName}" from current value "${findingDetails.currentValue}" to baseline value "${findingDetails.expectedValue}" using RZ10/RZ11`,
            affectedObject: findingDetails.parameterName as string || 'Unknown',
            automatable: true,
            estimatedEffort: 'LOW',
          },
          {
            priority: 2,
            title: 'Investigate parameter change origin',
            description: 'Review SM21 system log and security audit log to identify who changed the parameter and whether it was authorized',
            affectedObject: findingDetails.parameterName as string || 'Unknown',
            automatable: false,
            estimatedEffort: 'MEDIUM',
          },
          {
            priority: 3,
            title: 'Implement change detection monitoring',
            description: 'Configure automated parameter baseline checks at increased frequency for this parameter',
            affectedObject: findingDetails.parameterName as string || 'Unknown',
            automatable: true,
            estimatedEffort: 'LOW',
          }
        );
        break;

      case 'FAILED_LOGON_FLOOD':
        recommendations.push(
          {
            priority: 1,
            title: 'Lock targeted user account',
            description: `Lock user "${findingDetails.userId}" via SU01 to prevent further brute-force attempts`,
            affectedObject: findingDetails.userId as string || 'Unknown',
            automatable: true,
            estimatedEffort: 'LOW',
          },
          {
            priority: 1,
            title: 'Block source IP if external',
            description: `Investigate source terminal/IP "${findingDetails.terminal}" and block at network level if external`,
            affectedObject: findingDetails.terminal as string || 'Unknown',
            automatable: false,
            estimatedEffort: 'MEDIUM',
          },
          {
            priority: 2,
            title: 'Review login security parameters',
            description: 'Verify login/fails_to_session_end and login/fails_to_user_lock parameters are set appropriately',
            affectedObject: 'login/fails_to_session_end',
            automatable: true,
            estimatedEffort: 'LOW',
          }
        );
        break;

      case 'TRANSPORT_BYPASS':
        recommendations.push(
          {
            priority: 1,
            title: 'Review transport contents immediately',
            description: `Audit all objects in transport "${findingDetails.transportId}" for malicious code or unauthorized changes`,
            affectedObject: findingDetails.transportId as string || 'Unknown',
            automatable: false,
            estimatedEffort: 'HIGH',
          },
          {
            priority: 1,
            title: 'Lock transport routes',
            description: 'Verify STMS transport route configuration prevents direct production imports',
            affectedObject: 'STMS Configuration',
            automatable: false,
            estimatedEffort: 'MEDIUM',
          },
          {
            priority: 2,
            title: 'Enforce change management controls',
            description: 'Implement mandatory QA approval gate in transport workflow via CTS project settings',
            affectedObject: 'Transport Management System',
            automatable: true,
            estimatedEffort: 'MEDIUM',
          }
        );
        break;

      case 'AUTH_TABLE_MODIFICATION':
        recommendations.push(
          {
            priority: 1,
            title: 'Audit authorization table changes',
            description: `Review specific field-level changes in authorization tables modified by transport "${findingDetails.transportId}"`,
            affectedObject: findingDetails.transportId as string || 'Unknown',
            automatable: false,
            estimatedEffort: 'HIGH',
          },
          {
            priority: 2,
            title: 'Compare user authorizations',
            description: 'Run SU53 and SUIM reports to compare affected user authorizations before and after transport import',
            affectedObject: 'Authorization Tables',
            automatable: true,
            estimatedEffort: 'MEDIUM',
          },
          {
            priority: 3,
            title: 'Enable table change logging',
            description: 'Ensure SE13 table logging is enabled for all authorization-related tables',
            affectedObject: 'Table Logging',
            automatable: true,
            estimatedEffort: 'LOW',
          }
        );
        break;

      case 'UNUSUAL_CLIENT_LOGON':
        recommendations.push(
          {
            priority: 1,
            title: 'Verify user access authorization',
            description: `Confirm user "${findingDetails.userId}" is authorized to access client "${findingDetails.client}"`,
            affectedObject: findingDetails.userId as string || 'Unknown',
            automatable: false,
            estimatedEffort: 'LOW',
          },
          {
            priority: 2,
            title: 'Review client configuration',
            description: 'Check SCC4 client settings for proper lock status on non-standard clients',
            affectedObject: `Client ${findingDetails.client}`,
            automatable: true,
            estimatedEffort: 'LOW',
          }
        );
        break;

      case 'RFC_REJECTION':
        recommendations.push(
          {
            priority: 1,
            title: 'Review RFC destination configuration',
            description: 'Audit SM59 RFC destinations for overly permissive trust relationships',
            affectedObject: 'RFC Destinations',
            automatable: false,
            estimatedEffort: 'MEDIUM',
          },
          {
            priority: 2,
            title: 'Validate RFC user authorizations',
            description: 'Review RFC user assignments and ensure minimal privilege principle',
            affectedObject: findingDetails.userId as string || 'RFC Users',
            automatable: true,
            estimatedEffort: 'MEDIUM',
          }
        );
        break;

      default:
        recommendations.push({
          priority: 2,
          title: 'Investigate and remediate finding',
          description: `Review the ${findingType} finding and take appropriate corrective action based on organizational security policies`,
          affectedObject: 'General',
          automatable: false,
          estimatedEffort: 'MEDIUM',
        });
    }

    return recommendations;
  }

  // ==========================================================================
  // Private Methods - Audit Log Analysis
  // ==========================================================================

  /**
   * Detect failed logon floods per user within a configurable time window.
   * Default: 5 failed attempts within 10 minutes per user.
   */
  private detectFailedLogonFlood(
    tenantId: string,
    systemId: string,
    failedLogons: SecurityAuditEvent[]
  ): RiskEvent[] {
    const findings: RiskEvent[] = [];

    // Group failed logons by user
    const byUser = new Map<string, SecurityAuditEvent[]>();
    for (const event of failedLogons) {
      const existing = byUser.get(event.userId) || [];
      existing.push(event);
      byUser.set(event.userId, existing);
    }

    for (const [userId, userEvents] of byUser) {
      // Sort by timestamp
      const sorted = userEvents.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Sliding window detection
      let windowStart = 0;
      for (let i = 0; i < sorted.length; i++) {
        const currentTime = new Date(sorted[i].timestamp).getTime();

        // Move window start forward
        while (
          windowStart < i &&
          currentTime - new Date(sorted[windowStart].timestamp).getTime() > DEFAULT_FAILED_LOGON_WINDOW_MS
        ) {
          windowStart++;
        }

        const windowCount = i - windowStart + 1;

        if (windowCount >= DEFAULT_FAILED_LOGON_THRESHOLD) {
          // Generate finding for this user
          const terminal = sorted[i].terminal || 'unknown';
          findings.push({
            riskEventId: cds.utils.uuid(),
            tenantId,
            transactionId: sorted[i].eventId,
            riskCategory: 'IAM_VIOLATION' as RiskCategory,
            riskScore: 75,
            confidence: 95,
            detectionMethod: 'THRESHOLD_BREACH' as DetectionMethod,
            riskIndicators: [
              {
                indicatorType: 'FAILED_LOGON_FLOOD',
                description: `${windowCount} failed logon attempts for user ${userId} within 10 minutes from terminal ${terminal}`,
                observedValue: windowCount,
                expectedRange: { min: 0, max: DEFAULT_FAILED_LOGON_THRESHOLD - 1 },
                weight: 0.9,
              },
            ],
            affectedEntities: [
              { entityType: 'user', entityId: userId, entityName: `User ${userId}` },
              { entityType: 'system', entityId: systemId, entityName: `System ${systemId}` },
            ],
            detectedAt: new Date(),
          });
          break; // One finding per user per analysis window
        }
      }
    }

    return findings;
  }

  /**
   * Detect successful logons from unusual SAP client numbers.
   * Unusual clients are those not in the standard set (000, 001, 100, 200, 300, 800).
   */
  private detectUnusualClientLogons(
    tenantId: string,
    systemId: string,
    successfulLogons: SecurityAuditEvent[]
  ): RiskEvent[] {
    const findings: RiskEvent[] = [];
    const standardClients = new Set<string>(STANDARD_CLIENTS);

    for (const event of successfulLogons) {
      if (!standardClients.has(event.client)) {
        findings.push({
          riskEventId: cds.utils.uuid(),
          tenantId,
          transactionId: event.eventId,
          riskCategory: 'IAM_VIOLATION' as RiskCategory,
          riskScore: 60,
          confidence: 85,
          detectionMethod: 'RULE_BASED' as DetectionMethod,
          riskIndicators: [
            {
              indicatorType: 'UNUSUAL_CLIENT_LOGON',
              description: `User ${event.userId} logged on to unusual client ${event.client} on system ${systemId}`,
              observedValue: event.client,
              weight: 0.7,
            },
          ],
          affectedEntities: [
            { entityType: 'user', entityId: event.userId, entityName: `User ${event.userId}` },
            { entityType: 'system', entityId: systemId, entityName: `System ${systemId}` },
          ],
          detectedAt: new Date(),
        });
      }
    }

    return findings;
  }

  /**
   * Detect suspicious user lock/unlock patterns.
   * Alerts on rapid lock/unlock cycles that may indicate manipulation.
   */
  private detectLockUnlockPatterns(
    tenantId: string,
    systemId: string,
    userLocks: SecurityAuditEvent[],
    userUnlocks: SecurityAuditEvent[]
  ): RiskEvent[] {
    const findings: RiskEvent[] = [];

    // Group unlock events by user
    const unlocksByUser = new Map<string, SecurityAuditEvent[]>();
    for (const event of userUnlocks) {
      const existing = unlocksByUser.get(event.userId) || [];
      existing.push(event);
      unlocksByUser.set(event.userId, existing);
    }

    // For each user with locks, check for rapid unlock
    const locksByUser = new Map<string, SecurityAuditEvent[]>();
    for (const event of userLocks) {
      const existing = locksByUser.get(event.userId) || [];
      existing.push(event);
      locksByUser.set(event.userId, existing);
    }

    for (const [userId, locks] of locksByUser) {
      const unlocks = unlocksByUser.get(userId) || [];

      // Detect if a lock was quickly followed by an unlock (within 5 minutes)
      for (const lock of locks) {
        const lockTime = new Date(lock.timestamp).getTime();
        const quickUnlock = unlocks.find(u => {
          const unlockTime = new Date(u.timestamp).getTime();
          return unlockTime > lockTime && (unlockTime - lockTime) < 5 * 60 * 1000;
        });

        if (quickUnlock) {
          findings.push({
            riskEventId: cds.utils.uuid(),
            tenantId,
            transactionId: lock.eventId,
            riskCategory: 'IAM_VIOLATION' as RiskCategory,
            riskScore: 65,
            confidence: 80,
            detectionMethod: 'PATTERN_MATCHING' as DetectionMethod,
            riskIndicators: [
              {
                indicatorType: 'USER_LOCK_UNLOCK',
                description: `Rapid lock/unlock cycle for user ${userId} - locked then unlocked within 5 minutes`,
                observedValue: {
                  lockTime: lock.timestamp,
                  unlockTime: quickUnlock.timestamp,
                  unlockedBy: quickUnlock.details?.performedBy || 'unknown',
                },
                weight: 0.7,
              },
            ],
            affectedEntities: [
              { entityType: 'user', entityId: userId, entityName: `User ${userId}` },
              { entityType: 'system', entityId: systemId, entityName: `System ${systemId}` },
            ],
            detectedAt: new Date(),
          });
        }
      }
    }

    return findings;
  }

  /**
   * Detect RFC connection rejections indicating potential lateral movement attempts.
   */
  private detectRFCRejections(
    tenantId: string,
    systemId: string,
    rfcRejections: SecurityAuditEvent[]
  ): RiskEvent[] {
    const findings: RiskEvent[] = [];

    // Group by source user/system to detect patterns
    const byUser = new Map<string, SecurityAuditEvent[]>();
    for (const event of rfcRejections) {
      const existing = byUser.get(event.userId) || [];
      existing.push(event);
      byUser.set(event.userId, existing);
    }

    for (const [userId, userEvents] of byUser) {
      // Multiple RFC rejections from same user suggest exploitation attempt
      if (userEvents.length >= 3) {
        findings.push({
          riskEventId: cds.utils.uuid(),
          tenantId,
          transactionId: userEvents[0].eventId,
          riskCategory: 'IAM_VIOLATION' as RiskCategory,
          riskScore: 70,
          confidence: 85,
          detectionMethod: 'THRESHOLD_BREACH' as DetectionMethod,
          riskIndicators: [
            {
              indicatorType: 'RFC_REJECTION',
              description: `${userEvents.length} RFC connection rejections for user ${userId} on system ${systemId} - possible lateral movement attempt`,
              observedValue: userEvents.length,
              expectedRange: { min: 0, max: 2 },
              weight: 0.8,
            },
          ],
          affectedEntities: [
            { entityType: 'user', entityId: userId, entityName: `User ${userId}` },
            { entityType: 'system', entityId: systemId, entityName: `System ${systemId}` },
          ],
          detectedAt: new Date(),
        });
      }
    }

    return findings;
  }

  /**
   * Detect critical transaction starts that may indicate unauthorized activity.
   */
  private detectCriticalTransactionStarts(
    tenantId: string,
    systemId: string,
    events: SecurityAuditEvent[]
  ): RiskEvent[] {
    const findings: RiskEvent[] = [];
    const criticalTcodes = new Set<string>(CRITICAL_TRANSACTION_CODES);

    for (const event of events) {
      const tcode = event.transactionCode?.toUpperCase() || '';
      if (criticalTcodes.has(tcode)) {
        findings.push({
          riskEventId: cds.utils.uuid(),
          tenantId,
          transactionId: event.eventId,
          riskCategory: 'IAM_VIOLATION' as RiskCategory,
          riskScore: 55,
          confidence: 90,
          detectionMethod: 'RULE_BASED' as DetectionMethod,
          riskIndicators: [
            {
              indicatorType: 'CRITICAL_TCODE_START',
              description: `User ${event.userId} started critical transaction ${tcode} on system ${systemId}`,
              observedValue: tcode,
              weight: 0.6,
            },
          ],
          affectedEntities: [
            { entityType: 'user', entityId: event.userId, entityName: `User ${event.userId}` },
            { entityType: 'system', entityId: systemId, entityName: `System ${systemId}` },
          ],
          detectedAt: new Date(),
        });
      }
    }

    return findings;
  }

  // ==========================================================================
  // Private Methods - Transport Monitoring
  // ==========================================================================

  /**
   * Determine if a transport object is security-relevant code.
   * Checks for programs flagged by credential scan or containing
   * security-relevant naming patterns.
   */
  private isSecurityRelevantCode(obj: TransportObject): boolean {
    const objectType = obj.objectType.toUpperCase();
    const objectName = obj.objectName.toUpperCase();

    // Only check programs/function groups/includes
    if (!['PROG', 'FUGR', 'REPS', 'FUNC', 'CLAS'].includes(objectType)) {
      return false;
    }

    // Check for security-relevant naming patterns
    const securityPatterns = [
      'AUTH', 'SECU', 'PASSWORD', 'LOGIN', 'CRED',
      'ENCRYPT', 'DECRYPT', 'TOKEN', 'CERTIF',
      'SU01', 'PFCG', 'USR', 'AGR_',
    ];

    return securityPatterns.some(pattern => objectName.includes(pattern));
  }

  /**
   * Create a risk event for a transport monitoring finding.
   */
  private createTransportRiskEvent(
    tenantId: string,
    transport: TransportEvent,
    alertReason: TransportAlertReason,
    relevantObjects?: TransportObject[]
  ): RiskEvent {
    const riskScoreByReason: Record<TransportAlertReason, number> = {
      'BYPASSED_QA': 80,
      'AUTH_TABLE_MODIFICATION': 75,
      'SECURITY_CODE_CHANGE': 70,
    };

    const descriptionByReason: Record<TransportAlertReason, string> = {
      'BYPASSED_QA': `Transport ${transport.transportId} imported directly to production system bypassing QA stage`,
      'AUTH_TABLE_MODIFICATION': `Transport ${transport.transportId} modifies authorization-related tables: ${relevantObjects?.map(o => o.tableName || o.objectName).join(', ')}`,
      'SECURITY_CODE_CHANGE': `Transport ${transport.transportId} modifies security-relevant code: ${relevantObjects?.map(o => o.objectName).join(', ')}`,
    };

    return {
      riskEventId: cds.utils.uuid(),
      tenantId,
      transactionId: transport.transportId,
      riskCategory: 'COMPLIANCE_BREACH' as RiskCategory,
      riskScore: riskScoreByReason[alertReason],
      confidence: 90,
      detectionMethod: 'RULE_BASED' as DetectionMethod,
      riskIndicators: [
        {
          indicatorType: alertReason,
          description: descriptionByReason[alertReason],
          observedValue: {
            transportId: transport.transportId,
            owner: transport.owner,
            objectCount: relevantObjects?.length || transport.objects.length,
          },
          weight: 0.9,
        },
      ],
      affectedEntities: [
        { entityType: 'user', entityId: transport.owner, entityName: `User ${transport.owner}` },
        {
          entityType: 'transport',
          entityId: transport.transportId,
          entityName: `Transport ${transport.transportId}`,
        },
      ],
      detectedAt: new Date(),
    };
  }

  // ==========================================================================
  // Private Methods - Security Parameter Monitoring
  // ==========================================================================

  /**
   * Get the baseline expected value for a security parameter.
   * Uses configured expected value or falls back to recommended defaults.
   */
  private getBaselineValue(parameterName: string, configuredExpected: string): string {
    // If a configured expected value is provided, use it
    if (configuredExpected) {
      return configuredExpected;
    }

    // Fall back to recommended values
    const knownParam = CRITICAL_SECURITY_PARAMETERS[parameterName];
    return knownParam?.recommendedValue || '';
  }

  /**
   * Check if a parameter's current value complies with its expected baseline.
   * Handles numeric comparisons and string matching.
   */
  private isParameterCompliant(currentValue: string, expectedValue: string): boolean {
    if (!expectedValue) return true; // No baseline configured

    // Normalize for comparison
    const current = currentValue.trim().toLowerCase();
    const expected = expectedValue.trim().toLowerCase();

    // For HTTPS enforcement, check if the value contains HTTPS
    if (expected.includes('prot=https')) {
      return current.includes('prot=https');
    }

    // Direct comparison
    return current === expected;
  }

  /**
   * Create a risk event for a security parameter deviation.
   */
  private createParameterDeviationRiskEvent(
    tenantId: string,
    systemId: string,
    param: SecurityParameter,
    expectedValue: string
  ): RiskEvent {
    return {
      riskEventId: cds.utils.uuid(),
      tenantId,
      transactionId: `param-check-${param.parameterName}-${Date.now()}`,
      riskCategory: 'COMPLIANCE_BREACH' as RiskCategory,
      riskScore: 70,
      confidence: 98,
      detectionMethod: 'THRESHOLD_BREACH' as DetectionMethod,
      riskIndicators: [
        {
          indicatorType: 'PARAMETER_DEVIATION',
          description: `Security parameter "${param.parameterName}" deviates from baseline: expected="${expectedValue}", actual="${param.currentValue}"`,
          observedValue: param.currentValue,
          expectedRange: { min: expectedValue, max: expectedValue },
          weight: 0.9,
        },
      ],
      affectedEntities: [
        {
          entityType: 'system',
          entityId: systemId,
          entityName: `System ${systemId}`,
        },
        {
          entityType: 'parameter',
          entityId: param.parameterName,
          entityName: `Parameter ${param.parameterName}`,
        },
      ],
      detectedAt: new Date(),
    };
  }

  // ==========================================================================
  // Private Methods - MITRE ATT&CK Mapping
  // ==========================================================================

  /**
   * Get a generic MITRE ATT&CK mapping for a risk category when no
   * specific technique mapping is found.
   */
  private getGenericMitreMapping(riskCategory: RiskCategory): MitreMapping {
    const genericMappings: Record<RiskCategory, MitreMapping> = {
      ANOMALY: {
        techniqueId: 'T1071',
        techniqueName: 'Application Layer Protocol',
        tactic: 'Command and Control',
        sapContext: 'Anomalous transaction pattern detected in SAP system',
        remediationSteps: ['Review transaction details', 'Correlate with user behavior profile'],
      },
      SOD_VIOLATION: {
        techniqueId: 'T1098',
        techniqueName: 'Account Manipulation',
        tactic: 'Persistence',
        sapContext: 'Segregation of duties violation detected in SAP authorization model',
        remediationSteps: ['Review role assignments', 'Implement compensating controls'],
      },
      FRAUD_PATTERN: {
        techniqueId: 'T1565',
        techniqueName: 'Data Manipulation',
        subTechniqueId: 'T1565.001',
        subTechniqueName: 'Stored Data Manipulation',
        tactic: 'Impact',
        sapContext: 'Fraud pattern detected in financial postings',
        remediationSteps: ['Block pending payments', 'Review transaction chain'],
      },
      IAM_VIOLATION: {
        techniqueId: 'T1078',
        techniqueName: 'Valid Accounts',
        tactic: 'Persistence',
        sapContext: 'IAM policy violation in SAP system',
        remediationSteps: ['Review account permissions', 'Enforce least privilege'],
      },
      PRIVILEGE_ESCALATION: {
        techniqueId: 'T1068',
        techniqueName: 'Exploitation for Privilege Escalation',
        tactic: 'Privilege Escalation',
        sapContext: 'Unauthorized privilege escalation in SAP system',
        remediationSteps: ['Revoke escalated privileges', 'Lock user account', 'Audit actions'],
      },
      INSIDER_THREAT: {
        techniqueId: 'T1567',
        techniqueName: 'Exfiltration Over Web Service',
        tactic: 'Exfiltration',
        sapContext: 'Insider threat indicators detected in SAP access patterns',
        remediationSteps: ['Restrict data access', 'Enable enhanced monitoring', 'Correlate with HR events'],
      },
      COMPLIANCE_BREACH: {
        techniqueId: 'T1562',
        techniqueName: 'Impair Defenses',
        subTechniqueId: 'T1562.001',
        subTechniqueName: 'Disable or Modify Tools',
        tactic: 'Defense Evasion',
        sapContext: 'Compliance control breach detected - security posture weakened',
        remediationSteps: ['Restore compliant configuration', 'Investigate change origin'],
      },
      VULNERABILITY: {
        techniqueId: 'T1190',
        techniqueName: 'Exploit Public-Facing Application',
        tactic: 'Initial Access',
        sapContext: 'Security vulnerability detected in SAP custom code or configuration',
        remediationSteps: ['Apply security patch', 'Implement input validation', 'Code review'],
      },
      VENDOR_TAMPERING: {
        techniqueId: 'T1565',
        techniqueName: 'Data Manipulation',
        subTechniqueId: 'T1565.002',
        subTechniqueName: 'Transmitted Data Manipulation',
        tactic: 'Impact',
        sapContext: 'Vendor master data tampering detected - potential payment fraud',
        remediationSteps: ['Hold pending payments', 'Verify bank details out-of-band'],
      },
      P2P_CONTROL_GAP: {
        techniqueId: 'T1098',
        techniqueName: 'Account Manipulation',
        tactic: 'Persistence',
        sapContext: 'Procure-to-Pay control gap identified',
        remediationSteps: ['Review P2P segregation', 'Enforce three-way match', 'Audit vendor-payment chain'],
      },
    };

    return genericMappings[riskCategory] || {
      techniqueId: 'T1000',
      techniqueName: 'Unknown Technique',
      tactic: 'Unknown',
      sapContext: `Unmapped risk category: ${riskCategory}`,
      remediationSteps: ['Investigate and remediate based on finding details'],
    };
  }

  // ==========================================================================
  // Private Methods - Alert Persistence
  // ==========================================================================

  /**
   * Persist risk events as alerts in the database.
   * Ensures alerts are generated within the 5-minute SLA for parameter deviations.
   */
  private async persistAlerts(tenantId: string, riskEvents: RiskEvent[]): Promise<void> {
    const logger = cds.log('grc-automation');

    try {
      const db = await cds.connect.to('db');
      const { Alerts } = db.entities('finsecure.ai');

      const now = new Date();
      const alertEntries = riskEvents.map(event => ({
        ID: cds.utils.uuid(),
        tenantId,
        priority: this.calculateAlertPriority(event.riskScore),
        status: 'OPEN',
        riskCategory: event.riskCategory,
        riskScore: event.riskScore,
        title: this.generateAlertTitle(event),
        description: event.riskIndicators[0]?.description || 'GRC finding detected',
        triggeringTxId: event.transactionId,
        riskIndicators: JSON.stringify(event.riskIndicators),
        affectedEntities: JSON.stringify(event.affectedEntities),
        recommendedActions: JSON.stringify(
          this.generateRemediationRecommendations(
            tenantId,
            event.riskIndicators[0]?.indicatorType || 'UNKNOWN',
            { ...event.riskIndicators[0] }
          ).map(r => r.title)
        ),
        aiConfidenceScore: event.confidence,
        slaDeadline: this.calculateSLADeadline(event.riskScore),
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString(),
      }));

      await INSERT.into(Alerts).entries(alertEntries);

      logger.info(`Persisted ${alertEntries.length} GRC alerts for tenant ${tenantId}`);
    } catch (error: any) {
      logger.error(`Failed to persist GRC alerts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate alert priority from risk score.
   */
  private calculateAlertPriority(riskScore: number): string {
    if (riskScore >= 90) return 'CRITICAL';
    if (riskScore >= 70) return 'HIGH';
    if (riskScore >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate alert title from risk event.
   */
  private generateAlertTitle(event: RiskEvent): string {
    const indicator = event.riskIndicators[0];
    if (!indicator) return `GRC Finding: ${event.riskCategory}`;

    const titlesByType: Record<string, string> = {
      'PARAMETER_DEVIATION': 'Security Parameter Baseline Deviation',
      'FAILED_LOGON_FLOOD': 'Failed Logon Threshold Exceeded',
      'UNUSUAL_CLIENT_LOGON': 'Unusual Client Logon Detected',
      'USER_LOCK_UNLOCK': 'Suspicious User Lock/Unlock Pattern',
      'RFC_REJECTION': 'RFC Connection Rejections Detected',
      'CRITICAL_TCODE_START': 'Critical Transaction Execution',
      'BYPASSED_QA': 'Transport Imported Without QA Approval',
      'AUTH_TABLE_MODIFICATION': 'Authorization Table Modified via Transport',
      'SECURITY_CODE_CHANGE': 'Security-Relevant Code Change Detected',
    };

    return titlesByType[indicator.indicatorType] || `GRC Finding: ${indicator.indicatorType}`;
  }

  /**
   * Calculate SLA deadline based on risk score priority.
   */
  private calculateSLADeadline(riskScore: number): string {
    const slaHours = riskScore >= 90 ? 4 : riskScore >= 70 ? 24 : riskScore >= 40 ? 72 : 168;
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + slaHours);
    return deadline.toISOString();
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

/** Summary of an audit log analysis run */
interface AuditLogAnalysisSummary {
  totalEventsAnalyzed: number;
  failedLogonAttempts: number;
  unusualClientLogons: number;
  lockUnlockEvents: number;
  rfcRejections: number;
  criticalTcodeStarts: number;
  findingsGenerated: number;
}
