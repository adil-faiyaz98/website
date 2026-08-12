using { my.bookshop as db } from '../db/schema';

@path: '/catalog'
service CatalogService {
  
  @readonly
  entity Books as projection on db.Books {
    *,
    author.name as authorName
  };
  
  @readonly
  entity Authors as projection on db.Authors;
  
  @requires: 'authenticated-user'
  entity Orders as projection on db.Orders;
  
  action submitOrder(orderID: UUID) returns Orders;
  function getBooksByGenre(genre: String) returns many Books;
}
