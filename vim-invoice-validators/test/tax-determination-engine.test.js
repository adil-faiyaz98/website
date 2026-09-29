/**
 * Tax Determination Engine - deterministic, fail-closed PO and Non-PO paths
 * (@sap/cds and ECC BAPIs are mocked).
 *
 * @module test/tax-determination-engine.test
 */

'use strict';

const mockEcc = {
  getPODetail1: jest.fn(),
  getVendorDetail: jest.fn(),
  getCompanyCodeDetail: jest.fn(),
  getTaxCodes: jest.fn(),
  getTaxJurisdictions: jest.fn(),
  calculateTaxFromNet: jest.fn(),
  calculateTaxFromNetStd: jest.fn()
};
const tables = {};
const ecc = mockEcc;
const mockDb = {
  run: jest.fn(async q => {
    const rows = (tables[q.entity] || []).filter(r =>
      Object.entries(q.where || {}).every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)));
    return q.one ? rows[0] || null : rows;
  })
};

jest.mock('@sap/cds', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return {
    log: jest.fn(() => logger),
    connect: {
      to: jest.fn(async name => {
        if (name === 'vim_ecc_integration') return mockEcc;
        if (name === 'db') return mockDb;
        throw new Error(`${name} not available`);
      })
    }
  };
});

const query = one => ({
  from: entity => {
    const q = { entity, one, where: null };
    q.where = w => ({ ...q, where: w });
    return q;
  }
});
global.SELECT = Object.assign(query(false), { one: query(true) });

const engine = require('../srv/lib/tax-determination-engine');

const PO = {
  RETURN: [],
  POHEADER: { COMP_CODE: '1000', VENDOR: '0000100001', CURRENCY: 'USD' },
  POITEM: [{ PO_ITEM: '00010', PLANT: '1000', MATL_GROUP: 'MG01', TAX_CODE: 'I1', TAXJURCODE: 'CA0000000' }],
  POACCOUNT: [],
  POADDRDELIVERY: []
};

beforeEach(() => {
  engine.clearCache();
  Object.values(ecc).forEach(fn => fn.mockReset());
  Object.keys(tables).forEach(k => delete tables[k]);
  ecc.getPODetail1.mockResolvedValue(JSON.parse(JSON.stringify(PO)));
  ecc.getVendorDetail.mockResolvedValue({ GENERALDETAIL: { NAME: 'ACME', COUNTRY: 'US', REGION: 'TX' } });
  ecc.getCompanyCodeDetail.mockResolvedValue({ COMPANYCODE_DETAIL: { COMP_CODE: '1000', COUNTRY: 'US' }, COMPANYCODE_ADDRESS: { REGION: 'CA' } });
  ecc.getTaxCodes.mockResolvedValue([{ MWSKZ: 'I1', MWART: 'V', KALSM: 'TAXUSJ' }, { MWSKZ: 'U1', MWART: 'V', KALSM: 'TAXUSJ' }, { MWSKZ: 'O1', MWART: 'A', KALSM: 'TAXUSJ' }]);
  ecc.getTaxJurisdictions.mockResolvedValue([{ TXJCD: 'CA0000000' }, { TXJCD: 'TX0000000' }]);
  ecc.calculateTaxFromNet.mockResolvedValue({ E_FWSTE: '72.50', T_MWDAT: [{ KSCHL: 'JP1I', MSATZ: '7.25', WMWST: '72.50' }] });
  tables['s4hana.TaxKeys'] = [{ MWSKZ: 'I1', KALSM: 'TAXUSJ' }, { MWSKZ: 'U1', KALSM: 'TAXUSJ', XINACT: 'X' }];
});

describe('PO line determination', () => {
  const run = (extra = {}) => engine.determineTaxForPOLine({
    poNumber: '4500001234', poLineNumber: '10', companyCode: '1000', netAmount: 1000, ...extra
  });

  test('uses POITEM tax code and jurisdiction, amount from calculateTaxFromNet', async () => {
    const r = await run();
    expect(r).toMatchObject({ status: 'DETERMINED', taxCode: 'I1', taxCodeSource: 'POITEM.TAX_CODE', taxJurisdiction: 'CA0000000', taxAmount: 72.5 });
    expect(ecc.calculateTaxFromNet).toHaveBeenCalledWith(expect.objectContaining({ I_MWSKZ: 'I1', I_TXJCD: 'CA0000000', I_WAERS: 'USD', I_WRBTR: 1000 }));
  });

  test('fails closed on company code mismatch', async () => {
    expect(await run({ companyCode: '2000' })).toMatchObject({ status: 'EXCEPTION', errorCode: 'PO_COMPANY_CODE_MISMATCH' });
  });

  test('fails closed when PO line is missing', async () => {
    expect(await run({ poLineNumber: '20' })).toMatchObject({ status: 'EXCEPTION', errorCode: 'PO_LINE_NOT_FOUND' });
  });

  test('fails closed on POITEM / POACCOUNT tax code conflict', async () => {
    const po = JSON.parse(JSON.stringify(PO));
    po.POACCOUNT = [{ PO_ITEM: '00010', SERIAL_NO: '01', TAX_CODE: 'I2' }];
    ecc.getPODetail1.mockResolvedValue(po);
    expect(await run()).toMatchObject({ status: 'EXCEPTION', errorCode: 'PO_TAX_CODE_CONFLICT' });
  });

  test('without PO tax code and without rule -> PO_TAX_CODE_MISSING (no default code)', async () => {
    const po = JSON.parse(JSON.stringify(PO));
    po.POITEM[0].TAX_CODE = '';
    ecc.getPODetail1.mockResolvedValue(po);
    expect(await run()).toMatchObject({ status: 'EXCEPTION', errorCode: 'PO_TAX_CODE_MISSING', taxCode: null });
  });

  test('rejects inactive tax code (s4hana.TaxKeys.XINACT)', async () => {
    const po = JSON.parse(JSON.stringify(PO));
    po.POITEM[0].TAX_CODE = 'U1';
    ecc.getPODetail1.mockResolvedValue(po);
    expect(await run()).toMatchObject({ status: 'EXCEPTION', errorCode: 'INVALID_TAX_CODE' });
  });

  test('rejects output tax code (MWART != V)', async () => {
    const po = JSON.parse(JSON.stringify(PO));
    po.POITEM[0].TAX_CODE = 'O1';
    ecc.getPODetail1.mockResolvedValue(po);
    expect(await run()).toMatchObject({ status: 'EXCEPTION', errorCode: 'INVALID_TAX_CODE' });
  });

  test('no local estimate when both calculation BAPIs fail', async () => {
    ecc.calculateTaxFromNet.mockRejectedValue(new Error('RFC down'));
    ecc.calculateTaxFromNetStd.mockRejectedValue(new Error('RFC down'));
    expect(await run()).toMatchObject({ status: 'EXCEPTION', errorCode: 'TAX_CALCULATION_FAILED', taxAmount: null });
  });
});

describe('Non-PO line determination', () => {
  const run = (extra = {}) => engine.determineTaxForNonPOLine({
    companyCode: '1000', vendorId: '100001', lineNumber: 1, netAmount: 1000, currency: 'USD', glAccount: '0000640000', ...extra
  });
  const rule = (id, extra) => ({ ID: id, companyCode: '1000', isActive: true, priority: 10, taxCode: 'I1', taxJurisdiction: 'CA0000000', ...extra });

  test('requires exact vendor ID', async () => {
    expect(await run({ vendorId: '' })).toMatchObject({ status: 'EXCEPTION', errorCode: 'VENDOR_REQUIRED' });
  });

  test('matches vendor + G/L rule ignoring leading zeros', async () => {
    tables['vim.validators.tax.TaxDeterminationRules'] = [rule('R1', { vendorId: '0000100001', glAccount: '640000' })];
    expect(await run()).toMatchObject({ status: 'DETERMINED', taxCode: 'I1', ruleId: 'R1', taxJurisdiction: 'CA0000000' });
  });

  test('rejects ties with different outcomes', async () => {
    tables['vim.validators.tax.TaxDeterminationRules'] = [
      rule('R1', { vendorId: '100001' }),
      rule('R2', { vendorId: '100001', taxCode: 'U1' })
    ];
    expect(await run()).toMatchObject({ status: 'EXCEPTION', errorCode: 'AMBIGUOUS_TAX_RULE' });
  });

  test('without rule or VendorTaxProfile default -> NO_TAX_RULE', async () => {
    expect(await run()).toMatchObject({ status: 'EXCEPTION', errorCode: 'NO_TAX_RULE' });
  });

  test('jurisdiction required for US company code', async () => {
    tables['vim.validators.tax.TaxDeterminationRules'] = [rule('R1', { vendorId: '100001', taxJurisdiction: null })];
    expect(await run()).toMatchObject({ status: 'EXCEPTION', errorCode: 'TAX_JURISDICTION_MISSING' });
  });
});
