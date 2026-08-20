// @ts-check
/**
 * @fileoverview Mock ECC responses for testing.
 */

const mockVendorList = [
  { VENDOR_NO: '0000001000', NAME: 'ACME Corporation' },
  { VENDOR_NO: '0000001001', NAME: 'Global Supplies Inc' },
  { VENDOR_NO: '0000001002', NAME: 'Tech Solutions GmbH' },
  { VENDOR_NO: '0000001003', NAME: 'Office Supplies Ltd' },
  { VENDOR_NO: '0000001004', NAME: 'Industrial Parts Co' }
];

const mockVendorDetail = {
  GENERALDETAIL: {
    VENDOR: '0000001000',
    NAME: 'ACME Corporation',
    NAME_2: 'Headquarters',
    CITY: 'New York',
    COUNTRY: 'US',
    POSTL_CODE: '10001'
  },
  COMPANYDETAIL: {
    PMNTTRMS: 'NT30'
  },
  RETURN: { TYPE: 'S' }
};

const mockPODetail = {
  POHEADER: {
    PO_NUMBER: '4500000001',
    CO_CODE: '1000',
    VENDOR: '0000001000',
    VEND_NAME: 'ACME Corporation',
    CURRENCY: 'USD',
    DOC_TYPE: 'NB',
    PURCH_ORG: '1000',
    PUR_GROUP: '001',
    DOC_DATE: '2024-01-15',
    PMNTTRMS: 'NT30'
  },
  POITEM: [
    {
      PO_NUMBER: '4500000001',
      PO_ITEM: '00010',
      MATERIAL: 'MAT001',
      SHORT_TEXT: 'Office Supplies - Paper',
      PLANT: '1000',
      NET_PRICE: 100.00,
      QUANTITY: 10,
      UNIT: 'EA',
      TAX_CODE: 'V1',
      ACCTASSCAT: 'K'
    },
    {
      PO_NUMBER: '4500000001',
      PO_ITEM: '00020',
      MATERIAL: 'MAT002',
      SHORT_TEXT: 'Office Supplies - Pens',
      PLANT: '1000',
      NET_PRICE: 50.00,
      QUANTITY: 20,
      UNIT: 'EA',
      TAX_CODE: 'V1',
      ACCTASSCAT: 'K'
    }
  ],
  POACCOUNT: [
    { PO_ITEM: '00010', GL_ACCOUNT: '6000100', COSTCENTER: 'CC1000' },
    { PO_ITEM: '00020', GL_ACCOUNT: '6000100', COSTCENTER: 'CC1000' }
  ],
  RETURN: { TYPE: 'S' }
};

const mockGLAccounts = {
  ACCOUNT_LIST: [
    { COMP_CODE: '1000', GL_ACCOUNT: '6000100', SHORT_TEXT: 'Office Expenses', LONG_TEXT: 'General Office Expenses' },
    { COMP_CODE: '1000', GL_ACCOUNT: '6000200', SHORT_TEXT: 'Travel Expenses', LONG_TEXT: 'Business Travel Costs' },
    { COMP_CODE: '1000', GL_ACCOUNT: '6000300', SHORT_TEXT: 'IT Equipment', LONG_TEXT: 'IT Hardware and Software' },
    { COMP_CODE: '1000', GL_ACCOUNT: '6000400', SHORT_TEXT: 'Marketing', LONG_TEXT: 'Marketing and Advertising' }
  ],
  RETURN: { TYPE: 'S' }
};

const mockCostCenters = {
  COSTCENTER_LIST: [
    { CO_AREA: '1000', COSTCENTER: 'CC1000', COCNTR_TXT: 'Administration' },
    { CO_AREA: '1000', COSTCENTER: 'CC2000', COCNTR_TXT: 'Sales Department' },
    { CO_AREA: '1000', COSTCENTER: 'CC3000', COCNTR_TXT: 'IT Department' },
    { CO_AREA: '1000', COSTCENTER: 'CC4000', COCNTR_TXT: 'Marketing' }
  ],
  RETURN: { TYPE: 'S' }
};

const mockTaxCodes = [
  { KALSM: 'TAXUS', MWSKZ: 'V1', MWART: 'V', TEXT1: 'Input Tax 7%' },
  { KALSM: 'TAXUS', MWSKZ: 'V2', MWART: 'V', TEXT1: 'Input Tax 19%' },
  { KALSM: 'TAXUS', MWSKZ: 'V0', MWART: 'A', TEXT1: 'Tax Exempt' }
];

const mockTaxJurisdictions = [
  { KALSM: 'TAXUS', TXJCD: 'NY0000000', TEXT1: 'New York State' },
  { KALSM: 'TAXUS', TXJCD: 'CA0000000', TEXT1: 'California' },
  { KALSM: 'TAXUS', TXJCD: 'TX0000000', TEXT1: 'Texas' }
];

module.exports = {
  mockVendorList,
  mockVendorDetail,
  mockPODetail,
  mockGLAccounts,
  mockCostCenters,
  mockTaxCodes,
  mockTaxJurisdictions
};
