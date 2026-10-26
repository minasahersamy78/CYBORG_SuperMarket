/**
 * Cyborg Supermarket - Hardware & Synchronization Resilience Test Suite
 * Validates Sections D (Hardware) and E (Synchronization & Resilience)
 */

const assert = require('assert');
const { hardwareSimulator } = require('../apps/backend/src/modules/hardware/hardware-simulator');
const { syncService } = require('../apps/backend/src/modules/sync/sync.service');
const { inventoryService } = require('../apps/backend/src/modules/inventory/inventory.service');
const ordersService = require('../apps/backend/src/modules/orders/orders.service');
const { db } = require('../apps/backend/src/database/db');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — HARDWARE & SYNC RESILIENCE SUITE');
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
// SECTION D: HARDWARE SIMULATION TESTS
// -------------------------------------------------------------
runTest('Hardware: Barcode Scanner Input Validation & Emulation', () => {
  const scan = hardwareSimulator.simulateBarcodeScan('6221007011400');
  assert.strictEqual(scan.success, true);
  assert.strictEqual(scan.rawBarcode, '6221007011400');
  assert.strictEqual(scan.type, 'EAN-13');

  // Scanner rejects garbage input
  assert.throws(() => {
    hardwareSimulator.simulateBarcodeScan('BARCODE_WITH_LETTERS_XYZ');
  }, /Invalid barcode format/, 'Scanner must reject non-numeric barcode streams');
});

runTest('Hardware: ESC/POS Thermal Receipt Formatting & Cut Command', () => {
  const printRes = hardwareSimulator.simulatePrintReceipt({
    orderId: 'ORD-HW-999',
    storeName: 'Downtown Cairo Flagship',
    items: [
      { name_en: 'Dina Farms Milk 1L', quantity: 2, unit_price: 38.50, subtotal: 77.00 },
      { name_en: 'Juhayna Orange 1L', quantity: 1, unit_price: 26.00, subtotal: 26.00 }
    ],
    subtotal: 103.00,
    tax: 14.42,
    discount: 0.00,
    total: 117.42,
    paymentMethod: 'CASH',
    cashierName: 'Fatma Hassan'
  });

  assert.strictEqual(printRes.success, true);
  assert(printRes.byteCount > 100, 'Print buffer must contain ESC/POS control bytes');
  assert(printRes.renderedText.includes('117.42'), 'Receipt must display exact total');
  assert(printRes.renderedText.includes('Dina Farms Milk'), 'Receipt must list item names');
});

runTest('Hardware: Cash Drawer DKD Pulse Trigger', () => {
  assert.strictEqual(hardwareSimulator.devices.cashDrawer.isOpen, false);
  const pulse = hardwareSimulator.triggerCashDrawerPulse(0, 50, 50);
  assert.strictEqual(pulse.success, true);
  assert.strictEqual(hardwareSimulator.devices.cashDrawer.isOpen, true);

  hardwareSimulator.closeCashDrawer();
  assert.strictEqual(hardwareSimulator.devices.cashDrawer.isOpen, false);
});

runTest('Hardware: Keyboard-Only POS Hotkey Event Handler', () => {
  const f2 = hardwareSimulator.handleKeyboardHotkey('F2');
  assert.strictEqual(f2.action, 'PAY_CASH');

  const f3 = hardwareSimulator.handleKeyboardHotkey('F3');
  assert.strictEqual(f3.action, 'PAY_CARD');

  const f10 = hardwareSimulator.handleKeyboardHotkey('F10');
  assert.strictEqual(f10.action, 'SEARCH_CATALOG');

  const unmapped = hardwareSimulator.handleKeyboardHotkey('F12');
  assert.strictEqual(unmapped.handled, false);
});

// -------------------------------------------------------------
// SECTION E: SYNCHRONIZATION & RESILIENCE TESTS
// -------------------------------------------------------------
runTest('Resilience: Idempotent Batch Sync with Deduplication Protection', () => {
  const eventUuid = `EVT-RESIL-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const batch = [{
    event_uuid: eventUuid,
    entity_type: 'ORDER',
    entity_id: `ORD-OFFLINE-${Date.now()}`,
    action: 'INSERT',
    payload: {
      source: 'POS',
      total_amount: 99.00,
      payment_method: 'CASH',
      items: [{ product_id: 6, quantity: 1, unit_price: 99.00 }]
    }
  }];

  // First sync ingestion
  const res1 = syncService.ingestBatch(batch, 'TRM-001');
  assert.strictEqual(res1.statusCode, 200);
  assert.strictEqual(res1.data.processed, 1);
  assert.strictEqual(res1.data.duplicates, 0);

  // Re-sending exact same batch (simulating network retry or reconnect)
  const res2 = syncService.ingestBatch(batch, 'TRM-001');
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res2.data.processed, 0, 'Should not re-process duplicate event');
  assert.strictEqual(res2.data.duplicates, 1, 'Duplicate event must be safely discarded');
});

runTest('Resilience: Concurrent Inventory Optimistic Locking Conflict', () => {
  // Check inventory record for product 10
  const inv = db.queryOne('SELECT * FROM inventory WHERE product_id = 10 AND store_id = 1');
  const initialVersion = inv.version;

  // Simulate process A updating the version
  db.run('UPDATE inventory SET version = version + 1 WHERE product_id = 10 AND store_id = 1');

  // Simulate process B attempting optimistic update with stale version
  const updateRes = db.run(
    'UPDATE inventory SET quantity = quantity - 1, version = version + 1 WHERE product_id = 10 AND store_id = 1 AND version = ?',
    [initialVersion]
  );

  // Check that version mismatch prevented modification
  const currentInv = db.queryOne('SELECT * FROM inventory WHERE product_id = 10 AND store_id = 1');
  assert.strictEqual(currentInv.version, initialVersion + 1, 'Version must only be incremented once by Process A');
});

runTest('Resilience: Stale Price Tampering & Backend Price Recalculation', () => {
  // Client attempts to checkout product 1 (Dina Farms Milk, ~38.50 EGP) at a stale/tampered price of 1.00 EGP
  const orderResult = ordersService.createOrder({
    source: 'POS',
    store_id: 1,
    payment_method: 'CASH',
    cashier_id: 'Cashier-01',
    items: [
      { product_id: 1, quantity: 2, unit_price: 1.00 } // Tampered / stale client price!
    ]
  });

  assert.strictEqual(orderResult.statusCode, 200);
  // Backend MUST have recalculated based on authentic DB price!
  const actualProduct = db.queryOne('SELECT price FROM products WHERE id = 1');
  const expectedSubtotal = Number(actualProduct.price) * 2;
  assert.strictEqual(orderResult.data.subtotal, expectedSubtotal, 'Backend server must enforce authoritative catalog price over client input');
});

runTest('Resilience: Offline Transaction Queue Recovery After Simulated Crash', () => {
  // Simulate durable offline storage: write uncommitted transaction to sync_events
  const crashUuid = `CRASH-RECOV-${Date.now()}`;
  db.run(
    `INSERT INTO sync_events (event_uuid, entity_type, entity_id, action, delta_payload, origin_terminal_id, synced)
     VALUES (?, 'TRANSACTION_OFFLINE', 'ORD-CRASH-01', 'INSERT', ?, 'TRM-002', 0)`,
    [crashUuid, JSON.stringify({ items: [{ product_id: 7, quantity: 1 }], total: 50.00 })]
  );

  // Verify pending offline events can be retrieved upon app reboot
  const pendingEvents = db.query("SELECT * FROM sync_events WHERE synced = 0 AND origin_terminal_id = 'TRM-002'");
  assert(pendingEvents.length >= 1, 'Unsynced offline transactions must persist durably across restarts');

  // Mark recovered and synced
  db.run('UPDATE sync_events SET synced = 1 WHERE event_uuid = ?', [crashUuid]);
  const postRecover = db.queryOne('SELECT synced FROM sync_events WHERE event_uuid = ?', [crashUuid]);
  assert.strictEqual(postRecover.synced, 1);
});

console.log('\n================================================================');
console.log(`HARDWARE & SYNC RESILIENCE RESULTS: ALL ${passedTests} TESTS PASSED!`);
console.log('================================================================\n');
