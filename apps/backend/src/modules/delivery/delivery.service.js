/**
 * Cyborg Supermarket - Delivery & Fulfillment Service
 * Manages delivery zones, dispatch assignments, substitutions,
 * partial fulfillment, and state transition validation.
 */

const { db } = require('../../database/db');
const { inventoryService } = require('../inventory/inventory.service');

const VALID_FULFILLMENT_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: []
};

class DeliveryService {
  // 1. DELIVERY ZONES
  getDeliveryZones() {
    return db.query('SELECT * FROM delivery_zones WHERE is_active = 1 ORDER BY delivery_fee ASC');
  }

  getDeliveryZoneByCode(code) {
    return db.queryOne('SELECT * FROM delivery_zones WHERE code = ? AND is_active = 1', [code]);
  }

  calculateDeliveryFee(zoneCode, subtotal) {
    const zone = this.getDeliveryZoneByCode(zoneCode);
    if (!zone) {
      return { eligible: false, reason: 'Invalid or unsupported delivery zone' };
    }
    if (subtotal < Number(zone.min_order_amount)) {
      return {
        eligible: false,
        minOrderAmount: Number(zone.min_order_amount),
        shortfall: Number((Number(zone.min_order_amount) - subtotal).toFixed(2)),
        reason: `Subtotal is below minimum order requirement of ${zone.min_order_amount} EGP`
      };
    }
    return {
      eligible: true,
      zoneNameEn: zone.name_en,
      zoneNameAr: zone.name_ar,
      deliveryFee: Number(zone.delivery_fee),
      estimatedMinutes: zone.estimated_minutes
    };
  }

  // 2. FULFILLMENT STATE TRANSITION VALIDATION
  updateFulfillmentStatus(orderId, newStatus, { notes = '', actorId = 'System' } = {}) {
    const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const currentStatus = order.status;
    const allowed = VALID_FULFILLMENT_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new Error(`Illegal fulfillment state transition: cannot move from ${currentStatus} to ${newStatus}`);
    }

    // Cancellation rule: release inventory back to store
    if (newStatus === 'CANCELLED') {
      const items = db.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
      for (const item of items) {
        db.run('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime("now") WHERE product_id = ? AND store_id = ?',
          [item.quantity, item.product_id, order.store_id || 1]);
        
        db.run(
          `INSERT INTO stock_movements (product_id, store_id, movement_type, quantity, previous_qty, new_qty, reference_type, reference_id, created_by)
           VALUES (?, ?, 'RETURN', ?, 0, 0, 'ORDER_CANCELLED', ?, ?)`,
          [item.product_id, order.store_id || 1, item.quantity, orderId, actorId]
        );
      }
    }

    db.run(
      'UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?',
      [newStatus, orderId]
    );

    // Audit log
    db.run(
      `INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details)
       VALUES ('FULFILLMENT_STATUS_UPDATE', ?, 'STAFF', 'orders', ?, ?)`,
      [actorId, orderId, `Changed status from ${currentStatus} to ${newStatus}. Notes: ${notes}`]
    );

    return {
      orderId,
      previousStatus: currentStatus,
      newStatus,
      updatedAt: new Date().toISOString()
    };
  }

  // 3. PRODUCT SUBSTITUTION FOR OUT-OF-STOCK FULFILLMENT
  substituteProduct({ orderId, originalProductId, replacementProductId, quantity, cashierOrPickerId }) {
    const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const originalItem = db.queryOne(
      'SELECT * FROM order_items WHERE order_id = ? AND product_id = ?',
      [orderId, originalProductId]
    );
    if (!originalItem) throw new Error(`Product ${originalProductId} not found in order ${orderId}`);

    const replacement = db.queryOne('SELECT * FROM products WHERE id = ?', [replacementProductId]);
    if (!replacement) throw new Error(`Replacement product ${replacementProductId} not found`);

    // Check replacement stock
    const inv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = ? AND store_id = ?',
      [replacementProductId, order.store_id || 1]);
    if (!inv || inv.quantity < quantity) {
      throw new Error(`Insufficient replacement stock for ${replacement.name_en}`);
    }

    // Release original product stock back
    db.run('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime("now") WHERE product_id = ? AND store_id = ?',
      [originalItem.quantity, originalProductId, order.store_id || 1]);

    // Deduct replacement product stock
    db.run('UPDATE inventory SET quantity = quantity - ?, updated_at = datetime("now") WHERE product_id = ? AND store_id = ?',
      [quantity, replacementProductId, order.store_id || 1]);

    // Update order item to replacement
    const replacementUnitPrice = Number(replacement.price);
    const newSubtotal = replacementUnitPrice * quantity;

    db.run(
      `UPDATE order_items 
       SET product_id = ?, product_name_en = ?, product_name_ar = ?, barcode = ?, quantity = ?, unit_price = ?, subtotal = ?
       WHERE id = ?`,
      [
        replacement.id,
        `[SUB] ${replacement.name_en}`,
        `[بديل] ${replacement.name_ar}`,
        replacement.barcode,
        quantity,
        replacementUnitPrice,
        newSubtotal,
        originalItem.id
      ]
    );

    // Recalculate order total
    const totals = db.queryOne(
      'SELECT SUM(subtotal) as subtotal FROM order_items WHERE order_id = ?',
      [orderId]
    );
    const newTotal = Number(totals.subtotal) + Number(order.tax_amount) - Number(order.discount_amount);
    db.run('UPDATE orders SET subtotal = ?, total_amount = ?, updated_at = datetime("now") WHERE id = ?',
      [totals.subtotal, newTotal, orderId]);

    db.run(
      `INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details)
       VALUES ('PRODUCT_SUBSTITUTION', ?, 'PICKER', 'orders', ?, ?)`,
      [
        cashierOrPickerId || 'Picker',
        orderId,
        `Substituted Product ${originalProductId} (${originalItem.product_name_en}) with ${replacementProductId} (${replacement.name_en})`
      ]
    );

    return {
      orderId,
      originalProduct: originalItem.product_name_en,
      replacementProduct: replacement.name_en,
      newTotal,
      status: 'SUBSTITUTED'
    };
  }

  // 4. DISPATCH ASSIGNMENT
  assignCourier(orderId, { courierName, courierPhone, trackingCode }) {
    const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const deliveryNote = JSON.stringify({
      courier_name: courierName,
      courier_phone: courierPhone,
      tracking_code: trackingCode || `TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      assigned_at: new Date().toISOString()
    });

    db.run(
      `INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details)
       VALUES ('COURIER_ASSIGNED', 'DispatchManager', 'MANAGER', 'orders', ?, ?)`,
      [orderId, deliveryNote]
    );

    return this.updateFulfillmentStatus(orderId, 'OUT_FOR_DELIVERY', { notes: `Assigned to ${courierName}` });
  }

  // 5. DELIVERY CAPACITY SLOTS
  getAvailableSlots(zoneCode, slotDate) {
    const zone = this.getDeliveryZoneByCode(zoneCode);
    if (!zone) throw new Error(`Invalid delivery zone code: ${zoneCode}`);

    const targetDate = slotDate || new Date().toISOString().split('T')[0];
    let slots = db.query(
      `SELECT *, (max_orders - current_orders) as remaining_capacity
       FROM delivery_slots
       WHERE zone_id = ? AND slot_date = ? AND is_active = 1
       ORDER BY start_time ASC`,
      [zone.id, targetDate]
    );

    if (slots.length === 0) {
      db.run('UPDATE delivery_slots SET slot_date = ? WHERE zone_id = ?;', [targetDate, zone.id]);
      slots = db.query(
        `SELECT *, (max_orders - current_orders) as remaining_capacity
         FROM delivery_slots
         WHERE zone_id = ? AND slot_date = ? AND is_active = 1
         ORDER BY start_time ASC`,
        [zone.id, targetDate]
      );
    }

    return slots.map(s => ({
      ...s,
      isAvailable: s.remaining_capacity > 0
    }));
  }

  reserveSlot(slotId, orderId) {
    const slot = db.queryOne('SELECT * FROM delivery_slots WHERE id = ?', [slotId]);
    if (!slot) throw new Error(`Delivery slot ${slotId} not found`);

    if (slot.current_orders >= slot.max_orders) {
      throw new Error(`Delivery slot ${slot.start_time}-${slot.end_time} on ${slot.slot_date} is fully booked`);
    }

    db.run('UPDATE delivery_slots SET current_orders = current_orders + 1 WHERE id = ?', [slotId]);

    if (orderId) {
      db.run(
        `INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details)
         VALUES ('SLOT_RESERVED', 'Customer', 'CUSTOMER', 'delivery_slots', ?, ?)`,
        [String(slotId), `Reserved slot ${slot.start_time}-${slot.end_time} for order ${orderId}`]
      );
    }

    return {
      success: true,
      slotId,
      slotDate: slot.slot_date,
      timeWindow: `${slot.start_time} - ${slot.end_time}`,
      remainingCapacity: slot.max_orders - slot.current_orders - 1
    };
  }

  releaseSlot(slotId) {
    const slot = db.queryOne('SELECT * FROM delivery_slots WHERE id = ?', [slotId]);
    if (!slot) return { success: false };

    const newCount = Math.max(0, slot.current_orders - 1);
    db.run('UPDATE delivery_slots SET current_orders = ? WHERE id = ?', [newCount, slotId]);
    return { success: true, slotId, currentOrders: newCount };
  }
}

const deliveryService = new DeliveryService();
module.exports = { deliveryService, DeliveryService };
