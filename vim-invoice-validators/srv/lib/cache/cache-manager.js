// @ts-check
/**
 * @fileoverview Cache manager for ECC master data.
 * Provides in-memory caching with optional HANA persistence for frequently accessed data.
 */

const cds = require('@sap/cds');

/** @type {Map<string, import('../types').CacheEntry>} */
const memoryCache = new Map();

/** Default TTL in milliseconds (15 minutes) */
const DEFAULT_TTL = 15 * 60 * 1000;

/** TTL configurations by data type */
const TTL_CONFIG = {
  vendor: 30 * 60 * 1000,      // 30 minutes
  vendorList: 60 * 60 * 1000,  // 1 hour
  po: 15 * 60 * 1000,          // 15 minutes
  poDetail: 10 * 60 * 1000,    // 10 minutes
  glAccount: 60 * 60 * 1000,   // 1 hour
  costCenter: 60 * 60 * 1000,  // 1 hour
  taxCode: 24 * 60 * 60 * 1000 // 24 hours
};

/** @type {import('../types').CacheStats} */
const stats = {
  hits: 0,
  misses: 0,
  size: 0,
  maxSize: 1000
};


/**
 * Generate a cache key from components.
 * @param {string} type - Cache type (vendor, po, etc.)
 * @param {...string} parts - Key components
 * @returns {string} Cache key
 */
function makeKey(type, ...parts) {
  return `${type}:${parts.filter(p => p).join(':')}`.toLowerCase();
}

/**
 * Get an item from cache.
 * @template T
 * @param {string} key - Cache key
 * @returns {T | null} Cached value or null if not found/expired
 */
function get(key) {
  const entry = memoryCache.get(key);
  
  if (!entry) {
    stats.misses++;
    return null;
  }
  
  // Check expiration
  if (Date.now() > entry.timestamp + entry.ttl) {
    memoryCache.delete(key);
    stats.size = memoryCache.size;
    stats.misses++;
    return null;
  }
  
  stats.hits++;
  return entry.value;
}

/**
 * Set an item in cache.
 * @template T
 * @param {string} key - Cache key
 * @param {T} value - Value to cache
 * @param {Object} [options] - Cache options
 * @param {number} [options.ttl] - Time to live in ms
 * @param {string} [options.source] - Data source identifier
 */
function set(key, value, options = {}) {
  const ttl = options.ttl || DEFAULT_TTL;
  
  // Evict oldest entries if at capacity
  if (memoryCache.size >= stats.maxSize) {
    evictOldest(Math.floor(stats.maxSize * 0.1)); // Evict 10%
  }
  
  memoryCache.set(key, {
    key,
    value,
    timestamp: Date.now(),
    ttl,
    source: options.source
  });
  
  stats.size = memoryCache.size;
}


/**
 * Delete an item from cache.
 * @param {string} key - Cache key
 * @returns {boolean} True if item was deleted
 */
function del(key) {
  const deleted = memoryCache.delete(key);
  stats.size = memoryCache.size;
  return deleted;
}

/**
 * Clear all entries matching a prefix.
 * @param {string} prefix - Key prefix to match
 * @returns {number} Number of entries cleared
 */
function clearByPrefix(prefix) {
  let count = 0;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
      count++;
    }
  }
  stats.size = memoryCache.size;
  return count;
}

/**
 * Clear all cache entries.
 */
function clearAll() {
  memoryCache.clear();
  stats.size = 0;
  stats.hits = 0;
  stats.misses = 0;
}

/**
 * Evict oldest cache entries.
 * @param {number} count - Number of entries to evict
 */
function evictOldest(count) {
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp)
    .slice(0, count);
  
  for (const [key] of entries) {
    memoryCache.delete(key);
  }
  
  stats.size = memoryCache.size;
}

/**
 * Get current cache statistics.
 * @returns {import('../types').CacheStats} Cache statistics
 */
function getStats() {
  return { ...stats };
}


// ============================================================================
// Typed Cache Helpers for specific data types
// ============================================================================

/**
 * Cache vendor data.
 * @param {string} companyCode - Company code
 * @param {string} vendorId - Vendor ID
 * @param {Object} vendorData - Vendor data to cache
 */
function cacheVendor(companyCode, vendorId, vendorData) {
  const key = makeKey('vendor', companyCode, vendorId);
  set(key, vendorData, { ttl: TTL_CONFIG.vendor, source: 'ecc' });
}

/**
 * Get cached vendor data.
 * @param {string} companyCode - Company code
 * @param {string} vendorId - Vendor ID
 * @returns {Object | null} Cached vendor or null
 */
function getCachedVendor(companyCode, vendorId) {
  const key = makeKey('vendor', companyCode, vendorId);
  return get(key);
}

/**
 * Cache vendor list for a company code.
 * @param {string} companyCode - Company code
 * @param {Object[]} vendors - Array of vendors
 */
function cacheVendorList(companyCode, vendors) {
  const key = makeKey('vendorlist', companyCode);
  set(key, vendors, { ttl: TTL_CONFIG.vendorList, source: 'ecc' });
}

/**
 * Get cached vendor list.
 * @param {string} companyCode - Company code
 * @returns {Object[] | null} Cached vendor list or null
 */
function getCachedVendorList(companyCode) {
  const key = makeKey('vendorlist', companyCode);
  return get(key);
}

/**
 * Cache PO header data.
 * @param {string} poNumber - PO number
 * @param {Object} poData - PO header data
 */
function cachePOHeader(poNumber, poData) {
  const key = makeKey('po', poNumber);
  set(key, poData, { ttl: TTL_CONFIG.po, source: 'ecc' });
}

/**
 * Get cached PO header.
 * @param {string} poNumber - PO number
 * @returns {Object | null} Cached PO or null
 */
function getCachedPOHeader(poNumber) {
  const key = makeKey('po', poNumber);
  return get(key);
}


/**
 * Cache PO detail (header + items).
 * @param {string} poNumber - PO number
 * @param {Object} poDetail - PO detail including items
 */
function cachePODetail(poNumber, poDetail) {
  const key = makeKey('podetail', poNumber);
  set(key, poDetail, { ttl: TTL_CONFIG.poDetail, source: 'ecc' });
}

/**
 * Get cached PO detail.
 * @param {string} poNumber - PO number
 * @returns {Object | null} Cached PO detail or null
 */
function getCachedPODetail(poNumber) {
  const key = makeKey('podetail', poNumber);
  return get(key);
}

/**
 * Cache GL accounts for a company code.
 * @param {string} companyCode - Company code
 * @param {Object[]} accounts - GL accounts
 */
function cacheGLAccounts(companyCode, accounts) {
  const key = makeKey('glaccount', companyCode);
  set(key, accounts, { ttl: TTL_CONFIG.glAccount, source: 'ecc' });
}

/**
 * Get cached GL accounts.
 * @param {string} companyCode - Company code
 * @returns {Object[] | null} Cached GL accounts or null
 */
function getCachedGLAccounts(companyCode) {
  const key = makeKey('glaccount', companyCode);
  return get(key);
}

/**
 * Cache cost centers.
 * @param {string} controllingArea - Controlling area
 * @param {Object[]} costCenters - Cost centers
 */
function cacheCostCenters(controllingArea, costCenters) {
  const key = makeKey('costcenter', controllingArea);
  set(key, costCenters, { ttl: TTL_CONFIG.costCenter, source: 'ecc' });
}

/**
 * Get cached cost centers.
 * @param {string} controllingArea - Controlling area
 * @returns {Object[] | null} Cached cost centers or null
 */
function getCachedCostCenters(controllingArea) {
  const key = makeKey('costcenter', controllingArea);
  return get(key);
}


/**
 * Cache tax codes for a country.
 * @param {string} country - Country code
 * @param {Object[]} taxCodes - Tax codes
 */
function cacheTaxCodes(country, taxCodes) {
  const key = makeKey('taxcode', country);
  set(key, taxCodes, { ttl: TTL_CONFIG.taxCode, source: 'ecc' });
}

/**
 * Get cached tax codes.
 * @param {string} country - Country code
 * @returns {Object[] | null} Cached tax codes or null
 */
function getCachedTaxCodes(country) {
  const key = makeKey('taxcode', country);
  return get(key);
}

/**
 * Cache tax jurisdictions for a country.
 * @param {string} country - Country code
 * @param {Object[]} jurisdictions - Tax jurisdictions
 */
function cacheTaxJurisdictions(country, jurisdictions) {
  const key = makeKey('taxjurisdiction', country);
  set(key, jurisdictions, { ttl: TTL_CONFIG.taxCode, source: 'ecc' });
}

/**
 * Get cached tax jurisdictions.
 * @param {string} country - Country code
 * @returns {Object[] | null} Cached jurisdictions or null
 */
function getCachedTaxJurisdictions(country) {
  const key = makeKey('taxjurisdiction', country);
  return get(key);
}

module.exports = {
  // Core operations
  makeKey,
  get,
  set,
  del,
  clearByPrefix,
  clearAll,
  getStats,
  
  // TTL config
  TTL_CONFIG,
  
  // Vendor cache
  cacheVendor,
  getCachedVendor,
  cacheVendorList,
  getCachedVendorList,
  
  // PO cache
  cachePOHeader,
  getCachedPOHeader,
  cachePODetail,
  getCachedPODetail,
  
  // GL Account cache
  cacheGLAccounts,
  getCachedGLAccounts,
  
  // Cost Center cache
  cacheCostCenters,
  getCachedCostCenters,
  
  // Tax cache
  cacheTaxCodes,
  getCachedTaxCodes,
  cacheTaxJurisdictions,
  getCachedTaxJurisdictions
};
