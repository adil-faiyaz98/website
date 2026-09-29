// @ts-check
/**
 * @fileoverview Enterprise Tax Determination Engine
 * 
 * A deterministic tax determination system that works for PO and Non-PO invoices
 * regardless of input data availability. Designed to match SAP, Ariba, and Coupa
 * enterprise logic standards.
 * 
 * Key Features:
 * - Per-line-item tax determination
 * - Date-effective rules with validFrom/validTo
 * - Vendor-specific rules support
 * - Tax exemption handling with certificate validation
 * - Withholding tax determination
 * - SAP tax code/jurisdiction validation
 * - Cross-border tax logic (senderCountry support)
 * - Audit logging for compliance
 * 
 * Data Sources:
 * - PO Invoices: Tax code from PO line item (BAPI_PO_GETDETAIL1)
 * - Non-PO Invoices: Rules engine based on company code address + vendor country
 * - Validation: TaxKeys and TaxJurisdiction replicated tables
 * 
 * @module tax-determination-engine
 */

'use strict';

const cds = require('@sap/cds');
const LOG = cds.log('tax-determination');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Tax-exempt expense types that typically don't attract sales tax
 * @type {string[]}
 */
const TAX_EXEMPT_EXPENSE_TYPES = [
  'insurance',
  'liability_insurance',
  'property_insurance',
  'taxes',
  'licenses',
  'government_fees',
  'bank_charges',
  'interest',
  'medical',
  'healthcare',
  'education',
  'training_exempt',
  'donations',
  'membership_dues'
];

/**
 * GL Account to Expense Type mapping
 * Should be configurable via admin in production
 * @type {Object.<string, string>}
 */
const GL_TO_EXPENSE_TYPE = {
  // Insurance accounts
  '6800100': 'insurance',
  '6800200': 'liability_insurance',
  '6800300': 'property_insurance',
  // Travel
  '6500100': 'travel',
  '6500200': 'airfare',
  '6500300': 'accommodation',
  // Taxes and fees
  '6700100': 'taxes',
  '6700200': 'licenses',
  '6700300': 'government_fees',
  // Financial
  '6600100': 'bank_charges',
  '6600200': 'interest',
  // Rent
  '6300100': 'rent',
  '6300200': 'lease',
  // Utilities
  '6200100': 'utilities',
  '6200200': 'telephone',
  // Professional services
  '6400100': 'consulting',
  '6400200': 'legal',
  '6400300': 'accounting',
  // Office
  '6100100': 'office_supplies',
  '6100200': 'equipment'
};

/**
 * Canadian provincial tax configurations
 * @type {Object.<string, {gst: number, pst: number, hst: number, qst: number, taxCode: string, jurisdictionPattern: string}>}
 */
const CANADIAN_PROVINCIAL_TAX = {
  'AB': { gst: 5, pst: 0, hst: 0, qst: 0, taxCode: 'G1', jurisdictionPattern: 'AB0000000' },
  'BC': { gst: 5, pst: 7, hst: 0, qst: 0, taxCode: 'P1', jurisdictionPattern: 'BC0000000' },
  'MB': { gst: 5, pst: 7, hst: 0, qst: 0, taxCode: 'P1', jurisdictionPattern: 'MB0000000' },
  'NB': { gst: 0, pst: 0, hst: 15, qst: 0, taxCode: 'H1', jurisdictionPattern: 'NB0000000' },
  'NL': { gst: 0, pst: 0, hst: 15, qst: 0, taxCode: 'H1', jurisdictionPattern: 'NL0000000' },
  'NS': { gst: 0, pst: 0, hst: 15, qst: 0, taxCode: 'H1', jurisdictionPattern: 'NS0000000' },
  'NT': { gst: 5, pst: 0, hst: 0, qst: 0, taxCode: 'G1', jurisdictionPattern: 'NT0000000' },
  'NU': { gst: 5, pst: 0, hst: 0, qst: 0, taxCode: 'G1', jurisdictionPattern: 'NU0000000' },
  'ON': { gst: 0, pst: 0, hst: 13, qst: 0, taxCode: 'H1', jurisdictionPattern: 'ON0000000' },
  'PE': { gst: 0, pst: 0, hst: 15, qst: 0, taxCode: 'H1', jurisdictionPattern: 'PE0000000' },
  'QC': { gst: 5, pst: 0, hst: 0, qst: 9.975, taxCode: 'Q1', jurisdictionPattern: 'QC0000000' },
  'SK': { gst: 5, pst: 6, hst: 0, qst: 0, taxCode: 'P1', jurisdictionPattern: 'SK0000000' },
  'YT': { gst: 5, pst: 0, hst: 0, qst: 0, taxCode: 'G1', jurisdictionPattern: 'YT0000000' }
};

/**
 * Withholding tax types by country
 * @type {Object.<string, {types: Array<{code: string, description: string, rate: number}>}>}
 */
const WITHHOLDING_TAX_CONFIG = {
  'US': {
    types: [
      { code: 'W1', description: '1099-MISC Backup Withholding', rate: 24 },
      { code: 'W2', description: '1099-NEC Non-Employee Comp', rate: 0 },
      { code: 'W3', description: '1042-S Foreign Vendor', rate: 30 }
    ]
  },
  'CA': {
    types: [
      { code: 'C1', description: 'Non-Resident Withholding', rate: 25 },
      { code: 'C2', description: 'Royalty Withholding', rate: 25 }
    ]
  },
  'IN': {
    types: [
      { code: 'T1', description: 'TDS Professional Services', rate: 10 },
      { code: 'T2', description: 'TDS Contractor', rate: 2 },
      { code: 'T3', description: 'TDS Rent', rate: 10 }
    ]
  }
};

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} TaxDeterminationInput
 * @property {string} companyCode - Company code (required)
 * @property {string} [vendorId] - Vendor ID
 * @property {string} [supplierName] - Supplier name (for vendor lookup)
 * @property {string} [poNumber] - Purchase order number
 * @property {string} [documentType] - Document type (RE, KR, KG)
 * @property {Date} [taxDate] - Tax calculation date (defaults to today)
 * @property {string} [currency] - Currency code
 * @property {TaxLineItem[]} lineItems - Line items to determine tax for
 */

/**
 * @typedef {Object} TaxLineItem
 * @property {string|number} lineNumber - Line item number
 * @property {string} [poNumber] - PO number for this line
 * @property {string} [poLineNumber] - PO line item number
 * @property {number} netAmount - Net amount
 * @property {string} [glAccount] - GL Account
 * @property {string} [expenseType] - Expense type
 * @property {string} [description] - Line description
 * @property {string} [materialGroup] - Material group
 * @property {string} [plant] - Plant code (ship-to)
 */

/**
 * @typedef {Object} TaxDeterminationResult
 * @property {boolean} success - Whether determination succeeded
 * @property {LineTaxResult[]} lines - Per-line tax results
 * @property {HeaderTaxResult} header - Aggregated header result
 * @property {WithholdingTaxResult} [withholdingTax] - Withholding tax if applicable
 * @property {TaxReconciliation} reconciliation - Reconciliation summary
 * @property {TaxAuditEntry[]} auditLog - Audit trail entries
 */

/**
 * @typedef {Object} LineTaxResult
 * @property {string|number} lineNumber - Line item number
 * @property {string} taxCode - Determined tax code
 * @property {string} taxJurisdiction - Tax jurisdiction code
 * @property {number} taxAmount - Calculated tax amount
 * @property {number} taxRate - Applied tax rate (percentage)
 * @property {number} confidence - Confidence score (0-1)
 * @property {string} determinationMethod - How tax was determined
 * @property {string} [ruleId] - Matched rule ID if rule-based
 * @property {string} [reason] - Human-readable reason
 * @property {boolean} isValidated - Whether validated against SAP tables
 * @property {string[]} warnings - Any warnings
 */

/**
 * @typedef {Object} HeaderTaxResult
 * @property {string} taxCode - Primary tax code for header
 * @property {string} taxJurisdiction - Primary jurisdiction
 * @property {number} totalTaxAmount - Sum of all line tax amounts
 * @property {number} totalNetAmount - Sum of all net amounts
 * @property {number} effectiveTaxRate - Weighted average tax rate
 * @property {boolean} allLinesSameTax - Whether all lines have same tax
 * @property {string[]} uniqueTaxCodes - All unique tax codes used
 */

/**
 * @typedef {Object} WithholdingTaxResult
 * @property {boolean} applicable - Whether WHT applies
 * @property {string} [wtType] - Withholding tax type
 * @property {string} [wtCode] - Withholding tax code
 * @property {number} [wtRate] - WHT rate percentage
 * @property {number} [wtBaseAmount] - Base amount for WHT
 * @property {number} [wtAmount] - Calculated WHT amount
 * @property {string} [reason] - Why WHT applies/doesn't apply
 */

/**
 * @typedef {Object} TaxReconciliation
 * @property {boolean} isBalanced - Whether tax amounts balance
 * @property {number} calculatedTotal - Sum of calculated line taxes
 * @property {number} [invoiceTotal] - Invoice-stated tax amount
 * @property {number} [variance] - Difference if any
 * @property {string} [action] - Recommended action
 * @property {string} message - Summary message
 */

/**
 * @typedef {Object} TaxAuditEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} lineNumber - Line reference
 * @property {string} action - What was done
 * @property {Object} input - Input data
 * @property {Object} output - Output data
 * @property {string} [ruleId] - Rule used if any
 */

// ============================================================================
// SERVICE CONNECTIONS
// ============================================================================

let eccService = null;
let dbService = null;
let adminService = null;

/**
 * Get ECC integration service
 * @returns {Promise<Object>}
 */
async function getEccService() {
  if (!eccService) {
    eccService = await cds.connect.to('vim_ecc_integration');
  }
  return eccService;
}

/**
 * Get database service
 * @returns {Promise<Object>}
 */
async function getDbService() {
  if (!dbService) {
    dbService = await cds.connect.to('db');
  }
  return dbService;
}

/**
 * Get admin service (for tax rules)
 * @returns {Promise<Object>}
 */
async function getAdminService() {
  if (!adminService) {
    try {
      adminService = await cds.connect.to('vendor_invoice_administration_cap');
    } catch (e) {
      LOG.warn('Admin service not available, using local rules');
      adminService = null;
    }
  }
  return adminService;
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = {
  vendorDetails: new Map(),
  companyDetails: new Map(),
  plantAddresses: new Map(),
  poDetails: new Map(),
  taxRules: new Map(),
  taxKeys: new Map(),
  taxJurisdictions: new Map(),
  vendorTaxProfiles: new Map()
};

/**
 * Clear all caches
 */
function clearCache() {
  cache.vendorDetails.clear();
  cache.companyDetails.clear();
  cache.plantAddresses.clear();
  cache.poDetails.clear();
  cache.taxRules.clear();
  cache.taxKeys.clear();
  cache.taxJurisdictions.clear();
  cache.vendorTaxProfiles.clear();
  LOG.info('Tax determination cache cleared');
}

/**
 * Check if cache entry is valid
 * @param {number} loadedAt - Timestamp when loaded
 * @returns {boolean}
 */
function isCacheValid(loadedAt) {
  return loadedAt && (Date.now() - loadedAt) < CACHE_TTL;
}

// ============================================================================
// BAPI WRAPPERS - Master Data Retrieval
// ============================================================================

/**
 * Get vendor details from SAP
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<Object|null>}
 */
async function getVendorDetail(vendorId, companyCode) {
  if (!vendorId || !companyCode) return null;
  
  const cacheKey = `${vendorId}:${companyCode}`;
  const cached = cache.vendorDetails.get(cacheKey);
  if (cached && isCacheValid(cached.loadedAt)) {
    return cached.data;
  }

  try {
    const ecc = await getEccService();
    const normalizedVendor = vendorId.toString().padStart(10, '0');
    
    const result = await ecc.getVendorDetail({
      VENDORNO: normalizedVendor,
      COMPANYCODE: companyCode
    });

    if (!result || result.RETURN?.TYPE === 'E') {
      LOG.warn(`Vendor ${vendorId} not found for company ${companyCode}`);
      return null;
    }

    const vendorData = {
      vendorId: normalizedVendor,
      name: result.GENERALDETAIL?.NAME || '',
      name2: result.GENERALDETAIL?.NAME_2 || '',
      country: result.GENERALDETAIL?.COUNTRY || '',
      region: result.GENERALDETAIL?.REGION || '',
      city: result.GENERALDETAIL?.CITY || '',
      postalCode: result.GENERALDETAIL?.POSTL_CODE || '',
      street: result.GENERALDETAIL?.STREET || '',
      telephone: result.GENERALDETAIL?.TELEPHONE || '',
      paymentTerms: result.COMPANYDETAIL?.PMNTTRMS || '',
      paymentMethods: result.COMPANYDETAIL?.PAYMENT_METHODS || ''
    };

    cache.vendorDetails.set(cacheKey, { data: vendorData, loadedAt: Date.now() });
    return vendorData;
  } catch (error) {
    LOG.error(`Error fetching vendor ${vendorId}:`, error);
    return null;
  }
}

/**
 * Get company code details from SAP
 * @param {string} companyCode - Company code
 * @returns {Promise<Object|null>}
 */
async function getCompanyCodeDetail(companyCode) {
  if (!companyCode) return null;

  const cached = cache.companyDetails.get(companyCode);
  if (cached && isCacheValid(cached.loadedAt)) {
    return cached.data;
  }

  try {
    const ecc = await getEccService();
    const result = await ecc.getCompanyCodeDetail({
      COMPANYCODEID: companyCode
    });

    if (!result || result.RETURN?.TYPE === 'E') {
      LOG.warn(`Company code ${companyCode} not found`);
      return null;
    }

    const detail = result.COMPANYCODE_DETAIL || {};
    const address = result.COMPANYCODE_ADDRESS || {};

    const companyData = {
      companyCode: detail.COMP_CODE || companyCode,
      companyName: detail.COMP_NAME || '',
      country: detail.COUNTRY || address.COUNTRY || '',
      currency: detail.CURRENCY || '',
      vatRegNumber: detail.VAT_REG_NO || '',
      chartOfAccounts: detail.CHRT_ACCTS || '',
      // Address details
      city: address.CITY || '',
      postalCode: address.POSTL_COD1 || '',
      region: address.REGION || '',
      street: address.STREET || '',
      taxJurisdiction: address.TAXJURCODE || '',
      telephone: address.TEL1_NUMBR || ''
    };

    cache.companyDetails.set(companyCode, { data: companyData, loadedAt: Date.now() });
    return companyData;
  } catch (error) {
    LOG.error(`Error fetching company code ${companyCode}:`, error);
    return null;
  }
}

/**
 * Get PO details with delivery addresses
 * @param {string} poNumber - Purchase order number
 * @returns {Promise<Object|null>}
 */
async function getPODetail(poNumber) {
  if (!poNumber) return null;

  const normalizedPO = poNumber.toString().padStart(10, '0');
  const cached = cache.poDetails.get(normalizedPO);
  if (cached && isCacheValid(cached.loadedAt)) {
    return cached.data;
  }

  try {
    const ecc = await getEccService();

    // BAPI_PO_GETDETAIL1: items are always returned; account assignment and
    // delivery address tables must be requested explicitly.
    const result = await ecc.getPODetail1({
      PURCHASEORDER: normalizedPO,
      ACCOUNT_ASSIGNMENT: 'X',
      DELIVERY_ADDRESS: 'X'
    });

    if (!result || (result.RETURN || []).some(r => r.TYPE === 'E' || r.TYPE === 'A')) {
      LOG.warn(`PO ${poNumber} not found`);
      return null;
    }

    const header = result.POHEADER || {};

    // Account assignment lines (POACCOUNT) grouped by PO item
    const accountsByItem = {};
    (result.POACCOUNT || []).forEach(acc => {
      if (acc.DELETE_IND) return;
      (accountsByItem[acc.PO_ITEM] = accountsByItem[acc.PO_ITEM] || []).push({
        serialNo: acc.SERIAL_NO,
        glAccount: acc.GL_ACCOUNT || '',
        costCenter: acc.COSTCENTER || '',
        taxCode: acc.TAX_CODE || '',
        taxJurisdiction: acc.TAXJURCODE || '',
        distributionPercent: acc.DISTR_PERC,
        netValue: acc.NET_VALUE
      });
    });

    // Delivery addresses (POADDRDELIVERY) keyed by PO item
    const deliveryAddresses = {};
    (result.POADDRDELIVERY || []).forEach(addr => {
      deliveryAddresses[addr.PO_ITEM] = {
        addressNumber: addr.ADDR_NO || '',
        country: addr.COUNTRY || '',
        region: addr.REGION || '',
        city: addr.CITY || '',
        postalCode: addr.POSTL_COD1 || '',
        street: addr.STREET || '',
        taxJurisdiction: addr.TAXJURCODE || ''
      };
    });

    const items = (result.POITEM || []).map(item => ({
      poNumber: normalizedPO,
      poItem: item.PO_ITEM,
      material: item.MATERIAL,
      shortText: item.SHORT_TEXT,
      plant: item.PLANT,
      materialGroup: item.MATL_GROUP,
      itemCategory: item.ITEM_CAT,
      accountCategory: item.ACCTASSCAT,
      unit: item.PO_UNIT,
      netPrice: parseFloat(item.NET_PRICE) || 0,
      priceUnit: parseFloat(item.PRICE_UNIT) || 1,
      taxCode: item.TAX_CODE || '',
      taxJurisdiction: item.TAXJURCODE || '',
      taxCountry: item.TAXCOUNTRY || '',
      glAccount: item.GL_ACCOUNT || '',
      deleteIndicator: !!item.DELETE_IND,
      accounts: accountsByItem[item.PO_ITEM] || []
    }));

    const poData = {
      poNumber: normalizedPO,
      companyCode: header.COMP_CODE,
      docType: header.DOC_TYPE,
      vendorId: header.VENDOR,
      currency: header.CURRENCY,
      vatCountry: header.VAT_CNTRY || '',
      paymentTerms: header.PMNTTRMS,
      purchaseOrg: header.PURCH_ORG,
      purchaseGroup: header.PUR_GROUP,
      createdOn: header.CREAT_DATE,
      createdBy: header.CREATED_BY,
      deleteIndicator: !!header.DELETE_IND,
      items,
      deliveryAddresses
    };

    cache.poDetails.set(normalizedPO, { data: poData, loadedAt: Date.now() });
    return poData;
  } catch (error) {
    LOG.error(`Error fetching PO ${poNumber}:`, error);
    return null;
  }
}

/**
 * Get plant address
 * @param {string} plant - Plant code
 * @returns {Promise<Object|null>}
 */
async function getPlantAddress(plant) {
  if (!plant) return null;

  const cached = cache.plantAddresses.get(plant);
  if (cached && isCacheValid(cached.loadedAt)) {
    return cached.data;
  }

  try {
    // Plant address typically comes from PO delivery address
    // or from T001W table. Using company code detail as proxy
    // In real implementation, would use specific plant lookup
    LOG.debug(`Plant address lookup for ${plant} - using cached PO data if available`);
    
    // Check if we have it from a PO
    for (const [, poData] of cache.poDetails) {
      if (poData.data?.deliveryAddresses) {
        for (const item of poData.data.items || []) {
          if (item.plant === plant) {
            const addr = poData.data.deliveryAddresses[item.poItem] || 
                        poData.data.deliveryAddresses._default;
            if (addr) {
              cache.plantAddresses.set(plant, { data: addr, loadedAt: Date.now() });
              return addr;
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    LOG.error(`Error fetching plant ${plant}:`, error);
    return null;
  }
}

// ============================================================================
// VENDOR TAX PROFILE
// ============================================================================

/**
 * Get vendor tax profile (exemptions, WHT, defaults)
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<Object|null>}
 */
async function getVendorTaxProfile(vendorId, companyCode) {
  if (!vendorId || !companyCode) return null;

  const cacheKey = `${vendorId}:${companyCode}`;
  const cached = cache.vendorTaxProfiles.get(cacheKey);
  if (cached && isCacheValid(cached.loadedAt)) {
    return cached.data;
  }

  try {
    const db = await getDbService();
    
    // Try to get from VendorTaxProfile table
    const profile = await db.run(
      SELECT.one.from('vim.validators.tax.VendorTaxProfile')
        .where({ vendorId: vendorId.toString().padStart(10, '0'), companyCode })
    );

    if (profile) {
      cache.vendorTaxProfiles.set(cacheKey, { data: profile, loadedAt: Date.now() });
      return profile;
    }

    // Create default profile from vendor master
    const vendorDetail = await getVendorDetail(vendorId, companyCode);
    if (!vendorDetail) return null;

    const defaultProfile = {
      vendorId: vendorDetail.vendorId,
      companyCode,
      vendorName: vendorDetail.name,
      vendorCountry: vendorDetail.country,
      vendorRegion: vendorDetail.region,
      isTaxExempt: false,
      exemptionCertNumber: null,
      exemptionValidFrom: null,
      exemptionValidTo: null,
      defaultTaxCode: null,
      withholdingTaxApplicable: false,
      withholdingTaxCode: null,
      withholdingTaxType: null,
      vatRegistrationNo: null,
      gstRegistrationNo: null
    };

    cache.vendorTaxProfiles.set(cacheKey, { data: defaultProfile, loadedAt: Date.now() });
    return defaultProfile;
  } catch (error) {
    LOG.warn(`Error fetching vendor tax profile for ${vendorId}:`, error);
    return null;
  }
}

/**
 * Check if vendor tax exemption is valid
 * @param {Object} profile - Vendor tax profile
 * @param {Date} [taxDate] - Date to check validity for
 * @returns {{isExempt: boolean, reason: string}}
 */
function checkVendorExemption(profile, taxDate = new Date()) {
  if (!profile || !profile.isTaxExempt) {
    return { isExempt: false, reason: 'Vendor not marked as tax exempt' };
  }

  // Check certificate validity dates
  if (profile.exemptionValidFrom) {
    const validFrom = new Date(profile.exemptionValidFrom);
    if (taxDate < validFrom) {
      return { 
        isExempt: false, 
        reason: `Exemption not yet valid (starts ${profile.exemptionValidFrom})` 
      };
    }
  }

  if (profile.exemptionValidTo) {
    const validTo = new Date(profile.exemptionValidTo);
    if (taxDate > validTo) {
      return { 
        isExempt: false, 
        reason: `Exemption expired (ended ${profile.exemptionValidTo})` 
      };
    }
  }

  // Check if certificate number exists
  if (!profile.exemptionCertNumber) {
    return { 
      isExempt: true, 
      reason: 'Vendor exempt but no certificate on file - recommend verification' 
    };
  }

  return { 
    isExempt: true, 
    reason: `Exempt per certificate ${profile.exemptionCertNumber}` 
  };
}

// ============================================================================
// TAX RULES ENGINE
// ============================================================================

/**
 * Load tax determination rules from admin service or local DB
 * @param {string} companyCode - Company code to filter by
 * @param {Date} [taxDate] - Date for validity filtering
 * @returns {Promise<Array>}
 */
async function loadTaxRules(companyCode, taxDate = new Date()) {
  const taxDateStr = taxDate.toISOString().split('T')[0];
  const isEffective = r =>
    r.isActive !== false &&
    (!r.validFrom || r.validFrom <= taxDateStr) &&
    (!r.validTo || r.validTo >= taxDateStr);

  // Cache is keyed by company code (rules for companyCode and '*')
  const cached = cache.taxRules.get(companyCode);
  if (cached && isCacheValid(cached.loadedAt)) {
    return cached.data.filter(isEffective);
  }

  try {
    let rules;
    const admin = await getAdminService();
    if (admin) {
      rules = await admin.run(
        SELECT.from('TaxDeterminationRules').where({ companyCode: [companyCode, '*'] })
      );
    } else {
      const db = await getDbService();
      rules = await db.run(
        SELECT.from('vim.validators.tax.TaxDeterminationRules')
          .where({ companyCode: [companyCode, '*'] })
      );
    }

    cache.taxRules.set(companyCode, { data: rules || [], loadedAt: Date.now() });
    return (rules || []).filter(isEffective);
  } catch (error) {
    LOG.error('Error loading tax rules:', error);
    return [];
  }
}

/**
 * Normalize rule input for comparison
 * @param {string} value - Value to normalize
 * @returns {string}
 */
function normalizeRuleInput(value) {
  return (value || '').toString().trim().toUpperCase();
}

/**
 * Rank how well a rule field matches a requested value
 * @param {string} ruleValue - Value in the rule
 * @param {string} requestedValue - Value from the request
 * @returns {number} 1 = exact match, 0 = wildcard match, -1 = no match
 */
function rankField(ruleValue, requestedValue) {
  const normalized = normalizeRuleInput(ruleValue);
  const requested = normalizeRuleInput(requestedValue);

  if (normalized === '*' || normalized === '') return 0;
  if (normalized === requested) return 1;
  return -1;
}

/**
 * Strip leading zeros from numeric SAP keys (vendor, G/L account)
 * @param {string} value - Value
 * @returns {string}
 */
function stripLeadingZeros(value) {
  if (value === null || value === undefined) return value;
  const str = value.toString().trim();
  return /^\d+$/.test(str) ? (str.replace(/^0+/, '') || '0') : str;
}

/**
 * Rank a postal code pattern ('*', exact value, or prefix ending in '*')
 * @param {string} rulePattern - Pattern in the rule
 * @param {string} requestedValue - Postal code from the request
 * @returns {number} 1 = match, 0 = wildcard, -1 = no match
 */
function rankPostalPattern(rulePattern, requestedValue) {
  const pattern = normalizeRuleInput(rulePattern);
  const requested = normalizeRuleInput(requestedValue).replace(/\s+/g, '');

  if (pattern === '*' || pattern === '') return 0;
  if (pattern.endsWith('*')) {
    return requested && requested.startsWith(pattern.slice(0, -1).replace(/\s+/g, '')) ? 1 : -1;
  }
  return pattern.replace(/\s+/g, '') === requested ? 1 : -1;
}

/**
 * Rule field weights (bit positions - a more specific field always outranks
 * any combination of less specific fields).
 */
const RULE_FIELD_WEIGHTS = {
  vendorId: 2048,
  senderCountry: 1024,
  receiverCountry: 512,
  receiverProvince: 256,
  postalCode: 128,
  documentType: 64,
  glAccount: 32,
  expenseType: 16,
  materialGroup: 8,
  vendorAccountGroup: 4,
  transactionType: 2,
  taxAmount: 1
};

/**
 * Evaluate all rules and return the best match with tie detection.
 * A rule field that is specific ('*'/empty = wildcard) must match the request
 * exactly; a missing request value never matches a specific rule field.
 *
 * @param {Object} input - Match criteria (see findMatchingTaxRule)
 * @returns {Promise<{rule: Object|null, ambiguous: boolean, candidates: Object[]}>}
 */
async function matchTaxRule(input) {
  const rules = await loadTaxRules(input.companyCode, input.taxDate);

  if (!rules || rules.length === 0) {
    LOG.debug(`No tax rules found for company ${input.companyCode}`);
    return { rule: null, ambiguous: false, candidates: [] };
  }

  const scored = [];

  for (const rule of rules) {
    const ranks = {
      vendorId: rankField(stripLeadingZeros(rule.vendorId), stripLeadingZeros(input.vendorId)),
      senderCountry: rankField(rule.senderCountry, input.senderCountry),
      receiverCountry: rankField(rule.receiverCountry, input.receiverCountry),
      receiverProvince: rankField(rule.receiverProvince, input.receiverProvince),
      postalCode: rankPostalPattern(rule.postalCodePattern ?? rule.postalCode, input.postalCode),
      documentType: rankField(rule.documentType, input.documentType),
      glAccount: rankField(stripLeadingZeros(rule.glAccount), stripLeadingZeros(input.glAccount)),
      expenseType: rankField(rule.expenseType, input.expenseType),
      materialGroup: rankField(rule.materialGroup, input.materialGroup),
      vendorAccountGroup: rankField(rule.vendorAccountGroup, input.vendorAccountGroup),
      transactionType: rankField(rule.transactionType, input.transactionType),
      taxAmount: 0
    };

    if (input.hasTaxAmount !== undefined && rule.taxAmount !== null && rule.taxAmount !== undefined) {
      ranks.taxAmount = (!!rule.taxAmount === !!input.hasTaxAmount) ? 1 : -1;
    }

    if (Object.values(ranks).some(r => r < 0)) {
      continue;
    }

    const score = Object.entries(ranks)
      .reduce((sum, [field, rank]) => sum + rank * RULE_FIELD_WEIGHTS[field], 0);

    // Priority is the tiebreaker (lower number = higher priority)
    const priority = rule.priority ?? 100;
    scored.push({ rule, score, priority });
  }

  if (scored.length === 0) {
    return { rule: null, ambiguous: false, candidates: [] };
  }

  scored.sort((a, b) =>
    (b.score - a.score) ||
    (a.priority - b.priority) ||
    String(a.rule.ID || '').localeCompare(String(b.rule.ID || ''))
  );

  const best = scored[0];
  const tied = scored.filter(s => s.score === best.score && s.priority === best.priority);
  const outcomes = new Set(tied.map(s =>
    `${normalizeRuleInput(s.rule.taxCode)}|${normalizeRuleInput(s.rule.taxJurisdiction)}`
  ));
  const candidates = tied.map(s => ({
    ruleId: s.rule.ID,
    ruleName: s.rule.ruleName,
    taxCode: s.rule.taxCode,
    taxJurisdiction: s.rule.taxJurisdiction || null
  }));

  if (outcomes.size > 1) {
    LOG.warn(`Ambiguous tax rules for company ${input.companyCode}: ${candidates.map(c => c.ruleId || c.ruleName).join(', ')}`);
    return { rule: null, ambiguous: true, candidates };
  }

  LOG.debug(`Matched rule ${best.rule.ID || best.rule.ruleName} with score ${best.score}`);
  return { rule: best.rule, ambiguous: false, candidates };
}

/**
 * Find best matching tax rule. Returns null when no rule matches or when
 * several equally specific rules with the same priority return different
 * tax code / jurisdiction (ambiguous configuration).
 *
 * @param {Object} input - Match criteria
 * @param {string} input.companyCode - Company code
 * @param {string} [input.vendorId] - Vendor ID
 * @param {string} [input.senderCountry] - Sender/vendor country
 * @param {string} [input.receiverCountry] - Receiver country
 * @param {string} [input.receiverProvince] - Receiver province
 * @param {string} [input.postalCode] - Postal code
 * @param {string} [input.documentType] - Document type
 * @param {string} [input.glAccount] - GL Account
 * @param {string} [input.expenseType] - Expense type
 * @param {string} [input.materialGroup] - Material group
 * @param {string} [input.vendorAccountGroup] - Vendor account group
 * @param {string} [input.transactionType] - Transaction type
 * @param {boolean} [input.hasTaxAmount] - Whether invoice has tax amount
 * @param {Date} [input.taxDate] - Tax calculation date
 * @returns {Promise<Object|null>}
 */
async function findMatchingTaxRule(input) {
  const match = await matchTaxRule(input);
  return match.rule;
}

// ============================================================================
// TAX VALIDATION (Against SAP Tables)
// ============================================================================

/**
 * Get tax codes (T007A/T007S via getTaxCodes) for a country
 * @param {string} country - Country key
 * @returns {Promise<Array|null>} null when ECC is unavailable
 */
async function getCountryTaxCodes(country) {
  const cached = cache.taxKeys.get(country);
  if (cached && isCacheValid(cached.loadedAt)) {
    return cached.data;
  }
  try {
    const ecc = await getEccService();
    const taxCodes = await ecc.getTaxCodes({ country, language: 'E' });
    cache.taxKeys.set(country, { data: taxCodes || [], loadedAt: Date.now() });
    return taxCodes || [];
  } catch (error) {
    LOG.warn(`Error loading tax codes for country ${country}:`, error);
    return null;
  }
}

/**
 * Get tax jurisdictions (TTXJ via getTaxJurisdictions) for a country
 * @param {string} country - Country key
 * @returns {Promise<Array|null>} null when ECC is unavailable
 */
async function getCountryJurisdictions(country) {
  const cached = cache.taxJurisdictions.get(country);
  if (cached && isCacheValid(cached.loadedAt)) {
    return cached.data;
  }
  try {
    const ecc = await getEccService();
    const jurisdictions = await ecc.getTaxJurisdictions({ country, language: 'E' });
    cache.taxJurisdictions.set(country, { data: jurisdictions || [], loadedAt: Date.now() });
    return jurisdictions || [];
  } catch (error) {
    LOG.warn(`Error loading tax jurisdictions for country ${country}:`, error);
    return null;
  }
}

/**
 * Read rows from a replicated ECC table
 * @param {string} entity - Entity name (e.g. 's4hana.TaxKeys')
 * @param {Object} where - Filter
 * @returns {Promise<Array|null>} null when the table is unavailable
 */
async function readReplicated(entity, where) {
  try {
    const db = await getDbService();
    return await db.run(SELECT.from(entity).where(where));
  } catch (error) {
    LOG.warn(`Replicated table ${entity} unavailable:`, error);
    return null;
  }
}

/**
 * Whether the company code country uses a jurisdiction-based tax procedure
 * (getTaxJurisdictions returns at least one TTXJ entry for the country).
 * @param {string} companyCode - Company code
 * @returns {Promise<boolean|null>} null when it cannot be determined
 */
async function isJurisdictionRequired(companyCode) {
  const company = await getCompanyCodeDetail(companyCode);
  if (!company?.country) return null;
  const jurisdictions = await getCountryJurisdictions(company.country);
  if (jurisdictions === null) return null;
  return jurisdictions.length > 0;
}

/**
 * Validate tax code: must exist for the company code country (getTaxCodes /
 * s4hana.TaxKeys), be an input tax code (MWART = 'V') and not be inactive
 * (s4hana.TaxKeys.XINACT). Fails closed when validation sources are unavailable.
 * @param {string} taxCode - Tax code to validate
 * @param {string} companyCode - Company code
 * @returns {Promise<{valid: boolean, message: string, procedure?: string|null, warnings?: string[]}>}
 */
async function validateTaxCode(taxCode, companyCode) {
  if (!taxCode) {
    return { valid: false, message: 'Tax code is required' };
  }

  const company = await getCompanyCodeDetail(companyCode);
  const country = company?.country;
  if (!country) {
    return { valid: false, message: `Country of company code ${companyCode} could not be determined` };
  }

  const eccCodes = await getCountryTaxCodes(country);
  const replicated = await readReplicated('s4hana.TaxKeys', { MWSKZ: taxCode });

  let matches;
  if (eccCodes !== null) {
    matches = eccCodes.filter(tc => tc.MWSKZ === taxCode);
  } else if (replicated !== null) {
    matches = replicated;
  } else {
    return { valid: false, message: `Tax code ${taxCode} could not be validated (getTaxCodes and s4hana.TaxKeys unavailable)` };
  }

  if (matches.length === 0) {
    return { valid: false, message: `Tax code ${taxCode} not found for country ${country}` };
  }

  const nonInput = matches.filter(m => m.MWART && m.MWART !== 'V');
  if (nonInput.length > 0) {
    return { valid: false, message: `Tax code ${taxCode} is not an input tax code (MWART=${nonInput[0].MWART})` };
  }

  const procedures = new Set(matches.map(m => m.KALSM).filter(Boolean));
  const replicatedForProcedure = (replicated || []).filter(r => procedures.size === 0 || procedures.has(r.KALSM));
  if (replicatedForProcedure.some(r => r.XINACT === 'X')) {
    return { valid: false, message: `Tax code ${taxCode} is inactive (s4hana.TaxKeys.XINACT)` };
  }

  const warnings = [];
  if (replicatedForProcedure.length === 0) {
    warnings.push(`Tax code ${taxCode} not found in s4hana.TaxKeys - inactive flag (XINACT) not verified`);
  }

  return {
    valid: true,
    message: `Valid: ${matches[0].TEXT1 || taxCode}`,
    procedure: procedures.size === 1 ? [...procedures][0] : null,
    warnings
  };
}

/**
 * Validate tax jurisdiction against TTXJ (getTaxJurisdictions, fallback
 * s4hana.TaxJurisdiction). Fails closed when validation sources are unavailable.
 * @param {string} jurisdictionCode - Jurisdiction code
 * @param {string} companyCode - Company code
 * @param {Object} [options]
 * @param {boolean} [options.required] - Jurisdiction is mandatory
 * @returns {Promise<{valid: boolean, message: string}>}
 */
async function validateTaxJurisdiction(jurisdictionCode, companyCode, options = {}) {
  if (!jurisdictionCode) {
    return options.required
      ? { valid: false, message: `Tax jurisdiction is required for company code ${companyCode}` }
      : { valid: true, message: 'Jurisdiction not required' };
  }

  const company = await getCompanyCodeDetail(companyCode);
  const country = company?.country;
  if (!country) {
    return { valid: false, message: `Country of company code ${companyCode} could not be determined` };
  }

  const jurisdictions = await getCountryJurisdictions(country);
  if (jurisdictions !== null) {
    const found = jurisdictions.find(tj => tj.TXJCD === jurisdictionCode);
    return found
      ? { valid: true, message: `Valid: ${found.TEXT1 || jurisdictionCode}` }
      : { valid: false, message: `Jurisdiction ${jurisdictionCode} not found for country ${country}` };
  }

  const replicated = await readReplicated('s4hana.TaxJurisdiction', { TXJCD: jurisdictionCode });
  if (replicated === null) {
    return { valid: false, message: `Jurisdiction ${jurisdictionCode} could not be validated (getTaxJurisdictions and s4hana.TaxJurisdiction unavailable)` };
  }
  return replicated.length > 0
    ? { valid: true, message: `Valid: ${jurisdictionCode} (s4hana.TaxJurisdiction)` }
    : { valid: false, message: `Jurisdiction ${jurisdictionCode} not found` };
}

// ============================================================================
// TAX CALCULATION (via SAP BAPI)
// ============================================================================

/**
 * Calculate tax amount using SAP BAPI
 * @param {Object} params - Calculation parameters
 * @param {string} params.companyCode - Company code
 * @param {string} params.taxCode - Tax code
 * @param {string} params.currency - Currency
 * @param {number} params.netAmount - Net amount
 * @param {string} [params.taxJurisdiction] - Tax jurisdiction
 * @param {Date} [params.taxDate] - Tax calculation date
 * @returns {Promise<{success: boolean, taxAmount: number|null, taxRate: number|null, nonDeductibleTax?: number, taxDetails?: Array, source?: string, message: string}>}
 */
async function calculateTaxAmount(params) {
  const { companyCode, taxCode, currency, netAmount, taxJurisdiction, taxDate } = params;

  const failure = message => ({ success: false, taxAmount: null, taxRate: null, message });

  if (!companyCode || !taxCode || !currency || netAmount === undefined || netAmount === null) {
    return failure('Missing required parameters for tax calculation');
  }

  if (Number(netAmount) === 0) {
    return { success: true, taxAmount: 0, taxRate: 0, nonDeductibleTax: 0, taxDetails: [], message: 'Zero net amount' };
  }

  const sign = netAmount < 0 ? -1 : 1;
  const formattedDate = (taxDate || new Date()).toISOString().split('T')[0];
  const request = {
    I_BUKRS: companyCode,
    I_MWSKZ: taxCode,
    I_WAERS: currency,
    I_WRBTR: Math.abs(netAmount),
    I_TXJCD: taxJurisdiction || null,
    I_PRSDT: formattedDate
  };

  let ecc;
  try {
    ecc = await getEccService();
  } catch (error) {
    LOG.warn('ECC service unavailable for tax calculation:', error);
    return failure(`Tax calculation unavailable: ${error.message}`);
  }

  let result;
  let source;
  try {
    result = await ecc.calculateTaxFromNet(request);
    source = 'calculateTaxFromNet';
  } catch (error) {
    LOG.warn(`calculateTaxFromNet failed for ${taxCode}, trying calculateTaxFromNetStd:`, error);
    try {
      result = await ecc.calculateTaxFromNetStd(request);
      source = 'calculateTaxFromNetStd';
    } catch (stdError) {
      LOG.warn(`calculateTaxFromNetStd failed for ${taxCode}:`, stdError);
      return failure(`Tax calculation failed: ${stdError.message}`);
    }
  }

  if (!result || result.E_FWSTE === undefined || result.E_FWSTE === null) {
    return failure(`${source} returned no tax amount (E_FWSTE)`);
  }

  const taxAmount = sign * (parseFloat(result.E_FWSTE) || 0);
  const nonDeductibleTax = sign * ((parseFloat(result.E_FWNAV) || 0) + (parseFloat(result.E_FWNVV) || 0));
  const taxDetails = (result.T_MWDAT || []).map(td => ({
    conditionType: td.KSCHL,
    accountKey: td.KTOSL,
    taxRate: parseFloat(td.MSATZ) || 0,
    taxAmount: sign * (parseFloat(td.WMWST) || 0),
    baseAmount: sign * (parseFloat(td.KAWRT) || 0),
    glAccount: td.HKONT,
    jurisdiction: td.TXJCD
  }));

  return {
    success: true,
    taxAmount,
    taxRate: Math.round((taxAmount / netAmount) * 1000000) / 10000,
    nonDeductibleTax,
    taxDetails,
    source,
    message: `Calculated via ${source}`
  };
}

// ============================================================================
// WITHHOLDING TAX DETERMINATION
// ============================================================================

/**
 * Determine withholding tax applicability and amount
 * @param {Object} params - WHT parameters
 * @param {string} params.vendorId - Vendor ID
 * @param {string} params.companyCode - Company code
 * @param {number} params.invoiceAmount - Total invoice amount
 * @param {string} [params.expenseType] - Type of expense
 * @param {string} [params.glAccount] - GL Account
 * @returns {Promise<WithholdingTaxResult>}
 */
async function determineWithholdingTax(params) {
  const { vendorId, companyCode, invoiceAmount, expenseType, glAccount } = params;

  const result = {
    applicable: false,
    wtType: null,
    wtCode: null,
    wtRate: 0,
    wtBaseAmount: 0,
    wtAmount: 0,
    reason: 'Withholding tax not applicable'
  };

  try {
    // Get vendor tax profile
    const profile = await getVendorTaxProfile(vendorId, companyCode);
    if (!profile) {
      result.reason = 'Vendor profile not found';
      return result;
    }

    // Check if vendor has WHT flag
    if (!profile.withholdingTaxApplicable) {
      result.reason = 'Vendor not subject to withholding tax';
      return result;
    }

    // Get company country for WHT rules
    const company = await getCompanyCodeDetail(companyCode);
    const companyCountry = company?.country || 'US';

    // Check WHT config for this country
    const wtConfig = WITHHOLDING_TAX_CONFIG[companyCountry];
    if (!wtConfig) {
      result.reason = `No WHT configuration for country ${companyCountry}`;
      return result;
    }

    // Determine WHT type based on expense type or vendor setup
    let wtType = profile.withholdingTaxType || wtConfig.types[0]?.code;
    let wtRate = profile.withholdingTaxCode 
      ? (wtConfig.types.find(t => t.code === profile.withholdingTaxCode)?.rate || 0)
      : (wtConfig.types[0]?.rate || 0);

    // Special rules based on expense type
    if (expenseType) {
      const expenseUpper = expenseType.toUpperCase();
      if (expenseUpper.includes('ROYALT')) {
        const royaltyType = wtConfig.types.find(t => 
          t.description.toLowerCase().includes('royalt')
        );
        if (royaltyType) {
          wtType = royaltyType.code;
          wtRate = royaltyType.rate;
        }
      } else if (expenseUpper.includes('RENT')) {
        const rentType = wtConfig.types.find(t => 
          t.description.toLowerCase().includes('rent')
        );
        if (rentType) {
          wtType = rentType.code;
          wtRate = rentType.rate;
        }
      }
    }

    // Check vendor country - foreign vendors often have higher WHT
    if (profile.vendorCountry && profile.vendorCountry !== companyCountry) {
      const foreignType = wtConfig.types.find(t => 
        t.description.toLowerCase().includes('foreign') || 
        t.description.toLowerCase().includes('non-resident')
      );
      if (foreignType) {
        wtType = foreignType.code;
        wtRate = foreignType.rate;
      }
    }

    if (wtRate > 0) {
      result.applicable = true;
      result.wtType = wtType;
      result.wtCode = profile.withholdingTaxCode || wtType;
      result.wtRate = wtRate;
      result.wtBaseAmount = invoiceAmount;
      result.wtAmount = Math.round((invoiceAmount * wtRate / 100) * 100) / 100;
      result.reason = `WHT ${wtRate}% applies - ${wtConfig.types.find(t => t.code === wtType)?.description || wtType}`;
    }

    return result;
  } catch (error) {
    LOG.error('Error determining withholding tax:', error);
    result.reason = `Error: ${error.message}`;
    return result;
  }
}

// ============================================================================
// ADDRESS RESOLUTION
// ============================================================================

/**
 * Resolve receiver address for tax determination
 * Priority for PO invoices: PO line plant address > PO header delivery address > Company address
 * Priority for Non-PO: Company code address
 * 
 * @param {Object} params - Resolution parameters
 * @param {string} params.companyCode - Company code
 * @param {string} [params.poNumber] - PO number
 * @param {string} [params.poLineNumber] - PO line number
 * @param {string} [params.plant] - Plant code
 * @returns {Promise<{address: Object, source: string}>}
 */
async function resolveReceiverAddress(params) {
  const { companyCode, poNumber, poLineNumber, plant } = params;

  // Priority 1: If we have a plant, get its address
  if (plant) {
    const plantAddr = await getPlantAddress(plant);
    if (plantAddr && plantAddr.country) {
      return { 
        address: plantAddr, 
        source: 'PLANT_MASTER' 
      };
    }
  }

  // Priority 2: If PO, get delivery address from PO
  if (poNumber) {
    const po = await getPODetail(poNumber);
    if (po) {
      const normalizedLine = poLineNumber ? poLineNumber.toString().padStart(5, '0') : null;
      
      // Try line-specific address
      if (normalizedLine && po.deliveryAddresses[normalizedLine]) {
        const addr = po.deliveryAddresses[normalizedLine];
        if (addr.country) {
          return { 
            address: addr, 
            source: 'PO_LINE_DELIVERY_ADDRESS' 
          };
        }
      }

      // Try plant from PO line
      const poItem = normalizedLine 
        ? po.items.find(i => i.poItem === normalizedLine)
        : po.items[0];
        
      if (poItem?.plant) {
        const plantAddr = await getPlantAddress(poItem.plant);
        if (plantAddr && plantAddr.country) {
          return { 
            address: plantAddr, 
            source: 'PO_LINE_PLANT_ADDRESS' 
          };
        }
      }

      // Use default PO delivery address
      if (po.deliveryAddresses._default?.country) {
        return { 
          address: po.deliveryAddresses._default, 
          source: 'PO_DEFAULT_DELIVERY_ADDRESS' 
        };
      }
    }
  }

  // Priority 3: Company code address (fallback)
  const company = await getCompanyCodeDetail(companyCode);
  if (company) {
    return {
      address: {
        country: company.country,
        region: company.region,
        city: company.city,
        postalCode: company.postalCode,
        taxJurisdiction: company.taxJurisdiction
      },
      source: 'COMPANY_CODE_ADDRESS'
    };
  }

  // No address found
  return {
    address: { country: '', region: '', postalCode: '', city: '', taxJurisdiction: '' },
    source: 'NONE_FOUND'
  };
}

/**
 * Derive expense type from GL Account
 * @param {string} glAccount - GL Account number
 * @returns {string|null}
 */
function deriveExpenseType(glAccount) {
  if (!glAccount) return null;
  
  const normalized = glAccount.replace(/^0+/, '');
  return GL_TO_EXPENSE_TYPE[normalized] || GL_TO_EXPENSE_TYPE[glAccount] || null;
}

// ============================================================================
// MAIN TAX DETERMINATION FUNCTIONS
// ============================================================================

/**
 * Create an empty line result
 * @param {string|number} lineNumber - Line number
 * @param {number} netAmount - Net amount
 * @returns {LineTaxResult}
 */
function createLineResult(lineNumber, netAmount) {
  return {
    lineNumber,
    netAmount: netAmount || 0,
    status: 'EXCEPTION',
    errorCode: null,
    taxCode: null,
    taxCodeSource: null,
    taxJurisdiction: null,
    taxJurisdictionSource: null,
    taxAmount: null,
    taxRate: null,
    nonDeductibleTax: null,
    taxDetails: [],
    confidence: 0,
    determinationMethod: null,
    ruleId: null,
    reason: null,
    isValidated: false,
    candidates: [],
    warnings: []
  };
}

/**
 * Mark a line result as exception (fail-closed)
 * @param {LineTaxResult} result - Line result
 * @param {string} errorCode - Error code
 * @param {string} reason - Reason
 * @returns {LineTaxResult}
 */
function failLine(result, errorCode, reason) {
  result.status = 'EXCEPTION';
  result.errorCode = errorCode;
  result.reason = reason;
  result.confidence = 0;
  result.warnings.push(reason);
  return result;
}

/**
 * Validate tax code / jurisdiction and calculate the tax amount via
 * calculateTaxFromNet. Any failure turns the line into an exception.
 * @param {LineTaxResult} result - Line result with taxCode/taxJurisdiction set
 * @param {Object} params
 * @param {string} params.companyCode - Company code
 * @param {string} params.currency - Currency
 * @param {number} params.netAmount - Net amount
 * @param {Date} [params.taxDate] - Tax date
 * @returns {Promise<LineTaxResult>}
 */
async function finalizeLine(result, { companyCode, currency, netAmount, taxDate }) {
  const codeValidation = await validateTaxCode(result.taxCode, companyCode);
  if (!codeValidation.valid) {
    return failLine(result, 'INVALID_TAX_CODE', codeValidation.message);
  }
  result.warnings.push(...(codeValidation.warnings || []));

  const required = await isJurisdictionRequired(companyCode);
  if (required === null) {
    return failLine(result, 'JURISDICTION_REQUIREMENT_UNKNOWN',
      `Could not determine whether company code ${companyCode} requires tax jurisdictions (getCompanyCodeDetail/getTaxJurisdictions unavailable)`);
  }
  const jurValidation = await validateTaxJurisdiction(result.taxJurisdiction, companyCode, { required });
  if (!jurValidation.valid) {
    return failLine(result, result.taxJurisdiction ? 'INVALID_TAX_JURISDICTION' : 'TAX_JURISDICTION_MISSING', jurValidation.message);
  }
  if (!required && result.taxJurisdiction) {
    return failLine(result, 'UNEXPECTED_TAX_JURISDICTION',
      `Company code ${companyCode} does not use tax jurisdictions but ${result.taxJurisdiction} was determined`);
  }
  result.isValidated = true;

  if (!currency) {
    return failLine(result, 'CURRENCY_MISSING', 'Currency is required for tax calculation');
  }

  const calc = await calculateTaxAmount({
    companyCode,
    taxCode: result.taxCode,
    currency,
    netAmount,
    taxJurisdiction: result.taxJurisdiction,
    taxDate
  });
  if (!calc.success) {
    return failLine(result, 'TAX_CALCULATION_FAILED', calc.message);
  }

  result.taxAmount = calc.taxAmount;
  result.taxRate = calc.taxRate;
  result.nonDeductibleTax = calc.nonDeductibleTax;
  result.taxDetails = calc.taxDetails || [];
  result.status = 'DETERMINED';
  result.confidence = 1.0;
  return result;
}

/**
 * Determine tax for a single PO line item (deterministic, fail-closed).
 *
 * Tax code:     POITEM.TAX_CODE, else the single POACCOUNT.TAX_CODE,
 *               else an unambiguous admin rule. Conflicts are exceptions.
 * Jurisdiction: POACCOUNT.TAXJURCODE (single value) > POITEM.TAXJURCODE >
 *               POADDRDELIVERY.TAXJURCODE > rule jurisdiction (rule path only).
 * Amount:       calculateTaxFromNet only.
 *
 * @param {Object} params - Line parameters
 * @param {string} params.poNumber - PO number
 * @param {string} params.poLineNumber - PO line number
 * @param {string} params.companyCode - Company code
 * @param {number} params.netAmount - Net amount
 * @param {string} [params.currency] - Currency (defaults to PO currency)
 * @param {Date} [params.taxDate] - Tax date
 * @param {string|number} [params.lineNumber] - Invoice line number
 * @returns {Promise<LineTaxResult>}
 */
async function determineTaxForPOLine(params) {
  const { poNumber, poLineNumber, companyCode, netAmount, currency, taxDate } = params;
  const result = createLineResult(params.lineNumber ?? poLineNumber, netAmount);

  try {
    if (!poLineNumber) {
      return failLine(result, 'PO_LINE_REQUIRED', `PO line number is required for PO ${poNumber}`);
    }

    const po = await getPODetail(poNumber);
    if (!po) {
      return failLine(result, 'PO_NOT_FOUND', `PO ${poNumber} not found`);
    }
    if (po.deleteIndicator) {
      return failLine(result, 'PO_DELETED', `PO ${poNumber} is deleted`);
    }
    if (companyCode && po.companyCode && po.companyCode !== companyCode) {
      return failLine(result, 'PO_COMPANY_CODE_MISMATCH',
        `PO ${poNumber} belongs to company code ${po.companyCode}, invoice company code is ${companyCode}`);
    }
    const effectiveCompanyCode = companyCode || po.companyCode;

    const normalizedLine = poLineNumber.toString().padStart(5, '0');
    const poItem = po.items.find(i => i.poItem === normalizedLine);
    if (!poItem) {
      return failLine(result, 'PO_LINE_NOT_FOUND', `PO line ${poLineNumber} not found in PO ${poNumber}`);
    }
    if (poItem.deleteIndicator) {
      return failLine(result, 'PO_LINE_DELETED', `PO line ${poLineNumber} of PO ${poNumber} is deleted`);
    }

    const accountTaxCodes = [...new Set(poItem.accounts.map(a => a.taxCode).filter(Boolean))];
    const accountJurisdictions = [...new Set(poItem.accounts.map(a => a.taxJurisdiction).filter(Boolean))];
    const accountGlAccounts = [...new Set(poItem.accounts.map(a => a.glAccount).filter(Boolean))];
    const deliveryAddr = po.deliveryAddresses[normalizedLine] || null;

    if (accountTaxCodes.length > 1 || (poItem.taxCode && accountTaxCodes.some(c => c !== poItem.taxCode))) {
      return failLine(result, 'PO_TAX_CODE_CONFLICT',
        `PO ${poNumber}/${normalizedLine} has conflicting tax codes (POITEM: ${poItem.taxCode || '-'}, POACCOUNT: ${accountTaxCodes.join(', ') || '-'})`);
    }
    if (accountJurisdictions.length > 1) {
      return failLine(result, 'PO_JURISDICTION_SPLIT',
        `PO ${poNumber}/${normalizedLine} has account assignments with different tax jurisdictions (${accountJurisdictions.join(', ')}) - split the invoice line per account assignment`);
    }

    if (poItem.taxCode || accountTaxCodes[0]) {
      result.taxCode = poItem.taxCode || accountTaxCodes[0];
      result.taxCodeSource = poItem.taxCode ? 'POITEM.TAX_CODE' : 'POACCOUNT.TAX_CODE';
      result.determinationMethod = 'PO_LINE_ITEM';
      result.reason = `Tax code ${result.taxCode} from PO ${poNumber}/${normalizedLine}`;
    }

    if (accountJurisdictions[0]) {
      result.taxJurisdiction = accountJurisdictions[0];
      result.taxJurisdictionSource = 'POACCOUNT.TAXJURCODE';
    } else if (poItem.taxJurisdiction) {
      result.taxJurisdiction = poItem.taxJurisdiction;
      result.taxJurisdictionSource = 'POITEM.TAXJURCODE';
    } else if (deliveryAddr?.taxJurisdiction) {
      result.taxJurisdiction = deliveryAddr.taxJurisdiction;
      result.taxJurisdictionSource = 'POADDRDELIVERY.TAXJURCODE';
    }

    if (!result.taxCode) {
      const vendor = await getVendorDetail(po.vendorId, effectiveCompanyCode);
      const match = await matchTaxRule({
        companyCode: effectiveCompanyCode,
        vendorId: po.vendorId,
        senderCountry: vendor?.country,
        receiverCountry: deliveryAddr?.country,
        receiverProvince: deliveryAddr?.region,
        postalCode: deliveryAddr?.postalCode,
        documentType: 'RE',
        glAccount: accountGlAccounts.length === 1 ? accountGlAccounts[0] : (accountGlAccounts.length === 0 ? poItem.glAccount : undefined),
        materialGroup: poItem.materialGroup,
        taxDate
      });

      if (match.ambiguous) {
        result.candidates = match.candidates;
        return failLine(result, 'AMBIGUOUS_TAX_RULE',
          `Several admin rules with equal specificity and priority return different results for PO ${poNumber}/${normalizedLine}`);
      }
      if (!match.rule) {
        return failLine(result, 'PO_TAX_CODE_MISSING',
          `PO ${poNumber}/${normalizedLine} has no tax code and no admin rule matched`);
      }

      result.taxCode = match.rule.taxCode;
      result.taxCodeSource = 'ADMIN_RULE';
      result.ruleId = match.rule.ID;
      result.determinationMethod = 'RULE_ENGINE';
      result.reason = `Rule ${match.rule.ruleName || match.rule.ID} matched`;
      if (!result.taxJurisdiction && match.rule.taxJurisdiction) {
        result.taxJurisdiction = match.rule.taxJurisdiction;
        result.taxJurisdictionSource = 'ADMIN_RULE';
      }
    }

    return await finalizeLine(result, {
      companyCode: effectiveCompanyCode,
      currency: currency || po.currency,
      netAmount,
      taxDate
    });
  } catch (error) {
    LOG.error(`Error determining tax for PO line ${poNumber}/${poLineNumber}:`, error);
    return failLine(result, 'EXCEPTION', `Error: ${error.message}`);
  }
}

/**
 * Determine tax for a Non-PO line item (deterministic, fail-closed).
 *
 * Requires an exact vendor ID (no name matching). Resolution order:
 *   1. VendorTaxProfile exemption (valid dates + certificate) -> VendorTaxProfile.defaultTaxCode
 *   2. Unambiguous admin rule (company code, vendor, G/L, expense type, ...)
 *   3. VendorTaxProfile.defaultTaxCode
 * Jurisdiction comes only from the matched rule; the company code, vendor or
 * bill-to address is never used. Amount comes only from calculateTaxFromNet.
 *
 * @param {Object} params - Line parameters
 * @param {string} params.companyCode - Company code
 * @param {string} params.vendorId - Vendor ID
 * @param {string|number} params.lineNumber - Line number
 * @param {number} params.netAmount - Net amount
 * @param {string} params.currency - Currency
 * @param {string} [params.glAccount] - GL Account
 * @param {string} [params.expenseType] - Expense type
 * @param {string} [params.materialGroup] - Material group
 * @param {string} [params.documentType] - Document type (KR, KG)
 * @param {Date} [params.taxDate] - Tax date
 * @returns {Promise<LineTaxResult>}
 */
async function determineTaxForNonPOLine(params) {
  const {
    companyCode, vendorId, lineNumber, netAmount, currency,
    glAccount, expenseType, materialGroup, documentType, taxDate
  } = params;

  const result = createLineResult(lineNumber, netAmount);

  try {
    if (!vendorId) {
      return failLine(result, 'VENDOR_REQUIRED', 'Non-PO tax determination requires an exact vendor ID');
    }

    const vendor = await getVendorDetail(vendorId, companyCode);
    if (!vendor) {
      return failLine(result, 'VENDOR_NOT_FOUND', `Vendor ${vendorId} not found for company code ${companyCode}`);
    }

    const vendorProfile = await getVendorTaxProfile(vendorId, companyCode);
    const exemptionStatus = checkVendorExemption(vendorProfile, taxDate);

    if (exemptionStatus.isExempt) {
      if (!vendorProfile.exemptionCertNumber) {
        return failLine(result, 'EXEMPTION_CERTIFICATE_MISSING',
          `Vendor ${vendorId} is flagged tax exempt without an exemption certificate`);
      }
      if (!vendorProfile.defaultTaxCode) {
        return failLine(result, 'EXEMPT_TAX_CODE_NOT_CONFIGURED',
          `Vendor ${vendorId} is tax exempt but VendorTaxProfile.defaultTaxCode is not configured`);
      }
      result.taxCode = vendorProfile.defaultTaxCode;
      result.taxCodeSource = 'VENDOR_TAX_PROFILE';
      result.taxJurisdiction = vendorProfile.defaultTaxJurisdiction || null;
      result.taxJurisdictionSource = vendorProfile.defaultTaxJurisdiction ? 'VENDOR_TAX_PROFILE' : null;
      result.determinationMethod = 'VENDOR_EXEMPT';
      result.reason = exemptionStatus.reason;
    } else {
      const company = await getCompanyCodeDetail(companyCode);
      if (!company) {
        return failLine(result, 'COMPANY_CODE_NOT_FOUND', `Company code ${companyCode} not found`);
      }

      const match = await matchTaxRule({
        companyCode,
        vendorId,
        senderCountry: vendor.country,
        receiverCountry: company.country,
        receiverProvince: company.region,
        postalCode: company.postalCode,
        documentType: documentType || 'KR',
        glAccount,
        expenseType: expenseType || deriveExpenseType(glAccount),
        materialGroup,
        taxDate
      });

      if (match.ambiguous) {
        result.candidates = match.candidates;
        return failLine(result, 'AMBIGUOUS_TAX_RULE',
          `Several admin rules with equal specificity and priority return different results for vendor ${vendorId}`);
      }

      if (match.rule) {
        result.taxCode = match.rule.taxCode;
        result.taxCodeSource = 'ADMIN_RULE';
        result.taxJurisdiction = match.rule.taxJurisdiction || null;
        result.taxJurisdictionSource = match.rule.taxJurisdiction ? 'ADMIN_RULE' : null;
        result.ruleId = match.rule.ID;
        result.determinationMethod = 'RULE_ENGINE';
        result.reason = `Rule ${match.rule.ruleName || match.rule.ID} matched`;
      } else if (vendorProfile?.defaultTaxCode) {
        result.taxCode = vendorProfile.defaultTaxCode;
        result.taxCodeSource = 'VENDOR_TAX_PROFILE';
        result.taxJurisdiction = vendorProfile.defaultTaxJurisdiction || null;
        result.taxJurisdictionSource = vendorProfile.defaultTaxJurisdiction ? 'VENDOR_TAX_PROFILE' : null;
        result.determinationMethod = 'VENDOR_TAX_PROFILE';
        result.reason = `Default tax code ${vendorProfile.defaultTaxCode} from VendorTaxProfile`;
      } else {
        return failLine(result, 'NO_TAX_RULE',
          `No admin rule or VendorTaxProfile default for vendor ${vendorId}, company code ${companyCode}`);
      }
    }

    return await finalizeLine(result, { companyCode, currency, netAmount, taxDate });
  } catch (error) {
    LOG.error(`Error determining tax for Non-PO line ${lineNumber}:`, error);
    return failLine(result, 'EXCEPTION', `Error: ${error.message}`);
  }
}

/**
 * Route a single invoice line to PO or Non-PO determination.
 * A line referencing a PO (line or header PO number) is always PO-based and
 * requires a PO line number; it never falls back to Non-PO determination.
 * @param {TaxLineItem} lineItem - Invoice line
 * @param {Object} ctx - Invoice context
 * @returns {Promise<LineTaxResult>}
 */
async function determineLine(lineItem, ctx) {
  const linePoNumber = lineItem.poNumber || ctx.poNumber;

  if (linePoNumber) {
    return determineTaxForPOLine({
      poNumber: linePoNumber,
      poLineNumber: lineItem.poLineNumber,
      lineNumber: lineItem.lineNumber,
      companyCode: ctx.companyCode,
      netAmount: lineItem.netAmount || 0,
      currency: ctx.currency,
      taxDate: ctx.taxDate
    });
  }

  return determineTaxForNonPOLine({
    companyCode: ctx.companyCode,
    vendorId: ctx.vendorId,
    lineNumber: lineItem.lineNumber,
    netAmount: lineItem.netAmount || 0,
    currency: ctx.currency,
    glAccount: lineItem.glAccount,
    expenseType: lineItem.expenseType,
    materialGroup: lineItem.materialGroup,
    documentType: ctx.documentType || 'KR',
    taxDate: ctx.taxDate
  });
}

/**
 * Main entry point: Determine tax for an entire invoice
 * Handles both PO and Non-PO invoices with per-line-item determination.
 * success is true only when every line has status DETERMINED.
 *
 * @param {TaxDeterminationInput} input - Invoice data
 * @returns {Promise<TaxDeterminationResult>}
 */
async function determineInvoiceTax(input) {
  const { 
    companyCode, vendorId, supplierName, poNumber, 
    documentType, taxDate, currency, lineItems 
  } = input;

  const startTime = Date.now();
  LOG.info(`Starting tax determination for ${lineItems?.length || 0} lines, company ${companyCode}`);

  const result = {
    success: false,
    lines: [],
    header: null,
    withholdingTax: null,
    reconciliation: null,
    exceptions: [],
    auditLog: []
  };

  try {
    // Validate required inputs
    if (!companyCode) {
      throw new Error('Company code is required');
    }
    if (!lineItems || lineItems.length === 0) {
      throw new Error('At least one line item is required');
    }

    // Vendor must be an exact ID; supplier names are never resolved here
    const resolvedVendorId = vendorId;
    if (!resolvedVendorId && supplierName) {
      LOG.debug(`Supplier name "${supplierName}" provided without vendor ID - Non-PO lines require an exact vendor ID`);
    }

    const effectiveTaxDate = taxDate ? new Date(taxDate) : new Date();

    // Process each line item
    for (const lineItem of lineItems) {
      const lineResult = await determineLine(lineItem, {
        companyCode,
        vendorId: resolvedVendorId,
        poNumber,
        documentType,
        currency,
        taxDate: effectiveTaxDate
      });
      const linePoNumber = lineItem.poNumber || poNumber;

      result.lines.push(lineResult);

      // Add to audit log
      result.auditLog.push({
        timestamp: new Date().toISOString(),
        lineNumber: lineItem.lineNumber,
        action: linePoNumber ? 'PO_LINE_TAX_DETERMINED' : 'NON_PO_LINE_TAX_DETERMINED',
        input: {
          poNumber: linePoNumber,
          poLine: lineItem.poLineNumber,
          netAmount: lineItem.netAmount,
          glAccount: lineItem.glAccount
        },
        output: {
          status: lineResult.status,
          errorCode: lineResult.errorCode,
          taxCode: lineResult.taxCode,
          taxJurisdiction: lineResult.taxJurisdiction,
          taxAmount: lineResult.taxAmount,
          method: lineResult.determinationMethod,
          confidence: lineResult.confidence
        },
        ruleId: lineResult.ruleId
      });
    }

    // Aggregate header results
    result.header = aggregateHeaderTax(result.lines);

    // Determine withholding tax (if applicable)
    if (resolvedVendorId) {
      const totalAmount = result.lines.reduce((sum, l) => sum + (l.netAmount || 0), 0);
      result.withholdingTax = await determineWithholdingTax({
        vendorId: resolvedVendorId,
        companyCode,
        invoiceAmount: totalAmount,
        expenseType: lineItems[0]?.expenseType,
        glAccount: lineItems[0]?.glAccount
      });
    }

    // Calculate reconciliation
    result.reconciliation = calculateReconciliation(result.lines, input.invoiceTaxAmount);

    result.exceptions = result.lines
      .filter(l => l.status !== 'DETERMINED')
      .map(l => ({ lineNumber: l.lineNumber, errorCode: l.errorCode, reason: l.reason }));
    result.success = result.exceptions.length === 0;

    const elapsed = Date.now() - startTime;
    LOG.info(`Tax determination completed in ${elapsed}ms, success: ${result.success}`);

    return result;
  } catch (error) {
    LOG.error('Tax determination failed:', error);
    result.reconciliation = {
      isBalanced: false,
      calculatedTotal: 0,
      message: `Error: ${error.message}`,
      action: 'MANUAL_REVIEW'
    };
    return result;
  }
}

/**
 * Aggregate line-level tax results to header
 * @param {LineTaxResult[]} lines - Line results
 * @returns {HeaderTaxResult}
 */
function aggregateHeaderTax(lines) {
  const taxCodeCounts = {};
  const taxCodeAmounts = {};
  let totalTaxAmount = 0;
  let totalNetAmount = 0;

  for (const line of lines) {
    if (line.taxCode) {
      taxCodeCounts[line.taxCode] = (taxCodeCounts[line.taxCode] || 0) + 1;
      taxCodeAmounts[line.taxCode] = (taxCodeAmounts[line.taxCode] || 0) + (line.netAmount || 0);
    }
    totalTaxAmount += line.taxAmount || 0;
    totalNetAmount += line.netAmount || 0;
  }

  // Determine primary tax code (highest total amount)
  let primaryTaxCode = null;
  let maxAmount = 0;
  for (const [code, amount] of Object.entries(taxCodeAmounts)) {
    if (Math.abs(amount) > maxAmount) {
      maxAmount = Math.abs(amount);
      primaryTaxCode = code;
    }
  }
  if (!primaryTaxCode && Object.keys(taxCodeAmounts).length > 0) {
    primaryTaxCode = Object.keys(taxCodeAmounts)[0];
  }

  const uniqueTaxCodes = Object.keys(taxCodeCounts);
  const allLinesSameTax = uniqueTaxCodes.length <= 1;
  const uniqueTaxJurisdictions = [...new Set(lines.filter(l => l.taxCode).map(l => l.taxJurisdiction || ''))];

  // Get jurisdiction from first line with matching tax code
  const primaryLine = lines.find(l => l.taxCode === primaryTaxCode);
  const primaryJurisdiction = primaryLine?.taxJurisdiction || '';

  return {
    taxCode: primaryTaxCode,
    taxJurisdiction: primaryJurisdiction,
    totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
    totalNetAmount: Math.round(totalNetAmount * 100) / 100,
    effectiveTaxRate: totalNetAmount > 0 
      ? Math.round((totalTaxAmount / totalNetAmount) * 10000) / 100 
      : 0,
    allLinesSameTax,
    uniqueTaxCodes,
    allLinesSameJurisdiction: uniqueTaxJurisdictions.length <= 1,
    uniqueTaxJurisdictions
  };
}

/**
 * Calculate tax reconciliation
 * @param {LineTaxResult[]} lines - Line results
 * @param {number} [invoiceTaxAmount] - Invoice-stated tax amount
 * @returns {TaxReconciliation}
 */
function calculateReconciliation(lines, invoiceTaxAmount) {
  const calculatedTotal = lines.reduce((sum, l) => sum + (l.taxAmount || 0), 0);
  const roundedCalculated = Math.round(calculatedTotal * 100) / 100;

  if (invoiceTaxAmount === undefined || invoiceTaxAmount === null) {
    return {
      isBalanced: true,
      calculatedTotal: roundedCalculated,
      message: 'No invoice tax amount to compare',
      action: 'NONE'
    };
  }

  const variance = Math.abs(roundedCalculated - invoiceTaxAmount);
  const tolerancePercent = 0.02; // 2% tolerance
  const toleranceAmount = Math.max(0.01, invoiceTaxAmount * tolerancePercent);

  if (variance <= toleranceAmount) {
    return {
      isBalanced: true,
      calculatedTotal: roundedCalculated,
      invoiceTotal: invoiceTaxAmount,
      variance: variance,
      message: `Tax amounts match within tolerance (${variance.toFixed(2)})`,
      action: 'NONE'
    };
  }

  const isOverstated = invoiceTaxAmount > roundedCalculated;
  return {
    isBalanced: false,
    calculatedTotal: roundedCalculated,
    invoiceTotal: invoiceTaxAmount,
    variance: variance,
    message: isOverstated 
      ? `Invoice tax (${invoiceTaxAmount}) exceeds calculated (${roundedCalculated}) by ${variance.toFixed(2)}`
      : `Invoice tax (${invoiceTaxAmount}) is less than calculated (${roundedCalculated}) by ${variance.toFixed(2)}`,
    action: isOverstated ? 'REVIEW_OVERSTATED' : 'REVIEW_UNDERSTATED'
  };
}

// ============================================================================
// UTILITY FUNCTIONS FOR REMOTE CALLERS
// ============================================================================

/**
 * Get tax details for a single lookup (simplified API)
 * Compatible with admin service getTaxDetails signature + enhancements
 * 
 * @param {Object} params - Lookup parameters
 * @returns {Promise<Object>}
 */
async function getTaxDetails(params) {
  const {
    companyCode,
    vendorId,
    senderCountry,
    receiverCountry,
    receiverProvince,
    postalCode,
    documentType,
    glAccount,
    taxAmount,
    taxDate
  } = params;

  // First try vendor exemption
  if (vendorId) {
    const profile = await getVendorTaxProfile(vendorId, companyCode);
    const exemption = checkVendorExemption(profile, taxDate);
    if (exemption.isExempt) {
      if (!profile.exemptionCertNumber || !profile.defaultTaxCode) {
        return {
          taxCode: null,
          taxJurisdiction: null,
          option: 'EXEMPT',
          source: 'VENDOR_EXEMPT',
          error: !profile.exemptionCertNumber ? 'EXEMPTION_CERTIFICATE_MISSING' : 'EXEMPT_TAX_CODE_NOT_CONFIGURED',
          reason: exemption.reason
        };
      }
      return {
        taxCode: profile.defaultTaxCode,
        taxJurisdiction: profile.defaultTaxJurisdiction || null,
        option: 'EXEMPT',
        source: 'VENDOR_EXEMPT',
        reason: exemption.reason
      };
    }
  }

  // Find matching rule
  const match = await matchTaxRule({
    companyCode,
    vendorId,
    senderCountry,
    receiverCountry,
    receiverProvince,
    postalCode,
    documentType,
    glAccount,
    hasTaxAmount: taxAmount,
    taxDate
  });
  const rule = match.rule;

  if (match.ambiguous) {
    return {
      taxCode: null,
      taxJurisdiction: null,
      option: null,
      source: 'AMBIGUOUS_RULES',
      error: 'AMBIGUOUS_TAX_RULE',
      candidates: match.candidates
    };
  }

  if (rule) {
    return {
      taxCode: rule.taxCode,
      taxJurisdiction: rule.taxJurisdiction,
      option: rule.option,
      source: 'RULE_ENGINE',
      ruleId: rule.ID,
      ruleName: rule.ruleName
    };
  }

  // No rule found - return explicit error (not silent null)
  return {
    taxCode: null,
    taxJurisdiction: null,
    option: null,
    source: 'NO_RULE_MATCHED',
    error: 'NO_MATCHING_RULE',
    searchCriteria: {
      companyCode,
      vendorId,
      senderCountry,
      receiverCountry,
      receiverProvince,
      postalCode,
      documentType,
      glAccount
    }
  };
}

/**
 * Batch tax determination for multiple lines
 * @param {Object} params - Batch parameters
 * @returns {Promise<Array>}
 */
async function batchDetermineTax(params) {
  const { companyCode, vendorId, lines, currency, taxDate, documentType } = params;
  const effectiveTaxDate = taxDate ? new Date(taxDate) : new Date();

  const results = [];
  for (const line of lines) {
    results.push(await determineLine(line, {
      companyCode,
      vendorId,
      documentType,
      currency,
      taxDate: effectiveTaxDate
    }));
  }
  
  return results;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log tax determination to audit table
 * @param {string} documentReference - Invoice/document reference
 * @param {TaxDeterminationResult} result - Determination result
 * @returns {Promise<void>}
 */
async function logTaxDetermination(documentReference, result) {
  try {
    const db = await getDbService();
    
    for (const entry of result.auditLog) {
      await db.run(
        INSERT.into('vim.validators.tax.TaxDeterminationAuditLog').entries({
          documentReference,
          documentType: entry.input?.poNumber ? 'PO' : 'NONPO',
          lineNumber: entry.lineNumber,
          determinedTaxCode: entry.output?.taxCode,
          determinedJurisdiction: entry.output?.taxJurisdiction,
          determinationMethod: entry.output?.method,
          matchedRuleId: entry.ruleId,
          inputData: JSON.stringify(entry.input),
          confidence: entry.output?.confidence,
          createdAt: entry.timestamp
        })
      );
    }
    
    LOG.debug(`Logged ${result.auditLog.length} audit entries for ${documentReference}`);
  } catch (error) {
    LOG.warn('Failed to log tax determination audit:', error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main entry points
  determineInvoiceTax,
  getTaxDetails,
  batchDetermineTax,
  
  // Individual determination functions
  determineTaxForPOLine,
  determineTaxForNonPOLine,
  
  // Withholding tax
  determineWithholdingTax,
  
  // Master data retrieval
  getVendorDetail,
  getCompanyCodeDetail,
  getPODetail,
  getPlantAddress,
  getVendorTaxProfile,
  
  // Address resolution
  resolveReceiverAddress,
  
  // Tax rules
  loadTaxRules,
  findMatchingTaxRule,
  
  // Validation
  validateTaxCode,
  validateTaxJurisdiction,
  
  // Calculation
  calculateTaxAmount,
  
  // Utilities
  checkVendorExemption,
  deriveExpenseType,
  aggregateHeaderTax,
  calculateReconciliation,
  
  // Audit
  logTaxDetermination,
  
  // Cache management
  clearCache,
  
  // Constants (for testing/configuration)
  TAX_EXEMPT_EXPENSE_TYPES,
  GL_TO_EXPENSE_TYPE,
  CANADIAN_PROVINCIAL_TAX,
  WITHHOLDING_TAX_CONFIG
};
