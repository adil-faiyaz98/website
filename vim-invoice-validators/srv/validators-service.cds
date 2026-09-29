using { vim_ecc_integration } from './external/vim_ecc_integration';

/**
 * Invoice Validators Service
 * Exposes validation and derivation operations for invoice processing.
 */
service ValidatorsService @(path: '/api/validators') {

  // ============================================================================
  // Types for request/response
  // ============================================================================
  
  type ValidationResult {
    isValid      : Boolean;
    confidence   : Decimal(5,4);
    derivedValue : String;
    message      : String;
    matchStrategy: String;
  }
  
  type DerivationResult {
    success       : Boolean;
    confidence    : Decimal(5,4);
    source        : String;
  }
  
  type ValidationContext {
    companyCode     : String(4);
    country         : String(2);
    language        : String(1);
    controllingArea : String(4);
  }

  // ============================================================================
  // Vendor Operations
  // ============================================================================
  
  /**
   * Validate a vendor by ID and/or name.
   */
  action validateVendor(
    vendorId   : String(10),
    vendorName : String(35),
    context    : ValidationContext not null
  ) returns ValidationResult;
  
  /**
   * Search vendors by name.
   */
  function searchVendors(
    searchTerm : String(100) not null,
    companyCode: String(4) not null,
    limit      : Integer default 10
  ) returns many {
    vendorId   : String(10);
    vendorName : String(35);
    score      : Decimal(5,4);
  };

  // ============================================================================
  // Purchase Order Operations
  // ============================================================================
  
  /**
   * Validate a PO number exists.
   */
  action validatePO(
    poNumber   : String(10) not null,
    context    : ValidationContext
  ) returns ValidationResult;
  
  /**
   * Derive fields from a Purchase Order.
   */
  action deriveFromPO(
    poNumber : String(10) not null,
    poItem   : String(5)
  ) returns {
    success       : Boolean;
    confidence    : Decimal(5,4);
    vendorId      : String(10);
    vendorName    : String(35);
    companyCode   : String(4);
    currency      : String(5);
    paymentTerms  : String(4);
    taxCode       : String(2);
    glAccount     : String(10);
    costCenter    : String(10);
  };


  // ============================================================================
  // Tax Operations
  // ============================================================================
  
  /**
   * Validate a tax code for a country.
   */
  action validateTaxCode(
    taxCode : String(2) not null,
    context : ValidationContext not null
  ) returns ValidationResult;
  
  /**
   * Calculate tax from net amount.
   */
  action calculateTax(
    companyCode      : String(4) not null,
    taxCode          : String(2) not null,
    currency         : String(5) not null,
    netAmount        : Decimal(15,2) not null,
    jurisdictionCode : String(15)
  ) returns {
    taxAmount : Decimal(15,2);
    success   : Boolean;
    message   : String;
  };
  
  /**
   * Get tax codes for a country.
   */
  function getTaxCodes(
    country  : String(2) not null,
    language : String(1) default 'E'
  ) returns many {
    taxCode     : String(2);
    description : String(50);
    taxType     : String(1);
  };

  // ============================================================================
  // Account Operations
  // ============================================================================
  
  /**
   * Validate a GL account.
   */
  action validateGLAccount(
    accountNumber : String(10) not null,
    context       : ValidationContext not null
  ) returns ValidationResult;
  
  /**
   * Validate a cost center.
   */
  action validateCostCenter(
    costCenter : String(10) not null,
    context    : ValidationContext
  ) returns ValidationResult;
  
  /**
   * Search GL accounts by description.
   */
  function searchGLAccounts(
    searchTerm  : String(100) not null,
    companyCode : String(4) not null,
    limit       : Integer default 10
  ) returns many {
    accountNumber : String(10);
    shortText     : String(20);
    longText      : String(50);
    score         : Decimal(5,4);
  };
  
  /**
   * Search cost centers by description.
   */
  function searchCostCenters(
    searchTerm      : String(100) not null,
    controllingArea : String(4),
    limit           : Integer default 10
  ) returns many {
    costCenter  : String(10);
    description : String(20);
    score       : Decimal(5,4);
  };

  // ============================================================================
  // Full Invoice Processing
  // ============================================================================
  
  /**
   * Process and validate a complete invoice.
   */
  action processInvoice(
    header    : {
      invoiceNumber  : String(16);
      vendorId       : String(10);
      vendorName     : String(35);
      purchaseOrder  : String(10);
      companyCode    : String(4);
      currency       : String(5);
      grossAmount    : Decimal(15,2);
      netAmount      : Decimal(15,2);
      taxAmount      : Decimal(15,2);
    },
    lineItems : many {
      lineNumber  : Integer;
      description : String(100);
      poNumber    : String(10);
      poItem      : String(5);
      netAmount   : Decimal(15,2);
      taxCode     : String(2);
      glAccount   : String(10);
      costCenter  : String(10);
    },
    context   : ValidationContext not null
  ) returns {
    isValid    : Boolean;
    confidence : Decimal(5,4);
    messages   : many String;
  };

  // ============================================================================
  // Touchless Processing
  // ============================================================================
  
  type TouchlessStatus : String enum { TOUCHLESS; REVIEW_REQUIRED; MANUAL_PROCESSING; REJECTED };
  
  type RiskAssessment {
    riskScore : Decimal(3,2);
    riskLevel : String(10);
    flags     : many String;
  }
  
  /**
   * Process invoice for touchless posting.
   */
  action processInvoiceTouchless(
    invoiceNumber : String(16),
    invoiceDate   : Date,
    grossAmount   : Decimal(15,2) not null,
    netAmount     : Decimal(15,2),
    taxAmount     : Decimal(15,2),
    currency      : String(5) not null,
    vendorId      : String(10),
    supplierName  : String(100),
    poNumber      : String(10),
    companyCode   : String(4) not null,
    country       : String(2) not null,
    controllingArea : String(4),
    lineItems     : many {
      lineNumber    : Integer;
      description   : String(100);
      amount        : Decimal(15,2);
      quantity      : Decimal(13,3);
      unitPrice     : Decimal(15,2);
      poLineNumber  : String(5);
      material      : String(18);
      expenseType   : String(30);
      department    : String(30);
    },
    options       : {
      skipFraudCheck    : Boolean;
      allowPartialMatch : Boolean;
    }
  ) returns {
    status            : TouchlessStatus;
    overallConfidence : Decimal(3,2);
    readyForPosting   : Boolean;
    derivedVendorId   : String(10);
    derivedPaymentTerms : String(4);
    derivedDueDate    : Date;
    derivedTaxCode    : String(2);
    derivedGLAccount  : String(10);
    derivedCostCenter : String(10);
    issues            : many String;
    recommendations   : many String;
    riskAssessment    : RiskAssessment;
  };
  
  /**
   * Check if invoice is eligible for touchless processing.
   */
  function checkTouchlessEligibility(
    vendorId    : String(10),
    supplierName: String(100),
    companyCode : String(4) not null,
    grossAmount : Decimal(15,2) not null,
    poNumber    : String(10)
  ) returns {
    eligible : Boolean;
    reasons  : many String;
  };

  // ============================================================================
  // Supplier/Vendor Advanced Operations
  // ============================================================================
  
  /**
   * Identify vendor from supplier name with additional matching criteria.
   */
  action identifyVendorFromSupplier(
    supplierName : String(100) not null,
    companyCode  : String(4) not null,
    city         : String(40),
    postalCode   : String(10),
    taxNumber    : String(20)
  ) returns ValidationResult;
  
  /**
   * Analyze vendor blocks (posting, payment, purchasing).
   */
  function analyzeVendorBlocks(
    vendorId    : String(10) not null,
    companyCode : String(4) not null
  ) returns {
    isBlocked  : Boolean;
    blockTypes : many String;
    reason     : String;
  };
  
  /**
   * Detect fraud indicators on invoice.
   */
  action detectFraudIndicators(
    vendorId      : String(10) not null,
    companyCode   : String(4) not null,
    amount        : Decimal(15,2) not null,
    invoiceNumber : String(16),
    invoiceDate   : Date,
    poNumber      : String(10)
  ) returns {
    riskScore      : Decimal(3,2);
    riskLevel      : String(10);
    flags          : many String;
    recommendation : String;
  };
  
  /**
   * Get comprehensive vendor risk profile.
   */
  function getVendorRiskProfile(
    vendorId    : String(10) not null,
    companyCode : String(4) not null
  ) returns {
    vendorId    : String(10);
    vendorName  : String(35);
    status      : String(20);
    overallRisk : String(10);
    riskFactors : many String;
    recommendation : String;
  };

  // ============================================================================
  // Payment Operations
  // ============================================================================
  
  /**
   * Derive payment terms from PO or vendor master.
   */
  action derivePaymentTerms(
    poNumber    : String(10),
    vendorId    : String(10),
    companyCode : String(4) not null
  ) returns {
    paymentTermsKey : String(4);
    netDays         : Integer;
    source          : String(20);
    description     : String(50);
  };
  
  /**
   * Calculate due date and cash discount.
   */
  action calculatePaymentInfo(
    poNumber      : String(10),
    vendorId      : String(10),
    companyCode   : String(4) not null,
    invoiceDate   : Date not null,
    invoiceAmount : Decimal(15,2) not null
  ) returns {
    paymentTerms      : String(4);
    dueDate           : Date;
    discountAvailable : Boolean;
    discountAmount    : Decimal(15,2);
    discountDueDate   : Date;
    discountPercent   : Decimal(5,2);
  };

  // ============================================================================
  // PO Matching Advanced Operations
  // ============================================================================
  
  /**
   * Perform 2-way match (PO to Invoice).
   */
  action perform2WayMatch(
    poNumber        : String(10) not null,
    poLineNumber    : String(5) not null,
    invoiceQuantity : Decimal(13,3),
    invoiceUnitPrice: Decimal(15,2),
    invoiceAmount   : Decimal(15,2)
  ) returns {
    isMatched   : Boolean;
    matchType   : String(10);
    confidence  : Decimal(3,2);
    issues      : many String;
    variances   : {
      quantity  : Decimal(5,4);
      unitPrice : Decimal(5,4);
      amount    : Decimal(5,4);
    };
  };
  
  /**
   * Perform 3-way match (PO to GR to Invoice).
   */
  action perform3WayMatch(
    poNumber        : String(10) not null,
    poLineNumber    : String(5) not null,
    invoiceQuantity : Decimal(13,3),
    invoiceUnitPrice: Decimal(15,2),
    invoiceAmount   : Decimal(15,2)
  ) returns {
    isMatched      : Boolean;
    matchType      : String(10);
    confidence     : Decimal(3,2);
    issues         : many String;
    grExists       : Boolean;
    openQuantity   : Decimal(13,3);
    openValue      : Decimal(15,2);
    recommendation : String;
  };
  
  /**
   * Get GR information for PO line.
   */
  function getGRInfoForPOLine(
    poNumber     : String(10) not null,
    poLineNumber : String(5) not null
  ) returns {
    grExists       : Boolean;
    grQuantity     : Decimal(13,3);
    grValue        : Decimal(15,2);
    openQuantity   : Decimal(13,3);
    openValue      : Decimal(15,2);
  };

  // ============================================================================
  // Determination Operations (Non-PO)
  // ============================================================================
  
  /**
   * Derive GL account for non-PO invoice.
   */
  action deriveGLAccountForNonPO(
    companyCode  : String(4) not null,
    expenseType  : String(30),
    description  : String(100),
    vendorId     : String(10)
  ) returns {
    glAccount   : String(10);
    description : String(50);
    confidence  : Decimal(3,2);
    source      : String(30);
  };
  
  /**
   * Derive cost center for non-PO invoice.
   */
  action deriveCostCenterForNonPO(
    controllingArea : String(4) not null,
    department      : String(30),
    description     : String(100),
    expenseType     : String(30)
  ) returns {
    costCenter  : String(10);
    description : String(50);
    confidence  : Decimal(3,2);
    source      : String(30);
  };
  
  /**
   * Derive complete account assignment for non-PO line.
   */
  action deriveAccountAssignment(
    companyCode     : String(4) not null,
    controllingArea : String(4),
    description     : String(100),
    expenseType     : String(30),
    department      : String(30),
    vendorId        : String(10)
  ) returns {
    glAccount       : String(10);
    glConfidence    : Decimal(3,2);
    costCenter      : String(10);
    ccConfidence    : Decimal(3,2);
    profitCenter    : String(10);
    internalOrder   : String(12);
    isComplete      : Boolean;
    recommendations : many String;
  };

  // ============================================================================
  // Tax Advanced Operations
  // ============================================================================
  
  /**
   * Derive tax code from PO.
   */
  action deriveTaxCodeFromPO(
    poNumber     : String(10) not null,
    poLineNumber : String(5),
    context      : ValidationContext
  ) returns ValidationResult;
  
  /**
   * Derive tax code for non-PO invoice.
   */
  action deriveTaxCodeForNonPO(
    vendorId    : String(10),
    companyCode : String(4) not null,
    country     : String(2) not null,
    expenseType : String(30),
    glAccount   : String(10)
  ) returns ValidationResult;
  
  /**
   * Derive complete tax information.
   */
  action deriveTaxInfo(
    poNumber     : String(10),
    poLineNumber : String(5),
    companyCode  : String(4) not null,
    country      : String(2) not null,
    vendorId     : String(10),
    expenseType  : String(30),
    glAccount    : String(10),
    region       : String(3),
    postalCode   : String(10)
  ) returns {
    taxCode                   : String(2);
    taxCodeConfidence         : Decimal(3,2);
    taxCodeSource             : String(30);
    taxJurisdiction           : String(15);
    taxJurisdictionConfidence : Decimal(3,2);
    isPOBased                 : Boolean;
  };

  // ============================================================================
  // Enterprise Tax Determination Engine (New)
  // ============================================================================

  /**
   * Line item for tax determination input
   */
  type TaxLineItemInput {
    lineNumber    : String(10);
    poNumber      : String(10);
    poLineNumber  : String(5);
    netAmount     : Decimal(15,2);
    glAccount     : String(10);
    expenseType   : String(30);
    description   : String(100);
    materialGroup : String(9);
    plant         : String(4);
  }

  /**
   * Line-level tax determination result
   */
  type LineTaxResult {
    lineNumber          : String(10);
    status              : String(20);   // DETERMINED or EXCEPTION
    errorCode           : String(50);
    taxCode             : String(4);
    taxJurisdiction     : String(15);
    taxAmount           : Decimal(15,2);
    taxRate             : Decimal(5,2);
    confidence          : Decimal(3,2);
    determinationMethod : String(50);
    ruleId              : String(36);
    reason              : String(200);
    isValidated         : Boolean;
    warnings            : many String;
  }

  /**
   * Header-level aggregated tax result
   */
  type HeaderTaxResult {
    taxCode           : String(4);
    taxJurisdiction   : String(15);
    totalTaxAmount    : Decimal(15,2);
    totalNetAmount    : Decimal(15,2);
    effectiveTaxRate  : Decimal(5,2);
    allLinesSameTax   : Boolean;
    uniqueTaxCodes    : many String;
    allLinesSameJurisdiction : Boolean;
    uniqueTaxJurisdictions   : many String;
  }

  /**
   * Withholding tax determination result
   */
  type WithholdingTaxResult {
    applicable    : Boolean;
    wtType        : String(2);
    wtCode        : String(2);
    wtRate        : Decimal(5,2);
    wtBaseAmount  : Decimal(15,2);
    wtAmount      : Decimal(15,2);
    reason        : String(200);
  }

  /**
   * Tax reconciliation summary
   */
  type TaxReconciliation {
    isBalanced      : Boolean;
    calculatedTotal : Decimal(15,2);
    invoiceTotal    : Decimal(15,2);
    variance        : Decimal(15,2);
    action          : String(30);
    message         : String(500);
  }

  /**
   * Line-level tax determination exception
   */
  type TaxException {
    lineNumber : String(10);
    errorCode  : String(50);
    reason     : String(200);
  }

  /**
   * Full invoice tax determination result
   */
  type InvoiceTaxResult {
    success         : Boolean;
    lines           : many LineTaxResult;
    exceptions      : many TaxException;
    header          : HeaderTaxResult;
    withholdingTax  : WithholdingTaxResult;
    reconciliation  : TaxReconciliation;
  }

  /**
   * Determine tax for an entire invoice (PO or Non-PO)
   * Main entry point for tax determination
   */
  action determineInvoiceTax(
    companyCode      : String(4) not null,
    vendorId         : String(10),
    supplierName     : String(100),
    poNumber         : String(10),
    documentType     : String(2),
    taxDate          : Date,
    currency         : String(5),
    invoiceTaxAmount : Decimal(15,2),
    lineItems        : many TaxLineItemInput not null
  ) returns InvoiceTaxResult;

  /**
   * Get tax details for a single lookup (rule-based)
   * Enhanced version with vendorId, senderCountry, and date-effective rules
   */
  action getTaxDetailsEnhanced(
    companyCode      : String(4) not null,
    vendorId         : String(10),
    senderCountry    : String(3),
    receiverCountry  : String(3),
    receiverProvince : String(3),
    postalCode       : String(10),
    documentType     : String(2),
    glAccount        : String(10),
    taxAmount        : Boolean,
    taxDate          : Date
  ) returns {
    taxCode         : String(4);
    taxJurisdiction : String(15);
    option          : String(20);
    source          : String(30);
    ruleId          : String(36);
    ruleName        : String(50);
    error           : String(50);
    searchCriteria  : String;
  };

  /**
   * Determine tax for a single PO line item
   */
  action determineTaxForPOLine(
    poNumber     : String(10) not null,
    poLineNumber : String(5) not null,
    companyCode  : String(4) not null,
    netAmount    : Decimal(15,2) not null,
    currency     : String(5) not null,
    taxDate      : Date
  ) returns LineTaxResult;

  /**
   * Determine tax for a single Non-PO line item
   */
  action determineTaxForNonPOLine(
    companyCode  : String(4) not null,
    vendorId     : String(10),
    lineNumber   : String(10) not null,
    netAmount    : Decimal(15,2) not null,
    currency     : String(5) not null,
    glAccount    : String(10),
    expenseType  : String(30),
    documentType : String(2),
    taxDate      : Date
  ) returns LineTaxResult;

  /**
   * Determine withholding tax applicability and amount
   */
  action determineWithholdingTax(
    vendorId      : String(10) not null,
    companyCode   : String(4) not null,
    invoiceAmount : Decimal(15,2) not null,
    expenseType   : String(30),
    glAccount     : String(10)
  ) returns WithholdingTaxResult;

  /**
   * Resolve receiver address for tax determination
   */
  action resolveReceiverAddress(
    companyCode  : String(4) not null,
    poNumber     : String(10),
    poLineNumber : String(5),
    plant        : String(4)
  ) returns {
    country         : String(3);
    region          : String(3);
    city            : String(40);
    postalCode      : String(10);
    taxJurisdiction : String(15);
    source          : String(50);
  };

  /**
   * Get vendor tax profile (exemptions, WHT config, defaults)
   */
  function getVendorTaxProfile(
    vendorId    : String(10) not null,
    companyCode : String(4) not null
  ) returns {
    vendorId                   : String(10);
    companyCode                : String(4);
    vendorName                 : String(35);
    vendorCountry              : String(3);
    isTaxExempt                : Boolean;
    exemptionCertNumber        : String(30);
    exemptionValidFrom         : Date;
    exemptionValidTo           : Date;
    defaultTaxCode             : String(4);
    withholdingTaxApplicable   : Boolean;
    withholdingTaxCode         : String(2);
    withholdingTaxType         : String(2);
  };

  /**
   * Validate a tax code against SAP TaxKeys table
   */
  action validateTaxCodeAgainstSAP(
    taxCode     : String(4) not null,
    companyCode : String(4) not null
  ) returns {
    valid   : Boolean;
    message : String(200);
  };

  /**
   * Validate a tax jurisdiction against SAP table
   */
  action validateTaxJurisdictionAgainstSAP(
    jurisdictionCode : String(15) not null,
    companyCode      : String(4) not null
  ) returns {
    valid   : Boolean;
    message : String(200);
  };

  /**
   * Batch tax determination for multiple lines
   */
  action batchDetermineTax(
    companyCode : String(4) not null,
    vendorId    : String(10),
    currency    : String(5) not null,
    taxDate     : Date,
    lines       : many TaxLineItemInput not null
  ) returns many LineTaxResult;

  // ============================================================================
  // Cache Management
  // ============================================================================
  
  /**
   * Clear all caches.
   */
  action clearCache() returns { success: Boolean };
  
  /**
   * Get cache statistics.
   */
  function getCacheStats() returns {
    hits    : Integer;
    misses  : Integer;
    size    : Integer;
    maxSize : Integer;
  };
}


  // ============================================================================
  // Tax Determination Engine V2 - 100% Deterministic
  // ============================================================================

  /**
   * Tax determination context for V2 engine
   */
  type TaxDeterminationContext {
    companyCode      : String(4) not null;
    invoiceType      : String(10);        // PO_BASED or NON_PO
    vendorId         : String(10);
    poNumber         : String(10);
    poLineItem       : Integer;
    shipFromCountry  : String(3);
    shipFromRegion   : String(3);
    shipToCountry    : String(3);
    shipToRegion     : String(3);
    shipToZipCode    : String(10);
    plantCode        : String(4);
    glAccount        : String(10);
    expenseCategory  : String(20);
    materialGroup    : String(9);
    grossAmount      : Decimal(15,2);
    currency         : String(5);
  }

  /**
   * Tax determination result from V2 engine
   */
  type TaxDeterminationResultV2 {
    success            : Boolean;
    status             : String(20);      // DETERMINED or EXCEPTION
    errorCode          : String(50);
    error              : String(500);
    taxCode            : String(4);
    taxRate            : Decimal(7,4);
    taxAmount          : Decimal(15,2);
    jurisdictionCode   : String(15);
    determinationLayer : String(30);
    ruleId             : String(36);
    ruleName           : String(100);
    confidenceScore    : Integer;
    requiresReview     : Boolean;
    reviewReason       : String(200);
    processingTimeMs   : Integer;
    determinationPath  : many String;
    warnings           : many String;
  }

  /**
   * Determine tax using V2 engine (fail-closed)
   * Returns status EXCEPTION with errorCode when no configured layer matches
   */
  action determineTaxV2(
    context : TaxDeterminationContext not null
  ) returns TaxDeterminationResultV2;

  /**
   * Determine tax for Non-PO invoice using V2 engine
   */
  action determineNonPOTaxV2(
    context : TaxDeterminationContext not null
  ) returns TaxDeterminationResultV2;

  /**
   * Test a tax determination scenario (for rule testing)
   */
  action testTaxDetermination(
    context : TaxDeterminationContext not null
  ) returns TaxDeterminationResultV2;

  /**
   * Get detailed explanation of how tax was determined
   */
  action explainTaxDetermination(
    context : TaxDeterminationContext not null
  ) returns {
    input              : TaxDeterminationContext;
    result             : TaxDeterminationResultV2;
    determinationLayer : String(30);
    layerExplanation   : String(500);
    determinationPath  : many String;
    confidenceScore    : Integer;
    ruleName           : String(100);
    warnings           : many String;
    recommendations    : many String;
  };

  // ============================================================================
  // ZIP Code Resolution
  // ============================================================================

  /**
   * Resolve ZIP code to tax jurisdiction
   */
  action resolveZipCode(
    zipCode : String(10) not null
  ) returns {
    success            : Boolean;
    matchType          : String(20);
    zipCode            : String(5);
    city               : String(100);
    county             : String(100);
    stateCode          : String(2);
    stateName          : String(50);
    taxCode            : String(4);
    jurisdictionCode   : String(15);
    jurisdictionName   : String(100);
    stateTaxRate       : Decimal(7,4);
    countyTaxRate      : Decimal(7,4);
    cityTaxRate        : Decimal(7,4);
    specialDistrictRate: Decimal(7,4);
    combinedTaxRate    : Decimal(7,4);
    warning            : String(200);
    error              : String(200);
  };

  /**
   * Batch resolve multiple ZIP codes
   */
  action batchResolveZipCodes(
    zipCodes : many String not null
  ) returns many {
    zipCode          : String(5);
    success          : Boolean;
    stateCode        : String(2);
    combinedTaxRate  : Decimal(7,4);
    taxCode          : String(4);
    jurisdictionCode : String(15);
    error            : String(200);
  };

  /**
   * Get state code from ZIP code prefix
   */
  function getStateFromZip(
    zipCode : String(10) not null
  ) returns {
    stateCode : String(2);
    valid     : Boolean;
  };

  // ============================================================================
  // Tax Admin API
  // ============================================================================

  /**
   * Tax rule data type
   */
  type TaxRuleData {
    ruleName            : String(100);
    ruleDescription     : String(500);
    ruleType            : String(30);
    priority            : Integer;
    companyCode         : String(4);
    vendorId            : String(10);
    vendorCountry       : String(3);
    vendorRegion        : String(3);
    shipFromCountry     : String(3);
    shipFromRegion      : String(3);
    shipToCountry       : String(3);
    shipToRegion        : String(3);
    materialGroup       : String(9);
    expenseType         : String(20);
    glAccount           : String(10);
    amountFrom          : Decimal(15,2);
    amountTo            : Decimal(15,2);
    determinedTaxCode   : String(4);
    determinedJurisdiction : String(15);
    determinedTaxRate   : Decimal(7,4);
    validFrom           : Date;
    validTo             : Date;
    isActive            : Boolean;
  }

  /**
   * Get all tax determination rules
   */
  function getTaxRules(
    ruleType    : String(30),
    companyCode : String(4),
    isActive    : Boolean,
    search      : String(100)
  ) returns many TaxRuleData;

  /**
   * Create a new tax determination rule
   */
  action createTaxRule(
    ruleData  : TaxRuleData not null,
    createdBy : String(50)
  ) returns {
    success : Boolean;
    ruleId  : String(36);
    errors  : many String;
  };

  /**
   * Update an existing tax determination rule
   */
  action updateTaxRule(
    ruleId    : String(36) not null,
    updates   : TaxRuleData not null,
    updatedBy : String(50)
  ) returns {
    success : Boolean;
    errors  : many String;
  };

  /**
   * Delete (deactivate) a tax determination rule
   */
  action deleteTaxRule(
    ruleId    : String(36) not null,
    deletedBy : String(50)
  ) returns {
    success : Boolean;
  };

  /**
   * Test a specific rule by ID
   */
  action testTaxRuleById(
    ruleId  : String(36) not null,
    context : TaxDeterminationContext
  ) returns {
    success     : Boolean;
    ruleMatched : Boolean;
    result      : TaxDeterminationResultV2;
  };

  /**
   * Batch test multiple scenarios
   */
  action batchTestTaxRules(
    scenarios : many TaxDeterminationContext not null
  ) returns {
    total      : Integer;
    successful : Integer;
    failed     : Integer;
    byLayer    : many {
      layer : String(30);
      count : Integer;
    };
  };

  // ============================================================================
  // US State Tax Management
  // ============================================================================

  /**
   * Get all US state tax configurations
   */
  function getUSStateTaxConfigs() returns many {
    stateCode           : String(2);
    stateName           : String(50);
    stateTaxRate        : Decimal(7,4);
    avgCombinedRate     : Decimal(7,4);
    defaultInputTaxCode : String(4);
    hasSalesTax         : Boolean;
    hasLocalTax         : Boolean;
    maxLocalTaxRate     : Decimal(7,4);
  };

  /**
   * Update US state tax rate
   */
  action updateUSStateTaxRate(
    stateCode     : String(2) not null,
    newRate       : Decimal(7,4) not null,
    effectiveDate : Date,
    updatedBy     : String(50)
  ) returns {
    success   : Boolean;
    oldRate   : Decimal(7,4);
    newRate   : Decimal(7,4);
  };

  // ============================================================================
  // Canadian Province Tax Management
  // ============================================================================

  /**
   * Get all Canadian provincial tax configurations
   */
  function getCanadianProvinceTaxConfigs() returns many {
    provinceCode        : String(2);
    provinceName        : String(50);
    taxSystem           : String(10);
    gstRate             : Decimal(7,4);
    pstRate             : Decimal(7,4);
    hstRate             : Decimal(7,4);
    qstRate             : Decimal(7,4);
    combinedRate        : Decimal(7,4);
    defaultInputTaxCode : String(4);
  };

  /**
   * Update Canadian province tax rate
   */
  action updateCanadianProvinceTaxRate(
    provinceCode  : String(2) not null,
    rateType      : String(10) not null,  // gst, pst, hst, qst
    newRate       : Decimal(7,4) not null,
    effectiveDate : Date,
    updatedBy     : String(50)
  ) returns {
    success         : Boolean;
    oldRate         : Decimal(7,4);
    newRate         : Decimal(7,4);
    newCombinedRate : Decimal(7,4);
  };

  // ============================================================================
  // Company Code Tax Configuration
  // ============================================================================

  /**
   * Get company code tax configurations
   */
  function getCompanyTaxConfigs() returns many {
    companyCode          : String(4);
    companyName          : String(100);
    countryKey           : String(3);
    defaultInputTaxCode  : String(4);
    defaultOutputTaxCode : String(4);
    useExternalTaxEngine : Boolean;
    externalEngineType   : String(20);
  };

  /**
   * Update company code tax configuration
   */
  action updateCompanyTaxConfig(
    companyCode : String(4) not null,
    updates     : {
      defaultInputTaxCode  : String(4);
      defaultOutputTaxCode : String(4);
      useExternalTaxEngine : Boolean;
      externalEngineType   : String(20);
    },
    updatedBy   : String(50)
  ) returns {
    success : Boolean;
  };

  // ============================================================================
  // Tax Data Sync
  // ============================================================================

  /**
   * Trigger full tax data sync from SAP
   */
  action triggerTaxDataSync(
    syncType    : String(20) not null,  // full, incremental, cache
    triggeredBy : String(50)
  ) returns {
    success  : Boolean;
    syncId   : String(36);
    message  : String(200);
  };

  /**
   * Get tax data sync history
   */
  function getTaxSyncHistory(
    limit : Integer default 20
  ) returns many {
    syncId           : String(36);
    syncType         : String(30);
    syncStatus       : String(20);
    startedAt        : Timestamp;
    completedAt      : Timestamp;
    recordsProcessed : Integer;
    recordsCreated   : Integer;
    recordsUpdated   : Integer;
    recordsFailed    : Integer;
    errorMessage     : String(500);
  };

  /**
   * Get scheduler status
   */
  function getTaxSchedulerStatus() returns {
    isRunning : Boolean;
    lastRun   : Timestamp;
    schedules : many {
      name    : String(50);
      type    : String(20);
      nextRun : Timestamp;
    };
  };

  // ============================================================================
  // Tax Audit Log
  // ============================================================================

  /**
   * Get tax data change history
   */
  function getTaxAuditLog(
    entityType : String(50),
    entityKey  : String(100),
    limit      : Integer default 50
  ) returns many {
    changeId   : String(36);
    entityType : String(50);
    entityKey  : String(100);
    changeType : String(20);
    changedAt  : Timestamp;
    changedBy  : String(50);
    fieldName  : String(100);
    oldValue   : String(500);
    newValue   : String(500);
  };

  // ============================================================================
  // Tax Admin Dashboard
  // ============================================================================

  /**
   * Get tax admin dashboard statistics
   */
  function getTaxAdminDashboard() returns {
    rules : {
      total  : Integer;
      byType : many {
        ruleType : String(30);
        count    : Integer;
      };
    };
    coverage : {
      usStates    : Integer;
      caProvinces : Integer;
      companies   : Integer;
    };
    recentSync : {
      syncId   : String(36);
      status   : String(20);
      syncedAt : Timestamp;
    };
    cacheStats : {
      companyConfigs : Integer;
      usStates       : Integer;
      caProvinces    : Integer;
      zipMappings    : Integer;
      adminRules     : Integer;
    };
  };

  /**
   * Refresh tax engine cache
   */
  action refreshTaxCache() returns {
    success   : Boolean;
    cacheSize : Integer;
  };

  // ============================================================================
  // External Tax Engine Integration
  // ============================================================================

  /**
   * Check external tax engine availability
   */
  function checkExternalTaxEngine(
    companyCode : String(4) not null
  ) returns {
    available  : Boolean;
    engineType : String(20);
    latency    : Integer;
    error      : String(200);
  };

  /**
   * Calculate tax using external engine (Vertex/Avalara)
   */
  action calculateTaxExternal(
    context : TaxDeterminationContext not null
  ) returns {
    success          : Boolean;
    taxCode          : String(4);
    taxRate          : Decimal(7,4);
    taxAmount        : Decimal(15,2);
    jurisdictionCode : String(15);
    engineType       : String(20);
    fromCache        : Boolean;
    error            : String(200);
  };
