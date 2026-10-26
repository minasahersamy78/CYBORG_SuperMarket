import os
import sys
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory, session

import database
import agent_tools
import agent_controller
import duration_parser
import category_matcher
import recommendation_engine
import email_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger("ShoppingAgentApp")

app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)
app.secret_key = os.environ.get('SECRET_KEY', 'smart_market_super_secret_key_2026')
app.config['JSON_AS_ASCII'] = False

# Initialize database on startup
database.init_db()

# Initialize conversational agent controller
agent = agent_controller.ShoppingAgentController()


@app.route('/')
def index():
    """Serves the intelligent bilingual shopping application."""
    return render_template('index.html')


@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Main conversational agent endpoint for both text and voice input.
    Payload:
    {
        "message": "عايز منتجات ألبان وبقوليات بميزانية 2000 جنيه لمدة شهر",
        "session_state": {},
        "is_voice": true/false
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    message = data.get('message', '').strip()
    session_state = data.get('session_state', {})
    is_voice = bool(data.get('is_voice', False))

    if not message:
        return jsonify({
            'success': False,
            'text': "Please provide a valid text or voice message.",
            'speech_text': "Please provide a message.",
            'action': 'empty_input',
            'items': [],
            'calculations': {},
            'updated_state': session_state
        }), 400

    try:
        # Sync session cart into session_state if session_state has empty cart
        if 'cart' in session and isinstance(session['cart'], dict) and session['cart'].get('items'):
            if not session_state.get('cart', {}).get('items'):
                session_state['cart'] = session['cart']

        response = agent.process_message(message, session_state)
        response['is_voice'] = is_voice
        response['success'] = True

        # Keep Flask session cart in sync
        if response.get('cart'):
            session['cart'] = response['cart']
            session.modified = True
        elif response.get('updated_state', {}).get('cart'):
            session['cart'] = response['updated_state']['cart']
            session.modified = True

        return jsonify(response)
    except Exception as e:
        logger.error(f"Error processing message '{message}': {e}", exc_info=True)
        return jsonify({
            'success': False,
            'text': f"An error occurred while processing your request: {str(e)}",
            'speech_text': "An error occurred while processing your request.",
            'action': 'system_error',
            'items': [],
            'calculations': {},
            'updated_state': session_state
        }), 500


@app.route('/api/recommend', methods=['POST'])
def recommend():
    """
    Direct deterministic budget-based and duration-aware recommendation endpoint.
    Payload:
    {
        "budget": 2000.0,
        "categories": ["dairy", "legumes"],
        "duration_days": 30,
        "query": ""
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    try:
        budget = float(data.get('budget', 0))
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': "Invalid budget format."}), 400

    categories = data.get('categories')
    if isinstance(categories, str):
        categories = [categories]

    duration_days = data.get('duration_days')
    if duration_days is not None:
        try:
            duration_days = int(duration_days)
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': "Invalid duration_days format."}), 400

    query = data.get('query')

    result = agent_tools.recommend_products(
        budget=budget,
        categories=categories,
        duration_days=duration_days,
        query=query
    )
    return jsonify(result)


@app.route('/api/order/confirm', methods=['POST'])
def confirm_order():
    """
    Atomically places an order, validates stock with SQLite row locks,
    and updates inventory in real time.
    Payload:
    {
        "items": [{"product_id": 414, "quantity": 1}],
        "customer_name": "Customer",
        "duration_days": 30
    }
    """
    data = request.get_json(force=True, silent=True) or {}
    items = data.get('items', [])
    customer_name = data.get('customer_name', 'Customer')
    duration_days = data.get('duration_days')

    if not items:
        return jsonify({'success': False, 'error': "Order must contain at least one item."}), 400

    try:
        order = agent_tools.create_order(
            items=items,
            customer_name=customer_name,
            duration_days=duration_days
        )
        return jsonify({
            'success': True,
            'message': f"Order #{order['order_id']} placed successfully.",
            'order': order
        })
    except Exception as e:
        logger.warning(f"Order placement failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/products', methods=['GET'])
def list_products():
    """
    Retrieves or searches products from database.
    Query params: q, category, max_price, in_stock_only, limit, offset
    """
    query = request.args.get('q', '').strip()
    category = request.args.get('category')
    max_price = request.args.get('max_price', type=float)
    in_stock_only = request.args.get('in_stock_only', 'true').lower() == 'true'
    limit = request.args.get('limit', default=50, type=int)

    products = agent_tools.search_products(
        query=query,
        category=category,
        max_price=max_price,
        in_stock_only=in_stock_only,
        limit=limit
    )
    return jsonify({
        'success': True,
        'count': len(products),
        'products': products
    })


@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """Retrieves single product specification and real-time inventory."""
    prod = agent_tools.get_product_details(product_id)
    if not prod:
        return jsonify({'success': False, 'error': "Product not found."}), 404
    return jsonify({'success': True, 'product': prod})


@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    """Lists current inventory stock across all products."""
    all_prods = database.get_all_products(limit=100)
    inventory = [
        {
            'id': p['id'],
            'barcode': p['barcode'],
            'name_en': p['name_en'],
            'name_ar': p['name_ar'],
            'price': p['price'],
            'stock': p['stock'],
            'category_en': p['category_en']
        }
        for p in all_prods
    ]
    return jsonify({'success': True, 'count': len(inventory), 'inventory': inventory})


@app.route('/api/inventory/<int:product_id>', methods=['PUT'])
def update_product_stock(product_id):
    """Admin / automated stock update endpoint."""
    data = request.get_json(force=True, silent=True) or {}
    new_stock = data.get('stock')
    if new_stock is None:
        diff = data.get('quantity_diff', 0)
        res = agent_tools.update_inventory(product_id, int(diff))
    else:
        try:
            database.set_product_stock(product_id, int(new_stock))
            res = {'success': True, 'product_id': product_id, 'new_stock': int(new_stock)}
        except Exception as e:
            res = {'success': False, 'error': str(e)}

    return jsonify(res)


@app.route('/api/orders', methods=['GET'])
def get_orders():
    """Retrieves order history with item breakdown and status."""
    customer_name = request.args.get('customer_name')
    customer_email = request.args.get('customer_email')
    orders = database.get_customer_orders_db(customer_name=customer_name, customer_email=customer_email, limit=100)
    return jsonify({'success': True, 'count': len(orders), 'orders': orders})


@app.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order_details(order_id):
    """Retrieves full details and line items for an order."""
    order = agent_tools.get_order_status(order_id)
    if not order:
        return jsonify({'success': False, 'error': f"Order #{order_id} not found."}), 404
    return jsonify({'success': True, 'order': order})


@app.route('/api/orders/<int:order_id>/cancel', methods=['POST'])
def cancel_order_route(order_id):
    """
    Section 14 & 15: Cancels an eligible order and restores inventory atomically.
    Validates order status on the backend before processing.
    """
    data = request.get_json(force=True, silent=True) or {}
    customer_name = data.get('customer_name')
    customer_email = data.get('customer_email')

    try:
        res = agent_tools.cancel_order(
            order_id=order_id,
            customer_name=customer_name,
            customer_email=customer_email
        )
        # Also remove restored items from current Flask session cart if present
        if 'cart' in session and isinstance(session['cart'], dict):
            current_cart = session['cart']
            for it in res.get('restored_items', []):
                rem_res = agent_tools.remove_from_cart(current_cart, it.get('product_id'))
                if rem_res.get('success'):
                    current_cart = rem_res['cart']
            session['cart'] = current_cart
            session.modified = True
            res['cart'] = session['cart']

        return jsonify(res)
    except PermissionError as pe:
        logger.warning(f"Unauthorized cancellation attempt for order #{order_id}: {pe}")
        return jsonify({'success': False, 'error': str(pe)}), 403
    except ValueError as ve:
        logger.warning(f"Invalid cancellation request for order #{order_id}: {ve}")
        return jsonify({'success': False, 'error': str(ve)}), 400
    except Exception as e:
        logger.error(f"Error cancelling order #{order_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================================
# SHOPPING CART ENDPOINTS (Section 13)
# ============================================================================

def _get_current_cart():
    if 'cart' not in session or not isinstance(session['cart'], dict):
        session['cart'] = {'items': [], 'items_count': 0, 'total': 0.0}
    return session['cart']


@app.route('/api/cart', methods=['GET'])
def get_cart_route():
    """Returns the current shopping cart contents and total value."""
    cart = _get_current_cart()
    normalized = agent_tools.get_cart(cart)
    session['cart'] = normalized
    return jsonify({'success': True, 'cart': normalized})


@app.route('/api/cart/add', methods=['POST'])
def add_to_cart_route():
    """Adds product to cart without reducing actual inventory."""
    data = request.get_json(force=True, silent=True) or {}
    product_id = data.get('product_id')
    product_name = data.get('product_name')
    target = product_id if product_id is not None else product_name
    quantity = int(data.get('quantity', 1))

    if not target:
        return jsonify({'success': False, 'error': "Product ID or product name is required."}), 400

    cart = _get_current_cart()
    try:
        res = agent_tools.add_to_cart(cart, target, quantity)
        if res['success']:
            session['cart'] = res['cart']
            session.modified = True
            return jsonify(res)
        else:
            return jsonify(res), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/cart/remove', methods=['POST'])
def remove_from_cart_route():
    """Removes a product from the shopping cart."""
    data = request.get_json(force=True, silent=True) or {}
    product_id = data.get('product_id')
    product_name = data.get('product_name')
    target = product_id if product_id is not None else product_name

    if target is None:
        return jsonify({'success': False, 'error': "Product ID or name required to remove item."}), 400

    cart = _get_current_cart()
    res = agent_tools.remove_from_cart(cart, target)
    if res['success']:
        session['cart'] = res['cart']
        session.modified = True
        return jsonify(res)
    return jsonify(res), 400


@app.route('/api/cart/update', methods=['POST'])
def update_cart_quantity_route():
    """Updates quantity of product in cart."""
    data = request.get_json(force=True, silent=True) or {}
    product_id = data.get('product_id')
    product_name = data.get('product_name')
    target = product_id if product_id is not None else product_name
    quantity = int(data.get('quantity', 1))

    if target is None:
        return jsonify({'success': False, 'error': "Product ID or name required."}), 400

    cart = _get_current_cart()
    res = agent_tools.update_cart_quantity(cart, target, quantity)
    if res['success']:
        session['cart'] = res['cart']
        session.modified = True
        return jsonify(res)
    return jsonify(res), 400


@app.route('/api/cart/checkout', methods=['POST'])
def checkout_cart_route():
    """
    Revalidates stock and prices, atomically creates order, deducts stock,
    and returns confirmed order details.
    """
    data = request.get_json(force=True, silent=True) or {}
    cart = data.get('cart') or _get_current_cart()
    customer_name = data.get('customer_name', 'Customer')
    customer_email = data.get('customer_email', 'moornafea@gmail.com')
    duration_days = data.get('duration_days')

    try:
        res = agent_tools.checkout(
            cart=cart,
            customer_name=customer_name,
            duration_days=duration_days,
            customer_email=customer_email
        )
        session['cart'] = {'items': [], 'items_count': 0, 'total': 0.0}
        session.modified = True
        return jsonify(res)
    except Exception as e:
        logger.warning(f"Checkout error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400


# ============================================================================
# COMPLAINTS ENDPOINTS (Section 12)
# ============================================================================

@app.route('/api/complaints', methods=['GET', 'POST'])
def complaints_route():
    """Submits or lists customer complaints."""
    if request.method == 'POST':
        data = request.get_json(force=True, silent=True) or {}
        description = data.get('description', '').strip()
        category = data.get('category')
        order_id = data.get('order_id')
        customer_name = data.get('customer_name', 'Customer')

        if not description:
            return jsonify({'success': False, 'error': "Complaint description is required."}), 400

        try:
            res = agent_tools.submit_complaint(
                description=description,
                category=category,
                order_id=order_id,
                customer_name=customer_name
            )
            return jsonify(res), 201
        except Exception as e:
            logger.error(f"Error submitting complaint: {e}", exc_info=True)
            return jsonify({'success': False, 'error': str(e)}), 400

    complaints = database.get_all_complaints(limit=100)
    return jsonify({'success': True, 'count': len(complaints), 'complaints': complaints})


@app.route('/api/complaints/<complaint_id>', methods=['GET'])
def get_complaint_status_route(complaint_id):
    """Retrieves status and details of a complaint."""
    stat = agent_tools.get_complaint_status(complaint_id)
    if not stat:
        return jsonify({'success': False, 'error': f"Complaint '{complaint_id}' was not found."}), 404
    return jsonify({'success': True, 'complaint': stat})


@app.route('/api/order/email', methods=['POST'])
def send_order_email_route():
    """Endpoint to dispatch or resend an order receipt to email (default moornafea@gmail.com)."""
    data = request.get_json(force=True, silent=True) or {}
    order_id = data.get('order_id')
    email = data.get('email', 'moornafea@gmail.com')
    if not order_id:
        return jsonify({'success': False, 'error': "Order ID is required."}), 400

    order = agent_tools.get_order_status(int(order_id))
    if not order:
        return jsonify({'success': False, 'error': f"Order #{order_id} was not found."}), 404

    res = email_service.send_order_email(order, recipient=email)
    return jsonify(res)


@app.route('/api/duration/parse', methods=['POST'])
def parse_duration_api():
    """Utility endpoint to test duration parsing and validation."""
    data = request.get_json(force=True, silent=True) or {}
    text = data.get('text', '')
    res = agent_tools.parse_duration(text)
    return jsonify(res)


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    conn = database.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as cnt FROM products")
    p_cnt = cur.fetchone()['cnt']
    cur.execute("SELECT COUNT(*) as cnt FROM orders")
    o_cnt = cur.fetchone()['cnt']
    conn.close()
    return jsonify({
        'status': 'healthy',
        'database': 'connected',
        'products_count': p_cnt,
        'orders_count': o_cnt,
        'dataset_file': database.EXCEL_PATH
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting Smart Market AI Voice Shopping Agent on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
