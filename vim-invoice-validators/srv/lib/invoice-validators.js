// @ts-check
/**
 * @fileoverview Invoice validators for duplicate detection, document type determination,
 * account assignment auto-fill, historical PO spend tracking, and one-time vendor detection.
 * Provides high-confidence auto-derivations using available BAPIs.
 */

const cds = require('@sap/cds');
const { normalizeVendorNumberPadded, normalizePONumberPadded, normalizeAmount } = require('./utils/normalizers');
const { createValidationResult, combineScores } = require('./utils/confidence');
const cache = require('./cache');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 */

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}

// ============================================================================
// DUPLICATE INVOICE CHECK
// ============================================================================

/**
 * Duplicate check result.
 * @typedef {Object} DuplicateCheckResult
 * @property {boolean} isDuplicate - Whether a duplicate was found
 * @property {number} confidence - Confidence level (0-1)
 * @property {Object[]} matches - List of potential duplicates
 * @property {string} message - Description of result
 * @property {Object} checkedFields - Fields used for comparison
 */

/**
 * Check for duplicate invoices using SAP's standard 6-field comparison.
 * Fields checked: Vendor, Reference, Company Code, Currency, Gross Amount, Invoice Date
 * @param {Object} invoice - Invoice data to check
 * @param {string} invoice.vendorId - Vendor ID
 * @param {string} invoice.companyCode - Company code
 * @param {string} invoice.currency - Currency code
 * @param {number} invoice.grossAmount - Gross amount
 * @param {string|Date} invoice.invoiceDate - Invoice date
 * @param {string} [invoice.referenceNumber] - Invoice reference number
 * @param {Object} [options] - Check options
 * @param {number} [options.amountTolerance=0.01] - Amount tolerance (1%)
 * @param {number} [options.dateTolerance=0] - Date tolerance in days
 * @returns {Promise<DuplicateCheckResult>}
 */
async function checkDuplicateInvoice(invoice, options = {}) {
  const { amountTolerance = 0.01, dateTolerance = 0 } = options;
  
  const checkedFields = {
    vendorId: normalizeVendorNumberPadded(invoice.vendorId),
    companyCode: invoice.companyCode,
    currency: invoice.currency,
    grossAmount: normalizeAmount(invoice.grossAmount),
    invoiceDate: normalizeDate(invoice.invoiceDate),
    referenceNumber: invoice.referenceNumber || null
  };
  
  try {
    // Use the cache to check against recently processed invoices
    const cacheKey = `duplicatecheck:${checkedFields.vendorId}:${checkedFields.companyCode}`;
    const recentInvoices = cache.get(cacheKey) || [];
    
    const matches = [];
    
    for (const existing of recentInvoices) {
      const matchScore = calculateDuplicateScore(checkedFields, existing, {
        amountTolerance,
        dateTolerance
      });
      
      if (matchScore.score >= 0.8) {
        matches.push({
          ...existing,
          matchScore: matchScore.score,
          matchDetails: matchScore.details
        });
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);
    
    const isDuplicate = matches.length > 0 && matches[0].matchScore >= 0.95;
    const confidence = matches.length > 0 ? matches[0].matchScore : 0;
    
    return {
      isDuplicate,
      confidence,
      matches: matches.slice(0, 5), // Top 5 matches
      message: isDuplicate 
        ? `Potential duplicate found: ${matches[0].referenceNumber || 'Unknown ref'} from ${matches[0].invoiceDate}`
        : matches.length > 0
          ? `${matches.length} similar invoice(s) found, but below duplicate threshold`
          : 'No duplicate invoices found',
      checkedFields
    };
  } catch (error) {
    return {
      isDuplicate: false,
      confidence: 0,
      matches: [],
      message: `Error checking duplicates: ${error.message}`,
      checkedFields
    };
  }
}

/**
 * Calculate duplicate match score between two invoices.
 * @param {Object} invoice1 - First invoice
 * @param {Object} invoice2 - Second invoice
 * @param {Object} options - Matching options
 * @returns {{score: number, details: Object}}
 */
function calculateDuplicateScore(invoice1, invoice2, options) {
  const details = {};
  let totalScore = 0;
  let fieldCount = 0;
  
  // Vendor match (required - 25% weight)
  if (invoice1.vendorId === invoice2.vendorId) {
    details.vendorMatch = true;
    totalScore += 0.25;
  } else {
    details.vendorMatch = false;
  }
  fieldCount++;

  // Company code match (required - 15% weight)
  if (invoice1.companyCode === invoice2.companyCode) {
    details.companyCodeMatch = true;
    totalScore += 0.15;
  } else {
    details.companyCodeMatch = false;
  }
  fieldCount++;
  
  // Currency match (required - 10% weight)
  if (invoice1.currency === invoice2.currency) {
    details.currencyMatch = true;
    totalScore += 0.10;
  } else {
    details.currencyMatch = false;
  }
  fieldCount++;
  
  // Amount match with tolerance (20% weight)
  const amountDiff = Math.abs(invoice1.grossAmount - invoice2.grossAmount);
  const amountPctDiff = invoice2.grossAmount > 0 
    ? amountDiff / invoice2.grossAmount 
    : (amountDiff === 0 ? 0 : 1);
  
  if (amountPctDiff <= options.amountTolerance) {
    details.amountMatch = true;
    details.amountDifference = amountPctDiff;
    totalScore += 0.20;
  } else {
    details.amountMatch = false;
    details.amountDifference = amountPctDiff;
  }
  fieldCount++;
  
  // Date match with tolerance (15% weight)
  const date1 = new Date(invoice1.invoiceDate);
  const date2 = new Date(invoice2.invoiceDate);
  const daysDiff = Math.abs(Math.floor((date1 - date2) / (1000 * 60 * 60 * 24)));
  
  if (daysDiff <= options.dateTolerance) {
    details.dateMatch = true;
    details.daysDifference = daysDiff;
    totalScore += 0.15;
  } else {
    details.dateMatch = false;
    details.daysDifference = daysDiff;
  }
  fieldCount++;

  // Reference number match (strongest indicator - 15% weight)
  if (invoice1.referenceNumber && invoice2.referenceNumber) {
    const ref1 = invoice1.referenceNumber.trim().toUpperCase();
    const ref2 = invoice2.referenceNumber.trim().toUpperCase();
    
    if (ref1 === ref2) {
      details.referenceMatch = 'exact';
      totalScore += 0.15;
    } else if (ref1.includes(ref2) || ref2.includes(ref1)) {
      details.referenceMatch = 'partial';
      totalScore += 0.10;
    } else {
      details.referenceMatch = false;
    }
  } else {
    details.referenceMatch = 'not_available';
  }
  fieldCount++;
  
  return {
    score: totalScore,
    details
  };
}

/**
 * Register an invoice for duplicate checking cache.
 * @param {Object} invoice - Invoice to register
 */
function registerInvoiceForDuplicateCheck(invoice) {
  const normalized = {
    vendorId: normalizeVendorNumberPadded(invoice.vendorId),
    companyCode: invoice.companyCode,
    currency: invoice.currency,
    grossAmount: normalizeAmount(invoice.grossAmount),
    invoiceDate: normalizeDate(invoice.invoiceDate),
    referenceNumber: invoice.referenceNumber || null,
    documentNumber: invoice.documentNumber || null,
    registeredAt: new Date().toISOString()
  };
  
  const cacheKey = `duplicatecheck:${normalized.vendorId}:${normalized.companyCode}`;
  const existing = cache.get(cacheKey) || [];
  
  // Keep last 100 invoices per vendor/company combo
  existing.unshift(normalized);
  if (existing.length > 100) existing.pop();
  
  cache.set(cacheKey, existing, { ttl: 30 * 24 * 60 * 60 * 1000 }); // 30 days
}


// ============================================================================
// CREDIT MEMO (KG) vs VENDOR INVOICE (KR) DETECTION
// ============================================================================

/**
 * Document type determination result.
 * @typedef {Object} DocumentTypeDetermination
 * @property {string} documentType - Determined document type (KR=Invoice, KG=Credit Memo)
 * @property {string} description - Human-readable description
 * @property {number} confidence - Confidence in determination (0-1)
 * @property {string[]} indicators - List of indicators used
 * @property {Object} analysis - Detailed analysis
 */

/**
 * Determine if document is Credit Memo (KG) or Vendor Invoice (KR).
 * Uses multiple indicators: amount sign, extracted text patterns, and context.
 * @param {Object} invoice - Invoice data
 * @param {number} invoice.grossAmount - Gross amount (negative typically = credit)
 * @param {string} [invoice.documentTypeText] - Extracted document type text
 * @param {string} [invoice.headerText] - Header text from document
 * @param {boolean} [invoice.isReturn] - Whether this is a return/refund
 * @param {string} [invoice.poNumber] - PO number if available
 * @returns {Promise<DocumentTypeDetermination>}
 */
async function determineDocumentType(invoice) {
  const indicators = [];
  const analysis = {
    amountSign: null,
    textPatterns: [],
    contextClues: []
  };
  
  let creditScore = 0;
  let invoiceScore = 0;
  
  // Indicator 1: Amount sign (strongest indicator)
  const amount = normalizeAmount(invoice.grossAmount);
  if (amount < 0) {
    indicators.push('NEGATIVE_AMOUNT');
    analysis.amountSign = 'negative';
    creditScore += 0.4;
  } else if (amount > 0) {
    indicators.push('POSITIVE_AMOUNT');
    analysis.amountSign = 'positive';
    invoiceScore += 0.4;
  }

  // Indicator 2: Document type text from extraction
  if (invoice.documentTypeText) {
    const docText = invoice.documentTypeText.toUpperCase();
    
    const creditPatterns = [
      'CREDIT', 'CREDIT MEMO', 'CREDIT NOTE', 'GUTSCHRIFT', 
      'AVISO', 'CN', 'REFUND', 'RETURN', 'ADJUSTMENT'
    ];
    const invoicePatterns = [
      'INVOICE', 'RECHNUNG', 'FACTURA', 'BILL', 'INV', 
      'DEBIT', 'DEBIT MEMO', 'DEBIT NOTE'
    ];
    
    for (const pattern of creditPatterns) {
      if (docText.includes(pattern)) {
        indicators.push(`TEXT_PATTERN:${pattern}`);
        analysis.textPatterns.push({ pattern, type: 'credit' });
        creditScore += 0.2;
        break;
      }
    }
    
    for (const pattern of invoicePatterns) {
      if (docText.includes(pattern)) {
        indicators.push(`TEXT_PATTERN:${pattern}`);
        analysis.textPatterns.push({ pattern, type: 'invoice' });
        invoiceScore += 0.2;
        break;
      }
    }
  }
  
  // Indicator 3: Header text patterns
  if (invoice.headerText) {
    const headerUpper = invoice.headerText.toUpperCase();
    
    if (headerUpper.includes('CREDIT') || headerUpper.includes('RETURN') || 
        headerUpper.includes('REFUND') || headerUpper.includes('REVERSAL')) {
      indicators.push('HEADER_CREDIT_INDICATOR');
      analysis.contextClues.push('Header contains credit-related keywords');
      creditScore += 0.15;
    }
    
    if (headerUpper.includes('PAYMENT DUE') || headerUpper.includes('AMOUNT DUE') ||
        headerUpper.includes('PLEASE PAY') || headerUpper.includes('REMIT')) {
      indicators.push('HEADER_PAYMENT_REQUEST');
      analysis.contextClues.push('Header contains payment request language');
      invoiceScore += 0.15;
    }
  }

  // Indicator 4: Explicit return flag
  if (invoice.isReturn === true) {
    indicators.push('EXPLICIT_RETURN_FLAG');
    analysis.contextClues.push('Document flagged as return');
    creditScore += 0.25;
  } else if (invoice.isReturn === false) {
    indicators.push('EXPLICIT_NON_RETURN');
    invoiceScore += 0.1;
  }
  
  // Indicator 5: Context from PO (returns against PO are often credits)
  if (invoice.poNumber && amount < 0) {
    indicators.push('NEGATIVE_PO_INVOICE');
    analysis.contextClues.push('Negative amount against PO suggests credit memo');
    creditScore += 0.1;
  }
  
  // Determine final type
  const totalScore = creditScore + invoiceScore;
  const isCreditMemo = creditScore > invoiceScore;
  const confidence = totalScore > 0 
    ? Math.abs(creditScore - invoiceScore) / totalScore + 0.5
    : 0.5;
  
  return {
    documentType: isCreditMemo ? 'KG' : 'KR',
    description: isCreditMemo ? 'Credit Memo' : 'Vendor Invoice',
    confidence: Math.min(1, confidence),
    indicators,
    analysis: {
      ...analysis,
      creditScore,
      invoiceScore,
      determination: isCreditMemo ? 'credit_memo' : 'vendor_invoice'
    }
  };
}

// ============================================================================
// ACCOUNT ASSIGNMENT AUTO-FILL
// ============================================================================

/**
 * Account assignment derivation result.
 * @typedef {Object} AccountAssignmentResult
 * @property {Object} costCenter - Cost center derivation
 * @property {Object} wbsElement - WBS element derivation
 * @property {Object} assetNumber - Asset number derivation
 * @property {Object} profitCenter - Profit center derivation
 * @property {Object} internalOrder - Internal order derivation
 * @property {number} overallConfidence - Overall confidence
 * @property {string[]} sources - Data sources used
 */

/**
 * Derive account assignment fields from PO account assignment data.
 * Uses BAPI_PO_GETDETAIL1 with ACCOUNT_ASSIGNMENT flag.
 * @param {string} poNumber - Purchase order number
 * @param {string} [poItem] - Specific PO line item (optional)
 * @returns {Promise<AccountAssignmentResult>}
 */
async function deriveAccountAssignmentFromPO(poNumber, poItem) {
  const result = {
    costCenter: { value: null, confidence: 0, source: null },
    wbsElement: { value: null, confidence: 0, source: null },
    assetNumber: { value: null, confidence: 0, source: null },
    profitCenter: { value: null, confidence: 0, source: null },
    internalOrder: { value: null, confidence: 0, source: null },
    overallConfidence: 0,
    sources: []
  };
  
  try {
    const ecc = await getEccService();
    const paddedPO = normalizePONumberPadded(poNumber);
    
    // Fetch PO with account assignment data
    const poDetail = await ecc.getPODetail1({
      PURCHASEORDER: paddedPO,
      ACCOUNT_ASSIGNMENT: 'X'
    });
    
    if (!poDetail || poDetail.RETURN?.some(r => r.TYPE === 'E')) {
      return result;
    }
    
    // Get account assignment entries
    const accountAssignments = poDetail.POACCOUNT || [];
    
    if (accountAssignments.length === 0) {
      return result;
    }
    
    // Filter by PO item if specified
    const relevantAssignments = poItem 
      ? accountAssignments.filter(a => a.PO_ITEM === poItem.toString().padStart(5, '0'))
      : accountAssignments;
    
    if (relevantAssignments.length === 0) {
      return result;
    }

    // Use first assignment (or most common if multiple)
    const primaryAssignment = relevantAssignments[0];
    result.sources.push('PO_ACCOUNT_ASSIGNMENT');
    
    // Cost Center (KOSTL/COSTCENTER)
    if (primaryAssignment.COSTCENTER) {
      result.costCenter = {
        value: primaryAssignment.COSTCENTER,
        confidence: 1.0,
        source: 'PO_ACCOUNT_ASSIGNMENT'
      };
    }
    
    // WBS Element (PS_PSP_PNR/WBS_ELEMENT)
    if (primaryAssignment.WBS_ELEMENT) {
      result.wbsElement = {
        value: primaryAssignment.WBS_ELEMENT,
        confidence: 1.0,
        source: 'PO_ACCOUNT_ASSIGNMENT'
      };
    }
    
    // Asset Number (ANLN1/ASSET_NO)
    if (primaryAssignment.ASSET_NO) {
      result.assetNumber = {
        value: primaryAssignment.ASSET_NO,
        subNumber: primaryAssignment.SUB_NUMBER || '0000',
        confidence: 1.0,
        source: 'PO_ACCOUNT_ASSIGNMENT'
      };
    }
    
    // Profit Center (PRCTR/PROFIT_CTR)
    if (primaryAssignment.PROFIT_CTR) {
      result.profitCenter = {
        value: primaryAssignment.PROFIT_CTR,
        confidence: 1.0,
        source: 'PO_ACCOUNT_ASSIGNMENT'
      };
    }
    
    // Internal Order (AUFNR/ORDERID)
    if (primaryAssignment.ORDERID) {
      result.internalOrder = {
        value: primaryAssignment.ORDERID,
        confidence: 1.0,
        source: 'PO_ACCOUNT_ASSIGNMENT'
      };
    }
    
    // Calculate overall confidence
    const derivedFields = [
      result.costCenter, result.wbsElement, result.assetNumber,
      result.profitCenter, result.internalOrder
    ].filter(f => f.value);
    
    result.overallConfidence = derivedFields.length > 0
      ? derivedFields.reduce((sum, f) => sum + f.confidence, 0) / derivedFields.length
      : 0;
    
    return result;
  } catch (error) {
    console.error('Error deriving account assignment from PO:', error);
    return result;
  }
}


/**
 * Derive profit center from cost center using cost center master.
 * @param {string} costCenter - Cost center ID
 * @param {string} controllingArea - Controlling area
 * @returns {Promise<{value: string|null, confidence: number}>}
 */
async function deriveProfitCenterFromCostCenter(costCenter, controllingArea) {
  try {
    const ecc = await getEccService();
    
    // Get cost center list with profit center assignment
    const result = await ecc.getCostCenters({
      CONTROLLINGAREA: controllingArea,
      COSTCENTER: costCenter
    });
    
    if (!result || !result.COSTCENTER_LIST || result.COSTCENTER_LIST.length === 0) {
      return { value: null, confidence: 0 };
    }
    
    // Cost center master has PRCTR field - need to fetch detail
    // For now, return the cost center and use profit center list separately
    const ccData = result.COSTCENTER_LIST[0];
    
    // Try to get profit center from profit center list
    const pcResult = await ecc.getProfitCenterList({
      CONTROLLINGAREA: controllingArea
    });
    
    if (pcResult && pcResult.PROFITCENTER_LIST) {
      // Match profit center to cost center pattern
      // Often profit centers follow naming convention similar to cost centers
      const matchingPC = pcResult.PROFITCENTER_LIST.find(
        pc => pc.PROFIT_CTR === costCenter || 
              pc.PCTR_NAME?.includes(ccData.COCNTR_TXT)
      );
      
      if (matchingPC) {
        return {
          value: matchingPC.PROFIT_CTR,
          confidence: 0.8
        };
      }
    }
    
    return { value: null, confidence: 0 };
  } catch (error) {
    console.error('Error deriving profit center:', error);
    return { value: null, confidence: 0 };
  }
}


/**
 * Search and validate internal order exists.
 * @param {string} orderId - Internal order ID
 * @param {string} controllingArea - Controlling area
 * @returns {Promise<ValidationResult>}
 */
async function validateInternalOrder(orderId, controllingArea) {
  try {
    const ecc = await getEccService();
    
    const result = await ecc.getInternalOrders({
      CONTROLLING_AREA: controllingArea,
      ORDER: orderId
    });
    
    if (!result || !result.ORDER_LIST || result.ORDER_LIST.length === 0) {
      return createValidationResult(false, 0, 'account', {
        message: `Internal order ${orderId} not found`
      });
    }
    
    const order = result.ORDER_LIST[0];
    
    return createValidationResult(true, 1.0, 'account', {
      derivedValue: order.ORDER,
      message: `Internal order ${order.ORDER} validated`,
      metadata: {
        orderName: order.ORDER_NAME,
        orderType: order.ORDER_TYPE
      }
    });
  } catch (error) {
    return createValidationResult(false, 0, 'account', {
      message: `Error validating internal order: ${error.message}`
    });
  }
}

// ============================================================================
// BASELINE DATE AND DUE DATE CALCULATION
// ============================================================================

/**
 * Payment date calculation result.
 * @typedef {Object} PaymentDateResult
 * @property {Date} baselineDate - Baseline date for payment
 * @property {Date} dueDate - Net due date
 * @property {Date} [discount1Date] - First discount due date
 * @property {number} [discount1Percent] - First discount percentage
 * @property {Date} [discount2Date] - Second discount due date
 * @property {number} [discount2Percent] - Second discount percentage
 * @property {string} paymentTermsKey - Payment terms used
 * @property {string} source - Source of payment terms
 */

/**
 * Calculate baseline date and due dates from payment terms.
 * Baseline date rules:
 * - If invoice date provided, use invoice date as baseline
 * - If posting date is later, may use posting date depending on terms config
 * @param {Object} params - Calculation parameters
 * @param {string|Date} params.invoiceDate - Invoice date
 * @param {string|Date} [params.postingDate] - Posting date (defaults to today)
 * @param {Object} params.paymentTerms - Payment terms configuration
 * @param {number} params.paymentTerms.netDays - Net payment days
 * @param {number} [params.paymentTerms.discount1Days] - Days for first discount
 * @param {number} [params.paymentTerms.discount1Percent] - First discount percentage
 * @param {number} [params.paymentTerms.discount2Days] - Days for second discount
 * @param {number} [params.paymentTerms.discount2Percent] - Second discount percentage
 * @param {string} [params.baselineDateRule='INVOICE_DATE'] - How to determine baseline
 * @returns {PaymentDateResult}
 */
function calculatePaymentDates(params) {
  const { 
    invoiceDate, 
    postingDate, 
    paymentTerms,
    baselineDateRule = 'INVOICE_DATE'
  } = params;
  
  const invDate = new Date(invoiceDate);
  const postDate = postingDate ? new Date(postingDate) : new Date();
  
  // Determine baseline date based on rule
  let baselineDate;
  switch (baselineDateRule) {
    case 'POSTING_DATE':
      baselineDate = postDate;
      break;
    case 'ENTRY_DATE':
      baselineDate = new Date(); // Current date
      break;
    case 'LATER_OF':
      baselineDate = invDate > postDate ? invDate : postDate;
      break;
    case 'INVOICE_DATE':
    default:
      baselineDate = invDate;
  }
  
  const result = {
    baselineDate,
    dueDate: addDays(baselineDate, paymentTerms.netDays || 30),
    paymentTermsKey: paymentTerms.paymentTermsKey || 'UNKNOWN',
    source: 'CALCULATED'
  };

  // Calculate discount dates
  if (paymentTerms.discount1Days && paymentTerms.discount1Percent) {
    result.discount1Date = addDays(baselineDate, paymentTerms.discount1Days);
    result.discount1Percent = paymentTerms.discount1Percent;
  }
  
  if (paymentTerms.discount2Days && paymentTerms.discount2Percent) {
    result.discount2Date = addDays(baselineDate, paymentTerms.discount2Days);
    result.discount2Percent = paymentTerms.discount2Percent;
  }
  
  return result;
}

/**
 * Add days to a date.
 * @param {Date} date - Base date
 * @param {number} days - Days to add
 * @returns {Date}
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// WITHHOLDING TAX DERIVATION
// ============================================================================

/**
 * Withholding tax derivation result.
 * @typedef {Object} WithholdingTaxResult
 * @property {boolean} hasWithholdingTax - Whether vendor has withholding tax
 * @property {Object[]} withholdingTaxCodes - List of applicable WT codes
 * @property {number} confidence - Confidence in derivation
 * @property {string} source - Data source
 */

/**
 * Derive withholding tax information from vendor master.
 * Uses vendor master withholding tax data (LFBW table equivalent).
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<WithholdingTaxResult>}
 */
async function deriveWithholdingTax(vendorId, companyCode) {
  try {
    const ecc = await getEccService();
    const paddedVendor = normalizeVendorNumberPadded(vendorId);
    
    const result = await ecc.getVendorDetail({
      VENDORNO: paddedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return {
        hasWithholdingTax: false,
        withholdingTaxCodes: [],
        confidence: 0,
        source: 'VENDOR_NOT_FOUND'
      };
    }
    
    // Check for withholding tax indicator in general detail
    // Note: Full WT data would require LFBW table access
    // BAPI_VENDOR_GETDETAIL returns limited WT info
    const generalDetail = result.GENERALDETAIL || {};
    const companyDetail = result.COMPANYDETAIL || {};
    
    // Check for WT exemption or liability flags
    const withholdingTaxCodes = [];
    
    // If vendor has tax numbers, they may be subject to WT
    const hasTaxNumber = !!(generalDetail.TAX_NO_1 || generalDetail.TAX_NO_2);
    
    // This is a simplified check - full implementation would query LFBW
    // and T059Z (WT types) tables
    const hasWithholdingTax = hasTaxNumber && companyCode;
    
    return {
      hasWithholdingTax,
      withholdingTaxCodes,
      confidence: hasTaxNumber ? 0.6 : 0.3, // Lower confidence without full LFBW access
      source: 'VENDOR_MASTER',
      vendorTaxInfo: {
        taxNumber1: generalDetail.TAX_NO_1,
        taxNumber2: generalDetail.TAX_NO_2,
        country: generalDetail.COUNTRY
      }
    };
  } catch (error) {
    console.error('Error deriving withholding tax:', error);
    return {
      hasWithholdingTax: false,
      withholdingTaxCodes: [],
      confidence: 0,
      source: 'ERROR'
    };
  }
}


// ============================================================================
// ONE-TIME VENDOR DETECTION
// ============================================================================

/**
 * One-time vendor check result.
 * @typedef {Object} OneTimeVendorResult
 * @property {boolean} isOneTimeVendor - Whether vendor is a one-time vendor (CPD)
 * @property {boolean} requiresCPDData - Whether CPD master data is required
 * @property {string[]} requiredFields - List of required CPD fields
 * @property {number} confidence - Confidence in determination
 */

/**
 * Check if vendor is a one-time vendor (CPD - Conto Pro Diverse).
 * One-time vendors require additional master data at posting time.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<OneTimeVendorResult>}
 */
async function checkOneTimeVendor(vendorId, companyCode) {
  try {
    const ecc = await getEccService();
    const paddedVendor = normalizeVendorNumberPadded(vendorId);
    
    const result = await ecc.getVendorDetail({
      VENDORNO: paddedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return {
        isOneTimeVendor: false,
        requiresCPDData: false,
        requiredFields: [],
        confidence: 0
      };
    }
    
    // Check for CPD (one-time) indicator
    // In vendor master: XCPDK flag in LFA1
    // Note: BAPI returns limited info, may need to check account group
    const generalDetail = result.GENERALDETAIL || {};
    
    // One-time vendors often have specific account groups (e.g., CPD, OT)
    // and may have limited master data
    const hasMinimalData = !generalDetail.NAME_2 && 
                          !generalDetail.STREET && 
                          !generalDetail.CITY;
    
    // Check if vendor number is in CPD range (often high numbers)
    const vendorNum = parseInt(vendorId.replace(/^0+/, ''), 10);
    const isInCPDRange = vendorNum >= 99990000; // Common CPD range

    const isOneTimeVendor = hasMinimalData || isInCPDRange;
    
    // Required fields for CPD posting
    const requiredFields = isOneTimeVendor ? [
      'NAME', 'STREET', 'CITY', 'POSTAL_CODE', 'COUNTRY',
      'BANK_ACCOUNT', 'BANK_KEY'
    ] : [];
    
    return {
      isOneTimeVendor,
      requiresCPDData: isOneTimeVendor,
      requiredFields,
      confidence: isInCPDRange ? 0.95 : (hasMinimalData ? 0.7 : 0.9),
      vendorInfo: {
        name: generalDetail.NAME,
        hasAddress: !!(generalDetail.STREET && generalDetail.CITY),
        vendorNumber: paddedVendor
      }
    };
  } catch (error) {
    console.error('Error checking one-time vendor:', error);
    return {
      isOneTimeVendor: false,
      requiresCPDData: false,
      requiredFields: [],
      confidence: 0
    };
  }
}

// ============================================================================
// HISTORICAL PO SPEND TRACKING
// ============================================================================

/**
 * PO spend tracking result.
 * @typedef {Object} POSpendResult
 * @property {number} poTotalValue - Total PO value
 * @property {number} invoicedAmount - Amount already invoiced
 * @property {number} remainingAmount - Remaining amount available
 * @property {number} percentInvoiced - Percentage already invoiced
 * @property {boolean} hasOverbilling - Whether overbilling detected
 * @property {number} overbillingAmount - Amount over PO value
 * @property {Object[]} invoiceHistory - List of historical invoices
 * @property {string} currency - Currency
 */

/**
 * Get historical PO spend and check for potential overbilling.
 * Uses BAPI_PO_GETDETAIL1 with HISTORY flag to get invoice history.
 * @param {string} poNumber - Purchase order number
 * @param {string} [poItem] - Specific line item (optional)
 * @param {number} [newInvoiceAmount] - New invoice amount to check
 * @returns {Promise<POSpendResult>}
 */
async function getHistoricalPOSpend(poNumber, poItem, newInvoiceAmount = 0) {
  try {
    const ecc = await getEccService();
    const paddedPO = normalizePONumberPadded(poNumber);
    
    // Fetch PO with history data
    const poDetail = await ecc.getPODetail1({
      PURCHASEORDER: paddedPO,
      HISTORY: 'X',
      ITEMS: 'X'
    });
    
    if (!poDetail || poDetail.RETURN?.some(r => r.TYPE === 'E')) {
      return {
        poTotalValue: 0,
        invoicedAmount: 0,
        remainingAmount: 0,
        percentInvoiced: 0,
        hasOverbilling: false,
        overbillingAmount: 0,
        invoiceHistory: [],
        currency: ''
      };
    }
    
    const items = poDetail.POITEM || [];
    const history = poDetail.POHISTORY || [];
    const historyTotals = poDetail.POHISTORY_TOTALS || [];
    
    // Filter by item if specified
    const relevantItems = poItem 
      ? items.filter(i => i.PO_ITEM === poItem.toString().padStart(5, '0'))
      : items;
    
    // Calculate PO total value
    let poTotalValue = 0;
    for (const item of relevantItems) {
      const qty = parseFloat(item.QUANTITY) || parseFloat(item.PO_QUANTITY) || 0;
      const price = parseFloat(item.NET_PRICE) || 0;
      const priceUnit = parseFloat(item.PRICE_UNIT) || 1;
      poTotalValue += (qty * price) / priceUnit;
    }

    // Get invoiced amounts from history
    // History record types: E = Invoice, Q = GR
    const invoiceHistory = [];
    let invoicedAmount = 0;
    
    // Use history totals if available (more reliable)
    if (historyTotals.length > 0) {
      const relevantTotals = poItem
        ? historyTotals.filter(t => t.PO_ITEM === poItem.toString().padStart(5, '0'))
        : historyTotals;
      
      for (const total of relevantTotals) {
        // IV_QTY = Invoice quantity, IV_VAL = Invoice value
        invoicedAmount += parseFloat(total.IV_VAL) || 0;
      }
    } else {
      // Fall back to detailed history
      const relevantHistory = poItem
        ? history.filter(h => h.PO_ITEM === poItem.toString().padStart(5, '0'))
        : history;
      
      for (const hist of relevantHistory) {
        // Check for invoice records (DOC_TYPE or movement type indicates invoice)
        if (hist.DOC_TYPE === 'RE' || hist.MOVE_TYPE === '101') {
          const value = parseFloat(hist.NET_VALUE) || 0;
          invoicedAmount += value;
          
          invoiceHistory.push({
            documentNumber: hist.REF_DOC,
            documentDate: hist.DOC_DATE,
            fiscalYear: hist.FIS_YEAR,
            amount: value,
            quantity: parseFloat(hist.QUANTITY) || 0
          });
        }
      }
    }
    
    // Calculate remaining and overbilling
    const projectedTotal = invoicedAmount + newInvoiceAmount;
    const remainingAmount = Math.max(0, poTotalValue - invoicedAmount);
    const percentInvoiced = poTotalValue > 0 
      ? (invoicedAmount / poTotalValue) * 100 
      : 0;
    
    const hasOverbilling = projectedTotal > poTotalValue;
    const overbillingAmount = hasOverbilling 
      ? projectedTotal - poTotalValue 
      : 0;

    return {
      poTotalValue,
      invoicedAmount,
      remainingAmount,
      percentInvoiced: Math.round(percentInvoiced * 100) / 100,
      hasOverbilling,
      overbillingAmount,
      invoiceHistory,
      currency: poDetail.POHEADER?.CURRENCY || '',
      newInvoiceAmount,
      projectedTotal,
      analysis: {
        itemCount: relevantItems.length,
        historyRecordCount: invoiceHistory.length,
        dataSource: historyTotals.length > 0 ? 'POHISTORY_TOTALS' : 'POHISTORY'
      }
    };
  } catch (error) {
    console.error('Error getting PO spend history:', error);
    return {
      poTotalValue: 0,
      invoicedAmount: 0,
      remainingAmount: 0,
      percentInvoiced: 0,
      hasOverbilling: false,
      overbillingAmount: 0,
      invoiceHistory: [],
      currency: '',
      error: error.message
    };
  }
}

/**
 * Validate invoice amount against remaining PO budget.
 * @param {string} poNumber - PO number
 * @param {number} invoiceAmount - Amount to validate
 * @param {Object} [options] - Validation options
 * @param {number} [options.tolerancePercent=5] - Tolerance percentage
 * @returns {Promise<ValidationResult>}
 */
async function validateAgainstPOBudget(poNumber, invoiceAmount, options = {}) {
  const { tolerancePercent = 5 } = options;
  
  const spend = await getHistoricalPOSpend(poNumber, null, invoiceAmount);
  
  if (spend.error) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `Error checking PO budget: ${spend.error}`
    });
  }

  // Calculate tolerance
  const tolerance = spend.poTotalValue * (tolerancePercent / 100);
  const maxAllowed = spend.poTotalValue + tolerance;
  
  if (spend.projectedTotal <= spend.poTotalValue) {
    return createValidationResult(true, 1.0, 'purchaseOrder', {
      message: `Invoice within PO budget. Remaining: ${spend.remainingAmount.toFixed(2)} ${spend.currency}`,
      metadata: spend
    });
  }
  
  if (spend.projectedTotal <= maxAllowed) {
    return createValidationResult(true, 0.7, 'purchaseOrder', {
      message: `Invoice exceeds PO value by ${spend.overbillingAmount.toFixed(2)} but within ${tolerancePercent}% tolerance`,
      metadata: spend
    });
  }
  
  return createValidationResult(false, 0.3, 'purchaseOrder', {
    message: `Overbilling detected: ${spend.overbillingAmount.toFixed(2)} ${spend.currency} over PO budget`,
    metadata: spend
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize date to YYYY-MM-DD string format.
 * @param {string|Date} date - Date to normalize
 * @returns {string}
 */
function normalizeDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}


/**
 * Comprehensive invoice auto-fill using all available derivations.
 * Chains multiple BAPI calls to derive maximum fields.
 * @param {Object} invoice - Invoice data with available fields
 * @param {string} [invoice.poNumber] - PO number
 * @param {string} [invoice.poItem] - PO line item
 * @param {string} [invoice.vendorId] - Vendor ID
 * @param {string} invoice.companyCode - Company code
 * @param {string} [invoice.controllingArea] - Controlling area (defaults to company code)
 * @returns {Promise<Object>} All derived fields with confidence scores
 */
async function autoFillInvoiceFields(invoice) {
  const derivedFields = {
    accountAssignment: null,
    paymentDates: null,
    withholdingTax: null,
    documentType: null,
    oneTimeVendor: null,
    poSpend: null,
    duplicateCheck: null
  };
  
  const controllingArea = invoice.controllingArea || invoice.companyCode;
  
  // 1. Derive account assignment from PO
  if (invoice.poNumber) {
    derivedFields.accountAssignment = await deriveAccountAssignmentFromPO(
      invoice.poNumber, 
      invoice.poItem
    );
    
    // If we got cost center but no profit center, try to derive it
    if (derivedFields.accountAssignment.costCenter.value && 
        !derivedFields.accountAssignment.profitCenter.value) {
      const pc = await deriveProfitCenterFromCostCenter(
        derivedFields.accountAssignment.costCenter.value,
        controllingArea
      );
      if (pc.value) {
        derivedFields.accountAssignment.profitCenter = {
          value: pc.value,
          confidence: pc.confidence,
          source: 'DERIVED_FROM_COST_CENTER'
        };
      }
    }
    
    // Get PO spend history
    derivedFields.poSpend = await getHistoricalPOSpend(
      invoice.poNumber,
      invoice.poItem,
      invoice.grossAmount
    );
  }

  // 2. Check one-time vendor
  if (invoice.vendorId) {
    derivedFields.oneTimeVendor = await checkOneTimeVendor(
      invoice.vendorId,
      invoice.companyCode
    );
    
    // 3. Derive withholding tax
    derivedFields.withholdingTax = await deriveWithholdingTax(
      invoice.vendorId,
      invoice.companyCode
    );
  }
  
  // 4. Determine document type
  derivedFields.documentType = await determineDocumentType(invoice);
  
  // 5. Check for duplicates
  if (invoice.vendorId && invoice.grossAmount && invoice.invoiceDate) {
    derivedFields.duplicateCheck = await checkDuplicateInvoice(invoice);
  }
  
  // Calculate overall fill rate
  const fillableFields = [
    'costCenter', 'wbsElement', 'assetNumber', 'profitCenter', 'internalOrder'
  ];
  
  const filledCount = fillableFields.filter(f => 
    derivedFields.accountAssignment?.[f]?.value
  ).length;
  
  derivedFields.summary = {
    fillRate: filledCount / fillableFields.length,
    filledFields: filledCount,
    totalFields: fillableFields.length,
    hasPOData: !!invoice.poNumber,
    hasVendorData: !!invoice.vendorId,
    isOneTimeVendor: derivedFields.oneTimeVendor?.isOneTimeVendor || false,
    isDuplicate: derivedFields.duplicateCheck?.isDuplicate || false,
    hasOverbilling: derivedFields.poSpend?.hasOverbilling || false,
    documentType: derivedFields.documentType?.documentType
  };
  
  return derivedFields;
}


// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // Duplicate Invoice Check
  checkDuplicateInvoice,
  registerInvoiceForDuplicateCheck,
  calculateDuplicateScore,
  
  // Document Type Determination
  determineDocumentType,
  
  // Account Assignment Auto-fill
  deriveAccountAssignmentFromPO,
  deriveProfitCenterFromCostCenter,
  validateInternalOrder,
  
  // Payment Date Calculations
  calculatePaymentDates,
  
  // Withholding Tax
  deriveWithholdingTax,
  
  // One-time Vendor
  checkOneTimeVendor,
  
  // Historical PO Spend
  getHistoricalPOSpend,
  validateAgainstPOBudget,
  
  // Comprehensive Auto-fill
  autoFillInvoiceFields,
  
  // Utility
  normalizeDate,
  addDays
};
