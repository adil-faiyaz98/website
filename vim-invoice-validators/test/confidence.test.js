// @ts-check
/**
 * @fileoverview Unit tests for confidence scoring.
 */

const {
  getConfidenceLevel,
  isAcceptable,
  combineScores,
  adjustScore,
  createValidationResult,
  resetThresholdsCache
} = require('../srv/lib/utils/confidence');

describe('Confidence Scoring', () => {
  beforeEach(() => {
    resetThresholdsCache();
  });

  describe('getConfidenceLevel', () => {
    test('returns exact for score of 1', () => {
      expect(getConfidenceLevel(1.0, 'vendor')).toBe('exact');
    });

    test('returns high for scores above highConfidence threshold', () => {
      expect(getConfidenceLevel(0.9, 'vendor')).toBe('high');
    });

    test('returns medium for scores above mediumConfidence threshold', () => {
      expect(getConfidenceLevel(0.75, 'vendor')).toBe('medium');
    });

    test('returns low for scores above lowConfidence threshold', () => {
      expect(getConfidenceLevel(0.55, 'vendor')).toBe('low');
    });

    test('returns none for scores below all thresholds', () => {
      expect(getConfidenceLevel(0.3, 'vendor')).toBe('none');
    });
  });

  describe('isAcceptable', () => {
    test('returns true for scores above minimum', () => {
      expect(isAcceptable(0.6, 'vendor')).toBe(true);
    });

    test('returns false for scores below minimum', () => {
      expect(isAcceptable(0.4, 'vendor')).toBe(false);
    });

    test('uses type-specific thresholds', () => {
      // Tax codes have higher minimum (0.65) than vendors (0.50)
      expect(isAcceptable(0.55, 'vendor')).toBe(true);
      expect(isAcceptable(0.55, 'taxCode')).toBe(false);
    });
  });

  describe('combineScores', () => {
    test('returns average by default', () => {
      expect(combineScores([0.8, 0.6])).toBe(0.7);
    });

    test('returns minimum with min method', () => {
      expect(combineScores([0.8, 0.6], { method: 'min' })).toBe(0.6);
    });

    test('supports weighted average', () => {
      const result = combineScores([1.0, 0.5], { method: 'weighted', weights: [2, 1] });
      expect(result).toBeCloseTo(0.833, 2);
    });

    test('returns 0 for empty array', () => {
      expect(combineScores([])).toBe(0);
    });
  });

  describe('adjustScore', () => {
    test('adds boost for exact ID match', () => {
      expect(adjustScore(0.8, { exactIdMatch: 0.1 })).toBe(0.9);
    });

    test('subtracts penalty for multiple candidates', () => {
      expect(adjustScore(0.8, { multipleCandidates: 0.1 })).toBe(0.7);
    });

    test('caps at 1.0', () => {
      expect(adjustScore(0.95, { exactIdMatch: 0.2 })).toBe(1.0);
    });

    test('floors at 0', () => {
      expect(adjustScore(0.1, { multipleCandidates: 0.3 })).toBe(0);
    });
  });

  describe('createValidationResult', () => {
    test('creates result with correct structure', () => {
      const result = createValidationResult(true, 0.9, 'vendor', {
        derivedValue: '0000001000',
        message: 'Vendor matched'
      });

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.9);
      expect(result.derivedValue).toBe('0000001000');
      expect(result.message).toBe('Vendor matched');
      expect(result.confidenceLevel).toBe('high');
    });

    test('generates default message when not provided', () => {
      const result = createValidationResult(true, 1.0, 'purchaseOrder');
      expect(result.message).toContain('Purchase Order');
    });
  });
});
