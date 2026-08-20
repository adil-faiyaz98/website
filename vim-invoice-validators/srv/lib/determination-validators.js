// @ts-check
/**
 * @fileoverview Determination validators for company code, chart of accounts, cost center,
 * and GL account determination - especially for non-PO invoices.
 * Provides deterministic field derivation for touchless invoice processing.
 */

const cds = require('@sap/cds');
const { normalizeDescription, normalizeCompanyName, extractSignificantTokens } = require('./utils/normalizers');
const { findBestMatches, calculateTokenOverlap, levenshteinSimilarity } = require('./utils/string-matching');
const { createValidationResult, adjustScore, isAcceptable } = require('./utils/confidence');
const cache = require('./cache');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 */

/**
 * GL Account derivation result.
 * @typedef {Object} GLDerivationResult
 * @property {string} glAccount - GL account number
 * @property {string} [description] - GL account description
 * @property {string} source - Derivation source
 * @property {number} confidence - Confidence score
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * Cost center derivation result.
 * @typedef {Object} CostCenterDerivationResult
 * @property {string} costCenter - Cost center
 * @property {string} [description] - Cost center description  
 * @property {string} source - Derivation source
 * @property {number} confidence - Confidence score
 */

async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}

/**
 * Fetch GL accounts for a company code with caching.
 * @param {string} companyCode - Company code
 * @param {string} [chartOfAccounts] - Chart of accounts
 * @returns {Promise<Array>}
 */
async function fetchGLAccounts(companyCode, chartOfAccounts) {
  const cacheKey = `glaccounts:${companyCode}:${chartOfAccounts || 'all'}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const params = { COMPANYCODE: companyCode };
    if (chartOfAccounts) params.CHARTOFACCOUNTS = chartOfAccounts;
    
    const result = await ecc.getGLAccounts(params);
    const accounts = result?.GLACCOUNTS || [];
    
    cache.set(cacheKey, accounts, { ttl: 60 * 60 * 1000 }); // 1 hour
    return accounts;
  } catch (error) {
    console.error('Error fetching GL accounts:', error);
    return [];
  }
}

/**
 * Fetch cost centers for a controlling area.
 * @param {string} controllingArea - Controlling area
 * @returns {Promise<Array>}
 */
async function fetchCostCenters(controllingArea) {
  const cacheKey = `costcenters:${controllingArea}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getCostCenters({ CONTROLLINGAREA: controllingArea });
    const centers = result?.COSTCENTERS || [];
    
    cache.set(cacheKey, centers, { ttl: 60 * 60 * 1000 });
    return centers;
  } catch (error) {
    console.error('Error fetching cost centers:', error);
    return [];
  }
}

/**
 * Fetch profit centers.
 * @param {string} controllingArea - Controlling area
 * @returns {Promise<Array>}
 */
async function fetchProfitCenters(controllingArea) {
  const cacheKey = `profitcenters:${controllingArea}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getProfitCenterList({ CONTROLLINGAREA: controllingArea });
    const centers = result?.PROFITCENTERS || [];
    
    cache.set(cacheKey, centers, { ttl: 60 * 60 * 1000 });
    return centers;
  } catch (error) {
    console.error('Error fetching profit centers:', error);
    return [];
  }
}

/**
 * Fetch internal orders.
 * @param {string} companyCode - Company code
 * @returns {Promise<Array>}
 */
async function fetchInternalOrders(companyCode) {
  const cacheKey = `internalorders:${companyCode}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getInternalOrders({ COMPANYCODE: companyCode });
    const orders = result?.ORDERS || [];
    
    cache.set(cacheKey, orders, { ttl: 60 * 60 * 1000 });
    return orders;
  } catch (error) {
    console.error('Error fetching internal orders:', error);
    return [];
  }
}


/**
 * Determine company code from vendor master data.
 * @param {string} vendorId - Vendor ID
 * @param {string[]} [allowedCompanyCodes] - List of allowed company codes
 * @returns {Promise<ValidationResult>}
 */
async function determineCompanyCode(vendorId, allowedCompanyCodes = []) {
  try {
    const ecc = await getEccService();
    const paddedVendor = vendorId.toString().padStart(10, '0');
    
    // Get vendor details to find associated company codes
    // In a real scenario, would query vendor company code assignments
    // For now, return the first allowed company code if vendor exists
    
    if (allowedCompanyCodes.length === 0) {
      return createValidationResult(false, 0, 'account', {
        message: 'No allowed company codes provided'
      });
    }
    
    // Try each company code to find one where vendor is assigned
    for (const companyCode of allowedCompanyCodes) {
      const result = await ecc.getVendorDetail({
        VENDORNO: paddedVendor,
        COMPANYCODE: companyCode
      });
      
      if (result && result.RETURN?.TYPE !== 'E' && result.COMPANYDETAIL) {
        return createValidationResult(true, 1.0, 'account', {
          derivedValue: companyCode,
          matchStrategy: 'vendor_assignment',
          message: `Company code ${companyCode} determined from vendor master`,
          metadata: { vendorId, companyCode }
        });
      }
    }
    
    return createValidationResult(false, 0.3, 'account', {
      message: `Vendor ${vendorId} not assigned to any allowed company codes`,
      metadata: { checkedCompanyCodes: allowedCompanyCodes }
    });
  } catch (error) {
    return createValidationResult(false, 0, 'account', {
      message: `Error determining company code: ${error.message}`
    });
  }
}

/**
 * Determine chart of accounts from company code.
 * @param {string} companyCode - Company code
 * @returns {Promise<string|null>}
 */
async function determineChartOfAccounts(companyCode) {
  // Chart of accounts is typically configured per company code
  // Would normally query T001 table or equivalent
  // For demonstration, using common mappings
  const chartMappings = {
    '1000': 'INT', // International COA
    '1010': 'INT',
    '2000': 'CAUS', // US COA
    '3000': 'CADE', // German COA
    'default': 'INT'
  };
  
  return chartMappings[companyCode] || chartMappings['default'];
}

/**
 * Derive GL account for non-PO invoice based on expense type/description.
 * @param {Object} params - Derivation parameters
 * @param {string} params.companyCode - Company code
 * @param {string} [params.expenseType] - Expense type/category
 * @param {string} [params.description] - Line item description
 * @param {string} [params.vendorId] - Vendor ID (for vendor-specific defaults)
 * @param {string} [params.taxCode] - Tax code (some GL accounts are tax-specific)
 * @returns {Promise<GLDerivationResult>}
 */
async function deriveGLAccountForNonPO(params) {
  const { companyCode, expenseType, description, vendorId, taxCode } = params;
  
  // Define expense type to GL account mappings (would be configured per company)
  const expenseTypeGLMap = {
    'OFFICE_SUPPLIES': '6510',
    'TRAVEL': '6520',
    'UTILITIES': '6530',
    'TELECOMMUNICATIONS': '6540',
    'PROFESSIONAL_SERVICES': '6550',
    'CONSULTING': '6551',
    'LEGAL': '6552',
    'MAINTENANCE': '6560',
    'REPAIRS': '6561',
    'RENT': '6570',
    'INSURANCE': '6580',
    'MARKETING': '6590',
    'ADVERTISING': '6591',
    'IT_SERVICES': '6600',
    'SOFTWARE': '6601',
    'HARDWARE': '6602',
    'TRAINING': '6610',
    'SUBSCRIPTIONS': '6620',
    'FREIGHT': '6630',
    'MISC_EXPENSE': '6999'
  };
  
  // Strategy 1: Direct expense type mapping
  if (expenseType && expenseTypeGLMap[expenseType.toUpperCase()]) {
    const glAccount = expenseTypeGLMap[expenseType.toUpperCase()];
    return {
      glAccount,
      description: expenseType,
      source: 'expense_type_mapping',
      confidence: 0.95,
      metadata: { expenseType }
    };
  }
  
  // Strategy 2: Description-based derivation using keywords
  if (description) {
    const normalizedDesc = normalizeDescription(description);
    const tokens = extractSignificantTokens(description);
    
    // Keyword mappings
    const keywordGLMap = {
      'office': '6510', 'stationery': '6510', 'supplies': '6510',
      'travel': '6520', 'flight': '6520', 'hotel': '6520', 'airfare': '6520',
      'electric': '6530', 'utility': '6530', 'water': '6530', 'gas': '6530',
      'phone': '6540', 'telecom': '6540', 'internet': '6540', 'mobile': '6540',
      'consulting': '6551', 'consultant': '6551', 'advisory': '6551',
      'legal': '6552', 'attorney': '6552', 'lawyer': '6552',
      'maintenance': '6560', 'repair': '6561', 'service': '6560',
      'rent': '6570', 'lease': '6570',
      'insurance': '6580', 'premium': '6580',
      'marketing': '6590', 'advertising': '6591', 'promotion': '6590',
      'software': '6601', 'license': '6601', 'subscription': '6620',
      'hardware': '6602', 'computer': '6602', 'equipment': '6602',
      'training': '6610', 'education': '6610', 'seminar': '6610',
      'freight': '6630', 'shipping': '6630', 'delivery': '6630'
    };
    
    for (const token of tokens) {
      const lowerToken = token.toLowerCase();
      if (keywordGLMap[lowerToken]) {
        return {
          glAccount: keywordGLMap[lowerToken],
          description: `Derived from keyword: ${token}`,
          source: 'description_keyword',
          confidence: 0.75,
          metadata: { matchedKeyword: token, originalDescription: description }
        };
      }
    }
    
    // Strategy 3: Fuzzy match against GL account descriptions
    const glAccounts = await fetchGLAccounts(companyCode);
    if (glAccounts.length > 0) {
      const matches = findBestMatches(
        normalizedDesc,
        glAccounts,
        gl => gl.DESCRIPTION || gl.TEXT || '',
        { minScore: 0.5, limit: 3 }
      );
      
      if (matches.length > 0) {
        return {
          glAccount: matches[0].item.GL_ACCOUNT || matches[0].item.GLACCOUNT,
          description: matches[0].item.DESCRIPTION || matches[0].item.TEXT,
          source: 'description_fuzzy_match',
          confidence: matches[0].score.score * 0.85,
          metadata: { 
            matchScore: matches[0].score.score,
            matchStrategy: matches[0].score.strategy,
            alternatives: matches.slice(1).map(m => ({
              glAccount: m.item.GL_ACCOUNT || m.item.GLACCOUNT,
              score: m.score.score
            }))
          }
        };
      }
    }
  }
  
  // Strategy 4: Vendor default GL account
  if (vendorId) {
    // Would lookup vendor-specific default GL - placeholder
    // In real implementation, would query vendor master or mapping table
  }
  
  // Fallback: Miscellaneous expense
  return {
    glAccount: '6999',
    description: 'Miscellaneous Expense',
    source: 'default_fallback',
    confidence: 0.3,
    metadata: { reason: 'No matching criteria found, using default' }
  };
}


/**
 * Derive cost center for non-PO invoice.
 * @param {Object} params - Derivation parameters
 * @param {string} params.controllingArea - Controlling area
 * @param {string} [params.department] - Department name/code
 * @param {string} [params.description] - Line item description
 * @param {string} [params.userId] - Requestor user ID
 * @param {string} [params.expenseType] - Expense type
 * @returns {Promise<CostCenterDerivationResult>}
 */
async function deriveCostCenterForNonPO(params) {
  const { controllingArea, department, description, userId, expenseType } = params;
  
  // Strategy 1: Direct department mapping
  if (department) {
    const costCenters = await fetchCostCenters(controllingArea);
    
    // Try exact match first
    const exactMatch = costCenters.find(cc => 
      cc.COSTCENTER === department || 
      cc.DESCRIPTION?.toUpperCase() === department.toUpperCase()
    );
    
    if (exactMatch) {
      return {
        costCenter: exactMatch.COSTCENTER,
        description: exactMatch.DESCRIPTION,
        source: 'department_exact_match',
        confidence: 0.95
      };
    }
    
    // Fuzzy match
    const matches = findBestMatches(
      department,
      costCenters,
      cc => cc.DESCRIPTION || cc.NAME || '',
      { minScore: 0.6, limit: 3 }
    );
    
    if (matches.length > 0) {
      return {
        costCenter: matches[0].item.COSTCENTER,
        description: matches[0].item.DESCRIPTION,
        source: 'department_fuzzy_match',
        confidence: matches[0].score.score * 0.9
      };
    }
  }
  
  // Strategy 2: User default cost center
  if (userId) {
    // Would lookup user default cost center from user master
    // Placeholder - in real implementation would query HR/user data
  }
  
  // Strategy 3: Expense type default cost centers
  const expenseTypeCostCenterMap = {
    'IT_SERVICES': '1100', // IT department
    'SOFTWARE': '1100',
    'HARDWARE': '1100',
    'MARKETING': '1200', // Marketing
    'ADVERTISING': '1200',
    'LEGAL': '1300', // Legal
    'HR': '1400', // Human Resources
    'TRAINING': '1400',
    'FACILITIES': '1500', // Facilities
    'MAINTENANCE': '1500',
    'RENT': '1500'
  };
  
  if (expenseType && expenseTypeCostCenterMap[expenseType.toUpperCase()]) {
    return {
      costCenter: expenseTypeCostCenterMap[expenseType.toUpperCase()],
      description: `Default for ${expenseType}`,
      source: 'expense_type_default',
      confidence: 0.6
    };
  }
  
  // Fallback
  return {
    costCenter: null,
    description: 'Unable to determine cost center',
    source: 'none',
    confidence: 0
  };
}

/**
 * Derive profit center from cost center.
 * @param {string} costCenter - Cost center
 * @param {string} controllingArea - Controlling area
 * @returns {Promise<{profitCenter: string|null, confidence: number}>}
 */
async function deriveProfitCenterFromCostCenter(costCenter, controllingArea) {
  try {
    const costCenters = await fetchCostCenters(controllingArea);
    const cc = costCenters.find(c => c.COSTCENTER === costCenter);
    
    if (cc && cc.PROFIT_CENTER) {
      return {
        profitCenter: cc.PROFIT_CENTER,
        confidence: 1.0
      };
    }
    
    return { profitCenter: null, confidence: 0 };
  } catch (error) {
    return { profitCenter: null, confidence: 0 };
  }
}

/**
 * Derive internal order for non-PO invoice.
 * @param {Object} params - Derivation parameters
 * @param {string} params.companyCode - Company code
 * @param {string} [params.projectCode] - Project code/name
 * @param {string} [params.description] - Line description
 * @returns {Promise<{internalOrder: string|null, confidence: number}>}
 */
async function deriveInternalOrder(params) {
  const { companyCode, projectCode, description } = params;
  
  if (!projectCode && !description) {
    return { internalOrder: null, confidence: 0 };
  }
  
  const orders = await fetchInternalOrders(companyCode);
  if (orders.length === 0) {
    return { internalOrder: null, confidence: 0 };
  }
  
  const searchTerm = projectCode || description;
  const matches = findBestMatches(
    searchTerm,
    orders,
    o => o.DESCRIPTION || o.ORDER_TEXT || '',
    { minScore: 0.5, limit: 3 }
  );
  
  if (matches.length > 0) {
    return {
      internalOrder: matches[0].item.ORDER_NO || matches[0].item.ORDERID,
      confidence: matches[0].score.score * 0.85
    };
  }
  
  return { internalOrder: null, confidence: 0 };
}


/**
 * Complete account assignment derivation for non-PO invoice line.
 * @param {Object} params - Line item parameters
 * @param {string} params.companyCode - Company code
 * @param {string} params.controllingArea - Controlling area
 * @param {string} [params.description] - Line description
 * @param {string} [params.expenseType] - Expense type
 * @param {string} [params.department] - Department
 * @param {string} [params.projectCode] - Project code
 * @param {string} [params.vendorId] - Vendor ID
 * @param {string} [params.taxCode] - Tax code
 * @returns {Promise<Object>} Complete account assignment
 */
async function deriveAccountAssignment(params) {
  const { companyCode, controllingArea, description, expenseType, department, projectCode, vendorId, taxCode } = params;
  
  // Derive chart of accounts
  const chartOfAccounts = await determineChartOfAccounts(companyCode);
  
  // Derive GL account
  const glResult = await deriveGLAccountForNonPO({
    companyCode,
    expenseType,
    description,
    vendorId,
    taxCode
  });
  
  // Derive cost center
  const costCenterResult = await deriveCostCenterForNonPO({
    controllingArea,
    department,
    description,
    expenseType
  });
  
  // Derive profit center from cost center
  let profitCenterResult = { profitCenter: null, confidence: 0 };
  if (costCenterResult.costCenter) {
    profitCenterResult = await deriveProfitCenterFromCostCenter(
      costCenterResult.costCenter,
      controllingArea
    );
  }
  
  // Derive internal order if project-related
  const internalOrderResult = await deriveInternalOrder({
    companyCode,
    projectCode,
    description
  });
  
  // Calculate overall confidence
  const confidences = [
    glResult.confidence,
    costCenterResult.confidence,
    profitCenterResult.confidence
  ].filter(c => c > 0);
  
  const overallConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  
  return {
    chartOfAccounts,
    glAccount: {
      value: glResult.glAccount,
      description: glResult.description,
      confidence: glResult.confidence,
      source: glResult.source
    },
    costCenter: {
      value: costCenterResult.costCenter,
      description: costCenterResult.description,
      confidence: costCenterResult.confidence,
      source: costCenterResult.source
    },
    profitCenter: {
      value: profitCenterResult.profitCenter,
      confidence: profitCenterResult.confidence
    },
    internalOrder: {
      value: internalOrderResult.internalOrder,
      confidence: internalOrderResult.confidence
    },
    overallConfidence,
    isComplete: glResult.confidence > 0.5 && costCenterResult.confidence > 0.5,
    recommendations: generateAccountingRecommendations({
      glResult,
      costCenterResult,
      profitCenterResult,
      internalOrderResult
    })
  };
}

/**
 * Generate recommendations for account assignment.
 * @param {Object} results - Derivation results
 * @returns {string[]} Recommendations
 */
function generateAccountingRecommendations(results) {
  const recommendations = [];
  
  if (results.glResult.confidence < 0.5) {
    recommendations.push('GL account requires manual selection - low confidence match');
  }
  
  if (results.costCenterResult.confidence < 0.5) {
    recommendations.push('Cost center requires manual selection');
  }
  
  if (!results.profitCenterResult.profitCenter && results.costCenterResult.costCenter) {
    recommendations.push('Profit center not derived from cost center - verify assignment');
  }
  
  if (results.glResult.source === 'default_fallback') {
    recommendations.push('Using default GL account - review expense classification');
  }
  
  return recommendations;
}

/**
 * Validate GL account exists and is valid for posting.
 * @param {string} glAccount - GL account
 * @param {string} companyCode - Company code
 * @returns {Promise<ValidationResult>}
 */
async function validateGLAccountForPosting(glAccount, companyCode) {
  const accounts = await fetchGLAccounts(companyCode);
  const account = accounts.find(a => 
    (a.GL_ACCOUNT || a.GLACCOUNT) === glAccount
  );
  
  if (!account) {
    return createValidationResult(false, 0, 'account', {
      message: `GL account ${glAccount} not found in company ${companyCode}`
    });
  }
  
  // Check if account is blocked for posting
  if (account.BLOCKED || account.POST_BLOCK) {
    return createValidationResult(false, 0, 'account', {
      message: `GL account ${glAccount} is blocked for posting`,
      metadata: { account }
    });
  }
  
  return createValidationResult(true, 1.0, 'account', {
    derivedValue: glAccount,
    message: 'GL account is valid for posting',
    metadata: { 
      description: account.DESCRIPTION || account.TEXT,
      accountType: account.ACCOUNT_TYPE
    }
  });
}

/**
 * Validate cost center is valid and active.
 * @param {string} costCenter - Cost center
 * @param {string} controllingArea - Controlling area
 * @param {Date} [postingDate] - Posting date for validity check
 * @returns {Promise<ValidationResult>}
 */
async function validateCostCenterForPosting(costCenter, controllingArea, postingDate) {
  const centers = await fetchCostCenters(controllingArea);
  const center = centers.find(c => c.COSTCENTER === costCenter);
  
  if (!center) {
    return createValidationResult(false, 0, 'account', {
      message: `Cost center ${costCenter} not found in controlling area ${controllingArea}`
    });
  }
  
  // Check validity period
  if (postingDate && center.VALID_FROM && center.VALID_TO) {
    const date = new Date(postingDate);
    const validFrom = new Date(center.VALID_FROM);
    const validTo = new Date(center.VALID_TO);
    
    if (date < validFrom || date > validTo) {
      return createValidationResult(false, 0, 'account', {
        message: `Cost center ${costCenter} not valid for posting date`,
        metadata: { validFrom, validTo, postingDate: date }
      });
    }
  }
  
  return createValidationResult(true, 1.0, 'account', {
    derivedValue: costCenter,
    message: 'Cost center is valid',
    metadata: { 
      description: center.DESCRIPTION,
      profitCenter: center.PROFIT_CENTER
    }
  });
}

module.exports = {
  fetchGLAccounts,
  fetchCostCenters,
  fetchProfitCenters,
  fetchInternalOrders,
  determineCompanyCode,
  determineChartOfAccounts,
  deriveGLAccountForNonPO,
  deriveCostCenterForNonPO,
  deriveProfitCenterFromCostCenter,
  deriveInternalOrder,
  deriveAccountAssignment,
  validateGLAccountForPosting,
  validateCostCenterForPosting
};
