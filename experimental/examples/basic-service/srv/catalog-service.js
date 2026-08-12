const cds = require('@sap/cds');

module.exports = cds.service.impl(async function() {
  const { Books, Orders, OrderItems } = this.entities;

  // Validate order before creation
  this.before('CREATE', 'Orders', async (req) => {
    const { items } = req.data;
    
    if (!items || items.length === 0) {
      return req.error(400, 'Order must have at least one item');
    }

    let total = 0;
    for (const item of items) {
      const book = await SELECT.one.from(Books).where({ ID: item.book_ID });
      if (!book) {
        return req.error(400, `Book ${item.book_ID} not found`);
      }
      if (book.stock < item.quantity) {
        return req.error(400, `Insufficient stock for ${book.title}`);
      }
      item.price = book.price * item.quantity;
      total += item.price;
    }
    
    req.data.total = total;
  });

  // Update stock after order creation
  this.after('CREATE', 'Orders', async (data, req) => {
    for (const item of data.items) {
      await UPDATE(Books)
        .set({ stock: { '-=': item.quantity } })
        .where({ ID: item.book_ID });
    }
  });

  // Custom action: Submit order
  this.on('submitOrder', async (req) => {
    const { orderID } = req.data;
    
    const order = await SELECT.one.from(Orders).where({ ID: orderID });
    if (!order) {
      return req.error(404, 'Order not found');
    }
    if (order.status !== 'draft') {
      return req.error(400, 'Only draft orders can be submitted');
    }

    await UPDATE(Orders).set({ status: 'submitted' }).where({ ID: orderID });
    return SELECT.one.from(Orders).where({ ID: orderID });
  });

  // Custom function: Get books by genre
  this.on('getBooksByGenre', async (req) => {
    const { genre } = req.data;
    return SELECT.from(Books).where({ genre });
  });
});
