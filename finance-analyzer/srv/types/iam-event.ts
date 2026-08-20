/**
 * IAM (Identity and Access Management) event interfaces.
 * Validates: Requirements 9.1
 */

import { IAMEventType } from './enums';

/** An IAM event captured from connected SAP systems */
export interface IAMEvent {
  /** Unique event ID */
  eventId: string;
  /** Tenant this event belongs to */
  tenantId: string;
  /** Type of IAM event */
  eventType: IAMEventType;
  /** User whose access was affected */
  userId: string;
  /** User who performed the action */
  performedBy: string;
  /** System where the event occurred */
  systemId: string;
  /** Event-specific details (roles, profiles, authorization objects, etc.) */
  details: Record<string, unknown>;
  /** When the event occurred */
  timestamp: Date;
}
