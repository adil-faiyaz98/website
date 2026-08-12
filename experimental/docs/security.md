# Security Best Practices

Security guidelines for CAP applications.

## Authentication

### XSUAA Configuration

```json
// xs-security.json
{
  "xsappname": "my-cap-app",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.read", "description": "Read access" },
    { "name": "$XSAPPNAME.write", "description": "Write access" },
    { "name": "$XSAPPNAME.admin", "description": "Admin access" }
  ],
  "role-templates": [
    {
      "name": "Viewer",
      "scope-references": ["$XSAPPNAME.read"]
    },
    {
      "name": "Editor",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write"]
    },
    {
      "name": "Admin",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write", "$XSAPPNAME.admin"]
    }
  ]
}
```

### Service Authentication

```cds
// Require authentication for entire service
@requires: 'authenticated-user'
service CatalogService {
  entity Products as projection on db.Products;
}
```

## Authorization

### Role-Based Access Control

```cds
service AdminService @(requires: 'admin') {
  entity Products as projection on db.Products;
  entity Orders as projection on db.Orders;
}

service CatalogService {
  // Read-only for all authenticated users
  @readonly
  @restrict: [{ grant: 'READ', to: 'authenticated-user' }]
  entity Products as projection on db.Products;
  
  // Full access for editors
  @restrict: [
    { grant: 'READ', to: 'Viewer' },
    { grant: '*', to: 'Editor' }
  ]
  entity Orders as projection on db.Orders;
}
```

### Instance-Based Authorization

```cds
entity Orders @(restrict: [
  { grant: 'READ', to: 'Viewer' },
  { grant: '*', to: 'Editor', where: 'createdBy = $user' }
]) {
  key ID : UUID;
  // ...
}
```

### Programmatic Authorization

```javascript
this.before('*', 'SensitiveData', async (req) => {
  // Check custom authorization logic
  if (!await hasSpecialPermission(req.user)) {
    return req.reject(403, 'Access denied');
  }
});

async function hasSpecialPermission(user) {
  // Custom logic - check database, external service, etc.
  return user.roles.includes('special-access');
}
```

## Input Validation

### CDS Constraints

```cds
entity Products {
  key ID : UUID;
  
  @mandatory
  name : String(100);
  
  @assert.range: [0, 999999.99]
  price : Decimal(10,2);
  
  @assert.format: '^[A-Z]{2}-\\d{4}$'
  sku : String(10);
}
```

### Handler Validation

```javascript
this.before('CREATE', 'Orders', async (req) => {
  const { items, shippingAddress } = req.data;
  
  // Validate required fields
  if (!items?.length) {
    return req.error(400, 'Order must have at least one item');
  }
  
  // Validate business rules
  for (const item of items) {
    if (item.quantity <= 0) {
      return req.error(400, 'Quantity must be positive', 'items');
    }
    
    // Check product exists and is available
    const product = await SELECT.one.from('Products')
      .where({ ID: item.productID, status: 'active' });
    
    if (!product) {
      return req.error(400, `Product ${item.productID} not available`);
    }
  }
  
  // Sanitize text inputs
  if (shippingAddress?.notes) {
    req.data.shippingAddress.notes = sanitizeHtml(shippingAddress.notes);
  }
});
```

## Data Protection

### Field-Level Security

```cds
entity Customers {
  key ID : UUID;
  name : String(100);
  
  @PersonalData.IsPotentiallySensitive
  email : String(255);
  
  @PersonalData.IsPotentiallySensitive
  phone : String(20);
  
  // Never expose in projections
  @cds.api.ignore
  internalNotes : String(1000);
}
```

### Masking Sensitive Data

```javascript
this.after('READ', 'Customers', (customers, req) => {
  // Mask sensitive data for non-admin users
  if (!req.user.is('admin')) {
    for (const customer of customers) {
      if (customer.email) {
        customer.email = maskEmail(customer.email);
      }
      if (customer.phone) {
        customer.phone = '***-***-' + customer.phone.slice(-4);
      }
    }
  }
});

function maskEmail(email) {
  const [local, domain] = email.split('@');
  return local[0] + '***@' + domain;
}
```

## Secure Coding Practices

### SQL Injection Prevention

```javascript
// GOOD - Using CDS Query Builder (parameterized)
const orders = await SELECT.from('Orders')
  .where({ customerID: customerId });

// GOOD - Using tagged template literals
const orders = await cds.run(`
  SELECT * FROM Orders WHERE customerID = ?
`, [customerId]);

// BAD - String concatenation (vulnerable!)
const orders = await cds.run(
  `SELECT * FROM Orders WHERE customerID = '${customerId}'`
);
```

### Secrets Management

```javascript
// GOOD - Use environment variables
const apiKey = process.env.EXTERNAL_API_KEY;

// GOOD - Use destination service
const destination = await cds.connect.to('destination');
const externalService = await destination.get('/api');

// BAD - Hardcoded secrets
const apiKey = 'sk-1234567890abcdef';
```

### Logging Security

```javascript
// GOOD - Log without sensitive data
console.log(`Processing order ${orderId} for customer ${customerId}`);

// BAD - Logging sensitive information
console.log(`User ${email} logged in with password ${password}`);
console.log('Full request:', JSON.stringify(req.data)); // May contain PII
```

## Security Headers

```javascript
// In server.js or express middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

## Audit Logging

```javascript
const auditLog = require('@sap/audit-logging');

this.after('*', 'SensitiveEntity', async (data, req) => {
  await auditLog.log({
    type: 'data-access',
    user: req.user.id,
    action: req.event,
    entity: 'SensitiveEntity',
    data: { id: data.ID },
    timestamp: new Date()
  });
});
```

## Best Practices Summary

1. **Always authenticate** - No anonymous access to business data
2. **Least privilege** - Grant minimum required permissions
3. **Validate all inputs** - Trust nothing from the client
4. **Protect sensitive data** - Mask, encrypt, and audit
5. **Use parameterized queries** - Prevent SQL injection
6. **Never hardcode secrets** - Use environment variables or vault
7. **Log securely** - Never log sensitive information
8. **Keep dependencies updated** - Regular security patches
