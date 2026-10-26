class PosMigrations {
  static const List<String> initialSchema = [
    '''
    CREATE TABLE IF NOT EXISTS local_products (
      id INTEGER PRIMARY KEY,
      barcode TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      price REAL NOT NULL,
      category_name TEXT,
      format TEXT,
      size TEXT,
      updated_at TEXT
    );
    ''',
    '''
    CREATE TABLE IF NOT EXISTS local_inventory (
      product_id INTEGER PRIMARY KEY,
      quantity INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES local_products(id)
    );
    ''',
    '''
    CREATE TABLE IF NOT EXISTS local_shifts (
      id TEXT PRIMARY KEY,
      cashier_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      terminal_id TEXT NOT NULL,
      opening_balance REAL NOT NULL,
      closing_balance REAL,
      actual_counted_balance REAL,
      discrepancy REAL,
      total_transactions INTEGER DEFAULT 0,
      total_cash_sales REAL DEFAULT 0.0,
      total_card_sales REAL DEFAULT 0.0,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      is_closed INTEGER DEFAULT 0
    );
    ''',
    '''
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_uuid TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'PENDING'
    );
    ''',
    '''
    CREATE INDEX IF NOT EXISTS idx_local_products_barcode ON local_products(barcode);
    ''',
    '''
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);
    '''
  ];
}
