using { finsecure.ai as db } from '../../db/schema';

/**
 * Investigation Service
 * Manages the investigation workflow with full audit trail.
 * Handles investigation creation from alerts, state machine transitions,
 * resolution recording, AI brief generation, and evidence export.
 *
 * Validates: Requirements 9.4, 9.5, 15.5
 */
service InvestigationService @(requires: 'system-user') {

  /** Investigations entity for lifecycle management */
  entity Investigations as projection on db.Investigations;
  entity InvestigationNotes as projection on db.InvestigationNotes;
  entity EvidenceItems as projection on db.EvidenceItems;
  entity Alerts as projection on db.Alerts;

  /**
   * Create an investigation from an alert with analyst assignment.
   */
  action createInvestigation(
    alertId    : String(36),
    analystId  : String(12)
  ) returns LargeString;

  /**
   * Transition investigation state with validation per state machine.
   * Rejects invalid transitions.
   */
  action transitionState(
    investigationId : String(36),
    targetState     : String(25),
    userId          : String(12)
  ) returns LargeString;

  /**
   * Resolve an investigation with mandatory resolution notes (1-5000 chars).
   * Records elapsed time from investigation start.
   */
  action resolve(
    investigationId : String(36),
    resolutionType  : String(25),
    resolutionNotes : LargeString,
    userId          : String(12)
  ) returns LargeString;

  /**
   * Generate an AI investigation brief via GenAI Hub.
   */
  action generateAIBrief(
    investigationId : String(36)
  ) returns LargeString;

  /**
   * Export evidence package as a signed PDF.
   */
  action exportEvidencePackage(
    investigationId : String(36)
  ) returns LargeString;
}
