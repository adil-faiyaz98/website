namespace vim.validators.tax;

using { cuid, managed } from '@sap/cds/common';

// ============================================================================
// TAX DETERMINATION RULES CONFIGURATION
// ============================================================================

/**
 * Tax Determination Rules - Main configuration table
 * Determines tax code and jurisdiction based on ship-to province rules.
 * Rules are evaluated in order of priority (lower number = higher priority).
 * 
 * Key Logic:
 * - For PO invoices: Use plant address (ship-to) for tax determination
 * - For Non-PO invoices: Use company code address or vendor-derived receiver address
 */
entity TaxDeterminationRules : cuid, managed {
  /** Rule name/identifier for easy reference */
  ruleName            : String(50) not null;
  
  /** Priority for rule evaluation (1 = highest priority) */
  priority            : Integer default 100;
  
  /** Whether rule is active */
  isActive            : Boolean default true;
  
  // ========== MATCHING CRITERIA ==========
  
  /** Company Code - specific or '*' for all */
  companyCode         : String(4) default '*';
  
  /** Vendor ID - specific vendor or '*' for all (highest priority match) */
  vendorId            : String(10) default '*';
  
  /** Sender Country (Ship-from / Vendor Country) - 2-letter ISO */
  senderCountry       : String(3) default '*';
  
  /** Receiver Country (Ship-to Country) - 2-letter ISO */
  receiverCountry     : String(3) not null;
  
  /** Receiver Province/Region/State (Ship-to Province) - SAP Region code */
  receiverProvince    : String(3) default '*';
  
  /** Postal Code pattern (supports wildcards: 'M5V*', '90210') */
  postalCodePattern   : String(10) default '*';
  
  /** Transaction Type: 'PURCHASE', 'SERVICE', 'ASSET', '*' */
  transactionType     : String(15) default '*';
  
  /** Document Type: 'PO', 'NONPO', '*' */
  documentType        : String(10) default '*';
  
  /** Material Group (for item-specific rules) */
  materialGroup       : String(9) default '*';
  
  /** Vendor Account Group (for vendor-specific tax treatment) */
  vendorAccountGroup  : String(4) default '*';
  
  /** Expense Type (for non-PO: TRAVEL, UTILITIES, etc.) */
  expenseType         : String(30) default '*';
  
  // ========== TAX OUTPUT ==========
  
  /** Tax Code to apply */
  taxCode             : String(2) not null;
  
  /** Tax Jurisdiction Code */
  taxJurisdiction     : String(15);
  
  /** Tax Rate Percentage (for reference/display) */
  taxRatePercent      : Decimal(5,2);
  
  /** Tax Description */
  taxDescription      : String(50);
  
  /** Whether tax amount should be calculated */
  calculateTaxAmount  : Boolean default true;
  
  // ========== ADDITIONAL SETTINGS ==========
  
  /** GL Account for tax (override) */
  taxGLAccount        : String(10);
  
  /** Whether this is a reverse charge scenario */
  isReverseCharge     : Boolean default false;
  
  /** Whether vendor is tax exempt */
  isTaxExempt         : Boolean default false;
  
  /** Exemption certificate required */
  exemptionRequired   : Boolean default false;
  
  /** Effective date range start */
  validFrom           : Date;
  
  /** Effective date range end */
  validTo             : Date;
  
  /** Notes/comments for rule */
  notes               : String(255);
}

/**
 * Canadian Provincial Tax Rates Reference Table
 * GST/HST/PST/QST rates by province - used for validation and calculation
 */
entity CanadianProvincialTaxRates : cuid, managed {
  /** Province Code (2-letter) */
  provinceCode        : String(3) not null;
  
  /** Province Name */
  provinceName        : String(50) not null;
  
  /** GST Rate (Federal - 5% as of 2024) */
  gstRate             : Decimal(5,3) default 5.000;
  
  /** PST Rate (Provincial Sales Tax) */
  pstRate             : Decimal(5,3) default 0.000;
  
  /** HST Rate (Harmonized - combines GST+PST) */
  hstRate             : Decimal(5,3) default 0.000;
  
  /** QST Rate (Quebec Sales Tax) */
  qstRate             : Decimal(5,3) default 0.000;
  
  /** Whether province uses HST (harmonized) */
  usesHST             : Boolean default false;
  
  /** Total Combined Tax Rate */
  totalRate           : Decimal(5,3) not null;
  
  /** SAP Tax Code for GST only */
  gstTaxCode          : String(2);
  
  /** SAP Tax Code for HST */
  hstTaxCode          : String(2);
  
  /** SAP Tax Code for PST (input - may not be recoverable) */
  pstTaxCode          : String(2);
  
  /** SAP Tax Code for QST */
  qstTaxCode          : String(2);
  
  /** SAP Tax Code for combined GST+PST */
  combinedTaxCode     : String(2);
  
  /** Tax Jurisdiction Code pattern for province */
  jurisdictionPattern : String(15);
  
  /** Effective from date */
  validFrom           : Date;
  
  /** Effective to date */
  validTo             : Date;
  
  /** Is PST recoverable on inputs? */
  pstRecoverable      : Boolean default false;
}

/**
 * US State Tax Configuration
 * Sales/Use tax by state with jurisdiction patterns
 */
entity USStateTaxRates : cuid, managed {
  /** State Code (2-letter) */
  stateCode           : String(2) not null;
  
  /** State Name */
  stateName           : String(50) not null;
  
  /** State Sales Tax Rate */
  stateTaxRate        : Decimal(5,3) default 0.000;
  
  /** Whether state has sales tax */
  hasSalesTax         : Boolean default true;
  
  /** Whether state uses origin-based taxation */
  isOriginBased       : Boolean default false;
  
  /** Default SAP Tax Code for state */
  defaultTaxCode      : String(2);
  
  /** Tax Jurisdiction Code pattern (e.g., 'CA0000000') */
  jurisdictionPattern : String(15);
  
  /** ZIP code range start */
  zipRangeStart       : String(5);
  
  /** ZIP code range end */
  zipRangeEnd         : String(5);
  
  /** Effective dates */
  validFrom           : Date;
  validTo             : Date;
}

/**
 * Plant Tax Configuration
 * Maps plants to their ship-to address tax information
 */
entity PlantTaxConfiguration : cuid, managed {
  /** Plant code */
  plant               : String(4) not null;
  
  /** Plant name */
  plantName           : String(30);
  
  /** Company code owning the plant */
  companyCode         : String(4) not null;
  
  /** Ship-to country */
  country             : String(3) not null;
  
  /** Ship-to region/province/state */
  region              : String(3);
  
  /** Ship-to city */
  city                : String(35);
  
  /** Ship-to postal code */
  postalCode          : String(10);
  
  /** Tax Jurisdiction Code for this plant */
  taxJurisdiction     : String(15);
  
  /** Default Tax Code for purchases to this plant */
  defaultTaxCode      : String(2);
  
  /** Whether plant is in a tax-free zone */
  isTaxFreeZone       : Boolean default false;
  
  /** Last synced from SAP */
  lastSyncedAt        : Timestamp;
}

/**
 * Vendor Tax Profile
 * Stores vendor-specific tax configuration and exemptions
 */
entity VendorTaxProfile : cuid, managed {
  /** Vendor ID */
  vendorId            : String(10) not null;
  
  /** Company Code (vendor may have different settings per company) */
  companyCode         : String(4) not null;
  
  /** Vendor Name (cached) */
  vendorName          : String(35);
  
  /** Vendor Country */
  vendorCountry       : String(3);
  
  /** Vendor Region/State */
  vendorRegion        : String(3);
  
  /** Vendor Account Group */
  accountGroup        : String(4);
  
  /** Whether vendor is tax exempt */
  isTaxExempt         : Boolean default false;
  
  /** Tax Exemption Certificate Number */
  exemptionCertNumber : String(30);
  
  /** Exemption valid from */
  exemptionValidFrom  : Date;
  
  /** Exemption valid to */
  exemptionValidTo    : Date;
  
  /** Default Tax Code for this vendor */
  defaultTaxCode      : String(2);

  /** Default Tax Jurisdiction (single-location vendors only; required for jurisdiction-based company codes) */
  defaultTaxJurisdiction : String(15);

  /** Withholding Tax applicable */
  withholdingTaxApplicable : Boolean default false;
  
  /** Withholding Tax Code */
  withholdingTaxCode  : String(2);
  
  /** VAT Registration Number */
  vatRegistrationNo   : String(20);
  
  /** GST/HST Registration Number (Canada) */
  gstRegistrationNo   : String(15);
  
  /** Last synced from SAP */
  lastSyncedAt        : Timestamp;
}

/**
 * Company Code Tax Settings
 * Company-specific tax configuration
 */
entity CompanyCodeTaxSettings : cuid, managed {
  /** Company Code */
  companyCode         : String(4) not null;
  
  /** Company Name */
  companyName         : String(25);
  
  /** Company Country */
  country             : String(3) not null;
  
  /** Company Region/State */
  region              : String(3);
  
  /** Company City */
  city                : String(35);
  
  /** Company Postal Code */
  postalCode          : String(10);
  
  /** Tax Procedure (TAXCA, TAXUS, etc.) */
  taxProcedure        : String(6);
  
  /** Default Tax Jurisdiction */
  defaultTaxJurisdiction : String(15);
  
  /** VAT Registration Number */
  vatRegistrationNo   : String(20);
  
  /** GST Registration Number */
  gstRegistrationNo   : String(15);
  
  /** Default Input Tax Code */
  defaultInputTaxCode : String(2);
  
  /** Default Output Tax Code */
  defaultOutputTaxCode : String(2);
  
  /** Controlling Area */
  controllingArea     : String(4);
  
  /** Last synced from SAP */
  lastSyncedAt        : Timestamp;
}

/**
 * Tax Code Master Cache
 * Caches tax codes fetched from SAP for quick lookup
 */
entity TaxCodeCache : cuid, managed {
  /** Tax Procedure */
  taxProcedure        : String(6) not null;
  
  /** Tax Code */
  taxCode             : String(2) not null;
  
  /** Country */
  country             : String(3) not null;
  
  /** Tax Type (V=Input, A=Output) */
  taxType             : String(1);
  
  /** Description */
  description         : String(50);
  
  /** Tax Rate (percentage) */
  taxRate             : Decimal(5,3);
  
  /** Is Active */
  isActive            : Boolean default true;
  
  /** Expires at (for cache refresh) */
  expiresAt           : Timestamp;
}

/**
 * Tax Jurisdiction Cache
 * Caches jurisdictions from SAP
 */
entity TaxJurisdictionCache : cuid, managed {
  /** Tax Procedure */
  taxProcedure        : String(6) not null;
  
  /** Jurisdiction Code */
  jurisdictionCode    : String(15) not null;
  
  /** Country */
  country             : String(3) not null;
  
  /** Description */
  description         : String(20);
  
  /** Expires at */
  expiresAt           : Timestamp;
}

/**
 * Tax Determination Audit Log
 * Tracks tax determination decisions for compliance
 */
entity TaxDeterminationAuditLog : cuid, managed {
  /** Invoice/Document Reference */
  documentReference   : String(50) not null;
  
  /** Document Type (PO/NONPO) */
  documentType        : String(10);
  
  /** Line Item Number (0 for header) */
  lineItemNumber      : Integer default 0;
  
  /** Rule ID that was applied */
  appliedRuleId       : String(36);
  
  /** Rule Name */
  appliedRuleName     : String(50);
  
  /** Input: Company Code */
  inputCompanyCode    : String(4);
  
  /** Input: Vendor ID */
  inputVendorId       : String(10);
  
  /** Input: Sender Country */
  inputSenderCountry  : String(3);
  
  /** Input: Receiver Country */
  inputReceiverCountry : String(3);
  
  /** Input: Receiver Province */
  inputReceiverProvince : String(3);
  
  /** Input: Plant */
  inputPlant          : String(4);
  
  /** Input: Material Group */
  inputMaterialGroup  : String(9);
  
  /** Input: Net Amount */
  inputNetAmount      : Decimal(15,2);
  
  /** Output: Tax Code */
  outputTaxCode       : String(2);
  
  /** Output: Tax Jurisdiction */
  outputTaxJurisdiction : String(15);
  
  /** Output: Tax Amount */
  outputTaxAmount     : Decimal(15,2);
  
  /** Output: Tax Rate Applied */
  outputTaxRate       : Decimal(5,3);
  
  /** Determination Method */
  determinationMethod : String(30);
  
  /** Confidence Score (0-1) */
  confidenceScore     : Decimal(3,2);
  
  /** Processing Timestamp */
  processedAt         : Timestamp not null;
  
  /** Any warnings or notes */
  notes               : String(500);
}

// ============================================================================
// VIEWS FOR COMMON QUERIES
// ============================================================================

/**
 * Active Tax Rules View - only active and currently valid rules
 */
view ActiveTaxRules as select from TaxDeterminationRules {
  *
} where isActive = true 
  and (validFrom is null or validFrom <= $now)
  and (validTo is null or validTo >= $now)
order by priority asc;

/**
 * Canadian Tax Summary View
 */
view CanadianTaxSummary as select from CanadianProvincialTaxRates {
  provinceCode,
  provinceName,
  usesHST,
  case when usesHST = true then hstRate else gstRate + pstRate end as effectiveRate : Decimal(5,3),
  case when usesHST = true then hstTaxCode else combinedTaxCode end as primaryTaxCode : String(2),
  jurisdictionPattern
} where (validTo is null or validTo >= $now);
