/**
 * Cyborg Supermarket - Phase 3 Schema Migration
 * Adds Loyalty, Customer Support, Pricing Engine, and Delivery Slots tables
 */

const { spawnSync } = require('child_process');
const path = require('path');
const db = require('../apps/backend/src/database/db');

const SQLITE_BIN = db.getSqliteBin();
const DB_PATH = db.getDbPath();

const MIGRATION_SQL = `
-- =====================================================================
-- PHASE 3: LOYALTY PROGRAM
-- =====================================================================
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    points_balance INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'BRONZE' CHECK(tier IN ('BRONZE','SILVER','GOLD','PLATINUM')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES loyalty_accounts(id),
    order_id TEXT,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('EARN','REDEEM','REVERSE_EARN','REVERSE_REDEEM','EXPIRE','ADJUSTMENT')),
    points INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account ON loyalty_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_idemp ON loyalty_transactions(idempotency_key);

-- =====================================================================
-- PHASE 3: CUSTOMER SUPPORT
-- =====================================================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES users(id),
    order_id TEXT,
    category TEXT NOT NULL CHECK(category IN ('ORDER_ISSUE','PRODUCT_COMPLAINT','DELIVERY_PROBLEM','REFUND_REQUEST','GENERAL_INQUIRY','TECHNICAL_ISSUE')),
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED','ESCALATED')),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH','URGENT')),
    assigned_to TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK(sender_role IN ('CUSTOMER','SUPPORT_AGENT','SYSTEM')),
    message TEXT NOT NULL,
    is_internal_note INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages ON ticket_messages(ticket_id);

-- =====================================================================
-- PHASE 3: PRICING ENGINE
-- =====================================================================
CREATE TABLE IF NOT EXISTS price_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER REFERENCES stores(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    override_price NUMERIC(10,2) NOT NULL,
    effective_from TEXT NOT NULL DEFAULT (datetime('now')),
    effective_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_price_lists_product ON price_lists(product_id, store_id);

CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    coupon_type TEXT NOT NULL CHECK(coupon_type IN ('PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING')),
    discount_value NUMERIC(10,2) NOT NULL,
    min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 1,
    current_uses INTEGER NOT NULL DEFAULT 0,
    eligible_tier TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    starts_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id TEXT NOT NULL REFERENCES coupons(id),
    user_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    discount_applied NUMERIC(10,2) NOT NULL,
    redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================================
-- PHASE 3: DELIVERY SLOTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS delivery_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER NOT NULL REFERENCES delivery_zones(id),
    slot_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    max_orders INTEGER NOT NULL DEFAULT 20,
    current_orders INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_zone_date ON delivery_slots(zone_id, slot_date);

-- SEED FOUNDATIONAL COUPONS & DELIVERY SLOTS
INSERT OR IGNORE INTO coupons (id, code, coupon_type, discount_value, min_order_amount, max_uses, starts_at, expires_at)
VALUES 
('CPN-WELCOME20', 'WELCOME20', 'PERCENTAGE', 20.00, 150.00, 500, '2026-01-01', '2026-12-31'),
('CPN-FLAT50', 'SAVE50', 'FIXED_AMOUNT', 50.00, 300.00, 200, '2026-01-01', '2026-12-31'),
('CPN-FREESHIP', 'FREEDELIVERY', 'FREE_SHIPPING', 25.00, 200.00, 1000, '2026-01-01', '2026-12-31');

-- Seed delivery slots for today and tomorrow for Zone 1 (Downtown)
INSERT OR IGNORE INTO delivery_slots (id, zone_id, slot_date, start_time, end_time, max_orders, current_orders)
VALUES
(1, 1, date('now'), '09:00', '12:00', 15, 0),
(2, 1, date('now'), '12:00', '15:00', 15, 0),
(3, 1, date('now'), '15:00', '18:00', 15, 0),
(4, 1, date('now'), '18:00', '21:00', 20, 0),
(5, 1, date('now', '+1 day'), '09:00', '12:00', 15, 0),
(6, 1, date('now', '+1 day'), '18:00', '21:00', 20, 0);
`;

console.log('Migrating database schema for Phase 3 (Loyalty, Support, Pricing, Delivery Slots)...');
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

console.log('Phase 3 Schema Extension successfully applied to database!');
