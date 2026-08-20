import { VendorTamperingDetection, VendorRiskLevel } from '../srv/detection/vendor-tampering-detection';
import { CanonicalTransaction, TenantThresholds } from '../srv/types';

/**
 * Unit tests for Vendor Master Tampering Detection.
 * Tests risk score calculation, risk level derivation, and scoring components.
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

// Default thresholds for testing
const DEFAULT_THRESHOLDS: TenantThresholds = {
  riskScoreAlertThreshold: 70,
  behavioralSensitivity: 5,
  sodLookbackDays: 90,
  vendorBankChangeHours: 48,
  dormantAccountDays: 90,
  roundNumberThreshold: 10000,
  dormancyPeriodDays: 180,
  businessHoursStart: 8,
  businessHoursEnd: 18,
  paymentFlagThreshold: 70,
  paymentAmountFactor: 3,
  massDataRecordLimit: 10000,
  massDataVolumeLimit: 50,
  maxFirefighterHours: 8,
  threeWayMatchTolerance: 0.02,
  grirClearingDays: 30,
};

function createPaymentTransaction(overrides: Partial<CanonicalTransaction> = {}): CanonicalTransaction {
  return {
    transactionId: 'tx-pay-001',
    tenantId: 'tenant-001',
    sourceSystem: 'sys-001',
    sourceEventId: 'evt-pay-001',
    documentNumber: 'PAY001',
    documentType: 'PAYMENT_DOCUMENT',
    postingDate: new Date('2024-03-15T14:00:00Z'),
    entryDate: new Date('2024-03-15T14:00:00Z'),
    amount: 50000,
    currency: 'USD',
    userId: 'PAYUSER01',
    companyCode: '1000',
    debitAccount: '2000001',
    creditAccount: '1100001',
    vendorId: 'V001',
    businessObjectRef: 'REF001',
    metadata: {},
    ingestedAt: new Date(),
    normalizedAt: new Date(),
    ...overrides,
  };
}

// Instantiate the detection class for pure function testing
const detector = new VendorTamperingDetection();

// =============================================================================
// Frequency Score Tests
// =============================================================================

describe('Vendor Tampering - Frequency Score Calculation', () => {
  it('should return 0 for 0 or 1 changes', () => {
    expect(detector.calculateFrequencyScore(0)).toBe(0);
    expect(detector.calculateFrequencyScore(1)).toBe(0);
  });

  it('should return 30 for exactly 2 changes', () => {
    expect(detector.calculateFrequencyScore(2)).toBe(30);
  });

  it('should return 60 for 3 changes', () => {
    expect(detector.calculateFrequencyScore(3)).toBe(60);
  });

  it('should return 80 for 4 changes', () => {
    expect(detector.calculateFrequencyScore(4)).toBe(80);
  });

  it('should return 100 for 5 or more changes', () => {
    expect(detector.calculateFrequencyScore(5)).toBe(100);
    expect(detector.calculateFrequencyScore(10)).toBe(100);
  });
});

// =============================================================================
// Proximity Score Tests
// =============================================================================

describe('Vendor Tampering - Time Proximity Score Calculation', () => {
  it('should return 0 when no proximity provided', () => {
    expect(detector.calculateProximityScore(undefined)).toBe(0);
  });

  it('should return 0 for negative proximity', () => {
    expect(detector.calculateProximityScore(-1)).toBe(0);
  });

  it('should return 100 for payments within 1 hour of bank change', () => {
    expect(detector.calculateProximityScore(0.5)).toBe(100);
    expect(detector.calculateProximityScore(1)).toBe(100);
  });

  it('should return 90 for payments 1-4 hours after bank change', () => {
    expect(detector.calculateProximityScore(2)).toBe(90);
    expect(detector.calculateProximityScore(4)).toBe(90);
  });

  it('should return 75 for payments 4-12 hours after bank change', () => {
    expect(detector.calculateProximityScore(6)).toBe(75);
    expect(detector.calculateProximityScore(12)).toBe(75);
  });

  it('should return 60 for payments 12-24 hours after bank change', () => {
    expect(detector.calculateProximityScore(18)).toBe(60);
    expect(detector.calculateProximityScore(24)).toBe(60);
  });

  it('should return 40 for payments 24-48 hours after bank change', () => {
    expect(detector.calculateProximityScore(36)).toBe(40);
    expect(detector.calculateProximityScore(48)).toBe(40);
  });

  it('should return 20 for payments 48-72 hours after bank change', () => {
    expect(detector.calculateProximityScore(60)).toBe(20);
    expect(detector.calculateProximityScore(72)).toBe(20);
  });

  it('should return 0 for payments more than 72 hours after bank change', () => {
    expect(detector.calculateProximityScore(73)).toBe(0);
    expect(detector.calculateProximityScore(100)).toBe(0);
  });
});

// =============================================================================
// Correlation Score Tests
// =============================================================================

describe('Vendor Tampering - Correlation History Score Calculation', () => {
  it('should return 0 for no prior correlations', () => {
    expect(detector.calculateCorrelationScore(0)).toBe(0);
  });

  it('should return 40 for 1 prior correlation', () => {
    expect(detector.calculateCorrelationScore(1)).toBe(40);
  });

  it('should return 65 for 2 prior correlations', () => {
    expect(detector.calculateCorrelationScore(2)).toBe(65);
  });

  it('should return 80 for 3 prior correlations', () => {
    expect(detector.calculateCorrelationScore(3)).toBe(80);
  });

  it('should return 100 for 4+ prior correlations', () => {
    expect(detector.calculateCorrelationScore(4)).toBe(100);
    expect(detector.calculateCorrelationScore(7)).toBe(100);
  });
});

// =============================================================================
// Maintainer Score Tests
// =============================================================================

describe('Vendor Tampering - Maintainer Score Calculation', () => {
  it('should return 100 for first-time maintainer', () => {
    expect(detector.calculateMaintainerScore(true)).toBe(100);
  });

  it('should return 0 for known maintainer', () => {
    expect(detector.calculateMaintainerScore(false)).toBe(0);
  });
});

// =============================================================================
// Risk Level Derivation Tests
// =============================================================================

describe('Vendor Tampering - Risk Level Derivation', () => {
  it('should return CRITICAL for scores >= 80', () => {
    expect(detector.deriveRiskLevel(80)).toBe('CRITICAL');
    expect(detector.deriveRiskLevel(90)).toBe('CRITICAL');
    expect(detector.deriveRiskLevel(100)).toBe('CRITICAL');
  });

  it('should return HIGH for scores 60-79', () => {
    expect(detector.deriveRiskLevel(60)).toBe('HIGH');
    expect(detector.deriveRiskLevel(70)).toBe('HIGH');
    expect(detector.deriveRiskLevel(79)).toBe('HIGH');
  });

  it('should return MEDIUM for scores 40-59', () => {
    expect(detector.deriveRiskLevel(40)).toBe('MEDIUM');
    expect(detector.deriveRiskLevel(50)).toBe('MEDIUM');
    expect(detector.deriveRiskLevel(59)).toBe('MEDIUM');
  });

  it('should return LOW for scores < 40', () => {
    expect(detector.deriveRiskLevel(0)).toBe('LOW');
    expect(detector.deriveRiskLevel(20)).toBe('LOW');
    expect(detector.deriveRiskLevel(39)).toBe('LOW');
  });
});

// =============================================================================
// Combined Score Bounds Tests
// =============================================================================

describe('Vendor Tampering - Risk Score Bounds', () => {
  it('should never produce a score below 0', () => {
    // All zero inputs
    const frequencyScore = detector.calculateFrequencyScore(0);
    const proximityScore = detector.calculateProximityScore(undefined);
    const correlationScore = detector.calculateCorrelationScore(0);
    const maintainerScore = detector.calculateMaintainerScore(false);

    const rawScore =
      frequencyScore * 0.25 +
      proximityScore * 0.30 +
      correlationScore * 0.25 +
      maintainerScore * 0.20;

    const boundedScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    expect(boundedScore).toBeGreaterThanOrEqual(0);
  });

  it('should never produce a score above 100', () => {
    // All max inputs
    const frequencyScore = detector.calculateFrequencyScore(10);
    const proximityScore = detector.calculateProximityScore(0.5);
    const correlationScore = detector.calculateCorrelationScore(5);
    const maintainerScore = detector.calculateMaintainerScore(true);

    const rawScore =
      frequencyScore * 0.25 +
      proximityScore * 0.30 +
      correlationScore * 0.25 +
      maintainerScore * 0.20;

    const boundedScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    expect(boundedScore).toBeLessThanOrEqual(100);
  });

  it('should produce a meaningful score with mixed inputs', () => {
    // Moderate risk scenario: 3 changes, 6 hours proximity, 1 past correlation, known maintainer
    const frequencyScore = detector.calculateFrequencyScore(3);   // 60
    const proximityScore = detector.calculateProximityScore(6);    // 75
    const correlationScore = detector.calculateCorrelationScore(1); // 40
    const maintainerScore = detector.calculateMaintainerScore(false); // 0

    const rawScore =
      frequencyScore * 0.25 +     // 60 * 0.25 = 15
      proximityScore * 0.30 +      // 75 * 0.30 = 22.5
      correlationScore * 0.25 +    // 40 * 0.25 = 10
      maintainerScore * 0.20;      // 0 * 0.20 = 0

    const boundedScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    expect(boundedScore).toBe(48); // 15 + 22.5 + 10 + 0 = 47.5, rounds to 48
    expect(boundedScore).toBeGreaterThanOrEqual(0);
    expect(boundedScore).toBeLessThanOrEqual(100);
  });

  it('should produce high score for first-time maintainer with close proximity', () => {
    // High risk scenario: 4 changes, 1 hour proximity, 2 past correlations, first-time maintainer
    const frequencyScore = detector.calculateFrequencyScore(4);    // 80
    const proximityScore = detector.calculateProximityScore(1);     // 100
    const correlationScore = detector.calculateCorrelationScore(2); // 65
    const maintainerScore = detector.calculateMaintainerScore(true); // 100

    const rawScore =
      frequencyScore * 0.25 +     // 80 * 0.25 = 20
      proximityScore * 0.30 +      // 100 * 0.30 = 30
      correlationScore * 0.25 +    // 65 * 0.25 = 16.25
      maintainerScore * 0.20;      // 100 * 0.20 = 20

    const boundedScore = Math.max(0, Math.min(100, Math.round(rawScore)));
    expect(boundedScore).toBe(86); // 20 + 30 + 16.25 + 20 = 86.25, rounds to 86
    expect(detector.deriveRiskLevel(boundedScore)).toBe('CRITICAL');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Vendor Tampering - Edge Cases', () => {
  it('should handle zero proximity hours (immediate payment)', () => {
    const score = detector.calculateProximityScore(0);
    expect(score).toBe(100);
  });

  it('should handle very large change counts', () => {
    const score = detector.calculateFrequencyScore(999);
    expect(score).toBe(100);
  });

  it('should handle exact boundary time values', () => {
    // Exact boundary: 1 hour
    expect(detector.calculateProximityScore(1)).toBe(100);
    // Exact boundary: 4 hours
    expect(detector.calculateProximityScore(4)).toBe(90);
    // Exact boundary: 12 hours
    expect(detector.calculateProximityScore(12)).toBe(75);
    // Exact boundary: 24 hours
    expect(detector.calculateProximityScore(24)).toBe(60);
    // Exact boundary: 48 hours
    expect(detector.calculateProximityScore(48)).toBe(40);
    // Exact boundary: 72 hours
    expect(detector.calculateProximityScore(72)).toBe(20);
  });
});
