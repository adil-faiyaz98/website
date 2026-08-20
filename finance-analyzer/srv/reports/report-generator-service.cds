using { finsecure.ai as db } from '../../db/schema';

/**
 * Report Generator Service
 * Generates, signs, exports, and schedules reports.
 * Supports PDF with digital signature and CSV for data analysis.
 * Enforces timing constraints based on reporting period length.
 *
 * Report types: risk_summary, compliance, fraud_detection, sod_violations,
 *   investigation_evidence, access_review, executive_briefing, vulnerability
 *
 * Timing: <= 60s for <= 12 months, <= 5 min for > 12 months, max 24 months
 * Max file size: 500 MB
 * Schedule: daily/weekly/monthly, max 50 recipients
 * Retry: once after 15 minutes on failure
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7
 */
service ReportGeneratorService @(requires: 'system-user') {

  /** Report entities for persistence */
  entity ScheduledReports as projection on db.ScheduledReports;
  entity GeneratedReports as projection on db.GeneratedReports;
  entity Investigations as projection on db.Investigations;
  entity InvestigationNotes as projection on db.InvestigationNotes;
  entity EvidenceItems as projection on db.EvidenceItems;
  entity Alerts as projection on db.Alerts;
  entity AuditTrailEntries as projection on db.AuditTrailEntries;

  /**
   * Generate a report with digital signature.
   * Enforces timing: <= 60s for <= 12 months, <= 5 min for > 12 months, max 24 months.
   * Max file size: 500 MB.
   */
  action generateReport(
    tenantId    : String(36),
    reportType  : String(30),
    periodStart : Date,
    periodEnd   : Date,
    format      : String(5),
    framework   : String(30)
  ) returns LargeString;

  /**
   * Schedule a recurring report with configurable frequency.
   * Max 50 recipients per schedule.
   */
  action scheduleReport(
    tenantId    : String(36),
    reportType  : String(30),
    frequency   : String(10),
    recipients  : LargeString,
    framework   : String(30)
  ) returns LargeString;

  /**
   * Export an investigation evidence package as a signed PDF.
   * Contains: triggering transaction, alert details, investigation notes,
   *   resolution, and all related audit trail entries.
   */
  action exportEvidencePackage(
    investigationId : String(36)
  ) returns LargeString;

  /**
   * Apply digital signature to report content with ISO 8601 timestamp.
   */
  action signReport(
    tenantId  : String(36),
    reportId  : String(36)
  ) returns LargeString;

  /**
   * Execute scheduled report generation with retry logic.
   * Retry once after 15 minutes on failure.
   */
  action executeScheduledReport(
    scheduleId : String(36)
  ) returns LargeString;
}
