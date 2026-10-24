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
