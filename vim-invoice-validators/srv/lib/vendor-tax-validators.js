// @ts-check
/**
 * @fileoverview Vendor Validation and Tax Derivation Module.
 * Validates invoice vendor data against SAP ECC master data
 * and derives tax information using BAPI-based calculations.
 * 
 * Based on SAP ECC Tax Determination Logic:
 * - Tax code determined from: Plant country/region + Vendor country/region + Material tax class
 * - Tax jurisdiction from: Country + Region + Postal code (table COMC_TAXJUR_REG)
 * - Condition technique via NAVS/MWST condition types
 */

const cds = require('@sap/cds');
const { normalizeVendorNumberPadded, normalizeString, normalizeAmount } = require('./utils/normalizers');
const { 
  levenshteinSimilarity, 
  jaroWinklerSimilarity, 
  calculateCompanyNameScore 
} = require('./utils/string-matching');
const cache = require('./cache');

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}


// ============================================================================
// CONFIGURATION: VALIDATION THRESHOLDS
// ============================================================================

/**
 * Confidence thresholds for vendor matching.
 */
const VENDOR_MATCH_THRESHOLDS = {
  EXACT_MATCH: 1.0,
  HIGH_CONFIDENCE: 0.95,
  MEDIUM_CONFIDENCE: 0.80,
  LOW_CONFIDENCE: 0.60,
  MIN_ACCEPTABLE: 0.50
};

/**
 * Weights for vendor field matching.
 */
const VENDOR_FIELD_WEIGHTS = {
  name: 0.35,        // Company name is most important
  country: 0.20,     // Country must match for valid vendor
  city: 0.15,        // City provides good signal
  postalCode: 0.15,  // Postal code provides good signal
  street: 0.10,      // Street address (partial match ok)
  region: 0.05       // Region/state
};


// ============================================================================
// CONFIGURATION: TAX CODE MAPPING
// ============================================================================

/**
 * Tax-exempt expense types.
 */
const TAX_EXEMPT_EXPENSE_TYPES = [
  'insurance', 'liability_insurance', 'property_insurance',
  'taxes', 'licenses', 'fees',
  'airfare', 'mileage'
];


// ============================================================================
// VENDOR VALIDATION: FIELD-BY-FIELD MATCHING
// ============================================================================

/**
 * @typedef {Object} VendorMatchField
 * @property {string} fieldName - Name of the field
 * @property {string} invoiceValue - Value from invoice
 * @property {string} eccValue - Value from ECC
 * @property {number} similarity - Match score 0-1
 * @property {string} matchType - Type of match (exact, fuzzy, partial, none)
 */

/**
 * @typedef {Object} VendorValidationResult
 * @property {boolean} isValid - Whether vendor matches
 * @property {number} confidence - Overall confidence 0-1
 * @property {string} vendorId - Matched vendor ID
 * @property {VendorMatchField[]} fieldMatches - Individual field match results
 * @property {string[]} warnings - Any warnings
 * @property {string} source - Derivation source
 */

/**
 * Normalize address for comparison.
 * @param {string} address - Address string
 * @returns {string} Normalized address
 */
function normalizeAddress(address) {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/[.,#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(street|str|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard)\b/g, '')
    .trim();
}


/**
 * Match a single field between invoice and ECC data.
 * @param {string} fieldName - Field name
 * @param {string} invoiceValue - Value from invoice
 * @param {string} eccValue - Value from ECC
 * @param {string} [matchStrategy='fuzzy'] - Match strategy
 * @returns {VendorMatchField}
 */
function matchField(fieldName, invoiceValue, eccValue, matchStrategy = 'fuzzy') {
  const inv = normalizeString(invoiceValue || '');
  const ecc = normalizeString(eccValue || '');
  
  // Both empty - neutral match
  if (!inv && !ecc) {
    return { fieldName, invoiceValue, eccValue, similarity: 1.0, matchType: 'both_empty' };
  }
  
  // One empty - partial data
  if (!inv || !ecc) {
    return { fieldName, invoiceValue, eccValue, similarity: 0.5, matchType: 'partial_data' };
  }
  
  // Exact match
  if (inv === ecc) {
    return { fieldName, invoiceValue, eccValue, similarity: 1.0, matchType: 'exact' };
  }
  
  // Strategy-based matching
  let similarity = 0;
  let matchType = 'none';
  
  if (matchStrategy === 'exact') {
    similarity = inv === ecc ? 1.0 : 0;
    matchType = similarity === 1 ? 'exact' : 'none';
  } else if (matchStrategy === 'fuzzy') {
    similarity = levenshteinSimilarity(inv, ecc);
    matchType = similarity >= 0.9 ? 'fuzzy_high' : similarity >= 0.7 ? 'fuzzy_medium' : 'fuzzy_low';
  } else if (matchStrategy === 'name') {
    const nameScore = calculateCompanyNameScore(invoiceValue, eccValue);
    similarity = nameScore.score;
    matchType = nameScore.strategy;
  } else if (matchStrategy === 'contains') {
    if (inv.includes(ecc) || ecc.includes(inv)) {
      similarity = 0.8;
      matchType = 'contains';
    }
  }
  
  return { fieldName, invoiceValue, eccValue, similarity, matchType };
}


/**
 * Validate invoice vendor data against ECC vendor master.
 * Uses getVendorDetail BAPI to fetch GENERALDETAIL and compare fields.
 * 
 * @param {Object} params - Validation parameters
 * @param {string} params.vendorId - Vendor ID (from invoice or derived)
 * @param {string} params.companyCode - Company code
 * @param {Object} params.invoiceVendorData - Vendor data from invoice
 * @param {string} [params.invoiceVendorData.name] - Vendor name from invoice
 * @param {string} [params.invoiceVendorData.city] - City from invoice
 * @param {string} [params.invoiceVendorData.street] - Street from invoice
 * @param {string} [params.invoiceVendorData.postalCode] - Postal code from invoice
 * @param {string} [params.invoiceVendorData.country] - Country from invoice
 * @param {string} [params.invoiceVendorData.region] - Region/State from invoice
 * @returns {Promise<VendorValidationResult>}
 */
async function validateVendorDetails(params) {
  const { vendorId, companyCode, invoiceVendorData } = params;
  
  if (!vendorId) {
    return {
      isValid: false,
      confidence: 0,
      vendorId: null,
      fieldMatches: [],
      warnings: ['No vendor ID provided'],
      source: 'NO_VENDOR_ID'
    };
  }
  
  try {
    const ecc = await getEccService();
    const paddedVendor = normalizeVendorNumberPadded(vendorId);
    
    const result = await ecc.getVendorDetail({
      VENDORNO: paddedVendor,
      COMPANYCODE: companyCode
    });

    
    // Check for errors
    if (result.RETURN?.TYPE === 'E') {
      return {
        isValid: false,
        confidence: 0,
        vendorId,
        fieldMatches: [],
        warnings: [result.RETURN.MESSAGE || 'Vendor not found in ECC'],
        source: 'VENDOR_NOT_FOUND'
      };
    }
    
    const general = result.GENERALDETAIL || {};
    const company = result.COMPANYDETAIL || {};
    
    // Match each field from invoice against ECC
    const fieldMatches = [];
    const warnings = [];
    
    // Name matching (most important - use company name strategy)
    if (invoiceVendorData.name) {
      // Combine NAME, NAME_2, NAME_3, NAME_4 for full comparison
      const eccFullName = [general.NAME, general.NAME_2, general.NAME_3, general.NAME_4]
        .filter(Boolean)
        .join(' ');
      fieldMatches.push(matchField('name', invoiceVendorData.name, eccFullName, 'name'));
    }
    
    // Country matching (critical for tax determination)
    if (invoiceVendorData.country) {
      const countryMatch = matchField('country', invoiceVendorData.country, general.COUNTRY, 'exact');
      fieldMatches.push(countryMatch);
      if (countryMatch.similarity < 1.0) {
        warnings.push('Country mismatch may affect tax determination');
      }
    }

    
    // City matching
    if (invoiceVendorData.city) {
      fieldMatches.push(matchField('city', invoiceVendorData.city, general.CITY, 'fuzzy'));
    }
    
    // Postal code matching
    if (invoiceVendorData.postalCode) {
      fieldMatches.push(matchField('postalCode', invoiceVendorData.postalCode, general.POSTL_CODE, 'fuzzy'));
    }
    
    // Street matching (more lenient)
    if (invoiceVendorData.street) {
      const invStreet = normalizeAddress(invoiceVendorData.street);
      const eccStreet = normalizeAddress(general.STREET);
      fieldMatches.push(matchField('street', invStreet, eccStreet, 'contains'));
    }
    
    // Region matching
    if (invoiceVendorData.region) {
      fieldMatches.push(matchField('region', invoiceVendorData.region, general.REGION, 'exact'));
    }
    
    // Calculate weighted confidence
    let totalWeight = 0;
    let weightedScore = 0;
    
    for (const match of fieldMatches) {
      const weight = VENDOR_FIELD_WEIGHTS[match.fieldName] || 0.1;
      totalWeight += weight;
      weightedScore += match.similarity * weight;
    }
    
    const confidence = totalWeight > 0 ? weightedScore / totalWeight : 0;

    
    // Determine validity
    const isValid = confidence >= VENDOR_MATCH_THRESHOLDS.MIN_ACCEPTABLE;
    
    // Add ECC vendor data to result for downstream use
    return {
      isValid,
      confidence: Math.round(confidence * 100) / 100,
      vendorId,
      fieldMatches,
      warnings,
      source: 'ECC_VENDOR_MASTER',
      eccVendorData: {
        name: general.NAME,
        name2: general.NAME_2,
        city: general.CITY,
        street: general.STREET,
        postalCode: general.POSTL_CODE,
        country: general.COUNTRY,
        countryISO: general.COUNTRYISO,
        region: general.REGION,
        telephone: general.TELEPHONE,
        companyCode: company.COMP_CODE,
        paymentTerms: company.PMNTTRMS
      }
    };
    
  } catch (error) {
    return {
      isValid: false,
      confidence: 0,
      vendorId,
      fieldMatches: [],
      warnings: [`Error validating vendor: ${error.message}`],
      source: 'ERROR'
    };
  }
}


// ============================================================================
// TAX JURISDICTION DERIVATION
// ============================================================================

/**
 * @typedef {Object} TaxJurisdictionResult
 * @property {string} taxJurisdiction - Derived tax jurisdiction code
 * @property {number} confidence - Confidence level 0-1
 * @property {string} source - Derivation source
 * @property {string[]} possibleJurisdictions - Alternative jurisdictions
 */

/**
 * Derive tax jurisdiction from country, region, and postal code.
 * Uses getTaxJurisdictions BAPI and matching logic.
 * 
 * SAP Determination Logic:
 * - Tax jurisdiction = Country + Region + Postal code area
 * - Format varies by country (US: CCRRRPPPPP, others vary)
 * 
 * @param {Object} params
 * @param {string} params.country - Country code (2-3 char)
 * @param {string} [params.region] - Region/state code
 * @param {string} [params.postalCode] - Postal code
 * @param {string} [params.city] - City name (for fallback matching)
 * @returns {Promise<TaxJurisdictionResult>}
 */
async function deriveTaxJurisdiction(params) {
  const { country, region, postalCode, city } = params;
  
  if (!country) {
    return {
      taxJurisdiction: null,
      confidence: 0,
      source: 'NO_COUNTRY',
      possibleJurisdictions: []
    };
  }

  
  try {
    const ecc = await getEccService();
    
    // Fetch all jurisdictions for the country
    const jurisdictions = await ecc.getTaxJurisdictions({
      country: country.toUpperCase()
    });
    
    if (!jurisdictions || jurisdictions.length === 0) {
      // Country may not use tax jurisdictions
      return {
        taxJurisdiction: null,
        confidence: 0.70,  // Still fairly confident no jurisdiction needed
        source: 'NO_JURISDICTIONS_FOR_COUNTRY',
        possibleJurisdictions: []
      };
    }
    
    // Try to match jurisdiction based on available data
    let bestMatch = null;
    let bestScore = 0;
    const possibleMatches = [];
    
    for (const jur of jurisdictions) {
      let score = 0;
      const jurCode = jur.TXJCD || '';
      const jurText = jur.TEXT1 || '';
      
      // US format: CCRRRPPPPP (Country[2] + Region[3] + Postal[5])
      if (country === 'US' || country === 'USA') {
        if (region && postalCode) {
          const expectedPrefix = region.substring(0, 3).toUpperCase();
          const postalPrefix = postalCode.substring(0, 5);
          
          // Check if jurisdiction matches region + postal
          if (jurCode.includes(expectedPrefix) || jurCode.includes(postalPrefix)) {
            score = 0.95;
          }
        } else if (region) {
          const expectedPrefix = region.substring(0, 2).toUpperCase();
          if (jurCode.startsWith(expectedPrefix) || jurText.toUpperCase().includes(region.toUpperCase())) {
            score = 0.80;
          }
        }
      } else {
        // Non-US: Try text matching with city/region
        if (city && jurText.toLowerCase().includes(city.toLowerCase())) {
          score = 0.85;
        } else if (region && jurText.toLowerCase().includes(region.toLowerCase())) {
          score = 0.75;
        }
      }

      
      if (score > 0) {
        possibleMatches.push({ jurisdiction: jurCode, text: jurText, score });
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = jurCode;
      }
    }
    
    // Sort possible matches by score
    possibleMatches.sort((a, b) => b.score - a.score);

    const topMatches = possibleMatches.filter(m => m.score === bestScore);
    if (bestMatch && new Set(topMatches.map(m => m.jurisdiction)).size > 1) {
      return {
        taxJurisdiction: null,
        confidence: 0,
        source: 'AMBIGUOUS_JURISDICTION',
        errorCode: 'AMBIGUOUS_JURISDICTION',
        possibleJurisdictions: possibleMatches.slice(0, 5).map(m => m.jurisdiction)
      };
    }

    if (bestMatch) {
      return {
        taxJurisdiction: bestMatch,
        confidence: bestScore,
        source: 'JURISDICTION_LOOKUP',
        possibleJurisdictions: possibleMatches.slice(0, 5).map(m => m.jurisdiction)
      };
    }

    // No specific match - never default to an arbitrary jurisdiction
    return {
      taxJurisdiction: null,
      confidence: 0,
      source: 'NO_JURISDICTION_MATCH',
      errorCode: 'NO_JURISDICTION_MATCH',
      possibleJurisdictions: jurisdictions.slice(0, 5).map(j => j.TXJCD)
    };
    
  } catch (error) {
    return {
      taxJurisdiction: null,
      confidence: 0,
      source: 'ERROR',
      possibleJurisdictions: [],
      error: error.message
    };
  }
}


// ============================================================================
// TAX CODE DERIVATION
// ============================================================================

/**
 * @typedef {Object} TaxCodeResult
 * @property {string} taxCode - Derived tax code
 * @property {number} confidence - Confidence level 0-1
 * @property {string} source - Derivation source
 * @property {string} taxDescription - Tax code description
 * @property {string[]} possibleCodes - Alternative tax codes
 * @property {boolean} isPO - Whether this is PO-based (100% confidence)
 */

/**
 * Derive tax code for an invoice (fail-closed).
 *
 * - For PO invoices: Use tax code from PO item (100% confidence)
 * - For Non-PO invoices: no tax code is selected here. SAP tax codes for the
 *   vendor country are ranked (domestic/import, expense type) and returned as
 *   possibleCodes for review; taxCode is null with errorCode NO_TAX_DETERMINATION.
 *   Use the tax determination engine for configured Non-PO determination.
 *
 * @param {Object} params
 * @param {string} params.companyCode - Company code
 * @param {string} params.vendorCountry - Vendor's country
 * @param {string} [params.plantCountry] - Plant/receiving country
 * @param {string} [params.poTaxCode] - Tax code from PO (if PO invoice)
 * @param {string} [params.expenseType] - Expense type for non-PO
 * @param {string} [params.materialGroup] - Material group
 * @param {string} [params.accountAssignmentCategory] - Account assignment (K, F, etc.)
 * @returns {Promise<TaxCodeResult>}
 */
async function deriveTaxCode(params) {
  const { 
    companyCode, 
    vendorCountry, 
    plantCountry, 
    poTaxCode, 
    expenseType,
    materialGroup,
    accountAssignmentCategory 
  } = params;

  
  // Priority 1: PO tax code (100% confidence for PO invoices)
  if (poTaxCode) {
    return {
      taxCode: poTaxCode,
      confidence: 1.0,
      source: 'PO_ITEM',
      taxDescription: 'From Purchase Order',
      possibleCodes: [poTaxCode],
      isPO: true
    };
  }
  
  if (!vendorCountry) {
    return {
      taxCode: null,
      confidence: 0,
      source: 'NO_VENDOR_COUNTRY',
      errorCode: 'VENDOR_COUNTRY_REQUIRED',
      taxDescription: null,
      possibleCodes: [],
      isPO: false
    };
  }

  // For non-PO: rank candidate tax codes for review only
  try {
    const ecc = await getEccService();

    // Fetch available tax codes for the vendor's country
    const taxCodes = await ecc.getTaxCodes({
      country: vendorCountry,
      language: 'E'
    });

    if (!taxCodes || taxCodes.length === 0) {
      return {
        taxCode: null,
        confidence: 0,
        source: 'NO_TAX_CODES_FOR_COUNTRY',
        errorCode: 'NO_TAX_DETERMINATION',
        taxDescription: null,
        possibleCodes: [],
        isPO: false
      };
    }

    
    // Determine if domestic or import
    const isDomestic = !plantCountry || vendorCountry === plantCountry;
    
    // Score each tax code based on available criteria
    const scoredCodes = [];
    
    for (const tc of taxCodes) {
      let score = 0.50; // Base score
      const code = tc.MWSKZ;
      const description = (tc.TEXT1 || '').toLowerCase();
      const taxType = tc.MWART; // 'A' = Output tax, 'V' = Input tax
      
      // Input tax for AP invoices
      if (taxType === 'V') {
        score += 0.10;
      }
      
      // Domestic vs Import matching
      if (isDomestic) {
        if (description.includes('domestic') || description.includes('input')) {
          score += 0.15;
        }
        if (description.includes('import') || description.includes('acquisition')) {
          score -= 0.20;
        }
      } else {
        if (description.includes('import') || description.includes('acquisition')) {
          score += 0.15;
        }
      }
      
      // Expense type hints
      if (expenseType) {
        if (TAX_EXEMPT_EXPENSE_TYPES.includes(expenseType)) {
          if (description.includes('exempt') || description.includes('zero') || code === 'V0') {
            score += 0.20;
          }
        } else {
          if (description.includes('standard') || description.includes('full')) {
            score += 0.10;
          }
        }
      }
      
      scoredCodes.push({ code, description: tc.TEXT1, score, taxType });
    }

    
    // Sort by score descending (tie-break on code for deterministic order)
    scoredCodes.sort((a, b) => b.score - a.score || String(a.code).localeCompare(String(b.code)));

    // Keyword ranking is a review aid only - it never selects the tax code
    return {
      taxCode: null,
      confidence: 0,
      source: 'TAX_CODE_ANALYSIS',
      errorCode: 'NO_TAX_DETERMINATION',
      taxDescription: null,
      possibleCodes: scoredCodes.slice(0, 5).map(c => c.code),
      isPO: false,
      scoredCodes: scoredCodes.slice(0, 5)
    };

  } catch (error) {
    return {
      taxCode: null,
      confidence: 0,
      source: 'ERROR',
      errorCode: 'EXCEPTION',
      taxDescription: null,
      possibleCodes: [],
      isPO: false,
      error: error.message
    };
  }
}


// ============================================================================
// TAX AMOUNT CALCULATION
// ============================================================================

/**
 * @typedef {Object} TaxCalculationResult
 * @property {number} taxAmount - Calculated tax amount
 * @property {number} netAmount - Net amount (input or calculated)
 * @property {number} grossAmount - Gross amount (net + tax)
 * @property {number} taxRate - Tax rate percentage
 * @property {number} confidence - Confidence level (100% when BAPI calculated)
 * @property {string} source - Calculation source
 * @property {Array} taxDetails - Detailed tax breakdown
 */

/**
 * Calculate tax amount using SAP BAPI calculateTaxFromNet.
 * This is 100% deterministic as it uses SAP's tax engine.
 * 
 * @param {Object} params
 * @param {string} params.companyCode - Company code (I_BUKRS)
 * @param {string} params.taxCode - Tax code (I_MWSKZ)
 * @param {string} params.currency - Currency code (I_WAERS)
 * @param {number} params.netAmount - Net amount (I_WRBTR)
 * @param {string} [params.taxJurisdiction] - Tax jurisdiction (I_TXJCD)
 * @param {Date} [params.pricingDate] - Pricing date (I_PRSDT)
 * @returns {Promise<TaxCalculationResult>}
 */
async function calculateTaxAmount(params) {
  const { companyCode, taxCode, currency, netAmount, taxJurisdiction, pricingDate } = params;
  
  if (!companyCode || !taxCode || !currency || netAmount === undefined) {
    return {
      taxAmount: 0,
      netAmount: normalizeAmount(netAmount) || 0,
      grossAmount: normalizeAmount(netAmount) || 0,
      taxRate: 0,
      confidence: 0,
      source: 'MISSING_PARAMETERS',
      taxDetails: []
    };
  }

  
  try {
    const ecc = await getEccService();
    const normalizedNet = normalizeAmount(netAmount);
    
    const calcParams = {
      I_BUKRS: companyCode,
      I_MWSKZ: taxCode,
      I_WAERS: currency,
      I_WRBTR: normalizedNet
    };
    
    // Add optional parameters
    if (taxJurisdiction) {
      calcParams.I_TXJCD = taxJurisdiction;
    }
    if (pricingDate) {
      calcParams.I_PRSDT = pricingDate;
    }
    
    const result = await ecc.calculateTaxFromNet(calcParams);
    
    // Extract results
    // E_FWSTE = Tax amount
    // E_FWNAV = Non-deductible tax
    // E_FWAST = Total tax including non-deductible
    // T_MWDAT = Tax breakdown details
    
    const taxAmount = normalizeAmount(result.E_FWSTE) || 0;
    const totalTax = normalizeAmount(result.E_FWAST) || taxAmount;
    const nonDeductible = normalizeAmount(result.E_FWNAV) || 0;
    const grossAmount = normalizedNet + totalTax;
    
    // Calculate effective tax rate
    const taxRate = normalizedNet > 0 ? (totalTax / normalizedNet) * 100 : 0;

    
    // Parse tax details
    const taxDetails = (result.T_MWDAT || []).map(td => ({
      conditionType: td.KSCHL,
      taxRate: normalizeAmount(td.MSATZ),
      taxAmount: normalizeAmount(td.WMWST),
      baseAmount: normalizeAmount(td.KAWRT),
      glAccount: td.HKONT,
      jurisdiction: td.TXJCD
    }));
    
    return {
      taxAmount: Math.round(taxAmount * 100) / 100,
      netAmount: normalizedNet,
      grossAmount: Math.round(grossAmount * 100) / 100,
      taxRate: Math.round(taxRate * 100) / 100,
      nonDeductibleTax: nonDeductible,
      confidence: 1.0,  // BAPI calculation is deterministic
      source: 'BAPI_CALCULATION',
      taxDetails
    };
    
  } catch (error) {
    // Fail closed: tax amounts are never estimated locally
    const normalizedNet = normalizeAmount(netAmount) || 0;

    return {
      taxAmount: 0,
      netAmount: normalizedNet,
      grossAmount: normalizedNet,
      taxRate: 0,
      confidence: 0,
      source: 'CALCULATION_FAILED',
      errorCode: 'TAX_CALCULATION_FAILED',
      taxDetails: [],
      error: error.message
    };
  }
}


// ============================================================================
// TAX AMOUNT VALIDATION
// ============================================================================

/**
 * @typedef {Object} TaxValidationResult
 * @property {boolean} isValid - Whether tax amount is valid
 * @property {number} confidence - Confidence level
 * @property {number} invoiceTaxAmount - Tax from invoice
 * @property {number} calculatedTaxAmount - Tax calculated by BAPI
 * @property {number} variance - Absolute variance
 * @property {number} variancePercent - Variance as percentage
 * @property {string} status - 'EXACT', 'WITHIN_TOLERANCE', 'EXCEEDS_TOLERANCE'
 */

/**
 * Validate invoice tax amount against BAPI calculation.
 * 
 * @param {Object} params
 * @param {number} params.invoiceTaxAmount - Tax amount from invoice
 * @param {number} params.netAmount - Net amount from invoice
 * @param {string} params.companyCode - Company code
 * @param {string} params.taxCode - Tax code
 * @param {string} params.currency - Currency
 * @param {string} [params.taxJurisdiction] - Tax jurisdiction
 * @param {number} [params.tolerancePercent=1] - Tolerance percentage
 * @param {number} [params.toleranceAmount=1] - Absolute tolerance amount
 * @returns {Promise<TaxValidationResult>}
 */
async function validateTaxAmount(params) {
  const { 
    invoiceTaxAmount, 
    netAmount, 
    companyCode, 
    taxCode, 
    currency,
    taxJurisdiction,
    tolerancePercent = 1,
    toleranceAmount = 1
  } = params;
  
  // Calculate expected tax
  const calculation = await calculateTaxAmount({
    companyCode,
    taxCode,
    currency,
    netAmount,
    taxJurisdiction
  });

  
  if (calculation.confidence === 0) {
    return {
      isValid: false,
      confidence: 0,
      invoiceTaxAmount: normalizeAmount(invoiceTaxAmount),
      calculatedTaxAmount: 0,
      variance: 0,
      variancePercent: 0,
      status: 'CALCULATION_FAILED',
      error: calculation.error
    };
  }
  
  const invTax = normalizeAmount(invoiceTaxAmount);
  const calcTax = calculation.taxAmount;
  const variance = Math.abs(invTax - calcTax);
  const variancePercent = calcTax > 0 ? (variance / calcTax) * 100 : 0;
  
  // Check tolerance
  let status;
  let isValid;
  let confidence;
  
  if (variance <= 0.01) {
    status = 'EXACT';
    isValid = true;
    confidence = 1.0;
  } else if (variance <= toleranceAmount || variancePercent <= tolerancePercent) {
    status = 'WITHIN_TOLERANCE';
    isValid = true;
    confidence = 0.95;
  } else {
    status = 'EXCEEDS_TOLERANCE';
    isValid = false;
    confidence = 1 - Math.min(1, variancePercent / 100);
  }
  
  return {
    isValid,
    confidence,
    invoiceTaxAmount: invTax,
    calculatedTaxAmount: calcTax,
    variance: Math.round(variance * 100) / 100,
    variancePercent: Math.round(variancePercent * 100) / 100,
    status,
    calculatedTaxRate: calculation.taxRate,
    taxDetails: calculation.taxDetails
  };
}


// ============================================================================
// COMPREHENSIVE VENDOR + TAX DERIVATION
// ============================================================================

/**
 * @typedef {Object} VendorTaxDerivationResult
 * @property {Object} vendorValidation - Vendor validation result
 * @property {Object} taxCode - Tax code derivation result
 * @property {Object} taxJurisdiction - Tax jurisdiction derivation result
 * @property {Object} taxCalculation - Tax amount calculation (if requested)
 * @property {number} overallConfidence - Combined confidence
 * @property {boolean} isTouchlessReady - All fields derived with high confidence
 * @property {string[]} recommendations - Suggested actions
 */

/**
 * Comprehensive vendor validation and tax derivation.
 * Orchestrates all vendor and tax derivation functions.
 * 
 * @param {Object} params
 * @param {string} params.vendorId - Vendor ID
 * @param {string} params.companyCode - Company code
 * @param {Object} params.invoiceData - Invoice data
 * @param {string} [params.invoiceData.vendorName] - Vendor name from invoice
 * @param {string} [params.invoiceData.vendorCity] - City from invoice
 * @param {string} [params.invoiceData.vendorStreet] - Street from invoice
 * @param {string} [params.invoiceData.vendorPostalCode] - Postal code from invoice
 * @param {string} [params.invoiceData.vendorCountry] - Country from invoice
 * @param {string} [params.invoiceData.vendorRegion] - Region from invoice
 * @param {number} [params.invoiceData.netAmount] - Net amount
 * @param {number} [params.invoiceData.taxAmount] - Tax amount from invoice
 * @param {string} [params.invoiceData.currency] - Currency
 * @param {string} [params.poTaxCode] - Tax code from PO (if PO invoice)
 * @param {string} [params.expenseType] - Expense type (for non-PO)
 * @param {boolean} [params.calculateTax=true] - Whether to calculate tax amount
 * @returns {Promise<VendorTaxDerivationResult>}
 */
async function deriveVendorAndTax(params) {
  const { 
    vendorId, 
    companyCode, 
    invoiceData = {},
    poTaxCode,
    expenseType,
    calculateTax = true
  } = params;

  
  const result = {
    vendorValidation: null,
    taxCode: null,
    taxJurisdiction: null,
    taxCalculation: null,
    taxValidation: null,
    overallConfidence: 0,
    isTouchlessReady: false,
    recommendations: []
  };
  
  // Step 1: Validate vendor
  result.vendorValidation = await validateVendorDetails({
    vendorId,
    companyCode,
    invoiceVendorData: {
      name: invoiceData.vendorName,
      city: invoiceData.vendorCity,
      street: invoiceData.vendorStreet,
      postalCode: invoiceData.vendorPostalCode,
      country: invoiceData.vendorCountry,
      region: invoiceData.vendorRegion
    }
  });
  
  // Use ECC vendor data if available, otherwise use invoice data
  const vendorCountry = result.vendorValidation.eccVendorData?.country || invoiceData.vendorCountry;
  const vendorRegion = result.vendorValidation.eccVendorData?.region || invoiceData.vendorRegion;
  const vendorPostalCode = result.vendorValidation.eccVendorData?.postalCode || invoiceData.vendorPostalCode;
  const vendorCity = result.vendorValidation.eccVendorData?.city || invoiceData.vendorCity;

  
  // Step 2: Derive tax jurisdiction (if vendor has address)
  if (vendorCountry) {
    result.taxJurisdiction = await deriveTaxJurisdiction({
      country: vendorCountry,
      region: vendorRegion,
      postalCode: vendorPostalCode,
      city: vendorCity
    });
  }
  
  // Step 3: Derive tax code
  result.taxCode = await deriveTaxCode({
    companyCode,
    vendorCountry,
    poTaxCode,
    expenseType
  });
  
  // Step 4: Calculate tax amount (if requested and we have the data)
  if (calculateTax && result.taxCode.taxCode && invoiceData.netAmount && invoiceData.currency) {
    result.taxCalculation = await calculateTaxAmount({
      companyCode,
      taxCode: result.taxCode.taxCode,
      currency: invoiceData.currency,
      netAmount: invoiceData.netAmount,
      taxJurisdiction: result.taxJurisdiction?.taxJurisdiction
    });
    
    // Step 5: Validate tax amount if provided on invoice
    if (invoiceData.taxAmount !== undefined) {
      result.taxValidation = await validateTaxAmount({
        invoiceTaxAmount: invoiceData.taxAmount,
        netAmount: invoiceData.netAmount,
        companyCode,
        taxCode: result.taxCode.taxCode,
        currency: invoiceData.currency,
        taxJurisdiction: result.taxJurisdiction?.taxJurisdiction
      });
    }
  }

  
  // Calculate overall confidence
  const confidences = [];
  if (result.vendorValidation?.confidence > 0) confidences.push(result.vendorValidation.confidence);
  if (result.taxCode?.confidence > 0) confidences.push(result.taxCode.confidence);
  if (result.taxJurisdiction?.confidence > 0) confidences.push(result.taxJurisdiction.confidence);
  if (result.taxCalculation?.confidence > 0) confidences.push(result.taxCalculation.confidence);
  
  result.overallConfidence = confidences.length > 0 
    ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
    : 0;
  
  // Determine if touchless ready (all fields with high confidence)
  result.isTouchlessReady = 
    result.vendorValidation?.confidence >= 0.90 &&
    result.taxCode?.confidence >= 0.85 &&
    (result.taxValidation?.isValid !== false);
  
  // Generate recommendations
  if (result.vendorValidation?.confidence < 0.80) {
    result.recommendations.push('Vendor validation confidence is low - manual review recommended');
  }
  if (!result.taxCode?.taxCode) {
    result.recommendations.push('Tax code could not be determined - manual tax determination required');
  }
  if (result.taxValidation && !result.taxValidation.isValid) {
    result.recommendations.push(
      `Tax amount variance: ${result.taxValidation.variancePercent}% - exceeds tolerance`
    );
  }
  if (!result.taxJurisdiction?.taxJurisdiction && vendorCountry === 'US') {
    result.recommendations.push('Tax jurisdiction could not be determined for US vendor');
  }
  
  return result;
}


// ============================================================================
// VENDOR SEARCH AND MATCHING
// ============================================================================

/**
 * Search for vendor by name and address from invoice.
 * Returns potential matches with confidence scores.
 * 
 * @param {Object} params
 * @param {string} params.companyCode - Company code
 * @param {string} params.vendorName - Vendor name from invoice
 * @param {string} [params.city] - City from invoice
 * @param {string} [params.country] - Country from invoice
 * @param {number} [params.limit=10] - Maximum results
 * @returns {Promise<Array<{vendorId: string, name: string, score: number}>>}
 */
async function searchVendorByInvoiceData(params) {
  const { companyCode, vendorName, city, country, limit = 10 } = params;
  
  if (!vendorName) {
    return [];
  }
  
  try {
    const ecc = await getEccService();
    
    // Get vendor list for company code
    const vendorList = await ecc.getBBPVendorList({
      COMP_CODE: companyCode
    });
    
    if (!vendorList?.VENDOR || vendorList.VENDOR.length === 0) {
      return [];
    }
    
    // Score each vendor against invoice data
    const scored = [];
    
    for (const vendor of vendorList.VENDOR) {
      const nameScore = calculateCompanyNameScore(vendorName, vendor.NAME || '');
      let totalScore = nameScore.score * 0.70;  // Name is 70% of score
      
      // If we have vendor details, get more info
      // (This would be expensive for large lists - in production, use search APIs)
      
      if (nameScore.score >= 0.50) {
        scored.push({
          vendorId: vendor.VENDOR_NO,
          name: vendor.NAME,
          score: Math.round(totalScore * 100) / 100,
          nameMatchStrategy: nameScore.strategy
        });
      }
    }

    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, limit);
    
  } catch (error) {
    return [];
  }
}


// ============================================================================
// PO-BASED TAX DERIVATION (100% CONFIDENCE)
// ============================================================================

/**
 * Get tax code from PO item.
 * This provides 100% confidence as it's the actual tax code used in the PO.
 * 
 * @param {string} poNumber - PO number
 * @param {string} [poItem] - PO item number (required when the PO has several items)
 * @returns {Promise<{taxCode: string, jurisdiction: string, confidence: number}>}
 */
async function getTaxCodeFromPO(poNumber, poItem) {
  try {
    const ecc = await getEccService();
    
    const poDetail = await ecc.getPODetail1({
      PURCHASEORDER: poNumber.padStart(10, '0'),
      ACCOUNT_ASSIGNMENT: 'X'
    });
    
    if (!poDetail?.POITEM || poDetail.POITEM.length === 0) {
      return { taxCode: null, jurisdiction: null, confidence: 0, source: 'PO_NOT_FOUND' };
    }
    
    // Exact item match only; without an item number only a single-item PO is unambiguous
    let item = null;
    if (poItem) {
      item = poDetail.POITEM.find(i => i.PO_ITEM === poItem.padStart(5, '0')) || null;
    } else if (poDetail.POITEM.length === 1) {
      item = poDetail.POITEM[0];
    }

    if (!item) {
      return {
        taxCode: null,
        jurisdiction: null,
        confidence: 0,
        source: poItem ? 'PO_LINE_NOT_FOUND' : 'PO_LINE_REQUIRED'
      };
    }

    if (!item.TAX_CODE) {
      return {
        taxCode: null,
        jurisdiction: null,
        plant: item.PLANT,
        materialGroup: item.MATL_GROUP,
        confidence: 0,
        source: 'PO_ITEM_NO_TAX_CODE'
      };
    }

    return {
      taxCode: item.TAX_CODE,
      jurisdiction: item.TAXJURCODE,
      plant: item.PLANT,
      materialGroup: item.MATL_GROUP,
      confidence: 1.0,  // 100% confidence from PO
      source: 'PO_ITEM'
    };
    
  } catch (error) {
    return { taxCode: null, jurisdiction: null, confidence: 0, source: 'ERROR', error: error.message };
  }
}


// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // Configuration
  VENDOR_MATCH_THRESHOLDS,
  VENDOR_FIELD_WEIGHTS,
  TAX_EXEMPT_EXPENSE_TYPES,
  
  // Utility functions
  normalizeAddress,
  matchField,
  
  // Vendor validation
  validateVendorDetails,
  searchVendorByInvoiceData,
  
  // Tax jurisdiction
  deriveTaxJurisdiction,
  
  // Tax code derivation
  deriveTaxCode,
  getTaxCodeFromPO,
  
  // Tax calculation
  calculateTaxAmount,
  validateTaxAmount,
  
  // Comprehensive derivation
  deriveVendorAndTax
};
