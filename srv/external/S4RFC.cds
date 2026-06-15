/* checksum : 24c63fb6be8c6f3024c79212abb50128 */
@cds.external : true
@protocol : 'rfc'
service S4RFC {
  action BAPI_COMPANYCODE_GETLIST(
    @RFCParameterType : 'Table'
    COMPANYCODE_LIST : many DDIC.BAPI0002_1
  ) returns BAPI_COMPANYCODE_GETLIST.ResultType;

  type BAPI_COMPANYCODE_GETLIST.ResultType {
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRETURN;
    @RFCParameterType : 'Table'
    COMPANYCODE_LIST : many DDIC.BAPI0002_1;
  };

  action BAPI_COSTCENTER_GETLIST(
    @RFCParameterType : 'Import'
    COMPANYCODE : String(4),
    @RFCParameterType : 'Import'
    COMPANYCODE_TO : String(4),
    @RFCParameterType : 'Import'
    CONTROLLINGAREA : String(4),
    @RFCParameterType : 'Import'
    CONTROLLINGAREA_TO : String(4),
    @RFCParameterType : 'Import'
    COSTCENTER : String(10),
    @RFCParameterType : 'Import'
    COSTCENTERGROUP : String(15),
    @RFCParameterType : 'Import'
    COSTCENTER_TO : String(10),
    @RFCParameterType : 'Import'
    DATE : Date,
    @RFCParameterType : 'Import'
    DATE_TO : Date,
    @RFCParameterType : 'Import'
    PERSON_IN_CHARGE : String(20),
    @RFCParameterType : 'Import'
    PERSON_IN_CHARGE_TO : String(20),
    @RFCParameterType : 'Import'
    PERSON_IN_CHARGE_USER_FROM : String(12),
    @RFCParameterType : 'Import'
    PERSON_IN_CHARGE_USER_TO : String(12),
    @RFCParameterType : 'Table'
    COSTCENTER_LIST : many DDIC.BAPI0012_2
  ) returns BAPI_COSTCENTER_GETLIST.ResultType;

  type BAPI_COSTCENTER_GETLIST.ResultType {
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRETURN;
    @RFCParameterType : 'Table'
    COSTCENTER_LIST : many DDIC.BAPI0012_2;
  };

  action BAPI_PO_GETITEMS(
    @RFCParameterType : 'Import'
    ACCTASSCAT : String(1),
    @RFCParameterType : 'Import'
    CREATED_BY : String(12),
    @RFCParameterType : 'Import'
    DELETED_ITEMS : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    DOC_DATE : Date,
    @RFCParameterType : 'Import'
    DOC_TYPE : String(4),
    @RFCParameterType : 'Import'
    ITEMS_OPEN_FOR_RECEIPT : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    ITEM_CAT : String(1),
    @RFCParameterType : 'Import'
    MATERIAL : String(18),
    @RFCParameterType : 'Import'
    MATERIAL_EVG : DDIC.BAPIMGVMATNR,
    @RFCParameterType : 'Import'
    MATERIAL_LONG : String(40),
    @RFCParameterType : 'Import'
    MAT_GRP : String(9),
    @RFCParameterType : 'Import'
    PLANT : String(4),
    @RFCParameterType : 'Import'
    PREQ_NAME : String(12) default 'SPACE',
    @RFCParameterType : 'Import'
    PURCHASEORDER : String(10),
    @RFCParameterType : 'Import'
    PURCH_ORG : String(4),
    @RFCParameterType : 'Import'
    PUR_GROUP : String(3),
    @RFCParameterType : 'Import'
    PUR_MAT : String(18) default 'SPACE',
    @RFCParameterType : 'Import'
    PUR_MAT_EVG : DDIC.BAPIMGVMATNR,
    @RFCParameterType : 'Import'
    PUR_MAT_LONG : String(40) default 'SPACE',
    @RFCParameterType : 'Import'
    SHORT_TEXT : String(40),
    @RFCParameterType : 'Import'
    SUPPL_PLANT : String(4),
    @RFCParameterType : 'Import'
    TRACKINGNO : String(10),
    @RFCParameterType : 'Import'
    VENDOR : String(10),
    @RFCParameterType : 'Import'
    WITH_PO_HEADERS : String(1) default 'SPACE',
    @RFCParameterType : 'Table'
    PO_HEADERS : many DDIC.BAPIEKKOL,
    @RFCParameterType : 'Table'
    PO_ITEMS : many DDIC.BAPIEKPOC,
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRETURN
  ) returns BAPI_PO_GETITEMS.ResultType;

  type BAPI_PO_GETITEMS.ResultType {
    @RFCParameterType : 'Table'
    PO_HEADERS : many DDIC.BAPIEKKOL;
    @RFCParameterType : 'Table'
    PO_ITEMS : many DDIC.BAPIEKPOC;
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRETURN;
  };

  action BAPI_GL_ACC_GETLIST(
    @RFCParameterType : 'Import'
    COMPANYCODE : String(4) not null,
    @RFCParameterType : 'Import'
    LANGUAGE : String(1),
    @RFCParameterType : 'Import'
    LANGUAGE_ISO : String(2),
    @RFCParameterType : 'Table'
    ACCOUNT_LIST : many DDIC.BAPI3006_1
  ) returns BAPI_GL_ACC_GETLIST.ResultType;

  type BAPI_GL_ACC_GETLIST.ResultType {
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRETURN;
    @RFCParameterType : 'Table'
    ACCOUNT_LIST : many DDIC.BAPI3006_1;
  };

  action BAPI_INTERNALORDER_GETLIST(
    @RFCParameterType : 'Import'
    CONTROLLING_AREA : String(4),
    @RFCParameterType : 'Import'
    ORDER : String(12),
    @RFCParameterType : 'Import'
    ORDER_EXTERNAL_NO : String(20),
    @RFCParameterType : 'Import'
    ORDER_EXTERNAL_NO_TO : String(20),
    @RFCParameterType : 'Import'
    ORDER_TO : String(12),
    @RFCParameterType : 'Import'
    ORDER_TYPE : String(4),
    @RFCParameterType : 'Import'
    RESP_COST_CENTER : String(10),
    @RFCParameterType : 'Table'
    ORDER_LIST : many DDIC.BAPI2075_1
  ) returns BAPI_INTERNALORDER_GETLIST.ResultType;

  type BAPI_INTERNALORDER_GETLIST.ResultType {
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRETURN;
    @RFCParameterType : 'Table'
    ORDER_LIST : many DDIC.BAPI2075_1;
  };

  action BAPI_CURRENCY_GETLIST(
    @RFCParameterType : 'Table'
    CURRENCY_LIST : many DDIC.BAPI1090_2
  ) returns BAPI_CURRENCY_GETLIST.ResultType;

  type BAPI_CURRENCY_GETLIST.ResultType {
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRETURN;
    @RFCParameterType : 'Table'
    CURRENCY_LIST : many DDIC.BAPI1090_2;
  };

  action BAPI_PO_GET_LIST(
    @RFCParameterType : 'Import'
    ITEMS_FOR_RELEASE : String(1) default 'X',
    @RFCParameterType : 'Import'
    REL_CODE : String(2),
    @RFCParameterType : 'Import'
    REL_GROUP : String(2),
    @RFCParameterType : 'Table'
    PO_ADDRESSES : many DDIC.BAPIEKAN,
    @RFCParameterType : 'Table'
    PO_ADDRESSES_NEW : many DDIC.BAPIADDRESS,
    @RFCParameterType : 'Table'
    PO_HEADERS : many DDIC.BAPIEKKO,
    @RFCParameterType : 'Table'
    PO_ITEMS : many DDIC.BAPIEKPO,
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRETURN
  ) returns BAPI_PO_GET_LIST.ResultType;

  type BAPI_PO_GET_LIST.ResultType {
    @RFCParameterType : 'Table'
    PO_ADDRESSES : many DDIC.BAPIEKAN;
    @RFCParameterType : 'Table'
    PO_ADDRESSES_NEW : many DDIC.BAPIADDRESS;
    @RFCParameterType : 'Table'
    PO_HEADERS : many DDIC.BAPIEKKO;
    @RFCParameterType : 'Table'
    PO_ITEMS : many DDIC.BAPIEKPO;
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRETURN;
  };

  action BAPI_COMPANYCODE_GETDETAIL(
    @RFCParameterType : 'Import'
    COMPANYCODEID : String(4) not null
  ) returns BAPI_COMPANYCODE_GETDETAIL.ResultType;

  type BAPI_COMPANYCODE_GETDETAIL.ResultType {
    @RFCParameterType : 'Export'
    COMPANYCODE_ADDRESS : DDIC.BAPI0002_3;
    @RFCParameterType : 'Export'
    COMPANYCODE_DETAIL : DDIC.BAPI0002_2;
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRETURN;
  };

  action BAPI_VENDOR_GETDETAIL(
    @RFCParameterType : 'Import'
    VENDORNO : String(10) not null,
    @RFCParameterType : 'Import'
    COMPANYCODE : String(4) not null
  ) returns BAPI_VENDOR_GETDETAIL.ResultType;

  type BAPI_VENDOR_GETDETAIL.ResultType {
    @RFCParameterType : 'Export'
    GENERALDETAIL : DDIC.BAPIVENDOR_04;
    @RFCParameterType : 'Export'
    COMPANYDETAIL : DDIC.BAPIVENDOR_05;
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRET1;
  };

  action BBP_VENDOR_GETLIST(
    @RFCParameterType : 'Import'
    COMP_CODE : String(4) not null,
    @RFCParameterType : 'Table'
    VENDOR : many DDIC.BBP_CREDIT
  ) returns BBP_VENDOR_GETLIST.ResultType;

  type BBP_VENDOR_GETLIST.ResultType {
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRETURN;
    @RFCParameterType : 'Table'
    VENDOR : many DDIC.BBP_CREDIT;
  };

  action BAPI_ACC_DOCUMENT_POST(
    @RFCParameterType : 'Import'
    CONTRACTHEADER : DDIC.BAPIACCAHD,
    @RFCParameterType : 'Import'
    CUSTOMERCPD : DDIC.BAPIACPA09,
    @RFCParameterType : 'Import'
    DOCUMENTHEADER : DDIC.BAPIACHE09 not null,
    @RFCParameterType : 'Table'
    ACCOUNTGL : many DDIC.BAPIACGL09,
    @RFCParameterType : 'Table'
    ACCOUNTPAYABLE : many DDIC.BAPIACAP09,
    @RFCParameterType : 'Table'
    ACCOUNTRECEIVABLE : many DDIC.BAPIACAR09,
    @RFCParameterType : 'Table'
    ACCOUNTTAX : many DDIC.BAPIACTX09,
    @RFCParameterType : 'Table'
    ACCOUNTWT : many DDIC.BAPIACWT09,
    @RFCParameterType : 'Table'
    CONTRACTITEM : many DDIC.BAPIACCAIT,
    @RFCParameterType : 'Table'
    CRITERIA : many DDIC.BAPIACKEC9,
    @RFCParameterType : 'Table'
    CURRENCYAMOUNT : many DDIC.BAPIACCR09,
    @RFCParameterType : 'Table'
    EXTENSION1 : many DDIC.BAPIACEXTC,
    @RFCParameterType : 'Table'
    EXTENSION2 : many DDIC.BAPIPAREX,
    @RFCParameterType : 'Table'
    PAYMENTCARD : many DDIC.BAPIACPC09,
    @RFCParameterType : 'Table'
    REALESTATE : many DDIC.BAPIACRE09,
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2,
    @RFCParameterType : 'Table'
    VALUEFIELD : many DDIC.BAPIACKEV9
  ) returns BAPI_ACC_DOCUMENT_POST.ResultType;

  type BAPI_ACC_DOCUMENT_POST.ResultType {
    @RFCParameterType : 'Export'
    OBJ_KEY : String(20);
    @RFCParameterType : 'Export'
    OBJ_SYS : String(10);
    @RFCParameterType : 'Export'
    OBJ_TYPE : String(5);
    @RFCParameterType : 'Table'
    ACCOUNTGL : many DDIC.BAPIACGL09;
    @RFCParameterType : 'Table'
    ACCOUNTPAYABLE : many DDIC.BAPIACAP09;
    @RFCParameterType : 'Table'
    ACCOUNTRECEIVABLE : many DDIC.BAPIACAR09;
    @RFCParameterType : 'Table'
    ACCOUNTTAX : many DDIC.BAPIACTX09;
    @RFCParameterType : 'Table'
    ACCOUNTWT : many DDIC.BAPIACWT09;
    @RFCParameterType : 'Table'
    CONTRACTITEM : many DDIC.BAPIACCAIT;
    @RFCParameterType : 'Table'
    CRITERIA : many DDIC.BAPIACKEC9;
    @RFCParameterType : 'Table'
    CURRENCYAMOUNT : many DDIC.BAPIACCR09;
    @RFCParameterType : 'Table'
    EXTENSION1 : many DDIC.BAPIACEXTC;
    @RFCParameterType : 'Table'
    EXTENSION2 : many DDIC.BAPIPAREX;
    @RFCParameterType : 'Table'
    PAYMENTCARD : many DDIC.BAPIACPC09;
    @RFCParameterType : 'Table'
    REALESTATE : many DDIC.BAPIACRE09;
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2;
    @RFCParameterType : 'Table'
    VALUEFIELD : many DDIC.BAPIACKEV9;
  };

  action BINARY_RELATION_CREATE_COMMIT(
    /** Role Object A */
    @RFCParameterType : 'Import'
    OBJ_ROLEA : DDIC.BORIDENT not null,
    /** Role Object B */
    @RFCParameterType : 'Import'
    OBJ_ROLEB : DDIC.BORIDENT not null,
    /** Relationship type */
    @RFCParameterType : 'Import'
    RELATIONTYPE : String(4) not null,
    /** Attributes */
    @RFCParameterType : 'Table'
    BINREL_ATTRIB : many DDIC.BRELATTR
  ) returns BINARY_RELATION_CREATE_COMMIT.ResultType;

  type BINARY_RELATION_CREATE_COMMIT.ResultType {
    /** Relationship and Roles */
    @RFCParameterType : 'Export'
    BINREL : DDIC.GBINREL;
    /** Attributes */
    @RFCParameterType : 'Table'
    BINREL_ATTRIB : many DDIC.BRELATTR;
  };

  type DDIC.BAPIRETURN {
    TYPE : String(1);
    CODE : String(5);
    MESSAGE : String(220);
    LOG_NO : String(20);
    @RFCAbapType : 'N'
    LOG_MSG_NO : String(6);
    MESSAGE_V1 : String(50);
    MESSAGE_V2 : String(50);
    MESSAGE_V3 : String(50);
    MESSAGE_V4 : String(50);
  };

  type DDIC.BAPI0002_1 {
    COMP_CODE : String(4);
    COMP_NAME : String(25);
  };

  type DDIC.BAPI0012_2 {
    CO_AREA : String(4);
    COSTCENTER : String(10);
    COCNTR_TXT : String(20);
  };

  type DDIC.BAPIMGVMATNR {
    MATERIAL_EXT : String(40);
    MATERIAL_VERS : String(10);
    MATERIAL_GUID : String(32);
  };

  type DDIC.BAPIEKKOL {
    PO_NUMBER : String(10);
    CO_CODE : String(4);
    DOC_CAT : String(1);
    DOC_TYPE : String(4);
    CNTRL_IND : String(1);
    DELETE_IND : String(1);
    STATUS : String(1);
    CREATED_ON : Date;
    CREATED_BY : String(12);
    @RFCAbapType : 'N'
    ITEM_INTVL : String(5);
    @RFCAbapType : 'N'
    LAST_ITEM : String(5);
    VENDOR : String(10);
    LANGUAGE : String(1);
    PMNTTRMS : String(4);
    DSCNT1_TO : Decimal;
    DSCNT2_TO : Decimal;
    DSCNT3_TO : Decimal;
    CASH_DISC1 : Decimal;
    CASH_DISC2 : Decimal;
    PURCH_ORG : String(4);
    PUR_GROUP : String(3);
    CURRENCY : String(5);
    EXCH_RATE : Decimal;
    EX_RATE_FX : String(1);
    DOC_DATE : Date;
    VPER_START : Date;
    VPER_END : Date;
    APPLIC_BY : Date;
    QUOT_DEAD : Date;
    BINDG_PER : Date;
    WARRANTY : Date;
    BIDINV_NO : String(10);
    QUOTATION : String(10);
    QUOT_DATE : Date;
    REF_1 : String(12);
    SALES_PERS : String(30);
    TELEPHONE : String(16);
    SUPPL_VEND : String(10);
    CUSTOMER : String(10);
    AGREEMENT : String(10);
    REJ_REASON : String(2);
    COMPL_DLV : String(1);
    GR_MESSAGE : String(1);
    SUPPL_PLNT : String(4);
    RCVG_VEND : String(10);
    INCOTERMS1 : String(3);
    INCOTERMS2 : String(28);
    TARGET_VAL : Decimal;
    COLL_NO : String(10);
    DOC_COND : String(10);
    PROCEDURE : String(6);
    UPDATE_GRP : String(6);
    DIFF_INV : String(10);
    EXPORT_NO : String(10);
    OUR_REF : String(12);
    LOGSYSTEM : String(10);
    @RFCAbapType : 'N'
    SUBITEMINT : String(5);
    MAST_COND : String(1);
    REL_GROUP : String(2);
    REL_STRAT : String(2);
    REL_IND : String(1);
    REL_STATUS : String(8);
    SUBJ_TO_R : String(1);
    TAXR_CNTRY : String(3);
    SCHED_IND : String(1);
    VEND_NAME : String(35);
    CURRENCY_ISO : String(3);
    EXCH_RATE_CM : Decimal;
    HOLD : String(1);
  };

  type DDIC.BAPIEKPOC {
    PO_NUMBER : String(10);
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    ADDRESS : String(10);
    MATERIAL : String(18);
    PUR_MAT : String(18);
    INFO_REC : String(10);
    ITEM_CAT : String(1);
    ACCTASSCAT : String(1);
    AGREEMENT : String(10);
    @RFCAbapType : 'N'
    AGMT_ITEM : String(5);
    STORE_LOC : String(4);
    MAT_GRP : String(9);
    SHORT_TEXT : String(40);
    DISTRIB : String(1);
    PART_INV : String(1);
    KANBAN_IND : String(1);
    PLANT : String(4);
    ALLOC_TBL : String(10);
    @RFCAbapType : 'N'
    AT_ITEM : String(5);
    UNIT : String(3);
    NET_PRICE : Decimal;
    PRICE_UNIT : Decimal;
    CONV_NUM1 : Decimal;
    CONV_DEN1 : Decimal;
    ORDERPR_UN : String(3);
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    PROMOTION : String(10);
    ACKN_REQD : String(1);
    TRACKINGNO : String(10);
    PLAN_DEL : Decimal;
    RET_ITEM : String(1);
    AT_RELEV : String(1);
    VEND_MAT : String(22);
    MANUF_PROF : String(4);
    MANU_MAT : String(40);
    MFR_NO : String(10);
    MFR_NO_EXT : String(10);
    PO_PRICE : String(1);
    SHIPPING : String(2);
    ITEM_CAT_EXT : String(1);
    PO_UNIT_ISO : String(3);
    ORDERPR_UN_ISO : String(3);
    PREQ_NAME : String(12);
    DISP_QUAN : Decimal;
    QUAL_INSP : String(1);
    NO_MORE_GR : String(1);
    DELETE_IND : String(1);
    NO_ROUNDING : String(1);
    TAX_CODE : String(2);
    MATERIAL_EXTERNAL : String(40);
    MATERIAL_GUID : String(32);
    MATERIAL_VERSION : String(10);
    PUR_MAT_EXTERNAL : String(40);
    PUR_MAT_GUID : String(32);
    PUR_MAT_VERSION : String(10);
    VAL_TYPE : String(10);
    PR_CLOSED : String(1);
    ACKNOWL_NO : String(20);
    REQ_SEGMENT : String(16);
    STK_SEGMENT : String(16);
    MATERIAL_LONG : String(40);
    PUR_MAT_LONG : String(40);
    REQ_SEG_LONG : String(40);
    STK_SEG_LONG : String(40);
  };

  type DDIC.BAPI3006_1 {
    COMP_CODE : String(4);
    GL_ACCOUNT : String(10);
    SHORT_TEXT : String(20);
    LONG_TEXT : String(50);
  };

  type DDIC.BAPI2075_1 {
    ORDER : String(12);
    OBJECT_NO : String(22);
    ORDER_TYPE : String(4);
    ORDER_NAME : String(40);
  };

  type DDIC.BAPI1090_2 {
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    ALT_CURR : String(3);
    VALID_TO : Date;
    LONG_TEXT : String(40);
  };

  type DDIC.BAPIEKAN {
    PO_NUMBER : String(10);
    NAME1 : String(35);
    NAME2 : String(35);
    NAME3 : String(35);
    NAME4 : String(35);
    ZIP_CODE : String(10);
    CITY : String(35);
    CNTRY_KEY : String(3);
    STREET : String(35);
    PO_BOX : String(10);
    ZIP_POBOX : String(10);
    TITLE : String(15);
    TELEX : String(30);
    FAX_NUMBER : String(31);
    TELETEXT : String(30);
    DATA_LINE : String(14);
    TELEBOX : String(15);
    REGION : String(3);
  };

  type DDIC.BAPIADDRESS {
    ADDRNUMBER : String(10);
    ADDRHANDLE : String(140);
    NATION : String(1);
    DATE : Date;
    DATE_FROM : Date;
    DATE_TO : Date;
    TITLE : String(4);
    NAME1 : String(40);
    NAME2 : String(40);
    NAME3 : String(40);
    NAME4 : String(40);
    NAME_TXT : String(50);
    NAME_CO : String(40);
    CITY1 : String(40);
    CITY2 : String(40);
    CITY_CODE : String(12);
    CITYP_CODE : String(8);
    CHCKSTATUS : String(1);
    POST_CODE1 : String(10);
    POST_CODE2 : String(10);
    POST_CODE3 : String(10);
    PO_BOX : String(10);
    PO_BOX_NUM : String(1);
    PO_BOX_LOC : String(40);
    CITY_CODE2 : String(12);
    PO_BOX_REG : String(3);
    PO_BOX_CTY : String(3);
    POSTALAREA : String(15);
    TRANSPZONE : String(10);
    STREET : String(60);
    STREETCODE : String(12);
    STREETABBR : String(2);
    HOUSE_NUM1 : String(10);
    HOUSE_NUM2 : String(10);
    HOUSE_NUM3 : String(10);
    STR_SUPPL1 : String(40);
    STR_SUPPL2 : String(40);
    LOCATION : String(40);
    BUILDING : String(10);
    FLOOR : String(10);
    ROOMNUMBER : String(10);
    COUNTRY : String(3);
    LANGU : String(1);
    REGION : String(3);
    SORT1 : String(20);
    SORT2 : String(20);
    SORT_PHN : String(20);
    ADDRORIGIN : String(4);
    EXTENSION1 : String(40);
    EXTENSION2 : String(40);
    TIME_ZONE : String(6);
    TAXJURCODE : String(15);
    ADDRESS_ID : String(10);
    REMARK : String(50);
    DEFLT_COMM : String(3);
    TEL_NUMBER : String(30);
    TEL_EXTENS : String(10);
    FAX_NUMBER : String(30);
    FAX_EXTENS : String(10);
    BUILD_LONG : String(20);
  };

  type DDIC.BAPIEKKO {
    PO_NUMBER : String(10);
    CO_CODE : String(4);
    DOC_CAT : String(1);
    DOC_TYPE : String(4);
    CNTRL_IND : String(1);
    DELETE_IND : String(1);
    STATUS : String(1);
    CREATED_ON : Date;
    CREATED_BY : String(12);
    @RFCAbapType : 'N'
    ITEM_INTVL : String(5);
    @RFCAbapType : 'N'
    LAST_ITEM : String(5);
    VENDOR : String(10);
    LANGUAGE : String(1);
    PMNTTRMS : String(4);
    DSCNT1_TO : Decimal;
    DSCNT2_TO : Decimal;
    DSCNT3_TO : Decimal;
    CASH_DISC1 : Decimal;
    CASH_DISC2 : Decimal;
    PURCH_ORG : String(4);
    PUR_GROUP : String(3);
    CURRENCY : String(5);
    EXCH_RATE : Decimal;
    EX_RATE_FX : String(1);
    DOC_DATE : Date;
    VPER_START : Date;
    VPER_END : Date;
    APPLIC_BY : Date;
    QUOT_DEAD : Date;
    BINDG_PER : Date;
    WARRANTY : Date;
    BIDINV_NO : String(10);
    QUOTATION : String(10);
    QUOT_DATE : Date;
    REF_1 : String(12);
    SALES_PERS : String(30);
    TELEPHONE : String(16);
    SUPPL_VEND : String(10);
    CUSTOMER : String(10);
    AGREEMENT : String(10);
    REJ_REASON : String(2);
    COMPL_DLV : String(1);
    GR_MESSAGE : String(1);
    SUPPL_PLNT : String(4);
    RCVG_VEND : String(10);
    INCOTERMS1 : String(3);
    INCOTERMS2 : String(28);
    TARGET_VAL : Decimal;
    COLL_NO : String(10);
    DOC_COND : String(10);
    PROCEDURE : String(6);
    UPDATE_GRP : String(6);
    DIFF_INV : String(10);
    EXPORT_NO : String(10);
    OUR_REF : String(12);
    LOGSYSTEM : String(10);
    @RFCAbapType : 'N'
    SUBITEMINT : String(5);
    MAST_COND : String(1);
    REL_GROUP : String(2);
    REL_STRAT : String(2);
    REL_IND : String(1);
    REL_STATUS : String(8);
    SUBJ_TO_R : String(1);
    TAXR_CNTRY : String(3);
    SCHED_IND : String(1);
    CURRENCY_ISO : String(3);
    EXCH_RATE_CM : Decimal;
  };

  type DDIC.BAPIEKPO {
    PO_NUMBER : String(10);
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    DELETE_IND : String(1);
    STATUS : String(1);
    CHANGED_ON : Date;
    SHORT_TEXT : String(40);
    MATERIAL : String(18);
    PUR_MAT : String(18);
    CO_CODE : String(4);
    PLANT : String(4);
    STORE_LOC : String(4);
    TRACKINGNO : String(10);
    MAT_GRP : String(9);
    INFO_REC : String(10);
    VEND_MAT : String(22);
    TARGET_QTY : Decimal;
    QUANTITY : Decimal;
    UNIT : String(3);
    ORDERPR_UN : String(3);
    CONV_NUM1 : Decimal;
    CONV_DEN1 : Decimal;
    CONV_NUM2 : Decimal;
    CONV_DEN2 : Decimal;
    NET_PRICE : Decimal;
    PRICE_UNIT : Decimal;
    NET_VALUE : Decimal;
    GROS_VALUE : Decimal;
    QUOT_DEAD : Date;
    GR_PR_TIME : Decimal;
    TAX_CODE : String(2);
    SETT_GRP1 : String(2);
    QUAL_INSP : String(1);
    INFO_UPD : String(1);
    PRNT_PRICE : String(1);
    EST_PRICE : String(1);
    NUM_REMIND : Decimal;
    REMINDER1 : Decimal;
    REMINDER2 : Decimal;
    REMINDER3 : Decimal;
    OVERDELTOL : Decimal;
    UNLIMITED : String(1);
    UNDER_TOL : Decimal;
    VAL_TYPE : String(10);
    VAL_CAT : String(1);
    REJ_IND : String(1);
    COMMENT : String(3);
    DEL_COMPL : String(1);
    FINAL_INV : String(1);
    ITEM_CAT : String(1);
    ACCTASSCAT : String(1);
    CONSUMPT : String(1);
    DISTRIB : String(1);
    PART_INV : String(1);
    GR_IND : String(1);
    GR_NON_VAL : String(1);
    IR_IND : String(1);
    GR_BASEDIV : String(1);
    ACKN_REQD : String(1);
    ACKNOWL_NO : String(20);
    AGREEMENT : String(10);
    @RFCAbapType : 'N'
    AGMT_ITEM : String(5);
    RECON_DATE : Date;
    AGRCUMQTY : Decimal;
    FIRM_ZONE : Decimal;
    TRADE_OFF : Decimal;
    BOM_EXPL : String(1);
    EXCLUSION : String(1);
    BASE_UNIT : String(3);
    SHIPPING : String(2);
    OUTL_TARGV : Decimal;
    NOND_ITAX : Decimal;
    RELORD_QTY : Decimal;
    PRICE_DATE : Date;
    DOC_CAT : String(1);
    EFF_VALUE : Decimal;
    COMMITMENT : String(1);
    CUSTOMER : String(10);
    ADDRESS : String(10);
    COND_GROUP : String(4);
    NO_C_DISC : String(1);
    UPDATE_GRP : String(6);
    PLAN_DEL : Decimal;
    NET_WEIGHT : Decimal;
    WEIGHTUNIT : String(3);
    TAX_JUR_CD : String(15);
    PRINT_REL : String(1);
    SPEC_STOCK : String(1);
    @RFCAbapType : 'N'
    SETRESERNO : String(10);
    @RFCAbapType : 'N'
    SETTLITMNO : String(4);
    NOT_CHGBL : String(1);
    CTR_KEY_QM : String(8);
    CERT_TYPE : String(4);
    EAN_UPC : String(18);
    CONF_CTRL : String(4);
    REV_LEV : String(2);
    FUND : String(10);
    FUNDS_CTR : String(16);
    CMMT_ITEM : String(14);
    BA_PARTNER : String(4);
    PTR_ASS_BA : String(4);
    PROFIT_CTR : String(10);
    PARTNER_PC : String(10);
    PRICE_CTR : String(1);
    GROSS_WGHT : Decimal;
    VOLUME : Decimal;
    VOLUMEUNIT : String(3);
    INCOTERMS1 : String(3);
    INCOTERMS2 : String(28);
    ADVANCE : String(1);
    PRIOR_VEND : String(10);
    SUB_RANGE : String(6);
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    STATISTIC : String(1);
    @RFCAbapType : 'N'
    HL_ITEM : String(5);
    GR_TO_DATE : Date;
    SUPPL_VEND : String(10);
    SC_VENDOR : String(1);
    CONF_MATL : String(18);
    MAT_CAT : String(2);
    KANBAN_IND : String(1);
    ADDRESS2 : String(10);
    @RFCAbapType : 'N'
    INT_OBJ_NO : String(18);
    ERS : String(1);
    GRSETTFROM : Date;
    LAST_TRANS : Date;
    TRANS_TIME : Time;
    @RFCAbapType : 'N'
    SER_NO : String(4);
    PROMOTION : String(10);
    ALLOC_TBL : String(10);
    @RFCAbapType : 'N'
    AT_ITEM : String(5);
    POINTS : Decimal;
    POINTS_UN : String(3);
    SEASON_TY : String(4);
    SEASON_YR : String(4);
    SETT_GRP_2 : String(2);
    SETT_GRP_3 : String(2);
    SETT_ITEM : String(1);
    ML_AKT : String(1);
    REMSHLIFE : Decimal;
    RFQ : String(10);
    @RFCAbapType : 'N'
    RFQ_ITEM : String(5);
    CONFIG_ORG : String(1);
    QUOTAUSAGE : String(1);
    SPSTCK_PHY : String(1);
    PREQ_NO : String(10);
    @RFCAbapType : 'N'
    PREQ_ITEM : String(5);
    MAT_TYPE : String(4);
    SI_CAT : String(1);
    SUB_ITEMS : String(1);
    SUBTOTAL_1 : Decimal;
    SUBTOTAL_2 : Decimal;
    SUBTOTAL_3 : Decimal;
    SUBTOTAL_4 : Decimal;
    SUBTOTAL_5 : Decimal;
    SUBTOTAL_6 : Decimal;
    SUBITM_KEY : String(3);
    MAX_CMG : Decimal;
    MAX_CPGO : Decimal;
    RET_ITEM : String(1);
    AT_RELEV : String(1);
    ORD_REAS : String(3);
    DEL_TYP_RT : String(4);
    PRDTE_CTRL : String(8);
    MANUF_PROF : String(4);
    MANU_MAT : String(40);
    MFR_NO : String(10);
    MFR_NO_EXT : String(10);
    ITEM_CAT_EXT : String(1);
    PO_UNIT_ISO : String(3);
    ORDERPR_UN_ISO : String(3);
    BASE_UOM_ISO : String(3);
    WEIGHTUNIT_ISO : String(3);
    VOLUMEUNIT_ISO : String(3);
    POINTS_UN_ISO : String(3);
    CONF_MATL_EXTERNAL : String(40);
    CONF_MATL_GUID : String(32);
    CONF_MATL_VERSION : String(10);
    MATERIAL_EXTERNAL : String(40);
    MATERIAL_GUID : String(32);
    MATERIAL_VERSION : String(10);
    PUR_MAT_EXTERNAL : String(40);
    PUR_MAT_GUID : String(32);
    PUR_MAT_VERSION : String(10);
    GRANT_NBR : String(20);
    CMMT_ITEM_LONG : String(24);
    FUNC_AREA_LONG : String(16);
    BUDGET_PERIOD : String(10);
    MATERIAL_LONG : String(40);
    PUR_MAT_LONG : String(40);
    CONF_MATL_LONG : String(40);
  };

  type DDIC.BAPI0002_3 {
    ADDR_NO : String(10);
    FORMOFADDR : String(20);
    NAME : String(40);
    NAME_2 : String(40);
    NAME_3 : String(40);
    NAME_4 : String(40);
    C_O_NAME : String(40);
    CITY : String(40);
    DISTRICT : String(40);
    CITY_NO : String(12);
    POSTL_COD1 : String(10);
    POSTL_COD2 : String(10);
    POSTL_COD3 : String(10);
    PO_BOX : String(10);
    PO_BOX_CIT : String(40);
    DELIV_DIS : String(15);
    STREET : String(40);
    STREET_NO : String(12);
    STR_ABBR : String(2);
    HOUSE_NO : String(10);
    STR_SUPPL1 : String(40);
    STR_SUPPL2 : String(40);
    LOCATION : String(40);
    BUILDING : String(10);
    FLOOR : String(10);
    ROOM_NO : String(10);
    COUNTRY : String(3);
    LANGU : String(1);
    REGION : String(3);
    SORT1 : String(20);
    SORT2 : String(20);
    TIME_ZONE : String(6);
    TAXJURCODE : String(15);
    ADR_NOTES : String(50);
    COMM_TYPE : String(3);
    TEL1_NUMBR : String(30);
    TEL1_EXT : String(10);
    FAX_NUMBER : String(30);
    FAX_EXTENS : String(10);
  };

  type DDIC.BAPI0002_2 {
    COMP_CODE : String(4);
    COMP_NAME : String(25);
    CITY : String(25);
    COUNTRY : String(3);
    CURRENCY : String(5);
    LANGU : String(1);
    CHRT_ACCTS : String(4);
    FY_VARIANT : String(2);
    VAT_REG_NO : String(20);
    COMPANY : String(6);
    ADDR_NO : String(10);
    COUNTRY_ISO : String(2);
    CURRENCY_ISO : String(3);
    LANGU_ISO : String(2);
  };

  type DDIC.BAPIVENDOR_04 {
    VENDOR : String(10);
    NAME : String(35);
    NAME_2 : String(35);
    NAME_3 : String(35);
    NAME_4 : String(35);
    CITY : String(35);
    DISTRICT : String(35);
    PO_BOX : String(10);
    POBX_PCD : String(10);
    POSTL_CODE : String(10);
    REGION : String(3);
    STREET : String(35);
    COUNTRY : String(3);
    COUNTRYISO : String(2);
    POBX_CTY : String(35);
    LANGU : String(1);
    LANGU_ISO : String(2);
    TELEPHONE : String(16);
    FORMOFADDR : String(15);
    TELEPHONE2 : String(16);
  };

  type DDIC.BAPIVENDOR_05 {
    VENDOR : String(10);
    COMP_CODE : String(4);
    CLERK : String(2);
    HD_OFFICE : String(10);
    ALT_PAYEE : String(10);
    CUVD_CLEAR : String(1);
    PMNTTRMS : String(4);
    ACT_AT_VEN : String(12);
    VEND_USER : String(15);
    INTERNET : String(130);
    FAX : String(31);
    PAYMENT_METHODS : String(10);
    TEL : String(30);
  };

  type DDIC.BAPIRET1 {
    TYPE : String(1);
    ID : String(20);
    @RFCAbapType : 'N'
    NUMBER : String(3);
    MESSAGE : String(220);
    LOG_NO : String(20);
    @RFCAbapType : 'N'
    LOG_MSG_NO : String(6);
    MESSAGE_V1 : String(50);
    MESSAGE_V2 : String(50);
    MESSAGE_V3 : String(50);
    MESSAGE_V4 : String(50);
  };

  type DDIC.BBP_CREDIT {
    VENDOR_NO : String(10);
    NAME : String(30);
  };

  type DDIC.BAPIACCAHD {
    DOC_NO : String(12);
    DOC_TYPE_CA : String(2);
    RES_KEY : String(30);
    FIKEY : String(12);
    PAYMENT_FORM_REF : String(30);
  };

  type DDIC.BAPIACPA09 {
    NAME : String(35);
    NAME_2 : String(35);
    NAME_3 : String(35);
    NAME_4 : String(35);
    POSTL_CODE : String(10);
    CITY : String(35);
    COUNTRY : String(3);
    COUNTRY_ISO : String(2);
    STREET : String(35);
    PO_BOX : String(10);
    POBX_PCD : String(10);
    POBK_CURAC : String(16);
    BANK_ACCT : String(18);
    BANK_NO : String(15);
    BANK_CTRY : String(3);
    BANK_CTRY_ISO : String(2);
    TAX_NO_1 : String(16);
    TAX_NO_2 : String(11);
    TAX : String(1);
    EQUAL_TAX : String(1);
    REGION : String(3);
    CTRL_KEY : String(2);
    INSTR_KEY : String(2);
    DME_IND : String(1);
    LANGU_ISO : String(2);
    IBAN : String(34);
    SWIFT_CODE : String(11);
    TAX_NO_3 : String(18);
    TAX_NO_4 : String(18);
    TITLE : String(15);
    TAX_NO_5 : String(60);
    GLO_RE1_OT : String(140);
    SOLE_PROP : String(1);
    TAX_NO_TY : String(2);
  };

  type DDIC.BAPIACHE09 {
    OBJ_TYPE : String(5);
    OBJ_KEY : String(20);
    OBJ_SYS : String(10);
    BUS_ACT : String(4);
    USERNAME : String(12);
    HEADER_TXT : String(25);
    COMP_CODE : String(4);
    DOC_DATE : Date;
    PSTNG_DATE : Date;
    TRANS_DATE : Date;
    @RFCAbapType : 'N'
    FISC_YEAR : String(4);
    @RFCAbapType : 'N'
    FIS_PERIOD : String(2);
    DOC_TYPE : String(2);
    REF_DOC_NO : String(16);
    AC_DOC_NO : String(10);
    OBJ_KEY_R : String(20);
    REASON_REV : String(2);
    COMPO_ACC : String(4);
    REF_DOC_NO_LONG : String(35);
    ACC_PRINCIPLE : String(4);
    NEG_POSTNG : String(1);
    OBJ_KEY_INV : String(20);
    BILL_CATEGORY : String(1);
    VATDATE : Date;
    INVOICE_REC_DATE : Date;
    ECS_ENV : String(10);
    PARTIAL_REV : String(1);
    DOC_STATUS : String(1);
    TAX_CALC_DATE : Date;
    GLO_REF1_HD : String(80);
    GLO_DAT1_HD : Date;
    GLO_REF2_HD : String(25);
    GLO_DAT2_HD : Date;
    GLO_REF3_HD : String(25);
    GLO_DAT3_HD : Date;
    GLO_REF4_HD : String(50);
    GLO_DAT4_HD : Date;
    GLO_REF5_HD : String(50);
    GLO_DAT5_HD : Date;
    GLO_BP1_HD : String(10);
    GLO_BP2_HD : String(10);
    EV_POSTNG_CTRL : String(1);
    LEDGER_GROUP : String(4);
    PLANNED_REV_DATE : Date;
    BUS_TRANSACTION_TYPE : String(4);
    @RFCAbapType : 'N'
    CLOSINGSTEP : String(3);
    FULFILLDATE : Date;
  };

  type DDIC.BAPIACGL09 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    GL_ACCOUNT : String(10);
    ITEM_TEXT : String(50);
    STAT_CON : String(1);
    LOG_PROC : String(6);
    AC_DOC_NO : String(10);
    REF_KEY_1 : String(12);
    REF_KEY_2 : String(12);
    REF_KEY_3 : String(20);
    ACCT_KEY : String(3);
    ACCT_TYPE : String(1);
    DOC_TYPE : String(2);
    COMP_CODE : String(4);
    BUS_AREA : String(4);
    FUNC_AREA : String(4);
    PLANT : String(4);
    @RFCAbapType : 'N'
    FIS_PERIOD : String(2);
    @RFCAbapType : 'N'
    FISC_YEAR : String(4);
    PSTNG_DATE : Date;
    VALUE_DATE : Date;
    FM_AREA : String(4);
    CUSTOMER : String(10);
    CSHDIS_IND : String(1);
    VENDOR_NO : String(10);
    ALLOC_NMBR : String(18);
    TAX_CODE : String(2);
    TAXJURCODE : String(15);
    EXT_OBJECT_ID : String(34);
    BUS_SCENARIO : String(16);
    COSTOBJECT : String(12);
    COSTCENTER : String(10);
    ACTTYPE : String(6);
    PROFIT_CTR : String(10);
    PART_PRCTR : String(10);
    NETWORK : String(12);
    WBS_ELEMENT : String(24);
    ORDERID : String(12);
    @RFCAbapType : 'N'
    ORDER_ITNO : String(4);
    @RFCAbapType : 'N'
    ROUTING_NO : String(10);
    ACTIVITY : String(4);
    COND_TYPE : String(4);
    @RFCAbapType : 'N'
    COND_COUNT : String(2);
    @RFCAbapType : 'N'
    COND_ST_NO : String(3);
    FUND : String(10);
    FUNDS_CTR : String(16);
    CMMT_ITEM : String(14);
    CO_BUSPROC : String(12);
    ASSET_NO : String(12);
    SUB_NUMBER : String(4);
    BILL_TYPE : String(4);
    SALES_ORD : String(10);
    @RFCAbapType : 'N'
    S_ORD_ITEM : String(6);
    DISTR_CHAN : String(2);
    DIVISION : String(2);
    SALESORG : String(4);
    SALES_GRP : String(3);
    SALES_OFF : String(4);
    SOLD_TO : String(10);
    DE_CRE_IND : String(1);
    P_EL_PRCTR : String(10);
    XMFRW : String(1);
    QUANTITY : Decimal;
    BASE_UOM : String(3);
    BASE_UOM_ISO : String(3);
    INV_QTY : Decimal;
    INV_QTY_SU : Decimal;
    SALES_UNIT : String(3);
    SALES_UNIT_ISO : String(3);
    PO_PR_QNT : Decimal;
    PO_PR_UOM : String(3);
    PO_PR_UOM_ISO : String(3);
    ENTRY_QNT : Decimal;
    ENTRY_UOM : String(3);
    ENTRY_UOM_ISO : String(3);
    VOLUME : Decimal;
    VOLUMEUNIT : String(3);
    VOLUMEUNIT_ISO : String(3);
    GROSS_WT : Decimal;
    NET_WEIGHT : Decimal;
    UNIT_OF_WT : String(3);
    UNIT_OF_WT_ISO : String(3);
    ITEM_CAT : String(1);
    MATERIAL : String(18);
    MATL_TYPE : String(4);
    MVT_IND : String(1);
    REVAL_IND : String(1);
    ORIG_GROUP : String(4);
    ORIG_MAT : String(1);
    @RFCAbapType : 'N'
    SERIAL_NO : String(2);
    PART_ACCT : String(10);
    TR_PART_BA : String(4);
    TRADE_ID : String(6);
    VAL_AREA : String(4);
    VAL_TYPE : String(10);
    ASVAL_DATE : Date;
    PO_NUMBER : String(10);
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    ITM_NUMBER : String(6);
    COND_CATEGORY : String(1);
    FUNC_AREA_LONG : String(16);
    CMMT_ITEM_LONG : String(24);
    GRANT_NBR : String(20);
    CS_TRANS_T : String(3);
    MEASURE : String(24);
    SEGMENT : String(10);
    PARTNER_SEGMENT : String(10);
    RES_DOC : String(10);
    @RFCAbapType : 'N'
    RES_ITEM : String(3);
    BILLING_PERIOD_START_DATE : Date;
    BILLING_PERIOD_END_DATE : Date;
    PPA_EX_IND : String(1);
    FASTPAY : String(1);
    PARTNER_GRANT_NBR : String(20);
    BUDGET_PERIOD : String(10);
    PARTNER_BUDGET_PERIOD : String(10);
    PARTNER_FUND : String(10);
    @RFCAbapType : 'N'
    ITEMNO_TAX : String(6);
    PAYMENT_TYPE : String(4);
    EXPENSE_TYPE : String(4);
    PROGRAM_PROFILE : String(10);
    MATERIAL_LONG : String(40);
    HOUSEBANKID : String(5);
    HOUSEBANKACCTID : String(5);
    @RFCAbapType : 'N'
    PERSON_NO : String(8);
    ACROBJ_TYPE : String(4);
    ACROBJ_ID : String(32);
    ACRSUBOBJ_ID : String(32);
    ACRITEM_TYPE : String(11);
    VALOBJTYPE : String(4);
    VALOBJ_ID : String(32);
    VALSUBOBJ_ID : String(32);
    TAX_CALC_DATE : Date;
    TAX_CALC_DT_FROM : Date;
    SERVICE_DOC_TYPE : String(4);
    SERVICE_DOC_ID : String(10);
    @RFCAbapType : 'N'
    SERVICE_DOC_ITEM_ID : String(6);
    BDGT_ACCOUNT : String(10);
    TAX_COUNTRY : String(3);
    GLO_REF1 : String(50);
    ACRLOGSYS : String(10);
    ACRVALDAT : Date;
    WORK_ITEM_ID : String(10);
    BUSINESSPLACE : String(4);
    JOINT_VENTURE : String(6);
    RECOVERY_IND : String(2);
    EQUITY_GROUP : String(3);
  };

  type DDIC.BAPIACAP09 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    VENDOR_NO : String(10);
    GL_ACCOUNT : String(10);
    REF_KEY_1 : String(12);
    REF_KEY_2 : String(12);
    REF_KEY_3 : String(20);
    COMP_CODE : String(4);
    BUS_AREA : String(4);
    PMNTTRMS : String(4);
    BLINE_DATE : Date;
    DSCT_DAYS1 : Decimal;
    DSCT_DAYS2 : Decimal;
    NETTERMS : Decimal;
    DSCT_PCT1 : Decimal;
    DSCT_PCT2 : Decimal;
    PYMT_METH : String(1);
    PMTMTHSUPL : String(2);
    PMNT_BLOCK : String(1);
    SCBANK_IND : String(3);
    SUPCOUNTRY : String(3);
    SUPCOUNTRY_ISO : String(2);
    BLLSRV_IND : String(1);
    ALLOC_NMBR : String(18);
    ITEM_TEXT : String(50);
    PO_SUB_NO : String(11);
    PO_CHECKDG : String(2);
    PO_REF_NO : String(27);
    W_TAX_CODE : String(2);
    BUSINESSPLACE : String(4);
    SECTIONCODE : String(4);
    @RFCAbapType : 'N'
    INSTR1 : String(2);
    @RFCAbapType : 'N'
    INSTR2 : String(2);
    @RFCAbapType : 'N'
    INSTR3 : String(2);
    @RFCAbapType : 'N'
    INSTR4 : String(2);
    BRANCH : String(10);
    PYMT_CUR : String(5);
    PYMT_AMT : Decimal;
    PYMT_CUR_ISO : String(3);
    SP_GL_IND : String(1);
    TAX_CODE : String(2);
    TAX_DATE : Date;
    TAXJURCODE : String(15);
    ALT_PAYEE : String(10);
    ALT_PAYEE_BANK : String(4);
    PARTNER_BK : String(4);
    BANK_ID : String(5);
    PARTNER_GUID : String(32);
    PROFIT_CTR : String(10);
    FUND : String(10);
    GRANT_NBR : String(20);
    MEASURE : String(24);
    HOUSEBANKACCTID : String(5);
    BUDGET_PERIOD : String(10);
    PPA_EX_IND : String(1);
    PART_BUSINESSPLACE : String(5);
    PAYMT_REF : String(30);
    PYMT_AMT_LONG : Decimal;
    BDGT_ACCOUNT : String(10);
    GLO_REF1 : String(50);
    TAX_COUNTRY : String(3);
    VAT_REG_NO : String(20);
    PAYT_RSN : String(4);
    JOINT_VENTURE : String(6);
    RECOVERY_IND : String(2);
    EQUITY_GROUP : String(3);
  };

  type DDIC.BAPIACAR09 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    CUSTOMER : String(10);
    GL_ACCOUNT : String(10);
    REF_KEY_1 : String(12);
    REF_KEY_2 : String(12);
    REF_KEY_3 : String(20);
    COMP_CODE : String(4);
    BUS_AREA : String(4);
    PMNTTRMS : String(4);
    BLINE_DATE : Date;
    DSCT_DAYS1 : Decimal;
    DSCT_DAYS2 : Decimal;
    NETTERMS : Decimal;
    DSCT_PCT1 : Decimal;
    DSCT_PCT2 : Decimal;
    PYMT_METH : String(1);
    PMTMTHSUPL : String(2);
    PAYMT_REF : String(30);
    DUNN_KEY : String(1);
    DUNN_BLOCK : String(1);
    PMNT_BLOCK : String(1);
    VAT_REG_NO : String(20);
    ALLOC_NMBR : String(18);
    ITEM_TEXT : String(50);
    PARTNER_BK : String(4);
    SCBANK_IND : String(3);
    BUSINESSPLACE : String(4);
    SECTIONCODE : String(4);
    BRANCH : String(10);
    PYMT_CUR : String(5);
    PYMT_CUR_ISO : String(3);
    PYMT_AMT : Decimal;
    C_CTR_AREA : String(4);
    BANK_ID : String(5);
    SUPCOUNTRY : String(3);
    SUPCOUNTRY_ISO : String(2);
    TAX_CODE : String(2);
    TAXJURCODE : String(15);
    TAX_DATE : Date;
    SP_GL_IND : String(1);
    PARTNER_GUID : String(32);
    ALT_PAYEE : String(10);
    ALT_PAYEE_BANK : String(4);
    DUNN_AREA : String(2);
    CASE_GUID : String(32);
    PROFIT_CTR : String(10);
    FUND : String(10);
    GRANT_NBR : String(20);
    MEASURE : String(24);
    HOUSEBANKACCTID : String(5);
    RES_DOC : String(10);
    @RFCAbapType : 'N'
    RES_ITEM : String(3);
    FUND_LONG : String(20);
    DISPUTE_IF_TYPE : String(1);
    BUDGET_PERIOD : String(10);
    PAYS_PROV : String(4);
    PAYS_TRAN : String(35);
    SEPA_MANDATE_ID : String(35);
    PART_BUSINESSPLACE : String(5);
    REP_COUNTRY_EU : String(3);
    PYMT_AMT_LONG : Decimal;
    SALES_ORD : String(10);
    @RFCAbapType : 'N'
    S_ORD_ITEM : String(6);
    BDGT_ACCOUNT : String(10);
    GLO_REF1 : String(50);
    TAX_COUNTRY : String(3);
    BILLING_IND : String(2);
    PAYT_RSN : String(4);
    EU_TRIANG_DEAL : String(1);
    JOINT_VENTURE : String(6);
    RECOVERY_IND : String(2);
    EQUITY_GROUP : String(3);
  };

  type DDIC.BAPIACTX09 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    GL_ACCOUNT : String(10);
    COND_KEY : String(4);
    ACCT_KEY : String(3);
    TAX_CODE : String(2);
    TAX_RATE : Decimal;
    TAX_DATE : Date;
    TAXJURCODE : String(15);
    TAXJURCODE_DEEP : String(15);
    TAXJURCODE_LEVEL : String(1);
    @RFCAbapType : 'N'
    ITEMNO_TAX : String(6);
    DIRECT_TAX : String(1);
    TAX_CALC_DT_FROM : Date;
    TAX_COUNTRY : String(3);
  };

  type DDIC.BAPIACWT09 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    WT_TYPE : String(2);
    WT_CODE : String(2);
    BAS_AMT_LC : Decimal;
    BAS_AMT_TC : Decimal;
    BAS_AMT_L2 : Decimal;
    BAS_AMT_L3 : Decimal;
    MAN_AMT_LC : Decimal;
    MAN_AMT_TC : Decimal;
    MAN_AMT_L2 : Decimal;
    MAN_AMT_L3 : Decimal;
    AWH_AMT_LC : Decimal;
    AWH_AMT_TC : Decimal;
    AWH_AMT_L2 : Decimal;
    AWH_AMT_L3 : Decimal;
    BAS_AMT_IND : String(1);
    MAN_AMT_IND : String(1);
    BAS_AMT_LC_LONG : Decimal;
    BAS_AMT_TC_LONG : Decimal;
    BAS_AMT_L2_LONG : Decimal;
    BAS_AMT_L3_LONG : Decimal;
    MAN_AMT_LC_LONG : Decimal;
    MAN_AMT_TC_LONG : Decimal;
    MAN_AMT_L2_LONG : Decimal;
    MAN_AMT_L3_LONG : Decimal;
    AWH_AMT_LC_LONG : Decimal;
    AWH_AMT_TC_LONG : Decimal;
    AWH_AMT_L2_LONG : Decimal;
    AWH_AMT_L3_LONG : Decimal;
  };

  type DDIC.BAPIACCAIT {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    CONT_ACCT : String(12);
    MAIN_TRANS : String(4);
    SUB_TRANS : String(4);
    FUNC_AREA : String(4);
    FM_AREA : String(4);
    CMMT_ITEM : String(14);
    FUNDS_CTR : String(16);
    FUND : String(10);
    AGREEMENT_GUID : Binary(16);
    FUNC_AREA_LONG : String(16);
    CMMT_ITEM_LONG : String(24);
    GRANT_NBR : String(20);
    VTREF : String(20);
    VTREF_GUID : Binary(16);
    EXT_OBJECT_ID : String(34);
    BUS_SCENARIO : String(16);
    REFERENCE_NO : String(16);
    BUDGET_PERIOD : String(10);
  };

  type DDIC.BAPIACKEC9 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    FIELDNAME : String(30);
    CHARACTER : String(18);
    PROD_NO_LONG : String(40);
    CUST_CHAR_VALUE_LONG : String(40);
  };

  type DDIC.BAPIACCR09 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    CURR_TYPE : String(2);
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    AMT_DOCCUR : Decimal;
    EXCH_RATE : Decimal;
    EXCH_RATE_V : Decimal;
    AMT_BASE : Decimal;
    DISC_BASE : Decimal;
    DISC_AMT : Decimal;
    TAX_AMT : Decimal;
    AMT_DOCCUR_LONG : Decimal;
    AMT_BASE_LONG : Decimal;
    DISC_BASE_LONG : Decimal;
    DISC_AMT_LONG : Decimal;
    TAX_AMT_LONG : Decimal;
  };

  type DDIC.BAPIACEXTC {
    FIELD1 : String(250);
    FIELD2 : String(250);
    FIELD3 : String(250);
    FIELD4 : String(250);
  };

  type DDIC.BAPIPAREX {
    STRUCTURE : String(30);
    VALUEPART1 : String(240);
    VALUEPART2 : String(240);
    VALUEPART3 : String(240);
    VALUEPART4 : String(240);
  };

  type DDIC.BAPIACPC09 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    CC_GLACCOUNT : String(10);
    CC_TYPE : String(4);
    CC_NUMBER : String(25);
    CC_SEQ_NO : String(10);
    CC_VALID_F : Date;
    CC_VALID_T : Date;
    CC_NAME : String(40);
    DATAORIGIN : String(1);
    AUTHAMOUNT : Decimal;
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    CC_AUTTH_NO : String(10);
    AUTH_REFNO : String(15);
    AUTH_DATE : Date;
    AUTH_TIME : Time;
    MERCHIDCL : String(15);
    POINT_OF_RECEIPT : String(10);
    TERMINAL : String(10);
    CCTYP : String(2);
    AUTHAMOUNT_LONG : Decimal;
  };

  type DDIC.BAPIACRE09 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    BUSINESS_ENTITY : String(8);
    BUILDING : String(8);
    PROPERTY : String(8);
    RENTAL_OBJECT : String(8);
    SERV_CHARGE_KEY : String(4);
    SETTLEMENT_UNIT : String(5);
    CONTRACT_NO : String(13);
    FLOW_TYPE : String(4);
    CORR_ITEM : String(10);
    REF_DATE : Date;
    OPTION_RATE : Decimal;
  };

  type DDIC.BAPIRET2 {
    TYPE : String(1);
    ID : String(20);
    @RFCAbapType : 'N'
    NUMBER : String(3);
    MESSAGE : String(220);
    LOG_NO : String(20);
    @RFCAbapType : 'N'
    LOG_MSG_NO : String(6);
    MESSAGE_V1 : String(50);
    MESSAGE_V2 : String(50);
    MESSAGE_V3 : String(50);
    MESSAGE_V4 : String(50);
    PARAMETER : String(32);
    ROW : Integer;
    FIELD : String(30);
    SYSTEM : String(10);
  };

  type DDIC.BAPIACKEV9 {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    FIELDNAME : String(30);
    CURR_TYPE : String(2);
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    AMT_VALCOM : Decimal;
    BASE_UOM : String(3);
    BASE_UOM_ISO : String(3);
    QUA_VALCOM : Decimal;
    AMT_VALCOM_LONG : Decimal;
  };

  type DDIC.BORIDENT {
    OBJKEY : String(70);
    OBJTYPE : String(10);
    LOGSYS : String(10);
  };

  type DDIC.GBINREL {
    ROLE_A : String(22);
    ROLE_B : String(22);
    RELATIONID : String(22);
    BRELTYP : String(4);
    UTCTIME : Decimal;
  };

  type DDIC.BRELATTR {
    ATTRIBUT : String(10);
    @RFCAbapType : 'N'
    POSNR : String(4);
    GATTRDATA : String(250);
  };
};

