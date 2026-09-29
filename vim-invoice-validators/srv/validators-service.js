// @ts-check
/**
 * @fileoverview CAP service implementation for Invoice Validators.
 */

const cds = require('@sap/cds');
const validators = require('./lib');
const touchlessProcessor = require('./lib/touchless-processor');
const supplierValidators = require('./lib/supplier-validators');
const paymentValidators = require('./lib/payment-validators');
const poMatchingValidators = require('./lib/po-matching-validators');
const determinationValidators = require('./lib/determination-validators');
const taxValidators = require('./lib/tax-validators');
const taxEngine = require('./lib/tax-determination-engine');

// Tax Engine V2 - 100% Deterministic Tax Determination
const taxEngineV2 = require('./lib/tax-engine-v2');
const zipCodeResolver = require('./lib/zip-code-resolver');
const taxAdminAPI = require('./lib/tax-admin-api');
const taxExternalIntegration = require('./lib/tax-external-integration');
const taxDataSync = require('./lib/tax-data-sync');

/**
 * Map a tax determination engine line result to the LineTaxResult type
 */
function mapLineTaxResult(l) {
  return {
    lineNumber: String(l.lineNumber),
    status: l.status,
    errorCode: l.errorCode,
    taxCode: l.taxCode,
    taxJurisdiction: l.taxJurisdiction,
    taxAmount: l.taxAmount,
    taxRate: l.taxRate,
    confidence: l.confidence,
    determinationMethod: l.determinationMethod,
    ruleId: l.ruleId,
    reason: l.reason,
    isValidated: l.isValidated,
    warnings: l.warnings
  };
}

/**
 * Map a Tax Engine V2 result to the TaxDeterminationResultV2 type
 */
function mapTaxResultV2(result) {
  return {
    success: result.success,
    status: result.status,
    errorCode: result.errorCode,
    error: result.error,
    taxCode: result.taxCode,
    taxRate: result.taxRate,
    taxAmount: result.taxAmount,
    jurisdictionCode: result.jurisdictionCode,
    determinationLayer: result.determinationLayer,
    ruleId: result.ruleId,
    ruleName: result.ruleName,
    confidenceScore: result.confidenceScore,
    requiresReview: result.requiresReview,
    reviewReason: result.reviewReason,
    processingTimeMs: result.processingTimeMs,
    determinationPath: result.determinationPath,
    warnings: result.warnings
  };
}

module.exports = class ValidatorsService extends cds.ApplicationService {

  async init() {
    // Vendor operations
    this.on('validateVendor', this.handleValidateVendor);
    this.on('searchVendors', this.handleSearchVendors);

    // PO operations
    this.on('validatePO', this.handleValidatePO);
    this.on('deriveFromPO', this.handleDeriveFromPO);

    // Tax operations
    this.on('validateTaxCode', this.handleValidateTaxCode);
    this.on('calculateTax', this.handleCalculateTax);
    this.on('getTaxCodes', this.handleGetTaxCodes);

    // Account operations
    this.on('validateGLAccount', this.handleValidateGLAccount);
    this.on('validateCostCenter', this.handleValidateCostCenter);
    this.on('searchGLAccounts', this.handleSearchGLAccounts);
    this.on('searchCostCenters', this.handleSearchCostCenters);

    // Full invoice processing (legacy)
    this.on('processInvoice', this.handleProcessInvoice);

    // Touchless processing (new)
    this.on('processInvoiceTouchless', this.handleProcessInvoiceTouchless);
    this.on('checkTouchlessEligibility', this.handleCheckTouchlessEligibility);

    // Supplier/Vendor advanced operations
    this.on('identifyVendorFromSupplier', this.handleIdentifyVendorFromSupplier);
    this.on('analyzeVendorBlocks', this.handleAnalyzeVendorBlocks);
    this.on('detectFraudIndicators', this.handleDetectFraudIndicators);
    this.on('getVendorRiskProfile', this.handleGetVendorRiskProfile);

    // Payment operations
    this.on('derivePaymentTerms', this.handleDerivePaymentTerms);
    this.on('calculatePaymentInfo', this.handleCalculatePaymentInfo);

    // PO matching advanced operations
    this.on('perform2WayMatch', this.handlePerform2WayMatch);
    this.on('perform3WayMatch', this.handlePerform3WayMatch);
    this.on('getGRInfoForPOLine', this.handleGetGRInfoForPOLine);

    // Determination operations (non-PO)
    this.on('deriveGLAccountForNonPO', this.handleDeriveGLAccountForNonPO);
    this.on('deriveCostCenterForNonPO', this.handleDeriveCostCenterForNonPO);
    this.on('deriveAccountAssignment', this.handleDeriveAccountAssignment);

    // Tax advanced operations
    this.on('deriveTaxCodeFromPO', this.handleDeriveTaxCodeFromPO);
    this.on('deriveTaxCodeForNonPO', this.handleDeriveTaxCodeForNonPO);
    this.on('deriveTaxInfo', this.handleDeriveTaxInfo);

    // Enterprise Tax Determination Engine (new)
    this.on('determineInvoiceTax', this.handleDetermineInvoiceTax);
    this.on('getTaxDetailsEnhanced', this.handleGetTaxDetailsEnhanced);
    this.on('determineTaxForPOLine', this.handleDetermineTaxForPOLine);
    this.on('determineTaxForNonPOLine', this.handleDetermineTaxForNonPOLine);
    this.on('determineWithholdingTax', this.handleDetermineWithholdingTax);
    this.on('resolveReceiverAddress', this.handleResolveReceiverAddress);
    this.on('getVendorTaxProfile', this.handleGetVendorTaxProfile);
    this.on('validateTaxCodeAgainstSAP', this.handleValidateTaxCodeAgainstSAP);
    this.on('validateTaxJurisdictionAgainstSAP', this.handleValidateTaxJurisdictionAgainstSAP);
    this.on('batchDetermineTax', this.handleBatchDetermineTax);

    // Cache management
    this.on('clearCache', this.handleClearCache);
    this.on('getCacheStats', this.handleGetCacheStats);

    // Tax Engine V2 - 100% Deterministic
    this.on('determineTaxV2', this.handleDetermineTaxV2);
    this.on('determineNonPOTaxV2', this.handleDetermineNonPOTaxV2);
    this.on('testTaxDetermination', this.handleTestTaxDetermination);
    this.on('explainTaxDetermination', this.handleExplainTaxDetermination);

    // ZIP Code Resolution
    this.on('resolveZipCode', this.handleResolveZipCode);
    this.on('batchResolveZipCodes', this.handleBatchResolveZipCodes);
    this.on('getStateFromZip', this.handleGetStateFromZip);

    // Tax Admin API
    this.on('getTaxRules', this.handleGetTaxRules);
    this.on('createTaxRule', this.handleCreateTaxRule);
    this.on('updateTaxRule', this.handleUpdateTaxRule);
    this.on('deleteTaxRule', this.handleDeleteTaxRule);
    this.on('testTaxRuleById', this.handleTestTaxRuleById);
    this.on('batchTestTaxRules', this.handleBatchTestTaxRules);

    // US State Tax Management
    this.on('getUSStateTaxConfigs', this.handleGetUSStateTaxConfigs);
    this.on('updateUSStateTaxRate', this.handleUpdateUSStateTaxRate);

    // Canadian Province Tax Management
    this.on('getCanadianProvinceTaxConfigs', this.handleGetCanadianProvinceTaxConfigs);
    this.on('updateCanadianProvinceTaxRate', this.handleUpdateCanadianProvinceTaxRate);

    // Company Tax Configuration
    this.on('getCompanyTaxConfigs', this.handleGetCompanyTaxConfigs);
    this.on('updateCompanyTaxConfig', this.handleUpdateCompanyTaxConfig);

    // Tax Data Sync
    this.on('triggerTaxDataSync', this.handleTriggerTaxDataSync);
    this.on('getTaxSyncHistory', this.handleGetTaxSyncHistory);
    this.on('getTaxSchedulerStatus', this.handleGetTaxSchedulerStatus);

    // Tax Audit Log
    this.on('getTaxAuditLog', this.handleGetTaxAuditLog);

    // Tax Admin Dashboard
    this.on('getTaxAdminDashboard', this.handleGetTaxAdminDashboard);
    this.on('refreshTaxCache', this.handleRefreshTaxCache);

    // External Tax Engine
    this.on('checkExternalTaxEngine', this.handleCheckExternalTaxEngine);
    this.on('calculateTaxExternal', this.handleCalculateTaxExternal);

    await super.init();
  }


  // ============================================================================
  // Vendor Handlers
  // ============================================================================

  async handleValidateVendor(req) {
    const { vendorId, vendorName, context } = req.data;
    const result = await validators.vendor.validateVendor(vendorId, vendorName, context);
    return this.formatValidationResult(result);
  }

  async handleSearchVendors(req) {
    const { searchTerm, companyCode, limit } = req.data;
    const results = await validators.vendor.searchVendors(
      searchTerm,
      { companyCode },
      { limit }
    );
    return results.map(r => ({
      vendorId: r.vendor.vendorId,
      vendorName: r.vendor.name,
      score: r.score
    }));
  }

  // ============================================================================
  // PO Handlers
  // ============================================================================

  async handleValidatePO(req) {
    const { poNumber, context } = req.data;
    const result = await validators.po.validatePONumber(poNumber, context || {});
    return this.formatValidationResult(result);
  }

  async handleDeriveFromPO(req) {
    const { poNumber, poItem } = req.data;

    // Get header fields
    const headerDerivation = await validators.po.deriveFieldsFromPO(poNumber, {});

    // Get item fields if poItem provided
    let itemFields = {};
    if (poItem) {
      const itemDerivation = await validators.po.deriveFieldsFromPOItem(poNumber, poItem, {});
      itemFields = itemDerivation.derivedFields || {};
    }

    return {
      success: headerDerivation.success,
      confidence: headerDerivation.confidence,
      vendorId: headerDerivation.derivedFields.vendorId,
      vendorName: headerDerivation.derivedFields.vendorName,
      companyCode: headerDerivation.derivedFields.companyCode,
      currency: headerDerivation.derivedFields.currency,
      paymentTerms: headerDerivation.derivedFields.paymentTerms,
      taxCode: itemFields.taxCode,
      glAccount: itemFields.glAccount,
      costCenter: itemFields.costCenter
    };
  }


  // ============================================================================
  // Tax Handlers
  // ============================================================================

  async handleValidateTaxCode(req) {
    const { taxCode, context } = req.data;
    const result = await validators.tax.validateTaxCode(taxCode, context);
    return this.formatValidationResult(result);
  }

  async handleCalculateTax(req) {
    const { companyCode, taxCode, currency, netAmount, jurisdictionCode } = req.data;
    return await validators.tax.calculateTaxFromNet({
      companyCode,
      taxCode,
      currency,
      netAmount,
      jurisdictionCode
    });
  }

  async handleGetTaxCodes(req) {
    const { country, language } = req.data;
    const taxCodes = await validators.tax.getTaxCodesForCountry(country, language);
    return taxCodes.map(tc => ({
      taxCode: tc.taxCode,
      description: tc.description,
      taxType: tc.taxType
    }));
  }

  // ============================================================================
  // Account Handlers
  // ============================================================================

  async handleValidateGLAccount(req) {
    const { accountNumber, context } = req.data;
    const result = await validators.account.validateGLAccount(accountNumber, context);
    return this.formatValidationResult(result);
  }

  async handleValidateCostCenter(req) {
    const { costCenter, context } = req.data;
    const result = await validators.account.validateCostCenter(costCenter, context || {});
    return this.formatValidationResult(result);
  }

  async handleSearchGLAccounts(req) {
    const { searchTerm, companyCode, limit } = req.data;
    const results = await validators.account.searchGLAccounts(
      searchTerm,
      { companyCode },
      { limit }
    );
    return results.map(r => ({
      accountNumber: r.account.accountNumber,
      shortText: r.account.shortText,
      longText: r.account.longText,
      score: r.score
    }));
  }

  async handleSearchCostCenters(req) {
    const { searchTerm, controllingArea, limit } = req.data;
    const results = await validators.account.searchCostCenters(
      searchTerm,
      { controllingArea },
      { limit }
    );
    return results.map(r => ({
      costCenter: r.costCenter.costCenter,
      description: r.costCenter.description,
      score: r.score
    }));
  }


  // ============================================================================
  // Invoice Processing Handler
  // ============================================================================

  async handleProcessInvoice(req) {
    const { header, lineItems, context } = req.data;

    const result = await validators.processInvoice(
      { header, lineItems },
      context
    );

    // Collect messages from all validation results
    const messages = [];

    if (result.header.validation.results) {
      for (const [key, val] of Object.entries(result.header.validation.results)) {
        if (val.message) {
          messages.push(`${key}: ${val.message}`);
        }
      }
    }

    for (const item of result.lineItems || []) {
      if (item.validation.results) {
        for (const [key, val] of Object.entries(item.validation.results)) {
          if (val.message) {
            messages.push(`Line ${item.lineNumber} ${key}: ${val.message}`);
          }
        }
      }
    }

    return {
      isValid: result.isValid,
      confidence: result.confidence,
      messages
    };
  }

  // ============================================================================
  // Cache Handlers
  // ============================================================================

  async handleClearCache() {
    validators.clearCache();
    return { success: true };
  }

  async handleGetCacheStats() {
    return validators.getCacheStats();
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  formatValidationResult(result) {
    return {
      isValid: result.isValid,
      confidence: result.confidence,
      derivedValue: result.derivedValue || null,
      message: result.message || null,
      matchStrategy: result.matchStrategy || null
    };
  }

  // ============================================================================
  // Touchless Processing Handlers
  // ============================================================================

  async handleProcessInvoiceTouchless(req) {
    const {
      invoiceNumber, invoiceDate, grossAmount, netAmount, taxAmount, currency,
      vendorId, supplierName, poNumber, companyCode, country, controllingArea,
      lineItems, options
    } = req.data;

    const result = await touchlessProcessor.processInvoice({
      invoiceNumber,
      invoiceDate,
      grossAmount,
      netAmount,
      taxAmount,
      currency,
      vendorId,
      supplierName,
      poNumber,
      companyCode,
      controllingArea,
      country,
      lineItems
    }, options || {});

    return {
      status: result.status,
      overallConfidence: result.overallConfidence,
      readyForPosting: result.readyForPosting,
      derivedVendorId: result.derivedFields.vendor?.vendorId,
      derivedPaymentTerms: result.derivedFields.payment?.paymentTerms,
      derivedDueDate: result.derivedFields.payment?.dueDate,
      derivedTaxCode: result.derivedFields.tax?.taxCode,
      derivedGLAccount: result.derivedFields.headerAccounting?.glAccount ||
        result.derivedFields.lineItems?.[0]?.glAccount,
      derivedCostCenter: result.derivedFields.headerAccounting?.costCenter ||
        result.derivedFields.lineItems?.[0]?.costCenter,
      issues: result.issues,
      recommendations: result.recommendations,
      riskAssessment: {
        riskScore: result.riskAssessment?.riskScore || 0,
        riskLevel: result.riskAssessment?.riskLevel || 'LOW',
        flags: result.riskAssessment?.flags || []
      }
    };
  }

  async handleCheckTouchlessEligibility(req) {
    const { vendorId, supplierName, companyCode, grossAmount, poNumber } = req.data;

    return await touchlessProcessor.checkTouchlessEligibility({
      vendorId,
      supplierName,
      companyCode,
      grossAmount,
      poNumber
    });
  }

  // ============================================================================
  // Supplier/Vendor Advanced Handlers
  // ============================================================================

  async handleIdentifyVendorFromSupplier(req) {
    const { supplierName, companyCode, city, postalCode, taxNumber } = req.data;

    const result = await supplierValidators.identifyVendorFromSupplier(
      supplierName,
      { companyCode },
      { city, postalCode, taxNumber }
    );

    return this.formatValidationResult(result);
  }

  async handleAnalyzeVendorBlocks(req) {
    const { vendorId, companyCode } = req.data;
    return await supplierValidators.analyzeVendorBlocks(vendorId, companyCode);
  }

  async handleDetectFraudIndicators(req) {
    const { vendorId, companyCode, amount, invoiceNumber, invoiceDate, poNumber } = req.data;

    return await supplierValidators.detectFraudIndicators({
      vendorId,
      companyCode,
      amount,
      invoiceNumber,
      invoiceDate,
      poNumber
    });
  }

  async handleGetVendorRiskProfile(req) {
    const { vendorId, companyCode } = req.data;
    return await supplierValidators.getVendorRiskProfile(vendorId, companyCode);
  }

  // ============================================================================
  // Payment Handlers
  // ============================================================================

  async handleDerivePaymentTerms(req) {
    const { poNumber, vendorId, companyCode } = req.data;

    const result = await paymentValidators.derivePaymentTerms({
      poNumber,
      vendorId,
      companyCode
    });

    return {
      paymentTermsKey: result.terms?.paymentTermsKey,
      netDays: result.terms?.netDays,
      source: result.source,
      description: result.terms?.description
    };
  }

  async handleCalculatePaymentInfo(req) {
    const { poNumber, vendorId, companyCode, invoiceDate, invoiceAmount } = req.data;

    const info = await paymentValidators.getPaymentInfo({
      poNumber,
      vendorId,
      companyCode,
      invoiceDate,
      invoiceAmount
    });

    return {
      paymentTerms: info.paymentTerms?.paymentTermsKey,
      dueDate: info.summary.dueDate,
      discountAvailable: info.cashDiscount.isEligible,
      discountAmount: info.cashDiscount.discountAmount,
      discountDueDate: info.summary.discountDueDate,
      discountPercent: info.cashDiscount.discountPercent
    };
  }

  // ============================================================================
  // PO Matching Advanced Handlers
  // ============================================================================

  async handlePerform2WayMatch(req) {
    const { poNumber, poLineNumber, invoiceQuantity, invoiceUnitPrice, invoiceAmount } = req.data;

    const result = await poMatchingValidators.perform2WayMatch({
      poNumber,
      poLineNumber,
      invoiceQuantity,
      invoiceUnitPrice,
      invoiceAmount
    });

    return {
      isMatched: result.isMatched,
      matchType: result.matchType,
      confidence: result.confidence,
      issues: result.issues,
      variances: {
        quantity: result.variances?.quantity?.variance || 0,
        unitPrice: result.variances?.unitPrice?.variance || 0,
        amount: result.variances?.amount?.variance || 0
      }
    };
  }

  async handlePerform3WayMatch(req) {
    const { poNumber, poLineNumber, invoiceQuantity, invoiceUnitPrice, invoiceAmount } = req.data;

    const result = await poMatchingValidators.perform3WayMatch({
      poNumber,
      poLineNumber,
      invoiceQuantity,
      invoiceUnitPrice,
      invoiceAmount
    });

    return {
      isMatched: result.isMatched,
      matchType: result.matchType,
      confidence: result.confidence,
      issues: result.issues,
      grExists: result.grInfo?.grExists,
      openQuantity: result.grInfo?.openQuantity,
      openValue: result.grInfo?.openValue,
      recommendation: result.recommendation
    };
  }

  async handleGetGRInfoForPOLine(req) {
    const { poNumber, poLineNumber } = req.data;
    return await poMatchingValidators.getGRInfoForPOLine(poNumber, poLineNumber);
  }

  // ============================================================================
  // Determination Handlers (Non-PO)
  // ============================================================================

  async handleDeriveGLAccountForNonPO(req) {
    const { companyCode, expenseType, description, vendorId } = req.data;

    const result = await determinationValidators.deriveGLAccountForNonPO({
      companyCode,
      expenseType,
      description,
      vendorId
    });

    return {
      glAccount: result.glAccount,
      description: result.description,
      confidence: result.confidence,
      source: result.source
    };
  }

  async handleDeriveCostCenterForNonPO(req) {
    const { controllingArea, department, description, expenseType } = req.data;

    const result = await determinationValidators.deriveCostCenterForNonPO({
      controllingArea,
      department,
      description,
      expenseType
    });

    return {
      costCenter: result.costCenter,
      description: result.description,
      confidence: result.confidence,
      source: result.source
    };
  }

  async handleDeriveAccountAssignment(req) {
    const { companyCode, controllingArea, description, expenseType, department, vendorId } = req.data;

    const result = await determinationValidators.deriveAccountAssignment({
      companyCode,
      controllingArea: controllingArea || companyCode,
      description,
      expenseType,
      department,
      vendorId
    });

    return {
      glAccount: result.glAccount.value,
      glConfidence: result.glAccount.confidence,
      costCenter: result.costCenter.value,
      ccConfidence: result.costCenter.confidence,
      profitCenter: result.profitCenter.value,
      internalOrder: result.internalOrder.value,
      isComplete: result.isComplete,
      recommendations: result.recommendations
    };
  }

  // ============================================================================
  // Tax Advanced Handlers
  // ============================================================================

  async handleDeriveTaxCodeFromPO(req) {
    const { poNumber, poLineNumber, context } = req.data;
    const result = await taxValidators.deriveTaxCodeFromPO(poNumber, poLineNumber, context || {});
    return this.formatValidationResult(result);
  }

  async handleDeriveTaxCodeForNonPO(req) {
    const { vendorId, companyCode, country, expenseType, glAccount } = req.data;

    const result = await taxValidators.deriveTaxCodeForNonPO({
      vendorId,
      companyCode,
      country,
      expenseType,
      glAccount
    });

    return this.formatValidationResult(result);
  }

  async handleDeriveTaxInfo(req) {
    const { poNumber, poLineNumber, companyCode, country, vendorId, expenseType, glAccount, region, postalCode } = req.data;

    return await taxValidators.deriveTaxInfo({
      poNumber,
      poLineNumber,
      companyCode,
      country,
      vendorId,
      expenseType,
      glAccount,
      region,
      postalCode
    }, { companyCode, country });
  }

  // ============================================================================
  // Enterprise Tax Determination Engine Handlers
  // ============================================================================

  /**
   * Main entry point for invoice tax determination
   * Handles both PO and Non-PO invoices with per-line-item processing
   */
  async handleDetermineInvoiceTax(req) {
    const {
      companyCode, vendorId, supplierName, poNumber,
      documentType, taxDate, currency, invoiceTaxAmount, lineItems
    } = req.data;

    const result = await taxEngine.determineInvoiceTax({
      companyCode,
      vendorId,
      supplierName,
      poNumber,
      documentType,
      taxDate: taxDate ? new Date(taxDate) : null,
      currency,
      invoiceTaxAmount,
      lineItems: lineItems.map(li => ({
        lineNumber: li.lineNumber,
        poNumber: li.poNumber,
        poLineNumber: li.poLineNumber,
        netAmount: parseFloat(li.netAmount) || 0,
        glAccount: li.glAccount,
        expenseType: li.expenseType,
        description: li.description,
        materialGroup: li.materialGroup,
        plant: li.plant
      }))
    });

    // Log to audit if successful
    if (result.success && req.data.documentReference) {
      await taxEngine.logTaxDetermination(req.data.documentReference, result);
    }

    return {
      success: result.success,
      lines: result.lines.map(mapLineTaxResult),
      exceptions: (result.exceptions || []).map(e => ({
        lineNumber: e.lineNumber != null ? String(e.lineNumber) : null,
        errorCode: e.errorCode,
        reason: e.reason
      })),
      header: result.header ? {
        taxCode: result.header.taxCode,
        taxJurisdiction: result.header.taxJurisdiction,
        totalTaxAmount: result.header.totalTaxAmount,
        totalNetAmount: result.header.totalNetAmount,
        effectiveTaxRate: result.header.effectiveTaxRate,
        allLinesSameTax: result.header.allLinesSameTax,
        uniqueTaxCodes: result.header.uniqueTaxCodes,
        allLinesSameJurisdiction: result.header.allLinesSameJurisdiction,
        uniqueTaxJurisdictions: result.header.uniqueTaxJurisdictions
      } : null,
      withholdingTax: result.withholdingTax ? {
        applicable: result.withholdingTax.applicable,
        wtType: result.withholdingTax.wtType,
        wtCode: result.withholdingTax.wtCode,
        wtRate: result.withholdingTax.wtRate,
        wtBaseAmount: result.withholdingTax.wtBaseAmount,
        wtAmount: result.withholdingTax.wtAmount,
        reason: result.withholdingTax.reason
      } : null,
      reconciliation: result.reconciliation ? {
        isBalanced: result.reconciliation.isBalanced,
        calculatedTotal: result.reconciliation.calculatedTotal,
        invoiceTotal: result.reconciliation.invoiceTotal,
        variance: result.reconciliation.variance,
        action: result.reconciliation.action,
        message: result.reconciliation.message
      } : null
    };
  }

  /**
   * Get tax details for a single lookup (enhanced rule-based)
   */
  async handleGetTaxDetailsEnhanced(req) {
    const {
      companyCode, vendorId, senderCountry, receiverCountry, receiverProvince,
      postalCode, documentType, glAccount, taxAmount, taxDate
    } = req.data;

    const result = await taxEngine.getTaxDetails({
      companyCode,
      vendorId,
      senderCountry,
      receiverCountry,
      receiverProvince,
      postalCode,
      documentType,
      glAccount,
      taxAmount,
      taxDate: taxDate ? new Date(taxDate) : null
    });

    return {
      taxCode: result.taxCode,
      taxJurisdiction: result.taxJurisdiction,
      option: result.option,
      source: result.source,
      ruleId: result.ruleId,
      ruleName: result.ruleName,
      error: result.error,
      searchCriteria: result.searchCriteria ? JSON.stringify(result.searchCriteria) : null
    };
  }

  /**
   * Determine tax for a single PO line item
   */
  async handleDetermineTaxForPOLine(req) {
    const { poNumber, poLineNumber, companyCode, netAmount, currency, taxDate } = req.data;

    const result = await taxEngine.determineTaxForPOLine({
      poNumber,
      poLineNumber,
      companyCode,
      netAmount: parseFloat(netAmount),
      currency,
      taxDate: taxDate ? new Date(taxDate) : null
    });

    return mapLineTaxResult(result);
  }

  /**
   * Determine tax for a single Non-PO line item
   */
  async handleDetermineTaxForNonPOLine(req) {
    const {
      companyCode, vendorId, lineNumber, netAmount, currency,
      glAccount, expenseType, documentType, taxDate
    } = req.data;

    const result = await taxEngine.determineTaxForNonPOLine({
      companyCode,
      vendorId,
      lineNumber,
      netAmount: parseFloat(netAmount),
      currency,
      glAccount,
      expenseType,
      documentType,
      taxDate: taxDate ? new Date(taxDate) : null
    });

    return mapLineTaxResult(result);
  }

  /**
   * Determine withholding tax applicability and amount
   */
  async handleDetermineWithholdingTax(req) {
    const { vendorId, companyCode, invoiceAmount, expenseType, glAccount } = req.data;

    const result = await taxEngine.determineWithholdingTax({
      vendorId,
      companyCode,
      invoiceAmount: parseFloat(invoiceAmount),
      expenseType,
      glAccount
    });

    return {
      applicable: result.applicable,
      wtType: result.wtType,
      wtCode: result.wtCode,
      wtRate: result.wtRate,
      wtBaseAmount: result.wtBaseAmount,
      wtAmount: result.wtAmount,
      reason: result.reason
    };
  }

  /**
   * Resolve receiver address for tax determination
   */
  async handleResolveReceiverAddress(req) {
    const { companyCode, poNumber, poLineNumber, plant } = req.data;

    const { address, source } = await taxEngine.resolveReceiverAddress({
      companyCode,
      poNumber,
      poLineNumber,
      plant
    });

    return {
      country: address.country,
      region: address.region,
      city: address.city,
      postalCode: address.postalCode,
      taxJurisdiction: address.taxJurisdiction,
      source
    };
  }

  /**
   * Get vendor tax profile
   */
  async handleGetVendorTaxProfile(req) {
    const { vendorId, companyCode } = req.data;

    const profile = await taxEngine.getVendorTaxProfile(vendorId, companyCode);

    if (!profile) {
      return null;
    }

    return {
      vendorId: profile.vendorId,
      companyCode: profile.companyCode,
      vendorName: profile.vendorName,
      vendorCountry: profile.vendorCountry,
      isTaxExempt: profile.isTaxExempt,
      exemptionCertNumber: profile.exemptionCertNumber,
      exemptionValidFrom: profile.exemptionValidFrom,
      exemptionValidTo: profile.exemptionValidTo,
      defaultTaxCode: profile.defaultTaxCode,
      withholdingTaxApplicable: profile.withholdingTaxApplicable,
      withholdingTaxCode: profile.withholdingTaxCode,
      withholdingTaxType: profile.withholdingTaxType
    };
  }

  /**
   * Validate tax code against SAP TaxKeys table
   */
  async handleValidateTaxCodeAgainstSAP(req) {
    const { taxCode, companyCode } = req.data;
    return await taxEngine.validateTaxCode(taxCode, companyCode);
  }

  /**
   * Validate tax jurisdiction against SAP table
   */
  async handleValidateTaxJurisdictionAgainstSAP(req) {
    const { jurisdictionCode, companyCode } = req.data;
    return await taxEngine.validateTaxJurisdiction(jurisdictionCode, companyCode);
  }

  /**
   * Batch tax determination for multiple lines
   */
  async handleBatchDetermineTax(req) {
    const { companyCode, vendorId, currency, taxDate, lines } = req.data;

    const results = await taxEngine.batchDetermineTax({
      companyCode,
      vendorId,
      currency,
      taxDate: taxDate ? new Date(taxDate) : null,
      lines: lines.map(li => ({
        lineNumber: li.lineNumber,
        poNumber: li.poNumber,
        poLineNumber: li.poLineNumber,
        netAmount: parseFloat(li.netAmount) || 0,
        glAccount: li.glAccount,
        expenseType: li.expenseType
      }))
    });

    return results.map(mapLineTaxResult);
  }
};


// ============================================================================
// Tax Engine V2 Handlers
// ============================================================================

/**
 * Handle determineTaxV2 - Main entry point for 100% deterministic tax
 */
ValidatorsService.prototype.handleDetermineTaxV2 = async function (req) {
  const { context } = req.data;

  const result = await taxEngineV2.determineTax(context);

  return mapTaxResultV2(result);
};

/**
 * Handle determineNonPOTaxV2 - Non-PO invoice tax determination
 */
ValidatorsService.prototype.handleDetermineNonPOTaxV2 = async function (req) {
  const { context } = req.data;

  const result = await taxEngineV2.determineNonPOTax(context);

  return mapTaxResultV2(result);
};

/**
 * Handle testTaxDetermination - Test a scenario without logging
 */
ValidatorsService.prototype.handleTestTaxDetermination = async function (req) {
  const { context } = req.data;

  const result = await taxEngineV2.testDetermination(context);

  return mapTaxResultV2(result);
};

/**
 * Handle explainTaxDetermination - Get detailed explanation
 */
ValidatorsService.prototype.handleExplainTaxDetermination = async function (req) {
  const { context } = req.data;

  const explanation = await taxEngineV2.explainDetermination(context);

  return {
    input: explanation.input,
    result: explanation.result,
    determinationLayer: explanation.determinationLayer,
    layerExplanation: explanation.layerExplanation,
    determinationPath: explanation.determinationPath,
    confidenceScore: explanation.confidenceScore,
    ruleName: explanation.ruleName,
    warnings: explanation.warnings,
    recommendations: explanation.recommendations
  };
};

// ============================================================================
// ZIP Code Resolution Handlers
// ============================================================================

/**
 * Handle resolveZipCode
 */
ValidatorsService.prototype.handleResolveZipCode = async function (req) {
  const { zipCode } = req.data;

  const result = await zipCodeResolver.resolveZipCode(zipCode);

  return {
    success: result.success,
    matchType: result.matchType,
    zipCode: result.zipCode,
    city: result.city,
    county: result.county,
    stateCode: result.stateCode,
    stateName: result.stateName,
    taxCode: result.taxCode,
    jurisdictionCode: result.jurisdictionCode,
    jurisdictionName: result.jurisdictionName,
    stateTaxRate: result.stateTaxRate,
    countyTaxRate: result.countyTaxRate,
    cityTaxRate: result.cityTaxRate,
    specialDistrictRate: result.specialDistrictRate,
    combinedTaxRate: result.combinedTaxRate,
    warning: result.warning,
    error: result.error
  };
};

/**
 * Handle batchResolveZipCodes
 */
ValidatorsService.prototype.handleBatchResolveZipCodes = async function (req) {
  const { zipCodes } = req.data;

  const results = await zipCodeResolver.batchResolveZipCodes(zipCodes);

  return results.map(r => ({
    zipCode: r.zipCode,
    success: r.success,
    stateCode: r.stateCode,
    combinedTaxRate: r.combinedTaxRate,
    taxCode: r.taxCode,
    jurisdictionCode: r.jurisdictionCode,
    error: r.error
  }));
};

/**
 * Handle getStateFromZip
 */
ValidatorsService.prototype.handleGetStateFromZip = function (req) {
  const { zipCode } = req.data;

  const stateCode = zipCodeResolver.getStateFromZip(zipCode);

  return {
    stateCode: stateCode,
    valid: !!stateCode
  };
};

// ============================================================================
// Tax Admin API Handlers
// ============================================================================

/**
 * Handle getTaxRules
 */
ValidatorsService.prototype.handleGetTaxRules = async function (req) {
  const { ruleType, companyCode, isActive, search } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.getRules({ ruleType, companyCode, isActive, search });

  return result.rules || [];
};

/**
 * Handle createTaxRule
 */
ValidatorsService.prototype.handleCreateTaxRule = async function (req) {
  const { ruleData, createdBy } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.createRule(ruleData, createdBy);

  return {
    success: result.success,
    ruleId: result.ruleId,
    errors: result.errors || []
  };
};

/**
 * Handle updateTaxRule
 */
ValidatorsService.prototype.handleUpdateTaxRule = async function (req) {
  const { ruleId, updates, updatedBy } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.updateRule(ruleId, updates, updatedBy);

  return {
    success: result.success,
    errors: result.errors || []
  };
};

/**
 * Handle deleteTaxRule
 */
ValidatorsService.prototype.handleDeleteTaxRule = async function (req) {
  const { ruleId, deletedBy } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.deleteRule(ruleId, deletedBy);

  return { success: result.success };
};

/**
 * Handle testTaxRuleById
 */
ValidatorsService.prototype.handleTestTaxRuleById = async function (req) {
  const { ruleId, context } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.testRuleById(ruleId, context || {});

  return {
    success: result.success,
    ruleMatched: result.ruleMatched,
    result: result.result
  };
};

/**
 * Handle batchTestTaxRules
 */
ValidatorsService.prototype.handleBatchTestTaxRules = async function (req) {
  const { scenarios } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.batchTestRules(scenarios);

  return {
    total: result.summary.total,
    successful: result.summary.successful,
    failed: result.summary.failed,
    byLayer: Object.entries(result.summary.byLayer || {}).map(([layer, count]) => ({
      layer,
      count
    }))
  };
};

// ============================================================================
// US State Tax Management Handlers
// ============================================================================

/**
 * Handle getUSStateTaxConfigs
 */
ValidatorsService.prototype.handleGetUSStateTaxConfigs = async function (req) {
  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.getUSStates();

  return result.states || [];
};

/**
 * Handle updateUSStateTaxRate
 */
ValidatorsService.prototype.handleUpdateUSStateTaxRate = async function (req) {
  const { stateCode, newRate, effectiveDate, updatedBy } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.updateUSStateRate(stateCode, newRate, effectiveDate, updatedBy);

  return {
    success: result.success,
    oldRate: result.oldRate,
    newRate: result.newRate
  };
};

// ============================================================================
// Canadian Province Tax Management Handlers
// ============================================================================

/**
 * Handle getCanadianProvinceTaxConfigs
 */
ValidatorsService.prototype.handleGetCanadianProvinceTaxConfigs = async function (req) {
  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.getCanadianProvinces();

  return result.provinces || [];
};

/**
 * Handle updateCanadianProvinceTaxRate
 */
ValidatorsService.prototype.handleUpdateCanadianProvinceTaxRate = async function (req) {
  const { provinceCode, rateType, newRate, effectiveDate, updatedBy } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.updateCanadianProvinceRate(provinceCode, rateType, newRate, effectiveDate, updatedBy);

  return {
    success: result.success,
    oldRate: result.oldRate,
    newRate: result.newRate,
    newCombinedRate: result.newCombinedRate
  };
};

// ============================================================================
// Company Tax Configuration Handlers
// ============================================================================

/**
 * Handle getCompanyTaxConfigs
 */
ValidatorsService.prototype.handleGetCompanyTaxConfigs = async function (req) {
  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.getCompanyConfigs();

  return result.configs || [];
};

/**
 * Handle updateCompanyTaxConfig
 */
ValidatorsService.prototype.handleUpdateCompanyTaxConfig = async function (req) {
  const { companyCode, updates, updatedBy } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.updateCompanyConfig(companyCode, updates, updatedBy);

  return { success: result.success };
};

// ============================================================================
// Tax Data Sync Handlers
// ============================================================================

/**
 * Handle triggerTaxDataSync
 */
ValidatorsService.prototype.handleTriggerTaxDataSync = async function (req) {
  const { syncType, triggeredBy } = req.data;

  const scheduler = taxExternalIntegration.getSyncScheduler();
  const result = await scheduler.triggerSync(syncType);

  return {
    success: result.success,
    syncId: result.syncId,
    message: result.error || 'Sync triggered successfully'
  };
};

/**
 * Handle getTaxSyncHistory
 */
ValidatorsService.prototype.handleGetTaxSyncHistory = async function (req) {
  const { limit } = req.data;

  const syncService = taxDataSync.getSyncService();
  const history = await syncService.getSyncHistory(limit || 20);

  return history.map(h => ({
    syncId: h.ID,
    syncType: h.syncType,
    syncStatus: h.syncStatus,
    startedAt: h.startedAt,
    completedAt: h.completedAt,
    recordsProcessed: h.recordsProcessed,
    recordsCreated: h.recordsCreated,
    recordsUpdated: h.recordsUpdated,
    recordsFailed: h.recordsFailed,
    errorMessage: h.errorMessage
  }));
};

/**
 * Handle getTaxSchedulerStatus
 */
ValidatorsService.prototype.handleGetTaxSchedulerStatus = function (req) {
  const scheduler = taxExternalIntegration.getSyncScheduler();
  const status = scheduler.getStatus();

  return {
    isRunning: status.isRunning,
    lastRun: status.lastRun,
    schedules: Object.entries(status.schedules || {}).map(([name, info]) => ({
      name,
      type: info.type,
      nextRun: info.nextRun
    }))
  };
};

// ============================================================================
// Tax Audit Log Handlers
// ============================================================================

/**
 * Handle getTaxAuditLog
 */
ValidatorsService.prototype.handleGetTaxAuditLog = async function (req) {
  const { entityType, entityKey, limit } = req.data;

  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.getAuditLog(entityType, entityKey, limit);

  return (result.history || []).map(h => ({
    changeId: h.ID,
    entityType: h.entityType,
    entityKey: h.entityKey,
    changeType: h.changeType,
    changedAt: h.changedAt,
    changedBy: h.changedBy,
    fieldName: h.fieldName,
    oldValue: h.oldValue,
    newValue: h.newValue
  }));
};

// ============================================================================
// Tax Admin Dashboard Handlers
// ============================================================================

/**
 * Handle getTaxAdminDashboard
 */
ValidatorsService.prototype.handleGetTaxAdminDashboard = async function (req) {
  const adminAPI = taxAdminAPI.getAdminAPI();
  const result = await adminAPI.getDashboard();

  const dashboard = result.dashboard || {};

  return {
    rules: {
      total: dashboard.rules?.total || 0,
      byType: Object.entries(dashboard.rules?.byType || {}).map(([ruleType, count]) => ({
        ruleType,
        count
      }))
    },
    coverage: {
      usStates: dashboard.coverage?.usStates || 0,
      caProvinces: dashboard.coverage?.caProvinces || 0,
      companies: dashboard.coverage?.companies || 0
    },
    recentSync: dashboard.syncs?.lastSuccess ? {
      syncId: dashboard.syncs.lastSuccess.ID,
      status: dashboard.syncs.lastSuccess.syncStatus,
      syncedAt: dashboard.syncs.lastSuccess.completedAt
    } : null,
    cacheStats: await adminAPI.getCacheStats()
  };
};

/**
 * Handle refreshTaxCache
 */
ValidatorsService.prototype.handleRefreshTaxCache = async function (req) {
  const adminAPI = taxAdminAPI.getAdminAPI();
  await adminAPI.refreshEngineCache();

  const stats = await adminAPI.getCacheStats();
  const totalSize = Object.values(stats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

  return {
    success: true,
    cacheSize: totalSize
  };
};

// ============================================================================
// External Tax Engine Handlers
// ============================================================================

/**
 * Handle checkExternalTaxEngine
 */
ValidatorsService.prototype.handleCheckExternalTaxEngine = async function (req) {
  const { companyCode } = req.data;

  const integration = taxExternalIntegration.getExternalIntegration();
  const status = await integration.getEngineStatus(companyCode);

  return {
    available: status.available,
    engineType: status.engineType,
    latency: status.latency,
    error: status.error || status.reason
  };
};

/**
 * Handle calculateTaxExternal
 */
ValidatorsService.prototype.handleCalculateTaxExternal = async function (req) {
  const { context } = req.data;

  const result = await taxExternalIntegration.calculateExternalTax(context);

  return {
    success: result.success,
    taxCode: result.taxCode,
    taxRate: result.taxRate,
    taxAmount: result.taxAmount,
    jurisdictionCode: result.jurisdictionCode,
    engineType: result.engineType,
    fromCache: result.fromCache,
    error: result.error
  };
};
