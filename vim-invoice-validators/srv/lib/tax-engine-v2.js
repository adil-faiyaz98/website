/**
 * Tax Determination Engine V2 - Deterministic, Fail-Closed Tax Resolution
 *
 * Tax codes are resolved from configured sources only, in this order:
 *
 * Layer 1: PO_LINE_ITEM - Tax code from PO line item (highest priority)
 * Layer 2: ADMIN_RULES - Business rules configured by administrators
 *          (equal-priority rules with different results are an exception)
 * Layer 3: GEOGRAPHIC_DEFAULTS - Configured State/Province/ZIP tax codes
 * Layer 4: PLANT_DEFAULT - Configured plant-level tax code
 *
 * When no layer yields a tax code the result is an exception
 * (success = false, status = 'EXCEPTION', errorCode set). There is no
 * company-default fallback and tax amounts are never estimated locally.
 *
 * @module tax-engine-v2
 * @version 2.0.0
 */

'use strict';

const cds = require('@sap/cds');

// Determination layer constants
const DETERMINATION_LAYERS = {
    PO_LINE_ITEM: 'PO_LINE_ITEM',
    ADMIN_RULES: 'ADMIN_RULES',
    GEOGRAPHIC_DEFAULTS: 'GEOGRAPHIC_DEFAULTS',
    PLANT_DEFAULT: 'PLANT_DEFAULT'
};

// Tax treatment types
const TAX_TREATMENT = {
    STANDARD: 'STANDARD',
    EXEMPT: 'EXEMPT',
    ZERO_RATED: 'ZERO_RATED',
    REVERSE_CHARGE: 'REVERSE_CHARGE'
};

// Invoice types
const INVOICE_TYPE = {
    PO_BASED: 'PO_BASED',
    NON_PO: 'NON_PO'
};

/**
 * Main Tax Determination Engine class
 * Provides 100% deterministic tax resolution for all invoice scenarios
 */
class TaxDeterminationEngineV2 {
    constructor() {
        this.db = null;
        this.initialized = false;
        this.cache = {
            companyConfigs: new Map(),
            plantConfigs: new Map(),
            usStates: new Map(),
            caProvinces: new Map(),
            zipMappings: new Map(),
            vendorProfiles: new Map(),
            glMappings: new Map(),
            expenseCategories: new Map(),
            crossBorderRules: new Map(),
            adminRules: []
        };
        this.cacheTimestamp = null;
        this.cacheTTLMs = 5 * 60 * 1000; // 5 minutes cache TTL
    }

    /**
     * Initialize the engine with database connection
     */
    async initialize() {
        if (this.initialized && this.isCacheValid()) {
            return;
        }

        this.db = await cds.connect.to('db');
        await this.loadAllCaches();
        this.initialized = true;
        this.cacheTimestamp = Date.now();
    }

    /**
     * Check if cache is still valid
     */
    isCacheValid() {
        if (!this.cacheTimestamp) return false;
        return (Date.now() - this.cacheTimestamp) < this.cacheTTLMs;
    }

    /**
     * Load all configuration caches from database
     */
    async loadAllCaches() {
        const { 
            CompanyCodeTaxConfiguration,
            PlantTaxConfiguration,
            USStateTaxConfiguration,
            CanadianProvincialTaxConfiguration,
            USZipCodeTaxMapping,
            VendorTaxProfile,
            GLAccountTaxMapping,
            ExpenseCategoryTaxRules,
            CrossBorderTaxRules,
            TaxDeterminationRules
        } = cds.entities('vim.tax');

        // Load in parallel for performance
        const [
            companyConfigs,
            plantConfigs,
            usStates,
            caProvinces,
            zipMappings,
            vendorProfiles,
            glMappings,
            expenseCategories,
            crossBorderRules,
            adminRules
        ] = await Promise.all([
            SELECT.from(CompanyCodeTaxConfiguration).where({ isActive: true }),
            SELECT.from(PlantTaxConfiguration).where({ isActive: true }),
            SELECT.from(USStateTaxConfiguration).where({ isActive: true }),
            SELECT.from(CanadianProvincialTaxConfiguration).where({ isActive: true }),
            SELECT.from(USZipCodeTaxMapping).where({ isActive: true }),
            SELECT.from(VendorTaxProfile).where({ isActive: true }),
            SELECT.from(GLAccountTaxMapping).where({ isActive: true }),
            SELECT.from(ExpenseCategoryTaxRules).where({ isActive: true }),
            SELECT.from(CrossBorderTaxRules).where({ isActive: true }),
            SELECT.from(TaxDeterminationRules).where({ isActive: true }).orderBy('priority asc')
        ]);

        // Index by key for fast lookup
        this.cache.companyConfigs.clear();
        companyConfigs.forEach(c => this.cache.companyConfigs.set(c.companyCode, c));

        this.cache.plantConfigs.clear();
        plantConfigs.forEach(p => this.cache.plantConfigs.set(`${p.companyCode_companyCode}-${p.plantCode}`, p));

        this.cache.usStates.clear();
        usStates.forEach(s => this.cache.usStates.set(s.stateCode, s));

        this.cache.caProvinces.clear();
        caProvinces.forEach(p => this.cache.caProvinces.set(p.provinceCode, p));

        this.cache.zipMappings.clear();
        zipMappings.forEach(z => this.cache.zipMappings.set(z.zipCode, z));

        this.cache.vendorProfiles.clear();
        vendorProfiles.forEach(v => this.cache.vendorProfiles.set(v.vendorId, v));

        this.cache.glMappings.clear();
        glMappings.forEach(g => {
            const key = g.companyCode ? `${g.companyCode}-${g.glAccount}` : `ALL-${g.glAccount}`;
            this.cache.glMappings.set(key, g);
        });

        this.cache.expenseCategories.clear();
        expenseCategories.forEach(e => {
            const key = `${e.countryKey || 'ALL'}-${e.region || 'ALL'}-${e.categoryCode}`;
            this.cache.expenseCategories.set(key, e);
        });

        this.cache.crossBorderRules.clear();
        crossBorderRules.forEach(r => {
            const key = `${r.originCountry}-${r.destinationCountry}`;
            this.cache.crossBorderRules.set(key, r);
        });

        this.cache.adminRules = adminRules;
    }

    /**
     * Force refresh all caches
     */
    async refreshCaches() {
        this.cacheTimestamp = null;
        await this.initialize();
    }

    /**
     * MAIN ENTRY POINT: Determine tax for an invoice (fail-closed)
     * success is true only when a configured layer yields a tax code.
     *
     * @param {Object} context - Tax determination context
     * @param {string} context.companyCode - SAP Company Code (REQUIRED)
     * @param {string} context.invoiceType - 'PO_BASED' or 'NON_PO'
     * @param {string} [context.vendorId] - Vendor ID
     * @param {string} [context.poNumber] - Purchase Order number
     * @param {number} [context.poLineItem] - PO Line Item number
     * @param {Object} [context.poData] - PO data with tax code from BAPI
     * @param {string} [context.shipFromCountry] - Origin country
     * @param {string} [context.shipFromRegion] - Origin state/province
     * @param {string} [context.shipToCountry] - Destination country
     * @param {string} [context.shipToRegion] - Destination state/province
     * @param {string} [context.shipToZipCode] - Destination ZIP code
     * @param {string} [context.plantCode] - SAP Plant code
     * @param {string} [context.glAccount] - G/L Account
     * @param {string} [context.expenseCategory] - Expense category code
     * @param {string} [context.materialGroup] - Material group
     * @param {number} [context.grossAmount] - Invoice gross amount
     * @param {string} [context.currency] - Currency code
     * @returns {Object} Tax determination result (status DETERMINED or EXCEPTION with errorCode)
     */
    async determineTax(context) {
        const startTime = Date.now();
        const result = this._createResult();

        try {
            await this._runDetermination(context || {}, result);
        } catch (error) {
            this._fail(result, 'EXCEPTION', error.message);
        }

        result.processingTimeMs = Date.now() - startTime;
        return result;
    }

    /**
     * Create an empty (not yet determined) result
     */
    _createResult() {
        return {
            success: false,
            status: 'EXCEPTION',
            errorCode: null,
            error: null,
            taxCode: null,
            taxRate: null,
            taxAmount: null,
            jurisdictionCode: null,
            determinationLayer: null,
            ruleId: null,
            ruleName: null,
            confidenceScore: 0,
            requiresReview: false,
            reviewReason: null,
            processingTimeMs: 0,
            determinationPath: [],
            candidates: [],
            warnings: []
        };
    }

    /**
     * Mark a result as exception (fail-closed)
     */
    _fail(result, errorCode, message) {
        result.success = false;
        result.status = 'EXCEPTION';
        result.errorCode = errorCode;
        result.error = message;
        result.taxCode = null;
        result.taxRate = null;
        result.taxAmount = null;
        result.jurisdictionCode = null;
        result.confidenceScore = 0;
        result.determinationPath.push(`✗ ${errorCode}: ${message}`);
        return result;
    }

    /**
     * Mark a result as determined
     */
    _succeed(result, taxResult, context) {
        result.success = true;
        result.status = 'DETERMINED';
        result.errorCode = null;
        result.error = null;
        result.taxCode = taxResult.taxCode;
        result.taxRate = taxResult.taxRate ?? null;
        result.jurisdictionCode = taxResult.jurisdictionCode || null;
        result.confidenceScore = 100;

        // Tax amounts come from SAP (calculateTaxFromNet) only - never estimated here
        result.taxAmount = context.grossAmount === 0 ? 0 : null;

        if (taxResult.requiresApproval || (context.grossAmount && context.grossAmount > 100000)) {
            result.requiresReview = true;
            result.reviewReason = taxResult.requiresApproval ?
                'Rule requires approval' : 'High value invoice';
        }
        return result;
    }

    /**
     * Layer results without a tax code are treated as "no result"
     */
    _withTaxCode(taxResult) {
        return taxResult && taxResult.taxCode ? taxResult : null;
    }

    /**
     * Execute the layered determination on a result object
     */
    async _runDetermination(context, result) {
        if (!context.companyCode) {
            return this._fail(result, 'COMPANY_CODE_REQUIRED', 'Company code is required for tax determination');
        }

        await this.initialize();

        const companyConfig = this.cache.companyConfigs.get(context.companyCode);
        if (!companyConfig) {
            return this._fail(result, 'COMPANY_NOT_CONFIGURED',
                `Company code ${context.companyCode} not configured for tax determination`);
        }

        // Determine invoice type
        const invoiceType = context.invoiceType ||
            (context.poNumber ? INVOICE_TYPE.PO_BASED : INVOICE_TYPE.NON_PO);

        // Vendor exemption (Non-PO only)
        if (invoiceType === INVOICE_TYPE.NON_PO && context.vendorId) {
            const vendorProfile = this.cache.vendorProfiles.get(context.vendorId);
            if (vendorProfile?.taxStatus === 'EXEMPT' &&
                vendorProfile.exemptionExpiry &&
                new Date(vendorProfile.exemptionExpiry) > new Date()) {
                result.determinationLayer = DETERMINATION_LAYERS.ADMIN_RULES;
                result.ruleName = 'Vendor Exemption';
                if (!vendorProfile.exemptionCertificate) {
                    return this._fail(result, 'EXEMPTION_CERTIFICATE_MISSING',
                        `Vendor ${context.vendorId} is flagged tax exempt without an exemption certificate`);
                }
                if (!companyConfig.defaultExemptCode) {
                    return this._fail(result, 'EXEMPT_TAX_CODE_NOT_CONFIGURED',
                        `Vendor ${context.vendorId} is tax exempt but no exempt tax code is configured for company code ${context.companyCode}`);
                }
                result.determinationPath.push('Vendor has valid tax exemption certificate');
                return this._succeed(result, {
                    taxCode: companyConfig.defaultExemptCode,
                    taxRate: 0,
                    jurisdictionCode: null
                }, { ...context, grossAmount: 0 });
            }
        }

        let taxResult = null;

        // Layer 1: PO Line Item (for PO-based invoices)
        if (invoiceType === INVOICE_TYPE.PO_BASED) {
            result.determinationPath.push('Checking Layer 1: PO_LINE_ITEM');
            taxResult = this._withTaxCode(await this._layer1_POLineItem(context));
            if (taxResult) {
                result.determinationLayer = DETERMINATION_LAYERS.PO_LINE_ITEM;
                result.determinationPath.push('✓ Found tax code from PO line item');
            }
        }

        // Layer 2: Admin Rules
        if (!taxResult) {
            result.determinationPath.push('Checking Layer 2: ADMIN_RULES');
            const ruleMatch = await this._layer2_AdminRules(context, invoiceType, companyConfig);
            if (ruleMatch?.ambiguous) {
                result.candidates = ruleMatch.candidates;
                return this._fail(result, 'AMBIGUOUS_TAX_RULE',
                    'Several admin rules with the same priority return different results');
            }
            taxResult = this._withTaxCode(ruleMatch);
            if (taxResult) {
                result.determinationLayer = DETERMINATION_LAYERS.ADMIN_RULES;
                result.ruleId = taxResult.ruleId;
                result.ruleName = taxResult.ruleName;
                result.determinationPath.push(`✓ Matched admin rule: ${taxResult.ruleName}`);
            }
        }

        // Layer 3: Geographic Defaults
        if (!taxResult) {
            result.determinationPath.push('Checking Layer 3: GEOGRAPHIC_DEFAULTS');
            taxResult = this._withTaxCode(await this._layer3_GeographicDefaults(context, companyConfig));
            if (taxResult) {
                result.determinationLayer = DETERMINATION_LAYERS.GEOGRAPHIC_DEFAULTS;
                result.determinationPath.push(`✓ Found geographic default for ${taxResult.jurisdiction}`);
            }
        }

        // Layer 4: Plant Default
        if (!taxResult && context.plantCode) {
            result.determinationPath.push('Checking Layer 4: PLANT_DEFAULT');
            taxResult = this._withTaxCode(await this._layer4_PlantDefault(context, companyConfig));
            if (taxResult) {
                result.determinationLayer = DETERMINATION_LAYERS.PLANT_DEFAULT;
                result.determinationPath.push(`✓ Using plant default for ${context.plantCode}`);
            }
        }

        if (!taxResult) {
            return this._fail(result, 'NO_TAX_DETERMINATION',
                `No PO tax code, admin rule, geographic or plant configuration matched for company code ${context.companyCode}`);
        }

        return this._succeed(result, taxResult, context);
    }

    /**
     * Layer 1: Get tax code from PO line item
     * Uses BAPI_PO_GETDETAIL1 response which contains TAX_CODE per line
     */
    async _layer1_POLineItem(context) {
        // If PO data already provided (from earlier BAPI call)
        if (context.poData?.taxCode) {
            return {
                taxCode: context.poData.taxCode,
                taxRate: context.poData.taxRate,
                jurisdictionCode: context.poData.jurisdictionCode
            };
        }

        // If we have PO number but no data, try to fetch from cache
        if (context.poNumber && context.poLineItem) {
            const { POItemCache } = cds.entities;
            const poItem = await SELECT.one.from(POItemCache)
                .where({ 
                    poNumber: context.poNumber, 
                    poItem: context.poLineItem.toString().padStart(5, '0')
                });

            if (poItem?.taxCode) {
                return {
                    taxCode: poItem.taxCode,
                    taxRate: null, // Rate to be looked up
                    jurisdictionCode: poItem.taxJurisdiction
                };
            }
        }

        return null;
    }

    /**
     * Layer 2: Match against admin-configured rules
     * Rules are pre-sorted by priority (lower = higher priority). Matching
     * rules with the best priority but different outcomes are ambiguous.
     * @returns {Object|null} Rule result, { ambiguous: true, candidates } or null
     */
    async _layer2_AdminRules(context, invoiceType, companyConfig) {
        const now = new Date();
        const matches = [];

        for (const rule of this.cache.adminRules) {
            // Check validity dates
            if (rule.validFrom && new Date(rule.validFrom) > now) continue;
            if (rule.validTo && new Date(rule.validTo) < now) continue;

            // Check rule type matches
            if (rule.ruleType && rule.ruleType !== invoiceType &&
                rule.ruleType !== 'EXEMPT' && rule.ruleType !== 'CROSS_BORDER') {
                continue;
            }

            // Match all conditions
            if (!this._matchRuleConditions(rule, context, companyConfig)) {
                continue;
            }

            if (matches.length > 0 && (rule.priority ?? 100) !== (matches[0].priority ?? 100)) {
                break;
            }
            matches.push(rule);
        }

        if (matches.length === 0) {
            return null;
        }

        const outcomes = new Set(matches.map(r => `${r.determinedTaxCode || ''}|${r.determinedJurisdiction || ''}`));
        if (outcomes.size > 1) {
            return {
                ambiguous: true,
                candidates: matches.map(r => ({
                    ruleId: r.ID,
                    ruleName: r.ruleName,
                    taxCode: r.determinedTaxCode,
                    jurisdictionCode: r.determinedJurisdiction || null
                }))
            };
        }

        const rule = matches[0];
        return {
            taxCode: rule.determinedTaxCode,
            taxRate: rule.determinedTaxRate,
            jurisdictionCode: rule.determinedJurisdiction,
            ruleId: rule.ID,
            ruleName: rule.ruleName,
            requiresApproval: rule.requiresApproval,
            taxExemptReason: rule.taxExemptReason
        };
    }

    /**
     * Match rule conditions against context
     */
    _matchRuleConditions(rule, context, companyConfig) {
        // Company code match
        if (rule.companyCode && rule.companyCode !== context.companyCode) {
            return false;
        }

        // Vendor match
        if (rule.vendorId && rule.vendorId !== context.vendorId) {
            return false;
        }

        // Vendor country/region
        if (rule.vendorCountry || rule.vendorRegion) {
            const vendorProfile = this.cache.vendorProfiles.get(context.vendorId);
            if (rule.vendorCountry && vendorProfile?.countryKey !== rule.vendorCountry) {
                return false;
            }
            if (rule.vendorRegion && vendorProfile?.region !== rule.vendorRegion) {
                return false;
            }
        }

        // Geographic match
        if (rule.shipFromCountry && rule.shipFromCountry !== context.shipFromCountry) {
            return false;
        }
        if (rule.shipFromRegion && rule.shipFromRegion !== context.shipFromRegion) {
            return false;
        }
        if (rule.shipToCountry && rule.shipToCountry !== context.shipToCountry) {
            return false;
        }
        if (rule.shipToRegion && rule.shipToRegion !== context.shipToRegion) {
            return false;
        }

        // Material/Category match
        if (rule.materialGroup && rule.materialGroup !== context.materialGroup) {
            return false;
        }
        if (rule.productCategory && rule.productCategory !== context.productCategory) {
            return false;
        }
        if (rule.expenseType && rule.expenseType !== context.expenseCategory) {
            return false;
        }

        // G/L Account match
        if (rule.glAccount && rule.glAccount !== context.glAccount) {
            return false;
        }

        // Cost center match
        if (rule.costCenter && rule.costCenter !== context.costCenter) {
            return false;
        }

        // Invoice/Document type match
        if (rule.invoiceType && rule.invoiceType !== context.invoiceType) {
            return false;
        }
        if (rule.documentType && rule.documentType !== context.documentType) {
            return false;
        }

        // Amount range match
        if (rule.amountFrom || rule.amountTo) {
            const amount = context.grossAmount || 0;
            if (rule.amountFrom && amount < rule.amountFrom) {
                return false;
            }
            if (rule.amountTo && amount > rule.amountTo) {
                return false;
            }
        }

        return true;
    }

    /**
     * Layer 3: Geographic defaults based on ship-to location
     * Supports US (state + ZIP), Canada (province), and cross-border
     */
    async _layer3_GeographicDefaults(context, companyConfig) {
        const shipToCountry = context.shipToCountry || companyConfig.countryKey;
        const shipFromCountry = context.shipFromCountry || companyConfig.countryKey;

        // Check for cross-border scenario first
        if (shipFromCountry && shipToCountry && shipFromCountry !== shipToCountry) {
            const crossBorderKey = `${shipFromCountry}-${shipToCountry}`;
            const crossBorderRule = this.cache.crossBorderRules.get(crossBorderKey);
            if (crossBorderRule) {
                return {
                    taxCode: crossBorderRule.determinedTaxCode,
                    taxRate: crossBorderRule.determinedRate,
                    jurisdictionCode: crossBorderRule.jurisdictionCode,
                    jurisdiction: `${shipFromCountry} to ${shipToCountry}`
                };
            }
        }

        // US tax determination
        if (shipToCountry === 'US') {
            return this._getUSTaxDefaults(context);
        }

        // Canadian tax determination
        if (shipToCountry === 'CA') {
            return this._getCanadianTaxDefaults(context);
        }

        // Other countries - no geographic configuration
        return null;
    }

    /**
     * Get US tax defaults - checks ZIP code first, then state
     */
    _getUSTaxDefaults(context) {
        const region = context.shipToRegion;
        const zipCode = context.shipToZipCode;

        // Try ZIP code mapping first (most accurate)
        if (zipCode) {
            const zipMapping = this.cache.zipMappings.get(zipCode.substring(0, 5));
            if (zipMapping) {
                return {
                    taxCode: zipMapping.taxCode,
                    taxRate: zipMapping.combinedTaxRate,
                    jurisdictionCode: zipMapping.jurisdictionCode,
                    jurisdiction: `${zipMapping.city}, ${zipMapping.state_ID}`
                };
            }
        }

        // Fall back to state level
        if (region) {
            const stateConfig = this.cache.usStates.get(region);
            if (stateConfig) {
                // Check if state has no sales tax
                if (!stateConfig.hasSalesTax) {
                    return {
                        taxCode: stateConfig.defaultInputTaxCode,
                        taxRate: 0,
                        jurisdictionCode: stateConfig.defaultJurisdiction,
                        jurisdiction: stateConfig.stateName
                    };
                }

                return {
                    taxCode: stateConfig.defaultInputTaxCode,
                    taxRate: stateConfig.avgCombinedRate || stateConfig.stateTaxRate,
                    jurisdictionCode: stateConfig.defaultJurisdiction,
                    jurisdiction: stateConfig.stateName
                };
            }
        }

        return null;
    }

    /**
     * Get Canadian tax defaults based on province
     */
    _getCanadianTaxDefaults(context) {
        const region = context.shipToRegion;

        if (region) {
            const provinceConfig = this.cache.caProvinces.get(region);
            if (provinceConfig) {
                return {
                    taxCode: provinceConfig.defaultInputTaxCode,
                    taxRate: provinceConfig.combinedRate,
                    jurisdictionCode: provinceConfig.defaultJurisdiction,
                    jurisdiction: provinceConfig.provinceName,
                    taxSystem: provinceConfig.taxSystem,
                    gstRate: provinceConfig.gstRate,
                    pstRate: provinceConfig.pstRate,
                    hstRate: provinceConfig.hstRate,
                    qstRate: provinceConfig.qstRate
                };
            }
        }

        return null;
    }

    /**
     * Layer 4: Plant-level default tax code
     */
    async _layer4_PlantDefault(context, companyConfig) {
        const plantKey = `${context.companyCode}-${context.plantCode}`;
        const plantConfig = this.cache.plantConfigs.get(plantKey);

        if (plantConfig?.defaultInputTaxCode) {
            return {
                taxCode: plantConfig.defaultInputTaxCode,
                taxRate: null,
                jurisdictionCode: plantConfig.defaultJurisdiction
            };
        }

        return null;
    }

    // =========================================================================
    // NON-PO INVOICE SPECIFIC METHODS
    // =========================================================================

    /**
     * Determine tax for Non-PO invoice
     * Uses expense category, G/L account, and vendor profile
     */
    async determineNonPOTax(context) {
        // Enhance context for Non-PO determination
        const enhancedContext = {
            ...context,
            invoiceType: INVOICE_TYPE.NON_PO
        };

        if (!context?.companyCode) {
            return this.determineTax(enhancedContext);
        }

        try {
            await this.initialize();
        } catch (error) {
            const result = this._fail(this._createResult(), 'EXCEPTION', error.message);
            return result;
        }

        // Try to get vendor profile for additional context
        if (context.vendorId) {
            const vendorProfile = this.cache.vendorProfiles.get(context.vendorId);
            if (vendorProfile) {
                enhancedContext.vendorCountry = vendorProfile.countryKey;
                enhancedContext.vendorRegion = vendorProfile.region;
            }
        }

        // Try expense category first
        if (context.expenseCategory) {
            const expenseResult = this._getExpenseCategoryTax(context);
            if (expenseResult) {
                enhancedContext.expenseCategoryResult = expenseResult;
            }
        }

        // Try G/L account mapping
        if (context.glAccount) {
            const glResult = this._getGLAccountTax(context);
            if (glResult) {
                enhancedContext.glAccountResult = glResult;
            }
        }

        // Use main determination with enhanced context
        return this.determineTax(enhancedContext);
    }

    /**
     * Get tax based on expense category
     */
    _getExpenseCategoryTax(context) {
        const countryKey = context.shipToCountry || 'US';
        const region = context.shipToRegion || 'ALL';
        
        // Try specific match first
        let key = `${countryKey}-${region}-${context.expenseCategory}`;
        let expenseRule = this.cache.expenseCategories.get(key);

        if (!expenseRule) {
            // Try country-level
            key = `${countryKey}-ALL-${context.expenseCategory}`;
            expenseRule = this.cache.expenseCategories.get(key);
        }

        if (!expenseRule) {
            // Try global
            key = `ALL-ALL-${context.expenseCategory}`;
            expenseRule = this.cache.expenseCategories.get(key);
        }

        if (expenseRule) {
            return {
                taxCode: expenseRule.defaultTaxCode,
                taxRate: expenseRule.taxRate,
                jurisdictionCode: expenseRule.jurisdictionCode,
                partiallyDeductible: expenseRule.partiallyDeductible,
                deductiblePercent: expenseRule.deductiblePercent
            };
        }

        return null;
    }

    /**
     * Get tax based on G/L account
     */
    _getGLAccountTax(context) {
        // Try company-specific mapping first
        let key = `${context.companyCode}-${context.glAccount}`;
        let glMapping = this.cache.glMappings.get(key);

        if (!glMapping) {
            // Try global mapping
            key = `ALL-${context.glAccount}`;
            glMapping = this.cache.glMappings.get(key);
        }

        if (glMapping) {
            return {
                taxCode: glMapping.defaultTaxCode,
                taxCategory: glMapping.taxCategory,
                isCapitalExpense: glMapping.isCapitalExpense,
                isTaxable: glMapping.isTaxable,
                alwaysExempt: glMapping.alwaysExempt
            };
        }

        return null;
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Validate a tax code exists and is active
     */
    async validateTaxCode(taxCode, companyCode) {
        const { TaxCodes } = cds.entities('vim.tax');
        const taxCodeRecord = await SELECT.one.from(TaxCodes)
            .where({ 
                taxCode: taxCode, 
                companyCode: companyCode,
                isActive: true 
            });

        return {
            valid: !!taxCodeRecord,
            taxCode: taxCodeRecord?.taxCode,
            description: taxCodeRecord?.description,
            taxRate: taxCodeRecord?.taxRate,
            taxType: taxCodeRecord?.taxType
        };
    }

    /**
     * Get all valid tax codes for a company
     */
    async getValidTaxCodes(companyCode) {
        const { TaxCodes } = cds.entities('vim.tax');
        return SELECT.from(TaxCodes)
            .where({ companyCode: companyCode, isActive: true })
            .orderBy('taxCode asc');
    }

    /**
     * Test a tax determination scenario without logging
     * Used for admin rule testing
     */
    async testDetermination(context) {
        const result = await this.determineTax(context);
        return {
            ...result,
            isTest: true
        };
    }

    /**
     * Get determination explanation for a scenario
     * Returns detailed breakdown of how tax was determined
     */
    async explainDetermination(context) {
        const result = await this.determineTax(context);
        
        const explanation = {
            input: context,
            result: {
                taxCode: result.taxCode,
                taxRate: result.taxRate,
                taxAmount: result.taxAmount,
                jurisdictionCode: result.jurisdictionCode
            },
            determinationLayer: result.determinationLayer,
            layerExplanation: this._getLayerExplanation(result.determinationLayer),
            determinationPath: result.determinationPath,
            confidenceScore: result.confidenceScore,
            ruleName: result.ruleName,
            warnings: result.warnings,
            recommendations: this._getRecommendations(result, context)
        };

        return explanation;
    }

    /**
     * Get human-readable explanation for a determination layer
     */
    _getLayerExplanation(layer) {
        const explanations = {
            [DETERMINATION_LAYERS.PO_LINE_ITEM]: 
                'Tax code was determined from the Purchase Order line item. This is the most accurate source as it reflects the tax code agreed upon during procurement.',
            [DETERMINATION_LAYERS.ADMIN_RULES]: 
                'Tax code was determined by matching an administrator-configured business rule. These rules encode company-specific tax policies.',
            [DETERMINATION_LAYERS.GEOGRAPHIC_DEFAULTS]: 
                'Tax code was determined based on the ship-to geographic location (state/province/ZIP). This uses standard tax rates for the jurisdiction.',
            [DETERMINATION_LAYERS.PLANT_DEFAULT]:
                'Tax code was determined using the plant-level default configuration. This is appropriate when the plant\'s typical tax treatment applies.'
        };
        return explanations[layer] || 'No determination layer produced a tax code - the invoice requires manual tax determination.';
    }

    /**
     * Get recommendations for improving determination accuracy
     */
    _getRecommendations(result, context) {
        const recommendations = [];

        if (result.errorCode === 'NO_TAX_DETERMINATION') {
            if (!context.shipToRegion) {
                recommendations.push('Provide ship-to state/province for more accurate geographic tax determination');
            }
            if (!context.poNumber) {
                recommendations.push('For PO-based invoices, include PO number to use PO line item tax code');
            }
        }

        if (result.confidenceScore < 90) {
            recommendations.push('Consider adding more specific admin rules for this transaction pattern');
        }

        if (context.grossAmount && context.grossAmount > 50000 && !result.jurisdictionCode) {
            recommendations.push('High-value invoice without jurisdiction code - verify tax determination');
        }

        return recommendations;
    }

    // =========================================================================
    // EXTERNAL TAX ENGINE INTEGRATION HOOKS
    // =========================================================================

    /**
     * Hook for external tax engine integration (Vertex, Avalara)
     * Returns null by default - to be overridden by integration module
     */
    async callExternalTaxEngine(context, engineConfig) {
        // Placeholder for external integration
        // This will be implemented by the external integration module
        return null;
    }

    /**
     * Check if external tax engine should be used
     */
    shouldUseExternalEngine(companyConfig) {
        return companyConfig.useExternalTaxEngine && companyConfig.externalEngineType;
    }
}

// Singleton instance
let engineInstance = null;

/**
 * Get the singleton engine instance
 */
function getEngine() {
    if (!engineInstance) {
        engineInstance = new TaxDeterminationEngineV2();
    }
    return engineInstance;
}

/**
 * Convenience function for tax determination
 */
async function determineTax(context) {
    const engine = getEngine();
    return engine.determineTax(context);
}

/**
 * Convenience function for Non-PO tax determination
 */
async function determineNonPOTax(context) {
    const engine = getEngine();
    return engine.determineNonPOTax(context);
}

/**
 * Convenience function for testing determination
 */
async function testDetermination(context) {
    const engine = getEngine();
    return engine.testDetermination(context);
}

/**
 * Convenience function for determination explanation
 */
async function explainDetermination(context) {
    const engine = getEngine();
    return engine.explainDetermination(context);
}

// Export
module.exports = {
    TaxDeterminationEngineV2,
    getEngine,
    determineTax,
    determineNonPOTax,
    testDetermination,
    explainDetermination,
    DETERMINATION_LAYERS,
    TAX_TREATMENT,
    INVOICE_TYPE
};
