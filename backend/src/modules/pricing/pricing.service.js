/**
 * Cyborg Supermarket - Central Pricing Engine & Coupon Management Service
 * Enforces authoritative pricing, branch-specific price lists, quantity promotions,
 * coupon validation, and exact 14% Egyptian VAT calculation.
 */

const db = require('../../database/db');
const { retailOpsService } = require('../retail-ops/retail-ops.service');

class PricingService {
  getEffectivePrice(productId, storeId = 1) {
    // 1. Check for active store-specific price override
    const override = db.queryOne(
      `SELECT override_price FROM price_lists 
       WHERE product_id = ? AND store_id = ? 
         AND date('now') >= date(effective_from)
         AND (effective_to IS NULL OR date('now') <= date(effective_to))
       ORDER BY id DESC LIMIT 1`,
      [productId, storeId]
    );

    if (override && override.override_price !== null) {
      return Number(Number(override.override_price).toFixed(2));
    }

    // 2. Fall back to base catalog price
    const product = db.queryOne('SELECT price FROM products WHERE id = ?', [productId]);
    if (!product) throw new Error(`Product ${productId} not found in catalog`);
    return Number(Number(product.price).toFixed(2));
  }

  setStorePriceOverride(productId, storeId, overridePrice, effectiveFrom = null, effectiveTo = null) {
    db.run(
      `INSERT INTO price_lists (store_id, product_id, override_price, effective_from, effective_to)
       VALUES (?, ?, ?, COALESCE(?, datetime('now')), ?)`,
      [storeId, productId, overridePrice, effectiveFrom, effectiveTo]
    );
    return { productId, storeId, overridePrice, effectiveFrom: effectiveFrom || new Date().toISOString() };
  }

  validateCoupon({ code, userId = null, subtotal, loyaltyTier = 'BRONZE' }) {
    if (!code) return { valid: false, reason: 'No coupon code provided' };

    const coupon = db.queryOne(
      `SELECT * FROM coupons 
       WHERE code = ? AND is_active = 1
         AND date('now') BETWEEN date(starts_at) AND date(expires_at)`,
      [code.toUpperCase()]
    );

    if (!coupon) {
      return { valid: false, reason: 'Coupon code is invalid or expired' };
    }

    if (coupon.current_uses >= coupon.max_uses) {
      return { valid: false, reason: 'Coupon usage limit has been reached' };
    }

    if (subtotal < Number(coupon.min_order_amount)) {
      return {
        valid: false,
        reason: `Order subtotal must be at least ${coupon.min_order_amount} EGP to use this coupon`
      };
    }

    if (coupon.eligible_tier && coupon.eligible_tier !== loyaltyTier) {
      return {
        valid: false,
        reason: `Coupon is exclusive to ${coupon.eligible_tier} loyalty tier members`
      };
    }

    let calculatedDiscount = 0;
    if (coupon.coupon_type === 'PERCENTAGE') {
      calculatedDiscount = (subtotal * Number(coupon.discount_value)) / 100.0;
    } else if (coupon.coupon_type === 'FIXED_AMOUNT') {
      calculatedDiscount = Number(coupon.discount_value);
    } else if (coupon.coupon_type === 'FREE_SHIPPING') {
      calculatedDiscount = Number(coupon.discount_value); // typically 15-25 EGP
    }

    calculatedDiscount = Math.min(calculatedDiscount, subtotal);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.coupon_type,
        discountValue: Number(coupon.discount_value),
        calculatedDiscount: Number(calculatedDiscount.toFixed(2))
      }
    };
  }

  applyCoupon({ code, userId, orderId, subtotal }) {
    const val = this.validateCoupon({ code, userId, subtotal });
    if (!val.valid) {
      throw new Error(val.reason);
    }

    db.run(
      `INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
       VALUES (?, ?, ?, ?)`,
      [val.coupon.id, userId || 'GUEST', orderId, val.coupon.calculatedDiscount]
    );

    db.run('UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?', [val.coupon.id]);

    return {
      couponCode: code,
      discountApplied: val.coupon.calculatedDiscount
    };
  }

  calculateOrderTotal({ items, storeId = 1, couponCode = null, userId = null, loyaltyTier = 'BRONZE' }) {
    let rawSubtotal = 0;
    const pricedItems = [];

    for (const item of items) {
      const unitPrice = this.getEffectivePrice(item.product_id, storeId);
      const subtotal = Number((unitPrice * item.quantity).toFixed(2));
      rawSubtotal += subtotal;

      const product = db.queryOne('SELECT name_en, name_ar, barcode FROM products WHERE id = ?', [item.product_id]);
      pricedItems.push({
        product_id: item.product_id,
        name_en: product ? product.name_en : 'Product',
        name_ar: product ? product.name_ar : 'منتج',
        barcode: product ? product.barcode : '',
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal
      });
    }

    rawSubtotal = Number(rawSubtotal.toFixed(2));

    // 1. Promotional Discounts (Volume / Cart value promotions)
    const promoResult = retailOpsService.applyPromotions(pricedItems, rawSubtotal);
    const promoDiscount = promoResult.discountAmount || 0;

    // 2. Coupon Discount
    let couponDiscount = 0;
    let couponInfo = null;
    if (couponCode) {
      const couponVal = this.validateCoupon({
        code: couponCode,
        userId,
        subtotal: rawSubtotal - promoDiscount,
        loyaltyTier
      });
      if (couponVal.valid) {
        couponDiscount = couponVal.coupon.calculatedDiscount;
        couponInfo = couponVal.coupon;
      }
    }

    const totalDiscounts = Number((promoDiscount + couponDiscount).toFixed(2));
    const discountedSubtotal = Math.max(0, rawSubtotal - totalDiscounts);

    // 3. Egyptian VAT 14% applied to discounted subtotal
    const taxAmount = Number((discountedSubtotal * 0.14).toFixed(2));
    const totalAmount = Number((discountedSubtotal + taxAmount).toFixed(2));

    return {
      storeId,
      rawSubtotal,
      promoDiscount,
      couponDiscount,
      totalDiscounts,
      discountedSubtotal,
      taxAmount,
      taxRate: '14%',
      totalAmount,
      appliedPromotion: promoResult.appliedPromotion,
      appliedCoupon: couponInfo,
      items: pricedItems
    };
  }
}

const pricingService = new PricingService();
module.exports = { pricingService, PricingService };
