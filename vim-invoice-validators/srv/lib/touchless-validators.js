// @ts-check
/**
 * @fileoverview Touchless automation validators for invoice processing.
 * Provides 3-way matching, tolerance checks, payment block determination,
 * workflow routing, and posting simulation.
 * 
 * Data Flow:
 * - Fetches master data from ECC (PO, GR, Vendor)
 * - Applies deterministic rules to invoice input
 * - Returns decisions with 100% confidence (calculation-based)
 */

const cds = require('@sap/cds');
const { normalizeVendorNumberPadded, normalizePONumberPadded, normalizeAmount } = require('./utils/normalizers');

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}

// ============================================================================
// DEFAULT TOLERANCES (Can be overridden by caller)
// ============================================================================

const DEFAULT_TOLERANCES = {
  // Price tolerances
  priceVariancePercent: 5,          // 5% price variance allowed
  priceVarianceAbsolute: 10,        // $10 absolute variance allowed
  
  // Quantity tolerances
  quantityVariancePercent: 3,       // 3% quantity variance allowed
  quantityVarianceAbsolute: 1,      // 1 unit absolute variance allowed
  
  // Amount tolerances
  amountVariancePercent: 2,         // 2% total amount variance
  amountVarianceAbsolute: 100,      // $100 absolute variance
  
  // Tax tolerance
  taxVarianceAbsolute: 0.01,        // $0.01 tax rounding tolerance
  
  // Small amount threshold (auto-approve)
  smallAmountThreshold: 50          // Auto-approve variances under $50
};

// ============================================================================
// 3-WAY MATCH
// ============================================================================

/**
 * 3-Way match result for a line item.
 * @typedef {Object} ThreeWayMatchResult
 * @property {string} status - FULL_MATCH, TOLERANCE_MATCH, PRICE_VARIANCE, QUANTITY_VARIANCE, NO_GR, NO_PO
 * @property {boolean} canAutoPost - Whether line can be auto-posted
 * @property {Object} poData - PO line data
 * @property {Object} grData - GR data
 * @property {Object} invoiceData - Invoice line data
 * @property {Object} variances - Calculated variances
 * @property {string[]} issues - List of issues found
 */

/**
 * Perform 3-way match for an invoice against PO and GR.
 * @param {Object} params - Match parameters
 * @param {string} params.poNumber - PO number
 * @param {Object[]} params.invoiceLines - Invoice line items
 * @param {string} params.invoiceLines[].poItem - PO item number
 * @param {number} params.invoiceLines[].quantity - Invoice quantity
 * @param {number} params.invoiceLines[].unitPrice - Invoice unit price
 * @param {number} params.invoiceLines[].netAmount - Invoice net amount
 * @param {string} [params.invoiceLines[].uom] - Unit of measure
 * @param {Object} [params.tolerances] - Custom tolerances (overrides defaults)
 * @param {boolean} [params.grRequired=true] - Whether GR is required for match
 * @returns {Promise<{overallStatus: string, canAutoPost: boolean, lines: ThreeWayMatchResult[], summary: Object, confidence: number}>}
 */
async function performThreeWayMatch(params) {
  const { poNumber, invoiceLines, tolerances = {}, grRequired = true } = params;
  const tol = { ...DEFAULT_TOLERANCES, ...tolerances };
  
  try {
    const ecc = await getEccService();
    const paddedPO = normalizePONumberPadded(poNumber);
    
    // Fetch PO with items and history (includes GR data)
    const poDetail = await ecc.getPODetail1({
      PURCHASEORDER: paddedPO,
      ITEMS: 'X',
      HISTORY: 'X',
      ACCOUNT_ASSIGNMENT: 'X'
    });
    
    if (!poDetail || poDetail.RETURN?.some(r => r.TYPE === 'E')) {
      return {
        overallStatus: 'NO_PO',
        canAutoPost: false,
        lines: [],
        summary: { error: 'PO not found' },
        confidence: 1.0
      };
    }
    
    const poItems = poDetail.POITEM || [];
    const poHistory = poDetail.POHISTORY || [];
    const historyTotals = poDetail.POHISTORY_TOTALS || [];
    const poHeader = poDetail.POHEADER || {};
    
    const lineResults = [];
    let hasBlockingIssue = false;
    let hasWarning = false;
    
    for (const invLine of invoiceLines) {
      const itemNumber = invLine.poItem?.toString().padStart(5, '0');
      
      // Find matching PO item
      const poItem = poItems.find(p => p.PO_ITEM === itemNumber);
      
      if (!poItem) {
        lineResults.push({
          status: 'NO_PO_ITEM',
          canAutoPost: false,
          poData: null,
          grData: null,
          invoiceData: invLine,
          variances: {},
          issues: [`PO item ${invLine.poItem} not found`]
        });
        hasBlockingIssue = true;
        continue;
      }
      
      // Get PO values
      const poQty = Number.parseFloat(poItem.QUANTITY) || Number.parseFloat(poItem.PO_QUANTITY) || 0;
      const poPrice = Number.parseFloat(poItem.NET_PRICE) || 0;
      const poPriceUnit = Number.parseFloat(poItem.PRICE_UNIT) || 1;
      const poUnitPrice = poPrice / poPriceUnit;
      const poNetAmount = poQty * poUnitPrice;
      const poUom = poItem.PO_UNIT || poItem.UNIT || '';
      
      // Get GR data from history
      const itemHistoryTotal = historyTotals.find(h => h.PO_ITEM === itemNumber);
      const grQty = itemHistoryTotal ? (Number.parseFloat(itemHistoryTotal.GR_QTY) || 0) : 0;
      const grValue = itemHistoryTotal ? (Number.parseFloat(itemHistoryTotal.GR_VAL) || 0) : 0;
      
      // Check if GR indicator on PO item
      const grIndicator = poItem.GR_IND === 'X' || poItem.GR_IND === true;
      const needsGR = grRequired && grIndicator;
      
      // Invoice values
      const invQty = normalizeAmount(invLine.quantity);
      const invUnitPrice = normalizeAmount(invLine.unitPrice);
      const invNetAmount = normalizeAmount(invLine.netAmount);
      const invUom = invLine.uom || '';
      
      // Calculate variances
      const qtyToMatch = needsGR ? grQty : poQty;
      const qtyVariance = invQty - qtyToMatch;
      const qtyVariancePercent = qtyToMatch > 0 ? (qtyVariance / qtyToMatch) * 100 : 0;
      
      const priceVariance = invUnitPrice - poUnitPrice;
      const priceVariancePercent = poUnitPrice > 0 ? (priceVariance / poUnitPrice) * 100 : 0;
      
      const amountVariance = invNetAmount - (qtyToMatch * poUnitPrice);
      const amountVariancePercent = poNetAmount > 0 ? (amountVariance / poNetAmount) * 100 : 0;
      
      const variances = {
        quantity: {
          po: poQty,
          gr: grQty,
          invoice: invQty,
          variance: Math.round(qtyVariance * 1000) / 1000,
          variancePercent: Math.round(qtyVariancePercent * 100) / 100
        },
        price: {
          po: Math.round(poUnitPrice * 100) / 100,
          invoice: Math.round(invUnitPrice * 100) / 100,
          variance: Math.round(priceVariance * 100) / 100,
          variancePercent: Math.round(priceVariancePercent * 100) / 100
        },
        amount: {
          expected: Math.round(qtyToMatch * poUnitPrice * 100) / 100,
          invoice: Math.round(invNetAmount * 100) / 100,
          variance: Math.round(amountVariance * 100) / 100,
          variancePercent: Math.round(amountVariancePercent * 100) / 100
        }
      };
      
      // Determine match status
      const issues = [];
      let status = 'FULL_MATCH';
      let canAutoPost = true;
      
      // Check GR requirement
      if (needsGR && grQty === 0) {
        status = 'NO_GR';
        canAutoPost = false;
        issues.push('Goods receipt required but not posted');
        hasBlockingIssue = true;
      }
      
      // Check UOM match
      if (invUom && poUom && invUom !== poUom) {
        issues.push(`UOM mismatch: Invoice=${invUom}, PO=${poUom}`);
        // Don't block for UOM - may be convertible
      }
      
      // Check quantity variance
      const qtyWithinPercent = Math.abs(qtyVariancePercent) <= tol.quantityVariancePercent;
      const qtyWithinAbsolute = Math.abs(qtyVariance) <= tol.quantityVarianceAbsolute;
      
      if (!qtyWithinPercent && !qtyWithinAbsolute) {
        if (status === 'FULL_MATCH') status = 'QUANTITY_VARIANCE';
        canAutoPost = false;
        issues.push(`Quantity variance ${qtyVariancePercent.toFixed(1)}% exceeds tolerance ${tol.quantityVariancePercent}%`);
        hasBlockingIssue = true;
      } else if (Math.abs(qtyVariance) > 0) {
        if (status === 'FULL_MATCH') status = 'TOLERANCE_MATCH';
        hasWarning = true;
      }
      
      // Check price variance
      const priceWithinPercent = Math.abs(priceVariancePercent) <= tol.priceVariancePercent;
      const priceWithinAbsolute = Math.abs(priceVariance) <= tol.priceVarianceAbsolute;
      
      if (!priceWithinPercent && !priceWithinAbsolute) {
        if (status === 'FULL_MATCH' || status === 'TOLERANCE_MATCH') status = 'PRICE_VARIANCE';
        canAutoPost = false;
        issues.push(`Price variance ${priceVariancePercent.toFixed(1)}% exceeds tolerance ${tol.priceVariancePercent}%`);
        hasBlockingIssue = true;
      } else if (Math.abs(priceVariance) > 0.01) {
        if (status === 'FULL_MATCH') status = 'TOLERANCE_MATCH';
        hasWarning = true;
      }
      
      // Check total amount variance
      const amtWithinPercent = Math.abs(amountVariancePercent) <= tol.amountVariancePercent;
      const amtWithinAbsolute = Math.abs(amountVariance) <= tol.amountVarianceAbsolute;
      
      if (!amtWithinPercent && !amtWithinAbsolute) {
        if (status === 'FULL_MATCH' || status === 'TOLERANCE_MATCH') status = 'AMOUNT_VARIANCE';
        canAutoPost = false;
        issues.push(`Amount variance ${amountVariancePercent.toFixed(1)}% exceeds tolerance ${tol.amountVariancePercent}%`);
        hasBlockingIssue = true;
      }
      
      // Small amount exception
      if (!canAutoPost && Math.abs(amountVariance) <= tol.smallAmountThreshold) {
        canAutoPost = true;
        status = 'TOLERANCE_MATCH';
        issues.push(`Small amount variance (${amountVariance.toFixed(2)}) auto-approved`);
      }
      
      lineResults.push({
        status,
        canAutoPost,
        poData: {
          poNumber: paddedPO,
          poItem: itemNumber,
          quantity: poQty,
          unitPrice: Math.round(poUnitPrice * 100) / 100,
          netAmount: Math.round(poNetAmount * 100) / 100,
          uom: poUom,
          grRequired: needsGR
        },
        grData: {
          quantity: grQty,
          value: Math.round(grValue * 100) / 100,
          isReceived: grQty > 0
        },
        invoiceData: {
          poItem: invLine.poItem,
          quantity: invQty,
          unitPrice: Math.round(invUnitPrice * 100) / 100,
          netAmount: Math.round(invNetAmount * 100) / 100,
          uom: invUom
        },
        variances,
        issues
      });
    }
    
    // Determine overall status
    let overallStatus = 'FULL_MATCH';
    if (hasBlockingIssue) {
      const hasPrice = lineResults.some(l => l.status === 'PRICE_VARIANCE');
      const hasQty = lineResults.some(l => l.status === 'QUANTITY_VARIANCE');
      const hasNoGR = lineResults.some(l => l.status === 'NO_GR');
      
      if (hasNoGR) overallStatus = 'NO_GR';
      else if (hasPrice && hasQty) overallStatus = 'PRICE_AND_QUANTITY_VARIANCE';
      else if (hasPrice) overallStatus = 'PRICE_VARIANCE';
      else if (hasQty) overallStatus = 'QUANTITY_VARIANCE';
      else overallStatus = 'VARIANCE';
    } else if (hasWarning) {
      overallStatus = 'TOLERANCE_MATCH';
    }
    
    const canAutoPost = lineResults.every(l => l.canAutoPost);
    
    return {
      overallStatus,
      canAutoPost,
      lines: lineResults,
      summary: {
        poNumber: paddedPO,
        poCurrency: poHeader.CURRENCY || '',
        totalLines: lineResults.length,
        matchedLines: lineResults.filter(l => l.status === 'FULL_MATCH').length,
        toleranceLines: lineResults.filter(l => l.status === 'TOLERANCE_MATCH').length,
        varianceLines: lineResults.filter(l => !['FULL_MATCH', 'TOLERANCE_MATCH'].includes(l.status)).length,
        totalInvoiceAmount: Math.round(lineResults.reduce((sum, l) => sum + (l.invoiceData?.netAmount || 0), 0) * 100) / 100,
        totalExpectedAmount: Math.round(lineResults.reduce((sum, l) => sum + (l.variances?.amount?.expected || 0), 0) * 100) / 100,
        totalVariance: Math.round(lineResults.reduce((sum, l) => sum + (l.variances?.amount?.variance || 0), 0) * 100) / 100
      },
      confidence: 1.0 // 100% confidence - deterministic calculation
    };
    
  } catch (error) {
    return {
      overallStatus: 'ERROR',
      canAutoPost: false,
      lines: [],
      summary: { error: error.message },
      confidence: 0
    };
  }
}


// ============================================================================
// CURRENCY VALIDATION & CONVERSION
// ============================================================================

/**
 * Exchange rate source.
 * @typedef {Object} ExchangeRate
 * @property {string} fromCurrency - Source currency
 * @property {string} toCurrency - Target currency
 * @property {number} rate - Exchange rate
 * @property {string} validFrom - Valid from date
 * @property {string} [rateType] - Rate type (M=Average, B=Buy, S=Sell)
 */

/**
 * Validate invoice currency against PO and vendor.
 * @param {Object} params - Validation parameters
 * @param {string} params.invoiceCurrency - Currency on invoice
 * @param {number} params.invoiceAmount - Amount in invoice currency
 * @param {string} [params.poNumber] - PO number (for PO currency check)
 * @param {string} [params.vendorId] - Vendor ID (for vendor currency check)
 * @param {string} [params.companyCode] - Company code (for local currency)
 * @param {Object[]} [params.exchangeRates] - Exchange rates (if conversion needed)
 * @returns {Promise<{isValid: boolean, currencyMatch: Object, conversion: Object, issues: string[], confidence: number}>}
 */
async function validateCurrency(params) {
  const { 
    invoiceCurrency, 
    invoiceAmount, 
    poNumber, 
    vendorId, 
    companyCode,
    exchangeRates = []
  } = params;
  
  const issues = [];
  const currencyMatch = {
    invoiceCurrency,
    poCurrency: null,
    vendorCurrency: null,
    localCurrency: null,
    matchesPO: null,
    matchesVendor: null
  };
  
  try {
    const ecc = await getEccService();
    
    // Get PO currency
    if (poNumber) {
      const paddedPO = normalizePONumberPadded(poNumber);
      const poDetail = await ecc.getPODetail1({
        PURCHASEORDER: paddedPO
      });
      
      if (poDetail?.POHEADER) {
        currencyMatch.poCurrency = poDetail.POHEADER.CURRENCY || poDetail.POHEADER.DOC_CURR;
        currencyMatch.matchesPO = invoiceCurrency === currencyMatch.poCurrency;
        
        if (!currencyMatch.matchesPO) {
          issues.push(`Invoice currency (${invoiceCurrency}) differs from PO currency (${currencyMatch.poCurrency})`);
        }
      }
    }
    
    // Get vendor currency preference
    if (vendorId) {
      const paddedVendor = normalizeVendorNumberPadded(vendorId);
      const vendorDetail = await ecc.getVendorDetail({
        VENDOR: paddedVendor
      });
      
      if (vendorDetail?.COMPANYDETAIL?.length > 0) {
        // Check company-specific vendor data for payment currency
        const companyData = companyCode 
          ? vendorDetail.COMPANYDETAIL.find(c => c.COMP_CODE === companyCode)
          : vendorDetail.COMPANYDETAIL[0];
        
        if (companyData?.CURRENCY) {
          currencyMatch.vendorCurrency = companyData.CURRENCY;
          currencyMatch.matchesVendor = invoiceCurrency === currencyMatch.vendorCurrency;
        }
      }
    }
    
    // Determine if conversion is needed
    let conversion = null;
    const needsConversion = (currencyMatch.poCurrency && invoiceCurrency !== currencyMatch.poCurrency) ||
                          (currencyMatch.localCurrency && invoiceCurrency !== currencyMatch.localCurrency);
    
    if (needsConversion) {
      const targetCurrency = currencyMatch.poCurrency || currencyMatch.localCurrency;
      
      // Look for exchange rate
      const rate = exchangeRates.find(r => 
        r.fromCurrency === invoiceCurrency && r.toCurrency === targetCurrency
      );
      
      if (rate) {
        const convertedAmount = invoiceAmount * rate.rate;
        conversion = {
          fromCurrency: invoiceCurrency,
          toCurrency: targetCurrency,
          originalAmount: invoiceAmount,
          exchangeRate: rate.rate,
          convertedAmount: Math.round(convertedAmount * 100) / 100,
          rateDate: rate.validFrom,
          rateType: rate.rateType || 'M'
        };
      } else {
        issues.push(`Exchange rate not provided for ${invoiceCurrency} → ${targetCurrency}`);
      }
    }
    
    // Determine validity
    const isValid = issues.length === 0 || 
                   (currencyMatch.matchesPO === true) ||
                   (conversion !== null);
    
    return {
      isValid,
      currencyMatch,
      conversion,
      issues,
      confidence: 1.0 // Deterministic validation
    };
    
  } catch (error) {
    return {
      isValid: false,
      currencyMatch,
      conversion: null,
      issues: [error.message],
      confidence: 0
    };
  }
}


// ============================================================================
// TOLERANCE CHECK
// ============================================================================

/**
 * Check if values are within tolerance.
 * Pure calculation - no ECC fetch needed (uses data already fetched).
 * @param {Object} params - Tolerance parameters
 * @param {number} params.expectedValue - Expected value (from PO/GR)
 * @param {number} params.actualValue - Actual value (from invoice)
 * @param {string} [params.toleranceType='amount'] - Type: 'amount', 'price', 'quantity', 'tax'
 * @param {Object} [params.tolerances] - Custom tolerances
 * @returns {{isWithinTolerance: boolean, variance: number, variancePercent: number, toleranceUsed: Object, confidence: number}}
 */
function checkTolerance(params) {
  const { 
    expectedValue, 
    actualValue, 
    toleranceType = 'amount',
    tolerances = {}
  } = params;
  
  const tol = { ...DEFAULT_TOLERANCES, ...tolerances };
  
  const variance = actualValue - expectedValue;
  const variancePercent = expectedValue !== 0 ? (variance / expectedValue) * 100 : (actualValue !== 0 ? 100 : 0);
  
  let percentTolerance, absoluteTolerance;
  
  switch (toleranceType) {
    case 'price':
      percentTolerance = tol.priceVariancePercent;
      absoluteTolerance = tol.priceVarianceAbsolute;
      break;
    case 'quantity':
      percentTolerance = tol.quantityVariancePercent;
      absoluteTolerance = tol.quantityVarianceAbsolute;
      break;
    case 'tax':
      percentTolerance = 100; // No percent check for tax
      absoluteTolerance = tol.taxVarianceAbsolute;
      break;
    case 'amount':
    default:
      percentTolerance = tol.amountVariancePercent;
      absoluteTolerance = tol.amountVarianceAbsolute;
      break;
  }
  
  const withinPercent = Math.abs(variancePercent) <= percentTolerance;
  const withinAbsolute = Math.abs(variance) <= absoluteTolerance;
  const isWithinTolerance = withinPercent || withinAbsolute;
  
  return {
    isWithinTolerance,
    variance: Math.round(variance * 100) / 100,
    variancePercent: Math.round(variancePercent * 100) / 100,
    toleranceUsed: {
      type: toleranceType,
      percentTolerance,
      absoluteTolerance,
      passedBy: isWithinTolerance ? (withinPercent ? 'percent' : 'absolute') : 'none'
    },
    confidence: 1.0 // Pure calculation
  };
}


/**
 * Comprehensive tolerance check for entire invoice.
 * @param {Object} params - Invoice data
 * @param {Object[]} params.lines - Invoice lines with expected vs actual
 * @param {number} params.lines[].expectedQty - Expected quantity
 * @param {number} params.lines[].actualQty - Actual quantity
 * @param {number} params.lines[].expectedPrice - Expected unit price
 * @param {number} params.lines[].actualPrice - Actual unit price
 * @param {number} params.lines[].expectedAmount - Expected amount
 * @param {number} params.lines[].actualAmount - Actual amount
 * @param {number} [params.expectedTax] - Expected tax
 * @param {number} [params.actualTax] - Actual tax
 * @param {Object} [params.tolerances] - Custom tolerances
 * @returns {{allWithinTolerance: boolean, lineResults: Object[], taxResult: Object, summary: Object, confidence: number}}
 */
function checkInvoiceTolerances(params) {
  const { lines, expectedTax, actualTax, tolerances = {} } = params;
  
  const lineResults = lines.map((line, index) => {
    const qtyCheck = checkTolerance({
      expectedValue: line.expectedQty,
      actualValue: line.actualQty,
      toleranceType: 'quantity',
      tolerances
    });
    
    const priceCheck = checkTolerance({
      expectedValue: line.expectedPrice,
      actualValue: line.actualPrice,
      toleranceType: 'price',
      tolerances
    });
    
    const amountCheck = checkTolerance({
      expectedValue: line.expectedAmount,
      actualValue: line.actualAmount,
      toleranceType: 'amount',
      tolerances
    });
    
    return {
      lineNumber: index + 1,
      quantity: qtyCheck,
      price: priceCheck,
      amount: amountCheck,
      isWithinTolerance: qtyCheck.isWithinTolerance && priceCheck.isWithinTolerance && amountCheck.isWithinTolerance
    };
  });
  
  let taxResult = null;
  if (expectedTax !== undefined && actualTax !== undefined) {
    taxResult = checkTolerance({
      expectedValue: expectedTax,
      actualValue: actualTax,
      toleranceType: 'tax',
      tolerances
    });
  }
  
  const allLinesWithin = lineResults.every(l => l.isWithinTolerance);
  const taxWithin = taxResult ? taxResult.isWithinTolerance : true;
  
  return {
    allWithinTolerance: allLinesWithin && taxWithin,
    lineResults,
    taxResult,
    summary: {
      totalLines: lineResults.length,
      linesWithinTolerance: lineResults.filter(l => l.isWithinTolerance).length,
      linesOutsideTolerance: lineResults.filter(l => !l.isWithinTolerance).length,
      totalExpectedAmount: Math.round(lines.reduce((sum, l) => sum + l.expectedAmount, 0) * 100) / 100,
      totalActualAmount: Math.round(lines.reduce((sum, l) => sum + l.actualAmount, 0) * 100) / 100,
      totalVariance: Math.round(lines.reduce((sum, l) => sum + (l.actualAmount - l.expectedAmount), 0) * 100) / 100
    },
    confidence: 1.0
  };
}


// ============================================================================
// PAYMENT BLOCK DETERMINATION
// ============================================================================

/**
 * SAP Payment Block Codes.
 */
const PAYMENT_BLOCK_CODES = {
  'A': { code: 'A', reason: 'Delivery not received', description: 'GR not posted or incomplete' },
  'B': { code: 'B', reason: 'Duplicate check', description: 'Potential duplicate invoice' },
  'R': { code: 'R', reason: 'Price variance', description: 'Price exceeds tolerance' },
  'M': { code: 'M', reason: 'Quantity variance', description: 'Quantity mismatch' },
  'Q': { code: 'Q', reason: 'Quality hold', description: 'Quality inspection pending' },
  'V': { code: 'V', reason: 'Vendor issue', description: 'Vendor account blocked' },
  'W': { code: 'W', reason: 'Awaiting approval', description: 'Pending workflow approval' },
  'Z': { code: 'Z', reason: 'Other', description: 'Manual review required' },
  '': { code: '', reason: 'No block', description: 'Ready for payment' }
};

/**
 * Determine payment block code based on invoice status.
 * @param {Object} params - Block determination parameters
 * @param {Object} params.threeWayMatch - Result from performThreeWayMatch
 * @param {boolean} [params.isDuplicate=false] - Is duplicate invoice
 * @param {boolean} [params.vendorBlocked=false] - Is vendor blocked
 * @param {boolean} [params.qualityHold=false] - Quality inspection pending
 * @param {boolean} [params.needsApproval=false] - Needs workflow approval
 * @param {number} [params.approvalThreshold] - Amount threshold for approval
 * @param {number} [params.invoiceAmount] - Invoice total amount
 * @returns {{blockCode: string, blockReason: string, blockDescription: string, allBlocks: Object[], canPay: boolean, confidence: number}}
 */
function determinePaymentBlock(params) {
  const {
    threeWayMatch,
    isDuplicate = false,
    vendorBlocked = false,
    qualityHold = false,
    needsApproval = false,
    approvalThreshold,
    invoiceAmount
  } = params;
  
  const blocks = [];
  
  // Check for GR issue
  if (threeWayMatch?.overallStatus === 'NO_GR') {
    blocks.push(PAYMENT_BLOCK_CODES['A']);
  }
  
  // Check for duplicate
  if (isDuplicate) {
    blocks.push(PAYMENT_BLOCK_CODES['B']);
  }
  
  // Check for price variance
  if (threeWayMatch?.overallStatus === 'PRICE_VARIANCE' || 
      threeWayMatch?.overallStatus === 'PRICE_AND_QUANTITY_VARIANCE') {
    blocks.push(PAYMENT_BLOCK_CODES['R']);
  }
  
  // Check for quantity variance
  if (threeWayMatch?.overallStatus === 'QUANTITY_VARIANCE' || 
      threeWayMatch?.overallStatus === 'PRICE_AND_QUANTITY_VARIANCE') {
    blocks.push(PAYMENT_BLOCK_CODES['M']);
  }
  
  // Check quality hold
  if (qualityHold) {
    blocks.push(PAYMENT_BLOCK_CODES['Q']);
  }
  
  // Check vendor block
  if (vendorBlocked) {
    blocks.push(PAYMENT_BLOCK_CODES['V']);
  }
  
  // Check approval requirement
  if (needsApproval || (approvalThreshold && invoiceAmount > approvalThreshold)) {
    blocks.push(PAYMENT_BLOCK_CODES['W']);
  }
  
  // Determine primary block (priority order)
  const priorityOrder = ['B', 'V', 'A', 'R', 'M', 'Q', 'W', 'Z'];
  blocks.sort((a, b) => priorityOrder.indexOf(a.code) - priorityOrder.indexOf(b.code));
  
  const primaryBlock = blocks.length > 0 ? blocks[0] : PAYMENT_BLOCK_CODES[''];
  
  return {
    blockCode: primaryBlock.code,
    blockReason: primaryBlock.reason,
    blockDescription: primaryBlock.description,
    allBlocks: blocks,
    canPay: blocks.length === 0,
    confidence: 1.0 // Rule-based determination
  };
}


// ============================================================================
// WORKFLOW ROUTING RULES
// ============================================================================

/**
 * Workflow routing rule.
 * @typedef {Object} WorkflowRule
 * @property {string} ruleId - Rule identifier
 * @property {string} ruleName - Rule name
 * @property {string} approverRole - Role required to approve
 * @property {string} [approverUser] - Specific user (if known)
 * @property {string} reason - Why this routing applies
 * @property {number} priority - Rule priority (lower = higher priority)
 */

/**
 * Default workflow routing configuration.
 */
const DEFAULT_WORKFLOW_CONFIG = {
  // Amount thresholds
  thresholds: {
    level1: 1000,      // Up to $1,000 - Auto approve or AP Clerk
    level2: 10000,     // $1,001 - $10,000 - AP Specialist
    level3: 50000,     // $10,001 - $50,000 - AP Manager
    level4: 100000,    // $50,001 - $100,000 - Finance Manager
    level5: Infinity   // Over $100,000 - CFO/Director
  },
  
  // Variance thresholds requiring buyer approval
  varianceThresholds: {
    priceVariancePercent: 5,
    quantityVariancePercent: 10,
    amountAbsolute: 1000
  },
  
  // Document types requiring special routing
  specialRouting: {
    creditMemo: 'AP_SPECIALIST',
    nonPOInvoice: 'AP_SPECIALIST',
    serviceInvoice: 'SERVICE_RECEIVER',
    capitalExpense: 'ASSET_ACCOUNTANT',
    intercompany: 'IC_COORDINATOR'
  }
};

/**
 * Determine workflow routing for an invoice.
 * @param {Object} params - Routing parameters
 * @param {number} params.invoiceAmount - Invoice total amount
 * @param {string} [params.documentType] - Document type (KR, KG, etc.)
 * @param {boolean} [params.isPOInvoice=true] - Is PO-based invoice
 * @param {boolean} [params.hasVariance=false] - Has price/qty variance
 * @param {Object} [params.variance] - Variance details
 * @param {string} [params.expenseType] - Expense type (capital, service, etc.)
 * @param {string} [params.companyCode] - Company code
 * @param {string} [params.plantCode] - Plant code
 * @param {string} [params.costCenter] - Cost center
 * @param {string} [params.buyerId] - Buyer from PO
 * @param {string} [params.requesterId] - Original requester
 * @param {Object} [params.config] - Custom workflow configuration
 * @returns {{routing: WorkflowRule[], primaryApprover: Object, requiresApproval: boolean, autoApprove: boolean, confidence: number}}
 */
function determineWorkflowRouting(params) {
  const {
    invoiceAmount,
    documentType,
    isPOInvoice = true,
    hasVariance = false,
    variance = {},
    expenseType,
    companyCode,
    plantCode,
    costCenter,
    buyerId,
    requesterId,
    config = {}
  } = params;
  
  const cfg = {
    thresholds: { ...DEFAULT_WORKFLOW_CONFIG.thresholds, ...config.thresholds },
    varianceThresholds: { ...DEFAULT_WORKFLOW_CONFIG.varianceThresholds, ...config.varianceThresholds },
    specialRouting: { ...DEFAULT_WORKFLOW_CONFIG.specialRouting, ...config.specialRouting }
  };
  
  const routing = [];
  let autoApprove = false;
  
  // Rule 1: Amount-based routing
  let amountRole;
  if (invoiceAmount <= cfg.thresholds.level1) {
    amountRole = 'AUTO_APPROVE';
    autoApprove = true;
  } else if (invoiceAmount <= cfg.thresholds.level2) {
    amountRole = 'AP_CLERK';
  } else if (invoiceAmount <= cfg.thresholds.level3) {
    amountRole = 'AP_SPECIALIST';
  } else if (invoiceAmount <= cfg.thresholds.level4) {
    amountRole = 'AP_MANAGER';
  } else if (invoiceAmount <= cfg.thresholds.level5) {
    amountRole = 'FINANCE_MANAGER';
  } else {
    amountRole = 'CFO';
  }
  
  if (amountRole !== 'AUTO_APPROVE') {
    routing.push({
      ruleId: 'AMOUNT_THRESHOLD',
      ruleName: 'Amount-based approval',
      approverRole: amountRole,
      reason: `Invoice amount ${invoiceAmount} requires ${amountRole} approval`,
      priority: 10
    });
  }
  
  // Rule 2: Document type routing
  if (documentType === 'KG') {
    routing.push({
      ruleId: 'CREDIT_MEMO',
      ruleName: 'Credit memo routing',
      approverRole: cfg.specialRouting.creditMemo,
      reason: 'Credit memos require specialist review',
      priority: 5
    });
    autoApprove = false;
  }
  
  // Rule 3: Non-PO invoice routing
  if (!isPOInvoice) {
    routing.push({
      ruleId: 'NON_PO_INVOICE',
      ruleName: 'Non-PO invoice routing',
      approverRole: cfg.specialRouting.nonPOInvoice,
      reason: 'Non-PO invoices require specialist coding and approval',
      priority: 5
    });
    autoApprove = false;
  }
  
  // Rule 4: Variance routing (route to buyer)
  if (hasVariance) {
    const priceVar = Math.abs(variance.priceVariancePercent || 0);
    const qtyVar = Math.abs(variance.quantityVariancePercent || 0);
    const amtVar = Math.abs(variance.amountVariance || 0);
    
    if (priceVar > cfg.varianceThresholds.priceVariancePercent) {
      routing.push({
        ruleId: 'PRICE_VARIANCE',
        ruleName: 'Price variance approval',
        approverRole: 'BUYER',
        approverUser: buyerId,
        reason: `Price variance ${priceVar.toFixed(1)}% exceeds ${cfg.varianceThresholds.priceVariancePercent}%`,
        priority: 3
      });
      autoApprove = false;
    }
    
    if (qtyVar > cfg.varianceThresholds.quantityVariancePercent) {
      routing.push({
        ruleId: 'QUANTITY_VARIANCE',
        ruleName: 'Quantity variance approval',
        approverRole: 'BUYER',
        approverUser: buyerId,
        reason: `Quantity variance ${qtyVar.toFixed(1)}% exceeds ${cfg.varianceThresholds.quantityVariancePercent}%`,
        priority: 3
      });
      autoApprove = false;
    }
    
    if (amtVar > cfg.varianceThresholds.amountAbsolute) {
      routing.push({
        ruleId: 'AMOUNT_VARIANCE',
        ruleName: 'Amount variance approval',
        approverRole: 'BUYER',
        approverUser: buyerId,
        reason: `Amount variance ${amtVar.toFixed(2)} exceeds ${cfg.varianceThresholds.amountAbsolute}`,
        priority: 3
      });
      autoApprove = false;
    }
  }
  
  // Rule 5: Expense type routing
  if (expenseType === 'capital') {
    routing.push({
      ruleId: 'CAPITAL_EXPENSE',
      ruleName: 'Capital expense routing',
      approverRole: cfg.specialRouting.capitalExpense,
      reason: 'Capital expenses require asset accountant review',
      priority: 7
    });
    autoApprove = false;
  } else if (expenseType === 'service') {
    routing.push({
      ruleId: 'SERVICE_INVOICE',
      ruleName: 'Service invoice routing',
      approverRole: cfg.specialRouting.serviceInvoice,
      approverUser: requesterId,
      reason: 'Service invoices require service receiver confirmation',
      priority: 4
    });
    autoApprove = false;
  } else if (expenseType === 'intercompany') {
    routing.push({
      ruleId: 'INTERCOMPANY',
      ruleName: 'Intercompany routing',
      approverRole: cfg.specialRouting.intercompany,
      reason: 'Intercompany transactions require IC coordinator review',
      priority: 6
    });
    autoApprove = false;
  }
  
  // Rule 6: Cost center owner (if no specific routing found)
  if (costCenter && routing.length === 0) {
    routing.push({
      ruleId: 'COST_CENTER_OWNER',
      ruleName: 'Cost center approval',
      approverRole: 'COST_CENTER_OWNER',
      reason: `Route to cost center ${costCenter} owner`,
      priority: 15
    });
  }
  
  // Sort by priority
  routing.sort((a, b) => a.priority - b.priority);
  
  // Determine primary approver
  const primaryApprover = routing.length > 0 ? {
    role: routing[0].approverRole,
    user: routing[0].approverUser || null,
    reason: routing[0].reason
  } : null;
  
  return {
    routing,
    primaryApprover,
    requiresApproval: routing.length > 0 && !autoApprove,
    autoApprove: autoApprove && routing.length === 0,
    confidence: 1.0 // Rule-based determination
  };
}


// ============================================================================
// INVOICE POSTING SIMULATION
// ============================================================================

/**
 * Posting simulation result.
 * @typedef {Object} PostingSimulationResult
 * @property {boolean} canPost - Whether invoice can be posted
 * @property {string} status - READY, INCOMPLETE, BLOCKED, ERROR
 * @property {Object} completeness - Field completeness check
 * @property {Object} validations - Validation results
 * @property {string[]} missingFields - List of missing required fields
 * @property {string[]} errors - Blocking errors
 * @property {string[]} warnings - Non-blocking warnings
 * @property {Object} suggestedActions - Recommended actions to resolve issues
 */

/**
 * Required fields for different invoice types.
 */
const REQUIRED_FIELDS = {
  // Common fields for all invoices
  common: [
    { field: 'vendorId', label: 'Vendor ID', critical: true },
    { field: 'invoiceNumber', label: 'Invoice Number', critical: true },
    { field: 'invoiceDate', label: 'Invoice Date', critical: true },
    { field: 'grossAmount', label: 'Gross Amount', critical: true },
    { field: 'currency', label: 'Currency', critical: true },
    { field: 'companyCode', label: 'Company Code', critical: true }
  ],
  
  // Additional fields for PO invoices
  poInvoice: [
    { field: 'poNumber', label: 'PO Number', critical: true }
  ],
  
  // Additional fields for non-PO invoices
  nonPOInvoice: [
    { field: 'glAccount', label: 'GL Account', critical: true },
    { field: 'costCenter', label: 'Cost Center', critical: false }, // Or other account assignment
    { field: 'taxCode', label: 'Tax Code', critical: true }
  ],
  
  // Line item fields for PO invoice
  poLineItem: [
    { field: 'poItem', label: 'PO Item', critical: true },
    { field: 'quantity', label: 'Quantity', critical: true },
    { field: 'netAmount', label: 'Net Amount', critical: true }
  ],
  
  // Line item fields for non-PO invoice
  nonPOLineItem: [
    { field: 'glAccount', label: 'GL Account', critical: true },
    { field: 'amount', label: 'Amount', critical: true },
    { field: 'taxCode', label: 'Tax Code', critical: true }
  ]
};

/**
 * Simulate invoice posting to identify issues before actual post.
 * @param {Object} params - Invoice data
 * @param {Object} params.header - Invoice header
 * @param {string} params.header.vendorId - Vendor ID
 * @param {string} params.header.invoiceNumber - Invoice number
 * @param {string|Date} params.header.invoiceDate - Invoice date
 * @param {number} params.header.grossAmount - Gross amount
 * @param {number} [params.header.netAmount] - Net amount
 * @param {number} [params.header.taxAmount] - Tax amount
 * @param {string} params.header.currency - Currency
 * @param {string} params.header.companyCode - Company code
 * @param {string} [params.header.poNumber] - PO number (if PO invoice)
 * @param {string} [params.header.documentType] - Document type (KR/KG)
 * @param {string} [params.header.paymentTerms] - Payment terms
 * @param {string} [params.header.paymentMethod] - Payment method
 * @param {Object[]} [params.lineItems] - Line items
 * @param {Object} [params.threeWayMatch] - Result from 3-way match
 * @param {Object} [params.toleranceCheck] - Result from tolerance check
 * @param {boolean} [params.skipDuplicateCheck=false] - Skip duplicate check
 * @returns {Promise<PostingSimulationResult>}
 */
async function simulatePosting(params) {
  const { 
    header, 
    lineItems = [], 
    threeWayMatch, 
    toleranceCheck,
    skipDuplicateCheck = false
  } = params;
  
  const missingFields = [];
  const errors = [];
  const warnings = [];
  const validations = {};
  
  const isPOInvoice = !!header.poNumber;
  
  // 1. Check required header fields
  const requiredHeaderFields = [
    ...REQUIRED_FIELDS.common,
    ...(isPOInvoice ? REQUIRED_FIELDS.poInvoice : REQUIRED_FIELDS.nonPOInvoice)
  ];
  
  for (const req of requiredHeaderFields) {
    const value = header[req.field];
    const hasValue = value !== undefined && value !== null && value !== '';
    
    if (!hasValue) {
      missingFields.push(req.label);
      if (req.critical) {
        errors.push(`Missing required field: ${req.label}`);
      } else {
        warnings.push(`Missing recommended field: ${req.label}`);
      }
    }
  }
  
  // 2. Check line items
  const lineFields = isPOInvoice ? REQUIRED_FIELDS.poLineItem : REQUIRED_FIELDS.nonPOLineItem;
  
  lineItems.forEach((line, index) => {
    for (const req of lineFields) {
      const value = line[req.field];
      const hasValue = value !== undefined && value !== null && value !== '';
      
      if (!hasValue && req.critical) {
        errors.push(`Line ${index + 1}: Missing ${req.label}`);
      }
    }
  });
  
  // 3. Validate dates
  const invoiceDate = new Date(header.invoiceDate);
  const today = new Date();
  
  if (invoiceDate > today) {
    warnings.push('Invoice date is in the future');
  }
  
  const daysDiff = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) {
    errors.push('Invoice date is more than 1 year old - may require special approval');
  } else if (daysDiff > 90) {
    warnings.push('Invoice date is more than 90 days old');
  }
  
  validations.dateCheck = {
    invoiceDate: invoiceDate.toISOString().split('T')[0],
    daysOld: daysDiff,
    isValid: daysDiff <= 365 && daysDiff >= 0
  };
  
  // 4. Validate amounts
  const grossAmount = normalizeAmount(header.grossAmount);
  const netAmount = header.netAmount ? normalizeAmount(header.netAmount) : null;
  const taxAmount = header.taxAmount ? normalizeAmount(header.taxAmount) : null;
  
  if (grossAmount <= 0 && header.documentType !== 'KG') {
    errors.push('Gross amount must be positive for vendor invoice');
  }
  
  if (netAmount !== null && taxAmount !== null) {
    const calculatedGross = netAmount + taxAmount;
    const amountDiff = Math.abs(grossAmount - calculatedGross);
    
    if (amountDiff > 0.01) {
      warnings.push(`Amount mismatch: Gross (${grossAmount}) ≠ Net (${netAmount}) + Tax (${taxAmount})`);
    }
  }
  
  validations.amountCheck = {
    grossAmount,
    netAmount,
    taxAmount,
    isValid: grossAmount !== 0
  };
  
  // 5. Check 3-way match result
  if (threeWayMatch) {
    validations.threeWayMatch = {
      status: threeWayMatch.overallStatus,
      canAutoPost: threeWayMatch.canAutoPost
    };
    
    if (!threeWayMatch.canAutoPost) {
      if (threeWayMatch.overallStatus === 'NO_GR') {
        errors.push('Goods receipt not posted - cannot process invoice');
      } else if (threeWayMatch.overallStatus.includes('VARIANCE')) {
        errors.push(`3-way match failed: ${threeWayMatch.overallStatus}`);
      }
    }
  }
  
  // 6. Check tolerance result
  if (toleranceCheck) {
    validations.toleranceCheck = {
      allWithinTolerance: toleranceCheck.allWithinTolerance,
      summary: toleranceCheck.summary
    };
    
    if (!toleranceCheck.allWithinTolerance) {
      errors.push('Invoice amounts outside tolerance limits');
    }
  }
  
  // 7. Check for duplicate (using existing invoice validator)
  if (!skipDuplicateCheck) {
    try {
      const invoiceValidators = require('./invoice-validators');
      const duplicateResult = await invoiceValidators.checkDuplicateInvoice({
        vendorId: header.vendorId,
        invoiceNumber: header.invoiceNumber,
        grossAmount: header.grossAmount,
        invoiceDate: header.invoiceDate,
        companyCode: header.companyCode
      });
      
      validations.duplicateCheck = {
        isDuplicate: duplicateResult.isDuplicate,
        confidence: duplicateResult.confidence
      };
      
      if (duplicateResult.isDuplicate) {
        errors.push('Potential duplicate invoice detected');
      }
    } catch (e) {
      // Duplicate check module not available
      validations.duplicateCheck = { skipped: true };
    }
  }
  
  // 8. Validate vendor (check if exists and not blocked)
  try {
    const ecc = await getEccService();
    const paddedVendor = normalizeVendorNumberPadded(header.vendorId);
    
    const vendorDetail = await ecc.getVendorDetail({
      VENDOR: paddedVendor,
      COMPANYCODE: header.companyCode
    });
    
    if (!vendorDetail || vendorDetail.RETURN?.some(r => r.TYPE === 'E')) {
      errors.push('Vendor not found in system');
      validations.vendorCheck = { isValid: false, error: 'Vendor not found' };
    } else {
      const companyData = vendorDetail.COMPANYDETAIL?.find(c => c.COMP_CODE === header.companyCode);
      const isBlocked = companyData?.PMNT_BLOCK || companyData?.POST_BLOCK;
      
      validations.vendorCheck = {
        isValid: !isBlocked,
        vendorName: vendorDetail.GENERALDETAIL?.NAME1,
        paymentBlocked: !!companyData?.PMNT_BLOCK,
        postingBlocked: !!companyData?.POST_BLOCK
      };
      
      if (companyData?.POST_BLOCK) {
        errors.push('Vendor is blocked for posting');
      } else if (companyData?.PMNT_BLOCK) {
        warnings.push('Vendor is blocked for payment');
      }
    }
  } catch (e) {
    warnings.push('Could not validate vendor: ' + e.message);
    validations.vendorCheck = { skipped: true, error: e.message };
  }
  
  // 9. Calculate completeness score
  const totalRequiredFields = requiredHeaderFields.filter(f => f.critical).length +
                             (lineItems.length * lineFields.filter(f => f.critical).length);
  const missingCriticalFields = errors.filter(e => e.startsWith('Missing') || e.includes('Missing')).length;
  const completenessScore = totalRequiredFields > 0 
    ? Math.round(((totalRequiredFields - missingCriticalFields) / totalRequiredFields) * 100)
    : 0;
  
  // 10. Determine overall status
  let status;
  let canPost = false;
  
  if (errors.length === 0) {
    status = 'READY';
    canPost = true;
  } else if (missingFields.length > 0 && errors.every(e => e.startsWith('Missing'))) {
    status = 'INCOMPLETE';
  } else {
    status = 'BLOCKED';
  }
  
  // 11. Generate suggested actions
  const suggestedActions = [];
  
  if (missingFields.length > 0) {
    suggestedActions.push({
      action: 'COMPLETE_FIELDS',
      description: 'Fill in missing required fields',
      fields: missingFields
    });
  }
  
  if (errors.some(e => e.includes('3-way match'))) {
    suggestedActions.push({
      action: 'RESOLVE_VARIANCE',
      description: 'Review and resolve price/quantity variances',
      routeTo: 'BUYER'
    });
  }
  
  if (errors.some(e => e.includes('Goods receipt'))) {
    suggestedActions.push({
      action: 'POST_GR',
      description: 'Post goods receipt before processing invoice',
      routeTo: 'WAREHOUSE'
    });
  }
  
  if (errors.some(e => e.includes('duplicate'))) {
    suggestedActions.push({
      action: 'VERIFY_DUPLICATE',
      description: 'Verify this is not a duplicate invoice',
      routeTo: 'AP_SPECIALIST'
    });
  }
  
  if (errors.some(e => e.includes('Vendor is blocked'))) {
    suggestedActions.push({
      action: 'UNBLOCK_VENDOR',
      description: 'Remove vendor block or select different vendor',
      routeTo: 'VENDOR_MASTER'
    });
  }
  
  return {
    canPost,
    status,
    completeness: {
      score: completenessScore,
      totalFields: totalRequiredFields,
      filledFields: totalRequiredFields - missingCriticalFields,
      missingFields
    },
    validations,
    missingFields,
    errors,
    warnings,
    suggestedActions,
    confidence: 1.0 // Deterministic validation
  };
}


// ============================================================================
// TOUCHLESS READINESS ASSESSMENT
// ============================================================================

/**
 * Comprehensive touchless readiness assessment.
 * Combines all checks to determine if invoice can be processed touchlessly.
 * @param {Object} params - Assessment parameters
 * @param {Object} params.invoice - Complete invoice data
 * @param {Object} params.invoice.header - Invoice header
 * @param {Object[]} [params.invoice.lineItems] - Invoice line items
 * @param {Object} [params.tolerances] - Custom tolerances
 * @param {Object} [params.workflowConfig] - Custom workflow configuration
 * @param {boolean} [params.grRequired=true] - Whether GR is required
 * @returns {Promise<{isTouchless: boolean, score: number, assessment: Object, recommendations: string[]}>}
 */
async function assessTouchlessReadiness(params) {
  const { 
    invoice, 
    tolerances = {}, 
    workflowConfig = {},
    grRequired = true 
  } = params;
  
  const { header, lineItems = [] } = invoice;
  const isPOInvoice = !!header.poNumber;
  
  const assessment = {
    completeness: null,
    threeWayMatch: null,
    toleranceCheck: null,
    currencyValidation: null,
    paymentBlock: null,
    workflowRouting: null,
    postingSimulation: null
  };
  
  const recommendations = [];
  let touchlessScore = 100;
  
  try {
    // 1. Perform 3-way match (for PO invoices)
    if (isPOInvoice && lineItems.length > 0) {
      assessment.threeWayMatch = await performThreeWayMatch({
        poNumber: header.poNumber,
        invoiceLines: lineItems,
        tolerances,
        grRequired
      });
      
      if (!assessment.threeWayMatch.canAutoPost) {
        touchlessScore -= 40;
        
        if (assessment.threeWayMatch.overallStatus === 'NO_GR') {
          recommendations.push('Post goods receipt before processing invoice');
        } else {
          recommendations.push('Resolve 3-way match variances with buyer');
        }
      }
    }
    
    // 2. Validate currency
    assessment.currencyValidation = await validateCurrency({
      invoiceCurrency: header.currency,
      invoiceAmount: header.grossAmount,
      poNumber: header.poNumber,
      vendorId: header.vendorId,
      companyCode: header.companyCode
    });
    
    if (!assessment.currencyValidation.isValid) {
      touchlessScore -= 10;
      recommendations.push('Resolve currency mismatch or provide exchange rate');
    }
    
    // 3. Check tolerances (if 3-way match was done)
    if (assessment.threeWayMatch && assessment.threeWayMatch.lines.length > 0) {
      const toleranceLines = assessment.threeWayMatch.lines.map(l => ({
        expectedQty: l.grData?.quantity || l.poData?.quantity || 0,
        actualQty: l.invoiceData?.quantity || 0,
        expectedPrice: l.poData?.unitPrice || 0,
        actualPrice: l.invoiceData?.unitPrice || 0,
        expectedAmount: l.variances?.amount?.expected || 0,
        actualAmount: l.invoiceData?.netAmount || 0
      }));
      
      assessment.toleranceCheck = checkInvoiceTolerances({
        lines: toleranceLines,
        tolerances
      });
      
      if (!assessment.toleranceCheck.allWithinTolerance) {
        touchlessScore -= 20;
        recommendations.push('Review tolerance exceptions');
      }
    }
    
    // 4. Determine payment block
    assessment.paymentBlock = determinePaymentBlock({
      threeWayMatch: assessment.threeWayMatch,
      isDuplicate: false, // Will be checked in simulation
      vendorBlocked: assessment.currencyValidation?.currencyMatch?.vendorBlocked || false,
      invoiceAmount: header.grossAmount
    });
    
    if (!assessment.paymentBlock.canPay) {
      touchlessScore -= 15;
      recommendations.push(`Resolve payment block: ${assessment.paymentBlock.blockReason}`);
    }
    
    // 5. Determine workflow routing
    assessment.workflowRouting = determineWorkflowRouting({
      invoiceAmount: header.grossAmount,
      documentType: header.documentType,
      isPOInvoice,
      hasVariance: assessment.threeWayMatch?.overallStatus?.includes('VARIANCE'),
      variance: assessment.threeWayMatch?.summary,
      config: workflowConfig
    });
    
    if (assessment.workflowRouting.requiresApproval) {
      touchlessScore -= 10;
      recommendations.push(`Invoice requires ${assessment.workflowRouting.primaryApprover?.role} approval`);
    }
    
    // 6. Simulate posting
    assessment.postingSimulation = await simulatePosting({
      header,
      lineItems,
      threeWayMatch: assessment.threeWayMatch,
      toleranceCheck: assessment.toleranceCheck
    });
    
    if (!assessment.postingSimulation.canPost) {
      touchlessScore -= 25;
      assessment.postingSimulation.suggestedActions.forEach(action => {
        recommendations.push(action.description);
      });
    }
    
    // Ensure score doesn't go below 0
    touchlessScore = Math.max(0, touchlessScore);
    
    // Determine if touchless
    const isTouchless = touchlessScore >= 80 && 
                       assessment.postingSimulation?.canPost &&
                       !assessment.workflowRouting?.requiresApproval;
    
    return {
      isTouchless,
      score: touchlessScore,
      assessment,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      summary: {
        status: isTouchless ? 'TOUCHLESS_READY' : 
                touchlessScore >= 60 ? 'NEEDS_REVIEW' : 'MANUAL_PROCESS',
        threeWayMatchStatus: assessment.threeWayMatch?.overallStatus || 'N/A',
        currencyValid: assessment.currencyValidation?.isValid,
        withinTolerance: assessment.toleranceCheck?.allWithinTolerance ?? true,
        paymentBlockCode: assessment.paymentBlock?.blockCode || '',
        requiresApproval: assessment.workflowRouting?.requiresApproval,
        canPost: assessment.postingSimulation?.canPost
      },
      confidence: 1.0
    };
    
  } catch (error) {
    return {
      isTouchless: false,
      score: 0,
      assessment,
      recommendations: ['Error during assessment: ' + error.message],
      summary: { status: 'ERROR', error: error.message },
      confidence: 0
    };
  }
}


// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  // Configuration
  DEFAULT_TOLERANCES,
  PAYMENT_BLOCK_CODES,
  REQUIRED_FIELDS,
  
  // 3-Way Match
  performThreeWayMatch,
  
  // Currency Validation
  validateCurrency,
  
  // Tolerance Checks
  checkTolerance,
  checkInvoiceTolerances,
  
  // Payment Block
  determinePaymentBlock,
  
  // Workflow Routing
  determineWorkflowRouting,
  
  // Posting Simulation
  simulatePosting,
  
  // Comprehensive Assessment
  assessTouchlessReadiness
};
