const cds = require('@sap/cds');
const { SELECT } = cds.ql;
const LOG_PO = cds.log('PO');

module.exports = class S4HANARemoteService extends cds.ApplicationService {
  async init() {
    const S4RFC = await cds.connect.to('S4RFC');

    this.before('*', (req) => {
      if (req.http?.req && !req.http.req.locale) req.http.req.locale = 'EN';
    });

    this.before('READ', 'PaymentBlockTexts', (req) => {
      req.query.where({ SPRAS: 'E' });
    });

    this.on('getCompanyCodes', async () => {
      const result = await S4RFC.BAPI_COMPANYCODE_GETLIST({
        COMPANYCODE_LIST: []
      });
      return result;
    });

    this.on('getCompanyCodeDetail', async (req) => {
      const { COMPANYCODEID } = req.data;
      const result = await S4RFC.BAPI_COMPANYCODE_GETDETAIL({
        COMPANYCODEID
      });
      return result;
    });

    this.on('getVendorDetail', async (req) => {
      const { VENDORNO, COMPANYCODE } = req.data;
      const result = await S4RFC.BAPI_VENDOR_GETDETAIL({
        VENDORNO: VENDORNO.padStart(10, '0'),
        COMPANYCODE
      });
      return result;
    });

    this.on('getBBPVendorList', async (req) => {
      const { COMP_CODE } = req.data;
      const result = await S4RFC.BBP_VENDOR_GETLIST({
        COMP_CODE,
        VENDOR: []
      });
      return result;
    });

    this.on('getCostCenters', async (req) => {
      const {
        COMPANYCODE, COMPANYCODE_TO,
        CONTROLLINGAREA, CONTROLLINGAREA_TO,
        COSTCENTER, COSTCENTERGROUP, COSTCENTER_TO,
        DATE, DATE_TO,
        PERSON_IN_CHARGE, PERSON_IN_CHARGE_TO,
        PERSON_IN_CHARGE_USER_FROM, PERSON_IN_CHARGE_USER_TO
      } = req.data;

      const bapParams = {
        COMPANYCODE:                COMPANYCODE                ?? '',
        COMPANYCODE_TO:             COMPANYCODE_TO             ?? '',
        CONTROLLINGAREA:            CONTROLLINGAREA            ?? '',
        CONTROLLINGAREA_TO:         CONTROLLINGAREA_TO         ?? '',
        COSTCENTER:                 COSTCENTER                 ?? '',
        COSTCENTERGROUP:            COSTCENTERGROUP            ?? '',
        COSTCENTER_TO:              COSTCENTER_TO              ?? '',
        PERSON_IN_CHARGE:           PERSON_IN_CHARGE           ?? '',
        PERSON_IN_CHARGE_TO:        PERSON_IN_CHARGE_TO        ?? '',
        PERSON_IN_CHARGE_USER_FROM: PERSON_IN_CHARGE_USER_FROM ?? '',
        PERSON_IN_CHARGE_USER_TO:   PERSON_IN_CHARGE_USER_TO   ?? '',
        COSTCENTER_LIST: []
      };
      if (DATE)    bapParams.DATE    = DATE;
      if (DATE_TO) bapParams.DATE_TO = DATE_TO;
      const result = await S4RFC.BAPI_COSTCENTER_GETLIST(bapParams);
      return result;
    });

    this.on('getGLAccounts', async (req) => {
      const { COMPANYCODE, LANGUAGE, LANGUAGE_ISO } = req.data;
      const result = await S4RFC.BAPI_GL_ACC_GETLIST({
        COMPANYCODE,
        LANGUAGE:      LANGUAGE     ?? '',
        LANGUAGE_ISO:  LANGUAGE_ISO ?? '',
        ACCOUNT_LIST: []
      });
      return result;
    });

    this.on('getPOList', async (req) => {
      const { ITEMS_FOR_RELEASE, REL_CODE, REL_GROUP } = req.data;
      const result = await S4RFC.BAPI_PO_GET_LIST({
        ITEMS_FOR_RELEASE: ITEMS_FOR_RELEASE ?? '',
        REL_CODE:          REL_CODE          ?? '',
        REL_GROUP:         REL_GROUP         ?? ''
      });
      return result;
    });

    this.on('getTaxJurisdictions', async (req) => {
      const { country, language } = req.data;
      const kalsmPattern = 'TAX' + country.toUpperCase() + '%';
      const lang = language ?? 'E';

      const db = await cds.connect.to('db');
      const texts = await db.run(
        SELECT.from('s4hana.TaxJurisdictionTexts').where({ KALSM: { like: kalsmPattern }, SPRAS: lang })
      );

      return texts.map(t => ({
        KALSM: t.KALSM,
        TXJCD: t.TXJCD,
        TEXT1: t.TEXT1
      }));
    });

    this.on('getTaxCodes', async (req) => {
      const { country, language } = req.data;
      const KALSM = 'TAX' + country.toUpperCase();
      const lang = language ?? 'E';

      const db = await cds.connect.to('db');

      const [keys, texts] = await Promise.all([
        db.run(SELECT.from('s4hana.TaxKeys').where({ KALSM, XINACT: { '!=': 'X' } })),
        db.run(SELECT.from('s4hana.TaxCodeTexts').where({ KALSM, SPRAS: lang }))
      ]);

      const textMap = Object.fromEntries(texts.map(t => [t.MWSKZ, t.TEXT1]));

      return keys.map(k => ({
        KALSM: k.KALSM,
        MWSKZ: k.MWSKZ,
        MWART: k.MWART,
        TEXT1: textMap[k.MWSKZ] ?? ''
      }));
    });

    this.on('getCurrencies', async () => {
      const result = await S4RFC.BAPI_CURRENCY_GETLIST({
        CURRENCY_LIST: []
      });
      return result;
    });

    this.on('getInternalOrders', async (req) => {
      const {
        CONTROLLING_AREA, ORDER, ORDER_EXTERNAL_NO, ORDER_EXTERNAL_NO_TO,
        ORDER_TO, ORDER_TYPE, RESP_COST_CENTER
      } = req.data;
      const result = await S4RFC.BAPI_INTERNALORDER_GETLIST({
        CONTROLLING_AREA:     CONTROLLING_AREA     ?? '',
        ORDER:                ORDER                ?? '',
        ORDER_EXTERNAL_NO:    ORDER_EXTERNAL_NO    ?? '',
        ORDER_EXTERNAL_NO_TO: ORDER_EXTERNAL_NO_TO ?? '',
        ORDER_TO:             ORDER_TO             ?? '',
        ORDER_TYPE:           ORDER_TYPE           ?? '',
        RESP_COST_CENTER:     RESP_COST_CENTER     ?? '',
        ORDER_LIST: []
      });
      return result;
    });

    this.on('getPOLineItems', async (req) => {
      LOG_PO.debug('getPOLineItems called');
      const sys = await cds.connect.to('S4RFC');
      const { purchaseOrder } = req.data;
      LOG_PO.debug('Fetching PO line items', { purchaseOrder });
      const lineItems = await sys.BAPI_PO_GETITEMS({
        PURCHASEORDER: purchaseOrder,
        PO_ITEMS: []
      });
      LOG_PO.debug('PO line items fetched', { purchaseOrder, resultCount: lineItems?.length });
      return lineItems;
    });

    this.on('postAccDocument', async (req) => {
      const {
        DOCUMENTHEADER, CONTRACTHEADER, CUSTOMERCPD,
        ACCOUNTGL, ACCOUNTPAYABLE, ACCOUNTRECEIVABLE,
        ACCOUNTTAX, ACCOUNTWT, CONTRACTITEM,
        CRITERIA, CURRENCYAMOUNT, EXTENSION1,
        EXTENSION2, PAYMENTCARD, REALESTATE, VALUEFIELD
      } = req.data;

      const result = await S4RFC.BAPI_ACC_DOCUMENT_POST({
        DOCUMENTHEADER,
        CONTRACTHEADER:    CONTRACTHEADER    ?? {},
        CUSTOMERCPD:       CUSTOMERCPD       ?? {},
        ACCOUNTGL:         ACCOUNTGL         ?? [],
        ACCOUNTPAYABLE:    ACCOUNTPAYABLE    ?? [],
        ACCOUNTRECEIVABLE: ACCOUNTRECEIVABLE ?? [],
        ACCOUNTTAX:        ACCOUNTTAX        ?? [],
        ACCOUNTWT:         ACCOUNTWT         ?? [],
        CONTRACTITEM:      CONTRACTITEM      ?? [],
        CRITERIA:          CRITERIA          ?? [],
        CURRENCYAMOUNT:    CURRENCYAMOUNT    ?? [],
        EXTENSION1:        EXTENSION1        ?? [],
        EXTENSION2:        EXTENSION2        ?? [],
        PAYMENTCARD:       PAYMENTCARD       ?? [],
        REALESTATE:        REALESTATE        ?? [],
        RETURN:            [],
        VALUEFIELD:        VALUEFIELD        ?? []
      });
      return result;
    });

    this.on('createBinaryRelation', async (req) => {
      const { OBJ_ROLEA, OBJ_ROLEB, RELATIONTYPE, BINREL_ATTRIB } = req.data;

      const result = await S4RFC.BINARY_RELATION_CREATE_COMMIT({
        OBJ_ROLEA,
        OBJ_ROLEB,
        RELATIONTYPE,
        BINREL_ATTRIB: BINREL_ATTRIB ?? []
      });
      return result;
    });

    return super.init();
  }
};
