/**
 * Cyborg Supermarket - Product Model
 * Grounded in genuine Excel dataset records
 */

class ProductModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.sku = data.sku || data.barcode || '';
    this.name_en = data.name_en || data.name || 'Product';
    this.name_ar = data.name_ar || '';
    this.barcode = data.barcode || '';
    this.price = parseFloat(data.price || 0);
    this.category_id = data.category_id || 1;
    this.category_name_en = data.category_name_en || '';
    this.category_name_ar = data.category_name_ar || '';
    this.brand = data.brand || 'Local Essentials';
    this.unit = data.unit || 'piece';
    this.image_url = data.image_url || '';
    this.is_active = data.is_active !== undefined ? Boolean(data.is_active) : true;
    this.stock = data.available_quantity || data.quantity || 50;
  }
}

module.exports = ProductModel;
