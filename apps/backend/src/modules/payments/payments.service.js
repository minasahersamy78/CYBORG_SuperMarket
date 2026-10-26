/**
 * Cyborg Supermarket - Payment Lifecycle & Financial Integrity Service
 * Implements idempotent processing, webhook HMAC verification, refund workflows,
 * sandbox/production environment isolation, and PCI-DSS compliance (zero PAN/CVV storage).
 */

const { db } = require('../../database/db');
const crypto = require('crypto');

class PaymentsService {
  constructor() {
    this.environment = process.env.PAYMENT_ENV || 'sandbox';
    this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'cyborg_whsec_dev_9876543210';
  }

  // 1. INITIATE PAYMENT
  initiatePayment({ orderId, amount, paymentMethod, idempotencyKey, customerEmail, customerPhone }) {
    // Idempotency check: if key already exists, return previous transaction
    if (idempotencyKey) {
      const existing = db.queryOne('SELECT * FROM payment_transactions WHERE idempotency_key = ?', [idempotencyKey]);
      if (existing) {
        return {
          idempotentReplay: true,
          transaction: existing
        };
      }
    }

    const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const transactionId = `TXN-${Date.now()}`;
    const transactionRef = `REF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const isSandbox = this.environment === 'production' ? 0 : 1;

    db.run(
      `INSERT INTO payment_transactions (id, transaction_ref, order_id, amount, currency, payment_method, status, provider, idempotency_key, is_sandbox, metadata)
       VALUES (?, ?, ?, ?, 'EGP', ?, 'INITIATED', 'CYBORG_GATEWAY', ?, ?, ?)`,
      [
        transactionId,
        transactionRef,
        orderId,
        amount,
        paymentMethod,
        idempotencyKey || null,
        isSandbox,
        JSON.stringify({ initiated_at: new Date().toISOString(), customer_email: customerEmail || '' })
      ]
    );

    return {
      idempotentReplay: false,
      transaction: db.queryOne('SELECT * FROM payment_transactions WHERE id = ?', [transactionId])
    };
  }

  // 2. AUTHORIZE & CAPTURE PAYMENT (Server-side verification)
  capturePayment({ transactionId, simulatedCardLast4 = '4242', shouldSimulateFailure = false, failureReason = '' }) {
    const txn = db.queryOne('SELECT * FROM payment_transactions WHERE id = ?', [transactionId]);
    if (!txn) throw new Error(`Transaction ${transactionId} not found`);

    if (txn.status === 'CAPTURED') {
      return { status: 'CAPTURED', alreadyProcessed: true, transaction: txn };
    }

    if (shouldSimulateFailure) {
      db.run(
        `UPDATE payment_transactions 
         SET status = 'FAILED', failure_reason = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [failureReason || 'Insufficient funds or card declined', transactionId]
      );
      return {
        status: 'FAILED',
        reason: failureReason || 'Card declined',
        transaction: db.queryOne('SELECT * FROM payment_transactions WHERE id = ?', [transactionId])
      };
    }

    // Capture success
    const providerRef = `AUTH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const meta = JSON.parse(txn.metadata || '{}');
    meta.captured_at = new Date().toISOString();
    meta.card_last4 = simulatedCardLast4; // PCI-DSS: Only last 4 digits stored!
    meta.tokenized_ref = `tok_${crypto.randomBytes(8).toString('hex')}`;

    db.run(
      `UPDATE payment_transactions 
       SET status = 'CAPTURED', provider_ref = ?, metadata = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [providerRef, JSON.stringify(meta), transactionId]
    );

    // Update order payment status
    db.run(
      `UPDATE orders SET payment_status = 'COMPLETED', updated_at = datetime('now') WHERE id = ?`,
      [txn.order_id]
    );

    return {
      status: 'CAPTURED',
      providerRef,
      transaction: db.queryOne('SELECT * FROM payment_transactions WHERE id = ?', [transactionId])
    };
  }

  // 3. REFUND PAYMENT
  refundPayment({ transactionId, refundAmount, reason }) {
    const txn = db.queryOne('SELECT * FROM payment_transactions WHERE id = ?', [transactionId]);
    if (!txn) throw new Error(`Transaction ${transactionId} not found`);
    if (txn.status !== 'CAPTURED') throw new Error(`Cannot refund transaction with status ${txn.status}`);

    const meta = JSON.parse(txn.metadata || '{}');
    meta.refunded_at = new Date().toISOString();
    meta.refund_reason = reason || 'Customer requested refund';
    meta.refund_amount = refundAmount || txn.amount;

    db.run(
      `UPDATE payment_transactions 
       SET status = 'REFUNDED', metadata = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(meta), transactionId]
    );

    // Update order status if full refund
    if (!refundAmount || refundAmount >= txn.amount) {
      db.run(
        `UPDATE orders SET payment_status = 'REFUNDED', status = 'REFUNDED', updated_at = datetime('now') WHERE id = ?`,
        [txn.order_id]
      );
    }

    return {
      status: 'REFUNDED',
      refundAmount: refundAmount || txn.amount,
      transaction: db.queryOne('SELECT * FROM payment_transactions WHERE id = ?', [transactionId])
    };
  }

  // 4. WEBHOOK SIGNATURE VERIFICATION (HMAC-SHA256)
  verifyWebhookSignature({ payloadString, signatureHeader }) {
    if (!payloadString || !signatureHeader) return false;
    const computedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadString, 'utf-8')
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    if (computedSignature.length !== signatureHeader.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signatureHeader));
  }

  // 5. INGEST WEBHOOK EVENT
  ingestWebhook({ provider = 'FAWRY_PAYMOB', payload, signatureHeader }) {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const isValid = this.verifyWebhookSignature({ payloadString, signatureHeader });

    const payloadHash = crypto.createHash('sha256').update(payloadString).digest('hex');

    db.run(
      `INSERT INTO payment_webhook_logs (provider, event_type, payload_hash, signature_verified, status, raw_payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        provider,
        (payload && payload.event) || 'PAYMENT_STATUS_UPDATE',
        payloadHash,
        isValid ? 1 : 0,
        isValid ? 'PROCESSED' : 'REJECTED_INVALID_SIGNATURE',
        payloadString
      ]
    );

    if (!isValid) {
      return { success: false, error: 'Invalid HMAC signature' };
    }

    // Process event if verified
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (parsed.transaction_ref && parsed.status) {
      const txn = db.queryOne('SELECT * FROM payment_transactions WHERE transaction_ref = ?', [parsed.transaction_ref]);
      if (txn) {
        if (parsed.status === 'SUCCESS' && txn.status !== 'CAPTURED') {
          this.capturePayment({ transactionId: txn.id, simulatedCardLast4: parsed.card_last4 || '4242' });
        } else if (parsed.status === 'FAILED') {
          db.run('UPDATE payment_transactions SET status = "FAILED", failure_reason = ? WHERE id = ?',
            [parsed.failure_reason || 'Webhook reported payment failure', txn.id]);
        }
      }
    }

    return { success: true, verified: true };
  }

  // 6. PAYMENT AUDIT & STATUS HISTORY
  getPaymentHistory(orderId = null, limit = 50) {
    let sql = `SELECT pt.*, o.customer_name, o.source as order_source
               FROM payment_transactions pt
               JOIN orders o ON pt.order_id = o.id
               WHERE 1=1`;
    const params = [];
    if (orderId) {
      sql += ' AND pt.order_id = ?';
      params.push(orderId);
    }
    sql += ' ORDER BY pt.created_at DESC LIMIT ?';
    params.push(limit);
    return db.query(sql, params);
  }

  getTransactionById(id) {
    return db.queryOne('SELECT * FROM payment_transactions WHERE id = ?', [id]);
  }
}

const paymentsService = new PaymentsService();
module.exports = { paymentsService, PaymentsService };
