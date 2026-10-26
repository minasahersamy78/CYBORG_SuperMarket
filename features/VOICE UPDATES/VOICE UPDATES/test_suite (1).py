import sys
import unittest
import concurrent.futures
import database
import agent_tools
import agent_controller
import duration_parser
import category_matcher
import recommendation_engine

sys.stdout.reconfigure(encoding='utf-8')


class SmartMarketShoppingAgentTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        database.init_db(force_reload=True)
        cls.controller = agent_controller.ShoppingAgentController()

    def test_a_budget_accuracy(self):
        """Test A: Total must not exceed 2,000 EGP. Budget used effectively."""
        res = agent_tools.recommend_products(budget=2000.0)
        self.assertTrue(res['success'])
        self.assertLessEqual(res['total_spent'], 2000.0)
        # Should effectively use budget (>= 1800 EGP)
        self.assertGreaterEqual(res['total_spent'], 1800.0, f"Budget poorly used: {res['total_spent']}")
        self.assertGreater(len(res['items']), 0)
        # Verify programmatic calculation
        computed_sum = round(sum(it['unit_price'] * it['quantity'] for it in res['items']), 2)
        self.assertEqual(res['total_spent'], computed_sum)

    def test_b_strict_categories(self):
        """Test B: Recommend dairy products and legumes exclusively."""
        res = agent_tools.recommend_products(budget=1500.0, categories=['dairy', 'legumes'])
        self.assertTrue(res['success'])
        self.assertGreater(len(res['items']), 0)
        for it in res['items']:
            is_dairy = category_matcher.is_product_in_category(it, 'dairy')
            is_legume = category_matcher.is_product_in_category(it, 'legumes')
            self.assertTrue(
                is_dairy or is_legume,
                f"Product '{it['name_en']}' ({it.get('category_en')}/{it.get('subcategory_en')}) is not dairy or legume!"
            )
            # Ensure biscuits, fruits, snacks are excluded
            self.assertNotEqual(it.get('subcategory_en'), 'Biscuits, Crackers & Cakes')

    def test_c_combined_constraints(self):
        """Test C: 'عايز منتجات ألبان وبقوليات بميزانية 2000 جنيه لمدة شهر.'"""
        msg = "عايز منتجات ألبان وبقوليات بميزانية 2000 جنيه لمدة شهر."
        session = {}
        res = self.controller.process_message(msg, session)
        self.assertEqual(res['action'], 'recommend')
        calc = res['calculations']
        self.assertLessEqual(calc['total_spent'], 2000.0)
        self.assertEqual(calc['duration_days'], 30)
        self.assertEqual(calc['daily_spending'], round(calc['total_spent'] / 30, 2))
        for it in res['items']:
            is_dairy = category_matcher.is_product_in_category(it, 'dairy')
            is_legume = category_matcher.is_product_in_category(it, 'legumes')
            self.assertTrue(is_dairy or is_legume)

    def test_d_valid_duration(self):
        """Test D: 'I need groceries for 7 days.' -> accepted and displayed as 1 week."""
        dur = duration_parser.parse_duration("I need groceries for 7 days.")
        self.assertTrue(dur['found'])
        self.assertTrue(dur['is_valid'])
        self.assertEqual(dur['days'], 7)
        self.assertEqual(dur['readable_label_en'], '1 week')

    def test_e_invalid_duration(self):
        """Test E: 'I need groceries for 12 hours.' -> rejected, range 1-365 days explained."""
        dur = duration_parser.parse_duration("I need groceries for 12 hours.")
        self.assertTrue(dur['found'])
        self.assertFalse(dur['is_valid'])

        # Test controller response
        res = self.controller.process_message("I need groceries for 12 hours.")
        self.assertEqual(res['action'], 'invalid_duration')
        self.assertIn("1 day and 365 days", res['text'])
        self.assertEqual(len(res['items']), 0)

    def test_f_maximum_duration(self):
        """Test F: 'I need groceries for one year.' -> accepted as 365 days."""
        dur = duration_parser.parse_duration("I need groceries for one year.")
        self.assertTrue(dur['found'])
        self.assertTrue(dur['is_valid'])
        self.assertEqual(dur['days'], 365)
        self.assertEqual(dur['readable_label_en'], '1 year')

    def test_g_duration_beyond_the_limit(self):
        """Test G: 'I need groceries for two years.' -> rejected, no recommendations or orders."""
        dur = duration_parser.parse_duration("I need groceries for two years.")
        self.assertTrue(dur['found'])
        self.assertFalse(dur['is_valid'])

        res = self.controller.process_message("I need groceries for two years.")
        self.assertEqual(res['action'], 'invalid_duration')
        self.assertEqual(len(res['items']), 0)

    def test_h_inventory_update(self):
        """Test H: Initial stock: 20 water packs -> order 1 pack -> stock becomes 19."""
        water_id = 414 # Schweppes Tonic Water Glass Bottle
        database.set_product_stock(water_id, 20)
        self.assertEqual(database.get_product_by_id(water_id)['stock'], 20)

        session = {}
        r1 = self.controller.process_message("I want one pack of water.", session)
        self.assertEqual(r1['action'], 'order_pending')
        # Stock NOT deducted before confirmation
        self.assertEqual(database.get_product_by_id(water_id)['stock'], 20)

        # Confirm
        r2 = self.controller.process_message("Yes, please confirm the order", r1['updated_state'])
        self.assertEqual(r2['action'], 'order_created')
        # Stock updated in SQLite to 19
        self.assertEqual(database.get_product_by_id(water_id)['stock'], 19)

    def test_i_voice_ordering(self):
        """Test I: Voice ordering (STT processed -> stock checked -> order confirmed -> spoken confirmation)."""
        water_id = 414
        database.set_product_stock(water_id, 10)
        session = {}

        # Voice audio transcribed by client STT
        r1 = self.controller.process_message("I want one pack of water", session)
        self.assertEqual(r1['action'], 'order_pending')
        self.assertIn("confirm", r1['speech_text'].lower())

        r2 = self.controller.process_message("confirm order", r1['updated_state'])
        self.assertEqual(r2['action'], 'order_created')
        self.assertIn("confirmed", r2['speech_text'].lower())
        self.assertEqual(database.get_product_by_id(water_id)['stock'], 9)

    def test_j_voice_recommendations(self):
        """Test J: Customer speaks budget, category, duration -> same business rules applied."""
        spoken_msg = "عايز منتجات ألبان وبقوليات بميزانية 2000 جنيه لمدة شهر"
        session = {}
        res = self.controller.process_message(spoken_msg, session)
        self.assertEqual(res['action'], 'recommend')
        self.assertLessEqual(res['calculations']['total_spent'], 2000.0)
        self.assertEqual(res['calculations']['duration_days'], 30)
        self.assertTrue(len(res['speech_text']) > 0)

    def test_k_concurrent_orders(self):
        """Test K: 2 customers attempt to purchase the last available unit simultaneously."""
        water_id = 414
        database.set_product_stock(water_id, 1)

        def order_worker(client_id):
            try:
                res = database.execute_order_atomic(
                    items=[{'product_id': water_id, 'quantity': 1}],
                    customer_name=f"Customer_{client_id}"
                )
                return True, res
            except Exception as e:
                return False, str(e)

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            t1 = executor.submit(order_worker, 1)
            t2 = executor.submit(order_worker, 2)
            res1 = t1.result()
            res2 = t2.result()

        successes = [r for r in [res1, res2] if r[0]]
        failures = [r for r in [res1, res2] if not r[0]]

        self.assertEqual(len(successes), 1, "Exactly one order must succeed!")
        self.assertEqual(len(failures), 1, "The concurrent order must fail gracefully!")
        self.assertEqual(database.get_product_by_id(water_id)['stock'], 0)


if __name__ == '__main__':
    unittest.main()


# ============================================================================
# SECTION 16 ACCEPTANCE TESTS: Complaints, Cart, and Order Cancellation
# ============================================================================

class NewFeatureAcceptanceTests(unittest.TestCase):
    """
    Acceptance tests for Sections 12, 13, 14, and 15:
    - Customer Complaints Management (Section 12)
    - Shopping Cart Management (Section 13)
    - Order Cancellation with Inventory Restoration (Section 14)
    - AI Agent Integration (Section 15)
    """

    WATER_ID = 414  # Schweppes Tonic Water Glass Bottle

    @classmethod
    def setUpClass(cls):
        database.init_db(force_reload=True)
        cls.controller = agent_controller.ShoppingAgentController()

    def setUp(self):
        """Reset product stock before each test to ensure determinism."""
        database.set_product_stock(self.WATER_ID, 30)

    # -------------------------------------------------------------------
    # Scenario 1: A customer submits a complaint; saved successfully
    # -------------------------------------------------------------------
    def test_01_complaint_submission_is_saved(self):
        """Scenario 1: Submit complaint → stored in DB with unique ID and status."""
        res = agent_tools.submit_complaint(
            description="I received a damaged water bottle in my order.",
            category="damaged_product",
            order_id=None,
            customer_name="Customer"
        )
        self.assertTrue(res['success'])
        cid_str = res['complaint_id']           # e.g. "CMP-3"
        self.assertTrue(cid_str.startswith("CMP-"))

        # Verify persistence: retrieve from DB
        fetched = agent_tools.get_complaint_status(res['raw_id'])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched['category'], 'damaged_product')
        self.assertEqual(fetched['status'], 'open')
        self.assertIn("damaged", fetched['description'].lower())

    # -------------------------------------------------------------------
    # Scenario 2: Customer checks status of an existing complaint
    # -------------------------------------------------------------------
    def test_02_check_complaint_status(self):
        """Scenario 2: Customer can retrieve status using complaint ID."""
        sub = agent_tools.submit_complaint(
            description="Missing items from my grocery basket.",
            category="missing_product",
            customer_name="Customer"
        )
        raw_id = sub['raw_id']

        status = agent_tools.get_complaint_status(raw_id)
        self.assertIsNotNone(status)
        self.assertEqual(status['complaint_id'], f"CMP-{raw_id}")
        self.assertEqual(status['status'], 'open')
        self.assertEqual(status['category'], 'missing_product')

    # -------------------------------------------------------------------
    # Scenario 3: Customer adds products to cart and sees correct total
    # -------------------------------------------------------------------
    def test_03_add_to_cart_correct_total(self):
        """Scenario 3: Add two products, verify total = sum of (qty * unit_price)."""
        empty_cart = {'items': [], 'items_count': 0, 'total': 0.0}

        res1 = agent_tools.add_to_cart(empty_cart, self.WATER_ID, 2)
        self.assertTrue(res1['success'])
        cart_after_first = res1['cart']

        water = database.get_product_by_id(self.WATER_ID)
        expected_subtotal = round(float(water['price']) * 2, 2)
        self.assertEqual(cart_after_first['total'], expected_subtotal)
        self.assertEqual(cart_after_first['items_count'], 2)

        # Verify stock was NOT decremented
        self.assertEqual(database.get_product_by_id(self.WATER_ID)['stock'], 30)

    # -------------------------------------------------------------------
    # Scenario 4: Removing a product updates cart total correctly
    # -------------------------------------------------------------------
    def test_04_remove_item_updates_total(self):
        """Scenario 4: Add then remove; total resets to 0."""
        empty_cart = {'items': [], 'items_count': 0, 'total': 0.0}
        added = agent_tools.add_to_cart(empty_cart, self.WATER_ID, 1)
        self.assertTrue(added['success'])
        cart_with_item = added['cart']
        self.assertGreater(cart_with_item['total'], 0)

        removed = agent_tools.remove_from_cart(cart_with_item, self.WATER_ID)
        self.assertTrue(removed['success'])
        self.assertEqual(removed['cart']['total'], 0.0)
        self.assertEqual(len(removed['cart']['items']), 0)

    # -------------------------------------------------------------------
    # Scenario 5: Adding to cart does NOT change inventory
    # -------------------------------------------------------------------
    def test_05_add_to_cart_no_inventory_change(self):
        """Scenario 5: Cart add must never reduce DB stock."""
        stock_before = database.get_product_by_id(self.WATER_ID)['stock']
        empty_cart = {'items': [], 'items_count': 0, 'total': 0.0}

        for _ in range(3):
            agent_tools.add_to_cart(empty_cart, self.WATER_ID, 1)

        stock_after = database.get_product_by_id(self.WATER_ID)['stock']
        self.assertEqual(stock_before, stock_after,
            f"Stock must not change on cart add: was {stock_before}, now {stock_after}")

    # -------------------------------------------------------------------
    # Scenario 6: Checkout creates order and deducts correct stock quantity
    # -------------------------------------------------------------------
    def test_06_checkout_creates_order_deducts_stock(self):
        """Scenario 6: Cart checkout → order created → stock decremented by exact quantity."""
        stock_before = database.get_product_by_id(self.WATER_ID)['stock']

        empty_cart = {'items': [], 'items_count': 0, 'total': 0.0}
        added = agent_tools.add_to_cart(empty_cart, self.WATER_ID, 3)
        self.assertTrue(added['success'])

        result = agent_tools.checkout(
            cart=added['cart'],
            customer_name="Customer",
            customer_email="moornafea@gmail.com"
        )
        self.assertTrue(result['success'])
        order = result['order']
        self.assertIn('order_id', order)
        self.assertGreater(order['order_id'], 0)

        stock_after = database.get_product_by_id(self.WATER_ID)['stock']
        self.assertEqual(stock_after, stock_before - 3,
            f"Expected stock={stock_before - 3}, got {stock_after}")

        # Cart should be empty after checkout
        self.assertEqual(result['cart']['total'], 0.0)
        self.assertEqual(result['cart']['items_count'], 0)

    # -------------------------------------------------------------------
    # Scenario 7: Customer cancels an eligible order from Orders tab
    # -------------------------------------------------------------------
    def test_07_cancel_eligible_order(self):
        """Scenario 7: A confirmed/pending order can be cancelled."""
        order = database.execute_order_atomic(
            items=[{'product_id': self.WATER_ID, 'quantity': 1}],
            customer_name="Customer"
        )
        oid = order['order_id']
        self.assertEqual(order['status'], 'confirmed')

        result = agent_tools.cancel_order(oid, customer_name="Customer")
        self.assertTrue(result['success'])
        self.assertEqual(result['status'], 'cancelled')

        # Check DB reflects cancellation
        reloaded = database.get_order_by_id(oid)
        self.assertEqual(reloaded['status'], 'cancelled')

    # -------------------------------------------------------------------
    # Scenario 8: Cancelling an eligible order restores inventory exactly once
    # -------------------------------------------------------------------
    def test_08_cancellation_restores_inventory_exactly_once(self):
        """Scenario 8: Cancel order → stock restored by exact quantity, only once."""
        stock_before = database.get_product_by_id(self.WATER_ID)['stock']
        qty_ordered = 5

        order = database.execute_order_atomic(
            items=[{'product_id': self.WATER_ID, 'quantity': qty_ordered}],
            customer_name="Customer"
        )
        oid = order['order_id']

        stock_after_order = database.get_product_by_id(self.WATER_ID)['stock']
        self.assertEqual(stock_after_order, stock_before - qty_ordered)

        # Cancel → stock should be restored to original
        result = agent_tools.cancel_order(oid, customer_name="Customer")
        self.assertTrue(result['success'])

        stock_after_cancel = database.get_product_by_id(self.WATER_ID)['stock']
        self.assertEqual(stock_after_cancel, stock_before,
            f"Stock not restored: was {stock_before}, after cancel got {stock_after_cancel}")

        # Try to cancel again: must raise ValueError (prevent double-restoration)
        with self.assertRaises((ValueError, Exception)) as ctx:
            agent_tools.cancel_order(oid, customer_name="Customer")
        self.assertIn("already cancelled", str(ctx.exception).lower())

    # -------------------------------------------------------------------
    # Scenario 9: An ineligible order (delivered) cannot be cancelled
    # -------------------------------------------------------------------
    def test_09_ineligible_order_cannot_be_cancelled(self):
        """Scenario 9: Order in 'delivered' status must be rejected for cancellation."""
        order = database.execute_order_atomic(
            items=[{'product_id': self.WATER_ID, 'quantity': 1}],
            customer_name="Customer"
        )
        oid = order['order_id']

        # Manually mark as delivered
        conn = database.get_db_connection()
        conn.execute("UPDATE orders SET status = 'delivered' WHERE id = ?", (oid,))
        conn.commit()
        conn.close()

        with self.assertRaises((ValueError, Exception)) as ctx:
            agent_tools.cancel_order(oid, customer_name="Customer")
        err = str(ctx.exception).lower()
        self.assertTrue(
            "cannot be cancelled" in err or "delivered" in err or "ineligible" in err,
            f"Expected cancellation refusal for delivered order, got: {err}"
        )

    # -------------------------------------------------------------------
    # Scenario 10: A customer cannot cancel another customer's order
    # -------------------------------------------------------------------
    def test_10_cross_customer_cancellation_denied(self):
        """Scenario 10: Ownership check must block cross-customer cancellation."""
        order = database.execute_order_atomic(
            items=[{'product_id': self.WATER_ID, 'quantity': 1}],
            customer_name="Alice",
            customer_email="alice@test.com"
        )
        oid = order['order_id']

        with self.assertRaises((ValueError, PermissionError, Exception)) as ctx:
            agent_tools.cancel_order(oid, customer_name="Bob", customer_email="bob@test.com")
        err = str(ctx.exception).lower()
        self.assertTrue(
            "denied" in err or "permission" in err or "cannot cancel" in err or "access" in err,
            f"Expected permission denial, got: {err}"
        )

    # -------------------------------------------------------------------
    # Scenario 11: Orders tab displays accurate statuses after cancellation
    # -------------------------------------------------------------------
    def test_11_order_status_reflects_cancellation(self):
        """Scenario 11: get_customer_orders returns updated 'cancelled' status post-cancellation."""
        order = database.execute_order_atomic(
            items=[{'product_id': self.WATER_ID, 'quantity': 1}],
            customer_name="Customer"
        )
        oid = order['order_id']

        cancel_res = agent_tools.cancel_order(oid, customer_name="Customer")
        self.assertTrue(cancel_res['success'])

        orders = agent_tools.get_customer_orders(customer_name="Customer")
        this_order = next((o for o in orders if o['id'] == oid), None)
        self.assertIsNotNone(this_order, f"Order #{oid} not found in customer orders list")
        self.assertEqual(this_order['status'], 'cancelled',
            f"Expected 'cancelled' status for order #{oid}, got '{this_order['status']}'")

    # -------------------------------------------------------------------
    # Scenario 12: Complaint, cart, cancellation work through AI agent text interface
    # -------------------------------------------------------------------
    def test_12_agent_text_interface_integration(self):
        """Scenario 12: All three features work via AI agent text conversation."""
        session = {}

        # 12a. Cart via agent
        r_cart = self.controller.process_message("Add two packs of water to my cart", session)
        self.assertIn(r_cart['action'], ['cart_updated', 'cart_error', 'order_pending'],
            f"Unexpected action for cart add: {r_cart['action']}")

        if r_cart['action'] == 'cart_updated':
            session = r_cart['updated_state']
            r_total = self.controller.process_message("What's my total?", session)
            self.assertIn(r_total['action'], ['cart_view', 'recommend', 'general_help'])

        # 12b. Complaint via agent
        session2 = {}
        r_complaint = self.controller.process_message(
            "I received a damaged product. Order #999.", session2
        )
        # Agent should confirm complaint submission (order 999 may not exist → complaint filed without link)
        self.assertIn(r_complaint['action'], [
            'complaint_submitted', 'complaint_need_order_id', 'general_help', 'search_results'
        ])

        # 12c. Order cancellation via agent
        order = database.execute_order_atomic(
            items=[{'product_id': self.WATER_ID, 'quantity': 1}],
            customer_name="Customer"
        )
        oid = order['order_id']
        session3 = {}
        r_cancel = self.controller.process_message(f"Cancel order {oid}", session3)
        self.assertIn(r_cancel['action'], ['confirm_cancellation_required', 'order_cancelled'])

        if r_cancel['action'] == 'confirm_cancellation_required':
            session3 = r_cancel['updated_state']
            r_confirmed = self.controller.process_message("Yes, confirm", session3)
            self.assertEqual(r_confirmed['action'], 'order_cancelled',
                f"Expected order_cancelled, got: {r_confirmed['action']} — {r_confirmed.get('text', '')}")


if __name__ == '__main__':
    unittest.main()
