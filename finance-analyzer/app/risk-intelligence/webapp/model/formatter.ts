/**
 * Formatting utilities for the Risk Intelligence Dashboard.
 * Provides formatters for risk scores, priorities, dates, and chart granularity.
 */
const formatter = {
  /**
   * Returns a semantic color state based on risk score value (0-100).
   * Critical: >= 80, Warning: >= 50, Success: < 50
   */
  riskScoreState(riskScore: number): string {
    if (riskScore >= 80) {
      return "Error";
    } else if (riskScore >= 50) {
      return "Warning";
    }
    return "Success";
  },

  /**
   * Returns a color for the risk posture radial chart.
   * Red: >= 70, Orange: >= 40, Green: < 40
   */
  riskPostureColor(score: number): string {
    if (score >= 70) {
      return "Error";
    } else if (score >= 40) {
      return "Critical";
    }
    return "Good";
  },

  /**
   * Returns a human-readable priority label.
   */
  priorityText(priority: string): string {
    const map: Record<string, string> = {
      CRITICAL: "Critical",
      HIGH: "High",
      MEDIUM: "Medium",
      LOW: "Low"
    };
    return map[priority] || priority;
  },

  /**
   * Returns a semantic state for alert priority.
   */
  priorityState(priority: string): string {
    const map: Record<string, string> = {
      CRITICAL: "Error",
      HIGH: "Warning",
      MEDIUM: "None",
      LOW: "Success"
    };
    return map[priority] || "None";
  },

  /**
   * Formats a number with thousand separators.
   */
  formatCount(count: number): string {
    if (count === undefined || count === null) {
      return "0";
    }
    return count.toLocaleString();
  },

  /**
   * Returns chart granularity label based on the date range in days.
   * Daily granularity for periods <= 90 days, weekly for > 90 days.
   */
  chartGranularity(days: number): string {
    return days <= 90 ? "Daily" : "Weekly";
  },

  /**
   * Determines the time dimension unit for time-series charts.
   * Returns "day" for <= 90 days range, "week" for > 90 days.
   */
  timeDimensionUnit(dateRangeDays: number): string {
    return dateRangeDays <= 90 ? "day" : "week";
  },

  /**
   * Returns a user-friendly date range label.
   */
  dateRangeLabel(days: number): string {
    if (days <= 1) return "Last 24 hours";
    if (days <= 7) return "Last 7 days";
    if (days <= 30) return "Last 30 days";
    if (days <= 90) return "Last 90 days";
    if (days <= 180) return "Last 6 months";
    return "Last 12 months";
  },

  /**
   * Formats a compliance status percentage.
   */
  complianceStatusText(passCount: number, totalCount: number): string {
    if (!totalCount) return "N/A";
    const percentage = Math.round((passCount / totalCount) * 100);
    return `${percentage}%`;
  },

  /**
   * Returns semantic state for compliance percentage.
   */
  complianceState(passCount: number, totalCount: number): string {
    if (!totalCount) return "None";
    const percentage = (passCount / totalCount) * 100;
    if (percentage >= 95) return "Success";
    if (percentage >= 80) return "Warning";
    return "Error";
  },

  /**
   * Formats error message for component failure display.
   */
  componentErrorText(componentName: string, error: string): string {
    return `Unable to load ${componentName}. ${error || "Please try again later."}`;
  }
};

export default formatter;
