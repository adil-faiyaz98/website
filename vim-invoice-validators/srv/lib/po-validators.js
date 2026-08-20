// @ts-check
/**
 * @fileoverview Purchase Order validators and field derivation.
 * Validates PO references and derives invoice fields from PO master data.
 */

const cds = require('@sap/cds');
const { normalizePONumber, normalizePONumberPadded, normalizeAmount } = require('./utils/normalizers');
const { calculateMatchScore, findBestMatches } = require('./utils/string-matching');
const { createValidationResult, isAcceptable, combineScores } = require('./utils/confidence');
const cache = require('./cache');

/**
 * @typedef {import('./types').ValidationResult} ValidationResult
 * @typedef {import('./types').DerivationResult} DerivationResult
 * @typedef {import('./types').ValidationContext} ValidationContext
 * @typedef {import('./types').POHeader} POHeader
 * @typedef {import('./types').POLineItem} POLineItem
 */

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}


/**
 * Fetch PO detail from ECC with caching.
 * @param {string} poNumber - Purchase order number
 * @returns {Promise<{header: POHeader, items: POLineItem[]} | null>} PO detail or null
 */
async function fetchPODetail(poNumber) {
  const normalizedPO = normalizePONumberPadded(poNumber);
  
  // Check cache first
  const cached = cache.getCachedPODetail(normalizedPO);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const result = await ecc.getPODetail({
      PURCHASEORDER: normalizedPO,
      ITEMS: 'X',
      ACCOUNT_ASSIGNMENT: 'X'
    });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }
    
    const poDetail = transformPODetail(result);
    
    // Cache the result
    if (poDetail) {
      cache.cachePODetail(normalizedPO, poDetail);
    }
    
    return poDetail;
  } catch (error) {
    console.error(`Error fetching PO ${normalizedPO}:`, error);
    return null;
  }
}

/**
 * Transform ECC PO response to internal format.
 * @param {any} eccResponse - Raw ECC response
 * @returns {{header: POHeader, items: POLineItem[]}} Transformed PO data
 */
function transformPODetail(eccResponse) {
  const header = {
    poNumber: eccResponse.POHEADER?.PO_NUMBER || eccResponse.PO_NUMBER,
    companyCode: eccResponse.POHEADER?.CO_CODE,
    vendorId: eccResponse.POHEADER?.VENDOR,
    vendorName: eccResponse.POHEADER?.VEND_NAME,
    currency: eccResponse.POHEADER?.CURRENCY,
    docType: eccResponse.POHEADER?.DOC_TYPE,
    purchaseOrg: eccResponse.POHEADER?.PURCH_ORG,
    purchaseGroup: eccResponse.POHEADER?.PUR_GROUP,
    docDate: eccResponse.POHEADER?.DOC_DATE,
    paymentTerms: eccResponse.POHEADER?.PMNTTRMS
  };
  
  const items = (eccResponse.POITEM || []).map(item => ({
    poNumber: item.PO_NUMBER,
    poItem: item.PO_ITEM,
    material: item.MATERIAL,
    shortText: item.SHORT_TEXT,
    plant: item.PLANT,
    netPrice: normalizeAmount(item.NET_PRICE),
    quantity: normalizeAmount(item.QUANTITY || item.PO_QUANTITY),
    unit: item.PO_UNIT || item.UNIT,
    taxCode: item.TAX_CODE,
    accountAssignmentCategory: item.ACCTASSCAT,
    glAccount: null,
    costCenter: null
  }));
  
  // Merge account assignment data if available
  if (eccResponse.POACCOUNT) {
    for (const acct of eccResponse.POACCOUNT) {
      const item = items.find(i => i.poItem === acct.PO_ITEM);
      if (item) {
        item.glAccount = acct.GL_ACCOUNT;
        item.costCenter = acct.COSTCENTER;
      }
    }
  }
  
  return { header, items };
}


/**
 * Validate a PO number exists and is valid.
 * @param {string} poNumber - PO number to validate
 * @param {ValidationContext} [context] - Validation context
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validatePONumber(poNumber, context = {}) {
  if (!poNumber) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: 'PO number is required'
    });
  }
  
  const normalizedPO = normalizePONumberPadded(poNumber);
  const poDetail = await fetchPODetail(normalizedPO);
  
  if (!poDetail) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `Purchase Order ${poNumber} not found in ECC`
    });
  }
  
  // Check company code if provided in context
  if (context.companyCode && poDetail.header.companyCode) {
    if (poDetail.header.companyCode !== context.companyCode) {
      return createValidationResult(false, 0.3, 'purchaseOrder', {
        message: `PO ${poNumber} belongs to company ${poDetail.header.companyCode}, not ${context.companyCode}`,
        derivedValue: normalizedPO
      });
    }
  }
  
  return createValidationResult(true, 1.0, 'purchaseOrder', {
    derivedValue: normalizedPO,
    matchStrategy: 'exact',
    message: `Purchase Order ${normalizedPO} validated`,
    metadata: {
      vendorId: poDetail.header.vendorId,
      vendorName: poDetail.header.vendorName,
      companyCode: poDetail.header.companyCode
    }
  });
}

/**
 * Validate a PO line item exists.
 * @param {string} poNumber - PO number
 * @param {string} poItem - PO item number
 * @param {ValidationContext} [context] - Validation context
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validatePOItem(poNumber, poItem, context = {}) {
  if (!poNumber || !poItem) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: 'PO number and item are required'
    });
  }
  
  const poDetail = await fetchPODetail(poNumber);
  
  if (!poDetail) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `Purchase Order ${poNumber} not found`
    });
  }
  
  // Normalize item number (typically 5 digits)
  const normalizedItem = poItem.toString().padStart(5, '0');
  const matchedItem = poDetail.items.find(i => i.poItem === normalizedItem);
  
  if (!matchedItem) {
    return createValidationResult(false, 0.2, 'purchaseOrder', {
      message: `Item ${poItem} not found in PO ${poNumber}`,
      derivedValue: normalizePONumberPadded(poNumber)
    });
  }
  
  return createValidationResult(true, 1.0, 'purchaseOrder', {
    derivedValue: normalizedItem,
    matchStrategy: 'exact',
    metadata: matchedItem
  });
}


/**
 * Derive invoice header fields from a PO.
 * @param {string} poNumber - PO number
 * @param {ValidationContext} [context] - Validation context
 * @returns {Promise<DerivationResult>} Derived fields
 */
async function deriveFieldsFromPO(poNumber, context = {}) {
  const poDetail = await fetchPODetail(poNumber);
  
  if (!poDetail) {
    return {
      success: false,
      derivedFields: {},
      confidence: 0,
      source: 'PO'
    };
  }
  
  const { header } = poDetail;
  
  const derivedFields = {
    vendorId: header.vendorId,
    vendorName: header.vendorName,
    companyCode: header.companyCode,
    currency: header.currency,
    paymentTerms: header.paymentTerms,
    purchaseOrg: header.purchaseOrg
  };
  
  // Filter out undefined/null values
  const cleanedFields = Object.fromEntries(
    Object.entries(derivedFields).filter(([_, v]) => v != null)
  );
  
  const fieldCount = Object.keys(cleanedFields).length;
  const confidence = fieldCount > 0 ? Math.min(1, 0.5 + (fieldCount * 0.1)) : 0;
  
  return {
    success: fieldCount > 0,
    derivedFields: cleanedFields,
    confidence,
    source: 'PO',
    validations: [{
      isValid: true,
      confidence: 1.0,
      derivedValue: normalizePONumberPadded(poNumber),
      message: `Derived ${fieldCount} fields from PO ${poNumber}`
    }]
  };
}

/**
 * Derive line item fields from a PO item.
 * @param {string} poNumber - PO number
 * @param {string} poItem - PO item number
 * @param {ValidationContext} [context] - Validation context
 * @returns {Promise<DerivationResult>} Derived fields
 */
async function deriveFieldsFromPOItem(poNumber, poItem, context = {}) {
  const poDetail = await fetchPODetail(poNumber);
  
  if (!poDetail) {
    return {
      success: false,
      derivedFields: {},
      confidence: 0,
      source: 'PO Item'
    };
  }
  
  const normalizedItem = poItem.toString().padStart(5, '0');
  const item = poDetail.items.find(i => i.poItem === normalizedItem);
  
  if (!item) {
    return {
      success: false,
      derivedFields: {},
      confidence: 0,
      source: 'PO Item'
    };
  }
  
  const derivedFields = {
    taxCode: item.taxCode,
    glAccount: item.glAccount,
    costCenter: item.costCenter,
    plant: item.plant,
    material: item.material,
    unitPrice: item.netPrice,
    unit: item.unit
  };
  
  const cleanedFields = Object.fromEntries(
    Object.entries(derivedFields).filter(([_, v]) => v != null)
  );
  
  const fieldCount = Object.keys(cleanedFields).length;
  const confidence = fieldCount > 0 ? Math.min(1, 0.5 + (fieldCount * 0.1)) : 0;
  
  return {
    success: fieldCount > 0,
    derivedFields: cleanedFields,
    confidence,
    source: 'PO Item'
  };
}


/**
 * Match invoice line to best PO item by description and amount.
 * @param {string} poNumber - PO number
 * @param {Object} invoiceLine - Invoice line item data
 * @param {string} [invoiceLine.description] - Line description
 * @param {number} [invoiceLine.amount] - Line amount
 * @param {number} [invoiceLine.quantity] - Quantity
 * @param {ValidationContext} [context] - Validation context
 * @returns {Promise<{item: POLineItem, score: number} | null>} Best matching item
 */
async function matchInvoiceLineToPOItem(poNumber, invoiceLine, context = {}) {
  const poDetail = await fetchPODetail(poNumber);
  
  if (!poDetail || poDetail.items.length === 0) {
    return null;
  }
  
  const candidates = [];
  
  for (const item of poDetail.items) {
    let score = 0;
    let matchCount = 0;
    
    // Match by description
    if (invoiceLine.description && item.shortText) {
      const descScore = calculateMatchScore(invoiceLine.description, item.shortText);
      score += descScore.score * 0.4;
      matchCount++;
    }
    
    // Match by amount (within 5% tolerance)
    if (invoiceLine.amount && item.netPrice) {
      const amountDiff = Math.abs(invoiceLine.amount - item.netPrice) / item.netPrice;
      const amountScore = amountDiff <= 0.05 ? 1 : amountDiff <= 0.1 ? 0.8 : amountDiff <= 0.2 ? 0.5 : 0;
      score += amountScore * 0.4;
      matchCount++;
    }
    
    // Match by quantity
    if (invoiceLine.quantity && item.quantity) {
      const qtyMatch = invoiceLine.quantity === item.quantity ? 1 : 0.5;
      score += qtyMatch * 0.2;
      matchCount++;
    }
    
    if (matchCount > 0) {
      candidates.push({ item, score: score / matchCount * matchCount });
    }
  }
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Sort by score and return best match
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Validate invoice amount against PO total.
 * @param {string} poNumber - PO number
 * @param {number} invoiceAmount - Invoice total amount
 * @param {Object} [options] - Validation options
 * @param {number} [options.tolerance=0.01] - Tolerance percentage (default 1%)
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateAmountAgainstPO(poNumber, invoiceAmount, options = {}) {
  const { tolerance = 0.01 } = options;
  
  const poDetail = await fetchPODetail(poNumber);
  
  if (!poDetail) {
    return createValidationResult(false, 0, 'purchaseOrder', {
      message: `PO ${poNumber} not found`
    });
  }
  
  // Calculate PO total
  const poTotal = poDetail.items.reduce((sum, item) => {
    return sum + (item.netPrice * (item.quantity || 1));
  }, 0);
  
  const difference = Math.abs(invoiceAmount - poTotal);
  const percentDiff = poTotal > 0 ? difference / poTotal : 1;
  
  // Determine confidence based on difference
  let confidence = 0;
  let isValid = false;
  
  if (percentDiff <= tolerance) {
    confidence = 1.0;
    isValid = true;
  } else if (percentDiff <= tolerance * 2) {
    confidence = 0.8;
    isValid = true;
  } else if (percentDiff <= tolerance * 5) {
    confidence = 0.5;
    isValid = false;
  } else {
    confidence = 0.2;
    isValid = false;
  }
  
  return createValidationResult(isValid, confidence, 'purchaseOrder', {
    message: isValid 
      ? `Invoice amount matches PO within tolerance`
      : `Invoice amount ${invoiceAmount} differs from PO total ${poTotal.toFixed(2)} by ${(percentDiff * 100).toFixed(1)}%`,
    metadata: {
      poTotal,
      invoiceAmount,
      difference,
      percentDiff
    }
  });
}


/**
 * Search for POs by vendor.
 * @param {string} vendorId - Vendor ID
 * @param {ValidationContext} [context] - Validation context
 * @returns {Promise<POHeader[]>} List of PO headers
 */
async function searchPOsByVendor(vendorId, context = {}) {
  try {
    const ecc = await getEccService();
    const result = await ecc.getPOList({});
    
    if (!result || !result.PO_HEADERS) {
      return [];
    }
    
    // Filter by vendor
    const vendorNorm = vendorId.toString().padStart(10, '0');
    const filtered = result.PO_HEADERS.filter(h => h.VENDOR === vendorNorm);
    
    return filtered.map(h => ({
      poNumber: h.PO_NUMBER,
      companyCode: h.CO_CODE,
      vendorId: h.VENDOR,
      vendorName: h.VEND_NAME,
      currency: h.CURRENCY,
      docType: h.DOC_TYPE,
      purchaseOrg: h.PURCH_ORG,
      purchaseGroup: h.PUR_GROUP,
      docDate: h.DOC_DATE,
      paymentTerms: h.PMNTTRMS
    }));
  } catch (error) {
    console.error('Error searching POs by vendor:', error);
    return [];
  }
}

/**
 * Validate vendor on invoice matches PO vendor.
 * @param {string} poNumber - PO number
 * @param {string} invoiceVendorId - Vendor ID from invoice
 * @param {string} [invoiceVendorName] - Vendor name from invoice
 * @returns {Promise<ValidationResult>} Validation result
 */
async function validateVendorAgainstPO(poNumber, invoiceVendorId, invoiceVendorName) {
  const poDetail = await fetchPODetail(poNumber);
  
  if (!poDetail) {
    return createValidationResult(false, 0, 'vendor', {
      message: `PO ${poNumber} not found`
    });
  }
  
  const poVendorId = poDetail.header.vendorId;
  const poVendorName = poDetail.header.vendorName;
  
  // Compare vendor IDs
  const normInvoiceVendor = invoiceVendorId?.toString().replace(/^0+/, '') || '';
  const normPOVendor = poVendorId?.toString().replace(/^0+/, '') || '';
  
  if (normInvoiceVendor && normPOVendor && normInvoiceVendor === normPOVendor) {
    return createValidationResult(true, 1.0, 'vendor', {
      derivedValue: poVendorId,
      matchStrategy: 'exact',
      message: 'Vendor ID matches PO'
    });
  }
  
  // Try name matching if IDs don't match
  if (invoiceVendorName && poVendorName) {
    const nameScore = calculateMatchScore(invoiceVendorName, poVendorName);
    
    if (nameScore.score >= 0.7) {
      return createValidationResult(true, nameScore.score, 'vendor', {
        derivedValue: poVendorId,
        matchStrategy: nameScore.strategy,
        message: `Vendor name matches PO vendor (${(nameScore.score * 100).toFixed(0)}% confidence)`,
        metadata: {
          poVendorId,
          poVendorName,
          invoiceVendorId,
          invoiceVendorName
        }
      });
    }
  }
  
  return createValidationResult(false, 0.2, 'vendor', {
    message: `Invoice vendor does not match PO vendor (${poVendorName})`,
    metadata: {
      poVendorId,
      poVendorName,
      invoiceVendorId,
      invoiceVendorName
    }
  });
}

module.exports = {
  fetchPODetail,
  validatePONumber,
  validatePOItem,
  deriveFieldsFromPO,
  deriveFieldsFromPOItem,
  matchInvoiceLineToPOItem,
  validateAmountAgainstPO,
  searchPOsByVendor,
  validateVendorAgainstPO
};
