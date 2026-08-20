using { vim.validators.cache as db } from '../../../db/schema';

/**
 * Cache for GL Account master data.
 */
entity GLAccountCache : db.cuid, db.managed {
  companyCode   : String(4) not null;
  accountNumber : String(10) not null;
  shortText     : String(20);
  longText      : String(50);
  expiresAt     : Timestamp not null;
}

/**
 * Cache for Cost Center master data.
 */
entity CostCenterCache : db.cuid, db.managed {
  controllingArea : String(4) not null;
  costCenter      : String(10) not null;
  description     : String(20);
  expiresAt       : Timestamp not null;
}

/**
 * Cache for Tax Code data.
 */
entity TaxCodeCache : db.cuid, db.managed {
  country       : String(2) not null;
  taxProcedure  : String(6) not null;
  taxCode       : String(2) not null;
  taxType       : String(1);
  description   : String(50);
  expiresAt     : Timestamp not null;
}

/**
 * Cache for Tax Jurisdiction data.
 */
entity TaxJurisdictionCache : db.cuid, db.managed {
  country          : String(2) not null;
  taxProcedure     : String(6) not null;
  jurisdictionCode : String(15) not null;
  description      : String(20);
  expiresAt        : Timestamp not null;
}
