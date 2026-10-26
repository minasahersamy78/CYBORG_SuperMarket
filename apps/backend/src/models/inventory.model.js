/**
 * Cyborg Supermarket - Inventory Model
 */

class InventoryModel {
  constructor(data = {}) {
    this.product_id = data.product_id;
    this.store_id = data.store_id || 1;
    this.quantity = parseInt(data.quantity || 0, 10);
    this.reserved_qty = parseInt(data.reserved_qty || 0, 10);
    this.low_stock_threshold = parseInt(data.low_stock_threshold || 10, 10);
    this.version = parseInt(data.version || 1, 10);
    this.available_quantity = this.quantity - this.reserved_qty;
    this.is_low_stock = this.available_quantity <= this.low_stock_threshold;
  }
}

module.exports = InventoryModel;
