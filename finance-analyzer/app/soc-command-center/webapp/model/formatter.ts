/**
 * Formatter utilities for the SOC Command Center Dashboard.
 * Provides formatting for KPI values, system status indicators,
 * timestamps, and alert severity levels.
 */
export default {
  /**
   * Format Mean Time to Detect (MTTD) in human-readable format.
   * @param minutes - Time in minutes
   * @returns Formatted string (e.g., "2h 15m" or "45m")
   */
  formatMTTD(minutes: number): string {
    if (!minutes && minutes !== 0) return "N/A";
    if (minutes < 1) return "<1m";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  },

  /**
   * Format Mean Time to Respond (MTTR) in human-readable format.
   * @param minutes - Time in minutes
   * @returns Formatted string (e.g., "1d 4h" or "3h 30m")
   */
  formatMTTR(minutes: number): string {
    if (!minutes && minutes !== 0) return "N/A";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.round((minutes % 1440) / 60);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  },

  /**
   * Format percentage values for KPI display.
   * @param value - Percentage value (0-100)
   * @returns Formatted percentage string
   */
  formatPercentage(value: number): string {
    if (value === null || value === undefined) return "N/A";
    return `${value.toFixed(1)}%`;
  },

  /**
   * Get system status color based on risk level.
   * Green = healthy, Yellow = degraded, Orange = at-risk, Red = critical
   * @param status - System status string
   * @returns SAP UI5 ValueState or hex color
   */
  getSystemStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case "green":
      case "healthy":
        return "Good";
      case "yellow":
      case "degraded":
        return "Warning";
      case "orange":
      case "at-risk":
        return "Critical";
      case "red":
      case "critical":
        return "Error";
      default:
        return "None";
    }
  },

  /**
   * Get hex color for system node visualization.
   * @param status - System status string
   * @returns Hex color code
   */
  getSystemNodeColor(status: string): string {
    switch (status?.toLowerCase()) {
      case "green":
      case "healthy":
        return "#2b7c2b";
      case "yellow":
      case "degraded":
        return "#e6a400";
      case "orange":
      case "at-risk":
        return "#e87500";
      case "red":
      case "critical":
        return "#cc1919";
      default:
        return "#6a6d70";
    }
  },

  /**
   * Format alert severity for display.
   * @param severity - Alert severity level
   * @returns Icon and state information
   */
  formatAlertSeverity(severity: string): string {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "sap-icon://alert";
      case "high":
        return "sap-icon://warning2";
      case "medium":
        return "sap-icon://notification";
      case "low":
        return "sap-icon://information";
      default:
        return "sap-icon://question-mark";
    }
  },

  /**
   * Format timestamp to relative time (e.g., "2 minutes ago").
   * @param timestamp - ISO timestamp string
   * @returns Relative time string
   */
  formatRelativeTime(timestamp: string): string {
    if (!timestamp) return "";
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  },

  /**
   * Format alert volume with K/M suffix for large numbers.
   * @param count - Alert count
   * @returns Formatted string
   */
  formatAlertVolume(count: number): string {
    if (count === null || count === undefined) return "0";
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  },

  /**
   * Get role display name from role ID.
   * @param roleId - BTP role identifier
   * @returns Human-readable role name
   */
  getRoleDisplayName(roleId: string): string {
    const roleMap: Record<string, string> = {
      "SecurityAnalyst": "SOC Analyst",
      "SecurityAdmin": "Security Admin",
      "IAMAdmin": "IAM Administrator",
      "Auditor": "Compliance Officer",
      "Executive": "CISO Executive"
    };
    return roleMap[roleId] || roleId;
  },

  /**
   * Determine KPI trend indicator.
   * @param current - Current value
   * @param previous - Previous period value
   * @returns "Up", "Down", or "Stable"
   */
  getKPITrend(current: number, previous: number): string {
    if (!previous || !current) return "Stable";
    const change = ((current - previous) / previous) * 100;
    if (change > 5) return "Up";
    if (change < -5) return "Down";
    return "Stable";
  }
};
