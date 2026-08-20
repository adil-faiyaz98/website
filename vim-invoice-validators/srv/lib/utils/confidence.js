// @ts-check
/**
 * @fileoverview Confidence scoring and threshold evaluation utilities.
 * Handles loading thresholds and computing confidence levels for validations.
 */

const fs = require('fs');
const path = require('path');

/** @type {Object|null} Cached thresholds configuration */
let cachedThresholds = null;

/**
 * Load thresholds configuration from file.
 * @returns {Object} Thresholds configuration
 */
function loadThresholds() {
  if (cachedThresholds) return cachedThresholds;
  
  try {
    const thresholdsPath = path.join(__dirname, '../../../thresholds.json');
    const content = fs.readFileSync(thresholdsPath, 'utf8');
    cachedThresholds = JSON.parse(content);
    return cachedThresholds;
  } catch (error) {
    // Return defaults if file not found
    return getDefaultThresholds();
  }
}


/**
 * Get default thresholds configuration.
 * @returns {Object} Default thresholds
 */
function getDefaultThresholds() {
  return {
    vendor: {
      exactMatch: 1.0,
      highConfidence: 0.85,
      mediumConfidence: 0.70,
      lowConfidence: 0.50,
      minAcceptable: 0.50
    },
    purchaseOrder: {
      exactMatch: 1.0,
      highConfidence: 0.90,
      mediumConfidence: 0.75,
      lowConfidence: 0.60,
      minAcceptable: 0.60
    },
    taxCode: {
      exactMatch: 1.0,
      highConfidence: 0.95,
      mediumConfidence: 0.80,
      lowConfidence: 0.65,
      minAcceptable: 0.65
    },
    glAccount: {
      exactMatch: 1.0,
      highConfidence: 0.90,
      mediumConfidence: 0.75,
      lowConfidence: 0.60,
      minAcceptable: 0.60
    },
    costCenter: {
      exactMatch: 1.0,
      highConfidence: 0.85,
      mediumConfidence: 0.70,
      lowConfidence: 0.55,
      minAcceptable: 0.55
    }
  };
}


/**
 * @typedef {'exact'|'high'|'medium'|'low'|'none'} ConfidenceLevel
 */

/**
 * Get thresholds for a specific validation type.
 * @param {'vendor'|'purchaseOrder'|'taxCode'|'glAccount'|'costCenter'} type - Validation type
 * @param {Object} [customThresholds] - Optional custom thresholds override
 * @returns {import('../types').ThresholdConfig} Threshold configuration
 */
function getThresholds(type, customThresholds) {
  const thresholds = customThresholds || loadThresholds();
  return thresholds[type] || getDefaultThresholds()[type];
}

/**
 * Determine confidence level from a score.
 * @param {number} score - Score from 0 to 1
 * @param {'vendor'|'purchaseOrder'|'taxCode'|'glAccount'|'costCenter'} type - Validation type
 * @param {Object} [customThresholds] - Optional custom thresholds
 * @returns {ConfidenceLevel} Confidence level
 */
function getConfidenceLevel(score, type, customThresholds) {
  const t = getThresholds(type, customThresholds);
  
  if (score >= t.exactMatch) return 'exact';
  if (score >= t.highConfidence) return 'high';
  if (score >= t.mediumConfidence) return 'medium';
  if (score >= t.lowConfidence) return 'low';
  return 'none';
}


/**
 * Check if a score meets the minimum acceptable threshold.
 * @param {number} score - Score from 0 to 1
 * @param {'vendor'|'purchaseOrder'|'taxCode'|'glAccount'|'costCenter'} type - Validation type
 * @param {Object} [customThresholds] - Optional custom thresholds
 * @returns {boolean} True if score is acceptable
 */
function isAcceptable(score, type, customThresholds) {
  const t = getThresholds(type, customThresholds);
  return score >= t.minAcceptable;
}

/**
 * Create a validation result with confidence information.
 * @param {boolean} isValid - Whether validation passed
 * @param {number} score - Confidence score
 * @param {'vendor'|'purchaseOrder'|'taxCode'|'glAccount'|'costCenter'} type - Validation type
 * @param {Object} [options] - Additional options
 * @param {string} [options.derivedValue] - Derived/matched value
 * @param {string} [options.message] - Result message
 * @param {string} [options.matchStrategy] - Matching strategy used
 * @param {Object} [options.metadata] - Additional metadata
 * @param {Object} [options.customThresholds] - Custom thresholds
 * @returns {import('../types').ValidationResult} Validation result
 */
function createValidationResult(isValid, score, type, options = {}) {
  const level = getConfidenceLevel(score, type, options.customThresholds);
  
  return {
    isValid,
    confidence: score,
    confidenceLevel: level,
    derivedValue: options.derivedValue,
    message: options.message || getDefaultMessage(isValid, level, type),
    matchStrategy: options.matchStrategy,
    metadata: options.metadata
  };
}


/**
 * Generate a default message based on validation result.
 * @param {boolean} isValid - Validation passed
 * @param {ConfidenceLevel} level - Confidence level
 * @param {string} type - Validation type
 * @returns {string} Human-readable message
 */
function getDefaultMessage(isValid, level, type) {
  const typeNames = {
    vendor: 'Vendor',
    purchaseOrder: 'Purchase Order',
    taxCode: 'Tax Code',
    glAccount: 'GL Account',
    costCenter: 'Cost Center'
  };
  
  const typeName = typeNames[type] || type;
  
  if (!isValid) {
    return `${typeName} validation failed - no matching record found`;
  }
  
  switch (level) {
    case 'exact':
      return `${typeName} matched exactly`;
    case 'high':
      return `${typeName} matched with high confidence`;
    case 'medium':
      return `${typeName} matched with medium confidence - review recommended`;
    case 'low':
      return `${typeName} matched with low confidence - manual verification required`;
    default:
      return `${typeName} match confidence below threshold`;
  }
}

/**
 * Combine multiple confidence scores into an overall score.
 * @param {number[]} scores - Array of scores
 * @param {Object} [options] - Combination options
 * @param {'average'|'min'|'weighted'} [options.method='average'] - Combination method
 * @param {number[]} [options.weights] - Weights for weighted average
 * @returns {number} Combined score
 */
function combineScores(scores, options = {}) {
  const { method = 'average', weights } = options;
  
  if (scores.length === 0) return 0;
  
  switch (method) {
    case 'min':
      return Math.min(...scores);
    
    case 'weighted':
      if (!weights || weights.length !== scores.length) {
        return scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const weightedSum = scores.reduce((sum, s, i) => sum + s * weights[i], 0);
      return weightedSum / weightSum;
    
    case 'average':
    default:
      return scores.reduce((a, b) => a + b, 0) / scores.length;
  }
}


/**
 * Boost or penalize a score based on additional factors.
 * @param {number} baseScore - Base score to modify
 * @param {Object} factors - Adjustment factors
 * @param {number} [factors.exactIdMatch] - Boost for exact ID match (0-0.2)
 * @param {number} [factors.recentActivity] - Boost for recent transactions (0-0.1)
 * @param {number} [factors.multipleCandidates] - Penalty for ambiguous matches (0-0.2)
 * @param {number} [factors.dataQuality] - Adjustment for data quality (0-0.1)
 * @returns {number} Adjusted score (capped at 1.0)
 */
function adjustScore(baseScore, factors = {}) {
  let adjusted = baseScore;
  
  if (factors.exactIdMatch) {
    adjusted += factors.exactIdMatch;
  }
  
  if (factors.recentActivity) {
    adjusted += factors.recentActivity;
  }
  
  if (factors.multipleCandidates) {
    adjusted -= factors.multipleCandidates;
  }
  
  if (factors.dataQuality) {
    adjusted += factors.dataQuality;
  }
  
  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, adjusted));
}

/**
 * Reset the cached thresholds (for testing).
 */
function resetThresholdsCache() {
  cachedThresholds = null;
}

module.exports = {
  loadThresholds,
  getDefaultThresholds,
  getThresholds,
  getConfidenceLevel,
  isAcceptable,
  createValidationResult,
  getDefaultMessage,
  combineScores,
  adjustScore,
  resetThresholdsCache
};
