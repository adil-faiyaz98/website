// @ts-check
/**
 * @fileoverview Comprehensive PO Lookup Script
 * Fetches all relevant details for a Purchase Order including:
 * - PO header details (number, type, dates, status)
 * - PO currency and exchange rate info
 * - Vendor associated with PO
 * - Company code details
 * - Payment terms and due dates
 * - Vendor blocking status
 * - PO line items with account assignments
 */

const cds = require('@sap/cds');
const { normalizePONumberPadded, normalizeVendorNumberPadded } = require('./utils/normalizers');
const cache = require('./cache');

/**
 * @typedef {Object} POLookupResult
 * @property {boolean} success - Whether the lookup was successful
 * @property {string} [error] - Error message if lookup failed
 * @property {POHeaderInfo} [header] - PO header information
 * @property {VendorInfo} [vendor] - Vendor details
 * @property {CompanyCodeInfo} [companyCode] - Company code details
 * @property {PaymentInfo} [payment] - Payment terms and info
 * @property {POLineItem[]} [lineItems] - PO line items
 * @property {Object} [summary] - Quick summary of key info
 */

/**
 * @typedef {Object} POHeaderInfo
 * @property {string} poNumber - Purchase order number
 * @property {string} companyCode - Company code
 * @property {string} docType - Document type (NB, FO, etc.)
 * @property {string} docCategory - Document category
 * @property {string} status - PO status
 * @property {string} createdOn - Creation date
 * @property {string} createdBy - Created by user
 */

/**
 * @property {string} docDate - Document date
 * @property {string} purchaseOrg - Purchasing organization
 * @property {string} purchaseGroup - Purchasing group
 * @property {string} currency - PO currency
 * @property {string} currencyISO - ISO currency code
 * @property {number} exchangeRate - Exchange rate
 * @property {boolean} exchangeRateFixed - Is exchange rate fixed
 * @property {string} incoterms1 - Incoterms part 1
 * @property {string} incoterms2 - Incoterms part 2
 * @property {string} releaseStatus - Release status
 * @property {string} releaseIndicator - Release indicator
 * @property {boolean} isDeleted - Deletion indicator
 * @property {boolean} isOnHold - Hold status
 * @property {number} targetValue - Target value
 */

/**
 * @typedef {Object} VendorInfo
 * @property {string} vendorId - Vendor number
 * @property {string} name - Vendor name
 * @property {string} name2 - Vendor name line 2
 * @property {string} name3 - Vendor name line 3
 * @property {string} name4 - Vendor name line 4
 * @property {string} street - Street address
 * @property {string} city - City
 * @property {string} postalCode - Postal code
 * @property {string} region - Region/State
 * @property {string} country - Country code
 * @property {string} countryISO - ISO country code
 * @property {string} telephone - Phone number
 * @property {string} fax - Fax number
 * @property {string} language - Language key
 * @property {boolean} isBlocked - General posting block
 * @property {boolean} isPaymentBlocked - Payment block
 * @property {boolean} isPurchasingBlocked - Purchasing block
 * @property {string} paymentMethods - Payment methods
 * @property {string} alternatePayee - Alternate payee
 * @property {string} clerkCode - Accounting clerk
 */

/**
 * @typedef {Object} CompanyCodeInfo
 * @property {string} companyCode - Company code
 * @property {string} companyName - Company name
 * @property {string} city - City
 * @property {string} country - Country
 * @property {string} countryISO - ISO country code
 * @property {string} currency - Local currency
 * @property {string} currencyISO - ISO currency code
 * @property {string} language - Language
 * @property {string} chartOfAccounts - Chart of accounts
 * @property {string} fiscalYearVariant - Fiscal year variant
 * @property {string} vatRegNumber - VAT registration number
 * @property {Object} address - Full address details
 */

/**
 * @typedef {Object} PaymentInfo
 * @property {string} paymentTerms - Payment terms key
 * @property {string} paymentTermsDescription - Payment terms description
 * @property {number} discount1Days - Days for discount 1
 * @property {number} discount2Days - Days for discount 2
 * @property {number} netDueDays - Net due days
 * @property {number} discount1Percent - Discount 1 percentage
 * @property {number} discount2Percent - Discount 2 percentage
 * @property {string} calculatedDueDate - Calculated due date
 * @property {string} discount1Date - Discount 1 date
 * @property {string} discount2Date - Discount 2 date
 */

/**
 * @typedef {Object} POLineItem
 * @property {string} poNumber - PO number
 * @property {string} itemNumber - Item number
 * @property {string} material - Material number
 * @property {string} shortText - Item description
 * @property {string} plant - Plant
 */

/**
 * @property {string} storageLocation - Storage location
 * @property {string} materialGroup - Material group
 * @property {string} itemCategory - Item category
 * @property {string} accountAssignmentCategory - Account assignment cat
 * @property {number} quantity - Order quantity
 * @property {string} unit - Unit of measure
 * @property {number} netPrice - Net price
 * @property {number} priceUnit - Price unit
 * @property {number} netValue - Net value
 * @property {string} taxCode - Tax code
 * @property {string} taxJurisdiction - Tax jurisdiction code
 * @property {boolean} isDeleted - Deletion indicator
 * @property {boolean} isGRBased - GR-based invoice verification
 * @property {boolean} isFinalInvoice - Final invoice indicator
 * @property {Object[]} accountAssignments - Account assignment details
 */

// ============================================================================
// ECC SERVICE CONNECTION
// ============================================================================

/**
 * Get the ECC integration service.
 * @returns {Promise<any>} ECC service instance
 */
async function getEccService() {
    return await cds.connect.to('vim_ecc_integration');
}

// ============================================================================
// MAIN LOOKUP FUNCTION
// ============================================================================

/**
 * Comprehensive PO lookup - fetches all relevant details for a purchase order.
 * @param {string} poNumber - Purchase order number
 * @param {Object} [options] - Lookup options
 * @param {boolean} [options.includeVendorDetail=true] - Fetch vendor details
 * @param {boolean} [options.includeCompanyCode=true] - Fetch company details
 * @param {boolean} [options.includeLineItems=true] - Fetch line items
 * @param {boolean} [options.includeAccountAssignments=true] - Fetch acct assignments
 * @param {boolean} [options.includeHistory=false] - Fetch PO history
 * @param {boolean} [options.useCache=true] - Use caching
 * @returns {Promise<POLookupResult>} Complete PO information
 */

async function lookupPO(poNumber, options = {}) {
    const {
        includeVendorDetail = true,
        includeCompanyCode = true,
        includeLineItems = true,
        includeAccountAssignments = true,
        includeHistory = false,
        useCache = true
    } = options;

    if (!poNumber) {
        return {
            success: false,
            error: 'PO number is required'
        };
    }

    const normalizedPO = normalizePONumberPadded(poNumber);
    
    try {
        const ecc = await getEccService();
        
        // Fetch PO detail from ECC using getPODetail (more comprehensive)
        const poResult = await ecc.getPODetail({
            PURCHASEORDER: normalizedPO,
            ITEMS: includeLineItems ? 'X' : '',
            ACCOUNT_ASSIGNMENT: includeAccountAssignments ? 'X' : '',
            HISTORY: includeHistory ? 'X' : '',
            SCHEDULES: 'X'
        });

        // Check for errors
        if (!poResult) {
            return {
                success: false,
                error: `PO ${poNumber} not found - no response from ECC`
            };
        }

        if (poResult.RETURN?.TYPE === 'E') {
            return {
                success: false,
                error: poResult.RETURN.MESSAGE || `PO ${poNumber} not found`
            };
        }

        // Extract PO header information
        const header = extractPOHeader(poResult);
        
        if (!header.poNumber) {
            return {
                success: false,
                error: `PO ${poNumber} not found in ECC`
            };
        }

        // Build result object
        const result = {
            success: true,
            header
        };

        // Fetch vendor details if requested
        if (includeVendorDetail && header.vendorId) {
            result.vendor = await fetchVendorInfo(
                ecc, 
                header.vendorId, 
                header.companyCode
            );
        }

        // Fetch company code details if requested
        if (includeCompanyCode && header.companyCode) {
            result.companyCode = await fetchCompanyCodeInfo(
                ecc, 
                header.companyCode
            );
        }

        // Extract payment information
        result.payment = extractPaymentInfo(poResult, header);

        // Extract line items if requested
        if (includeLineItems) {
            result.lineItems = extractLineItems(poResult);
            
            // Merge account assignments into line items
            if (includeAccountAssignments && poResult.POACCOUNT) {
                mergeAccountAssignments(result.lineItems, poResult.POACCOUNT);
            }
        }

        // Build summary
        result.summary = buildSummary(result);

        return result;

    } catch (error) {
        console.error(`Error looking up PO ${poNumber}:`, error);
        return {
            success: false,
            error: `Failed to fetch PO ${poNumber}: ${error.message}`
        };
    }
}


// ============================================================================
// HEADER EXTRACTION
// ============================================================================

/**
 * Extract PO header information from ECC response.
 * @param {Object} poResult - Raw ECC PO detail response
 * @returns {POHeaderInfo} Extracted header info
 */
function extractPOHeader(poResult) {
    const h = poResult.POHEADER || poResult;
    
    return {
        // Basic identification
        poNumber: h.PO_NUMBER,
        companyCode: h.CO_CODE,
        docType: h.DOC_TYPE,
        docCategory: h.DOC_CAT,
        
        // Status info
        status: h.STATUS,
        isDeleted: h.DELETE_IND === 'X',
        isOnHold: h.HOLD === 'X',
        releaseStatus: h.REL_STATUS,
        releaseIndicator: h.REL_IND,
        releaseGroup: h.REL_GROUP,
        releaseStrategy: h.REL_STRAT,
        
        // Dates
        createdOn: h.CREATED_ON,
        createdBy: h.CREATED_BY,
        docDate: h.DOC_DATE,
        validityStart: h.VPER_START,
        validityEnd: h.VPER_END,
        
        // Organizational data
        purchaseOrg: h.PURCH_ORG,
        purchaseGroup: h.PUR_GROUP,
        
        // Vendor (basic from PO header)
        vendorId: h.VENDOR,
        vendorName: h.VEND_NAME,
        supplyingVendor: h.SUPPL_VEND,
        supplyingPlant: h.SUPPL_PLNT,
        
        // Currency and pricing
        currency: h.CURRENCY,
        currencyISO: h.CURRENCY_ISO,
        exchangeRate: parseFloat(h.EXCH_RATE) || 0,
        exchangeRateFixed: h.EX_RATE_FX === 'X',
        targetValue: parseFloat(h.TARGET_VAL) || 0,

        // Payment terms
        paymentTerms: h.PMNTTRMS,
        discount1Days: parseFloat(h.DSCNT1_TO) || 0,
        discount2Days: parseFloat(h.DSCNT2_TO) || 0,
        netDueDays: parseFloat(h.DSCNT3_TO) || 0,
        cashDiscount1: parseFloat(h.CASH_DISC1) || 0,
        cashDiscount2: parseFloat(h.CASH_DISC2) || 0,
        
        // Trade terms
        incoterms1: h.INCOTERMS1,
        incoterms2: h.INCOTERMS2,
        
        // References
        agreement: h.AGREEMENT,
        quotation: h.QUOTATION,
        quotationDate: h.QUOT_DATE,
        ourReference: h.OUR_REF,
        salesPerson: h.SALES_PERS,
        telephone: h.TELEPHONE,
        
        // Tax
        taxCountry: h.TAXR_CNTRY,
        
        // Other
        language: h.LANGUAGE,
        completeDelivery: h.COMPL_DLV === 'X',
        grMessage: h.GR_MESSAGE === 'X'
    };
}

// ============================================================================
// VENDOR INFO FETCHING
// ============================================================================

/**
 * Fetch comprehensive vendor information.
 * @param {Object} ecc - ECC service instance
 * @param {string} vendorId - Vendor ID
 * @param {string} companyCode - Company code
 * @returns {Promise<VendorInfo|null>} Vendor information
 */
async function fetchVendorInfo(ecc, vendorId, companyCode) {
    try {
        const normalizedVendor = normalizeVendorNumberPadded(vendorId);
        
        const result = await ecc.getVendorDetail({
            VENDORNO: normalizedVendor,
            COMPANYCODE: companyCode
        });

        if (!result || result.RETURN?.TYPE === 'E') {
            console.warn(`Vendor ${vendorId} not found or error`);
            return null;
        }

        const general = result.GENERALDETAIL || {};
        const company = result.COMPANYDETAIL || {};

        return {
            // Basic identification
            vendorId: general.VENDOR || normalizedVendor,
            
            // Name fields
            name: general.NAME,
            name2: general.NAME_2,
            name3: general.NAME_3,
            name4: general.NAME_4,
            
            // Address
            street: general.STREET,
            city: general.CITY,
            district: general.DISTRICT,
            postalCode: general.POSTL_CODE,
            poBox: general.PO_BOX,
            poBoxPostalCode: general.POBX_PCD,
            poBoxCity: general.POBX_CTY,
            region: general.REGION,
            country: general.COUNTRY,
            countryISO: general.COUNTRYISO,
            
            // Communication
            telephone: general.TELEPHONE,
            telephone2: general.TELEPHONE2,
            fax: company.FAX,
            internet: company.INTERNET,
            
            // Language
            language: general.LANGU,
            languageISO: general.LANGU_ISO,
            formOfAddress: general.FORMOFADDR,
            
            // Company-specific data
            clerkCode: company.CLERK,
            headOffice: company.HD_OFFICE,
            alternatePayee: company.ALT_PAYEE,
            accountAtVendor: company.ACT_AT_VEN,
            vendorUser: company.VEND_USER,

            // Payment info
            paymentTerms: company.PMNTTRMS,
            paymentMethods: company.PAYMENT_METHODS,
            clearingWithVendor: company.CUVD_CLEAR === 'X',
            
            // Blocking status - these would come from additional calls
            // or extended vendor data if available
            isBlocked: false,
            isPaymentBlocked: false,
            isPurchasingBlocked: false
        };

    } catch (error) {
        console.error(`Error fetching vendor ${vendorId}:`, error);
        return null;
    }
}

// ============================================================================
// COMPANY CODE INFO FETCHING
// ============================================================================

/**
 * Fetch company code details.
 * @param {Object} ecc - ECC service instance
 * @param {string} companyCode - Company code
 * @returns {Promise<CompanyCodeInfo|null>} Company code information
 */
async function fetchCompanyCodeInfo(ecc, companyCode) {
    try {
        const result = await ecc.getCompanyCodeDetail({
            COMPANYCODEID: companyCode
        });

        if (!result || result.RETURN?.TYPE === 'E') {
            console.warn(`Company code ${companyCode} not found`);
            return null;
        }

        const detail = result.COMPANYCODE_DETAIL || {};
        const address = result.COMPANYCODE_ADDRESS || {};

        return {
            companyCode: detail.COMP_CODE,
            companyName: detail.COMP_NAME,
            city: detail.CITY,
            country: detail.COUNTRY,
            countryISO: detail.COUNTRY_ISO,
            currency: detail.CURRENCY,
            currencyISO: detail.CURRENCY_ISO,

            language: detail.LANGU,
            languageISO: detail.LANGU_ISO,
            chartOfAccounts: detail.CHRT_ACCTS,
            fiscalYearVariant: detail.FY_VARIANT,
            vatRegNumber: detail.VAT_REG_NO,
            company: detail.COMPANY,
            addressNumber: detail.ADDR_NO,
            
            // Full address details
            address: {
                formOfAddress: address.FORMOFADDR,
                name: address.NAME,
                name2: address.NAME_2,
                name3: address.NAME_3,
                name4: address.NAME_4,
                coName: address.C_O_NAME,
                city: address.CITY,
                district: address.DISTRICT,
                postalCode1: address.POSTL_COD1,
                postalCode2: address.POSTL_COD2,
                postalCode3: address.POSTL_COD3,
                poBox: address.PO_BOX,
                poBoxCity: address.PO_BOX_CIT,
                street: address.STREET,
                streetNumber: address.STREET_NO,
                houseNumber: address.HOUSE_NO,
                building: address.BUILDING,
                floor: address.FLOOR,
                room: address.ROOM_NO,
                country: address.COUNTRY,
                region: address.REGION,
                timeZone: address.TIME_ZONE,
                taxJurisdiction: address.TAXJURCODE,
                telephone: address.TEL1_NUMBR,
                telephoneExt: address.TEL1_EXT,
                fax: address.FAX_NUMBER,
                faxExt: address.FAX_EXTENS
            }
        };

    } catch (error) {
        console.error(`Error fetching company code ${companyCode}:`, error);
        return null;
    }
}


// ============================================================================
// PAYMENT INFO EXTRACTION
// ============================================================================

/**
 * Extract and calculate payment information.
 * @param {Object} poResult - Raw ECC response
 * @param {POHeaderInfo} header - Extracted header
 * @returns {PaymentInfo} Payment information
 */
function extractPaymentInfo(poResult, header) {
    const baseDate = header.docDate ? new Date(header.docDate) : new Date();
    
    // Calculate due dates based on payment terms
    const discount1Date = addDays(baseDate, header.discount1Days);
    const discount2Date = addDays(baseDate, header.discount2Days);
    const netDueDate = addDays(baseDate, header.netDueDays || 30);

    return {
        paymentTerms: header.paymentTerms,
        paymentTermsDescription: getPaymentTermsDescription(header.paymentTerms),
        
        // Discount periods
        discount1Days: header.discount1Days,
        discount1Percent: header.cashDiscount1,
        discount1Date: formatDate(discount1Date),
        
        discount2Days: header.discount2Days,
        discount2Percent: header.cashDiscount2,
        discount2Date: formatDate(discount2Date),
        
        // Net due
        netDueDays: header.netDueDays || 30,
        calculatedDueDate: formatDate(netDueDate),
        
        // Base date for calculations
        baseDate: formatDate(baseDate)
    };
}

/**
 * Get a human-readable description for payment terms.
 * @param {string} paymentTerms - Payment terms key
 * @returns {string} Description
 */
function getPaymentTermsDescription(paymentTerms) {
    // Common payment terms descriptions
    const descriptions = {
        'NT30': 'Net 30 days',
        'NT45': 'Net 45 days',
        'NT60': 'Net 60 days',
        'NT90': 'Net 90 days',

        'Z001': 'Payable immediately',
        'Z010': 'Net 10 days',
        'Z014': 'Net 14 days',
        'Z030': 'Net 30 days',
        '0001': 'Payable immediately',
        '0002': 'Within 14 days 2% discount',
        '0003': 'Within 30 days net'
    };
    
    return descriptions[paymentTerms] || `Payment terms: ${paymentTerms || 'Not specified'}`;
}

// ============================================================================
// LINE ITEMS EXTRACTION
// ============================================================================

/**
 * Extract PO line items from ECC response.
 * @param {Object} poResult - Raw ECC response
 * @returns {POLineItem[]} Line items
 */
function extractLineItems(poResult) {
    const items = poResult.POITEM || [];
    
    return items.map(item => ({
        // Identification
        poNumber: item.PO_NUMBER,
        itemNumber: item.PO_ITEM,
        
        // Material info
        material: item.MATERIAL,
        materialLong: item.MATERIAL_LONG,
        vendorMaterial: item.VEND_MAT,
        purchasingMaterial: item.PUR_MAT,
        shortText: item.SHORT_TEXT,
        
        // Organizational
        plant: item.PLANT,
        storageLocation: item.STORE_LOC,
        materialGroup: item.MAT_GRP,
        
        // Categorization
        itemCategory: item.ITEM_CAT,
        itemCategoryExt: item.ITEM_CAT_EXT,
        accountAssignmentCategory: item.ACCTASSCAT,
        
        // Quantities and units
        quantity: parseFloat(item.QUANTITY) || 0,
        unit: item.UNIT || item.PO_UNIT,
        unitISO: item.PO_UNIT_ISO,

        orderUnit: item.ORDERPR_UN,
        orderUnitISO: item.ORDERPR_UN_ISO,
        
        // Conversion factors
        conversionNumerator: parseFloat(item.CONV_NUM1) || 1,
        conversionDenominator: parseFloat(item.CONV_DEN1) || 1,
        
        // Pricing
        netPrice: parseFloat(item.NET_PRICE) || 0,
        priceUnit: parseFloat(item.PRICE_UNIT) || 1,
        netValue: parseFloat(item.NET_PRICE) * (parseFloat(item.QUANTITY) || 1),
        
        // Tax
        taxCode: item.TAX_CODE,
        taxJurisdiction: item.TAX_JUR_CD,
        
        // Status flags
        isDeleted: item.DELETE_IND === 'X',
        noMoreGR: item.NO_MORE_GR === 'X',
        finalInvoice: item.FINAL_INV === 'X',
        deliveryComplete: item.DEL_COMPL === 'X',
        
        // Verification flags
        goodsReceiptIndicator: item.GR_IND === 'X',
        invoiceReceiptIndicator: item.IR_IND === 'X',
        grBasedInvoice: item.GR_BASEDIV === 'X',
        grNonValuated: item.GR_NON_VAL === 'X',
        
        // References
        agreement: item.AGREEMENT,
        agreementItem: item.AGMT_ITEM,
        infoRecord: item.INFO_REC,
        trackingNumber: item.TRACKINGNO,
        
        // Address
        addressNumber: item.ADDRESS,
        
        // Account assignments (to be merged separately)
        accountAssignments: []
    }));
}


/**
 * Merge account assignment data into line items.
 * @param {POLineItem[]} lineItems - Line items array
 * @param {Object[]} accountData - Account assignment data from ECC
 */
function mergeAccountAssignments(lineItems, accountData) {
    for (const acct of accountData) {
        const item = lineItems.find(i => i.itemNumber === acct.PO_ITEM);
        if (item) {
            item.accountAssignments.push({
                serialNumber: acct.SERIAL_NO,
                glAccount: acct.GL_ACCOUNT,
                costCenter: acct.COSTCENTER,
                profitCenter: acct.PROFIT_CTR,
                orderNumber: acct.ORDERID || acct.ORDER_NO,
                wbsElement: acct.WBS_ELEMENT,
                network: acct.NETWORK,
                networkActivity: acct.ACTIVITY,
                assetNumber: acct.ASSET_NO,
                assetSubNumber: acct.SUB_NUMBER,
                quantity: parseFloat(acct.QUANTITY) || 0,
                distributionPercent: parseFloat(acct.DISTR_PERC) || 100
            });
        }
    }
}

// ============================================================================
// SUMMARY BUILDER
// ============================================================================

/**
 * Build a quick summary of the PO lookup result.
 * @param {POLookupResult} result - Full lookup result
 * @returns {Object} Summary object
 */
function buildSummary(result) {
    const { header, vendor, companyCode, payment, lineItems = [] } = result;
    
    // Calculate totals
    const totalValue = lineItems.reduce((sum, item) => sum + (item.netValue || 0), 0);
    const activeItems = lineItems.filter(i => !i.isDeleted).length;

    return {
        // PO identification
        poNumber: header?.poNumber,
        docType: header?.docType,
        status: header?.status,
        
        // Key parties
        vendorId: header?.vendorId,
        vendorName: vendor?.name || header?.vendorName,
        companyCode: header?.companyCode,
        companyName: companyCode?.companyName,
        
        // Currency and value
        currency: header?.currency,
        totalValue: totalValue.toFixed(2),
        
        // Item summary
        totalItems: lineItems.length,
        activeItems: activeItems,
        
        // Payment summary
        paymentTerms: payment?.paymentTerms,
        dueDate: payment?.calculatedDueDate,
        
        // Status flags
        isOnHold: header?.isOnHold || false,
        isDeleted: header?.isDeleted || false,
        isReleased: header?.releaseIndicator === '2',
        
        // Vendor status
        vendorBlocked: vendor?.isBlocked || false,
        vendorPaymentBlocked: vendor?.isPaymentBlocked || false,
        
        // Dates
        createdOn: header?.createdOn,
        docDate: header?.docDate
    };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Add days to a date.
 * @param {Date} date - Base date
 * @param {number} days - Days to add
 * @returns {Date} New date
 */
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + (days || 0));
    return result;
}


/**
 * Format date as YYYY-MM-DD.
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
    if (!date || isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick lookup to get just the vendor info for a PO.
 * @param {string} poNumber - PO number
 * @returns {Promise<VendorInfo|null>} Vendor info or null
 */
async function lookupPOVendor(poNumber) {
    const result = await lookupPO(poNumber, {
        includeVendorDetail: true,
        includeCompanyCode: false,
        includeLineItems: false,
        includeAccountAssignments: false
    });
    return result.success ? result.vendor : null;
}

/**
 * Quick lookup to get payment info for a PO.
 * @param {string} poNumber - PO number
 * @returns {Promise<PaymentInfo|null>} Payment info or null
 */
async function lookupPOPaymentTerms(poNumber) {
    const result = await lookupPO(poNumber, {
        includeVendorDetail: false,
        includeCompanyCode: false,
        includeLineItems: false,
        includeAccountAssignments: false
    });
    return result.success ? result.payment : null;
}

/**
 * Quick lookup to get company code info for a PO.
 * @param {string} poNumber - PO number
 * @returns {Promise<CompanyCodeInfo|null>} Company code info or null
 */
async function lookupPOCompanyCode(poNumber) {
    const result = await lookupPO(poNumber, {
        includeVendorDetail: false,
        includeCompanyCode: true,
        includeLineItems: false,
        includeAccountAssignments: false
    });
    return result.success ? result.companyCode : null;
}


/**
 * Quick lookup to get line items for a PO.
 * @param {string} poNumber - PO number
 * @returns {Promise<POLineItem[]>} Line items array
 */
async function lookupPOLineItems(poNumber) {
    const result = await lookupPO(poNumber, {
        includeVendorDetail: false,
        includeCompanyCode: false,
        includeLineItems: true,
        includeAccountAssignments: true
    });
    return result.success ? result.lineItems : [];
}

/**
 * Check if a PO exists and is valid for invoicing.
 * @param {string} poNumber - PO number
 * @returns {Promise<{valid: boolean, reason: string}>} Validity check result
 */
async function checkPOValidForInvoicing(poNumber) {
    const result = await lookupPO(poNumber, {
        includeVendorDetail: true,
        includeCompanyCode: false,
        includeLineItems: false
    });

    if (!result.success) {
        return { valid: false, reason: result.error };
    }

    const { header, vendor } = result;

    // Check PO status
    if (header.isDeleted) {
        return { valid: false, reason: 'PO is marked for deletion' };
    }

    if (header.isOnHold) {
        return { valid: false, reason: 'PO is on hold' };
    }

    // Check vendor blocks
    if (vendor?.isBlocked) {
        return { valid: false, reason: 'Vendor is blocked for posting' };
    }

    if (vendor?.isPaymentBlocked) {
        return { valid: false, reason: 'Vendor is blocked for payment' };
    }

    return { valid: true, reason: 'PO is valid for invoicing' };
}


/**
 * Print a formatted report of PO details to console.
 * Useful for debugging and manual inspection.
 * @param {string} poNumber - PO number
 */
async function printPOReport(poNumber) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`PO LOOKUP REPORT: ${poNumber}`);
    console.log('='.repeat(60));

    const result = await lookupPO(poNumber);

    if (!result.success) {
        console.log(`\nERROR: ${result.error}`);
        return;
    }

    const { header, vendor, companyCode, payment, lineItems, summary } = result;

    // Header Section
    console.log('\n--- PO HEADER ---');
    console.log(`PO Number:        ${header.poNumber}`);
    console.log(`Doc Type:         ${header.docType}`);
    console.log(`Status:           ${header.status}`);
    console.log(`Created:          ${header.createdOn} by ${header.createdBy}`);
    console.log(`Doc Date:         ${header.docDate}`);
    console.log(`On Hold:          ${header.isOnHold ? 'YES' : 'No'}`);
    console.log(`Deleted:          ${header.isDeleted ? 'YES' : 'No'}`);

    // Currency Section
    console.log('\n--- CURRENCY ---');
    console.log(`Currency:         ${header.currency} (${header.currencyISO || '-'})`);
    console.log(`Exchange Rate:    ${header.exchangeRate}`);
    console.log(`Rate Fixed:       ${header.exchangeRateFixed ? 'Yes' : 'No'}`);
    console.log(`Target Value:     ${header.targetValue}`);

    // Organization Section
    console.log('\n--- ORGANIZATION ---');
    console.log(`Company Code:     ${header.companyCode}`);
    console.log(`Purchase Org:     ${header.purchaseOrg}`);
    console.log(`Purchase Group:   ${header.purchaseGroup}`);

    // Company Code Details
    if (companyCode) {
        console.log('\n--- COMPANY CODE DETAILS ---');
        console.log(`Name:             ${companyCode.companyName}`);
        console.log(`City:             ${companyCode.city}`);
        console.log(`Country:          ${companyCode.country}`);
        console.log(`Local Currency:   ${companyCode.currency}`);
        console.log(`Chart of Accts:   ${companyCode.chartOfAccounts}`);
        console.log(`VAT Reg No:       ${companyCode.vatRegNumber || '-'}`);
    }

    // Vendor Section
    console.log('\n--- VENDOR ---');
    console.log(`Vendor ID:        ${header.vendorId}`);
    if (vendor) {
        console.log(`Name:             ${vendor.name}`);
        if (vendor.name2) console.log(`Name 2:           ${vendor.name2}`);
        console.log(`City:             ${vendor.city}`);
        console.log(`Country:          ${vendor.country}`);
        console.log(`Postal Code:      ${vendor.postalCode}`);
        console.log(`Telephone:        ${vendor.telephone || '-'}`);
        console.log(`Blocked:          ${vendor.isBlocked ? 'YES' : 'No'}`);
        console.log(`Payment Blocked:  ${vendor.isPaymentBlocked ? 'YES' : 'No'}`);
        console.log(`Payment Methods:  ${vendor.paymentMethods || '-'}`);
    }

    // Payment Terms Section
    console.log('\n--- PAYMENT TERMS ---');
    console.log(`Terms Key:        ${payment.paymentTerms || '-'}`);
    console.log(`Description:      ${payment.paymentTermsDescription}`);
    console.log(`Base Date:        ${payment.baseDate}`);
    if (payment.discount1Days > 0) {
        console.log(`Discount 1:       ${payment.discount1Percent}% within ${payment.discount1Days} days (${payment.discount1Date})`);
    }
    if (payment.discount2Days > 0) {
        console.log(`Discount 2:       ${payment.discount2Percent}% within ${payment.discount2Days} days (${payment.discount2Date})`);
    }
    console.log(`Net Due:          ${payment.netDueDays} days (${payment.calculatedDueDate})`);

    // Line Items Section
    console.log('\n--- LINE ITEMS ---');
    console.log(`Total Items:      ${lineItems.length}`);
    console.log(`Active Items:     ${lineItems.filter(i => !i.isDeleted).length}`);
    
    lineItems.forEach((item, idx) => {
        console.log(`\n  Item ${item.itemNumber}:`);
        console.log(`    Description:  ${item.shortText}`);
        console.log(`    Material:     ${item.material || '-'}`);
        console.log(`    Plant:        ${item.plant}`);
        console.log(`    Quantity:     ${item.quantity} ${item.unit}`);
        console.log(`    Net Price:    ${item.netPrice} per ${item.priceUnit} ${item.unit}`);
        console.log(`    Net Value:    ${item.netValue.toFixed(2)}`);
        console.log(`    Tax Code:     ${item.taxCode || '-'}`);
        console.log(`    Deleted:      ${item.isDeleted ? 'YES' : 'No'}`);
        
        if (item.accountAssignments.length > 0) {
            console.log('    Account Assignments:');
            item.accountAssignments.forEach(acct => {
                console.log(`      - GL: ${acct.glAccount}, CC: ${acct.costCenter || '-'}, Order: ${acct.orderNumber || '-'}`);
            });
        }
    });

    // Summary Section
    console.log('\n--- SUMMARY ---');
    console.log(`Total Value:      ${summary.currency} ${summary.totalValue}`);
    console.log(`Ready for Invoice: ${summary.isOnHold || summary.isDeleted || summary.vendorBlocked ? 'NO' : 'Yes'}`);
    
    console.log('\n' + '='.repeat(60) + '\n');
}


// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Main lookup function
    lookupPO,
    
    // Convenience functions
    lookupPOVendor,
    lookupPOPaymentTerms,
    lookupPOCompanyCode,
    lookupPOLineItems,
    
    // Validation helper
    checkPOValidForInvoicing,
    
    // Debug/report function
    printPOReport,
    
    // Internal functions (exported for testing)
    extractPOHeader,
    extractPaymentInfo,
    extractLineItems,
    fetchVendorInfo,
    fetchCompanyCodeInfo
};
