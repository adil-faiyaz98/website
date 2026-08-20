// @ts-check
/**
 * @fileoverview Touchless invoice processor - orchestrates all validators
 * for automated invoice processing with minimal human intervention.
 */

const supplierValidators = require('./supplier-validators');
const paymentValidators = require('./payment-validators');
const determinationValidators = require('./determination-validators');
const poMatchingValidators = require('./po-matching-validators');
const taxValidators = require('./tax-validators');
const invoiceValidators = require('./invoice-validators');
const { createValidationResult } = require('./utils/confidence');

/**
 * Processing result status.
 * @typedef {'TOUCHLESS' | 'REVIEW_REQUIRED' | 'MANUAL_PROCESSING' | 'REJECTED'} ProcessingStatus
 */

/**
 * Invoice processing result.
 * @typedef {Object} InvoiceProcessingResult
 * @property {ProcessingStatus} status - Processing status
 * @property {number} overallConfidence - Overall confidence score (0-1)
 * @property {boolean} readyForPosting - Whether invoice can be auto-posted
 * @property {Object} derivedFields - All derived field values
 * @property {Object} validations - All validation results
 * @property {string[]} issues - List of issues found
 * @property {string[]} recommendations - Processing recommendations
 * @property {Object} riskAssessment - Risk assessment summary
 */

/**
 * Invoice input data.
 * @typedef {Object} InvoiceInput
 * @property {string} [invoiceNumber] - Invoice number
 * @property {string|Date} invoiceDate - Invoice date
 * @property {number} grossAmount - Gross invoice amount
 * @property {number} [netAmount] - Net amount
 * @property {number} [taxAmount] - Tax amount
 * @property {string} currency - Currency code
 * @property {string} [vendorId] - Vendor ID (if known)
 * @property {string} [supplierName] - Supplier name (for vendor lookup)
 * @property {string} [poNumber] - PO number (if PO invoice)
 * @property {string} companyCode - Company code
 * @property {string} [controllingArea] - Controlling area
 * @property {string} country - Country code
 * @property {Array} [lineItems] - Invoice line items
 * @property {Object} [additionalData] - Additional invoice data
 */

/**
 * Confidence thresholds for touchless processing.
 */
const TOUCHLESS_THRESHOLDS = {
  vendor: 0.9,
  poMatch: 0.85,
  taxCode: 0.8,
  glAccount: 0.8,
  costCenter: 0.75,
  overall: 0.85,
  riskScore: 0.3 // Max acceptable risk score
};

/**
 * Process invoice for touchless posting.
 * @param {InvoiceInput} invoice - Invoice data
 * @param {Object} [options] - Processing options
 * @param {Object} [options.thresholds] - Custom thresholds
 * @param {boolean} [options.skipFraudCheck] - Skip fraud detection
 * @param {boolean} [options.allowPartialMatch] - Allow partial line matching
 * @returns {Promise<InvoiceProcessingResult>}
 */
async function processInvoice(invoice, options = {}) {
  const thresholds = { ...TOUCHLESS_THRESHOLDS, ...options.thresholds };
  const context = {
    companyCode: invoice.companyCode,
    country: invoice.country,
    thresholds
  };
  
  const result = {
    status: /** @type {ProcessingStatus} */ ('TOUCHLESS'),
    overallConfidence: 0,
    readyForPosting: false,
    derivedFields: {},
    validations: {},
    issues: [],
    recommendations: [],
    riskAssessment: {}
  };
  
  try {
    // Step 0: Document type determination (Credit Memo vs Invoice)
    const documentTypeResult = await invoiceValidators.determineDocumentType({
      grossAmount: invoice.grossAmount,
      documentTypeText: invoice.additionalData?.documentTypeText,
      headerText: invoice.additionalData?.headerText,
      isReturn: invoice.additionalData?.isReturn,
      poNumber: invoice.poNumber
    });
    result.derivedFields.documentType = documentTypeResult;
    result.validations.documentType = documentTypeResult;
    
    // Step 0.5: Duplicate invoice check
    if (invoice.vendorId || invoice.supplierName) {
      const duplicateResult = await invoiceValidators.checkDuplicateInvoice({
        vendorId: invoice.vendorId,
        companyCode: invoice.companyCode,
        currency: invoice.currency,
        grossAmount: invoice.grossAmount,
        invoiceDate: invoice.invoiceDate,
        referenceNumber: invoice.invoiceNumber
      });
      result.validations.duplicateCheck = duplicateResult;
      
      if (duplicateResult.isDuplicate) {
        result.status = 'REJECTED';
        result.issues.push(`Duplicate invoice detected: ${duplicateResult.message}`);
        result.recommendations.push('Review existing invoice before processing');
        return finalizeResult(result, thresholds);
      } else if (duplicateResult.matches.length > 0) {
        result.issues.push(`Similar invoice found - verify not duplicate`);
      }
    }
    
    // Step 1: Vendor identification and validation
    const vendorResult = await processVendor(invoice, context);
    result.derivedFields.vendor = vendorResult.derivedFields;
    result.validations.vendor = vendorResult.validations;
    result.issues.push(...vendorResult.issues);
    
    if (!vendorResult.vendorId) {
      result.status = 'MANUAL_PROCESSING';
      result.issues.push('Unable to identify vendor');
      return finalizeResult(result, thresholds);
    }
    
    // Step 1.5: One-time vendor check
    const oneTimeVendorResult = await invoiceValidators.checkOneTimeVendor(
      vendorResult.vendorId,
      invoice.companyCode
    );
    result.validations.oneTimeVendor = oneTimeVendorResult;
    
    if (oneTimeVendorResult.isOneTimeVendor) {
      result.derivedFields.isOneTimeVendor = true;
      result.derivedFields.requiredCPDFields = oneTimeVendorResult.requiredFields;
      result.recommendations.push('One-time vendor detected - ensure CPD master data is provided');
    }
    
    // Step 2: Fraud and risk assessment
    if (!options.skipFraudCheck) {
      const riskResult = await assessRisk(invoice, vendorResult.vendorId, context);
      result.riskAssessment = riskResult;
      
      if (riskResult.riskScore > thresholds.riskScore) {
        result.status = 'REVIEW_REQUIRED';
        result.issues.push(`High risk score: ${riskResult.riskLevel}`);
        result.recommendations.push(...riskResult.flags);
      }
    }
    
    // Step 3: PO or Non-PO processing path
    if (invoice.poNumber) {
      const poResult = await processPOInvoice(invoice, vendorResult.vendorId, context);
      Object.assign(result.derivedFields, poResult.derivedFields);
      Object.assign(result.validations, poResult.validations);
      result.issues.push(...poResult.issues);
      result.recommendations.push(...poResult.recommendations);
      
      if (!poResult.matched) {
        result.status = poResult.confidence > 0.6 ? 'REVIEW_REQUIRED' : 'MANUAL_PROCESSING';
      }
      
      // Step 3.5: Overbilling check using historical PO spend
      const overbillingResult = await invoiceValidators.validateAgainstPOBudget(
        invoice.poNumber,
        invoice.grossAmount,
        { tolerancePercent: 5 }
      );
      result.validations.overbilling = overbillingResult;
      
      if (!overbillingResult.isValid) {
        result.issues.push(overbillingResult.message);
        result.recommendations.push('Verify overbilling is authorized or adjust invoice amount');
        if (overbillingResult.confidence < 0.5) {
          result.status = 'REVIEW_REQUIRED';
        }
      }
      
      // Step 3.6: Derive account assignments from PO
      const accountAssignment = await invoiceValidators.deriveAccountAssignmentFromPO(
        invoice.poNumber,
        invoice.lineItems?.[0]?.poLineNumber
      );
      result.derivedFields.accountAssignment = accountAssignment;
      
    } else {
      const nonPOResult = await processNonPOInvoice(invoice, vendorResult.vendorId, context);
      Object.assign(result.derivedFields, nonPOResult.derivedFields);
      Object.assign(result.validations, nonPOResult.validations);
      result.issues.push(...nonPOResult.issues);
      result.recommendations.push(...nonPOResult.recommendations);
    }
    
    // Step 4: Payment information
    const paymentResult = await processPayment(invoice, vendorResult.vendorId, context);
    result.derivedFields.payment = paymentResult.derivedFields;
    result.validations.payment = paymentResult.validations;
    result.issues.push(...paymentResult.issues);
    
    // Step 4.5: Withholding tax derivation
    const withholdingTaxResult = await invoiceValidators.deriveWithholdingTax(
      vendorResult.vendorId,
      invoice.companyCode
    );
    result.derivedFields.withholdingTax = withholdingTaxResult;
    
    if (withholdingTaxResult.hasWithholdingTax) {
      result.recommendations.push('Vendor subject to withholding tax - verify WT codes');
    }
    
    // Step 5: Tax derivation
    const taxResult = await processTax(invoice, result.derivedFields, context);
    result.derivedFields.tax = taxResult.derivedFields;
    result.validations.tax = taxResult.validations;
    result.issues.push(...taxResult.issues);
    
    // Step 6: Register invoice for future duplicate checking
    if (invoice.vendorId && invoice.grossAmount) {
      invoiceValidators.registerInvoiceForDuplicateCheck({
        vendorId: invoice.vendorId,
        companyCode: invoice.companyCode,
        currency: invoice.currency,
        grossAmount: invoice.grossAmount,
        invoiceDate: invoice.invoiceDate,
        referenceNumber: invoice.invoiceNumber
      });
    }
    
    return finalizeResult(result, thresholds);
  } catch (error) {
    result.status = 'MANUAL_PROCESSING';
    result.issues.push(`Processing error: ${error.message}`);
    return result;
  }
}


/**
 * Process vendor identification and validation.
 * @param {InvoiceInput} invoice - Invoice data
 * @param {Object} context - Processing context
 * @returns {Promise<Object>}
 */
async function processVendor(invoice, context) {
  const result = {
    vendorId: null,
    derivedFields: {},
    validations: {},
    issues: []
  };
  
  // If vendor ID provided, validate it
  if (invoice.vendorId) {
    const activeResult = await supplierValidators.validateVendorActive(
      invoice.vendorId,
      invoice.companyCode
    );
    
    result.validations.vendorActive = activeResult;
    
    if (activeResult.isValid) {
      result.vendorId = invoice.vendorId;
      result.derivedFields.vendorId = invoice.vendorId;
      result.derivedFields.vendorIdSource = 'provided';
    } else {
      result.issues.push(activeResult.message);
    }
  }
  
  // If no vendor ID or validation failed, try to identify from supplier name
  if (!result.vendorId && invoice.supplierName) {
    const identifyResult = await supplierValidators.identifyVendorFromSupplier(
      invoice.supplierName,
      context,
      invoice.additionalData || {}
    );
    
    result.validations.vendorIdentification = identifyResult;
    
    if (identifyResult.isValid && identifyResult.confidence >= context.thresholds.vendor) {
      result.vendorId = identifyResult.derivedValue;
      result.derivedFields.vendorId = identifyResult.derivedValue;
      result.derivedFields.vendorIdSource = 'identified';
      result.derivedFields.vendorIdConfidence = identifyResult.confidence;
    } else if (identifyResult.derivedValue) {
      result.derivedFields.suggestedVendorId = identifyResult.derivedValue;
      result.derivedFields.suggestedVendorConfidence = identifyResult.confidence;
      result.issues.push(`Vendor match confidence ${(identifyResult.confidence * 100).toFixed(0)}% below threshold`);
    }
  }
  
  // Get vendor details if we have a vendor ID
  if (result.vendorId) {
    const vendorDetail = await supplierValidators.getVendorDetailWithCache(
      result.vendorId,
      invoice.companyCode
    );
    
    if (vendorDetail) {
      result.derivedFields.vendorName = vendorDetail.name;
      result.derivedFields.vendorCountry = vendorDetail.country;
      result.derivedFields.vendorCity = vendorDetail.city;
    }
  }
  
  return result;
}

/**
 * Assess risk and fraud indicators.
 * @param {InvoiceInput} invoice - Invoice data
 * @param {string} vendorId - Vendor ID
 * @param {Object} context - Processing context
 * @returns {Promise<Object>}
 */
async function assessRisk(invoice, vendorId, context) {
  // Fraud detection
  const fraudResult = await supplierValidators.detectFraudIndicators({
    vendorId,
    companyCode: invoice.companyCode,
    amount: invoice.grossAmount,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    poNumber: invoice.poNumber
  });
  
  // Vendor risk profile
  const riskProfile = await supplierValidators.getVendorRiskProfile(
    vendorId,
    invoice.companyCode
  );
  
  return {
    riskScore: fraudResult.riskScore,
    riskLevel: fraudResult.riskLevel,
    flags: fraudResult.flags,
    fraudDetails: fraudResult.details,
    vendorRiskProfile: riskProfile,
    recommendation: fraudResult.recommendation
  };
}

/**
 * Process PO-based invoice.
 * @param {InvoiceInput} invoice - Invoice data
 * @param {string} vendorId - Vendor ID
 * @param {Object} context - Processing context
 * @returns {Promise<Object>}
 */
async function processPOInvoice(invoice, vendorId, context) {
  const result = {
    matched: false,
    confidence: 0,
    derivedFields: { invoiceType: 'PO' },
    validations: {},
    issues: [],
    recommendations: []
  };
  
  // Validate PO exists and is open
  const poExistsResult = await poMatchingValidators.validatePOExists(invoice.poNumber);
  result.validations.poExists = poExistsResult;
  
  if (!poExistsResult.isValid) {
    result.issues.push(`PO ${invoice.poNumber} not found`);
    return result;
  }
  
  result.derivedFields.poCompanyCode = poExistsResult.metadata?.companyCode;
  result.derivedFields.poCurrency = poExistsResult.metadata?.currency;
  
  // Validate PO open for invoicing
  const poOpenResult = await poMatchingValidators.validatePOOpenForInvoicing(invoice.poNumber);
  result.validations.poOpen = poOpenResult;
  
  if (!poOpenResult.isValid) {
    result.issues.push(poOpenResult.message);
    return result;
  }
  
  // Validate vendor matches PO
  const vendorMatchResult = await poMatchingValidators.validatePOVendorMatch(
    invoice.poNumber,
    vendorId
  );
  result.validations.vendorMatch = vendorMatchResult;
  
  if (!vendorMatchResult.isValid) {
    result.issues.push('Invoice vendor does not match PO vendor');
    result.recommendations.push('Verify vendor assignment or create credit memo');
  }
  
  // Match line items
  if (invoice.lineItems && invoice.lineItems.length > 0) {
    const matchSummary = await poMatchingValidators.getInvoicePOMatchSummary(
      {
        poNumber: invoice.poNumber,
        vendorId,
        lineItems: invoice.lineItems
      },
      context.thresholds
    );
    
    result.validations.lineItemMatch = matchSummary;
    result.matched = matchSummary.overallMatch;
    result.confidence = matchSummary.overallConfidence;
    result.derivedFields.matchType = matchSummary.matchType;
    result.derivedFields.lineMatches = matchSummary.lineItemMatches;
    
    if (!matchSummary.overallMatch) {
      result.issues.push(...matchSummary.issues);
    }
    result.recommendations.push(...matchSummary.recommendations);
  } else {
    // Header-level PO match only
    result.matched = vendorMatchResult.isValid;
    result.confidence = vendorMatchResult.isValid ? 0.7 : 0.3;
    result.recommendations.push('No line items provided - header-level match only');
  }
  
  return result;
}


/**
 * Process non-PO invoice (cost invoice).
 * @param {InvoiceInput} invoice - Invoice data
 * @param {string} vendorId - Vendor ID
 * @param {Object} context - Processing context
 * @returns {Promise<Object>}
 */
async function processNonPOInvoice(invoice, vendorId, context) {
  const result = {
    derivedFields: { invoiceType: 'NON_PO' },
    validations: {},
    issues: [],
    recommendations: []
  };
  
  // Process each line item for account assignment
  if (invoice.lineItems && invoice.lineItems.length > 0) {
    result.derivedFields.lineItems = [];
    
    for (const line of invoice.lineItems) {
      const lineResult = await deriveNonPOLineFields(line, invoice, vendorId, context);
      result.derivedFields.lineItems.push(lineResult.derivedFields);
      Object.assign(result.validations, lineResult.validations);
      result.issues.push(...lineResult.issues);
    }
  } else {
    // Header-level derivation
    const headerResult = await deriveNonPOLineFields(
      {
        description: invoice.additionalData?.description,
        amount: invoice.netAmount || invoice.grossAmount,
        expenseType: invoice.additionalData?.expenseType,
        department: invoice.additionalData?.department
      },
      invoice,
      vendorId,
      context
    );
    
    result.derivedFields.headerAccounting = headerResult.derivedFields;
    Object.assign(result.validations, headerResult.validations);
    result.issues.push(...headerResult.issues);
  }
  
  // Non-PO invoices typically require approval workflow
  result.recommendations.push('Non-PO invoice - approval workflow required');
  
  return result;
}

/**
 * Derive fields for a non-PO invoice line.
 * @param {Object} line - Line item data
 * @param {InvoiceInput} invoice - Invoice data
 * @param {string} vendorId - Vendor ID
 * @param {Object} context - Processing context
 * @returns {Promise<Object>}
 */
async function deriveNonPOLineFields(line, invoice, vendorId, context) {
  const result = {
    derivedFields: {},
    validations: {},
    issues: []
  };
  
  // Derive complete account assignment
  const accountResult = await determinationValidators.deriveAccountAssignment({
    companyCode: invoice.companyCode,
    controllingArea: invoice.controllingArea || invoice.companyCode,
    description: line.description,
    expenseType: line.expenseType,
    department: line.department,
    projectCode: line.projectCode,
    vendorId,
    taxCode: line.taxCode
  });
  
  result.derivedFields = {
    glAccount: accountResult.glAccount.value,
    glAccountConfidence: accountResult.glAccount.confidence,
    glAccountSource: accountResult.glAccount.source,
    costCenter: accountResult.costCenter.value,
    costCenterConfidence: accountResult.costCenter.confidence,
    profitCenter: accountResult.profitCenter.value,
    internalOrder: accountResult.internalOrder.value,
    chartOfAccounts: accountResult.chartOfAccounts,
    isComplete: accountResult.isComplete
  };
  
  result.validations.accountAssignment = accountResult;
  
  if (!accountResult.isComplete) {
    result.issues.push(...accountResult.recommendations);
  }
  
  // Validate derived GL account
  if (accountResult.glAccount.value) {
    const glValidation = await determinationValidators.validateGLAccountForPosting(
      accountResult.glAccount.value,
      invoice.companyCode
    );
    result.validations.glAccount = glValidation;
    
    if (!glValidation.isValid) {
      result.issues.push(glValidation.message);
    }
  }
  
  // Validate cost center
  if (accountResult.costCenter.value) {
    const ccValidation = await determinationValidators.validateCostCenterForPosting(
      accountResult.costCenter.value,
      invoice.controllingArea || invoice.companyCode,
      invoice.invoiceDate
    );
    result.validations.costCenter = ccValidation;
    
    if (!ccValidation.isValid) {
      result.issues.push(ccValidation.message);
    }
  }
  
  return result;
}

/**
 * Process payment-related fields.
 * @param {InvoiceInput} invoice - Invoice data
 * @param {string} vendorId - Vendor ID
 * @param {Object} context - Processing context
 * @returns {Promise<Object>}
 */
async function processPayment(invoice, vendorId, context) {
  const result = {
    derivedFields: {},
    validations: {},
    issues: []
  };
  
  // Get complete payment info
  const paymentInfo = await paymentValidators.getPaymentInfo({
    poNumber: invoice.poNumber,
    vendorId,
    companyCode: invoice.companyCode,
    invoiceDate: invoice.invoiceDate,
    invoiceAmount: invoice.grossAmount
  });
  
  result.derivedFields = {
    paymentTerms: paymentInfo.paymentTerms?.paymentTermsKey,
    paymentTermsSource: paymentInfo.paymentTermsSource,
    dueDate: paymentInfo.summary.dueDate,
    baselineDate: paymentInfo.baselineDate?.toISOString?.()?.split('T')?.[0],
    paymentMethod: paymentInfo.paymentMethod?.method,
    cashDiscountAvailable: paymentInfo.cashDiscount.isEligible,
    cashDiscountAmount: paymentInfo.cashDiscount.discountAmount,
    cashDiscountDueDate: paymentInfo.summary.discountDueDate
  };
  
  // Validate payment not blocked
  const paymentBlockResult = await paymentValidators.validatePaymentNotBlocked(
    vendorId,
    invoice.companyCode
  );
  result.validations.paymentBlock = paymentBlockResult;
  
  if (!paymentBlockResult.isValid) {
    result.issues.push('Vendor has payment block');
  }
  
  // Validate invoice date
  const dateResult = paymentValidators.validateInvoiceDate(invoice.invoiceDate);
  result.validations.invoiceDate = dateResult;
  
  if (!dateResult.isValid) {
    result.issues.push(dateResult.message);
  }
  
  return result;
}


/**
 * Process tax derivation.
 * @param {InvoiceInput} invoice - Invoice data
 * @param {Object} derivedFields - Already derived fields
 * @param {Object} context - Processing context
 * @returns {Promise<Object>}
 */
async function processTax(invoice, derivedFields, context) {
  const result = {
    derivedFields: {},
    validations: {},
    issues: []
  };
  
  // Get line-level or header-level GL account for tax derivation
  const glAccount = derivedFields.lineItems?.[0]?.glAccount || 
                   derivedFields.headerAccounting?.glAccount;
  
  // Derive tax information
  const taxInfo = await taxValidators.deriveTaxInfo({
    poNumber: invoice.poNumber,
    poLineNumber: invoice.lineItems?.[0]?.poLineNumber,
    companyCode: invoice.companyCode,
    country: invoice.country,
    vendorId: derivedFields.vendor?.vendorId,
    expenseType: invoice.additionalData?.expenseType,
    glAccount,
    region: invoice.additionalData?.region,
    postalCode: invoice.additionalData?.postalCode
  }, context);
  
  result.derivedFields = {
    taxCode: taxInfo.taxCode,
    taxCodeConfidence: taxInfo.taxCodeConfidence,
    taxCodeSource: taxInfo.taxCodeSource,
    taxJurisdiction: taxInfo.taxJurisdiction,
    taxJurisdictionConfidence: taxInfo.taxJurisdictionConfidence,
    isPOBased: taxInfo.isPOBased
  };
  
  // Validate tax amount if provided
  if (invoice.taxAmount !== undefined && taxInfo.taxCode) {
    const taxValidation = await taxValidators.validateTaxAmount({
      companyCode: invoice.companyCode,
      taxCode: taxInfo.taxCode,
      currency: invoice.currency,
      netAmount: invoice.netAmount || (invoice.grossAmount - invoice.taxAmount),
      invoiceTaxAmount: invoice.taxAmount,
      jurisdictionCode: taxInfo.taxJurisdiction
    });
    
    result.validations.taxAmount = taxValidation;
    
    if (!taxValidation.isValid) {
      result.issues.push(taxValidation.message);
    }
    
    result.derivedFields.calculatedTaxAmount = taxValidation.metadata?.expectedTax;
    result.derivedFields.taxVariance = taxValidation.metadata?.percentDiff;
  }
  
  return result;
}

/**
 * Finalize processing result and determine status.
 * @param {InvoiceProcessingResult} result - Processing result
 * @param {Object} thresholds - Confidence thresholds
 * @returns {InvoiceProcessingResult}
 */
function finalizeResult(result, thresholds) {
  // Calculate overall confidence
  const confidences = [];
  
  if (result.validations.vendor?.vendorIdentification?.confidence) {
    confidences.push(result.validations.vendor.vendorIdentification.confidence);
  }
  if (result.validations.lineItemMatch?.overallConfidence) {
    confidences.push(result.validations.lineItemMatch.overallConfidence);
  }
  if (result.derivedFields.tax?.taxCodeConfidence) {
    confidences.push(result.derivedFields.tax.taxCodeConfidence);
  }
  
  result.overallConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  
  // Determine final status
  if (result.status !== 'REJECTED') {
    if (result.issues.length === 0 && result.overallConfidence >= thresholds.overall) {
      result.status = 'TOUCHLESS';
      result.readyForPosting = true;
    } else if (result.overallConfidence >= thresholds.overall * 0.7) {
      result.status = 'REVIEW_REQUIRED';
      result.readyForPosting = false;
    } else {
      result.status = 'MANUAL_PROCESSING';
      result.readyForPosting = false;
    }
  }
  
  // Add final recommendations
  if (result.status === 'TOUCHLESS') {
    result.recommendations.unshift('Invoice ready for automatic posting');
  } else if (result.status === 'REVIEW_REQUIRED') {
    result.recommendations.unshift('Invoice requires approval before posting');
  } else {
    result.recommendations.unshift('Invoice requires manual data entry');
  }
  
  return result;
}

/**
 * Quick check if invoice is eligible for touchless processing.
 * @param {InvoiceInput} invoice - Invoice data
 * @returns {Promise<{eligible: boolean, reasons: string[]}>}
 */
async function checkTouchlessEligibility(invoice) {
  const reasons = [];
  
  // Check required fields
  if (!invoice.vendorId && !invoice.supplierName) {
    reasons.push('No vendor identification available');
  }
  
  if (!invoice.companyCode) {
    reasons.push('Company code is required');
  }
  
  if (!invoice.grossAmount) {
    reasons.push('Invoice amount is required');
  }
  
  if (!invoice.invoiceDate) {
    reasons.push('Invoice date is required');
  }
  
  // Check if vendor is blocked
  if (invoice.vendorId) {
    const blockStatus = await supplierValidators.analyzeVendorBlocks(
      invoice.vendorId,
      invoice.companyCode
    );
    
    if (blockStatus.isBlocked) {
      reasons.push(`Vendor is blocked: ${blockStatus.blockTypes.join(', ')}`);
    }
  }
  
  // Non-PO invoices may require approval
  if (!invoice.poNumber) {
    reasons.push('Non-PO invoice requires approval workflow');
  }
  
  return {
    eligible: reasons.length === 0,
    reasons
  };
}

/**
 * Get processing summary for reporting.
 * @param {InvoiceProcessingResult} result - Processing result
 * @returns {Object} Summary for reporting
 */
function getProcessingSummary(result) {
  return {
    status: result.status,
    readyForPosting: result.readyForPosting,
    overallConfidence: Math.round(result.overallConfidence * 100),
    vendorId: result.derivedFields.vendor?.vendorId,
    invoiceType: result.derivedFields.invoiceType,
    matchType: result.derivedFields.matchType,
    issueCount: result.issues.length,
    topIssues: result.issues.slice(0, 3),
    primaryRecommendation: result.recommendations[0],
    riskLevel: result.riskAssessment?.riskLevel || 'LOW',
    derivedFieldCount: countDerivedFields(result.derivedFields)
  };
}

/**
 * Count non-null derived fields.
 * @param {Object} obj - Object to count
 * @returns {number}
 */
function countDerivedFields(obj) {
  let count = 0;
  for (const key in obj) {
    if (obj[key] !== null && obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        count += countDerivedFields(obj[key]);
      } else {
        count++;
      }
    }
  }
  return count;
}

module.exports = {
  processInvoice,
  checkTouchlessEligibility,
  getProcessingSummary,
  TOUCHLESS_THRESHOLDS,
  // Export sub-processors for testing/customization
  processVendor,
  assessRisk,
  processPOInvoice,
  processNonPOInvoice,
  processPayment,
  processTax
};
