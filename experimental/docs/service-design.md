# Service Design Best Practices

Guidelines for designing clean, maintainable CAP services.

## Service Definition Principles

### 1. Use Projections

Expose only what's needed:

```cds
using { my.bookshop as db } from '../db/schema';

service CatalogService {
  // Expose read-only view of books
  @readonly
  entity Books as projection on db.Books {
    ID,
    title,
    author.name as authorName,
    price
  };
}
```

### 2. Separate Read and Write Services

```cds
// Query service for read operations
@readonly
service QueryService {
  entity Products as projection on db.Products;
  entity Orders as projection on db.Orders;
}

// Command service for write operations
service AdminService @(requires: 'admin') {
  entity Products as projection on db.Products;
  entity Orders as projection on db.Orders;
}
```

### 3. Define Actions and Functions

```cds
service OrderService {
  entity Orders as projection on db.Orders;
  
  // Unbound action
  action submitOrder(orderID: UUID) returns Orders;
  
  // Bound action
  action Orders.cancel();
  
  // Function (read-only, no side effects)
  function getOrderStatus(orderID: UUID) returns String;
}
```

## API Design Guidelines

### RESTful Endpoints

CAP automatically generates RESTful endpoints:

| Operation | HTTP Method | Path |
|-----------|-------------|------|
| Create | POST | /Orders |
| Read | GET | /Orders(id) |
| Update | PATCH | /Orders(id) |
| Delete | DELETE | /Orders(id) |
| Action | POST | /Orders(id)/cancel |
| Function | GET | /getOrderStatus(orderID='...') |

### Pagination

Enable pagination for large datasets:

```cds
service CatalogService {
  @odata.draft.enabled
  entity Products as projection on db.Products;
}
```

Query with pagination:
```
GET /Products?$top=20&$skip=40
```

### Filtering and Sorting

```
GET /Products?$filter=price gt 100&$orderby=name asc
```

### Expanding Associations

```
GET /Orders?$expand=items($expand=product)
```

## Error Handling

### Standard Error Responses

```javascript
// In service handler
srv.on('submitOrder', async (req) => {
  const { orderID } = req.data;
  const order = await SELECT.one.from('Orders').where({ ID: orderID });
  
  if (!order) {
    return req.error(404, 'Order not found', 'orderID');
  }
  
  if (order.status !== 'draft') {
    return req.error(400, 'Only draft orders can be submitted');
  }
  
  // Process order...
});
```

### Structured Error Messages

```javascript
return req.error({
  code: 'ORDER_INVALID',
  message: 'Order validation failed',
  target: 'items',
  details: [
    { code: 'ITEM_QUANTITY', message: 'Quantity must be positive', target: 'items/0/quantity' }
  ]
});
```

## Versioning

### URL-based Versioning

```cds
@path: '/api/v1'
service CatalogServiceV1 {
  entity Products as projection on db.Products;
}

@path: '/api/v2'
service CatalogServiceV2 {
  entity Products as projection on db.Products {
    *,
    newField  // Added in v2
  };
}
```

## Documentation

### OpenAPI Annotations

```cds
@Core.Description: 'Service for managing product catalog'
service CatalogService {
  
  @Core.Description: 'List of available products'
  entity Products as projection on db.Products;
  
  @Core.Description: 'Search products by name'
  @Core.LongDescription: 'Returns products matching the search term'
  function searchProducts(term: String) returns many Products;
}
```

## Best Practices Summary

1. **Keep services focused** - One service per bounded context
2. **Use projections** - Never expose raw database entities
3. **Implement proper authorization** - Use `@requires` and `@restrict`
4. **Handle errors gracefully** - Return meaningful error messages
5. **Document your APIs** - Use annotations for auto-generated docs
6. **Version when needed** - Plan for API evolution
