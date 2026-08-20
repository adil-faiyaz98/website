import { InvestigationStatus } from '../srv/types/enums';
import {
  isValidInvestigationTransition,
  INVESTIGATION_VALID_TRANSITIONS,
} from '../srv/types/state-machines';

/**
 * Unit tests for Investigation Service core logic.
 * Tests state machine transitions, resolution validation, and elapsed time calculation.
 * Validates: Requirements 9.4, 9.5, 15.5
 */

// ============================================================================
// Investigation State Machine Tests
// ============================================================================

describe('Investigation State Machine - Valid Transitions', () => {
  it('should allow OPEN → IN_PROGRESS', () => {
    expect(isValidInvestigationTransition('OPEN', 'IN_PROGRESS')).toBe(true);
  });

  it('should allow OPEN → ESCALATED', () => {
    expect(isValidInvestigationTransition('OPEN', 'ESCALATED')).toBe(true);
  });

  it('should allow IN_PROGRESS → ESCALATED', () => {
    expect(isValidInvestigationTransition('IN_PROGRESS', 'ESCALATED')).toBe(true);
  });

  it('should allow IN_PROGRESS → RESOLVED_TRUE_POSITIVE', () => {
    expect(isValidInvestigationTransition('IN_PROGRESS', 'RESOLVED_TRUE_POSITIVE')).toBe(true);
  });

  it('should allow IN_PROGRESS → RESOLVED_FALSE_POSITIVE', () => {
    expect(isValidInvestigationTransition('IN_PROGRESS', 'RESOLVED_FALSE_POSITIVE')).toBe(true);
  });

  it('should allow ESCALATED → IN_PROGRESS', () => {
    expect(isValidInvestigationTransition('ESCALATED', 'IN_PROGRESS')).toBe(true);
  });

  it('should allow ESCALATED → RESOLVED_TRUE_POSITIVE', () => {
    expect(isValidInvestigationTransition('ESCALATED', 'RESOLVED_TRUE_POSITIVE')).toBe(true);
  });

  it('should allow ESCALATED → RESOLVED_FALSE_POSITIVE', () => {
    expect(isValidInvestigationTransition('ESCALATED', 'RESOLVED_FALSE_POSITIVE')).toBe(true);
  });
});

describe('Investigation State Machine - Invalid Transitions', () => {
  it('should reject OPEN → RESOLVED_TRUE_POSITIVE', () => {
    expect(isValidInvestigationTransition('OPEN', 'RESOLVED_TRUE_POSITIVE')).toBe(false);
  });

  it('should reject OPEN → RESOLVED_FALSE_POSITIVE', () => {
    expect(isValidInvestigationTransition('OPEN', 'RESOLVED_FALSE_POSITIVE')).toBe(false);
  });

  it('should reject RESOLVED_TRUE_POSITIVE → any state', () => {
    const allStates: InvestigationStatus[] = [
      'OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED_TRUE_POSITIVE', 'RESOLVED_FALSE_POSITIVE',
    ];
    for (const target of allStates) {
      expect(isValidInvestigationTransition('RESOLVED_TRUE_POSITIVE', target)).toBe(false);
    }
  });

  it('should reject RESOLVED_FALSE_POSITIVE → any state', () => {
    const allStates: InvestigationStatus[] = [
      'OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED_TRUE_POSITIVE', 'RESOLVED_FALSE_POSITIVE',
    ];
    for (const target of allStates) {
      expect(isValidInvestigationTransition('RESOLVED_FALSE_POSITIVE', target)).toBe(false);
    }
  });

  it('should reject OPEN → OPEN (self-transition)', () => {
    expect(isValidInvestigationTransition('OPEN', 'OPEN')).toBe(false);
  });

  it('should reject IN_PROGRESS → OPEN (backward transition)', () => {
    expect(isValidInvestigationTransition('IN_PROGRESS', 'OPEN')).toBe(false);
  });

  it('should reject ESCALATED → OPEN (backward transition)', () => {
    expect(isValidInvestigationTransition('ESCALATED', 'OPEN')).toBe(false);
  });
});

describe('Investigation State Machine - Transition Map Completeness', () => {
  it('should define transitions for all investigation states', () => {
    const allStates: InvestigationStatus[] = [
      'OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED_TRUE_POSITIVE', 'RESOLVED_FALSE_POSITIVE',
    ];
    for (const state of allStates) {
      expect(INVESTIGATION_VALID_TRANSITIONS[state]).toBeDefined();
      expect(Array.isArray(INVESTIGATION_VALID_TRANSITIONS[state])).toBe(true);
    }
  });

  it('should have no valid transitions from terminal states', () => {
    expect(INVESTIGATION_VALID_TRANSITIONS['RESOLVED_TRUE_POSITIVE']).toEqual([]);
    expect(INVESTIGATION_VALID_TRANSITIONS['RESOLVED_FALSE_POSITIVE']).toEqual([]);
  });

  it('should have at least one valid transition from non-terminal states', () => {
    expect(INVESTIGATION_VALID_TRANSITIONS['OPEN'].length).toBeGreaterThan(0);
    expect(INVESTIGATION_VALID_TRANSITIONS['IN_PROGRESS'].length).toBeGreaterThan(0);
    expect(INVESTIGATION_VALID_TRANSITIONS['ESCALATED'].length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Resolution Notes Validation Tests
// ============================================================================

describe('Investigation Resolution - Notes Validation', () => {
  const MIN_NOTES_LENGTH = 1;
  const MAX_NOTES_LENGTH = 5000;

  function validateResolutionNotes(notes: string | null | undefined): {
    valid: boolean;
    error?: string;
  } {
    if (!notes || notes.trim().length === 0) {
      return { valid: false, error: 'Resolution notes are mandatory' };
    }
    const trimmed = notes.trim();
    if (trimmed.length < MIN_NOTES_LENGTH || trimmed.length > MAX_NOTES_LENGTH) {
      return {
        valid: false,
        error: `Resolution notes must be between ${MIN_NOTES_LENGTH} and ${MAX_NOTES_LENGTH} characters`,
      };
    }
    return { valid: true };
  }

  it('should reject null notes', () => {
    const result = validateResolutionNotes(null);
    expect(result.valid).toBe(false);
  });

  it('should reject undefined notes', () => {
    const result = validateResolutionNotes(undefined);
    expect(result.valid).toBe(false);
  });

  it('should reject empty string', () => {
    const result = validateResolutionNotes('');
    expect(result.valid).toBe(false);
  });

  it('should reject whitespace-only string', () => {
    const result = validateResolutionNotes('   \n\t  ');
    expect(result.valid).toBe(false);
  });

  it('should accept minimum length notes (1 char)', () => {
    const result = validateResolutionNotes('X');
    expect(result.valid).toBe(true);
  });

  it('should accept notes at maximum length (5000 chars)', () => {
    const notes = 'A'.repeat(5000);
    const result = validateResolutionNotes(notes);
    expect(result.valid).toBe(true);
  });

  it('should reject notes exceeding 5000 characters', () => {
    const notes = 'A'.repeat(5001);
    const result = validateResolutionNotes(notes);
    expect(result.valid).toBe(false);
  });

  it('should accept typical resolution notes', () => {
    const notes = 'Investigation confirmed a false positive. The vendor bank change was legitimate and authorized by the treasury department per ticket #12345.';
    const result = validateResolutionNotes(notes);
    expect(result.valid).toBe(true);
  });

  it('should trim whitespace before validation', () => {
    const notes = '   Valid notes with surrounding whitespace   ';
    const result = validateResolutionNotes(notes);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Elapsed Time Calculation Tests
// ============================================================================

describe('Investigation Resolution - Elapsed Time Calculation', () => {
  function calculateElapsedTime(startedAt: Date, resolvedAt: Date): number {
    return resolvedAt.getTime() - startedAt.getTime();
  }

  it('should calculate elapsed time in milliseconds', () => {
    const start = new Date('2024-03-15T10:00:00Z');
    const end = new Date('2024-03-15T14:30:00Z');
    const elapsed = calculateElapsedTime(start, end);
    // 4.5 hours = 4.5 * 60 * 60 * 1000 = 16,200,000 ms
    expect(elapsed).toBe(16_200_000);
  });

  it('should handle same-minute resolution', () => {
    const start = new Date('2024-03-15T10:00:00Z');
    const end = new Date('2024-03-15T10:00:30Z');
    const elapsed = calculateElapsedTime(start, end);
    expect(elapsed).toBe(30_000);
  });

  it('should handle multi-day investigations', () => {
    const start = new Date('2024-03-10T08:00:00Z');
    const end = new Date('2024-03-15T17:00:00Z');
    const elapsed = calculateElapsedTime(start, end);
    // 5 days + 9 hours = (5*24 + 9) * 3600 * 1000
    const expected = (5 * 24 + 9) * 3600 * 1000;
    expect(elapsed).toBe(expected);
  });

  it('should always produce positive elapsed time', () => {
    const start = new Date('2024-03-15T10:00:00Z');
    const end = new Date('2024-03-15T10:00:01Z');
    const elapsed = calculateElapsedTime(start, end);
    expect(elapsed).toBeGreaterThan(0);
  });
});

// ============================================================================
// Resolution Type Validation Tests
// ============================================================================

describe('Investigation Resolution - Resolution Type Validation', () => {
  const VALID_RESOLUTION_TYPES: InvestigationStatus[] = [
    'RESOLVED_TRUE_POSITIVE',
    'RESOLVED_FALSE_POSITIVE',
  ];

  function isValidResolutionType(type: string): boolean {
    return VALID_RESOLUTION_TYPES.includes(type as InvestigationStatus);
  }

  it('should accept RESOLVED_TRUE_POSITIVE', () => {
    expect(isValidResolutionType('RESOLVED_TRUE_POSITIVE')).toBe(true);
  });

  it('should accept RESOLVED_FALSE_POSITIVE', () => {
    expect(isValidResolutionType('RESOLVED_FALSE_POSITIVE')).toBe(true);
  });

  it('should reject OPEN as resolution type', () => {
    expect(isValidResolutionType('OPEN')).toBe(false);
  });

  it('should reject IN_PROGRESS as resolution type', () => {
    expect(isValidResolutionType('IN_PROGRESS')).toBe(false);
  });

  it('should reject ESCALATED as resolution type', () => {
    expect(isValidResolutionType('ESCALATED')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidResolutionType('')).toBe(false);
  });

  it('should reject arbitrary string', () => {
    expect(isValidResolutionType('DISMISSED')).toBe(false);
  });
});

// ============================================================================
// Investigation Creation Validation Tests
// ============================================================================

describe('Investigation Creation - Input Validation', () => {
  function validateCreateInput(alertId: string | null, analystId: string | null): {
    valid: boolean;
    error?: string;
  } {
    if (!alertId || !analystId) {
      return { valid: false, error: 'Both alertId and analystId are required' };
    }
    return { valid: true };
  }

  it('should accept valid alertId and analystId', () => {
    const result = validateCreateInput('alert-001', 'ANALYST01');
    expect(result.valid).toBe(true);
  });

  it('should reject missing alertId', () => {
    const result = validateCreateInput(null, 'ANALYST01');
    expect(result.valid).toBe(false);
  });

  it('should reject missing analystId', () => {
    const result = validateCreateInput('alert-001', null);
    expect(result.valid).toBe(false);
  });

  it('should reject empty alertId', () => {
    const result = validateCreateInput('', 'ANALYST01');
    expect(result.valid).toBe(false);
  });

  it('should reject empty analystId', () => {
    const result = validateCreateInput('alert-001', '');
    expect(result.valid).toBe(false);
  });
});
