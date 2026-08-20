// @ts-check
/**
 * @fileoverview Main orchestrator for VIM Invoice Validators.
 * Provides a unified API for validating and deriving invoice fields.
 */

const poValidators = require('./po-validators');
const poLookup = require('./po-lookup');
const vendorValidators = require('./vendor-validators');
const taxValidators = require('./tax-validators');
const accountValidators = require('./account-validators');
const invoiceValidators = require('./invoice-validators');
const reconciliationValidators = require('./reconciliation-validators');
const touchlessValidators = require('./touchless-validators');
const nonPOValidators = require('./non-po-validators');
const vendorTaxValidators = require('./vendor-tax-validators');
const cache = require('./cache');
const { combineScores, createValidationResult } = require('./utils/confidence');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').DerivationResult} DerivationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 * @typedef {import('./types').InvoiceHeader} InvoiceHeader
 * @typedef {import('./types').InvoiceLineItem} InvoiceLineItem
 */

/**
 * Validate an entire invoice header.
 * @param {InvoiceHeader} header - Invoice header data
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<{isValid: boolean, confidence: number, results: Object}>}
 */
async function validateInvoiceHeader(header, context) {
  const results = {};
  const scores = [];
  
  // Validate vendor
  if (header.vendorId || header.vendorName) {
    results.vendor = await vendorValidators.validateVendor(
      header.vendorId,
      header.vendorName,
      context
    );
    if (results.vendor.confidence > 0) {
      scores.push(results.vendor.confidence);
    }
  }
  
  // Validate PO if provided
  if (header.purchaseOrder) {
    results.purchaseOrder = await poValidators.validatePONumber(
      header.purchaseOrder,
      context
    );
    if (results.purchaseOrder.confidence > 0) {
      scores.push(results.purchaseOrder.confidence);
    }
    
    // Cross-validate vendor against PO
    if (results.purchaseOrder.isValid && (header.vendorId || header.vendorName)) {
      results.vendorPOMatch = await poValidators.validateVendorAgainstPO(
        header.purchaseOrder,
        header.vendorId,
        header.vendorName
      );
      scores.push(results.vendorPOMatch.confidence);
    }
  }
  
  const overallConfidence = scores.length > 0 ? combineScores(scores) : 0;
  const isValid = scores.length > 0 && scores.every(s => s >= 0.5);
  
  return {
    isValid,
    confidence: overallConfidence,
    results
  };
}


/**
 * Validate an invoice line item.
 * @param {InvoiceLineItem} lineItem - Line item data
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<{isValid: boolean, confidence: number, results: Object}>}
 */
async function validateInvoiceLineItem(lineItem, context) {
  const results = {};
  const scores = [];
  
  // Validate PO item if provided
  if (lineItem.poNumber && lineItem.poItem) {
    results.poItem = await poValidators.validatePOItem(
      lineItem.poNumber,
      lineItem.poItem,
      context
    );
    if (results.poItem.confidence > 0) {
      scores.push(results.poItem.confidence);
    }
  }
  
  // Validate GL account
  if (lineItem.glAccount) {
    results.glAccount = await accountValidators.validateGLAccount(
      lineItem.glAccount,
      context
    );
    if (results.glAccount.confidence > 0) {
      scores.push(results.glAccount.confidence);
    }
  }
  
  // Validate cost center
  if (lineItem.costCenter) {
    results.costCenter = await accountValidators.validateCostCenter(
      lineItem.costCenter,
      context
    );
    if (results.costCenter.confidence > 0) {
      scores.push(results.costCenter.confidence);
    }
  }
  
  // Validate tax code
  if (lineItem.taxCode) {
    results.taxCode = await taxValidators.validateTaxCode(
      lineItem.taxCode,
      context
    );
    if (results.taxCode.confidence > 0) {
      scores.push(results.taxCode.confidence);
    }
  }
  
  const overallConfidence = scores.length > 0 ? combineScores(scores) : 0;
  const isValid = scores.length > 0 && scores.every(s => s >= 0.5);
  
  return {
    isValid,
    confidence: overallConfidence,
    results
  };
}

/**
 * Derive missing fields for an invoice header from PO.
 * @param {InvoiceHeader} header - Invoice header with at least PO number
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<DerivationResult>}
 */
async function deriveInvoiceHeaderFields(header, context) {
  if (!header.purchaseOrder) {
    return {
      success: false,
      derivedFields: {},
      confidence: 0,
      source: 'none'
    };
  }
  
  // Derive from PO
  const poDerivation = await poValidators.deriveFieldsFromPO(
    header.purchaseOrder,
    context
  );
  
  return poDerivation;
}


/**
 * Derive missing fields for an invoice line item.
 * @param {InvoiceLineItem} lineItem - Line item data
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<DerivationResult>}
 */
async function deriveLineItemFields(lineItem, context) {
  const derivedFields = {};
  const validations = [];
  let overallConfidence = 0;
  let derivationCount = 0;
  
  // Try to derive from PO item first
  if (lineItem.poNumber && lineItem.poItem) {
    const poItemDerivation = await poValidators.deriveFieldsFromPOItem(
      lineItem.poNumber,
      lineItem.poItem,
      context
    );
    
    if (poItemDerivation.success) {
      Object.assign(derivedFields, poItemDerivation.derivedFields);
      overallConfidence += poItemDerivation.confidence;
      derivationCount++;
    }
  } else if (lineItem.poNumber && lineItem.description) {
    // Try to match line to PO item by description
    const matchResult = await poValidators.matchInvoiceLineToPOItem(
      lineItem.poNumber,
      { description: lineItem.description, amount: lineItem.netAmount },
      context
    );
    
    if (matchResult && matchResult.score >= 0.5) {
      const item = matchResult.item;
      derivedFields.poItem = item.poItem;
      derivedFields.taxCode = item.taxCode;
      derivedFields.glAccount = item.glAccount;
      derivedFields.costCenter = item.costCenter;
      overallConfidence += matchResult.score;
      derivationCount++;
    }
  }
  
  // Derive GL account from description if still missing
  if (!derivedFields.glAccount && lineItem.description) {
    const glResult = await accountValidators.deriveGLAccountFromDescription(
      lineItem.description,
      context
    );
    if (glResult.isValid) {
      derivedFields.glAccount = glResult.derivedValue;
      validations.push(glResult);
      overallConfidence += glResult.confidence;
      derivationCount++;
    }
  }
  
  // Derive cost center from description if still missing
  if (!derivedFields.costCenter && lineItem.description) {
    const ccResult = await accountValidators.deriveCostCenterFromDescription(
      lineItem.description,
      context
    );
    if (ccResult.isValid) {
      derivedFields.costCenter = ccResult.derivedValue;
      validations.push(ccResult);
      overallConfidence += ccResult.confidence;
      derivationCount++;
    }
  }
  
  return {
    success: Object.keys(derivedFields).length > 0,
    derivedFields,
    confidence: derivationCount > 0 ? overallConfidence / derivationCount : 0,
    source: lineItem.poNumber ? 'PO Item' : 'Description Matching',
    validations
  };
}

/**
 * Validate and derive all fields for a complete invoice.
 * @param {Object} invoice - Complete invoice data
 * @param {InvoiceHeader} invoice.header - Invoice header
 * @param {InvoiceLineItem[]} invoice.lineItems - Line items
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<Object>} Complete validation and derivation results
 */
async function processInvoice(invoice, context) {
  const { header, lineItems = [] } = invoice;
  
  // Validate header
  const headerValidation = await validateInvoiceHeader(header, context);
  
  // Derive missing header fields
  const headerDerivation = await deriveInvoiceHeaderFields(header, context);
  
  // Process line items
  const lineItemResults = await Promise.all(
    lineItems.map(async (item, index) => {
      const validation = await validateInvoiceLineItem(item, context);
      const derivation = await deriveLineItemFields(item, context);
      
      return {
        lineNumber: item.lineNumber || index + 1,
        validation,
        derivation
      };
    })
  );
  
  // Calculate overall confidence
  const allConfidences = [
    headerValidation.confidence,
    ...lineItemResults.map(r => r.validation.confidence)
  ].filter(c => c > 0);
  
  const overallConfidence = allConfidences.length > 0
    ? combineScores(allConfidences)
    : 0;
  
  return {
    isValid: headerValidation.isValid && lineItemResults.every(r => r.validation.isValid),
    confidence: overallConfidence,
    header: {
      validation: headerValidation,
      derivation: headerDerivation
    },
    lineItems: lineItemResults
  };
}


/**
 * Clear all caches.
 */
function clearCache() {
  cache.clearAll();
}

/**
 * Get cache statistics.
 * @returns {import('./types').CacheStats}
 */
function getCacheStats() {
  return cache.getStats();
}

// Export all validators and utilities
module.exports = {
  // High-level orchestration
  validateInvoiceHeader,
  validateInvoiceLineItem,
  deriveInvoiceHeaderFields,
  deriveLineItemFields,
  processInvoice,
  
  // Cache management
  clearCache,
  getCacheStats,
  
  // PO validators
  po: {
    validatePONumber: poValidators.validatePONumber,
    validatePOItem: poValidators.validatePOItem,
    deriveFieldsFromPO: poValidators.deriveFieldsFromPO,
    deriveFieldsFromPOItem: poValidators.deriveFieldsFromPOItem,
    matchInvoiceLineToPOItem: poValidators.matchInvoiceLineToPOItem,
    validateAmountAgainstPO: poValidators.validateAmountAgainstPO,
    validateVendorAgainstPO: poValidators.validateVendorAgainstPO,
    searchPOsByVendor: poValidators.searchPOsByVendor,
    fetchPODetail: poValidators.fetchPODetail
  },
  
  // PO Lookup (comprehensive PO details retrieval)
  poLookup: {
    // Main lookup function
    lookupPO: poLookup.lookupPO,
    
    // Convenience functions
    lookupPOVendor: poLookup.lookupPOVendor,
    lookupPOPaymentTerms: poLookup.lookupPOPaymentTerms,
    lookupPOCompanyCode: poLookup.lookupPOCompanyCode,
    lookupPOLineItems: poLookup.lookupPOLineItems,
    
    // Validation helper
    checkPOValidForInvoicing: poLookup.checkPOValidForInvoicing,
    
    // Debug/report function
    printPOReport: poLookup.printPOReport
  },
  
  // Vendor validators
  vendor: {
    validateVendor: vendorValidators.validateVendor,
    validateVendorById: vendorValidators.validateVendorById,
    validateVendorByName: vendorValidators.validateVendorByName,
    searchVendors: vendorValidators.searchVendors,
    validateVendorGroupKey: vendorValidators.validateVendorGroupKey,
    deriveVendorIdFromName: vendorValidators.deriveVendorIdFromName,
    getVendorPaymentInfo: vendorValidators.getVendorPaymentInfo,
    isVendorActive: vendorValidators.isVendorActive,
    fetchVendorList: vendorValidators.fetchVendorList,
    fetchVendorDetail: vendorValidators.fetchVendorDetail
  },
  
  // Tax validators
  tax: {
    validateTaxCode: taxValidators.validateTaxCode,
    validateTaxJurisdiction: taxValidators.validateTaxJurisdiction,
    deriveTaxCodeFromDescription: taxValidators.deriveTaxCodeFromDescription,
    calculateTaxFromNet: taxValidators.calculateTaxFromNet,
    validateTaxAmount: taxValidators.validateTaxAmount,
    getTaxCodesForCountry: taxValidators.getTaxCodesForCountry,
    getTaxJurisdictionsForCountry: taxValidators.getTaxJurisdictionsForCountry,
    suggestTaxCode: taxValidators.suggestTaxCode
  },
  
  // Account validators
  account: {
    validateGLAccount: accountValidators.validateGLAccount,
    validateCostCenter: accountValidators.validateCostCenter,
    validateInternalOrder: accountValidators.validateInternalOrder,
    validateProfitCenter: accountValidators.validateProfitCenter,
    deriveGLAccountFromDescription: accountValidators.deriveGLAccountFromDescription,
    deriveCostCenterFromDescription: accountValidators.deriveCostCenterFromDescription,
    searchGLAccounts: accountValidators.searchGLAccounts,
    searchCostCenters: accountValidators.searchCostCenters,
    getGLAccountsForCompany: accountValidators.getGLAccountsForCompany,
    getCostCentersForArea: accountValidators.getCostCentersForArea
  },
  
  // Invoice validators (duplicate check, document type, auto-fill, PO spend)
  invoice: {
    // Duplicate Invoice Check
    checkDuplicateInvoice: invoiceValidators.checkDuplicateInvoice,
    registerInvoiceForDuplicateCheck: invoiceValidators.registerInvoiceForDuplicateCheck,
    
    // Document Type Determination (KR vs KG)
    determineDocumentType: invoiceValidators.determineDocumentType,
    
    // Account Assignment Auto-fill
    deriveAccountAssignmentFromPO: invoiceValidators.deriveAccountAssignmentFromPO,
    deriveProfitCenterFromCostCenter: invoiceValidators.deriveProfitCenterFromCostCenter,
    validateInternalOrder: invoiceValidators.validateInternalOrder,
    
    // Payment Date Calculations
    calculatePaymentDates: invoiceValidators.calculatePaymentDates,
    
    // Withholding Tax
    deriveWithholdingTax: invoiceValidators.deriveWithholdingTax,
    
    // One-time Vendor (CPD)
    checkOneTimeVendor: invoiceValidators.checkOneTimeVendor,
    
    // Historical PO Spend / Overbilling
    getHistoricalPOSpend: invoiceValidators.getHistoricalPOSpend,
    validateAgainstPOBudget: invoiceValidators.validateAgainstPOBudget,
    
    // Comprehensive Auto-fill
    autoFillInvoiceFields: invoiceValidators.autoFillInvoiceFields
  },
  
  // Reconciliation & Month-End Close
  reconciliation: {
    // PO Reconciliation
    reconcilePOWithInvoices: reconciliationValidators.reconcilePOWithInvoices,
    
    // Invoice Aging Analysis
    analyzeInvoiceAging: reconciliationValidators.analyzeInvoiceAging,
    
    // Accrual Identification
    identifyAccrualCandidates: reconciliationValidators.identifyAccrualCandidates,
    
    // Payment Forecasting
    forecastPayments: reconciliationValidators.forecastPayments,
    
    // Period-End Readiness
    validatePeriodEndReadiness: reconciliationValidators.validatePeriodEndReadiness
  },
  
  // Touchless Processing Validators
  touchless: {
    // Configuration
    DEFAULT_TOLERANCES: touchlessValidators.DEFAULT_TOLERANCES,
    PAYMENT_BLOCK_CODES: touchlessValidators.PAYMENT_BLOCK_CODES,
    REQUIRED_FIELDS: touchlessValidators.REQUIRED_FIELDS,
    
    // 3-Way Match (PO vs GR vs Invoice)
    performThreeWayMatch: touchlessValidators.performThreeWayMatch,
    
    // Currency Validation & Conversion
    validateCurrency: touchlessValidators.validateCurrency,
    
    // Tolerance Checks
    checkTolerance: touchlessValidators.checkTolerance,
    checkInvoiceTolerances: touchlessValidators.checkInvoiceTolerances,
    
    // Payment Block Determination
    determinePaymentBlock: touchlessValidators.determinePaymentBlock,
    
    // Workflow Routing
    determineWorkflowRouting: touchlessValidators.determineWorkflowRouting,
    
    // Posting Simulation
    simulatePosting: touchlessValidators.simulatePosting,
    
    // Comprehensive Touchless Assessment
    assessTouchlessReadiness: touchlessValidators.assessTouchlessReadiness
  },
  
  // Non-PO Invoice Validators (GL Account & Cost Center Derivation)
  nonPO: {
    // Configuration (overridable)
    EXPENSE_TYPE_GL_MAPPING: nonPOValidators.EXPENSE_TYPE_GL_MAPPING,
    VENDOR_GROUP_GL_MAPPING: nonPOValidators.VENDOR_GROUP_GL_MAPPING,
    DEPARTMENT_COST_CENTER_MAPPING: nonPOValidators.DEPARTMENT_COST_CENTER_MAPPING,
    
    // Individual Derivation Functions
    deriveGLFromExpenseType: nonPOValidators.deriveGLFromExpenseType,
    deriveExpenseTypeFromDescription: nonPOValidators.deriveExpenseTypeFromDescription,
    deriveGLFromVendor: nonPOValidators.deriveGLFromVendor,
    deriveFromHistoricalPattern: nonPOValidators.deriveFromHistoricalPattern,
    deriveCostCenterFromRequester: nonPOValidators.deriveCostCenterFromRequester,
    getExpenseHintsFromTaxCode: nonPOValidators.getExpenseHintsFromTaxCode,
    
    // Master Derivation Function (uses all inputs)
    deriveNonPOAccountAssignment: nonPOValidators.deriveNonPOAccountAssignment
  },
  
  // Vendor Validation & Tax Derivation (field-by-field matching)
  vendorTax: {
    // Configuration
    VENDOR_MATCH_THRESHOLDS: vendorTaxValidators.VENDOR_MATCH_THRESHOLDS,
    VENDOR_FIELD_WEIGHTS: vendorTaxValidators.VENDOR_FIELD_WEIGHTS,
    COUNTRY_TAX_CODE_DEFAULTS: vendorTaxValidators.COUNTRY_TAX_CODE_DEFAULTS,
    TAX_EXEMPT_EXPENSE_TYPES: vendorTaxValidators.TAX_EXEMPT_EXPENSE_TYPES,
    
    // Vendor Validation (field-by-field against ECC)
    validateVendorDetails: vendorTaxValidators.validateVendorDetails,
    searchVendorByInvoiceData: vendorTaxValidators.searchVendorByInvoiceData,
    
    // Tax Jurisdiction Derivation (country + region + postal)
    deriveTaxJurisdiction: vendorTaxValidators.deriveTaxJurisdiction,
    
    // Tax Code Derivation (100% for PO, 70-85% for non-PO)
    deriveTaxCode: vendorTaxValidators.deriveTaxCode,
    getTaxCodeFromPO: vendorTaxValidators.getTaxCodeFromPO,
    
    // Tax Amount Calculation (100% via BAPI)
    calculateTaxAmount: vendorTaxValidators.calculateTaxAmount,
    validateTaxAmount: vendorTaxValidators.validateTaxAmount,
    
    // Comprehensive Vendor + Tax Orchestration
    deriveVendorAndTax: vendorTaxValidators.deriveVendorAndTax
  },
  
  // Utilities (for advanced usage)
  utils: require('./utils'),
  cache: require('./cache')
};
