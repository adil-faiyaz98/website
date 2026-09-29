/**
 * Tax Administration API
 * 
 * Provides comprehensive API for managing tax configuration:
 * - Tax determination rules CRUD
 * - Rule testing and validation
 * - Rate management for US states and Canadian provinces
 * - Vendor tax profile management
 * - G/L account tax mapping
 * - Expense category rules
 * - Sync management
 * - Audit trail access
 * 
 * @module tax-admin-api
 * @version 1.0.0
 */

'use strict';

const cds = require('@sap/cds');
const { v4: uuidv4 } = require('uuid');
const { getEngine, testDetermination, explainDetermination } = require('./tax-engine-v2');
const { getSyncService, runFullSync, runIncrementalSync } = require('./tax-data-sync');
const { getResolver, resolveZipCode } = require('./zip-code-resolver');

/**
 * Tax Administration API Service
 */
class TaxAdminAPI {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    /**
     * Initialize the admin API
     */
    async initialize() {
        if (this.initialized) return;
        this.db = await cds.connect.to('db');
        this.initialized = true;
    }

    // =========================================================================
    // TAX DETERMINATION RULES MANAGEMENT
    // =========================================================================

    /**
     * Get all tax determination rules with optional filters
     */
    async getRules(filters = {}) {
        await this.initialize();
        const { TaxDeterminationRules } = cds.entities('vim.tax');

        let query = SELECT.from(TaxDeterminationRules);

        // Apply filters
        const conditions = [];
        if (filters.ruleType) conditions.push({ ruleType: filters.ruleType });
        if (filters.companyCode) conditions.push({ companyCode: filters.companyCode });
        if (filters.isActive !== undefined) conditions.push({ isActive: filters.isActive });
        if (filters.search) {
            // Search in rule name and description
            query = query.where(`ruleName like '%${filters.search}%' or ruleDescription like '%${filters.search}%'`);
        }

        if (conditions.length > 0) {
            query = query.where(conditions.reduce((acc, cond) => ({ ...acc, ...cond }), {}));
        }

        const rules = await query.orderBy('priority asc');

        return {
            success: true,
            count: rules.length,
            rules: rules
        };
    }

    /**
     * Get a single rule by ID
     */
    async getRule(ruleId) {
        await this.initialize();
        const { TaxDeterminationRules } = cds.entities('vim.tax');

        const rule = await SELECT.one.from(TaxDeterminationRules).where({ ID: ruleId });

        if (!rule) {
            return { success: false, error: `Rule ${ruleId} not found` };
        }

        return { success: true, rule };
    }

    /**
     * Create a new tax determination rule
     */
    async createRule(ruleData, createdBy) {
        await this.initialize();
        const { TaxDeterminationRules } = cds.entities('vim.tax');

        // Validate required fields
        const validation = this.validateRuleData(ruleData);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Check for duplicate rules
        const duplicate = await this.checkDuplicateRule(ruleData);
        if (duplicate) {
            return { 
                success: false, 
                error: 'A similar rule already exists',
                existingRule: duplicate
            };
        }

        const newRule = {
            ID: uuidv4(),
            ...ruleData,
            validFrom: ruleData.validFrom || new Date(),
            isActive: ruleData.isActive !== false,
            matchCount: 0,
            createdBy: createdBy,
            createdAt: new Date()
        };

        await INSERT.into(TaxDeterminationRules).entries(newRule);

        // Refresh engine cache
        await this.refreshEngineCache();

        // Log the creation
        await this.logAdminAction('CREATE_RULE', newRule.ID, null, newRule, createdBy);

        return {
            success: true,
            ruleId: newRule.ID,
            rule: newRule
        };
    }

    /**
     * Update an existing tax determination rule
     */
    async updateRule(ruleId, updates, updatedBy) {
        await this.initialize();
        const { TaxDeterminationRules } = cds.entities('vim.tax');

        const existing = await SELECT.one.from(TaxDeterminationRules).where({ ID: ruleId });
        if (!existing) {
            return { success: false, error: `Rule ${ruleId} not found` };
        }

        // Validate updates
        const mergedData = { ...existing, ...updates };
        const validation = this.validateRuleData(mergedData);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Remove fields that shouldn't be updated
        delete updates.ID;
        delete updates.createdAt;
        delete updates.createdBy;
        delete updates.matchCount;

        updates.modifiedAt = new Date();
        updates.modifiedBy = updatedBy;

        await UPDATE(TaxDeterminationRules).set(updates).where({ ID: ruleId });

        // Refresh engine cache
        await this.refreshEngineCache();

        // Log the update
        await this.logAdminAction('UPDATE_RULE', ruleId, existing, updates, updatedBy);

        const updated = await SELECT.one.from(TaxDeterminationRules).where({ ID: ruleId });
        return {
            success: true,
            rule: updated
        };
    }

    /**
     * Delete (deactivate) a tax determination rule
     */
    async deleteRule(ruleId, deletedBy, hardDelete = false) {
        await this.initialize();
        const { TaxDeterminationRules } = cds.entities('vim.tax');

        const existing = await SELECT.one.from(TaxDeterminationRules).where({ ID: ruleId });
        if (!existing) {
            return { success: false, error: `Rule ${ruleId} not found` };
        }

        if (hardDelete) {
            await DELETE.from(TaxDeterminationRules).where({ ID: ruleId });
        } else {
            // Soft delete - just deactivate
            await UPDATE(TaxDeterminationRules)
                .set({ isActive: false, modifiedAt: new Date(), modifiedBy: deletedBy })
                .where({ ID: ruleId });
        }

        // Refresh engine cache
        await this.refreshEngineCache();

        // Log the deletion
        await this.logAdminAction(hardDelete ? 'DELETE_RULE' : 'DEACTIVATE_RULE', 
            ruleId, existing, null, deletedBy);

        return { success: true, ruleId };
    }

    /**
     * Validate rule data
     */
    validateRuleData(ruleData) {
        const errors = [];

        if (!ruleData.ruleName) {
            errors.push('Rule name is required');
        }
        if (!ruleData.ruleType) {
            errors.push('Rule type is required');
        }
        if (!ruleData.determinedTaxCode) {
            errors.push('Determined tax code is required');
        }
        if (!ruleData.priority && ruleData.priority !== 0) {
            errors.push('Priority is required');
        }
        if (ruleData.priority < 1 || ruleData.priority > 999) {
            errors.push('Priority must be between 1 and 999');
        }

        // Validate rule type
        const validTypes = ['PO_BASED', 'NON_PO', 'CROSS_BORDER', 'EXEMPT', 'REVERSE_CHARGE'];
        if (ruleData.ruleType && !validTypes.includes(ruleData.ruleType)) {
            errors.push(`Invalid rule type. Must be one of: ${validTypes.join(', ')}`);
        }

        // Validate amount range
        if (ruleData.amountFrom && ruleData.amountTo && ruleData.amountFrom > ruleData.amountTo) {
            errors.push('Amount from must be less than amount to');
        }

        // Validate dates
        if (ruleData.validFrom && ruleData.validTo) {
            if (new Date(ruleData.validFrom) > new Date(ruleData.validTo)) {
                errors.push('Valid from date must be before valid to date');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Check for duplicate rules
     */
    async checkDuplicateRule(ruleData) {
        const { TaxDeterminationRules } = cds.entities('vim.tax');

        // Check for rules with same key conditions
        const conditions = { isActive: true };
        if (ruleData.companyCode) conditions.companyCode = ruleData.companyCode;
        if (ruleData.vendorId) conditions.vendorId = ruleData.vendorId;
        if (ruleData.shipToCountry) conditions.shipToCountry = ruleData.shipToCountry;
        if (ruleData.shipToRegion) conditions.shipToRegion = ruleData.shipToRegion;
        if (ruleData.glAccount) conditions.glAccount = ruleData.glAccount;
        if (ruleData.expenseType) conditions.expenseType = ruleData.expenseType;

        const existing = await SELECT.one.from(TaxDeterminationRules).where(conditions);
        return existing;
    }

    // =========================================================================
    // RULE TESTING
    // =========================================================================

    /**
     * Test a rule against sample invoice data
     * Returns what tax would be determined
     */
    async testRule(testContext) {
        await this.initialize();

        // Validate test context
        if (!testContext.companyCode) {
            return { success: false, error: 'Company code is required for testing' };
        }

        try {
            // Run through tax engine
            const result = await testDetermination(testContext);

            return {
                success: result.success,
                error: result.success ? undefined : result.error,
                testInput: testContext,
                result: {
                    status: result.status,
                    errorCode: result.errorCode,
                    taxCode: result.taxCode,
                    taxRate: result.taxRate,
                    taxAmount: result.taxAmount,
                    jurisdictionCode: result.jurisdictionCode,
                    determinationLayer: result.determinationLayer,
                    ruleName: result.ruleName,
                    ruleId: result.ruleId,
                    confidenceScore: result.confidenceScore,
                    determinationPath: result.determinationPath,
                    warnings: result.warnings
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                testInput: testContext
            };
        }
    }

    /**
     * Test a specific rule by ID
     */
    async testRuleById(ruleId, testContext) {
        await this.initialize();

        // Get the rule
        const ruleResult = await this.getRule(ruleId);
        if (!ruleResult.success) {
            return ruleResult;
        }

        const rule = ruleResult.rule;

        // Build test context from rule conditions
        const fullContext = {
            ...testContext,
            companyCode: testContext.companyCode || rule.companyCode || '1000',
            vendorId: testContext.vendorId || rule.vendorId,
            shipFromCountry: testContext.shipFromCountry || rule.shipFromCountry,
            shipFromRegion: testContext.shipFromRegion || rule.shipFromRegion,
            shipToCountry: testContext.shipToCountry || rule.shipToCountry,
            shipToRegion: testContext.shipToRegion || rule.shipToRegion,
            glAccount: testContext.glAccount || rule.glAccount,
            expenseCategory: testContext.expenseCategory || rule.expenseType,
            materialGroup: testContext.materialGroup || rule.materialGroup,
            invoiceType: testContext.invoiceType || rule.ruleType
        };

        const result = await this.testRule(fullContext);

        // Check if this specific rule was matched
        result.ruleMatched = result.result?.ruleId === ruleId;
        result.testedRule = rule;

        return result;
    }

    /**
     * Explain tax determination for a given context
     */
    async explainTaxDetermination(context) {
        await this.initialize();

        if (!context.companyCode) {
            return { success: false, error: 'Company code is required' };
        }

        try {
            const explanation = await explainDetermination(context);
            return {
                success: true,
                explanation
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Batch test multiple scenarios
     */
    async batchTestRules(scenarios) {
        await this.initialize();

        const results = [];
        for (const scenario of scenarios) {
            const result = await this.testRule(scenario);
            results.push({
                scenario: scenario,
                result: result
            });
        }

        const summary = {
            total: results.length,
            successful: results.filter(r => r.result.success).length,
            failed: results.filter(r => !r.result.success).length,
            byLayer: this.groupByDeterminationLayer(results)
        };

        return {
            success: true,
            results,
            summary
        };
    }

    /**
     * Group test results by determination layer
     */
    groupByDeterminationLayer(results) {
        const groups = {};
        for (const r of results) {
            if (r.result.success && r.result.result?.determinationLayer) {
                const layer = r.result.result.determinationLayer;
                groups[layer] = (groups[layer] || 0) + 1;
            }
        }
        return groups;
    }

    // =========================================================================
    // US STATE TAX MANAGEMENT
    // =========================================================================

    /**
     * Get all US state tax configurations
     */
    async getUSStates() {
        await this.initialize();
        const { USStateTaxConfiguration } = cds.entities('vim.tax');

        const states = await SELECT.from(USStateTaxConfiguration)
            .where({ isActive: true })
            .orderBy('stateCode asc');

        return { success: true, count: states.length, states };
    }

    /**
     * Update US state tax rate
     */
    async updateUSStateRate(stateCode, newRate, effectiveDate, updatedBy) {
        await this.initialize();
        const syncService = getSyncService();

        const result = await syncService.updateStateTaxRate(
            stateCode, newRate, effectiveDate, updatedBy
        );

        if (result.success) {
            await this.refreshEngineCache();
        }

        return result;
    }

    /**
     * Get ZIP code tax details
     */
    async getZipCodeDetails(zipCode) {
        const result = await resolveZipCode(zipCode);
        return result;
    }

    // =========================================================================
    // CANADIAN PROVINCE TAX MANAGEMENT
    // =========================================================================

    /**
     * Get all Canadian provincial tax configurations
     */
    async getCanadianProvinces() {
        await this.initialize();
        const { CanadianProvincialTaxConfiguration } = cds.entities('vim.tax');

        const provinces = await SELECT.from(CanadianProvincialTaxConfiguration)
            .where({ isActive: true })
            .orderBy('provinceCode asc');

        return { success: true, count: provinces.length, provinces };
    }

    /**
     * Update Canadian province tax rate
     */
    async updateCanadianProvinceRate(provinceCode, rateType, newRate, effectiveDate, updatedBy) {
        await this.initialize();
        const syncService = getSyncService();

        const result = await syncService.updateProvinceTaxRate(
            provinceCode, rateType, newRate, effectiveDate, updatedBy
        );

        if (result.success) {
            await this.refreshEngineCache();
        }

        return result;
    }

    // =========================================================================
    // COMPANY CODE CONFIGURATION
    // =========================================================================

    /**
     * Get company code tax configurations
     */
    async getCompanyConfigs() {
        await this.initialize();
        const { CompanyCodeTaxConfiguration } = cds.entities('vim.tax');

        const configs = await SELECT.from(CompanyCodeTaxConfiguration)
            .where({ isActive: true });

        return { success: true, count: configs.length, configs };
    }

    /**
     * Update company code tax configuration
     */
    async updateCompanyConfig(companyCode, updates, updatedBy) {
        await this.initialize();
        const { CompanyCodeTaxConfiguration } = cds.entities('vim.tax');

        const existing = await SELECT.one.from(CompanyCodeTaxConfiguration)
            .where({ companyCode: companyCode });

        if (!existing) {
            return { success: false, error: `Company code ${companyCode} not found` };
        }

        // Ensure mandatory field is set
        if (updates.defaultInputTaxCode === null || updates.defaultInputTaxCode === '') {
            return { 
                success: false, 
                error: 'Default input tax code is mandatory and cannot be removed'
            };
        }

        updates.modifiedAt = new Date();
        updates.modifiedBy = updatedBy;

        await UPDATE(CompanyCodeTaxConfiguration)
            .set(updates)
            .where({ companyCode: companyCode });

        await this.refreshEngineCache();
        await this.logAdminAction('UPDATE_COMPANY_CONFIG', existing.ID, existing, updates, updatedBy);

        return { success: true, companyCode };
    }

    /**
     * Create new company code configuration
     */
    async createCompanyConfig(configData, createdBy) {
        await this.initialize();
        const { CompanyCodeTaxConfiguration } = cds.entities('vim.tax');

        // Validate required fields
        if (!configData.companyCode) {
            return { success: false, error: 'Company code is required' };
        }
        if (!configData.defaultInputTaxCode) {
            return { success: false, error: 'Default input tax code is mandatory' };
        }

        // Check if already exists
        const existing = await SELECT.one.from(CompanyCodeTaxConfiguration)
            .where({ companyCode: configData.companyCode });

        if (existing) {
            return { success: false, error: `Company code ${configData.companyCode} already exists` };
        }

        const newConfig = {
            ID: uuidv4(),
            ...configData,
            isActive: true,
            createdAt: new Date(),
            createdBy: createdBy
        };

        await INSERT.into(CompanyCodeTaxConfiguration).entries(newConfig);
        await this.refreshEngineCache();

        return { success: true, config: newConfig };
    }

    // =========================================================================
    // VENDOR TAX PROFILE MANAGEMENT
    // =========================================================================

    /**
     * Get vendor tax profiles
     */
    async getVendorProfiles(filters = {}) {
        await this.initialize();
        const { VendorTaxProfile } = cds.entities('vim.tax');

        let query = SELECT.from(VendorTaxProfile);
        
        if (filters.vendorId) {
            query = query.where({ vendorId: filters.vendorId });
        }
        if (filters.taxStatus) {
            query = query.where({ taxStatus: filters.taxStatus });
        }
        if (filters.isActive !== undefined) {
            query = query.where({ isActive: filters.isActive });
        }

        const profiles = await query.orderBy('vendorId asc');
        return { success: true, count: profiles.length, profiles };
    }

    /**
     * Update vendor tax profile
     */
    async updateVendorProfile(vendorId, updates, updatedBy) {
        await this.initialize();
        const { VendorTaxProfile } = cds.entities('vim.tax');

        const existing = await SELECT.one.from(VendorTaxProfile)
            .where({ vendorId: vendorId });

        if (!existing) {
            // Create new profile
            const newProfile = {
                ID: uuidv4(),
                vendorId: vendorId,
                ...updates,
                isActive: true,
                createdAt: new Date(),
                createdBy: updatedBy
            };

            await INSERT.into(VendorTaxProfile).entries(newProfile);
            await this.refreshEngineCache();

            return { success: true, created: true, profile: newProfile };
        }

        updates.modifiedAt = new Date();
        updates.modifiedBy = updatedBy;

        await UPDATE(VendorTaxProfile)
            .set(updates)
            .where({ vendorId: vendorId });

        await this.refreshEngineCache();
        await this.logAdminAction('UPDATE_VENDOR_PROFILE', existing.ID, existing, updates, updatedBy);

        return { success: true, vendorId };
    }

    /**
     * Set vendor as tax exempt
     */
    async setVendorExempt(vendorId, exemptionData, updatedBy) {
        return this.updateVendorProfile(vendorId, {
            taxStatus: 'EXEMPT',
            exemptionCertificate: exemptionData.certificateNumber,
            exemptionExpiry: exemptionData.expiryDate,
            exemptionReason: exemptionData.reason
        }, updatedBy);
    }

    // =========================================================================
    // G/L ACCOUNT TAX MAPPING
    // =========================================================================

    /**
     * Get G/L account tax mappings
     */
    async getGLAccountMappings(companyCode) {
        await this.initialize();
        const { GLAccountTaxMapping } = cds.entities('vim.tax');

        let query = SELECT.from(GLAccountTaxMapping).where({ isActive: true });
        
        if (companyCode) {
            query = query.where({ companyCode: companyCode });
        }

        const mappings = await query.orderBy('glAccount asc');
        return { success: true, count: mappings.length, mappings };
    }

    /**
     * Update G/L account tax mapping
     */
    async updateGLAccountMapping(glAccount, companyCode, updates, updatedBy) {
        await this.initialize();
        const { GLAccountTaxMapping } = cds.entities('vim.tax');

        const conditions = { glAccount: glAccount };
        if (companyCode) {
            conditions.companyCode = companyCode;
        }

        const existing = await SELECT.one.from(GLAccountTaxMapping).where(conditions);

        if (!existing) {
            // Create new mapping
            const newMapping = {
                ID: uuidv4(),
                glAccount: glAccount,
                companyCode: companyCode,
                ...updates,
                isActive: true,
                createdAt: new Date()
            };

            await INSERT.into(GLAccountTaxMapping).entries(newMapping);
            await this.refreshEngineCache();

            return { success: true, created: true, mapping: newMapping };
        }

        updates.modifiedAt = new Date();
        await UPDATE(GLAccountTaxMapping).set(updates).where({ ID: existing.ID });

        await this.refreshEngineCache();
        return { success: true, glAccount };
    }

    // =========================================================================
    // EXPENSE CATEGORY RULES
    // =========================================================================

    /**
     * Get expense category tax rules
     */
    async getExpenseCategoryRules(countryKey) {
        await this.initialize();
        const { ExpenseCategoryTaxRules } = cds.entities('vim.tax');

        let query = SELECT.from(ExpenseCategoryTaxRules).where({ isActive: true });
        
        if (countryKey) {
            query = query.where({ countryKey: countryKey });
        }

        const rules = await query.orderBy('priority asc');
        return { success: true, count: rules.length, rules };
    }

    /**
     * Update expense category rule
     */
    async updateExpenseCategoryRule(categoryCode, countryKey, updates, updatedBy) {
        await this.initialize();
        const { ExpenseCategoryTaxRules } = cds.entities('vim.tax');

        const conditions = { categoryCode: categoryCode };
        if (countryKey) conditions.countryKey = countryKey;

        const existing = await SELECT.one.from(ExpenseCategoryTaxRules).where(conditions);

        if (!existing) {
            return { success: false, error: `Expense category ${categoryCode} not found` };
        }

        updates.modifiedAt = new Date();
        await UPDATE(ExpenseCategoryTaxRules).set(updates).where({ ID: existing.ID });

        await this.refreshEngineCache();
        return { success: true, categoryCode };
    }

    // =========================================================================
    // SYNC MANAGEMENT
    // =========================================================================

    /**
     * Trigger full tax data sync
     */
    async triggerFullSync(triggeredBy) {
        return runFullSync({ triggeredBy, triggeredByUser: triggeredBy });
    }

    /**
     * Trigger incremental sync
     */
    async triggerIncrementalSync(triggeredBy) {
        return runIncrementalSync({ triggeredBy, triggeredByUser: triggeredBy });
    }

    /**
     * Get sync history
     */
    async getSyncHistory(limit = 20) {
        const syncService = getSyncService();
        return syncService.getSyncHistory(limit);
    }

    // =========================================================================
    // AUDIT & LOGGING
    // =========================================================================

    /**
     * Get audit log for an entity
     */
    async getAuditLog(entityType, entityKey, limit = 50) {
        await this.initialize();
        const { TaxDataChangeHistory } = cds.entities('vim.tax');

        const conditions = {};
        if (entityType) conditions.entityType = entityType;
        if (entityKey) conditions.entityKey = entityKey;

        const history = await SELECT.from(TaxDataChangeHistory)
            .where(conditions)
            .orderBy('changedAt desc')
            .limit(limit);

        return { success: true, count: history.length, history };
    }

    /**
     * Log an admin action
     */
    async logAdminAction(actionType, entityId, oldValue, newValue, performedBy) {
        const { TaxDataChangeHistory } = cds.entities('vim.tax');

        await INSERT.into(TaxDataChangeHistory).entries({
            ID: uuidv4(),
            entityType: actionType,
            entityKey: entityId,
            changeType: actionType,
            changedAt: new Date(),
            changedBy: performedBy,
            oldValue: oldValue ? JSON.stringify(oldValue) : null,
            newValue: newValue ? JSON.stringify(newValue) : null
        });
    }

    // =========================================================================
    // CACHE MANAGEMENT
    // =========================================================================

    /**
     * Refresh the tax engine cache
     */
    async refreshEngineCache() {
        const engine = getEngine();
        await engine.refreshCaches();
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        const engine = getEngine();
        return {
            companyConfigs: engine.cache.companyConfigs.size,
            plantConfigs: engine.cache.plantConfigs.size,
            usStates: engine.cache.usStates.size,
            caProvinces: engine.cache.caProvinces.size,
            zipMappings: engine.cache.zipMappings.size,
            vendorProfiles: engine.cache.vendorProfiles.size,
            glMappings: engine.cache.glMappings.size,
            expenseCategories: engine.cache.expenseCategories.size,
            crossBorderRules: engine.cache.crossBorderRules.size,
            adminRules: engine.cache.adminRules.length,
            cacheTimestamp: engine.cacheTimestamp,
            cacheAge: engine.cacheTimestamp ? Date.now() - engine.cacheTimestamp : null
        };
    }

    // =========================================================================
    // DASHBOARD & STATISTICS
    // =========================================================================

    /**
     * Get tax admin dashboard data
     */
    async getDashboard() {
        await this.initialize();

        const { 
            TaxDeterminationRules, 
            TaxDeterminationLog,
            TaxDataSyncLog,
            USStateTaxConfiguration,
            CanadianProvincialTaxConfiguration,
            CompanyCodeTaxConfiguration
        } = cds.entities('vim.tax');

        const [
            activeRules,
            recentDeterminations,
            recentSyncs,
            usStates,
            caProvinces,
            companies
        ] = await Promise.all([
            SELECT.from(TaxDeterminationRules).where({ isActive: true }),
            SELECT.from(TaxDeterminationLog).orderBy('determinedAt desc').limit(100),
            SELECT.from(TaxDataSyncLog).orderBy('startedAt desc').limit(10),
            SELECT.from(USStateTaxConfiguration).where({ isActive: true }),
            SELECT.from(CanadianProvincialTaxConfiguration).where({ isActive: true }),
            SELECT.from(CompanyCodeTaxConfiguration).where({ isActive: true })
        ]);

        // Calculate determination statistics
        const layerStats = {};
        for (const det of recentDeterminations) {
            layerStats[det.determinationLayer] = (layerStats[det.determinationLayer] || 0) + 1;
        }

        return {
            success: true,
            dashboard: {
                rules: {
                    total: activeRules.length,
                    byType: this.groupBy(activeRules, 'ruleType')
                },
                determinations: {
                    recent: recentDeterminations.length,
                    byLayer: layerStats
                },
                syncs: {
                    recent: recentSyncs.slice(0, 5),
                    lastSuccess: recentSyncs.find(s => s.syncStatus === 'COMPLETED')
                },
                coverage: {
                    usStates: usStates.length,
                    caProvinces: caProvinces.length,
                    companies: companies.length
                }
            }
        };
    }

    /**
     * Group array by field
     */
    groupBy(array, field) {
        return array.reduce((groups, item) => {
            const key = item[field] || 'UNKNOWN';
            groups[key] = (groups[key] || 0) + 1;
            return groups;
        }, {});
    }
}

// Singleton instance
let adminAPIInstance = null;

/**
 * Get the singleton admin API instance
 */
function getAdminAPI() {
    if (!adminAPIInstance) {
        adminAPIInstance = new TaxAdminAPI();
    }
    return adminAPIInstance;
}

// Export
module.exports = {
    TaxAdminAPI,
    getAdminAPI
};
