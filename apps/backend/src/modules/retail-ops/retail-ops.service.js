/**
 * Cyborg Supermarket - Retail Operations Service
 * Handles multi-store, multi-terminal, suppliers, purchase orders, goods receiving,
 * batch/expiry tracking, stock counts, discrepancy reconciliation, returns, and promotions.
 */

const { db } = require('../../database/db');
const { randomUUID } = require('crypto');

class RetailOpsService {
  // 1. STORES & TERMINALS
  getStores() {
    return db.query('SELECT * FROM stores ORDER BY id ASC');
  }

  getStoreById(id) {
    return db.queryOne('SELECT * FROM stores WHERE id = ?', [id]);
  }

  createStore({ code, name_en, name_ar, address, city, phone }) {
    db.run(
      `INSERT INTO stores (code, name_en, name_ar, address, city, phone) VALUES (?, ?, ?, ?, ?, ?)`,
      [code, name_en, name_ar, address || '', city || 'Cairo', phone || '']
    );
    return db.queryOne('SELECT * FROM stores WHERE code = ?', [code]);
  }

  getTerminals(storeId) {
    if (storeId) {
      return db.query('SELECT * FROM terminals WHERE store_id = ? ORDER BY code ASC', [storeId]);
    }
    return db.query('SELECT * FROM terminals ORDER BY store_id ASC, code ASC');
  }

  registerTerminal({ storeId, code, name, ipAddress }) {
    const id = `TRM-${Date.now().toString(36).toUpperCase()}`;
    db.run(
      `INSERT INTO terminals (id, store_id, code, name, ip_address) VALUES (?, ?, ?, ?, ?)`,
      [id, storeId, code, name, ipAddress || '127.0.0.1']
    );
    return db.queryOne('SELECT * FROM terminals WHERE id = ?', [id]);
  }

  // 2. SUPPLIERS
  getSuppliers() {
    return db.query('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC');
  }

  createSupplier({ code, name, contactPerson, phone, email, taxId, paymentTerms }) {
    db.run(
      `INSERT INTO suppliers (code, name, contact_person, phone, email, tax_id, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code, name, contactPerson || '', phone || '', email || '', taxId || '', paymentTerms || 'Net 30']
    );
    return db.queryOne('SELECT * FROM suppliers WHERE code = ?', [code]);
  }

  // 3. PURCHASE ORDERS
  createPurchaseOrder({ supplierId, storeId, items, expectedDate, notes, createdBy }) {
    const poId = `PO-${Date.now()}`;
    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let totalAmount = 0;

    items.forEach(item => {
      totalAmount += item.ordered_qty * item.unit_cost;
    });

    db.run(
      `INSERT INTO purchase_orders (id, po_number, supplier_id, store_id, status, total_amount, expected_date, notes, created_by)
       VALUES (?, ?, ?, ?, 'SUBMITTED', ?, ?, ?, ?)`,
      [poId, poNumber, supplierId, storeId, totalAmount, expectedDate || null, notes || '', createdBy || 'Manager']
    );

    for (const item of items) {
      const subtotal = item.ordered_qty * item.unit_cost;
      db.run(
        `INSERT INTO purchase_order_items (po_id, product_id, ordered_qty, unit_cost, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [poId, item.product_id, item.ordered_qty, item.unit_cost, subtotal]
      );
    }

    return this.getPurchaseOrderById(poId);
  }

  getPurchaseOrders(storeId = null) {
    let sql = `SELECT po.*, s.name as supplier_name, st.name_en as store_name
               FROM purchase_orders po
               LEFT JOIN suppliers s ON po.supplier_id = s.id
               LEFT JOIN stores st ON po.store_id = st.id`;
    const params = [];
    if (storeId) {
      sql += ' WHERE po.store_id = ?';
      params.push(storeId);
    }
    sql += ' ORDER BY po.created_at DESC';
    return db.query(sql, params);
  }

  getPurchaseOrderById(id) {
    const po = db.queryOne(
      `SELECT po.*, s.name as supplier_name, st.name_en as store_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN stores st ON po.store_id = st.id
       WHERE po.id = ?`,
      [id]
    );
    if (!po) return null;

    po.items = db.query(
      `SELECT poi.*, p.name_en as product_name_en, p.name_ar as product_name_ar, p.barcode
       FROM purchase_order_items poi
       JOIN products p ON poi.product_id = p.id
       WHERE poi.po_id = ?`,
      [id]
    );
    return po;
  }

  // 4. GOODS RECEIVING (GRN) & INVENTORY UPDATES
  receiveGoods({ poId, storeId, supplierInvoiceNo, receivedBy, items, notes }) {
    const grnId = `GRN-${Date.now()}`;
    const grnNumber = `GRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    db.run(
      `INSERT INTO goods_receiving (id, grn_number, po_id, store_id, supplier_invoice_no, received_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [grnId, grnNumber, poId || null, storeId, supplierInvoiceNo || '', receivedBy, notes || '']
    );

    for (const item of items) {
      db.run(
        `INSERT INTO goods_receiving_items (grn_id, product_id, received_qty, unit_cost, batch_number, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [grnId, item.product_id, item.received_qty, item.unit_cost, item.batch_number || null, item.expiry_date || null]
      );

      // Fetch existing inventory
      const currentInv = db.queryOne('SELECT * FROM inventory WHERE product_id = ? AND store_id = ?', [item.product_id, storeId]);
      const prevQty = currentInv ? currentInv.quantity : 0;
      const newQty = prevQty + item.received_qty;

      if (currentInv) {
        db.run('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime("now") WHERE product_id = ? AND store_id = ?',
          [item.received_qty, item.product_id, storeId]);
      } else {
        db.run('INSERT INTO inventory (product_id, store_id, quantity, reserved_qty, version) VALUES (?, ?, ?, 0, 1)',
          [item.product_id, storeId, item.received_qty]);
      }

      // Record stock movement
      db.run(
        `INSERT INTO stock_movements (product_id, store_id, movement_type, quantity, previous_qty, new_qty, unit_cost, reference_type, reference_id, created_by)
         VALUES (?, ?, 'RECEIVING', ?, ?, ?, ?, 'GRN', ?, ?)`,
        [item.product_id, storeId, item.received_qty, prevQty, newQty, item.unit_cost, grnId, receivedBy]
      );

      // Record batch if provided
      if (item.batch_number && item.expiry_date) {
        db.run(
          `INSERT INTO product_batches (product_id, store_id, batch_number, expiry_date, initial_quantity, current_quantity, unit_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [item.product_id, storeId, item.batch_number, item.expiry_date, item.received_qty, item.received_qty, item.unit_cost]
        );
      }

      // If associated with a PO, update received qty on PO item
      if (poId) {
        db.run(
          `UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE po_id = ? AND product_id = ?`,
          [item.received_qty, poId, item.product_id]
        );
      }
    }

    if (poId) {
      // Check if all items received
      const remaining = db.query(
        `SELECT * FROM purchase_order_items WHERE po_id = ? AND received_qty < ordered_qty`,
        [poId]
      );
      const newStatus = remaining.length === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      db.run('UPDATE purchase_orders SET status = ?, updated_at = datetime("now") WHERE id = ?', [newStatus, poId]);
    }

    return { grnId, grnNumber, storeId, itemsCount: items.length, status: 'COMPLETED' };
  }

  // 5. STOCK MOVEMENTS & AUDIT
  getStockMovements(productId = null, storeId = null, limit = 50) {
    let sql = `SELECT sm.*, p.name_en as product_name_en, p.name_ar as product_name_ar, p.barcode
               FROM stock_movements sm
               JOIN products p ON sm.product_id = p.id
               WHERE 1=1`;
    const params = [];
    if (productId) {
      sql += ' AND sm.product_id = ?';
      params.push(productId);
    }
    if (storeId) {
      sql += ' AND sm.store_id = ?';
      params.push(storeId);
    }
    sql += ' ORDER BY sm.created_at DESC LIMIT ?';
    params.push(limit);
    return db.query(sql, params);
  }

  // 6. STOCK COUNTS & RECONCILIATION
  createStockCount({ storeId, countedBy, notes, items }) {
    const countId = `CNT-${Date.now()}`;
    const countNumber = `STK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    db.run(
      `INSERT INTO stock_counts (id, count_number, store_id, status, counted_by, notes)
       VALUES (?, ?, ?, 'COMPLETED', ?, ?)`,
      [countId, countNumber, storeId, countedBy, notes || '']
    );

    let totalDiscrepancyQty = 0;
    let totalDiscrepancyValue = 0;

    for (const item of items) {
      const inv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = ? AND store_id = ?', [item.product_id, storeId]);
      const systemQty = inv ? inv.quantity : 0;
      const discrepancyQty = item.counted_qty - systemQty;
      const product = db.queryOne('SELECT price FROM products WHERE id = ?', [item.product_id]);
      const unitPrice = product ? Number(product.price) : 0;
      const discrepancyValue = discrepancyQty * unitPrice;

      totalDiscrepancyQty += discrepancyQty;
      totalDiscrepancyValue += discrepancyValue;

      db.run(
        `INSERT INTO stock_count_items (stock_count_id, product_id, system_qty, counted_qty, discrepancy_qty, discrepancy_value)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [countId, item.product_id, systemQty, item.counted_qty, discrepancyQty, discrepancyValue]
      );
    }

    return {
      countId,
      countNumber,
      storeId,
      itemsCount: items.length,
      totalDiscrepancyQty,
      totalDiscrepancyValue,
      status: 'COMPLETED'
    };
  }

  reconcileStockCount(stockCountId, approvedBy = 'Auditor') {
    const count = db.queryOne('SELECT * FROM stock_counts WHERE id = ?', [stockCountId]);
    if (!count) throw new Error(`Stock count ${stockCountId} not found`);
    if (count.status === 'RECONCILED') throw new Error(`Stock count ${stockCountId} already reconciled`);

    const items = db.query('SELECT * FROM stock_count_items WHERE stock_count_id = ?', [stockCountId]);

    for (const item of items) {
      if (item.discrepancy_qty !== 0) {
        const inv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = ? AND store_id = ?', [item.product_id, count.store_id]);
        const prevQty = inv ? inv.quantity : 0;
        const newQty = item.counted_qty;

        db.run('UPDATE inventory SET quantity = ?, updated_at = datetime("now") WHERE product_id = ? AND store_id = ?',
          [newQty, item.product_id, count.store_id]);

        db.run(
          `INSERT INTO stock_movements (product_id, store_id, movement_type, quantity, previous_qty, new_qty, reference_type, reference_id, created_by)
           VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, 'STOCK_COUNT', ?, ?)`,
          [item.product_id, count.store_id, item.discrepancy_qty, prevQty, newQty, stockCountId, approvedBy]
        );
      }
      db.run('UPDATE stock_count_items SET reconciled = 1 WHERE id = ?', [item.id]);
    }

    db.run('UPDATE stock_counts SET status = "RECONCILED", reconciled_at = datetime("now") WHERE id = ?', [stockCountId]);
    return { stockCountId, status: 'RECONCILED', reconciledItems: items.length };
  }

  // 7. RETURNS, EXCHANGES & REFUNDS
  processReturn({ orderId, storeId = 1, cashierId, returnType = 'REFUND', items, reason }) {
    const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const returnId = `RET-${Date.now()}`;
    const returnNumber = `RET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalRefundAmount = 0;

    // Validate return items against original order
    for (const item of items) {
      const orderItem = db.queryOne(
        'SELECT * FROM order_items WHERE order_id = ? AND product_id = ?',
        [orderId, item.product_id]
      );
      if (!orderItem) {
        throw new Error(`Product ${item.product_id} was not part of order ${orderId}`);
      }
      if (item.quantity > orderItem.quantity) {
        throw new Error(`Cannot return ${item.quantity} units; only ${orderItem.quantity} originally purchased`);
      }
      const refundAmount = item.quantity * Number(orderItem.unit_price);
      totalRefundAmount += refundAmount;
    }

    db.run(
      `INSERT INTO returns (id, return_number, order_id, store_id, cashier_id, return_type, total_amount, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
      [returnId, returnNumber, orderId, storeId, cashierId, returnType, totalRefundAmount, reason || 'Customer Return']
    );

    for (const item of items) {
      const orderItem = db.queryOne('SELECT unit_price FROM order_items WHERE order_id = ? AND product_id = ?', [orderId, item.product_id]);
      const refundAmount = item.quantity * Number(orderItem.unit_price);
      const condition = item.condition || 'SELLABLE';

      db.run(
        `INSERT INTO return_items (return_id, order_item_id, product_id, quantity, refund_amount, condition)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [returnId, item.order_item_id || null, item.product_id, item.quantity, refundAmount, condition]
      );

      // Restore stock only if item is sellable
      if (condition === 'SELLABLE') {
        const inv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = ? AND store_id = ?', [item.product_id, storeId]);
        const prevQty = inv ? inv.quantity : 0;
        const newQty = prevQty + item.quantity;

        db.run('UPDATE inventory SET quantity = quantity + ?, updated_at = datetime("now") WHERE product_id = ? AND store_id = ?',
          [item.quantity, item.product_id, storeId]);

        db.run(
          `INSERT INTO stock_movements (product_id, store_id, movement_type, quantity, previous_qty, new_qty, reference_type, reference_id, created_by)
           VALUES (?, ?, 'RETURN', ?, ?, ?, 'RETURN', ?, ?)`,
          [item.product_id, storeId, item.quantity, prevQty, newQty, returnId, cashierId]
        );
      } else {
        // Log spoilage / damaged stock movement
        db.run(
          `INSERT INTO stock_movements (product_id, store_id, movement_type, quantity, previous_qty, new_qty, reference_type, reference_id, created_by)
           VALUES (?, ?, 'SPOILAGE', ?, 0, 0, 'RETURN_DAMAGED', ?, ?)`,
          [item.product_id, storeId, item.quantity, returnId, cashierId]
        );
      }
    }

    // Check if entire order refunded
    const totalOrderItemsCount = db.queryOne('SELECT SUM(quantity) as total FROM order_items WHERE order_id = ?', [orderId]).total;
    const totalReturnedCount = db.queryOne(
      `SELECT SUM(ri.quantity) as total FROM return_items ri JOIN returns r ON ri.return_id = r.id WHERE r.order_id = ?`,
      [orderId]
    ).total;

    if (totalReturnedCount >= totalOrderItemsCount) {
      db.run('UPDATE orders SET status = "REFUNDED", updated_at = datetime("now") WHERE id = ?', [orderId]);
    }

    return {
      returnId,
      returnNumber,
      orderId,
      returnType,
      totalRefundAmount,
      itemsCount: items.length,
      status: 'COMPLETED'
    };
  }

  // 8. PROMOTIONS & DISCOUNT PRECEDENCE ENGINE
  getPromotions() {
    return db.query('SELECT * FROM promotions WHERE is_active = 1 ORDER BY precedence ASC');
  }

  applyPromotions(items, subtotal) {
    const activePromos = db.query(
      `SELECT * FROM promotions 
       WHERE is_active = 1 
         AND date('now') BETWEEN date(start_date) AND date(end_date)
       ORDER BY precedence ASC`
    );

    let applicableDiscount = 0;
    let appliedPromo = null;

    for (const promo of activePromos) {
      if (subtotal >= Number(promo.min_order_amount)) {
        if (promo.promo_type === 'PERCENTAGE') {
          const discount = (subtotal * Number(promo.discount_value)) / 100.0;
          if (discount > applicableDiscount) {
            applicableDiscount = discount;
            appliedPromo = promo;
          }
        } else if (promo.promo_type === 'FIXED_DISCOUNT') {
          const discount = Number(promo.discount_value);
          if (discount > applicableDiscount) {
            applicableDiscount = discount;
            appliedPromo = promo;
          }
        }
      }
    }

    // Ensure discount does not exceed subtotal
    applicableDiscount = Math.min(applicableDiscount, subtotal);

    return {
      discountAmount: Number(applicableDiscount.toFixed(2)),
      appliedPromotion: appliedPromo ? {
        id: appliedPromo.id,
        code: appliedPromo.code,
        name_en: appliedPromo.name_en,
        name_ar: appliedPromo.name_ar,
        type: appliedPromo.promo_type
      } : null
    };
  }

  // 9. UNITS OF MEASURE CONVERSION
  getUnitsOfMeasure() {
    return db.query('SELECT * FROM units_of_measure ORDER BY id ASC');
  }

  convertUOM(quantity, fromUnitCode, toUnitCode) {
    if (fromUnitCode === toUnitCode) return quantity;
    const from = db.queryOne('SELECT * FROM units_of_measure WHERE code = ?', [fromUnitCode]);
    const to = db.queryOne('SELECT * FROM units_of_measure WHERE code = ?', [toUnitCode]);
    if (!from || !to) throw new Error(`Invalid UOM codes: ${fromUnitCode} -> ${toUnitCode}`);
    if (from.base_unit !== to.base_unit) throw new Error(`Cannot convert between different physical dimensions: ${from.base_unit} vs ${to.base_unit}`);

    // Convert from -> base -> to
    const baseQuantity = quantity * Number(from.conversion_factor);
    const targetQuantity = baseQuantity / Number(to.conversion_factor);
    return Number(targetQuantity.toFixed(4));
  }

  // 10. BATCH & EXPIRY TRACKING
  getBatches(productId = null, storeId = 1) {
    let sql = `SELECT pb.*, p.name_en, p.name_ar, p.barcode
               FROM product_batches pb
               JOIN products p ON pb.product_id = p.id
               WHERE pb.store_id = ?`;
    const params = [storeId];
    if (productId) {
      sql += ' AND pb.product_id = ?';
      params.push(productId);
    }
    sql += ' ORDER BY pb.expiry_date ASC';
    return db.query(sql, params);
  }

  getExpiringBatches(daysAhead = 30, storeId = 1) {
    const sql = `SELECT pb.*, p.name_en, p.name_ar, p.barcode,
                        julianday(pb.expiry_date) - julianday('now') as days_until_expiry
                 FROM product_batches pb
                 JOIN products p ON pb.product_id = p.id
                 WHERE pb.store_id = ?
                   AND date(pb.expiry_date) <= date('now', '+' || ? || ' days')
                   AND pb.current_quantity > 0
                 ORDER BY pb.expiry_date ASC`;
    return db.query(sql, [storeId, daysAhead]);
  }
}

const retailOpsService = new RetailOpsService();
module.exports = { retailOpsService, RetailOpsService };
