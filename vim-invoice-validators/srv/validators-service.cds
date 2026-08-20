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
