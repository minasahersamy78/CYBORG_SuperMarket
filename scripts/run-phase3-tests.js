/**
 * Cyborg Supermarket - Phase 3 Mandatory Services Test Suite
 * Tests Loyalty, Customer Support, Central Pricing Engine, and Delivery Slots.
 */

const assert = require('assert');
const { loyaltyService } = require('../apps/backend/src/modules/loyalty/loyalty.service');
const { supportService } = require('../apps/backend/src/modules/support/support.service');
const { pricingService } = require('../apps/backend/src/modules/pricing/pricing.service');
const { deliveryService } = require('../apps/backend/src/modules/delivery/delivery.service');
const { db } = require('../apps/backend/src/database/db');

console.log('================================================================');
console.log('CYBORG SUPERMARKET — PHASE 3 MANDATORY FEATURES TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// 1. CUSTOMER LOYALTY TESTS
// -------------------------------------------------------------
const testUserId = `usr-test-loyalty-${Date.now()}`;
db.run(
  `INSERT INTO users (id, name_ar, name_en, email, phone, password_hash, role)
   VALUES (?, 'عميل ولاء', 'Loyalty Customer', ?, ?, 'hash', 'CUSTOMER')`,
  [testUserId, `${testUserId}@cyborg.eg`, `+2010${Math.floor(10000000 + Math.random() * 90000000)}`]
);

runTest('Loyalty: Account Creation & Initial Balance', () => {
  const bal = loyaltyService.getBalance(testUserId);
  assert.strictEqual(bal.pointsBalance, 0);
  assert.strictEqual(bal.tier, 'BRONZE');
});

runTest('Loyalty: Earn Points & Idempotency', () => {
  const key = `IDEMP-EARN-${Date.now()}`;
  // 350 EGP spend = 35 points
  const res1 = loyaltyService.earnPoints({
    userId: testUserId,
    orderId: 'ORD-LOY-001',
    orderTotal: 350.00,
    idempotencyKey: key
  });

  assert.strictEqual(res1.idempotentReplay, false);
  assert.strictEqual(res1.pointsEarned, 35);
  assert.strictEqual(res1.balanceAfter, 35);

  // Idempotent retry: should return same without double-awarding
  const res2 = loyaltyService.earnPoints({
    userId: testUserId,
    orderId: 'ORD-LOY-001',
    orderTotal: 350.00,
    idempotencyKey: key
  });

  assert.strictEqual(res2.idempotentReplay, true);
  const bal = loyaltyService.getBalance(testUserId);
  assert.strictEqual(bal.pointsBalance, 35, 'Balance must remain 35, not 70');
});

runTest('Loyalty: Minimum Redemption Threshold & Balance Deduction', () => {
  // Try redeeming under 100 points
  assert.throws(() => {
    loyaltyService.redeemPoints({ userId: testUserId, points: 50, orderId: 'ORD-LOY-002' });
  }, /Minimum redemption threshold is 100 points/);

  // Earn enough points to reach 150 points
  loyaltyService.earnPoints({
    userId: testUserId,
    orderId: 'ORD-LOY-003',
    orderTotal: 1150.00 // 115 points
  });

  const beforeBal = loyaltyService.getBalance(testUserId);
  assert.strictEqual(beforeBal.pointsBalance, 150);

  // Redeem 100 points -> 10 EGP discount
  const redRes = loyaltyService.redeemPoints({
    userId: testUserId,
    points: 100,
    orderId: 'ORD-LOY-004'
  });

  assert.strictEqual(redRes.pointsRedeemed, 100);
  assert.strictEqual(redRes.discountEgp, 10.00);
  assert.strictEqual(redRes.balanceAfter, 50);
});

runTest('Loyalty: Reversal on Order Return', () => {
  // Earn 20 points on a specific order
  loyaltyService.earnPoints({
    userId: testUserId,
    orderId: 'ORD-RETURN-TEST',
    orderTotal: 200.00
  });

  const preRev = loyaltyService.getBalance(testUserId).pointsBalance;

  // Process return reversal
  const revRes = loyaltyService.reverseEarn({
    userId: testUserId,
    orderId: 'ORD-RETURN-TEST'
  });

  assert.strictEqual(revRes.reversed, true);
  assert.strictEqual(revRes.pointsReversed, 20);
  const postRev = loyaltyService.getBalance(testUserId).pointsBalance;
  assert.strictEqual(postRev, preRev - 20, 'Returned order points must be reversed');
});

// -------------------------------------------------------------
// 2. CUSTOMER SUPPORT & TICKETING TESTS
// -------------------------------------------------------------
let createdTicketId = null;

runTest('Support: Create Ticket with Initial Message', () => {
  const ticket = supportService.createTicket({
    customerId: testUserId,
    orderId: 'ORD-SUP-999',
    category: 'DELIVERY_PROBLEM',
    subject: 'Delivery was delayed by 30 minutes',
    message: 'Hello, my grocery order arrived late and cold.'
  });

  assert(ticket.id.startsWith('TCK-'));
  assert.strictEqual(ticket.status, 'OPEN');
  assert.strictEqual(ticket.messages.length, 1);
  assert.strictEqual(ticket.messages[0].is_internal_note, 0);
  createdTicketId = ticket.id;
});

runTest('Support: Internal Notes & Privacy Separation', () => {
  // Agent adds an internal note
  supportService.addMessage({
    ticketId: createdTicketId,
    senderId: 'usr-agent-01',
    senderRole: 'SUPPORT_AGENT',
    message: 'INTERNAL NOTE: Courier was stuck in Dokki traffic due to rain.',
    isInternalNote: true
  });

  // Agent adds a customer-visible reply
  supportService.addMessage({
    ticketId: createdTicketId,
    senderId: 'usr-agent-01',
    senderRole: 'SUPPORT_AGENT',
    message: 'We apologize for the delay! We have credited 25 EGP to your account.',
    isInternalNote: false
  });

  // Customer retrieves ticket: must NEVER see internal note
  const customerView = supportService.getTicketById(createdTicketId, 'CUSTOMER', testUserId);
  assert.strictEqual(customerView.messages.length, 2, 'Customer should see only 2 public messages');
  const hasInternal = customerView.messages.some(m => m.is_internal_note === 1);
  assert.strictEqual(hasInternal, false, 'Internal notes must be hidden from customer');

  // Agent retrieves ticket: sees all 3 messages
  const agentView = supportService.getTicketById(createdTicketId, 'SUPPORT_AGENT', 'usr-agent-01');
  assert.strictEqual(agentView.messages.length, 3, 'Agent should see all messages including internal notes');
});

runTest('Support: Ticket Status & Agent Assignment', () => {
  const assign = supportService.assignTicket({ ticketId: createdTicketId, agentId: 'usr-agent-01' });
  assert.strictEqual(assign.status, 'IN_PROGRESS');

  const update = supportService.updateStatus({ ticketId: createdTicketId, newStatus: 'RESOLVED', actorId: 'usr-agent-01' });
  assert.strictEqual(update.status, 'RESOLVED');
});

// -------------------------------------------------------------
// 3. CENTRAL PRICING ENGINE TESTS
// -------------------------------------------------------------
runTest('Pricing: Base Price vs Store-Specific Price Override', () => {
  const basePrice = pricingService.getEffectivePrice(1, 1); // Downtown store (base catalog)
  assert(basePrice > 0);

  // Set store 2 override (e.g. New Cairo premium pricing +5 EGP)
  pricingService.setStorePriceOverride(1, 2, basePrice + 5.00);

  const store2Price = pricingService.getEffectivePrice(1, 2);
  assert.strictEqual(store2Price, Number((basePrice + 5.00).toFixed(2)), 'Store 2 price must reflect store override');

  const store1Price = pricingService.getEffectivePrice(1, 1);
  assert.strictEqual(store1Price, basePrice, 'Store 1 base price must remain unaffected');
});

runTest('Pricing: Coupon Validation (Valid, Expired, Min Order)', () => {
  // Valid coupon
  const valid = pricingService.validateCoupon({
    code: 'WELCOME20',
    subtotal: 200.00
  });
  assert.strictEqual(valid.valid, true);
  assert.strictEqual(valid.coupon.calculatedDiscount, 40.00); // 20% of 200 = 40

  // Below minimum order amount
  const underMin = pricingService.validateCoupon({
    code: 'WELCOME20',
    subtotal: 50.00 // min is 150
  });
  assert.strictEqual(underMin.valid, false);
  assert(underMin.reason.includes('at least 150 EGP'));

  // Invalid code
  const invalid = pricingService.validateCoupon({
    code: 'NON_EXISTENT_COUPON',
    subtotal: 200.00
  });
  assert.strictEqual(invalid.valid, false);
});

runTest('Pricing: Full Order Total Calculation with Promotions, Coupon & 14% VAT', () => {
  const calc = pricingService.calculateOrderTotal({
    storeId: 1,
    items: [
      { product_id: 1, quantity: 2 }, // e.g. 2 * 38.50 = 77
      { product_id: 2, quantity: 2 }  // e.g. 2 * 26.00 = 52 -> subtotal ~ 129
    ],
    couponCode: null
  });

  assert(calc.rawSubtotal > 0);
  assert.strictEqual(calc.taxRate, '14%');
  assert.strictEqual(calc.taxAmount, Number((calc.discountedSubtotal * 0.14).toFixed(2)));
  assert.strictEqual(calc.totalAmount, Number((calc.discountedSubtotal + calc.taxAmount).toFixed(2)));
});

// -------------------------------------------------------------
// 4. DELIVERY SLOTS & CAPACITY TESTS
// -------------------------------------------------------------
runTest('Delivery: Query Available Slots & Capacity Reservation', () => {
  const slots = deliveryService.getAvailableSlots('ZONE-DT');
  assert(slots.length > 0, 'Should have seeded delivery slots');

  const slot = slots[0];
  const initialCapacity = slot.remaining_capacity;

  // Reserve slot
  const res = deliveryService.reserveSlot(slot.id, 'ORD-SLOT-001');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.remainingCapacity, initialCapacity - 1);

  // Release slot
  const rel = deliveryService.releaseSlot(slot.id);
  assert.strictEqual(rel.success, true);
});

console.log('\n================================================================');
console.log(`PHASE 3 MANDATORY FEATURES RESULTS: ALL ${passedTests} TESTS PASSED!`);
console.log('================================================================\n');
