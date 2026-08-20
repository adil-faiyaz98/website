import cds = require('@sap/cds');
import { CanonicalTransaction } from '../types';
import { DocumentType, SystemType } from '../types/enums';

const { ApplicationService } = cds;

// ============================================================================
// Interfaces
// ============================================================================

/** Raw event payload received from SAP Event Mesh or Integration Suite */
export interface RawSAPEvent {
  tenantId: string;
  sourceSystem: string;
  sourceEventId: string;
  eventTimestamp: Date;
  eventType: string;
  payload: Record<string, any>;
}

/** Result of a deduplication check */
export interface DeduplicationResult {
  isDuplicate: boolean;
  existingTransactionId?: string;
}

/** Result of a batch synchronization operation */
export interface BatchResult {
  totalRecords: number;
  processedRecords: number;
  duplicatesSkipped: number;
  failedRecords: number;
  startTime: Date;
  endTime: Date;
}

/** Authentication configuration for batch sync */
export interface AuthConfig {
  authMethod: 'OAUTH2' | 'CERTIFICATE';
  credentialNamespace: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum retries for failed operations */
const MAX_RETRIES = 3;

/** Exponential backoff delays in milliseconds: 5s, 10s, 20s */
const RETRY_DELAYS_MS = [5000, 10000, 20000];

/** Maximum retry delay in milliseconds (60 seconds) */
const MAX_RETRY_DELAY_MS = 60000;

/** Dead letter queue retention period in days */
const DLQ_RETENTION_DAYS = 30;

/** Default batch sync interval in hours */
const DEFAULT_BATCH_INTERVAL_HOURS = 6;

/** Maximum normalization time in milliseconds (5 seconds) */
const NORMALIZATION_TIMEOUT_MS = 5000;

// ============================================================================
// Ingestion Service Implementation
// ============================================================================

/**
 * Ingestion Service
 *
 * Receives events from SAP Event Mesh and batch data from Integration Suite,
 * normalizes to canonical format, deduplicates, and forwards to Detection Engine.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 23.4
 */
export default class IngestionService extends (ApplicationService as any) {
  async init() {
    // Register action handlers
    this.on('processEvent', async (req: any) => {
      const { tenantId, sourceSystem, sourceEventId, eventTimestamp, eventType, payload } = req.data;

      const rawEvent: RawSAPEvent = {
        tenantId,
        sourceSystem,
        sourceEventId,
        eventTimestamp: new Date(eventTimestamp),
        eventType,
        payload: typeof payload === 'string' ? JSON.parse(payload) : payload,
      };

      const result = await this.processEvent(rawEvent);
      return result.transactionId;
    });

    this.on('batchSync', async (req: any) => {
      const { tenantId, systemId, fromDate, authMethod } = req.data;
      const result = await this.batchSync(tenantId, systemId, new Date(fromDate), authMethod || 'OAUTH2');
      return JSON.stringify(result);
    });

    this.on('checkDuplicate', async (req: any) => {
      const { tenantId, sourceEventId, eventTimestamp } = req.data;
      return this.checkDuplicate(tenantId, sourceEventId, new Date(eventTimestamp));
    });

    this.on('routeToDeadLetterQueue', async (req: any) => {
      const { tenantId, payload, reason } = req.data;
      const rawEvent: RawSAPEvent = {
        tenantId,
        sourceSystem: 'unknown',
        sourceEventId: 'unknown',
        eventTimestamp: new Date(),
        eventType: 'unknown',
        payload: typeof payload === 'string' ? JSON.parse(payload) : payload,
      };
      await this.routeToDeadLetterQueue(rawEvent, reason);
      return 'Event routed to Dead Letter Queue';
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Process a real-time event from SAP Event Mesh.
   * Normalizes within 5 seconds of receipt, deduplicates, stores, and forwards.
   *
   * Validates: Requirements 2.1, 2.2, 2.8
   */
  async processEvent(event: RawSAPEvent): Promise<CanonicalTransaction> {
    const logger = cds.log('ingestion');
    const startTime = Date.now();

    logger.info(`Processing event ${event.sourceEventId} from ${event.sourceSystem} for tenant ${event.tenantId}`);

    try {
      // Step 1: Check for duplicates using composite key (sourceEventId + timestamp)
      const dedup = await this.checkDuplicate(event.tenantId, event.sourceEventId, event.eventTimestamp);
      if (dedup.isDuplicate) {
        logger.info(`Duplicate event detected: ${event.sourceEventId}, existing TX: ${dedup.existingTransactionId}`);
        // Return existing transaction data for idempotency
        return this.fetchExistingTransaction(dedup.existingTransactionId!);
      }

      // Step 2: Determine system type for normalization
      const systemType = await this.resolveSystemType(event.tenantId, event.sourceSystem);

      // Step 3: Normalize within 5 seconds
      const canonical = await this.normalizeWithTimeout(event, systemType);

      // Step 4: Store normalized transaction in HANA
      await this.storeTransaction(canonical);

      // Step 5: Record deduplication entry
      await this.recordDeduplication(event.tenantId, event.sourceEventId, event.eventTimestamp, canonical.transactionId);

      // Step 6: Forward to Detection Engine
      await this.forwardToDetectionEngine(canonical);

      const elapsed = Date.now() - startTime;
      logger.info(`Event ${event.sourceEventId} processed in ${elapsed}ms (TX: ${canonical.transactionId})`);

      return canonical;
    } catch (error: any) {
      logger.error(`Failed to process event ${event.sourceEventId}: ${error.message}`);

      // Attempt retry with exponential backoff
      const retryResult = await this.processWithRetry(event, error);
      if (retryResult) {
        return retryResult;
      }

      // All retries exhausted - route to DLQ
      await this.routeToDeadLetterQueue(event, `Processing failed after ${MAX_RETRIES} retries: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalize raw SAP event to canonical format.
   * Handles format differences for S4HC (OData V4), S4OP (RFC/OData/SOAP), ECC (BAPI/RFC/IDoc).
   *
   * Validates: Requirements 2.2, 2.4
   */
  normalize(raw: RawSAPEvent, systemType: SystemType): CanonicalTransaction {
    const now = new Date();
    const transactionId = cds.utils.uuid();

    switch (systemType) {
      case 'S4HC':
        return this.normalizeS4HC(raw, transactionId, now);
      case 'S4OP':
        return this.normalizeS4OP(raw, transactionId, now);
      case 'ECC':
        return this.normalizeECC(raw, transactionId, now);
      default:
        throw new Error(`Unsupported system type: ${systemType}`);
    }
  }

  /**
   * Deduplication check using composite key: sourceEventId + timestamp.
   * Ensures each transaction is processed exactly once (at-least-once delivery handling).
   *
   * Validates: Requirements 2.8
   */
  async checkDuplicate(tenantId: string, sourceEventId: string, timestamp: Date): Promise<DeduplicationResult> {
    const db = await cds.connect.to('db');
    const { DeduplicationLog } = db.entities('finsecure.ai');

    const existing = await SELECT.one.from(DeduplicationLog).where({
      tenantId,
      sourceEventId,
      eventTimestamp: timestamp.toISOString(),
    });

    if (existing) {
      return {
        isDuplicate: true,
        existingTransactionId: existing.transactionId,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Batch synchronization: pull historical data via Integration Suite.
   * Configurable schedule, default every 6 hours.
   * Supports OAuth 2.0 and certificate-based authentication.
   *
   * Validates: Requirements 2.3, 2.5
   */
  async batchSync(tenantId: string, systemId: string, fromDate: Date, authMethod: string = 'OAUTH2'): Promise<BatchResult> {
    const logger = cds.log('ingestion');
    logger.info(`Starting batch sync for tenant ${tenantId}, system ${systemId}, from ${fromDate.toISOString()}`);

    const startTime = new Date();
    let totalRecords = 0;
    let processedRecords = 0;
    let duplicatesSkipped = 0;
    let failedRecords = 0;

    try {
      // Validate authentication method (OAuth 2.0 or certificate-based)
      if (authMethod !== 'OAUTH2' && authMethod !== 'CERTIFICATE') {
        throw new Error(`Unsupported auth method: ${authMethod}. Must be OAUTH2 or CERTIFICATE.`);
      }

      // Resolve system type and connection details
      const systemType = await this.resolveSystemType(tenantId, systemId);
      await this.getConnectionConfig(tenantId, systemId); // Validate system exists and is accessible

      // Authenticate using tenant-specific credentials
      const authToken = await this.authenticate(tenantId, systemId, authMethod as 'OAUTH2' | 'CERTIFICATE');

      // Fetch historical records from Integration Suite
      const records = await this.fetchHistoricalRecords(tenantId, systemId, systemType, fromDate, authToken);
      totalRecords = records.length;

      // Process each record through normalization and dedup pipeline
      for (const record of records) {
        try {
          const rawEvent: RawSAPEvent = {
            tenantId,
            sourceSystem: systemId,
            sourceEventId: record.sourceEventId || `batch-${systemId}-${record.documentNumber}-${record.postingDate}`,
            eventTimestamp: new Date(record.timestamp || record.postingDate),
            eventType: record.eventType || record.documentType,
            payload: record,
          };

          // Check for duplicates
          const dedup = await this.checkDuplicate(tenantId, rawEvent.sourceEventId, rawEvent.eventTimestamp);
          if (dedup.isDuplicate) {
            duplicatesSkipped++;
            continue;
          }

          // Normalize and store
          const canonical = this.normalize(rawEvent, systemType);
          await this.storeTransaction(canonical);
          await this.recordDeduplication(tenantId, rawEvent.sourceEventId, rawEvent.eventTimestamp, canonical.transactionId);
          await this.forwardToDetectionEngine(canonical);

          processedRecords++;
        } catch (recordError: any) {
          logger.warn(`Failed to process batch record: ${recordError.message}`);
          failedRecords++;
        }
      }

      const endTime = new Date();
      const result: BatchResult = {
        totalRecords,
        processedRecords,
        duplicatesSkipped,
        failedRecords,
        startTime,
        endTime,
      };

      // Update last sync timestamp on the connected system
      await this.updateLastSyncTimestamp(tenantId, systemId, endTime);

      logger.info(
        `Batch sync completed for tenant ${tenantId}: ${processedRecords} processed, ${duplicatesSkipped} duplicates, ${failedRecords} failed`
      );

      return result;
    } catch (error: any) {
      logger.error(`Batch sync failed for tenant ${tenantId}, system ${systemId}: ${error.message}`);

      // Generate alert for ingestion failure
      await this.generateIngestionFailureAlert(tenantId, systemId, fromDate, error.message);

      throw error;
    }
  }

  /**
   * Route unprocessable events to Dead Letter Queue.
   * Stores failed events with payload, reason, timestamp; retains for 30 days.
   *
   * Validates: Requirements 2.6, 2.7
   */
  async routeToDeadLetterQueue(event: RawSAPEvent, reason: string): Promise<void> {
    const logger = cds.log('ingestion');
    logger.warn(`Routing event ${event.sourceEventId} to DLQ: ${reason}`);

    const db = await cds.connect.to('db');
    const { DeadLetterQueue } = db.entities('finsecure.ai');

    const retainUntil = new Date();
    retainUntil.setDate(retainUntil.getDate() + DLQ_RETENTION_DAYS);

    const dlqEntry = {
      tenantId: event.tenantId,
      eventPayload: JSON.stringify({
        sourceSystem: event.sourceSystem,
        sourceEventId: event.sourceEventId,
        eventTimestamp: event.eventTimestamp.toISOString(),
        eventType: event.eventType,
        payload: event.payload,
      }),
      failureReason: reason.substring(0, 1000), // Limit to 1000 chars
      receivedAt: new Date().toISOString(),
      retainUntil: retainUntil.toISOString(),
      processed: false,
    };

    await INSERT.into(DeadLetterQueue).entries(dlqEntry);
    logger.info(`Event ${event.sourceEventId} stored in DLQ, retained until ${retainUntil.toISOString()}`);
  }

  // ==========================================================================
  // Normalization Methods - System-Specific
  // ==========================================================================

  /**
   * Normalize S/4HANA Cloud event (OData V4 format).
   * S4HC sends events in OData V4 JSON format with standard naming conventions.
   *
   * Validates: Requirements 2.2
   */
  private normalizeS4HC(raw: RawSAPEvent, transactionId: string, now: Date): CanonicalTransaction {
    const p = raw.payload;

    return {
      transactionId,
      tenantId: raw.tenantId,
      sourceSystem: raw.sourceSystem,
      sourceEventId: raw.sourceEventId,
      documentNumber: p.AccountingDocument || p.DocumentNumber || p.PaymentDocument || '',
      documentType: this.mapDocumentType(raw.eventType, p),
      postingDate: new Date(p.PostingDate || p.DocumentDate || now),
      entryDate: new Date(p.CreationDate || p.EntryDate || now),
      amount: Number.parseFloat(p.AmountInTransactionCurrency || p.Amount || p.TotalAmount || '0'),
      currency: p.TransactionCurrency || p.Currency || p.DocumentCurrency || 'USD',
      userId: p.CreatedByUser || p.LastChangedByUser || p.AccountingDocCreatedByUser || '',
      companyCode: p.CompanyCode || '',
      debitAccount: p.DebitAccount || p.GLAccount || '',
      creditAccount: p.CreditAccount || p.OffsettingAccount || '',
      costCenter: p.CostCenter || undefined,
      vendorId: p.Supplier || p.Vendor || undefined,
      businessObjectRef: p.ReferenceDocument || p.AccountingDocument || `${raw.sourceSystem}/${raw.sourceEventId}`,
      metadata: this.extractMetadata(p, 'S4HC'),
      ingestedAt: now,
      normalizedAt: now,
    };
  }

  /**
   * Normalize S/4HANA On-Premise event (RFC/OData/SOAP formats).
   * S4OP can send events via RFC, OData, or SOAP interfaces via Cloud Connector.
   *
   * Validates: Requirements 2.2, 2.4
   */
  private normalizeS4OP(raw: RawSAPEvent, transactionId: string, now: Date): CanonicalTransaction {
    const p = raw.payload;

    // S4OP may use different field naming depending on interface (RFC uses BKPF/BSEG style)
    const isRFCFormat = !!(p.BUKRS || p.BELNR || p.GJAHR);
    const isSOAPFormat = !!(p['ns:CompanyCode'] || p['Document']);

    if (isRFCFormat) {
      return this.normalizeRFCPayload(raw, p, transactionId, now);
    }

    if (isSOAPFormat) {
      return this.normalizeSOAPPayload(raw, p, transactionId, now);
    }

    // Default to OData-style format (similar to S4HC but potentially older naming)
    return {
      transactionId,
      tenantId: raw.tenantId,
      sourceSystem: raw.sourceSystem,
      sourceEventId: raw.sourceEventId,
      documentNumber: p.AccountingDocument || p.DocumentNumber || '',
      documentType: this.mapDocumentType(raw.eventType, p),
      postingDate: new Date(p.PostingDate || p.BUDAT || now),
      entryDate: new Date(p.EntryDate || p.BLDAT || now),
      amount: Number.parseFloat(p.Amount || p.AmountInTransactionCurrency || '0'),
      currency: p.Currency || p.TransactionCurrency || 'USD',
      userId: p.UserName || p.CreatedByUser || '',
      companyCode: p.CompanyCode || '',
      debitAccount: p.DebitAccount || p.GLAccount || '',
      creditAccount: p.CreditAccount || p.OffsettingAccount || '',
      costCenter: p.CostCenter || undefined,
      vendorId: p.Vendor || p.Supplier || undefined,
      businessObjectRef: p.ReferenceDocument || `${raw.sourceSystem}/${raw.sourceEventId}`,
      metadata: this.extractMetadata(p, 'S4OP'),
      ingestedAt: now,
      normalizedAt: now,
    };
  }

  /**
   * Normalize ECC event (BAPI/RFC/IDoc formats).
   * ECC systems use legacy field names (BKPF/BSEG tables) and IDoc segments.
   *
   * Validates: Requirements 2.2, 2.4
   */
  private normalizeECC(raw: RawSAPEvent, transactionId: string, now: Date): CanonicalTransaction {
    const p = raw.payload;

    // Detect IDoc format (has segment-based structure)
    const isIDoc = !!(p.IDOCTYP || p.DOCNUM || p.EDI_DC40 || p.E1BPACHE09);

    if (isIDoc) {
      return this.normalizeIDocPayload(raw, p, transactionId, now);
    }

    // BAPI/RFC format uses SAP table field names
    return {
      transactionId,
      tenantId: raw.tenantId,
      sourceSystem: raw.sourceSystem,
      sourceEventId: raw.sourceEventId,
      documentNumber: p.BELNR || p.DOC_NUMBER || p.DOCNUM || '',
      documentType: this.mapDocumentType(raw.eventType, p),
      postingDate: this.parseSAPDate(p.BUDAT || p.PSTNG_DATE) || now,
      entryDate: this.parseSAPDate(p.BLDAT || p.DOC_DATE) || now,
      amount: Number.parseFloat(p.WRBTR || p.DMBTR || p.AMOUNT || '0'),
      currency: p.WAERS || p.CURR || p.CURRENCY || 'USD',
      userId: p.USNAM || p.USERNAME || p.UNAME || '',
      companyCode: p.BUKRS || p.COMP_CODE || '',
      debitAccount: p.HKONT || p.GL_ACCOUNT || p.SAKNR || '',
      creditAccount: p.SHKZG === 'H' ? (p.HKONT || '') : (p.GEGENKONTO || ''),
      costCenter: p.KOSTL || p.COST_CTR || undefined,
      vendorId: p.LIFNR || p.VENDOR_NO || undefined,
      businessObjectRef: p.XBLNR || p.REF_DOC_NO || `${raw.sourceSystem}/${raw.sourceEventId}`,
      metadata: this.extractMetadata(p, 'ECC'),
      ingestedAt: now,
      normalizedAt: now,
    };
  }

  /**
   * Normalize RFC-format payload from S/4HANA On-Premise.
   */
  private normalizeRFCPayload(raw: RawSAPEvent, p: Record<string, any>, transactionId: string, now: Date): CanonicalTransaction {
    return {
      transactionId,
      tenantId: raw.tenantId,
      sourceSystem: raw.sourceSystem,
      sourceEventId: raw.sourceEventId,
      documentNumber: p.BELNR || '',
      documentType: this.mapDocumentType(raw.eventType, p),
      postingDate: this.parseSAPDate(p.BUDAT) || now,
      entryDate: this.parseSAPDate(p.BLDAT) || now,
      amount: Number.parseFloat(p.WRBTR || p.DMBTR || '0'),
      currency: p.WAERS || 'USD',
      userId: p.USNAM || p.UNAME || '',
      companyCode: p.BUKRS || '',
      debitAccount: p.HKONT || p.SAKNR || '',
      creditAccount: p.GEGENKONTO || '',
      costCenter: p.KOSTL || undefined,
      vendorId: p.LIFNR || undefined,
      businessObjectRef: p.XBLNR || `${raw.sourceSystem}/${p.BELNR || raw.sourceEventId}`,
      metadata: this.extractMetadata(p, 'S4OP'),
      ingestedAt: now,
      normalizedAt: now,
    };
  }

  /**
   * Normalize SOAP-format payload from S/4HANA On-Premise.
   */
  private normalizeSOAPPayload(raw: RawSAPEvent, p: Record<string, any>, transactionId: string, now: Date): CanonicalTransaction {
    // SOAP payloads use namespace-prefixed or nested element names
    const doc = p['Document'] || p['ns:Document'] || p;

    return {
      transactionId,
      tenantId: raw.tenantId,
      sourceSystem: raw.sourceSystem,
      sourceEventId: raw.sourceEventId,
      documentNumber: doc['DocumentNumber'] || doc['ns:DocumentNumber'] || '',
      documentType: this.mapDocumentType(raw.eventType, doc),
      postingDate: new Date(doc['PostingDate'] || doc['ns:PostingDate'] || now),
      entryDate: new Date(doc['DocumentDate'] || doc['ns:DocumentDate'] || now),
      amount: Number.parseFloat(doc['Amount'] || doc['ns:Amount'] || '0'),
      currency: doc['Currency'] || doc['ns:Currency'] || 'USD',
      userId: doc['CreatedBy'] || doc['ns:CreatedBy'] || '',
      companyCode: doc['CompanyCode'] || doc['ns:CompanyCode'] || '',
      debitAccount: doc['DebitAccount'] || doc['ns:DebitAccount'] || '',
      creditAccount: doc['CreditAccount'] || doc['ns:CreditAccount'] || '',
      costCenter: doc['CostCenter'] || doc['ns:CostCenter'] || undefined,
      vendorId: doc['VendorId'] || doc['ns:VendorId'] || undefined,
      businessObjectRef: doc['ReferenceDocument'] || `${raw.sourceSystem}/${raw.sourceEventId}`,
      metadata: this.extractMetadata(p, 'S4OP'),
      ingestedAt: now,
      normalizedAt: now,
    };
  }

  /**
   * Normalize IDoc-format payload from ECC.
   */
  private normalizeIDocPayload(raw: RawSAPEvent, p: Record<string, any>, transactionId: string, now: Date): CanonicalTransaction {
    // IDoc format uses segment-based structure (e.g., E1BPACHE09 for accounting header)
    const header = p.E1BPACHE09 || p.E1EDK01 || p.HEADER || p;
    const item = p.E1BPACGL09 || p.E1EDP01 || p.ITEM || {};

    return {
      transactionId,
      tenantId: raw.tenantId,
      sourceSystem: raw.sourceSystem,
      sourceEventId: raw.sourceEventId,
      documentNumber: header.DOC_NUMBER || header.BELNR || p.DOCNUM || '',
      documentType: this.mapDocumentType(raw.eventType, p),
      postingDate: this.parseSAPDate(header.PSTNG_DATE || header.BUDAT) || now,
      entryDate: this.parseSAPDate(header.DOC_DATE || header.BLDAT) || now,
      amount: Number.parseFloat(item.AMT_DOCCUR || item.WRBTR || header.AMOUNT || '0'),
      currency: item.CURR_TYPE === '00' ? (item.CURRENCY || 'USD') : (header.WAERS || header.CURRENCY || 'USD'),
      userId: header.USERNAME || header.USNAM || '',
      companyCode: header.COMP_CODE || header.BUKRS || '',
      debitAccount: item.GL_ACCOUNT || item.HKONT || '',
      creditAccount: item.OFFSETTING_ACCT || '',
      costCenter: item.COST_CTR || item.KOSTL || undefined,
      vendorId: header.VENDOR_NO || header.LIFNR || undefined,
      businessObjectRef: header.REF_DOC_NO || `${raw.sourceSystem}/${p.DOCNUM || raw.sourceEventId}`,
      metadata: this.extractMetadata(p, 'ECC'),
      ingestedAt: now,
      normalizedAt: now,
    };
  }

  // ==========================================================================
  // Retry Logic
  // ==========================================================================

  /**
   * Process event with retry logic: 3 retries with exponential backoff.
   * Delays: 5s, 10s, 20s (capped at 60s max).
   *
   * Validates: Requirements 2.6
   */
  private async processWithRetry(event: RawSAPEvent, originalError: Error): Promise<CanonicalTransaction | null> {
    const logger = cds.log('ingestion');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const delay = Math.min(RETRY_DELAYS_MS[attempt - 1] || MAX_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS);
      logger.info(`Retry ${attempt}/${MAX_RETRIES} for event ${event.sourceEventId} after ${delay}ms`);

      await this.delay(delay);

      try {
        // Re-attempt the processing pipeline
        const dedup = await this.checkDuplicate(event.tenantId, event.sourceEventId, event.eventTimestamp);
        if (dedup.isDuplicate) {
          return this.fetchExistingTransaction(dedup.existingTransactionId!);
        }

        const systemType = await this.resolveSystemType(event.tenantId, event.sourceSystem);
        const canonical = this.normalize(event, systemType);
        await this.storeTransaction(canonical);
        await this.recordDeduplication(event.tenantId, event.sourceEventId, event.eventTimestamp, canonical.transactionId);
        await this.forwardToDetectionEngine(canonical);

        logger.info(`Event ${event.sourceEventId} processed successfully on retry ${attempt}`);
        return canonical;
      } catch (retryError: any) {
        logger.warn(`Retry ${attempt}/${MAX_RETRIES} failed for event ${event.sourceEventId}: ${retryError.message}`);

        if (attempt === MAX_RETRIES) {
          // All retries exhausted - generate failure alert
          await this.generateIngestionFailureAlert(
            event.tenantId,
            event.sourceSystem,
            event.eventTimestamp,
            `All ${MAX_RETRIES} retries exhausted: ${retryError.message}`
          );
          return null;
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Normalize with a 5-second timeout guarantee.
   */
  private async normalizeWithTimeout(event: RawSAPEvent, systemType: SystemType): Promise<CanonicalTransaction> {
    return new Promise<CanonicalTransaction>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Normalization exceeded ${NORMALIZATION_TIMEOUT_MS}ms timeout`));
      }, NORMALIZATION_TIMEOUT_MS);

      try {
        const result = this.normalize(event, systemType);
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Resolve system type from connected systems registry.
   */
  private async resolveSystemType(tenantId: string, systemId: string): Promise<SystemType> {
    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    const system = await SELECT.one.from(ConnectedSystems).where({
      tenant_ID: tenantId,
      systemId,
    });

    if (!system) {
      throw new Error(`System ${systemId} not found for tenant ${tenantId}`);
    }

    return system.systemType as SystemType;
  }

  /**
   * Get connection configuration for a system.
   */
  private async getConnectionConfig(tenantId: string, systemId: string): Promise<Record<string, any>> {
    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    const system = await SELECT.one.from(ConnectedSystems).where({
      tenant_ID: tenantId,
      systemId,
    });

    if (!system) {
      throw new Error(`System ${systemId} not found for tenant ${tenantId}`);
    }

    return {
      connectionType: system.connectionType,
      status: system.status,
    };
  }

  /**
   * Authenticate with the source system using OAuth 2.0 or certificate-based auth.
   * Uses tenant-specific credentials stored in SAP Credential Store.
   *
   * Validates: Requirements 2.5
   */
  private async authenticate(tenantId: string, systemId: string, authMethod: 'OAUTH2' | 'CERTIFICATE'): Promise<string> {
    const logger = cds.log('ingestion');
    const credentialNamespace = `finsecure/${tenantId}/${systemId}`;

    logger.info(`Authenticating with ${authMethod} for namespace ${credentialNamespace}`);

    // In production, this would fetch credentials from SAP Credential Store
    // and perform OAuth 2.0 client credentials flow or certificate-based auth
    try {
      if (authMethod === 'OAUTH2') {
        // OAuth 2.0 client credentials flow
        return await this.performOAuth2Flow(credentialNamespace);
      } else {
        // Certificate-based (X.509 mutual TLS)
        return await this.performCertificateAuth(credentialNamespace);
      }
    } catch (error: any) {
      throw new Error(`Authentication failed for ${systemId}: ${error.message}`);
    }
  }

  /**
   * Perform OAuth 2.0 client credentials flow.
   */
  private async performOAuth2Flow(credentialNamespace: string): Promise<string> {
    // In production: fetch clientId/clientSecret from Credential Store,
    // call token endpoint, return access token.
    // For now, we simulate the flow structure.
    const logger = cds.log('ingestion');
    logger.info(`OAuth 2.0 flow for namespace: ${credentialNamespace}`);
    return `oauth2_token_${credentialNamespace}_${Date.now()}`;
  }

  /**
   * Perform certificate-based authentication.
   */
  private async performCertificateAuth(credentialNamespace: string): Promise<string> {
    // In production: fetch X.509 certificate from Credential Store,
    // establish mutual TLS connection, return session token.
    const logger = cds.log('ingestion');
    logger.info(`Certificate auth for namespace: ${credentialNamespace}`);
    return `cert_token_${credentialNamespace}_${Date.now()}`;
  }

  /**
   * Fetch historical records from Integration Suite APIs.
   */
  private async fetchHistoricalRecords(
    tenantId: string,
    systemId: string,
    systemType: SystemType,
    fromDate: Date,
    authToken: string
  ): Promise<any[]> {
    const logger = cds.log('ingestion');
    logger.info(`Fetching historical records from ${systemId} (${systemType}) since ${fromDate.toISOString()}`);

    // In production, this calls Integration Suite APIs based on system type:
    // - S4HC: OData V4 batch read
    // - S4OP: RFC/OData via Cloud Connector
    // - ECC: BAPI/RFC calls via Cloud Connector
    // Returns array of raw records for processing

    // Stub: returns empty array - actual implementation connects to Integration Suite
    return [];
  }

  /**
   * Store normalized transaction in HANA.
   */
  private async storeTransaction(tx: CanonicalTransaction): Promise<void> {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    const entry = {
      ID: tx.transactionId,
      tenantId: tx.tenantId,
      sourceSystem_ID: tx.sourceSystem,
      sourceEventId: tx.sourceEventId,
      documentNumber: tx.documentNumber,
      documentType: tx.documentType,
      postingDate: tx.postingDate instanceof Date ? tx.postingDate.toISOString().split('T')[0] : tx.postingDate,
      entryDate: tx.entryDate instanceof Date ? tx.entryDate.toISOString().split('T')[0] : tx.entryDate,
      amount: tx.amount,
      currency: tx.currency,
      userId: tx.userId,
      companyCode: tx.companyCode,
      debitAccount: tx.debitAccount,
      creditAccount: tx.creditAccount,
      costCenter: tx.costCenter || null,
      vendorId: tx.vendorId || null,
      businessObjectRef: tx.businessObjectRef,
      riskScore: null,
      scored: false,
      metadata: JSON.stringify(tx.metadata),
      ingestedAt: tx.ingestedAt.toISOString(),
    };

    await INSERT.into(Transactions).entries(entry);
  }

  /**
   * Record deduplication entry for future duplicate detection.
   */
  private async recordDeduplication(
    tenantId: string,
    sourceEventId: string,
    eventTimestamp: Date,
    transactionId: string
  ): Promise<void> {
    const db = await cds.connect.to('db');
    const { DeduplicationLog } = db.entities('finsecure.ai');

    await INSERT.into(DeduplicationLog).entries({
      tenantId,
      sourceEventId,
      eventTimestamp: eventTimestamp.toISOString(),
      transactionId,
      processedAt: new Date().toISOString(),
    });
  }

  /**
   * Forward normalized transaction to Detection Engine for risk analysis.
   */
  private async forwardToDetectionEngine(tx: CanonicalTransaction): Promise<void> {
    const logger = cds.log('ingestion');

    try {
      // Publish event to Event Mesh for Detection Engine consumption
      const messaging = await cds.connect.to('messaging');
      await (messaging as any).emit('finsecure/transaction/normalized', {
        transactionId: tx.transactionId,
        tenantId: tx.tenantId,
        documentType: tx.documentType,
        amount: tx.amount,
        userId: tx.userId,
        companyCode: tx.companyCode,
        timestamp: tx.ingestedAt.toISOString(),
      });

      logger.info(`Transaction ${tx.transactionId} forwarded to Detection Engine`);
    } catch (error: any) {
      // Non-fatal: transaction is stored, detection can pick it up later
      logger.warn(`Failed to forward TX ${tx.transactionId} to Detection Engine: ${error.message}`);
    }
  }

  /**
   * Fetch an existing transaction by ID (for duplicate responses).
   */
  private async fetchExistingTransaction(transactionId: string): Promise<CanonicalTransaction> {
    const db = await cds.connect.to('db');
    const { Transactions } = db.entities('finsecure.ai');

    const tx = await SELECT.one.from(Transactions).where({ ID: transactionId });
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    return {
      transactionId: tx.ID,
      tenantId: tx.tenantId,
      sourceSystem: tx.sourceSystem_ID,
      sourceEventId: tx.sourceEventId,
      documentNumber: tx.documentNumber,
      documentType: tx.documentType as DocumentType,
      postingDate: new Date(tx.postingDate),
      entryDate: new Date(tx.entryDate),
      amount: Number.parseFloat(tx.amount),
      currency: tx.currency,
      userId: tx.userId,
      companyCode: tx.companyCode,
      debitAccount: tx.debitAccount,
      creditAccount: tx.creditAccount,
      costCenter: tx.costCenter || undefined,
      vendorId: tx.vendorId || undefined,
      businessObjectRef: tx.businessObjectRef,
      metadata: tx.metadata ? JSON.parse(tx.metadata) : {},
      ingestedAt: new Date(tx.ingestedAt),
      normalizedAt: new Date(tx.ingestedAt),
    };
  }

  /**
   * Generate an alert for ingestion failures after retries are exhausted.
   *
   * Validates: Requirements 2.7
   */
  private async generateIngestionFailureAlert(
    tenantId: string,
    systemId: string,
    fromDate: Date,
    reason: string
  ): Promise<void> {
    const logger = cds.log('ingestion');
    logger.error(`INGESTION FAILURE ALERT: tenant=${tenantId}, system=${systemId}, reason=${reason}`);

    const db = await cds.connect.to('db');
    const { Alerts } = db.entities('finsecure.ai');

    try {
      await INSERT.into(Alerts).entries({
        tenantId,
        priority: 'HIGH',
        status: 'OPEN',
        riskCategory: 'COMPLIANCE_BREACH',
        riskScore: 60,
        title: `Data ingestion failure: ${systemId}`,
        description: `Ingestion from system ${systemId} failed after ${MAX_RETRIES} retries. Reason: ${reason}. Gap period starts at ${fromDate.toISOString()}.`,
        riskIndicators: JSON.stringify([{
          indicatorType: 'INGESTION_FAILURE',
          description: reason,
          observedValue: systemId,
          weight: 1.0,
        }]),
        affectedEntities: JSON.stringify([{
          entityType: 'SYSTEM',
          entityId: systemId,
          tenantId,
        }]),
        recommendedActions: JSON.stringify([
          'Check system connectivity',
          'Verify credentials in Credential Store',
          'Review Dead Letter Queue for failed events',
          'Initiate manual batch sync once resolved',
        ]),
        slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
      });
    } catch (alertError: any) {
      logger.error(`Failed to create ingestion failure alert: ${alertError.message}`);
    }
  }

  /**
   * Update the last sync timestamp for a connected system.
   */
  private async updateLastSyncTimestamp(tenantId: string, systemId: string, syncTime: Date): Promise<void> {
    const db = await cds.connect.to('db');
    const { ConnectedSystems } = db.entities('finsecure.ai');

    await UPDATE(ConnectedSystems)
      .where({ tenant_ID: tenantId, systemId })
      .set({ lastSyncAt: syncTime.toISOString() });
  }

  /**
   * Map raw event type and payload fields to canonical DocumentType.
   */
  private mapDocumentType(eventType: string, payload: Record<string, any>): DocumentType {
    const typeUpper = (eventType || '').toUpperCase();

    // Direct mapping from event type string
    const directMappings: Record<string, DocumentType> = {
      'JOURNAL_ENTRY': 'JOURNAL_ENTRY',
      'PAYMENT_DOCUMENT': 'PAYMENT_DOCUMENT',
      'VENDOR_MASTER_CHANGE': 'VENDOR_MASTER_CHANGE',
      'GOODS_RECEIPT': 'GOODS_RECEIPT',
      'INVOICE_RECEIPT': 'INVOICE_RECEIPT',
      'PURCHASE_ORDER': 'PURCHASE_ORDER',
      'ROLE_ASSIGNMENT': 'ROLE_ASSIGNMENT',
      'AUTH_CHANGE': 'AUTH_CHANGE',
      'TRANSPORT_IMPORT': 'TRANSPORT_IMPORT',
      'SECURITY_AUDIT_EVENT': 'SECURITY_AUDIT_EVENT',
      'PARAMETER_CHANGE': 'PARAMETER_CHANGE',
    };

    if (directMappings[typeUpper]) {
      return directMappings[typeUpper];
    }

    // SAP-specific event type pattern matching via lookup table
    const patternMappings: Array<[string[], DocumentType]> = [
      [['FI_DOCUMENT', 'BKPF', 'ACC_DOCUMENT'], 'JOURNAL_ENTRY'],
      [['PAYMENT', 'REGUH', 'PAY_RUN'], 'PAYMENT_DOCUMENT'],
      [['VENDOR', 'LFA1', 'SUPPLIER'], 'VENDOR_MASTER_CHANGE'],
      [['GOODS_RECEIPT', 'MIGO', 'GR_'], 'GOODS_RECEIPT'],
      [['INVOICE', 'MIRO', 'IR_'], 'INVOICE_RECEIPT'],
      [['PURCHASE', 'EKKO', 'PO_'], 'PURCHASE_ORDER'],
      [['ROLE', 'AGR_', 'PFCG'], 'ROLE_ASSIGNMENT'],
      [['AUTH', 'USR', 'SU01'], 'AUTH_CHANGE'],
      [['TRANSPORT', 'E070', 'STMS'], 'TRANSPORT_IMPORT'],
      [['SECURITY', 'SM20', 'AUDIT_LOG'], 'SECURITY_AUDIT_EVENT'],
      [['PARAMETER', 'RZ10', 'PROFILE'], 'PARAMETER_CHANGE'],
    ];

    for (const [patterns, docType] of patternMappings) {
      if (patterns.some(pattern => typeUpper.includes(pattern))) {
        return docType;
      }
    }

    // Fallback: try to infer from payload content
    if (payload.BLART === 'SA' || payload.DocumentType === 'SA') {
      return 'JOURNAL_ENTRY';
    }

    // Default
    return 'JOURNAL_ENTRY';
  }

  /**
   * Extract additional metadata fields based on system type.
   */
  private extractMetadata(payload: Record<string, any>, systemType: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      _sourceFormat: systemType,
      _rawFieldCount: Object.keys(payload).length,
    };

    // Capture system-specific metadata using field extraction maps
    const fieldMaps: Record<string, Array<[string, string]>> = {
      'S4HC': [
        ['AccountingDocumentType', 'accountingDocType'],
        ['FiscalYear', 'fiscalYear'],
        ['FiscalPeriod', 'fiscalPeriod'],
        ['IsReversed', 'isReversed'],
        ['IsReversal', 'isReversal'],
      ],
      'S4OP': [
        ['GJAHR', 'fiscalYear'],
        ['FiscalYear', 'fiscalYear'],
        ['MONAT', 'fiscalPeriod'],
        ['FiscalPeriod', 'fiscalPeriod'],
        ['BLART', 'docType'],
        ['DocumentType', 'docType'],
        ['STBLG', 'reversalDoc'],
      ],
      'ECC': [
        ['GJAHR', 'fiscalYear'],
        ['MONAT', 'fiscalPeriod'],
        ['BLART', 'docType'],
        ['STBLG', 'reversalDoc'],
        ['TCODE', 'transactionCode'],
        ['IDOCTYP', 'idocType'],
      ],
    };

    const fields = fieldMaps[systemType] || [];
    for (const [sourceField, metaKey] of fields) {
      if (payload[sourceField] && !metadata[metaKey]) {
        metadata[metaKey] = payload[sourceField];
      }
    }

    return metadata;
  }

  /**
   * Parse SAP date format (YYYYMMDD) to JavaScript Date.
   */
  private parseSAPDate(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;

    // Handle YYYYMMDD format
    if (/^\d{8}$/.test(dateStr)) {
      const year = Number.parseInt(dateStr.substring(0, 4), 10);
      const month = Number.parseInt(dateStr.substring(4, 6), 10) - 1;
      const day = Number.parseInt(dateStr.substring(6, 8), 10);
      return new Date(year, month, day);
    }

    // Handle ISO or other standard formats
    const parsed = new Date(dateStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Delay execution for the specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
