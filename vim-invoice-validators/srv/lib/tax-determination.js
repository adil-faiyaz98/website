// @ts-check
/**
 * @fileoverview Comprehensive Tax Determination Service
 * 
 * Determines tax codes and jurisdictions for both PO and Non-PO invoices
 * based on ship-to province rules. Uses SAP BAPIs for master data retrieval
 * and a configurable rules engine for tax determination.
 * 
 * Key BAPIs Used:
 * - BAPI_COMPANYCODE_GETDETAIL: Get company code address for tax jurisdiction
 * - BAPI_VENDOR_GETDETAIL: Get vendor address and tax information
 * - BAPI_PO_GETDETAIL1: Get PO with delivery addresses
 * - Plant data from T001W via address lookup
 * - Tax calculation via Z_VIM_CALCULATE_TAX_FROM_NET / BBP_CALCULATE_TAX_FRM_NET
 * 
 * Tax Determination Logic:
 * 1. PO Invoices: Ship-to address from PO line item plant → derive province → apply rules
 * 2. Non-PO Invoices: Company code address as receiver → vendor country as sender → apply rules
 */

const cds = require('@sap/cds');
const { normalizeVendorNumberPadded, normalizePONumberPadded } = require('./utils/normalizers');
const { createValidationResult } = require('./utils/confidence');
const cache = require('./cache');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} PlantAddress
 * @property {string} plant - Plant code
 * @property {string} plantName - Plant name
 * @property {string} country - Country code (3-letter)
 * @property {string} region - Region/Province/State code
 * @property {string} city - City name
 * @property {string} postalCode - Postal code
 * @property {string} street - Street address
 * @property {string} taxJurisdiction - Tax jurisdiction code if maintained
 */

/**
 * @typedef {Object} CompanyAddress
 * @property {string} companyCode - Company code
 * @property {string} companyName - Company name
 * @property {string} country - Country code
 * @property {string} region - Region/Province/State
 * @property {string} city - City
 * @property {string} postalCode - Postal code
 * @property {string} taxJurisdiction - Tax jurisdiction code
 * @property {string} vatRegistrationNo - VAT registration number
 * @property {string} currency - Company currency
 */

/**
 * @typedef {Object} VendorTaxInfo
 * @property {string} vendorId - Vendor ID
 * @property {string} vendorName - Vendor name
 * @property {string} country - Vendor country
 * @property {string} region - Vendor region/state
 * @property {string} postalCode - Vendor postal code
 * @property {string} city - Vendor city
 * @property {string} accountGroup - Vendor account group
 * @property {boolean} isTaxExempt - Whether vendor is tax exempt
 * @property {string} vatNumber - VAT registration number
 */

/**
 * @typedef {Object} TaxDeterminationInput
 * @property {string} [poNumber] - Purchase order number (for PO invoices)
 * @property {string} [poLineNumber] - PO line item number
 * @property {string} companyCode - Company code
 * @property {string} [vendorId] - Vendor ID
 * @property {string} [plant] - Plant code (ship-to)
 * @property {string} [costCenter] - Cost center (can derive plant/location)
 * @property {string} [receiverCountry] - Receiver country override
 * @property {string} [receiverRegion] - Receiver region/province override
 * @property {string} [receiverPostalCode] - Receiver postal code override
 * @property {string} [receiverCity] - Receiver city override
 * @property {Object} [billToAddress] - Bill-to address from invoice
 * @property {string} [billToAddress.country] - Bill-to country
 * @property {string} [billToAddress.region] - Bill-to region/province
 * @property {string} [billToAddress.postalCode] - Bill-to postal code
 * @property {string} [billToAddress.city] - Bill-to city
 * @property {string} [billToAddress.taxJurisdiction] - Bill-to tax jurisdiction
 * @property {string} [materialGroup] - Material group
 * @property {string} [expenseType] - Expense type (for non-PO)
 * @property {string} [transactionType] - Transaction type (PURCHASE/SERVICE/ASSET)
 * @property {number} netAmount - Net amount for tax calculation
 * @property {string} currency - Currency code
 * @property {Date} [taxDate] - Date for tax calculation
 */

/**
 * @typedef {Object} TaxDeterminationResult
 * @property {boolean} success - Whether determination succeeded
 * @property {string} status - 'DETERMINED' or 'EXCEPTION'
 * @property {string|null} errorCode - Error code when status is 'EXCEPTION'
 * @property {string} taxCode - Determined tax code
 * @property {string} taxJurisdiction - Determined tax jurisdiction
 * @property {number} taxAmount - Calculated tax amount
 * @property {number} taxRate - Applied tax rate percentage
 * @property {number} confidence - Confidence score (0-1)
 * @property {string} determinationMethod - Method used for determination
 * @property {string} ruleId - ID of the rule that was applied
 * @property {string} ruleName - Name of the applied rule
 * @property {Object} derivedAddresses - Addresses used for determination
 * @property {string} [message] - Additional message/explanation
 */

/**
 * @typedef {Object} LineTaxResult
 * @property {string} lineNumber - Line item number
 * @property {string} taxCode - Tax code for this line
 * @property {string} taxJurisdiction - Jurisdiction for this line
 * @property {number} taxAmount - Tax amount for this line
 * @property {number} taxRate - Tax rate applied
 * @property {string} plant - Ship-to plant
 * @property {string} determinationMethod - How tax was determined
 */

// ============================================================================
// SERVICE CONNECTION
// ============================================================================

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
  return await cds.connect.to('vim_ecc_integration');
}

/**
 * Get the local database service for configuration tables.
 * @returns {Promise<any>} DB service instance
 */
async function getDbService() {
  return await cds.connect.to('db');
}

// ============================================================================
// RESULT HELPERS
// ============================================================================

/**
 * Create an empty (not yet determined) tax determination result.
 * @returns {TaxDeterminationResult}
 */
function createTaxResult() {
  return {
    success: false,
    status: 'EXCEPTION',
    errorCode: null,
    taxCode: null,
    taxJurisdiction: null,
    taxAmount: 0,
    taxRate: 0,
    confidence: 0,
    determinationMethod: null,
    ruleId: null,
    ruleName: null,
    derivedAddresses: {},
    message: null
  };
}

/**
 * Mark a tax determination result as exception (fail-closed).
 * @param {TaxDeterminationResult} result - Result to update
 * @param {string} errorCode - Error code
 * @param {string} message - Explanation
 * @returns {TaxDeterminationResult}
 */
function failTaxResult(result, errorCode, message) {
  result.success = false;
  result.status = 'EXCEPTION';
  result.errorCode = errorCode;
  result.taxCode = null;
  result.taxJurisdiction = null;
  result.taxAmount = 0;
  result.taxRate = 0;
  result.confidence = 0;
  result.message = message;
  return result;
}

/**
 * Mark a tax determination result as determined.
 * @param {TaxDeterminationResult} result - Result to update
 * @returns {TaxDeterminationResult}
 */
function succeedTaxResult(result) {
  result.success = true;
  result.status = 'DETERMINED';
  result.errorCode = null;
  return result;
}

/**
 * Calculate tax amount via SAP and apply it to a result; fails the result
 * when a net amount is present but SAP cannot calculate the tax.
 * @param {TaxDeterminationResult} result - Result with a tax code
 * @param {Object} params - calculateTaxAmount parameters (without taxCode/taxJurisdiction)
 * @returns {Promise<boolean>} Whether the result is still valid
 */
async function applyCalculatedTax(result, params) {
  if (!params.netAmount) {
    return true;
  }

  const calcResult = await calculateTaxAmount({
    ...params,
    taxCode: result.taxCode,
    taxJurisdiction: result.taxJurisdiction
  });

  if (!calcResult.success) {
    failTaxResult(result, 'TAX_CALCULATION_FAILED', calcResult.message);
    return false;
  }

  result.taxAmount = calcResult.taxAmount;
  if (!result.taxRate && params.netAmount > 0) {
    result.taxRate = (result.taxAmount / params.netAmount) * 100;
  }
  return true;
}

/**
 * Select the PO item for a line. When no line number is given, only a
 * single-item PO is unambiguous.
 * @param {Array} items - PO items (with poItem or PO_ITEM)
 * @param {string} [poLineNumber] - Requested PO line number
 * @param {string} [key='poItem'] - Item number property
 * @returns {Object|null} Matching item or null
 */
function selectPOItem(items, poLineNumber, key = 'poItem') {
  if (!items || items.length === 0) return null;
  if (poLineNumber) {
    const normalizedLine = poLineNumber.toString().padStart(5, '0');
    return items.find(i => i[key] === normalizedLine) || null;
  }
  return items.length === 1 ? items[0] : null;
}

// ============================================================================
// BAPI WRAPPERS: PLANT DATA RETRIEVAL
// ============================================================================

/**
 * Cache for plant addresses (in-memory for session).
 * @type {Map<string, PlantAddress>}
 */
const plantAddressCache = new Map();

/**
 * Get plant address from SAP.
 * Uses PO detail with delivery address or T001W table data.
 * 
 * @param {string} plant - Plant code (4 characters)
 * @returns {Promise<PlantAddress | null>} Plant address or null if not found
 */
async function getPlantAddress(plant) {
  if (!plant) return null;

  const normalizedPlant = plant.toString().padStart(4, ' ').substring(0, 4);

  // Check cache
  if (plantAddressCache.has(normalizedPlant)) {
    return plantAddressCache.get(normalizedPlant);
  }

  // Check database cache
  const db = await getDbService();
  const { PlantTaxConfiguration } = db.entities('vim.validators.tax');

  const cachedPlant = await SELECT.one.from(PlantTaxConfiguration).where({ plant: normalizedPlant });
  if (cachedPlant && cachedPlant.lastSyncedAt) {
    const cacheAge = Date.now() - new Date(cachedPlant.lastSyncedAt).getTime();
    if (cacheAge < 24 * 60 * 60 * 1000) { // 24 hour cache
      const result = {
        plant: cachedPlant.plant,
        plantName: cachedPlant.plantName,
        country: cachedPlant.country,
        region: cachedPlant.region,
        city: cachedPlant.city,
        postalCode: cachedPlant.postalCode,
        taxJurisdiction: cachedPlant.taxJurisdiction
      };
      plantAddressCache.set(normalizedPlant, result);
      return result;
    }
  }

  try {
    const ecc = await getEccService();

    // Method 1: Try to get plant address from a sample PO with this plant
    // This leverages BAPI_PO_GETDETAIL1 with DELIVERY_ADDRESS flag
    const poList = await ecc.getPOList({});

    if (poList?.PO_ITEMS) {
      const poWithPlant = poList.PO_ITEMS.find(item => item.PLANT === normalizedPlant);
      if (poWithPlant && poList.PO_ADDRESSES) {
        const address = poList.PO_ADDRESSES.find(a => a.PO_NUMBER === poWithPlant.PO_NUMBER);
        if (address) {
          const result = {
            plant: normalizedPlant,
            plantName: address.NAME1 || '',
            country: address.CNTRY_KEY || address.COUNTRY || '',
            region: address.REGION || '',
            city: address.CITY || '',
            postalCode: address.ZIP_CODE || address.POST_CODE1 || '',
            street: address.STREET || '',
            taxJurisdiction: address.TAXJURCODE || ''
          };

          // Cache in database
          await cachePlantAddress(result);
          plantAddressCache.set(normalizedPlant, result);
          return result;
        }
      }
    }

    // Method 2: If we have PO_ADDRESSES_NEW (BAPIADDRESS structure)
    if (poList?.PO_ADDRESSES_NEW) {
      for (const addr of poList.PO_ADDRESSES_NEW) {
        if (addr.REGION && addr.COUNTRY) {
          // This might be from a PO with our plant - would need correlation
          // For now, skip if we can't correlate
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching plant address for ${plant}:`, error);
    return null;
  }
}

/**
 * Get plant address from PO detail (more reliable for PO invoices).
 * Uses BAPI_PO_GETDETAIL1 with DELIVERY_ADDRESS flag.
 * 
 * @param {string} poNumber - Purchase order number
 * @param {string} [poLineNumber] - Specific line item number
 * @returns {Promise<PlantAddress | null>} Plant address from PO
 */
async function getPlantAddressFromPO(poNumber, poLineNumber) {
  if (!poNumber) return null;

  const normalizedPO = normalizePONumberPadded(poNumber);

  try {
    const ecc = await getEccService();

    // Call BAPI_PO_GETDETAIL1 with delivery address flag
    const result = await ecc.getPODetail1({
      PURCHASEORDER: normalizedPO,
      DELIVERY_ADDRESS: 'X',
      ITEMS: 'X'
    });

    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }

    // Get the plant from the specific line item (exact match only)
    let targetPlant = null;
    let targetItem = null;

    if (result.POITEM) {
      const items = Array.isArray(result.POITEM) ? result.POITEM : [result.POITEM];
      targetItem = selectPOItem(items, poLineNumber, 'PO_ITEM');

      if (targetItem) {
        targetPlant = targetItem.PLANT;
      }
    }

    if (!targetItem) {
      return null;
    }

    // Get delivery address from POEXPIMPADDRESS or POSERVICES delivery
    // BAPI_PO_GETDETAIL1 returns delivery addresses in different structures
    if (result.POEXPIMPADDR) {
      const deliveryAddresses = Array.isArray(result.POEXPIMPADDR) ? result.POEXPIMPADDR : [result.POEXPIMPADDR];

      // Only an address for this line item is used
      const address = deliveryAddresses.find(a => a.PO_ITEM === targetItem.PO_ITEM);

      if (address) {
        return {
          plant: targetPlant || '',
          plantName: address.NAME1 || '',
          country: address.COUNTRY || '',
          region: address.REGION || '',
          city: address.CITY1 || address.CITY || '',
          postalCode: address.POST_CODE1 || address.POSTL_CODE || '',
          street: address.STREET || '',
          taxJurisdiction: address.TAXJURCODE || ''
        };
      }
    }

    // No line delivery address: look up the line's plant master address
    if (targetPlant) {
      return await getPlantAddress(targetPlant);
    }

    return null;
  } catch (error) {
    console.error(`Error fetching plant address from PO ${poNumber}:`, error);
    return null;
  }
}

/**
 * Cache plant address in the database.
 * @param {PlantAddress} plantAddress - Plant address to cache
 */
async function cachePlantAddress(plantAddress) {
  try {
    const db = await getDbService();
    const { PlantTaxConfiguration } = db.entities('vim.validators.tax');

    await UPSERT.into(PlantTaxConfiguration).entries({
      plant: plantAddress.plant,
      plantName: plantAddress.plantName,
      country: plantAddress.country,
      region: plantAddress.region,
      city: plantAddress.city,
      postalCode: plantAddress.postalCode,
      taxJurisdiction: plantAddress.taxJurisdiction,
      lastSyncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error caching plant address:', error);
  }
}

// ============================================================================
// BAPI WRAPPERS: COMPANY CODE DATA RETRIEVAL
// ============================================================================

/**
 * Cache for company code addresses.
 * @type {Map<string, CompanyAddress>}
 */
const companyAddressCache = new Map();

/**
 * Get company code address and tax settings from SAP.
 * Uses BAPI_COMPANYCODE_GETDETAIL.
 * 
 * @param {string} companyCode - Company code (4 characters)
 * @returns {Promise<CompanyAddress | null>} Company address or null
 */
async function getCompanyCodeAddress(companyCode) {
  if (!companyCode) return null;

  const normalizedCC = companyCode.toString().padStart(4, ' ').trim();

  // Check memory cache
  if (companyAddressCache.has(normalizedCC)) {
    return companyAddressCache.get(normalizedCC);
  }

  // Check database cache
  const db = await getDbService();
  const { CompanyCodeTaxSettings } = db.entities('vim.validators.tax');

  const cachedCC = await SELECT.one.from(CompanyCodeTaxSettings).where({ companyCode: normalizedCC });
  if (cachedCC && cachedCC.lastSyncedAt) {
    const cacheAge = Date.now() - new Date(cachedCC.lastSyncedAt).getTime();
    if (cacheAge < 24 * 60 * 60 * 1000) {
      const result = {
        companyCode: cachedCC.companyCode,
        companyName: cachedCC.companyName,
        country: cachedCC.country,
        region: cachedCC.region,
        city: cachedCC.city,
        postalCode: cachedCC.postalCode,
        taxJurisdiction: cachedCC.defaultTaxJurisdiction,
        vatRegistrationNo: cachedCC.vatRegistrationNo,
        taxProcedure: cachedCC.taxProcedure
      };
      companyAddressCache.set(normalizedCC, result);
      return result;
    }
  }

  try {
    const ecc = await getEccService();

    // Call BAPI_COMPANYCODE_GETDETAIL
    const result = await ecc.getCompanyCodeDetail({
      COMPANYCODEID: normalizedCC
    });

    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }

    const detail = result.COMPANYCODE_DETAIL || {};
    const address = result.COMPANYCODE_ADDRESS || {};

    const companyAddress = {
      companyCode: detail.COMP_CODE || normalizedCC,
      companyName: detail.COMP_NAME || address.NAME || '',
      country: detail.COUNTRY || address.COUNTRY || '',
      region: address.REGION || '',
      city: detail.CITY || address.CITY || '',
      postalCode: address.POSTL_COD1 || '',
      taxJurisdiction: address.TAXJURCODE || '',
      vatRegistrationNo: detail.VAT_REG_NO || '',
      currency: detail.CURRENCY || '',
      taxProcedure: '' // Would need to look up from config
    };

    // Cache the result
    await cacheCompanyCodeAddress(companyAddress);
    companyAddressCache.set(normalizedCC, companyAddress);

    return companyAddress;
  } catch (error) {
    console.error(`Error fetching company code ${companyCode}:`, error);
    return null;
  }
}

/**
 * Cache company code address in the database.
 * @param {CompanyAddress} companyAddress - Company address to cache
 */
async function cacheCompanyCodeAddress(companyAddress) {
  try {
    const db = await getDbService();
    const { CompanyCodeTaxSettings } = db.entities('vim.validators.tax');

    await UPSERT.into(CompanyCodeTaxSettings).entries({
      companyCode: companyAddress.companyCode,
      companyName: companyAddress.companyName,
      country: companyAddress.country,
      region: companyAddress.region,
      city: companyAddress.city,
      postalCode: companyAddress.postalCode,
      defaultTaxJurisdiction: companyAddress.taxJurisdiction,
      vatRegistrationNo: companyAddress.vatRegistrationNo,
      lastSyncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error caching company address:', error);
  }
}

// ============================================================================
// BAPI WRAPPERS: VENDOR DATA RETRIEVAL
// ============================================================================

/**
 * Cache for vendor tax info.
 * @type {Map<string, VendorTaxInfo>}
 */
const vendorTaxInfoCache = new Map();

/**
 * Get vendor tax-relevant information from SAP.
 * Uses BAPI_VENDOR_GETDETAIL.
 * 
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<VendorTaxInfo | null>} Vendor tax info or null
 */
async function getVendorTaxInfo(vendorId, companyCode) {
  if (!vendorId || !companyCode) return null;

  const normalizedVendor = normalizeVendorNumberPadded(vendorId);
  const cacheKey = `${normalizedVendor}-${companyCode}`;

  // Check memory cache
  if (vendorTaxInfoCache.has(cacheKey)) {
    return vendorTaxInfoCache.get(cacheKey);
  }

  // Check database cache
  const db = await getDbService();
  const { VendorTaxProfile } = db.entities('vim.validators.tax');

  const cachedVendor = await SELECT.one.from(VendorTaxProfile)
    .where({ vendorId: normalizedVendor, companyCode });

  if (cachedVendor && cachedVendor.lastSyncedAt) {
    const cacheAge = Date.now() - new Date(cachedVendor.lastSyncedAt).getTime();
    if (cacheAge < 24 * 60 * 60 * 1000) {
      const result = {
        vendorId: cachedVendor.vendorId,
        vendorName: cachedVendor.vendorName,
        country: cachedVendor.vendorCountry,
        region: cachedVendor.vendorRegion,
        accountGroup: cachedVendor.accountGroup,
        isTaxExempt: cachedVendor.isTaxExempt,
        vatNumber: cachedVendor.vatRegistrationNo,
        defaultTaxCode: cachedVendor.defaultTaxCode
      };
      vendorTaxInfoCache.set(cacheKey, result);
      return result;
    }
  }

  try {
    const ecc = await getEccService();

    // Call BAPI_VENDOR_GETDETAIL
    const result = await ecc.getVendorDetail({
      VENDORNO: normalizedVendor,
      COMPANYCODE: companyCode
    });

    if (!result || result.RETURN?.TYPE === 'E') {
      return null;
    }

    const general = result.GENERALDETAIL || {};
    const company = result.COMPANYDETAIL || {};

    const vendorInfo = {
      vendorId: general.VENDOR || normalizedVendor,
      vendorName: general.NAME || '',
      country: general.COUNTRY || '',
      region: general.REGION || '',
      postalCode: general.POSTL_CODE || '',
      city: general.CITY || '',
      accountGroup: general.ACCT_GROUP || general.KTOKK || '',
      isTaxExempt: false, // Would need to check withholding tax tables
      vatNumber: general.VAT_REGN_NO || '',
      defaultTaxCode: null
    };

    // Cache the result
    await cacheVendorTaxInfo(vendorInfo, companyCode);
    vendorTaxInfoCache.set(cacheKey, vendorInfo);

    return vendorInfo;
  } catch (error) {
    console.error(`Error fetching vendor ${vendorId}:`, error);
    return null;
  }
}

/**
 * Cache vendor tax info in the database.
 * @param {VendorTaxInfo} vendorInfo - Vendor info to cache
 * @param {string} companyCode - Company code
 */
async function cacheVendorTaxInfo(vendorInfo, companyCode) {
  try {
    const db = await getDbService();
    const { VendorTaxProfile } = db.entities('vim.validators.tax');

    await UPSERT.into(VendorTaxProfile).entries({
      vendorId: vendorInfo.vendorId,
      companyCode: companyCode,
      vendorName: vendorInfo.vendorName,
      vendorCountry: vendorInfo.country,
      vendorRegion: vendorInfo.region,
      accountGroup: vendorInfo.accountGroup,
      isTaxExempt: vendorInfo.isTaxExempt,
      vatRegistrationNo: vendorInfo.vatNumber,
      lastSyncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error caching vendor tax info:', error);
  }
}

// ============================================================================
// BAPI WRAPPERS: PO DETAIL WITH TAX INFO
// ============================================================================

/**
 * Get PO line items with their tax codes and plant information.
 * Uses BAPI_PO_GETDETAIL.
 * 
 * @param {string} poNumber - Purchase order number
 * @returns {Promise<{header: Object, items: Array} | null>} PO with tax details
 */
async function getPOTaxDetails(poNumber) {
  if (!poNumber) return null;

  const normalizedPO = normalizePONumberPadded(poNumber);

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

    const header = {
      poNumber: result.POHEADER?.PO_NUMBER || normalizedPO,
      companyCode: result.POHEADER?.CO_CODE,
      vendorId: result.POHEADER?.VENDOR,
      vendorName: result.POHEADER?.VEND_NAME,
      currency: result.POHEADER?.CURRENCY,
      taxCountry: result.POHEADER?.TAXR_CNTRY
    };

    const items = (result.POITEM || []).map(item => ({
      poNumber: item.PO_NUMBER,
      poItem: item.PO_ITEM,
      material: item.MATERIAL,
      shortText: item.SHORT_TEXT,
      plant: item.PLANT,
      materialGroup: item.MAT_GRP,
      taxCode: item.TAX_CODE,
      taxJurisdiction: item.TAX_JUR_CD || item.TXJCD,
      netPrice: parseFloat(item.NET_PRICE) || 0,
      quantity: parseFloat(item.QUANTITY || item.TARGET_QTY) || 1,
      unit: item.UNIT,
      accountAssignmentCategory: item.ACCTASSCAT
    }));

    return { header, items };
  } catch (error) {
    console.error(`Error fetching PO tax details for ${poNumber}:`, error);
    return null;
  }
}

// ============================================================================
// TAX CODE AND JURISDICTION LOOKUP
// ============================================================================

/**
 * Get tax codes for a country from SAP.
 * @param {string} country - Country code (2 or 3 letter)
 * @param {string} [language='E'] - Language code
 * @returns {Promise<Array<{taxCode: string, description: string, taxType: string}>>}
 */
async function getTaxCodesForCountry(country, language = 'E') {
  if (!country) return [];

  // Normalize to 2-letter for BAPI
  const countryCode = country.length === 3 ? country.substring(0, 2) : country;

  // Check cache
  const db = await getDbService();
  const { TaxCodeCache } = db.entities('vim.validators.tax');

  const cached = await SELECT.from(TaxCodeCache)
    .where({ country: countryCode })
    .and('expiresAt >', new Date().toISOString());

  if (cached && cached.length > 0) {
    return cached.map(tc => ({
      taxCode: tc.taxCode,
      description: tc.description,
      taxType: tc.taxType,
      taxRate: tc.taxRate
    }));
  }

  try {
    const ecc = await getEccService();
    const result = await ecc.getTaxCodes({
      country: countryCode,
      language: language
    });

    if (!result || !Array.isArray(result)) {
      return [];
    }

    const taxCodes = result.map(tc => ({
      taxProcedure: tc.KALSM,
      taxCode: tc.MWSKZ,
      description: tc.TEXT1,
      taxType: tc.MWART
    }));

    // Cache the results
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (const tc of taxCodes) {
      await UPSERT.into(TaxCodeCache).entries({
        taxProcedure: tc.taxProcedure,
        taxCode: tc.taxCode,
        country: countryCode,
        taxType: tc.taxType,
        description: tc.description,
        expiresAt
      });
    }

    return taxCodes;
  } catch (error) {
    console.error(`Error fetching tax codes for ${country}:`, error);
    return [];
  }
}

/**
 * Get tax jurisdictions for a country.
 * @param {string} country - Country code
 * @param {string} [language='E'] - Language code
 * @returns {Promise<Array<{jurisdictionCode: string, description: string}>>}
 */
async function getTaxJurisdictionsForCountry(country, language = 'E') {
  if (!country) return [];

  const countryCode = country.length === 3 ? country.substring(0, 2) : country;

  // Check cache
  const db = await getDbService();
  const { TaxJurisdictionCache } = db.entities('vim.validators.tax');

  const cached = await SELECT.from(TaxJurisdictionCache)
    .where({ country: countryCode })
    .and('expiresAt >', new Date().toISOString());

  if (cached && cached.length > 0) {
    return cached.map(tj => ({
      jurisdictionCode: tj.jurisdictionCode,
      description: tj.description
    }));
  }

  try {
    const ecc = await getEccService();
    const result = await ecc.getTaxJurisdictions({
      country: countryCode,
      language: language
    });

    if (!result || !Array.isArray(result)) {
      return [];
    }

    const jurisdictions = result.map(tj => ({
      taxProcedure: tj.KALSM,
      jurisdictionCode: tj.TXJCD,
      description: tj.TEXT1
    }));

    // Cache results
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (const tj of jurisdictions) {
      await UPSERT.into(TaxJurisdictionCache).entries({
        taxProcedure: tj.taxProcedure,
        jurisdictionCode: tj.jurisdictionCode,
        country: countryCode,
        description: tj.description,
        expiresAt
      });
    }

    return jurisdictions;
  } catch (error) {
    console.error(`Error fetching tax jurisdictions for ${country}:`, error);
    return [];
  }
}

// ============================================================================
// TAX CALCULATION BAPI
// ============================================================================

/**
 * Calculate tax amount from net amount using SAP tax calculation.
 * Uses Z_VIM_CALCULATE_TAX_FROM_NET or BBP_CALCULATE_TAX_FRM_NET.
 * 
 * @param {Object} params - Calculation parameters
 * @param {string} params.companyCode - Company code
 * @param {string} params.taxCode - Tax code
 * @param {string} params.currency - Currency code
 * @param {number} params.netAmount - Net amount
 * @param {string} [params.taxJurisdiction] - Tax jurisdiction code
 * @param {Date} [params.taxDate] - Tax calculation date
 * @returns {Promise<{taxAmount: number, success: boolean, message: string}>}
 */
async function calculateTaxAmount(params) {
  const { companyCode, taxCode, currency, netAmount, taxJurisdiction, taxDate } = params;

  if (!companyCode || !taxCode || !currency || netAmount === undefined) {
    return {
      taxAmount: 0,
      success: false,
      message: 'Missing required parameters'
    };
  }

  try {
    const ecc = await getEccService();

    // Try custom function first
    let result;
    try {
      result = await ecc.calculateTaxFromNet({
        I_BUKRS: companyCode,
        I_MWSKZ: taxCode,
        I_WAERS: currency,
        I_WRBTR: netAmount,
        I_TXJCD: taxJurisdiction || null,
        I_PRSDT: taxDate ? formatDateForSAP(taxDate) : null
      });
    } catch {
      // Fallback to standard function
      result = await ecc.calculateTaxFromNetStd({
        I_BUKRS: companyCode,
        I_MWSKZ: taxCode,
        I_WAERS: currency,
        I_WRBTR: netAmount,
        I_TXJCD: taxJurisdiction || null,
        I_PRSDT: taxDate ? formatDateForSAP(taxDate) : null
      });
    }

    if (!result) {
      return {
        taxAmount: 0,
        success: false,
        message: 'No response from tax calculation'
      };
    }

    const taxAmount = parseFloat(result.E_FWSTE || result.TAX_AMOUNT || 0);

    return {
      taxAmount,
      success: true,
      message: `Tax calculated: ${taxAmount} ${currency}`
    };
  } catch (error) {
    console.error('Error calculating tax:', error);
    return {
      taxAmount: 0,
      success: false,
      message: `Tax calculation error: ${error.message}`
    };
  }
}

/**
 * Format date for SAP BAPI (YYYYMMDD or Date object).
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
function formatDateForSAP(date) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

// ============================================================================
// TAX DETERMINATION RULES ENGINE
// ============================================================================

/**
 * Load active tax determination rules from configuration.
 * @returns {Promise<Array>} Active rules sorted by priority
 */
async function loadTaxDeterminationRules() {
  try {
    const db = await getDbService();
    const { TaxDeterminationRules } = db.entities('vim.validators.tax');

    const rules = await SELECT.from(TaxDeterminationRules)
      .where({ isActive: true })
      .and('validFrom is null or validFrom <=', new Date().toISOString().split('T')[0])
      .and('validTo is null or validTo >=', new Date().toISOString().split('T')[0])
      .orderBy('priority asc');

    return rules || [];
  } catch (error) {
    console.error('Error loading tax rules:', error);
    return [];
  }
}

/**
 * Match input against a rule criteria.
 * '*' means match any value.
 * 
 * @param {string} ruleValue - Rule value ('*' or specific value)
 * @param {string} inputValue - Input value to match
 * @returns {boolean} Whether it matches
 */
function matchesCriteria(ruleValue, inputValue) {
  if (!ruleValue || ruleValue === '*') return true;
  if (!inputValue) return false;

  // Support wildcards in rule value (e.g., 'M5V*' for postal codes)
  if (ruleValue.includes('*')) {
    const pattern = ruleValue.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`, 'i');
    return regex.test(inputValue);
  }

  return ruleValue.toUpperCase() === inputValue.toUpperCase();
}

/**
 * Find the best matching tax rule for given input.
 * 
 * @param {Object} input - Tax determination input
 * @param {string} input.companyCode - Company code
 * @param {string} input.senderCountry - Sender/vendor country
 * @param {string} input.receiverCountry - Receiver/ship-to country
 * @param {string} input.receiverProvince - Receiver province/region
 * @param {string} [input.postalCode] - Receiver postal code
 * @param {string} [input.transactionType] - Transaction type
 * @param {string} [input.documentType] - Document type (PO/NONPO)
 * @param {string} [input.materialGroup] - Material group
 * @param {string} [input.vendorAccountGroup] - Vendor account group
 * @param {string} [input.expenseType] - Expense type
 * @returns {Promise<Object | null>} Best matching rule, { ambiguous: true, candidates } when
 *   equal-priority matches return different tax codes/jurisdictions, or null
 */
async function findMatchingTaxRule(input) {
  const rules = await loadTaxDeterminationRules();

  if (!rules || rules.length === 0) {
    return null;
  }

  const matches = [];
  for (const rule of rules) {
    // Check all criteria
    if (!matchesCriteria(rule.companyCode, input.companyCode)) continue;
    if (!matchesCriteria(rule.senderCountry, input.senderCountry)) continue;
    if (!matchesCriteria(rule.receiverCountry, input.receiverCountry)) continue;
    if (!matchesCriteria(rule.receiverProvince, input.receiverProvince)) continue;
    if (!matchesCriteria(rule.postalCodePattern, input.postalCode)) continue;
    if (!matchesCriteria(rule.transactionType, input.transactionType)) continue;
    if (!matchesCriteria(rule.documentType, input.documentType)) continue;
    if (!matchesCriteria(rule.materialGroup, input.materialGroup)) continue;
    if (!matchesCriteria(rule.vendorAccountGroup, input.vendorAccountGroup)) continue;
    if (!matchesCriteria(rule.expenseType, input.expenseType)) continue;

    // Rules are sorted by priority - stop after the best-priority matches
    if (matches.length > 0 && rule.priority !== matches[0].priority) break;
    matches.push(rule);
  }

  if (matches.length === 0) {
    return null;
  }

  const outcomes = new Set(matches.map(r => `${r.taxCode || ''}|${r.taxJurisdiction || ''}`));
  if (outcomes.size > 1) {
    return {
      ambiguous: true,
      candidates: matches.map(r => ({
        ruleId: r.ID,
        ruleName: r.ruleName,
        taxCode: r.taxCode,
        taxJurisdiction: r.taxJurisdiction || null
      }))
    };
  }

  return matches[0];
}

// ============================================================================
// CANADIAN PROVINCIAL TAX LOOKUP
// ============================================================================

/**
 * Get Canadian provincial tax rates and codes.
 * @param {string} provinceCode - Province code (2-letter, e.g., 'ON', 'BC')
 * @returns {Promise<Object | null>} Provincial tax info
 */
async function getCanadianProvincialTax(provinceCode) {
  if (!provinceCode) return null;

  const normalizedProvince = provinceCode.toUpperCase().trim();

  try {
    const db = await getDbService();
    const { CanadianProvincialTaxRates } = db.entities('vim.validators.tax');

    const provinceTax = await SELECT.one.from(CanadianProvincialTaxRates)
      .where({ provinceCode: normalizedProvince })
      .and('validFrom is null or validFrom <=', new Date().toISOString().split('T')[0])
      .and('validTo is null or validTo >=', new Date().toISOString().split('T')[0]);

    if (provinceTax) {
      return {
        provinceCode: provinceTax.provinceCode,
        provinceName: provinceTax.provinceName,
        usesHST: provinceTax.usesHST,
        gstRate: provinceTax.gstRate,
        pstRate: provinceTax.pstRate,
        hstRate: provinceTax.hstRate,
        qstRate: provinceTax.qstRate,
        totalRate: provinceTax.totalRate,
        taxCode: provinceTax.usesHST ? provinceTax.hstTaxCode : provinceTax.combinedTaxCode,
        gstTaxCode: provinceTax.gstTaxCode,
        hstTaxCode: provinceTax.hstTaxCode,
        pstTaxCode: provinceTax.pstTaxCode,
        jurisdictionPattern: provinceTax.jurisdictionPattern,
        pstRecoverable: provinceTax.pstRecoverable
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching Canadian provincial tax for ${provinceCode}:`, error);
    return null;
  }
}

// ============================================================================
// US STATE TAX LOOKUP
// ============================================================================

/**
 * Get US state tax information.
 * @param {string} stateCode - State code (2-letter)
 * @returns {Promise<Object | null>} State tax info
 */
async function getUSStateTax(stateCode) {
  if (!stateCode) return null;

  const normalizedState = stateCode.toUpperCase().trim();

  try {
    const db = await getDbService();
    const { USStateTaxRates } = db.entities('vim.validators.tax');

    const stateTax = await SELECT.one.from(USStateTaxRates)
      .where({ stateCode: normalizedState });

    return stateTax || null;
  } catch (error) {
    console.error(`Error fetching US state tax for ${stateCode}:`, error);
    return null;
  }
}

// ============================================================================
// COST CENTER TO PLANT DERIVATION
// ============================================================================

/**
 * Cost center to plant mapping cache.
 * @type {Map<string, string>}
 */
const costCenterPlantCache = new Map();

/**
 * Derive plant from cost center.
 * Cost centers in SAP are often associated with a specific plant/location.
 * This can be configured in the cost center master data or via custom mapping.
 * 
 * @param {string} costCenter - Cost center code
 * @param {string} companyCode - Company code
 * @returns {Promise<string | null>} Plant code or null
 */
async function derivePlantFromCostCenter(costCenter, companyCode) {
  if (!costCenter) return null;

  const cacheKey = `${companyCode}-${costCenter}`;

  // Check memory cache
  if (costCenterPlantCache.has(cacheKey)) {
    return costCenterPlantCache.get(cacheKey);
  }

  try {
    const ecc = await getEccService();

    // Get cost center details - may include responsible cost center or location
    const result = await ecc.getCostCenters({
      COMPANYCODE: companyCode,
      COSTCENTER: costCenter.toString().padStart(10, '0')
    });

    if (result?.COSTCENTER_LIST && result.COSTCENTER_LIST.length > 0) {
      const ccDetail = result.COSTCENTER_LIST[0];

      // Some organizations store plant in the cost center hierarchy name
      // or have a naming convention like "1000-PLANT1" or location prefix
      // This is organization-specific and may need customization

      // Check if there's a pattern in cost center that indicates plant
      // Common patterns: PLANT-DEPT (e.g., "1000-IT") or LOCATION-FUNCTION
      const ccText = ccDetail.COCNTR_TXT || ccDetail.COSTCENTER || '';

      // Try to extract plant from naming convention (first 4 chars if numeric)
      const potentialPlant = costCenter.substring(0, 4);
      if (/^\d{4}$/.test(potentialPlant)) {
        // Verify this is a valid plant
        const plantAddr = await getPlantAddress(potentialPlant);
        if (plantAddr) {
          costCenterPlantCache.set(cacheKey, potentialPlant);
          return potentialPlant;
        }
      }
    }

    // Fallback: Check custom configuration table
    const db = await getDbService();

    // You might have a custom mapping table - check if configured
    // For now, return null if no mapping found
    return null;
  } catch (error) {
    console.error(`Error deriving plant from cost center ${costCenter}:`, error);
    return null;
  }
}

// ============================================================================
// MAIN TAX DETERMINATION FUNCTIONS
// ============================================================================

/**
 * Determine tax for a PO invoice.
 * Uses ship-to plant address (province) to determine tax.
 * 
 * @param {TaxDeterminationInput} input - Tax determination input
 * @returns {Promise<TaxDeterminationResult>} Tax determination result
 */
async function determineTaxForPOInvoice(input) {
  const { poNumber, poLineNumber, companyCode, vendorId, netAmount, currency, taxDate } = input;

  const result = createTaxResult();

  try {
    // Step 1: Get PO details with tax information
    const poDetails = await getPOTaxDetails(poNumber);
    if (!poDetails) {
      return failTaxResult(result, 'PO_NOT_FOUND', `PO ${poNumber} not found`);
    }

    // Step 2: Get vendor information (sender country)
    const vendor = await getVendorTaxInfo(
      vendorId || poDetails.header.vendorId,
      companyCode || poDetails.header.companyCode
    );

    // Step 3: Determine ship-to address from PO line item plant (exact line match only)
    let plantAddress = null;
    const targetItem = selectPOItem(poDetails.items, poLineNumber);

    if (!targetItem) {
      return failTaxResult(result, poLineNumber ? 'PO_LINE_NOT_FOUND' : 'PO_LINE_REQUIRED',
        poLineNumber
          ? `PO line ${poLineNumber} not found on PO ${poNumber}`
          : `PO ${poNumber} has several lines - a PO line number is required`);
    }

    if (targetItem.plant) {
      // Try to get plant address from PO first (more accurate)
      plantAddress = await getPlantAddressFromPO(poNumber, targetItem.poItem);

      // Fallback to plant master lookup
      if (!plantAddress) {
        plantAddress = await getPlantAddress(targetItem.plant);
      }
    }

    const calcParams = {
      companyCode: companyCode || poDetails.header.companyCode,
      currency: currency || poDetails.header.currency,
      netAmount,
      taxDate
    };

    // Step 4: If plant has tax code on PO, use it (highest confidence)
    if (targetItem.taxCode) {
      result.taxCode = targetItem.taxCode;
      result.taxJurisdiction = targetItem.taxJurisdiction;
      result.confidence = 1.0;
      result.determinationMethod = 'PO_LINE_ITEM';
      result.message = `Tax code ${targetItem.taxCode} from PO line item`;
      result.derivedAddresses = { plant: plantAddress, vendor };

      if (!(await applyCalculatedTax(result, calcParams))) {
        return result;
      }
      return succeedTaxResult(result);
    }

    // Step 5: Determine tax using ship-to province rules
    const ruleInput = {
      companyCode: companyCode || poDetails.header.companyCode,
      senderCountry: vendor?.country || '',
      receiverCountry: plantAddress?.country || '',
      receiverProvince: plantAddress?.region || '',
      postalCode: plantAddress?.postalCode || '',
      transactionType: 'PURCHASE',
      documentType: 'PO',
      materialGroup: targetItem.materialGroup || '',
      vendorAccountGroup: vendor?.accountGroup || ''
    };

    result.derivedAddresses = {
      plant: plantAddress,
      vendor,
      ruleInput
    };

    // Step 6: Configured rule, then configured provincial/state tax codes
    if (!(await applyConfiguredTaxCode(result, ruleInput, plantAddress, 'plant'))) {
      return result;
    }

    // Step 7: Calculate tax amount via SAP
    if (!(await applyCalculatedTax(result, calcParams))) {
      return result;
    }

    return succeedTaxResult(result);
  } catch (error) {
    console.error('Error in PO tax determination:', error);
    return failTaxResult(result, 'EXCEPTION', `Error: ${error.message}`);
  }
}

/**
 * Apply the tax code from a matching configured rule or, failing that, from
 * configured Canadian provincial / US state tables. Hard-coded tax codes are
 * never used; unresolved or ambiguous determinations fail the result.
 *
 * @param {TaxDeterminationResult} result - Result to update
 * @param {Object} ruleInput - Rule matching input
 * @param {Object|null} receiverAddress - Receiver (ship-to) address
 * @param {string} receiverSource - Source of the receiver address (for messages)
 * @param {string|null} [vendorDefaultTaxCode] - Tax code configured on the vendor tax profile
 * @returns {Promise<boolean>} Whether a tax code was applied
 */
async function applyConfiguredTaxCode(result, ruleInput, receiverAddress, receiverSource, vendorDefaultTaxCode = null) {
  const matchedRule = await findMatchingTaxRule(ruleInput);

  if (matchedRule?.ambiguous) {
    failTaxResult(result, 'AMBIGUOUS_TAX_RULE',
      `Several tax rules with the same priority return different results: ${matchedRule.candidates.map(c => c.ruleName).join(', ')}`);
    return false;
  }

  if (matchedRule?.taxCode) {
    result.taxCode = matchedRule.taxCode;
    result.taxJurisdiction = matchedRule.taxJurisdiction || receiverAddress?.taxJurisdiction || null;
    result.ruleId = matchedRule.ID;
    result.ruleName = matchedRule.ruleName;
    result.confidence = 0.95;
    result.determinationMethod = 'TAX_RULE';
    result.message = `Tax determined by rule: ${matchedRule.ruleName} (receiver from ${receiverSource})`;
    if (matchedRule.taxRatePercent) {
      result.taxRate = parseFloat(matchedRule.taxRatePercent);
    }
    return true;
  }

  if (vendorDefaultTaxCode) {
    result.taxCode = vendorDefaultTaxCode;
    result.confidence = 0.80;
    result.determinationMethod = 'VENDOR_DEFAULT';
    result.message = 'Using vendor default tax code';
    return true;
  }

  const country = receiverAddress?.country;

  if (country === 'CA' || country === 'CAN') {
    const provincialTax = await getCanadianProvincialTax(receiverAddress.region);
    if (provincialTax?.taxCode) {
      result.taxCode = provincialTax.taxCode;
      result.taxRate = provincialTax.totalRate;
      result.taxJurisdiction = provincialTax.jurisdictionPattern || null;
      result.confidence = 0.85;
      result.determinationMethod = 'CANADIAN_PROVINCIAL';
      result.message = `Canadian provincial tax for ${provincialTax.provinceName || receiverAddress.region} (receiver from ${receiverSource})`;
      return true;
    }
  } else if (country === 'US' || country === 'USA') {
    const stateTax = await getUSStateTax(receiverAddress.region);
    if (stateTax?.defaultTaxCode) {
      result.taxCode = stateTax.defaultTaxCode;
      result.taxJurisdiction = stateTax.jurisdictionPattern || null;
      result.confidence = 0.80;
      result.determinationMethod = 'US_STATE';
      result.message = `US state tax for ${receiverAddress.region} (receiver from ${receiverSource})`;
      return true;
    }
  }

  failTaxResult(result, 'NO_TAX_DETERMINATION',
    `Could not determine tax code - no matching rule or configured tax code for receiver ${country || 'unknown'}/${receiverAddress?.region || 'unknown'}`);
  return false;
}

/**
 * Determine tax for a Non-PO invoice.
 * 
 * RECEIVER ADDRESS DETERMINATION HIERARCHY:
 * 1. Explicit override (receiverCountry, receiverRegion, receiverPostalCode)
 * 2. Bill-to address from invoice (if provided)
 * 3. Plant address (if plant provided - e.g., for service at specific location)
 * 4. Cost Center's plant/location (if cost center provided)
 * 5. Company Code address (default fallback)
 * 
 * SENDER ADDRESS:
 * - Vendor address from BAPI_VENDOR_GETDETAIL
 * 
 * @param {TaxDeterminationInput} input - Tax determination input
 * @returns {Promise<TaxDeterminationResult>} Tax determination result
 */
async function determineTaxForNonPOInvoice(input) {
  const {
    companyCode, vendorId, netAmount, currency,
    expenseType, taxDate, plant, costCenter,
    // Override addresses (if invoice has bill-to/receiver info)
    receiverCountry: overrideReceiverCountry,
    receiverRegion: overrideReceiverRegion,
    receiverPostalCode: overridePostalCode,
    receiverCity: overrideReceiverCity,
    // Bill-to address from invoice (alternative to overrides)
    billToAddress
  } = input;

  const result = createTaxResult();

  try {
    // =========================================================================
    // STEP 1: DETERMINE RECEIVER (SHIP-TO) ADDRESS
    // Priority: Override → Bill-to → Plant → Cost Center Plant → Company Code
    // =========================================================================

    let receiverAddress = null;
    let receiverSource = null;

    // Priority 1: Explicit override values (from invoice bill-to or manual entry)
    if (overrideReceiverCountry && overrideReceiverRegion) {
      receiverAddress = {
        country: overrideReceiverCountry,
        region: overrideReceiverRegion,
        postalCode: overridePostalCode || '',
        city: overrideReceiverCity || '',
        taxJurisdiction: ''
      };
      receiverSource = 'INVOICE_OVERRIDE';
    }

    // Priority 2: Bill-to address from invoice (extracted from invoice document)
    if (!receiverAddress && billToAddress) {
      if (billToAddress.country && billToAddress.region) {
        receiverAddress = {
          country: billToAddress.country,
          region: billToAddress.region,
          postalCode: billToAddress.postalCode || '',
          city: billToAddress.city || '',
          taxJurisdiction: billToAddress.taxJurisdiction || ''
        };
        receiverSource = 'BILL_TO_ADDRESS';
      }
    }

    // Priority 3: Plant address (if service/goods at specific plant)
    if (!receiverAddress && plant) {
      const plantAddr = await getPlantAddress(plant);
      if (plantAddr && plantAddr.country && plantAddr.region) {
        receiverAddress = {
          country: plantAddr.country,
          region: plantAddr.region,
          postalCode: plantAddr.postalCode || '',
          city: plantAddr.city || '',
          taxJurisdiction: plantAddr.taxJurisdiction || ''
        };
        receiverSource = 'PLANT_ADDRESS';
      }
    }

    // Priority 4: Derive plant from cost center (if cost center has location)
    if (!receiverAddress && costCenter) {
      const plantFromCC = await derivePlantFromCostCenter(costCenter, companyCode);
      if (plantFromCC) {
        const plantAddr = await getPlantAddress(plantFromCC);
        if (plantAddr && plantAddr.country && plantAddr.region) {
          receiverAddress = {
            country: plantAddr.country,
            region: plantAddr.region,
            postalCode: plantAddr.postalCode || '',
            city: plantAddr.city || '',
            taxJurisdiction: plantAddr.taxJurisdiction || ''
          };
          receiverSource = 'COST_CENTER_PLANT';
        }
      }
    }

    // Priority 5: Company code address (receiver of Non-PO invoices)
    const companyAddress = await getCompanyCodeAddress(companyCode);
    if (!companyAddress) {
      return failTaxResult(result, 'COMPANY_NOT_FOUND', `Company code ${companyCode} not found`);
    }

    if (!receiverAddress) {
      receiverAddress = {
        country: companyAddress.country,
        region: companyAddress.region || '',
        postalCode: companyAddress.postalCode || '',
        city: companyAddress.city || '',
        taxJurisdiction: companyAddress.taxJurisdiction || ''
      };
      receiverSource = 'COMPANY_CODE';
    }

    // =========================================================================
    // STEP 2: GET VENDOR (SENDER/SHIP-FROM) INFORMATION
    // =========================================================================

    const vendor = await getVendorTaxInfo(vendorId, companyCode);

    // Step 3: Check vendor tax exemption (exempt tax code must be configured on the vendor profile)
    if (vendor?.isTaxExempt) {
      result.determinationMethod = 'VENDOR_EXEMPT';
      result.derivedAddresses = {
        receiver: receiverAddress,
        receiverSource,
        company: companyAddress,
        vendor
      };
      if (!vendor.defaultTaxCode) {
        return failTaxResult(result, 'EXEMPT_TAX_CODE_NOT_CONFIGURED',
          `Vendor ${vendorId} is tax exempt but no exempt tax code is configured on the vendor tax profile`);
      }
      result.taxCode = vendor.defaultTaxCode;
      result.taxAmount = 0;
      result.taxRate = 0;
      result.confidence = 1.0;
      result.message = 'Vendor is tax exempt';
      return succeedTaxResult(result);
    }

    // =========================================================================
    // STEP 3: BUILD RULE INPUT USING DERIVED RECEIVER ADDRESS
    // =========================================================================

    const ruleInput = {
      companyCode,
      senderCountry: vendor?.country || '',
      receiverCountry: receiverAddress.country,
      receiverProvince: receiverAddress.region,
      postalCode: receiverAddress.postalCode,
      transactionType: 'PURCHASE',
      documentType: 'NONPO',
      vendorAccountGroup: vendor?.accountGroup || '',
      expenseType: expenseType || ''
    };

    result.derivedAddresses = {
      receiver: receiverAddress,
      receiverSource,
      company: companyAddress,
      vendor,
      ruleInput
    };

    // =========================================================================
    // STEP 4: APPLY CONFIGURED TAX RULES / TAX CODES (no hard-coded defaults)
    // =========================================================================

    if (!(await applyConfiguredTaxCode(result, ruleInput, receiverAddress, receiverSource, vendor?.defaultTaxCode))) {
      return result;
    }

    // Step 5: Calculate tax amount via SAP
    if (!(await applyCalculatedTax(result, { companyCode, currency, netAmount, taxDate }))) {
      return result;
    }

    return succeedTaxResult(result);
  } catch (error) {
    console.error('Error in non-PO tax determination:', error);
    return failTaxResult(result, 'EXCEPTION', `Error: ${error.message}`);
  }
}

/**
 * Determine tax for all line items of a PO invoice.
 * Each line may have different ship-to plants and thus different tax treatment.
 * 
 * @param {string} poNumber - Purchase order number
 * @param {string} companyCode - Company code
 * @param {Array<{lineNumber: string, netAmount: number}>} lineItems - Line items with amounts
 * @param {string} currency - Currency code
 * @param {Date} [taxDate] - Tax calculation date
 * @returns {Promise<{header: TaxDeterminationResult, lines: LineTaxResult[]}>}
 */
async function determineTaxForPOInvoiceLines(poNumber, companyCode, lineItems, currency, taxDate) {
  const results = {
    header: null,
    lines: [],
    exceptions: []
  };

  // Get PO details once
  const poDetails = await getPOTaxDetails(poNumber);
  if (!poDetails) {
    return {
      header: {
        success: false,
        errorCode: 'PO_NOT_FOUND',
        message: `PO ${poNumber} not found`,
        taxCode: null,
        taxJurisdiction: null,
        taxAmount: 0,
        taxRate: 0,
        confidence: 0
      },
      lines: [],
      exceptions: [{ lineNumber: null, errorCode: 'PO_NOT_FOUND', reason: `PO ${poNumber} not found` }]
    };
  }

  // Process each line item
  let totalNetAmount = 0;
  let totalTaxAmount = 0;
  const taxCodeCounts = {};
  const jurisdictionCounts = {};

  for (const lineItem of lineItems) {
    const lineResult = await determineTaxForPOInvoice({
      poNumber,
      poLineNumber: lineItem.lineNumber,
      companyCode: companyCode || poDetails.header.companyCode,
      vendorId: poDetails.header.vendorId,
      netAmount: lineItem.netAmount,
      currency: currency || poDetails.header.currency,
      taxDate
    });

    const poItem = poDetails.items.find(i =>
      i.poItem === lineItem.lineNumber.toString().padStart(5, '0')
    );

    results.lines.push({
      lineNumber: lineItem.lineNumber,
      status: lineResult.status,
      errorCode: lineResult.errorCode,
      reason: lineResult.message,
      taxCode: lineResult.taxCode,
      taxJurisdiction: lineResult.taxJurisdiction,
      taxAmount: lineResult.taxAmount,
      taxRate: lineResult.taxRate,
      plant: poItem?.plant || '',
      determinationMethod: lineResult.determinationMethod,
      confidence: lineResult.confidence
    });

    totalNetAmount += lineItem.netAmount;
    totalTaxAmount += lineResult.taxAmount;

    // Track most common tax code for header
    if (lineResult.taxCode) {
      taxCodeCounts[lineResult.taxCode] = (taxCodeCounts[lineResult.taxCode] || 0) + 1;
    }
    if (lineResult.taxJurisdiction) {
      jurisdictionCounts[lineResult.taxJurisdiction] = (jurisdictionCounts[lineResult.taxJurisdiction] || 0) + 1;
    }
  }

  // Determine header tax code (most common among lines or first line's)
  const headerTaxCode = Object.entries(taxCodeCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || results.lines[0]?.taxCode;

  const headerJurisdiction = Object.entries(jurisdictionCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || results.lines[0]?.taxJurisdiction;

  // Check if all lines have the same tax code
  const allSameTaxCode = results.lines.every(l => l.taxCode === headerTaxCode);

  results.exceptions = collectLineExceptions(results.lines);

  results.header = {
    success: results.lines.length > 0 && results.exceptions.length === 0,
    taxCode: headerTaxCode,
    taxJurisdiction: headerJurisdiction,
    taxAmount: totalTaxAmount,
    taxRate: totalNetAmount > 0 ? (totalTaxAmount / totalNetAmount) * 100 : 0,
    confidence: allSameTaxCode ? 0.95 : 0.80,
    determinationMethod: allSameTaxCode ? 'LINES_UNANIMOUS' : 'LINES_MAJORITY',
    message: allSameTaxCode
      ? `All ${results.lines.length} lines have tax code ${headerTaxCode}`
      : `Multiple tax codes across lines, header uses majority: ${headerTaxCode}`
  };

  return results;
}

/**
 * Collect line-level exceptions (lines whose status is not DETERMINED).
 * @param {Array<{lineNumber: *, status: string, errorCode: string, reason?: string}>} lines - Line results
 * @returns {Array<{lineNumber: *, errorCode: string, reason: string}>}
 */
function collectLineExceptions(lines) {
  return lines
    .filter(l => l.status !== 'DETERMINED')
    .map(l => ({ lineNumber: l.lineNumber, errorCode: l.errorCode, reason: l.reason }));
}

/**
 * Set exceptions and success on an invoice-level result. success is true only
 * when every line is DETERMINED; otherwise reconciliation requires manual review.
 * @param {Object} result - Invoice tax result with lines and reconciliation
 */
function applyLineExceptions(result) {
  result.exceptions = collectLineExceptions(result.lines);
  result.success = result.lines.length > 0 && result.exceptions.length === 0 && !!result.header.taxCode;

  if (result.exceptions.length > 0) {
    result.reconciliation.withinTolerance = false;
    result.reconciliation.action = 'MANUAL_REVIEW';
    result.reconciliation.message = `${result.exceptions.length} line(s) could not be tax determined. ${result.reconciliation.message}`.trim();
  }
}

/**
 * Main tax determination entry point.
 * Automatically determines if PO or non-PO and routes accordingly.
 * 
 * @param {TaxDeterminationInput} input - Tax determination input
 * @returns {Promise<TaxDeterminationResult>} Tax determination result
 */
async function determineTax(input) {
  if (input.poNumber) {
    return determineTaxForPOInvoice(input);
  } else {
    return determineTaxForNonPOInvoice(input);
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log tax determination decision for audit/compliance.
 * 
 * @param {string} documentReference - Invoice/document reference
 * @param {TaxDeterminationInput} input - Input used for determination
 * @param {TaxDeterminationResult} result - Determination result
 */
async function logTaxDetermination(documentReference, input, result) {
  try {
    const db = await getDbService();
    const { TaxDeterminationAuditLog } = db.entities('vim.validators.tax');

    await INSERT.into(TaxDeterminationAuditLog).entries({
      documentReference,
      documentType: input.poNumber ? 'PO' : 'NONPO',
      lineItemNumber: parseInt(input.poLineNumber) || 0,
      appliedRuleId: result.ruleId,
      appliedRuleName: result.ruleName,
      inputCompanyCode: input.companyCode,
      inputVendorId: input.vendorId,
      inputSenderCountry: result.derivedAddresses?.vendor?.country,
      inputReceiverCountry: result.derivedAddresses?.company?.country || result.derivedAddresses?.plant?.country,
      inputReceiverProvince: result.derivedAddresses?.company?.region || result.derivedAddresses?.plant?.region,
      inputPlant: input.plant || result.derivedAddresses?.plant?.plant,
      inputMaterialGroup: input.materialGroup,
      inputNetAmount: input.netAmount,
      outputTaxCode: result.taxCode,
      outputTaxJurisdiction: result.taxJurisdiction,
      outputTaxAmount: result.taxAmount,
      outputTaxRate: result.taxRate,
      determinationMethod: result.determinationMethod,
      confidenceScore: result.confidence,
      processedAt: new Date().toISOString(),
      notes: result.message
    });
  } catch (error) {
    console.error('Error logging tax determination:', error);
  }
}

// ============================================================================
// VALIDATION RESULT WRAPPERS
// ============================================================================

/**
 * Create a validation result for tax determination.
 * @param {TaxDeterminationResult} taxResult - Tax determination result
 * @returns {import('./types').ValidationResult}
 */
function createTaxValidationResult(taxResult) {
  return createValidationResult(
    taxResult.success,
    taxResult.confidence,
    'taxCode',
    {
      derivedValue: taxResult.taxCode,
      matchStrategy: taxResult.determinationMethod,
      message: taxResult.message,
      metadata: {
        taxCode: taxResult.taxCode,
        taxJurisdiction: taxResult.taxJurisdiction,
        taxAmount: taxResult.taxAmount,
        taxRate: taxResult.taxRate,
        ruleId: taxResult.ruleId,
        ruleName: taxResult.ruleName,
        derivedAddresses: taxResult.derivedAddresses
      }
    }
  );
}

// ============================================================================
// COMPREHENSIVE LINE-ITEM TAX DETERMINATION (NON-PO)
// ============================================================================

/**
 * @typedef {Object} InvoiceLineItem
 * @property {string|number} lineNumber - Line item number
 * @property {string} [description] - Item description
 * @property {number} quantity - Quantity
 * @property {string} [unitOfMeasure] - Unit of measure
 * @property {number} unitPrice - Unit price
 * @property {number} netAmount - Net amount (quantity * unitPrice)
 * @property {string} [materialGroup] - Material group (if known)
 * @property {string} [expenseType] - Expense type (if known)
 * @property {string} [glAccount] - GL Account (if assigned)
 * @property {string} [costCenter] - Cost center (if assigned)
 * @property {string} [plant] - Plant (if known - for delivery location)
 * @property {string} [taxCode] - Tax code from invoice (for validation)
 * @property {number} [taxAmount] - Tax amount from invoice (for validation)
 */

/**
 * @typedef {Object} InvoiceTaxInput
 * @property {string} companyCode - Company code
 * @property {string} [vendorId] - Vendor ID
 * @property {string} [vendorName] - Vendor name (for lookup if no ID)
 * @property {string} currency - Currency code
 * @property {Date} [invoiceDate] - Invoice date (for tax calculation date)
 * @property {InvoiceLineItem[]} lineItems - Invoice line items
 * @property {number} [headerTaxAmount] - Tax amount from invoice header (for validation)
 * @property {string} [headerTaxCode] - Tax code from invoice header
 * @property {Object} [billToAddress] - Bill-to address from invoice (if extracted)
 * @property {string} [receiverCountry] - Override receiver country
 * @property {string} [receiverRegion] - Override receiver region/province
 */

/**
 * @typedef {Object} LineItemTaxResult
 * @property {string|number} lineNumber - Line item number
 * @property {string} description - Item description
 * @property {number} netAmount - Net amount
 * @property {string} taxCode - Determined tax code
 * @property {string} taxJurisdiction - Determined tax jurisdiction
 * @property {number} calculatedTaxAmount - Tax amount calculated by system
 * @property {number} taxRate - Tax rate percentage
 * @property {string} determinationMethod - How tax was determined
 * @property {number} confidence - Confidence score
 * @property {string} [invoiceTaxCode] - Tax code from invoice (if provided)
 * @property {number} [invoiceTaxAmount] - Tax amount from invoice (if provided)
 * @property {boolean} [taxCodeMatch] - Whether invoice tax code matches
 * @property {boolean} [taxAmountMatch] - Whether invoice tax amount matches (within tolerance)
 * @property {string} [discrepancyReason] - Reason for any discrepancy
 */

/**
 * @typedef {Object} InvoiceTaxResult
 * @property {boolean} success - Whether determination succeeded
 * @property {Object} header - Header-level tax information
 * @property {string} header.taxCode - Primary tax code for header
 * @property {string} header.taxJurisdiction - Primary tax jurisdiction
 * @property {number} header.totalNetAmount - Total net amount
 * @property {number} header.calculatedTaxAmount - Total calculated tax
 * @property {number} header.effectiveTaxRate - Weighted average tax rate
 * @property {string} header.determinationMethod - How header tax was determined
 * @property {LineItemTaxResult[]} lines - Line-item tax results
 * @property {Object} reconciliation - Tax amount reconciliation
 * @property {number} reconciliation.invoiceTaxAmount - Tax from invoice
 * @property {number} reconciliation.calculatedTaxAmount - Tax calculated
 * @property {number} reconciliation.difference - Difference amount
 * @property {number} reconciliation.differencePercent - Difference percentage
 * @property {boolean} reconciliation.withinTolerance - Within acceptable tolerance
 * @property {string} reconciliation.action - Recommended action
 * @property {string} reconciliation.message - Explanation
 * @property {Object} derivedAddresses - Addresses used for determination
 */

/**
 * Tax amount tolerance settings.
 */
const TAX_RECONCILIATION_TOLERANCES = {
  // Absolute tolerance in currency units
  absoluteTolerance: 0.01, // 1 cent
  // Percentage tolerance
  percentTolerance: 0.02,  // 2%
  // Maximum absolute difference regardless of percentage
  maxAbsoluteDifference: 5.00 // $5 max
};

/**
 * Determine expense type from line item description.
 * @param {string} description - Item description
 * @returns {string} Expense type
 */
function deriveExpenseTypeFromLineDescription(description) {
  if (!description) return 'miscellaneous';

  const lowerDesc = description.toLowerCase();

  // High-confidence mappings
  if (lowerDesc.includes('consulting') || lowerDesc.includes('consultant')) return 'consulting';
  if (lowerDesc.includes('legal') || lowerDesc.includes('attorney') || lowerDesc.includes('lawyer')) return 'legal';
  if (lowerDesc.includes('software') || lowerDesc.includes('license') || lowerDesc.includes('subscription')) return 'software';
  if (lowerDesc.includes('cloud') || lowerDesc.includes('aws') || lowerDesc.includes('azure')) return 'cloud_services';
  if (lowerDesc.includes('internet') || lowerDesc.includes('bandwidth')) return 'internet';
  if (lowerDesc.includes('phone') || lowerDesc.includes('telecom') || lowerDesc.includes('mobile')) return 'telecom';
  if (lowerDesc.includes('insurance') || lowerDesc.includes('premium')) return 'insurance';
  if (lowerDesc.includes('rent') || lowerDesc.includes('lease')) return 'rent';
  if (lowerDesc.includes('electric') || lowerDesc.includes('power')) return 'electricity';
  if (lowerDesc.includes('water')) return 'water';
  if (lowerDesc.includes('gas') && !lowerDesc.includes('gasoline')) return 'gas';
  if (lowerDesc.includes('maintenance') || lowerDesc.includes('repair')) return 'maintenance';
  if (lowerDesc.includes('office') || lowerDesc.includes('supplies') || lowerDesc.includes('stationery')) return 'office_supplies';
  if (lowerDesc.includes('training') || lowerDesc.includes('course') || lowerDesc.includes('certification')) return 'training';
  if (lowerDesc.includes('travel') || lowerDesc.includes('trip')) return 'travel';
  if (lowerDesc.includes('hotel') || lowerDesc.includes('lodging') || lowerDesc.includes('accommodation')) return 'lodging';
  if (lowerDesc.includes('airfare') || lowerDesc.includes('flight') || lowerDesc.includes('airline')) return 'airfare';
  if (lowerDesc.includes('meal') || lowerDesc.includes('catering') || lowerDesc.includes('food')) return 'meals';
  if (lowerDesc.includes('shipping') || lowerDesc.includes('freight') || lowerDesc.includes('delivery')) return 'postage';
  if (lowerDesc.includes('advertising') || lowerDesc.includes('marketing') || lowerDesc.includes('promotion')) return 'marketing';
  if (lowerDesc.includes('audit')) return 'audit';
  if (lowerDesc.includes('accounting') || lowerDesc.includes('bookkeeping')) return 'accounting';

  return 'miscellaneous';
}

/**
 * Determine tax for all line items of a Non-PO invoice and aggregate to header.
 * 
 * This function:
 * 1. Determines tax code and jurisdiction for each line item
 * 2. Calculates tax amount for each line
 * 3. Aggregates to header tax (most common tax code or weighted)
 * 4. Reconciles calculated tax vs invoice tax amount
 * 5. Provides recommended actions for discrepancies
 * 
 * @param {InvoiceTaxInput} input - Invoice with line items
 * @returns {Promise<InvoiceTaxResult>} Complete tax determination result
 */
async function determineInvoiceLineTax(input) {
  const {
    companyCode,
    vendorId,
    currency,
    invoiceDate,
    lineItems,
    headerTaxAmount,
    headerTaxCode,
    billToAddress,
    receiverCountry,
    receiverRegion
  } = input;

  const result = {
    success: false,
    header: {
      taxCode: null,
      taxJurisdiction: null,
      totalNetAmount: 0,
      calculatedTaxAmount: 0,
      effectiveTaxRate: 0,
      determinationMethod: null
    },
    lines: [],
    reconciliation: {
      invoiceTaxAmount: headerTaxAmount || 0,
      calculatedTaxAmount: 0,
      difference: 0,
      differencePercent: 0,
      withinTolerance: true,
      action: 'ACCEPT',
      message: ''
    },
    exceptions: [],
    derivedAddresses: {}
  };

  if (!lineItems || lineItems.length === 0) {
    result.reconciliation.message = 'No line items provided';
    return result;
  }

  try {
    // Get receiver address once (for all lines in non-PO scenario)
    const companyAddress = await getCompanyCodeAddress(companyCode);
    const vendor = await getVendorTaxInfo(vendorId, companyCode);

    // Determine receiver address
    let receiverAddress = null;
    let receiverSource = 'COMPANY_CODE';

    if (receiverCountry && receiverRegion) {
      receiverAddress = { country: receiverCountry, region: receiverRegion };
      receiverSource = 'OVERRIDE';
    } else if (billToAddress?.country && billToAddress?.region) {
      receiverAddress = billToAddress;
      receiverSource = 'BILL_TO';
    } else if (companyAddress) {
      receiverAddress = companyAddress;
      receiverSource = 'COMPANY_CODE';
    }

    result.derivedAddresses = {
      receiver: receiverAddress,
      receiverSource,
      company: companyAddress,
      vendor
    };

    // Track tax codes and amounts for aggregation
    const taxCodeCounts = {};
    const taxCodeAmounts = {};
    const jurisdictionCounts = {};
    let totalNetAmount = 0;
    let totalCalculatedTax = 0;

    // Process each line item
    for (const lineItem of lineItems) {
      const lineNetAmount = lineItem.netAmount || (lineItem.quantity * lineItem.unitPrice) || 0;
      totalNetAmount += lineNetAmount;

      // Derive expense type from description if not provided
      const expenseType = lineItem.expenseType ||
        deriveExpenseTypeFromLineDescription(lineItem.description);

      // Determine tax for this line
      const lineTaxResult = await determineTaxForNonPOInvoice({
        companyCode,
        vendorId,
        netAmount: lineNetAmount,
        currency,
        expenseType,
        taxDate: invoiceDate,
        plant: lineItem.plant,
        costCenter: lineItem.costCenter,
        receiverCountry: receiverAddress?.country,
        receiverRegion: receiverAddress?.region,
        billToAddress
      });

      // Build line result
      const lineResult = {
        lineNumber: lineItem.lineNumber,
        status: lineTaxResult.status,
        errorCode: lineTaxResult.errorCode,
        reason: lineTaxResult.message,
        description: lineItem.description || '',
        netAmount: lineNetAmount,
        taxCode: lineTaxResult.taxCode,
        taxJurisdiction: lineTaxResult.taxJurisdiction,
        calculatedTaxAmount: lineTaxResult.taxAmount,
        taxRate: lineTaxResult.taxRate,
        determinationMethod: lineTaxResult.determinationMethod,
        confidence: lineTaxResult.confidence,
        expenseType
      };

      // Compare with invoice-provided tax (if available)
      if (lineItem.taxCode) {
        lineResult.invoiceTaxCode = lineItem.taxCode;
        lineResult.taxCodeMatch = lineItem.taxCode === lineTaxResult.taxCode;

        if (!lineResult.taxCodeMatch) {
          lineResult.discrepancyReason = `Invoice tax code ${lineItem.taxCode} differs from calculated ${lineTaxResult.taxCode}`;
        }
      }

      if (lineItem.taxAmount !== undefined) {
        lineResult.invoiceTaxAmount = lineItem.taxAmount;
        const lineDiff = Math.abs(lineItem.taxAmount - lineTaxResult.taxAmount);
        const lineDiffPercent = lineTaxResult.taxAmount > 0
          ? lineDiff / lineTaxResult.taxAmount
          : (lineItem.taxAmount > 0 ? 1 : 0);

        lineResult.taxAmountMatch = lineDiff <= TAX_RECONCILIATION_TOLERANCES.absoluteTolerance ||
          lineDiffPercent <= TAX_RECONCILIATION_TOLERANCES.percentTolerance;

        if (!lineResult.taxAmountMatch) {
          lineResult.discrepancyReason = (lineResult.discrepancyReason || '') +
            ` Tax amount differs: invoice ${lineItem.taxAmount}, calculated ${lineTaxResult.taxAmount.toFixed(2)}`;
        }
      }

      result.lines.push(lineResult);
      totalCalculatedTax += lineTaxResult.taxAmount;

      // Track for header aggregation
      if (lineTaxResult.taxCode) {
        taxCodeCounts[lineTaxResult.taxCode] = (taxCodeCounts[lineTaxResult.taxCode] || 0) + 1;
        taxCodeAmounts[lineTaxResult.taxCode] = (taxCodeAmounts[lineTaxResult.taxCode] || 0) + lineNetAmount;
      }
      if (lineTaxResult.taxJurisdiction) {
        jurisdictionCounts[lineTaxResult.taxJurisdiction] = (jurisdictionCounts[lineTaxResult.taxJurisdiction] || 0) + 1;
      }
    }

    // =========================================================================
    // AGGREGATE TO HEADER
    // =========================================================================

    // Strategy: Use tax code with highest total amount (weighted by line amounts)
    let headerTaxCodeDerived = null;
    let maxAmount = 0;

    for (const [taxCode, amount] of Object.entries(taxCodeAmounts)) {
      if (amount > maxAmount) {
        maxAmount = amount;
        headerTaxCodeDerived = taxCode;
      }
    }

    // Get most common jurisdiction
    const headerJurisdiction = Object.entries(jurisdictionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Determine if all lines have same tax code
    const uniqueTaxCodes = Object.keys(taxCodeCounts);
    const allSameTaxCode = uniqueTaxCodes.length === 1;

    result.header = {
      taxCode: headerTaxCodeDerived,
      taxJurisdiction: headerJurisdiction,
      totalNetAmount,
      calculatedTaxAmount: totalCalculatedTax,
      effectiveTaxRate: totalNetAmount > 0 ? (totalCalculatedTax / totalNetAmount) * 100 : 0,
      determinationMethod: allSameTaxCode ? 'ALL_LINES_SAME' : 'WEIGHTED_BY_AMOUNT',
      allLinesSameTaxCode: allSameTaxCode,
      uniqueTaxCodes
    };

    // =========================================================================
    // RECONCILE WITH INVOICE TAX AMOUNT
    // =========================================================================

    result.reconciliation.calculatedTaxAmount = totalCalculatedTax;

    if (headerTaxAmount !== undefined && headerTaxAmount !== null) {
      const difference = headerTaxAmount - totalCalculatedTax;
      const absDifference = Math.abs(difference);
      const percentDifference = totalCalculatedTax > 0
        ? absDifference / totalCalculatedTax
        : (headerTaxAmount > 0 ? 1 : 0);

      result.reconciliation.difference = difference;
      result.reconciliation.differencePercent = percentDifference * 100;

      // Check if within tolerance
      const withinAbsolute = absDifference <= TAX_RECONCILIATION_TOLERANCES.absoluteTolerance;
      const withinPercent = percentDifference <= TAX_RECONCILIATION_TOLERANCES.percentTolerance;
      const withinMaxAbsolute = absDifference <= TAX_RECONCILIATION_TOLERANCES.maxAbsoluteDifference;

      result.reconciliation.withinTolerance = withinAbsolute || (withinPercent && withinMaxAbsolute);

      // Determine action and message
      if (result.reconciliation.withinTolerance) {
        result.reconciliation.action = 'ACCEPT';
        result.reconciliation.message = absDifference === 0
          ? 'Invoice tax matches calculated tax exactly'
          : `Tax difference of ${difference.toFixed(2)} ${currency} (${(percentDifference * 100).toFixed(2)}%) is within tolerance`;
      } else {
        // Significant discrepancy - determine reason and action
        if (difference > 0) {
          // Invoice tax is HIGHER than calculated
          result.reconciliation.action = 'REVIEW_OVERSTATED';
          result.reconciliation.message = `Invoice tax (${headerTaxAmount.toFixed(2)}) exceeds calculated tax (${totalCalculatedTax.toFixed(2)}) by ${absDifference.toFixed(2)} ${currency}. ` +
            `Possible reasons: incorrect tax rate on invoice, tax on non-taxable items, or different tax jurisdiction used by vendor.`;
        } else {
          // Invoice tax is LOWER than calculated
          result.reconciliation.action = 'REVIEW_UNDERSTATED';
          result.reconciliation.message = `Invoice tax (${headerTaxAmount.toFixed(2)}) is less than calculated tax (${totalCalculatedTax.toFixed(2)}) by ${absDifference.toFixed(2)} ${currency}. ` +
            `Possible reasons: tax exemption not reflected in our rules, vendor applied different rate, or partial tax on some items.`;
        }

        // Additional guidance
        if (percentDifference > 0.1) { // More than 10% difference
          result.reconciliation.action = 'ESCALATE';
          result.reconciliation.message += ' ESCALATE: Large discrepancy requires manual review.';
        }
      }

      // Check if invoice header tax code matches
      if (headerTaxCode && headerTaxCode !== headerTaxCodeDerived) {
        result.reconciliation.headerTaxCodeMatch = false;
        result.reconciliation.message += ` Note: Invoice header tax code (${headerTaxCode}) differs from derived (${headerTaxCodeDerived}).`;
      } else if (headerTaxCode) {
        result.reconciliation.headerTaxCodeMatch = true;
      }
    } else {
      // No invoice tax amount to compare
      result.reconciliation.action = 'USE_CALCULATED';
      result.reconciliation.message = `No invoice tax amount provided. Using calculated tax: ${totalCalculatedTax.toFixed(2)} ${currency}`;
    }

    applyLineExceptions(result);

    return result;
  } catch (error) {
    console.error('Error in invoice line tax determination:', error);
    result.reconciliation.message = `Error: ${error.message}`;
    result.reconciliation.action = 'ERROR';
    return result;
  }
}

/**
 * Determine tax for all line items of a PO invoice with reconciliation.
 * 
 * @param {Object} input - PO invoice input
 * @param {string} input.poNumber - Purchase order number
 * @param {string} input.companyCode - Company code
 * @param {string} input.currency - Currency code
 * @param {InvoiceLineItem[]} input.lineItems - Invoice line items (with poLineNumber for matching)
 * @param {number} [input.headerTaxAmount] - Tax amount from invoice header
 * @param {Date} [input.invoiceDate] - Invoice date
 * @returns {Promise<InvoiceTaxResult>} Complete tax determination result
 */
async function determinePOInvoiceLineTax(input) {
  const {
    poNumber,
    companyCode,
    currency,
    lineItems,
    headerTaxAmount,
    invoiceDate
  } = input;

  const result = {
    success: false,
    header: {
      taxCode: null,
      taxJurisdiction: null,
      totalNetAmount: 0,
      calculatedTaxAmount: 0,
      effectiveTaxRate: 0,
      determinationMethod: null
    },
    lines: [],
    reconciliation: {
      invoiceTaxAmount: headerTaxAmount || 0,
      calculatedTaxAmount: 0,
      difference: 0,
      differencePercent: 0,
      withinTolerance: true,
      action: 'ACCEPT',
      message: ''
    },
    exceptions: [],
    derivedAddresses: {}
  };

  // Get PO details
  const poDetails = await getPOTaxDetails(poNumber);
  if (!poDetails) {
    result.reconciliation.message = `PO ${poNumber} not found`;
    result.reconciliation.action = 'ERROR';
    return result;
  }

  const taxCodeCounts = {};
  const taxCodeAmounts = {};
  let totalNetAmount = 0;
  let totalCalculatedTax = 0;

  for (const lineItem of lineItems) {
    const lineNetAmount = lineItem.netAmount || 0;
    totalNetAmount += lineNetAmount;

    // Match to PO line item
    const poLineNumber = lineItem.poLineNumber || lineItem.lineNumber;

    // Determine tax using PO logic
    const lineTaxResult = await determineTaxForPOInvoice({
      poNumber,
      poLineNumber: poLineNumber?.toString(),
      companyCode: companyCode || poDetails.header.companyCode,
      vendorId: poDetails.header.vendorId,
      netAmount: lineNetAmount,
      currency: currency || poDetails.header.currency,
      taxDate: invoiceDate
    });

    // Find corresponding PO item for plant info
    const poItem = poDetails.items.find(i =>
      i.poItem === poLineNumber?.toString().padStart(5, '0')
    );

    const lineResult = {
      lineNumber: lineItem.lineNumber,
      status: lineTaxResult.status,
      errorCode: lineTaxResult.errorCode,
      reason: lineTaxResult.message,
      poLineNumber,
      description: lineItem.description || poItem?.shortText || '',
      netAmount: lineNetAmount,
      taxCode: lineTaxResult.taxCode,
      taxJurisdiction: lineTaxResult.taxJurisdiction,
      calculatedTaxAmount: lineTaxResult.taxAmount,
      taxRate: lineTaxResult.taxRate,
      determinationMethod: lineTaxResult.determinationMethod,
      confidence: lineTaxResult.confidence,
      plant: poItem?.plant || '',
      poTaxCode: poItem?.taxCode // Tax code from PO for reference
    };

    // Compare with invoice-provided values
    if (lineItem.taxCode) {
      lineResult.invoiceTaxCode = lineItem.taxCode;
      lineResult.taxCodeMatch = lineItem.taxCode === lineTaxResult.taxCode;
    }

    if (lineItem.taxAmount !== undefined) {
      lineResult.invoiceTaxAmount = lineItem.taxAmount;
      const lineDiff = Math.abs(lineItem.taxAmount - lineTaxResult.taxAmount);
      lineResult.taxAmountMatch = lineDiff <= TAX_RECONCILIATION_TOLERANCES.absoluteTolerance;
    }

    result.lines.push(lineResult);
    totalCalculatedTax += lineTaxResult.taxAmount;

    if (lineTaxResult.taxCode) {
      taxCodeCounts[lineTaxResult.taxCode] = (taxCodeCounts[lineTaxResult.taxCode] || 0) + 1;
      taxCodeAmounts[lineTaxResult.taxCode] = (taxCodeAmounts[lineTaxResult.taxCode] || 0) + lineNetAmount;
    }
  }

  // Aggregate header (same logic as non-PO)
  let headerTaxCode = null;
  let maxAmount = 0;
  for (const [taxCode, amount] of Object.entries(taxCodeAmounts)) {
    if (amount > maxAmount) {
      maxAmount = amount;
      headerTaxCode = taxCode;
    }
  }

  const uniqueTaxCodes = Object.keys(taxCodeCounts);

  result.header = {
    taxCode: headerTaxCode,
    taxJurisdiction: result.lines.find(l => l.taxCode && l.taxCode === headerTaxCode)?.taxJurisdiction || null,
    totalNetAmount,
    calculatedTaxAmount: totalCalculatedTax,
    effectiveTaxRate: totalNetAmount > 0 ? (totalCalculatedTax / totalNetAmount) * 100 : 0,
    determinationMethod: uniqueTaxCodes.length === 1 ? 'ALL_LINES_SAME' : 'WEIGHTED_BY_AMOUNT',
    allLinesSameTaxCode: uniqueTaxCodes.length === 1,
    uniqueTaxCodes
  };

  // Reconciliation (same logic as non-PO)
  result.reconciliation.calculatedTaxAmount = totalCalculatedTax;

  if (headerTaxAmount !== undefined && headerTaxAmount !== null) {
    const difference = headerTaxAmount - totalCalculatedTax;
    const absDifference = Math.abs(difference);
    const percentDifference = totalCalculatedTax > 0 ? absDifference / totalCalculatedTax : 0;

    result.reconciliation.difference = difference;
    result.reconciliation.differencePercent = percentDifference * 100;
    result.reconciliation.withinTolerance =
      absDifference <= TAX_RECONCILIATION_TOLERANCES.absoluteTolerance ||
      (percentDifference <= TAX_RECONCILIATION_TOLERANCES.percentTolerance &&
        absDifference <= TAX_RECONCILIATION_TOLERANCES.maxAbsoluteDifference);

    if (result.reconciliation.withinTolerance) {
      result.reconciliation.action = 'ACCEPT';
      result.reconciliation.message = `Tax matches within tolerance`;
    } else {
      result.reconciliation.action = difference > 0 ? 'REVIEW_OVERSTATED' : 'REVIEW_UNDERSTATED';
      result.reconciliation.message = `Tax discrepancy of ${absDifference.toFixed(2)} (${(percentDifference * 100).toFixed(1)}%) requires review`;
    }
  } else {
    result.reconciliation.action = 'USE_CALCULATED';
    result.reconciliation.message = `Using calculated tax: ${totalCalculatedTax.toFixed(2)}`;
  }

  applyLineExceptions(result);
  result.derivedAddresses = { poHeader: poDetails.header };

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // BAPI Wrappers
  getPlantAddress,
  getPlantAddressFromPO,
  getCompanyCodeAddress,
  getVendorTaxInfo,
  getPOTaxDetails,
  derivePlantFromCostCenter,

  // Tax Code/Jurisdiction Lookup
  getTaxCodesForCountry,
  getTaxJurisdictionsForCountry,
  getCanadianProvincialTax,
  getUSStateTax,

  // Tax Calculation
  calculateTaxAmount,

  // Rules Engine
  loadTaxDeterminationRules,
  findMatchingTaxRule,

  // Main Determination Functions
  determineTax,
  determineTaxForPOInvoice,
  determineTaxForNonPOInvoice,
  determineTaxForPOInvoiceLines,

  // Line-Item Tax Determination with Header Aggregation & Reconciliation
  determineInvoiceLineTax,      // For Non-PO invoices
  determinePOInvoiceLineTax,    // For PO invoices

  // Configuration
  TAX_RECONCILIATION_TOLERANCES,

  // Audit
  logTaxDetermination,

  // Utilities
  createTaxValidationResult,
  deriveExpenseTypeFromLineDescription
};
