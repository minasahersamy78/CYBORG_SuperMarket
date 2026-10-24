/**
 * Cyborg Supermarket - Cart & Family Shared Cart Service
 * Implements Multi-Member Family Cart & Spend Limit Rules
 */

const crypto = require('crypto');
const db = require('../../database/db');

const cartService = {
  getOrCreateCart(cartId, userId = null, isFamily = false, budgetLimit = null) {
    let cart = null;
    if (cartId) {
      cart = db.getOne('SELECT * FROM carts WHERE id = ? LIMIT 1;', [cartId]);
    } else if (userId) {
      cart = db.getOne('SELECT * FROM carts WHERE user_id = ? AND is_family_cart = ? LIMIT 1;', [userId, isFamily ? 1 : 0]);
    }

    if (!cart) {
      const newId = 'cart-' + crypto.randomUUID().substring(0, 8);
      db.run(
        'INSERT INTO carts (id, user_id, is_family_cart, budget_limit, updated_at) VALUES (?, ?, ?, ?, datetime("now"));',
        [newId, userId, isFamily ? 1 : 0, budgetLimit || (isFamily ? 2000.00 : null)]
      );
      cart = db.getOne('SELECT * FROM carts WHERE id = ?;', [newId]);
    }

    return this.getCartDetails(cart.id);
  },

  getCartDetails(cartId) {
    const cart = db.getOne('SELECT * FROM carts WHERE id = ? LIMIT 1;', [cartId]);
    if (!cart) return { success: false, statusCode: 404, error: 'Cart not found' };

    const items = db.query(`
      SELECT
        ci.id as cart_item_id, ci.cart_id, ci.product_id, ci.quantity, ci.unit_price,
        (ci.quantity * ci.unit_price) as total_price,
        p.name_en, p.name_ar, p.barcode, p.image_url
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ?;
    `, [cartId]);

    let subtotal = 0;
    items.forEach(it => {
      subtotal += parseFloat(it.total_price);
    });

    subtotal = parseFloat(subtotal.toFixed(2));
    const tax = parseFloat((subtotal * 0.14).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    const familyMembers = cart.is_family_cart ? db.query('SELECT * FROM family_members WHERE cart_id = ?;', [cartId]) : [];

    return {
      success: true,
      statusCode: 200,
      data: {
        id: cart.id,
        user_id: cart.user_id,
        is_family_cart: Boolean(cart.is_family_cart),
        budget_limit: cart.budget_limit ? parseFloat(cart.budget_limit) : null,
        items,
        subtotal,
        tax,
        total,
        family_members: familyMembers,
        updated_at: cart.updated_at
      }
    };
  },

  addItem(cartId, productId, quantity = 1, memberUserId = null) {
    const cart = db.getOne('SELECT * FROM carts WHERE id = ? LIMIT 1;', [cartId]);
    if (!cart) return { success: false, statusCode: 404, error: 'Cart not found' };

    const product = db.getOne('SELECT id, price, is_active, name_en FROM products WHERE id = ?;', [productId]);
    if (!product || !product.is_active) {
      return { success: false, statusCode: 404, error: 'Product not available' };
    }

    const unitPrice = parseFloat(product.price);
    const itemCost = unitPrice * quantity;

    // Check Family Cart Budget Constraint
    if (cart.is_family_cart && cart.budget_limit) {
      const currentCart = this.getCartDetails(cartId).data;
      if (currentCart.total + itemCost > cart.budget_limit) {
        return {
          success: false,
          statusCode: 400,
          error: `Family cart budget limit exceeded! Current total: ${currentCart.total} EGP, Item: ${itemCost} EGP, Budget limit: ${cart.budget_limit} EGP`
        };
      }
    }

    // Check Member specific spend limit
    if (cart.is_family_cart && memberUserId) {
      const member = db.getOne('SELECT * FROM family_members WHERE cart_id = ? AND user_id = ?;', [cartId, memberUserId]);
      if (member && (member.current_spend + itemCost > member.spend_limit)) {
        return {
          success: false,
          statusCode: 400,
          error: `Member spend limit exceeded! Member limit: ${member.spend_limit} EGP, Current spend: ${member.current_spend} EGP`
        };
      }
    }

    const existingItem = db.getOne('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?;', [cartId, productId]);
    if (existingItem) {
      db.run('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?;', [quantity, existingItem.id]);
    } else {
      db.run('INSERT INTO cart_items (cart_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?);', [cartId, productId, quantity, unitPrice]);
    }

    db.run('UPDATE carts SET updated_at = datetime("now") WHERE id = ?;', [cartId]);

    // Update family member spend if member provided
    if (cart.is_family_cart && memberUserId) {
      db.run('UPDATE family_members SET current_spend = current_spend + ? WHERE cart_id = ? AND user_id = ?;', [itemCost, cartId, memberUserId]);
    }

    return this.getCartDetails(cartId);
  },

  updateItemQuantity(cartId, productId, quantity) {
    if (quantity <= 0) {
      return this.removeItem(cartId, productId);
    }
    db.run('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?;', [quantity, cartId, productId]);
    db.run('UPDATE carts SET updated_at = datetime("now") WHERE id = ?;', [cartId]);
    return this.getCartDetails(cartId);
  },

  removeItem(cartId, productId) {
    db.run('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?;', [cartId, productId]);
    db.run('UPDATE carts SET updated_at = datetime("now") WHERE id = ?;', [cartId]);
    return this.getCartDetails(cartId);
  },

  clearCart(cartId) {
    db.run('DELETE FROM cart_items WHERE cart_id = ?;', [cartId]);
    db.run('UPDATE carts SET updated_at = datetime("now") WHERE id = ?;', [cartId]);
    return this.getCartDetails(cartId);
  }
};

module.exports = cartService;
