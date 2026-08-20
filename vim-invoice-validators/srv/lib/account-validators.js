// @ts-check
/**
 * @fileoverview Account validators for GL account and cost center derivation.
 * Validates and derives GL accounts, cost centers, internal orders, and profit centers.
 */

const cds = require('@sap/cds');
const { normalizeGLAccount, normalizeCostCenter } = require('./utils/normalizers');
const { findBestMatches } = require('./utils/string-matching');
const { createValidationResult, isAcceptable } = require('./utils/confidence');
const cache = require('./cache');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 * @typedef {import('./types').GLAccount} GLAccount
 * @typedef {import('./types').CostCenter} CostCenter
 */

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}


/**
 * Fetch GL accounts for a company code with caching.
 * @param {string} companyCode - Company code
 * @param {string} [language='E'] - Language code
 * @returns {Promise<GLAccount[]>} List of GL accounts
 */
async function fetchGLAccounts(companyCode, language = 'E') {
  // Check cache
  const cached = cache.getCachedGLAccounts(companyCode);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getGLAccounts({
      COMPANYCODE: companyCode,
      LANGUAGE: language
    });
    
    if (!result || !result.ACCOUNT_LIST) {
      return [];
    }
    
    const accounts = result.ACCOUNT_LIST.map(acc => ({
      companyCode: acc.COMP_CODE,
      accountNumber: acc.GL_ACCOUNT,
      shortText: acc.SHORT_TEXT,
      longText: acc.LONG_TEXT
    }));
    
    // Cache the result
    cache.cacheGLAccounts(companyCode, accounts);
    
    return accounts;
  } catch (error) {
    console.error(`Error fetching GL accounts for ${companyCode}:`, error);
    return [];
  }
}

/**
 * Fetch cost centers with caching.
 * @param {Object} params - Query parameters
 * @param {string} [params.companyCode] - Company code
 * @param {string} [params.controllingArea] - Controlling area
 * @param {string} [params.costCenter] - Specific cost center
 * @returns {Promise<CostCenter[]>} List of cost centers
 */
async function fetchCostCenters(params = {}) {
  const { companyCode, controllingArea, costCenter } = params;
  const cacheKey = controllingArea || companyCode || 'all';
  
  // Check cache (only for broad queries)
  if (!costCenter) {
    const cached = cache.getCachedCostCenters(cacheKey);
    if (cached) return cached;
  }
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getCostCenters({
      COMPANYCODE: companyCode || null,
      CONTROLLINGAREA: controllingArea || null,
      COSTCENTER: costCenter || null
    });
    
    if (!result || !result.COSTCENTER_LIST) {
      return [];
    }
    
    const centers = result.COSTCENTER_LIST.map(cc => ({
      controllingArea: cc.CO_AREA,
      costCenter: cc.COSTCENTER,
      description: cc.COCNTR_TXT
    }));
    
    // Cache broad queries
    if (!costCenter && centers.length > 0) {
      cache.cacheCostCenters(cacheKey, centers);
    }
    
    return centers;
  } catch (error) {
    console.error('Error fetching cost centers:', error);
    return [];
  }
}


/**
 * Validate a GL account exists for a company code.
 * @param {string} accountNumber - GL account number
 * @param {ValidationContext} context - Validation context (requires companyCode)
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateGLAccount(accountNumber, context) {
  if (!accountNumber) {
    return createValidationResult(false, 0, 'glAccount', {
      message: 'GL account number is required'
    });
  }
  
  if (!context.companyCode) {
    return createValidationResult(false, 0, 'glAccount', {
      message: 'Company code is required for GL account validation'
    });
  }
  
  const normalizedAccount = normalizeGLAccount(accountNumber);
  const accounts = await fetchGLAccounts(context.companyCode, context.language);
  
  if (accounts.length === 0) {
    return createValidationResult(false, 0, 'glAccount', {
      message: `No GL accounts found for company ${context.companyCode}`
    });
  }
  
  // Find exact match
  const exactMatch = accounts.find(acc => 
    normalizeGLAccount(acc.accountNumber) === normalizedAccount
  );
  
  if (exactMatch) {
    return createValidationResult(true, 1.0, 'glAccount', {
      derivedValue: exactMatch.accountNumber,
      matchStrategy: 'exact',
      message: `GL Account ${exactMatch.accountNumber} validated: ${exactMatch.shortText}`,
      metadata: exactMatch
    });
  }
  
  return createValidationResult(false, 0, 'glAccount', {
    message: `GL Account ${accountNumber} not found for company ${context.companyCode}`
  });
}

/**
 * Validate a cost center exists.
 * @param {string} costCenterId - Cost center ID
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateCostCenter(costCenterId, context) {
  if (!costCenterId) {
    return createValidationResult(false, 0, 'costCenter', {
      message: 'Cost center ID is required'
    });
  }
  
  const normalizedCC = normalizeCostCenter(costCenterId);
  const costCenters = await fetchCostCenters({
    companyCode: context.companyCode,
    controllingArea: context.controllingArea
  });
  
  if (costCenters.length === 0) {
    return createValidationResult(false, 0, 'costCenter', {
      message: 'No cost centers found'
    });
  }
  
  // Find exact match
  const exactMatch = costCenters.find(cc => 
    normalizeCostCenter(cc.costCenter) === normalizedCC
  );
  
  if (exactMatch) {
    return createValidationResult(true, 1.0, 'costCenter', {
      derivedValue: exactMatch.costCenter,
      matchStrategy: 'exact',
      message: `Cost Center ${exactMatch.costCenter} validated: ${exactMatch.description}`,
      metadata: exactMatch
    });
  }
  
  return createValidationResult(false, 0, 'costCenter', {
    message: `Cost Center ${costCenterId} not found`
  });
}


/**
 * Derive GL account from description.
 * @param {string} description - Account description or hint
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>} Derivation result
 */
async function deriveGLAccountFromDescription(description, context) {
  if (!description) {
    return createValidationResult(false, 0, 'glAccount', {
      message: 'Description is required for GL account derivation'
    });
  }
  
  if (!context.companyCode) {
    return createValidationResult(false, 0, 'glAccount', {
      message: 'Company code is required for GL account derivation'
    });
  }
  
  const accounts = await fetchGLAccounts(context.companyCode, context.language);
  
  if (accounts.length === 0) {
    return createValidationResult(false, 0, 'glAccount', {
      message: `No GL accounts available for company ${context.companyCode}`
    });
  }
  
  // Search in both short and long text
  const matches = findBestMatches(
    description,
    accounts,
    acc => `${acc.shortText || ''} ${acc.longText || ''}`.trim(),
    { minScore: 0.4, limit: 5, companyName: false }
  );
  
  if (matches.length === 0) {
    return createValidationResult(false, 0.1, 'glAccount', {
      message: `No matching GL account found for "${description}"`
    });
  }
  
  const bestMatch = matches[0];
  const isValid = isAcceptable(bestMatch.score.score, 'glAccount', context.thresholds);
  
  return createValidationResult(isValid, bestMatch.score.score, 'glAccount', {
    derivedValue: bestMatch.item.accountNumber,
    matchStrategy: bestMatch.score.strategy,
    message: isValid
      ? `Derived GL Account ${bestMatch.item.accountNumber}: ${bestMatch.item.shortText}`
      : `Best match ${bestMatch.item.accountNumber} below confidence threshold`,
    metadata: {
      matchedAccount: bestMatch.item,
      allMatches: matches.map(m => ({
        accountNumber: m.item.accountNumber,
        shortText: m.item.shortText,
        score: m.score.score
      }))
    }
  });
}

/**
 * Derive cost center from description.
 * @param {string} description - Cost center description or hint
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>} Derivation result
 */
async function deriveCostCenterFromDescription(description, context) {
  if (!description) {
    return createValidationResult(false, 0, 'costCenter', {
      message: 'Description is required for cost center derivation'
    });
  }
  
  const costCenters = await fetchCostCenters({
    companyCode: context.companyCode,
    controllingArea: context.controllingArea
  });
  
  if (costCenters.length === 0) {
    return createValidationResult(false, 0, 'costCenter', {
      message: 'No cost centers available'
    });
  }
  
  const matches = findBestMatches(
    description,
    costCenters,
    cc => cc.description || '',
    { minScore: 0.4, limit: 5, companyName: false }
  );
  
  if (matches.length === 0) {
    return createValidationResult(false, 0.1, 'costCenter', {
      message: `No matching cost center found for "${description}"`
    });
  }
  
  const bestMatch = matches[0];
  const isValid = isAcceptable(bestMatch.score.score, 'costCenter', context.thresholds);
  
  return createValidationResult(isValid, bestMatch.score.score, 'costCenter', {
    derivedValue: bestMatch.item.costCenter,
    matchStrategy: bestMatch.score.strategy,
    message: isValid
      ? `Derived Cost Center ${bestMatch.item.costCenter}: ${bestMatch.item.description}`
      : `Best match ${bestMatch.item.costCenter} below confidence threshold`,
    metadata: {
      matchedCostCenter: bestMatch.item,
      allMatches: matches.map(m => ({
        costCenter: m.item.costCenter,
        description: m.item.description,
        score: m.score.score
      }))
    }
  });
}


/**
 * Fetch internal orders.
 * @param {Object} params - Query parameters
 * @param {string} [params.controllingArea] - Controlling area
 * @param {string} [params.orderType] - Order type
 * @returns {Promise<Array<{order: string, description: string}>>} Internal orders
 */
async function fetchInternalOrders(params = {}) {
  try {
    const ecc = await getEccService();
    const result = await ecc.getInternalOrders({
      CONTROLLING_AREA: params.controllingArea || null,
      ORDER_TYPE: params.orderType || null
    });
    
    if (!result || !result.ORDER_LIST) {
      return [];
    }
    
    return result.ORDER_LIST.map(order => ({
      order: order.ORDER_NUMBER || order.ORDER,
      description: order.DESCRIPTION || order.ORDER_TEXT,
      orderType: order.ORDER_TYPE,
      controllingArea: order.CONTROLLING_AREA || order.CO_AREA
    }));
  } catch (error) {
    console.error('Error fetching internal orders:', error);
    return [];
  }
}

/**
 * Validate an internal order.
 * @param {string} orderId - Internal order ID
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateInternalOrder(orderId, context) {
  if (!orderId) {
    return createValidationResult(false, 0, 'glAccount', {
      message: 'Internal order ID is required'
    });
  }
  
  const orders = await fetchInternalOrders({
    controllingArea: context.controllingArea
  });
  
  if (orders.length === 0) {
    return createValidationResult(false, 0, 'glAccount', {
      message: 'No internal orders found'
    });
  }
  
  const normalizedOrder = orderId.toString().padStart(12, '0');
  const exactMatch = orders.find(o => 
    o.order.toString().padStart(12, '0') === normalizedOrder
  );
  
  if (exactMatch) {
    return createValidationResult(true, 1.0, 'glAccount', {
      derivedValue: exactMatch.order,
      matchStrategy: 'exact',
      message: `Internal Order ${exactMatch.order} validated: ${exactMatch.description}`,
      metadata: exactMatch
    });
  }
  
  return createValidationResult(false, 0, 'glAccount', {
    message: `Internal Order ${orderId} not found`
  });
}

/**
 * Fetch profit centers.
 * @param {string} controllingArea - Controlling area
 * @returns {Promise<Array<{profitCenter: string, description: string}>>} Profit centers
 */
async function fetchProfitCenters(controllingArea) {
  try {
    const ecc = await getEccService();
    const result = await ecc.getProfitCenterList({
      CONTROLLINGAREA: controllingArea
    });
    
    if (!result || !result.PROFITCENTER_LIST) {
      return [];
    }
    
    return result.PROFITCENTER_LIST.map(pc => ({
      profitCenter: pc.PROFIT_CTR || pc.PRCTR,
      description: pc.LONG_TEXT || pc.DESCRIPTION,
      controllingArea: pc.CO_AREA
    }));
  } catch (error) {
    console.error('Error fetching profit centers:', error);
    return [];
  }
}

/**
 * Validate a profit center.
 * @param {string} profitCenterId - Profit center ID
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateProfitCenter(profitCenterId, context) {
  if (!profitCenterId) {
    return createValidationResult(false, 0, 'costCenter', {
      message: 'Profit center ID is required'
    });
  }
  
  if (!context.controllingArea) {
    return createValidationResult(false, 0, 'costCenter', {
      message: 'Controlling area is required for profit center validation'
    });
  }
  
  const profitCenters = await fetchProfitCenters(context.controllingArea);
  
  if (profitCenters.length === 0) {
    return createValidationResult(false, 0, 'costCenter', {
      message: `No profit centers found for controlling area ${context.controllingArea}`
    });
  }
  
  const normalizedPC = profitCenterId.toString().trim().toUpperCase();
  const exactMatch = profitCenters.find(pc => 
    pc.profitCenter.toString().trim().toUpperCase() === normalizedPC
  );
  
  if (exactMatch) {
    return createValidationResult(true, 1.0, 'costCenter', {
      derivedValue: exactMatch.profitCenter,
      matchStrategy: 'exact',
      message: `Profit Center ${exactMatch.profitCenter} validated: ${exactMatch.description}`,
      metadata: exactMatch
    });
  }
  
  return createValidationResult(false, 0, 'costCenter', {
    message: `Profit Center ${profitCenterId} not found`
  });
}


/**
 * Search GL accounts by description.
 * @param {string} searchTerm - Search term
 * @param {ValidationContext} context - Validation context
 * @param {Object} [options] - Search options
 * @returns {Promise<Array<{account: GLAccount, score: number}>>} Matching accounts
 */
async function searchGLAccounts(searchTerm, context, options = {}) {
  const { limit = 10, minScore = 0.3 } = options;
  
  if (!context.companyCode) {
    return [];
  }
  
  const accounts = await fetchGLAccounts(context.companyCode, context.language);
  
  const matches = findBestMatches(
    searchTerm,
    accounts,
    acc => `${acc.shortText || ''} ${acc.longText || ''}`.trim(),
    { minScore, limit, companyName: false }
  );
  
  return matches.map(m => ({
    account: m.item,
    score: m.score.score
  }));
}

/**
 * Search cost centers by description.
 * @param {string} searchTerm - Search term
 * @param {ValidationContext} context - Validation context
 * @param {Object} [options] - Search options
 * @returns {Promise<Array<{costCenter: CostCenter, score: number}>>} Matching cost centers
 */
async function searchCostCenters(searchTerm, context, options = {}) {
  const { limit = 10, minScore = 0.3 } = options;
  
  const costCenters = await fetchCostCenters({
    companyCode: context.companyCode,
    controllingArea: context.controllingArea
  });
  
  const matches = findBestMatches(
    searchTerm,
    costCenters,
    cc => cc.description || '',
    { minScore, limit, companyName: false }
  );
  
  return matches.map(m => ({
    costCenter: m.item,
    score: m.score.score
  }));
}

/**
 * Get all GL accounts for a company code.
 * @param {string} companyCode - Company code
 * @param {string} [language] - Language
 * @returns {Promise<GLAccount[]>} GL accounts
 */
async function getGLAccountsForCompany(companyCode, language) {
  return fetchGLAccounts(companyCode, language);
}

/**
 * Get all cost centers for a controlling area.
 * @param {string} controllingArea - Controlling area
 * @returns {Promise<CostCenter[]>} Cost centers
 */
async function getCostCentersForArea(controllingArea) {
  return fetchCostCenters({ controllingArea });
}

module.exports = {
  fetchGLAccounts,
  fetchCostCenters,
  fetchInternalOrders,
  fetchProfitCenters,
  validateGLAccount,
  validateCostCenter,
  validateInternalOrder,
  validateProfitCenter,
  deriveGLAccountFromDescription,
  deriveCostCenterFromDescription,
  searchGLAccounts,
  searchCostCenters,
  getGLAccountsForCompany,
  getCostCentersForArea
};
