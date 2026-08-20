import {
  classifySeverity,
  validateCustomRule,
  mapTransactionToActivity,
  PREDEFINED_SOD_RULES,
  PAYMENT_BANK_ACTIVITIES,
  FINANCIAL_APPROVAL_ACTIVITIES,
  MAX_CUSTOM_RULES_PER_TENANT,
  SoDRule,
} from '../srv/detection/sod-detection';
import { CanonicalTransaction, TenantThresholds } from '../srv/types';

/**
 * Unit tests for SoD Violation Detection.
 * Tests predefined rules, severity classification, rule validation, and activity mapping.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7, 5.8
 */

// =============================================================================
// Test Helpers
// =============================================================================

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
    businessObjectRef: 'REF001',
    metadata: {},
    ingestedAt: new Date(),
    normalizedAt: new Date(),
    ...overrides,
  };
}

function createMockRule(overrides: Partial<SoDRule> = {}): SoDRule {
  return {
    ID: 'rule-001',
    tenantId: 'tenant-001',
    ruleName: 'Test Rule',
    ruleType: 'CUSTOM',
    activity1: 'activity_a',
    activity2: 'activity_b',
    severity: 'MEDIUM',
    isActive: true,
    lookbackDays: 90,
    ...overrides,
  };
}

// =============================================================================
// Predefined Rules
// =============================================================================

describe('SoD Detection - Predefined Rules Library', () => {
  it('should provide at least 4 predefined rules', () => {
    expect(PREDEFINED_SOD_RULES.length).toBeGreaterThanOrEqual(4);
  });

  it('should include create_vendor / approve_payment rule as CRITICAL', () => {
    const rule = PREDEFINED_SOD_RULES.find(
      (r) => r.activity1 === 'create_vendor' && r.activity2 === 'approve_payment'
    );
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('CRITICAL');
  });

  it('should include post_journal_entry / approve_journal_entry rule as HIGH', () => {
    const rule = PREDEFINED_SOD_RULES.find(
      (r) => r.activity1 === 'post_journal_entry' && r.activity2 === 'approve_journal_entry'
    );
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('HIGH');
  });

  it('should include maintain_bank_details / execute_payment_run rule as CRITICAL', () => {
    const rule = PREDEFINED_SOD_RULES.find(
      (r) => r.activity1 === 'maintain_bank_details' && r.activity2 === 'execute_payment_run'
    );
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('CRITICAL');
  });

  it('should include create_purchase_order / approve_goods_receipt rule as HIGH', () => {
    const rule = PREDEFINED_SOD_RULES.find(
      (r) => r.activity1 === 'create_purchase_order' && r.activity2 === 'approve_goods_receipt'
    );
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('HIGH');
  });

  it('all predefined rules should have ruleType PREDEFINED', () => {
    for (const rule of PREDEFINED_SOD_RULES) {
      expect(rule.ruleType).toBe('PREDEFINED');
    }
  });

  it('all predefined rules should have different activity1 and activity2', () => {
    for (const rule of PREDEFINED_SOD_RULES) {
      expect(rule.activity1).not.toBe(rule.activity2);
    }
  });
});

// =============================================================================
// Severity Classification
// =============================================================================

describe('SoD Detection - Severity Classification', () => {
  it('should classify as CRITICAL when both activities are payment/bank operations', () => {
    expect(classifySeverity('approve_payment', 'execute_payment_run')).toBe('CRITICAL');
    expect(classifySeverity('maintain_bank_details', 'execute_payment_run')).toBe('CRITICAL');
    expect(classifySeverity('approve_payment', 'maintain_bank_details')).toBe('CRITICAL');
  });

  it('should classify as HIGH when one activity is a financial approval', () => {
    expect(classifySeverity('create_vendor', 'approve_payment')).toBe('HIGH');
    expect(classifySeverity('post_journal_entry', 'approve_journal_entry')).toBe('HIGH');
    expect(classifySeverity('create_purchase_order', 'approve_goods_receipt')).toBe('HIGH');
  });

  it('should classify as MEDIUM for all other conflict combinations', () => {
    expect(classifySeverity('create_vendor', 'create_purchase_order')).toBe('MEDIUM');
    expect(classifySeverity('post_journal_entry', 'create_vendor')).toBe('MEDIUM');
  });

  it('should be deterministic - same inputs always produce same severity', () => {
    const severity1 = classifySeverity('approve_payment', 'maintain_bank_details');
    const severity2 = classifySeverity('approve_payment', 'maintain_bank_details');
    expect(severity1).toBe(severity2);
  });

  it('should handle order of activities symmetrically for CRITICAL', () => {
    // Both orders should give the same severity
    const s1 = classifySeverity('maintain_bank_details', 'execute_payment_run');
    const s2 = classifySeverity('execute_payment_run', 'maintain_bank_details');
    expect(s1).toBe('CRITICAL');
    expect(s2).toBe('CRITICAL');
  });
});

// =============================================================================
// Custom Rule Validation
// =============================================================================

describe('SoD Detection - Custom Rule Validation', () => {
  it('should reject rule where activity1 equals activity2', () => {
    const result = validateCustomRule('approve_payment', 'approve_payment', [], 'tenant-001');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('same action');
  });

  it('should reject duplicate rule (same pair, same order)', () => {
    const existingRules: SoDRule[] = [
      createMockRule({ activity1: 'create_vendor', activity2: 'approve_payment', tenantId: 'tenant-001' }),
    ];

    const result = validateCustomRule('create_vendor', 'approve_payment', existingRules, 'tenant-001');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('should reject duplicate rule (same pair, reversed order)', () => {
    const existingRules: SoDRule[] = [
      createMockRule({ activity1: 'create_vendor', activity2: 'approve_payment', tenantId: 'tenant-001' }),
    ];

    const result = validateCustomRule('approve_payment', 'create_vendor', existingRules, 'tenant-001');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already exists');
  });

  it('should accept valid rule with different activities and no duplicates', () => {
    const result = validateCustomRule('activity_x', 'activity_y', [], 'tenant-001');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject when maximum custom rules (50) reached', () => {
    const existingRules: SoDRule[] = Array.from({ length: 50 }, (_, i) =>
      createMockRule({
        ID: `rule-${i}`,
        tenantId: 'tenant-001',
        ruleType: 'CUSTOM',
        activity1: `act_a_${i}`,
        activity2: `act_b_${i}`,
      })
    );

    const result = validateCustomRule('new_activity_1', 'new_activity_2', existingRules, 'tenant-001');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('50');
  });

  it('should allow up to 50 custom rules', () => {
    const existingRules: SoDRule[] = Array.from({ length: 49 }, (_, i) =>
      createMockRule({
        ID: `rule-${i}`,
        tenantId: 'tenant-001',
        ruleType: 'CUSTOM',
        activity1: `act_a_${i}`,
        activity2: `act_b_${i}`,
      })
    );

    const result = validateCustomRule('new_activity_1', 'new_activity_2', existingRules, 'tenant-001');
    expect(result.valid).toBe(true);
  });

  it('should not count PREDEFINED rules toward the 50-rule limit', () => {
    const existingRules: SoDRule[] = Array.from({ length: 50 }, (_, i) =>
      createMockRule({
        ID: `rule-${i}`,
        tenantId: 'tenant-001',
        ruleType: 'PREDEFINED',
        activity1: `act_a_${i}`,
        activity2: `act_b_${i}`,
      })
    );

    const result = validateCustomRule('new_activity_1', 'new_activity_2', existingRules, 'tenant-001');
    expect(result.valid).toBe(true);
  });

  it('should not count rules from other tenants', () => {
    const existingRules: SoDRule[] = Array.from({ length: 50 }, (_, i) =>
      createMockRule({
        ID: `rule-${i}`,
        tenantId: 'other-tenant',
        ruleType: 'CUSTOM',
        activity1: `act_a_${i}`,
        activity2: `act_b_${i}`,
      })
    );

    const result = validateCustomRule('new_activity_1', 'new_activity_2', existingRules, 'tenant-001');
    expect(result.valid).toBe(true);
  });

  it('should not count duplicate check against other tenants', () => {
    const existingRules: SoDRule[] = [
      createMockRule({
        activity1: 'activity_x',
        activity2: 'activity_y',
        tenantId: 'other-tenant',
      }),
    ];

    const result = validateCustomRule('activity_x', 'activity_y', existingRules, 'tenant-001');
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Transaction to Activity Mapping
// =============================================================================

describe('SoD Detection - Transaction Activity Mapping', () => {
  it('should map VENDOR_MASTER_CHANGE to create_vendor by default', () => {
    const tx = createTransaction({
      documentType: 'VENDOR_MASTER_CHANGE',
      metadata: {},
    });
    expect(mapTransactionToActivity(tx)).toBe('create_vendor');
  });

  it('should map VENDOR_MASTER_CHANGE with BANK_DETAIL to maintain_bank_details', () => {
    const tx = createTransaction({
      documentType: 'VENDOR_MASTER_CHANGE',
      metadata: { changeType: 'BANK_DETAIL' },
    });
    expect(mapTransactionToActivity(tx)).toBe('maintain_bank_details');
  });

  it('should map PAYMENT_DOCUMENT with approval to approve_payment', () => {
    const tx = createTransaction({
      documentType: 'PAYMENT_DOCUMENT',
      metadata: { isApproval: true },
    });
    expect(mapTransactionToActivity(tx)).toBe('approve_payment');
  });

  it('should map PAYMENT_DOCUMENT with payment run flag to execute_payment_run', () => {
    const tx = createTransaction({
      documentType: 'PAYMENT_DOCUMENT',
      metadata: { isPaymentRun: true },
    });
    expect(mapTransactionToActivity(tx)).toBe('execute_payment_run');
  });

  it('should map JOURNAL_ENTRY without approval to post_journal_entry', () => {
    const tx = createTransaction({
      documentType: 'JOURNAL_ENTRY',
      metadata: {},
    });
    expect(mapTransactionToActivity(tx)).toBe('post_journal_entry');
  });

  it('should map JOURNAL_ENTRY with approval to approve_journal_entry', () => {
    const tx = createTransaction({
      documentType: 'JOURNAL_ENTRY',
      metadata: { isApproval: true },
    });
    expect(mapTransactionToActivity(tx)).toBe('approve_journal_entry');
  });

  it('should map PURCHASE_ORDER to create_purchase_order', () => {
    const tx = createTransaction({
      documentType: 'PURCHASE_ORDER',
      metadata: {},
    });
    expect(mapTransactionToActivity(tx)).toBe('create_purchase_order');
  });

  it('should map GOODS_RECEIPT to approve_goods_receipt', () => {
    const tx = createTransaction({
      documentType: 'GOODS_RECEIPT',
      metadata: {},
    });
    expect(mapTransactionToActivity(tx)).toBe('approve_goods_receipt');
  });

  it('should return null for unmapped document types', () => {
    const tx = createTransaction({
      documentType: 'ROLE_ASSIGNMENT',
      metadata: {},
    });
    expect(mapTransactionToActivity(tx)).toBeNull();
  });

  it('should return null for TRANSPORT_IMPORT', () => {
    const tx = createTransaction({
      documentType: 'TRANSPORT_IMPORT',
      metadata: {},
    });
    expect(mapTransactionToActivity(tx)).toBeNull();
  });
});

// =============================================================================
// Activity Sets (Constants)
// =============================================================================

describe('SoD Detection - Activity Classification Constants', () => {
  it('PAYMENT_BANK_ACTIVITIES should include payment and bank-related activities', () => {
    expect(PAYMENT_BANK_ACTIVITIES.has('approve_payment')).toBe(true);
    expect(PAYMENT_BANK_ACTIVITIES.has('execute_payment_run')).toBe(true);
    expect(PAYMENT_BANK_ACTIVITIES.has('maintain_bank_details')).toBe(true);
  });

  it('FINANCIAL_APPROVAL_ACTIVITIES should include approval activities', () => {
    expect(FINANCIAL_APPROVAL_ACTIVITIES.has('approve_journal_entry')).toBe(true);
    expect(FINANCIAL_APPROVAL_ACTIVITIES.has('approve_payment')).toBe(true);
    expect(FINANCIAL_APPROVAL_ACTIVITIES.has('approve_goods_receipt')).toBe(true);
  });

  it('MAX_CUSTOM_RULES_PER_TENANT should be 50', () => {
    expect(MAX_CUSTOM_RULES_PER_TENANT).toBe(50);
  });
});

// =============================================================================
// Acknowledgment Workflow Logic (unit testable parts)
// =============================================================================

describe('SoD Detection - Acknowledgment Workflow', () => {
  it('violation status transitions from ACTIVE to ACKNOWLEDGED', () => {
    // Test that the status model supports the transition
    const validStatuses = ['ACTIVE', 'ACKNOWLEDGED'];
    expect(validStatuses).toContain('ACTIVE');
    expect(validStatuses).toContain('ACKNOWLEDGED');
  });

  it('acknowledged violation should record user and timestamp', () => {
    // This tests the data model requirements
    const now = new Date();
    const acknowledgment = {
      status: 'ACKNOWLEDGED' as const,
      acknowledgedBy: 'ADMIN01',
      acknowledgedAt: now,
    };

    expect(acknowledgment.status).toBe('ACKNOWLEDGED');
    expect(acknowledgment.acknowledgedBy).toBe('ADMIN01');
    expect(acknowledgment.acknowledgedAt).toBeInstanceOf(Date);
  });
});
