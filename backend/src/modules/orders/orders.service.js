/**
 * Cyborg Supermarket - Order & Checkout Management Service
 * Implements State Machine, Idempotent Processing, and Server-Side Recalculations
 */

const crypto = require('crypto');
const db = require('../../database/db');
const inventoryService = require('../inventory/inventory.service');
const emailService = require('../email/email.service');

// Valid state machine transitions
const VALID_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: []
};

const ordersService = {
  createOrder(dto, actor = null) {
    // 1. Idempotency Check
    if (dto.idempotency_key) {
      const existing = db.getOne('SELECT * FROM orders WHERE idempotency_key = ? LIMIT 1;', [dto.idempotency_key]);
      if (existing) {
        return this.getOrderById(existing.id);
      }
    }

    if (!dto.items || dto.items.length === 0) {
      return { success: false, statusCode: 400, error: 'Order must contain at least one item' };
    }

    // 2. Server-side Price & Stock Revalidation
    let subtotal = 0;
    const validatedItems = [];

    for (const item of dto.items) {
      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        return { success: false, statusCode: 400, error: `Invalid quantity for product ID ${item.product_id}` };
      }

      const product = db.getOne('SELECT id, barcode, name_en, name_ar, price, is_active FROM products WHERE id = ?;', [item.product_id]);
      if (!product || !product.is_active) {
        return { success: false, statusCode: 404, error: `Product ID ${item.product_id} is inactive or not found` };
      }

      // Concurrency Stock Check
      const inv = db.getOne('SELECT quantity, reserved_qty FROM inventory WHERE product_id = ?;', [product.id]);
      const available = inv ? (inv.quantity - inv.reserved_qty) : 0;
      if (available < qty) {
        return {
          success: false,
          statusCode: 409,
          error: `Insufficient stock for '${product.name_en}'. Available: ${available}, requested: ${qty}`
        };
      }

      const unitPrice = parseFloat(product.price);
      const lineTotal = parseFloat((unitPrice * qty).toFixed(2));
      subtotal += lineTotal;

      validatedItems.push({
        product_id: product.id,
        barcode: product.barcode,
        product_name_en: product.name_en,
        product_name_ar: product.name_ar,
        quantity: qty,
        unit_price: unitPrice,
        subtotal: lineTotal
      });
    }

    subtotal = parseFloat(subtotal.toFixed(2));
    const taxRate = 0.14; // 14% Egyptian VAT
    const taxAmount = parseFloat((subtotal * taxRate).toFixed(2));
    const discountAmount = parseFloat(Number(dto.discount_amount || 0).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount - discountAmount).toFixed(2));

    const orderId = 'ord-' + crypto.randomUUID().substring(0, 10);
    const source = dto.source || 'ONLINE';
    const status = (source === 'POS') ? 'DELIVERED' : 'CONFIRMED';
    const paymentStatus = (source === 'POS' || dto.payment_status === 'COMPLETED') ? 'COMPLETED' : 'PENDING';
    const shiftId = (source === 'POS') ? (dto.shift_id || 'shift-cairo-001') : null;
    const userId = actor ? actor.sub || actor.id : (dto.user_id || null);

    // 3. Atomically Deduct Stock
    inventoryService.deductStock(validatedItems, dto.store_id || 1);

    // 4. Persist Order
    db.run(`
      INSERT INTO orders (
        id, user_id, customer_name, source, status, shift_id, store_id, terminal_id,
        subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status,
        delivery_address, idempotency_key, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, datetime('now'), datetime('now')
      );
    `, [
      orderId, userId, dto.customer_name || 'Walking Customer', source, status, shiftId, dto.store_id || 1, dto.terminal_id || 'TERM-01',
      subtotal, taxAmount, discountAmount, totalAmount, dto.payment_method || 'CASH', paymentStatus,
      dto.delivery_address || 'Store Pickup', dto.idempotency_key || null
    ]);

    // 5. Persist Line Items
    for (const line of validatedItems) {
      db.run(`
        INSERT INTO order_items (
          order_id, product_id, product_name_en, product_name_ar, barcode, quantity, unit_price, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        orderId, line.product_id, line.product_name_en, line.product_name_ar, line.barcode,
        line.quantity, line.unit_price, line.subtotal
      ]);
    }

    // 6. Update Shift Totals if POS
    if (source === 'POS' && shiftId) {
      const isCash = (dto.payment_method === 'CASH');
      db.run(`
        UPDATE shifts
        SET total_transactions = total_transactions + 1,
            total_cash_sales = total_cash_sales + ${isCash ? totalAmount : 0},
            total_card_sales = total_card_sales + ${!isCash ? totalAmount : 0}
        WHERE id = ?;
      `, [shiftId]);
    }

    // 7. Record Sync & Audit Event
    db.run(
      'INSERT INTO sync_events (event_uuid, entity_type, entity_id, action, delta_payload) VALUES (?, ?, ?, ?, ?);',
      [
        'evt-ord-' + Date.now(),
        'ORDER',
        orderId,
        'INSERT',
        JSON.stringify({ order_id: orderId, source, total_amount: totalAmount, status })
      ]
    );

    const createdOrder = this.getOrderById(orderId);
    if (createdOrder && createdOrder.success) {
      try {
        emailService.sendOrderNotification(createdOrder.data, dto.customer_email || 'cyborgcoding1@gmail.com');
      } catch (_) {}
    }
    return createdOrder;
  },

  getOrderById(id) {
    const order = db.getOne('SELECT * FROM orders WHERE id = ? LIMIT 1;', [id]);
    if (!order) return { success: false, statusCode: 404, error: 'Order not found' };

    const items = db.query('SELECT * FROM order_items WHERE order_id = ?;', [id]);
    return {
      success: true,
      statusCode: 200,
      data: {
        ...order,
        items
      }
    };
  },

  listOrders(query = {}) {
    const page = Math.max(1, parseInt(query.page || 1, 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || 20, 10)));
    const offset = (page - 1) * limit;

    let whereClauses = ['1=1'];
    const params = [];

    if (query.status) {
      whereClauses.push('status = ?');
      params.push(query.status);
    }
    if (query.source) {
      whereClauses.push('source = ?');
      params.push(query.source);
    }
    if (query.user_id) {
      whereClauses.push('user_id = ?');
      params.push(query.user_id);
    }
    if (query.shift_id) {
      whereClauses.push('shift_id = ?');
      params.push(query.shift_id);
    }

    const whereSql = whereClauses.join(' AND ');

    const countRow = db.getOne(`SELECT count(*) as total FROM orders WHERE ${whereSql};`, params);
    const total = countRow ? parseInt(countRow.total, 10) : 0;

    const orders = db.query(`
      SELECT * FROM orders
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `, params);

    return {
      success: true,
      statusCode: 200,
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  },

  updateStatus(orderId, newStatus, actor = null) {
    const order = db.getOne('SELECT status FROM orders WHERE id = ? LIMIT 1;', [orderId]);
    if (!order) return { success: false, statusCode: 404, error: 'Order not found' };

    const permittedNext = VALID_TRANSITIONS[order.status] || [];
    if (!permittedNext.includes(newStatus)) {
      return {
        success: false,
        statusCode: 400,
        error: `Illegal state transition from '${order.status}' to '${newStatus}'. Permitted: [${permittedNext.join(', ')}]`
      };
    }

    db.run(
      'UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?;',
      [newStatus, orderId]
    );

    // Audit log
    db.run(
      'INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?);',
      ['ORDER_STATUS_CHANGED', actor ? actor.sub : 'system', actor ? actor.role : 'SYSTEM', 'ORDER', orderId, `Status transitioned from ${order.status} to ${newStatus}`]
    );

    return this.getOrderById(orderId);
  },

  processRefund(orderId, reason = 'CUSTOMER_RETURN', actor = null) {
    const order = db.getOne('SELECT * FROM orders WHERE id = ? LIMIT 1;', [orderId]);
    if (!order) return { success: false, statusCode: 404, error: 'Order not found' };
    if (order.status === 'REFUNDED') {
      return { success: false, statusCode: 400, error: 'Order has already been refunded' };
    }

    const items = db.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?;', [orderId]);

    // Restore stock
    for (const item of items) {
      inventoryService.adjustStock(item.product_id, item.quantity, `REFUND_RESTORE_${orderId}`);
    }

    db.run('UPDATE orders SET status = "REFUNDED", updated_at = datetime("now") WHERE id = ?;', [orderId]);

    // Update shift refund totals if POS
    if (order.shift_id) {
      db.run(
        'UPDATE shifts SET total_refunds = total_refunds + ? WHERE id = ?;',
        [order.total_amount, order.shift_id]
      );
    }

    // Audit
    db.run(
      'INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?);',
      ['ORDER_REFUNDED', actor ? actor.sub : 'cashier', actor ? actor.role : 'CASHIER', 'ORDER', orderId, `Order refunded for amount ${order.total_amount} EGP. Reason: ${reason}`]
    );

    return this.getOrderById(orderId);
  },

  cancelOrder(orderId, reason = 'CUSTOMER_CANCELLED', actor = null) {
    const order = db.getOne('SELECT * FROM orders WHERE id = ? LIMIT 1;', [orderId]);
    if (!order) return { success: false, statusCode: 404, error: 'Order not found' };
    if (order.status === 'CANCELLED') {
      return { success: false, statusCode: 400, error: 'Order is already cancelled' };
    }
    if (order.status === 'REFUNDED') {
      return { success: false, statusCode: 400, error: 'Cannot cancel an already refunded order' };
    }

    const permittedNext = VALID_TRANSITIONS[order.status] || [];
    if (!permittedNext.includes('CANCELLED')) {
      return {
        success: false,
        statusCode: 400,
        error: `Order in '${order.status}' status cannot be cancelled. Only orders in [${Object.keys(VALID_TRANSITIONS).filter(k => (VALID_TRANSITIONS[k]||[]).includes('CANCELLED')).join(', ')}] can be cancelled.`
      };
    }

    // 1. Restore Inventory Stock for all line items
    const items = db.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?;', [orderId]);
    for (const item of items) {
      inventoryService.adjustStock(item.product_id, item.quantity, `CANCEL_RESTORE_${orderId}`);
    }

    // 2. Transition Order Status to CANCELLED
    db.run(
      "UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?;",
      [orderId]
    );

    // 3. Persist Audit Log
    db.run(
      "INSERT INTO audit_logs (action, actor_id, actor_role, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?);",
      ['ORDER_CANCELLED', actor ? (actor.sub || actor.id) : 'customer', actor ? actor.role : 'CUSTOMER', 'ORDER', orderId, `Order cancelled. Reason: ${reason}`]
    );

    // 4. Notify via Email
    const updated = this.getOrderById(orderId);
    try {
      if (updated && updated.success) {
        emailService.sendChatbotFeedback({
          feedbackType: 'ORDER_CANCELLATION',
          customerName: order.customer_name || 'Customer',
          message: `Order #${orderId} was cancelled (${reason}). Inventory quantities automatically restored.`
        }, 'cyborgcoding1@gmail.com');
      }
    } catch (_) {}

    return updated;
  }
};

module.exports = ordersService;
