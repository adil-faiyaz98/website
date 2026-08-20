// @ts-check
/**
 * @fileoverview Supplier validators for vendor identification, block analysis, and fraud detection.
 * Provides advanced supplier matching and risk assessment capabilities.
 */

const cds = require('@sap/cds');
const { 
  normalizeCompanyName, 
  normalizeVendorNumberPadded,
  extractSignificantTokens,
  normalizeAmount
} = require('./utils/normalizers');
const { 
  calculateCompanyNameScore, 
  findBestMatches,
  levenshteinSimilarity
} = require('./utils/string-matching');
const { createValidationResult, adjustScore, isAcceptable } = require('./utils/confidence');
const cache = require('./cache');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 */

/**
 * Fraud risk indicators.
 * @typedef {Object} FraudRiskIndicators
 * @property {number} riskScore - Overall risk score (0-1, higher = more risk)
 * @property {string[]} flags - List of risk flags
 * @property {Object} details - Detailed risk analysis
 */

/**
 * Vendor block status.
 * @typedef {Object} VendorBlockStatus
 * @property {boolean} isBlocked - Whether vendor is blocked
 * @property {string[]} blockTypes - Types of blocks (posting, payment, purchasing)
 * @property {string} [reason] - Block reason if available
 */

async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}


/**
 * Identify vendor ID from supplier name using multiple strategies.
 * @param {string} supplierName - Supplier name from invoice
 * @param {ValidationContext} context - Validation context
 * @param {Object} [additionalInfo] - Additional info for matching
 * @param {string} [additionalInfo.city] - City
 * @param {string} [additionalInfo.postalCode] - Postal code
 * @param {string} [additionalInfo.taxNumber] - Tax ID
 * @param {string} [additionalInfo.bankAccount] - Bank account (last 4 digits)
 * @returns {Promise<ValidationResult>}
 */
async function identifyVendorFromSupplier(supplierName, context, additionalInfo = {}) {
  if (!supplierName) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Supplier name is required'
    });
  }
  
  if (!context.companyCode) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Company code is required'
    });
  }
  
  try {
    const ecc = await getEccService();
    
    // Fetch vendor list for the company
    const result = await ecc.getBBPVendorList({ COMP_CODE: context.companyCode });
    
    if (!result || !result.VENDOR || result.VENDOR.length === 0) {
      return createValidationResult(false, 0, 'vendor', {
        message: `No vendors found for company ${context.companyCode}`
      });
    }
    
    const vendors = result.VENDOR.map(v => ({
      vendorId: v.VENDOR_NO,
      name: v.NAME
    }));
    
    // Strategy 1: Name matching
    const nameMatches = findBestMatches(
      supplierName,
      vendors,
      v => v.name,
      { minScore: 0.4, limit: 10, companyName: true }
    );
    
    if (nameMatches.length === 0) {
      return createValidationResult(false, 0.1, 'vendor', {
        message: `No matching vendor found for supplier "${supplierName}"`
      });
    }
    
    // If we have additional info, use it to boost/filter matches
    let bestMatch = nameMatches[0];
    let confidence = bestMatch.score.score;
    
    if (additionalInfo.city || additionalInfo.postalCode || additionalInfo.taxNumber) {
      // Fetch details for top candidates to compare additional fields
      for (const match of nameMatches.slice(0, 3)) {
        const vendorDetail = await getVendorDetailWithCache(match.item.vendorId, context.companyCode);
        
        if (vendorDetail) {
          let boost = 0;
          
          // City match
          if (additionalInfo.city && vendorDetail.city) {
            const cityScore = levenshteinSimilarity(additionalInfo.city, vendorDetail.city);
            if (cityScore > 0.8) boost += 0.1;
          }
          
          // Postal code match
          if (additionalInfo.postalCode && vendorDetail.postalCode) {
            if (additionalInfo.postalCode === vendorDetail.postalCode) boost += 0.15;
          }
          
          // Tax number match (strongest indicator)
          if (additionalInfo.taxNumber && vendorDetail.taxNumber) {
            const taxMatch = additionalInfo.taxNumber.replace(/[^0-9]/g, '') === 
                            vendorDetail.taxNumber.replace(/[^0-9]/g, '');
            if (taxMatch) boost += 0.25;
          }
          
          const adjustedScore = adjustScore(match.score.score, { exactIdMatch: boost });
          
          if (adjustedScore > confidence) {
            confidence = adjustedScore;
            bestMatch = match;
          }
        }
      }
    }
    
    // Check for ambiguous matches
    const closeMatches = nameMatches.filter(m => m.score.score >= confidence * 0.9);
    const isAmbiguous = closeMatches.length > 1;
    
    if (isAmbiguous) {
      confidence = adjustScore(confidence, { multipleCandidates: 0.1 });
    }
    
    const isValid = isAcceptable(confidence, 'vendor', context.thresholds);
    
    return createValidationResult(isValid, confidence, 'vendor', {
      derivedValue: bestMatch.item.vendorId,
      matchStrategy: bestMatch.score.strategy,
      message: isValid
        ? `Identified vendor ${bestMatch.item.vendorId} (${bestMatch.item.name})`
        : `Best match ${bestMatch.item.name} below confidence threshold`,
      metadata: {
        matchedVendor: bestMatch.item,
        allMatches: nameMatches.slice(0, 5).map(m => ({
          vendorId: m.item.vendorId,
          name: m.item.name,
          score: m.score.score
        })),
        isAmbiguous,
        additionalInfoUsed: Object.keys(additionalInfo).filter(k => additionalInfo[k])
      }
    });
  } catch (error) {
    return createValidationResult(false, 0, 'vendor', {
      message: `Error identifying vendor: ${error.message}`
    });
  }
}

/**
 * Get vendor detail with caching.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<Object|null>}
 */
async function getVendorDetailWithCache(vendorId, companyCode) {
  const cached = cache.getCachedVendor(companyCode, vendorId);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getVendorDetail({
      VENDORNO: normalizeVendorNumberPadded(vendorId),
      COMPANYCODE: companyCode
    });
    
    if (!result || result.RETURN?.TYPE === 'E') return null;
    
    const detail = {
      vendorId,
      name: result.GENERALDETAIL?.NAME,
      name2: result.GENERALDETAIL?.NAME_2,
      city: result.GENERALDETAIL?.CITY,
      postalCode: result.GENERALDETAIL?.POSTL_CODE,
      country: result.GENERALDETAIL?.COUNTRY,
      taxNumber: result.GENERALDETAIL?.TAX_NO_1,
      paymentTerms: result.COMPANYDETAIL?.PMNTTRMS
    };
    
    cache.cacheVendor(companyCode, vendorId, detail);
    return detail;
  } catch (error) {
    return null;
  }
}


/**
 * Analyze vendor blocks (posting, payment, purchasing).
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<VendorBlockStatus>}
 */
async function analyzeVendorBlocks(vendorId, companyCode) {
  try {
    const ecc = await getEccService();
    const paddedVendor = normalizeVendorNumberPadded(vendorId);
    
    const result = await ecc.getVendorDetail({
      VENDORNO: paddedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return {
        isBlocked: false,
        blockTypes: [],
        reason: 'Unable to retrieve vendor details'
      };
    }
    
    const blockTypes = [];
    let reason = '';
    
    // Check general block (central)
    if (result.GENERALDETAIL?.CENT_BLOCK) {
      blockTypes.push('central');
      reason = 'Vendor is centrally blocked';
    }
    
    // Check posting block
    if (result.COMPANYDETAIL?.POST_BLOCK) {
      blockTypes.push('posting');
      reason = reason || 'Vendor is blocked for posting';
    }
    
    // Check payment block
    if (result.COMPANYDETAIL?.PMNT_BLOCK) {
      blockTypes.push('payment');
      reason = reason || 'Vendor is blocked for payment';
    }
    
    // Check purchasing block
    if (result.PURCHASINGDETAIL?.PUR_BLOCK) {
      blockTypes.push('purchasing');
      reason = reason || 'Vendor is blocked for purchasing';
    }
    
    return {
      isBlocked: blockTypes.length > 0,
      blockTypes,
      reason: blockTypes.length > 0 ? reason : 'Vendor is not blocked'
    };
  } catch (error) {
    return {
      isBlocked: false,
      blockTypes: [],
      reason: `Error checking vendor blocks: ${error.message}`
    };
  }
}

/**
 * Detect potential fraud indicators on an invoice.
 * @param {Object} invoiceData - Invoice data
 * @param {string} invoiceData.vendorId - Vendor ID
 * @param {string} invoiceData.companyCode - Company code
 * @param {number} invoiceData.amount - Invoice amount
 * @param {string} [invoiceData.invoiceNumber] - Invoice number
 * @param {string} [invoiceData.invoiceDate] - Invoice date
 * @param {string} [invoiceData.bankAccount] - Bank account on invoice
 * @param {string} [invoiceData.poNumber] - PO number if provided
 * @returns {Promise<FraudRiskIndicators>}
 */
async function detectFraudIndicators(invoiceData) {
  const flags = [];
  const details = {};
  let riskScore = 0;
  
  const { vendorId, companyCode, amount, invoiceNumber, invoiceDate, bankAccount, poNumber } = invoiceData;
  
  try {
    const vendorDetail = await getVendorDetailWithCache(vendorId, companyCode);
    
    // Check 1: New vendor (no payment terms established)
    if (vendorDetail && !vendorDetail.paymentTerms) {
      flags.push('NEW_VENDOR_NO_TERMS');
      details.newVendor = 'Vendor has no established payment terms';
      riskScore += 0.1;
    }
    
    // Check 2: Round amount (potential indicator)
    const normalizedAmount = normalizeAmount(amount);
    if (normalizedAmount > 1000 && normalizedAmount % 1000 === 0) {
      flags.push('ROUND_AMOUNT');
      details.roundAmount = `Invoice amount ${amount} is suspiciously round`;
      riskScore += 0.05;
    }
    
    // Check 3: Very large amount without PO
    if (!poNumber && normalizedAmount > 50000) {
      flags.push('LARGE_NON_PO_INVOICE');
      details.largeNonPO = `Large invoice ${amount} without PO reference`;
      riskScore += 0.15;
    }
    
    // Check 4: Duplicate invoice number pattern
    if (invoiceNumber) {
      const simplePattern = /^[0-9]{1,4}$/.test(invoiceNumber);
      if (simplePattern) {
        flags.push('SIMPLE_INVOICE_NUMBER');
        details.simpleInvoiceNumber = `Invoice number "${invoiceNumber}" is unusually simple`;
        riskScore += 0.1;
      }
    }
    
    // Check 5: Weekend/holiday invoice date
    if (invoiceDate) {
      const date = new Date(invoiceDate);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        flags.push('WEEKEND_INVOICE');
        details.weekendInvoice = 'Invoice dated on weekend';
        riskScore += 0.05;
      }
    }
    
    // Check 6: Bank account mismatch (if we have vendor bank info)
    if (bankAccount && vendorDetail) {
      // Would check against stored bank accounts
      // For now, flag if bank account is provided but differs format
      details.bankAccountProvided = true;
    }
    
    // Check 7: Vendor blocks
    const blockStatus = await analyzeVendorBlocks(vendorId, companyCode);
    if (blockStatus.isBlocked) {
      flags.push('VENDOR_BLOCKED');
      details.vendorBlocked = blockStatus;
      riskScore += 0.3;
    }
    
    // Check 8: Rush payment indicators (very short payment terms requested)
    // Would need invoice payment terms to check
    
    // Normalize risk score to 0-1 range
    riskScore = Math.min(1, riskScore);
    
    return {
      riskScore,
      flags,
      details,
      riskLevel: riskScore > 0.5 ? 'HIGH' : riskScore > 0.2 ? 'MEDIUM' : 'LOW',
      recommendation: riskScore > 0.5 
        ? 'Manual review required before processing'
        : riskScore > 0.2
          ? 'Additional verification recommended'
          : 'Normal processing'
    };
  } catch (error) {
    return {
      riskScore: 0.5,
      flags: ['VALIDATION_ERROR'],
      details: { error: error.message },
      riskLevel: 'MEDIUM',
      recommendation: 'Unable to complete fraud analysis - manual review recommended'
    };
  }
}


/**
 * Validate vendor group key using ECC check function.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<ValidationResult>}
 */
async function validateVendorGroupKey(vendorId, companyCode) {
  try {
    const ecc = await getEccService();
    const paddedVendor = normalizeVendorNumberPadded(vendorId);
    
    const result = await ecc.checkVendorGroupKey({
      VENDORNO: paddedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!result) {
      return createValidationResult(false, 0, 'vendor', {
        message: 'Unable to validate vendor group key'
      });
    }
    
    // Check return message for validation result
    if (result.RETURN?.TYPE === 'E') {
      return createValidationResult(false, 0, 'vendor', {
        message: result.RETURN.MESSAGE || 'Vendor group key validation failed',
        metadata: { returnCode: result.RETURN }
      });
    }
    
    return createValidationResult(true, 1.0, 'vendor', {
      message: 'Vendor group key is valid',
      metadata: {
        groupKey: result.GROUP_KEY,
        vendorId: paddedVendor
      }
    });
  } catch (error) {
    return createValidationResult(false, 0, 'vendor', {
      message: `Error validating vendor group key: ${error.message}`
    });
  }
}

/**
 * Get comprehensive vendor risk profile.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<Object>}
 */
async function getVendorRiskProfile(vendorId, companyCode) {
  const profile = {
    vendorId,
    companyCode,
    timestamp: new Date().toISOString(),
    status: 'unknown',
    riskFactors: [],
    overallRisk: 'LOW'
  };
  
  try {
    // Get vendor details
    const vendorDetail = await getVendorDetailWithCache(vendorId, companyCode);
    if (!vendorDetail) {
      profile.status = 'not_found';
      profile.riskFactors.push('VENDOR_NOT_FOUND');
      profile.overallRisk = 'HIGH';
      return profile;
    }
    
    profile.vendorName = vendorDetail.name;
    profile.country = vendorDetail.country;
    profile.status = 'active';
    
    // Check blocks
    const blockStatus = await analyzeVendorBlocks(vendorId, companyCode);
    profile.blockStatus = blockStatus;
    if (blockStatus.isBlocked) {
      profile.riskFactors.push(...blockStatus.blockTypes.map(t => `BLOCKED_${t.toUpperCase()}`));
    }
    
    // Validate group key
    const groupKeyResult = await validateVendorGroupKey(vendorId, companyCode);
    profile.groupKeyValid = groupKeyResult.isValid;
    if (!groupKeyResult.isValid) {
      profile.riskFactors.push('INVALID_GROUP_KEY');
    }
    
    // Check for missing critical data
    if (!vendorDetail.taxNumber) {
      profile.riskFactors.push('MISSING_TAX_NUMBER');
    }
    if (!vendorDetail.paymentTerms) {
      profile.riskFactors.push('MISSING_PAYMENT_TERMS');
    }
    
    // Determine overall risk
    const highRiskFactors = ['BLOCKED_CENTRAL', 'BLOCKED_PAYMENT', 'VENDOR_NOT_FOUND', 'INVALID_GROUP_KEY'];
    const mediumRiskFactors = ['BLOCKED_POSTING', 'BLOCKED_PURCHASING', 'MISSING_TAX_NUMBER'];
    
    const hasHighRisk = profile.riskFactors.some(f => highRiskFactors.includes(f));
    const hasMediumRisk = profile.riskFactors.some(f => mediumRiskFactors.includes(f));
    
    if (hasHighRisk) {
      profile.overallRisk = 'HIGH';
    } else if (hasMediumRisk || profile.riskFactors.length >= 2) {
      profile.overallRisk = 'MEDIUM';
    } else {
      profile.overallRisk = 'LOW';
    }
    
    profile.recommendation = profile.overallRisk === 'HIGH'
      ? 'Do not process - vendor requires review'
      : profile.overallRisk === 'MEDIUM'
        ? 'Process with caution - some risk factors present'
        : 'Normal processing allowed';
    
    return profile;
  } catch (error) {
    profile.status = 'error';
    profile.error = error.message;
    profile.overallRisk = 'MEDIUM';
    profile.recommendation = 'Unable to complete risk assessment - manual review recommended';
    return profile;
  }
}

/**
 * Search for vendors by partial name.
 * @param {string} searchTerm - Search term
 * @param {string} companyCode - Company code
 * @param {number} [limit=10] - Maximum results
 * @returns {Promise<Array>}
 */
async function searchVendorsByName(searchTerm, companyCode, limit = 10) {
  try {
    const ecc = await getEccService();
    const result = await ecc.getBBPVendorList({ COMP_CODE: companyCode });
    
    if (!result || !result.VENDOR) return [];
    
    const normalized = normalizeCompanyName(searchTerm);
    const matches = findBestMatches(
      normalized,
      result.VENDOR,
      v => v.NAME,
      { minScore: 0.3, limit, companyName: true }
    );
    
    return matches.map(m => ({
      vendorId: m.item.VENDOR_NO,
      name: m.item.NAME,
      score: m.score.score,
      matchStrategy: m.score.strategy
    }));
  } catch (error) {
    console.error('Error searching vendors:', error);
    return [];
  }
}

/**
 * Validate vendor exists and is active.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<ValidationResult>}
 */
async function validateVendorActive(vendorId, companyCode) {
  const blockStatus = await analyzeVendorBlocks(vendorId, companyCode);
  
  if (blockStatus.blockTypes.includes('central')) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Vendor is centrally blocked',
      metadata: blockStatus
    });
  }
  
  if (blockStatus.blockTypes.includes('posting')) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Vendor is blocked for posting',
      metadata: blockStatus
    });
  }
  
  if (blockStatus.isBlocked) {
    return createValidationResult(true, 0.7, 'vendor', {
      message: `Vendor has partial blocks: ${blockStatus.blockTypes.join(', ')}`,
      metadata: blockStatus
    });
  }
  
  return createValidationResult(true, 1.0, 'vendor', {
    message: 'Vendor is active',
    metadata: blockStatus
  });
}

module.exports = {
  identifyVendorFromSupplier,
  getVendorDetailWithCache,
  analyzeVendorBlocks,
  detectFraudIndicators,
  validateVendorGroupKey,
  getVendorRiskProfile,
  searchVendorsByName,
  validateVendorActive
};
