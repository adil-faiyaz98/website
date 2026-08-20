// @ts-check
/**
 * @fileoverview Text normalization utilities for invoice field validation.
 * Handles cleaning, standardizing, and preparing text for matching operations.
 */

/**
 * Normalize a string for comparison by removing extra whitespace,
 * converting to lowercase, and removing special characters.
 * @param {string | null | undefined} str - Input string
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalize a string aggressively - removes all non-alphanumeric characters.
 * Useful for ID comparisons where formatting varies.
 * @param {string | null | undefined} str - Input string
 * @returns {string} Normalized string with only alphanumeric characters
 */
function normalizeAlphanumeric(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalize a vendor/company name for matching.
 * Removes common suffixes (Inc, LLC, GmbH, etc.) and standardizes format.
 * @param {string | null | undefined} name - Company/vendor name
 * @returns {string} Normalized name
 */
function normalizeCompanyName(name) {
  if (!name) return '';
  
  // Common company suffixes to remove
  const suffixes = [
    /\b(inc\.?|incorporated)\b/gi,
    /\b(llc|l\.l\.c\.)\b/gi,
    /\b(ltd\.?|limited)\b/gi,
    /\b(corp\.?|corporation)\b/gi,
    /\b(co\.?|company)\b/gi,
    /\b(gmbh)\b/gi,
    /\b(ag)\b/gi,
    /\b(plc)\b/gi,
    /\b(pvt\.?|private)\b/gi,
    /\b(intl\.?|international)\b/gi,
    /\b(assoc\.?|associates?)\b/gi,
    /\b(& co\.?)\b/gi,
  ];
  
  let normalized = name.toString().toLowerCase().trim();
  
  // Remove suffixes
  for (const suffix of suffixes) {
    normalized = normalized.replace(suffix, '');
  }
  
  // Clean up punctuation and extra spaces
  normalized = normalized
    .replace(/[.,;:'"!?()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

/**
 * Normalize a PO number by removing leading zeros and standardizing format.
 * SAP PO numbers are typically 10 digits with leading zeros.
 * @param {string | null | undefined} poNumber - Purchase order number
 * @returns {string} Normalized PO number
 */
function normalizePONumber(poNumber) {
  if (!poNumber) return '';
  
  // Remove all non-numeric characters first
  let normalized = poNumber.toString().replace(/[^0-9]/g, '');
  
  // Remove leading zeros
  normalized = normalized.replace(/^0+/, '');
  
  return normalized;
}

/**
 * Normalize a PO number while preserving SAP format (10 digits with leading zeros).
 * @param {string | null | undefined} poNumber - Purchase order number
 * @returns {string} Padded PO number
 */
function normalizePONumberPadded(poNumber) {
  if (!poNumber) return '';
  
  // Get the numeric part
  const numeric = normalizePONumber(poNumber);
  
  // Pad to 10 digits
  return numeric.padStart(10, '0');
}

/**
 * Normalize a vendor number (similar to PO, typically 10 digits).
 * @param {string | null | undefined} vendorNumber - Vendor number
 * @returns {string} Normalized vendor number
 */
function normalizeVendorNumber(vendorNumber) {
  if (!vendorNumber) return '';
  
  // Remove non-numeric
  let normalized = vendorNumber.toString().replace(/[^0-9]/g, '');
  
  // Remove leading zeros for comparison
  normalized = normalized.replace(/^0+/, '');
  
  return normalized;
}

/**
 * Normalize vendor number with SAP padding (10 digits).
 * @param {string | null | undefined} vendorNumber - Vendor number
 * @returns {string} Padded vendor number
 */
function normalizeVendorNumberPadded(vendorNumber) {
  if (!vendorNumber) return '';
  
  const numeric = normalizeVendorNumber(vendorNumber);
  return numeric.padStart(10, '0');
}

/**
 * Normalize a GL account number.
 * @param {string | null | undefined} account - GL account number
 * @returns {string} Normalized account number
 */
function normalizeGLAccount(account) {
  if (!account) return '';
  return account.toString().replace(/[^0-9]/g, '');
}

/**
 * Normalize a cost center ID.
 * @param {string | null | undefined} costCenter - Cost center
 * @returns {string} Normalized cost center
 */
function normalizeCostCenter(costCenter) {
  if (!costCenter) return '';
  return costCenter.toString().toUpperCase().trim().replace(/\s+/g, '');
}

/**
 * Normalize a tax code.
 * @param {string | null | undefined} taxCode - Tax code
 * @returns {string} Normalized tax code
 */
function normalizeTaxCode(taxCode) {
  if (!taxCode) return '';
  return taxCode.toString().toUpperCase().trim();
}

/**
 * Normalize a currency amount by removing formatting.
 * @param {string | number | null | undefined} amount - Amount value
 * @returns {number} Normalized numeric amount
 */
function normalizeAmount(amount) {
  if (amount === null || amount === undefined) return 0;
  
  if (typeof amount === 'number') return amount;
  
  // Handle string amounts with various formats
  let str = amount.toString().trim();
  
  // Remove currency symbols
  str = str.replace(/[$€£¥₹]/g, '');
  
  // Detect decimal separator (last occurrence of . or ,)
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  
  if (lastComma > lastDot) {
    // European format: 1.234,56
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: 1,234.56
    str = str.replace(/,/g, '');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize a date to ISO format (YYYY-MM-DD).
 * @param {string | Date | null | undefined} date - Input date
 * @returns {string} ISO date string or empty string
 */
function normalizeDate(date) {
  if (!date) return '';
  
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }
  
  // Try parsing string date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return '';
  
  return parsed.toISOString().split('T')[0];
}

/**
 * Tokenize a string into words for matching.
 * @param {string | null | undefined} str - Input string
 * @returns {string[]} Array of tokens
 */
function tokenize(str) {
  if (!str) return [];
  
  return str
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Extract significant tokens from a company name (removes common words).
 * @param {string | null | undefined} name - Company name
 * @returns {string[]} Significant tokens
 */
function extractSignificantTokens(name) {
  if (!name) return [];
  
  const stopWords = new Set([
    'the', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'a', 'an',
    'inc', 'llc', 'ltd', 'corp', 'co', 'company', 'corporation',
    'gmbh', 'ag', 'plc', 'pvt', 'private', 'limited', 'incorporated',
    'international', 'intl', 'group', 'holdings', 'services', 'solutions'
  ]);
  
  const tokens = tokenize(normalizeCompanyName(name));
  return tokens.filter(token => !stopWords.has(token) && token.length > 1);
}

module.exports = {
  normalizeString,
  normalizeAlphanumeric,
  normalizeCompanyName,
  normalizePONumber,
  normalizePONumberPadded,
  normalizeVendorNumber,
  normalizeVendorNumberPadded,
  normalizeGLAccount,
  normalizeCostCenter,
  normalizeTaxCode,
  normalizeAmount,
  normalizeDate,
  tokenize,
  extractSignificantTokens
};
