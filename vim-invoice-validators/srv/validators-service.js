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
    
    // Cache management
    this.on('clearCache', this.handleClearCache);
    this.on('getCacheStats', this.handleGetCacheStats);
    
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
};
