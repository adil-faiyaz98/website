// @ts-check
/**
 * @fileoverview Non-PO invoice validators and field derivation.
 * Provides deterministic GL Account and Cost Center derivation
 * using multiple input signals for high-confidence results.
 */

const cds = require('@sap/cds');
const { normalizeVendorNumberPadded, normalizeAmount } = require('./utils/normalizers');
const cache = require('./cache');

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}

// ============================================================================
// CONFIGURATION: EXPENSE TYPE TO GL ACCOUNT MAPPING
// ============================================================================

/**
 * Standard expense type to GL account mapping.
 * These should be configured per company/client.
 * @type {Object.<string, {glAccount: string, glDescription: string, defaultTaxCode: string}>}
 */
const EXPENSE_TYPE_GL_MAPPING = {
  // Travel & Entertainment
  'travel': { glAccount: '6170000', glDescription: 'Travel Expenses', defaultTaxCode: 'V0' },
  'meals': { glAccount: '6175000', glDescription: 'Meals & Entertainment', defaultTaxCode: 'V1' },
  'lodging': { glAccount: '6171000', glDescription: 'Lodging Expenses', defaultTaxCode: 'V1' },
  'airfare': { glAccount: '6172000', glDescription: 'Airfare', defaultTaxCode: 'V0' },
  'mileage': { glAccount: '6173000', glDescription: 'Mileage Reimbursement', defaultTaxCode: 'V0' },
  
  // Utilities & Facilities
  'utilities': { glAccount: '6500100', glDescription: 'Utilities', defaultTaxCode: 'V1' },
  'electricity': { glAccount: '6500110', glDescription: 'Electricity', defaultTaxCode: 'V1' },
  'water': { glAccount: '6500120', glDescription: 'Water', defaultTaxCode: 'V1' },
  'gas': { glAccount: '6500130', glDescription: 'Natural Gas', defaultTaxCode: 'V1' },
  'rent': { glAccount: '6400000', glDescription: 'Rent Expense', defaultTaxCode: 'V1' },
  'lease': { glAccount: '6410000', glDescription: 'Lease Expense', defaultTaxCode: 'V1' },
  
  // Office & Administrative
  'office_supplies': { glAccount: '6560000', glDescription: 'Office Supplies', defaultTaxCode: 'V1' },
  'postage': { glAccount: '6570000', glDescription: 'Postage & Shipping', defaultTaxCode: 'V0' },
  'printing': { glAccount: '6580000', glDescription: 'Printing & Reproduction', defaultTaxCode: 'V1' },
  'subscriptions': { glAccount: '6590000', glDescription: 'Subscriptions', defaultTaxCode: 'V1' },
  
  // Professional Services
  'consulting': { glAccount: '6300000', glDescription: 'Consulting Fees', defaultTaxCode: 'V1' },
  'legal': { glAccount: '6310000', glDescription: 'Legal Fees', defaultTaxCode: 'V1' },
  'accounting': { glAccount: '6320000', glDescription: 'Accounting Fees', defaultTaxCode: 'V1' },
  'audit': { glAccount: '6325000', glDescription: 'Audit Fees', defaultTaxCode: 'V1' },
  'professional_services': { glAccount: '6330000', glDescription: 'Professional Services', defaultTaxCode: 'V1' },
  
  // IT & Technology
  'software': { glAccount: '6540000', glDescription: 'Software Expense', defaultTaxCode: 'V1' },
  'hardware': { glAccount: '6545000', glDescription: 'Hardware Expense', defaultTaxCode: 'V1' },
  'cloud_services': { glAccount: '6541000', glDescription: 'Cloud Services', defaultTaxCode: 'V1' },
  'telecom': { glAccount: '6550000', glDescription: 'Telecommunications', defaultTaxCode: 'V1' },
  'internet': { glAccount: '6551000', glDescription: 'Internet Services', defaultTaxCode: 'V1' },
  
  // Insurance
  'insurance': { glAccount: '6450000', glDescription: 'Insurance Expense', defaultTaxCode: 'V0' },
  'liability_insurance': { glAccount: '6451000', glDescription: 'Liability Insurance', defaultTaxCode: 'V0' },
  'property_insurance': { glAccount: '6452000', glDescription: 'Property Insurance', defaultTaxCode: 'V0' },
  
  // Maintenance & Repairs
  'maintenance': { glAccount: '6600000', glDescription: 'Maintenance Expense', defaultTaxCode: 'V1' },
  'repairs': { glAccount: '6610000', glDescription: 'Repairs Expense', defaultTaxCode: 'V1' },
  'equipment_maintenance': { glAccount: '6620000', glDescription: 'Equipment Maintenance', defaultTaxCode: 'V1' },
  'building_maintenance': { glAccount: '6630000', glDescription: 'Building Maintenance', defaultTaxCode: 'V1' },
  
  // Marketing & Advertising
  'marketing': { glAccount: '6700000', glDescription: 'Marketing Expense', defaultTaxCode: 'V1' },
  'advertising': { glAccount: '6710000', glDescription: 'Advertising', defaultTaxCode: 'V1' },
  'promotions': { glAccount: '6720000', glDescription: 'Promotions', defaultTaxCode: 'V1' },
  
  // Training & Education
  'training': { glAccount: '6800000', glDescription: 'Training Expense', defaultTaxCode: 'V1' },
  'education': { glAccount: '6810000', glDescription: 'Education Expense', defaultTaxCode: 'V1' },
  'conferences': { glAccount: '6820000', glDescription: 'Conferences & Seminars', defaultTaxCode: 'V1' },
  
  // Taxes & Licenses
  'taxes': { glAccount: '6900000', glDescription: 'Taxes - Other', defaultTaxCode: 'V0' },
  'licenses': { glAccount: '6910000', glDescription: 'Licenses & Permits', defaultTaxCode: 'V0' },
  'fees': { glAccount: '6920000', glDescription: 'Fees - Other', defaultTaxCode: 'V0' },
  
  // Miscellaneous
  'miscellaneous': { glAccount: '6990000', glDescription: 'Miscellaneous Expense', defaultTaxCode: 'V1' },
  'other': { glAccount: '6999000', glDescription: 'Other Expense', defaultTaxCode: 'V1' }
};

// ============================================================================
// CONFIGURATION: VENDOR ACCOUNT GROUP TO GL ACCOUNT MAPPING
// ============================================================================

/**
 * Vendor account group to default GL account mapping.
 * @type {Object.<string, {glAccount: string, glDescription: string, expenseType: string}>}
 */
const VENDOR_GROUP_GL_MAPPING = {
  // Standard vendor groups
  'ZDOM': { glAccount: '6200000', glDescription: 'Domestic Vendor Expenses', expenseType: 'miscellaneous' },
  'ZFOR': { glAccount: '6210000', glDescription: 'Foreign Vendor Expenses', expenseType: 'miscellaneous' },
  'ZFRGT': { glAccount: '6250000', glDescription: 'Freight Expenses', expenseType: 'freight' },
  'ZUTIL': { glAccount: '6500100', glDescription: 'Utilities', expenseType: 'utilities' },
  'ZPROS': { glAccount: '6300000', glDescription: 'Professional Services', expenseType: 'professional_services' },
  'ZCONS': { glAccount: '6300000', glDescription: 'Consulting', expenseType: 'consulting' },
  'ZLEGA': { glAccount: '6310000', glDescription: 'Legal Services', expenseType: 'legal' },
  'ZRENT': { glAccount: '6400000', glDescription: 'Rent/Lease', expenseType: 'rent' },
  'ZINS': { glAccount: '6450000', glDescription: 'Insurance', expenseType: 'insurance' },
  'ZTECH': { glAccount: '6540000', glDescription: 'Technology/IT', expenseType: 'software' },
  'ZTEL': { glAccount: '6550000', glDescription: 'Telecommunications', expenseType: 'telecom' },
  'ZMKT': { glAccount: '6700000', glDescription: 'Marketing', expenseType: 'marketing' },
  'ZONET': { glAccount: '6999000', glDescription: 'One-time Vendor', expenseType: 'miscellaneous' },
  'CPD': { glAccount: '6999000', glDescription: 'One-time Vendor', expenseType: 'miscellaneous' }
};

// ============================================================================
// CONFIGURATION: DESCRIPTION KEYWORDS TO EXPENSE TYPE
// ============================================================================

/**
 * Keywords in description to expense type mapping.
 * @type {Array<{keywords: string[], expenseType: string, priority: number}>}
 */
const DESCRIPTION_EXPENSE_MAPPING = [
  // High priority - specific terms
  { keywords: ['electric', 'electricity', 'power bill'], expenseType: 'electricity', priority: 100 },
  { keywords: ['water bill', 'water service'], expenseType: 'water', priority: 100 },
  { keywords: ['natural gas', 'gas bill'], expenseType: 'gas', priority: 100 },
  { keywords: ['rent', 'lease payment', 'monthly rent'], expenseType: 'rent', priority: 100 },
  { keywords: ['legal fee', 'attorney', 'lawyer'], expenseType: 'legal', priority: 100 },
  { keywords: ['audit fee', 'audit service'], expenseType: 'audit', priority: 100 },
  { keywords: ['consulting', 'consultant'], expenseType: 'consulting', priority: 90 },
  { keywords: ['software license', 'saas', 'subscription'], expenseType: 'software', priority: 90 },
  { keywords: ['cloud', 'aws', 'azure', 'gcp'], expenseType: 'cloud_services', priority: 90 },
  { keywords: ['internet', 'broadband', 'isp'], expenseType: 'internet', priority: 90 },
  { keywords: ['phone', 'telephone', 'telecom', 'mobile'], expenseType: 'telecom', priority: 85 },
  { keywords: ['insurance', 'premium', 'policy'], expenseType: 'insurance', priority: 85 },
  { keywords: ['maintenance', 'repair', 'service call'], expenseType: 'maintenance', priority: 80 },
  { keywords: ['office supply', 'supplies', 'stationery'], expenseType: 'office_supplies', priority: 80 },
  { keywords: ['training', 'course', 'certification'], expenseType: 'training', priority: 80 },
  { keywords: ['conference', 'seminar', 'workshop'], expenseType: 'conferences', priority: 80 },
  { keywords: ['advertising', 'ad spend', 'marketing'], expenseType: 'advertising', priority: 75 },
  { keywords: ['travel', 'trip', 'business travel'], expenseType: 'travel', priority: 75 },
  { keywords: ['airfare', 'flight', 'airline'], expenseType: 'airfare', priority: 90 },
  { keywords: ['hotel', 'lodging', 'accommodation'], expenseType: 'lodging', priority: 90 },
  { keywords: ['meal', 'dinner', 'lunch', 'catering'], expenseType: 'meals', priority: 85 },
  { keywords: ['shipping', 'freight', 'delivery', 'fedex', 'ups'], expenseType: 'postage', priority: 80 },
  { keywords: ['printing', 'print service'], expenseType: 'printing', priority: 75 },
  
  // Lower priority - generic terms
  { keywords: ['utility', 'utilities'], expenseType: 'utilities', priority: 70 },
  { keywords: ['professional', 'service'], expenseType: 'professional_services', priority: 50 },
  { keywords: ['fee', 'charge'], expenseType: 'fees', priority: 40 }
];


// ============================================================================
// DERIVATION: GL ACCOUNT FROM EXPENSE TYPE
// ============================================================================

/**
 * Derive GL Account from expense type.
 * @param {Object} params
 * @param {string} params.expenseType - Expense type key
 * @param {Object} [params.customMapping] - Custom GL mapping (overrides default)
 * @returns {{glAccount: string, glDescription: string, taxCode: string, confidence: number, source: string}}
 */
function deriveGLFromExpenseType(params) {
  const { expenseType, customMapping = {} } = params;
  
  // Check custom mapping first
  const mapping = customMapping[expenseType] || EXPENSE_TYPE_GL_MAPPING[expenseType];
  
  if (mapping) {
    return {
      glAccount: mapping.glAccount,
      glDescription: mapping.glDescription,
      taxCode: mapping.defaultTaxCode,
      confidence: 0.90,
      source: 'EXPENSE_TYPE_MAPPING'
    };
  }
  
  // Fallback to miscellaneous
  return {
    glAccount: EXPENSE_TYPE_GL_MAPPING.miscellaneous.glAccount,
    glDescription: 'Miscellaneous Expense',
    taxCode: 'V1',
    confidence: 0.50,
    source: 'DEFAULT_FALLBACK'
  };
}


// ============================================================================
// DERIVATION: EXPENSE TYPE FROM DESCRIPTION
// ============================================================================

/**
 * Derive expense type from invoice description.
 * @param {string} description - Invoice description/text
 * @returns {{expenseType: string, confidence: number, matchedKeywords: string[]}}
 */
function deriveExpenseTypeFromDescription(description) {
  if (!description) {
    return { expenseType: 'miscellaneous', confidence: 0.30, matchedKeywords: [] };
  }
  
  const lowerDesc = description.toLowerCase();
  let bestMatch = null;
  let bestPriority = 0;
  let matchedKeywords = [];
  
  for (const mapping of DESCRIPTION_EXPENSE_MAPPING) {
    for (const keyword of mapping.keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        if (mapping.priority > bestPriority) {
          bestPriority = mapping.priority;
          bestMatch = mapping.expenseType;
          matchedKeywords = [keyword];
        } else if (mapping.priority === bestPriority && bestMatch === mapping.expenseType) {
          matchedKeywords.push(keyword);
        }
      }
    }
  }
  
  if (bestMatch) {
    // Confidence based on priority (max 100 → 0.80 confidence)
    const confidence = Math.min(0.80, bestPriority / 125);
    return { expenseType: bestMatch, confidence, matchedKeywords };
  }
  
  return { expenseType: 'miscellaneous', confidence: 0.30, matchedKeywords: [] };
}


// ============================================================================
// DERIVATION: GL ACCOUNT FROM VENDOR
// ============================================================================

/**
 * Derive GL Account from vendor account group.
 * @param {Object} params
 * @param {string} params.vendorId - Vendor ID
 * @param {string} [params.companyCode] - Company code
 * @param {Object} [params.customMapping] - Custom vendor group mapping
 * @returns {Promise<{glAccount: string, glDescription: string, expenseType: string, vendorGroup: string, confidence: number, source: string}>}
 */
async function deriveGLFromVendor(params) {
  const { vendorId, companyCode, customMapping = {} } = params;
  
  try {
    const ecc = await getEccService();
    const paddedVendor = normalizeVendorNumberPadded(vendorId);
    
    const vendorDetail = await ecc.getVendorDetail({
      VENDOR: paddedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!vendorDetail || vendorDetail.RETURN?.some(r => r.TYPE === 'E')) {
      return {
        glAccount: null,
        glDescription: null,
        expenseType: null,
        vendorGroup: null,
        confidence: 0,
        source: 'VENDOR_NOT_FOUND'
      };
    }
    
    // Get vendor account group
    const vendorGroup = vendorDetail.GENERALDETAIL?.VENDOR_ACCOUNT_GROUP || 
                       vendorDetail.GENERALDETAIL?.ACCT_GROUP ||
                       vendorDetail.GENERALDETAIL?.KTOKK;
    
    if (vendorGroup) {
      // Check custom mapping first, then default
      const mapping = customMapping[vendorGroup] || VENDOR_GROUP_GL_MAPPING[vendorGroup];
      
      if (mapping) {
        return {
          glAccount: mapping.glAccount,
          glDescription: mapping.glDescription,
          expenseType: mapping.expenseType,
          vendorGroup,
          confidence: 0.95,
          source: 'VENDOR_ACCOUNT_GROUP'
        };
      }
    }
    
    // Fallback - vendor found but no mapping
    return {
      glAccount: null,
      glDescription: null,
      expenseType: null,
      vendorGroup,
      confidence: 0.40,
      source: 'VENDOR_GROUP_NO_MAPPING'
    };
    
  } catch (error) {
    return {
      glAccount: null,
      glDescription: null,
      expenseType: null,
      vendorGroup: null,
      confidence: 0,
      source: 'ERROR',
      error: error.message
    };
  }
}


// ============================================================================
// DERIVATION: GL + COST CENTER FROM HISTORICAL PATTERN
// ============================================================================

/**
 * Historical posting entry.
 * @typedef {Object} HistoricalPosting
 * @property {string} vendorId - Vendor ID
 * @property {string} glAccount - GL Account used
 * @property {string} costCenter - Cost Center used
 * @property {number} amount - Amount
 * @property {string} postingDate - Posting date
 * @property {string} [description] - Description
 */

/**
 * Derive GL and Cost Center from historical posting patterns.
 * Uses past invoices from same vendor to determine likely account assignment.
 * @param {Object} params
 * @param {string} params.vendorId - Vendor ID
 * @param {string} params.companyCode - Company code
 * @param {number} [params.amount] - Invoice amount (for amount-range matching)
 * @param {string} [params.description] - Invoice description (for similarity matching)
 * @param {HistoricalPosting[]} params.historicalPostings - Historical posting data
 * @param {number} [params.minOccurrences=3] - Minimum occurrences to consider pattern
 * @returns {{glAccount: string, costCenter: string, confidence: number, patternCount: number, source: string}}
 */
function deriveFromHistoricalPattern(params) {
  const { 
    vendorId, 
    companyCode,
    amount,
    description,
    historicalPostings = [],
    minOccurrences = 3 
  } = params;
  
  // Filter to same vendor
  const vendorPostings = historicalPostings.filter(p => 
    p.vendorId === vendorId || 
    normalizeVendorNumberPadded(p.vendorId) === normalizeVendorNumberPadded(vendorId)
  );
  
  if (vendorPostings.length < minOccurrences) {
    return {
      glAccount: null,
      costCenter: null,
      confidence: 0,
      patternCount: vendorPostings.length,
      source: 'INSUFFICIENT_HISTORY'
    };
  }
  
  // Count GL + Cost Center combinations
  const combinations = new Map();
  
  for (const posting of vendorPostings) {
    const key = `${posting.glAccount}|${posting.costCenter || 'NONE'}`;
    const entry = combinations.get(key) || { 
      glAccount: posting.glAccount, 
      costCenter: posting.costCenter,
      count: 0,
      totalAmount: 0,
      amounts: []
    };
    entry.count++;
    entry.totalAmount += normalizeAmount(posting.amount);
    entry.amounts.push(normalizeAmount(posting.amount));
    combinations.set(key, entry);
  }
  
  // Find most common combination
  let bestMatch = null;
  let maxCount = 0;
  
  for (const [key, entry] of combinations) {
    // If amount provided, prefer combinations with similar amounts
    if (amount) {
      const avgAmount = entry.totalAmount / entry.count;
      const amountSimilarity = 1 - Math.min(1, Math.abs(amount - avgAmount) / Math.max(amount, avgAmount));
      const weightedCount = entry.count * (0.7 + 0.3 * amountSimilarity);
      
      if (weightedCount > maxCount) {
        maxCount = weightedCount;
        bestMatch = entry;
      }
    } else {
      if (entry.count > maxCount) {
        maxCount = entry.count;
        bestMatch = entry;
      }
    }
  }
  
  if (bestMatch && bestMatch.count >= minOccurrences) {
    // Confidence based on consistency
    const consistency = bestMatch.count / vendorPostings.length;
    const confidence = Math.min(0.90, 0.70 + consistency * 0.20);
    
    return {
      glAccount: bestMatch.glAccount,
      costCenter: bestMatch.costCenter === 'NONE' ? null : bestMatch.costCenter,
      confidence,
      patternCount: bestMatch.count,
      totalOccurrences: vendorPostings.length,
      source: 'HISTORICAL_PATTERN'
    };
  }
  
  return {
    glAccount: null,
    costCenter: null,
    confidence: 0,
    patternCount: 0,
    source: 'NO_CONSISTENT_PATTERN'
  };
}


// ============================================================================
// DERIVATION: COST CENTER FROM USER/DEPARTMENT
// ============================================================================

/**
 * Department to cost center mapping.
 * @type {Object.<string, string>}
 */
const DEPARTMENT_COST_CENTER_MAPPING = {
  // These should be configured per company
  'IT': '1000100',
  'HR': '1000200',
  'FINANCE': '1000300',
  'ACCOUNTING': '1000310',
  'LEGAL': '1000400',
  'MARKETING': '1000500',
  'SALES': '1000600',
  'OPERATIONS': '1000700',
  'PROCUREMENT': '1000800',
  'FACILITIES': '1000900',
  'ADMIN': '1001000',
  'R&D': '1001100',
  'ENGINEERING': '1001200',
  'MANUFACTURING': '1001300',
  'WAREHOUSE': '1001400',
  'LOGISTICS': '1001500',
  'CUSTOMER_SERVICE': '1001600',
  'EXECUTIVE': '1001700'
};

/**
 * Derive cost center from requester/department.
 * @param {Object} params
 * @param {string} [params.requesterId] - Requester user ID
 * @param {string} [params.departmentCode] - Department code
 * @param {string} [params.departmentName] - Department name
 * @param {string} [params.costCenterOverride] - Explicit cost center from requester
 * @param {Object} [params.userCostCenterMapping] - Custom user → cost center mapping
 * @param {Object} [params.deptCostCenterMapping] - Custom dept → cost center mapping
 * @returns {{costCenter: string, confidence: number, source: string}}
 */
function deriveCostCenterFromRequester(params) {
  const { 
    requesterId, 
    departmentCode, 
    departmentName,
    costCenterOverride,
    userCostCenterMapping = {},
    deptCostCenterMapping = {}
  } = params;
  
  // Priority 1: Explicit cost center override (100% confidence)
  if (costCenterOverride) {
    return {
      costCenter: costCenterOverride,
      confidence: 1.0,
      source: 'EXPLICIT_OVERRIDE'
    };
  }
  
  // Priority 2: User-specific mapping (95% confidence)
  if (requesterId && userCostCenterMapping[requesterId]) {
    return {
      costCenter: userCostCenterMapping[requesterId],
      confidence: 0.95,
      source: 'USER_MAPPING'
    };
  }
  
  // Priority 3: Department code mapping (90% confidence)
  if (departmentCode) {
    const upperDept = departmentCode.toUpperCase();
    const mapping = deptCostCenterMapping[upperDept] || DEPARTMENT_COST_CENTER_MAPPING[upperDept];
    
    if (mapping) {
      return {
        costCenter: mapping,
        confidence: 0.90,
        source: 'DEPARTMENT_CODE_MAPPING'
      };
    }
  }
  
  // Priority 4: Department name matching (85% confidence)
  if (departmentName) {
    const upperName = departmentName.toUpperCase();
    
    // Try exact match
    let mapping = deptCostCenterMapping[upperName] || DEPARTMENT_COST_CENTER_MAPPING[upperName];
    
    // Try partial match
    if (!mapping) {
      for (const [dept, cc] of Object.entries(DEPARTMENT_COST_CENTER_MAPPING)) {
        if (upperName.includes(dept) || dept.includes(upperName)) {
          mapping = cc;
          break;
        }
      }
    }
    
    if (mapping) {
      return {
        costCenter: mapping,
        confidence: 0.85,
        source: 'DEPARTMENT_NAME_MAPPING'
      };
    }
  }
  
  return {
    costCenter: null,
    confidence: 0,
    source: 'NO_MAPPING_FOUND'
  };
}


// ============================================================================
// DERIVATION: GL ACCOUNT FROM TAX CODE
// ============================================================================

/**
 * Tax code to expense type hints.
 * @type {Object.<string, {expenseTypes: string[], description: string}>}
 */
const TAX_CODE_EXPENSE_HINTS = {
  // Standard tax codes (vary by country - these are examples)
  'V0': { expenseTypes: ['travel', 'airfare', 'taxes', 'insurance', 'fees'], description: 'Zero-rated/exempt' },
  'V1': { expenseTypes: ['utilities', 'consulting', 'software', 'maintenance'], description: 'Standard rate' },
  'V2': { expenseTypes: ['utilities', 'rent'], description: 'Reduced rate' },
  'VI': { expenseTypes: ['office_supplies', 'hardware'], description: 'Input tax' },
  'VN': { expenseTypes: ['miscellaneous'], description: 'Non-deductible' },
  'A0': { expenseTypes: ['travel', 'insurance'], description: 'Exempt' },
  'A1': { expenseTypes: ['consulting', 'professional_services'], description: 'Standard rate' }
};

/**
 * Use tax code as a hint for expense type derivation.
 * @param {string} taxCode - Tax code
 * @returns {{possibleExpenseTypes: string[], confidence: number}}
 */
function getExpenseHintsFromTaxCode(taxCode) {
  const hints = TAX_CODE_EXPENSE_HINTS[taxCode];
  
  if (hints) {
    return {
      possibleExpenseTypes: hints.expenseTypes,
      taxDescription: hints.description,
      confidence: 0.60
    };
  }
  
  return {
    possibleExpenseTypes: ['miscellaneous'],
    taxDescription: 'Unknown tax code',
    confidence: 0.20
  };
}


// ============================================================================
// MASTER DERIVATION FUNCTION: COMPREHENSIVE GL + COST CENTER
// ============================================================================

/**
 * Derivation result with all signals.
 * @typedef {Object} NonPODerivationResult
 * @property {string} glAccount - Derived GL Account
 * @property {string} glDescription - GL Account description
 * @property {string} costCenter - Derived Cost Center
 * @property {number} glConfidence - GL derivation confidence
 * @property {number} costCenterConfidence - Cost center derivation confidence
 * @property {string} glSource - Source of GL derivation
 * @property {string} costCenterSource - Source of cost center derivation
 * @property {string} expenseType - Derived expense type
 * @property {string} taxCode - Suggested tax code
 * @property {Object} derivationDetails - Details of each derivation attempt
 */

/**
 * Combine multiple GL derivation signals for higher confidence.
 * @param {Array<{glAccount: string, confidence: number, source: string}>} derivations
 * @returns {{glAccount: string, confidence: number, sources: string[], agreement: string}}
 */
function combineGLDerivations(derivations) {
  // Filter out null/failed derivations
  const valid = derivations.filter(d => d.glAccount && d.confidence > 0);
  
  if (valid.length === 0) {
    return { glAccount: null, confidence: 0, sources: [], agreement: 'NONE' };
  }
  
  if (valid.length === 1) {
    return { 
      glAccount: valid[0].glAccount, 
      confidence: valid[0].confidence, 
      sources: [valid[0].source],
      agreement: 'SINGLE_SOURCE'
    };
  }
  
  // Group by GL account
  const byGL = new Map();
  for (const d of valid) {
    const existing = byGL.get(d.glAccount) || { glAccount: d.glAccount, confidences: [], sources: [] };
    existing.confidences.push(d.confidence);
    existing.sources.push(d.source);
    byGL.set(d.glAccount, existing);
  }
  
  // Find the GL with most/best agreement
  let bestGL = null;
  let bestScore = 0;
  
  for (const [gl, data] of byGL) {
    // Score = count of agreements × average confidence
    const avgConf = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;
    const score = data.confidences.length * avgConf;
    
    if (score > bestScore) {
      bestScore = score;
      bestGL = data;
    }
  }
  
  // Calculate combined confidence
  const agreementCount = bestGL.confidences.length;
  const maxConfidence = Math.max(...bestGL.confidences);
  const totalSources = valid.length;
  
  let combinedConfidence;
  let agreement;
  
  if (agreementCount === totalSources) {
    // All sources agree - boost confidence
    if (agreementCount >= 3) {
      combinedConfidence = Math.min(0.99, maxConfidence + 0.05);
      agreement = 'FULL_AGREEMENT_HIGH';
    } else if (agreementCount === 2) {
      combinedConfidence = Math.min(0.98, maxConfidence + 0.03);
      agreement = 'FULL_AGREEMENT';
    } else {
      combinedConfidence = maxConfidence;
      agreement = 'SINGLE_SOURCE';
    }
  } else {
    // Some sources disagree - use best match but note disagreement
    combinedConfidence = maxConfidence * 0.95; // Slight penalty for disagreement
    agreement = 'PARTIAL_AGREEMENT';
  }
  
  return {
    glAccount: bestGL.glAccount,
    confidence: Math.round(combinedConfidence * 100) / 100,
    sources: bestGL.sources,
    agreement,
    totalSources,
    agreementCount
  };
}


/**
 * Comprehensive GL and Cost Center derivation for non-PO invoices.
 * Uses all available inputs with confidence combination for corroborating signals.
 * 
 * @param {Object} params - All available inputs
 * @param {string} params.vendorId - Vendor ID (required for vendor-based derivation)
 * @param {string} [params.companyCode] - Company code
 * @param {string} [params.description] - Invoice description/text
 * @param {string} [params.expenseType] - Explicit expense type (highest priority)
 * @param {string} [params.taxCode] - Tax code (provides hints)
 * @param {number} [params.amount] - Invoice amount
 * @param {string} [params.requesterId] - Requester user ID
 * @param {string} [params.departmentCode] - Department code
 * @param {string} [params.departmentName] - Department name
 * @param {string} [params.costCenterOverride] - Explicit cost center (100% confidence)
 * @param {string} [params.glAccountOverride] - Explicit GL account (100% confidence)
 * @param {HistoricalPosting[]} [params.historicalPostings] - Historical posting data
 * @param {Object} [params.customMappings] - Custom mappings to override defaults
 * @param {Object} [params.customMappings.expenseTypeGL] - Expense type → GL mapping
 * @param {Object} [params.customMappings.vendorGroupGL] - Vendor group → GL mapping
 * @param {Object} [params.customMappings.userCostCenter] - User → Cost center mapping
 * @param {Object} [params.customMappings.deptCostCenter] - Dept → Cost center mapping
 * @returns {Promise<NonPODerivationResult>}
 */
async function deriveNonPOAccountAssignment(params) {
  const {
    vendorId,
    companyCode,
    description,
    expenseType: explicitExpenseType,
    taxCode,
    amount,
    requesterId,
    departmentCode,
    departmentName,
    costCenterOverride,
    glAccountOverride,
    historicalPostings = [],
    customMappings = {}
  } = params;
  
  const derivationDetails = {
    glDerivations: [],
    costCenterDerivations: [],
    inputsProvided: []
  };
  
  // Track what inputs were provided
  if (vendorId) derivationDetails.inputsProvided.push('vendorId');
  if (description) derivationDetails.inputsProvided.push('description');
  if (explicitExpenseType) derivationDetails.inputsProvided.push('expenseType');
  if (taxCode) derivationDetails.inputsProvided.push('taxCode');
  if (amount) derivationDetails.inputsProvided.push('amount');
  if (requesterId) derivationDetails.inputsProvided.push('requesterId');
  if (departmentCode) derivationDetails.inputsProvided.push('departmentCode');
  if (historicalPostings.length > 0) derivationDetails.inputsProvided.push('historicalPostings');
  
  let glAccount = null;
  let glDescription = null;
  let glConfidence = 0;
  let glSource = 'NONE';
  let costCenter = null;
  let costCenterConfidence = 0;
  let costCenterSource = 'NONE';
  let derivedExpenseType = explicitExpenseType || null;
  let suggestedTaxCode = taxCode || null;
  
  // =========================================================================
  // GL ACCOUNT DERIVATION - Collect ALL signals (don't short-circuit)
  // =========================================================================
  
  const allGLDerivations = [];
  
  // Signal 1: Explicit GL override (100% confidence)
  if (glAccountOverride) {
    allGLDerivations.push({ 
      source: 'EXPLICIT_OVERRIDE', 
      confidence: 1.0, 
      glAccount: glAccountOverride,
      glDescription: 'User Specified'
    });
  }
  
  // Signal 2: Historical pattern (up to 90% confidence)
  if (historicalPostings.length > 0) {
    const histResult = deriveFromHistoricalPattern({
      vendorId,
      companyCode,
      amount,
      description,
      historicalPostings,
      minOccurrences: 3
    });
    
    if (histResult.glAccount) {
      allGLDerivations.push({ 
        source: 'HISTORICAL_PATTERN', 
        confidence: histResult.confidence,
        glAccount: histResult.glAccount,
        patternCount: histResult.patternCount
      });
      
      // Also track cost center from history
      if (histResult.costCenter) {
        derivationDetails.costCenterDerivations.push({
          source: 'HISTORICAL_PATTERN',
          confidence: histResult.confidence,
          costCenter: histResult.costCenter
        });
      }
    }
  }
  
  // Signal 3: Vendor account group (95% confidence)
  if (vendorId) {
    const vendorResult = await deriveGLFromVendor({
      vendorId,
      companyCode,
      customMapping: customMappings.vendorGroupGL
    });
    
    if (vendorResult.glAccount) {
      allGLDerivations.push({ 
        source: 'VENDOR_ACCOUNT_GROUP', 
        confidence: vendorResult.confidence,
        glAccount: vendorResult.glAccount,
        glDescription: vendorResult.glDescription,
        vendorGroup: vendorResult.vendorGroup,
        expenseType: vendorResult.expenseType
      });
      derivedExpenseType = derivedExpenseType || vendorResult.expenseType;
    }
  }
  
  // Signal 4: Explicit expense type mapping (90% confidence)
  if (explicitExpenseType) {
    const expResult = deriveGLFromExpenseType({
      expenseType: explicitExpenseType,
      customMapping: customMappings.expenseTypeGL
    });
    
    if (expResult.glAccount) {
      allGLDerivations.push({ 
        source: 'EXPLICIT_EXPENSE_TYPE', 
        confidence: expResult.confidence,
        glAccount: expResult.glAccount,
        glDescription: expResult.glDescription
      });
      suggestedTaxCode = suggestedTaxCode || expResult.taxCode;
    }
  }
  
  // Signal 5: Description-based expense type (up to 80% confidence)
  if (description) {
    const descResult = deriveExpenseTypeFromDescription(description);
    
    if (descResult.confidence > 0.4) {
      derivedExpenseType = derivedExpenseType || descResult.expenseType;
      
      const expResult = deriveGLFromExpenseType({
        expenseType: descResult.expenseType,
        customMapping: customMappings.expenseTypeGL
      });
      
      // Combine confidence: description confidence × expense type confidence
      const combinedConfidence = descResult.confidence * expResult.confidence;
      
      if (expResult.glAccount) {
        allGLDerivations.push({ 
          source: 'DESCRIPTION_ANALYSIS', 
          confidence: combinedConfidence,
          glAccount: expResult.glAccount,
          glDescription: expResult.glDescription,
          matchedKeywords: descResult.matchedKeywords,
          derivedExpenseType: descResult.expenseType
        });
        suggestedTaxCode = suggestedTaxCode || expResult.taxCode;
      }
    }
  }
  
  // Signal 6: Tax code hints (60% confidence)
  if (taxCode) {
    const taxHints = getExpenseHintsFromTaxCode(taxCode);
    
    if (taxHints.possibleExpenseTypes.length > 0) {
      const primaryExpenseType = taxHints.possibleExpenseTypes[0];
      const expResult = deriveGLFromExpenseType({
        expenseType: primaryExpenseType,
        customMapping: customMappings.expenseTypeGL
      });
      
      const combinedConfidence = taxHints.confidence * expResult.confidence;
      
      if (expResult.glAccount) {
        allGLDerivations.push({ 
          source: 'TAX_CODE_HINT', 
          confidence: combinedConfidence,
          glAccount: expResult.glAccount,
          glDescription: expResult.glDescription,
          possibleExpenseTypes: taxHints.possibleExpenseTypes
        });
        derivedExpenseType = derivedExpenseType || primaryExpenseType;
      }
    }
  }
  
  // Store all derivations for debugging
  derivationDetails.glDerivations = allGLDerivations;
  
  // =========================================================================
  // COMBINE GL SIGNALS
  // =========================================================================
  
  if (allGLDerivations.length > 0) {
    const combined = combineGLDerivations(allGLDerivations);
    glAccount = combined.glAccount;
    glConfidence = combined.confidence;
    glSource = combined.sources.join(' + ');
    
    // Get description from best matching derivation
    const bestDerivation = allGLDerivations.find(d => d.glAccount === glAccount);
    glDescription = bestDerivation?.glDescription || 'Derived';
    
    derivationDetails.glCombination = {
      agreement: combined.agreement,
      totalSources: combined.totalSources,
      agreementCount: combined.agreementCount,
      combinedSources: combined.sources
    };
  } else {
    // Fallback: Miscellaneous expense
    glAccount = EXPENSE_TYPE_GL_MAPPING.miscellaneous.glAccount;
    glDescription = 'Miscellaneous Expense';
    glConfidence = 0.30;
    glSource = 'DEFAULT_FALLBACK';
    derivedExpenseType = derivedExpenseType || 'miscellaneous';
  }
  
  // =========================================================================
  // COST CENTER DERIVATION
  // =========================================================================
  
  // Get from historical if available
  const histCCDerivation = derivationDetails.costCenterDerivations.find(d => d.source === 'HISTORICAL_PATTERN');
  if (histCCDerivation?.costCenter) {
    costCenter = histCCDerivation.costCenter;
    costCenterConfidence = histCCDerivation.confidence;
    costCenterSource = 'HISTORICAL_PATTERN';
  }
  
  // Priority 1: Explicit cost center override (100% confidence)
  if (costCenterOverride) {
    costCenter = costCenterOverride;
    costCenterConfidence = 1.0;
    costCenterSource = 'EXPLICIT_OVERRIDE';
    derivationDetails.costCenterDerivations.push({ 
      source: costCenterSource, 
      confidence: costCenterConfidence, 
      costCenter 
    });
  }
  
  // Priority 2: Requester/Department mapping (if not already set)
  if (!costCenter) {
    const requesterResult = deriveCostCenterFromRequester({
      requesterId,
      departmentCode,
      departmentName,
      userCostCenterMapping: customMappings.userCostCenter,
      deptCostCenterMapping: customMappings.deptCostCenter
    });
    
    derivationDetails.costCenterDerivations.push({ 
      source: requesterResult.source, 
      confidence: requesterResult.confidence, 
      costCenter: requesterResult.costCenter 
    });
    
    if (requesterResult.costCenter && requesterResult.confidence >= costCenterConfidence) {
      costCenter = requesterResult.costCenter;
      costCenterConfidence = requesterResult.confidence;
      costCenterSource = requesterResult.source;
    }
  }
  
  return {
    glAccount,
    glDescription,
    costCenter,
    glConfidence: Math.round(glConfidence * 100) / 100,
    costCenterConfidence: Math.round(costCenterConfidence * 100) / 100,
    glSource,
    costCenterSource,
    expenseType: derivedExpenseType,
    taxCode: suggestedTaxCode,
    derivationDetails,
    
    // Overall assessment
    isComplete: !!glAccount && !!costCenter,
    overallConfidence: Math.round(((glConfidence + costCenterConfidence) / 2) * 100) / 100,
    
    // Recommendations
    recommendations: [
      ...(glConfidence < 0.80 ? [`GL Account confidence (${Math.round(glConfidence * 100)}%) is below threshold - consider manual review`] : []),
      ...(costCenterConfidence < 0.80 ? [`Cost Center confidence (${Math.round(costCenterConfidence * 100)}%) is below threshold - consider manual review`] : []),
      ...(!costCenter ? ['No cost center derived - requester or department information needed'] : [])
    ]
  };
}


// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // Configuration (can be overridden)
  EXPENSE_TYPE_GL_MAPPING,
  VENDOR_GROUP_GL_MAPPING,
  DESCRIPTION_EXPENSE_MAPPING,
  DEPARTMENT_COST_CENTER_MAPPING,
  TAX_CODE_EXPENSE_HINTS,
  
  // Individual derivation functions
  deriveGLFromExpenseType,
  deriveExpenseTypeFromDescription,
  deriveGLFromVendor,
  deriveFromHistoricalPattern,
  deriveCostCenterFromRequester,
  getExpenseHintsFromTaxCode,
  
  // Master derivation function
  deriveNonPOAccountAssignment
};
