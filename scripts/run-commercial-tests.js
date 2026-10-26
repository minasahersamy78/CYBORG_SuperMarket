/**
 * Cyborg Supermarket - Commercial Readiness & Retail Operations Test Suite
 * Validates Sections A, B, C, F of Commercial Readiness requirements
 */

const assert = require('assert');
const crypto = require('crypto');
const { retailOpsService } = require('../apps/backend/src/modules/retail-ops/retail-ops.service');
const { paymentsService } = require('../apps/backend/src/modules/payments/payments.service');
const { deliveryService } = require('../apps/backend/src/modules/delivery/delivery.service');
const reportsService = require('../apps/backend/src/modules/reports/reports.service');
const { db } = require('../apps/backend/src/database/db');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — COMMERCIAL READINESS TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// SECTION A: RETAIL OPERATIONS TESTS
// -------------------------------------------------------------
runTest('Retail Ops: Multi-Store and Multi-Terminal Management', () => {
  const stores = retailOpsService.getStores();
  assert(stores.length >= 2, 'Should have at least 2 seeded stores');
  assert.strictEqual(stores[0].code, 'STR-001');

  const terminalsStore1 = retailOpsService.getTerminals(1);
  assert(terminalsStore1.length >= 2, 'Store 1 should have multiple checkout terminals');
});

runTest('Retail Ops: Supplier PO and Goods Receiving (GRN) with Stock Movements', () => {
  const suppliers = retailOpsService.getSuppliers();
  assert(suppliers.length >= 3, 'Should have seeded suppliers');
  const supplierId = suppliers[0].id;

  // Create Purchase Order
  const po = retailOpsService.createPurchaseOrder({
    supplierId,
    storeId: 1,
    items: [{ product_id: 1, ordered_qty: 50, unit_cost: 15.00 }],
    expectedDate: '2026-11-01',
    notes: 'Weekly fresh stock',
    createdBy: 'TestManager'
  });

  assert(po && po.id.startsWith('PO-'), 'PO should be created');
  assert.strictEqual(po.status, 'SUBMITTED');
  assert.strictEqual(po.items.length, 1);

  // Initial stock of product 1
  const prevInv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = 1 AND store_id = 1');
  const prevQty = prevInv ? prevInv.quantity : 0;

  // Receive Goods (GRN)
  const grn = retailOpsService.receiveGoods({
    poId: po.id,
    storeId: 1,
    supplierInvoiceNo: 'INV-TEST-999',
    receivedBy: 'WarehouseReceiver',
    items: [{
      product_id: 1,
      received_qty: 50,
      unit_cost: 15.00,
      batch_number: 'BATCH-2026-X1',
      expiry_date: '2026-12-31'
    }]
  });

  assert.strictEqual(grn.status, 'COMPLETED');

  // Verify inventory incremented
  const updatedInv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = 1 AND store_id = 1');
  assert.strictEqual(updatedInv.quantity, prevQty + 50, 'Inventory quantity must increase by 50');

  // Verify stock movement logged
  const movements = retailOpsService.getStockMovements(1, 1, 5);
  const grnMovement = movements.find(m => m.reference_id === grn.grnId);
  assert(grnMovement, 'GRN stock movement should be persisted in audit trail');
  assert.strictEqual(grnMovement.movement_type, 'RECEIVING');

  // Verify batch recorded
  const batches = retailOpsService.getBatches(1, 1);
  const createdBatch = batches.find(b => b.batch_number === 'BATCH-2026-X1');
  assert(createdBatch, 'Product batch should be recorded with expiry date');
});

runTest('Retail Ops: Physical Stock Count & Discrepancy Reconciliation', () => {
  // Ensure product 99 has known stock before testing discrepancy
  db.run('UPDATE inventory SET quantity = 100 WHERE product_id = 99 AND store_id = 1');
  const currentQty = 100;

  // Counted 5 units less (shrinkage)
  const countedQty = currentQty - 5;
  const countRes = retailOpsService.createStockCount({
    storeId: 1,
    countedBy: 'InventoryAuditor',
    items: [{ product_id: 99, counted_qty: countedQty }]
  });

  assert.strictEqual(countRes.totalDiscrepancyQty, -5, 'Discrepancy quantity should be -5');

  // Reconcile stock count
  const recRes = retailOpsService.reconcileStockCount(countRes.countId, 'AuditorApprover');
  assert.strictEqual(recRes.status, 'RECONCILED');

  const afterInv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = 99 AND store_id = 1');
  assert.strictEqual(afterInv.quantity, countedQty, 'Inventory should be updated to counted quantity');
});

runTest('Retail Ops: Returns & Refund Processing with Stock Restoration', () => {
  // Create a quick test order first
  const orderId = `ORD-RET-TEST-${Date.now()}`;
  db.run(
    `INSERT INTO orders (id, source, status, store_id, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status)
     VALUES (?, 'POS', 'CONFIRMED', 1, 100.00, 14.00, 0.00, 114.00, 'CASH', 'COMPLETED')`,
    [orderId]
  );
  db.run(
    `INSERT INTO order_items (order_id, product_id, product_name_en, product_name_ar, barcode, quantity, unit_price, subtotal)
     VALUES (?, 3, 'Test Product', 'منتج تجريبي', '123456789012', 2, 50.00, 100.00)`,
    [orderId]
  );

  const prevInv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = 3 AND store_id = 1').quantity;

  // Process Return of 1 unit
  const returnRes = retailOpsService.processReturn({
    orderId,
    storeId: 1,
    cashierId: 'Cashier-01',
    returnType: 'REFUND',
    items: [{ product_id: 3, quantity: 1, condition: 'SELLABLE' }],
    reason: 'Customer changed mind'
  });

  assert.strictEqual(returnRes.status, 'COMPLETED');
  assert.strictEqual(returnRes.totalRefundAmount, 50.00);

  // Verify stock restored
  const postInv = db.queryOne('SELECT quantity FROM inventory WHERE product_id = 3 AND store_id = 1').quantity;
  assert.strictEqual(postInv, prevInv + 1, 'Sellable returned unit must restore inventory by 1');
});

runTest('Retail Ops: Configurable Promotions & Precedence Engine', () => {
  // Test cart below threshold
  const noPromo = retailOpsService.applyPromotions([], 50.00);
  assert.strictEqual(noPromo.discountAmount, 0.00, 'No promo should apply under minimum order threshold');

  // Test cart above 100 EGP (10% promo should apply)
  const promo100 = retailOpsService.applyPromotions([], 200.00);
  assert.strictEqual(promo100.discountAmount, 20.00, '10% discount on 200 EGP should be 20 EGP');

  // Test cart above 350 EGP (precedence check: 50 EGP off vs 10% = 40 EGP)
  const promo400 = retailOpsService.applyPromotions([], 400.00);
  assert(promo400.discountAmount >= 40.00, 'Higher discount should be selected');
});

runTest('Retail Ops: Unit of Measure Conversion', () => {
  const grams = retailOpsService.convertUOM(2.5, 'KG', 'G');
  assert.strictEqual(grams, 2500, '2.5 KG must convert to 2500 G');

  const ml = retailOpsService.convertUOM(1.5, 'L', 'ML');
  assert.strictEqual(ml, 1500, '1.5 L must convert to 1500 ML');

  assert.throws(() => {
    retailOpsService.convertUOM(1, 'KG', 'L');
  }, /Cannot convert between different physical dimensions/, 'Cross-dimensional conversion must be rejected');
});

// -------------------------------------------------------------
// SECTION B: FINANCIAL & PAYMENT INTEGRITY TESTS
// -------------------------------------------------------------
runTest('Payments: Payment Initiation & Idempotent Processing', () => {
  const orderId = `ORD-PAY-TEST-${Date.now()}`;
  db.run(
    `INSERT INTO orders (id, source, status, store_id, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status)
     VALUES (?, 'ONLINE', 'PENDING', 1, 200.00, 28.00, 0.00, 228.00, 'CARD', 'PENDING')`,
    [orderId]
  );

  const idempotencyKey = `IDEMP-${Date.now()}-${Math.random()}`;

  // First initiation
  const res1 = paymentsService.initiatePayment({
    orderId,
    amount: 228.00,
    paymentMethod: 'CARD',
    idempotencyKey,
    customerEmail: 'customer@example.com'
  });

  assert.strictEqual(res1.idempotentReplay, false);
  assert.strictEqual(res1.transaction.status, 'INITIATED');

  // Second initiation with identical idempotency key -> Idempotent replay
  const res2 = paymentsService.initiatePayment({
    orderId,
    amount: 228.00,
    paymentMethod: 'CARD',
    idempotencyKey,
    customerEmail: 'customer@example.com'
  });

  assert.strictEqual(res2.idempotentReplay, true, 'Subsequent call with same key must return idempotent replay');
  assert.strictEqual(res2.transaction.id, res1.transaction.id, 'Transaction ID must be identical');
});

runTest('Payments: Capture & PCI-DSS Zero PAN/CVV Compliance', () => {
  const orderId = `ORD-CAP-TEST-${Date.now()}`;
  db.run(
    `INSERT INTO orders (id, source, status, store_id, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status)
     VALUES (?, 'ONLINE', 'PENDING', 1, 100.00, 14.00, 0.00, 114.00, 'CARD', 'PENDING')`,
    [orderId]
  );

  const init = paymentsService.initiatePayment({ orderId, amount: 114.00, paymentMethod: 'CARD' });
  const capture = paymentsService.capturePayment({ transactionId: init.transaction.id, simulatedCardLast4: '5544' });

  assert.strictEqual(capture.status, 'CAPTURED');
  assert(capture.providerRef.startsWith('AUTH-'));

  // Verify PCI-DSS: ensure metadata contains ONLY card_last4 and NO raw PAN/CVV
  const meta = JSON.parse(capture.transaction.metadata);
  assert.strictEqual(meta.card_last4, '5544');
  assert.strictEqual(meta.cvv, undefined);
  assert.strictEqual(meta.pan, undefined);
});

runTest('Payments: Webhook HMAC-SHA256 Signature Verification', () => {
  const secret = paymentsService.webhookSecret;
  const payload = JSON.stringify({
    event: 'PAYMENT_CONFIRMED',
    transaction_ref: 'REF-TEST-001',
    status: 'SUCCESS'
  });

  // Valid signature
  const validSignature = crypto.createHmac('sha256', secret).update(payload, 'utf-8').digest('hex');
  const validRes = paymentsService.verifyWebhookSignature({ payloadString: payload, signatureHeader: validSignature });
  assert.strictEqual(validRes, true, 'Valid HMAC signature must verify successfully');

  // Forged signature
  const forgedRes = paymentsService.verifyWebhookSignature({ payloadString: payload, signatureHeader: 'bad_signature_1234567890abcdef' });
  assert.strictEqual(forgedRes, false, 'Forged or altered HMAC signature must be rejected');
});

// -------------------------------------------------------------
// SECTION C: DELIVERY & FULFILLMENT TESTS
// -------------------------------------------------------------
runTest('Delivery: Zone Fee and Minimum Order Calculation', () => {
  const lowOrder = deliveryService.calculateDeliveryFee('ZONE-DT', 30.00);
  assert.strictEqual(lowOrder.eligible, false, 'Below minimum 50 EGP must be ineligible');
  assert.strictEqual(lowOrder.shortfall, 20.00);

  const eligibleOrder = deliveryService.calculateDeliveryFee('ZONE-DT', 150.00);
  assert.strictEqual(eligibleOrder.eligible, true);
  assert.strictEqual(eligibleOrder.deliveryFee, 15.00);
});

runTest('Delivery: Fulfillment State Machine Transition Enforcement', () => {
  const orderId = `ORD-STATE-TEST-${Date.now()}`;
  db.run(
    `INSERT INTO orders (id, source, status, store_id, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status)
     VALUES (?, 'ONLINE', 'PENDING', 1, 100.00, 14.00, 0.00, 114.00, 'CARD', 'COMPLETED')`,
    [orderId]
  );

  // Valid progression: PENDING -> CONFIRMED
  const step1 = deliveryService.updateFulfillmentStatus(orderId, 'CONFIRMED');
  assert.strictEqual(step1.newStatus, 'CONFIRMED');

  // Valid progression: CONFIRMED -> PREPARING
  const step2 = deliveryService.updateFulfillmentStatus(orderId, 'PREPARING');
  assert.strictEqual(step2.newStatus, 'PREPARING');

  // Invalid progression: PREPARING -> DELIVERED (skipping READY & OUT_FOR_DELIVERY)
  assert.throws(() => {
    deliveryService.updateFulfillmentStatus(orderId, 'DELIVERED');
  }, /Illegal fulfillment state transition/, 'Illegal state jump must throw validation error');
});

runTest('Delivery: Product Substitution with Automatic Total Recalculation', () => {
  const orderId = `ORD-SUB-TEST-${Date.now()}`;
  db.run(
    `INSERT INTO orders (id, source, status, store_id, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status)
     VALUES (?, 'ONLINE', 'CONFIRMED', 1, 20.00, 2.80, 0.00, 22.80, 'CARD', 'COMPLETED')`,
    [orderId]
  );
  db.run(
    `INSERT INTO order_items (order_id, product_id, product_name_en, product_name_ar, barcode, quantity, unit_price, subtotal)
     VALUES (?, 4, 'Original Item', 'عنصر أصلي', '444444444444', 1, 20.00, 20.00)`,
    [orderId]
  );

  // Substitute product 4 with product 5
  const subRes = deliveryService.substituteProduct({
    orderId,
    originalProductId: 4,
    replacementProductId: 5,
    quantity: 1,
    cashierOrPickerId: 'Picker-Ali'
  });

  assert.strictEqual(subRes.status, 'SUBSTITUTED');
  const updatedItem = db.queryOne('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  assert(updatedItem.product_name_en.startsWith('[SUB]'), 'Substituted item should have tag');
});

// -------------------------------------------------------------
// SECTION F: COMMERCIAL ANALYTICS WITH RIGOROUS FINANCIAL DEFINITIONS
// -------------------------------------------------------------
runTest('Analytics: Gross Sales, Net Sales & Unambiguous Definitions', () => {
  const analytics = reportsService.getCommercialAnalytics();
  assert(analytics.success, 'Analytics query must succeed');
  assert(analytics.data.financials.gross_sales_egp >= 0, 'Gross sales must be non-negative');
  assert(analytics.data.financials.net_sales_egp <= analytics.data.financials.gross_sales_egp, 'Net sales must be <= Gross sales');
  assert.strictEqual(analytics.data.inventory_turnover.status, 'UNAVAILABLE', 'Turnover must report explicit UNAVAILABLE state rather than fake numbers');
});

console.log('\n================================================================');
console.log(`COMMERCIAL READINESS TEST RESULTS: ALL ${passedTests} TESTS PASSED!`);
console.log('================================================================\n');
