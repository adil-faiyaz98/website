namespace my.bookshop;

using { managed, Currency } from '@sap/cds/common';

entity Books : managed {
  key ID : UUID;
  title : String(100) @mandatory;
  author : Association to Authors;
  genre : String(50);
  price : Decimal(10,2);
  currency : Currency;
  stock : Integer default 0;
}

entity Authors : managed {
  key ID : UUID;
  name : String(100) @mandatory;
  books : Association to many Books on books.author = $self;
}

entity Orders : managed {
  key ID : UUID;
  customer : String(100);
  items : Composition of many OrderItems on items.order = $self;
  total : Decimal(10,2);
  status : String enum { draft; submitted; completed; } default 'draft';
}

entity OrderItems {
  key ID : UUID;
  order : Association to Orders;
  book : Association to Books;
  quantity : Integer @assert.range: [1, 100];
  price : Decimal(10,2);
}
