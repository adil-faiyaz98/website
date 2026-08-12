# Custom Handler Best Practices

Guidelines for implementing custom event handlers in CAP.

## Handler Structure

### Basic Handler Setup

```javascript
const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
  const { Orders, Products } = this.entities;
  
  // Event handlers go here
  this.on('READ', 'Orders', handleReadOrders);
  this.before('CREATE', 'Orders', validateOrder);
  this.after('CREATE', 'Orders', notifyOrderCreated);
});
```

### Modular Handler Organization

```
srv/
├── handlers/
│   ├── orders.js
│   ├── products.js
│   └── index.js
└── catalog-service.js
```

**handlers/orders.js:**
```javascript
module.exports = {
  async beforeCreate(req) {
    // Validation logic
  },
  
  async afterCreate(data, req) {
    // Post-processing logic
  },
  
  async onSubmit(req) {
    // Custom action logic
  }
};
```

**catalog-service.js:**
```javascript
const cds = require('@sap/cds');
const orderHandlers = require('./handlers/orders');

module.exports = cds.service.impl(async function() {
  this.before('CREATE', 'Orders', orderHandlers.beforeCreate);
  this.after('CREATE', 'Orders', orderHandlers.afterCreate);
  this.on('submitOrder', orderHandlers.onSubmit);
});
```

## Event Handler Types

### BEFORE Handlers

Use for validation and data enrichment:

```javascript
this.before('CREATE', 'Orders', async (req) => {
  const { items } = req.data;
  
  // Validate
  if (!items || items.length === 0) {
    return req.error(400, 'Order must have at least one item');
  }
  
  // Enrich
  req.data.createdAt = new Date();
  req.data.status = 'draft';
});
```

### ON Handlers

Replace default implementation:

```javascript
this.on('READ', 'Products', async (req) => {
  // Custom read logic with caching
  const cacheKey = JSON.stringify(req.query);
  let results = cache.get(cacheKey);
  
  if (!results) {
    results = await cds.run(req.query);
    cache.set(cacheKey, results, 300); // 5 min TTL
  }
  
  return results;
});
```

### AFTER Handlers

Post-processing and side effects:

```javascript
this.after('CREATE', 'Orders', async (data, req) => {
  // Send notification
  await notificationService.send({
    type: 'ORDER_CREATED',
    orderId: data.ID,
    userId: req.user.id
  });
  
  // Audit log
  await auditLog.write({
    action: 'CREATE',
    entity: 'Orders',
    key: data.ID,
    user: req.user.id
  });
});
```

## Error Handling

### Graceful Error Handling

```javascript
this.on('submitOrder', async (req) => {
  try {
    const { orderID } = req.data;
    const order = await SELECT.one.from('Orders').where({ ID: orderID });
    
    if (!order) {
      return req.error(404, `Order ${orderID} not found`);
    }
    
    // Business logic...
    
  } catch (error) {
    console.error('Error submitting order:', error);
    return req.error(500, 'Failed to submit order. Please try again.');
  }
});
```

### Validation Errors

```javascript
this.before('CREATE', 'Products', async (req) => {
  const errors = [];
  
  if (!req.data.name) {
    errors.push({ message: 'Name is required', target: 'name' });
  }
  
  if (req.data.price < 0) {
    errors.push({ message: 'Price must be positive', target: 'price' });
  }
  
  if (errors.length > 0) {
    return req.reject(400, 'Validation failed', errors);
  }
});
```

## Working with Data

### Query Building

```javascript
// Select with conditions
const orders = await SELECT.from('Orders')
  .where({ status: 'pending' })
  .orderBy('createdAt desc')
  .limit(10);

// Select with joins
const orderDetails = await SELECT.from('Orders')
  .columns('ID', 'total', 'customer.name as customerName')
  .where({ ID: orderId });
```

### Insert, Update, Delete

```javascript
// Insert
const result = await INSERT.into('Orders').entries(orderData);

// Update
await UPDATE('Orders')
  .set({ status: 'approved' })
  .where({ ID: orderId });

// Delete
await DELETE.from('OrderItems').where({ order_ID: orderId });
```

### Transactions

```javascript
this.on('transferStock', async (req) => {
  const { fromWarehouse, toWarehouse, productId, quantity } = req.data;
  
  // CAP automatically handles transactions
  await UPDATE('Stock')
    .set({ quantity: { '-=': quantity } })
    .where({ warehouse_ID: fromWarehouse, product_ID: productId });
    
  await UPDATE('Stock')
    .set({ quantity: { '+=': quantity } })
    .where({ warehouse_ID: toWarehouse, product_ID: productId });
});
```

## Testing Handlers

### Unit Testing

```javascript
const cds = require('@sap/cds');

describe('Order Handlers', () => {
  let srv;
  
  beforeAll(async () => {
    srv = await cds.serve('OrderService').from(__dirname + '/../srv');
  });
  
  it('should validate order has items', async () => {
    const order = { customerID: '123', items: [] };
    
    await expect(srv.create('Orders', order))
      .rejects.toThrow('Order must have at least one item');
  });
});
```

## Best Practices Summary

1. **Keep handlers focused** - One handler, one responsibility
2. **Use modular structure** - Organize handlers by entity/feature
3. **Handle errors gracefully** - Always provide meaningful messages
4. **Use transactions** - Ensure data consistency
5. **Log appropriately** - Debug info, not sensitive data
6. **Write tests** - Cover happy path and edge cases
7. **Avoid side effects in BEFORE handlers** - Keep them for validation
