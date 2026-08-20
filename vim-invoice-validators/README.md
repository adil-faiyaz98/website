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
