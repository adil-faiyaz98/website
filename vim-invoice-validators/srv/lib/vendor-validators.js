// @ts-check
/**
 * @fileoverview Vendor validators with multi-strategy matching.
 * Validates vendor IDs and names against ECC master data using various matching strategies.
 */

const cds = require('@sap/cds');
const { 
  normalizeVendorNumber, 
  normalizeVendorNumberPadded,
  normalizeCompanyName,
  extractSignificantTokens
} = require('./utils/normalizers');
const { 
  calculateCompanyNameScore, 
  findBestMatches,
  levenshteinSimilarity
} = require('./utils/string-matching');
const { createValidationResult, isAcceptable, adjustScore } = require('./utils/confidence');
const cache = require('./cache');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 * @typedef {import('./types').VendorMaster} VendorMaster
 * @typedef {import('./types').MatchCandidate} MatchCandidate
 */

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}


/**
 * Fetch vendor list from ECC with caching.
 * @param {string} companyCode - Company code
 * @returns {Promise<VendorMaster[]>} List of vendors
 */
async function fetchVendorList(companyCode) {
  // Check cache first
  const cached = cache.getCachedVendorList(companyCode);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getBBPVendorList({ COMP_CODE: companyCode });
    
    if (!result || !result.VENDOR) {
      return [];
    }
    
    const vendors = result.VENDOR.map(v => ({
      vendorId: v.VENDOR_NO,
      name: v.NAME
    }));
    
    // Cache the list
    cache.cacheVendorList(companyCode, vendors);
    
    return vendors;
  } catch (error) {
    console.error(`Error fetching vendor list for ${companyCode}:`, error);
    return [];
  }
}

/**
 * Fetch detailed vendor information from ECC.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<VendorMaster | null>} Vendor details or null
 */
async function fetchVendorDetail(vendorId, companyCode) {
  const normalizedVendor = normalizeVendorNumberPadded(vendorId);
  
  // Check cache
  const cached = cache.getCachedVendor(companyCode, normalizedVendor);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getVendorDetail({
      VENDORNO: normalizedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }
    
    const vendor = {
      vendorId: normalizedVendor,
      name: result.GENERALDETAIL?.NAME,
      name2: result.GENERALDETAIL?.NAME_2,
      city: result.GENERALDETAIL?.CITY,
      country: result.GENERALDETAIL?.COUNTRY,
      postalCode: result.GENERALDETAIL?.POSTL_CODE,
      paymentTerms: result.COMPANYDETAIL?.PMNTTRMS
    };
    
    // Cache the result
    cache.cacheVendor(companyCode, normalizedVendor, vendor);
    
    return vendor;
  } catch (error) {
    console.error(`Error fetching vendor ${vendorId}:`, error);
    return null;
  }
}


/**
 * Validate vendor by ID - exact match strategy.
 * @param {string} vendorId - Vendor ID to validate
 * @param {ValidationContext} context - Validation context (requires companyCode)
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateVendorById(vendorId, context) {
  if (!vendorId) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Vendor ID is required'
    });
  }
  
  if (!context.companyCode) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Company code is required for vendor validation'
    });
  }
  
  const normalizedId = normalizeVendorNumberPadded(vendorId);
  const vendor = await fetchVendorDetail(normalizedId, context.companyCode);
  
  if (!vendor) {
    return createValidationResult(false, 0, 'vendor', {
      message: `Vendor ${vendorId} not found in company ${context.companyCode}`
    });
  }
  
  return createValidationResult(true, 1.0, 'vendor', {
    derivedValue: vendor.vendorId,
    matchStrategy: 'exact',
    message: `Vendor ${vendor.vendorId} (${vendor.name}) validated`,
    metadata: vendor
  });
}

/**
 * Validate vendor by name - fuzzy matching strategy.
 * @param {string} vendorName - Vendor name to validate
 * @param {ValidationContext} context - Validation context (requires companyCode)
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateVendorByName(vendorName, context) {
  if (!vendorName) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Vendor name is required'
    });
  }
  
  if (!context.companyCode) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Company code is required for vendor validation'
    });
  }
  
  const vendors = await fetchVendorList(context.companyCode);
  
  if (vendors.length === 0) {
    return createValidationResult(false, 0, 'vendor', {
      message: `No vendors found for company ${context.companyCode}`
    });
  }
  
  // Find best matches using company name scoring
  const matches = findBestMatches(
    vendorName, 
    vendors, 
    v => v.name,
    { minScore: 0.5, limit: 5, companyName: true }
  );
  
  if (matches.length === 0) {
    return createValidationResult(false, 0.1, 'vendor', {
      message: `No matching vendor found for "${vendorName}"`
    });
  }
  
  const bestMatch = matches[0];
  const confidence = bestMatch.score.score;
  
  // Check if there are ambiguous matches (multiple high-scoring candidates)
  const ambiguous = matches.filter(m => m.score.score >= confidence * 0.9).length > 1;
  
  let adjustedScore = confidence;
  if (ambiguous) {
    adjustedScore = adjustScore(confidence, { multipleCandidates: 0.1 });
  }
  
  const isValid = isAcceptable(adjustedScore, 'vendor', context.thresholds);
  
  return createValidationResult(isValid, adjustedScore, 'vendor', {
    derivedValue: bestMatch.item.vendorId,
    matchStrategy: bestMatch.score.strategy,
    message: isValid
      ? `Matched vendor "${bestMatch.item.name}" (${(adjustedScore * 100).toFixed(0)}% confidence)`
      : `Best match "${bestMatch.item.name}" below confidence threshold`,
    metadata: {
      matchedVendor: bestMatch.item,
      allMatches: matches.map(m => ({
        vendorId: m.item.vendorId,
        name: m.item.name,
        score: m.score.score
      })),
      ambiguous
    }
  });
}


/**
 * Validate vendor using combined ID and name strategy.
 * Tries ID first, falls back to name matching.
 * @param {string} [vendorId] - Vendor ID (optional)
 * @param {string} [vendorName] - Vendor name (optional)
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateVendor(vendorId, vendorName, context) {
  if (!context.companyCode) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Company code is required for vendor validation'
    });
  }
  
  // Strategy 1: Try exact ID match first
  if (vendorId) {
    const idResult = await validateVendorById(vendorId, context);
    
    if (idResult.isValid) {
      // If we also have a name, verify it matches for extra confidence
      if (vendorName && idResult.metadata?.name) {
        const nameScore = calculateCompanyNameScore(vendorName, idResult.metadata.name);
        if (nameScore.score < 0.5) {
          // Name mismatch - flag for review
          return createValidationResult(true, 0.7, 'vendor', {
            ...idResult,
            message: `Vendor ID valid but name mismatch: expected "${idResult.metadata.name}", got "${vendorName}"`,
            metadata: {
              ...idResult.metadata,
              nameMatchScore: nameScore.score,
              providedName: vendorName
            }
          });
        }
        // Both ID and name match - high confidence
        return createValidationResult(true, adjustScore(idResult.confidence, { exactIdMatch: 0.1 }), 'vendor', {
          ...idResult,
          matchStrategy: 'id+name'
        });
      }
      return idResult;
    }
  }
  
  // Strategy 2: Fall back to name matching
  if (vendorName) {
    const nameResult = await validateVendorByName(vendorName, context);
    
    // If we had an invalid ID, note that in the result
    if (vendorId && nameResult.isValid) {
      return createValidationResult(true, nameResult.confidence * 0.9, 'vendor', {
        ...nameResult,
        message: `Vendor ID ${vendorId} not found, matched by name instead`,
        metadata: {
          ...nameResult.metadata,
          providedVendorId: vendorId
        }
      });
    }
    
    return nameResult;
  }
  
  return createValidationResult(false, 0, 'vendor', {
    message: 'Either vendor ID or vendor name is required'
  });
}


/**
 * Search vendors by name pattern.
 * @param {string} searchTerm - Search term
 * @param {ValidationContext} context - Validation context
 * @param {Object} [options] - Search options
 * @param {number} [options.limit=10] - Max results
 * @param {number} [options.minScore=0.3] - Min match score
 * @returns {Promise<Array<{vendor: VendorMaster, score: number}>>} Matching vendors
 */
async function searchVendors(searchTerm, context, options = {}) {
  const { limit = 10, minScore = 0.3 } = options;
  
  if (!context.companyCode) {
    return [];
  }
  
  const vendors = await fetchVendorList(context.companyCode);
  
  const matches = findBestMatches(
    searchTerm,
    vendors,
    v => v.name,
    { minScore, limit, companyName: true }
  );
  
  return matches.map(m => ({
    vendor: m.item,
    score: m.score.score
  }));
}

/**
 * Validate vendor group key.
 * @param {string} vendorId - Vendor ID
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateVendorGroupKey(vendorId) {
  if (!vendorId) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Vendor ID is required'
    });
  }
  
  try {
    const ecc = await getEccService();
    const normalizedId = normalizeVendorNumberPadded(vendorId);
    const result = await ecc.checkVendorGroupKey({ I_LIFNR: normalizedId });
    
    const isValid = result?.E_SUCC === 'X';
    
    return createValidationResult(isValid, isValid ? 1.0 : 0, 'vendor', {
      derivedValue: normalizedId,
      message: isValid 
        ? 'Vendor group key validated'
        : 'Vendor group key validation failed'
    });
  } catch (error) {
    console.error('Error validating vendor group key:', error);
    return createValidationResult(false, 0, 'vendor', {
      message: 'Error validating vendor group key'
    });
  }
}


/**
 * Get vendor payment information.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<Object|null>} Payment info or null
 */
async function getVendorPaymentInfo(vendorId, companyCode) {
  const vendor = await fetchVendorDetail(vendorId, companyCode);
  
  if (!vendor) {
    return null;
  }
  
  return {
    vendorId: vendor.vendorId,
    paymentTerms: vendor.paymentTerms,
    name: vendor.name
  };
}

/**
 * Derive vendor ID from name when ID is missing.
 * @param {string} vendorName - Vendor name
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<{vendorId: string, confidence: number} | null>} Derived ID or null
 */
async function deriveVendorIdFromName(vendorName, context) {
  const result = await validateVendorByName(vendorName, context);
  
  if (result.isValid && result.derivedValue) {
    return {
      vendorId: result.derivedValue,
      confidence: result.confidence
    };
  }
  
  return null;
}

/**
 * Check if vendor is active/valid for invoicing.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<boolean>} True if vendor is active
 */
async function isVendorActive(vendorId, companyCode) {
  const vendor = await fetchVendorDetail(vendorId, companyCode);
  return vendor !== null;
}

module.exports = {
  fetchVendorList,
  fetchVendorDetail,
  validateVendorById,
  validateVendorByName,
  validateVendor,
  searchVendors,
  validateVendorGroupKey,
  getVendorPaymentInfo,
  deriveVendorIdFromName,
  isVendorActive
};
