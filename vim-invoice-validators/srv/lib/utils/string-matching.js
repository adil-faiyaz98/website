// @ts-check
/**
 * @fileoverview String matching utilities with multiple strategies.
 * Provides fuzzy matching, token-based matching, and scoring algorithms.
 */

const { normalizeString, tokenize, extractSignificantTokens } = require('./normalizers');

/**
 * Calculate Levenshtein distance between two strings.
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  
  // Create distance matrix
  const matrix = Array(s1.length + 1).fill(null)
    .map(() => Array(s2.length + 1).fill(0));
  
  // Initialize first column
  for (let i = 0; i <= s1.length; i++) {
    matrix[i][0] = i;
  }
  
  // Initialize first row
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[s1.length][s2.length];
}

/**
 * Calculate Levenshtein similarity as a ratio (0 to 1).
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score from 0 to 1
 */
function levenshteinSimilarity(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Calculate Jaro-Winkler similarity (good for names).
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score from 0 to 1
 */
function jaroWinklerSimilarity(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  const jaro = (
    (matches / s1.length) +
    (matches / s2.length) +
    ((matches - transpositions / 2) / matches)
  ) / 3;
  
  // Winkler modification: boost score for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  return jaro + (prefix * 0.1 * (1 - jaro));
}

/**
 * Calculate token overlap ratio between two strings.
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Overlap ratio from 0 to 1
 */
function tokenOverlapRatio(str1, str2) {
  const tokens1 = new Set(tokenize(str1));
  const tokens2 = new Set(tokenize(str2));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) intersection++;
  }
  
  // Jaccard similarity
  const union = tokens1.size + tokens2.size - intersection;
  return intersection / union;
}

/**
 * Calculate significant token overlap for company names.
 * More lenient than full token overlap, focuses on distinctive words.
 * @param {string} name1 - First company name
 * @param {string} name2 - Second company name
 * @returns {number} Overlap score from 0 to 1
 */
function significantTokenOverlap(name1, name2) {
  const tokens1 = extractSignificantTokens(name1);
  const tokens2 = extractSignificantTokens(name2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  let matches = 0;
  const used = new Set();
  
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (used.has(t2)) continue;
      
      // Allow fuzzy matching of individual tokens
      if (t1 === t2 || levenshteinSimilarity(t1, t2) > 0.8) {
        matches++;
        used.add(t2);
        break;
      }
    }
  }
  
  // Return ratio of matched tokens to smaller set
  const minSize = Math.min(tokens1.length, tokens2.length);
  return matches / minSize;
}

/**
 * Check if str2 starts with str1 (prefix match).
 * @param {string} prefix - Potential prefix
 * @param {string} str - String to check
 * @returns {boolean} True if str starts with prefix
 */
function isPrefixMatch(prefix, str) {
  const p = normalizeString(prefix);
  const s = normalizeString(str);
  return s.startsWith(p);
}

/**
 * Calculate prefix match score.
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Prefix score from 0 to 1
 */
function prefixMatchScore(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Find common prefix length
  let prefixLen = 0;
  const minLen = Math.min(s1.length, s2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) prefixLen++;
    else break;
  }
  
  // Score based on prefix ratio to shorter string
  return prefixLen / minLen;
}

/**
 * Check if one string contains the other.
 * @param {string} needle - String to find
 * @param {string} haystack - String to search in
 * @returns {boolean} True if found
 */
function containsMatch(needle, haystack) {
  const n = normalizeString(needle);
  const h = normalizeString(haystack);
  return h.includes(n);
}

/**
 * @typedef {import('../types').MatchScore} MatchScore
 */

/**
 * Calculate combined match score using multiple strategies.
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {Object} [weights] - Custom weights for each method
 * @param {number} [weights.levenshtein=0.4] - Weight for Levenshtein
 * @param {number} [weights.tokenMatch=0.3] - Weight for token matching
 * @param {number} [weights.prefix=0.3] - Weight for prefix matching
 * @returns {MatchScore} Combined match score with breakdown
 */
function calculateMatchScore(str1, str2, weights = {}) {
  const {
    levenshtein: levWeight = 0.4,
    tokenMatch: tokenWeight = 0.3,
    prefix: prefixWeight = 0.3
  } = weights;
  
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  // Exact match
  if (s1 === s2) {
    return {
      score: 1,
      strategy: 'exact',
      breakdown: { levenshtein: 1, tokenMatch: 1, prefixMatch: 1 }
    };
  }
  
  const levScore = levenshteinSimilarity(s1, s2);
  const tokenScore = tokenOverlapRatio(s1, s2);
  const prefixScore = prefixMatchScore(s1, s2);
  
  const combinedScore = (
    (levScore * levWeight) +
    (tokenScore * tokenWeight) +
    (prefixScore * prefixWeight)
  );
  
  // Determine primary strategy
  let strategy = 'combined';
  if (levScore >= 0.9) strategy = 'fuzzy';
  else if (tokenScore >= 0.8) strategy = 'token';
  else if (prefixScore >= 0.8) strategy = 'prefix';
  
  return {
    score: Math.min(1, combinedScore),
    strategy,
    breakdown: {
      levenshtein: levScore,
      tokenMatch: tokenScore,
      prefixMatch: prefixScore
    }
  };
}

/**
 * Calculate match score optimized for company names.
 * Uses Jaro-Winkler and significant token overlap.
 * @param {string} name1 - First company name
 * @param {string} name2 - Second company name
 * @returns {MatchScore} Match score
 */
function calculateCompanyNameScore(name1, name2) {
  const s1 = normalizeString(name1);
  const s2 = normalizeString(name2);
  
  // Exact match
  if (s1 === s2) {
    return {
      score: 1,
      strategy: 'exact',
      breakdown: { jaroWinkler: 1, significantTokens: 1, contains: 1 }
    };
  }
  
  const jwScore = jaroWinklerSimilarity(name1, name2);
  const tokenScore = significantTokenOverlap(name1, name2);
  const containsScore = containsMatch(name1, name2) || containsMatch(name2, name1) ? 0.8 : 0;
  
  // Take best of different strategies
  const bestScore = Math.max(
    jwScore,
    tokenScore,
    containsScore
  );
  
  // Weighted combination for final score
  const combinedScore = (jwScore * 0.4) + (tokenScore * 0.4) + (containsScore * 0.2);
  const finalScore = Math.max(bestScore * 0.7 + combinedScore * 0.3, combinedScore);
  
  let strategy = 'combined';
  if (jwScore >= 0.9) strategy = 'jaro-winkler';
  else if (tokenScore >= 0.8) strategy = 'token';
  else if (containsScore > 0) strategy = 'contains';
  
  return {
    score: Math.min(1, finalScore),
    strategy,
    breakdown: {
      jaroWinkler: jwScore,
      significantTokens: tokenScore,
      contains: containsScore
    }
  };
}

/**
 * Find best matches from a list of candidates.
 * @template T
 * @param {string} query - Query string to match
 * @param {T[]} candidates - Array of candidates
 * @param {function(T): string} getKey - Function to extract string key from candidate
 * @param {Object} [options] - Matching options
 * @param {number} [options.minScore=0.5] - Minimum score threshold
 * @param {number} [options.limit=5] - Maximum results to return
 * @param {boolean} [options.companyName=false] - Use company name matching
 * @returns {Array<{item: T, score: MatchScore}>} Sorted matches
 */
function findBestMatches(query, candidates, getKey, options = {}) {
  const {
    minScore = 0.5,
    limit = 5,
    companyName = false
  } = options;
  
  const matches = [];
  const scoreFn = companyName ? calculateCompanyNameScore : calculateMatchScore;
  
  for (const candidate of candidates) {
    const key = getKey(candidate);
    if (!key) continue;
    
    const score = scoreFn(query, key);
    
    if (score.score >= minScore) {
      matches.push({ item: candidate, score });
    }
  }
  
  // Sort by score descending
  matches.sort((a, b) => b.score.score - a.score.score);
  
  return matches.slice(0, limit);
}

module.exports = {
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  tokenOverlapRatio,
  significantTokenOverlap,
  isPrefixMatch,
  prefixMatchScore,
  containsMatch,
  calculateMatchScore,
  calculateCompanyNameScore,
  findBestMatches
};
