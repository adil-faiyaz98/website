/**
 * Canonical transaction interface - normalized format for all SAP source events.
 * Validates: Requirements 2.2
 */

import { DocumentType } from './enums';

/** Normalized transaction after ingestion from any SAP source system */
export interface CanonicalTransaction {
  /** Unique internal transaction ID */
  transactionId: string;
  /** Tenant this transaction belongs to */
  tenantId: string;
  /** System registration ID of the source */
  sourceSystem: string;
  /** Original event ID for deduplication */
  sourceEventId: string;
  /** SAP document number */
  documentNumber: string;
  /** Type of document */
  documentType: DocumentType;
  /** Date the document was posted */
  postingDate: Date;
  /** Date the document was entered */
  entryDate: Date;
  /** Transaction amount */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** SAP user who posted the transaction */
  userId: string;
  /** Company code */
  companyCode: string;
  /** Debit G/L account */
  debitAccount: string;
  /** Credit G/L account */
  creditAccount: string;
  /** Cost center (optional) */
  costCenter?: string;
  /** Vendor ID (optional) */
  vendorId?: string;
  /** Reference to source business object */
  businessObjectRef: string;
  /** Additional fields per document type */
  metadata: Record<string, unknown>;
  /** Timestamp when ingested */
  ingestedAt: Date;
  /** Timestamp when normalized */
  normalizedAt: Date;
}
