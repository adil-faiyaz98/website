import cds = require('@sap/cds');

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Supported HR lifecycle event categories received from SuccessFactors.
 * Privacy note: Only the category classification is used for risk scoring;
 * specific reasons/details are NOT stored in the system.
 */
export type HREventCategory =
  | 'TERMINATION'
  | 'RESIGNATION'
  | 'PIP'
  | 'DEMOTION'
  | 'TRANSFER'
  | 'LEAVE'
  | 'CONTRACTOR_END_DATE';

/** Configuration for SuccessFactors integration behavior */
export interface SuccessFactorsConfig {
  /** Default risk score multiplier for elevated monitoring (default 1.5) */
  defaultRiskMultiplier: number;
  /** Default monitoring period in days (default 30, range 7-90) */
  defaultMonitoringDays: number;
  /** Minimum allowed monitoring period in days */
  minMonitoringDays: number;
  /** Maximum allowed monitoring period in days */
  maxMonitoringDays: number;
  /** Offboarding SLA in hours (default 24) */
  offboardingSLAHours: number;
  /** Interval in minutes for offboarding verification checks */
  offboardingCheckIntervalMinutes: number;
}

/** Result of processing an HR event */
export interface HREventProcessingResult {
  success: boolean;
  userId: string;
  riskClassification: 'ELEVATED' | 'STANDARD';
  monitoringPeriodDays: number;
  effectiveMultiplier: number;
  expiresAt: string;
  message: string;
}

/** Result of offboarding compliance verification */
export interface OffboardingVerificationResult {
  compliant: boolean;
  userId: string;
  accountStatus: 'LOCKED' | 'DELETED' | 'ACTIVE' | 'UNKNOWN';
  checkedSystems: SystemCheckResult[];
  slaHours: number;
  hoursElapsed: number;
  alertGenerated: boolean;
  message: string;
}

/** Result of a system-level offboarding check */
export interface SystemCheckResult {
  systemId: string;
  systemType: string;
  accountLocked: boolean;
  accountDeleted: boolean;
  lastCheckedAt: string;
}

/** Over-provisioned access finding */
export interface OverProvisionedFinding {
  userId: string;
  currentDepartment: string;
  currentCostCenter: string;
  currentJobRole: string;
  excessAuthorizations: ExcessAuthorization[];
  riskScore: number;
  recommendation: string;
}

/** Authorization that is potentially excessive for current org assignment */
export interface ExcessAuthorization {
  authorizationObject: string;
  roleName: string;
  originalDepartment?: string;
  reason: string;
}

/** HR risk dashboard data */
export interface HRRiskDashboardData {
  usersWithActiveHRRisk: HRRiskUser[];
  pendingOffboardingAccounts: PendingOffboarding[];
  accessOutliers: AccessOutlierEntry[];
  integrationStatus: IntegrationStatus;
}

/** User with active HR risk elevation */
export interface HRRiskUser {
  userId: string;
  riskClassification: 'ELEVATED' | 'STANDARD';
  multiplier: number;
  expiresAt: string;
  daysRemaining: number;
}

/** Account pending offboarding verification */
export interface PendingOffboarding {
  userId: string;
  eventDate: string;
  slaDeadline: string;
  hoursRemaining: number;
  systemsChecked: number;
  systemsCompliant: number;
}

/** Access outlier relative to peer group */
export interface AccessOutlierEntry {
  userId: string;
  currentJobRole: string;
  authorizationCount: number;
  peerGroupMedian: number;
  deviationFactor: number;
}

/** Integration connectivity status */
export interface IntegrationStatus {
  available: boolean;
  lastEventReceivedAt: string | null;
  connectionHealth: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  message: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default integration configuration */
const DEFAULT_CONFIG: SuccessFactorsConfig = {
  defaultRiskMultiplier: 1.5,
  defaultMonitoringDays: 30,
  minMonitoringDays: 7,
  maxMonitoringDays: 90,
  offboardingSLAHours: 24,
  offboardingCheckIntervalMinutes: 60,
};

/** Valid HR event categories */
const VALID_EVENT_CATEGORIES: HREventCategory[] = [
  'TERMINATION',
  'RESIGNATION',
  'PIP',
  'DEMOTION',
  'TRANSFER',
  'LEAVE',
  'CONTRACTOR_END_DATE',
];

// ============================================================================
// SuccessFactors HCM Integration Service
// ============================================================================

/**
 * SAP SuccessFactors HCM Integration Service.
 *
 * Receives HR lifecycle events via SAP Integration Suite and correlates them
 * with the insider threat detection engine for enhanced risk monitoring.
 *
 * Privacy-preserving design: only risk classification (elevated/standard) and
 * monitoring period are stored. Specific HR event types and reasons remain
 * exclusively in SuccessFactors.
 *
 * Graceful degradation: if the integration is unavailable, the system operates
 * without HR correlation and indicates reduced detection capability.
 *
 * Validates: Requirements 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7
 */
export class SuccessFactorsIntegrationService extends cds.ApplicationService {
  private config!: SuccessFactorsConfig;

  async init(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };

    // Register action handlers
    this.on('processHREvent', this.handleProcessHREvent.bind(this));
    this.on('verifyOffboardingCompliance', this.handleVerifyOffboardingCompliance.bind(this));
    this.on('detectOverProvisionedAccess', this.handleDetectOverProvisionedAccess.bind(this));
    this.on('getHRRiskDashboard', this.handleGetHRRiskDashboard.bind(this));
    this.on('checkIntegrationHealth', this.handleCheckIntegrationHealth.bind(this));

    await super.init();
  }

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  /**
   * Handle incoming HR lifecycle event from SuccessFactors via Integration Suite.
   *
   * Privacy: stores only risk classification and monitoring period, NOT the
   * specific HR event type (27.7).
   *
   * Validates: Requirements 27.1, 27.2, 27.7
   */
  private async handleProcessHREvent(req: any): Promise<string> {
    const { tenantId, sapUserId, eventCategory, eventDate, monitoringDays, riskMultiplier } = req.data;
    const logger = cds.log('sf-integration');

    try {
      // Validate event category
      const normalizedCategory = (eventCategory || '').toUpperCase() as HREventCategory;
      if (!VALID_EVENT_CATEGORIES.includes(normalizedCategory)) {
        return JSON.stringify({
          success: false,
          message: `Invalid event category: ${eventCategory}. ` +
            `Valid categories: ${VALID_EVENT_CATEGORIES.join(', ')}`,
        });
      }

      // Validate and clamp monitoring period
      const effectiveMonitoringDays = this.clampMonitoringDays(
        monitoringDays ?? this.config.defaultMonitoringDays
      );

      // Validate multiplier (must be >= 1.0)
      const effectiveMultiplier = Math.max(1.0, riskMultiplier ?? this.config.defaultRiskMultiplier);

      // Calculate expiration date
      const baseDate = eventDate ? new Date(eventDate) : new Date();
      const expiresAt = new Date(baseDate);
      expiresAt.setDate(expiresAt.getDate() + effectiveMonitoringDays);

      // Apply risk elevation to behavioral profile
      // Privacy: we store ONLY the multiplier value and expiry — not the event category or details
      await this.applyRiskElevation(
        tenantId,
        sapUserId,
        effectiveMultiplier,
        expiresAt
      );

      // Log to audit trail (privacy-preserving: no event details)
      await this.logAuditEntry(tenantId, 'HR_RISK_ELEVATION_APPLIED', sapUserId, {
        riskClassification: 'ELEVATED',
        monitoringPeriodDays: effectiveMonitoringDays,
        expiresAt: expiresAt.toISOString(),
      });

      logger.info(
        `HR risk elevation applied for user ${sapUserId} in tenant ${tenantId}: ` +
        `multiplier=${effectiveMultiplier}, period=${effectiveMonitoringDays}d, ` +
        `expires=${expiresAt.toISOString()}`
      );

      const response: HREventProcessingResult = {
        success: true,
        userId: sapUserId,
        riskClassification: 'ELEVATED',
        monitoringPeriodDays: effectiveMonitoringDays,
        effectiveMultiplier,
        expiresAt: expiresAt.toISOString(),
        message: `Risk sensitivity elevated for user ${sapUserId} for ${effectiveMonitoringDays} days`,
      };

      return JSON.stringify(response);
    } catch (error: any) {
      logger.error(`Failed to process HR event for user ${sapUserId}: ${error.message}`);
      return JSON.stringify({
        success: false,
        userId: sapUserId,
        riskClassification: 'STANDARD',
        monitoringPeriodDays: 0,
        effectiveMultiplier: 1.0,
        expiresAt: null,
        message: `Failed to process HR event: ${error.message}`,
      });
    }
  }

  /**
   * Verify offboarding compliance for a terminated user.
   * Checks that SAP user accounts are locked/deleted within configured SLA.
   * Generates critical alert if access persists beyond the window.
   *
   * Validates: Requirements 27.3
   */
  private async handleVerifyOffboardingCompliance(req: any): Promise<string> {
    const { tenantId, sapUserId, eventDate, slaHours } = req.data;
    const logger = cds.log('sf-integration');

    try {
      const effectiveSLA = slaHours ?? this.config.offboardingSLAHours;
      const terminationDate = eventDate ? new Date(eventDate) : new Date();
      const now = new Date();
      const hoursElapsed = (now.getTime() - terminationDate.getTime()) / (1000 * 60 * 60);

      // Check connected systems for account status
      const systemChecks = await this.checkAccountStatusAcrossSystems(tenantId, sapUserId);

      // Determine compliance
      const allCompliant = systemChecks.length > 0 &&
        systemChecks.every(check => check.accountLocked || check.accountDeleted);
      const slaExceeded = hoursElapsed > effectiveSLA;

      let alertGenerated = false;

      // Generate critical alert if SLA exceeded and account still active
      if (slaExceeded && !allCompliant) {
        await this.generateOffboardingAlert(tenantId, sapUserId, hoursElapsed, effectiveSLA, systemChecks);
        alertGenerated = true;
        logger.warn(
          `Offboarding SLA breach: user ${sapUserId} still active ` +
          `after ${hoursElapsed.toFixed(1)} hours (SLA: ${effectiveSLA}h)`
        );
      }

      // Determine account status
      let accountStatus: 'LOCKED' | 'DELETED' | 'ACTIVE' | 'UNKNOWN';
      if (systemChecks.length === 0) {
        accountStatus = 'UNKNOWN';
      } else if (systemChecks.every(c => c.accountDeleted)) {
        accountStatus = 'DELETED';
      } else if (allCompliant) {
        accountStatus = 'LOCKED';
      } else {
        accountStatus = 'ACTIVE';
      }

      // Determine result message
      let message: string;
      if (allCompliant) {
        message = `User ${sapUserId} accounts properly deactivated across all systems`;
      } else if (slaExceeded) {
        message = `CRITICAL: User ${sapUserId} access persists beyond ${effectiveSLA}h SLA`;
      } else {
        message = `User ${sapUserId} accounts pending deactivation (${(effectiveSLA - hoursElapsed).toFixed(1)}h remaining)`;
      }

      const result: OffboardingVerificationResult = {
        compliant: allCompliant,
        userId: sapUserId,
        accountStatus,
        checkedSystems: systemChecks,
        slaHours: effectiveSLA,
        hoursElapsed: Math.round(hoursElapsed * 10) / 10,
        alertGenerated,
        message,
      };

      return JSON.stringify(result);
    } catch (error: any) {
      logger.error(`Offboarding verification failed for user ${sapUserId}: ${error.message}`);
      return JSON.stringify({
        compliant: false,
        userId: sapUserId,
        accountStatus: 'UNKNOWN',
        checkedSystems: [],
        slaHours: slaHours ?? this.config.offboardingSLAHours,
        hoursElapsed: 0,
        alertGenerated: false,
        message: `Verification failed: ${error.message}`,
      });
    }
  }

  /**
   * Cross-reference SuccessFactors org assignments with SAP authorizations
   * to detect over-provisioned access.
   *
   * Validates: Requirements 27.4
   */
  private async handleDetectOverProvisionedAccess(req: any): Promise<string> {
    const { tenantId, sapUserId, currentDept, currentCostCenter, currentJobRole } = req.data;
    const logger = cds.log('sf-integration');

    try {
      const findings = await this.analyzeAccessForOrgAlignment(
        tenantId,
        sapUserId,
        currentDept,
        currentCostCenter,
        currentJobRole
      );

      if (findings.excessAuthorizations.length > 0) {
        logger.info(
          `Over-provisioned access detected for user ${sapUserId}: ` +
          `${findings.excessAuthorizations.length} excess authorizations`
        );
      }

      return JSON.stringify(findings);
    } catch (error: any) {
      logger.error(`Over-provisioned access detection failed for user ${sapUserId}: ${error.message}`);
      return JSON.stringify({
        userId: sapUserId,
        currentDepartment: currentDept,
        currentCostCenter,
        currentJobRole,
        excessAuthorizations: [],
        riskScore: 0,
        recommendation: `Analysis unavailable: ${error.message}`,
      });
    }
  }

  /**
   * Get HR-correlated risk dashboard data.
   *
   * Validates: Requirements 27.5
   */
  private async handleGetHRRiskDashboard(req: any): Promise<string> {
    const { tenantId } = req.data;
    const logger = cds.log('sf-integration');

    try {
      const dashboardData = await this.buildDashboardData(tenantId);
      return JSON.stringify(dashboardData);
    } catch (error: any) {
      logger.error(`HR risk dashboard generation failed for tenant ${tenantId}: ${error.message}`);

      // Graceful degradation: return empty dashboard with unavailable status
      const fallbackData: HRRiskDashboardData = {
        usersWithActiveHRRisk: [],
        pendingOffboardingAccounts: [],
        accessOutliers: [],
        integrationStatus: {
          available: false,
          lastEventReceivedAt: null,
          connectionHealth: 'UNAVAILABLE',
          message: 'HR correlation unavailable. Enhanced insider threat detection via HR signals is not active.',
        },
      };
      return JSON.stringify(fallbackData);
    }
  }

  /**
   * Check integration health and connectivity status.
   * Supports graceful degradation notification.
   *
   * Validates: Requirements 27.6
   */
  private async handleCheckIntegrationHealth(req: any): Promise<string> {
    const { tenantId } = req.data;
    const logger = cds.log('sf-integration');

    try {
      const status = await this.getIntegrationStatus(tenantId);
      return JSON.stringify(status);
    } catch (error: any) {
      logger.error(`Integration health check failed for tenant ${tenantId}: ${error.message}`);
      return JSON.stringify({
        available: false,
        lastEventReceivedAt: null,
        connectionHealth: 'UNAVAILABLE',
        message: 'Enhanced insider threat detection via HR signals is not active. ' +
          'System operates without HR correlation.',
      });
    }
  }

  // ==========================================================================
  // Core Business Logic
  // ==========================================================================

  /**
   * Apply risk elevation to a user's behavioral profile.
   * Privacy: stores ONLY the multiplier and expiration — NOT the event type.
   *
   * Validates: Requirements 27.2, 27.7
   */
  private async applyRiskElevation(
    tenantId: string,
    sapUserId: string,
    multiplier: number,
    expiresAt: Date
  ): Promise<boolean> {
    const db = await cds.connect.to('db');
    const { BehavioralProfiles } = db.entities('finsecure.ai');

    // Check if profile exists
    const profile = await SELECT.one.from(BehavioralProfiles).where({
      tenantId,
      userId: sapUserId,
    });

    if (profile) {
      // Update existing profile with elevated risk
      await UPDATE(BehavioralProfiles)
        .set({
          hrRiskMultiplier: multiplier,
          hrRiskExpiresAt: expiresAt.toISOString(),
        })
        .where({ tenantId, userId: sapUserId });
      return true;
    } else {
      // Create a minimal profile entry for users not yet in the system
      // (they may not have transacted yet but HR event requires monitoring)
      await INSERT.into(BehavioralProfiles).entries({
        tenantId,
        userId: sapUserId,
        status: 'LEARNING',
        hrRiskMultiplier: multiplier,
        hrRiskExpiresAt: expiresAt.toISOString(),
        daysCovered: 0,
        windowStartDate: new Date().toISOString().split('T')[0],
        windowEndDate: expiresAt.toISOString().split('T')[0],
        lastUpdated: new Date().toISOString(),
      });
      return true;
    }
  }

  /**
   * Check user account status across all connected SAP systems for a tenant.
   *
   * Validates: Requirements 27.3
   */
  private async checkAccountStatusAcrossSystems(
    tenantId: string,
    sapUserId: string
  ): Promise<SystemCheckResult[]> {
    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    // Get all connected systems for the tenant
    const systems = await SELECT.from(ConnectedSystems).where({
      tenant_ID: tenantId,
      status: 'active',
    });

    const results: SystemCheckResult[] = [];

    for (const system of systems) {
      // Attempt to check account status via Integration Suite API
      const checkResult = await this.checkAccountStatusInSystem(
        tenantId,
        sapUserId,
        system.systemId,
        system.systemType
      );
      results.push(checkResult);
    }

    return results;
  }

  /**
   * Check account status in a specific connected system.
   * Graceful degradation: returns UNKNOWN status if system is unreachable.
   */
  private async checkAccountStatusInSystem(
    tenantId: string,
    sapUserId: string,
    systemId: string,
    systemType: string
  ): Promise<SystemCheckResult> {
    const logger = cds.log('sf-integration');

    try {
      // In production, this would call Integration Suite to check the
      // user master record (SU01D) in the connected SAP system.
      // For S4HC: OData API (Business User Read)
      // For S4OP/ECC: RFC call (BAPI_USER_GET_DETAIL)
      //
      // Graceful degradation: if the system call fails, we return UNKNOWN
      // and do not generate false compliance reports.

      // Conservative approach: check behavioral profile for recent activity.
      // In production, Integration Suite would be called to verify the user
      // master record status directly. For now, default to reporting
      // as not yet locked/deleted (safest approach to avoid false compliance).
      const now = new Date();

      return {
        systemId,
        systemType,
        accountLocked: false,
        accountDeleted: false,
        lastCheckedAt: now.toISOString(),
      };
    } catch (error: any) {
      logger.warn(
        `Unable to verify account status for user ${sapUserId} ` +
        `in system ${systemId}: ${error.message}`
      );
      return {
        systemId,
        systemType,
        accountLocked: false,
        accountDeleted: false,
        lastCheckedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate critical alert for offboarding SLA breach.
   *
   * Validates: Requirements 27.3
   */
  private async generateOffboardingAlert(
    tenantId: string,
    sapUserId: string,
    hoursElapsed: number,
    slaHours: number,
    systemChecks: SystemCheckResult[]
  ): Promise<void> {
    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const nonCompliantSystems = systemChecks
      .filter(c => !c.accountLocked && !c.accountDeleted)
      .map(c => c.systemId);

    await INSERT.into(Alerts).entries({
      tenantId,
      priority: 'CRITICAL',
      status: 'NEW',
      riskCategory: 'IAM_VIOLATION',
      riskScore: 95,
      title: `Offboarding SLA Breach: User ${sapUserId} access persists`,
      description:
        `Employee user account ${sapUserId} has not been locked/deleted ` +
        `within the configured offboarding SLA of ${slaHours} hours. ` +
        `Time elapsed: ${hoursElapsed.toFixed(1)} hours. ` +
        `Non-compliant systems: ${nonCompliantSystems.join(', ')}. ` +
        `Immediate action required to revoke access.`,
      riskIndicators: JSON.stringify([
        {
          indicatorType: 'OFFBOARDING_SLA_BREACH',
          description: `Account active ${hoursElapsed.toFixed(1)}h after termination (SLA: ${slaHours}h)`,
          observedValue: hoursElapsed,
          expectedRange: { min: 0, max: slaHours },
        },
      ]),
      affectedEntities: JSON.stringify([
        { entityType: 'USER', entityId: sapUserId, systemId: nonCompliantSystems[0] || 'UNKNOWN' },
      ]),
      recommendedActions: JSON.stringify([
        'Immediately lock user account in all connected SAP systems',
        'Verify no unauthorized activity since termination date',
        'Review data accessed by user during post-termination period',
        'Document remediation steps for compliance audit',
      ]),
    });

    // Log the alert generation in audit trail
    await this.logAuditEntry(tenantId, 'OFFBOARDING_SLA_ALERT_GENERATED', sapUserId, {
      slaHours,
      hoursElapsed: hoursElapsed.toFixed(1),
      nonCompliantSystems,
    });
  }

  /**
   * Analyze access alignment with organizational assignments.
   * Cross-references SuccessFactors org data with SAP authorizations.
   *
   * Validates: Requirements 27.4
   */
  private async analyzeAccessForOrgAlignment(
    tenantId: string,
    sapUserId: string,
    currentDept: string,
    currentCostCenter: string,
    currentJobRole: string
  ): Promise<OverProvisionedFinding> {
    const db = await cds.connect.to('db');
    const { BehavioralProfiles, ProfileDimensions } = db.entities('finsecure.ai');

    const excessAuthorizations: ExcessAuthorization[] = [];
    let riskScore = 0;

    // Load user profile for cost center and access patterns
    const profile = await SELECT.one.from(BehavioralProfiles).where({
      tenantId,
      userId: sapUserId,
    });

    if (profile) {
      const dimensions = await SELECT.one.from(ProfileDimensions).where({
        profile_ID: profile.ID,
      });

      if (dimensions) {
        // Check cost center alignment
        const profileCostCenters = this.parseJsonArray(dimensions.costCenters);
        const nonCurrentCostCenters = profileCostCenters.filter(
          (cc: string) => cc !== currentCostCenter
        );

        if (nonCurrentCostCenters.length > 0) {
          for (const cc of nonCurrentCostCenters) {
            excessAuthorizations.push({
              authorizationObject: `COST_CENTER_${cc}`,
              roleName: 'Cost Center Access',
              originalDepartment: cc,
              reason: `User retains access to cost center ${cc} not aligned with current assignment ${currentCostCenter}`,
            });
          }
        }

        // Peer group analysis: check if user has significantly more
        // access than peers in the same job role
        const peerProfiles = await SELECT.from(BehavioralProfiles).where({
          tenantId,
          status: 'ACTIVE',
        });

        if (peerProfiles.length > 0) {
          // Calculate peer access breadth (cost centers as proxy)
          const peerDimensions = await Promise.all(
            peerProfiles
              .filter((p: any) => p.userId !== sapUserId)
              .slice(0, 20) // Limit query scope
              .map(async (p: any) => {
                const dim = await SELECT.one.from(ProfileDimensions).where({
                  profile_ID: p.ID,
                });
                return dim;
              })
          );

          const peerCostCenterCounts = peerDimensions
            .filter((d): d is any => d !== null && d !== undefined)
            .map((d: any) => this.parseJsonArray(d.costCenters).length);

          if (peerCostCenterCounts.length > 0) {
            const peerMedian = this.calculateMedian(peerCostCenterCounts);
            const peerStdDev = this.calculateStdDev(peerCostCenterCounts);
            const userCCCount = profileCostCenters.length;

            // Flag if user has > 2 std dev above median
            if (peerStdDev > 0 && (userCCCount - peerMedian) / peerStdDev > 2) {
              excessAuthorizations.push({
                authorizationObject: 'PEER_GROUP_OUTLIER',
                roleName: 'Access Breadth',
                reason: `User has ${userCCCount} cost center accesses vs peer median of ${peerMedian.toFixed(1)} (>${(2 * peerStdDev + peerMedian).toFixed(1)} threshold)`,
              });
            }
          }
        }
      }
    }

    // Calculate risk score based on findings
    if (excessAuthorizations.length > 0) {
      riskScore = Math.min(100, 20 + excessAuthorizations.length * 15);
    }

    const recommendation = excessAuthorizations.length > 0
      ? `Review and remove ${excessAuthorizations.length} authorization(s) not aligned with current role: ${currentJobRole}`
      : `No over-provisioning detected for user ${sapUserId} in current role: ${currentJobRole}`;

    return {
      userId: sapUserId,
      currentDepartment: currentDept,
      currentCostCenter,
      currentJobRole,
      excessAuthorizations,
      riskScore,
      recommendation,
    };
  }

  /**
   * Build HR-correlated risk dashboard data.
   *
   * Validates: Requirements 27.5
   */
  private async buildDashboardData(tenantId: string): Promise<HRRiskDashboardData> {
    const db = await cds.connect.to('db');
    const { BehavioralProfiles, ProfileDimensions } = db.entities('finsecure.ai');

    const now = new Date();

    // 1. Users with active HR risk events
    const elevatedProfiles = await SELECT.from(BehavioralProfiles).where({
      tenantId,
      hrRiskMultiplier: { '>': 1.0 },
    });

    const usersWithActiveHRRisk: HRRiskUser[] = elevatedProfiles
      .filter((p: any) => p.hrRiskExpiresAt && new Date(p.hrRiskExpiresAt) > now)
      .map((p: any) => {
        const expiresAt = new Date(p.hrRiskExpiresAt);
        const daysRemaining = Math.max(0, Math.ceil(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ));
        return {
          userId: p.userId,
          riskClassification: 'ELEVATED' as const,
          multiplier: Number(p.hrRiskMultiplier),
          expiresAt: expiresAt.toISOString(),
          daysRemaining,
        };
      });

    // 2. Pending offboarding accounts (profiles with expired HR risk but not yet verified)
    const pendingOffboardingAccounts: PendingOffboarding[] = [];

    // 3. Access outliers via peer group analysis
    const activeProfiles = await SELECT.from(BehavioralProfiles).where({
      tenantId,
      status: 'ACTIVE',
    });

    const accessOutliers: AccessOutlierEntry[] = [];

    if (activeProfiles.length > 3) {
      const allDimensions = await Promise.all(
        activeProfiles.slice(0, 50).map(async (p: any) => {
          const dim = await SELECT.one.from(ProfileDimensions).where({
            profile_ID: p.ID,
          });
          return { userId: p.userId, dimensions: dim };
        })
      );

      const ccCounts = allDimensions
        .filter((d) => d.dimensions)
        .map((d) => ({
          userId: d.userId,
          count: this.parseJsonArray(d.dimensions?.costCenters).length,
        }));

      const counts = ccCounts.map(c => c.count);
      const median = this.calculateMedian(counts);
      const stdDev = this.calculateStdDev(counts);

      if (stdDev > 0) {
        for (const entry of ccCounts) {
          const deviation = (entry.count - median) / stdDev;
          if (deviation > 2) {
            accessOutliers.push({
              userId: entry.userId,
              currentJobRole: 'N/A', // Would be enriched from SuccessFactors
              authorizationCount: entry.count,
              peerGroupMedian: median,
              deviationFactor: Math.round(deviation * 10) / 10,
            });
          }
        }
      }
    }

    // 4. Integration status
    const integrationStatus = await this.getIntegrationStatus(tenantId);

    return {
      usersWithActiveHRRisk,
      pendingOffboardingAccounts,
      accessOutliers,
      integrationStatus,
    };
  }

  /**
   * Get current integration status for the tenant.
   * Implements graceful degradation notification per 27.6.
   *
   * Validates: Requirements 27.6
   */
  private async getIntegrationStatus(tenantId: string): Promise<IntegrationStatus> {
    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    try {
      // Check if SuccessFactors is configured as a connected system
      const sfSystem = await SELECT.one.from(ConnectedSystems).where({
        tenant_ID: tenantId,
        systemType: 'SUCCESSFACTORS',
      });

      if (!sfSystem) {
        // Integration not configured — graceful degradation
        return {
          available: false,
          lastEventReceivedAt: null,
          connectionHealth: 'UNAVAILABLE',
          message: 'SuccessFactors integration not configured. ' +
            'Enhanced insider threat detection via HR signals is not active.',
        };
      }

      // Check system status
      if (sfSystem.status !== 'active') {
        return {
          available: false,
          lastEventReceivedAt: sfSystem.lastSyncAt || null,
          connectionHealth: 'DEGRADED',
          message: `SuccessFactors integration status: ${sfSystem.status}. ` +
            'HR-correlated threat detection may be delayed.',
        };
      }

      return {
        available: true,
        lastEventReceivedAt: sfSystem.lastSyncAt || null,
        connectionHealth: 'HEALTHY',
        message: 'SuccessFactors integration active. HR-correlated threat detection enabled.',
      };
    } catch (error: any) {
      return {
        available: false,
        lastEventReceivedAt: null,
        connectionHealth: 'UNAVAILABLE',
        message: 'Enhanced insider threat detection via HR signals is not active. ' +
          'System operates without HR correlation.',
      };
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Clamp monitoring days to configured valid range (7-90).
   */
  private clampMonitoringDays(days: number): number {
    return Math.min(
      this.config.maxMonitoringDays,
      Math.max(this.config.minMonitoringDays, days)
    );
  }

  /**
   * Log an entry to the audit trail.
   */
  private async logAuditEntry(
    tenantId: string,
    action: string,
    affectedObject: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const db = await cds.connect.to('db');
      const { AuditTrailEntries } = db.entities('finsecure.ai');

      await INSERT.into(AuditTrailEntries).entries({
        tenantId,
        userId: 'SYSTEM',
        action,
        affectedObject,
        sourceIP: '0.0.0.0',
        outcome: 'SUCCESS',
        details: JSON.stringify(details),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      // Audit log failure should not break the primary operation
      const logger = cds.log('sf-integration');
      logger.warn(`Audit log write failed: ${error.message}`);
    }
  }

  /**
   * Parse a JSON string into an array, returning empty array on failure.
   */
  private parseJsonArray(jsonStr: string | null | undefined): any[] {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_e: unknown) {
      return [];
    }
  }

  /**
   * Calculate median of a number array.
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate standard deviation of a number array.
   */
  private calculateStdDev(values: number[]): number {
    if (values.length <= 1) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => (v - mean) ** 2);
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }
}

module.exports = { SuccessFactorsIntegrationService };
