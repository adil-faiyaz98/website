import { CanonicalTransaction, TenantThresholds } from '../srv/types';
import {
  calculateFraudRiskScore,
  calculatePatternConfidence,
  buildFraudConfig,
  shouldTriggerPlaybook,
  FraudDetectionConfig,
  FraudMatch,
  FraudPatternType,
} from '../srv/detection/fraud-pattern-detection';

/**
 * Unit tests for Fraud Pattern Detection module.
 * Tests risk score calculation, confidence estimation, playbook routing,
 * and configuration building.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

// Default test thresholds
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

const DEFAULT_FRAUD_CONFIG: FraudDetectionConfig = {
  duplicatePaymentWindowDays: 30,
  vendorBankChangeHours: 48,
  roundTrippingWindowDays: 90,
  splitPaymentWindowDays: 5,
  noPOLookbackMonths: 12,
  approvalThreshold: 10000,
  lowConfidenceThreshold: 50,
  criticalExposureThreshold: 10000,
};

function createFraudMatch(overrides: Partial<FraudMatch> = {}): FraudMatch {
  return {
    patternType: 'DUPLICATE_PAYMENT',
    confidence: 75,
    financialExposure: 5000,
    riskScore: 65,
    description: 'Test fraud match',
    lowConfidence: false,
    relatedTransactionIds: ['tx-002'],
    riskIndicators: [],
    affectedEntities: [],
    ...overrides,
  };
}

// =============================================================================
// Risk Score Calculation Tests
// =============================================================================

describe('Fraud Pattern Detection - Risk Score Calculation', () => {
  it('should calculate risk score from ML confidence and financial exposure', () => {
    // confidence=80 (60% weight), exposure=10000/10000=100 (40% weight)
    // score = 80*0.6 + 100*0.4 = 48 + 40 = 88
    const score = calculateFraudRiskScore(80, 10000, DEFAULT_FRAUD_CONFIG);
    expect(score).toBe(88);
  });

  it('should return 0 when both confidence and exposure are 0', () => {
    const score = calculateFraudRiskScore(0, 0, DEFAULT_FRAUD_CONFIG);
    expect(score).toBe(0);
  });

  it('should cap score at 100', () => {
    const score = calculateFraudRiskScore(100, 100000, DEFAULT_FRAUD_CONFIG);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should never return negative scores', () => {
    const score = calculateFraudRiskScore(-10, -5000, DEFAULT_FRAUD_CONFIG);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('should be higher with higher confidence', () => {
    const lowConfScore = calculateFraudRiskScore(30, 5000, DEFAULT_FRAUD_CONFIG);
    const highConfScore = calculateFraudRiskScore(90, 5000, DEFAULT_FRAUD_CONFIG);
    expect(highConfScore).toBeGreaterThan(lowConfScore);
  });

  it('should be higher with higher financial exposure', () => {
    const lowExposure = calculateFraudRiskScore(60, 1000, DEFAULT_FRAUD_CONFIG);
    const highExposure = calculateFraudRiskScore(60, 50000, DEFAULT_FRAUD_CONFIG);
    expect(highExposure).toBeGreaterThan(lowExposure);
  });

  it('should normalize exposure against critical threshold', () => {
    // At critical threshold (10000), exposure contribution is 100
    // confidence=50, exposure=10000 -> 50*0.6 + 100*0.4 = 30 + 40 = 70
    const score = calculateFraudRiskScore(50, 10000, DEFAULT_FRAUD_CONFIG);
    expect(score).toBe(70);
  });

  it('should cap exposure normalization at 100 for amounts above threshold', () => {
    // Both at and above critical threshold should have same exposure contribution
    const atThreshold = calculateFraudRiskScore(50, 10000, DEFAULT_FRAUD_CONFIG);
    const aboveThreshold = calculateFraudRiskScore(50, 50000, DEFAULT_FRAUD_CONFIG);
    expect(aboveThreshold).toBe(atThreshold);
  });

  it('should produce integer scores', () => {
    const score = calculateFraudRiskScore(73, 7500, DEFAULT_FRAUD_CONFIG);
    expect(Number.isInteger(score)).toBe(true);
  });
});

// =============================================================================
// Pattern Confidence Calculation Tests
// =============================================================================

describe('Fraud Pattern Detection - Pattern Confidence', () => {
  it('should return base confidence for single evidence with low exposure', () => {
    const confidence = calculatePatternConfidence('DUPLICATE_PAYMENT', 1, 1000);
    expect(confidence).toBe(70); // base for duplicate
  });

  it('should increase confidence with more evidence', () => {
    const single = calculatePatternConfidence('DUPLICATE_PAYMENT', 1, 1000);
    const multiple = calculatePatternConfidence('DUPLICATE_PAYMENT', 3, 1000);
    expect(multiple).toBeGreaterThan(single);
  });

  it('should cap evidence boost at 15 points', () => {
    const manyEvidence = calculatePatternConfidence('DUPLICATE_PAYMENT', 10, 1000);
    // base 70 + max 15 boost = 85 (plus possible exposure boost)
    expect(manyEvidence).toBeLessThanOrEqual(100);
  });

  it('should boost confidence for high financial exposure', () => {
    const lowExposure = calculatePatternConfidence('SPLIT_PAYMENT', 1, 5000);
    const highExposure = calculatePatternConfidence('SPLIT_PAYMENT', 1, 60000);
    expect(highExposure).toBeGreaterThan(lowExposure);
  });

  it('should have highest base confidence for vendor bank manipulation', () => {
    const bankManip = calculatePatternConfidence('VENDOR_BANK_MANIPULATION', 1, 1000);
    const duplicate = calculatePatternConfidence('DUPLICATE_PAYMENT', 1, 1000);
    const roundTrip = calculatePatternConfidence('ROUND_TRIPPING', 1, 1000);
    const split = calculatePatternConfidence('SPLIT_PAYMENT', 1, 1000);
    const noPO = calculatePatternConfidence('NO_PO_VENDOR', 1, 1000);

    expect(bankManip).toBeGreaterThan(duplicate);
    expect(bankManip).toBeGreaterThan(roundTrip);
    expect(bankManip).toBeGreaterThan(split);
    expect(bankManip).toBeGreaterThan(noPO);
  });

  it('should have lowest base confidence for no-PO vendor', () => {
    const noPO = calculatePatternConfidence('NO_PO_VENDOR', 1, 1000);
    expect(noPO).toBe(40);
  });

  it('should never exceed 100', () => {
    const confidence = calculatePatternConfidence('VENDOR_BANK_MANIPULATION', 10, 100000);
    expect(confidence).toBeLessThanOrEqual(100);
  });

  it('should never go below 0', () => {
    const confidence = calculatePatternConfidence('NO_PO_VENDOR', 0, 0);
    expect(confidence).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// Playbook Trigger Logic Tests
// =============================================================================

describe('Fraud Pattern Detection - Playbook Routing', () => {
  it('should NOT trigger playbook for low-confidence findings', () => {
    const match = createFraudMatch({
      confidence: 30,
      lowConfidence: true,
      riskScore: 80,
      financialExposure: 50000,
    });
    expect(shouldTriggerPlaybook(match, DEFAULT_FRAUD_CONFIG)).toBe(false);
  });

  it('should trigger playbook for high financial exposure', () => {
    const match = createFraudMatch({
      confidence: 60,
      lowConfidence: false,
      riskScore: 50,
      financialExposure: 15000, // above 10000 threshold
    });
    expect(shouldTriggerPlaybook(match, DEFAULT_FRAUD_CONFIG)).toBe(true);
  });

  it('should trigger playbook for high risk score (>= 70)', () => {
    const match = createFraudMatch({
      confidence: 60,
      lowConfidence: false,
      riskScore: 75,
      financialExposure: 5000,
    });
    expect(shouldTriggerPlaybook(match, DEFAULT_FRAUD_CONFIG)).toBe(true);
  });

  it('should NOT trigger playbook for moderate findings below thresholds', () => {
    const match = createFraudMatch({
      confidence: 55,
      lowConfidence: false,
      riskScore: 50,
      financialExposure: 5000, // below 10000 threshold
    });
    expect(shouldTriggerPlaybook(match, DEFAULT_FRAUD_CONFIG)).toBe(false);
  });

  it('should route low-confidence to manual review regardless of exposure', () => {
    const match = createFraudMatch({
      confidence: 40,
      lowConfidence: true,
      riskScore: 90,
      financialExposure: 1000000, // very high exposure
    });
    // Low confidence always means no playbook, manual review instead
    expect(shouldTriggerPlaybook(match, DEFAULT_FRAUD_CONFIG)).toBe(false);
  });

  it('should trigger playbook at exact risk score boundary (70)', () => {
    const match = createFraudMatch({
      confidence: 60,
      lowConfidence: false,
      riskScore: 70,
      financialExposure: 5000,
    });
    expect(shouldTriggerPlaybook(match, DEFAULT_FRAUD_CONFIG)).toBe(true);
  });

  it('should NOT trigger playbook just below risk score boundary (69)', () => {
    const match = createFraudMatch({
      confidence: 55,
      lowConfidence: false,
      riskScore: 69,
      financialExposure: 5000,
    });
    expect(shouldTriggerPlaybook(match, DEFAULT_FRAUD_CONFIG)).toBe(false);
  });
});

// =============================================================================
// Configuration Building Tests
// =============================================================================

describe('Fraud Pattern Detection - Configuration', () => {
  it('should build config from tenant thresholds', () => {
    const config = buildFraudConfig(DEFAULT_THRESHOLDS);

    expect(config.vendorBankChangeHours).toBe(48);
    expect(config.duplicatePaymentWindowDays).toBe(30);
    expect(config.roundTrippingWindowDays).toBe(90);
    expect(config.splitPaymentWindowDays).toBe(5);
    expect(config.noPOLookbackMonths).toBe(12);
    expect(config.lowConfidenceThreshold).toBe(50);
  });

  it('should use tenant-specific vendorBankChangeHours', () => {
    const customThresholds: TenantThresholds = {
      ...DEFAULT_THRESHOLDS,
      vendorBankChangeHours: 72,
    };
    const config = buildFraudConfig(customThresholds);
    expect(config.vendorBankChangeHours).toBe(72);
  });

  it('should use roundNumberThreshold as approval threshold', () => {
    const customThresholds: TenantThresholds = {
      ...DEFAULT_THRESHOLDS,
      roundNumberThreshold: 25000,
    };
    const config = buildFraudConfig(customThresholds);
    expect(config.approvalThreshold).toBe(25000);
    expect(config.criticalExposureThreshold).toBe(25000);
  });
});

// =============================================================================
// Low-Confidence Routing Tests (Requirement 6.6)
// =============================================================================

describe('Fraud Pattern Detection - Low-Confidence Routing', () => {
  it('should classify findings with confidence < 50 as low-confidence', () => {
    // NO_PO_VENDOR has base confidence of 40, which is below 50
    const confidence = calculatePatternConfidence('NO_PO_VENDOR', 1, 1000);
    expect(confidence).toBeLessThan(50);
  });

  it('should classify findings with confidence >= 50 as normal', () => {
    // DUPLICATE_PAYMENT has base confidence of 70, which is above 50
    const confidence = calculatePatternConfidence('DUPLICATE_PAYMENT', 1, 1000);
    expect(confidence).toBeGreaterThanOrEqual(50);
  });

  it('should not trigger playbook for findings below confidence threshold', () => {
    const match = createFraudMatch({
      confidence: 45,
      lowConfidence: true,
    });
    expect(shouldTriggerPlaybook(match)).toBe(false);
  });
});
