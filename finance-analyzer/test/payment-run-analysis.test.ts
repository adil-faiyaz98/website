import {
  checkPaymentAmountAnomaly,
  buildRiskSummary,
  generateFlaggedPaymentAlert,
  calculateAlertPriority,
  PaymentRunPayment,
  PaymentScoreResult,
} from '../srv/detection/payment-run-analysis';

/**
 * Unit tests for Payment Run Analysis module.
 * Tests core scoring logic, risk summary generation, alert generation, and priority calculation.
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.7
 */

// ============================================================================
// Test Helpers
// ============================================================================

function createPayment(overrides: Partial<PaymentRunPayment> = {}): PaymentRunPayment {
  return {
    paymentId: 'pay-001',
    vendorId: 'vendor-001',
    amount: 5000,
    currency: 'USD',
    companyCode: '1000',
    ...overrides,
  };
}

function createPaymentResult(overrides: Partial<PaymentScoreResult> = {}): PaymentScoreResult {
  return {
    paymentId: 'pay-001',
    vendorId: 'vendor-001',
    amount: 5000,
    currency: 'USD',
    riskScore: 0,
    flagged: false,
    riskReasons: [],
    historicalCount: 10,
    ...overrides,
  };
}

// ============================================================================
// checkPaymentAmountAnomaly Tests
// ============================================================================

describe('Payment Run Analysis - Amount Anomaly Check', () => {
  it('should flag vendor with fewer than 3 historical payments', () => {
    const payment = createPayment({ amount: 100 });
    const history = { averageAmount: 0, count: 0 };

    const result = checkPaymentAmountAnomaly(payment, history, 3);

    expect(result.flagged).toBe(true);
    expect(result.score).toBe(75);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toContain('only 0 historical payment(s)');
  });

  it('should flag vendor with exactly 1 historical payment', () => {
    const payment = createPayment({ amount: 5000 });
    const history = { averageAmount: 5000, count: 1 };

    const result = checkPaymentAmountAnomaly(payment, history, 3);

    expect(result.flagged).toBe(true);
    expect(result.score).toBe(75);
  });

  it('should flag vendor with exactly 2 historical payments', () => {
    const payment = createPayment({ amount: 5000 });
    const history = { averageAmount: 5000, count: 2 };

    const result = checkPaymentAmountAnomaly(payment, history, 3);

    expect(result.flagged).toBe(true);
  });

  it('should flag payment exceeding 3x historical average', () => {
    const payment = createPayment({ amount: 40000 });
    const history = { averageAmount: 10000, count: 10 };

    const result = checkPaymentAmountAnomaly(payment, history, 3);

    expect(result.flagged).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.reasons[0]).toContain('exceeds 3x historical average');
  });

  it('should not flag payment within 3x historical average', () => {
    const payment = createPayment({ amount: 25000 });
    const history = { averageAmount: 10000, count: 10 };

    const result = checkPaymentAmountAnomaly(payment, history, 3);

    expect(result.flagged).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });

  it('should not flag payment exactly at 3x threshold', () => {
    const payment = createPayment({ amount: 30000 });
    const history = { averageAmount: 10000, count: 10 };

    const result = checkPaymentAmountAnomaly(payment, history, 3);

    expect(result.flagged).toBe(false);
  });

  it('should flag payment just above 3x threshold', () => {
    const payment = createPayment({ amount: 30001 });
    const history = { averageAmount: 10000, count: 10 };

    const result = checkPaymentAmountAnomaly(payment, history, 3);

    expect(result.flagged).toBe(true);
  });

  it('should use configurable factor (e.g., 5x)', () => {
    const payment = createPayment({ amount: 60000 });
    const history = { averageAmount: 10000, count: 10 };

    const result = checkPaymentAmountAnomaly(payment, history, 5);

    expect(result.flagged).toBe(true);
    expect(result.reasons[0]).toContain('exceeds 5x historical average');
  });

  it('should not flag with configurable factor 5x when amount is under 5x', () => {
    const payment = createPayment({ amount: 40000 });
    const history = { averageAmount: 10000, count: 10 };

    const result = checkPaymentAmountAnomaly(payment, history, 5);

    expect(result.flagged).toBe(false);
  });

  it('should cap risk score at 100', () => {
    const payment = createPayment({ amount: 1000000 });
    const history = { averageAmount: 1000, count: 10 };

    const result = checkPaymentAmountAnomaly(payment, history, 3);

    expect(result.flagged).toBe(true);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// buildRiskSummary Tests
// ============================================================================

describe('Payment Run Analysis - Risk Summary', () => {
  it('should calculate correct total amount', () => {
    const results = [
      createPaymentResult({ amount: 5000 }),
      createPaymentResult({ amount: 3000 }),
      createPaymentResult({ amount: 2000 }),
    ];

    const summary = buildRiskSummary(results);

    expect(summary.totalAmount).toBe(10000);
  });

  it('should count total number of payments', () => {
    const results = [
      createPaymentResult(),
      createPaymentResult(),
      createPaymentResult(),
    ];

    const summary = buildRiskSummary(results);

    expect(summary.numberOfPayments).toBe(3);
  });

  it('should count flagged payments', () => {
    const results = [
      createPaymentResult({ flagged: true, riskScore: 80 }),
      createPaymentResult({ flagged: false, riskScore: 20 }),
      createPaymentResult({ flagged: true, riskScore: 90 }),
    ];

    const summary = buildRiskSummary(results);

    expect(summary.numberOfFlagged).toBe(2);
  });

  it('should identify highest risk score', () => {
    const results = [
      createPaymentResult({ riskScore: 30 }),
      createPaymentResult({ riskScore: 85 }),
      createPaymentResult({ riskScore: 60 }),
    ];

    const summary = buildRiskSummary(results);

    expect(summary.highestRiskScore).toBe(85);
  });

  it('should set aggregate score as the maximum risk score', () => {
    const results = [
      createPaymentResult({ riskScore: 30 }),
      createPaymentResult({ riskScore: 85 }),
      createPaymentResult({ riskScore: 60 }),
    ];

    const summary = buildRiskSummary(results);

    expect(summary.aggregateRiskScore).toBe(85);
    expect(summary.aggregateRiskScore).toBe(summary.highestRiskScore);
  });

  it('should handle empty payment list', () => {
    const summary = buildRiskSummary([]);

    expect(summary.totalAmount).toBe(0);
    expect(summary.numberOfPayments).toBe(0);
    expect(summary.numberOfFlagged).toBe(0);
    expect(summary.highestRiskScore).toBe(0);
    expect(summary.aggregateRiskScore).toBe(0);
  });

  it('should handle single payment', () => {
    const results = [createPaymentResult({ amount: 5000, riskScore: 50, flagged: false })];

    const summary = buildRiskSummary(results);

    expect(summary.totalAmount).toBe(5000);
    expect(summary.numberOfPayments).toBe(1);
    expect(summary.numberOfFlagged).toBe(0);
    expect(summary.highestRiskScore).toBe(50);
  });
});

// ============================================================================
// generateFlaggedPaymentAlert Tests
// ============================================================================

describe('Payment Run Analysis - Alert Generation', () => {
  it('should generate alert with all flagged payment details', () => {
    const flagged: PaymentScoreResult[] = [
      createPaymentResult({
        paymentId: 'pay-001',
        vendorId: 'vendor-001',
        amount: 50000,
        currency: 'USD',
        riskScore: 85,
        flagged: true,
        riskReasons: ['Exceeds 3x historical average'],
      }),
      createPaymentResult({
        paymentId: 'pay-002',
        vendorId: 'vendor-002',
        amount: 30000,
        currency: 'USD',
        riskScore: 75,
        flagged: true,
        riskReasons: ['Vendor has insufficient history'],
      }),
    ];

    const summary = buildRiskSummary(flagged);
    const alert = generateFlaggedPaymentAlert('tenant-001', 'run-001', flagged, summary);

    expect(alert.paymentRunId).toBe('run-001');
    expect(alert.flaggedPayments).toHaveLength(2);
    expect(alert.flaggedPayments[0].paymentId).toBe('pay-001');
    expect(alert.flaggedPayments[0].amount).toBe(50000);
    expect(alert.flaggedPayments[0].vendorId).toBe('vendor-001');
    expect(alert.flaggedPayments[0].riskScore).toBe(85);
    expect(alert.flaggedPayments[0].riskReasons).toContain('Exceeds 3x historical average');
    expect(alert.flaggedPayments[1].paymentId).toBe('pay-002');
    expect(alert.flaggedPayments[1].vendorId).toBe('vendor-002');
  });

  it('should calculate financial exposure as sum of flagged amounts', () => {
    const flagged: PaymentScoreResult[] = [
      createPaymentResult({ amount: 50000, flagged: true, riskScore: 80 }),
      createPaymentResult({ amount: 30000, flagged: true, riskScore: 75 }),
    ];

    const summary = buildRiskSummary(flagged);
    const alert = generateFlaggedPaymentAlert('tenant-001', 'run-001', flagged, summary);

    expect(alert.financialExposure).toBe(80000);
  });

  it('should include payment run reference in alert', () => {
    const flagged: PaymentScoreResult[] = [
      createPaymentResult({ flagged: true, riskScore: 80 }),
    ];

    const summary = buildRiskSummary(flagged);
    const alert = generateFlaggedPaymentAlert('tenant-001', 'run-xyz', flagged, summary);

    expect(alert.paymentRunId).toBe('run-xyz');
    expect(alert.title).toContain('run-xyz');
  });

  it('should have a valid alert ID', () => {
    const flagged: PaymentScoreResult[] = [
      createPaymentResult({ flagged: true, riskScore: 80 }),
    ];

    const summary = buildRiskSummary(flagged);
    const alert = generateFlaggedPaymentAlert('tenant-001', 'run-001', flagged, summary);

    expect(alert.alertId).toBeDefined();
    expect(alert.alertId.length).toBeGreaterThan(0);
  });

  it('should deduplicate affected vendor entities', () => {
    const flagged: PaymentScoreResult[] = [
      createPaymentResult({ paymentId: 'pay-001', vendorId: 'vendor-001', flagged: true, riskScore: 80 }),
      createPaymentResult({ paymentId: 'pay-002', vendorId: 'vendor-001', flagged: true, riskScore: 75 }),
      createPaymentResult({ paymentId: 'pay-003', vendorId: 'vendor-002', flagged: true, riskScore: 72 }),
    ];

    const summary = buildRiskSummary(flagged);
    const alert = generateFlaggedPaymentAlert('tenant-001', 'run-001', flagged, summary);

    const vendorEntities = alert.affectedEntities.filter(e => e.entityType === 'vendor');
    expect(vendorEntities).toHaveLength(2);
  });
});

// ============================================================================
// calculateAlertPriority Tests
// ============================================================================

describe('Payment Run Analysis - Alert Priority Calculation', () => {
  it('should assign CRITICAL for risk score >= 90', () => {
    expect(calculateAlertPriority(90, 0)).toBe('CRITICAL');
    expect(calculateAlertPriority(95, 0)).toBe('CRITICAL');
    expect(calculateAlertPriority(100, 0)).toBe('CRITICAL');
  });

  it('should assign CRITICAL for financial exposure >= 1,000,000', () => {
    expect(calculateAlertPriority(50, 1000000)).toBe('CRITICAL');
    expect(calculateAlertPriority(50, 2000000)).toBe('CRITICAL');
  });

  it('should assign HIGH for risk score >= 70 (below 90)', () => {
    expect(calculateAlertPriority(70, 0)).toBe('HIGH');
    expect(calculateAlertPriority(85, 0)).toBe('HIGH');
    expect(calculateAlertPriority(89, 0)).toBe('HIGH');
  });

  it('should assign HIGH for financial exposure >= 100,000 (below 1M)', () => {
    expect(calculateAlertPriority(30, 100000)).toBe('HIGH');
    expect(calculateAlertPriority(30, 500000)).toBe('HIGH');
  });

  it('should assign MEDIUM for risk score >= 40 (below 70)', () => {
    expect(calculateAlertPriority(40, 0)).toBe('MEDIUM');
    expect(calculateAlertPriority(60, 0)).toBe('MEDIUM');
    expect(calculateAlertPriority(69, 0)).toBe('MEDIUM');
  });

  it('should assign LOW for risk score < 40 and low exposure', () => {
    expect(calculateAlertPriority(0, 0)).toBe('LOW');
    expect(calculateAlertPriority(20, 5000)).toBe('LOW');
    expect(calculateAlertPriority(39, 99999)).toBe('LOW');
  });
});
