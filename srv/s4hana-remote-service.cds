using s4hana from '../db/s4hana';
using {S4RFC.BAPI_COMPANYCODE_GETLIST.ResultType as ResultTypeCompanyCodes} from './external/S4RFC';
using {S4RFC.BAPI_COMPANYCODE_GETDETAIL.ResultType as ResultTypeCompanyCodeDetail} from './external/S4RFC';
using {S4RFC.BAPI_VENDOR_GETDETAIL.ResultType as ResultTypeVendorDetail} from './external/S4RFC';
using {S4RFC.BBP_VENDOR_GETLIST.ResultType as ResultTypeBBPVendorList} from './external/S4RFC';
using {S4RFC.BAPI_COSTCENTER_GETLIST.ResultType as ResultTypeCostCenters} from './external/S4RFC';
using {S4RFC.BAPI_PO_GETITEMS.ResultType as ResultTypePOItems} from './external/S4RFC';
using {S4RFC.BAPI_GL_ACC_GETLIST.ResultType as ResultTypeGLAccounts} from './external/S4RFC';
using {S4RFC.BAPI_INTERNALORDER_GETLIST.ResultType as ResultTypeInternalOrders} from './external/S4RFC';
using {S4RFC.BAPI_CURRENCY_GETLIST.ResultType as ResultTypeCurrencies} from './external/S4RFC';
using {S4RFC.BAPI_PO_GET_LIST.ResultType as ResultTypePOList} from './external/S4RFC';
using {S4RFC.BAPI_ACC_DOCUMENT_POST.ResultType as ResultTypeAccDocumentPost} from './external/S4RFC';
using {S4RFC.BINARY_RELATION_CREATE_COMMIT.ResultType as ResultTypeBinaryRelation} from './external/S4RFC';
using {
  S4RFC.DDIC.BAPIACHE09 as BAPIACHE09,
  S4RFC.DDIC.BAPIACCAHD as BAPIACCAHD,
  S4RFC.DDIC.BAPIACPA09 as BAPIACPA09,
  S4RFC.DDIC.BAPIACGL09 as BAPIACGL09,
  S4RFC.DDIC.BAPIACAP09 as BAPIACAP09,
  S4RFC.DDIC.BAPIACAR09 as BAPIACAR09,
  S4RFC.DDIC.BAPIACTX09 as BAPIACTX09,
  S4RFC.DDIC.BAPIACWT09 as BAPIACWT09,
  S4RFC.DDIC.BAPIACCAIT as BAPIACCAIT,
  S4RFC.DDIC.BAPIACKEC9 as BAPIACKEC9,
  S4RFC.DDIC.BAPIACCR09 as BAPIACCR09,
  S4RFC.DDIC.BAPIACEXTC as BAPIACEXTC,
  S4RFC.DDIC.BAPIPAREX  as BAPIPAREX,
  S4RFC.DDIC.BAPIACPC09 as BAPIACPC09,
  S4RFC.DDIC.BAPIACRE09 as BAPIACRE09,
  S4RFC.DDIC.BAPIACKEV9 as BAPIACKEV9,
  S4RFC.DDIC.BORIDENT   as BORIDENT,
  S4RFC.DDIC.BRELATTR   as BRELATTR
} from './external/S4RFC';

@path: '/s4hana-remote'
service S4HANARemoteService {
  @readonly entity PaymentBlockTexts     as select from s4hana.PaymentBlockTexts;
  @readonly entity PaymentMethods        as projection on s4hana.PaymentMethods;
  @readonly entity TaxKeys               as projection on s4hana.TaxKeys;
  @readonly entity TaxCodeTexts          as projection on s4hana.TaxCodeTexts;
  @readonly entity PaymentMethodTexts    as projection on s4hana.PaymentMethodTexts;
  //@readonly entity PaymentMethodSuppTexts as projection on s4hana.PaymentMethodSuppTexts;
  //@readonly entity PaymentTerms          as projection on s4hana.PaymentTerms;
  @readonly entity PaymentTermsTexts     as projection on s4hana.PaymentTermsTexts;
  @readonly entity PaymentTermsAdditional as projection on s4hana.PaymentTermsAdditional;
  @readonly entity TaxJurisdiction       as projection on s4hana.TaxJurisdiction;
  @readonly entity TaxJurisdictionTexts  as projection on s4hana.TaxJurisdictionTexts;

  function getCompanyCodes() returns ResultTypeCompanyCodes;

  function getCompanyCodeDetail(
    COMPANYCODEID : String(4) not null
  ) returns ResultTypeCompanyCodeDetail;

  function getVendorDetail(
    VENDORNO    : String(10) not null,
    COMPANYCODE : String(4) not null
  ) returns ResultTypeVendorDetail;

  function getBBPVendorList(
    COMP_CODE : String(4) not null
  ) returns ResultTypeBBPVendorList;

  function getCostCenters(
    COMPANYCODE               : String(4),
    COMPANYCODE_TO            : String(4),
    CONTROLLINGAREA           : String(4),
    CONTROLLINGAREA_TO        : String(4),
    COSTCENTER                : String(10),
    COSTCENTERGROUP           : String(15),
    COSTCENTER_TO             : String(10),
    DATE                      : Date,
    DATE_TO                   : Date,
    PERSON_IN_CHARGE          : String(20),
    PERSON_IN_CHARGE_TO       : String(20),
    PERSON_IN_CHARGE_USER_FROM: String(12),
    PERSON_IN_CHARGE_USER_TO  : String(12)
  ) returns ResultTypeCostCenters;

  type POHeader {
    PO_NUMBER  : String(10);
    CO_CODE    : String(4);
    DOC_TYPE   : String(4);
    VENDOR     : String(10);
    VEND_NAME  : String(35);
    DOC_DATE   : Date;
    CREATED_ON : Date;
    CREATED_BY : String(12);
    PURCH_ORG  : String(4);
    PUR_GROUP  : String(3);
    CURRENCY   : String(5);
    STATUS     : String(1);
  }

  type POItem {
    PO_NUMBER  : String(10);
    PO_ITEM    : String(5);
    MATERIAL   : String(18);
    SHORT_TEXT : String(40);
    PLANT      : String(4);
    MAT_GRP    : String(9);
    ITEM_CAT   : String(1);
    ACCTASSCAT : String(1);
    UNIT       : String(3);
    NET_PRICE  : Decimal;
    PRICE_UNIT : Decimal;
    TAX_CODE   : String(2);
    DELETE_IND : String(1);
    VENDOR     : String(10);
  }

  type POItemsResult {
    PO_HEADERS : array of POHeader;
    PO_ITEMS   : array of POItem;
  }

  function getPOLineItems(
    purchaseOrder : String(10)
  ) returns ResultTypePOItems;

  function getGLAccounts(
    COMPANYCODE   : String(4) not null,
    LANGUAGE      : String(1),
    LANGUAGE_ISO  : String(2)
  ) returns ResultTypeGLAccounts;

  function getCurrencies() returns ResultTypeCurrencies;

  type TaxCodeItem {
    KALSM : String(6);
    MWSKZ : String(2);
    MWART : String(1);
    TEXT1 : String(50);
  }

  function getTaxCodes(
    country  : String(2) not null,
    language : String(1)
  ) returns array of TaxCodeItem;

  type TaxJurisdictionItem {
    KALSM : String(6);
    TXJCD : String(15);
    TEXT1 : String(20);
  }

  function getTaxJurisdictions(
    country  : String(2) not null,
    language : String(1)
  ) returns array of TaxJurisdictionItem;

  function getPOList(
    ITEMS_FOR_RELEASE : String(1),
    REL_CODE          : String(2),
    REL_GROUP         : String(2)
  ) returns ResultTypePOList;

  function getInternalOrders(
    CONTROLLING_AREA      : String(4),
    ORDER                 : String(12),
    ORDER_EXTERNAL_NO     : String(20),
    ORDER_EXTERNAL_NO_TO  : String(20),
    ORDER_TO              : String(12),
    ORDER_TYPE            : String(4),
    RESP_COST_CENTER      : String(10)
  ) returns ResultTypeInternalOrders;

  action postAccDocument(
    DOCUMENTHEADER    : BAPIACHE09 not null,
    CONTRACTHEADER    : BAPIACCAHD,
    CUSTOMERCPD       : BAPIACPA09,
    ACCOUNTGL         : array of BAPIACGL09,
    ACCOUNTPAYABLE    : array of BAPIACAP09,
    ACCOUNTRECEIVABLE : array of BAPIACAR09,
    ACCOUNTTAX        : array of BAPIACTX09,
    ACCOUNTWT         : array of BAPIACWT09,
    CONTRACTITEM      : array of BAPIACCAIT,
    CRITERIA          : array of BAPIACKEC9,
    CURRENCYAMOUNT    : array of BAPIACCR09,
    EXTENSION1        : array of BAPIACEXTC,
    EXTENSION2        : array of BAPIPAREX,
    PAYMENTCARD       : array of BAPIACPC09,
    REALESTATE        : array of BAPIACRE09,
    VALUEFIELD        : array of BAPIACKEV9
  ) returns ResultTypeAccDocumentPost;

  action createBinaryRelation(
    OBJ_ROLEA     : BORIDENT not null,
    OBJ_ROLEB     : BORIDENT not null,
    RELATIONTYPE  : String(4) not null,
    BINREL_ATTRIB : array of BRELATTR
  ) returns ResultTypeBinaryRelation;
}
