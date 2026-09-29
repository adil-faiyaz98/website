# VIM Invoice Validators

A CAP-based library for validating and deriving invoice fields against SAP ECC master data. Designed for VIM (Vendor Invoice Management) integration.

## Features

- **Vendor Validation**: Multi-strategy matching (exact ID, fuzzy name matching)
- **PO Validation**: Validate PO numbers, items, and derive fields
- **Tax Validation**: Validate tax codes, jurisdictions, calculate tax amounts
- **Account Validation**: Validate GL accounts, cost centers, profit centers
- **Fuzzy Matching**: Levenshtein, Jaro-Winkler, and token-based matching
- **Confidence Scoring**: Configurable thresholds for match confidence
- **Caching**: In-memory caching with TTL for ECC data

## Installation

```bash
npm install
```

## Configuration

### ECC Integration

Configure the ECC integration in `package.json` under `cds.requires`:

```json
{
  "cds": {
    "requires": {
      "vim_ecc_integration": {
        "kind": "odata-v2",
        "[production]": {
          "credentials": {
            "destination": "VIM_ECC_INTEGRATION"
          }
        }
      }
    }
  }
}
```

### Confidence Thresholds

Edit `thresholds.json` to customize matching thresholds:

```json
{
  "vendor": {
    "exactMatch": 1.0,
    "highConfidence": 0.85,
    "mediumConfidence": 0.70,
    "lowConfidence": 0.50,
    "minAcceptable": 0.50
  }
}
```

## Usage

### As a Library

```javascript
const validators = require('vim-invoice-validators');

// Validate a vendor
const result = await validators.vendor.validateVendor(
  '0000001000',  // vendorId
  'ACME Corp',   // vendorName
  { companyCode: '1000' }
);

console.log(result);
// {
//   isValid: true,
//   confidence: 0.95,
//   derivedValue: '0000001000',
//   message: 'Vendor matched with high confidence'
// }
```


### Derive Fields from PO

```javascript
const validators = require('vim-invoice-validators');

// Derive header fields from PO
const headerFields = await validators.po.deriveFieldsFromPO('4500000001', {});
// {
//   success: true,
//   derivedFields: {
//     vendorId: '0000001000',
//     vendorName: 'ACME Corporation',
//     companyCode: '1000',
//     currency: 'USD',
//     paymentTerms: 'NT30'
//   },
//   confidence: 0.9
// }

// Derive line item fields from PO item
const itemFields = await validators.po.deriveFieldsFromPOItem('4500000001', '00010', {});
// {
//   derivedFields: {
//     taxCode: 'V1',
//     glAccount: '6000100',
//     costCenter: 'CC1000'
//   }
// }
```

### Process Complete Invoice

```javascript
const validators = require('vim-invoice-validators');

const result = await validators.processInvoice({
  header: {
    vendorId: '0000001000',
    vendorName: 'ACME Corporation',
    purchaseOrder: '4500000001',
    companyCode: '1000'
  },
  lineItems: [
    {
      lineNumber: 1,
      description: 'Office Supplies',
      poNumber: '4500000001',
      poItem: '00010',
      netAmount: 100.00
    }
  ]
}, {
  companyCode: '1000',
  country: 'US'
});

console.log(result.isValid);     // true
console.log(result.confidence);  // 0.95
```

### As a CAP Service

Start the service:

```bash
cds watch
```

The service exposes endpoints at `/api/validators`:

```bash
# Validate vendor
POST /api/validators/validateVendor
{
  "vendorId": "0000001000",
  "vendorName": "ACME Corp",
  "context": { "companyCode": "1000" }
}

# Search vendors
GET /api/validators/searchVendors(searchTerm='ACME',companyCode='1000',limit=5)

# Derive from PO
POST /api/validators/deriveFromPO
{
  "poNumber": "4500000001",
  "poItem": "00010"
}

# Get tax codes
GET /api/validators/getTaxCodes(country='US',language='E')
```


## API Reference

### Validator Modules

#### `validators.vendor`
- `validateVendor(vendorId, vendorName, context)` - Combined validation
- `validateVendorById(vendorId, context)` - Exact ID match
- `validateVendorByName(vendorName, context)` - Fuzzy name matching
- `searchVendors(searchTerm, context, options)` - Search vendors
- `deriveVendorIdFromName(vendorName, context)` - Derive ID from name

#### `validators.po`
- `validatePONumber(poNumber, context)` - Validate PO exists
- `validatePOItem(poNumber, poItem, context)` - Validate PO item
- `deriveFieldsFromPO(poNumber, context)` - Derive header fields
- `deriveFieldsFromPOItem(poNumber, poItem, context)` - Derive item fields
- `matchInvoiceLineToPOItem(poNumber, invoiceLine, context)` - Fuzzy line matching
- `validateAmountAgainstPO(poNumber, amount, options)` - Amount validation

#### `validators.tax`
- `validateTaxCode(taxCode, context)` - Validate tax code
- `validateTaxJurisdiction(jurisdictionCode, context)` - Validate jurisdiction
- `deriveTaxCodeFromDescription(description, context)` - Derive from description
- `calculateTaxFromNet(params)` - Calculate tax amount
- `validateTaxAmount(params)` - Validate calculated vs invoice tax

#### `validators.account`
- `validateGLAccount(accountNumber, context)` - Validate GL account
- `validateCostCenter(costCenterId, context)` - Validate cost center
- `validateInternalOrder(orderId, context)` - Validate internal order
- `validateProfitCenter(profitCenterId, context)` - Validate profit center
- `deriveGLAccountFromDescription(description, context)` - Derive from description
- `deriveCostCenterFromDescription(description, context)` - Derive from description

### Validation Context

```typescript
interface ValidationContext {
  companyCode?: string;     // Required for most validations
  country?: string;         // Required for tax validations
  language?: string;        // For description lookups (default: 'E')
  controllingArea?: string; // For cost center/profit center
  thresholds?: object;      // Custom threshold overrides
}
```

### Validation Result

```typescript
interface ValidationResult {
  isValid: boolean;          // Whether validation passed
  confidence: number;        // Score from 0 to 1
  derivedValue?: string;     // Matched/derived value
  message?: string;          // Human-readable message
  matchStrategy?: string;    // Strategy used (exact, fuzzy, token, etc.)
  metadata?: object;         // Additional match data
}
```

## Deterministic Tax Determination

`srv/lib/tax-determination-engine.js` determines tax code, tax jurisdiction and tax amount per invoice line. It never guesses: a line either ends with `status: 'DETERMINED'` or with an `errorCode` and goes to exception handling. `determineInvoiceTax().success` is `true` only when every line is `DETERMINED`; failed lines are listed in `result.exceptions`.

### Principles

- PO invoices: tax data comes from the PO (`getPODetail1`). Invoice-supplied tax codes/jurisdictions are not used.
- Non-PO invoices: an exact SAP vendor ID is required. Supplier names are never fuzzy-matched.
- Tax amount comes only from `calculateTaxFromNet` (fallback `calculateTaxFromNetStd`) per line. No local rate tables, no estimation. Header tax = sum of lines; the invoice tax amount is only used for reconciliation.
- No system default tax code (the former `I1` default is removed). Ambiguous admin rules (equal specificity and priority, different results) are rejected.

### BAPI / Table Derivation and Validation Matrix

| Source | Used for | Fields |
|---|---|---|
| `getPODetail1` | PO derivation | `POHEADER` (`COMP_CODE`, `VENDOR`, `CURRENCY`, `DELETE_IND`), `POITEM` (`TAX_CODE`, `TAXJURCODE`, `PLANT`, `MATL_GROUP`, `DELETE_IND`), `POACCOUNT` (`TAX_CODE`, `TAXJURCODE`, `GL_ACCOUNT`), `POADDRDELIVERY` (`TAXJURCODE`, `REGION`, `POSTL_COD1`, `COUNTRY`) |
| `getVendorDetail` | Vendor existence, sender country for rules | Vendor general data |
| `getCompanyCodeDetail` | Company code existence, country | Company code data |
| `getTaxCodes` / `s4hana.TaxKeys` | Tax code validation | Exists for country, `MWART = 'V'` (input tax), `XINACT` not set |
| `getTaxJurisdictions` / `s4hana.TaxJurisdiction` | Jurisdiction validation; whether the company country uses jurisdictions | `TXJCD` |
| `calculateTaxFromNet` / `calculateTaxFromNetStd` | Tax amount | `E_FWSTE` (tax), `E_FWNAV` + `E_FWNVV` (non-deductible), `T_MWDAT` (condition details) |

### PO Line Derivation Order

1. PO header must exist, not be deleted, and belong to the invoice company code (`PO_NOT_FOUND`, `PO_DELETED`, `PO_COMPANY_CODE_MISMATCH`).
2. Every PO invoice line must carry a PO line number (`PO_LINE_REQUIRED`); the line must exist and not be deleted (`PO_LINE_NOT_FOUND`, `PO_LINE_DELETED`).
3. Tax code: `POITEM.TAX_CODE`, else `POACCOUNT.TAX_CODE`. Different codes between them or across account assignments → `PO_TAX_CODE_CONFLICT`.
4. Jurisdiction: `POACCOUNT.TAXJURCODE` → `POITEM.TAXJURCODE` → `POADDRDELIVERY.TAXJURCODE`. Different jurisdictions across account assignments → `PO_JURISDICTION_SPLIT`.
5. No tax code on the PO → admin rule (`TaxDeterminationRules`) on company code, PO vendor, delivery country/region/postal code, G/L account, material group. No match → `PO_TAX_CODE_MISSING`; tie → `AMBIGUOUS_TAX_RULE`.

### Non-PO Line Derivation Order

1. Exact vendor ID required (`VENDOR_REQUIRED`, `VENDOR_NOT_FOUND`).
2. Exempt vendor (`VendorTaxProfile.isTaxExempt`, valid dates): requires `exemptionCertNumber` and `defaultTaxCode` (`EXEMPTION_CERTIFICATE_MISSING`, `EXEMPT_TAX_CODE_NOT_CONFIGURED`).
3. Admin rule on company code, vendor, G/L account, expense type (or derived from G/L), material group; receiver country/region/postal code come from the company code address, never from the vendor or invoice. Tie → `AMBIGUOUS_TAX_RULE`.
4. Otherwise `VendorTaxProfile.defaultTaxCode` / `defaultTaxJurisdiction`.
5. Otherwise `NO_TAX_RULE`.

Tax code and jurisdiction are set on every Non-PO line; the header values are an aggregate (`allLinesSameTax`, `allLinesSameJurisdiction`, `uniqueTaxCodes`, `uniqueTaxJurisdictions`).

### Final Validation (all lines)

- Tax code validated against `getTaxCodes` / `s4hana.TaxKeys` → `INVALID_TAX_CODE`.
- Jurisdiction requirement cannot be determined (company country / `getTaxJurisdictions` unavailable) → `JURISDICTION_REQUIREMENT_UNKNOWN`.
- Company country uses jurisdictions but none derived → `TAX_JURISDICTION_MISSING`; derived jurisdiction not found → `INVALID_TAX_JURISDICTION`; jurisdiction derived for a non-jurisdiction country → `UNEXPECTED_TAX_JURISDICTION`.
- Currency must be known (invoice or PO) → `CURRENCY_MISSING`.
- BAPI calculation failure or missing `E_FWSTE` → `TAX_CALCULATION_FAILED`.

### Admin Configuration Required to Close Gaps

| Gap | Configuration |
|---|---|
| PO line without `TAX_CODE` | Maintain tax code on the PO in ECC (preferred), or a `TaxDeterminationRules` entry for company code + vendor/material group/G/L account |
| PO account assignments with different jurisdictions | Split the invoice line per account assignment, or correct the PO |
| PO without jurisdiction in a jurisdiction country | Maintain `TAXJURCODE` on the PO delivery address / account assignment, or a rule with `taxJurisdiction` |
| Non-PO vendor with a single ship-to location | `VendorTaxProfile` per vendor + company code with `defaultTaxCode` and `defaultTaxJurisdiction` |
| Non-PO vendor with expense-dependent tax | `TaxDeterminationRules` per company code + vendor + G/L account (or expense type) |
| Exempt vendors | `VendorTaxProfile.isTaxExempt`, `exemptionCertNumber`, `exemptionValidFrom`/`exemptionValidTo`, `defaultTaxCode` (exempt code) |
| Rule ties | Give overlapping rules distinct `priority` or more specific criteria |
| Tax code / jurisdiction master data | Keep `s4hana.TaxKeys` and `s4hana.TaxJurisdiction` replicated when BAPIs are unavailable |

Non-PO vendors whose goods or services are consumed at several locations cannot be determined without per-line location data; configure line-level G/L/location rules or route them to exception handling.

## Testing

```bash
npm test
```

## Project Structure

```
vim-invoice-validators/
├── db/
│   └── schema.cds           # Cache entity definitions
├── srv/
│   ├── external/
│   │   └── vim_ecc_integration.cds
│   ├── lib/
│   │   ├── cache/           # Caching layer
│   │   ├── utils/           # Normalizers, string matching, confidence
│   │   ├── po-validators.js
│   │   ├── vendor-validators.js
│   │   ├── tax-validators.js
│   │   ├── account-validators.js
│   │   ├── index.js         # Main orchestrator
│   │   └── types.js         # JSDoc type definitions
│   ├── validators-service.cds
│   └── validators-service.js
├── test/
│   └── mocks/               # Mock ECC responses
├── thresholds.json          # Confidence configuration
└── package.json
```

## License

Apache-2.0
