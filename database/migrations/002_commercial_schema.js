/**
 * Cyborg Supermarket - Commercial Schema Extension Migration
 * Appends retail operations, payments, delivery, and audit tables
 */

const { spawnSync } = require('child_process');
const path = require('path');

const SQLITE_BIN = 'C:\\Program Files\\platform-tools\\sqlite3.exe';
const DB_PATH = path.resolve(__dirname, '../data/cyborg_supermarket.db');

const MIGRATION_SQL = `
-- 11. MULTI-STORE MANAGEMENT
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Cairo',
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 12. MULTI-TERMINAL MANAGEMENT
CREATE TABLE IF NOT EXISTS terminals (
    id TEXT PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    ip_address TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    tax_id TEXT,
    payment_terms TEXT DEFAULT 'Net 30',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 14. PURCHASE ORDERS & GOODS RECEIVING
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    po_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    store_id INTEGER NOT NULL REFERENCES stores(id),
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')) DEFAULT 'DRAFT',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    expected_date TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    ordered_qty INTEGER NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    received_qty INTEGER NOT NULL DEFAULT 0,
    subtotal NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS goods_receiving (
    id TEXT PRIMARY KEY,
    grn_number TEXT NOT NULL UNIQUE,
    po_id TEXT REFERENCES purchase_orders(id),
    store_id INTEGER NOT NULL REFERENCES stores(id),
    supplier_invoice_no TEXT,
    received_by TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS goods_receiving_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_id TEXT NOT NULL REFERENCES goods_receiving(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    received_qty INTEGER NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL,
    batch_number TEXT,
    expiry_date TEXT
);

-- 15. STOCK MOVEMENT AUDIT TRAIL
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id),
    movement_type TEXT NOT NULL CHECK(movement_type IN ('OPENING_BALANCE', 'RECEIVING', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SPOILAGE')),
    quantity INTEGER NOT NULL,
    previous_qty INTEGER NOT NULL,
    new_qty INTEGER NOT NULL,
    unit_cost NUMERIC(10, 2),
    reference_type TEXT,
    reference_id TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);

-- 16. BATCH & EXPIRY TRACKING
CREATE TABLE IF NOT EXISTS product_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id),
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    initial_quantity INTEGER NOT NULL,
    current_quantity INTEGER NOT NULL,
    unit_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);

-- 17. UNITS OF MEASURE
CREATE TABLE IF NOT EXISTS units_of_measure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    base_unit TEXT,
    conversion_factor NUMERIC(10, 4) NOT NULL DEFAULT 1.0000
);

-- 18. PHYSICAL STOCK COUNTS & RECONCILIATION
CREATE TABLE IF NOT EXISTS stock_counts (
    id TEXT PRIMARY KEY,
    count_number TEXT NOT NULL UNIQUE,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    status TEXT NOT NULL CHECK(status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'RECONCILED')) DEFAULT 'DRAFT',
    counted_by TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reconciled_at TEXT
);

CREATE TABLE IF NOT EXISTS stock_count_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_count_id TEXT NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    system_qty INTEGER NOT NULL,
    counted_qty INTEGER NOT NULL,
    discrepancy_qty INTEGER NOT NULL,
    discrepancy_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    reconciled INTEGER NOT NULL DEFAULT 0
);

-- 19. RETURNS, EXCHANGES & REFUNDS
CREATE TABLE IF NOT EXISTS returns (
    id TEXT PRIMARY KEY,
    return_number TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL REFERENCES orders(id),
    store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id),
    cashier_id TEXT NOT NULL,
    return_type TEXT NOT NULL CHECK(return_type IN ('REFUND', 'EXCHANGE')),
    total_amount NUMERIC(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('COMPLETED', 'PENDING_APPROVAL', 'REJECTED')) DEFAULT 'COMPLETED',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id INTEGER,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    refund_amount NUMERIC(10, 2) NOT NULL,
    condition TEXT NOT NULL CHECK(condition IN ('SELLABLE', 'DAMAGED', 'EXPIRED')) DEFAULT 'SELLABLE'
);

-- 20. PROMOTIONS & DISCOUNT PRECEDENCE
CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    promo_type TEXT NOT NULL CHECK(promo_type IN ('PERCENTAGE', 'FIXED_DISCOUNT', 'BUY_X_GET_Y', 'CATEGORY_DISCOUNT')),
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    target_category_id INTEGER,
    precedence INTEGER NOT NULL DEFAULT 10,
    is_active INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 21. DELIVERY ZONES & FULFILLMENT RULES
CREATE TABLE IF NOT EXISTS delivery_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
    estimated_minutes INTEGER NOT NULL DEFAULT 45,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- 22. FINANCIAL & PAYMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    transaction_ref TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL REFERENCES orders(id),
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'EGP',
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('INITIATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED')),
    provider TEXT NOT NULL DEFAULT 'INTERNAL_GATEWAY',
    provider_ref TEXT,
    failure_reason TEXT,
    idempotency_key TEXT UNIQUE,
    is_sandbox INTEGER NOT NULL DEFAULT 1,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_ref ON payment_transactions(transaction_ref);

CREATE TABLE IF NOT EXISTS payment_webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    signature_verified INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PROCESSED',
    raw_payload TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SEED FOUNDATIONAL METADATA
INSERT OR IGNORE INTO stores (id, code, name_en, name_ar, address, city, phone) VALUES 
(1, 'STR-001', 'Downtown Cairo Flagship', 'الفرع الرئيسي - وسط البلد', '15 Tahrir Square, Cairo', 'Cairo', '+20 2 25789000'),
(2, 'STR-002', 'New Cairo Mega Store', 'فرع القاهرة الجديدة', 'Road 90, 5th Settlement, New Cairo', 'Cairo', '+20 2 28135000');

INSERT OR IGNORE INTO terminals (id, store_id, code, name, ip_address) VALUES 
('TRM-001', 1, 'POS-01', 'Checkout Terminal 1', '192.168.1.101'),
('TRM-002', 1, 'POS-02', 'Express Checkout 2', '192.168.1.102'),
('TRM-003', 2, 'POS-03', 'New Cairo Terminal 1', '192.168.2.101');

INSERT OR IGNORE INTO units_of_measure (code, name_en, name_ar, base_unit, conversion_factor) VALUES
('PCS', 'Piece', 'قطعة', 'PCS', 1.0),
('KG', 'Kilogram', 'كيلوجرام', 'G', 1000.0),
('G', 'Gram', 'جرام', 'G', 1.0),
('L', 'Liter', 'لتر', 'ML', 1000.0),
('ML', 'Milliliter', 'مليلتر', 'ML', 1.0),
('PACK', 'Pack / Box', 'علبة / كرتونة', 'PCS', 1.0);

INSERT OR IGNORE INTO delivery_zones (code, name_en, name_ar, delivery_fee, min_order_amount, estimated_minutes) VALUES
('ZONE-DT', 'Downtown & Zamalek', 'وسط البلد والزمالك', 15.00, 50.00, 30),
('ZONE-NC', 'New Cairo & Tagamoa', 'القاهرة الجديدة والتجمع', 25.00, 100.00, 45),
('ZONE-MD', 'Maadi & Helwan', 'المعادي وحلوان', 20.00, 75.00, 40),
('ZONE-GZ', 'Giza & Dokki', 'الجيزة والدقي', 18.00, 60.00, 35);

INSERT OR IGNORE INTO suppliers (code, name, contact_person, phone, email, tax_id, payment_terms) VALUES
('SUP-001', 'Dina Farms Agricultural Investments', 'Ahmed Mansour', '+20 100 123 4567', 'orders@dinafarms.eg', '100-245-890', 'Net 15'),
('SUP-002', 'Juhayna Food Industries', 'Sara El-Sayed', '+20 102 987 6543', 'b2b@juhayna.com', '100-345-991', 'Net 30'),
('SUP-003', 'Almarai Egypt Distribution', 'Karim Nabil', '+20 111 555 4321', 'sales@almarai.com.eg', '100-456-112', 'Net 30');

INSERT OR IGNORE INTO promotions (id, code, name_en, name_ar, promo_type, discount_value, min_order_amount, precedence, is_active, start_date, end_date) VALUES
('PROMO-WELCOME', 'CYBORG10', '10% Welcome Discount', 'خصم ترحيبي 10%', 'PERCENTAGE', 10.00, 100.00, 10, 1, '2026-01-01', '2026-12-31'),
('PROMO-RAMADAN', 'RAMADAN50', '50 EGP Off Big Carts', 'خصم 50 جنيه على السلات الكبيرة', 'FIXED_DISCOUNT', 50.00, 350.00, 20, 1, '2026-01-01', '2026-12-31');
`;

console.log('Migrating database schema for Commercial Readiness...');
const res = spawnSync(SQLITE_BIN, [DB_PATH], {
  input: MIGRATION_SQL,
  encoding: 'utf-8',
  maxBuffer: 16 * 1024 * 1024
});

if (res.error) {
  console.error('Migration failed with error:', res.error);
  process.exit(1);
}
if (res.status !== 0) {
  console.error('Migration failed:', res.stderr);
  process.exit(1);
}

console.log('Commercial Schema Extension successfully applied to database!');
