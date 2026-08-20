namespace vim.validators.cache;

using { cuid, managed } from '@sap/cds/common';

/**
 * Cache for vendor master data lookups.
 * Reduces calls to ECC by storing recently retrieved vendors.
 */
entity VendorCache : cuid, managed {
  companyCode   : String(4) not null;
  vendorId      : String(10) not null;
  vendorName    : String(35);
  vendorName2   : String(35);
  city          : String(35);
  country       : String(3);
  postalCode    : String(10);
  paymentTerms  : String(4);
  expiresAt     : Timestamp not null;
}

/**
 * Cache for Purchase Order headers.
 */
entity POHeaderCache : cuid, managed {
  poNumber      : String(10) not null;
  companyCode   : String(4);
  vendorId      : String(10);
  vendorName    : String(35);
  currency      : String(5);
  docType       : String(4);
  purchaseOrg   : String(4);
  purchaseGroup : String(3);
  docDate       : Date;
  paymentTerms  : String(4);
  expiresAt     : Timestamp not null;
}

/**
 * Cache for Purchase Order line items.
 */
entity POItemCache : cuid, managed {
  poNumber      : String(10) not null;
  poItem        : String(5) not null;
  material      : String(18);
  shortText     : String(40);
  plant         : String(4);
  netPrice      : Decimal(15,2);
  quantity      : Decimal(13,3);
  unit          : String(3);
  taxCode       : String(2);
  glAccount     : String(10);
  costCenter    : String(10);
  expiresAt     : Timestamp not null;
}
