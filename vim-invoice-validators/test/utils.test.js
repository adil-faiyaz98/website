// @ts-check
/**
 * @fileoverview Unit tests for utility functions.
 */

const {
  normalizeString,
  normalizeCompanyName,
  normalizePONumber,
  normalizePONumberPadded,
  normalizeVendorNumber,
  normalizeAmount,
  tokenize,
  extractSignificantTokens
} = require('../srv/lib/utils/normalizers');

const {
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  tokenOverlapRatio,
  calculateMatchScore,
  calculateCompanyNameScore,
  findBestMatches
} = require('../srv/lib/utils/string-matching');

const {
  getConfidenceLevel,
  isAcceptable,
  combineScores
} = require('../srv/lib/utils/confidence');

describe('Normalizers', () => {
  describe('normalizeString', () => {
    test('converts to lowercase and trims', () => {
      expect(normalizeString('  Hello World  ')).toBe('hello world');
    });

    test('handles null/undefined', () => {
      expect(normalizeString(null)).toBe('');
      expect(normalizeString(undefined)).toBe('');
    });

    test('collapses multiple spaces', () => {
      expect(normalizeString('hello    world')).toBe('hello world');
    });
  });

  describe('normalizeCompanyName', () => {
    test('removes common suffixes', () => {
      expect(normalizeCompanyName('ACME Corporation')).toBe('acme');
      expect(normalizeCompanyName('Tech Solutions Inc.')).toBe('tech solutions');
      expect(normalizeCompanyName('Global GmbH')).toBe('global');
    });

    test('handles multiple suffixes', () => {
      expect(normalizeCompanyName('ACME Corp. LLC')).toBe('acme');
    });
  });

  describe('normalizePONumber', () => {
    test('removes leading zeros', () => {
      expect(normalizePONumber('0000450001')).toBe('450001');
    });

    test('removes non-numeric characters', () => {
      expect(normalizePONumber('PO-450001')).toBe('450001');
    });
  });

  describe('normalizePONumberPadded', () => {
    test('pads to 10 digits', () => {
      expect(normalizePONumberPadded('450001')).toBe('0000450001');
    });
  });

  describe('normalizeAmount', () => {
    test('handles US format', () => {
      expect(normalizeAmount('1,234.56')).toBe(1234.56);
    });

    test('handles European format', () => {
      expect(normalizeAmount('1.234,56')).toBe(1234.56);
    });

    test('handles currency symbols', () => {
      expect(normalizeAmount('$1,234.56')).toBe(1234.56);
      expect(normalizeAmount('€1.234,56')).toBe(1234.56);
    });

    test('handles numbers directly', () => {
      expect(normalizeAmount(1234.56)).toBe(1234.56);
    });
  });

  describe('tokenize', () => {
    test('splits into lowercase words', () => {
      expect(tokenize('Hello World')).toEqual(['hello', 'world']);
    });

    test('removes punctuation', () => {
      expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
    });
  });

  describe('extractSignificantTokens', () => {
    test('removes stop words and company suffixes', () => {
      const tokens = extractSignificantTokens('The ACME Corporation of America');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('of');
      expect(tokens).not.toContain('corporation');
      expect(tokens).toContain('acme');
      expect(tokens).toContain('america');
    });
  });
});
