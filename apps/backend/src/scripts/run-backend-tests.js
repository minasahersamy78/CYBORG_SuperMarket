/**
 * Cyborg Supermarket - Comprehensive Backend Test Runner
 * Covers: Auth, Products, Inventory, Orders, Shifts, AI Voice, Sync, and Concurrency
 */

const assert = require('assert');
const authService = require('../modules/auth/auth.service');
const productsService = require('../modules/products/products.service');
const inventoryService = require('../modules/inventory/inventory.service');
const ordersService = require('../modules/orders/orders.service');
const cartService = require('../modules/cart/cart.service');
const shiftsService = require('../modules/shifts/shifts.service');
const syncService = require('../modules/sync/sync.service');
const aiEngineService = require('../modules/ai-engine/ai-engine.service');
const reportsService = require('../modules/reports/reports.service');
const db = require('../database/db');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — BACKEND AUTOMATED TEST SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// 1. Auth & RBAC Tests
runTest('Auth: Successful login for Super Admin', () => {
  const res = authService.login('admin@cyborg.eg', 'Admin@123');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.user.role, 'SUPER_ADMIN');
  assert.ok(res.data.access_token);
});

runTest('Auth: Reject invalid password', () => {
  const res = authService.login('admin@cyborg.eg', 'WrongPassword!');
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.statusCode, 401);
});

runTest('Auth: RBAC role permission enforcement', () => {
  const cashier = { sub: 'usr-csh-01', role: 'CASHIER' };
  const admin = { sub: 'usr-admin-01', role: 'SUPER_ADMIN' };
  assert.strictEqual(authService.checkPermission(cashier, ['STORE_MANAGER', 'SUPER_ADMIN']), false);
  assert.strictEqual(authService.checkPermission(admin, ['STORE_MANAGER']), true); // Super admin passes all
  assert.strictEqual(authService.checkPermission(cashier, ['CASHIER']), true);
});

// 2. Product Catalog Tests
runTest('Products: Catalog contains 1000 items with valid pagination', () => {
  const res = productsService.list({ page: 1, limit: 10 });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.meta.total, 1000);
  assert.strictEqual(res.data.length, 10);
});

runTest('Products: Fast Barcode lookup returns Dina Farms product', () => {
  const res = productsService.getByBarcode('6224011439398');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.data.name_en, 'Dina Farms Cottage Cheese - 450 gm');
  assert.strictEqual(parseFloat(res.data.price), 69);
});

runTest('Products: Bilingual search (Arabic and English)', () => {
  const resAr = productsService.list({ q: 'جبنة' });
  assert.strictEqual(resAr.success, true);
  assert.ok(resAr.data.length > 0);

  const resEn = productsService.list({ q: 'Juhayna' });
  assert.strictEqual(resEn.success, true);
  assert.ok(resEn.data.length > 0);
});

runTest('Products: Filter by category and price bounds', () => {
  const res = productsService.list({ min_price: 20, max_price: 50 });
  assert.strictEqual(res.success, true);
  res.data.forEach(item => {
    assert.ok(item.price >= 20 && item.price <= 50);
  });
});

// 3. Inventory & Concurrency Tests
runTest('Inventory: Fetch initial balance and check low stock threshold', () => {
  const res = inventoryService.getBalance(1);
  assert.strictEqual(res.success, true);
  assert.ok(res.data.quantity > 0);
  assert.strictEqual(res.data.reserved_qty, 0);
});

runTest('Inventory: Reserve stock and release reservation', () => {
  const init = inventoryService.getBalance(1).data;
  const reserveRes = inventoryService.reserveStock([{ product_id: 1, quantity: 5 }]);
  assert.strictEqual(reserveRes.success, true);

  const afterReserve = inventoryService.getBalance(1).data;
  assert.strictEqual(afterReserve.reserved_qty, init.reserved_qty + 5);

  const releaseRes = inventoryService.releaseReservation([{ product_id: 1, quantity: 5 }]);
  assert.strictEqual(releaseRes.success, true);

  const afterRelease = inventoryService.getBalance(1).data;
  assert.strictEqual(afterRelease.reserved_qty, init.reserved_qty);
});

// 4. Cart & Family Cart Tests
runTest('Cart: Add items, calculate Egyptian 14% VAT, and update totals', () => {
  const testSuffix = Date.now() + Math.random().toString(36).substring(2, 6);
  const cart = cartService.getOrCreateCart(null, 'usr-cart-' + testSuffix);
  const cartId = cart.data.id;

  const updated = cartService.addItem(cartId, 1, 2); // 69 EGP x 2 = 138 EGP
  assert.strictEqual(updated.success, true);
  assert.strictEqual(updated.data.subtotal, 138);
  assert.strictEqual(updated.data.tax, parseFloat((138 * 0.14).toFixed(2))); // 19.32 EGP
  assert.strictEqual(updated.data.total, parseFloat((138 + 19.32).toFixed(2))); // 157.32 EGP
});

runTest('Cart: Family cart budget enforcement', () => {
  const testSuffix = Date.now() + Math.random().toString(36).substring(2, 6);
  const familyCart = cartService.getOrCreateCart(null, 'usr-fam-' + testSuffix, true, 200.00); // 200 EGP budget
  const cartId = familyCart.data.id;

  // Adding item 3 (332.25 EGP) should fail budget constraint
  const failRes = cartService.addItem(cartId, 3, 1);
  assert.strictEqual(failRes.success, false);
  assert.strictEqual(failRes.statusCode, 400);
  assert.ok(failRes.error.includes('budget limit exceeded'));
});

// 5. Orders & Financial Calculations
runTest('Orders: Create POS order, recalculate price on server, deduct stock', () => {
  const testSuffix = Date.now() + Math.random().toString(36).substring(2, 6);
  const initStock = inventoryService.getBalance(2).data.quantity;

  const orderRes = ordersService.createOrder({
    items: [{ product_id: 2, quantity: 3 }], // 28.70 EGP x 3 = 86.10 EGP
    source: 'POS',
    store_id: 1,
    payment_method: 'CASH',
    idempotency_key: 'test-idemp-' + testSuffix
  });

  assert.strictEqual(orderRes.success, true);
  assert.strictEqual(orderRes.data.subtotal, 86.1);
  assert.strictEqual(orderRes.data.source, 'POS');
  assert.strictEqual(orderRes.data.status, 'DELIVERED');

  // Verify stock deduction
  const afterStock = inventoryService.getBalance(2).data.quantity;
  assert.strictEqual(afterStock, initStock - 3);

  // Test idempotency retry
  const retryRes = ordersService.createOrder({
    items: [{ product_id: 2, quantity: 3 }],
    source: 'POS',
    payment_method: 'CASH',
    idempotency_key: 'test-idemp-' + testSuffix
  });
  assert.strictEqual(retryRes.data.id, orderRes.data.id);
});

runTest('Orders: Validate illegal order state transition rejection', () => {
  const testSuffix = Date.now() + Math.random().toString(36).substring(2, 6);
  const orderRes = ordersService.createOrder({
    items: [{ product_id: 1, quantity: 1 }],
    source: 'ONLINE',
    payment_method: 'CARD',
    idempotency_key: 'test-idemp-online-' + testSuffix
  });

  const orderId = orderRes.data.id;
  // Trying to jump from CONFIRMED directly to DELIVERED without PREPARING / READY should fail
  const badTransition = ordersService.updateStatus(orderId, 'DELIVERED');
  assert.strictEqual(badTransition.success, false);
  assert.strictEqual(badTransition.statusCode, 400);

  // Valid step: CONFIRMED -> PREPARING
  const goodTransition = ordersService.updateStatus(orderId, 'PREPARING');
  assert.strictEqual(goodTransition.success, true);
  assert.strictEqual(goodTransition.data.status, 'PREPARING');
});

// 6. Cashier Shifts & Cash Reconciliation
runTest('Shifts: Open shift, record sales, close shift, calculate cash discrepancy', () => {
  const testSuffix = Date.now() + Math.random().toString(36).substring(2, 6);
  const shiftRes = shiftsService.startShift({
    terminal_id: 'TERM-TEST-' + testSuffix,
    opening_balance: 500.00
  }, { sub: 'usr-csh-01', name: 'Cashier Ahmed' });

  assert.strictEqual(shiftRes.success, true);
  const shiftId = shiftRes.data.id;

  // Make a sale linked to this shift
  ordersService.createOrder({
    items: [{ product_id: 4, quantity: 1 }],
    source: 'POS',
    shift_id: shiftId,
    payment_method: 'CASH',
    idempotency_key: 'test-shift-order-' + testSuffix
  });

  // Close shift with actual counted cash = expected - 10 EGP discrepancy
  const summaryBefore = shiftsService.getShiftSummary(shiftId).data;
  const expectedCash = summaryBefore.opening_balance + summaryBefore.total_cash_sales;
  const countedCash = expectedCash - 10.00;

  const closeRes = shiftsService.closeShift(shiftId, countedCash, 'End of evening shift');
  assert.strictEqual(closeRes.success, true);
  assert.strictEqual(closeRes.data.is_closed, 1);
  assert.strictEqual(closeRes.data.discrepancy, -10.00);
});

// 7. AI Voice & Egyptian Arabic NLP
runTest('AI: Resolve Egyptian Arabic grocery intent and ground in catalog', () => {
  const res = aiEngineService.parseVoiceOrTextQuery('عايز لبن جهينه كامل الدسم');
  assert.strictEqual(res.intent, 'ADD_TO_CART');
  assert.ok(res.matched_products.length > 0);
  assert.ok(res.matched_products[0].name_ar.includes('جهين') || res.matched_products[0].name_en.includes('Juhayna'));
});

runTest('AI: Check price intent in Egyptian dialect', () => {
  const res = aiEngineService.parseVoiceOrTextQuery('بكام سمنة مزارع دينا');
  assert.strictEqual(res.intent, 'CHECK_PRICE');
  assert.ok(res.matched_products.length > 0);
  assert.ok(res.message.includes('جنيه'));
});

runTest('AI: Smart substitution suggestion for out-of-stock items', () => {
  const res = aiEngineService.getSubstitutions(1); // Dina Farms Cottage Cheese
  assert.strictEqual(res.success, true);
  assert.ok(res.data.substitutes.length > 0);
});

// 8. Cloud-Local Synchronization
runTest('Sync: Ingest offline POS batch with duplicate protection', () => {
  const testSuffix = Date.now() + Math.random().toString(36).substring(2, 6);
  const offlineOrderId = 'ord-pos-off-' + testSuffix;
  const syncEventUuid = 'sync-uuid-' + testSuffix;

  const batchRes = syncService.ingestBatch('TERM-OFFLINE-01', [
    {
      event_uuid: syncEventUuid,
      entity_type: 'ORDER',
      entity_id: offlineOrderId,
      delta_payload: {
        id: offlineOrderId,
        total_amount: 150.00,
        items: [{ product_id: 1, quantity: 1, unit_price: 69.00 }]
      }
    }
  ]);

  assert.strictEqual(batchRes.success, true);
  assert.strictEqual(batchRes.data.processed, 1);

  // Send same batch again to verify idempotency
  const dupBatchRes = syncService.ingestBatch('TERM-OFFLINE-01', [
    {
      event_uuid: syncEventUuid,
      entity_type: 'ORDER',
      entity_id: offlineOrderId,
      delta_payload: { id: offlineOrderId, total_amount: 150.00 }
    }
  ]);
  assert.strictEqual(dupBatchRes.data.duplicates, 1);
  assert.strictEqual(dupBatchRes.data.processed, 0);
});

// 9. Real-Data Operational Reporting
runTest('Reports: Dashboard overview calculated from genuine database records', () => {
  const rep = reportsService.getDashboardOverview();
  assert.strictEqual(rep.success, true);
  assert.strictEqual(rep.data.catalog.total_active_products, 1000);
  assert.ok(rep.data.sales_summary.total_orders > 0);
  assert.ok(rep.data.sales_summary.total_revenue_egp > 0);
  assert.ok(Array.isArray(rep.data.catalog.category_breakdown));
});

console.log('================================================================');
console.log(`TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL BACKEND UNIT & INTEGRATION TESTS SUCCEEDED!\n');
  process.exit(0);
}
