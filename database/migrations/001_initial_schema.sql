-- =============================================================================
-- CYBORG SUPERMARKET - ENTERPRISE RELATIONAL SCHEMA (PostgreSQL 16 & SQLite)
-- Primary Source of Truth matching cyborg_system_architecture.pdf ERD
-- =============================================================================

-- 1. USERS & IDENTITY
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'STORE_ADMIN', 'STORE_MANAGER', 'CASHIER', 'INVENTORY_OPERATOR', 'CUSTOMER', 'AUDITOR')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. TAXONOMY (CATEGORIES & SUBCATEGORIES)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    parent_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- 3. PRODUCT CATALOG
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    barcode TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    subcategory_id INTEGER,
    brand TEXT,
    country TEXT NOT NULL DEFAULT 'Egypt',
    size TEXT,
    format TEXT NOT NULL DEFAULT 'pieces',
    price NUMERIC(10, 2) NOT NULL,
    image_url TEXT,
    gallery_urls TEXT,
    embedding TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (subcategory_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- 4. INVENTORY & CONCURRENCY CONTROL
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL UNIQUE,
    store_id INTEGER NOT NULL DEFAULT 1,
    quantity INTEGER NOT NULL DEFAULT 100,
    reserved_qty INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_store ON inventory(product_id, store_id);

-- 5. CASHIER SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    cashier_id TEXT NOT NULL,
    cashier_name TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    store_id INTEGER NOT NULL DEFAULT 1,
    opening_balance NUMERIC(10, 2) NOT NULL,
    closing_balance NUMERIC(10, 2),
    actual_counted_balance NUMERIC(10, 2),
    discrepancy NUMERIC(10, 2) DEFAULT 0.00,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    total_cash_sales NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_card_sales NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_refunds NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    is_closed INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (cashier_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_terminal ON shifts(terminal_id);

-- 6. ORDERS & FULFILLMENT
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    customer_name TEXT,
    source TEXT NOT NULL CHECK(source IN ('POS', 'ONLINE', 'FAMILY_CART')),
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
    shift_id TEXT,
    store_id INTEGER NOT NULL DEFAULT 1,
    terminal_id TEXT,
    subtotal NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'CARD', 'MOBILE_WALLET', 'SIMULATED_MADA', 'SIMULATED_FAWRY')),
    payment_status TEXT NOT NULL DEFAULT 'COMPLETED',
    delivery_address TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);

-- 7. ORDER LINE ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name_en TEXT NOT NULL,
    product_name_ar TEXT NOT NULL,
    barcode TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 8. CARTS & SHARED FAMILY CARTS
CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    is_family_cart INTEGER NOT NULL DEFAULT 0,
    budget_limit NUMERIC(10, 2),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('OWNER', 'MEMBER')),
    spend_limit NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    current_spend NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. CLOUD-LOCAL SYNCHRONIZATION EVENT STORE
CREATE TABLE IF NOT EXISTS sync_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uuid TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('INSERT', 'UPDATE', 'DELETE')),
    delta_payload TEXT NOT NULL,
    origin_terminal_id TEXT,
    synced INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_events_synced ON sync_events(synced);

-- 10. SECURITY AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    actor_id TEXT,
    actor_role TEXT,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

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
