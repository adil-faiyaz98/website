using { finsecure.ai as db } from '../../db/schema';

/**
 * Alert Manager Service
 * Creates, prioritizes, delivers, and manages alert lifecycle.
 * Handles risk event classification, multi-channel delivery,
 * state machine transitions, SLA escalation, and AI-powered clustering.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.6, 9.7, 9.8
 */
service AlertManagerService @(requires: 'system-user') {

  /** Alerts entity for lifecycle management */
  entity Alerts as projection on db.Alerts;
  entity Investigations as projection on db.Investigations;
  entity Tenants as projection on db.Tenants;
  entity TenantThresholds as projection on db.TenantThresholds;

  /**
   * Create an alert from a risk event with priority classification.
   * Delivers within 60 seconds of generation.
   */
  action createAlert(
    riskEventId       : String(36),
    tenantId          : String(36),
    transactionId     : String(36),
    riskCategory      : String(30),
    riskScore         : Integer,
    confidence        : Integer,
    detectionMethod   : String(25),
    riskIndicators    : LargeString,
    affectedEntities  : LargeString,
    financialExposure : Decimal(23,2),
    title             : String(500),
    description       : LargeString
  ) returns LargeString;

  /**
   * Transition alert state with validation.
   * Rejects invalid transitions per the state machine.
   */
  action transitionState(
    alertId     : String(36),
    targetState : String(25),
    userId      : String(12),
    notes       : LargeString
  ) returns LargeString;

  /**
   * Check SLA escalation for all open critical alerts.
   * Auto-escalates alerts exceeding configured SLA duration.
   */
  action checkSLAEscalation(
    tenantId : String(36)
  ) returns LargeString;

  /**
   * AI-powered clustering of related alerts.
   * Groups alerts by affected entities, risk category, and temporal proximity.
   */
  action clusterRelatedAlerts(
    tenantId : String(36),
    alertId  : String(36)
  ) returns String;
}
