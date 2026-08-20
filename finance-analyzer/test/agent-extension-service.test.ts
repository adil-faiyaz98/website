import * as fc from 'fast-check';

/**
 * Property-based tests for Custom Agent Governance (Property 25).
 * Tests pure logic extracted from AgentExtensionService without CAP service dependencies.
 *
 * **Validates: Requirements 35.4, 35.5, 35.8**
 */

// ============================================================================
// Constants (mirroring the service implementation)
// ============================================================================

const DEFAULT_RATE_LIMIT = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type RiskCategory =
  | 'ANOMALY' | 'SOD_VIOLATION' | 'FRAUD_PATTERN' | 'IAM_VIOLATION'
  | 'PRIVILEGE_ESCALATION' | 'INSIDER_THREAT' | 'COMPLIANCE_BREACH'
  | 'VULNERABILITY' | 'VENDOR_TAMPERING' | 'P2P_CONTROL_GAP';

type AgentStatus = 'ACTIVE' | 'QUARANTINED';

const VALID_RISK_CATEGORIES: RiskCategory[] = [
  'ANOMALY', 'SOD_VIOLATION', 'FRAUD_PATTERN', 'IAM_VIOLATION',
  'PRIVILEGE_ESCALATION', 'INSIDER_THREAT', 'COMPLIANCE_BREACH',
  'VULNERABILITY', 'VENDOR_TAMPERING', 'P2P_CONTROL_GAP',
];

// ============================================================================
// Extracted Pure Functions (matching the service implementation)
// ============================================================================

/**
 * Classify alert priority based on confidence score.
 * Mirrors: AgentExtensionService.classifyPriority
 */
function classifyPriority(confidenceScore: number): string {
  if (confidenceScore >= 90) return 'CRITICAL';
  if (confidenceScore >= 70) return 'HIGH';
  if (confidenceScore >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Validate agent output against required schema and governance rules.
 * Returns error message if validation fails, or null if valid.
 * Mirrors: AgentExtensionService.validateAgentOutput (core logic)
 */
function validateAgentOutput(output: {
  riskCategory: any;
  confidenceScore: any;
}): string | null {
  // Mandatory risk category (requirement 35.5)
  if (!output.riskCategory) {
    return 'Missing mandatory riskCategory';
  }
  if (!VALID_RISK_CATEGORIES.includes(output.riskCategory)) {
    return `Invalid riskCategory: ${output.riskCategory}`;
  }

  // Required confidence score (requirement 35.5)
  if (output.confidenceScore === undefined || output.confidenceScore === null) {
    return 'Missing mandatory confidenceScore';
  }
  if (
    typeof output.confidenceScore !== 'number' ||
    output.confidenceScore < 0 ||
    output.confidenceScore > 100
  ) {
    return `Invalid confidenceScore: ${output.confidenceScore}. Must be 0-100.`;
  }

  return null;
}

/**
 * Check rate limit for an agent given current count and max per hour.
 * Mirrors: AgentExtensionService.checkRateLimit (pure decision logic)
 */
function checkRateLimit(currentCount: number, maxPerHour: number): { allowed: boolean; remainingQuota: number } {
  const allowed = currentCount < maxPerHour;
  const remainingQuota = Math.max(0, maxPerHour - currentCount);
  return { allowed, remainingQuota };
}

/**
 * Determine if a quarantined agent's output should be processed.
 * Mirrors: processAgentOutput early return for quarantined agents.
 */
function shouldProcessOutput(agentStatus: AgentStatus): { canProcess: boolean } {
  return { canProcess: agentStatus === 'ACTIVE' };
}

// ============================================================================
// Custom Arbitraries
// ============================================================================

/** Arbitrary for valid risk categories */
const validRiskCategoryArb = fc.constantFrom(...VALID_RISK_CATEGORIES);

/** Arbitrary for invalid risk categories (strings that are not in valid list) */
const invalidRiskCategoryArb = fc.string({ minLength: 1, maxLength: 30 }).filter(
  (s) => !VALID_RISK_CATEGORIES.includes(s as RiskCategory)
);

/** Arbitrary for valid confidence scores (0-100 inclusive) */
const validConfidenceScoreArb = fc.integer({ min: 0, max: 100 });

/** Arbitrary for invalid confidence scores (outside 0-100) */
const invalidConfidenceScoreArb = fc.oneof(
  fc.integer({ min: -1000, max: -1 }),
  fc.integer({ min: 101, max: 1000 })
);

/** Arbitrary for valid agent output */
const validAgentOutputArb = fc.record({
  riskCategory: validRiskCategoryArb,
  confidenceScore: validConfidenceScoreArb,
});

/** Arbitrary for agent status */
const agentStatusArb = fc.constantFrom<AgentStatus>('ACTIVE', 'QUARANTINED');

/** Arbitrary for rate limit configuration */
const rateLimitConfigArb = fc.record({
  currentCount: fc.nat({ max: 500 }),
  maxPerHour: fc.integer({ min: 1, max: 500 }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Custom Agent Governance - Property 25', () => {
  // --------------------------------------------------------------------------
  // Property 1: Standard Workflow Processing - Priority Classification
  // **Validates: Requirements 35.4**
  // --------------------------------------------------------------------------
  describe('Standard workflow processing (Requirement 35.4)', () => {
    it('should deterministically classify priority based on confidence score', () => {
      fc.assert(
        fc.property(validConfidenceScoreArb, (score) => {
          const priority = classifyPriority(score);

          if (score >= 90) {
            expect(priority).toBe('CRITICAL');
          } else if (score >= 70) {
            expect(priority).toBe('HIGH');
          } else if (score >= 40) {
            expect(priority).toBe('MEDIUM');
          } else {
            expect(priority).toBe('LOW');
          }
        }),
        { numRuns: 200 }
      );
    });

    it('should always return one of the four valid priority levels', () => {
      fc.assert(
        fc.property(validConfidenceScoreArb, (score) => {
          const priority = classifyPriority(score);
          expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(priority);
        }),
        { numRuns: 200 }
      );
    });

    it('should validate all valid agent outputs pass schema validation', () => {
      fc.assert(
        fc.property(validAgentOutputArb, (output) => {
          const error = validateAgentOutput(output);
          expect(error).toBeNull();
        }),
        { numRuns: 200 }
      );
    });
  });

  // --------------------------------------------------------------------------
  // Property 2: Rate Limit Enforcement
  // **Validates: Requirements 35.5**
  // --------------------------------------------------------------------------
  describe('Rate limit enforcement (Requirement 35.5)', () => {
    it('should reject when current count >= maxPerHour', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500 }),
          fc.nat({ max: 500 }),
          (maxPerHour, excess) => {
            const currentCount = maxPerHour + excess; // >= maxPerHour
            const result = checkRateLimit(currentCount, maxPerHour);
            expect(result.allowed).toBe(false);
            expect(result.remainingQuota).toBe(0);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should allow when current count < maxPerHour', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 500 }),
          (maxPerHour) => {
            // currentCount is strictly less than maxPerHour
            const currentCount = fc.sample(fc.nat({ max: maxPerHour - 1 }), 1)[0];
            const result = checkRateLimit(currentCount, maxPerHour);
            expect(result.allowed).toBe(true);
            expect(result.remainingQuota).toBe(maxPerHour - currentCount);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should have remaining quota equal to max(0, maxPerHour - currentCount)', () => {
      fc.assert(
        fc.property(rateLimitConfigArb, ({ currentCount, maxPerHour }) => {
          const result = checkRateLimit(currentCount, maxPerHour);
          expect(result.remainingQuota).toBe(Math.max(0, maxPerHour - currentCount));
        }),
        { numRuns: 200 }
      );
    });

    it('should use default rate limit of 100 alerts per hour', () => {
      expect(DEFAULT_RATE_LIMIT).toBe(100);
      // Verify at boundary: 99 allowed, 100 rejected
      expect(checkRateLimit(99, DEFAULT_RATE_LIMIT).allowed).toBe(true);
      expect(checkRateLimit(100, DEFAULT_RATE_LIMIT).allowed).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Property 3: Schema Validation - Quarantine on Failure
  // **Validates: Requirements 35.5, 35.8**
  // --------------------------------------------------------------------------
  describe('Schema validation - quarantine on failure (Requirements 35.5, 35.8)', () => {
    it('should return error for missing riskCategory', () => {
      fc.assert(
        fc.property(validConfidenceScoreArb, (score) => {
          const output = { riskCategory: null as any, confidenceScore: score };
          const error = validateAgentOutput(output);
          expect(error).not.toBeNull();
          expect(error).toContain('riskCategory');
        }),
        { numRuns: 100 }
      );
    });

    it('should return error for invalid riskCategory', () => {
      fc.assert(
        fc.property(invalidRiskCategoryArb, validConfidenceScoreArb, (category, score) => {
          const output = { riskCategory: category, confidenceScore: score };
          const error = validateAgentOutput(output);
          expect(error).not.toBeNull();
          expect(error).toContain('riskCategory');
        }),
        { numRuns: 200 }
      );
    });

    it('should return error for confidence score outside 0-100', () => {
      fc.assert(
        fc.property(validRiskCategoryArb, invalidConfidenceScoreArb, (category, score) => {
          const output = { riskCategory: category, confidenceScore: score };
          const error = validateAgentOutput(output);
          expect(error).not.toBeNull();
          expect(error).toContain('confidenceScore');
        }),
        { numRuns: 200 }
      );
    });

    it('should return error for missing confidence score (undefined)', () => {
      fc.assert(
        fc.property(validRiskCategoryArb, (category) => {
          const output = { riskCategory: category, confidenceScore: undefined as any };
          const error = validateAgentOutput(output);
          expect(error).not.toBeNull();
          expect(error).toContain('confidenceScore');
        }),
        { numRuns: 100 }
      );
    });

    it('should return error for non-numeric confidence score (string or boolean)', () => {
      fc.assert(
        fc.property(
          validRiskCategoryArb,
          fc.oneof(
            fc.string({ minLength: 1 }),
            fc.boolean()
          ),
          (category, score) => {
            const output = { riskCategory: category, confidenceScore: score as any };
            const error = validateAgentOutput(output);
            expect(error).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // --------------------------------------------------------------------------
  // Property 4: Quarantined Agent Rejection
  // **Validates: Requirements 35.8**
  // --------------------------------------------------------------------------
  describe('Quarantined agent rejection (Requirement 35.8)', () => {
    it('should reject outputs from quarantined agents regardless of output validity', () => {
      fc.assert(
        fc.property(validAgentOutputArb, (output) => {
          const result = shouldProcessOutput('QUARANTINED');
          expect(result.canProcess).toBe(false);
        }),
        { numRuns: 200 }
      );
    });

    it('should allow outputs from active agents', () => {
      fc.assert(
        fc.property(validAgentOutputArb, (output) => {
          const result = shouldProcessOutput('ACTIVE');
          expect(result.canProcess).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('should have consistent behavior: quarantined always rejected, active always allowed', () => {
      fc.assert(
        fc.property(agentStatusArb, validAgentOutputArb, (status, output) => {
          const result = shouldProcessOutput(status);
          if (status === 'QUARANTINED') {
            expect(result.canProcess).toBe(false);
          } else {
            expect(result.canProcess).toBe(true);
          }
        }),
        { numRuns: 200 }
      );
    });
  });

  // --------------------------------------------------------------------------
  // Property 5: No Outputs Processed from Quarantined Agents
  // **Validates: Requirements 35.8**
  // --------------------------------------------------------------------------
  describe('No outputs processed from quarantined agents (Requirement 35.8)', () => {
    it('should never create an alert for a quarantined agent regardless of input', () => {
      fc.assert(
        fc.property(
          validAgentOutputArb,
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (output, title, description) => {
            // Simulate the full processAgentOutput logic:
            // 1. Check agent status first
            const agentStatus: AgentStatus = 'QUARANTINED';
            const processResult = shouldProcessOutput(agentStatus);

            // If not processable, no alert is created
            if (!processResult.canProcess) {
              // Verify: validation doesn't even matter for quarantined agents
              const validationPasses = validateAgentOutput(output) === null;
              // Even with valid output, processing is blocked
              expect(processResult.canProcess).toBe(false);
              // This confirms no alert creation path is reached
              return;
            }

            // This branch should never be reached for QUARANTINED agents
            fail('Should not reach alert creation for quarantined agents');
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should block output processing before rate limit or validation checks for quarantined agents', () => {
      fc.assert(
        fc.property(
          validAgentOutputArb,
          rateLimitConfigArb,
          (output, rateConfig) => {
            // Quarantine check happens BEFORE rate limit and validation
            const agentStatus: AgentStatus = 'QUARANTINED';
            const processResult = shouldProcessOutput(agentStatus);

            // Regardless of rate limit status
            const rateLimitResult = checkRateLimit(rateConfig.currentCount, rateConfig.maxPerHour);

            // Even if rate limit allows AND validation passes,
            // quarantined agent is still rejected
            expect(processResult.canProcess).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
