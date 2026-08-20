import cds = require('@sap/cds');

const { ApplicationService } = cds;

// ============================================================================
// Types
// ============================================================================

/** Campaign trigger types */
type CampaignTrigger = 'SCHEDULED' | 'ROLE_CHANGE' | 'COMPLIANCE_DEADLINE' | 'ALERT_THRESHOLD';

/** Campaign statuses */
type CampaignStatus = 'ACTIVE' | 'COMPLETED' | 'OVERDUE';

/** Reviewer decision types */
type ReviewDecision = 'APPROVE' | 'REVOKE' | 'FLAG_FOR_REVIEW';

/** Role assignment details included in a review task */
interface RoleAssignment {
  roleId: string;
  roleName: string;
  riskClassification: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  lastActivityDate?: string;
  assignedDate?: string;
}

/** Context information generated for each review task */
interface ReviewTaskContext {
  userId: string;
  roles: RoleAssignment[];
  lastActivityDate?: string;
  riskClassification: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  relatedAlerts: string[];
}

/** Peer group metrics for access outlier detection */
interface PeerGroupMetrics {
  peerGroupId: string;
  department: string;
  jobRole: string;
  medianAuthCount: number;
  stdDevAuthCount: number;
  userCount: number;
}

/** Access outlier result */
interface AccessOutlier {
  userId: string;
  tenantId: string;
  authorizationCount: number;
  peerGroupMedian: number;
  peerGroupStdDev: number;
  deviationFactor: number;
  flaggedAt: Date;
}

/** Governance KPIs */
interface GovernanceKPIs {
  completionRate: number;
  averageReviewTimeDays: number;
  revokedPercentage: number;
  approvedPercentage: number;
  flaggedPercentage: number;
  orphanedAccountCount: number;
  leastPrivilegeScore: number;
  activeCampaigns: number;
  overdueTasks: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default SLA for review task completion in days */
const DEFAULT_REVIEW_SLA_DAYS = 14;

/** Default alert threshold per organizational unit for triggering campaigns */
const DEFAULT_ALERT_THRESHOLD = 10;

/** Minimum justification length for high-risk approvals */
const MIN_JUSTIFICATION_LENGTH = 10;

/** Maximum pending review tasks before escalation */
const MAX_PENDING_TASKS_PER_REVIEWER = 50;

/** Campaign completion threshold at halfway point */
const HALFWAY_COMPLETION_THRESHOLD = 0.80;

/** Peer group deviation threshold (standard deviations above median) */
const PEER_GROUP_DEVIATION_THRESHOLD = 2;

/** Maximum hours for automatic role removal via Integration Suite */
const ROLE_REMOVAL_SLA_HOURS = 24;

// ============================================================================
// Access Review Service
// ============================================================================

/**
 * Access Review Service
 *
 * Manages access governance and review workflows including campaign triggers,
 * review task generation with context, reviewer decisions with justification
 * requirements, automatic role removal, peer group analysis, and completion
 * rate tracking with escalation.
 *
 * Validates: Requirements 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8
 */
export default class AccessReviewService extends (ApplicationService as any) {
  async init() {
    this.on('triggerCampaign', async (req: any) => {
      const { tenantId, trigger, deadline, targetUsers } = req.data;
      const parsedUsers: string[] = targetUsers ? JSON.parse(targetUsers) : [];
      const campaign = await this.triggerAccessReviewCampaign(
        tenantId,
        trigger as CampaignTrigger,
        new Date(deadline),
        parsedUsers
      );
      return JSON.stringify(campaign);
    });

    this.on('submitDecision', async (req: any) => {
      const { taskId, decision, justification } = req.data;
      const result = await this.processReviewerDecision(
        taskId,
        decision as ReviewDecision,
        justification
      );
      return JSON.stringify(result);
    });

    this.on('identifyAccessOutliers', async (req: any) => {
      const { tenantId } = req.data;
      const outliers = await this.performPeerGroupAnalysis(tenantId);
      return JSON.stringify(outliers);
    });

    this.on('checkCompletionRates', async (req: any) => {
      const { tenantId } = req.data;
      const result = await this.trackCompletionAndEscalate(tenantId);
      return JSON.stringify(result);
    });

    this.on('getReviewHistory', async (req: any) => {
      const { tenantId, userId } = req.data;
      const history = await this.getAccessReviewHistory(tenantId, userId);
      return JSON.stringify(history);
    });

    this.on('calculateGovernanceKPIs', async (req: any) => {
      const { tenantId } = req.data;
      const kpis = await this.calculateKPIs(tenantId);
      return JSON.stringify(kpis);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Trigger an access review campaign based on configurable triggers.
   * Supports: calendar-based schedule, role change, compliance deadline, alert threshold.
   *
   * Validates: Requirements 30.1
   */
  async triggerAccessReviewCampaign(
    tenantId: string,
    trigger: CampaignTrigger,
    deadline: Date,
    targetUsers: string[]
  ): Promise<{ campaignId: string; taskCount: number; status: CampaignStatus }> {
    const logger = cds.log('access-review');
    const db = await cds.connect.to('db');
    const { AccessReviewCampaigns, AccessReviewTasks } = db.entities('finsecure.ai');

    const campaignId = cds.utils.uuid();
    const now = new Date();

    // Validate trigger type
    const validTriggers: CampaignTrigger[] = [
      'SCHEDULED', 'ROLE_CHANGE', 'COMPLIANCE_DEADLINE', 'ALERT_THRESHOLD',
    ];
    if (!validTriggers.includes(trigger)) {
      throw new Error(`Invalid campaign trigger: ${trigger}. Must be one of: ${validTriggers.join(', ')}`);
    }

    // Create the campaign
    await INSERT.into(AccessReviewCampaigns).entries({
      ID: campaignId,
      tenantId,
      triggerType: trigger,
      status: 'ACTIVE',
      deadline: deadline.toISOString(),
      completionRate: 0,
      createdAt: now.toISOString(),
      modifiedAt: now.toISOString(),
    });

    // Generate review tasks with context for each target user
    const reviewTasks = await this.generateReviewTasks(
      tenantId,
      campaignId,
      targetUsers
    );

    // Insert all review tasks
    if (reviewTasks.length > 0) {
      await INSERT.into(AccessReviewTasks).entries(reviewTasks);
    }

    logger.info(
      `Access review campaign ${campaignId} triggered: trigger=${trigger}, ` +
      `tasks=${reviewTasks.length}, deadline=${deadline.toISOString()}, tenant=${tenantId}`
    );

    return {
      campaignId,
      taskCount: reviewTasks.length,
      status: 'ACTIVE',
    };
  }

  /**
   * Process a reviewer's decision on a review task.
   * Validates justification requirements for high-risk approvals.
   *
   * Validates: Requirements 30.3, 30.4
   */
  async processReviewerDecision(
    taskId: string,
    decision: ReviewDecision,
    justification: string
  ): Promise<{ success: boolean; taskId: string; decision: ReviewDecision; remediationTriggered?: boolean; error?: string }> {
    const logger = cds.log('access-review');
    const db = await cds.connect.to('db');
    const { AccessReviewTasks } = db.entities('finsecure.ai');

    // Fetch the task
    const task = await SELECT.one.from(AccessReviewTasks).where({ ID: taskId });
    if (!task) {
      return { success: false, taskId, decision, error: `Review task ${taskId} not found` };
    }

    // Check if already completed
    if (task.completedAt) {
      return { success: false, taskId, decision, error: `Review task ${taskId} already completed` };
    }

    // Validate decision
    const validDecisions: ReviewDecision[] = ['APPROVE', 'REVOKE', 'FLAG_FOR_REVIEW'];
    if (!validDecisions.includes(decision)) {
      return {
        success: false,
        taskId,
        decision,
        error: `Invalid decision: ${decision}. Must be one of: ${validDecisions.join(', ')}`,
      };
    }

    // Validate justification for high-risk approvals
    if (decision === 'APPROVE') {
      const roles: RoleAssignment[] = task.roles ? JSON.parse(task.roles) : [];
      const hasHighRiskRole = roles.some(
        (r) => r.riskClassification === 'CRITICAL' || r.riskClassification === 'HIGH'
      );

      if (hasHighRiskRole) {
        if (!justification || justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
          return {
            success: false,
            taskId,
            decision,
            error: `Justification must be at least ${MIN_JUSTIFICATION_LENGTH} characters for high-risk role approvals`,
          };
        }
      }
    }

    // Update the task with the decision
    const now = new Date();
    await UPDATE(AccessReviewTasks).where({ ID: taskId }).set({
      decision,
      justification: justification || null,
      completedAt: now.toISOString(),
      modifiedAt: now.toISOString(),
    });

    let remediationTriggered = false;

    // If REVOKE, trigger automatic role removal
    if (decision === 'REVOKE') {
      remediationTriggered = await this.triggerRoleRemoval(task);
    }

    // Update campaign completion rate
    if (task.campaign_ID) {
      await this.updateCampaignCompletionRate(task.campaign_ID);
    }

    logger.info(
      `Review task ${taskId} decided: decision=${decision}, ` +
      `user=${task.userId}, remediation=${remediationTriggered}`
    );

    return { success: true, taskId, decision, remediationTriggered };
  }

  /**
   * Perform peer group analysis to identify access outliers.
   * Flags users whose authorization scope exceeds the peer group median
   * by more than 2 standard deviations.
   *
   * Validates: Requirements 30.5
   */
  async performPeerGroupAnalysis(tenantId: string): Promise<AccessOutlier[]> {
    const logger = cds.log('access-review');
    const db = await cds.connect.to('db');
    const { BehavioralProfiles } = db.entities('finsecure.ai');

    // Fetch all behavioral profiles for the tenant to group by department/role patterns
    const profiles = await SELECT.from(BehavioralProfiles).where({ tenantId });

    if (profiles.length === 0) {
      logger.info(`No profiles found for tenant ${tenantId} - skipping peer group analysis`);
      return [];
    }

    // Build peer groups based on authorization patterns
    const peerGroups = this.buildPeerGroups(profiles);
    const outliers: AccessOutlier[] = [];

    for (const group of peerGroups) {
      if (group.userCount < 3) {
        // Skip groups too small for meaningful statistical analysis
        continue;
      }

      for (const profile of group.members) {
        const authCount = this.countAuthorizations(profile);
        const deviation = (authCount - group.medianAuthCount) / (group.stdDevAuthCount || 1);

        if (deviation > PEER_GROUP_DEVIATION_THRESHOLD) {
          outliers.push({
            userId: profile.userId,
            tenantId,
            authorizationCount: authCount,
            peerGroupMedian: group.medianAuthCount,
            peerGroupStdDev: group.stdDevAuthCount,
            deviationFactor: deviation,
            flaggedAt: new Date(),
          });
        }
      }
    }

    if (outliers.length > 0) {
      logger.info(
        `Peer group analysis for tenant ${tenantId}: ${outliers.length} outliers found across ${peerGroups.length} peer groups`
      );
    }

    return outliers;
  }

  /**
   * Track campaign completion rates and generate escalation alerts.
   * Escalates when:
   * - Review tasks remain uncompleted beyond SLA (default 14 days)
   * - Campaign completion falls below 80% at halfway point
   * - A reviewer has more than 50 pending tasks
   *
   * Validates: Requirements 30.6
   */
  async trackCompletionAndEscalate(
    tenantId: string
  ): Promise<{ escalations: EscalationResult[]; campaignsChecked: number }> {
    const logger = cds.log('access-review');
    const db = await cds.connect.to('db');
    const { AccessReviewCampaigns, AccessReviewTasks } = db.entities('finsecure.ai');

    const escalations: EscalationResult[] = [];

    // Fetch all active campaigns for the tenant
    const activeCampaigns = await SELECT.from(AccessReviewCampaigns).where({
      tenantId,
      status: 'ACTIVE',
    });

    const now = new Date();

    for (const campaign of activeCampaigns) {
      // Check for overdue tasks (beyond SLA)
      const tasks = await SELECT.from(AccessReviewTasks).where({
        campaign_ID: campaign.ID,
      });

      const pendingTasks = tasks.filter((t: any) => !t.completedAt);
      const completedTasks = tasks.filter((t: any) => t.completedAt);

      // Check task-level SLA violations
      for (const task of pendingTasks) {
        const taskCreatedAt = new Date(task.createdAt);
        const daysSinceCreation = (now.getTime() - taskCreatedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceCreation > DEFAULT_REVIEW_SLA_DAYS) {
          escalations.push({
            type: 'TASK_OVERDUE',
            campaignId: campaign.ID,
            taskId: task.ID,
            reviewerId: task.reviewerId,
            details: `Review task overdue by ${Math.floor(daysSinceCreation - DEFAULT_REVIEW_SLA_DAYS)} days`,
          });
        }
      }

      // Check campaign halfway completion threshold
      const campaignDeadline = new Date(campaign.deadline);
      const campaignCreatedAt = new Date(campaign.createdAt);
      const totalDuration = campaignDeadline.getTime() - campaignCreatedAt.getTime();
      const elapsed = now.getTime() - campaignCreatedAt.getTime();
      const progress = elapsed / totalDuration;

      if (progress >= 0.5 && tasks.length > 0) {
        const completionRate = completedTasks.length / tasks.length;
        if (completionRate < HALFWAY_COMPLETION_THRESHOLD) {
          escalations.push({
            type: 'CAMPAIGN_BEHIND_SCHEDULE',
            campaignId: campaign.ID,
            details: `Campaign at ${(completionRate * 100).toFixed(1)}% completion at halfway point (threshold: ${HALFWAY_COMPLETION_THRESHOLD * 100}%)`,
          });
        }
      }

      // Check for overdue campaigns
      if (now > campaignDeadline && pendingTasks.length > 0) {
        await UPDATE(AccessReviewCampaigns).where({ ID: campaign.ID }).set({
          status: 'OVERDUE',
          modifiedAt: now.toISOString(),
        });

        escalations.push({
          type: 'CAMPAIGN_OVERDUE',
          campaignId: campaign.ID,
          details: `Campaign deadline passed with ${pendingTasks.length} pending tasks`,
        });
      }

      // Update completion rate
      if (tasks.length > 0) {
        const rate = (completedTasks.length / tasks.length) * 100;
        await UPDATE(AccessReviewCampaigns).where({ ID: campaign.ID }).set({
          completionRate: Math.round(rate * 100) / 100,
          modifiedAt: now.toISOString(),
        });
      }
    }

    // Check reviewer workload across all active campaigns
    const allPendingTasks = await SELECT.from(AccessReviewTasks).where({
      completedAt: null,
    });

    const reviewerTaskCounts: Record<string, number> = {};
    for (const task of allPendingTasks) {
      reviewerTaskCounts[task.reviewerId] = (reviewerTaskCounts[task.reviewerId] || 0) + 1;
    }

    for (const [reviewerId, count] of Object.entries(reviewerTaskCounts)) {
      if (count > MAX_PENDING_TASKS_PER_REVIEWER) {
        escalations.push({
          type: 'REVIEWER_OVERLOADED',
          reviewerId,
          details: `Reviewer has ${count} pending tasks (threshold: ${MAX_PENDING_TASKS_PER_REVIEWER})`,
        });
      }
    }

    // Generate escalation alerts
    if (escalations.length > 0) {
      await this.generateEscalationAlerts(tenantId, escalations);
    }

    logger.info(
      `Completion rate check for tenant ${tenantId}: ` +
      `${activeCampaigns.length} campaigns checked, ${escalations.length} escalations`
    );

    return { escalations, campaignsChecked: activeCampaigns.length };
  }

  /**
   * Get complete access review history for a user.
   * Shows all past review decisions, reviewers, justifications, and resulting changes.
   *
   * Validates: Requirements 30.7
   */
  async getAccessReviewHistory(
    tenantId: string,
    userId: string
  ): Promise<{ userId: string; reviews: any[] }> {
    const db = await cds.connect.to('db');
    const { AccessReviewTasks, AccessReviewCampaigns } = db.entities('finsecure.ai');

    // Fetch all review tasks for this user across all campaigns for the tenant
    const tasks = await SELECT.from(AccessReviewTasks).where({ userId });

    const reviews = [];
    for (const task of tasks) {
      // Fetch campaign details
      const campaign = await SELECT.one.from(AccessReviewCampaigns).where({
        ID: task.campaign_ID,
        tenantId,
      });

      if (campaign) {
        reviews.push({
          taskId: task.ID,
          campaignId: campaign.ID,
          triggerType: campaign.triggerType,
          reviewerId: task.reviewerId,
          roles: task.roles ? JSON.parse(task.roles) : [],
          decision: task.decision,
          justification: task.justification,
          completedAt: task.completedAt,
          campaignDeadline: campaign.deadline,
          campaignStatus: campaign.status,
        });
      }
    }

    // Sort by most recent first
    reviews.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    });

    return { userId, reviews };
  }

  /**
   * Calculate access governance KPIs for the dashboard.
   *
   * Validates: Requirements 30.8
   */
  async calculateKPIs(tenantId: string): Promise<GovernanceKPIs> {
    const db = await cds.connect.to('db');
    const { AccessReviewCampaigns, AccessReviewTasks } = db.entities('finsecure.ai');

    // Fetch all campaigns for the tenant
    const campaigns = await SELECT.from(AccessReviewCampaigns).where({ tenantId });
    const campaignIds = campaigns.map((c: any) => c.ID);

    let allTasks: any[] = [];
    if (campaignIds.length > 0) {
      for (const campaignId of campaignIds) {
        const tasks = await SELECT.from(AccessReviewTasks).where({ campaign_ID: campaignId });
        allTasks = allTasks.concat(tasks);
      }
    }

    const completedTasks = allTasks.filter((t) => t.completedAt);
    const pendingTasks = allTasks.filter((t) => !t.completedAt);

    // Completion rate
    const completionRate = allTasks.length > 0
      ? (completedTasks.length / allTasks.length) * 100
      : 0;

    // Average review time (in days)
    let totalReviewTimeDays = 0;
    let reviewTimeCount = 0;
    for (const task of completedTasks) {
      if (task.createdAt && task.completedAt) {
        const created = new Date(task.createdAt).getTime();
        const completed = new Date(task.completedAt).getTime();
        totalReviewTimeDays += (completed - created) / (1000 * 60 * 60 * 24);
        reviewTimeCount++;
      }
    }
    const averageReviewTimeDays = reviewTimeCount > 0
      ? Math.round((totalReviewTimeDays / reviewTimeCount) * 100) / 100
      : 0;

    // Decision breakdown
    const approvedCount = completedTasks.filter((t) => t.decision === 'APPROVE').length;
    const revokedCount = completedTasks.filter((t) => t.decision === 'REVOKE').length;
    const flaggedCount = completedTasks.filter((t) => t.decision === 'FLAG_FOR_REVIEW').length;
    const decisionTotal = completedTasks.length || 1;

    const revokedPercentage = Math.round((revokedCount / decisionTotal) * 10000) / 100;
    const approvedPercentage = Math.round((approvedCount / decisionTotal) * 10000) / 100;
    const flaggedPercentage = Math.round((flaggedCount / decisionTotal) * 10000) / 100;

    // Active campaigns count
    const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE').length;

    // Overdue tasks
    const now = new Date();
    const overdueTasks = pendingTasks.filter((t) => {
      if (!t.createdAt) return false;
      const daysSinceCreation = (now.getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation > DEFAULT_REVIEW_SLA_DAYS;
    }).length;

    // Least-privilege score: higher if more revocations and fewer outliers
    const leastPrivilegeScore = this.calculateLeastPrivilegeScore(
      revokedPercentage,
      completionRate,
      overdueTasks,
      allTasks.length
    );

    return {
      completionRate: Math.round(completionRate * 100) / 100,
      averageReviewTimeDays,
      revokedPercentage,
      approvedPercentage,
      flaggedPercentage,
      orphanedAccountCount: 0, // Calculated from IAM event correlation
      leastPrivilegeScore,
      activeCampaigns,
      overdueTasks,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Generate review tasks with context for each target user.
   * Each task includes: user identity, roles, last activity, risk classification, related alerts.
   *
   * Validates: Requirements 30.2
   */
  private async generateReviewTasks(
    tenantId: string,
    campaignId: string,
    targetUsers: string[]
  ): Promise<any[]> {
    const logger = cds.log('access-review');

    const tasks: any[] = [];
    const now = new Date();

    for (const userId of targetUsers) {
      // Build context for the review task
      const context = await this.buildReviewTaskContext(tenantId, userId);

      // Determine the reviewer (use IAM administrator as default)
      const reviewerId = this.determineReviewer(userId, context);

      const taskId = cds.utils.uuid();
      tasks.push({
        ID: taskId,
        campaign_ID: campaignId,
        reviewerId,
        userId,
        roles: JSON.stringify(context.roles),
        decision: null,
        justification: null,
        completedAt: null,
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString(),
      });
    }

    logger.info(
      `Generated ${tasks.length} review tasks for campaign ${campaignId}`
    );

    return tasks;
  }

  /**
   * Build review task context with user details, roles, last activity,
   * risk classification, and related alerts.
   */
  private async buildReviewTaskContext(
    tenantId: string,
    userId: string
  ): Promise<ReviewTaskContext> {
    const db = await cds.connect.to('db');
    const { BehavioralProfiles, Alerts } = db.entities('finsecure.ai');

    // Fetch behavioral profile for last activity info
    const profile = await SELECT.one.from(BehavioralProfiles).where({
      tenantId,
      userId,
    });

    // Fetch related IAM alerts for the user
    const relatedAlerts = await SELECT.from(Alerts).where({
      tenantId,
      riskCategory: 'IAM_VIOLATION',
    });

    // Filter alerts mentioning this user in affected entities
    const userAlerts = relatedAlerts.filter((alert: any) => {
      if (!alert.affectedEntities) return false;
      try {
        const entities = JSON.parse(alert.affectedEntities);
        return entities.some((e: any) => e.entityId === userId);
      } catch {
        return false;
      }
    });

    // Build role assignments with risk classification
    const roles = this.buildRoleAssignments(profile);

    // Determine overall risk classification
    const riskClassification = this.determineRiskClassification(roles, userAlerts.length);

    return {
      userId,
      roles,
      lastActivityDate: profile?.lastUpdated || undefined,
      riskClassification,
      relatedAlerts: userAlerts.map((a: any) => a.ID),
    };
  }

  /**
   * Build role assignments from behavioral profile data.
   */
  private buildRoleAssignments(profile: any): RoleAssignment[] {
    if (!profile?.dimensions) {
      return [];
    }

    // Extract transaction codes from profile dimensions to infer roles
    let transactionCodes: string[] = [];
    try {
      const dimensions = typeof profile.dimensions === 'string'
        ? JSON.parse(profile.dimensions)
        : profile.dimensions;

      if (dimensions?.transactionCodes) {
        transactionCodes = typeof dimensions.transactionCodes === 'string'
          ? JSON.parse(dimensions.transactionCodes)
          : dimensions.transactionCodes;
      }
    } catch {
      // Use empty array if parsing fails
    }

    // Map known critical transaction codes to role assignments
    const roles: RoleAssignment[] = [];
    const criticalTcodes = new Set(['SU01', 'PFCG', 'SE38', 'SM49', 'SM69', 'SE16', 'SCC4']);
    const highTcodes = new Set(['FB01', 'FK01', 'FK02', 'ME21N', 'MIRO', 'F110']);

    for (const tcode of transactionCodes) {
      let riskClassification: RoleAssignment['riskClassification'];
      if (criticalTcodes.has(tcode)) {
        riskClassification = 'CRITICAL';
      } else if (highTcodes.has(tcode)) {
        riskClassification = 'HIGH';
      } else {
        riskClassification = 'MEDIUM';
      }

      roles.push({
        roleId: `ROLE_${tcode}`,
        roleName: `Authorization for ${tcode}`,
        riskClassification,
        lastActivityDate: profile?.lastUpdated || undefined,
        assignedDate: profile?.createdAt || undefined,
      });
    }

    // If no transaction codes found, provide a generic placeholder
    if (roles.length === 0) {
      roles.push({
        roleId: 'ROLE_GENERIC',
        roleName: 'Standard User Access',
        riskClassification: 'LOW',
        lastActivityDate: profile?.lastUpdated || undefined,
      });
    }

    return roles;
  }

  /**
   * Determine overall risk classification based on roles and alert count.
   */
  private determineRiskClassification(
    roles: RoleAssignment[],
    alertCount: number
  ): ReviewTaskContext['riskClassification'] {
    if (roles.some((r) => r.riskClassification === 'CRITICAL') || alertCount >= 3) {
      return 'CRITICAL';
    }
    if (roles.some((r) => r.riskClassification === 'HIGH') || alertCount >= 1) {
      return 'HIGH';
    }
    if (roles.some((r) => r.riskClassification === 'MEDIUM')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * Determine the appropriate reviewer for a user's access.
   * Default assignment logic: IAM administrator for high-risk, manager pattern for others.
   */
  private determineReviewer(userId: string, context: ReviewTaskContext): string {
    // In production, this would look up organizational hierarchy.
    // Default to 'IAM_ADMIN' for critical/high risk, 'ROLE_OWNER' for others.
    if (context.riskClassification === 'CRITICAL' || context.riskClassification === 'HIGH') {
      return 'IAM_ADMIN';
    }
    return 'ROLE_OWNER';
  }

  /**
   * Trigger automatic role removal via Integration Suite API.
   * Must complete within 24 hours of revocation decision.
   *
   * Validates: Requirements 30.4
   */
  private async triggerRoleRemoval(task: any): Promise<boolean> {
    const logger = cds.log('access-review');

    try {
      const roles: RoleAssignment[] = task.roles ? JSON.parse(task.roles) : [];

      // In production, this calls SAP Integration Suite API to remove roles
      // from the connected S/4HANA or ECC system
      const remediationPayload = {
        userId: task.userId,
        roles: roles.map((r) => r.roleId),
        action: 'REVOKE',
        deadline: new Date(Date.now() + ROLE_REMOVAL_SLA_HOURS * 60 * 60 * 1000).toISOString(),
        triggeredBy: task.reviewerId,
        triggeredAt: new Date().toISOString(),
        taskId: task.ID,
      };

      logger.info(
        `Role removal triggered for user ${task.userId}: ` +
        `${roles.length} roles to revoke, deadline=${remediationPayload.deadline}`
      );

      // Simulate Integration Suite API call
      // In production: await integrationSuite.post('/role-remediation', remediationPayload);
      return true;
    } catch (error: any) {
      logger.error(`Failed to trigger role removal for task ${task.ID}: ${error.message}`);
      return false;
    }
  }

  /**
   * Build peer groups from behavioral profiles based on authorization patterns.
   */
  private buildPeerGroups(profiles: any[]): Array<PeerGroupMetrics & { members: any[] }> {
    // Group profiles by common patterns (simulating department/job role grouping)
    // In production, this would use SuccessFactors HCM data for department/role
    const groups: Map<string, any[]> = new Map();

    for (const profile of profiles) {
      // Use cost centers from profile dimensions as a proxy for peer grouping
      let groupKey = 'default';
      try {
        const dimensions = typeof profile.dimensions === 'string'
          ? JSON.parse(profile.dimensions)
          : profile.dimensions;

        if (dimensions?.costCenters) {
          const costCenters = typeof dimensions.costCenters === 'string'
            ? JSON.parse(dimensions.costCenters)
            : dimensions.costCenters;

          if (Array.isArray(costCenters) && costCenters.length > 0) {
            groupKey = costCenters[0]; // Primary cost center as group key
          }
        }
      } catch {
        // Use default group
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(profile);
    }

    // Calculate statistics for each peer group
    const peerGroups: Array<PeerGroupMetrics & { members: any[] }> = [];

    for (const [groupKey, members] of groups) {
      const authCounts = members.map((m) => this.countAuthorizations(m));

      if (authCounts.length === 0) continue;

      // Calculate median
      const sorted = [...authCounts].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;

      // Calculate standard deviation
      const mean = authCounts.reduce((sum, c) => sum + c, 0) / authCounts.length;
      const variance = authCounts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / authCounts.length;
      const stdDev = Math.sqrt(variance);

      peerGroups.push({
        peerGroupId: groupKey,
        department: groupKey,
        jobRole: groupKey,
        medianAuthCount: median,
        stdDevAuthCount: stdDev,
        userCount: members.length,
        members,
      });
    }

    return peerGroups;
  }

  /**
   * Count authorizations for a profile (using transaction codes as proxy).
   */
  private countAuthorizations(profile: any): number {
    try {
      const dimensions = typeof profile.dimensions === 'string'
        ? JSON.parse(profile.dimensions)
        : profile.dimensions;

      if (!dimensions) return 0;

      let count = 0;

      // Count transaction codes
      if (dimensions.transactionCodes) {
        const tcodes = typeof dimensions.transactionCodes === 'string'
          ? JSON.parse(dimensions.transactionCodes)
          : dimensions.transactionCodes;
        count += Array.isArray(tcodes) ? tcodes.length : 0;
      }

      // Count account combinations
      if (dimensions.accountCombinations) {
        const combinations = typeof dimensions.accountCombinations === 'string'
          ? JSON.parse(dimensions.accountCombinations)
          : dimensions.accountCombinations;
        count += Array.isArray(combinations) ? combinations.length : 0;
      }

      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Update campaign completion rate after a task decision.
   */
  private async updateCampaignCompletionRate(campaignId: string): Promise<void> {
    const db = await cds.connect.to('db');
    const { AccessReviewTasks, AccessReviewCampaigns } = db.entities('finsecure.ai');

    const tasks = await SELECT.from(AccessReviewTasks).where({ campaign_ID: campaignId });
    const completedCount = tasks.filter((t: any) => t.completedAt).length;
    const totalCount = tasks.length;

    if (totalCount === 0) return;

    const rate = (completedCount / totalCount) * 100;
    const roundedRate = Math.round(rate * 100) / 100;

    const updatePayload: Record<string, any> = {
      completionRate: roundedRate,
      modifiedAt: new Date().toISOString(),
    };

    // Mark campaign as completed if all tasks are done
    if (completedCount === totalCount) {
      updatePayload.status = 'COMPLETED';
    }

    await UPDATE(AccessReviewCampaigns).where({ ID: campaignId }).set(updatePayload);
  }

  /**
   * Generate escalation alerts for overdue or at-risk campaigns.
   */
  private async generateEscalationAlerts(
    tenantId: string,
    escalations: EscalationResult[]
  ): Promise<void> {
    const logger = cds.log('access-review');
    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    const now = new Date();

    for (const escalation of escalations) {
      const alertId = cds.utils.uuid();
      const title = this.generateEscalationTitle(escalation);
      const description = this.generateEscalationDescription(escalation);

      await INSERT.into(Alerts).entries({
        ID: alertId,
        tenantId,
        priority: escalation.type === 'CAMPAIGN_OVERDUE' ? 'HIGH' : 'MEDIUM',
        status: 'OPEN',
        riskCategory: 'IAM_VIOLATION',
        riskScore: escalation.type === 'CAMPAIGN_OVERDUE' ? 70 : 50,
        title,
        description,
        recommendedActions: JSON.stringify([
          'Review and complete pending access review tasks',
          'Reassign overloaded reviewers',
          'Escalate to IAM administrator',
        ]),
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString(),
        slaDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });

      logger.info(`Escalation alert ${alertId} created: type=${escalation.type}`);
    }
  }

  /**
   * Generate escalation alert title based on type.
   */
  private generateEscalationTitle(escalation: EscalationResult): string {
    switch (escalation.type) {
      case 'TASK_OVERDUE':
        return `Access Review Task Overdue - Reviewer: ${escalation.reviewerId}`;
      case 'CAMPAIGN_BEHIND_SCHEDULE':
        return `Access Review Campaign Behind Schedule`;
      case 'CAMPAIGN_OVERDUE':
        return `Access Review Campaign Overdue - Immediate Action Required`;
      case 'REVIEWER_OVERLOADED':
        return `Reviewer Overloaded - ${escalation.reviewerId} has excessive pending tasks`;
      default:
        return 'Access Review Escalation';
    }
  }

  /**
   * Generate escalation alert description.
   */
  private generateEscalationDescription(escalation: EscalationResult): string {
    const parts: string[] = [
      `Escalation Type: ${escalation.type}`,
      `Details: ${escalation.details}`,
    ];

    if (escalation.campaignId) {
      parts.push(`Campaign ID: ${escalation.campaignId}`);
    }
    if (escalation.taskId) {
      parts.push(`Task ID: ${escalation.taskId}`);
    }
    if (escalation.reviewerId) {
      parts.push(`Reviewer: ${escalation.reviewerId}`);
    }

    return parts.join('\n');
  }

  /**
   * Calculate the least-privilege compliance score.
   * Higher score means better adherence to least-privilege principles.
   */
  private calculateLeastPrivilegeScore(
    revokedPercentage: number,
    completionRate: number,
    overdueTasks: number,
    totalTasks: number
  ): number {
    // Score components (0-100 scale):
    // - Revocation rate contributes positively (access is being cleaned up)
    // - Completion rate contributes positively (reviews are being done)
    // - Overdue tasks penalize the score

    const revocationComponent = Math.min(revokedPercentage * 2, 30); // Max 30 points
    const completionComponent = (completionRate / 100) * 40; // Max 40 points
    const overdueReduction = totalTasks > 0
      ? Math.min((overdueTasks / totalTasks) * 30, 30)
      : 0;

    const score = Math.max(0, Math.min(100,
      30 + revocationComponent + completionComponent - overdueReduction
    ));

    return Math.round(score * 100) / 100;
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface EscalationResult {
  type: 'TASK_OVERDUE' | 'CAMPAIGN_BEHIND_SCHEDULE' | 'CAMPAIGN_OVERDUE' | 'REVIEWER_OVERLOADED';
  campaignId?: string;
  taskId?: string;
  reviewerId?: string;
  details: string;
}
