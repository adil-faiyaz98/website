import cds = require('@sap/cds');
import { IAMEvent, RiskEvent, RiskIndicator, TenantThresholds } from '../types';
import { DetectionMethod, IAMEventType, RiskCategory } from '../types/enums';

// ============================================================================
// Interfaces
// ============================================================================

/** Escalation sequence event detected in the system */
export interface EscalationEvent {
  /** User who performed the escalation */
  userId: string;
  /** Tenant context */
  tenantId: string;
  /** Type of escalation detected */
  escalationType: EscalationType;
  /** Events that form the escalation sequence */
  sequenceEvents: IAMEvent[];
  /** Risk score assigned to this escalation (0-100) */
  riskScore: number;
  /** Whether this is a self-escalation */
  isSelfEscalation: boolean;
  /** Whether a playbook should be triggered */
  triggerPlaybook: boolean;
  /** Generated risk event */
  riskEvent: RiskEvent;
}

/** Types of privilege escalation patterns */
export type EscalationType =
  | 'ESCALATION_SEQUENCE'        // SU01 → PFCG → self-assign
  | 'FIREFIGHTER_OVERDUE'        // Firefighter access not revoked in time
  | 'CRITICAL_TCODE_NO_PROFILE'  // Critical transaction without historical profile
  | 'TEMPORARY_ACCESS_OVERDUE'   // Temporary access not revoked 24h post-expiry
  | 'SELF_ESCALATION'            // Self-assignment of critical auths
  | 'NEW_AUTH_PRIVILEGED_EXEC';  // New auth + privileged transaction within 4 hours

/** Firefighter access tracking record */
export interface FirefighterAccessRecord {
  /** User with firefighter access */
  userId: string;
  /** Tenant context */
  tenantId: string;
  /** When firefighter access was activated */
  activatedAt: Date;
  /** Maximum allowed duration in hours */
  maxDurationHours: number;
  /** Whether the access has been revoked */
  revoked: boolean;
  /** When the access was revoked (if applicable) */
  revokedAt?: Date;
}

/** Temporary access grant tracking */
export interface TemporaryAccessGrant {
  /** User with temporary access */
  userId: string;
  /** Tenant context */
  tenantId: string;
  /** Role or profile granted */
  roleId: string;
  /** When access was granted */
  grantedAt: Date;
  /** Configured expiry date */
  expiryDate: Date;
  /** Whether access has been revoked */
  revoked: boolean;
  /** When the access was revoked (if applicable) */
  revokedAt?: Date;
}

/** Configuration for privilege escalation detection */
export interface PrivilegeEscalationConfig {
  /** Window for SU01→PFCG→self-assign sequence in minutes (default 60) */
  escalationWindowMinutes: number;
  /** Max firefighter access duration in hours (default 8) */
  maxFirefighterHours: number;
  /** Hours after temp access expiry before alert (default 24) */
  tempAccessGracePeriodHours: number;
  /** Window for new auth + privileged transaction correlation in hours (default 4) */
  authCorrelationWindowHours: number;
  /** Critical transactions to monitor */
  criticalTransactions: string[];
  /** Lookback days for historical profile check (default 90) */
  profileLookbackDays: number;
}

/** Authorization change event for correlation */
export interface AuthorizationChange {
  /** User who received the authorization */
  userId: string;
  /** Tenant context */
  tenantId: string;
  /** Authorization/role granted */
  authorizationId: string;
  /** When the change was made */
  changedAt: Date;
  /** Who performed the change */
  performedBy: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Critical SAP transactions that require monitoring */
const CRITICAL_TRANSACTIONS: string[] = [
  'SU01',   // User maintenance
  'PFCG',   // Role maintenance
  'SE38',   // ABAP Editor
  'SM49',   // External OS commands
  'SM69',   // External OS command definitions
  'SE16',   // Data browser
  'SA38',   // Program execution
  'SM30',   // Table maintenance
  'RSBDCOS0', // OS command execution
];

/** Default escalation detection configuration */
const DEFAULT_CONFIG: PrivilegeEscalationConfig = {
  escalationWindowMinutes: 60,
  maxFirefighterHours: 8,
  tempAccessGracePeriodHours: 24,
  authCorrelationWindowHours: 4,
  criticalTransactions: CRITICAL_TRANSACTIONS,
  profileLookbackDays: 90,
};

/** Risk scores for different escalation types */
const ESCALATION_RISK_SCORES: Record<EscalationType, number> = {
  ESCALATION_SEQUENCE: 85,
  FIREFIGHTER_OVERDUE: 75,
  CRITICAL_TCODE_NO_PROFILE: 80,
  TEMPORARY_ACCESS_OVERDUE: 70,
  SELF_ESCALATION: 95,
  NEW_AUTH_PRIVILEGED_EXEC: 78,
};

// ============================================================================
// Privilege Escalation Detection Implementation
// ============================================================================

/**
 * Privilege Escalation Detection Engine.
 *
 * Detects privilege escalation patterns in IAM events including:
 * - SU01 → PFCG → self-assignment sequences within configurable window
 * - Firefighter access exceeding maximum duration
 * - Critical transaction execution without historical profile
 * - Temporary access grants not revoked after expiry
 * - Self-escalation (immediate CRITICAL alert + playbook trigger)
 * - New auth + privileged transaction correlation within 4 hours
 *
 * Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8
 */
export class PrivilegeEscalationDetector {
  private readonly config: PrivilegeEscalationConfig;

  constructor(config?: Partial<PrivilegeEscalationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Process an IAM event and detect privilege escalation patterns.
   * Entry point for all IAM event-driven escalation detection.
   *
   * Validates: Requirements 19.1
   */
  async processIAMEvent(event: IAMEvent, thresholds: TenantThresholds): Promise<EscalationEvent | null> {
    const logger = cds.log('privilege-escalation');
    logger.info(`Processing IAM event ${event.eventId} for user ${event.userId}, type: ${event.eventType}`);

    // Apply tenant-specific thresholds
    const effectiveConfig = this.applyTenantThresholds(thresholds);

    // Check for self-escalation first (highest priority, immediate CRITICAL)
    const selfEscalation = await this.detectSelfEscalation(event, effectiveConfig);
    if (selfEscalation) {
      return selfEscalation;
    }

    // Check for escalation sequence (SU01 → PFCG → self-assign)
    const sequenceEscalation = await this.detectEscalationSequence(event, effectiveConfig);
    if (sequenceEscalation) {
      return sequenceEscalation;
    }

    // Check firefighter access monitoring
    const firefighterAlert = await this.checkFirefighterAccess(event, effectiveConfig);
    if (firefighterAlert) {
      return firefighterAlert;
    }

    // Check for critical transaction without historical profile
    const criticalTcodeAlert = await this.detectCriticalTransactionNoProfile(event, effectiveConfig);
    if (criticalTcodeAlert) {
      return criticalTcodeAlert;
    }

    // Check temporary access overdue revocation
    const tempAccessAlert = await this.checkTemporaryAccessOverdue(event, effectiveConfig);
    if (tempAccessAlert) {
      return tempAccessAlert;
    }

    // Check new auth + privileged transaction correlation
    const correlationAlert = await this.detectNewAuthCorrelation(event, effectiveConfig);
    if (correlationAlert) {
      return correlationAlert;
    }

    return null;
  }

  /**
   * Monitor all active firefighter access records and alert on overdue ones.
   * Called periodically (e.g., every 15 minutes) to check for overdue access.
   *
   * Validates: Requirements 19.3
   */
  async monitorFirefighterAccess(tenantId: string, thresholds: TenantThresholds): Promise<EscalationEvent[]> {
    const logger = cds.log('privilege-escalation');
    const alerts: EscalationEvent[] = [];

    try {
      const maxHours = thresholds.maxFirefighterHours || this.config.maxFirefighterHours;
      const activeRecords = await this.getActiveFirefighterRecords(tenantId);

      const now = new Date();

      for (const record of activeRecords) {
        const activatedAt = new Date(record.activatedAt);
        const elapsedMs = now.getTime() - activatedAt.getTime();
        const elapsedHours = elapsedMs / (1000 * 60 * 60);

        if (elapsedHours > maxHours) {
          logger.warn(
            `Firefighter access overdue for user ${record.userId} in tenant ${tenantId}. ` +
            `Elapsed: ${elapsedHours.toFixed(1)}h, Max: ${maxHours}h`
          );

          const riskEvent = this.createRiskEvent(
            tenantId,
            record.userId,
            'FIREFIGHTER_OVERDUE',
            ESCALATION_RISK_SCORES.FIREFIGHTER_OVERDUE,
            [
              {
                indicatorType: 'firefighter_overdue',
                description: `Firefighter access active for ${elapsedHours.toFixed(1)} hours, exceeding maximum of ${maxHours} hours`,
                observedValue: elapsedHours,
                expectedRange: { min: 0, max: maxHours },
                weight: 0.9,
              },
            ],
            `Firefighter access overdue: ${record.userId}`
          );

          alerts.push({
            userId: record.userId,
            tenantId,
            escalationType: 'FIREFIGHTER_OVERDUE',
            sequenceEvents: [],
            riskScore: ESCALATION_RISK_SCORES.FIREFIGHTER_OVERDUE,
            isSelfEscalation: false,
            triggerPlaybook: true,
            riskEvent,
          });
        }
      }
    } catch (error: any) {
      logger.error(`Error monitoring firefighter access for tenant ${tenantId}: ${error.message}`);
    }

    return alerts;
  }

  /**
   * Check all temporary access grants for overdue revocations.
   * Generates alerts for access not revoked within 24 hours post-expiry.
   *
   * Validates: Requirements 19.5
   */
  async checkAllTemporaryAccessGrants(tenantId: string): Promise<EscalationEvent[]> {
    const logger = cds.log('privilege-escalation');
    const alerts: EscalationEvent[] = [];

    try {
      const overdueGrants = await this.getOverdueTemporaryGrants(tenantId);
      const now = new Date();

      for (const grant of overdueGrants) {
        const expiryDate = new Date(grant.expiryDate);
        const hoursSinceExpiry = (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceExpiry > this.config.tempAccessGracePeriodHours) {
          logger.warn(
            `Temporary access overdue revocation for user ${grant.userId}, role ${grant.roleId}. ` +
            `Expired ${hoursSinceExpiry.toFixed(1)} hours ago`
          );

          const riskEvent = this.createRiskEvent(
            tenantId,
            grant.userId,
            'TEMPORARY_ACCESS_OVERDUE',
            ESCALATION_RISK_SCORES.TEMPORARY_ACCESS_OVERDUE,
            [
              {
                indicatorType: 'temp_access_overdue',
                description: `Temporary access for role ${grant.roleId} expired ${hoursSinceExpiry.toFixed(1)} hours ago and has not been revoked (grace period: ${this.config.tempAccessGracePeriodHours}h)`,
                observedValue: hoursSinceExpiry,
                expectedRange: { min: 0, max: this.config.tempAccessGracePeriodHours },
                weight: 0.8,
              },
            ],
            `Overdue temporary access revocation: ${grant.userId} - ${grant.roleId}`
          );

          alerts.push({
            userId: grant.userId,
            tenantId,
            escalationType: 'TEMPORARY_ACCESS_OVERDUE',
            sequenceEvents: [],
            riskScore: ESCALATION_RISK_SCORES.TEMPORARY_ACCESS_OVERDUE,
            isSelfEscalation: false,
            triggerPlaybook: false,
            riskEvent,
          });
        }
      }
    } catch (error: any) {
      logger.error(`Error checking temporary access grants for tenant ${tenantId}: ${error.message}`);
    }

    return alerts;
  }

  // ==========================================================================
  // Detection Methods
  // ==========================================================================

  /**
   * Detect self-escalation: user assigning critical authorizations to themselves.
   * Generates immediate CRITICAL alert + playbook trigger.
   *
   * Validates: Requirements 19.6, 19.8
   */
  private async detectSelfEscalation(
    event: IAMEvent,
    config: PrivilegeEscalationConfig
  ): Promise<EscalationEvent | null> {
    const logger = cds.log('privilege-escalation');

    // Self-escalation: performedBy === userId AND it's a role/auth assignment
    const isSelfAssignment = event.performedBy === event.userId;
    const isAuthGrant = event.eventType === 'ROLE_ASSIGNMENT' ||
      event.eventType === 'CRITICAL_AUTH_GRANT' ||
      event.eventType === 'PROFILE_CHANGE';

    if (!isSelfAssignment || !isAuthGrant) {
      return null;
    }

    // Check if the assigned authorization is critical
    const isCriticalAuth = this.isCriticalAuthorization(event.details);

    if (!isCriticalAuth) {
      return null;
    }

    logger.warn(
      `CRITICAL: Self-escalation detected! User ${event.userId} assigned critical auth to themselves. ` +
      `Event: ${event.eventId}`
    );

    const riskEvent = this.createRiskEvent(
      event.tenantId,
      event.userId,
      'SELF_ESCALATION',
      ESCALATION_RISK_SCORES.SELF_ESCALATION,
      [
        {
          indicatorType: 'self_escalation',
          description: `User ${event.userId} assigned critical authorization to their own account`,
          observedValue: event.eventType,
          expectedRange: undefined,
          weight: 1.0,
        },
        {
          indicatorType: 'critical_auth_self_assign',
          description: `Critical authorization self-assigned: ${this.describeAuth(event.details)}`,
          observedValue: event.details,
          expectedRange: undefined,
          weight: 1.0,
        },
      ],
      `Self-escalation: ${event.userId} assigned critical auth to own account`
    );

    return {
      userId: event.userId,
      tenantId: event.tenantId,
      escalationType: 'SELF_ESCALATION',
      sequenceEvents: [event],
      riskScore: ESCALATION_RISK_SCORES.SELF_ESCALATION,
      isSelfEscalation: true,
      triggerPlaybook: true,
      riskEvent,
    };
  }

  /**
   * Detect escalation sequence: SU01 → PFCG → self-assignment within
   * configurable window (default 60 minutes).
   *
   * Validates: Requirements 19.2
   */
  private async detectEscalationSequence(
    event: IAMEvent,
    config: PrivilegeEscalationConfig
  ): Promise<EscalationEvent | null> {
    const logger = cds.log('privilege-escalation');

    // Only check on role assignment or auth change events (the final step)
    if (event.eventType !== 'ROLE_ASSIGNMENT' && event.eventType !== 'CRITICAL_AUTH_GRANT') {
      return null;
    }

    // Look for the escalation pattern: SU01 → PFCG → self-assign within window
    const windowMs = config.escalationWindowMinutes * 60 * 1000;
    const windowStart = new Date(event.timestamp.getTime() - windowMs);

    try {
      const recentEvents = await this.getRecentIAMEvents(
        event.tenantId,
        event.userId,
        windowStart,
        event.timestamp
      );

      // Check for the three-step pattern
      const hasSU01 = recentEvents.some(e => this.isTransactionExecution(e, 'SU01'));
      const hasPFCG = recentEvents.some(e => this.isTransactionExecution(e, 'PFCG'));
      const hasSelfAssignment = event.performedBy === event.userId;

      if (hasSU01 && hasPFCG && hasSelfAssignment) {
        const sequenceEvents = [
          ...recentEvents.filter(e =>
            this.isTransactionExecution(e, 'SU01') || this.isTransactionExecution(e, 'PFCG')
          ),
          event,
        ];

        logger.warn(
          `Escalation sequence detected: SU01 → PFCG → self-assign by user ${event.userId} ` +
          `within ${config.escalationWindowMinutes} minutes`
        );

        const riskEvent = this.createRiskEvent(
          event.tenantId,
          event.userId,
          'ESCALATION_SEQUENCE',
          ESCALATION_RISK_SCORES.ESCALATION_SEQUENCE,
          [
            {
              indicatorType: 'escalation_sequence',
              description: `SU01 → PFCG → self-assignment sequence detected within ${config.escalationWindowMinutes} minute window`,
              observedValue: sequenceEvents.length,
              expectedRange: { min: 0, max: 0 },
              weight: 0.9,
            },
            {
              indicatorType: 'self_role_assignment',
              description: `User ${event.userId} assigned role to themselves after SU01/PFCG activity`,
              observedValue: true,
              expectedRange: undefined,
              weight: 0.8,
            },
          ],
          `Escalation sequence: ${event.userId} - SU01 → PFCG → self-assign`
        );

        return {
          userId: event.userId,
          tenantId: event.tenantId,
          escalationType: 'ESCALATION_SEQUENCE',
          sequenceEvents,
          riskScore: ESCALATION_RISK_SCORES.ESCALATION_SEQUENCE,
          isSelfEscalation: true,
          triggerPlaybook: true,
          riskEvent,
        };
      }
    } catch (error: any) {
      logger.error(`Error checking escalation sequence for user ${event.userId}: ${error.message}`);
    }

    return null;
  }

  /**
   * Check firefighter access status on activation events.
   * Starts monitoring when activated; alerts handled by monitorFirefighterAccess.
   *
   * Validates: Requirements 19.3
   */
  private async checkFirefighterAccess(
    event: IAMEvent,
    config: PrivilegeEscalationConfig
  ): Promise<EscalationEvent | null> {
    const logger = cds.log('privilege-escalation');

    if (event.eventType !== 'FIREFIGHTER_ACTIVATION' && event.eventType !== 'FIREFIGHTER_OVERDUE') {
      return null;
    }

    // If this is an overdue event already flagged by the system
    if (event.eventType === 'FIREFIGHTER_OVERDUE') {
      const maxHours = config.maxFirefighterHours;
      const activatedAt = event.details?.activatedAt
        ? new Date(event.details.activatedAt as string)
        : new Date(event.timestamp.getTime() - maxHours * 60 * 60 * 1000);

      const elapsedHours = (event.timestamp.getTime() - activatedAt.getTime()) / (1000 * 60 * 60);

      logger.warn(
        `Firefighter access overdue for user ${event.userId}. Elapsed: ${elapsedHours.toFixed(1)}h, Max: ${maxHours}h`
      );

      const riskEvent = this.createRiskEvent(
        event.tenantId,
        event.userId,
        'FIREFIGHTER_OVERDUE',
        ESCALATION_RISK_SCORES.FIREFIGHTER_OVERDUE,
        [
          {
            indicatorType: 'firefighter_overdue',
            description: `Firefighter access not revoked within ${maxHours} hours`,
            observedValue: elapsedHours,
            expectedRange: { min: 0, max: maxHours },
            weight: 0.9,
          },
        ],
        `Firefighter access overdue: ${event.userId}`
      );

      return {
        userId: event.userId,
        tenantId: event.tenantId,
        escalationType: 'FIREFIGHTER_OVERDUE',
        sequenceEvents: [event],
        riskScore: ESCALATION_RISK_SCORES.FIREFIGHTER_OVERDUE,
        isSelfEscalation: false,
        triggerPlaybook: true,
        riskEvent,
      };
    }

    // On activation, record the firefighter access for monitoring
    if (event.eventType === 'FIREFIGHTER_ACTIVATION') {
      await this.recordFirefighterActivation(event, config);
    }

    return null;
  }

  /**
   * Detect critical transaction execution by users without historical profile.
   * User must not have the transaction in their behavioral profile from the
   * preceding 90 days.
   *
   * Validates: Requirements 19.4
   */
  private async detectCriticalTransactionNoProfile(
    event: IAMEvent,
    config: PrivilegeEscalationConfig
  ): Promise<EscalationEvent | null> {
    const logger = cds.log('privilege-escalation');

    // Check if this event represents execution of a critical transaction
    const transactionCode = this.extractTransactionCode(event);
    if (!transactionCode || !config.criticalTransactions.includes(transactionCode)) {
      return null;
    }

    try {
      // Check if user has this transaction in their historical profile
      const hasInProfile = await this.hasTransactionInProfile(
        event.tenantId,
        event.userId,
        transactionCode,
        config.profileLookbackDays
      );

      if (!hasInProfile) {
        logger.warn(
          `Critical transaction ${transactionCode} executed by user ${event.userId} ` +
          `without historical profile match (lookback: ${config.profileLookbackDays} days)`
        );

        const riskEvent = this.createRiskEvent(
          event.tenantId,
          event.userId,
          'CRITICAL_TCODE_NO_PROFILE',
          ESCALATION_RISK_SCORES.CRITICAL_TCODE_NO_PROFILE,
          [
            {
              indicatorType: 'critical_tcode_no_profile',
              description: `User ${event.userId} executed critical transaction ${transactionCode} not found in their ${config.profileLookbackDays}-day behavioral profile`,
              observedValue: transactionCode,
              expectedRange: undefined,
              weight: 0.85,
            },
          ],
          `Critical transaction without profile: ${event.userId} - ${transactionCode}`
        );

        return {
          userId: event.userId,
          tenantId: event.tenantId,
          escalationType: 'CRITICAL_TCODE_NO_PROFILE',
          sequenceEvents: [event],
          riskScore: ESCALATION_RISK_SCORES.CRITICAL_TCODE_NO_PROFILE,
          isSelfEscalation: false,
          triggerPlaybook: false,
          riskEvent,
        };
      }
    } catch (error: any) {
      logger.error(`Error checking transaction profile for user ${event.userId}: ${error.message}`);
    }

    return null;
  }

  /**
   * Check if temporary access has not been revoked within the grace period.
   *
   * Validates: Requirements 19.5
   */
  private async checkTemporaryAccessOverdue(
    event: IAMEvent,
    config: PrivilegeEscalationConfig
  ): Promise<EscalationEvent | null> {
    const logger = cds.log('privilege-escalation');

    if (event.eventType !== 'TEMPORARY_ACCESS_EXPIRED') {
      return null;
    }

    // The event signals expiry — check if access was revoked
    const expiryDate = event.details?.expiryDate
      ? new Date(event.details.expiryDate as string)
      : event.timestamp;

    const now = new Date();
    const hoursSinceExpiry = (now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceExpiry > config.tempAccessGracePeriodHours) {
      const roleId = (event.details?.roleId as string) || 'unknown';

      logger.warn(
        `Temporary access overdue for user ${event.userId}, role ${roleId}. ` +
        `Expired ${hoursSinceExpiry.toFixed(1)} hours ago`
      );

      const riskEvent = this.createRiskEvent(
        event.tenantId,
        event.userId,
        'TEMPORARY_ACCESS_OVERDUE',
        ESCALATION_RISK_SCORES.TEMPORARY_ACCESS_OVERDUE,
        [
          {
            indicatorType: 'temp_access_overdue',
            description: `Temporary access for role ${roleId} expired ${hoursSinceExpiry.toFixed(1)} hours ago, exceeding the ${config.tempAccessGracePeriodHours}-hour grace period`,
            observedValue: hoursSinceExpiry,
            expectedRange: { min: 0, max: config.tempAccessGracePeriodHours },
            weight: 0.8,
          },
        ],
        `Overdue temporary access: ${event.userId} - ${roleId}`
      );

      return {
        userId: event.userId,
        tenantId: event.tenantId,
        escalationType: 'TEMPORARY_ACCESS_OVERDUE',
        sequenceEvents: [event],
        riskScore: ESCALATION_RISK_SCORES.TEMPORARY_ACCESS_OVERDUE,
        isSelfEscalation: false,
        triggerPlaybook: false,
        riskEvent,
      };
    }

    return null;
  }

  /**
   * Correlate new authorization assignment with privileged transaction execution
   * within a 4-hour window.
   *
   * Validates: Requirements 19.6, 19.7
   */
  private async detectNewAuthCorrelation(
    event: IAMEvent,
    config: PrivilegeEscalationConfig
  ): Promise<EscalationEvent | null> {
    const logger = cds.log('privilege-escalation');

    // Check if this is a privileged transaction execution
    const transactionCode = this.extractTransactionCode(event);
    if (!transactionCode || !config.criticalTransactions.includes(transactionCode)) {
      return null;
    }

    try {
      // Look for recent authorization grants to this user within the correlation window
      const correlationWindowMs = config.authCorrelationWindowHours * 60 * 60 * 1000;
      const windowStart = new Date(event.timestamp.getTime() - correlationWindowMs);

      const recentAuthChanges = await this.getRecentAuthorizationChanges(
        event.tenantId,
        event.userId,
        windowStart,
        event.timestamp
      );

      if (recentAuthChanges.length > 0) {
        const mostRecentChange = recentAuthChanges[0];
        const timeSinceAuth = (event.timestamp.getTime() - mostRecentChange.timestamp.getTime()) / (1000 * 60 * 60);

        logger.warn(
          `Correlation detected: User ${event.userId} executed privileged transaction ${transactionCode} ` +
          `${timeSinceAuth.toFixed(1)} hours after receiving new authorization`
        );

        const riskEvent = this.createRiskEvent(
          event.tenantId,
          event.userId,
          'NEW_AUTH_PRIVILEGED_EXEC',
          ESCALATION_RISK_SCORES.NEW_AUTH_PRIVILEGED_EXEC,
          [
            {
              indicatorType: 'new_auth_correlation',
              description: `New authorization granted ${timeSinceAuth.toFixed(1)} hours before privileged transaction ${transactionCode} execution`,
              observedValue: timeSinceAuth,
              expectedRange: { min: config.authCorrelationWindowHours, max: undefined as unknown },
              weight: 0.85,
            },
            {
              indicatorType: 'privileged_transaction_post_auth',
              description: `Privileged transaction ${transactionCode} executed shortly after authorization change`,
              observedValue: transactionCode,
              expectedRange: undefined,
              weight: 0.7,
            },
          ],
          `Auth correlation: ${event.userId} - new auth → ${transactionCode} within ${config.authCorrelationWindowHours}h`
        );

        return {
          userId: event.userId,
          tenantId: event.tenantId,
          escalationType: 'NEW_AUTH_PRIVILEGED_EXEC',
          sequenceEvents: [mostRecentChange, event],
          riskScore: ESCALATION_RISK_SCORES.NEW_AUTH_PRIVILEGED_EXEC,
          isSelfEscalation: false,
          triggerPlaybook: false,
          riskEvent,
        };
      }
    } catch (error: any) {
      logger.error(`Error checking auth correlation for user ${event.userId}: ${error.message}`);
    }

    return null;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Apply tenant-specific thresholds to the configuration.
   */
  private applyTenantThresholds(thresholds: TenantThresholds): PrivilegeEscalationConfig {
    return {
      ...this.config,
      maxFirefighterHours: thresholds.maxFirefighterHours || this.config.maxFirefighterHours,
    };
  }

  /**
   * Check if the authorization details indicate a critical authorization.
   * Critical auths: SAP_ALL, S_DEVELOP, S_ADMI_FCD, S_RZL_ADM, S_BTCH_ADM.
   */
  private isCriticalAuthorization(details: Record<string, unknown>): boolean {
    const criticalProfiles = ['SAP_ALL', 'SAP_NEW'];
    const criticalAuthObjects = ['S_DEVELOP', 'S_ADMI_FCD', 'S_RZL_ADM', 'S_BTCH_ADM'];

    const role = (details?.role as string)?.toUpperCase() || '';
    const profile = (details?.profile as string)?.toUpperCase() || '';
    const authObject = (details?.authorizationObject as string)?.toUpperCase() || '';
    const roles = (details?.roles as string[]) || [];
    const profiles = (details?.profiles as string[]) || [];

    // Check direct matches
    if (criticalProfiles.includes(profile) || criticalAuthObjects.includes(authObject)) {
      return true;
    }

    // Check role/profile names for critical patterns
    if (criticalProfiles.some(p => role.includes(p) || profiles.map(pr => pr.toUpperCase()).includes(p))) {
      return true;
    }

    if (criticalAuthObjects.some(a => roles.map(r => r.toUpperCase()).includes(a))) {
      return true;
    }

    // Check for unrestricted access indicators
    const hasUnrestrictedAccess = details?.unrestricted === true ||
      details?.fullAuthorization === true ||
      (details?.activityValues as string[])?.includes('*');

    return !!hasUnrestrictedAccess;
  }

  /**
   * Extract human-readable description of the authorization from event details.
   */
  private describeAuth(details: Record<string, unknown>): string {
    const role = details?.role as string;
    const profile = details?.profile as string;
    const authObject = details?.authorizationObject as string;

    const parts: string[] = [];
    if (role) parts.push(`Role: ${role}`);
    if (profile) parts.push(`Profile: ${profile}`);
    if (authObject) parts.push(`Auth Object: ${authObject}`);

    return parts.length > 0 ? parts.join(', ') : 'Unknown authorization';
  }

  /**
   * Check if an IAM event represents execution of a specific transaction code.
   */
  private isTransactionExecution(event: IAMEvent, tcode: string): boolean {
    const eventTcode = this.extractTransactionCode(event);
    return eventTcode === tcode;
  }

  /**
   * Extract the transaction code from an IAM event.
   */
  private extractTransactionCode(event: IAMEvent): string | null {
    return (event.details?.transactionCode as string) ||
      (event.details?.tcode as string) ||
      (event.details?.transaction as string) ||
      null;
  }

  /**
   * Create a RiskEvent for a privilege escalation detection.
   */
  private createRiskEvent(
    tenantId: string,
    userId: string,
    escalationType: EscalationType,
    riskScore: number,
    indicators: RiskIndicator[],
    description: string
  ): RiskEvent {
    return {
      riskEventId: `PE-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      tenantId,
      transactionId: `IAM-${userId}-${Date.now()}`,
      riskCategory: 'PRIVILEGE_ESCALATION' as RiskCategory,
      riskScore: Math.max(0, Math.min(100, riskScore)),
      confidence: 90,
      detectionMethod: escalationType === 'NEW_AUTH_PRIVILEGED_EXEC'
        ? 'CORRELATION' as DetectionMethod
        : 'PATTERN_MATCHING' as DetectionMethod,
      riskIndicators: indicators,
      affectedEntities: [
        {
          entityType: 'user',
          entityId: userId,
          entityName: userId,
        },
      ],
      financialExposure: undefined,
      detectedAt: new Date(),
    };
  }

  // ==========================================================================
  // Database Access Methods
  // ==========================================================================

  /**
   * Get recent IAM events for a user within a time window.
   */
  private async getRecentIAMEvents(
    tenantId: string,
    userId: string,
    windowStart: Date,
    windowEnd: Date
  ): Promise<IAMEvent[]> {
    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      // Query audit trail for IAM-related events within the window
      const entries = await SELECT.from(AuditTrailEntries).where({
        tenantId,
        userId,
        timestamp: { '>=': windowStart.toISOString(), '<=': windowEnd.toISOString() },
        action: { in: ['SU01_EXECUTE', 'PFCG_EXECUTE', 'ROLE_ASSIGNMENT', 'AUTH_CHANGE', 'CRITICAL_AUTH_GRANT'] },
      });

      return (entries || []).map((entry: any) => this.mapAuditEntryToIAMEvent(entry, tenantId));
    } catch (error: any) {
      cds.log('privilege-escalation').warn(`Failed to query recent IAM events: ${error.message}`);
      return [];
    }
  }

  /**
   * Get recent authorization changes for a user within a correlation window.
   */
  private async getRecentAuthorizationChanges(
    tenantId: string,
    userId: string,
    windowStart: Date,
    windowEnd: Date
  ): Promise<IAMEvent[]> {
    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      const entries = await SELECT.from(AuditTrailEntries).where({
        tenantId,
        affectedObject: userId,
        timestamp: { '>=': windowStart.toISOString(), '<=': windowEnd.toISOString() },
        action: { in: ['ROLE_ASSIGNMENT', 'CRITICAL_AUTH_GRANT', 'PROFILE_CHANGE'] },
      });

      return (entries || []).map((entry: any) => this.mapAuditEntryToIAMEvent(entry, tenantId));
    } catch (error: any) {
      cds.log('privilege-escalation').warn(`Failed to query recent auth changes: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if a user has a specific transaction in their behavioral profile.
   */
  private async hasTransactionInProfile(
    tenantId: string,
    userId: string,
    transactionCode: string,
    lookbackDays: number
  ): Promise<boolean> {
    try {
      const db = await cds.connect.to('db');
      const { BehavioralProfiles } = db.entities('finsecure.ai');

      const profile = await SELECT.one.from(BehavioralProfiles).where({
        tenantId,
        userId,
        status: 'ACTIVE',
      });

      if (!profile) {
        return false;
      }

      // Check if the transaction code is in the profile's known transaction codes
      const transactionCodes: string[] = typeof profile.transactionCodes === 'string'
        ? JSON.parse(profile.transactionCodes)
        : (profile.transactionCodes || []);

      return transactionCodes.includes(transactionCode);
    } catch (error: any) {
      cds.log('privilege-escalation').warn(`Failed to check transaction profile: ${error.message}`);
      // If we can't verify the profile, assume no match (safer approach)
      return false;
    }
  }

  /**
   * Get all active (non-revoked) firefighter access records for a tenant.
   */
  private async getActiveFirefighterRecords(tenantId: string): Promise<FirefighterAccessRecord[]> {
    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      // Find firefighter activations that haven't been deactivated
      const activations = await SELECT.from(AuditTrailEntries).where({
        tenantId,
        action: 'FIREFIGHTER_ACTIVATION',
        outcome: 'SUCCESS',
      });

      const deactivations = await SELECT.from(AuditTrailEntries).where({
        tenantId,
        action: { in: ['FIREFIGHTER_DEACTIVATION', 'FIREFIGHTER_REVOKED'] },
        outcome: 'SUCCESS',
      });

      const deactivatedUsers = new Set(
        (deactivations || []).map((d: any) => `${d.userId}-${d.affectedObject}`)
      );

      return (activations || [])
        .filter((a: any) => !deactivatedUsers.has(`${a.userId}-${a.affectedObject}`))
        .map((a: any) => ({
          userId: a.userId,
          tenantId,
          activatedAt: new Date(a.timestamp),
          maxDurationHours: this.config.maxFirefighterHours,
          revoked: false,
        }));
    } catch (error: any) {
      cds.log('privilege-escalation').warn(`Failed to query firefighter records: ${error.message}`);
      return [];
    }
  }

  /**
   * Get all overdue temporary access grants for a tenant.
   */
  private async getOverdueTemporaryGrants(tenantId: string): Promise<TemporaryAccessGrant[]> {
    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      const now = new Date();

      // Find temporary grants that have expired
      const grants = await SELECT.from(AuditTrailEntries).where({
        tenantId,
        action: 'TEMPORARY_ACCESS_GRANT',
        outcome: 'SUCCESS',
      });

      const revocations = await SELECT.from(AuditTrailEntries).where({
        tenantId,
        action: { in: ['TEMPORARY_ACCESS_REVOKED', 'ROLE_REMOVAL'] },
        outcome: 'SUCCESS',
      });

      const revokedKeys = new Set(
        (revocations || []).map((r: any) => `${r.userId}-${r.affectedObject}`)
      );

      return (grants || [])
        .filter((g: any) => {
          const details = typeof g.details === 'string' ? JSON.parse(g.details) : (g.details || {});
          const expiryDate = details.expiryDate ? new Date(details.expiryDate) : null;
          const isExpired = expiryDate && expiryDate < now;
          const isNotRevoked = !revokedKeys.has(`${g.userId}-${g.affectedObject}`);
          return isExpired && isNotRevoked;
        })
        .map((g: any) => {
          const details = typeof g.details === 'string' ? JSON.parse(g.details) : (g.details || {});
          return {
            userId: g.userId,
            tenantId,
            roleId: g.affectedObject || details.roleId || 'unknown',
            grantedAt: new Date(g.timestamp),
            expiryDate: new Date(details.expiryDate),
            revoked: false,
          };
        });
    } catch (error: any) {
      cds.log('privilege-escalation').warn(`Failed to query temporary grants: ${error.message}`);
      return [];
    }
  }

  /**
   * Record a firefighter access activation for future monitoring.
   */
  private async recordFirefighterActivation(
    event: IAMEvent,
    config: PrivilegeEscalationConfig
  ): Promise<void> {
    const logger = cds.log('privilege-escalation');

    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      // Record the activation in audit trail for monitoring
      await INSERT.into(AuditTrailEntries).entries({
        ID: `FF-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        tenantId: event.tenantId,
        userId: event.userId,
        action: 'FIREFIGHTER_ACTIVATION',
        affectedObject: event.userId,
        timestamp: event.timestamp.toISOString(),
        sourceIP: 'system',
        outcome: 'SUCCESS',
        details: JSON.stringify({
          maxDurationHours: config.maxFirefighterHours,
          activatedBy: event.performedBy,
          systemId: event.systemId,
        }),
      });

      logger.info(
        `Recorded firefighter activation for user ${event.userId}. ` +
        `Max duration: ${config.maxFirefighterHours}h`
      );
    } catch (error: any) {
      logger.error(`Failed to record firefighter activation: ${error.message}`);
    }
  }

  /**
   * Map an audit trail entry to an IAMEvent structure.
   */
  private mapAuditEntryToIAMEvent(entry: any, tenantId: string): IAMEvent {
    const details = typeof entry.details === 'string'
      ? JSON.parse(entry.details)
      : (entry.details || {});

    // Map action to IAMEventType
    const eventTypeMap: Record<string, IAMEventType> = {
      'ROLE_ASSIGNMENT': 'ROLE_ASSIGNMENT',
      'ROLE_REMOVAL': 'ROLE_REMOVAL',
      'PROFILE_CHANGE': 'PROFILE_CHANGE',
      'CRITICAL_AUTH_GRANT': 'CRITICAL_AUTH_GRANT',
      'AUTH_CHANGE': 'PROFILE_CHANGE',
      'SU01_EXECUTE': 'PROFILE_CHANGE',
      'PFCG_EXECUTE': 'ROLE_ASSIGNMENT',
      'FIREFIGHTER_ACTIVATION': 'FIREFIGHTER_ACTIVATION',
      'FIREFIGHTER_OVERDUE': 'FIREFIGHTER_OVERDUE',
      'TEMPORARY_ACCESS_EXPIRED': 'TEMPORARY_ACCESS_EXPIRED',
    };

    return {
      eventId: entry.ID || `EVT-${Date.now()}`,
      tenantId,
      eventType: eventTypeMap[entry.action] || 'PROFILE_CHANGE',
      userId: entry.userId,
      performedBy: details.performedBy || entry.userId,
      systemId: details.systemId || 'unknown',
      details: { ...details, transactionCode: details.transactionCode || entry.action?.split('_')[0] },
      timestamp: new Date(entry.timestamp),
    };
  }
}
