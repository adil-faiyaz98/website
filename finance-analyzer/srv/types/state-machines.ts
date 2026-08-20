/**
 * State machine transition maps for Alert and Investigation lifecycles.
 * Defines valid state transitions for lifecycle management.
 * Validates: Requirements 2.2, 3.1
 */

import { AlertStatus, InvestigationStatus } from './enums';

/**
 * Valid state transitions for Alert lifecycle.
 * - OPEN → IN_PROGRESS, ESCALATED
 * - IN_PROGRESS → ESCALATED, RESOLVED_TRUE_POSITIVE, RESOLVED_FALSE_POSITIVE
 * - ESCALATED → IN_PROGRESS, RESOLVED_TRUE_POSITIVE, RESOLVED_FALSE_POSITIVE
 */
export const ALERT_VALID_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  'OPEN': ['IN_PROGRESS', 'ESCALATED'],
  'IN_PROGRESS': ['ESCALATED', 'RESOLVED_TRUE_POSITIVE', 'RESOLVED_FALSE_POSITIVE'],
  'ESCALATED': ['IN_PROGRESS', 'RESOLVED_TRUE_POSITIVE', 'RESOLVED_FALSE_POSITIVE'],
  'RESOLVED_TRUE_POSITIVE': [],
  'RESOLVED_FALSE_POSITIVE': [],
};

/**
 * Valid state transitions for Investigation lifecycle.
 * - OPEN → IN_PROGRESS, ESCALATED
 * - IN_PROGRESS → ESCALATED, RESOLVED_TRUE_POSITIVE, RESOLVED_FALSE_POSITIVE
 * - ESCALATED → IN_PROGRESS, RESOLVED_TRUE_POSITIVE, RESOLVED_FALSE_POSITIVE
 */
export const INVESTIGATION_VALID_TRANSITIONS: Record<InvestigationStatus, InvestigationStatus[]> = {
  'OPEN': ['IN_PROGRESS', 'ESCALATED'],
  'IN_PROGRESS': ['ESCALATED', 'RESOLVED_TRUE_POSITIVE', 'RESOLVED_FALSE_POSITIVE'],
  'ESCALATED': ['IN_PROGRESS', 'RESOLVED_TRUE_POSITIVE', 'RESOLVED_FALSE_POSITIVE'],
  'RESOLVED_TRUE_POSITIVE': [],
  'RESOLVED_FALSE_POSITIVE': [],
};

/**
 * Check if a state transition is valid for an Alert.
 */
export function isValidAlertTransition(from: AlertStatus, to: AlertStatus): boolean {
  return ALERT_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a state transition is valid for an Investigation.
 */
export function isValidInvestigationTransition(from: InvestigationStatus, to: InvestigationStatus): boolean {
  return INVESTIGATION_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
