// @ts-check
/**
 * @fileoverview Enhanced PO matching validators for invoice verification.
 * Provides 2-way match (PO-Invoice), 3-way match (PO-GR-Invoice), and GR-based verification.
 */

const cds = require('@sap/cds');
const { normalizeAmount, normalizeQuantity, normalizeVendorNumberPadded } = require('./utils/normalizers');
const { createValidationResult, adjustScore, isAcceptable } = require('./utils/confidence');
const { levenshteinSimilarity } = require('./utils/string-matching');
const cache = require('./cache');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 */

/**
 * PO Match result.
 * @typedef {Object} POMatchResult
 * @property {boolean} isMatched - Whether PO matches
 * @property {string} matchType - Type of match (2-way, 3-way)
 * @property {number} confidence - Match confidence
 * @property {Object} [variances] - Variance details
 * @property {string[]} [issues] - Issues found
 */

/**
 * GR (Goods Receipt) verification result.
 * @typedef {Object} GRVerificationResult
 * @property {boolean} grExists - Whether GR exists
 * @property {number} grQuantity - Total GR quantity
 * @property {number} grValue - Total GR value
 * @property {number} openQuantity - Quantity open for invoicing
 * @property {number} openValue - Value open for invoicing
 */

async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}

/**
 * Get PO details with caching.
 * @param {string} poNumber - PO number
 * @returns {Promise<Object|null>}
 */
async function getPODetailWithCache(poNumber) {
  const cacheKey = `po:${poNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const paddedPO = poNumber.toString().padStart(10, '0');
    
    const result = await ecc.getPODetail({ PURCHASEORDER: paddedPO });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }
    
    cache.set(cacheKey, result, { ttl: 5 * 60 * 1000 }); // 5 minutes
    return result;
  } catch (error) {
    console.error('Error fetching PO detail:', error);
    return null;
  }
}

/**
 * Get extended PO details using getPODetail1.
 * @param {string} poNumber - PO number
 * @returns {Promise<Object|null>}
 */
async function getPODetailExtended(poNumber) {
  const cacheKey = `po1:${poNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const paddedPO = poNumber.toString().padStart(10, '0');
    
    const result = await ecc.getPODetail1({ PURCHASEORDER: paddedPO });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }
    
    cache.set(cacheKey, result, { ttl: 5 * 60 * 1000 });
    return result;
  } catch (error) {
    console.error('Error fetching extended PO detail:', error);
    return null;
  }
}


/**
 * Validate PO exists and get header info.
 * @param {string} poNumber - PO number
 * @returns {Promise<ValidationResult>}
 */
async function validatePOExists(poNumber) {
  if (!poNumber) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: 'PO number is required'
    });
  }
  
  const poDetail = await getPODetailWithCache(poNumber);
  
  if (!poDetail) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `PO ${poNumber} not found`
    });
  }
  
  const header = poDetail.POHEADER;
  return createValidationResult(true, 1.0, 'purchaseOrder', {
    derivedValue: poNumber,
    message: `PO ${poNumber} exists`,
    metadata: {
      vendor: header?.VENDOR,
      companyCode: header?.CO_CODE,
      purchOrg: header?.PURCH_ORG,
      currency: header?.CURRENCY,
      status: header?.STATUS
    }
  });
}

/**
 * Validate vendor on invoice matches PO vendor.
 * @param {string} poNumber - PO number
 * @param {string} invoiceVendorId - Vendor ID from invoice
 * @returns {Promise<ValidationResult>}
 */
async function validatePOVendorMatch(poNumber, invoiceVendorId) {
  const poDetail = await getPODetailWithCache(poNumber);
  
  if (!poDetail) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `PO ${poNumber} not found`
    });
  }
  
  const poVendor = poDetail.POHEADER?.VENDOR;
  const normalizedInvoiceVendor = normalizeVendorNumberPadded(invoiceVendorId);
  const normalizedPOVendor = normalizeVendorNumberPadded(poVendor);
  
  if (normalizedInvoiceVendor === normalizedPOVendor) {
    return createValidationResult(true, 1.0, 'purchaseOrder', {
      message: 'Invoice vendor matches PO vendor',
      metadata: { poVendor, invoiceVendor: invoiceVendorId }
    });
  }
  
  return createValidationResult(false, 0, 'purchaseOrder', {
    message: `Vendor mismatch: Invoice vendor ${invoiceVendorId} does not match PO vendor ${poVendor}`,
    metadata: { poVendor, invoiceVendor: invoiceVendorId }
  });
}

/**
 * Find matching PO line item for invoice line.
 * @param {string} poNumber - PO number
 * @param {Object} invoiceLine - Invoice line item
 * @param {string} [invoiceLine.poLineNumber] - PO line number if provided
 * @param {string} [invoiceLine.material] - Material number
 * @param {string} [invoiceLine.description] - Line description
 * @param {number} [invoiceLine.quantity] - Quantity
 * @param {number} [invoiceLine.unitPrice] - Unit price
 * @returns {Promise<{lineItem: Object|null, confidence: number, matchStrategy: string}>}
 */
async function findMatchingPOLineItem(poNumber, invoiceLine) {
  const poDetail = await getPODetailWithCache(poNumber);
  
  if (!poDetail || !poDetail.POITEM) {
    return { lineItem: null, confidence: 0, matchStrategy: 'none' };
  }
  
  const poItems = Array.isArray(poDetail.POITEM) ? poDetail.POITEM : [poDetail.POITEM];
  
  // Strategy 1: Exact PO line number match
  if (invoiceLine.poLineNumber) {
    const exactMatch = poItems.find(item => 
      item.PO_ITEM === invoiceLine.poLineNumber ||
      parseInt(item.PO_ITEM) === parseInt(invoiceLine.poLineNumber)
    );
    
    if (exactMatch) {
      return { lineItem: exactMatch, confidence: 1.0, matchStrategy: 'po_line_number' };
    }
  }
  
  // Strategy 2: Material number match
  if (invoiceLine.material) {
    const materialMatch = poItems.find(item => 
      item.MATERIAL === invoiceLine.material ||
      item.MATERIAL?.replace(/^0+/, '') === invoiceLine.material?.replace(/^0+/, '')
    );
    
    if (materialMatch) {
      return { lineItem: materialMatch, confidence: 0.95, matchStrategy: 'material_number' };
    }
  }
  
  // Strategy 3: Description + quantity/price matching
  if (invoiceLine.description) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const item of poItems) {
      const descScore = levenshteinSimilarity(
        invoiceLine.description.toLowerCase(),
        (item.SHORT_TEXT || '').toLowerCase()
      );
      
      let priceScore = 0;
      if (invoiceLine.unitPrice && item.NET_PRICE) {
        const priceDiff = Math.abs(invoiceLine.unitPrice - parseFloat(item.NET_PRICE)) / parseFloat(item.NET_PRICE);
        priceScore = priceDiff < 0.05 ? 0.3 : priceDiff < 0.1 ? 0.15 : 0;
      }
      
      const totalScore = descScore * 0.7 + priceScore;
      
      if (totalScore > bestScore && totalScore > 0.5) {
        bestScore = totalScore;
        bestMatch = item;
      }
    }
    
    if (bestMatch) {
      return { lineItem: bestMatch, confidence: bestScore, matchStrategy: 'description_price' };
    }
  }
  
  // Strategy 4: Single line PO - auto-match
  if (poItems.length === 1) {
    return { lineItem: poItems[0], confidence: 0.7, matchStrategy: 'single_line_po' };
  }
  
  return { lineItem: null, confidence: 0, matchStrategy: 'none' };
}


/**
 * Get GR (Goods Receipt) information for a PO line.
 * @param {string} poNumber - PO number
 * @param {string} poLineNumber - PO line number
 * @returns {Promise<GRVerificationResult>}
 */
async function getGRInfoForPOLine(poNumber, poLineNumber) {
  const poDetail = await getPODetailExtended(poNumber);
  
  if (!poDetail) {
    return {
      grExists: false,
      grQuantity: 0,
      grValue: 0,
      openQuantity: 0,
      openValue: 0
    };
  }
  
  // Find the PO line
  const poItems = Array.isArray(poDetail.POITEM) ? poDetail.POITEM : [poDetail.POITEM];
  const lineItem = poItems.find(item => 
    item.PO_ITEM === poLineNumber || 
    parseInt(item.PO_ITEM) === parseInt(poLineNumber)
  );
  
  if (!lineItem) {
    return {
      grExists: false,
      grQuantity: 0,
      grValue: 0,
      openQuantity: 0,
      openValue: 0
    };
  }
  
  // Extract GR quantities from PO item history/schedule lines
  const orderedQty = parseFloat(lineItem.QUANTITY) || 0;
  const deliveredQty = parseFloat(lineItem.GR_QUANTITY) || parseFloat(lineItem.DELIV_QTY) || 0;
  const invoicedQty = parseFloat(lineItem.IV_QUANTITY) || parseFloat(lineItem.INV_QTY) || 0;
  const unitPrice = parseFloat(lineItem.NET_PRICE) || 0;
  
  const openQty = Math.max(0, deliveredQty - invoicedQty);
  
  return {
    grExists: deliveredQty > 0,
    grQuantity: deliveredQty,
    grValue: deliveredQty * unitPrice,
    openQuantity: openQty,
    openValue: openQty * unitPrice,
    orderedQuantity: orderedQty,
    invoicedQuantity: invoicedQty,
    unitPrice
  };
}

/**
 * Perform 2-way match (PO to Invoice).
 * @param {Object} params - Match parameters
 * @param {string} params.poNumber - PO number
 * @param {string} params.poLineNumber - PO line number
 * @param {number} params.invoiceQuantity - Invoice quantity
 * @param {number} params.invoiceUnitPrice - Invoice unit price
 * @param {number} params.invoiceAmount - Invoice line amount
 * @param {Object} [params.tolerances] - Tolerance settings
 * @returns {Promise<POMatchResult>}
 */
async function perform2WayMatch(params) {
  const { 
    poNumber, 
    poLineNumber, 
    invoiceQuantity, 
    invoiceUnitPrice, 
    invoiceAmount,
    tolerances = { quantity: 0.05, price: 0.05, amount: 0.05 }
  } = params;
  
  const poDetail = await getPODetailWithCache(poNumber);
  if (!poDetail) {
    return {
      isMatched: false,
      matchType: '2-way',
      confidence: 0,
      issues: [`PO ${poNumber} not found`]
    };
  }
  
  const poItems = Array.isArray(poDetail.POITEM) ? poDetail.POITEM : [poDetail.POITEM];
  const poLine = poItems.find(item => 
    item.PO_ITEM === poLineNumber || 
    parseInt(item.PO_ITEM) === parseInt(poLineNumber)
  );
  
  if (!poLine) {
    return {
      isMatched: false,
      matchType: '2-way',
      confidence: 0,
      issues: [`PO line ${poLineNumber} not found`]
    };
  }
  
  const poQuantity = parseFloat(poLine.QUANTITY) || 0;
  const poUnitPrice = parseFloat(poLine.NET_PRICE) || 0;
  const poAmount = poQuantity * poUnitPrice;
  
  const issues = [];
  const variances = {};
  let confidence = 1.0;
  
  // Check quantity variance
  if (poQuantity > 0) {
    const qtyVariance = (invoiceQuantity - poQuantity) / poQuantity;
    variances.quantity = { po: poQuantity, invoice: invoiceQuantity, variance: qtyVariance };
    
    if (Math.abs(qtyVariance) > tolerances.quantity) {
      issues.push(`Quantity variance ${(qtyVariance * 100).toFixed(2)}% exceeds tolerance`);
      confidence -= 0.3;
    }
  }
  
  // Check price variance
  if (poUnitPrice > 0) {
    const priceVariance = (invoiceUnitPrice - poUnitPrice) / poUnitPrice;
    variances.unitPrice = { po: poUnitPrice, invoice: invoiceUnitPrice, variance: priceVariance };
    
    if (Math.abs(priceVariance) > tolerances.price) {
      issues.push(`Price variance ${(priceVariance * 100).toFixed(2)}% exceeds tolerance`);
      confidence -= 0.3;
    }
  }
  
  // Check amount variance
  if (poAmount > 0) {
    const amountVariance = (invoiceAmount - poAmount) / poAmount;
    variances.amount = { po: poAmount, invoice: invoiceAmount, variance: amountVariance };
    
    if (Math.abs(amountVariance) > tolerances.amount) {
      issues.push(`Amount variance ${(amountVariance * 100).toFixed(2)}% exceeds tolerance`);
      confidence -= 0.2;
    }
  }
  
  confidence = Math.max(0, confidence);
  
  return {
    isMatched: issues.length === 0,
    matchType: '2-way',
    confidence,
    variances,
    issues,
    poLineDetails: {
      material: poLine.MATERIAL,
      description: poLine.SHORT_TEXT,
      quantity: poQuantity,
      unitPrice: poUnitPrice,
      unit: poLine.PO_UNIT
    }
  };
}


/**
 * Perform 3-way match (PO to GR to Invoice).
 * @param {Object} params - Match parameters
 * @param {string} params.poNumber - PO number
 * @param {string} params.poLineNumber - PO line number
 * @param {number} params.invoiceQuantity - Invoice quantity
 * @param {number} params.invoiceUnitPrice - Invoice unit price
 * @param {number} params.invoiceAmount - Invoice line amount
 * @param {Object} [params.tolerances] - Tolerance settings
 * @returns {Promise<POMatchResult>}
 */
async function perform3WayMatch(params) {
  const { 
    poNumber, 
    poLineNumber, 
    invoiceQuantity, 
    invoiceUnitPrice, 
    invoiceAmount,
    tolerances = { quantity: 0.05, price: 0.05, amount: 0.05 }
  } = params;
  
  // First perform 2-way match
  const twoWayResult = await perform2WayMatch(params);
  
  // Get GR information
  const grInfo = await getGRInfoForPOLine(poNumber, poLineNumber);
  
  const issues = [...(twoWayResult.issues || [])];
  const variances = { ...twoWayResult.variances };
  let confidence = twoWayResult.confidence;
  
  // Check if GR exists
  if (!grInfo.grExists) {
    issues.push('No Goods Receipt found for this PO line');
    confidence -= 0.4;
    
    return {
      isMatched: false,
      matchType: '3-way',
      confidence: Math.max(0, confidence),
      variances,
      issues,
      grInfo,
      recommendation: 'Invoice requires GR before processing (GR-based IV)'
    };
  }
  
  // Check GR quantity vs invoice quantity
  const grQtyVariance = (invoiceQuantity - grInfo.openQuantity) / (grInfo.openQuantity || 1);
  variances.grQuantity = { 
    gr: grInfo.grQuantity, 
    open: grInfo.openQuantity,
    invoice: invoiceQuantity, 
    variance: grQtyVariance 
  };
  
  if (invoiceQuantity > grInfo.openQuantity * (1 + tolerances.quantity)) {
    issues.push(`Invoice quantity ${invoiceQuantity} exceeds open GR quantity ${grInfo.openQuantity}`);
    confidence -= 0.3;
  }
  
  // Check invoice value vs open GR value
  if (grInfo.openValue > 0) {
    const valueVariance = (invoiceAmount - grInfo.openValue) / grInfo.openValue;
    variances.grValue = { 
      grOpen: grInfo.openValue, 
      invoice: invoiceAmount, 
      variance: valueVariance 
    };
    
    if (Math.abs(valueVariance) > tolerances.amount) {
      issues.push(`Invoice amount variance ${(valueVariance * 100).toFixed(2)}% from open GR value`);
      confidence -= 0.2;
    }
  }
  
  confidence = Math.max(0, confidence);
  
  return {
    isMatched: issues.length === 0,
    matchType: '3-way',
    confidence,
    variances,
    issues,
    grInfo,
    recommendation: issues.length === 0 
      ? 'Ready for automatic posting'
      : confidence > 0.6 
        ? 'Minor variances - review recommended'
        : 'Significant variances - manual review required'
  };
}

/**
 * Verify invoice can be posted against GR.
 * @param {string} poNumber - PO number
 * @param {string} poLineNumber - PO line number
 * @param {number} invoiceQuantity - Invoice quantity
 * @param {number} invoiceAmount - Invoice amount
 * @returns {Promise<ValidationResult>}
 */
async function verifyGRBasedInvoice(poNumber, poLineNumber, invoiceQuantity, invoiceAmount) {
  const grInfo = await getGRInfoForPOLine(poNumber, poLineNumber);
  
  if (!grInfo.grExists) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: 'No Goods Receipt exists for this PO line',
      metadata: { poNumber, poLineNumber, grInfo }
    });
  }
  
  if (grInfo.openQuantity <= 0) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: 'No open quantity available for invoicing - GR fully invoiced',
      metadata: { grInfo }
    });
  }
  
  if (invoiceQuantity > grInfo.openQuantity * 1.05) {
    return createValidationResult(false, 0.3, 'purchaseOrder', {
      message: `Invoice quantity ${invoiceQuantity} exceeds open GR quantity ${grInfo.openQuantity}`,
      metadata: { grInfo, invoiceQuantity }
    });
  }
  
  if (invoiceAmount > grInfo.openValue * 1.1) {
    return createValidationResult(true, 0.7, 'purchaseOrder', {
      message: `Invoice amount ${invoiceAmount} exceeds expected GR value ${grInfo.openValue} - review recommended`,
      metadata: { grInfo, invoiceAmount }
    });
  }
  
  return createValidationResult(true, 1.0, 'purchaseOrder', {
    message: 'Invoice verified against Goods Receipt',
    metadata: { grInfo, invoiceQuantity, invoiceAmount }
  });
}


/**
 * Get complete PO matching summary for an invoice.
 * @param {Object} invoice - Invoice data
 * @param {string} invoice.poNumber - PO number
 * @param {string} invoice.vendorId - Vendor ID
 * @param {Array} invoice.lineItems - Invoice line items
 * @param {Object} [tolerances] - Tolerance settings
 * @returns {Promise<Object>}
 */
async function getInvoicePOMatchSummary(invoice, tolerances) {
  const { poNumber, vendorId, lineItems } = invoice;
  
  const summary = {
    poNumber,
    poExists: false,
    vendorMatches: false,
    lineItemMatches: [],
    overallMatch: false,
    matchType: 'none',
    overallConfidence: 0,
    issues: [],
    recommendations: []
  };
  
  // Check PO exists
  const poResult = await validatePOExists(poNumber);
  summary.poExists = poResult.isValid;
  
  if (!summary.poExists) {
    summary.issues.push(`PO ${poNumber} not found`);
    return summary;
  }
  
  // Check vendor match
  const vendorResult = await validatePOVendorMatch(poNumber, vendorId);
  summary.vendorMatches = vendorResult.isValid;
  
  if (!summary.vendorMatches) {
    summary.issues.push(vendorResult.message);
    summary.recommendations.push('Verify invoice vendor against PO');
  }
  
  // Match each line item
  for (const line of lineItems) {
    const lineMatch = await findMatchingPOLineItem(poNumber, line);
    
    if (!lineMatch.lineItem) {
      summary.lineItemMatches.push({
        invoiceLine: line,
        matched: false,
        confidence: 0,
        issues: ['No matching PO line found']
      });
      continue;
    }
    
    // Perform 3-way match for each matched line
    const matchResult = await perform3WayMatch({
      poNumber,
      poLineNumber: lineMatch.lineItem.PO_ITEM,
      invoiceQuantity: line.quantity || 0,
      invoiceUnitPrice: line.unitPrice || 0,
      invoiceAmount: line.amount || (line.quantity * line.unitPrice) || 0,
      tolerances
    });
    
    summary.lineItemMatches.push({
      invoiceLine: line,
      poLine: lineMatch.lineItem.PO_ITEM,
      matched: matchResult.isMatched,
      confidence: matchResult.confidence,
      matchType: matchResult.matchType,
      variances: matchResult.variances,
      issues: matchResult.issues,
      grInfo: matchResult.grInfo
    });
  }
  
  // Calculate overall match status
  const matchedLines = summary.lineItemMatches.filter(l => l.matched);
  const confidences = summary.lineItemMatches.map(l => l.confidence);
  
  summary.overallConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  
  summary.overallMatch = 
    summary.vendorMatches && 
    matchedLines.length === lineItems.length &&
    summary.overallConfidence >= 0.8;
  
  summary.matchType = summary.lineItemMatches.some(l => l.grInfo?.grExists) 
    ? '3-way' 
    : '2-way';
  
  // Generate recommendations
  if (summary.overallMatch) {
    summary.recommendations.push('Invoice ready for automatic posting');
  } else if (summary.overallConfidence >= 0.6) {
    summary.recommendations.push('Invoice requires review before posting');
  } else {
    summary.recommendations.push('Invoice requires manual processing');
  }
  
  return summary;
}

/**
 * Search for POs matching invoice criteria.
 * @param {Object} criteria - Search criteria
 * @param {string} criteria.vendorId - Vendor ID
 * @param {string} criteria.companyCode - Company code
 * @param {number} [criteria.amount] - Approximate invoice amount
 * @param {string} [criteria.material] - Material number
 * @param {number} [limit=5] - Max results
 * @returns {Promise<Array>}
 */
async function searchMatchingPOs(criteria, limit = 5) {
  const { vendorId, companyCode, amount, material } = criteria;
  
  // Would query PO list from ECC - simplified implementation
  // In real scenario, would use BAPI_PO_GETITEMS or similar
  
  try {
    const ecc = await getEccService();
    const paddedVendor = normalizeVendorNumberPadded(vendorId);
    
    // This is a placeholder - actual implementation would search PO documents
    // The ECC CDS doesn't expose a PO search function directly
    
    return [];
  } catch (error) {
    console.error('Error searching POs:', error);
    return [];
  }
}

/**
 * Validate PO is open for invoicing.
 * @param {string} poNumber - PO number
 * @returns {Promise<ValidationResult>}
 */
async function validatePOOpenForInvoicing(poNumber) {
  const poDetail = await getPODetailWithCache(poNumber);
  
  if (!poDetail) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `PO ${poNumber} not found`
    });
  }
  
  // Check PO status
  const status = poDetail.POHEADER?.STATUS;
  const deletionIndicator = poDetail.POHEADER?.DELETE_IND;
  
  if (deletionIndicator === 'X' || deletionIndicator === 'L') {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `PO ${poNumber} is flagged for deletion`,
      metadata: { status, deletionIndicator }
    });
  }
  
  // Check if any lines are open for invoicing
  const poItems = Array.isArray(poDetail.POITEM) ? poDetail.POITEM : [poDetail.POITEM];
  
  let hasOpenLines = false;
  for (const item of poItems) {
    const finalInvoice = item.FINAL_INV === 'X';
    if (!finalInvoice) {
      hasOpenLines = true;
      break;
    }
  }
  
  if (!hasOpenLines) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `PO ${poNumber} is fully invoiced (final invoice flag set)`,
      metadata: { status }
    });
  }
  
  return createValidationResult(true, 1.0, 'purchaseOrder', {
    message: `PO ${poNumber} is open for invoicing`,
    metadata: { status, lineCount: poItems.length }
  });
}

module.exports = {
  getPODetailWithCache,
  getPODetailExtended,
  validatePOExists,
  validatePOVendorMatch,
  findMatchingPOLineItem,
  getGRInfoForPOLine,
  perform2WayMatch,
  perform3WayMatch,
  verifyGRBasedInvoice,
  getInvoicePOMatchSummary,
  searchMatchingPOs,
  validatePOOpenForInvoicing
};
