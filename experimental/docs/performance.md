# Performance Best Practices

Guidelines for building performant CAP applications.

## Database Optimization

### Use Pagination

```javascript
// Always paginate large datasets
this.on('READ', 'Products', async (req) => {
  const { $top = 100, $skip = 0 } = req.query.SELECT;
  return SELECT.from('Products').limit($top, $skip);
});
```

### Optimize Queries

```javascript
// Select only needed fields
const products = await SELECT
  .columns('ID', 'name', 'price')
  .from('Products');

// Use indexes for frequently queried fields
// In schema.cds:
// @cds.index: ['status', 'createdAt']
```

### Batch Operations

```javascript
// Batch inserts
await INSERT.into('Products').entries(productArray);

// Batch updates
await UPDATE('Products')
  .set({ status: 'archived' })
  .where({ lastModified: { '<': oneYearAgo } });
```

## Caching

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 });

this.on('READ', 'Products', async (req) => {
  const cacheKey = JSON.stringify(req.query);
  let data = cache.get(cacheKey);
  
  if (!data) {
    data = await cds.run(req.query);
    cache.set(cacheKey, data);
  }
  return data;
});
```

## Best Practices Summary

1. **Paginate** - Always limit result sets
2. **Select wisely** - Only fetch needed columns
3. **Cache** - Cache frequently accessed, rarely changed data
4. **Batch** - Use bulk operations for multiple records
5. **Index** - Add indexes for query patterns
