/* checksum : 8515ae429a22b4d9e40941fae6a66c97 */
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
    @RFCParameterType : 'Import'
    OBJ_ROLEA : DDIC.BORIDENT not null,
    @RFCParameterType : 'Import'
    OBJ_ROLEB : DDIC.BORIDENT not null,
    @RFCParameterType : 'Import'
    RELATIONTYPE : String(4) not null,
    @RFCParameterType : 'Table'
    BINREL_ATTRIB : many DDIC.BRELATTR
  ) returns BINARY_RELATION_CREATE_COMMIT.ResultType;

  type BINARY_RELATION_CREATE_COMMIT.ResultType {
    @RFCParameterType : 'Export'
    BINREL : DDIC.GBINREL;
    @RFCParameterType : 'Table'
    BINREL_ATTRIB : many DDIC.BRELATTR;
  };

  action BAPI_PROFITCENTER_GETLIST(
    @RFCParameterType : 'Import'
    CONTROLLINGAREA : String(4) not null,
    @RFCParameterType : 'Import'
    DATE : Date default ' ',
    @RFCParameterType : 'Import'
    IN_CHARGE_USER : String(12) default '%',
    @RFCParameterType : 'Import'
    PERSONINCHARGE : String(20) default '%',
    @RFCParameterType : 'Table'
    PROFITCENTER_LIST : many DDIC.BAPI0015_1
  ) returns BAPI_PROFITCENTER_GETLIST.ResultType;

  type BAPI_PROFITCENTER_GETLIST.ResultType {
    @RFCParameterType : 'Export'
    RETURN : DDIC.BAPIRETURN;
    @RFCParameterType : 'Table'
    PROFITCENTER_LIST : many DDIC.BAPI0015_1;
  };

  action BAPI_INCOMINGINVOICE_CANCEL(
    @RFCAbapType : 'N'
    @RFCParameterType : 'Import'
    FISCALYEAR : String(4) not null,
    @RFCParameterType : 'Import'
    INVOICEDOCNUMBER : String(10) not null,
    @RFCParameterType : 'Import'
    POSTINGDATE : Date,
    @RFCParameterType : 'Import'
    REASONREVERSAL : String(2) not null,
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2
  ) returns BAPI_INCOMINGINVOICE_CANCEL.ResultType;

  type BAPI_INCOMINGINVOICE_CANCEL.ResultType {
    @RFCAbapType : 'N'
    @RFCParameterType : 'Export'
    FISCALYEAR_REVERSAL : String(4);
    @RFCParameterType : 'Export'
    INVOICEDOCNUMBER_REVERSAL : String(10);
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2;
  };

  action BAPI_ACC_DOCUMENT_REV_POST(
    @RFCParameterType : 'Import'
    BUS_ACT : String(4) not null,
    @RFCParameterType : 'Import'
    REVERSAL : DDIC.BAPIACREV not null,
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2
  ) returns BAPI_ACC_DOCUMENT_REV_POST.ResultType;

  type BAPI_ACC_DOCUMENT_REV_POST.ResultType {
    @RFCParameterType : 'Export'
    OBJ_KEY : String(20);
    @RFCParameterType : 'Export'
    OBJ_SYS : String(10);
    @RFCParameterType : 'Export'
    OBJ_TYPE : String(5);
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2;
  };

  action BBP_CALCULATE_TAX_FRM_NET_40B(
    @RFCParameterType : 'Import'
    I_BUKRS : String(4) not null,
    @RFCParameterType : 'Import'
    I_MWSKZ : String(2) not null,
    @RFCParameterType : 'Import'
    I_PROTOKOLL : String(1),
    @RFCParameterType : 'Import'
    I_PRSDT : Date,
    @RFCParameterType : 'Import'
    I_TXJCD : String(15),
    @RFCParameterType : 'Import'
    I_WAERS : String(5) not null,
    @RFCParameterType : 'Import'
    I_WRBTR : Decimal not null,
    @RFCParameterType : 'Import'
    I_ZBD1P : Decimal,
    @RFCParameterType : 'Table'
    T_MWDAT : many DDIC.RTAX1U15
  ) returns BBP_CALCULATE_TAX_FRM_NET_40B.ResultType;

  type BBP_CALCULATE_TAX_FRM_NET_40B.ResultType {
    @RFCParameterType : 'Export'
    E_FWAST : Decimal;
    @RFCParameterType : 'Export'
    E_FWNAV : Decimal;
    @RFCParameterType : 'Export'
    E_FWNVV : Decimal;
    @RFCParameterType : 'Export'
    E_FWSTE : Decimal;
    @RFCParameterType : 'Table'
    T_MWDAT : many DDIC.RTAX1U15;
  };

  action Z_VIM_CALCULATE_TAX_FROM_NET(
    @RFCParameterType : 'Import'
    I_BUKRS : String(4) not null,
    @RFCParameterType : 'Import'
    I_MWSKZ : String(2) not null,
    @RFCParameterType : 'Import'
    I_PROTOKOLL : String(1),
    @RFCParameterType : 'Import'
    I_PRSDT : Date not null,
    @RFCParameterType : 'Import'
    I_TXJCD : String(15) not null,
    @RFCParameterType : 'Import'
    I_WAERS : String(5) not null,
    @RFCParameterType : 'Import'
    I_WRBTR : Decimal not null,
    @RFCParameterType : 'Import'
    I_ZBD1P : Decimal,
    @RFCParameterType : 'Table'
    T_MWDAT : many DDIC.RTAX1U15
  ) returns Z_VIM_CALCULATE_TAX_FROM_NET.ResultType;

  type Z_VIM_CALCULATE_TAX_FROM_NET.ResultType {
    @RFCParameterType : 'Export'
    E_FWAST : Decimal;
    @RFCParameterType : 'Export'
    E_FWNAV : Decimal;
    @RFCParameterType : 'Export'
    E_FWNVV : Decimal;
    @RFCParameterType : 'Export'
    E_FWSTE : Decimal;
    @RFCParameterType : 'Table'
    T_MWDAT : many DDIC.RTAX1U15;
  };

  action FI_TAX_SERVICES_CALCULATE(
    @RFCParameterType : 'Import'
    ACCOUNTPAYABLE : DDIC.BAPIACAP09_TAB,
    @RFCParameterType : 'Import'
    ACCOUNTRECEIVABLE : DDIC.BAPIACAR09_TAB,
    @RFCParameterType : 'Import'
    ACCOUNTTAX_INPUT : DDIC.BAPIACTX09_TAB,
    @RFCParameterType : 'Import'
    ACCOUNTWT : DDIC.BAPIACWT09_TAB,
    @RFCParameterType : 'Import'
    CRITERIA : DDIC.BAPIACKEC9_TAB,
    @RFCParameterType : 'Import'
    CURRENCYAMOUNT_INPUT : DDIC.BAPIACCR09_TAB,
    @RFCParameterType : 'Import'
    CUSTOMERCPD : DDIC.BAPIACPA09,
    @RFCParameterType : 'Import'
    DIFFERENCE_IS_TAX : String(1),
    @RFCParameterType : 'Import'
    DISTRIBUTION_METHOD : String(1) default 'X',
    @RFCParameterType : 'Import'
    DOCUMENTHEADER : DDIC.BAPIACHE09 not null,
    @RFCParameterType : 'Import'
    EXTENSION1 : DDIC.BAPIACEXTC_TAB,
    @RFCParameterType : 'Import'
    EXTENSION2 : DDIC.BAPIPAREX2_TAB,
    @RFCAbapType : 'N'
    @RFCParameterType : 'Import'
    ITEMNO_ACC_ZERO_BALANCE : String(10),
    @RFCParameterType : 'Import'
    REALESTATE : DDIC.BAPIACRE09_TAB,
    @RFCParameterType : 'Import'
    TAXAMOUNT : Decimal,
    @RFCParameterType : 'Changing'
    ACCOUNTGL : DDIC.BAPIACGL09_TAB,
    @RFCParameterType : 'Changing'
    ACCOUNTTAX : DDIC.BAPIACTX09_TAB,
    @RFCParameterType : 'Changing'
    CURRENCYAMOUNT : DDIC.BAPIACCR09_TAB,
    @RFCParameterType : 'Changing'
    RETURN : DDIC.BAPIRETTAB
  ) returns FI_TAX_SERVICES_CALCULATE.ResultType;

  type FI_TAX_SERVICES_CALCULATE.ResultType {
    @RFCAbapType : 'N'
    @RFCParameterType : 'Export'
    RETURN_CODE : String(2);
    @RFCParameterType : 'Changing'
    ACCOUNTGL : DDIC.BAPIACGL09_TAB;
    @RFCParameterType : 'Changing'
    ACCOUNTTAX : DDIC.BAPIACTX09_TAB;
    @RFCParameterType : 'Changing'
    CURRENCYAMOUNT : DDIC.BAPIACCR09_TAB;
    @RFCParameterType : 'Changing'
    RETURN : DDIC.BAPIRETTAB;
  };

  action BAPI_PO_GETDETAIL(
    @RFCParameterType : 'Import'
    ACCOUNT_ASSIGNMENT : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    CONFIRMATIONS : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    EXTENSIONS : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    HEADER_TEXTS : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    HISTORY : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    ITEMS : String(1) default 'X',
    @RFCParameterType : 'Import'
    ITEM_TEXTS : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    PURCHASEORDER : String(10) not null,
    @RFCParameterType : 'Import'
    SCHEDULES : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    SERVICES : String(1) default 'SPACE',
    @RFCParameterType : 'Import'
    SERVICE_TEXTS : String(1) default 'SPACE',
    @RFCParameterType : 'Table'
    EXTENSIONOUT : many DDIC.BAPIPAREX,
    @RFCParameterType : 'Table'
    PO_HEADER_TEXTS : many DDIC.BAPIEKKOTX,
    @RFCParameterType : 'Table'
    PO_ITEMS : many DDIC.BAPIEKPO,
    @RFCParameterType : 'Table'
    PO_ITEM_ACCOUNT_ASSIGNMENT : many DDIC.BAPIEKKN,
    @RFCParameterType : 'Table'
    PO_ITEM_CONFIRMATIONS : many DDIC.BAPIEKES,
    @RFCParameterType : 'Table'
    PO_ITEM_CONTRACT_LIMITS : many DDIC.BAPIESUC,
    @RFCParameterType : 'Table'
    PO_ITEM_HISTORY : many DDIC.BAPIEKBE,
    @RFCParameterType : 'Table'
    PO_ITEM_HISTORY_TOTALS : many DDIC.BAPIEKBES,
    @RFCParameterType : 'Table'
    PO_ITEM_LIMITS : many DDIC.BAPIESUH,
    @RFCParameterType : 'Table'
    PO_ITEM_SCHEDULES : many DDIC.BAPIEKET,
    @RFCParameterType : 'Table'
    PO_ITEM_SERVICES : many DDIC.BAPIESLL,
    @RFCParameterType : 'Table'
    PO_ITEM_SRV_ACCASS_VALUES : many DDIC.BAPIESKL,
    @RFCParameterType : 'Table'
    PO_ITEM_TEXTS : many DDIC.BAPIEKPOTX,
    @RFCParameterType : 'Table'
    PO_SERVICES_TEXTS : many DDIC.BAPIESLLTX,
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRETURN
  ) returns BAPI_PO_GETDETAIL.ResultType;

  type BAPI_PO_GETDETAIL.ResultType {
    @RFCParameterType : 'Export'
    PO_ADDRESS : DDIC.BAPIADDRESS;
    @RFCParameterType : 'Export'
    PO_HEADER : DDIC.BAPIEKKOL;
    @RFCParameterType : 'Table'
    EXTENSIONOUT : many DDIC.BAPIPAREX;
    @RFCParameterType : 'Table'
    PO_HEADER_TEXTS : many DDIC.BAPIEKKOTX;
    @RFCParameterType : 'Table'
    PO_ITEMS : many DDIC.BAPIEKPO;
    @RFCParameterType : 'Table'
    PO_ITEM_ACCOUNT_ASSIGNMENT : many DDIC.BAPIEKKN;
    @RFCParameterType : 'Table'
    PO_ITEM_CONFIRMATIONS : many DDIC.BAPIEKES;
    @RFCParameterType : 'Table'
    PO_ITEM_CONTRACT_LIMITS : many DDIC.BAPIESUC;
    @RFCParameterType : 'Table'
    PO_ITEM_HISTORY : many DDIC.BAPIEKBE;
    @RFCParameterType : 'Table'
    PO_ITEM_HISTORY_TOTALS : many DDIC.BAPIEKBES;
    @RFCParameterType : 'Table'
    PO_ITEM_LIMITS : many DDIC.BAPIESUH;
    @RFCParameterType : 'Table'
    PO_ITEM_SCHEDULES : many DDIC.BAPIEKET;
    @RFCParameterType : 'Table'
    PO_ITEM_SERVICES : many DDIC.BAPIESLL;
    @RFCParameterType : 'Table'
    PO_ITEM_SRV_ACCASS_VALUES : many DDIC.BAPIESKL;
    @RFCParameterType : 'Table'
    PO_ITEM_TEXTS : many DDIC.BAPIEKPOTX;
    @RFCParameterType : 'Table'
    PO_SERVICES_TEXTS : many DDIC.BAPIESLLTX;
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRETURN;
  };

  action BAPI_PO_GETDETAIL1(
    /** Account Assignment Data */
    @RFCParameterType : 'Import'
    ACCOUNT_ASSIGNMENT : String(1) default 'SPACE',
    /** Delivery address */
    @RFCParameterType : 'Import'
    DELIVERY_ADDRESS : String(1) default 'SPACE',
    /** Header Txt */
    @RFCParameterType : 'Import'
    HEADER_TEXT : String(1) default 'SPACE',
    /** Invoicing Plan */
    @RFCParameterType : 'Import'
    INVOICEPLAN : String(1) default 'SPACE',
    /** Item Text */
    @RFCParameterType : 'Import'
    ITEM_TEXT : String(1) default 'SPACE',
    /** Purchasing Document Number */
    @RFCParameterType : 'Import'
    PURCHASEORDER : String(10) not null,
    /** Serial Numbers */
    @RFCParameterType : 'Import'
    SERIALNUMBERS : String(1) default 'SPACE',
    /** External Service Data */
    @RFCParameterType : 'Import'
    SERVICES : String(1) default 'SPACE',
    /** Version Management */
    @RFCParameterType : 'Import'
    VERSION : String(1) default 'SPACE',
    /** Version Data */
    @RFCParameterType : 'Table'
    ALLVERSIONS : many DDIC.BAPIMEDCM_ALLVERSIONS,
    /** ExtensionOut */
    @RFCParameterType : 'Table'
    EXTENSIONOUT : many DDIC.BAPIPAREX,
    /** Invoicing Plan: Header Data */
    @RFCParameterType : 'Table'
    INVPLANHEADER : many DDIC.BAPI_INVOICE_PLAN_HEADER,
    /** Invoicing Plan: Item Data */
    @RFCParameterType : 'Table'
    INVPLANITEM : many DDIC.BAPI_INVOICE_PLAN_ITEM,
    /** Account Assignment Fields */
    @RFCParameterType : 'Table'
    POACCOUNT : many DDIC.BAPIMEPOACCOUNT,
    /** Addresses for Inward Delivery (Item) */
    @RFCParameterType : 'Table'
    POADDRDELIVERY : many DDIC.BAPIMEPOADDRDELIVERY,
    /** BAPI Structure for Components */
    @RFCParameterType : 'Table'
    POCOMPONENTS : many DDIC.BAPIMEPOCOMPONENT,
    /** Conditions (Items) */
    @RFCParameterType : 'Table'
    POCOND : many DDIC.BAPIMEPOCOND,
    /** Conditions (header) */
    @RFCParameterType : 'Table'
    POCONDHEADER : many DDIC.BAPIMEPOCONDHEADER,
    /** Vendor Confirmation */
    @RFCParameterType : 'Table'
    POCONFIRMATION : many DDIC.BAPIEKES,
    /** Communication Structure: Contract Limits */
    @RFCParameterType : 'Table'
    POCONTRACTLIMITS : many DDIC.BAPIESUCC,
    /** Foreign Trade: Item Data */
    @RFCParameterType : 'Table'
    POEXPIMPITEM : many DDIC.BAPIEIPO,
    /** Purchase Order History */
    @RFCParameterType : 'Table'
    POHISTORY : many DDIC.BAPIEKBE,
    /** Transfer Structure for Purchase Order History Account Assignment Level */
    @RFCParameterType : 'Table'
    POHISTORY_MA : many DDIC.BAPIEKBE_MA,
    /** Purchase Order History - Totals */
    @RFCParameterType : 'Table'
    POHISTORY_TOTALS : many DDIC.BAPIEKBES,
    /** Purchase Order Item */
    @RFCParameterType : 'Table'
    POITEM : many DDIC.BAPIMEPOITEM,
    /** External Services: Limits */
    @RFCParameterType : 'Table'
    POLIMITS : many DDIC.BAPIESUHC,
    /** Partner */
    @RFCParameterType : 'Table'
    POPARTNER : many DDIC.BAPIEKKOP,
    /** Delivery Schedule */
    @RFCParameterType : 'Table'
    POSCHEDULE : many DDIC.BAPIMEPOSCHEDULE,
    /** Communication Structure: Create Service Line */
    @RFCParameterType : 'Table'
    POSERVICES : many DDIC.BAPIESLLC,
    /** Export Structure for Shipping Data */
    @RFCParameterType : 'Table'
    POSHIPPINGEXP : many DDIC.BAPIMEPOSHIPPEXP,
    /** External Services: Account Assignment Distribution for Service Lines */
    @RFCParameterType : 'Table'
    POSRVACCESSVALUES : many DDIC.BAPIESKLC,
    /** Header Texts */
    @RFCParameterType : 'Table'
    POTEXTHEADER : many DDIC.BAPIMEPOTEXTHEADER,
    /** Item Texts */
    @RFCParameterType : 'Table'
    POTEXTITEM : many DDIC.BAPIMEPOTEXT,
    /** Return Parameter(s) */
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2,
    /** Serial Numbers in Purchase Order BAPIs */
    @RFCParameterType : 'Table'
    SERIALNUMBER : many DDIC.BAPIMEPOSERIALNO
  ) returns BAPI_PO_GETDETAIL1.ResultType;

  type BAPI_PO_GETDETAIL1.ResultType {
    /** Foreign Trade: Export/Import: Header Data */
    @RFCParameterType : 'Export'
    POEXPIMPHEADER : DDIC.BAPIEIKP;
    /** Purchase Order Header Data */
    @RFCParameterType : 'Export'
    POHEADER : DDIC.BAPIMEPOHEADER;
    /** Version Data */
    @RFCParameterType : 'Table'
    ALLVERSIONS : many DDIC.BAPIMEDCM_ALLVERSIONS;
    /** ExtensionOut */
    @RFCParameterType : 'Table'
    EXTENSIONOUT : many DDIC.BAPIPAREX;
    /** Invoicing Plan: Header Data */
    @RFCParameterType : 'Table'
    INVPLANHEADER : many DDIC.BAPI_INVOICE_PLAN_HEADER;
    /** Invoicing Plan: Item Data */
    @RFCParameterType : 'Table'
    INVPLANITEM : many DDIC.BAPI_INVOICE_PLAN_ITEM;
    /** Account Assignment Fields */
    @RFCParameterType : 'Table'
    POACCOUNT : many DDIC.BAPIMEPOACCOUNT;
    /** Addresses for Inward Delivery (Item) */
    @RFCParameterType : 'Table'
    POADDRDELIVERY : many DDIC.BAPIMEPOADDRDELIVERY;
    /** BAPI Structure for Components */
    @RFCParameterType : 'Table'
    POCOMPONENTS : many DDIC.BAPIMEPOCOMPONENT;
    /** Conditions (Items) */
    @RFCParameterType : 'Table'
    POCOND : many DDIC.BAPIMEPOCOND;
    /** Conditions (header) */
    @RFCParameterType : 'Table'
    POCONDHEADER : many DDIC.BAPIMEPOCONDHEADER;
    /** Vendor Confirmation */
    @RFCParameterType : 'Table'
    POCONFIRMATION : many DDIC.BAPIEKES;
    /** Communication Structure: Contract Limits */
    @RFCParameterType : 'Table'
    POCONTRACTLIMITS : many DDIC.BAPIESUCC;
    /** Foreign Trade: Item Data */
    @RFCParameterType : 'Table'
    POEXPIMPITEM : many DDIC.BAPIEIPO;
    /** Purchase Order History */
    @RFCParameterType : 'Table'
    POHISTORY : many DDIC.BAPIEKBE;
    /** Transfer Structure for Purchase Order History Account Assignment Level */
    @RFCParameterType : 'Table'
    POHISTORY_MA : many DDIC.BAPIEKBE_MA;
    /** Purchase Order History - Totals */
    @RFCParameterType : 'Table'
    POHISTORY_TOTALS : many DDIC.BAPIEKBES;
    /** Purchase Order Item */
    @RFCParameterType : 'Table'
    POITEM : many DDIC.BAPIMEPOITEM;
    /** External Services: Limits */
    @RFCParameterType : 'Table'
    POLIMITS : many DDIC.BAPIESUHC;
    /** Partner */
    @RFCParameterType : 'Table'
    POPARTNER : many DDIC.BAPIEKKOP;
    /** Delivery Schedule */
    @RFCParameterType : 'Table'
    POSCHEDULE : many DDIC.BAPIMEPOSCHEDULE;
    /** Communication Structure: Create Service Line */
    @RFCParameterType : 'Table'
    POSERVICES : many DDIC.BAPIESLLC;
    /** Export Structure for Shipping Data */
    @RFCParameterType : 'Table'
    POSHIPPINGEXP : many DDIC.BAPIMEPOSHIPPEXP;
    /** External Services: Account Assignment Distribution for Service Lines */
    @RFCParameterType : 'Table'
    POSRVACCESSVALUES : many DDIC.BAPIESKLC;
    /** Header Texts */
    @RFCParameterType : 'Table'
    POTEXTHEADER : many DDIC.BAPIMEPOTEXTHEADER;
    /** Item Texts */
    @RFCParameterType : 'Table'
    POTEXTITEM : many DDIC.BAPIMEPOTEXT;
    /** Return Parameter(s) */
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2;
    /** Serial Numbers in Purchase Order BAPIs */
    @RFCParameterType : 'Table'
    SERIALNUMBER : many DDIC.BAPIMEPOSERIALNO;
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
    PSTNG_DATE : String(8);
    VALUE_DATE : String(8);
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
    BLINE_DATE : String(8);
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
    TAX_DATE : String(8);
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

  type DDIC.BAPI0015_1 {
    CO_AREA : String(4);
    PROFIT_CTR : String(10);
    VALID_TO : Date;
    PCTR_NAME : String(20);
    IN_CHARGE : String(20);
    IN_CHARGE_USER : String(12);
  };

  type DDIC.BAPIACREV {
    OBJ_TYPE : String(5);
    OBJ_KEY : String(20);
    OBJ_SYS : String(10);
    OBJ_KEY_R : String(20);
    PSTNG_DATE : Date;
    @RFCAbapType : 'N'
    FIS_PERIOD : String(2);
    COMP_CODE : String(4);
    REASON_REV : String(2);
    AC_DOC_NO : String(10);
    ACC_PRINCIPLE : String(4);
    VAT_DATE : Date;
    USERNAME : String(12);
  };

  type DDIC.RTAX1U15 {
    WMWST : Decimal;
    MSATZ : Decimal;
    KTOSL : String(3);
    TXJCD : String(15);
    KNUMH : String(10);
    KBETR : Decimal;
    KAWRT : Decimal;
    HKONT : String(10);
    KSCHL : String(4);
    TXJCD_DEEP : String(15);
    TXJLV : String(1);
  };

  type DDIC.BAPIACAP09_TAB : many {
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

  type DDIC.BAPIACAR09_TAB : many {
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

  type DDIC.BAPIACTX09_TAB : many {
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

  type DDIC.BAPIACWT09_TAB : many {
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

  type DDIC.BAPIACKEC9_TAB : many {
    @RFCAbapType : 'N'
    ITEMNO_ACC : String(10);
    FIELDNAME : String(30);
    CHARACTER : String(18);
    PROD_NO_LONG : String(40);
    CUST_CHAR_VALUE_LONG : String(40);
  };

  type DDIC.BAPIACCR09_TAB : many {
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

  type DDIC.BAPIACEXTC_TAB : many {
    FIELD1 : String(250);
    FIELD2 : String(250);
    FIELD3 : String(250);
    FIELD4 : String(250);
  };

  type DDIC.BAPIPAREX2_TAB : many {
    STRUCTURE : String(30);
    VALUEPART1 : String(240);
    VALUEPART2 : String(240);
    VALUEPART3 : String(240);
    VALUEPART4 : String(240);
  };

  type DDIC.BAPIACRE09_TAB : many {
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

  type DDIC.BAPIACGL09_TAB : many {
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

  type DDIC.BAPIRETTAB : many {
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

  type DDIC.BAPIEKKOTX {
    PO_NUMBER : String(10);
    TEXT_ID : String(4);
    TEXT_FORM : String(2);
    TEXT_LINE : String(132);
  };

  type DDIC.BAPIEKKN {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SERIAL_NO : String(2);
    QUANTITY : Decimal;
    DISTR_PERC : Decimal;
    G_L_ACCT : String(10);
    BUS_AREA : String(4);
    COST_CTR : String(10);
    PROJ_EXT : String(24);
    SD_DOC : String(10);
    @RFCAbapType : 'N'
    SDOC_ITEM : String(6);
    @RFCAbapType : 'N'
    SCHED_LINE : String(4);
    ASSET_NO : String(12);
    SUB_NUMBER : String(4);
    ORDER_NO : String(12);
    GR_RCPT : String(12);
    UNLOAD_PT : String(25);
    CO_AREA : String(4);
    TO_COSTCTR : String(1);
    TO_ORDER : String(1);
    TO_PROJECT : String(1);
    COST_OBJ : String(12);
    @RFCAbapType : 'N'
    PROF_SEGM : String(10);
    PROFIT_CTR : String(10);
    WBS_ELEM_E : String(24);
    NETWORK : String(12);
    @RFCAbapType : 'N'
    ROUTING_NO : String(10);
    RL_EST_KEY : String(8);
    @RFCAbapType : 'N'
    COUNTER : String(8);
    PART_ACCT : String(10);
    CMMT_ITEM : String(14);
    REC_IND : String(2);
    FUNDS_CTR : String(16);
    FUND : String(10);
    FUNC_AREA : String(4);
    REF_DATE : Date;
    ACTIVITY : String(4);
    GRANT_NBR : String(20);
    CMMT_ITEM_LONG : String(24);
    FUNC_AREA_LONG : String(16);
    FUNDS_RES : String(10);
    @RFCAbapType : 'N'
    RES_ITEM : String(3);
    BUDGET_PERIOD : String(10);
  };

  type DDIC.BAPIEKES {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    CONF_SER : String(4);
    CONF_TYPE : String(2);
    CONF_NAME : String(20);
    DEL_DATCAT : String(1);
    DEL_DATCAT_EXT : String(1);
    DELIV_DATE : Date;
    DELIV_TIME : Time;
    QUANTITY : Decimal;
    DELETE_IND : String(1);
    DISPO_REL : String(1);
    RECEIPT_REL : String(1);
    EXT_DOC : String(20);
    DELIV_NUMB : String(10);
    @RFCAbapType : 'N'
    DELIV_ITEM : String(6);
    EXT_DOC_LONG : String(35);
    HANDOVERDATE : Date;
    HANDOVERTIME : Time;
  };

  type DDIC.BAPIESUC {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    @RFCAbapType : 'N'
    LINE_NO : String(10);
    DELETE_IND : String(1);
    CON_NUMBER : String(10);
    @RFCAbapType : 'N'
    CON_ITEM : String(5);
    LIMIT : Decimal;
    NO_LIMIT : String(1);
    ACT_VALUE : Decimal;
    PRICE_CHG : String(1);
    SHORT_TEXT : String(40);
    KTEXT1 : String(40);
    @RFCAbapType : 'N'
    SUB_PACKNO : String(10);
  };

  type DDIC.BAPIEKBE {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SERIAL_NO : String(2);
    PROCESS_ID : String(1);
    @RFCAbapType : 'N'
    DOC_YEAR : String(4);
    MAT_DOC : String(10);
    @RFCAbapType : 'N'
    MATDOC_ITM : String(4);
    HIST_TYPE : String(1);
    MOVE_TYPE : String(3);
    PSTNG_DATE : Date;
    QUANTITY : Decimal;
    VAL_LOCCUR : Decimal;
    VAL_FORCUR : Decimal;
    CURRENCY : String(5);
    CL_VAL_LOC : Decimal;
    BLOCKED_QY : Decimal;
    BL_QTY : Decimal;
    DB_CR_IND : String(1);
    VAL_TYPE : String(10);
    NO_MORE_GR : String(1);
    REF_DOC_NO : String(16);
    @RFCAbapType : 'N'
    REF_DOC_YR : String(4);
    REF_DOC : String(10);
    @RFCAbapType : 'N'
    REF_DOC_IT : String(4);
    @RFCAbapType : 'N'
    MOVE_REAS : String(4);
    ENTRY_DATE : Date;
    ENTRY_TIME : Time;
    IVVAL_LOC : Decimal;
    IVVAL_FOR : Decimal;
    MATERIAL : String(18);
    PLANT : String(4);
    @RFCAbapType : 'N'
    CONF_SER : String(4);
    CONDITION : String(10);
    TAX_CODE : String(2);
    DELIV_QTY : Decimal;
    DELIV_UNIT : String(3);
    PUR_MAT : String(18);
    LOC_CURR : String(5);
    BATCH : String(10);
    DOC_DATE : Date;
    CURRENCY_ISO : String(3);
    LOC_CURR_ISO : String(3);
    DELIV_UNIT_ISO : String(3);
    MATERIAL_EXTERNAL : String(40);
    MATERIAL_GUID : String(32);
    MATERIAL_VERSION : String(10);
    PUR_MAT_EXTERNAL : String(40);
    PUR_MAT_GUID : String(32);
    PUR_MAT_VERSION : String(10);
    REF_DOC_NO_LONG : String(35);
    STK_SEGMENT : String(16);
    MATERIAL_LONG : String(40);
    PUR_MAT_LONG : String(40);
    STK_SEG_LONG : String(40);
    TAXCOUNTRY : String(3);
  };

  type DDIC.BAPIEKBES {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SERIAL_NO : String(2);
    WITHDR_QTY : Decimal;
    BLOCKED_QY : Decimal;
    BL_QTY : Decimal;
    DELIV_QTY : Decimal;
    PO_PR_QNT : Decimal;
    VAL_GR_LOC : Decimal;
    VAL_GR_FOR : Decimal;
    IV_QTY : Decimal;
    IV_QTY_PO : Decimal;
    VAL_IV_LOC : Decimal;
    VAL_IV_FOR : Decimal;
    CL_VAL_LOC : Decimal;
    CL_VAL_FOR : Decimal;
    DOP_VL_LOC : Decimal;
    IVVAL_LOC : Decimal;
    IVVAL_FOR : Decimal;
    DL_QTY_TRSP : Decimal;
    BL_QTY_TOTAL : Decimal;
    DL_QTY_TOTAL : Decimal;
    IV_QTY_TOTAL : Decimal;
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
  };

  type DDIC.BAPIESUH {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    LIMIT : Decimal;
    NO_LIMIT : String(1);
    EXP_VALUE : Decimal;
    ACT_VALUE : Decimal;
    SSC_EXIST : String(1);
    CON_EXIST : String(1);
    TMP_EXIST : String(1);
    PRICE_CHG : String(1);
    FREE_LIMIT : Decimal;
    NO_FRLIMIT : String(1);
    FREACT_VAL : Decimal;
    CURRENCY : String(5);
    CURR_ISOCD : String(3);
    SERV_TYPE : String(3);
    @RFCAbapType : 'N'
    EDITION : String(4);
    SSC_LIMIT : Decimal;
    SSC_NOLIM : String(1);
    SSC_ACTVAL : Decimal;
    SSC_PRSCHG : String(1);
    SSC_PERC : Decimal;
    TMP_NUMBER : String(10);
    TMP_LIMIT : Decimal;
    TMP_NOLIM : String(1);
    TMP_ACTVAL : Decimal;
    TMP_PRSCHG : String(1);
    TMP_PERC : Decimal;
    CONT_PERC : Decimal;
  };

  type DDIC.BAPIEKET {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SERIAL_NO : String(4);
    DEL_DATCAT : String(1);
    DELIV_DATE : Date;
    DELIV_TIME : Time;
    QUANTITY : Decimal;
    PREQ_NO : String(10);
    @RFCAbapType : 'N'
    PREQ_ITEM : String(5);
    CREATE_IND : String(1);
    QUOTA_NO : String(10);
    @RFCAbapType : 'N'
    QUOTA_ITEM : String(3);
    BOMEXPL_NO : String(8);
    @RFCAbapType : 'N'
    RESERV_NO : String(10);
    BATCH : String(10);
    VEND_BATCH : String(15);
    VERSION : String(4);
    DEL_DATCAT_EXT : String(1);
  };

  type DDIC.BAPIESLL {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    @RFCAbapType : 'N'
    LINE_NO : String(10);
    @RFCAbapType : 'N'
    EXT_LINE : String(10);
    OUTL_LEVEL : Integer;
    OUTL_NO : String(8);
    OUTL_IND : String(1);
    @RFCAbapType : 'N'
    SUBPCKG_NO : String(10);
    DELETE_IND : String(1);
    SERVICE : String(18);
    SERV_TYPE : String(3);
    @RFCAbapType : 'N'
    EDITION : String(4);
    SSC_ITEM : String(18);
    EXT_SERV : String(18);
    QUANTITY : Decimal;
    BASE_UOM : String(3);
    UOM_ISO : String(3);
    OVF_TOL : Decimal;
    OVF_UNLIM : String(1);
    PRICE_UNIT : Decimal;
    GROSS_VAL : Decimal;
    NET_VALUE : Decimal;
    FROM_LINE : String(6);
    TO_LINE : String(6);
    SHORT_TEXT : String(40);
    DISTRIB : String(1);
    @RFCAbapType : 'N'
    PERS_NO : String(8);
    WAGETYPE : String(4);
    @RFCAbapType : 'N'
    PLN_PCKG : String(10);
    @RFCAbapType : 'N'
    PLN_LINE : String(10);
    @RFCAbapType : 'N'
    CON_PCKG : String(10);
    @RFCAbapType : 'N'
    CON_LINE : String(10);
    @RFCAbapType : 'N'
    TMP_PCKG : String(10);
    @RFCAbapType : 'N'
    TMP_LINE : String(10);
    SSC_LIM : String(1);
    @RFCAbapType : 'N'
    LIMIT_LINE : String(10);
    ACTUAL_QTY : Decimal;
    ACTUAL_VAL : Decimal;
    CON_VALUE : Decimal;
    CON_QTY : Decimal;
    TARGET_VAL : Decimal;
    UNPL_VAL : Decimal;
    UNPL_QTY : Decimal;
    @RFCAbapType : 'N'
    BASLINE_NO : String(10);
    BASIC_LINE : String(1);
    ALTERNAT : String(1);
    BIDDER : String(1);
    SUPP_LINE : String(1);
    OPEN_QTY : String(1);
    INFORM : String(1);
    BLANKET : String(1);
    EVENTUAL : String(1);
    TAX_CODE : String(2);
    TAXJURCODE : String(15);
    PRICE_CHG : String(1);
    MATL_GROUP : String(9);
    NOND_ITAX : Decimal;
    DATE : Date;
    BEGINTIME : Time;
    ENDTIME : Time;
    EXTPERS_NO : String(40);
    FORMULA : String(10);
    FORM_VAL1 : Decimal;
    FORM_VAL2 : Decimal;
    FORM_VAL3 : Decimal;
    FORM_VAL4 : Decimal;
    FORM_VAL5 : Decimal;
    @RFCAbapType : 'N'
    USERF1_NUM : String(10);
    USERF2_NUM : Decimal;
    USERF1_TXT : String(40);
    USERF2_TXT : String(10);
    GR_PRICE : Decimal;
    @RFCAbapType : 'N'
    HI_LINE_NO : String(10);
    EXTREFKEY : String(40);
    PER_SDATE : Date;
    PER_EDATE : Date;
    EXTERNAL_ITEM_ID : String(40);
    @RFCAbapType : 'N'
    SERVICE_ITEM_KEY : String(10);
  };

  type DDIC.BAPIESKL {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    @RFCAbapType : 'N'
    LINE_NO : String(10);
    @RFCAbapType : 'N'
    SERNO_LINE : String(2);
    DELETE_IND : String(1);
    INACTIVE : String(1);
    QUANTITY : Decimal;
    PERCENTAGE : Decimal;
    NET_VALUE : Decimal;
    @RFCAbapType : 'N'
    SERIAL_NO : String(2);
    @RFCAbapType : 'N'
    HPACKNO : String(10);
  };

  type DDIC.BAPIEKPOTX {
    PO_NUMBER : String(10);
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    TEXT_ID : String(4);
    TEXT_FORM : String(2);
    TEXT_LINE : String(132);
  };

  type DDIC.BAPIESLLTX {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    @RFCAbapType : 'N'
    LINE_NO : String(10);
    TEXT_ID : String(4);
    FORMAT_COL : String(2);
    TEXT_LINE : String(132);
  };

  type DDIC.BAPIEIKP {
    TRANSPORT_MODE : String(1);
    CUSTOMS : String(6);
  };

  type DDIC.BAPIMEPOHEADER {
    PO_NUMBER : String(10);
    COMP_CODE : String(4);
    DOC_TYPE : String(4);
    DELETE_IND : String(1);
    STATUS : String(1);
    CREAT_DATE : Date;
    CREATED_BY : String(12);
    @RFCAbapType : 'N'
    ITEM_INTVL : String(5);
    VENDOR : String(10);
    LANGU : String(1);
    LANGU_ISO : String(2);
    PMNTTRMS : String(4);
    DSCNT1_TO : Decimal;
    DSCNT2_TO : Decimal;
    DSCNT3_TO : Decimal;
    DSCT_PCT1 : Decimal;
    DSCT_PCT2 : Decimal;
    PURCH_ORG : String(4);
    PUR_GROUP : String(3);
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    EXCH_RATE : Decimal;
    EX_RATE_FX : String(1);
    DOC_DATE : Date;
    VPER_START : Date;
    VPER_END : Date;
    WARRANTY : Date;
    QUOTATION : String(10);
    QUOT_DATE : Date;
    REF_1 : String(12);
    SALES_PERS : String(30);
    TELEPHONE : String(16);
    SUPPL_VEND : String(10);
    CUSTOMER : String(10);
    AGREEMENT : String(10);
    GR_MESSAGE : String(1);
    SUPPL_PLNT : String(4);
    INCOTERMS1 : String(3);
    INCOTERMS2 : String(28);
    COLLECT_NO : String(10);
    DIFF_INV : String(10);
    OUR_REF : String(12);
    LOGSYSTEM : String(10);
    @RFCAbapType : 'N'
    SUBITEMINT : String(5);
    PO_REL_IND : String(1);
    REL_STATUS : String(8);
    VAT_CNTRY : String(3);
    VAT_CNTRY_ISO : String(2);
    @RFCAbapType : 'N'
    REASON_CANCEL : String(2);
    REASON_CODE : String(4);
    RETENTION_TYPE : String(1);
    RETENTION_PERCENTAGE : Decimal;
    DOWNPAY_TYPE : String(4);
    DOWNPAY_AMOUNT : Decimal;
    DOWNPAY_PERCENT : Decimal;
    DOWNPAY_DUEDATE : Date;
    MEMORY : String(1);
    MEMORYTYPE : String(1);
    SHIPTYPE : String(2);
    HANDOVERLOC : String(10);
    SHIPCOND : String(2);
    INCOTERMSV : String(4);
    INCOTERMS2L : String(70);
    INCOTERMS3L : String(70);
    EXT_SYS : String(60);
    EXT_REF : String(70);
    INTRASTAT_REL : String(1);
    INTRASTAT_EXCL : String(1);
    EXT_REV_TMSTMP : Decimal;
    TOTAL_STATUS_PCS : String(1);
    TOTAL_STATUS_PMA : String(1);
    TOTAL_STATUS_DG : String(1);
    TOTAL_STATUS_SDS : String(1);
  };

  type DDIC.BAPIMEDCM_ALLVERSIONS {
    DOC_TYPE : String(1);
    DOC_NUMBER : String(10);
    @RFCAbapType : 'N'
    ITEM_NUMBER : String(5);
    VERSION : String(8);
    CREATED_BY : String(12);
    CR_ON : Date;
    REC_TIME : Time;
    RELEASED_BY : String(12);
    RELEASE_DATE : Date;
    RELEASE_TIME : Time;
    RELEASEBY_PUR : String(12);
    RELEASEDATE_PUR : Date;
    RELEASETIME_PUR : Time;
    REASON : String(4);
    DESCRIPTION : String(60);
    REQ_BY_EXT : String(20);
    REQ_BY : String(12);
    NET_VALUE : Decimal;
    VALUE_CHANGED : Decimal;
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    POST_DATE : Date;
    COMPLETED : String(1);
    STATUS : String(1);
    DELETE_IND : String(1);
    STATUS_DOC_OLD : String(2);
  };

  type DDIC.BAPI_INVOICE_PLAN_HEADER {
    @RFCAbapType : 'N'
    DOC_ITEM : String(5);
    IV_PLAN_NUM : String(10);
    CATEGORY : String(1);
    IP_TYPE : String(2);
    SORT_FLD : String(10);
    START_DATE : Date;
    END_DATE : Date;
    HORIZON : String(2);
    ORGN_ST_DAT : String(2);
    ORGN_END_DAT : String(2);
    PERIOD : String(2);
    @RFCAbapType : 'N'
    LNGTH_STAND_PRD : String(3);
    REF_IV_PLAN_NUM : String(10);
    DATES_FROM : Date;
    IN_ADVANCE : String(1);
    ORGN_FROM_DAT : String(2);
    DEV_BILL_DAT : String(2);
    CALENDER_ID : String(2);
    DATES_TO : Date;
    ORGN_UNTIL_DAT : String(2);
    PO_NUMBER : String(10);
    @RFCAbapType : 'N'
    UNLIMITED : String(6);
    AUTO_COR_DAT : String(1);
  };

  type DDIC.BAPI_INVOICE_PLAN_ITEM {
    @RFCAbapType : 'N'
    DOC_ITEM : String(5);
    IV_PLAN_NUM : String(10);
    @RFCAbapType : 'N'
    IV_PLAN_ITEM : String(6);
    DEL_IND : String(1);
    DATE_CATG : String(2);
    DATE_DESC : String(4);
    SETT_DATE_FROM : Date;
    BILL_RULE : String(1);
    INVOICE_PERCENTAGE : Decimal;
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    EXCHG_RAT_DAT : Decimal;
    BILL_VALUE : Decimal;
    BILLING_BLOCK : String(2);
    BILLING_STATUS : String(1);
    SETT_DATE_TO : Date;
    CALENDER_ID : String(2);
    BILL_DATE : Date;
    CASH_DISCOUNT : Decimal;
    REBATE_BASIS1 : Decimal;
    PRICING_OK : String(1);
    @RFCAbapType : 'N'
    MILESTONE_NUM : String(12);
    MILESTONE_USE : String(5);
    MANUALLY : String(1);
  };

  type DDIC.BAPIMEPOACCOUNT {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SERIAL_NO : String(2);
    DELETE_IND : String(1);
    CREAT_DATE : Date;
    QUANTITY : Decimal;
    DISTR_PERC : Decimal;
    NET_VALUE : Decimal;
    GL_ACCOUNT : String(10);
    BUS_AREA : String(4);
    COSTCENTER : String(10);
    SD_DOC : String(10);
    @RFCAbapType : 'N'
    ITM_NUMBER : String(6);
    @RFCAbapType : 'N'
    SCHED_LINE : String(4);
    ASSET_NO : String(12);
    SUB_NUMBER : String(4);
    ORDERID : String(12);
    GR_RCPT : String(12);
    UNLOAD_PT : String(25);
    CO_AREA : String(4);
    COSTOBJECT : String(12);
    PROFIT_CTR : String(10);
    WBS_ELEMENT : String(24);
    NETWORK : String(12);
    RL_EST_KEY : String(8);
    PART_ACCT : String(10);
    CMMT_ITEM : String(14);
    REC_IND : String(2);
    FUNDS_CTR : String(16);
    FUND : String(10);
    FUNC_AREA : String(4);
    REF_DATE : Date;
    TAX_CODE : String(2);
    TAXJURCODE : String(15);
    NOND_ITAX : Decimal;
    ACTTYPE : String(6);
    CO_BUSPROC : String(12);
    RES_DOC : String(10);
    @RFCAbapType : 'N'
    RES_ITEM : String(3);
    ACTIVITY : String(4);
    GRANT_NBR : String(20);
    CMMT_ITEM_LONG : String(24);
    FUNC_AREA_LONG : String(16);
    BUDGET_PERIOD : String(10);
    FINAL_IND : String(1);
    FINAL_REASON : String(2);
    SERVICE_DOC : String(10);
    @RFCAbapType : 'N'
    SERVICE_ITEM : String(6);
    SERVICE_DOC_TYPE : String(4);
  };

  type DDIC.BAPIMEPOADDRDELIVERY {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
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
    STREET : String(60);
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
    STREET_LNG : String(60);
    DISTRCT_NO : String(8);
    CHCKSTATUS : String(1);
    PBOXCIT_NO : String(12);
    TRANSPZONE : String(10);
    HOUSE_NO2 : String(10);
    E_MAIL : String(241);
    STR_SUPPL3 : String(40);
    TITLE : String(30);
    COUNTRYISO : String(2);
    LANGU_ISO : String(2);
    BUILD_LONG : String(20);
    REGIOGROUP : String(8);
    SUPP_VENDOR : String(10);
    CUSTOMER : String(10);
    SC_VENDOR : String(1);
  };

  type DDIC.BAPIMEPOCOMPONENT {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SCHED_LINE : String(4);
    @RFCAbapType : 'N'
    ITEM_NO : String(4);
    MATERIAL : String(18);
    ENTRY_QUANTITY : Decimal;
    ENTRY_UOM : String(3);
    ENTRY_UOM_ISO : String(3);
    FIXED_QUAN : String(1);
    PLANT : String(4);
    REQ_DATE : Date;
    CHANGE_ID : String(1);
    MATERIAL_EXTERNAL : String(40);
    MATERIAL_GUID : String(32);
    MATERIAL_VERSION : String(10);
    ITEM_CAT : String(1);
    REQ_QUAN : Decimal;
    BASE_UOM : String(3);
    BASE_UOM_ISO : String(3);
    PHANT_ITEM : String(1);
    BATCH : String(10);
    MAT_PROVISION : String(1);
    ISS_ST_LOC : String(4);
    REV_LEV : String(2);
    REQ_SEGMENT : String(16);
    MATERIAL_LONG : String(40);
    REQ_SEG_LONG : String(40);
  };

  type DDIC.BAPIMEPOCOND {
    CONDITION_NO : String(10);
    @RFCAbapType : 'N'
    ITM_NUMBER : String(6);
    @RFCAbapType : 'N'
    COND_ST_NO : String(3);
    @RFCAbapType : 'N'
    COND_COUNT : String(2);
    COND_TYPE : String(4);
    COND_VALUE : Decimal;
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    COND_UNIT : String(3);
    COND_UNIT_ISO : String(3);
    COND_P_UNT : Decimal;
    APPLICATIO : String(2);
    CONPRICDAT : Date;
    CALCTYPCON : String(1);
    CONBASEVAL : Decimal;
    CONEXCHRAT : Decimal;
    NUMCONVERT : Decimal;
    DENOMINATO : Decimal;
    CONDTYPE : String(1);
    STAT_CON : String(1);
    SCALETYPE : String(1);
    ACCRUALS : String(1);
    CONINVOLST : String(1);
    CONDORIGIN : String(1);
    GROUPCOND : String(1);
    COND_UPDAT : String(1);
    @RFCAbapType : 'N'
    ACCESS_SEQ : String(2);
    @RFCAbapType : 'N'
    CONDCOUNT : String(2);
    CONDCNTRL : String(1);
    CONDISACTI : String(1);
    CONDCLASS : String(1);
    FACTBASVAL : Double;
    SCALEBASIN : String(1);
    SCALBASVAL : Decimal;
    UNITMEASUR : String(3);
    UNITMEASUR_ISO : String(3);
    CURRENCKEY : String(5);
    CURRENCKEY_ISO : String(3);
    CONDINCOMP : String(1);
    CONDCONFIG : String(1);
    CONDCHAMAN : String(1);
    COND_NO : String(10);
    CHANGE_ID : String(1);
    VENDOR_NO : String(10);
    @RFCAbapType : 'N'
    ACCESS_SEQ_LONG : String(3);
    @RFCAbapType : 'N'
    COND_COUNT_LONG : String(3);
  };

  type DDIC.BAPIMEPOCONDHEADER {
    CONDITION_NO : String(10);
    @RFCAbapType : 'N'
    ITM_NUMBER : String(6);
    @RFCAbapType : 'N'
    COND_ST_NO : String(3);
    @RFCAbapType : 'N'
    COND_COUNT : String(2);
    COND_TYPE : String(4);
    COND_VALUE : Decimal;
    CURRENCY : String(5);
    CURRENCY_ISO : String(3);
    COND_UNIT : String(3);
    COND_UNIT_ISO : String(3);
    COND_P_UNT : Decimal;
    APPLICATIO : String(2);
    CONPRICDAT : Date;
    CALCTYPCON : String(1);
    CONBASEVAL : Decimal;
    CONEXCHRAT : Decimal;
    NUMCONVERT : Decimal;
    DENOMINATO : Decimal;
    CONDTYPE : String(1);
    STAT_CON : String(1);
    SCALETYPE : String(1);
    ACCRUALS : String(1);
    CONINVOLST : String(1);
    CONDORIGIN : String(1);
    GROUPCOND : String(1);
    COND_UPDAT : String(1);
    @RFCAbapType : 'N'
    ACCESS_SEQ : String(2);
    @RFCAbapType : 'N'
    CONDCOUNT : String(2);
    CONDCNTRL : String(1);
    CONDISACTI : String(1);
    CONDCLASS : String(1);
    FACTBASVAL : Double;
    SCALEBASIN : String(1);
    SCALBASVAL : Decimal;
    UNITMEASUR : String(3);
    UNITMEASUR_ISO : String(3);
    CURRENCKEY : String(5);
    CURRENCKEY_ISO : String(3);
    CONDINCOMP : String(1);
    CONDCONFIG : String(1);
    CONDCHAMAN : String(1);
    COND_NO : String(10);
    CHANGE_ID : String(1);
    VENDOR_NO : String(10);
    @RFCAbapType : 'N'
    ACCESS_SEQ_LONG : String(3);
    @RFCAbapType : 'N'
    COND_COUNT_LONG : String(3);
  };

  type DDIC.BAPIESUCC {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    @RFCAbapType : 'N'
    LINE_NO : String(10);
    CON_NUMBER : String(10);
    @RFCAbapType : 'N'
    CON_ITEM : String(5);
    LIMIT : Decimal;
    NO_LIMIT : String(1);
    PRICE_CHG : String(1);
    SHORT_TEXT : String(40);
    DELETE_IND : String(1);
  };

  type DDIC.BAPIEIPO {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    BUSINESS_TRANSACTION_TYPE : String(2);
    EXPORT_IMPORT_PROCEDURE : String(8);
    COUNTRYORI : String(3);
    COUNTRYORI_ISO : String(2);
    REGIONORIG : String(3);
    COMM_CODE : String(17);
    SHIPPING_COUNTRY : String(3);
    SHIPPING_COUNTRY_ISO : String(2);
  };

  type DDIC.BAPIEKBE_MA {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SERIAL_NO : String(2);
    PROCESS_ID : String(1);
    @RFCAbapType : 'N'
    DOC_YEAR : String(4);
    MAT_DOC : String(10);
    @RFCAbapType : 'N'
    MATDOC_ITM : String(4);
    @RFCAbapType : 'N'
    REF_DOC_YR : String(4);
    REF_DOC : String(10);
    @RFCAbapType : 'N'
    REF_DOC_IT : String(4);
    DB_CR_IND : String(1);
    QUANTITY_F : Double;
    QUANTITY : Decimal;
    VAL_LOCCUR : Decimal;
    VAL_FORCUR : Decimal;
    CL_VAL_LOC : Decimal;
    IVVAL_LOC : Decimal;
    IVVAL_FOR : Decimal;
    TAX_CODE : String(2);
  };

  type DDIC.BAPIMEPOITEM {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    DELETE_IND : String(1);
    SHORT_TEXT : String(40);
    MATERIAL : String(18);
    MATERIAL_EXTERNAL : String(40);
    MATERIAL_GUID : String(32);
    MATERIAL_VERSION : String(10);
    EMATERIAL : String(18);
    EMATERIAL_EXTERNAL : String(40);
    EMATERIAL_GUID : String(32);
    EMATERIAL_VERSION : String(10);
    PLANT : String(4);
    STGE_LOC : String(4);
    TRACKINGNO : String(10);
    MATL_GROUP : String(9);
    INFO_REC : String(10);
    VEND_MAT : String(35);
    QUANTITY : Decimal;
    PO_UNIT : String(3);
    PO_UNIT_ISO : String(3);
    ORDERPR_UN : String(3);
    ORDERPR_UN_ISO : String(3);
    CONV_NUM1 : Decimal;
    CONV_DEN1 : Decimal;
    NET_PRICE : Decimal;
    PRICE_UNIT : Decimal;
    GR_PR_TIME : Decimal;
    TAX_CODE : String(2);
    BON_GRP1 : String(2);
    QUAL_INSP : String(1);
    INFO_UPD : String(1);
    PRNT_PRICE : String(1);
    EST_PRICE : String(1);
    REMINDER1 : Decimal;
    REMINDER2 : Decimal;
    REMINDER3 : Decimal;
    OVER_DLV_TOL : Decimal;
    UNLIMITED_DLV : String(1);
    UNDER_DLV_TOL : Decimal;
    VAL_TYPE : String(10);
    NO_MORE_GR : String(1);
    FINAL_INV : String(1);
    ITEM_CAT : String(1);
    ACCTASSCAT : String(1);
    DISTRIB : String(1);
    PART_INV : String(1);
    GR_IND : String(1);
    GR_NON_VAL : String(1);
    IR_IND : String(1);
    FREE_ITEM : String(1);
    GR_BASEDIV : String(1);
    ACKN_REQD : String(1);
    ACKNOWL_NO : String(20);
    AGREEMENT : String(10);
    @RFCAbapType : 'N'
    AGMT_ITEM : String(5);
    SHIPPING : String(2);
    CUSTOMER : String(10);
    COND_GROUP : String(4);
    NO_DISCT : String(1);
    PLAN_DEL : Decimal;
    NET_WEIGHT : Decimal;
    WEIGHTUNIT : String(3);
    WEIGHTUNIT_ISO : String(3);
    TAXJURCODE : String(15);
    CTRL_KEY : String(8);
    CONF_CTRL : String(4);
    REV_LEV : String(2);
    FUND : String(10);
    FUNDS_CTR : String(16);
    CMMT_ITEM : String(14);
    PRICEDATE : String(1);
    PRICE_DATE : Date;
    GROSS_WT : Decimal;
    VOLUME : Decimal;
    VOLUMEUNIT : String(3);
    VOLUMEUNIT_ISO : String(3);
    INCOTERMS1 : String(3);
    INCOTERMS2 : String(28);
    PRE_VENDOR : String(10);
    VEND_PART : String(6);
    @RFCAbapType : 'N'
    HL_ITEM : String(5);
    GR_TO_DATE : Date;
    SUPP_VENDOR : String(10);
    SC_VENDOR : String(1);
    KANBAN_IND : String(1);
    ERS : String(1);
    R_PROMO : String(10);
    POINTS : Decimal;
    POINT_UNIT : String(3);
    POINT_UNIT_ISO : String(3);
    SEASON : String(4);
    SEASON_YR : String(4);
    BON_GRP2 : String(2);
    BON_GRP3 : String(2);
    SETT_ITEM : String(1);
    MINREMLIFE : Decimal;
    RFQ_NO : String(10);
    @RFCAbapType : 'N'
    RFQ_ITEM : String(5);
    PREQ_NO : String(10);
    @RFCAbapType : 'N'
    PREQ_ITEM : String(5);
    REF_DOC : String(10);
    @RFCAbapType : 'N'
    REF_ITEM : String(5);
    SI_CAT : String(1);
    RET_ITEM : String(1);
    AT_RELEV : String(1);
    ORDER_REASON : String(3);
    BRAS_NBM : String(16);
    MATL_USAGE : String(1);
    MAT_ORIGIN : String(1);
    IN_HOUSE : String(1);
    INDUS3 : String(2);
    INF_INDEX : String(5);
    UNTIL_DATE : Date;
    DELIV_COMPL : String(1);
    PART_DELIV : String(1);
    SHIP_BLOCKED : String(1);
    PREQ_NAME : String(12);
    PERIOD_IND_EXPIRATION_DATE : String(1);
    @RFCAbapType : 'N'
    INT_OBJ_NO : String(18);
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    BATCH : String(10);
    VENDRBATCH : String(15);
    CALCTYPE : String(1);
    GRANT_NBR : String(20);
    CMMT_ITEM_LONG : String(24);
    FUNC_AREA_LONG : String(16);
    NO_ROUNDING : String(1);
    PO_PRICE : String(1);
    SUPPL_STLOC : String(4);
    SRV_BASED_IV : String(1);
    FUNDS_RES : String(10);
    @RFCAbapType : 'N'
    RES_ITEM : String(3);
    ORIG_ACCEPT : String(1);
    ALLOC_TBL : String(10);
    @RFCAbapType : 'N'
    ALLOC_TBL_ITEM : String(5);
    SRC_STOCK_TYPE : String(1);
    REASON_REJ : String(2);
    CRM_SALES_ORDER_NO : String(10);
    @RFCAbapType : 'N'
    CRM_SALES_ORDER_ITEM_NO : String(6);
    CRM_REF_SALES_ORDER_NO : String(35);
    CRM_REF_SO_ITEM_NO : String(6);
    @RFCAbapType : 'N'
    PRIO_URGENCY : String(2);
    @RFCAbapType : 'N'
    PRIO_REQUIREMENT : String(3);
    REASON_CODE : String(4);
    FUND_LONG : String(20);
    LONG_ITEM_NUMBER : String(40);
    @RFCAbapType : 'N'
    EXTERNAL_SORT_NUMBER : String(5);
    EXTERNAL_HIERARCHY_TYPE : String(4);
    RETENTION_PERCENTAGE : Decimal;
    DOWNPAY_TYPE : String(4);
    DOWNPAY_AMOUNT : Decimal;
    DOWNPAY_PERCENT : Decimal;
    DOWNPAY_DUEDATE : Date;
    EXT_RFX_NUMBER : String(35);
    EXT_RFX_ITEM : String(10);
    EXT_RFX_SYSTEM : String(10);
    SRM_CONTRACT_ID : String(10);
    @RFCAbapType : 'N'
    SRM_CONTRACT_ITM : String(10);
    BUDGET_PERIOD : String(10);
    BLOCK_REASON_ID : String(4);
    BLOCK_REASON_TEXT : String(40);
    SPE_CRM_FKREL : String(1);
    DATE_QTY_FIXED : String(1);
    GI_BASED_GR : String(1);
    SHIPTYPE : String(2);
    HANDOVERLOC : String(10);
    TC_AUT_DET : String(2);
    MANUAL_TC_REASON : String(2);
    FISCAL_INCENTIVE : String(4);
    FISCAL_INCENTIVE_ID : String(4);
    TAX_SUBJECT_ST : String(1);
    REQ_SEGMENT : String(16);
    STK_SEGMENT : String(16);
    SF_TXJCD : String(15);
    INCOTERMS2L : String(70);
    INCOTERMS3L : String(70);
    MATERIAL_LONG : String(40);
    EMATERIAL_LONG : String(40);
    SERVICEPERFORMER : String(10);
    PRODUCTTYPE : String(2);
    STARTDATE : Date;
    ENDDATE : Date;
    REQ_SEG_LONG : String(40);
    STK_SEG_LONG : String(40);
    EXPECTED_VALUE : Decimal;
    LIMIT_AMOUNT : Decimal;
    EXT_REF : String(70);
    GL_ACCOUNT : String(10);
    COSTCENTER : String(10);
    WBS_ELEMENT : String(24);
    COMMODITY_CODE : String(30);
    INTRASTAT_SERVICE_CODE : String(30);
    CONTRACT_FOR_LIMIT : String(10);
    TAXCALCDATE : Date;
    TAXCOUNTRY : String(3);
    STATUS_PCS : String(1);
    STATUS_PMA : String(1);
    STATUS_DG : String(1);
    STATUS_SDS : String(1);
    TXS_BUSINESS_TRANSACTION : String(4);
    TXS_USAGE_PURPOSE : String(25);
  };

  type DDIC.BAPIESUHC {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    LIMIT : Decimal;
    NO_LIMIT : String(1);
    EXP_VALUE : Decimal;
    SSC_EXIST : String(1);
    CON_EXIST : String(1);
    TMP_EXIST : String(1);
    PRICE_CHG : String(1);
    FREE_LIMIT : Decimal;
    NO_FRLIMIT : String(1);
    SERV_TYPE : String(3);
    @RFCAbapType : 'N'
    EDITION : String(4);
    SSC_LIMIT : Decimal;
    SSC_NOLIM : String(1);
    SSC_PRSCHG : String(1);
    SSC_PERC : Decimal;
    TMP_NUMBER : String(10);
    TMP_LIMIT : Decimal;
    TMP_NOLIM : String(1);
    TMP_PRSCHG : String(1);
    TMP_PERC : Decimal;
    CONT_PERC : Decimal;
  };

  type DDIC.BAPIEKKOP {
    PARTNERDESC : String(2);
    LANGU : String(1);
    BUSPARTNO : String(10);
    DELETE_IND : String(1);
  };

  type DDIC.BAPIMEPOSCHEDULE {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SCHED_LINE : String(4);
    DEL_DATCAT_EXT : String(1);
    DELIVERY_DATE : String(10);
    QUANTITY : Decimal;
    DELIV_TIME : Time;
    STAT_DATE : Date;
    PREQ_NO : String(10);
    @RFCAbapType : 'N'
    PREQ_ITEM : String(5);
    PO_DATE : Date;
    ROUTESCHED : String(10);
    MS_DATE : Date;
    MS_TIME : Time;
    LOAD_DATE : Date;
    LOAD_TIME : Time;
    TP_DATE : Date;
    TP_TIME : Time;
    GI_DATE : Date;
    GI_TIME : Time;
    DELETE_IND : String(1);
    REQ_CLOSED : String(1);
    GR_END_DATE : Date;
    GR_END_TIME : Time;
    COM_QTY : Decimal;
    COM_DATE : Date;
    GEO_ROUTE : String(10);
    HANDOVERDATE : Date;
    HANDOVERTIME : Time;
  };

  type DDIC.BAPIESLLC {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    @RFCAbapType : 'N'
    LINE_NO : String(10);
    @RFCAbapType : 'N'
    EXT_LINE : String(10);
    OUTL_LEVEL : Integer;
    OUTL_NO : String(8);
    OUTL_IND : String(1);
    @RFCAbapType : 'N'
    SUBPCKG_NO : String(10);
    SERVICE : String(18);
    SERV_TYPE : String(3);
    @RFCAbapType : 'N'
    EDITION : String(4);
    SSC_ITEM : String(18);
    EXT_SERV : String(18);
    QUANTITY : Decimal;
    BASE_UOM : String(3);
    UOM_ISO : String(3);
    OVF_TOL : Decimal;
    OVF_UNLIM : String(1);
    PRICE_UNIT : Decimal;
    GR_PRICE : Decimal;
    FROM_LINE : String(6);
    TO_LINE : String(6);
    SHORT_TEXT : String(40);
    DISTRIB : String(1);
    @RFCAbapType : 'N'
    PERS_NO : String(8);
    WAGETYPE : String(4);
    @RFCAbapType : 'N'
    PLN_PCKG : String(10);
    @RFCAbapType : 'N'
    PLN_LINE : String(10);
    @RFCAbapType : 'N'
    CON_PCKG : String(10);
    @RFCAbapType : 'N'
    CON_LINE : String(10);
    @RFCAbapType : 'N'
    TMP_PCKG : String(10);
    @RFCAbapType : 'N'
    TMP_LINE : String(10);
    SSC_LIM : String(1);
    @RFCAbapType : 'N'
    LIMIT_LINE : String(10);
    TARGET_VAL : Decimal;
    @RFCAbapType : 'N'
    BASLINE_NO : String(10);
    BASIC_LINE : String(1);
    ALTERNAT : String(1);
    BIDDER : String(1);
    SUPP_LINE : String(1);
    OPEN_QTY : String(1);
    INFORM : String(1);
    BLANKET : String(1);
    EVENTUAL : String(1);
    TAX_CODE : String(2);
    TAXJURCODE : String(15);
    PRICE_CHG : String(1);
    MATL_GROUP : String(9);
    DATE : Date;
    BEGINTIME : Time;
    ENDTIME : Time;
    EXTPERS_NO : String(40);
    FORMULA : String(10);
    FORM_VAL1 : Decimal;
    FORM_VAL2 : Decimal;
    FORM_VAL3 : Decimal;
    FORM_VAL4 : Decimal;
    FORM_VAL5 : Decimal;
    @RFCAbapType : 'N'
    USERF1_NUM : String(10);
    USERF2_NUM : Decimal;
    USERF1_TXT : String(40);
    USERF2_TXT : String(10);
    @RFCAbapType : 'N'
    HI_LINE_NO : String(10);
    EXTREFKEY : String(40);
    DELETE_IND : String(1);
    PER_SDATE : Date;
    PER_EDATE : Date;
    EXTERNAL_ITEM_ID : String(40);
    @RFCAbapType : 'N'
    SERVICE_ITEM_KEY : String(10);
    NET_VALUE : Decimal;
  };

  type DDIC.BAPIMEPOSHIPPEXP {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    SHIP_POINT : String(4);
    @RFCAbapType : 'N'
    DLV_PRIO : String(2);
    ROUTE : String(6);
    CUSTOMER : String(10);
    SOLD_TO : String(10);
    FWDAGENT : String(10);
    SALESORG : String(4);
    DISTR_CHAN : String(2);
    DIVISION : String(2);
    DEL_CREATE_DATE : Date;
    PLND_DELRY : Decimal;
    LANGU : String(1);
    LANGU_ISO : String(2);
    SHIP_COND : String(2);
    LOADINGGRP : String(4);
    TRANS_GRP : String(4);
    UNLOAD_PT : String(25);
    ORDCOMBIND : String(1);
    TIME_ZONE : String(6);
    AUTH_NUMBER : String(20);
    SRC_DLV_NO : String(10);
    SRC_HANDLG_UNIT : String(20);
    INSPOUT_GUID : String(32);
    FOLLOW_UP : String(4);
  };

  type DDIC.BAPIESKLC {
    @RFCAbapType : 'N'
    PCKG_NO : String(10);
    @RFCAbapType : 'N'
    LINE_NO : String(10);
    @RFCAbapType : 'N'
    SERNO_LINE : String(2);
    PERCENTAGE : Decimal;
    @RFCAbapType : 'N'
    SERIAL_NO : String(2);
    QUANTITY : Decimal;
    NET_VALUE : Decimal;
  };

  type DDIC.BAPIMEPOTEXTHEADER {
    PO_NUMBER : String(10);
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    TEXT_ID : String(4);
    TEXT_FORM : String(2);
    TEXT_LINE : String(132);
  };

  type DDIC.BAPIMEPOTEXT {
    PO_NUMBER : String(10);
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    TEXT_ID : String(4);
    TEXT_FORM : String(2);
    TEXT_LINE : String(132);
  };

  type DDIC.BAPIMEPOSERIALNO {
    @RFCAbapType : 'N'
    PO_ITEM : String(5);
    @RFCAbapType : 'N'
    SCHED_LINE : String(4);
    DELETE_IND : String(1);
    SERIALNO : String(18);
    UII : String(72);
  };
};

