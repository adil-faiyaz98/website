// @ts-check
/**
 * @fileoverview Unit tests for string matching functions.
 */

const {
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  tokenOverlapRatio,
  calculateMatchScore,
  calculateCompanyNameScore,
  findBestMatches
} = require('../srv/lib/utils/string-matching');

describe('String Matching', () => {
  describe('levenshteinDistance', () => {
    test('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    test('returns correct distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    test('handles empty strings', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
    });

    test('is case insensitive after normalization', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(0);
    });
  });

  describe('levenshteinSimilarity', () => {
    test('returns 1 for identical strings', () => {
      expect(levenshteinSimilarity('hello', 'hello')).toBe(1);
    });

    test('returns value between 0 and 1', () => {
      const sim = levenshteinSimilarity('hello', 'hallo');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });
  });

  describe('jaroWinklerSimilarity', () => {
    test('returns 1 for identical strings', () => {
      expect(jaroWinklerSimilarity('hello', 'hello')).toBe(1);
    });

    test('boosts score for common prefix', () => {
      const jaro1 = jaroWinklerSimilarity('MARTHA', 'MARHTA');
      const jaro2 = jaroWinklerSimilarity('CRATE', 'TRACE');
      expect(jaro1).toBeGreaterThan(jaro2);
    });
  });

  describe('tokenOverlapRatio', () => {
    test('returns 1 for identical token sets', () => {
      expect(tokenOverlapRatio('hello world', 'world hello')).toBe(1);
    });

    test('returns 0 for no overlap', () => {
      expect(tokenOverlapRatio('hello', 'goodbye')).toBe(0);
    });

    test('returns partial overlap', () => {
      const ratio = tokenOverlapRatio('hello world', 'hello there');
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(1);
    });
  });

  describe('calculateMatchScore', () => {
    test('returns score of 1 for exact match', () => {
      const result = calculateMatchScore('hello', 'hello');
      expect(result.score).toBe(1);
      expect(result.strategy).toBe('exact');
    });

    test('returns combined score for fuzzy match', () => {
      const result = calculateMatchScore('hello', 'hallo');
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.breakdown).toHaveProperty('levenshtein');
      expect(result.breakdown).toHaveProperty('tokenMatch');
      expect(result.breakdown).toHaveProperty('prefixMatch');
    });
  });

  describe('calculateCompanyNameScore', () => {
    test('handles company name variations', () => {
      const result = calculateCompanyNameScore('ACME Corp', 'ACME Corporation');
      expect(result.score).toBeGreaterThan(0.8);
    });

    test('scores contains matches', () => {
      const result = calculateCompanyNameScore('ACME', 'ACME Corporation');
      expect(result.score).toBeGreaterThan(0.5);
    });
  });

  describe('findBestMatches', () => {
    const candidates = [
      { id: 1, name: 'ACME Corporation' },
      { id: 2, name: 'Apex Solutions' },
      { id: 3, name: 'Acme Industries' }
    ];

    test('finds exact matches first', () => {
      const matches = findBestMatches('ACME Corporation', candidates, c => c.name);
      expect(matches[0].item.id).toBe(1);
      expect(matches[0].score.score).toBe(1);
    });

    test('finds fuzzy matches', () => {
      const matches = findBestMatches('Acme', candidates, c => c.name, { minScore: 0.3 });
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some(m => m.item.name.includes('ACME'))).toBe(true);
    });

    test('respects limit option', () => {
      const matches = findBestMatches('Corp', candidates, c => c.name, { limit: 1, minScore: 0.1 });
      expect(matches.length).toBeLessThanOrEqual(1);
    });
  });
});
