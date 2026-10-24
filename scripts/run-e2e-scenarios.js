/**
 * Cyborg Supermarket - End-to-End Scenario Verification Runner
 * Verifies Scenarios A through F from Prompt Section 19
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const authService = require('../apps/backend/src/modules/auth/auth.service');
const productsService = require('../apps/backend/src/modules/products/products.service');
const inventoryService = require('../apps/backend/src/modules/inventory/inventory.service');
const ordersService = require('../apps/backend/src/modules/orders/orders.service');
const cartService = require('../apps/backend/src/modules/cart/cart.service');
const shiftsService = require('../apps/backend/src/modules/shifts/shifts.service');
const syncService = require('../apps/backend/src/modules/sync/sync.service');
const db = require('../apps/backend/src/database/db');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — E2E SCENARIOS VERIFICATION (A through F)');
console.log('================================================================');

let passed = 0;
let failed = 0;

function runScenario(title, fn) {
  try {
    console.log(`\n--- Running ${title} ---`);
    fn();
    console.log(`[PASS] ${title}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${title}: ${err.message}`);
    failed++;
  }
}

// Scenario A: Product Import
runScenario('Scenario A: Product Import Verification', () => {
  // 1. Verify Excel file exists
  assert.ok(fs.existsSync(path.resolve(__dirname, '../data/source/super_market.xlsx')), 'super_market.xlsx exists');
  // 2. Verify imported row count in database
  const countRow = db.getOne('SELECT count(*) as total FROM products;');
  assert.strictEqual(parseInt(countRow.total, 10), 1000, 'All 1,000 real products are present in database');
  // 3. Search for known product #1 (Dina Farms Cottage Cheese)
  const p1 = productsService.getById(1).data;
  assert.strictEqual(p1.barcode, '6224011439398');
  assert.strictEqual(p1.name_en, 'Dina Farms Cottage Cheese - 450 gm');
  assert.strictEqual(p1.name_ar, 'جبنة قريش مزارع دينا - 450 جرام');
  assert.strictEqual(parseFloat(p1.price), 69.00);
});

// Scenario B: Online Shopping & Checkout
runScenario('Scenario B: Online Shopping Lifecycle', () => {
  const customerUser = authService.login('customer@cyborg.eg', 'Admin@123').data.user;
  assert.ok(customerUser);

  // Browse products
  const list = productsService.list({ q: 'Juhayna', limit: 5 }).data;
  assert.ok(list.length > 0);
  const targetProduct = list[0];

  const initialStock = inventoryService.getBalance(targetProduct.id).data.quantity;

  // Create Order with simulated Fawry payment
  const orderRes = ordersService.createOrder({
    items: [{ product_id: targetProduct.id, quantity: 2 }],
    source: 'ONLINE',
    payment_method: 'SIMULATED_FAWRY',
    delivery_address: '15th of May City, Cairo',
    idempotency_key: 'e2e-order-' + Date.now()
  }, { sub: customerUser.id, role: customerUser.role });

  assert.strictEqual(orderRes.success, true);
  assert.strictEqual(orderRes.data.status, 'CONFIRMED');

  // Verify stock was reduced
  const afterStock = inventoryService.getBalance(targetProduct.id).data.quantity;
  assert.strictEqual(afterStock, initialStock - 2);
});

// Scenario C: POS Checkout
runScenario('Scenario C: POS Checkout & Receipt Generation', () => {
  const cashierUser = authService.login('cashier@cyborg.eg', 'Admin@123').data.user;
  assert.ok(cashierUser);

  // Scan barcode for Juhayna Strawberry Yogurt Drink (barcode: 6223000352625)
  const scanned = productsService.getByBarcode('6223000352625');
  assert.strictEqual(scanned.success, true);
  assert.strictEqual(scanned.data.name_en, 'Juhayna Zabado Strawberry Yoghurt Drink - 440 ml');

  // Cashier completes cash transaction
  const order = ordersService.createOrder({
    items: [{ product_id: scanned.data.id, quantity: 1 }],
    source: 'POS',
    payment_method: 'CASH',
    shift_id: 'shift-cairo-001',
    idempotency_key: 'pos-e2e-' + Date.now()
  }, { sub: cashierUser.id, role: cashierUser.role });

  assert.strictEqual(order.success, true);
  assert.strictEqual(order.data.status, 'DELIVERED');
  assert.strictEqual(order.data.source, 'POS');
});

// Scenario D: Offline POS & Reconnect Sync
runScenario('Scenario D: Offline POS & Idempotent Sync', () => {
  const offlineId = 'ord-offline-sim-' + Date.now();
  const eventUuid = 'sync-e2e-' + Date.now();

  // Simulate offline transaction queued on desktop POS
  const offlineOrderPayload = {
    id: offlineId,
    total_amount: 93.00,
    payment_method: 'CASH',
    items: [{ product_id: 10, quantity: 1, unit_price: 93.00 }]
  };

  // Connectivity restored -> Upload outbox batch
  const syncRes = syncService.ingestBatch('TERM-OFFLINE-TEST', [
    {
      event_uuid: eventUuid,
      entity_type: 'ORDER',
      entity_id: offlineId,
      delta_payload: offlineOrderPayload
    }
  ]);

  assert.strictEqual(syncRes.success, true);
  assert.strictEqual(syncRes.data.processed, 1);

  // Verify order persisted in database
  const saved = ordersService.getOrderById(offlineId);
  assert.strictEqual(saved.success, true);
  assert.strictEqual(saved.data.total_amount, 93.00);

  // Retry same batch to confirm idempotency
  const dupRes = syncService.ingestBatch('TERM-OFFLINE-TEST', [
    {
      event_uuid: eventUuid,
      entity_type: 'ORDER',
      entity_id: offlineId,
      delta_payload: offlineOrderPayload
    }
  ]);
  assert.strictEqual(dupRes.data.duplicates, 1);
  assert.strictEqual(dupRes.data.processed, 0);
});

// Scenario E: Authorization & Role Enforcement
runScenario('Scenario E: Authorization & Privilege Enforcement', () => {
  const customer = { sub: 'usr-cst-01', role: 'CUSTOMER' };
  const cashier = { sub: 'usr-csh-01', role: 'CASHIER' };

  // Customer cannot adjust inventory
  assert.strictEqual(authService.checkPermission(customer, ['INVENTORY_OPERATOR', 'STORE_MANAGER']), false);

  // Cashier cannot adjust inventory
  assert.strictEqual(authService.checkPermission(cashier, ['INVENTORY_OPERATOR', 'STORE_MANAGER']), false);

  // Cashier cannot access administrative audit logs
  assert.strictEqual(authService.checkPermission(cashier, ['STORE_MANAGER', 'SUPER_ADMIN', 'AUDITOR']), false);
});

// Scenario F: Data Integrity & Boundary Validation
runScenario('Scenario F: Data Integrity & Negative Stock Protection', () => {
  // Reject non-existent product in order
  const badOrder = ordersService.createOrder({
    items: [{ product_id: 999999, quantity: 1 }],
    source: 'ONLINE',
    payment_method: 'CASH'
  });
  assert.strictEqual(badOrder.success, false);
  assert.strictEqual(badOrder.statusCode, 404);

  // Reject zero/negative quantity
  const zeroQtyOrder = ordersService.createOrder({
    items: [{ product_id: 1, quantity: 0 }],
    source: 'ONLINE',
    payment_method: 'CASH'
  });
  assert.strictEqual(zeroQtyOrder.success, false);
  assert.strictEqual(zeroQtyOrder.statusCode, 400);

  // Reject inventory adjustment that would drop stock below zero
  const badAdjust = inventoryService.adjustStock(1, -999999);
  assert.strictEqual(badAdjust.success, false);
  assert.strictEqual(badAdjust.statusCode, 400);
});

console.log('\n================================================================');
console.log(`E2E SCENARIOS SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
console.log('================================================================');

if (failed > 0) process.exit(1);
console.log('ALL SCENARIOS VERIFIED SUCCESSFULLY!\n');
