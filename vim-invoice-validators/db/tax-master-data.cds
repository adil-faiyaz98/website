/**
 * Tax Master Data Schema - 100% Deterministic Tax Determination Engine
 * 
 * This schema provides comprehensive tax configuration for both PO-based and Non-PO 
 * based invoices with a guaranteed 5-layer fallback architecture:
 * 
 * Layer 1: PO_LINE_ITEM - Tax code from PO line item (highest priority)
 * Layer 2: ADMIN_RULES - Business rules configured by administrators
 * Layer 3: GEOGRAPHIC_DEFAULTS - State/Province/ZIP based tax codes
 * Layer 4: PLANT_DEFAULT - Plant-level default tax code
 * Layer 5: COMPANY_DEFAULT - Company code default (MANDATORY - guaranteed fallback)
 * 
 * Supports: US (50 states + DC), Canada (13 provinces/territories), Cross-border
 * External Integration Ready: Vertex, Avalara hooks
 */

namespace vim.tax;

using { cuid, managed } from '@sap/cds/common';

// ============================================================================
// CORE TAX CODE CONFIGURATION
// ============================================================================

/**
 * Master tax code repository - all valid tax codes in the system
 * Replicated from SAP T007A with additional metadata for determination
 */
entity TaxCodes : cuid, managed {
    taxCode             : String(2) not null;           // SAP Tax Code (e.g., V0, V1, I1)
    countryKey          : String(3) not null;           // Country (US, CA, DE, etc.)
    description         : String(100);                  // Human readable description
    taxType             : String(20);                   // INPUT, OUTPUT, EXEMPT, ZERO_RATED
    taxRate             : Decimal(7, 4);                // Combined rate as decimal (0.0825 = 8.25%)
    isInputTax          : Boolean default true;         // True for AP (input/purchase tax)
    isOutputTax         : Boolean default false;        // True for AR (sales tax)
    isExempt            : Boolean default false;        // True for exempt transactions
    isZeroRated         : Boolean default false;        // True for zero-rated (still reported)
    isReverseCharge     : Boolean default false;        // True for reverse charge mechanism
    jurisdictionCode    : String(15);                   // Tax jurisdiction code
    validFrom           : Date;                         // Effective start date
    validTo             : Date;                         // Effective end date
    isActive            : Boolean default true;         // Soft delete flag
    sapTaxCodeId        : String(50);                   // Reference to SAP T007A.MWSKZ
    
    // Composite uniqueness
    key companyCode     : String(4);
}

// ============================================================================
// US TAX CONFIGURATION
// ============================================================================

/**
 * US State-level tax configuration
 * Comprehensive coverage for all 50 states + DC + territories
 */
entity USStateTaxConfiguration : cuid, managed {
    stateCode           : String(2) not null;           // ISO 3166-2 (CA, NY, TX, etc.)
    stateName           : String(50) not null;          // Full state name
    stateTaxRate        : Decimal(7, 4) not null;       // State sales tax rate
    hasLocalTax         : Boolean default false;        // Does state have local taxes?
    maxLocalTaxRate     : Decimal(7, 4) default 0;      // Maximum local tax rate
    avgCombinedRate     : Decimal(7, 4);                // Average combined state+local rate
    defaultInputTaxCode : String(2) not null;           // Default tax code for this state
    defaultJurisdiction : String(15);                   // Default jurisdiction code
    hasSalesTax         : Boolean default true;         // False for OR, MT, NH, DE, AK
    hasUseTax           : Boolean default true;         // Use tax applicable
    taxHolidays         : Boolean default false;        // Has tax holiday periods
    effectiveFrom       : Date;                         // Rate effective date
    effectiveTo         : Date;                         // Rate expiry date
    isActive            : Boolean default true;
    notes               : String(500);                  // Additional notes/rules
    
    // Links to ZIP code mappings
    zipCodeMappings     : Composition of many USZipCodeTaxMapping on zipCodeMappings.state = $self;
}

/**
 * US ZIP Code to Tax Jurisdiction Mapping
 * Enables precise tax determination for major metropolitan areas
 * Falls back to state average for unmapped ZIP codes
 */
entity USZipCodeTaxMapping : cuid, managed {
    zipCode             : String(5) not null;           // 5-digit ZIP code
    zipCodeRange        : String(11);                   // ZIP range (e.g., "90001-90899")
    city                : String(100);                  // City name
    county              : String(100);                  // County name
    state               : Association to USStateTaxConfiguration;
    stateTaxRate        : Decimal(7, 4) not null;       // State portion
    countyTaxRate       : Decimal(7, 4) default 0;      // County portion
    cityTaxRate         : Decimal(7, 4) default 0;      // City portion
    specialDistrictRate : Decimal(7, 4) default 0;      // Special district taxes
    combinedTaxRate     : Decimal(7, 4) not null;       // Total combined rate
    taxCode             : String(2) not null;           // Mapped SAP tax code
    jurisdictionCode    : String(15) not null;          // Full jurisdiction code
    jurisdictionName    : String(100);                  // Jurisdiction description
    effectiveFrom       : Date;
    effectiveTo         : Date;
    isActive            : Boolean default true;
    dataSource          : String(50);                   // TAX_FOUNDATION, VERTEX, AVALARA, MANUAL
    lastVerified        : Timestamp;                    // Last verification date
}

// ============================================================================
// CANADIAN TAX CONFIGURATION
// ============================================================================

/**
 * Canadian Provincial/Territorial Tax Configuration
 * Handles complex HST/GST/PST/QST structure
 */
entity CanadianProvincialTaxConfiguration : cuid, managed {
    provinceCode        : String(2) not null;           // ISO 3166-2:CA (ON, BC, QC, etc.)
    provinceName        : String(50) not null;          // Full province name
    taxSystem           : String(10) not null;          // HST, GST_PST, GST_QST, GST_ONLY
    gstRate             : Decimal(7, 4) not null;       // Federal GST rate (5%)
    pstRate             : Decimal(7, 4) default 0;      // Provincial PST rate
    hstRate             : Decimal(7, 4) default 0;      // Harmonized HST rate (if applicable)
    qstRate             : Decimal(7, 4) default 0;      // Quebec QST rate (if applicable)
    combinedRate        : Decimal(7, 4) not null;       // Total combined rate
    defaultInputTaxCode : String(2) not null;           // Default tax code
    gstTaxCode          : String(2);                    // Tax code for GST portion
    pstTaxCode          : String(2);                    // Tax code for PST portion
    hstTaxCode          : String(2);                    // Tax code for HST
    qstTaxCode          : String(2);                    // Tax code for QST
    defaultJurisdiction : String(15);                   // Default jurisdiction
    pstExemptCategories : String(500);                  // Categories exempt from PST
    effectiveFrom       : Date;
    effectiveTo         : Date;
    isActive            : Boolean default true;
    notes               : String(500);
}

// ============================================================================
// COMPANY CODE TAX CONFIGURATION
// ============================================================================

/**
 * Company Code Tax Configuration
 * CRITICAL: defaultInputTaxCode is MANDATORY - this guarantees 100% determinism
 * by ensuring there is ALWAYS a valid fallback tax code
 */
entity CompanyCodeTaxConfiguration : cuid, managed {
    companyCode         : String(4) not null;           // SAP Company Code
    companyName         : String(100);                  // Company name
    countryKey          : String(3) not null;           // Country of company
    
    // MANDATORY DEFAULT - Guarantees 100% determinism
    defaultInputTaxCode : String(2) not null;           // MANDATORY: Ultimate fallback tax code
    defaultOutputTaxCode: String(2);                    // Default for AR transactions
    defaultExemptCode   : String(2);                    // Default for exempt transactions
    defaultZeroRatedCode: String(2);                    // Default for zero-rated
    
    defaultJurisdiction : String(15);                   // Default tax jurisdiction
    taxCalculationProc  : String(6);                    // SAP Tax Calculation Procedure (TAXUS, TAXCA)
    
    // Company-level settings
    useExternalTaxEngine: Boolean default false;        // Use Vertex/Avalara
    externalEngineType  : String(20);                   // VERTEX, AVALARA, CUSTOM
    
    // Thresholds
    smallInvoiceThreshold: Decimal(15, 2) default 0;    // Skip tax calc below this
    taxTolerancePercent : Decimal(5, 2) default 1.0;    // Acceptable tax variance %
    taxToleranceAmount  : Decimal(15, 2) default 10.0;  // Acceptable tax variance amount
    
    isActive            : Boolean default true;
    
    // Link to plant defaults
    plantDefaults       : Composition of many PlantTaxConfiguration on plantDefaults.companyCode = $self;
}

/**
 * Plant-level Tax Configuration
 * Layer 4 fallback - between geographic defaults and company default
 */
entity PlantTaxConfiguration : cuid, managed {
    plantCode           : String(4) not null;           // SAP Plant Code
    plantName           : String(100);
    companyCode         : Association to CompanyCodeTaxConfiguration;
    countryKey          : String(3);                    // Plant country
    region              : String(3);                    // State/Province
    defaultInputTaxCode : String(2) not null;           // Plant default tax code
    defaultJurisdiction : String(15);
    taxableByDefault    : Boolean default true;
    isActive            : Boolean default true;
}

// ============================================================================
// TAX DETERMINATION RULES ENGINE
// ============================================================================

/**
 * Tax Determination Rules - Admin-configurable business rules
 * Layer 2 in the fallback hierarchy
 * Supports complex multi-condition rules with priority ordering
 */
entity TaxDeterminationRules : cuid, managed {
    ruleName            : String(100) not null;         // Human readable rule name
    ruleDescription     : String(500);                  // Detailed description
    ruleType            : String(30) not null;          // PO_BASED, NON_PO, CROSS_BORDER, EXEMPT, REVERSE_CHARGE
    priority            : Integer not null default 100; // Lower = higher priority
    
    // Matching Conditions (all conditions must match for rule to apply)
    companyCode         : String(4);                    // NULL = all company codes
    vendorId            : String(10);                   // Specific vendor
    vendorCountry       : String(3);                    // Vendor country
    vendorRegion        : String(3);                    // Vendor state/province
    vendorTaxId         : String(20);                   // Specific tax ID pattern
    
    shipFromCountry     : String(3);                    // Origin country
    shipFromRegion      : String(3);                    // Origin state/province
    shipToCountry       : String(3);                    // Destination country
    shipToRegion        : String(3);                    // Destination state/province
    
    materialGroup       : String(9);                    // Material group
    productCategory     : String(20);                   // Product category
    expenseType         : String(20);                   // Expense type (for Non-PO)
    glAccount           : String(10);                   // G/L Account
    costCenter          : String(10);                   // Cost center
    
    invoiceType         : String(4);                    // Invoice type
    documentType        : String(4);                    // Document type
    
    amountFrom          : Decimal(15, 2);               // Amount range start
    amountTo            : Decimal(15, 2);               // Amount range end
    currency            : String(3);                    // Currency for amount check
    
    // Rule Output - What tax treatment to apply
    determinedTaxCode   : String(2) not null;           // Tax code to use
    determinedJurisdiction: String(15);                 // Jurisdiction to use
    determinedTaxRate   : Decimal(7, 4);                // Override rate (if any)
    taxExemptReason     : String(100);                  // Exemption reason if applicable
    
    // Rule metadata
    validFrom           : Date not null;
    validTo             : Date;
    isActive            : Boolean default true;
    requiresApproval    : Boolean default false;        // Flag for manual review
    createdBy           : String(50);
    approvedBy          : String(50);
    approvalDate        : Timestamp;
    
    // Audit trail
    lastMatchedAt       : Timestamp;                    // Last time rule was used
    matchCount          : Integer default 0;            // Times rule has matched
}

// ============================================================================
// VENDOR TAX PROFILE
// ============================================================================

/**
 * Vendor Tax Profile - Vendor-specific tax settings
 * Used for vendor-based tax determination and exemption handling
 */
entity VendorTaxProfile : cuid, managed {
    vendorId            : String(10) not null;          // SAP Vendor ID
    vendorName          : String(100);
    countryKey          : String(3);                    // Vendor country
    region              : String(3);                    // Vendor state/province
    
    // Tax identification
    taxIdNumber         : String(20);                   // Tax ID / VAT number
    taxIdType           : String(10);                   // EIN, VAT, GST, etc.
    taxIdVerified       : Boolean default false;
    taxIdVerifiedDate   : Timestamp;
    
    // Vendor tax status
    taxStatus           : String(20) default 'TAXABLE'; // TAXABLE, EXEMPT, ZERO_RATED
    exemptionCertificate: String(50);                   // Exemption cert number
    exemptionExpiry     : Date;                         // Cert expiry date
    exemptionReason     : String(100);
    
    // Default tax codes for this vendor
    defaultInputTaxCode : String(2);                    // Default when buying from this vendor
    withholdingTaxCode  : String(2);                    // Withholding tax if applicable
    
    // Cross-border settings
    isForeignVendor     : Boolean default false;
    foreignVendorType   : String(20);                   // INTERNATIONAL, TREATY_COUNTRY
    treatyCountry       : Boolean default false;        // Has tax treaty
    withholdingRate     : Decimal(5, 2);                // Withholding %
    
    isActive            : Boolean default true;
}

// ============================================================================
// G/L ACCOUNT TAX MAPPING
// ============================================================================

/**
 * G/L Account to Tax Code Mapping
 * For Non-PO invoices - determine tax by G/L account
 */
entity GLAccountTaxMapping : cuid, managed {
    glAccount           : String(10) not null;          // G/L Account number
    glAccountName       : String(100);
    companyCode         : String(4);                    // NULL = all company codes
    
    // Tax mapping
    defaultTaxCode      : String(2) not null;           // Default tax code for this G/L
    taxCategory         : String(20);                   // GOODS, SERVICES, CAPITAL, EXPENSE
    isCapitalExpense    : Boolean default false;
    isTaxable           : Boolean default true;
    
    // Special handling
    alwaysExempt        : Boolean default false;        // Always tax exempt
    requiresJurisdiction: Boolean default false;        // Needs jurisdiction for determination
    
    effectiveFrom       : Date;
    effectiveTo         : Date;
    isActive            : Boolean default true;
}

// ============================================================================
// CROSS-BORDER TAX RULES
// ============================================================================

/**
 * Cross-Border Tax Configuration
 * Handles international transactions, import duties, and reverse charge
 */
entity CrossBorderTaxRules : cuid, managed {
    ruleName            : String(100) not null;
    originCountry       : String(3) not null;           // From country
    destinationCountry  : String(3) not null;           // To country
    
    // Tax treatment
    taxTreatment        : String(30) not null;          // STANDARD, REVERSE_CHARGE, EXEMPT, ZERO_RATED
    importDutyApplicable: Boolean default false;
    vatApplicable       : Boolean default true;
    
    // Determined codes
    determinedTaxCode   : String(2) not null;
    determinedRate      : Decimal(7, 4);
    jurisdictionCode    : String(15);
    
    // Reverse charge
    reverseChargeApplicable: Boolean default false;
    reverseChargeTaxCode: String(2);
    
    // Treaty information
    hasTaxTreaty        : Boolean default false;
    treatyRate          : Decimal(5, 2);                // Reduced treaty rate
    
    priority            : Integer default 100;
    validFrom           : Date;
    validTo             : Date;
    isActive            : Boolean default true;
}

// ============================================================================
// EXPENSE CATEGORY TAX RULES
// ============================================================================

/**
 * Expense Category Tax Configuration
 * For Non-PO invoices - tax determination by expense category
 */
entity ExpenseCategoryTaxRules : cuid, managed {
    categoryCode        : String(20) not null;          // TRAVEL, MEALS, SUPPLIES, SERVICES, etc.
    categoryName        : String(100);
    description         : String(500);
    
    // Geographic scope
    companyCode         : String(4);                    // NULL = all
    countryKey          : String(3);                    // NULL = all
    region              : String(3);                    // State/Province
    
    // Tax determination
    defaultTaxCode      : String(2) not null;
    taxRate             : Decimal(7, 4);
    jurisdictionCode    : String(15);
    
    // Special rules
    partiallyDeductible : Boolean default false;        // Partial deduction (e.g., meals)
    deductiblePercent   : Decimal(5, 2) default 100;    // % that's deductible
    exemptionAllowed    : Boolean default false;
    maxExemptAmount     : Decimal(15, 2);               // Max exempt amount
    
    // Linked G/L accounts
    linkedGLAccounts    : String(200);                  // Comma-separated G/L accounts
    
    priority            : Integer default 100;
    validFrom           : Date;
    validTo             : Date;
    isActive            : Boolean default true;
}

// ============================================================================
// EXTERNAL TAX ENGINE INTEGRATION
// ============================================================================

/**
 * External Tax Engine Configuration
 * Ready for Vertex, Avalara, or custom tax engine integration
 */
entity ExternalTaxEngineConfig : cuid, managed {
    engineType          : String(20) not null;          // VERTEX, AVALARA, CUSTOM
    engineName          : String(100);
    companyCode         : String(4);                    // NULL = all company codes
    
    // Connection settings
    endpointUrl         : String(500);                  // API endpoint
    apiVersion          : String(20);                   // API version
    authType            : String(20);                   // BASIC, OAUTH, API_KEY
    // Note: Credentials stored in secure vault, not here
    credentialVaultKey  : String(100);                  // Key to retrieve credentials
    
    // Engine behavior
    isEnabled           : Boolean default false;
    isPrimary           : Boolean default false;        // Primary vs fallback
    timeoutSeconds      : Integer default 30;
    retryAttempts       : Integer default 3;
    
    // Fallback behavior
    fallbackToInternal  : Boolean default true;         // Use internal engine if external fails
    cacheResults        : Boolean default true;         // Cache external results
    cacheDurationMinutes: Integer default 60;
    
    // Supported operations
    supportsCalculation : Boolean default true;         // Tax calculation
    supportsValidation  : Boolean default true;         // Address validation
    supportsExemption   : Boolean default false;        // Exemption certificate mgmt
    
    isActive            : Boolean default true;
}

// ============================================================================
// TAX DATA SYNCHRONIZATION
// ============================================================================

/**
 * Tax Data Sync Log - Track data synchronization status
 * Ensures tax data stays current
 */
entity TaxDataSyncLog : cuid, managed {
    syncType            : String(30) not null;          // SAP_TAX_CODES, US_RATES, CA_RATES, JURISDICTION, FULL
    syncSource          : String(50) not null;          // SAP, TAX_FOUNDATION, VERTEX, AVALARA, MANUAL
    syncStatus          : String(20) not null;          // STARTED, IN_PROGRESS, COMPLETED, FAILED
    
    startedAt           : Timestamp not null;
    completedAt         : Timestamp;
    
    recordsProcessed    : Integer default 0;
    recordsCreated      : Integer default 0;
    recordsUpdated      : Integer default 0;
    recordsFailed       : Integer default 0;
    
    errorMessage        : LargeString;
    errorDetails        : LargeString;
    
    triggeredBy         : String(50);                   // USER, SCHEDULER, API
    triggeredByUser     : String(50);
    
    // Sync details
    companyCodesAffected: String(100);                  // Affected company codes
    entitiesAffected    : String(200);                  // Affected entity types
}

/**
 * Tax Data Change History - Audit trail for tax data changes
 */
entity TaxDataChangeHistory : cuid, managed {
    entityType          : String(50) not null;          // Entity that was changed
    entityKey           : String(100) not null;         // Primary key of changed record
    changeType          : String(20) not null;          // CREATE, UPDATE, DELETE
    
    changedAt           : Timestamp not null;
    changedBy           : String(50);
    
    fieldName           : String(100);                  // Field that changed
    oldValue            : String(500);                  // Previous value
    newValue            : String(500);                  // New value
    
    changeReason        : String(200);                  // Reason for change
    approvedBy          : String(50);                   // If approval required
    syncLogId           : UUID;                         // Link to sync log if from sync
}

// ============================================================================
// TAX DETERMINATION AUDIT LOG
// ============================================================================

/**
 * Tax Determination Result Log - Complete audit trail
 * Records every tax determination for compliance and debugging
 */
entity TaxDeterminationLog : cuid, managed {
    // Invoice reference
    invoiceId           : String(50);
    invoiceNumber       : String(35);
    invoiceLineItem     : Integer;
    
    // Determination context
    determinationType   : String(20) not null;          // PO_BASED, NON_PO
    companyCode         : String(4);
    vendorId            : String(10);
    
    // Input data snapshot
    poNumber            : String(10);
    poLineItem          : Integer;
    shipFromCountry     : String(3);
    shipFromRegion      : String(3);
    shipToCountry       : String(3);
    shipToRegion        : String(3);
    materialGroup       : String(9);
    glAccount           : String(10);
    expenseCategory     : String(20);
    
    grossAmount         : Decimal(15, 2);
    currency            : String(3);
    
    // Determination result
    determinedTaxCode   : String(2) not null;
    determinedRate      : Decimal(7, 4);
    determinedTaxAmount : Decimal(15, 2);
    jurisdictionCode    : String(15);
    
    // Determination path
    determinationLayer  : String(30) not null;          // PO_LINE_ITEM, ADMIN_RULES, GEOGRAPHIC, PLANT, COMPANY
    ruleId              : UUID;                         // If ADMIN_RULES layer
    ruleName            : String(100);
    
    // Processing details
    determinedAt        : Timestamp not null;
    processingTimeMs    : Integer;                      // Performance tracking
    externalEngineUsed  : Boolean default false;
    externalEngineType  : String(20);
    
    // Confidence and flags
    confidenceScore     : Integer default 100;          // 0-100 confidence
    requiresReview      : Boolean default false;
    reviewReason        : String(200);
}

// ============================================================================
// VIEWS FOR COMMON QUERIES
// ============================================================================

/**
 * Active US Tax Rates View
 * Quick access to current US tax rates
 */
view ActiveUSRates as select from USStateTaxConfiguration {
    stateCode,
    stateName,
    stateTaxRate,
    avgCombinedRate,
    defaultInputTaxCode,
    defaultJurisdiction,
    hasSalesTax
} where isActive = true and (effectiveTo is null or effectiveTo >= $now);

/**
 * Active Canadian Tax Rates View
 */
view ActiveCanadianRates as select from CanadianProvincialTaxConfiguration {
    provinceCode,
    provinceName,
    taxSystem,
    gstRate,
    pstRate,
    hstRate,
    qstRate,
    combinedRate,
    defaultInputTaxCode
} where isActive = true and (effectiveTo is null or effectiveTo >= $now);

/**
 * Active Tax Rules View
 */
view ActiveTaxRules as select from TaxDeterminationRules {
    *
} where isActive = true 
  and validFrom <= $now 
  and (validTo is null or validTo >= $now)
order by priority asc;
