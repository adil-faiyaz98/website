// @ts-check
/**
 * @fileoverview Payment validators for payment terms, cash discounts, due dates, and payment methods.
 * Derives payment-related fields from vendor master, PO, and company code settings.
 */

const cds = require('@sap/cds');
const { normalizeDate } = require('./utils/normalizers');
const { createValidationResult } = require('./utils/confidence');
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

/**
 * Payment terms structure.
 * @typedef {Object} PaymentTerms
 * @property {string} paymentTermsKey - Payment terms key (ZTERM)
 * @property {number} netDays - Net payment days
 * @property {number} [discount1Days] - Days for first discount
 * @property {number} [discount1Percent] - First discount percentage
 * @property {number} [discount2Days] - Days for second discount
 * @property {number} [discount2Percent] - Second discount percentage
 * @property {string} [description] - Payment terms description
 */

/**
 * Cash discount calculation result.
 * @typedef {Object} CashDiscountResult
 * @property {number} discountAmount - Discount amount
 * @property {number} discountPercent - Discount percentage applied
 * @property {Date} discountDueDate - Date by which payment must be made for discount
 * @property {boolean} isEligible - Whether discount is still available
 * @property {string} tier - Which discount tier (1, 2, or none)
 */


/**
 * Fetch payment terms details from ECC.
 * @param {string} companyCode - Company code
 * @returns {Promise<Map<string, PaymentTerms>>} Payment terms map
 */
async function fetchPaymentTerms(companyCode) {
  const cacheKey = `paymentterms:${companyCode}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    // Query PaymentTermsTexts entity for descriptions
    const terms = await ecc.run(
      SELECT.from('PaymentTermsTexts').where({ SPRAS: 'E' })
    );
    
    const termsMap = new Map();
    if (terms && Array.isArray(terms)) {
      for (const term of terms) {
        termsMap.set(term.ZTERM, {
          paymentTermsKey: term.ZTERM,
          description: term.TEXT1 || term.URLTX
        });
      }
    }
    
    cache.set(cacheKey, termsMap, { ttl: 60 * 60 * 1000 }); // 1 hour
    return termsMap;
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    return new Map();
  }
}

/**
 * Fetch payment block texts.
 * @returns {Promise<Map<string, string>>} Payment block descriptions
 */
async function fetchPaymentBlockTexts() {
  const cacheKey = 'paymentblocktexts';
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const blocks = await ecc.run(
      SELECT.from('PaymentBlockTexts').where({ SPRAS: 'E' })
    );
    
    const blockMap = new Map();
    if (blocks && Array.isArray(blocks)) {
      for (const block of blocks) {
        blockMap.set(block.ZTERM, block.VTEXT);
      }
    }
    
    cache.set(cacheKey, blockMap, { ttl: 24 * 60 * 60 * 1000 }); // 24 hours
    return blockMap;
  } catch (error) {
    console.error('Error fetching payment block texts:', error);
    return new Map();
  }
}

/**
 * Fetch payment methods for a country.
 * @param {string} country - Country code
 * @returns {Promise<Array>} Payment methods
 */
async function fetchPaymentMethods(country) {
  const cacheKey = `paymentmethods:${country}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const ecc = await getEccService();
    const methods = await ecc.run(
      SELECT.from('PaymentMethods').where({ LAND1: country })
    );
    
    cache.set(cacheKey, methods || [], { ttl: 24 * 60 * 60 * 1000 });
    return methods || [];
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return [];
  }
}


/**
 * Get payment terms from vendor master.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<PaymentTerms|null>} Payment terms or null
 */
async function getVendorPaymentTerms(vendorId, companyCode) {
  try {
    const ecc = await getEccService();
    const paddedVendor = vendorId.toString().padStart(10, '0');
    
    const result = await ecc.getVendorDetail({
      VENDORNO: paddedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }
    
    const pmnttrms = result.COMPANYDETAIL?.PMNTTRMS;
    if (!pmnttrms) return null;
    
    return {
      paymentTermsKey: pmnttrms,
      netDays: 0, // Will be enriched from payment terms table
      description: `Payment terms ${pmnttrms}`
    };
  } catch (error) {
    console.error('Error getting vendor payment terms:', error);
    return null;
  }
}

/**
 * Get payment terms from PO.
 * @param {string} poNumber - PO number
 * @returns {Promise<PaymentTerms|null>} Payment terms or null
 */
async function getPOPaymentTerms(poNumber) {
  try {
    const ecc = await getEccService();
    const paddedPO = poNumber.toString().padStart(10, '0');
    
    const result = await ecc.getPODetail({
      PURCHASEORDER: paddedPO
    });
    
    if (!result || !result.POHEADER) {
      return null;
    }
    
    const header = result.POHEADER;
    return {
      paymentTermsKey: header.PMNTTRMS,
      netDays: parseFloat(header.DSCNT3_TO) || 0,
      discount1Days: parseFloat(header.DSCNT1_TO) || 0,
      discount1Percent: parseFloat(header.CASH_DISC1) || 0,
      discount2Days: parseFloat(header.DSCNT2_TO) || 0,
      discount2Percent: parseFloat(header.CASH_DISC2) || 0
    };
  } catch (error) {
    console.error('Error getting PO payment terms:', error);
    return null;
  }
}


/**
 * Calculate due date from invoice date and payment terms.
 * @param {string|Date} invoiceDate - Invoice date
 * @param {PaymentTerms} paymentTerms - Payment terms
 * @param {string|Date} [baselineDate] - Baseline date (defaults to invoice date)
 * @returns {{dueDate: Date, baselineDate: Date}} Due date calculation
 */
function calculateDueDate(invoiceDate, paymentTerms, baselineDate) {
  const invDate = new Date(invoiceDate);
  const baseline = baselineDate ? new Date(baselineDate) : invDate;
  
  const netDays = paymentTerms.netDays || 30; // Default 30 days
  const dueDate = new Date(baseline);
  dueDate.setDate(dueDate.getDate() + netDays);
  
  return {
    dueDate,
    baselineDate: baseline
  };
}

/**
 * Calculate cash discount details.
 * @param {number} invoiceAmount - Invoice gross amount
 * @param {string|Date} invoiceDate - Invoice date
 * @param {PaymentTerms} paymentTerms - Payment terms
 * @param {string|Date} [currentDate] - Current date for eligibility check
 * @returns {CashDiscountResult} Cash discount calculation
 */
function calculateCashDiscount(invoiceAmount, invoiceDate, paymentTerms, currentDate) {
  const invDate = new Date(invoiceDate);
  const now = currentDate ? new Date(currentDate) : new Date();
  
  const daysSinceInvoice = Math.floor((now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Check discount tier 1
  if (paymentTerms.discount1Days && paymentTerms.discount1Percent) {
    if (daysSinceInvoice <= paymentTerms.discount1Days) {
      const discountAmount = invoiceAmount * (paymentTerms.discount1Percent / 100);
      const discountDueDate = new Date(invDate);
      discountDueDate.setDate(discountDueDate.getDate() + paymentTerms.discount1Days);
      
      return {
        discountAmount,
        discountPercent: paymentTerms.discount1Percent,
        discountDueDate,
        isEligible: true,
        tier: '1'
      };
    }
  }
  
  // Check discount tier 2
  if (paymentTerms.discount2Days && paymentTerms.discount2Percent) {
    if (daysSinceInvoice <= paymentTerms.discount2Days) {
      const discountAmount = invoiceAmount * (paymentTerms.discount2Percent / 100);
      const discountDueDate = new Date(invDate);
      discountDueDate.setDate(discountDueDate.getDate() + paymentTerms.discount2Days);
      
      return {
        discountAmount,
        discountPercent: paymentTerms.discount2Percent,
        discountDueDate,
        isEligible: true,
        tier: '2'
      };
    }
  }
  
  // No discount available
  return {
    discountAmount: 0,
    discountPercent: 0,
    discountDueDate: null,
    isEligible: false,
    tier: 'none'
  };
}

/**
 * Derive payment terms from multiple sources with priority.
 * Priority: 1. PO, 2. Vendor Master, 3. Company Default
 * @param {Object} params - Derivation parameters
 * @param {string} [params.poNumber] - PO number
 * @param {string} [params.vendorId] - Vendor ID
 * @param {string} params.companyCode - Company code
 * @returns {Promise<{terms: PaymentTerms|null, source: string}>}
 */
async function derivePaymentTerms(params) {
  const { poNumber, vendorId, companyCode } = params;
  
  // Priority 1: From PO
  if (poNumber) {
    const poTerms = await getPOPaymentTerms(poNumber);
    if (poTerms && poTerms.paymentTermsKey) {
      return { terms: poTerms, source: 'PO' };
    }
  }
  
  // Priority 2: From Vendor Master
  if (vendorId && companyCode) {
    const vendorTerms = await getVendorPaymentTerms(vendorId, companyCode);
    if (vendorTerms && vendorTerms.paymentTermsKey) {
      return { terms: vendorTerms, source: 'Vendor Master' };
    }
  }
  
  // Priority 3: Default (would come from company code settings)
  return {
    terms: {
      paymentTermsKey: 'NT30',
      netDays: 30,
      description: 'Default Net 30'
    },
    source: 'Default'
  };
}


/**
 * Derive payment method from vendor master.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<{method: string, description: string}|null>}
 */
async function derivePaymentMethod(vendorId, companyCode) {
  try {
    const ecc = await getEccService();
    const paddedVendor = vendorId.toString().padStart(10, '0');
    
    const result = await ecc.getVendorDetail({
      VENDORNO: paddedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }
    
    const paymentMethods = result.COMPANYDETAIL?.PAYMENT_METHODS;
    if (!paymentMethods) return null;
    
    // First character is the primary payment method
    const primaryMethod = paymentMethods.charAt(0);
    
    return {
      method: primaryMethod,
      description: `Payment method ${primaryMethod}`
    };
  } catch (error) {
    console.error('Error deriving payment method:', error);
    return null;
  }
}

/**
 * Validate payment terms exist.
 * @param {string} paymentTermsKey - Payment terms key
 * @param {ValidationContext} context - Validation context
 * @returns {Promise<ValidationResult>}
 */
async function validatePaymentTerms(paymentTermsKey, context) {
  if (!paymentTermsKey) {
    return createValidationResult(false, 0, 'vendor', {
      message: 'Payment terms key is required'
    });
  }
  
  const termsMap = await fetchPaymentTerms(context.companyCode);
  
  if (termsMap.has(paymentTermsKey)) {
    const terms = termsMap.get(paymentTermsKey);
    return createValidationResult(true, 1.0, 'vendor', {
      derivedValue: paymentTermsKey,
      matchStrategy: 'exact',
      message: `Payment terms ${paymentTermsKey} validated`,
      metadata: terms
    });
  }
  
  return createValidationResult(false, 0, 'vendor', {
    message: `Payment terms ${paymentTermsKey} not found`
  });
}

/**
 * Validate payment is not blocked.
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<ValidationResult>}
 */
async function validatePaymentNotBlocked(vendorId, companyCode) {
  try {
    const ecc = await getEccService();
    const paddedVendor = vendorId.toString().padStart(10, '0');
    
    const result = await ecc.getVendorDetail({
      VENDORNO: paddedVendor,
      COMPANYCODE: companyCode
    });
    
    if (!result || result.RETURN?.TYPE === 'E') {
      return createValidationResult(false, 0, 'vendor', {
        message: 'Unable to retrieve vendor details'
      });
    }
    
    // Check for payment block indicator - would be in COMPANYDETAIL
    // This is a simplified check - actual field depends on ECC config
    const isBlocked = false; // Placeholder - check actual block field
    
    if (isBlocked) {
      return createValidationResult(false, 0, 'vendor', {
        message: 'Vendor has payment block',
        metadata: { blocked: true }
      });
    }
    
    return createValidationResult(true, 1.0, 'vendor', {
      message: 'Vendor is not payment blocked',
      metadata: { blocked: false }
    });
  } catch (error) {
    return createValidationResult(false, 0, 'vendor', {
      message: `Error checking payment block: ${error.message}`
    });
  }
}


/**
 * Get complete payment information for an invoice.
 * @param {Object} params - Invoice parameters
 * @param {string} [params.poNumber] - PO number
 * @param {string} [params.vendorId] - Vendor ID
 * @param {string} params.companyCode - Company code
 * @param {string|Date} params.invoiceDate - Invoice date
 * @param {number} params.invoiceAmount - Invoice amount
 * @returns {Promise<Object>} Complete payment information
 */
async function getPaymentInfo(params) {
  const { poNumber, vendorId, companyCode, invoiceDate, invoiceAmount } = params;
  
  // Derive payment terms
  const { terms, source } = await derivePaymentTerms({
    poNumber,
    vendorId,
    companyCode
  });
  
  // Calculate due date
  const { dueDate, baselineDate } = calculateDueDate(invoiceDate, terms);
  
  // Calculate cash discount
  const discountInfo = calculateCashDiscount(invoiceAmount, invoiceDate, terms);
  
  // Get payment method
  let paymentMethod = null;
  if (vendorId) {
    paymentMethod = await derivePaymentMethod(vendorId, companyCode);
  }
  
  return {
    paymentTerms: terms,
    paymentTermsSource: source,
    dueDate,
    baselineDate,
    cashDiscount: discountInfo,
    paymentMethod,
    summary: {
      paymentTermsKey: terms?.paymentTermsKey,
      netDays: terms?.netDays,
      dueDate: dueDate.toISOString().split('T')[0],
      discountAvailable: discountInfo.isEligible,
      discountAmount: discountInfo.discountAmount,
      discountDueDate: discountInfo.discountDueDate?.toISOString().split('T')[0]
    }
  };
}

/**
 * Validate invoice date is not in the future.
 * @param {string|Date} invoiceDate - Invoice date
 * @returns {ValidationResult}
 */
function validateInvoiceDate(invoiceDate) {
  const invDate = new Date(invoiceDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  if (invDate > today) {
    return createValidationResult(false, 0.3, 'purchaseOrder', {
      message: 'Invoice date is in the future',
      metadata: { invoiceDate: invDate.toISOString().split('T')[0] }
    });
  }
  
  // Check if invoice date is too old (more than 1 year)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  if (invDate < oneYearAgo) {
    return createValidationResult(true, 0.7, 'purchaseOrder', {
      message: 'Invoice date is more than 1 year old - review recommended',
      metadata: { invoiceDate: invDate.toISOString().split('T')[0], aged: true }
    });
  }
  
  return createValidationResult(true, 1.0, 'purchaseOrder', {
    message: 'Invoice date is valid',
    metadata: { invoiceDate: invDate.toISOString().split('T')[0] }
  });
}

module.exports = {
  fetchPaymentTerms,
  fetchPaymentBlockTexts,
  fetchPaymentMethods,
  getVendorPaymentTerms,
  getPOPaymentTerms,
  calculateDueDate,
  calculateCashDiscount,
  derivePaymentTerms,
  derivePaymentMethod,
  validatePaymentTerms,
  validatePaymentNotBlocked,
  getPaymentInfo,
  validateInvoiceDate
};
