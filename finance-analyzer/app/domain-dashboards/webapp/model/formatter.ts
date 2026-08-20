/**
 * Formatter utilities for domain dashboard views.
 * Provides formatting functions for risk indicators, severity, dates, and metrics.
 */
export default {
  /**
   * Returns ValueState based on risk score thresholds.
   * Red >= 80, Orange >= 60, Yellow >= 40, else Green.
   */
  riskScoreState(riskScore: number): string {
    if (riskScore >= 80) return "Error";
    if (riskScore >= 60) return "Warning";
    if (riskScore >= 40) return "Information";
    return "Success";
  },

  /**
   * Returns color indicator for risk score in hex.
   */
  riskScoreColor(riskScore: number): string {
    if (riskScore >= 80) return "#BB0000";
    if (riskScore >= 60) return "#E78C07";
    if (riskScore >= 40) return "#F0AB00";
    return "#2B7C2B";
  },

  /**
   * Returns severity icon based on severity level.
   */
  severityIcon(severity: string): string {
    switch (severity?.toUpperCase()) {
      case "CRITICAL": return "sap-icon://error";
      case "HIGH": return "sap-icon://warning2";
      case "MEDIUM": return "sap-icon://alert";
      case "LOW": return "sap-icon://information";
      default: return "sap-icon://question-mark";
    }
  },

  /**
   * Returns ValueState for severity.
   */
  severityState(severity: string): string {
    switch (severity?.toUpperCase()) {
      case "CRITICAL": return "Error";
      case "HIGH": return "Warning";
      case "MEDIUM": return "Information";
      case "LOW": return "Success";
      default: return "None";
    }
  },

  /**
   * Formats a compliance percentage value.
   */
  compliancePercentage(pass: number, fail: number, warning: number): string {
    const total = pass + fail + warning;
    if (total === 0) return "N/A";
    const percentage = (pass / total) * 100;
    return `${percentage.toFixed(1)}%`;
  },

  /**
   * Returns ValueState for compliance percentage.
   */
  compliancePercentageState(pass: number, fail: number, warning: number): string {
    const total = pass + fail + warning;
    if (total === 0) return "None";
    const percentage = (pass / total) * 100;
    if (percentage >= 90) return "Success";
    if (percentage >= 70) return "Warning";
    return "Error";
  },

  /**
   * Formats throughput as events/sec string.
   */
  throughputFormat(value: number): string {
    if (value === null || value === undefined) return "—";
    return `${value.toFixed(1)} events/sec`;
  },

  /**
   * Formats latency in milliseconds.
   */
  latencyFormat(value: number): string {
    if (value === null || value === undefined) return "—";
    return `${value} ms`;
  },

  /**
   * Formats a threat score (0-100) with risk label.
   */
  threatScoreLabel(score: number): string {
    if (score >= 80) return `${score} - Critical`;
    if (score >= 60) return `${score} - High`;
    if (score >= 40) return `${score} - Medium`;
    return `${score} - Low`;
  },

  /**
   * Returns ValueState for back-pressure status.
   */
  backPressureState(active: boolean): string {
    return active ? "Error" : "Success";
  },

  /**
   * Formats back-pressure status text.
   */
  backPressureText(active: boolean): string {
    return active ? "Active" : "Normal";
  },

  /**
   * Formats timestamp to locale date/time string.
   */
  dateTimeFormat(timestamp: string): string {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return date.toLocaleString();
  },

  /**
   * Formats a vulnerability lifecycle status with icon text.
   */
  vulnerabilityLifecycleText(lifecycle: string): string {
    switch (lifecycle?.toUpperCase()) {
      case "OPEN": return "Open";
      case "ACKNOWLEDGED": return "Acknowledged";
      case "IN_REMEDIATION": return "In Remediation";
      case "RESOLVED": return "Resolved";
      case "RISK_ACCEPTED": return "Risk Accepted";
      default: return lifecycle || "Unknown";
    }
  },

  /**
   * Returns the percentage as a number for progress indicators.
   */
  percentValue(numerator: number, denominator: number): number {
    if (!denominator || denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
  },

  /**
   * Formats DLQ depth with appropriate warning text.
   */
  dlqDepthText(depth: number): string {
    if (depth === 0) return "Empty";
    if (depth > 100) return `${depth} (Critical)`;
    if (depth > 10) return `${depth} (Warning)`;
    return `${depth}`;
  },

  /**
   * Returns ValueState for DLQ depth.
   */
  dlqDepthState(depth: number): string {
    if (depth === 0) return "Success";
    if (depth > 100) return "Error";
    if (depth > 10) return "Warning";
    return "Information";
  },

  /**
   * Returns ValueState for connected system status.
   * Used in EventProcessingHealth view for system health indicators.
   */
  systemStatusState(status: string): string {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
      case "CONNECTED":
      case "HEALTHY":
        return "Success";
      case "DEGRADED":
      case "WARNING":
        return "Warning";
      case "ERROR":
      case "DISCONNECTED":
      case "DOWN":
        return "Error";
      default:
        return "None";
    }
  }
};
