namespace s4hana;

// T007A - Tax Keys
@cds.persistence.exists
entity TaxKeys {
  key KALSM  : String(6);
  key MWSKZ  : String(2);
      MWART  : String(1);
      XINACT : String(1);
      EGRKZ  : String(1);
}

// T007S - Tax Code Texts
@cds.persistence.exists
entity TaxCodeTexts {
  key SPRAS  : String(1);
  key KALSM  : String(6);
  key MWSKZ  : String(2);
      TEXT1  : String(50);
}

// T042T - Payment Terms Company Code Texts
@cds.persistence.exists
entity PaymentMethodTexts {
  key BUKRS     : String(4);
  key TXTID     : String(4);
      TXTKO     : String(16);
      TXTFU     : String(16);
      TXTUN     : String(16);
      TXTAB     : String(16);
      SF_HEADER : String(30);
      SF_FOOTER : String(30);
      SF_SENDER : String(30);
      SF_GREETG : String(30);
      URL_LOGO  : String(255);
      URL_GRAPH : String(255);
}

// TVZBT - Payment Block Reason Texts (also backing PaymentBlockTexts)
/*@cds.persistence.exists
entity PaymentMethodSuppTexts {
  key SPRAS  : String(1);
  key ZTERM  : String(4);
      VTEXT  : String(30);
}*/

// T042Z - Payment Methods for Countries (duplicate of PaymentMethods, synonym removed)
/*@cds.persistence.exists
entity PaymentTerms {
  key LAND1      : String(3);
  key ZLSCH      : String(1);
      TEXT1      : String(30);
      XBKKT      : String(1);
      XSTRA      : String(1);
      XEINZ      : String(1);
      XESRD      : String(1);
      XPGIR      : String(1);
      XEZER      : String(1);
      XSCHK      : String(1);
      PROGN      : String(40);
      XZWHR      : String(1);
      XEURO      : String(1);
      FORMI      : String(30);
      FORMZ      : String(6);
      XWECH      : String(1);
      XWANF      : String(1);
      XPSKT      : String(1);
      XWECS      : String(1);
      BLART      : String(2);
      BLARV      : String(2);
      UMSKZ      : String(1);
      XSWEC      : String(1);
      TXTSL      : String(2);
      ZLSTN      : String(6);
}*/

// T052T - Payment Terms URL Texts
@cds.persistence.exists
entity PaymentTermsTexts {
  key SPRAS  : String(1);
  key URLID  : String(4);
      URLTX  : String(20);
}

// T052U - Additional Payment Terms Text
@cds.persistence.exists
entity PaymentTermsAdditional {
  key SPRAS  : String(1);
  key ZTERM  : String(4);
  key ZTAGG  : String(2);
      TEXT1  : String(50);
}

// TVZBT - Payment Block Reason Texts
@cds.persistence.exists
entity PaymentBlockTexts {
  key SPRAS  : String(1);
  key ZTERM  : String(4);
      VTEXT  : String(30);
}

// T042Z - Payment Methods for Countries
@cds.persistence.exists
entity PaymentMethods {
  key LAND1      : String(3);
  key ZLSCH      : String(1);
      TEXT1      : String(30);
      XBKKT      : String(1);
      XSTRA      : String(1);
      XEINZ      : String(1);
      XESRD      : String(1);
      XPGIR      : String(1);
      XEZER      : String(1);
      XSCHK      : String(1);
      PROGN      : String(40);
      XZWHR      : String(1);
      XEURO      : String(1);
      FORMI      : String(30);
      FORMZ      : String(6);
      XWECH      : String(1);
      XWANF      : String(1);
      XPSKT      : String(1);
      XWECS      : String(1);
      BLART      : String(2);
      BLARV      : String(2);
      UMSKZ      : String(1);
      XSWEC      : String(1);
      TXTSL      : String(2);
      ZLSTN      : String(6);
      WLSTN      : String(6);
      XZANF      : String(1);
      XAKTZ      : String(1);
      WEART      : String(2);
      XNOPO      : String(1);
      XORB       : String(1);
      XIBAN      : String(1);
      XNO_ACCNO  : String(1);
      XSEPA      : String(1);
      XALIAS     : String(1);
      XSFSF      : String(1);
      UMSKZ_SF   : String(1);
}

// TTXJ - Tax Jurisdictions
@cds.persistence.exists
entity TaxJurisdiction {
  key KALSM  : String(6);
  key TXJCD  : String(15);
      XSKFN  : String(1);
      XMWSN  : String(1);
}

// TTXJT - Tax Jurisdiction Texts
@cds.persistence.exists
entity TaxJurisdictionTexts {
  key SPRAS  : String(1);
  key KALSM  : String(6);
  key TXJCD  : String(15);
      TEXT1  : String(20);
}
