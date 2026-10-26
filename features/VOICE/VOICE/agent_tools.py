import sqlite3
from typing import List, Dict, Any, Optional, Tuple, Union
import database
import duration_parser
import category_matcher
import recommendation_engine


def search_products(
    query: str = "",
    category: Optional[str] = None,
    max_price: Optional[float] = None,
    in_stock_only: bool = True,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Tool: search_products
    Searches products by keyword in English or Arabic, with optional category filter,
    max price threshold, and stock availability constraint.
    """
    conn = database.get_db_connection()
    cur = conn.cursor()

    sql = "SELECT * FROM products WHERE 1=1"
    params = []

    if query:
        q = f"%{query.strip()}%"
        sql += " AND (name_en LIKE ? OR name_ar LIKE ? OR brand LIKE ? OR barcode LIKE ?)"
        params.extend([q, q, q, q])

    if max_price is not None and max_price > 0:
        sql += " AND price <= ?"
        params.append(float(max_price))

    if in_stock_only:
        sql += " AND stock > 0"

    sql += f" LIMIT {int(limit)}"
    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    if category:
        cats = [category] if isinstance(category, str) else category
        rows = category_matcher.filter_products_strictly(rows, cats)

    return rows


def get_product_details(product_id: int) -> Optional[Dict[str, Any]]:
    """
    Tool: get_product_details
    Retrieves full specifications, stock, price, and metadata for a specific product ID.
    """
    return database.get_product_by_id(product_id)


def check_stock(product_id: int) -> Dict[str, Any]:
    """
    Tool: check_stock
    Checks immediate available inventory for a specific product.
    """
    prod = database.get_product_by_id(product_id)
    if not prod:
        return {'found': False, 'product_id': product_id, 'stock': 0, 'status': 'Product not found'}
    
    return {
        'found': True,
        'product_id': prod['id'],
        'name_en': prod['name_en'],
        'name_ar': prod['name_ar'],
        'price': prod['price'],
        'stock': prod['stock'],
        'in_stock': prod['stock'] > 0
    }


def filter_by_category(categories: List[str]) -> List[Dict[str, Any]]:
    """
    Tool: filter_by_category
    Retrieves products matching strictly one or more category keys.
    """
    all_prods = database.get_all_products(in_stock_only=True)
    return category_matcher.filter_products_strictly(all_prods, categories)


def validate_budget(budget: Any) -> Tuple[bool, Optional[float], Optional[str]]:
    """
    Tool: validate_budget
    Validates that the budget is a positive number.
    Returns (is_valid, parsed_budget, error_message).
    """
    if budget is None:
        return False, None, "Budget cannot be empty."

    try:
        b = float(budget)
    except (ValueError, TypeError):
        return False, None, "Invalid budget format. Budget must be a numeric value in EGP."

    if b <= 0:
        return False, None, "Budget must be greater than 0 EGP."

    return True, b, None


def parse_duration(text: str) -> Dict[str, Any]:
    """
    Tool: parse_duration
    Parses natural language duration expressions in Arabic, Egyptian Arabic, and English.
    """
    return duration_parser.parse_duration(text)


def validate_duration(duration_days: Any) -> Tuple[bool, Optional[str]]:
    """
    Tool: validate_duration
    Validates that shopping duration is strictly between 1 and 365 days.
    """
    return duration_parser.validate_duration(duration_days)


def recommend_products(
    budget: float,
    categories: Optional[List[str]] = None,
    duration_days: Optional[int] = None,
    query: Optional[str] = None
) -> Dict[str, Any]:
    """
    Tool: recommend_products
    Generates intelligent budget-based and duration-aware product recommendations.
    """
    return recommendation_engine.recommend_products(
        budget=budget,
        categories=categories,
        duration_days=duration_days,
        query=query
    )


def calculate_order_total(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Tool: calculate_order_total
    Programmatically calculates item subtotals and the final order total.
    """
    if not items:
        return {'total': 0.0, 'items_count': 0, 'items': []}

    detailed_items = []
    total = 0.0
    for it in items:
        p_id = it.get('product_id') or it.get('id')
        qty = int(it.get('quantity', 1))
        unit_price = float(it.get('unit_price') or it.get('price', 0))
        
        # If price wasn't supplied, look up in DB to prevent price spoofing
        if unit_price <= 0 and p_id:
            p_data = database.get_product_by_id(p_id)
            if p_data:
                unit_price = float(p_data['price'])

        subtotal = round(unit_price * qty, 2)
        total = round(total + subtotal, 2)
        detailed_items.append({
            'product_id': p_id,
            'name_en': it.get('name_en', ''),
            'name_ar': it.get('name_ar', ''),
            'quantity': qty,
            'unit_price': unit_price,
            'subtotal': subtotal
        })

    return {
        'items': detailed_items,
        'items_count': len(detailed_items),
        'total': total
    }


import email_service


def create_order(
    items: List[Dict[str, Any]],
    customer_name: str = "Customer",
    duration_days: Optional[int] = None,
    notes: Optional[str] = None,
    customer_email: str = "moornafea@gmail.com"
) -> Dict[str, Any]:
    """
    Tool: create_order
    Atomically creates an order in SQLite, validates inventory, deducts stock,
    and automatically sends the order receipt to the specified email (default moornafea@gmail.com).
    """
    order = database.execute_order_atomic(
        items=items,
        customer_name=customer_name,
        duration_days=duration_days,
        notes=notes,
        customer_email=customer_email
    )
    # Send email receipt automatically
    email_res = email_service.send_order_email(order, recipient=customer_email)
    order['email_status'] = email_res
    return order


def update_inventory(product_id: int, quantity_diff: int) -> Dict[str, Any]:
    """
    Tool: update_inventory
    Updates the stock count of a product by quantity_diff (positive to restock, negative to reduce).
    """
    conn = database.get_db_connection()
    with conn:
        cur = conn.cursor()
        cur.execute("SELECT stock FROM products WHERE id = ?", (product_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return {'success': False, 'error': f"Product {product_id} not found"}
        
        new_stock = row['stock'] + quantity_diff
        if new_stock < 0:
            conn.close()
            return {'success': False, 'error': f"Cannot set negative stock ({new_stock})"}

        cur.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, product_id))
    conn.close()
    return {'success': True, 'product_id': product_id, 'new_stock': new_stock}


def get_order_status(order_id: int) -> Optional[Dict[str, Any]]:
    """
    Tool: get_order_status
    Retrieves the status, total, and item breakdown of an existing order.
    """
    return database.get_order_by_id(order_id)


# ============================================================================
# COMPLAINTS MANAGEMENT TOOLS (Section 12 & 15)
# ============================================================================

def classify_complaint_category(text: str) -> str:
    """Classifies natural language complaint text into standard categories."""
    if not text:
        return "general"
    norm = text.lower()
    if any(w in norm for w in ["damage", "broken", "leaking", "expired", "cracked", "spoiled", "تالف", "مكسور", "بايظ", "منتهي", "متضرر"]):
        return "damaged_product"
    if any(w in norm for w in ["miss", "missing", "incomplete", "forgot", "left out", "not in", "ناقص", "لم استلم", "مفقود", "مش موجود"]):
        return "missing_product"
    if any(w in norm for w in ["wrong", "incorrect", "mistake", "different", "instead", "خطأ", "غلط", "غير صحيح", "مختلف", "بدل"]):
        return "incorrect_order"
    if any(w in norm for w in ["payment", "charged", "refund", "card", "billing", "money", "fee", "دفع", "سحب", "فلوس", "رصيد", "مبلغ"]):
        return "payment_issue"
    if any(w in norm for w in ["deliver", "delay", "late", "driver", "courier", "rider", "time", "توصيل", "تاخير", "سائق", "مندوب", "دليفري"]):
        return "delivery_problem"
    if any(w in norm for w in ["app", "website", "bug", "crash", "error", "technical", "system", "سيستم", "برنامج", "موقع", "عطل", "مشكلة تقنية"]):
        return "technical_issue"
    return "general"


def submit_complaint(
    description: str,
    category: Optional[str] = None,
    order_id: Optional[Union[int, str]] = None,
    customer_name: str = "Customer"
) -> Dict[str, Any]:
    """
    Tool: submit_complaint
    Registers a customer complaint in the database with auto-classification,
    links to order if provided, and returns complaint ID and status.
    """
    if not description or not description.strip():
        raise ValueError("Complaint description is required.")

    cat = category or classify_complaint_category(description)

    # Clean order ID if given
    clean_oid = None
    if order_id is not None:
        try:
            clean_oid = int(str(order_id).replace("Order", "").replace("order", "").replace("#", "").strip())
        except (ValueError, TypeError):
            clean_oid = None

    record = database.create_complaint(
        description=description,
        category=cat,
        order_id=clean_oid,
        customer_name=customer_name
    )

    complaint_code = f"CMP-{record['id']}"
    return {
        "success": True,
        "complaint_id": complaint_code,
        "raw_id": record['id'],
        "order_id": record['order_id'],
        "category": record['category'],
        "description": record['description'],
        "status": record['status'],
        "created_at": record['created_at'],
        "message": f"Complaint #{complaint_code} registered successfully under category '{record['category']}'."
    }


def get_complaint_status(complaint_id: Union[int, str]) -> Optional[Dict[str, Any]]:
    """
    Tool: get_complaint_status
    Checks the status of an existing complaint.
    """
    record = database.get_complaint_by_id(complaint_id)
    if not record:
        return None
    return {
        "complaint_id": f"CMP-{record['id']}",
        "raw_id": record['id'],
        "order_id": record['order_id'],
        "category": record['category'],
        "description": record['description'],
        "status": record['status'],
        "created_at": record['created_at']
    }


# ============================================================================
# SHOPPING CART MANAGEMENT TOOLS (Section 13 & 15)
# ============================================================================

def _normalize_cart(cart: Any) -> Dict[str, Any]:
    """Ensures cart is a consistent dictionary structure."""
    if isinstance(cart, list):
        items = cart
    elif isinstance(cart, dict):
        items = cart.get('items', [])
    else:
        items = []
    return calculate_cart_total(items)


def calculate_cart_total(cart_items: Union[List[Dict[str, Any]], Dict[str, Any]]) -> Dict[str, Any]:
    """
    Tool: calculate_cart_total
    Calculates item subtotals and total cart value.
    """
    items = cart_items.get('items', []) if isinstance(cart_items, dict) else (cart_items or [])
    total = 0.0
    detailed = []

    for it in items:
        p_id = it.get('product_id') or it.get('id')
        qty = int(it.get('quantity', 1))
        unit_price = float(it.get('unit_price') or it.get('price', 0))

        if (unit_price <= 0 or not it.get('name_en')) and p_id:
            p_data = database.get_product_by_id(p_id)
            if p_data:
                unit_price = float(p_data['price'])
                it['name_en'] = it.get('name_en') or p_data['name_en']
                it['name_ar'] = it.get('name_ar') or p_data['name_ar']
                it['stock'] = p_data['stock']
                it['image'] = p_data.get('image', '')

        subtotal = round(unit_price * qty, 2)
        total = round(total + subtotal, 2)
        detailed.append({
            'product_id': p_id,
            'name_en': it.get('name_en', ''),
            'name_ar': it.get('name_ar', ''),
            'unit_price': unit_price,
            'quantity': qty,
            'subtotal': subtotal,
            'stock': it.get('stock', 50),
            'image': it.get('image', '')
        })

    return {
        'items': detailed,
        'items_count': sum(i['quantity'] for i in detailed),
        'total': total
    }


def get_cart(cart: Any) -> Dict[str, Any]:
    """
    Tool: get_cart
    Returns the current shopping cart contents and total value.
    """
    return _normalize_cart(cart)


def add_to_cart(cart: Any, product_identifier: Union[int, str, Dict[str, Any]], quantity: int = 1) -> Dict[str, Any]:
    """
    Tool: add_to_cart
    Adds product to shopping cart without deducting inventory from the database.
    Revalidates product existence and stock availability.
    """
    if quantity <= 0:
        raise ValueError(f"Invalid quantity {quantity}. Quantity must be at least 1.")

    target_prod = None
    if isinstance(product_identifier, dict) and (product_identifier.get('id') or product_identifier.get('product_id')):
        p_id = product_identifier.get('id') or product_identifier.get('product_id')
        target_prod = database.get_product_by_id(p_id)
    elif isinstance(product_identifier, int) or (isinstance(product_identifier, str) and str(product_identifier).isdigit()):
        target_prod = database.get_product_by_id(int(product_identifier))
    elif isinstance(product_identifier, str):
        matches = search_products(query=product_identifier, limit=1)
        if matches:
            target_prod = matches[0]

    if not target_prod:
        return {
            'success': False,
            'error': f"Product '{product_identifier}' not found in catalog.",
            'cart': _normalize_cart(cart)
        }

    available_stock = target_prod['stock']
    if available_stock <= 0:
        return {
            'success': False,
            'error': f"Product '{target_prod['name_en']}' ({target_prod['name_ar']}) is out of stock.",
            'cart': _normalize_cart(cart)
        }

    c = _normalize_cart(cart)
    existing_item = next((it for it in c['items'] if it['product_id'] == target_prod['id']), None)
    new_qty = (existing_item['quantity'] if existing_item else 0) + quantity

    if new_qty > available_stock:
        return {
            'success': False,
            'error': f"Cannot add {quantity} units. Current stock in database is {available_stock}.",
            'cart': c
        }

    if existing_item:
        existing_item['quantity'] = new_qty
    else:
        c['items'].append({
            'product_id': target_prod['id'],
            'name_en': target_prod['name_en'],
            'name_ar': target_prod['name_ar'],
            'unit_price': float(target_prod['price']),
            'quantity': quantity,
            'stock': available_stock,
            'image': target_prod.get('image', '')
        })

    updated_cart = calculate_cart_total(c['items'])
    return {
        'success': True,
        'cart': updated_cart,
        'added_item': {
            'product_id': target_prod['id'],
            'name_en': target_prod['name_en'],
            'name_ar': target_prod['name_ar'],
            'quantity': quantity,
            'unit_price': float(target_prod['price'])
        },
        'message': f"Added {quantity} of '{target_prod['name_en']}' to cart."
    }


def remove_from_cart(cart: Any, product_identifier: Union[int, str]) -> Dict[str, Any]:
    """
    Tool: remove_from_cart
    Removes a product from the shopping cart.
    """
    c = _normalize_cart(cart)
    target_idx = None

    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and str(product_identifier).isdigit()):
        pid = int(product_identifier)
        for idx, it in enumerate(c['items']):
            if it['product_id'] == pid:
                target_idx = idx
                break
    elif isinstance(product_identifier, str):
        query = product_identifier.lower().strip()
        for idx, it in enumerate(c['items']):
            if query in it['name_en'].lower() or query in it['name_ar'].lower():
                target_idx = idx
                break

    if target_idx is None:
        return {
            'success': False,
            'error': f"Item '{product_identifier}' was not found in cart.",
            'cart': c
        }

    removed = c['items'].pop(target_idx)
    updated_cart = calculate_cart_total(c['items'])
    return {
        'success': True,
        'cart': updated_cart,
        'removed_item': removed,
        'message': f"Removed '{removed['name_en']}' from cart."
    }


def update_cart_quantity(cart: Any, product_identifier: Union[int, str], quantity: int) -> Dict[str, Any]:
    """
    Tool: update_cart_quantity
    Increases or decreases quantity of a product in the cart.
    If quantity <= 0, removes the product from cart.
    """
    if quantity <= 0:
        return remove_from_cart(cart, product_identifier)

    c = _normalize_cart(cart)
    target_item = None

    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and str(product_identifier).isdigit()):
        pid = int(product_identifier)
        target_item = next((it for it in c['items'] if it['product_id'] == pid), None)
    elif isinstance(product_identifier, str):
        query = product_identifier.lower().strip()
        target_item = next((it for it in c['items'] if query in it['name_en'].lower() or query in it['name_ar'].lower()), None)

    if not target_item:
        return {
            'success': False,
            'error': f"Item '{product_identifier}' not found in cart.",
            'cart': c
        }

    # Verify stock in DB
    prod = database.get_product_by_id(target_item['product_id'])
    if prod and quantity > prod['stock']:
        return {
            'success': False,
            'error': f"Cannot set quantity to {quantity}. Available stock is {prod['stock']}.",
            'cart': c
        }

    target_item['quantity'] = quantity
    updated_cart = calculate_cart_total(c['items'])
    return {
        'success': True,
        'cart': updated_cart,
        'updated_item': target_item,
        'message': f"Updated quantity for '{target_item['name_en']}' to {quantity}."
    }


def checkout(
    cart: Any,
    customer_name: str = "Customer",
    duration_days: Optional[int] = None,
    notes: Optional[str] = None,
    customer_email: str = "moornafea@gmail.com"
) -> Dict[str, Any]:
    """
    Tool: checkout
    Revalidates stock and prices, atomically creates the order, deducts stock from inventory,
    sends order confirmation email, and empties the cart.
    """
    c = _normalize_cart(cart)
    if not c['items']:
        raise ValueError("Cannot checkout with an empty cart.")

    # Execute atomic order creation (stock deducted here)
    order = create_order(
        items=c['items'],
        customer_name=customer_name,
        duration_days=duration_days,
        notes=notes,
        customer_email=customer_email
    )

    # Empty cart upon confirmed checkout
    return {
        'success': True,
        'order': order,
        'cart': {'items': [], 'items_count': 0, 'total': 0.0},
        'message': f"Checkout successful! Order #{order['order_id']} confirmed."
    }


# ============================================================================
# ORDER CANCELLATION & INVENTORY RESTORATION TOOLS (Section 14 & 15)
# ============================================================================

def get_customer_orders(customer_name: str = "Customer", customer_email: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Tool: get_customer_orders
    Retrieves all orders for the specified customer with itemized details and status.
    """
    return database.get_customer_orders_db(customer_name=customer_name, customer_email=customer_email)


def cancel_order(order_id: int, customer_name: str = "Customer", customer_email: Optional[str] = None) -> Dict[str, Any]:
    """
    Tool: cancel_order
    Cancels an eligible order and restores its inventory exactly once using atomic DB transaction.
    """
    return database.cancel_order_atomic(order_id=order_id, customer_name=customer_name, customer_email=customer_email)


def restore_inventory(order_id: int) -> Dict[str, Any]:
    """
    Tool: restore_inventory
    Restores inventory associated with an order cancellation.
    """
    return cancel_order(order_id=order_id)
