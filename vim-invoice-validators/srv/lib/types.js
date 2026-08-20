// @ts-check
/**
 * @fileoverview JSDoc type definitions for the VIM Invoice Validators library.
 * This file contains all shared type definitions used across the validator modules.
 */

// ============================================================================
// Core Result Types
// ============================================================================

/**
 * Standard validation result returned by all validator functions.
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether the validation passed
 * @property {number} confidence - Confidence score from 0 to 1
 * @property {string} [derivedValue] - The derived/matched value from master data
 * @property {string} [message] - Human-readable message about the validation
 * @property {string} [matchStrategy] - Which matching strategy was used (exact, fuzzy, token, etc.)
 * @property {Object} [metadata] - Additional metadata about the match
 */

/**
 * Result from field derivation operations.
 * @typedef {Object} DerivationResult
 * @property {boolean} success - Whether derivation was successful
 * @property {Object<string, any>} derivedFields - Map of field names to derived values
 * @property {number} confidence - Overall confidence in the derivation
 * @property {string} [source] - Source of the derivation (e.g., "PO", "Vendor Master")
 * @property {ValidationResult[]} [validations] - Individual field validation results
 */

/**
 * Bulk validation result for multiple items.
 * @typedef {Object} BulkValidationResult
 * @property {number} totalItems - Total number of items validated
 * @property {number} validCount - Number of valid items
 * @property {number} invalidCount - Number of invalid items
 * @property {ValidationResult[]} results - Individual results
 */

// ============================================================================
// Invoice Types
// ============================================================================

/**
 * Invoice header data extracted from OCR or input.
 * @typedef {Object} InvoiceHeader
 * @property {string} [invoiceNumber] - Invoice number from document
 * @property {string} [invoiceDate] - Invoice date
 * @property {string} [vendorId] - Vendor ID/number
 * @property {string} [vendorName] - Vendor name
 * @property {string} [purchaseOrder] - PO number reference
 * @property {string} [companyCode] - Company code
 * @property {string} [currency] - Currency code
 * @property {number} [grossAmount] - Gross amount
 * @property {number} [netAmount] - Net amount
 * @property {number} [taxAmount] - Tax amount
 */

/**
 * Invoice line item data.
 * @typedef {Object} InvoiceLineItem
 * @property {number} lineNumber - Line item number
 * @property {string} [description] - Item description
 * @property {string} [poNumber] - PO number
 * @property {string} [poItem] - PO line item
 * @property {number} [quantity] - Quantity
 * @property {string} [unit] - Unit of measure
 * @property {number} [unitPrice] - Price per unit
 * @property {number} [netAmount] - Net amount
 * @property {number} [taxAmount] - Tax amount
 * @property {string} [taxCode] - Tax code
 * @property {string} [glAccount] - GL account
 * @property {string} [costCenter] - Cost center
 */

// ============================================================================
// ECC Master Data Types
// ============================================================================

/**
 * Vendor master data from ECC.
 * @typedef {Object} VendorMaster
 * @property {string} vendorId - Vendor number (LIFNR)
 * @property {string} name - Vendor name (NAME1)
 * @property {string} [name2] - Additional name
 * @property {string} [city] - City
 * @property {string} [country] - Country key
 * @property {string} [postalCode] - Postal code
 * @property {string} [taxNumber] - Tax number
 * @property {string} [paymentTerms] - Payment terms
 */

/**
 * Purchase Order header from ECC.
 * @typedef {Object} POHeader
 * @property {string} poNumber - PO number
 * @property {string} companyCode - Company code
 * @property {string} vendorId - Vendor number
 * @property {string} [vendorName] - Vendor name
 * @property {string} currency - Currency
 * @property {string} docType - Document type
 * @property {string} purchaseOrg - Purchasing organization
 * @property {string} purchaseGroup - Purchasing group
 * @property {string} [docDate] - Document date
 * @property {string} [paymentTerms] - Payment terms
 */

/**
 * Purchase Order line item from ECC.
 * @typedef {Object} POLineItem
 * @property {string} poNumber - PO number
 * @property {string} poItem - PO item number
 * @property {string} [material] - Material number
 * @property {string} [shortText] - Short description
 * @property {string} plant - Plant
 * @property {number} netPrice - Net price
 * @property {number} quantity - Order quantity
 * @property {string} unit - Unit of measure
 * @property {string} [taxCode] - Tax code
 * @property {string} [accountAssignmentCategory] - Account assignment category
 * @property {string} [glAccount] - GL account
 * @property {string} [costCenter] - Cost center
 */

/**
 * GL Account master data.
 * @typedef {Object} GLAccount
 * @property {string} companyCode - Company code
 * @property {string} accountNumber - GL account number
 * @property {string} shortText - Short description
 * @property {string} [longText] - Long description
 */

/**
 * Cost Center master data.
 * @typedef {Object} CostCenter
 * @property {string} controllingArea - Controlling area
 * @property {string} costCenter - Cost center ID
 * @property {string} description - Description
 */

/**
 * Tax Code master data.
 * @typedef {Object} TaxCode
 * @property {string} taxProcedure - Tax procedure (KALSM)
 * @property {string} taxCode - Tax code (MWSKZ)
 * @property {string} [taxType] - Tax type
 * @property {string} description - Description
 */

/**
 * Tax Jurisdiction data.
 * @typedef {Object} TaxJurisdiction
 * @property {string} taxProcedure - Tax procedure
 * @property {string} jurisdictionCode - Jurisdiction code
 * @property {string} description - Description
 */

// ============================================================================
// Matching & Scoring Types
// ============================================================================

/**
 * String matching result with scoring details.
 * @typedef {Object} MatchScore
 * @property {number} score - Combined score from 0 to 1
 * @property {string} strategy - Matching strategy used
 * @property {Object} breakdown - Score breakdown by method
 * @property {number} [breakdown.levenshtein] - Levenshtein similarity
 * @property {number} [breakdown.tokenMatch] - Token overlap score
 * @property {number} [breakdown.prefixMatch] - Prefix match score
 */

/**
 * Candidate match during fuzzy matching.
 * @typedef {Object} MatchCandidate
 * @property {any} item - The matched item
 * @property {MatchScore} score - Match score details
 */

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry with metadata.
 * @typedef {Object} CacheEntry
 * @property {string} key - Cache key
 * @property {any} value - Cached value
 * @property {number} timestamp - Creation timestamp
 * @property {number} ttl - Time to live in milliseconds
 * @property {string} [source] - Data source identifier
 */

/**
 * Cache statistics.
 * @typedef {Object} CacheStats
 * @property {number} hits - Cache hit count
 * @property {number} misses - Cache miss count
 * @property {number} size - Current cache size
 * @property {number} maxSize - Maximum cache size
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Threshold configuration for a validation type.
 * @typedef {Object} ThresholdConfig
 * @property {number} exactMatch - Score for exact match (typically 1.0)
 * @property {number} highConfidence - High confidence threshold
 * @property {number} mediumConfidence - Medium confidence threshold
 * @property {number} lowConfidence - Low confidence threshold
 * @property {number} minAcceptable - Minimum acceptable score
 */

/**
 * String matching configuration.
 * @typedef {Object} StringMatchConfig
 * @property {Object} levenshtein - Levenshtein config
 * @property {number} levenshtein.maxDistance - Max edit distance
 * @property {number} levenshtein.weight - Weight in combined score
 * @property {Object} tokenMatch - Token matching config
 * @property {number} tokenMatch.minTokenOverlap - Min token overlap ratio
 * @property {number} tokenMatch.weight - Weight in combined score
 * @property {Object} prefixMatch - Prefix matching config
 * @property {number} prefixMatch.minLength - Min prefix length
 * @property {number} prefixMatch.weight - Weight in combined score
 */

// ============================================================================
// Service Context Types
// ============================================================================

/**
 * Validation context passed to validators.
 * @typedef {Object} ValidationContext
 * @property {string} companyCode - Company code for the validation
 * @property {string} [language] - Language for descriptions
 * @property {string} [country] - Country code for tax lookups
 * @property {Object} [thresholds] - Custom threshold overrides
 * @property {boolean} [useCache] - Whether to use caching (default: true)
 */

// Export empty object to make this a module
module.exports = {};
