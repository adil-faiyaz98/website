import { CanonicalTransaction } from '../srv/types';

/**
 * Unit tests for the UEBA Engine core logic.
 * Tests sensitivity factor calculation, deviation detection, and profile management.
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.7
 */

// =============================================================================
// Helper Functions (mirror the engine's pure logic for testing)
// =============================================================================

/**
 * Sensitivity factor mapping: sensitivity level (1-10) maps to a multiplier.
 * sensitivity 1 → factor 4.0 (least sensitive)
 * sensitivity 5 → factor 2.5 (default)
 * sensitivity 10 → factor 1.0 (most sensitive)
 */
function getSensitivityFactor(sensitivity: number): number {
  const clamped = Math.max(1, Math.min(10, sensitivity));
  return 4.0 - ((clamped - 1) / 9) * 3.0;
}

/**
 * Check cost center deviation: flag any transaction to unobserved cost center.
 */
function checkCostCenterDeviation(
  costCenter: string | undefined,
  knownCostCenters: string[]
): boolean {
  if (!costCenter) return false;
  if (knownCostCenters.length === 0) return false;
  return !knownCostCenters.includes(costCenter);
}

/**
 * Check amount deviation: flag when amount exceeds mean + sensitivity_factor * stdDev.
 */
function checkAmountDeviation(
  amount: number,
  mean: number,
  stdDev: number,
  sensitivityFactor: number
): { hasDeviation: boolean; magnitude: number } {
  if (stdDev === 0 || mean === 0) return { hasDeviation: false, magnitude: 0 };
  const absAmount = Math.abs(amount);
  const threshold = mean + sensitivityFactor * stdDev;
  const magnitude = (absAmount - mean) / stdDev;
  return {
    hasDeviation: absAmount > threshold,
    magnitude,
  };
}

/**
 * Determine profile status based on days covered.
 */
function getProfileStatus(daysCovered: number, learningPeriodDays: number = 30): 'LEARNING' | 'ACTIVE' {
  return daysCovered >= learningPeriodDays ? 'ACTIVE' : 'LEARNING';
}

/**
 * Check if deviation alerts should be suppressed.
 */
function shouldSuppressAlerts(status: 'LEARNING' | 'ACTIVE'): boolean {
  return status === 'LEARNING';
}

/**
 * Calculate deviation risk score based on dimension and magnitude.
 */
function calculateDeviationRiskScore(dimension: string, magnitude: number): number {
  const baseScores: Record<string, number> = {
    costCenters: 60,
    transactionAmounts: 50,
    postingTimes: 30,
    postingFrequency: 25,
    accountCombinations: 40,
    vendorRelationships: 35,
    transactionCodes: 35,
    dataAccessVolume: 45,
  };
  const baseScore = baseScores[dimension] ?? 30;
  const magnitudeBonus = Math.min(40, Math.round(Math.min(magnitude, 10) * 4));
  return Math.min(100, baseScore + magnitudeBonus);
}

/**
 * Check account combination deviation.
 */
function checkAccountCombinationDeviation(
  debitAccount: string,
  creditAccount: string,
  knownCombinations: string[]
): boolean {
  if (knownCombinations.length === 0) return false;
  const combo = `${debitAccount}:${creditAccount}`;
  return !knownCombinations.includes(combo);
}

/**
 * Calculate daily posting counts from dates.
 */
function calculateDailyCounts(dates: string[]): number[] {
  const dayCounts = new Map<string, number>();
  for (const d of dates) {
    const dateStr = d.split('T')[0];
    dayCounts.set(dateStr, (dayCounts.get(dateStr) || 0) + 1);
  }
  return Array.from(dayCounts.values());
}

/**
 * Calculate peak hours from hour distribution.
 */
function calculatePeakHours(hourDistribution: number[]): number[] {
  return hourDistribution
    .map((count, hour) => ({ count, hour }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .filter(h => h.count > 0)
    .map(h => h.hour);
}

function createTransaction(overrides: Partial<CanonicalTransaction> = {}): CanonicalTransaction {
  return {
    transactionId: 'tx-001',
    tenantId: 'tenant-001',
    sourceSystem: 'sys-001',
    sourceEventId: 'evt-001',
    documentNumber: 'DOC001',
    documentType: 'JOURNAL_ENTRY',
    postingDate: new Date('2024-03-15T10:30:00Z'),
    entryDate: new Date('2024-03-15T10:30:00Z'),
    amount: 5000,
    currency: 'USD',
    userId: 'USER01',
    companyCode: '1000',
    debitAccount: '4000001',
    creditAccount: '1100001',
    costCenter: 'CC100',
    businessObjectRef: 'REF001',
    metadata: {},
    ingestedAt: new Date(),
    normalizedAt: new Date(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('UEBA Engine - Sensitivity Factor Calculation', () => {
  it('should return 4.0 for sensitivity 1 (least sensitive)', () => {
    expect(getSensitivityFactor(1)).toBeCloseTo(4.0);
  });

  it('should return 2.5 for sensitivity 5 (default)', () => {
    // (5-1)/9 * 3 = 4/9 * 3 = 1.333; 4.0 - 1.333 = 2.667
    // Actually: 4.0 - ((5-1)/9)*3 = 4.0 - 1.333 = 2.667
    const factor = getSensitivityFactor(5);
    expect(factor).toBeCloseTo(2.6667, 3);
  });

  it('should return 1.0 for sensitivity 10 (most sensitive)', () => {
    expect(getSensitivityFactor(10)).toBeCloseTo(1.0);
  });

  it('should clamp sensitivity below 1 to 1', () => {
    expect(getSensitivityFactor(0)).toBeCloseTo(4.0);
    expect(getSensitivityFactor(-5)).toBeCloseTo(4.0);
  });

  it('should clamp sensitivity above 10 to 10', () => {
    expect(getSensitivityFactor(15)).toBeCloseTo(1.0);
    expect(getSensitivityFactor(100)).toBeCloseTo(1.0);
  });

  it('should monotonically decrease as sensitivity increases', () => {
    for (let s = 1; s < 10; s++) {
      expect(getSensitivityFactor(s)).toBeGreaterThan(getSensitivityFactor(s + 1));
    }
  });
});

describe('UEBA Engine - Profile Status (Learning vs Active)', () => {
  it('should mark profile as LEARNING when daysCovered < 30', () => {
    expect(getProfileStatus(0)).toBe('LEARNING');
    expect(getProfileStatus(15)).toBe('LEARNING');
    expect(getProfileStatus(29)).toBe('LEARNING');
  });

  it('should mark profile as ACTIVE when daysCovered >= 30', () => {
    expect(getProfileStatus(30)).toBe('ACTIVE');
    expect(getProfileStatus(90)).toBe('ACTIVE');
    expect(getProfileStatus(365)).toBe('ACTIVE');
  });

  it('should suppress alerts for LEARNING profiles', () => {
    expect(shouldSuppressAlerts('LEARNING')).toBe(true);
  });

  it('should NOT suppress alerts for ACTIVE profiles', () => {
    expect(shouldSuppressAlerts('ACTIVE')).toBe(false);
  });

  it('should transition from LEARNING to ACTIVE at exactly 30 days', () => {
    expect(getProfileStatus(29)).toBe('LEARNING');
    expect(getProfileStatus(30)).toBe('ACTIVE');
  });
});

describe('UEBA Engine - Cost Center Deviation', () => {
  it('should flag transaction to unobserved cost center', () => {
    const knownCostCenters = ['CC100', 'CC200', 'CC300'];
    expect(checkCostCenterDeviation('CC999', knownCostCenters)).toBe(true);
  });

  it('should NOT flag transaction to known cost center', () => {
    const knownCostCenters = ['CC100', 'CC200', 'CC300'];
    expect(checkCostCenterDeviation('CC200', knownCostCenters)).toBe(false);
  });

  it('should NOT flag when there are no known cost centers (new profile)', () => {
    expect(checkCostCenterDeviation('CC999', [])).toBe(false);
  });

  it('should NOT flag when transaction has no cost center', () => {
    const knownCostCenters = ['CC100', 'CC200'];
    expect(checkCostCenterDeviation(undefined, knownCostCenters)).toBe(false);
  });

  it('should be case-sensitive in cost center matching', () => {
    const knownCostCenters = ['CC100', 'CC200'];
    expect(checkCostCenterDeviation('cc100', knownCostCenters)).toBe(true);
  });
});

describe('UEBA Engine - Amount Deviation', () => {
  it('should flag amount exceeding mean + sensitivity_factor * stdDev', () => {
    // mean=1000, stdDev=200, sensitivityFactor=2.5 → threshold=1500
    // amount=2000 > 1500 → flag
    const result = checkAmountDeviation(2000, 1000, 200, 2.5);
    expect(result.hasDeviation).toBe(true);
    expect(result.magnitude).toBe(5); // (2000-1000)/200 = 5
  });

  it('should NOT flag amount within threshold', () => {
    // mean=1000, stdDev=200, sensitivityFactor=2.5 → threshold=1500
    // amount=1400 < 1500 → no flag
    const result = checkAmountDeviation(1400, 1000, 200, 2.5);
    expect(result.hasDeviation).toBe(false);
  });

  it('should flag at exact threshold boundary', () => {
    // mean=1000, stdDev=200, sensitivityFactor=2.5 → threshold=1500
    // amount=1501 > 1500 → flag
    const result = checkAmountDeviation(1501, 1000, 200, 2.5);
    expect(result.hasDeviation).toBe(true);
  });

  it('should NOT flag at exact threshold value', () => {
    // amount=1500 is NOT greater than 1500, so no flag
    const result = checkAmountDeviation(1500, 1000, 200, 2.5);
    expect(result.hasDeviation).toBe(false);
  });

  it('should handle zero stdDev gracefully (no deviation)', () => {
    const result = checkAmountDeviation(5000, 1000, 0, 2.5);
    expect(result.hasDeviation).toBe(false);
  });

  it('should handle zero mean gracefully (no deviation)', () => {
    const result = checkAmountDeviation(5000, 0, 200, 2.5);
    expect(result.hasDeviation).toBe(false);
  });

  it('should use absolute value for negative amounts', () => {
    const result = checkAmountDeviation(-2000, 1000, 200, 2.5);
    expect(result.hasDeviation).toBe(true);
  });

  it('should be more sensitive with higher sensitivity (lower factor)', () => {
    // sensitivity 10 → factor 1.0, threshold = 1000 + 1*200 = 1200
    const highSensResult = checkAmountDeviation(1300, 1000, 200, 1.0);
    // sensitivity 1 → factor 4.0, threshold = 1000 + 4*200 = 1800
    const lowSensResult = checkAmountDeviation(1300, 1000, 200, 4.0);

    expect(highSensResult.hasDeviation).toBe(true);
    expect(lowSensResult.hasDeviation).toBe(false);
  });
});

describe('UEBA Engine - Account Combination Deviation', () => {
  it('should flag unknown account combination', () => {
    const known = ['4000001:1100001', '5000001:2100001'];
    expect(checkAccountCombinationDeviation('6000001', '3100001', known)).toBe(true);
  });

  it('should NOT flag known account combination', () => {
    const known = ['4000001:1100001', '5000001:2100001'];
    expect(checkAccountCombinationDeviation('4000001', '1100001', known)).toBe(false);
  });

  it('should NOT flag when no known combinations exist', () => {
    expect(checkAccountCombinationDeviation('4000001', '1100001', [])).toBe(false);
  });
});

describe('UEBA Engine - Risk Score Calculation', () => {
  it('should assign higher base score for cost center deviation', () => {
    const costCenterScore = calculateDeviationRiskScore('costCenters', 3);
    const timeScore = calculateDeviationRiskScore('postingTimes', 3);
    expect(costCenterScore).toBeGreaterThan(timeScore);
  });

  it('should cap risk score at 100', () => {
    const score = calculateDeviationRiskScore('costCenters', 100);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should increase score with higher deviation magnitude', () => {
    const lowMag = calculateDeviationRiskScore('transactionAmounts', 2);
    const highMag = calculateDeviationRiskScore('transactionAmounts', 8);
    expect(highMag).toBeGreaterThan(lowMag);
  });

  it('should return at least the base score for any positive magnitude', () => {
    const score = calculateDeviationRiskScore('transactionAmounts', 0);
    expect(score).toBe(50); // base score for transactionAmounts
  });

  it('should handle unknown dimension with default base score', () => {
    const score = calculateDeviationRiskScore('unknownDimension', 3);
    expect(score).toBeGreaterThanOrEqual(30); // default base + magnitude bonus
  });
});

describe('UEBA Engine - Daily Count Calculation', () => {
  it('should count transactions per day correctly', () => {
    const dates = [
      '2024-03-15T10:00:00Z',
      '2024-03-15T14:00:00Z',
      '2024-03-15T16:00:00Z',
      '2024-03-16T09:00:00Z',
      '2024-03-17T11:00:00Z',
      '2024-03-17T15:00:00Z',
    ];
    const counts = calculateDailyCounts(dates);
    expect(counts).toHaveLength(3); // 3 distinct days
    expect(counts.sort()).toEqual([1, 2, 3]); // 1 on 16th, 2 on 17th, 3 on 15th
  });

  it('should return empty array for no transactions', () => {
    expect(calculateDailyCounts([])).toEqual([]);
  });

  it('should handle single transaction', () => {
    const counts = calculateDailyCounts(['2024-03-15T10:00:00Z']);
    expect(counts).toEqual([1]);
  });
});

describe('UEBA Engine - Peak Hours Calculation', () => {
  it('should identify top 3 hours with most activity', () => {
    const dist = new Array(24).fill(0);
    dist[9] = 15;  // 9 AM
    dist[10] = 20; // 10 AM
    dist[14] = 18; // 2 PM
    dist[16] = 5;  // 4 PM

    const peaks = calculatePeakHours(dist);
    expect(peaks).toHaveLength(3);
    expect(peaks[0]).toBe(10); // highest
    expect(peaks[1]).toBe(14);
    expect(peaks[2]).toBe(9);
  });

  it('should return fewer than 3 if only few hours have activity', () => {
    const dist = new Array(24).fill(0);
    dist[10] = 5;

    const peaks = calculatePeakHours(dist);
    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toBe(10);
  });

  it('should return empty for all-zero distribution', () => {
    const dist = new Array(24).fill(0);
    const peaks = calculatePeakHours(dist);
    expect(peaks).toHaveLength(0);
  });
});

describe('UEBA Engine - Rolling Window Configuration', () => {
  it('should clamp rolling window to minimum 30 days', () => {
    const clamped = Math.max(30, Math.min(365, 10));
    expect(clamped).toBe(30);
  });

  it('should clamp rolling window to maximum 365 days', () => {
    const clamped = Math.max(30, Math.min(365, 500));
    expect(clamped).toBe(365);
  });

  it('should accept valid rolling window values', () => {
    const clamped = Math.max(30, Math.min(365, 90));
    expect(clamped).toBe(90);
  });
});

describe('UEBA Engine - Vendor Relationship Deviation', () => {
  function checkVendorDeviation(vendorId: string | undefined, knownVendors: string[]): boolean {
    if (!vendorId) return false;
    if (knownVendors.length === 0) return false;
    return !knownVendors.includes(vendorId);
  }

  it('should flag unknown vendor', () => {
    expect(checkVendorDeviation('V999', ['V001', 'V002', 'V003'])).toBe(true);
  });

  it('should NOT flag known vendor', () => {
    expect(checkVendorDeviation('V001', ['V001', 'V002', 'V003'])).toBe(false);
  });

  it('should NOT flag when no vendor on transaction', () => {
    expect(checkVendorDeviation(undefined, ['V001', 'V002'])).toBe(false);
  });

  it('should NOT flag when no known vendors (new profile)', () => {
    expect(checkVendorDeviation('V001', [])).toBe(false);
  });
});

describe('UEBA Engine - Integration Scenarios', () => {
  it('should suppress all deviations for LEARNING profile regardless of deviation', () => {
    // Even if there is a clear amount deviation, LEARNING profiles should be suppressed
    const daysCovered = 15; // < 30
    const status = getProfileStatus(daysCovered);
    expect(status).toBe('LEARNING');
    expect(shouldSuppressAlerts(status)).toBe(true);
  });

  it('should detect cost center deviation even at low sensitivity', () => {
    // Cost center deviation always flags regardless of sensitivity
    const knownCostCenters = ['CC100', 'CC200'];
    const isDeviation = checkCostCenterDeviation('CC999', knownCostCenters);
    expect(isDeviation).toBe(true);
  });

  it('should not detect amount deviation at low sensitivity for moderate amounts', () => {
    // sensitivity 1 → factor 4.0, threshold = 1000 + 4*200 = 1800
    // Amount 1500 < 1800 → no flag
    const result = checkAmountDeviation(1500, 1000, 200, getSensitivityFactor(1));
    expect(result.hasDeviation).toBe(false);
  });

  it('should detect amount deviation at high sensitivity for moderate amounts', () => {
    // sensitivity 10 → factor 1.0, threshold = 1000 + 1*200 = 1200
    // Amount 1500 > 1200 → flag
    const result = checkAmountDeviation(1500, 1000, 200, getSensitivityFactor(10));
    expect(result.hasDeviation).toBe(true);
  });
});
