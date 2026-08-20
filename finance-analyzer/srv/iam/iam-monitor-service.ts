import cds = require('@sap/cds');
import { IAMEvent } from '../types/iam-event';
import { RiskEvent, RiskIndicator } from '../types/risk-event';
import { RiskCategory, DetectionMethod, IAMEventType } from '../types/enums';
import { TenantThresholds } from '../types/tenant-config';

const { ApplicationService } = cds;

// ============================================================================
// Interfaces
// ============================================================================

/** Dormant account identified by the IAM monitor */
export interface DormantAccount {
  /** SAP user ID */
  userId: string;
  /** Tenant this account belongs to */
  tenantId: string;
  /** System where the account resides */
  systemId: string;
  /** Last interactive logon timestamp (null if never logged on) */
  lastLogonAt: Date | null;
  /** Number of days since last logon */
  daysSinceLogon: number;
  /** Roles still assigned to this dormant account */
  assignedRoles: string[];
  /** Last activity timestamp of any kind */
  lastActivityAt: Date | null;
}

/** User privilege risk score for IAM heatmap */
export interface UserRiskScore {
  /** SAP user ID */
  userId: string;
  /** Tenant this user belongs to */
  tenantId: string;
  /** Calculated risk score (0-100) */
  riskScore: number;
  /** Number of critical authorizations assigned */
  criticalAuthCount: number;
  /** Number of roles assigned */
  roleCount: number;
  /** Whether this user has SAP_ALL or equivalent */
  hasSuperAccess: boolean;
  /** Whether this user has S_DEVELOP in production */
  hasDevelopAccess: boolean;
  /** Risk factors contributing to the score */
  riskFactors: string[];
}

/** IAM misconfiguration finding */
export interface IAMMisconfiguration {
  /** Type of misconfiguration detected */
  misconfigurationType: IAMMisconfigurationType;
  /** User affected */
  userId: string;
  /** System where the misconfiguration exists */
  systemId: string;
  /** Human-readable description */
  description: string;
  /** Severity of the misconfiguration */
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

/** Types of IAM misconfigurations */
export type IAMMisconfigurationType =
  | 'DEBUG_IN_PRODUCTION'
  | 'UNRESTRICTED_TABLE_ACCESS'
  | 'RFC_DIALOG_CAPABILITY'
  | 'OS_COMMAND_EXECUTION';

// ============================================================================
// Constants
// ============================================================================

/** Critical authorization profiles that trigger immediate alert */
const CRITICAL_AUTHORIZATIONS = ['SAP_ALL', 'SAP_NEW'] as const;

/** Critical authorization objects that represent unrestricted access */
const CRITICAL_AUTH_OBJECTS = ['S_DEVELOP', 'S_TABU_DIS', 'S_RZL_ADM', 'S_LOG_COM'] as const;

/** Threshold for unrestricted access: authorization objects count */
const UNRESTRICTED_AUTH_OBJECT_THRESHOLD = 500;

/** Maximum detection time for critical auth grants (60 seconds) */
const CRITICAL_AUTH_DETECT_TIMEOUT_MS = 60_000;

/** Default dormant account period in days */
const DEFAULT_DORMANT_ACCOUNT_DAYS = 90;

/** Default critical user percentage threshold for governance alerts */
const DEFAULT_CRITICAL_USER_PERCENTAGE = 5;

/** Risk score weights for privilege heatmap calculation */
const RISK_WEIGHTS = {
  SAP_ALL: 40,
  SAP_NEW: 30,
  S_DEVELOP_PROD: 25,
  UNRESTRICTED_TABLE: 20,
  RFC_DIALOG: 15,
  OS_COMMAND: 20,
  CRITICAL_TCODES: 15,
  HIGH_ROLE_COUNT: 10,
  DORMANT_WITH_ACCESS: 10,
} as const;

/** Default tenant thresholds for fallback */
const DEFAULT_THRESHOLDS: Partial<TenantThresholds> = {
  dormantAccountDays: 90,
  riskScoreAlertThreshold: 70,
};

// ============================================================================
// IAM Monitor Service
// ============================================================================

/**
 * IAM Monitor Service
 *
 * Monitors identity and access management across connected SAP systems.
 * Detects critical authorization grants, dormant accounts, service account misuse,
 * IAM misconfigurations, and calculates privilege risk scores.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8
 */
export default class IAMMonitorService extends (ApplicationService as any) {
  async init() {
    this.on('processIAMEvent', async (req: any) => {
      const event: IAMEvent = {
        eventId: req.data.eventId,
        tenantId: req.data.tenantId,
        eventType: req.data.eventType as IAMEventType,
        userId: req.data.userId,
        performedBy: req.data.performedBy,
        systemId: req.data.systemId,
        details: req.data.details ? JSON.parse(req.data.details) : {},
        timestamp: new Date(req.data.timestamp),
      };

      const riskEvents = await this.processIAMEvent(event);
      return JSON.stringify(riskEvents);
    });

    this.on('detectCriticalAuthGrant', async (req: any) => {
      const event: IAMEvent = {
        eventId: req.data.eventId,
        tenantId: req.data.tenantId,
        eventType: req.data.eventType as IAMEventType,
        userId: req.data.userId,
        performedBy: req.data.performedBy,
        systemId: req.data.systemId,
        details: req.data.details ? JSON.parse(req.data.details) : {},
        timestamp: new Date(req.data.timestamp),
      };

      const alert = await this.detectCriticalAuthGrant(event);
      return alert ? JSON.stringify(alert) : null;
    });

    this.on('identifyDormantAccounts', async (req: any) => {
      const { tenantId } = req.data;
      const dormantAccounts = await this.identifyDormantAccounts(tenantId);
      return JSON.stringify(dormantAccounts);
    });

    this.on('calculatePrivilegeRiskScores', async (req: any) => {
      const { tenantId } = req.data;
      const scores = await this.calculatePrivilegeRiskScores(tenantId);
      return JSON.stringify(scores);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Process IAM event from ingestion pipeline.
   * Handles role assignments, auth changes, profile modifications,
   * service account dialog logons, and IAM misconfigurations.
   *
   * Validates: Requirements 16.1
   */
  async processIAMEvent(event: IAMEvent): Promise<RiskEvent[]> {
    const logger = cds.log('iam-monitor');
    const riskEvents: RiskEvent[] = [];

    logger.info(
      `Processing IAM event: type=${event.eventType}, user=${event.userId}, ` +
      `performer=${event.performedBy}, system=${event.systemId}`
    );

    // Record the IAM event in change history (Req 16.6)
    await this.recordAuthChangeHistory(event);

    switch (event.eventType) {
      case 'ROLE_ASSIGNMENT': {
        const roleRisk = await this.handleRoleAssignment(event);
        if (roleRisk) riskEvents.push(roleRisk);
        break;
      }

      case 'ROLE_REMOVAL': {
        // Role removals are tracked for history but typically don't generate risk
        logger.info(`Role removal recorded for user ${event.userId} by ${event.performedBy}`);
        break;
      }

      case 'PROFILE_CHANGE': {
        const profileRisk = await this.handleProfileChange(event);
        if (profileRisk) riskEvents.push(profileRisk);
        break;
      }

      case 'CRITICAL_AUTH_GRANT': {
        const criticalRisk = await this.handleCriticalAuthGrant(event);
        if (criticalRisk) riskEvents.push(criticalRisk);
        break;
      }

      case 'SELF_ESCALATION': {
        const escalationRisk = this.handleSelfEscalation(event);
        riskEvents.push(escalationRisk);
        break;
      }

      case 'SERVICE_ACCOUNT_DIALOG_LOGON': {
        const serviceRisk = this.handleServiceAccountDialogLogon(event);
        riskEvents.push(serviceRisk);
        break;
      }

      case 'DORMANT_ACCOUNT_DETECTED': {
        const dormantRisk = this.handleDormantAccountDetected(event);
        riskEvents.push(dormantRisk);
        break;
      }

      case 'FIREFIGHTER_ACTIVATION': {
        logger.info(`Firefighter activation for user ${event.userId}`);
        break;
      }

      case 'FIREFIGHTER_OVERDUE': {
        const firefighterRisk = this.handleFirefighterOverdue(event);
        riskEvents.push(firefighterRisk);
        break;
      }

      case 'TEMPORARY_ACCESS_EXPIRED': {
        const tempAccessRisk = this.handleTemporaryAccessExpired(event);
        if (tempAccessRisk) riskEvents.push(tempAccessRisk);
        break;
      }

      default:
        logger.warn(`Unknown IAM event type: ${event.eventType}`);
    }

    // Check for IAM misconfigurations (Req 16.5)
    const misconfigurations = this.detectMisconfigurations(event);
    for (const misconfig of misconfigurations) {
      riskEvents.push(this.createMisconfigRiskEvent(event, misconfig));
    }

    // Check governance threshold (Req 16.7)
    await this.checkCriticalUserThreshold(event.tenantId);

    return riskEvents;
  }

  /**
   * Detect critical authorization grants.
   * Alerts within 60 seconds for SAP_ALL, S_DEVELOP, unrestricted access.
   *
   * Validates: Requirements 16.2
   */
  async detectCriticalAuthGrant(event: IAMEvent): Promise<RiskEvent | null> {
    const logger = cds.log('iam-monitor');
    const startTime = Date.now();

    const details = event.details as Record<string, any>;
    const assignedProfile = (details.profile || details.roleName || '') as string;
    const authObjects = (details.authObjects || []) as string[];
    const authObjectCount = (details.authObjectCount || authObjects.length || 0) as number;

    // Check for critical authorization profiles
    const isCriticalProfile = CRITICAL_AUTHORIZATIONS.some(
      (crit) => assignedProfile.toUpperCase().includes(crit)
    );

    // Check for unrestricted access (>500 auth objects)
    const isUnrestricted = authObjectCount > UNRESTRICTED_AUTH_OBJECT_THRESHOLD;

    // Check for critical auth objects (S_DEVELOP with full access, etc.)
    const hasCriticalAuthObject = authObjects.some((obj) =>
      CRITICAL_AUTH_OBJECTS.some((crit) => obj.toUpperCase().includes(crit))
    );

    if (!isCriticalProfile && !isUnrestricted && !hasCriticalAuthObject) {
      return null;
    }

    // Build risk indicators
    const riskIndicators: RiskIndicator[] = [];

    if (isCriticalProfile) {
      riskIndicators.push({
        indicatorType: 'critical_auth_profile',
        description: `Critical authorization profile assigned: ${assignedProfile}`,
        observedValue: assignedProfile,
        weight: 0.5,
      });
    }

    if (isUnrestricted) {
      riskIndicators.push({
        indicatorType: 'unrestricted_access',
        description: `Unrestricted access granted with ${authObjectCount} authorization objects (threshold: ${UNRESTRICTED_AUTH_OBJECT_THRESHOLD})`,
        observedValue: authObjectCount,
        expectedRange: { min: 0, max: UNRESTRICTED_AUTH_OBJECT_THRESHOLD },
        weight: 0.4,
      });
    }

    if (hasCriticalAuthObject) {
      const critObjects = authObjects.filter((obj) =>
        CRITICAL_AUTH_OBJECTS.some((crit) => obj.toUpperCase().includes(crit))
      );
      riskIndicators.push({
        indicatorType: 'critical_auth_object',
        description: `Critical authorization objects assigned: ${critObjects.join(', ')}`,
        observedValue: critObjects,
        weight: 0.3,
      });
    }

    const riskEvent: RiskEvent = {
      riskEventId: cds.utils.uuid(),
      tenantId: event.tenantId,
      transactionId: event.eventId,
      riskCategory: 'IAM_VIOLATION' as RiskCategory,
      riskScore: this.calculateCriticalAuthRiskScore(isCriticalProfile, isUnrestricted, hasCriticalAuthObject),
      confidence: 95,
      detectionMethod: 'RULE_BASED' as DetectionMethod,
      riskIndicators,
      affectedEntities: [
        {
          entityType: 'user',
          entityId: event.userId,
          entityName: `User ${event.userId}`,
        },
        {
          entityType: 'user',
          entityId: event.performedBy,
          entityName: `Administrator ${event.performedBy}`,
        },
      ],
      detectedAt: new Date(),
    };

    const elapsed = Date.now() - startTime;
    logger.info(
      `Critical auth grant detected for user ${event.userId} in ${elapsed}ms ` +
      `(must alert within ${CRITICAL_AUTH_DETECT_TIMEOUT_MS}ms): ` +
      `profile=${isCriticalProfile}, unrestricted=${isUnrestricted}, criticalObj=${hasCriticalAuthObject}`
    );

    return riskEvent;
  }

  /**
   * Identify dormant accounts with active authorizations.
   * Detects accounts with no interactive logon within configurable period (default 90 days).
   *
   * Validates: Requirements 16.3
   */
  async identifyDormantAccounts(tenantId: string, dormantDays?: number): Promise<DormantAccount[]> {
    const logger = cds.log('iam-monitor');

    // Get tenant-specific dormancy threshold
    const thresholdDays = dormantDays ?? await this.getDormantAccountDays(tenantId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

    logger.info(
      `Scanning for dormant accounts in tenant ${tenantId} (threshold: ${thresholdDays} days, cutoff: ${cutoffDate.toISOString()})`
    );

    const db = await cds.connect.to('db');
    const { BehavioralProfiles } = db.entities('finsecure.ai');

    // Query profiles with last activity before the cutoff date
    const profiles = await SELECT.from(BehavioralProfiles).where({
      tenantId,
    });

    const dormantAccounts: DormantAccount[] = [];

    for (const profile of profiles) {
      const lastUpdated = profile.lastUpdated ? new Date(profile.lastUpdated) : null;
      const windowEnd = profile.windowEndDate ? new Date(profile.windowEndDate) : null;
      const lastActivity = lastUpdated || windowEnd;

      // Account is dormant if last activity is before the cutoff
      if (!lastActivity || lastActivity < cutoffDate) {
        const daysSince = lastActivity
          ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
          : thresholdDays + 1; // If never active, exceed threshold

        dormantAccounts.push({
          userId: profile.userId,
          tenantId,
          systemId: 'PRIMARY', // Derived from profile context
          lastLogonAt: lastActivity,
          daysSinceLogon: daysSince,
          assignedRoles: this.parseAssignedRoles(profile),
          lastActivityAt: lastActivity,
        });
      }
    }

    logger.info(
      `Found ${dormantAccounts.length} dormant accounts in tenant ${tenantId}`
    );

    return dormantAccounts;
  }

  /**
   * Detect service account dialog logon.
   * User type B (service/system) with interactive use generates high-priority alert.
   *
   * Validates: Requirements 16.4
   */
  detectServiceAccountDialogLogon(event: IAMEvent): RiskEvent {
    const details = event.details as Record<string, any>;
    const userType = (details.userType || 'B') as string;
    const logonType = (details.logonType || 'DIALOG') as string;

    const riskIndicators: RiskIndicator[] = [
      {
        indicatorType: 'service_account_dialog',
        description: `Service account (type ${userType}) used for interactive ${logonType} logon`,
        observedValue: { userType, logonType },
        weight: 0.8,
      },
    ];

    return {
      riskEventId: cds.utils.uuid(),
      tenantId: event.tenantId,
      transactionId: event.eventId,
      riskCategory: 'IAM_VIOLATION' as RiskCategory,
      riskScore: 85,
      confidence: 98,
      detectionMethod: 'RULE_BASED' as DetectionMethod,
      riskIndicators,
      affectedEntities: [
        {
          entityType: 'service_account',
          entityId: event.userId,
          entityName: `Service Account ${event.userId}`,
        },
      ],
      detectedAt: new Date(),
    };
  }

  /**
   * Detect IAM misconfigurations in the event details.
   * Checks for: debug access in production, unrestricted table access,
   * RFC dialog capability, OS command execution authorization.
   *
   * Validates: Requirements 16.5
   */
  detectMisconfigurations(event: IAMEvent): IAMMisconfiguration[] {
    const misconfigurations: IAMMisconfiguration[] = [];
    const details = event.details as Record<string, any>;
    const authObjects = (details.authObjects || []) as string[];
    const authDetails = (details.authDetails || {}) as Record<string, any>;
    const systemEnvironment = (details.environment || details.systemEnvironment || '') as string;

    // Check for debug/replace access in production (S_DEVELOP with ACTVT 02)
    if (this.hasDebugInProduction(authObjects, authDetails, systemEnvironment)) {
      misconfigurations.push({
        misconfigurationType: 'DEBUG_IN_PRODUCTION',
        userId: event.userId,
        systemId: event.systemId,
        description: `User ${event.userId} has S_DEVELOP with debug/replace access (ACTVT 02) in production system`,
        severity: 'CRITICAL',
      });
    }

    // Check for unrestricted table access (S_TABU_DIS with unrestricted)
    if (this.hasUnrestrictedTableAccess(authObjects, authDetails)) {
      misconfigurations.push({
        misconfigurationType: 'UNRESTRICTED_TABLE_ACCESS',
        userId: event.userId,
        systemId: event.systemId,
        description: `User ${event.userId} has unrestricted table maintenance access (S_TABU_DIS without table group restriction)`,
        severity: 'HIGH',
      });
    }

    // Check for RFC users with dialog logon capability
    if (this.hasRFCDialogCapability(details)) {
      misconfigurations.push({
        misconfigurationType: 'RFC_DIALOG_CAPABILITY',
        userId: event.userId,
        systemId: event.systemId,
        description: `RFC user ${event.userId} configured with dialog logon capability`,
        severity: 'HIGH',
      });
    }

    // Check for OS command execution authorization (S_RZL_ADM or S_LOG_COM)
    if (this.hasOSCommandExecution(authObjects)) {
      misconfigurations.push({
        misconfigurationType: 'OS_COMMAND_EXECUTION',
        userId: event.userId,
        systemId: event.systemId,
        description: `User ${event.userId} has authorization to execute operating system commands (S_RZL_ADM or S_LOG_COM)`,
        severity: 'CRITICAL',
      });
    }

    return misconfigurations;
  }

  /**
   * Calculate IAM privilege risk scores for all users in a tenant.
   * Produces an IAM risk heatmap ranked by accumulated privilege risk.
   *
   * Validates: Requirements 16.8
   */
  async calculatePrivilegeRiskScores(tenantId: string): Promise<UserRiskScore[]> {
    const logger = cds.log('iam-monitor');
    logger.info(`Calculating privilege risk scores for tenant ${tenantId}`);

    const db = await cds.connect.to('db');
    const { BehavioralProfiles } = db.entities('finsecure.ai');

    // Get all user profiles for the tenant
    const profiles = await SELECT.from(BehavioralProfiles).where({ tenantId });

    const userScores: UserRiskScore[] = [];

    for (const profile of profiles) {
      const score = this.calculateUserRiskScore(profile);
      userScores.push(score);
    }

    // Sort by risk score descending for heatmap ordering
    userScores.sort((a, b) => b.riskScore - a.riskScore);

    logger.info(
      `Calculated risk scores for ${userScores.length} users in tenant ${tenantId}. ` +
      `High-risk users (score >= 70): ${userScores.filter(s => s.riskScore >= 70).length}`
    );

    return userScores;
  }

  // ==========================================================================
  // Private Methods - Event Handlers
  // ==========================================================================

  /**
   * Handle a role assignment event. Checks whether the assigned role
   * contains critical authorizations.
   */
  private async handleRoleAssignment(event: IAMEvent): Promise<RiskEvent | null> {
    const details = event.details as Record<string, any>;
    const roleName = (details.roleName || '') as string;
    const authObjects = (details.authObjects || []) as string[];
    const authObjectCount = (details.authObjectCount || authObjects.length || 0) as number;

    // Detect if this is a critical auth grant
    const isCritical = CRITICAL_AUTHORIZATIONS.some(
      (crit) => roleName.toUpperCase().includes(crit)
    ) || authObjectCount > UNRESTRICTED_AUTH_OBJECT_THRESHOLD;

    if (isCritical) {
      return this.detectCriticalAuthGrant({
        ...event,
        eventType: 'CRITICAL_AUTH_GRANT',
        details: { ...details, profile: roleName, authObjectCount },
      });
    }

    return null;
  }

  /**
   * Handle a profile change event. Checks if the change grants
   * dangerous authorizations.
   */
  private async handleProfileChange(event: IAMEvent): Promise<RiskEvent | null> {
    const details = event.details as Record<string, any>;
    const newAuthObjects = (details.addedAuthObjects || details.authObjects || []) as string[];

    // Check if new auth objects include critical ones
    const hasCritical = newAuthObjects.some((obj) =>
      CRITICAL_AUTH_OBJECTS.some((crit) => obj.toUpperCase().includes(crit))
    );

    if (hasCritical) {
      return this.detectCriticalAuthGrant({
        ...event,
        eventType: 'CRITICAL_AUTH_GRANT',
        details: { ...details, authObjects: newAuthObjects },
      });
    }

    return null;
  }

  /**
   * Handle a critical authorization grant event directly.
   */
  private async handleCriticalAuthGrant(event: IAMEvent): Promise<RiskEvent | null> {
    return this.detectCriticalAuthGrant(event);
  }

  /**
   * Handle self-escalation: user assigns privileges to themselves.
   * Generates immediate CRITICAL risk event.
   */
  private handleSelfEscalation(event: IAMEvent): RiskEvent {
    return {
      riskEventId: cds.utils.uuid(),
      tenantId: event.tenantId,
      transactionId: event.eventId,
      riskCategory: 'PRIVILEGE_ESCALATION' as RiskCategory,
      riskScore: 98,
      confidence: 99,
      detectionMethod: 'RULE_BASED' as DetectionMethod,
      riskIndicators: [
        {
          indicatorType: 'self_escalation',
          description: `User ${event.userId} escalated their own privileges`,
          observedValue: { userId: event.userId, performedBy: event.performedBy },
          weight: 1.0,
        },
      ],
      affectedEntities: [
        {
          entityType: 'user',
          entityId: event.userId,
          entityName: `User ${event.userId}`,
        },
      ],
      detectedAt: new Date(),
    };
  }

  /**
   * Handle service account dialog logon event.
   */
  private handleServiceAccountDialogLogon(event: IAMEvent): RiskEvent {
    return this.detectServiceAccountDialogLogon(event);
  }

  /**
   * Handle dormant account detected event.
   */
  private handleDormantAccountDetected(event: IAMEvent): RiskEvent {
    const details = event.details as Record<string, any>;
    const daysSinceLogon = (details.daysSinceLogon || 90) as number;

    return {
      riskEventId: cds.utils.uuid(),
      tenantId: event.tenantId,
      transactionId: event.eventId,
      riskCategory: 'IAM_VIOLATION' as RiskCategory,
      riskScore: 60,
      confidence: 90,
      detectionMethod: 'THRESHOLD_BREACH' as DetectionMethod,
      riskIndicators: [
        {
          indicatorType: 'dormant_account',
          description: `Account ${event.userId} has not logged on for ${daysSinceLogon} days but retains active authorizations`,
          observedValue: daysSinceLogon,
          expectedRange: { min: 0, max: DEFAULT_DORMANT_ACCOUNT_DAYS },
          weight: 0.7,
        },
      ],
      affectedEntities: [
        {
          entityType: 'user',
          entityId: event.userId,
          entityName: `Dormant Account ${event.userId}`,
        },
      ],
      detectedAt: new Date(),
    };
  }

  /**
   * Handle firefighter access overdue event.
   */
  private handleFirefighterOverdue(event: IAMEvent): RiskEvent {
    const details = event.details as Record<string, any>;
    const elapsedHours = (details.elapsedHours || 0) as number;
    const maxHours = (details.maxHours || 8) as number;

    return {
      riskEventId: cds.utils.uuid(),
      tenantId: event.tenantId,
      transactionId: event.eventId,
      riskCategory: 'PRIVILEGE_ESCALATION' as RiskCategory,
      riskScore: 80,
      confidence: 95,
      detectionMethod: 'THRESHOLD_BREACH' as DetectionMethod,
      riskIndicators: [
        {
          indicatorType: 'firefighter_overdue',
          description: `Firefighter access for user ${event.userId} has been active for ${elapsedHours} hours (max: ${maxHours} hours)`,
          observedValue: elapsedHours,
          expectedRange: { min: 0, max: maxHours },
          weight: 0.9,
        },
      ],
      affectedEntities: [
        {
          entityType: 'user',
          entityId: event.userId,
          entityName: `Firefighter ${event.userId}`,
        },
      ],
      detectedAt: new Date(),
    };
  }

  /**
   * Handle temporary access expired event.
   * Generates a risk event if access was not revoked after expiration.
   */
  private handleTemporaryAccessExpired(event: IAMEvent): RiskEvent | null {
    const details = event.details as Record<string, any>;
    const accessRevoked = (details.accessRevoked || false) as boolean;

    if (accessRevoked) {
      // Access was properly revoked, no risk
      return null;
    }

    return {
      riskEventId: cds.utils.uuid(),
      tenantId: event.tenantId,
      transactionId: event.eventId,
      riskCategory: 'IAM_VIOLATION' as RiskCategory,
      riskScore: 70,
      confidence: 92,
      detectionMethod: 'THRESHOLD_BREACH' as DetectionMethod,
      riskIndicators: [
        {
          indicatorType: 'temporary_access_not_revoked',
          description: `Temporary access for user ${event.userId} has expired but was not revoked`,
          observedValue: { expired: true, revoked: false },
          weight: 0.8,
        },
      ],
      affectedEntities: [
        {
          entityType: 'user',
          entityId: event.userId,
          entityName: `User ${event.userId}`,
        },
      ],
      detectedAt: new Date(),
    };
  }

  // ==========================================================================
  // Private Methods - Misconfiguration Detection
  // ==========================================================================

  /**
   * Check if user has debug/replace access (S_DEVELOP ACTVT 02) in production.
   */
  private hasDebugInProduction(
    authObjects: string[],
    authDetails: Record<string, any>,
    systemEnvironment: string
  ): boolean {
    const isProduction = systemEnvironment.toUpperCase() === 'PRODUCTION' ||
      systemEnvironment.toUpperCase() === 'PRD' ||
      systemEnvironment.toUpperCase() === 'PROD';

    if (!isProduction) return false;

    const hasDevelop = authObjects.some(
      (obj) => obj.toUpperCase().includes('S_DEVELOP')
    );

    if (!hasDevelop) return false;

    // Check for ACTVT 02 (change/debug/replace)
    const developDetails = authDetails['S_DEVELOP'] || authDetails['s_develop'] || {};
    const actvt = developDetails.ACTVT || developDetails.actvt || '';

    // If ACTVT contains 02, or if we have S_DEVELOP without restriction in prod
    return actvt.toString().includes('02') || actvt === '*' || actvt === '';
  }

  /**
   * Check if user has unrestricted table maintenance access (S_TABU_DIS).
   */
  private hasUnrestrictedTableAccess(
    authObjects: string[],
    authDetails: Record<string, any>
  ): boolean {
    const hasTabuDis = authObjects.some(
      (obj) => obj.toUpperCase().includes('S_TABU_DIS')
    );

    if (!hasTabuDis) return false;

    // Check for unrestricted table authorization (DICBERCLS = '*' or empty)
    const tabuDetails = authDetails['S_TABU_DIS'] || authDetails['s_tabu_dis'] || {};
    const tableGroup = tabuDetails.DICBERCLS || tabuDetails.dicbercls || '';

    return tableGroup === '*' || tableGroup === '';
  }

  /**
   * Check if RFC user has dialog logon capability.
   */
  private hasRFCDialogCapability(details: Record<string, any>): boolean {
    const userType = (details.userType || '') as string;
    const logonType = (details.logonType || '') as string;
    const hasDialog = (details.dialogCapability || false) as boolean;

    // RFC users are type 'C' (communication) or explicitly marked
    const isRFCUser = userType.toUpperCase() === 'C' ||
      userType.toUpperCase() === 'RFC' ||
      (details.isRFCUser as boolean);

    return isRFCUser && (hasDialog || logonType.toUpperCase() === 'DIALOG');
  }

  /**
   * Check if user has OS command execution authorization.
   */
  private hasOSCommandExecution(authObjects: string[]): boolean {
    return authObjects.some(
      (obj) => obj.toUpperCase().includes('S_RZL_ADM') || obj.toUpperCase().includes('S_LOG_COM')
    );
  }

  // ==========================================================================
  // Private Methods - Risk Score Calculations
  // ==========================================================================

  /**
   * Calculate risk score for a critical authorization grant.
   * Score: 95 for SAP_ALL, 90 for unrestricted, 85 for critical objects.
   */
  private calculateCriticalAuthRiskScore(
    isCriticalProfile: boolean,
    isUnrestricted: boolean,
    hasCriticalAuthObject: boolean
  ): number {
    if (isCriticalProfile) return 95;
    if (isUnrestricted) return 90;
    if (hasCriticalAuthObject) return 85;
    return 80;
  }

  /**
   * Calculate individual user risk score for the IAM heatmap.
   * Based on the number and criticality of assigned authorization objects.
   */
  private calculateUserRiskScore(profile: any): UserRiskScore {
    const transactionCodes = this.parseJsonArray(profile.dimensions?.transactionCodes);
    const roleCount = this.parseJsonArray(profile.dimensions?.vendorRelationships).length; // proxy for role data

    let riskScore = 0;
    const riskFactors: string[] = [];
    let hasSuperAccess = false;
    let hasDevelopAccess = false;
    let criticalAuthCount = 0;

    // Check for critical transaction codes (proxy for authorization analysis)
    const criticalTCodeSet = new Set(['SU01', 'PFCG', 'SE38', 'SM49', 'SM69', 'SE16', 'SA38', 'SE80']);
    const userCriticalTCodes = transactionCodes.filter((tc: string) =>
      criticalTCodeSet.has(tc.toUpperCase())
    );

    if (userCriticalTCodes.length > 0) {
      riskScore += Math.min(RISK_WEIGHTS.CRITICAL_TCODES, userCriticalTCodes.length * 5);
      riskFactors.push(`Critical transaction codes: ${userCriticalTCodes.join(', ')}`);
      criticalAuthCount += userCriticalTCodes.length;
    }

    // Check for SAP_ALL equivalent indicators
    if (transactionCodes.some((tc: string) => tc.toUpperCase() === 'SAP_ALL')) {
      riskScore += RISK_WEIGHTS.SAP_ALL;
      riskFactors.push('Has SAP_ALL or equivalent');
      hasSuperAccess = true;
      criticalAuthCount += 10;
    }

    // Check for development access
    if (transactionCodes.some((tc: string) =>
      ['SE38', 'SE80', 'SE24', 'SE37'].includes(tc.toUpperCase())
    )) {
      riskScore += RISK_WEIGHTS.S_DEVELOP_PROD;
      riskFactors.push('Has development access (S_DEVELOP)');
      hasDevelopAccess = true;
      criticalAuthCount += 3;
    }

    // High role count penalty
    if (roleCount > 20) {
      riskScore += RISK_WEIGHTS.HIGH_ROLE_COUNT;
      riskFactors.push(`High role count: ${roleCount}`);
    }

    // Check if account is dormant (contributes to risk)
    const lastUpdated = profile.lastUpdated ? new Date(profile.lastUpdated) : null;
    if (lastUpdated) {
      const daysSinceActivity = Math.floor(
        (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceActivity > DEFAULT_DORMANT_ACCOUNT_DAYS) {
        riskScore += RISK_WEIGHTS.DORMANT_WITH_ACCESS;
        riskFactors.push(`Dormant account (${daysSinceActivity} days inactive)`);
      }
    }

    // Clamp to 0-100 range
    riskScore = Math.min(100, Math.max(0, riskScore));

    return {
      userId: profile.userId,
      tenantId: profile.tenantId,
      riskScore,
      criticalAuthCount,
      roleCount,
      hasSuperAccess,
      hasDevelopAccess,
      riskFactors,
    };
  }

  // ==========================================================================
  // Private Methods - Helpers
  // ==========================================================================

  /**
   * Record IAM event in authorization change history for timeline view.
   * Validates: Requirements 16.6
   */
  private async recordAuthChangeHistory(event: IAMEvent): Promise<void> {
    const logger = cds.log('iam-monitor');

    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      const entry = {
        ID: cds.utils.uuid(),
        tenantId: event.tenantId,
        timestamp: event.timestamp.toISOString(),
        userId: event.performedBy,
        action: `IAM_${event.eventType}`,
        affectedObject: `user:${event.userId}`,
        sourceIP: (event.details as Record<string, any>).sourceIP || 'SYSTEM',
        outcome: 'SUCCESS',
        details: JSON.stringify({
          eventType: event.eventType,
          targetUser: event.userId,
          systemId: event.systemId,
          details: event.details,
        }),
      };

      await INSERT.into(AuditTrailEntries).entries(entry);
    } catch (error: any) {
      logger.warn(`Failed to record auth change history: ${error.message}`);
    }
  }

  /**
   * Get the dormant account days threshold for a tenant.
   */
  private async getDormantAccountDays(tenantId: string): Promise<number> {
    try {
      const db = await cds.connect.to('db');
      const { TenantThresholds } = db.entities('finsecure.ai');
      const thresholds = await SELECT.one.from(TenantThresholds).where({ tenant_ID: tenantId });

      if (thresholds?.dormantAccountDays) {
        return thresholds.dormantAccountDays;
      }
    } catch {
      // Fall through to default
    }

    return DEFAULT_DORMANT_ACCOUNT_DAYS;
  }

  /**
   * Check if the critical user percentage threshold has been exceeded.
   * Generates a governance alert if needed.
   *
   * Validates: Requirements 16.7
   */
  private async checkCriticalUserThreshold(tenantId: string): Promise<void> {
    const logger = cds.log('iam-monitor');

    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles } = db.entities('finsecure.ai');

      const allProfiles = await SELECT.from(BehavioralProfiles).where({ tenantId });
      const totalUsers = allProfiles.length;

      if (totalUsers === 0) return;

      // Calculate how many users have critical authorizations
      const criticalTCodeSet = new Set(['SU01', 'PFCG', 'SAP_ALL', 'SE38', 'SM49', 'SM69']);
      let criticalUsers = 0;
      for (const profile of allProfiles) {
        const transactionCodes = this.parseJsonArray(profile.dimensions?.transactionCodes);
        const hasCritical = transactionCodes.some((tc: string) =>
          criticalTCodeSet.has(tc.toUpperCase())
        );
        if (hasCritical) criticalUsers++;
      }

      const criticalPercentage = (criticalUsers / totalUsers) * 100;

      if (criticalPercentage > DEFAULT_CRITICAL_USER_PERCENTAGE) {
        logger.warn(
          `Tenant ${tenantId}: ${criticalPercentage.toFixed(1)}% of users have critical authorizations ` +
          `(threshold: ${DEFAULT_CRITICAL_USER_PERCENTAGE}%). Recommend access review campaign.`
        );
      }
    } catch (error: any) {
      logger.warn(`Failed to check critical user threshold: ${error.message}`);
    }
  }

  /**
   * Create a RiskEvent from an IAM misconfiguration finding.
   */
  private createMisconfigRiskEvent(event: IAMEvent, misconfig: IAMMisconfiguration): RiskEvent {
    const severityToScore: Record<string, number> = {
      CRITICAL: 90,
      HIGH: 75,
      MEDIUM: 60,
    };

    return {
      riskEventId: cds.utils.uuid(),
      tenantId: event.tenantId,
      transactionId: event.eventId,
      riskCategory: 'IAM_VIOLATION' as RiskCategory,
      riskScore: severityToScore[misconfig.severity] || 70,
      confidence: 95,
      detectionMethod: 'RULE_BASED' as DetectionMethod,
      riskIndicators: [
        {
          indicatorType: `misconfiguration_${misconfig.misconfigurationType.toLowerCase()}`,
          description: misconfig.description,
          observedValue: {
            type: misconfig.misconfigurationType,
            userId: misconfig.userId,
            systemId: misconfig.systemId,
          },
          weight: 0.9,
        },
      ],
      affectedEntities: [
        {
          entityType: 'user',
          entityId: misconfig.userId,
          entityName: `User ${misconfig.userId}`,
        },
        {
          entityType: 'system',
          entityId: misconfig.systemId,
          entityName: `System ${misconfig.systemId}`,
        },
      ],
      detectedAt: new Date(),
    };
  }

  /**
   * Parse assigned roles from a behavioral profile.
   * Roles may be stored in the transactionCodes dimension as a proxy.
   */
  private parseAssignedRoles(profile: any): string[] {
    if (!profile.dimensions) return [];
    return this.parseJsonArray(profile.dimensions.transactionCodes);
  }

  /**
   * Safely parse a JSON string that should be an array.
   */
  private parseJsonArray(jsonStr: string | null | undefined): string[] {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
