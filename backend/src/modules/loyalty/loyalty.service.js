/**
 * Cyborg Supermarket - Customer Loyalty Program Service
 * Manages points ledger, tier progression, redemption rules, and reversal on returns.
 */

const db = require('../../database/db');

class LoyaltyService {
  getOrCreateAccount(userId) {
    let account = db.queryOne('SELECT * FROM loyalty_accounts WHERE user_id = ?', [userId]);
    if (!account) {
      db.run(
        `INSERT INTO loyalty_accounts (user_id, points_balance, lifetime_points, tier)
         VALUES (?, 0, 0, 'BRONZE')`,
        [userId]
      );
      account = db.queryOne('SELECT * FROM loyalty_accounts WHERE user_id = ?', [userId]);
    }
    return account;
  }

  getBalance(userId) {
    const account = this.getOrCreateAccount(userId);
    return {
      userId,
      pointsBalance: account.points_balance,
      lifetimePoints: account.lifetime_points,
      tier: account.tier,
      tierBenefits: this.getTierBenefits(account.tier)
    };
  }

  getTierBenefits(tier) {
    switch (tier) {
      case 'PLATINUM':
        return { discountPercent: 10, freeDelivery: true, earnMultiplier: 2.0 };
      case 'GOLD':
        return { discountPercent: 5, freeDelivery: true, earnMultiplier: 1.5 };
      case 'SILVER':
        return { discountPercent: 2.5, freeDelivery: false, earnMultiplier: 1.2 };
      default:
        return { discountPercent: 0, freeDelivery: false, earnMultiplier: 1.0 };
    }
  }

  earnPoints({ userId, orderId, orderTotal, idempotencyKey }) {
    if (idempotencyKey) {
      const existing = db.queryOne('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?', [idempotencyKey]);
      if (existing) {
        return { idempotentReplay: true, transaction: existing };
      }
    }

    const account = this.getOrCreateAccount(userId);
    const multiplier = this.getTierBenefits(account.tier).earnMultiplier;
    // 1 point per 10 EGP spent
    const basePoints = Math.floor(Number(orderTotal) / 10);
    const pointsToEarn = Math.floor(basePoints * multiplier);

    if (pointsToEarn <= 0) {
      return { pointsEarned: 0, balanceAfter: account.points_balance };
    }

    const newBalance = account.points_balance + pointsToEarn;
    const newLifetime = account.lifetime_points + pointsToEarn;

    db.run(
      'UPDATE loyalty_accounts SET points_balance = ?, lifetime_points = ? WHERE id = ?',
      [newBalance, newLifetime, account.id]
    );

    db.run(
      `INSERT INTO loyalty_transactions (account_id, order_id, transaction_type, points, balance_after, description, idempotency_key)
       VALUES (?, ?, 'EARN', ?, ?, ?, ?)`,
      [account.id, orderId || null, pointsToEarn, newBalance, `Points earned for order ${orderId || 'POS'}`, idempotencyKey || null]
    );

    this.updateTier(userId);

    return {
      idempotentReplay: false,
      pointsEarned: pointsToEarn,
      balanceAfter: newBalance,
      currentTier: this.getOrCreateAccount(userId).tier
    };
  }

  redeemPoints({ userId, points, orderId, idempotencyKey }) {
    if (idempotencyKey) {
      const existing = db.queryOne('SELECT * FROM loyalty_transactions WHERE idempotency_key = ?', [idempotencyKey]);
      if (existing) {
        return { idempotentReplay: true, transaction: existing };
      }
    }

    const account = this.getOrCreateAccount(userId);
    const pts = parseInt(points, 10);

    if (pts < 100) {
      throw new Error('Minimum redemption threshold is 100 points');
    }

    if (account.points_balance < pts) {
      throw new Error(`Insufficient points balance: requested ${pts}, available ${account.points_balance}`);
    }

    const newBalance = account.points_balance - pts;
    const discountEgp = (pts / 100) * 10; // 100 points = 10 EGP discount

    db.run('UPDATE loyalty_accounts SET points_balance = ? WHERE id = ?', [newBalance, account.id]);

    db.run(
      `INSERT INTO loyalty_transactions (account_id, order_id, transaction_type, points, balance_after, description, idempotency_key)
       VALUES (?, ?, 'REDEEM', ?, ?, ?, ?)`,
      [account.id, orderId || null, -pts, newBalance, `Redeemed ${pts} pts for ${discountEgp} EGP discount on order ${orderId}`, idempotencyKey || null]
    );

    return {
      idempotentReplay: false,
      pointsRedeemed: pts,
      discountEgp,
      balanceAfter: newBalance
    };
  }

  reverseEarn({ userId, orderId }) {
    const account = this.getOrCreateAccount(userId);
    const originalEarn = db.queryOne(
      `SELECT * FROM loyalty_transactions WHERE account_id = ? AND order_id = ? AND transaction_type = 'EARN'`,
      [account.id, orderId]
    );

    if (!originalEarn) {
      return { reversed: false, reason: 'No earn transaction found for this order' };
    }

    const pointsToReverse = originalEarn.points;
    const newBalance = Math.max(0, account.points_balance - pointsToReverse);
    const newLifetime = Math.max(0, account.lifetime_points - pointsToReverse);

    db.run('UPDATE loyalty_accounts SET points_balance = ?, lifetime_points = ? WHERE id = ?', [newBalance, newLifetime, account.id]);

    db.run(
      `INSERT INTO loyalty_transactions (account_id, order_id, transaction_type, points, balance_after, description)
       VALUES (?, ?, 'REVERSE_EARN', ?, ?, ?)`,
      [account.id, orderId, -pointsToReverse, newBalance, `Reversed ${pointsToReverse} points due to return/refund of order ${orderId}`]
    );

    this.updateTier(userId);

    return {
      reversed: true,
      pointsReversed: pointsToReverse,
      balanceAfter: newBalance
    };
  }

  updateTier(userId) {
    const account = db.queryOne('SELECT * FROM loyalty_accounts WHERE user_id = ?', [userId]);
    if (!account) return;

    let targetTier = 'BRONZE';
    const lp = account.lifetime_points;
    if (lp >= 5000) targetTier = 'PLATINUM';
    else if (lp >= 2000) targetTier = 'GOLD';
    else if (lp >= 500) targetTier = 'SILVER';

    if (account.tier !== targetTier) {
      db.run('UPDATE loyalty_accounts SET tier = ? WHERE id = ?', [targetTier, account.id]);
    }
  }

  getTransactionHistory(userId, limit = 50) {
    const account = this.getOrCreateAccount(userId);
    return db.query(
      `SELECT * FROM loyalty_transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT ?`,
      [account.id, limit]
    );
  }
}

const loyaltyService = new LoyaltyService();
module.exports = { loyaltyService, LoyaltyService };
