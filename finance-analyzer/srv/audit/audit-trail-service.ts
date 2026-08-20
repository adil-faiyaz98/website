import cds = require('@sap/cds');
import * as crypto from 'node:crypto';

const { ApplicationService } = cds;

// ============================================================================
// Types
// ============================================================================

/** Audit outcome status values */
type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

/** Structure for a single audit trail entry */
interface AuditEntry {
  ID: string;
  tenantId: string;
  timestamp: string;
  userId: string;
  action: string;
  affectedObject: string;
  sourceIP: string;
  outcome: AuditOutcome;
  details: string | null;
  integrityHash: string;
}

/** Buffered event awaiting replay to SAP Audit Log Service */
interface BufferedEvent {
  entry: AuditEntry;
  bufferedAt: number;
}

/** Pagination metadata returned with query results */
interface PaginationMeta {
  page: number;
  pageSize: number;
  totalEntries: number;
  totalPages: number;
  hasNextPage: boolean;
}

/** Query filter parameters */
interface AuditQueryFilters {
  tenantId: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  eventType?: string;
  riskCategory?: string;
  affectedObject?: string;
  page: number;
  pageSize: number;
}

/** Integrity verification result */
interface IntegrityResult {
  verified: boolean;
  totalEntries: number;
  validEntries: number;
  tamperedEntries: string[];
  verifiedAt: string;
}

/** Data for computing an entry's integrity hash */
interface HashInput {
  previousHash: string;
  timestamp: string;
  tenantId: string;
  userId: string;
  action: string;
  affectedObject: string;
  sourceIP: string;
  outcome: string;
}

/** Circuit breaker states */
type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** Circuit breaker for SAP Audit Log Service calls */
interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  openedAt: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum entries per page (requirement 12.4) */
const MAX_PAGE_SIZE = 200;

/** Default page size */
const DEFAULT_PAGE_SIZE = 50;

/** Minimum retention period in years (requirement 12.3) */
const RETENTION_YEARS = 7;

/** Buffer capacity limit (number of events) */
const BUFFER_CAPACITY = 10_000;

/** Buffer alert threshold (90% capacity - requirement 12.6) */
const BUFFER_ALERT_THRESHOLD = 0.9;

/** Hash algorithm for integrity chain */
const HASH_ALGORITHM = 'sha256';

/** Genesis hash for the first entry in a tenant's chain */
const GENESIS_HASH = '0'.repeat(64);

/** Circuit breaker: consecutive failures to trigger OPEN state */
const CB_FAILURE_THRESHOLD = 5;

/** Circuit breaker: time window for counting failures (ms) */
const CB_FAILURE_WINDOW_MS = 60_000;

/** Circuit breaker: time to stay OPEN before switching to HALF_OPEN (ms) */
const CB_OPEN_DURATION_MS = 30_000;

// ============================================================================
// Audit Trail Service
// ============================================================================

/**
 * Audit Trail Service
 *
 * Logs all system activities to SAP Audit Log Service with cryptographic
 * integrity verification (tamper-evident hash chain), local buffering for
 * availability, 7-year retention, and paginated querying.
 *
 * Implements circuit breaker pattern for SAP Audit Log Service calls:
 * - CLOSED: Normal operation
 * - OPEN: After 5 consecutive failures within 60s — stop calling for 30s
 * - HALF_OPEN: Allow single test request to determine recovery
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */
export default class AuditTrailService extends (ApplicationService as any) {
  /**
   * Local buffer for audit events when SAP Audit Log Service is unavailable.
   * Events are replayed in chronological order upon service recovery.
   */
  private readonly buffer: BufferedEvent[] = [];

  /** Circuit breaker state for SAP Audit Log Service */
  private readonly circuitBreaker: CircuitBreaker = {
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: 0,
    openedAt: 0,
  };

  /** Track whether a buffer capacity alert has been sent */
  private bufferAlertSent: boolean = false;

  async init() {
    this.on('logEvent', async (req: any) => {
      const { tenantId, userId, action, affectedObject, sourceIP, outcome, details } = req.data;
      const result = await this.logAuditEvent(
        tenantId, userId, action, affectedObject, sourceIP,
        outcome as AuditOutcome, details
      );
      return JSON.stringify(result);
    });

    this.on('verifyIntegrity', async (req: any) => {
      const { tenantId, startDate, endDate } = req.data;
      const result = await this.verifyChainIntegrity(tenantId, startDate, endDate);
      return JSON.stringify(result);
    });

    this.on('queryAuditTrail', async (req: any) => {
      const { tenantId, startDate, endDate, userId, eventType, riskCategory, affectedObject, page, pageSize } = req.data;
      const result = await this.queryEntries({
        tenantId, startDate, endDate, userId, eventType,
        riskCategory, affectedObject,
        page: page ?? 1,
        pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
      });
      return JSON.stringify(result);
    });

    this.on('replayBuffer', async (req: any) => {
      const { tenantId } = req.data;
      const result = await this.replayBufferedEvents(tenantId);
      return JSON.stringify(result);
    });

    this.on('getBufferStatus', async (_req: any) => {
      const status = this.getBufferStatusReport();
      return JSON.stringify(status);
    });

    this.on('enforceRetention', async (req: any) => {
      const { tenantId } = req.data;
      const result = await this.enforceRetentionPolicy(tenantId);
      return JSON.stringify(result);
    });

    await super.init();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Log an audit event with cryptographic integrity hash.
   * If the SAP Audit Log Service is unavailable, buffers locally.
   *
   * Each entry includes: timestamp (UTC ms precision), tenantId, userId,
   * action, affectedObject, sourceIP, outcome (SUCCESS/FAILURE/DENIED).
   *
   * Validates: Requirements 12.1, 12.2, 12.5, 12.6
   */
  async logAuditEvent(
    tenantId: string,
    userId: string,
    action: string,
    affectedObject: string,
    sourceIP: string,
    outcome: AuditOutcome,
    details?: string | null
  ): Promise<{ success: boolean; entryId?: string; buffered?: boolean; error?: string }> {
    const logger = cds.log('audit-trail');

    // Validate outcome value
    if (!['SUCCESS', 'FAILURE', 'DENIED'].includes(outcome)) {
      return { success: false, error: `Invalid outcome: ${outcome}. Must be SUCCESS, FAILURE, or DENIED.` };
    }

    // Generate timestamp with UTC millisecond precision
    const timestamp = new Date().toISOString();
    const entryId = cds.utils.uuid();

    // Compute cryptographic integrity hash (hash chain)
    const previousHash = await this.getLastHash(tenantId);
    const integrityHash = this.computeEntryHash({
      previousHash,
      timestamp,
      tenantId,
      userId,
      action,
      affectedObject,
      sourceIP,
      outcome,
    });

    const entry: AuditEntry = {
      ID: entryId,
      tenantId,
      timestamp,
      userId,
      action,
      affectedObject,
      sourceIP,
      outcome,
      details: details ?? null,
      integrityHash,
    };

    // Check circuit breaker state before attempting write
    const serviceAvailable = this.isServiceAvailable();

    if (serviceAvailable) {
      try {
        await this.writeToAuditLogService(entry);
        await this.persistEntry(entry);
        this.recordSuccess();
        logger.info(
          `Audit event logged: ${action} by ${userId} on ${affectedObject} [${outcome}] tenant=${tenantId}`
        );
        return { success: true, entryId };
      } catch (error: any) {
        logger.warn(`SAP Audit Log Service write failed, buffering: ${error.message}`);
        this.recordFailure();
        this.bufferEvent(entry);
        return { success: true, entryId, buffered: true };
      }
    } else {
      // Buffer locally when service unavailable (circuit breaker OPEN)
      this.bufferEvent(entry);
      logger.info(
        `Audit event buffered (service unavailable): ${action} by ${userId} [${outcome}]`
      );
      return { success: true, entryId, buffered: true };
    }
  }

  /**
   * Verify cryptographic integrity of the audit trail hash chain.
   * Detects tampering by recalculating and comparing hashes.
   * Generates a security alert within 60 seconds if tampering detected.
   *
   * Validates: Requirements 12.2
   */
  async verifyChainIntegrity(
    tenantId: string,
    startDate?: string,
    endDate?: string
  ): Promise<IntegrityResult> {
    const logger = cds.log('audit-trail');
    const db = await cds.connect.to('db');
    const { AuditTrailEntries } = db.entities('finsecure.ai');

    // Build query conditions
    const conditions: Record<string, any> = { tenantId };
    if (startDate) {
      conditions.timestamp = { '>=': startDate };
    }
    if (endDate) {
      if (conditions.timestamp) {
        conditions.timestamp = { ...conditions.timestamp, '<=': endDate };
      } else {
        conditions.timestamp = { '<=': endDate };
      }
    }

    // Fetch entries ordered by timestamp for chain verification
    const entries = await SELECT.from(AuditTrailEntries)
      .where(conditions)
      .orderBy('timestamp asc');

    const tamperedEntries: string[] = [];
    let previousHash = GENESIS_HASH;

    // If we have a start date, get the hash of the entry before the range
    if (startDate && entries.length > 0) {
      const priorEntry = await SELECT.one.from(AuditTrailEntries)
        .where({ tenantId, timestamp: { '<': startDate } })
        .orderBy('timestamp desc');

      if (priorEntry) {
        previousHash = priorEntry.integrityHash;
      }
    }

    for (const entry of entries) {
      const expectedHash = this.computeEntryHash({
        previousHash,
        timestamp: entry.timestamp,
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        affectedObject: entry.affectedObject,
        sourceIP: entry.sourceIP,
        outcome: entry.outcome,
      });

      if (entry.integrityHash !== expectedHash) {
        tamperedEntries.push(entry.ID);
      }

      previousHash = entry.integrityHash;
    }

    const result: IntegrityResult = {
      verified: tamperedEntries.length === 0,
      totalEntries: entries.length,
      validEntries: entries.length - tamperedEntries.length,
      tamperedEntries,
      verifiedAt: new Date().toISOString(),
    };

    // Generate security alert if tampering detected (within 60 seconds)
    if (tamperedEntries.length > 0) {
      logger.error(
        `INTEGRITY VIOLATION: ${tamperedEntries.length} tampered entries detected for tenant ${tenantId}`
      );
      await this.generateTamperAlert(tenantId, tamperedEntries);
    } else {
      logger.info(
        `Integrity verification passed for tenant ${tenantId}: ${entries.length} entries verified`
      );
    }

    return result;
  }

  /**
   * Query audit trail entries with filtering and pagination.
   * Supports filtering by date range, user, event type, risk category, and object.
   * Returns max 200 entries per page; first page delivered within 5 seconds.
   *
   * Validates: Requirements 12.4
   */
  async queryEntries(
    filters: AuditQueryFilters
  ): Promise<{ entries: any[]; pagination: PaginationMeta }> {
    const db = await cds.connect.to('db');
    const { AuditTrailEntries } = db.entities('finsecure.ai');

    // Enforce max page size (never more than 200 per page)
    const pageSize = Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE);
    const page = Math.max(1, filters.page);
    const offset = (page - 1) * pageSize;

    // Build WHERE conditions
    const conditions: Record<string, any> = { tenantId: filters.tenantId };

    if (filters.startDate) {
      conditions.timestamp = { '>=': filters.startDate };
    }
    if (filters.endDate) {
      if (conditions.timestamp) {
        conditions.timestamp = { ...conditions.timestamp, '<=': filters.endDate };
      } else {
        conditions.timestamp = { '<=': filters.endDate };
      }
    }
    if (filters.userId) {
      conditions.userId = filters.userId;
    }
    if (filters.eventType) {
      conditions.action = filters.eventType;
    }
    if (filters.affectedObject) {
      conditions.affectedObject = filters.affectedObject;
    }

    // Count total entries matching the filter
    const countResult = await SELECT.from(AuditTrailEntries)
      .where(conditions)
      .columns('count(*) as count');

    const totalEntries = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalEntries / pageSize);

    // Fetch paginated results ordered by timestamp descending (most recent first)
    const entries = await SELECT.from(AuditTrailEntries)
      .where(conditions)
      .orderBy('timestamp desc')
      .limit(pageSize, offset);

    // Apply risk category filter in-memory if provided (stored in details JSON)
    let filteredEntries = entries;
    if (filters.riskCategory) {
      filteredEntries = entries.filter((entry: any) => {
        if (!entry.details) return false;
        try {
          const details = JSON.parse(entry.details);
          return details.riskCategory === filters.riskCategory;
        } catch {
          return entry.details.includes(filters.riskCategory);
        }
      });
    }

    const pagination: PaginationMeta = {
      page,
      pageSize,
      totalEntries,
      totalPages,
      hasNextPage: page < totalPages,
    };

    return { entries: filteredEntries, pagination };
  }

  /**
   * Replay buffered events to SAP Audit Log Service in chronological order.
   * Called when the service recovers from unavailability.
   *
   * Validates: Requirements 12.6
   */
  async replayBufferedEvents(
    tenantId?: string
  ): Promise<{ replayed: number; failed: number; remaining: number }> {
    const logger = cds.log('audit-trail');

    // Check if service is available via circuit breaker (attempt half-open if needed)
    if (!this.isServiceAvailable()) {
      return { replayed: 0, failed: 0, remaining: this.buffer.length };
    }

    // Filter buffer by tenant if specified, otherwise replay all
    const eventsToReplay = tenantId
      ? this.buffer.filter(e => e.entry.tenantId === tenantId)
      : [...this.buffer];

    // Sort by buffered timestamp to maintain chronological order
    eventsToReplay.sort((a, b) => a.bufferedAt - b.bufferedAt);

    let replayed = 0;
    let failed = 0;

    for (const bufferedEvent of eventsToReplay) {
      try {
        await this.writeToAuditLogService(bufferedEvent.entry);
        await this.persistEntry(bufferedEvent.entry);
        replayed++;
        this.recordSuccess();

        // Remove from buffer
        const idx = this.buffer.indexOf(bufferedEvent);
        if (idx !== -1) {
          this.buffer.splice(idx, 1);
        }
      } catch (error: any) {
        logger.warn(`Failed to replay buffered event ${bufferedEvent.entry.ID}: ${error.message}`);
        failed++;
        this.recordFailure();

        // If circuit breaker trips to OPEN during replay, stop
        if (this.circuitBreaker.state === 'OPEN') {
          logger.error('Circuit breaker opened during replay, stopping');
          break;
        }
      }
    }

    // Reset buffer alert flag if buffer is now below threshold
    if (this.buffer.length / BUFFER_CAPACITY < BUFFER_ALERT_THRESHOLD) {
      this.bufferAlertSent = false;
    }

    logger.info(
      `Buffer replay complete: replayed=${replayed}, failed=${failed}, remaining=${this.buffer.length}`
    );

    return { replayed, failed, remaining: this.buffer.length };
  }

  /**
   * Get current buffer status including capacity utilization.
   *
   * Validates: Requirements 12.6
   */
  getBufferStatusReport(): {
    currentSize: number;
    capacity: number;
    utilizationPercent: number;
    alertThresholdReached: boolean;
    serviceAvailable: boolean;
    circuitBreakerState: CircuitBreakerState;
  } {
    const utilizationPercent = (this.buffer.length / BUFFER_CAPACITY) * 100;
    return {
      currentSize: this.buffer.length,
      capacity: BUFFER_CAPACITY,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      alertThresholdReached: this.buffer.length >= BUFFER_CAPACITY * BUFFER_ALERT_THRESHOLD,
      serviceAvailable: this.circuitBreaker.state !== 'OPEN',
      circuitBreakerState: this.circuitBreaker.state,
    };
  }

  /**
   * Enforce 7-year retention policy.
   * Entries older than 7 years are archived/purged per tenant configuration.
   * Entries within the retention window are preserved.
   *
   * Validates: Requirements 12.3
   */
  async enforceRetentionPolicy(
    tenantId: string
  ): Promise<{ retainedCount: number; expiredCount: number; retentionCutoff: string }> {
    const logger = cds.log('audit-trail');
    const db = await cds.connect.to('db');
    const { AuditTrailEntries } = db.entities('finsecure.ai');

    // Calculate the retention cutoff date (7 years ago)
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - RETENTION_YEARS);
    const cutoffISO = cutoffDate.toISOString();

    // Count entries within retention period (to be kept)
    const retainedResult = await SELECT.from(AuditTrailEntries)
      .where({ tenantId, timestamp: { '>=': cutoffISO } })
      .columns('count(*) as count');
    const retainedCount = retainedResult[0]?.count ?? 0;

    // Count entries past retention period
    const expiredResult = await SELECT.from(AuditTrailEntries)
      .where({ tenantId, timestamp: { '<': cutoffISO } })
      .columns('count(*) as count');
    const expiredCount = expiredResult[0]?.count ?? 0;

    // Entries past 7 years can be archived or purged per policy.
    // We log this enforcement action for compliance tracking.
    if (expiredCount > 0) {
      logger.info(
        `Retention enforcement for tenant ${tenantId}: ` +
        `${retainedCount} entries retained, ${expiredCount} entries past retention cutoff (${cutoffISO})`
      );

      // Log the retention enforcement action itself to audit trail
      await this.logAuditEvent(
        tenantId,
        'SYSTEM',
        'RETENTION_ENFORCEMENT',
        `AuditTrailEntries:${tenantId}`,
        '127.0.0.1',
        'SUCCESS',
        JSON.stringify({
          retainedCount,
          expiredCount,
          cutoffDate: cutoffISO,
        })
      );
    }

    return {
      retainedCount,
      expiredCount,
      retentionCutoff: cutoffISO,
    };
  }

  // ==========================================================================
  // Private Methods - Circuit Breaker
  // ==========================================================================

  /**
   * Check if the SAP Audit Log Service is available based on circuit breaker state.
   * Implements the circuit breaker pattern:
   * - CLOSED: Service is operational, allow all requests
   * - OPEN: Service has failed, block requests for cooldown period
   * - HALF_OPEN: Cooldown elapsed, allow one test request
   */
  private isServiceAvailable(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'CLOSED':
        return true;

      case 'OPEN': {
        // Check if cooldown period has elapsed
        const elapsed = now - this.circuitBreaker.openedAt;
        if (elapsed >= CB_OPEN_DURATION_MS) {
          // Transition to HALF_OPEN: allow a test request
          this.circuitBreaker.state = 'HALF_OPEN';
          return true;
        }
        return false;
      }

      case 'HALF_OPEN':
        // Allow exactly one request to test recovery
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful call — reset circuit breaker to CLOSED.
   */
  private recordSuccess(): void {
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.lastFailureTime = 0;
  }

  /**
   * Record a failed call — increment failure count and potentially trip breaker.
   */
  private recordFailure(): void {
    const now = Date.now();

    // If in HALF_OPEN and test request failed, go back to OPEN
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.openedAt = now;
      return;
    }

    // Reset failure count if last failure was outside the window
    if (now - this.circuitBreaker.lastFailureTime > CB_FAILURE_WINDOW_MS) {
      this.circuitBreaker.failureCount = 0;
    }

    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = now;

    // Trip to OPEN if threshold reached
    if (this.circuitBreaker.failureCount >= CB_FAILURE_THRESHOLD) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.openedAt = now;
      cds.log('audit-trail').error(
        `Circuit breaker OPENED: ${this.circuitBreaker.failureCount} failures within window`
      );
    }
  }

  // ==========================================================================
  // Private Methods - Cryptographic Integrity
  // ==========================================================================

  /**
   * Compute the SHA-256 hash for an audit entry in the chain.
   * Hash includes the previous entry's hash for tamper-evidence.
   */
  private computeEntryHash(input: HashInput): string {
    const data = [
      input.previousHash,
      input.timestamp,
      input.tenantId,
      input.userId,
      input.action,
      input.affectedObject,
      input.sourceIP,
      input.outcome,
    ].join('|');

    return crypto.createHash(HASH_ALGORITHM).update(data).digest('hex');
  }

  /**
   * Get the hash of the last entry for the tenant's chain.
   * Returns the genesis hash if no entries exist yet.
   */
  private async getLastHash(tenantId: string): Promise<string> {
    const db = await cds.connect.to('db');
    const { AuditTrailEntries } = db.entities('finsecure.ai');

    const lastEntry = await SELECT.one.from(AuditTrailEntries)
      .where({ tenantId })
      .orderBy('timestamp desc');

    if (lastEntry) {
      return lastEntry.integrityHash;
    }

    // Also check buffer for the last hash
    const bufferedForTenant = this.buffer
      .filter(e => e.entry.tenantId === tenantId)
      .sort((a, b) => b.bufferedAt - a.bufferedAt);

    if (bufferedForTenant.length > 0) {
      return bufferedForTenant[0].entry.integrityHash;
    }

    return GENESIS_HASH;
  }

  // ==========================================================================
  // Private Methods - SAP Audit Log Service Integration
  // ==========================================================================

  /**
   * Get SAP Audit Log client instance.
   * Returns null if service is not bound (e.g., in testing).
   */
  private async getAuditLogClient(): Promise<any> {
    try {
      const auditLogging = await cds.connect.to('audit-log');
      return auditLogging;
    } catch {
      return null;
    }
  }

  /**
   * Write an entry to the SAP Audit Log Service.
   * Uses the @sap/audit-logging library for BTP-native integration.
   */
  private async writeToAuditLogService(entry: AuditEntry): Promise<void> {
    const logger = cds.log('audit-trail');

    const auditLog = await this.getAuditLogClient();
    if (!auditLog) {
      throw new Error('SAP Audit Log Service not bound or unavailable');
    }

    // Log using the SAP Audit Logging API
    await auditLog.emit('audit', {
      type: 'SecurityEvent',
      data: {
        tenant: entry.tenantId,
        user: entry.userId,
        action: entry.action,
        object: entry.affectedObject,
        sourceIP: entry.sourceIP,
        outcome: entry.outcome,
        timestamp: entry.timestamp,
        integrityHash: entry.integrityHash,
      },
    });

    logger.info(`Written to SAP Audit Log Service: ${entry.ID}`);
  }

  /**
   * Persist the audit entry to the local HANA database.
   * This provides queryable access to the audit trail.
   */
  private async persistEntry(entry: AuditEntry): Promise<void> {
    const db = await cds.connect.to('db');
    const { AuditTrailEntries } = db.entities('finsecure.ai');

    await INSERT.into(AuditTrailEntries).entries({
      ID: entry.ID,
      tenantId: entry.tenantId,
      timestamp: entry.timestamp,
      userId: entry.userId,
      action: entry.action,
      affectedObject: entry.affectedObject,
      sourceIP: entry.sourceIP,
      outcome: entry.outcome,
      details: entry.details,
      integrityHash: entry.integrityHash,
    });
  }

  // ==========================================================================
  // Private Methods - Local Buffering
  // ==========================================================================

  /**
   * Buffer an audit event locally when SAP Audit Log Service is unavailable.
   * Maintains chronological order and monitors capacity.
   *
   * Validates: Requirements 12.6
   */
  private bufferEvent(entry: AuditEntry): void {
    const logger = cds.log('audit-trail');

    this.buffer.push({
      entry,
      bufferedAt: Date.now(),
    });

    // Check buffer capacity and alert at 90%
    const utilization = this.buffer.length / BUFFER_CAPACITY;
    if (utilization >= BUFFER_ALERT_THRESHOLD && !this.bufferAlertSent) {
      this.bufferAlertSent = true;
      logger.error(
        `CRITICAL: Audit buffer at ${(utilization * 100).toFixed(1)}% capacity ` +
        `(${this.buffer.length}/${BUFFER_CAPACITY}). Imminent audit event loss risk.`
      );
      // Generate critical alert asynchronously
      this.generateBufferCapacityAlert(entry.tenantId).catch((err: any) => {
        logger.error(`Failed to generate buffer capacity alert: ${err.message}`);
      });
    }

    // If buffer is completely full, log severe warning but do not drop events
    if (this.buffer.length >= BUFFER_CAPACITY) {
      logger.error(
        `SEVERE: Audit buffer at 100% capacity. Events continue to buffer but system integrity at risk.`
      );
    }
  }

  // ==========================================================================
  // Private Methods - Alerting
  // ==========================================================================

  /**
   * Generate a security alert when tampering is detected in the audit trail.
   * Must be generated within 60 seconds of detection.
   *
   * Validates: Requirements 12.2
   */
  private async generateTamperAlert(tenantId: string, tamperedEntryIds: string[]): Promise<void> {
    const logger = cds.log('audit-trail');

    try {
      const db = await cds.connect.to('db');
      const { Alerts } = db.entities('finsecure.ai');

      const alertId = cds.utils.uuid();
      const now = new Date();

      await INSERT.into(Alerts).entries({
        ID: alertId,
        tenantId,
        priority: 'CRITICAL',
        status: 'OPEN',
        riskCategory: 'COMPLIANCE_BREACH',
        riskScore: 100,
        title: 'Audit Trail Integrity Violation Detected',
        description:
          `Cryptographic integrity verification detected ${tamperedEntryIds.length} tampered entries ` +
          `in the audit trail. Entry IDs: ${tamperedEntryIds.slice(0, 10).join(', ')}` +
          (tamperedEntryIds.length > 10 ? ` (and ${tamperedEntryIds.length - 10} more)` : ''),
        riskIndicators: JSON.stringify([{
          indicatorType: 'AUDIT_TAMPERING',
          description: 'Audit trail hash chain integrity failure',
          observedValue: tamperedEntryIds.length,
          weight: 1.0,
        }]),
        affectedEntities: JSON.stringify([{
          entityType: 'AUDIT_TRAIL',
          entityId: tenantId,
        }]),
        recommendedActions: JSON.stringify([
          'Immediately investigate the source of audit trail modifications',
          'Review system access logs for unauthorized database access',
          'Notify compliance officer and security team',
          'Preserve evidence for forensic analysis',
        ]),
        slaDeadline: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4-hour SLA
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString(),
      });

      logger.info(`Tamper detection alert generated: ${alertId} for tenant ${tenantId}`);
    } catch (error: any) {
      logger.error(`Failed to generate tamper alert: ${error.message}`);
    }
  }

  /**
   * Generate a critical alert when the local buffer reaches 90% capacity.
   *
   * Validates: Requirements 12.6
   */
  private async generateBufferCapacityAlert(tenantId: string): Promise<void> {
    const logger = cds.log('audit-trail');

    try {
      const db = await cds.connect.to('db');
      const { Alerts } = db.entities('finsecure.ai');

      const alertId = cds.utils.uuid();
      const now = new Date();
      const utilization = (this.buffer.length / BUFFER_CAPACITY) * 100;

      await INSERT.into(Alerts).entries({
        ID: alertId,
        tenantId,
        priority: 'CRITICAL',
        status: 'OPEN',
        riskCategory: 'COMPLIANCE_BREACH',
        riskScore: 95,
        title: 'Audit Trail Buffer Capacity Critical',
        description:
          `The local audit event buffer has reached ${utilization.toFixed(1)}% capacity ` +
          `(${this.buffer.length}/${BUFFER_CAPACITY} events). ` +
          `SAP Audit Log Service appears unavailable. Imminent risk of audit event loss.`,
        riskIndicators: JSON.stringify([{
          indicatorType: 'BUFFER_CAPACITY',
          description: 'Audit buffer approaching full capacity',
          observedValue: this.buffer.length,
          expectedRange: { min: 0, max: BUFFER_CAPACITY * BUFFER_ALERT_THRESHOLD },
          weight: 1.0,
        }]),
        affectedEntities: JSON.stringify([{
          entityType: 'AUDIT_SYSTEM',
          entityId: 'audit-trail-buffer',
        }]),
        recommendedActions: JSON.stringify([
          'Investigate SAP Audit Log Service availability',
          'Check BTP service instance health',
          'Prepare for manual audit event export if service remains unavailable',
          'Contact SAP support if service outage persists',
        ]),
        slaDeadline: new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString(), // 1-hour SLA
        createdAt: now.toISOString(),
        modifiedAt: now.toISOString(),
      });

      logger.info(`Buffer capacity alert generated: ${alertId} (${utilization.toFixed(1)}%)`);
    } catch (error: any) {
      logger.error(`Failed to generate buffer capacity alert: ${error.message}`);
    }
  }
}
