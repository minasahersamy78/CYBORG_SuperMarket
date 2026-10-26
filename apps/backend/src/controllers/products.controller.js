const productsService = require('../modules/products/products.service');

const ProductsController = {
  list(query) {
    return productsService.list(query);
  },
  getById(id) {
    return productsService.getById(id);
  },
  getByBarcode(barcode) {
    return productsService.getByBarcode(barcode);
  },
  getCategories() {
    return productsService.getCategories();
  }
};

module.exports = ProductsController;
