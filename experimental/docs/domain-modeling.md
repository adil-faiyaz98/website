# Domain Modeling Best Practices

This guide covers best practices for defining domain models in CAP applications.

## Entity Design Principles

### 1. Use Meaningful Names

```cds
// Good
entity Products {
  key ID : UUID;
  name : String(100);
  description : String(1000);
  price : Decimal(10,2);
}

// Avoid
entity Tbl1 {
  key id : Integer;
  f1 : String;
  f2 : String;
}
```

### 2. Leverage Built-in Types

CAP provides semantic types that add meaning and validation:

```cds
using { Currency, Country, Language } from '@sap/cds/common';

entity Orders {
  key ID : UUID;
  currency : Currency;
  country : Country;
}
```

### 3. Use Managed Aspects

Apply the `managed` aspect for automatic audit fields:

```cds
using { managed } from '@sap/cds/common';

entity Products : managed {
  key ID : UUID;
  name : String(100);
  // createdAt, createdBy, modifiedAt, modifiedBy are auto-added
}
```

### 4. Define Associations Explicitly

```cds
entity Orders {
  key ID : UUID;
  items : Composition of many OrderItems on items.order = $self;
  customer : Association to Customers;
}

entity OrderItems {
  key ID : UUID;
  order : Association to Orders;
  product : Association to Products;
  quantity : Integer;
}
```

## Reusable Aspects

Create aspects for common patterns:

```cds
aspect Address {
  street : String(100);
  city : String(50);
  country : Country;
  postalCode : String(10);
}

entity Customers {
  key ID : UUID;
  name : String(100);
  billingAddress : Address;
  shippingAddress : Address;
}
```

## Enumerations

Use enums for fixed value sets:

```cds
type Status : String enum {
  draft;
  submitted;
  approved;
  rejected;
}

entity Orders {
  key ID : UUID;
  status : Status default 'draft';
}
```

## Annotations

Add annotations for UI and validation:

```cds
entity Products {
  key ID : UUID;
  
  @mandatory
  name : String(100);
  
  @assert.range: [0, 999999.99]
  price : Decimal(10,2);
  
  @Core.Description: 'Product category for classification'
  category : String(50);
}
```

## Best Practices Summary

1. **Keep entities focused** - One entity per business concept
2. **Normalize appropriately** - Balance normalization with query performance
3. **Use compositions** - For parent-child relationships with lifecycle dependency
4. **Use associations** - For references without lifecycle dependency
5. **Document with annotations** - Add descriptions and constraints
6. **Version your models** - Consider backward compatibility
