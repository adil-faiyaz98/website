/**
 * Formatter utilities for Alerts & Investigations UI
 * @namespace finsecure.ai.alertsinvestigations.model
 */
export default {
  /**
   * Returns the semantic color state for alert priority
   * CRITICAL = Error (red), HIGH = Warning (orange), MEDIUM = None, LOW = Success (green)
   */
  priorityState(priority: string): string {
    switch (priority) {
      case "CRITICAL":
        return "Error";
      case "HIGH":
        return "Warning";
      case "MEDIUM":
        return "None";
      case "LOW":
        return "Success";
      default:
        return "None";
    }
  },

  /**
   * Returns icon for alert priority
   */
  priorityIcon(priority: string): string {
    switch (priority) {
      case "CRITICAL":
        return "sap-icon://error";
      case "HIGH":
        return "sap-icon://warning";
      case "MEDIUM":
        return "sap-icon://information";
      case "LOW":
        return "sap-icon://hint";
      default:
        return "sap-icon://question-mark";
    }
  },

  /**
   * Returns SLA status color based on deadline proximity
   * Green: >24h remaining, Yellow: 4-24h remaining, Red: <4h or overdue
   */
  slaStatus(slaDeadline: string): string {
    if (!slaDeadline) {
      return "None";
    }
    const deadline = new Date(slaDeadline).getTime();
    const now = Date.now();
    const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

    if (hoursRemaining < 0) {
      return "Error"; // Overdue
    } else if (hoursRemaining < 4) {
      return "Error"; // Critical - less than 4 hours
    } else if (hoursRemaining < 24) {
      return "Warning"; // Warning - less than 24 hours
    } else {
      return "Success"; // On track
    }
  },

  /**
   * Returns human-readable SLA countdown text
   */
  slaCountdown(slaDeadline: string): string {
    if (!slaDeadline) {
      return "No SLA";
    }
    const deadline = new Date(slaDeadline).getTime();
    const now = Date.now();
    const diffMs = deadline - now;

    if (diffMs < 0) {
      const overdueHours = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
      return `Overdue by ${overdueHours}h`;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  },

  /**
   * Returns display label for investigation/alert status
   */
  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      OPEN: "Open",
      IN_PROGRESS: "In Progress",
      ESCALATED: "Escalated",
      RESOLVED_TRUE_POSITIVE: "Resolved (True Positive)",
      RESOLVED_FALSE_POSITIVE: "Resolved (False Positive)"
    };
    return labels[status] || status;
  },

  /**
   * Returns semantic state for investigation/alert status
   */
  statusState(status: string): string {
    switch (status) {
      case "OPEN":
        return "Information";
      case "IN_PROGRESS":
        return "Warning";
      case "ESCALATED":
        return "Error";
      case "RESOLVED_TRUE_POSITIVE":
        return "Success";
      case "RESOLVED_FALSE_POSITIVE":
        return "Success";
      default:
        return "None";
    }
  },

  /**
   * Returns icon for workflow states
   */
  stateIcon(status: string): string {
    switch (status) {
      case "OPEN":
        return "sap-icon://inbox";
      case "IN_PROGRESS":
        return "sap-icon://activity-individual";
      case "ESCALATED":
        return "sap-icon://warning2";
      case "RESOLVED_TRUE_POSITIVE":
        return "sap-icon://accept";
      case "RESOLVED_FALSE_POSITIVE":
        return "sap-icon://decline";
      default:
        return "sap-icon://question-mark";
    }
  },

  /**
   * Returns the age bucket label for alert age
   */
  ageBucket(createdAt: string): string {
    if (!createdAt) {
      return "Unknown";
    }
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const hoursOld = (now - created) / (1000 * 60 * 60);

    if (hoursOld < 1) {
      return "< 1 hour";
    } else if (hoursOld < 4) {
      return "1-4 hours";
    } else if (hoursOld < 24) {
      return "4-24 hours";
    } else if (hoursOld < 72) {
      return "1-3 days";
    } else {
      return "> 3 days";
    }
  },

  /**
   * Returns display text for review decision
   */
  reviewDecisionLabel(decision: string): string {
    const labels: Record<string, string> = {
      APPROVE: "Approved",
      REVOKE: "Revoked",
      FLAG_FOR_REVIEW: "Flagged for Review"
    };
    return labels[decision] || decision || "Pending";
  },

  /**
   * Returns semantic state for review decision
   */
  reviewDecisionState(decision: string): string {
    switch (decision) {
      case "APPROVE":
        return "Success";
      case "REVOKE":
        return "Error";
      case "FLAG_FOR_REVIEW":
        return "Warning";
      default:
        return "None";
    }
  },

  /**
   * Returns completion rate as formatted percentage
   */
  completionRateText(rate: number): string {
    if (rate === null || rate === undefined) {
      return "0%";
    }
    return `${rate.toFixed(1)}%`;
  },

  /**
   * Returns semantic state for campaign status
   */
  campaignStatusState(status: string): string {
    switch (status) {
      case "ACTIVE":
        return "Information";
      case "COMPLETED":
        return "Success";
      case "OVERDUE":
        return "Error";
      default:
        return "None";
    }
  },

  /**
   * Format risk score with visual indicator
   */
  riskScoreText(score: number): string {
    if (score === null || score === undefined) {
      return "N/A";
    }
    return `${score}/100`;
  },

  /**
   * Returns semantic state for risk score value
   */
  riskScoreState(score: number): string {
    if (score >= 80) {
      return "Error";
    } else if (score >= 60) {
      return "Warning";
    } else if (score >= 40) {
      return "None";
    } else {
      return "Success";
    }
  }
};
