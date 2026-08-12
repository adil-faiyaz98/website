# Testing Best Practices

Comprehensive guide to testing CAP applications.

## Testing Stack

### Recommended Tools

- **Jest** - Test runner and assertion library
- **@sap/cds** - CAP testing utilities
- **supertest** - HTTP assertions

### Setup

```json
// package.json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "supertest": "^6.0.0"
  },
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['srv/**/*.js'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
};
```

## Unit Testing

### Testing Service Handlers

```javascript
const cds = require('@sap/cds');

describe('CatalogService', () => {
  let srv;
  
  beforeAll(async () => {
    // Bootstrap CDS
    await cds.deploy(__dirname + '/../').to('sqlite::memory:');
    srv = await cds.serve('CatalogService');
  });
  
  afterAll(async () => {
    await cds.disconnect();
  });
  
  describe('Products', () => {
    it('should create a product', async () => {
      const product = {
        name: 'Test Product',
        price: 99.99
      };
      
      const result = await srv.create('Products', product);
      
      expect(result).toMatchObject({
        name: 'Test Product',
        price: 99.99
      });
      expect(result.ID).toBeDefined();
    });
    
    it('should reject invalid price', async () => {
      const product = {
        name: 'Invalid Product',
        price: -10
      };
      
      await expect(srv.create('Products', product))
        .rejects.toThrow('Price must be positive');
    });
  });
});
```

### Testing Custom Functions

```javascript
const { calculateDiscount } = require('../srv/utils/pricing');

describe('Pricing Utils', () => {
  describe('calculateDiscount', () => {
    it('should apply 10% discount for orders over 100', () => {
      expect(calculateDiscount(150)).toBe(15);
    });
    
    it('should not apply discount for orders under 100', () => {
      expect(calculateDiscount(50)).toBe(0);
    });
    
    it('should handle edge case at exactly 100', () => {
      expect(calculateDiscount(100)).toBe(10);
    });
  });
});
```

## Integration Testing

### Testing with HTTP Requests

```javascript
const cds = require('@sap/cds');
const request = require('supertest');

describe('CatalogService API', () => {
  let app;
  
  beforeAll(async () => {
    await cds.deploy(__dirname + '/../').to('sqlite::memory:');
    app = cds.app;
  });
  
  describe('GET /catalog/Products', () => {
    it('should return list of products', async () => {
      const response = await request(app)
        .get('/catalog/Products')
        .expect(200);
      
      expect(response.body.value).toBeInstanceOf(Array);
    });
    
    it('should support filtering', async () => {
      const response = await request(app)
        .get('/catalog/Products?$filter=price gt 50')
        .expect(200);
      
      response.body.value.forEach(product => {
        expect(product.price).toBeGreaterThan(50);
      });
    });
  });
  
  describe('POST /catalog/Orders', () => {
    it('should create order with valid data', async () => {
      const order = {
        customerID: 'cust-123',
        items: [
          { productID: 'prod-1', quantity: 2 }
        ]
      };
      
      const response = await request(app)
        .post('/catalog/Orders')
        .send(order)
        .expect(201);
      
      expect(response.body.ID).toBeDefined();
      expect(response.body.status).toBe('draft');
    });
  });
});
```

### Testing with Authentication

```javascript
describe('AdminService', () => {
  it('should reject unauthorized access', async () => {
    await request(app)
      .get('/admin/Products')
      .expect(401);
  });
  
  it('should allow admin access', async () => {
    await request(app)
      .get('/admin/Products')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);
  });
});
```

## Mocking

### Mocking External Services

```javascript
const cds = require('@sap/cds');

describe('Order Processing', () => {
  let srv;
  let mockPaymentService;
  
  beforeAll(async () => {
    // Mock external payment service
    mockPaymentService = {
      processPayment: jest.fn().mockResolvedValue({ success: true })
    };
    
    cds.services['PaymentService'] = mockPaymentService;
    
    srv = await cds.serve('OrderService');
  });
  
  it('should process payment on order submission', async () => {
    const orderId = await createTestOrder();
    
    await srv.submitOrder({ orderID: orderId });
    
    expect(mockPaymentService.processPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderID: orderId })
    );
  });
});
```

### Mocking Database

```javascript
jest.mock('@sap/cds', () => ({
  ...jest.requireActual('@sap/cds'),
  run: jest.fn()
}));

describe('Product Handler', () => {
  it('should handle database errors gracefully', async () => {
    cds.run.mockRejectedValue(new Error('Connection failed'));
    
    await expect(getProducts())
      .rejects.toThrow('Unable to fetch products');
  });
});
```

## Test Data Management

### Using CSV Files

```
tests/
├── data/
│   ├── Products.csv
│   └── Orders.csv
└── integration/
    └── catalog.test.js
```

```javascript
beforeAll(async () => {
  await cds.deploy(__dirname + '/../').to('sqlite::memory:');
  // Load test data
  await cds.run(INSERT.into('Products').entries(
    require('./data/products.json')
  ));
});
```

### Factory Functions

```javascript
// tests/factories/order.js
let orderCounter = 0;

function createOrder(overrides = {}) {
  return {
    customerID: `cust-${++orderCounter}`,
    items: [
      { productID: 'prod-1', quantity: 1 }
    ],
    ...overrides
  };
}

module.exports = { createOrder };
```

## Best Practices Summary

1. **Test pyramid** - More unit tests, fewer integration tests
2. **Isolation** - Each test should be independent
3. **Clear naming** - Tests should describe expected behavior
4. **Fast feedback** - Unit tests should run quickly
5. **Coverage goals** - Aim for 80%+ coverage on business logic
6. **Clean test data** - Reset state between tests
7. **Test edge cases** - Don't just test happy path
