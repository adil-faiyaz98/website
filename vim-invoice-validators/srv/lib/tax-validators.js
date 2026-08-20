// @ts-check
/**
 * @fileoverview Tax validators for tax code and jurisdiction derivation.
 * Validates and derives tax codes, jurisdictions, and calculates tax amounts.
 */

const cds = require('@sap/cds');
const { normalizeTaxCode } = require('./utils/normalizers');
const { findBestMatches, levenshteinSimilarity } = require('./utils/string-matching');
const { createValidationResult, isAcceptable } = require('./utils/confidence');
const cache = require('./cache');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 * @typedef {import('./types').TaxCode} TaxCode
 * @typedef {import('./types').TaxJurisdiction} TaxJurisdiction
 */

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}


/**
 * Fetch tax codes for a country with caching.
 * @param {string} country - Country code (2-letter)
 * @param {string} [language='E'] - Language code
 * @returns {Promise<TaxCode[]>} List of tax codes
 */
async function fetchTaxCodes(country, language = 'E') {
  // Check cache
  const cached = cache.getCachedTaxCodes(country);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getTaxCodes({
      country: country,
      language: language
    });
    
    if (!result || !Array.isArray(result)) {
      return [];
    }
    
    const taxCodes = result.map(tc => ({
      taxProcedure: tc.KALSM,
      taxCode: tc.MWSKZ,
      taxType: tc.MWART,
      description: tc.TEXT1
    }));
    
    // Cache the result
    cache.cacheTaxCodes(country, taxCodes);
    
    return taxCodes;
  } catch (error) {
    console.error(`Error fetching tax codes for ${country}:`, error);
    return [];
  }
}

/**
 * Fetch tax jurisdictions for a country with caching.
 * @param {string} country - Country code
 * @param {string} [language='E'] - Language code
 * @returns {Promise<TaxJurisdiction[]>} List of jurisdictions
 */
async function fetchTaxJurisdictions(country, language = 'E') {
  // Check cache
  const cached = cache.getCachedTaxJurisdictions(country);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getTaxJurisdictions({
      country: country,
      language: language
    });
    
    if (!result || !Array.isArray(result)) {
      return [];
    }
    
    const jurisdictions = result.map(tj => ({
      taxProcedure: tj.KALSM,
      jurisdictionCode: tj.TXJCD,
      description: tj.TEXT1
    }));
    
    // Cache the result
    cache.cacheTaxJurisdictions(country, jurisdictions);
    
    return jurisdictions;
  } catch (error) {
    console.error(`Error fetching tax jurisdictions for ${country}:`, error);
    return [];
  }
}


/**
 * Validate a tax code exists for a country.
 * @param {string} taxCode - Tax code to validate
 * @param {ValidationContext} context - Validation context (requires country)
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateTaxCode(taxCode, context) {
  if (!taxCode) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'Tax code is required'
    });
  }
  
  if (!context.country) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'Country is required for tax code validation'
    });
  }
  
  const normalizedCode = normalizeTaxCode(taxCode);
  const taxCodes = await fetchTaxCodes(context.country, context.language);
  
  if (taxCodes.length === 0) {
    return createValidationResult(false, 0, 'taxCode', {
      message: `No tax codes found for country ${context.country}`
    });
  }
  
  // Find exact match
  const exactMatch = taxCodes.find(tc => 
    normalizeTaxCode(tc.taxCode) === normalizedCode
  );
  
  if (exactMatch) {
    return createValidationResult(true, 1.0, 'taxCode', {
      derivedValue: exactMatch.taxCode,
      matchStrategy: 'exact',
      message: `Tax code ${exactMatch.taxCode} validated: ${exactMatch.description}`,
      metadata: exactMatch
    });
  }
  
  // Try fuzzy match on description if provided
  return createValidationResult(false, 0, 'taxCode', {
    message: `Tax code ${taxCode} not found for country ${context.country}`
  });
}

/**
 * Validate a tax jurisdiction code.
 * @param {string} jurisdictionCode - Jurisdiction code
 * @param {ValidationContext} context - Validation context (requires country)
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateTaxJurisdiction(jurisdictionCode, context) {
  if (!jurisdictionCode) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'Jurisdiction code is required'
    });
  }
  
  if (!context.country) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'Country is required for jurisdiction validation'
    });
  }
  
  const jurisdictions = await fetchTaxJurisdictions(context.country, context.language);
  
  if (jurisdictions.length === 0) {
    return createValidationResult(false, 0, 'taxCode', {
      message: `No tax jurisdictions found for country ${context.country}`
    });
  }
  
  // Find exact match
  const normalizedJuris = jurisdictionCode.toUpperCase().trim();
  const exactMatch = jurisdictions.find(j => 
    j.jurisdictionCode.toUpperCase().trim() === normalizedJuris
  );
  
  if (exactMatch) {
    return createValidationResult(true, 1.0, 'taxCode', {
      derivedValue: exactMatch.jurisdictionCode,
      matchStrategy: 'exact',
      message: `Jurisdiction ${exactMatch.jurisdictionCode} validated: ${exactMatch.description}`,
      metadata: exactMatch
    });
  }
  
  return createValidationResult(false, 0, 'taxCode', {
    message: `Jurisdiction ${jurisdictionCode} not found for country ${context.country}`
  });
}


/**
 * Derive tax code from description or context.
 * @param {string} description - Tax description or hint
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>} Derivation result
 */
async function deriveTaxCodeFromDescription(description, context) {
  if (!description) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'Description is required for tax code derivation'
    });
  }
  
  if (!context.country) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'Country is required for tax code derivation'
    });
  }
  
  const taxCodes = await fetchTaxCodes(context.country, context.language);
  
  if (taxCodes.length === 0) {
    return createValidationResult(false, 0, 'taxCode', {
      message: `No tax codes available for country ${context.country}`
    });
  }
  
  // Find best match by description
  const matches = findBestMatches(
    description,
    taxCodes,
    tc => tc.description || '',
    { minScore: 0.4, limit: 5, companyName: false }
  );
  
  if (matches.length === 0) {
    return createValidationResult(false, 0.1, 'taxCode', {
      message: `No matching tax code found for "${description}"`
    });
  }
  
  const bestMatch = matches[0];
  const isValid = isAcceptable(bestMatch.score.score, 'taxCode', context.thresholds);
  
  return createValidationResult(isValid, bestMatch.score.score, 'taxCode', {
    derivedValue: bestMatch.item.taxCode,
    matchStrategy: bestMatch.score.strategy,
    message: isValid
      ? `Derived tax code ${bestMatch.item.taxCode}: ${bestMatch.item.description}`
      : `Best match ${bestMatch.item.taxCode} below confidence threshold`,
    metadata: {
      matchedTaxCode: bestMatch.item,
      allMatches: matches.map(m => ({
        taxCode: m.item.taxCode,
        description: m.item.description,
        score: m.score.score
      }))
    }
  });
}

/**
 * Calculate tax amount from net amount.
 * @param {Object} params - Calculation parameters
 * @param {string} params.companyCode - Company code
 * @param {string} params.taxCode - Tax code
 * @param {string} params.currency - Currency
 * @param {number} params.netAmount - Net amount
 * @param {string} [params.jurisdictionCode] - Tax jurisdiction
 * @param {string} [params.taxDate] - Tax calculation date
 * @returns {Promise<{taxAmount: number, success: boolean, message: string}>} Tax calculation result
 */
async function calculateTaxFromNet(params) {
  const { companyCode, taxCode, currency, netAmount, jurisdictionCode, taxDate } = params;
  
  if (!companyCode || !taxCode || !currency || netAmount === undefined) {
    return {
      taxAmount: 0,
      success: false,
      message: 'Missing required parameters for tax calculation'
    };
  }
  
  try {
    const ecc = await getEccService();
    const result = await ecc.calculateTaxFromNet({
      I_BUKRS: companyCode,
      I_MWSKZ: taxCode,
      I_WAERS: currency,
      I_WRBTR: netAmount,
      I_TXJCD: jurisdictionCode || null,
      I_PRSDT: taxDate || null
    });
    
    if (!result) {
      return {
        taxAmount: 0,
        success: false,
        message: 'No response from tax calculation service'
      };
    }
    
    // Extract tax amount from response
    const taxAmount = result.E_FWSTE || result.TAX_AMOUNT || 0;
    
    return {
      taxAmount,
      success: true,
      message: `Tax calculated: ${taxAmount} ${currency}`
    };
  } catch (error) {
    console.error('Error calculating tax:', error);
    return {
      taxAmount: 0,
      success: false,
      message: `Tax calculation error: ${error.message}`
    };
  }
}


/**
 * Validate tax amount against expected calculation.
 * @param {Object} params - Validation parameters
 * @param {string} params.companyCode - Company code
 * @param {string} params.taxCode - Tax code
 * @param {string} params.currency - Currency
 * @param {number} params.netAmount - Net amount
 * @param {number} params.invoiceTaxAmount - Tax amount from invoice
 * @param {string} [params.jurisdictionCode] - Tax jurisdiction
 * @param {number} [params.tolerance=0.01] - Tolerance percentage
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateTaxAmount(params) {
  const { 
    companyCode, taxCode, currency, netAmount, 
    invoiceTaxAmount, jurisdictionCode, tolerance = 0.01 
  } = params;
  
  const calcResult = await calculateTaxFromNet({
    companyCode,
    taxCode,
    currency,
    netAmount,
    jurisdictionCode
  });
  
  if (!calcResult.success) {
    return createValidationResult(false, 0.3, 'taxCode', {
      message: `Cannot validate tax: ${calcResult.message}`
    });
  }
  
  const expectedTax = calcResult.taxAmount;
  const difference = Math.abs(invoiceTaxAmount - expectedTax);
  const percentDiff = expectedTax > 0 ? difference / expectedTax : (invoiceTaxAmount > 0 ? 1 : 0);
  
  let confidence = 0;
  let isValid = false;
  
  if (percentDiff <= tolerance) {
    confidence = 1.0;
    isValid = true;
  } else if (percentDiff <= tolerance * 2) {
    confidence = 0.85;
    isValid = true;
  } else if (percentDiff <= tolerance * 5) {
    confidence = 0.5;
    isValid = false;
  } else {
    confidence = 0.2;
    isValid = false;
  }
  
  return createValidationResult(isValid, confidence, 'taxCode', {
    message: isValid
      ? `Tax amount ${invoiceTaxAmount} matches expected ${expectedTax.toFixed(2)}`
      : `Tax amount ${invoiceTaxAmount} differs from expected ${expectedTax.toFixed(2)} by ${(percentDiff * 100).toFixed(1)}%`,
    metadata: {
      expectedTax,
      invoiceTaxAmount,
      difference,
      percentDiff,
      taxCode,
      netAmount
    }
  });
}

/**
 * Get all tax codes for a country.
 * @param {string} country - Country code
 * @param {string} [language] - Language code
 * @returns {Promise<TaxCode[]>} List of tax codes
 */
async function getTaxCodesForCountry(country, language) {
  return fetchTaxCodes(country, language);
}

/**
 * Get all tax jurisdictions for a country.
 * @param {string} country - Country code
 * @param {string} [language] - Language code
 * @returns {Promise<TaxJurisdiction[]>} List of jurisdictions
 */
async function getTaxJurisdictionsForCountry(country, language) {
  return fetchTaxJurisdictions(country, language);
}

/**
 * Suggest tax code based on item category or material group.
 * @param {Object} itemInfo - Item information
 * @param {string} [itemInfo.materialGroup] - Material group
 * @param {string} [itemInfo.itemCategory] - Item category
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<{taxCode: string, confidence: number} | null>} Suggested tax code
 */
async function suggestTaxCode(itemInfo, context) {
  // This would require business logic specific to the customer
  // For now, return null - the actual implementation would map
  // material groups or item categories to default tax codes
  
  if (!context.country) {
    return null;
  }
  
  const taxCodes = await fetchTaxCodes(context.country, context.language);
  
  if (taxCodes.length === 0) {
    return null;
  }
  
  // Default: suggest first active tax code (placeholder logic)
  // Real implementation would have mapping rules
  const defaultCode = taxCodes.find(tc => tc.taxType !== 'A'); // Non-exempt
  
  if (defaultCode) {
    return {
      taxCode: defaultCode.taxCode,
      confidence: 0.3 // Low confidence since it's just a default
    };
  }
  
  return null;
}

/**
 * Derive tax code from PO line item.
 * @param {string} poNumber - PO number
 * @param {string} poLineNumber - PO line number
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>}
 */
async function deriveTaxCodeFromPO(poNumber, poLineNumber, context) {
  if (!poNumber) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'PO number is required'
    });
  }
  
  try {
    const ecc = await getEccService();
    const paddedPO = poNumber.toString().padStart(10, '0');
    
    const result = await ecc.getPODetail({ PURCHASEORDER: paddedPO });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return createValidationResult(false, 0, 'taxCode', {
        message: `PO ${poNumber} not found`
      });
    }
    
    // Find specific line or use header tax code
    let taxCode = null;
    let source = 'po_header';
    
    if (poLineNumber && result.POITEM) {
      const poItems = Array.isArray(result.POITEM) ? result.POITEM : [result.POITEM];
      const lineItem = poItems.find(item => 
        item.PO_ITEM === poLineNumber || 
        parseInt(item.PO_ITEM) === parseInt(poLineNumber)
      );
      
      if (lineItem && lineItem.TAX_CODE) {
        taxCode = lineItem.TAX_CODE;
        source = 'po_line';
      }
    }
    
    // Fallback to header tax code
    if (!taxCode && result.POHEADER?.TAX_CODE) {
      taxCode = result.POHEADER.TAX_CODE;
    }
    
    if (!taxCode) {
      return createValidationResult(false, 0.3, 'taxCode', {
        message: 'No tax code found on PO',
        metadata: { poNumber, poLineNumber }
      });
    }
    
    return createValidationResult(true, 1.0, 'taxCode', {
      derivedValue: taxCode,
      matchStrategy: source,
      message: `Tax code ${taxCode} derived from ${source}`,
      metadata: { poNumber, poLineNumber, taxCode, source }
    });
  } catch (error) {
    return createValidationResult(false, 0, 'taxCode', {
      message: `Error deriving tax code from PO: ${error.message}`
    });
  }
}

/**
 * Derive tax jurisdiction from PO.
 * @param {string} poNumber - PO number
 * @param {string} [poLineNumber] - PO line number
 * @returns {Promise<ValidationResult>}
 */
async function deriveTaxJurisdictionFromPO(poNumber, poLineNumber) {
  if (!poNumber) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'PO number is required'
    });
  }
  
  try {
    const ecc = await getEccService();
    const paddedPO = poNumber.toString().padStart(10, '0');
    
    const result = await ecc.getPODetail({ PURCHASEORDER: paddedPO });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return createValidationResult(false, 0, 'taxCode', {
        message: `PO ${poNumber} not found`
      });
    }
    
    let jurisdiction = null;
    let source = 'po_header';
    
    // Check line item first
    if (poLineNumber && result.POITEM) {
      const poItems = Array.isArray(result.POITEM) ? result.POITEM : [result.POITEM];
      const lineItem = poItems.find(item => 
        item.PO_ITEM === poLineNumber || 
        parseInt(item.PO_ITEM) === parseInt(poLineNumber)
      );
      
      if (lineItem?.TXJCD) {
        jurisdiction = lineItem.TXJCD;
        source = 'po_line';
      }
    }
    
    // Fallback to header
    if (!jurisdiction && result.POHEADER?.TXJCD) {
      jurisdiction = result.POHEADER.TXJCD;
    }
    
    // Derive from ship-to plant if no explicit jurisdiction
    if (!jurisdiction && result.POHEADER?.PLANT) {
      // Would lookup plant address and derive jurisdiction
      // Placeholder - requires plant master data
    }
    
    if (!jurisdiction) {
      return createValidationResult(false, 0.3, 'taxCode', {
        message: 'No tax jurisdiction found on PO'
      });
    }
    
    return createValidationResult(true, 1.0, 'taxCode', {
      derivedValue: jurisdiction,
      matchStrategy: source,
      message: `Tax jurisdiction ${jurisdiction} derived from ${source}`,
      metadata: { poNumber, poLineNumber, jurisdiction, source }
    });
  } catch (error) {
    return createValidationResult(false, 0, 'taxCode', {
      message: `Error deriving tax jurisdiction from PO: ${error.message}`
    });
  }
}

/**
 * Derive tax code for non-PO invoice based on vendor, company, and expense type.
 * @param {Object} params - Derivation parameters
 * @param {string} params.vendorId - Vendor ID
 * @param {string} params.companyCode - Company code
 * @param {string} params.country - Country code
 * @param {string} [params.expenseType] - Expense type/category
 * @param {string} [params.glAccount] - GL account (if known)
 * @param {string} [params.materialGroup] - Material group
 * @returns {Promise<ValidationResult>}
 */
async function deriveTaxCodeForNonPO(params) {
  const { vendorId, companyCode, country, expenseType, glAccount, materialGroup } = params;
  
  if (!country) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'Country is required for tax code derivation'
    });
  }
  
  const taxCodes = await fetchTaxCodes(country);
  if (taxCodes.length === 0) {
    return createValidationResult(false, 0, 'taxCode', {
      message: `No tax codes available for country ${country}`
    });
  }
  
  // Strategy 1: GL Account based tax code mapping
  if (glAccount) {
    const glTaxMap = {
      // Expense accounts typically have input tax
      '6': 'I1', // Input tax standard rate (expenses start with 6)
      '7': 'I1', // Purchases
      '1': 'O0', // Assets may have different rules
      '2': 'O0', // Inventory
      '4': 'I1'  // Cost of goods
    };
    
    const firstDigit = glAccount.charAt(0);
    if (glTaxMap[firstDigit]) {
      const suggestedCode = glTaxMap[firstDigit];
      const matchingCode = taxCodes.find(tc => tc.taxCode === suggestedCode);
      
      if (matchingCode) {
        return createValidationResult(true, 0.8, 'taxCode', {
          derivedValue: matchingCode.taxCode,
          matchStrategy: 'gl_account_mapping',
          message: `Tax code ${matchingCode.taxCode} derived from GL account pattern`,
          metadata: { glAccount, taxCode: matchingCode }
        });
      }
    }
  }
  
  // Strategy 2: Expense type based mapping
  if (expenseType) {
    const expenseTaxMap = {
      'OFFICE_SUPPLIES': 'I1',
      'IT_SERVICES': 'I1',
      'SOFTWARE': 'I1',
      'CONSULTING': 'I1',
      'PROFESSIONAL_SERVICES': 'I1',
      'TRAVEL': 'I2', // May have different rate
      'RENT': 'I0', // Often exempt
      'INSURANCE': 'I0', // Often exempt
      'TRAINING': 'I1',
      'UTILITIES': 'I1'
    };
    
    const upperExpense = expenseType.toUpperCase();
    if (expenseTaxMap[upperExpense]) {
      const suggestedCode = expenseTaxMap[upperExpense];
      const matchingCode = taxCodes.find(tc => tc.taxCode === suggestedCode);
      
      if (matchingCode) {
        return createValidationResult(true, 0.75, 'taxCode', {
          derivedValue: matchingCode.taxCode,
          matchStrategy: 'expense_type_mapping',
          message: `Tax code ${matchingCode.taxCode} derived from expense type ${expenseType}`,
          metadata: { expenseType, taxCode: matchingCode }
        });
      }
    }
  }
  
  // Strategy 3: Vendor country based (domestic vs import)
  if (vendorId) {
    try {
      const ecc = await getEccService();
      const vendorResult = await ecc.getVendorDetail({
        VENDORNO: vendorId.toString().padStart(10, '0'),
        COMPANYCODE: companyCode
      });
      
      if (vendorResult && vendorResult.GENERALDETAIL?.COUNTRY) {
        const vendorCountry = vendorResult.GENERALDETAIL.COUNTRY;
        const isDomestic = vendorCountry === country;
        
        // Domestic vs import tax codes
        const suggestedCode = isDomestic ? 'I1' : 'I3'; // I3 for import
        const matchingCode = taxCodes.find(tc => tc.taxCode === suggestedCode);
        
        if (matchingCode) {
          return createValidationResult(true, 0.7, 'taxCode', {
            derivedValue: matchingCode.taxCode,
            matchStrategy: isDomestic ? 'domestic_vendor' : 'import_vendor',
            message: `Tax code ${matchingCode.taxCode} derived from vendor country (${isDomestic ? 'domestic' : 'import'})`,
            metadata: { vendorCountry, companyCountry: country, taxCode: matchingCode }
          });
        }
      }
    } catch (error) {
      // Continue to fallback
    }
  }
  
  // Strategy 4: Default input tax
  const defaultInputTax = taxCodes.find(tc => 
    tc.taxType === 'V' || // Input tax
    tc.taxCode?.startsWith('I') || 
    tc.description?.toLowerCase().includes('input')
  );
  
  if (defaultInputTax) {
    return createValidationResult(true, 0.5, 'taxCode', {
      derivedValue: defaultInputTax.taxCode,
      matchStrategy: 'default_input_tax',
      message: `Default input tax code ${defaultInputTax.taxCode}`,
      metadata: { taxCode: defaultInputTax, reason: 'No specific mapping found' }
    });
  }
  
  return createValidationResult(false, 0.2, 'taxCode', {
    message: 'Unable to derive tax code for non-PO invoice'
  });
}

/**
 * Derive tax jurisdiction for non-PO invoice.
 * @param {Object} params - Derivation parameters
 * @param {string} params.companyCode - Company code
 * @param {string} params.country - Country code
 * @param {string} [params.region] - Region/state code
 * @param {string} [params.postalCode] - Postal code
 * @param {string} [params.city] - City
 * @param {string} [params.plant] - Receiving plant
 * @returns {Promise<ValidationResult>}
 */
async function deriveTaxJurisdictionForNonPO(params) {
  const { companyCode, country, region, postalCode, city, plant } = params;
  
  if (!country) {
    return createValidationResult(false, 0, 'taxCode', {
      message: 'Country is required for jurisdiction derivation'
    });
  }
  
  const jurisdictions = await fetchTaxJurisdictions(country);
  if (jurisdictions.length === 0) {
    // Some countries don't use jurisdictions
    return createValidationResult(true, 1.0, 'taxCode', {
      message: `No tax jurisdictions for country ${country} - jurisdiction not required`,
      metadata: { country, jurisdictionRequired: false }
    });
  }
  
  // Strategy 1: Region/State based (US, Canada, etc.)
  if (region) {
    const regionMatch = jurisdictions.find(j => 
      j.jurisdictionCode?.startsWith(region) ||
      j.jurisdictionCode?.includes(region)
    );
    
    if (regionMatch) {
      return createValidationResult(true, 0.9, 'taxCode', {
        derivedValue: regionMatch.jurisdictionCode,
        matchStrategy: 'region_match',
        message: `Tax jurisdiction ${regionMatch.jurisdictionCode} derived from region ${region}`,
        metadata: { region, jurisdiction: regionMatch }
      });
    }
  }
  
  // Strategy 2: Postal code lookup (for detailed US jurisdictions)
  if (postalCode && country === 'US') {
    // US jurisdictions often encoded as STATE + county/city
    // Format: CA0000000 (state + 7 digit code)
    const stateFromZip = getStateFromZip(postalCode);
    if (stateFromZip) {
      const stateMatch = jurisdictions.find(j => 
        j.jurisdictionCode?.startsWith(stateFromZip)
      );
      
      if (stateMatch) {
        return createValidationResult(true, 0.85, 'taxCode', {
          derivedValue: stateMatch.jurisdictionCode,
          matchStrategy: 'postal_code_lookup',
          message: `Tax jurisdiction ${stateMatch.jurisdictionCode} derived from postal code ${postalCode}`,
          metadata: { postalCode, state: stateFromZip, jurisdiction: stateMatch }
        });
      }
    }
  }
  
  // Strategy 3: City based fuzzy match
  if (city) {
    const cityMatches = findBestMatches(
      city,
      jurisdictions,
      j => j.description || '',
      { minScore: 0.6, limit: 3 }
    );
    
    if (cityMatches.length > 0) {
      return createValidationResult(true, cityMatches[0].score.score * 0.9, 'taxCode', {
        derivedValue: cityMatches[0].item.jurisdictionCode,
        matchStrategy: 'city_fuzzy_match',
        message: `Tax jurisdiction derived from city ${city}`,
        metadata: { city, jurisdiction: cityMatches[0].item }
      });
    }
  }
  
  // Strategy 4: Default jurisdiction (first in list for country)
  const defaultJurisdiction = jurisdictions[0];
  return createValidationResult(true, 0.4, 'taxCode', {
    derivedValue: defaultJurisdiction.jurisdictionCode,
    matchStrategy: 'default_country',
    message: `Default tax jurisdiction ${defaultJurisdiction.jurisdictionCode} for ${country}`,
    metadata: { jurisdiction: defaultJurisdiction, reason: 'No specific match found' }
  });
}

/**
 * Get US state code from ZIP code.
 * @param {string} zipCode - ZIP code
 * @returns {string|null} State code
 */
function getStateFromZip(zipCode) {
  const zip = parseInt(zipCode.substring(0, 3));
  
  // Simplified ZIP to state mapping (first 3 digits)
  const zipRanges = [
    { min: 100, max: 149, state: 'NY' },
    { min: 150, max: 196, state: 'PA' },
    { min: 197, max: 199, state: 'DE' },
    { min: 200, max: 205, state: 'DC' },
    { min: 206, max: 219, state: 'MD' },
    { min: 220, max: 246, state: 'VA' },
    { min: 247, max: 268, state: 'WV' },
    { min: 270, max: 289, state: 'NC' },
    { min: 290, max: 299, state: 'SC' },
    { min: 300, max: 319, state: 'GA' },
    { min: 320, max: 339, state: 'FL' },
    { min: 350, max: 369, state: 'AL' },
    { min: 370, max: 385, state: 'TN' },
    { min: 386, max: 397, state: 'MS' },
    { min: 400, max: 427, state: 'KY' },
    { min: 430, max: 458, state: 'OH' },
    { min: 460, max: 479, state: 'IN' },
    { min: 480, max: 499, state: 'MI' },
    { min: 500, max: 528, state: 'IA' },
    { min: 530, max: 549, state: 'WI' },
    { min: 550, max: 567, state: 'MN' },
    { min: 570, max: 577, state: 'SD' },
    { min: 580, max: 588, state: 'ND' },
    { min: 590, max: 599, state: 'MT' },
    { min: 600, max: 629, state: 'IL' },
    { min: 630, max: 658, state: 'MO' },
    { min: 660, max: 679, state: 'KS' },
    { min: 680, max: 693, state: 'NE' },
    { min: 700, max: 714, state: 'LA' },
    { min: 716, max: 729, state: 'AR' },
    { min: 730, max: 749, state: 'OK' },
    { min: 750, max: 799, state: 'TX' },
    { min: 800, max: 816, state: 'CO' },
    { min: 820, max: 831, state: 'WY' },
    { min: 832, max: 838, state: 'ID' },
    { min: 840, max: 847, state: 'UT' },
    { min: 850, max: 865, state: 'AZ' },
    { min: 870, max: 884, state: 'NM' },
    { min: 889, max: 898, state: 'NV' },
    { min: 900, max: 961, state: 'CA' },
    { min: 967, max: 968, state: 'HI' },
    { min: 970, max: 979, state: 'OR' },
    { min: 980, max: 994, state: 'WA' },
    { min: 995, max: 999, state: 'AK' }
  ];
  
  for (const range of zipRanges) {
    if (zip >= range.min && zip <= range.max) {
      return range.state;
    }
  }
  
  return null;
}

/**
 * Get complete tax derivation for an invoice line.
 * @param {Object} params - Invoice line parameters
 * @param {string} [params.poNumber] - PO number (if PO invoice)
 * @param {string} [params.poLineNumber] - PO line number
 * @param {string} params.companyCode - Company code
 * @param {string} params.country - Country code
 * @param {string} [params.vendorId] - Vendor ID
 * @param {string} [params.expenseType] - Expense type
 * @param {string} [params.glAccount] - GL account
 * @param {string} [params.region] - Region/state
 * @param {string} [params.postalCode] - Postal code
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<Object>} Complete tax derivation result
 */
async function deriveTaxInfo(params, context) {
  const { poNumber, poLineNumber, companyCode, country, vendorId, expenseType, glAccount, region, postalCode } = params;
  
  const result = {
    taxCode: null,
    taxCodeConfidence: 0,
    taxCodeSource: null,
    taxJurisdiction: null,
    taxJurisdictionConfidence: 0,
    taxJurisdictionSource: null,
    isPOBased: !!poNumber
  };
  
  // Derive tax code
  if (poNumber) {
    // PO-based derivation
    const taxCodeResult = await deriveTaxCodeFromPO(poNumber, poLineNumber, context);
    if (taxCodeResult.isValid) {
      result.taxCode = taxCodeResult.derivedValue;
      result.taxCodeConfidence = taxCodeResult.confidence;
      result.taxCodeSource = 'PO';
    }
    
    const jurisdictionResult = await deriveTaxJurisdictionFromPO(poNumber, poLineNumber);
    if (jurisdictionResult.isValid) {
      result.taxJurisdiction = jurisdictionResult.derivedValue;
      result.taxJurisdictionConfidence = jurisdictionResult.confidence;
      result.taxJurisdictionSource = 'PO';
    }
  }
  
  // Non-PO or PO derivation failed - try non-PO methods
  if (!result.taxCode) {
    const taxCodeResult = await deriveTaxCodeForNonPO({
      vendorId,
      companyCode,
      country,
      expenseType,
      glAccount
    });
    
    if (taxCodeResult.isValid || taxCodeResult.confidence > 0.3) {
      result.taxCode = taxCodeResult.derivedValue;
      result.taxCodeConfidence = taxCodeResult.confidence;
      result.taxCodeSource = taxCodeResult.matchStrategy;
    }
  }
  
  if (!result.taxJurisdiction) {
    const jurisdictionResult = await deriveTaxJurisdictionForNonPO({
      companyCode,
      country,
      region,
      postalCode
    });
    
    if (jurisdictionResult.isValid || jurisdictionResult.confidence > 0.3) {
      result.taxJurisdiction = jurisdictionResult.derivedValue;
      result.taxJurisdictionConfidence = jurisdictionResult.confidence;
      result.taxJurisdictionSource = jurisdictionResult.matchStrategy;
    }
  }
  
  return result;
}

module.exports = {
  fetchTaxCodes,
  fetchTaxJurisdictions,
  validateTaxCode,
  validateTaxJurisdiction,
  deriveTaxCodeFromDescription,
  calculateTaxFromNet,
  validateTaxAmount,
  getTaxCodesForCountry,
  getTaxJurisdictionsForCountry,
  suggestTaxCode,
  // New PO-based functions
  deriveTaxCodeFromPO,
  deriveTaxJurisdictionFromPO,
  // New non-PO functions
  deriveTaxCodeForNonPO,
  deriveTaxJurisdictionForNonPO,
  // Comprehensive derivation
  deriveTaxInfo,
  // Utility
  getStateFromZip
};
