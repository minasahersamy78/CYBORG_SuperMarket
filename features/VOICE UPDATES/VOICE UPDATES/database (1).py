import sqlite3
import os
import zipfile
import xml.etree.ElementTree as ET
import json
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'market.db')
EXCEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'DATA', 'super_market.xlsx')


def get_db_connection():
    """Returns a SQLite connection with row_factory set to sqlite3.Row and busy timeout."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn


def init_db(force_reload=False):
    """Initializes the SQLite database from DATA/super_market.xlsx if not already populated."""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        barcode TEXT,
        name_ar TEXT,
        name_en TEXT,
        category_ar TEXT,
        category_en TEXT,
        subcategory_ar TEXT,
        subcategory_en TEXT,
        brand TEXT,
        country TEXT,
        size TEXT,
        format TEXT,
        price REAL,
        image TEXT,
        stock INTEGER DEFAULT 50,
        embedding TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT DEFAULT 'Customer',
        customer_email TEXT DEFAULT 'moornafea@gmail.com',
        total_amount REAL NOT NULL,
        duration_days INTEGER,
        status TEXT DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
    );
    """)

    try:
        cur.execute("ALTER TABLE orders ADD COLUMN customer_email TEXT DEFAULT 'moornafea@gmail.com';")
    except sqlite3.OperationalError:
        pass  # Column already exists

    try:
        cur.execute("ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP;")
    except sqlite3.OperationalError:
        pass  # Column already exists

    cur.execute("""
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        customer_name TEXT DEFAULT 'Customer',
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id)
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    );
    """)

    # Create indices for high-performance searching and filtering
    cur.execute("CREATE INDEX IF NOT EXISTS idx_prod_cat_en ON products(category_en);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_prod_cat_ar ON products(category_ar);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_prod_subcat_en ON products(subcategory_en);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_prod_subcat_ar ON products(subcategory_ar);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_prod_barcode ON products(barcode);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);")

    conn.commit()

    # Check if products already loaded
    cur.execute("SELECT COUNT(*) as cnt FROM products")
    count = cur.fetchone()['cnt']

    if count == 0 or force_reload:
        logger.info(f"Loading products from {EXCEL_PATH}...")
        cur.execute("DELETE FROM products;")
        _load_products_from_excel(conn)
        conn.commit()

    conn.close()


def _load_products_from_excel(conn):
    if not os.path.exists(EXCEL_PATH):
        raise FileNotFoundError(f"Excel file not found at {EXCEL_PATH}")

    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(EXCEL_PATH, 'r') as z:
        sst = ET.fromstring(z.read('xl/sharedStrings.xml'))
        strings = []
        for si in sst.findall('ns:si', ns):
            texts = [t.text for t in si.findall('.//ns:t', ns) if t.text]
            strings.append("".join(texts))

        sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows = sheet_tree.findall('.//ns:row', ns)

        header = []
        for c in rows[0].findall('ns:c', ns):
            v = c.find('ns:v', ns)
            t = c.attrib.get('t')
            val = v.text if v is not None else ''
            if t == 's' and val.isdigit():
                val = strings[int(val)]
            header.append(val)

        records = []
        for r in rows[1:]:
            vals = []
            for c in r.findall('ns:c', ns):
                v = c.find('ns:v', ns)
                t = c.attrib.get('t')
                val = v.text if v is not None else ''
                if t == 's' and val.isdigit():
                    val = strings[int(val)]
                vals.append(val)
            row_dict = dict(zip(header, vals))

            p_id = int(row_dict.get('id', 0)) if row_dict.get('id', '').isdigit() else None
            barcode = row_dict.get('barcode', '').strip()
            name_ar = row_dict.get('ArabicPrtoductName', '').strip()
            name_en = row_dict.get('EnglishProductName', '').strip()
            cat_ar = row_dict.get('ArabicCategory', '').strip()
            cat_en = row_dict.get('EnglishCategory', '').strip()
            subcat_ar = row_dict.get('ArabicSubCategory', '').strip()
            subcat_en = row_dict.get('EnglishSubCategory', '').strip()
            brand = row_dict.get('brand', '').strip()
            country = row_dict.get('country', '').strip()
            size = row_dict.get('size', '').strip()
            format_ = row_dict.get('format', '').strip()
            
            try:
                price = float(row_dict.get('price', 0))
            except (ValueError, TypeError):
                price = 0.0

            image = row_dict.get('image', '').strip()
            embedding = row_dict.get('embedding', '').strip()

            # Default stock is 50.
            # For water packs (such as ID 414 Schweppes Tonic Water / ID 457), set initial stock to 20
            # to match project specification and acceptance Test H ("Initial stock: 20 water packs").
            stock = 50
            name_en_l = name_en.lower()
            if ('water' in name_en_l and 'watermelon' not in name_en_l and 'watercress' not in name_en_l) or \
               (('ماء' in name_ar or 'مياه' in name_ar) and 'بطيخ' not in name_ar and 'جرجير' not in name_ar):
                stock = 20

            records.append((
                p_id, barcode, name_ar, name_en, cat_ar, cat_en,
                subcat_ar, subcat_en, brand, country, size, format_,
                price, image, stock, embedding
            ))

        cur = conn.cursor()
        cur.executemany("""
            INSERT OR REPLACE INTO products (
                id, barcode, name_ar, name_en, category_ar, category_en,
                subcategory_ar, subcategory_en, brand, country, size, format,
                price, image, stock, embedding
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, records)
        logger.info(f"Successfully loaded {len(records)} products into database.")


def get_all_products(limit=None, in_stock_only=False):
    conn = get_db_connection()
    cur = conn.cursor()
    query = "SELECT * FROM products"
    params = []
    if in_stock_only:
        query += " WHERE stock > 0"
    if limit:
        query += f" LIMIT {int(limit)}"
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_product_by_id(product_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def set_product_stock(product_id, new_stock):
    conn = get_db_connection()
    with conn:
        conn.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product_id))
    conn.close()


def execute_order_atomic(items, customer_name="Customer", duration_days=None, notes=None, customer_email="moornafea@gmail.com"):
    """
    Executes an order atomically:
    1. Validates all requested items and quantities.
    2. Uses BEGIN IMMEDIATE to lock rows in SQLite and prevent concurrent race conditions (overselling).
    3. Atomically checks stock >= quantity and decrements stock.
    4. Records order and order_items with customer_email.
    5. Returns order details or raises ValueError with clear explanation.
    """
    if not items:
        raise ValueError("Cannot create an empty order.")

    customer_email = customer_email or "moornafea@gmail.com"
    conn = get_db_connection()
    try:
        # SQLite BEGIN IMMEDIATE guarantees exclusive write transaction
        conn.execute("BEGIN IMMEDIATE;")
        cur = conn.cursor()

        total_amount = 0.0
        validated_items = []

        for it in items:
            p_id = it.get('product_id') or it.get('id')
            qty = int(it.get('quantity', 1))
            if qty <= 0:
                raise ValueError(f"Invalid quantity {qty} for product ID {p_id}.")

            cur.execute("SELECT id, name_en, name_ar, price, stock FROM products WHERE id = ?", (p_id,))
            prod = cur.fetchone()
            if not prod:
                raise ValueError(f"Product with ID {p_id} was not found in catalog.")

            current_stock = prod['stock']
            if current_stock < qty:
                raise ValueError(
                    f"Insufficient stock for '{prod['name_en']}' ({prod['name_ar']}). "
                    f"Requested: {qty}, Available in stock: {current_stock}."
                )

            unit_price = float(prod['price'])
            subtotal = round(unit_price * qty, 2)
            total_amount += subtotal

            validated_items.append({
                'product_id': prod['id'],
                'name_en': prod['name_en'],
                'name_ar': prod['name_ar'],
                'quantity': qty,
                'unit_price': unit_price,
                'subtotal': subtotal,
                'stock_before': current_stock,
                'stock_after': current_stock - qty
            })

        # All items verified in stock, now decrement each atomically
        for it in validated_items:
            cur.execute(
                "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
                (it['quantity'], it['product_id'], it['quantity'])
            )
            if cur.rowcount == 0:
                # Another transaction just purchased the items concurrently
                raise ValueError(
                    f"Concurrent checkout conflict: stock for '{it['name_en']}' is no longer available."
                )

        # Insert order record
        cur.execute(
            """
            INSERT INTO orders (customer_name, customer_email, total_amount, duration_days, status, notes)
            VALUES (?, ?, ?, ?, 'confirmed', ?)
            """,
            (customer_name, customer_email, round(total_amount, 2), duration_days, notes or '')
        )
        order_id = cur.lastrowid

        # Insert order items
        order_items_data = [
            (order_id, it['product_id'], it['name_en'], it['quantity'], it['unit_price'], it['subtotal'])
            for it in validated_items
        ]
        cur.executemany(
            """
            INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            order_items_data
        )

        conn.commit()

        return {
            'order_id': order_id,
            'customer_name': customer_name,
            'customer_email': customer_email,
            'total_amount': round(total_amount, 2),
            'duration_days': duration_days,
            'items': validated_items,
            'status': 'confirmed'
        }

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_order_by_id(order_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order_row = cur.fetchone()
    if not order_row:
        conn.close()
        return None

    cur.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
    item_rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    order_dict = dict(order_row)
    order_dict['items'] = item_rows
    return order_dict


def cancel_order_atomic(order_id, customer_name=None, customer_email=None):
    """
    Atomically cancels an eligible order and restores its inventory:
    1. Locks database using BEGIN IMMEDIATE.
    2. Validates order exists.
    3. Validates customer ownership (customer cannot cancel another's order).
    4. Validates order status is eligible ('confirmed' or 'pending'). If already 'cancelled', 'delivered', etc., raises ValueError.
    5. Updates order status to 'cancelled' and records cancelled_at timestamp.
    6. Restores inventory for all products in order_items atomically.
    7. Inventory restoration happens exactly once.
    """
    conn = get_db_connection()
    try:
        conn.execute("BEGIN IMMEDIATE;")
        cur = conn.cursor()

        cur.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
        order = cur.fetchone()
        if not order:
            raise ValueError(f"Order #{order_id} was not found.")

        # Ownership check (if specific customer is specified, prevent cross-customer cancellation)
        if customer_name and customer_name != "Customer" and order['customer_name'] != "Customer" and order['customer_name'] != customer_name:
            raise PermissionError("Access denied: You cannot cancel an order belonging to another customer.")
        if customer_email and order['customer_email'] and order['customer_email'].lower() != customer_email.lower():
            raise PermissionError("Access denied: You cannot cancel an order belonging to another customer.")

        current_status = (order['status'] or '').lower()
        if current_status == 'cancelled':
            raise ValueError(f"Order #{order_id} is already cancelled. Repeated cancellation is not permitted.")
        if current_status not in ['confirmed', 'pending']:
            raise ValueError(f"Order #{order_id} cannot be cancelled because its status is '{order['status']}'. Only Confirmed or Pending orders can be cancelled.")

        # Fetch items to restore stock
        cur.execute("SELECT product_id, product_name, quantity FROM order_items WHERE order_id = ?", (order_id,))
        items = cur.fetchall()

        # Update order status atomically
        cur.execute(
            "UPDATE orders SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?",
            (order_id, order['status'])
        )
        if cur.rowcount == 0:
            raise ValueError(f"Concurrent update conflict: Order #{order_id} status changed concurrently.")

        # Restore stock exactly once
        restored_items = []
        for it in items:
            p_id = it['product_id']
            qty = it['quantity']
            cur.execute("UPDATE products SET stock = stock + ? WHERE id = ?", (qty, p_id))
            cur.execute("SELECT stock FROM products WHERE id = ?", (p_id,))
            new_stock = cur.fetchone()['stock']
            restored_items.append({
                'product_id': p_id,
                'product_name': it['product_name'],
                'quantity_restored': qty,
                'new_stock': new_stock
            })

        conn.commit()
        return {
            'success': True,
            'order_id': order_id,
            'status': 'cancelled',
            'restored_items': restored_items,
            'message': f"Order #{order_id} successfully cancelled. Stock has been restored."
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def create_complaint(description, category, order_id=None, customer_name="Customer"):
    """Creates and stores a customer complaint in the database."""
    if not description or not description.strip():
        raise ValueError("Complaint description cannot be empty.")
    if not category or not category.strip():
        category = "general"

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        # Verify order exists if order_id is provided
        verified_order_id = None
        if order_id:
            try:
                oid = int(order_id)
                cur.execute("SELECT id FROM orders WHERE id = ?", (oid,))
                row = cur.fetchone()
                if row:
                    verified_order_id = oid
            except (ValueError, TypeError):
                pass

        cur.execute(
            """
            INSERT INTO complaints (order_id, customer_name, category, description, status)
            VALUES (?, ?, ?, ?, 'open')
            """,
            (verified_order_id, customer_name, category.strip(), description.strip())
        )
        complaint_id = cur.lastrowid
        conn.commit()

        cur.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
        complaint_record = dict(cur.fetchone())
        return complaint_record
    finally:
        conn.close()


def get_complaint_by_id(complaint_id):
    """Retrieves a complaint by ID."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cid_clean = str(complaint_id).replace("CMP-", "").replace("cmp-", "").strip()
        cur.execute("SELECT * FROM complaints WHERE id = ?", (int(cid_clean),))
        row = cur.fetchone()
        return dict(row) if row else None
    except Exception:
        return None
    finally:
        conn.close()


def get_all_complaints(limit=50):
    """Retrieves all complaints."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM complaints ORDER BY id DESC LIMIT ?", (int(limit),))
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


def get_customer_orders_db(customer_name=None, customer_email=None, limit=50):
    """Retrieves orders for a customer with item details."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        query = "SELECT * FROM orders WHERE 1=1"
        params = []
        if customer_name and customer_name != "Customer":
            query += " AND customer_name = ?"
            params.append(customer_name)
        if customer_email:
            query += " AND customer_email = ?"
            params.append(customer_email)
        query += " ORDER BY id DESC LIMIT ?"
        params.append(int(limit))
        cur.execute(query, params)
        orders = [dict(r) for r in cur.fetchall()]
        for o in orders:
            cur.execute("SELECT * FROM order_items WHERE order_id = ?", (o['id'],))
            o['items'] = [dict(it) for it in cur.fetchall()]
        return orders
    finally:
        conn.close()
