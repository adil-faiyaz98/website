/**
 * Investigation interface - workflow for analyst case management.
 * Validates: Requirements 3.1, 9.1
 */

import { InvestigationStatus } from './enums';

/** A note added during the investigation workflow */
export interface InvestigationNote {
  /** Unique note ID */
  noteId: string;
  /** Author (SAP user ID) */
  author: string;
  /** Note content */
  content: string;
  /** When the note was created */
  createdAt: Date;
  /** Attached file references */
  attachments?: string[];
}

/** A piece of evidence collected during investigation */
export interface EvidenceItem {
  /** Unique evidence ID */
  evidenceId: string;
  /** Type of evidence */
  evidenceType: string;
  /** Evidence content or description */
  content: string;
  /** Reference to source (URL, document ID, etc.) */
  reference: string;
}

/** Investigation created from an alert for detailed analysis */
export interface Investigation {
  /** Unique investigation ID */
  investigationId: string;
  /** Tenant this investigation belongs to */
  tenantId: string;
  /** ID of the alert that initiated this investigation */
  alertId: string;
  /** Current lifecycle status */
  status: InvestigationStatus;
  /** Assigned analyst (SAP user ID) */
  assignedAnalyst: string;
  /** Investigation notes and observations */
  notes: InvestigationNote[];
  /** Resolution type on closure */
  resolutionType?: string;
  /** Resolution notes (1-5000 characters, mandatory on resolution) */
  resolutionNotes?: string;
  /** AI-generated investigation brief */
  aiInvestigationBrief?: string;
  /** Related investigation IDs */
  relatedInvestigations: string[];
  /** Collected evidence items */
  evidencePackage: EvidenceItem[];
  /** When the investigation was started */
  startedAt: Date;
  /** When the investigation was resolved */
  resolvedAt?: Date;
  /** Elapsed time in milliseconds */
  elapsedTime?: number;
}
