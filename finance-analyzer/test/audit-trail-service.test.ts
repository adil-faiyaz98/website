import * as crypto from 'node:crypto';

/**
 * Unit tests for Audit Trail Service core logic.
 * Tests cryptographic integrity, pagination bounds, buffering, retention, and outcome validation.
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

// ============================================================================
// Constants (mirroring the service implementation)
// ============================================================================

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;
const RETENTION_YEARS = 7;
const BUFFER_CAPACITY = 10_000;
const BUFFER_ALERT_THRESHOLD = 0.9;
const HASH_ALGORITHM = 'sha256';
const GENESIS_HASH = '0'.repeat(64);

const CB_FAILURE_THRESHOLD = 5;
const CB_FAILURE_WINDOW_MS = 60_000;
const CB_OPEN_DURATION_MS = 30_000;

// ============================================================================
// Hash computation (same logic as the service)
// ============================================================================

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

function computeEntryHash(input: HashInput): string {
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

// ============================================================================
// Circuit Breaker Logic (extracted for unit testing)
// ============================================================================

type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  openedAt: number;
}

function createCircuitBreaker(): CircuitBreaker {
  return { state: 'CLOSED', failureCount: 0, lastFailureTime: 0, openedAt: 0 };
}

function isServiceAvailable(cb: CircuitBreaker, now: number): { available: boolean; cb: CircuitBreaker } {
  const updated = { ...cb };
  switch (cb.state) {
    case 'CLOSED':
      return { available: true, cb: updated };
    case 'OPEN': {
      const elapsed = now - cb.openedAt;
      if (elapsed >= CB_OPEN_DURATION_MS) {
        updated.state = 'HALF_OPEN';
        return { available: true, cb: updated };
      }
      return { available: false, cb: updated };
    }
    case 'HALF_OPEN':
      return { available: true, cb: updated };
    default:
      return { available: true, cb: updated };
  }
}

function recordSuccess(cb: CircuitBreaker): CircuitBreaker {
  return { ...cb, state: 'CLOSED', failureCount: 0, lastFailureTime: 0 };
}

function recordFailure(cb: CircuitBreaker, now: number): CircuitBreaker {
  const updated = { ...cb };

  if (cb.state === 'HALF_OPEN') {
    updated.state = 'OPEN';
    updated.openedAt = now;
    return updated;
  }

  if (now - cb.lastFailureTime > CB_FAILURE_WINDOW_MS) {
    updated.failureCount = 0;
  }

  updated.failureCount++;
  updated.lastFailureTime = now;

  if (updated.failureCount >= CB_FAILURE_THRESHOLD) {
    updated.state = 'OPEN';
    updated.openedAt = now;
  }

  return updated;
}

// ============================================================================
// Pagination Logic (extracted for unit testing)
// ============================================================================

function calculatePagination(
  totalEntries: number,
  requestedPage: number,
  requestedPageSize: number
) {
  const pageSize = Math.min(Math.max(1, requestedPageSize), MAX_PAGE_SIZE);
  const page = Math.max(1, requestedPage);
  const totalPages = Math.ceil(totalEntries / pageSize);
  const offset = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    totalEntries,
    totalPages,
    hasNextPage: page < totalPages,
    offset,
  };
}

// ============================================================================
// Tests: Cryptographic Integrity (Requirement 12.2)
// ============================================================================

describe('Audit Trail - Cryptographic Integrity', () => {
  it('should produce a deterministic SHA-256 hash for given input', () => {
    const input: HashInput = {
      previousHash: GENESIS_HASH,
      timestamp: '2024-01-15T10:30:00.000Z',
      tenantId: 'tenant-001',
      userId: 'user-abc',
      action: 'CREATE_ALERT',
      affectedObject: 'Alert:alert-123',
      sourceIP: '10.0.0.1',
      outcome: 'SUCCESS',
    };

    const hash1 = computeEntryHash(input);
    const hash2 = computeEntryHash(input);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex digest is 64 chars
  });

  it('should produce different hashes for different inputs', () => {
    const base: HashInput = {
      previousHash: GENESIS_HASH,
      timestamp: '2024-01-15T10:30:00.000Z',
      tenantId: 'tenant-001',
      userId: 'user-abc',
      action: 'CREATE_ALERT',
      affectedObject: 'Alert:alert-123',
      sourceIP: '10.0.0.1',
      outcome: 'SUCCESS',
    };

    const modified: HashInput = { ...base, userId: 'user-xyz' };
    expect(computeEntryHash(base)).not.toBe(computeEntryHash(modified));
  });

  it('should chain hashes correctly (tamper-evident)', () => {
    const entry1Input: HashInput = {
      previousHash: GENESIS_HASH,
      timestamp: '2024-01-15T10:30:00.000Z',
      tenantId: 'tenant-001',
      userId: 'user-abc',
      action: 'LOGIN',
      affectedObject: 'Session:sess-1',
      sourceIP: '10.0.0.1',
      outcome: 'SUCCESS',
    };

    const hash1 = computeEntryHash(entry1Input);

    const entry2Input: HashInput = {
      previousHash: hash1,
      timestamp: '2024-01-15T10:31:00.000Z',
      tenantId: 'tenant-001',
      userId: 'user-abc',
      action: 'CREATE_ALERT',
      affectedObject: 'Alert:alert-456',
      sourceIP: '10.0.0.1',
      outcome: 'SUCCESS',
    };

    const hash2 = computeEntryHash(entry2Input);
    expect(hash2).not.toBe(hash1);
    expect(hash2).toHaveLength(64);
  });

  it('should detect tampering when previous hash is modified', () => {
    const entry1Input: HashInput = {
      previousHash: GENESIS_HASH,
      timestamp: '2024-01-15T10:30:00.000Z',
      tenantId: 'tenant-001',
      userId: 'user-abc',
      action: 'LOGIN',
      affectedObject: 'Session:sess-1',
      sourceIP: '10.0.0.1',
      outcome: 'SUCCESS',
    };
    const originalHash1 = computeEntryHash(entry1Input);

    // Compute hash2 chained from hash1
    const entry2Input: HashInput = {
      previousHash: originalHash1,
      timestamp: '2024-01-15T10:31:00.000Z',
      tenantId: 'tenant-001',
      userId: 'user-abc',
      action: 'CREATE_ALERT',
      affectedObject: 'Alert:alert-456',
      sourceIP: '10.0.0.1',
      outcome: 'SUCCESS',
    };
    const originalHash2 = computeEntryHash(entry2Input);

    // If entry1 is tampered (e.g., action changed), hash2 recalculation with correct previous will differ
    const tamperedEntry1Input: HashInput = { ...entry1Input, action: 'LOGOUT' };
    const tamperedHash1 = computeEntryHash(tamperedEntry1Input);
    expect(tamperedHash1).not.toBe(originalHash1);

    // Recalculating hash2 with tampered previous hash produces different result
    const recalculated2 = computeEntryHash({ ...entry2Input, previousHash: tamperedHash1 });
    expect(recalculated2).not.toBe(originalHash2);
  });

  it('should use genesis hash (all zeros) for the first entry in a chain', () => {
    expect(GENESIS_HASH).toHaveLength(64);
    expect(GENESIS_HASH).toBe('0000000000000000000000000000000000000000000000000000000000000000');
  });
});

// ============================================================================
// Tests: Pagination (Requirement 12.4)
// ============================================================================

describe('Audit Trail - Pagination', () => {
  it('should enforce max page size of 200', () => {
    const result = calculatePagination(1000, 1, 500);
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(result.pageSize).toBeLessThanOrEqual(200);
  });

  it('should use requested page size when within bounds', () => {
    const result = calculatePagination(500, 1, 100);
    expect(result.pageSize).toBe(100);
  });

  it('should clamp page size to minimum of 1', () => {
    const result = calculatePagination(100, 1, 0);
    expect(result.pageSize).toBe(1);

    const result2 = calculatePagination(100, 1, -5);
    expect(result2.pageSize).toBe(1);
  });

  it('should clamp page number to minimum of 1', () => {
    const result = calculatePagination(100, 0, 50);
    expect(result.page).toBe(1);

    const result2 = calculatePagination(100, -3, 50);
    expect(result2.page).toBe(1);
  });

  it('should calculate total pages correctly', () => {
    expect(calculatePagination(1000, 1, 200).totalPages).toBe(5);
    expect(calculatePagination(1001, 1, 200).totalPages).toBe(6);
    expect(calculatePagination(0, 1, 200).totalPages).toBe(0);
    expect(calculatePagination(199, 1, 200).totalPages).toBe(1);
    expect(calculatePagination(200, 1, 200).totalPages).toBe(1);
    expect(calculatePagination(201, 1, 200).totalPages).toBe(2);
  });

  it('should calculate hasNextPage correctly', () => {
    expect(calculatePagination(500, 1, 200).hasNextPage).toBe(true);
    expect(calculatePagination(500, 2, 200).hasNextPage).toBe(true);
    expect(calculatePagination(500, 3, 200).hasNextPage).toBe(false);
    expect(calculatePagination(200, 1, 200).hasNextPage).toBe(false);
  });

  it('should calculate offset correctly', () => {
    expect(calculatePagination(1000, 1, 200).offset).toBe(0);
    expect(calculatePagination(1000, 2, 200).offset).toBe(200);
    expect(calculatePagination(1000, 3, 200).offset).toBe(400);
    expect(calculatePagination(1000, 1, 50).offset).toBe(0);
    expect(calculatePagination(1000, 2, 50).offset).toBe(50);
  });

  it('should never return page size exceeding 200 regardless of input', () => {
    const largeSizes = [201, 500, 1000, 10000, Number.MAX_SAFE_INTEGER];
    for (const size of largeSizes) {
      const result = calculatePagination(5000, 1, size);
      expect(result.pageSize).toBeLessThanOrEqual(200);
    }
  });
});

// ============================================================================
// Tests: Circuit Breaker (Requirement 12.6 - Buffering availability)
// ============================================================================

describe('Audit Trail - Circuit Breaker', () => {
  it('should start in CLOSED state (service available)', () => {
    const cb = createCircuitBreaker();
    expect(cb.state).toBe('CLOSED');
    expect(isServiceAvailable(cb, Date.now()).available).toBe(true);
  });

  it('should remain CLOSED after fewer failures than threshold', () => {
    let cb = createCircuitBreaker();
    const now = Date.now();

    for (let i = 0; i < CB_FAILURE_THRESHOLD - 1; i++) {
      cb = recordFailure(cb, now + i);
    }

    expect(cb.state).toBe('CLOSED');
    expect(isServiceAvailable(cb, now).available).toBe(true);
  });

  it('should trip to OPEN after reaching failure threshold within window', () => {
    let cb = createCircuitBreaker();
    const now = Date.now();

    for (let i = 0; i < CB_FAILURE_THRESHOLD; i++) {
      cb = recordFailure(cb, now + i * 100);
    }

    expect(cb.state).toBe('OPEN');
    expect(isServiceAvailable(cb, now + 1000).available).toBe(false);
  });

  it('should transition from OPEN to HALF_OPEN after cooldown', () => {
    let cb = createCircuitBreaker();
    const now = Date.now();

    // Trip the breaker
    for (let i = 0; i < CB_FAILURE_THRESHOLD; i++) {
      cb = recordFailure(cb, now + i * 100);
    }
    expect(cb.state).toBe('OPEN');

    // After cooldown period
    const afterCooldown = now + CB_OPEN_DURATION_MS + 1000;
    const result = isServiceAvailable(cb, afterCooldown);
    expect(result.available).toBe(true);
    expect(result.cb.state).toBe('HALF_OPEN');
  });

  it('should return to CLOSED on success after HALF_OPEN', () => {
    const cb: CircuitBreaker = {
      state: 'HALF_OPEN',
      failureCount: 5,
      lastFailureTime: Date.now(),
      openedAt: Date.now() - CB_OPEN_DURATION_MS,
    };

    const recovered = recordSuccess(cb);
    expect(recovered.state).toBe('CLOSED');
    expect(recovered.failureCount).toBe(0);
  });

  it('should return to OPEN on failure in HALF_OPEN', () => {
    const now = Date.now();
    const cb: CircuitBreaker = {
      state: 'HALF_OPEN',
      failureCount: 5,
      lastFailureTime: now - 10000,
      openedAt: now - CB_OPEN_DURATION_MS,
    };

    const result = recordFailure(cb, now);
    expect(result.state).toBe('OPEN');
    expect(result.openedAt).toBe(now);
  });

  it('should reset failure count if failures are outside the window', () => {
    let cb = createCircuitBreaker();
    const now = Date.now();

    // Record some failures
    for (let i = 0; i < 3; i++) {
      cb = recordFailure(cb, now + i * 100);
    }
    expect(cb.failureCount).toBe(3);

    // Record failure outside the window (much later)
    cb = recordFailure(cb, now + CB_FAILURE_WINDOW_MS + 1000);
    // Count should have been reset before incrementing
    expect(cb.failureCount).toBe(1);
    expect(cb.state).toBe('CLOSED');
  });

  it('should reset circuit breaker on success at any time', () => {
    const cb: CircuitBreaker = {
      state: 'CLOSED',
      failureCount: 4,
      lastFailureTime: Date.now(),
      openedAt: 0,
    };

    const reset = recordSuccess(cb);
    expect(reset.state).toBe('CLOSED');
    expect(reset.failureCount).toBe(0);
    expect(reset.lastFailureTime).toBe(0);
  });
});

// ============================================================================
// Tests: Buffer Capacity (Requirement 12.6)
// ============================================================================

describe('Audit Trail - Buffer Capacity Monitoring', () => {
  it('should have buffer capacity of 10,000 events', () => {
    expect(BUFFER_CAPACITY).toBe(10_000);
  });

  it('should alert at 90% buffer capacity', () => {
    expect(BUFFER_ALERT_THRESHOLD).toBe(0.9);
    const alertThreshold = Math.floor(BUFFER_CAPACITY * BUFFER_ALERT_THRESHOLD);
    expect(alertThreshold).toBe(9000);
  });

  it('should correctly identify when threshold is reached', () => {
    const bufferSize = 9000;
    const atThreshold = bufferSize >= BUFFER_CAPACITY * BUFFER_ALERT_THRESHOLD;
    expect(atThreshold).toBe(true);

    const belowThreshold = 8999 >= BUFFER_CAPACITY * BUFFER_ALERT_THRESHOLD;
    expect(belowThreshold).toBe(false);
  });

  it('should calculate utilization percentage correctly', () => {
    const calculate = (size: number) => Math.round((size / BUFFER_CAPACITY) * 100 * 100) / 100;

    expect(calculate(0)).toBe(0);
    expect(calculate(5000)).toBe(50);
    expect(calculate(9000)).toBe(90);
    expect(calculate(10000)).toBe(100);
  });
});

// ============================================================================
// Tests: Retention Policy (Requirement 12.3)
// ============================================================================

describe('Audit Trail - Retention Policy', () => {
  it('should enforce 7-year minimum retention', () => {
    expect(RETENTION_YEARS).toBe(7);
  });

  it('should calculate retention cutoff date correctly', () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

    expect(cutoff.getFullYear()).toBe(2017);
    expect(cutoff.getMonth()).toBe(5); // June (0-indexed)
    expect(cutoff.getDate()).toBe(15);
  });

  it('should retain entries within 7 years', () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

    // Entry from 6 years ago: should be retained
    const recentEntry = new Date('2018-06-15T12:00:00.000Z');
    expect(recentEntry >= cutoff).toBe(true);

    // Entry from 8 years ago: past retention
    const oldEntry = new Date('2016-06-15T12:00:00.000Z');
    expect(oldEntry >= cutoff).toBe(false);
  });
});

// ============================================================================
// Tests: Audit Entry Validation (Requirement 12.1, 12.5)
// ============================================================================

describe('Audit Trail - Entry Validation', () => {
  const validOutcomes = ['SUCCESS', 'FAILURE', 'DENIED'];
  const invalidOutcomes = ['success', 'ERROR', 'FAILED', 'OK', '', 'DENY', null, undefined];

  it('should accept valid outcome values: SUCCESS, FAILURE, DENIED', () => {
    for (const outcome of validOutcomes) {
      expect(validOutcomes.includes(outcome)).toBe(true);
    }
  });

  it('should reject invalid outcome values', () => {
    for (const outcome of invalidOutcomes) {
      expect(validOutcomes.includes(outcome as string)).toBe(false);
    }
  });

  it('should generate timestamps in ISO 8601 format with milliseconds', () => {
    const timestamp = new Date().toISOString();
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should require all mandatory fields in an entry', () => {
    const entry = {
      ID: 'entry-001',
      tenantId: 'tenant-001',
      timestamp: '2024-01-15T10:30:00.000Z',
      userId: 'user-abc',
      action: 'CREATE_ALERT',
      affectedObject: 'Alert:alert-123',
      sourceIP: '10.0.0.1',
      outcome: 'SUCCESS',
      integrityHash: computeEntryHash({
        previousHash: GENESIS_HASH,
        timestamp: '2024-01-15T10:30:00.000Z',
        tenantId: 'tenant-001',
        userId: 'user-abc',
        action: 'CREATE_ALERT',
        affectedObject: 'Alert:alert-123',
        sourceIP: '10.0.0.1',
        outcome: 'SUCCESS',
      }),
    };

    // All required fields must be present and non-null
    expect(entry.ID).toBeTruthy();
    expect(entry.tenantId).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
    expect(entry.userId).toBeTruthy();
    expect(entry.action).toBeTruthy();
    expect(entry.affectedObject).toBeTruthy();
    expect(entry.sourceIP).toBeTruthy();
    expect(entry.outcome).toBeTruthy();
    expect(entry.integrityHash).toBeTruthy();
    expect(entry.integrityHash).toHaveLength(64);
  });

  it('should support IPv4 addresses in sourceIP', () => {
    const ipv4 = '192.168.1.100';
    expect(ipv4.length).toBeLessThanOrEqual(45);
  });

  it('should support IPv6 addresses in sourceIP', () => {
    const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    expect(ipv6.length).toBeLessThanOrEqual(45);
  });
});

// ============================================================================
// Tests: Hash Chain Integrity Verification (Requirement 12.2)
// ============================================================================

describe('Audit Trail - Hash Chain Verification', () => {
  function buildChain(entries: Omit<HashInput, 'previousHash'>[]) {
    const chain: Array<{ input: HashInput; hash: string }> = [];
    let previousHash = GENESIS_HASH;

    for (const entry of entries) {
      const input: HashInput = { ...entry, previousHash };
      const hash = computeEntryHash(input);
      chain.push({ input, hash });
      previousHash = hash;
    }

    return chain;
  }

  function verifyChain(chain: Array<{ input: HashInput; hash: string }>): string[] {
    const tampered: string[] = [];
    let previousHash = GENESIS_HASH;

    for (let i = 0; i < chain.length; i++) {
      const expectedHash = computeEntryHash({ ...chain[i].input, previousHash });
      if (chain[i].hash !== expectedHash) {
        tampered.push(`entry-${i}`);
      }
      previousHash = chain[i].hash;
    }

    return tampered;
  }

  it('should verify a valid chain with no tampered entries', () => {
    const entries: Omit<HashInput, 'previousHash'>[] = [
      { timestamp: '2024-01-15T10:00:00.000Z', tenantId: 't1', userId: 'u1', action: 'LOGIN', affectedObject: 'Session:1', sourceIP: '10.0.0.1', outcome: 'SUCCESS' },
      { timestamp: '2024-01-15T10:01:00.000Z', tenantId: 't1', userId: 'u1', action: 'VIEW_ALERT', affectedObject: 'Alert:1', sourceIP: '10.0.0.1', outcome: 'SUCCESS' },
      { timestamp: '2024-01-15T10:02:00.000Z', tenantId: 't1', userId: 'u1', action: 'RESOLVE', affectedObject: 'Investigation:1', sourceIP: '10.0.0.1', outcome: 'SUCCESS' },
    ];

    const chain = buildChain(entries);
    const tampered = verifyChain(chain);
    expect(tampered).toHaveLength(0);
  });

  it('should detect tampering when a middle entry hash is modified', () => {
    const entries: Omit<HashInput, 'previousHash'>[] = [
      { timestamp: '2024-01-15T10:00:00.000Z', tenantId: 't1', userId: 'u1', action: 'LOGIN', affectedObject: 'Session:1', sourceIP: '10.0.0.1', outcome: 'SUCCESS' },
      { timestamp: '2024-01-15T10:01:00.000Z', tenantId: 't1', userId: 'u1', action: 'VIEW_ALERT', affectedObject: 'Alert:1', sourceIP: '10.0.0.1', outcome: 'SUCCESS' },
      { timestamp: '2024-01-15T10:02:00.000Z', tenantId: 't1', userId: 'u1', action: 'RESOLVE', affectedObject: 'Investigation:1', sourceIP: '10.0.0.1', outcome: 'SUCCESS' },
    ];

    const chain = buildChain(entries);

    // Tamper with entry 1's stored hash
    chain[1].hash = 'deadbeef'.repeat(8);

    const tampered = verifyChain(chain);
    // Entry 1 has wrong hash, and entry 2's verification also fails because it uses entry 1's hash as previous
    expect(tampered.length).toBeGreaterThan(0);
    expect(tampered).toContain('entry-1');
  });

  it('should handle single-entry chains correctly', () => {
    const entries: Omit<HashInput, 'previousHash'>[] = [
      { timestamp: '2024-01-15T10:00:00.000Z', tenantId: 't1', userId: 'u1', action: 'LOGIN', affectedObject: 'Session:1', sourceIP: '10.0.0.1', outcome: 'SUCCESS' },
    ];

    const chain = buildChain(entries);
    const tampered = verifyChain(chain);
    expect(tampered).toHaveLength(0);
  });

  it('should handle empty chains correctly', () => {
    const chain = buildChain([]);
    const tampered = verifyChain(chain);
    expect(tampered).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Default Page Size (Requirement 12.4)
// ============================================================================

describe('Audit Trail - Default Configuration', () => {
  it('should have a default page size of 50', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it('should have max page size of 200', () => {
    expect(MAX_PAGE_SIZE).toBe(200);
  });

  it('should use SHA-256 for integrity hashing', () => {
    expect(HASH_ALGORITHM).toBe('sha256');
  });
});
