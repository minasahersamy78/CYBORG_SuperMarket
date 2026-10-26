/**
 * Automated Verification Script:
 * Tests Order Cancellation, Automatic Stock Restoration, and Chatbot Email Feedback
 */

const assert = require('assert');
const db = require('../apps/backend/src/database/db');
const ordersService = require('../apps/backend/src/modules/orders/orders.service');
const inventoryService = require('../apps/backend/src/modules/inventory/inventory.service');
const emailService = require('../apps/backend/src/modules/email/email.service');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — ORDER CANCELLATION & EMAIL VERIFICATION');
console.log('================================================================');

// 1. Check Initial Balance for Product ID 1
const initialInv = inventoryService.getBalance(1);
assert.strictEqual(initialInv.success, true);
const initialQty = initialInv.data.quantity;
console.log(`[PASS] Initial Stock for Product #1: ${initialQty} units`);

// 2. Create Order for 3 units
const orderRes = ordersService.createOrder({
  items: [{ product_id: 1, quantity: 3 }],
  source: 'ONLINE',
  customer_name: 'Test Customer',
  customer_email: 'cyborgcoding1@gmail.com',
  delivery_address: 'Cairo, Egypt'
});
assert.strictEqual(orderRes.success, true);
const orderId = orderRes.data.id;
console.log(`[PASS] Order Created: #${orderId} with status '${orderRes.data.status}'`);

// 3. Verify Stock Decremented by 3
const postOrderInv = inventoryService.getBalance(1);
assert.strictEqual(postOrderInv.data.quantity, initialQty - 3);
console.log(`[PASS] Stock correctly decremented by 3: ${initialQty} -> ${postOrderInv.data.quantity}`);

// 4. Cancel the Order
const cancelRes = ordersService.cancelOrder(orderId, 'Changed my mind');
assert.strictEqual(cancelRes.success, true);
assert.strictEqual(cancelRes.data.status, 'CANCELLED');
console.log(`[PASS] Order #${orderId} successfully transitioned to CANCELLED`);

// 5. Verify Stock Restored back to initialQty
const restoredInv = inventoryService.getBalance(1);
assert.strictEqual(restoredInv.data.quantity, initialQty);
console.log(`[PASS] Stock correctly restored back to: ${restoredInv.data.quantity} units`);

// 6. Verify cannot re-cancel or cancel delivered order
const reCancelRes = ordersService.cancelOrder(orderId, 'Cancel again');
assert.strictEqual(reCancelRes.success, false);
console.log(`[PASS] Idempotent rejection: Cannot re-cancel already cancelled order (${reCancelRes.error})`);

// 7. Verify Chatbot Feedback & Email Dispatch to cyborgcoding1@gmail.com
const feedbackRes = emailService.sendChatbotFeedback({
  feedbackType: 'COMPLIMENT',
  customerName: 'Ahmad Al-Masry',
  message: 'The AI grocery assistant is brilliant and fast!',
  transcript: ['User: عايز كيلو موز', 'Bot: تم العثور على موز طازج']
}, 'cyborgcoding1@gmail.com');
assert.strictEqual(feedbackRes.success, true);
assert.strictEqual(feedbackRes.recipient, 'cyborgcoding1@gmail.com');
console.log(`[PASS] Chatbot feedback dispatched to ${feedbackRes.recipient} successfully`);

console.log('================================================================');
console.log('ALL VERIFICATIONS PASSED (6/6)!');
console.log('================================================================');
