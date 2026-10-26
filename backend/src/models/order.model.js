/**
 * Cyborg Supermarket - Order Model
 */

class OrderModel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.user_id = data.user_id || null;
    this.customer_name = data.customer_name || 'Customer';
    this.source = data.source || 'ONLINE';
    this.status = data.status || 'PENDING';
    this.subtotal = parseFloat(data.subtotal || 0);
    this.tax_amount = parseFloat(data.tax_amount || 0);
    this.discount_amount = parseFloat(data.discount_amount || 0);
    this.total_amount = parseFloat(data.total_amount || 0);
    this.payment_method = data.payment_method || 'CASH';
    this.payment_status = data.payment_status || 'PENDING';
    this.delivery_address = data.delivery_address || 'Store Pickup';
    this.items = data.items || [];
    this.created_at = data.created_at || new Date().toISOString();
  }

  isCancellable() {
    return ['CONFIRMED', 'PENDING', 'PREPARING', 'READY'].includes(this.status);
  }
}

module.exports = OrderModel;
