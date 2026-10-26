import re
import os
import json
import logging
from typing import Dict, Any, List, Optional
import agent_tools
import category_matcher
import duration_parser

logger = logging.getLogger(__name__)


class ShoppingAgentController:
    """
    Intelligent Conversational Agent Controller:
    - Interprets customer natural language in Arabic, Egyptian Arabic, and English.
    - Extracts intent, budget, duration, product categories, and specific items.
    - Executes deterministic tools for business rules and calculations.
    - Maintains state for pending orders and active carts.
    - Generates spoken & written bilingual responses.
    """

    def __init__(self):
        # Optional Gemini integration if API key is present
        self.gemini_client = None
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        if gemini_api_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=gemini_api_key)
                logger.info("Gemini API Client initialized successfully.")
            except Exception as e:
                logger.warning(f"Could not initialize Gemini Client: {e}")

    def process_message(self, message: str, session_state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Main entry point for processing text or transcribed voice messages.
        Returns a rich response dictionary with:
        - text: Human readable message
        - speech_text: Text suitable for Text-to-Speech
        - action: Action identifier ('recommend', 'order_created', 'order_pending', 'stock_info', 'error', 'clarification')
        - items: List of products involved
        - calculations: Programmatic totals, subtotals, and daily rates
        - updated_state: Persisted session state
        """
        if session_state is None:
            session_state = {}

        message = (message or "").strip()
        if not message:
            return {
                'text': "How can I assist you with your grocery shopping today? You can specify a budget, duration, or categories.",
                'speech_text': "How can I assist you with your grocery shopping today?",
                'action': 'welcome',
                'items': [],
                'calculations': {},
                'updated_state': session_state
            }

        is_arabic = bool(re.search(r'[\u0600-\u06FF]', message))

        session_state.setdefault('cart', {'items': [], 'items_count': 0, 'total': 0.0})

        # 0a. Check for pending cancellation confirmation
        pending_cancel = session_state.get('pending_cancellation')
        if pending_cancel and self._is_confirmation_intent(message):
            oid = pending_cancel['order_id']
            session_state.pop('pending_cancellation', None)
            try:
                res = agent_tools.cancel_order(oid, customer_name="Customer", customer_email="moornafea@gmail.com")
                restored = res.get('restored_items', [])

                # Auto-remove cancelled items from shopping cart
                current_cart = session_state.get('cart', {'items': []})
                for it in restored:
                    rem_res = agent_tools.remove_from_cart(current_cart, it.get('product_id'))
                    if rem_res.get('success'):
                        current_cart = rem_res['cart']
                session_state['cart'] = current_cart

                msg_en = f"✅ Order #{oid} has been successfully cancelled. The inventory has been restored and items removed from cart."
                msg_ar = f"✅ تم إلغاء الطلب #{oid} بنجاح، واستعادة المخزون في قاعدة البيانات وحذف الأصناف من سلة التسوق."
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'order_cancelled',
                    'order_id': oid,
                    'restored_items': restored,
                    'cart': session_state['cart'],
                    'updated_state': session_state
                }
            except Exception as e:
                err = str(e)
                return {
                    'text': f"Cancellation failed: {err}",
                    'speech_text': f"Cancellation failed: {err}",
                    'action': 'cancellation_error',
                    'updated_state': session_state
                }

        # 0b. Check for direct order confirmation if there was a pending order
        pending_order = session_state.get('pending_order')
        if pending_order and self._is_confirmation_intent(message):
            return self._handle_order_confirmation(pending_order, is_arabic, session_state)

        # 0c. Check Shopping Cart Flow (Section 13)
        cart_resp = self._handle_cart_flow(message, is_arabic, session_state)
        if cart_resp:
            return cart_resp

        # 0d. Check Customer Complaints Flow (Section 12)
        complaint_resp = self._handle_complaint_flow(message, is_arabic, session_state)
        if complaint_resp:
            return complaint_resp

        # 0e. Check Orders & Cancellation Flow (Section 14 & 15)
        orders_resp = self._handle_orders_flow(message, is_arabic, session_state)
        if orders_resp:
            return orders_resp

        # 1. Check Duration in message first
        dur_res = agent_tools.parse_duration(message)
        if dur_res['found'] and not dur_res['is_valid']:
            # Duration rejected per Section 3 rules!
            reason_en = (
                f"I noticed you requested groceries for '{dur_res['raw_expression']}'. "
                "Please choose a duration between 1 day and 365 days. "
                "You can specify the duration in days, weeks, months, or years."
            )
            reason_ar = (
                f"عفواً، المدة المحددة '{dur_res['raw_expression']}' غير مدعومة. "
                "يرجى اختيار مدة بين يوم واحد و 365 يوماً. "
                "يمكنك تحديد المدة بالأيام أو الأسابيع أو الشهور أو السنوات."
            )
            text_resp = reason_ar if is_arabic else reason_en
            return {
                'text': text_resp,
                'speech_text': text_resp,
                'action': 'invalid_duration',
                'items': [],
                'calculations': {},
                'updated_state': session_state
            }

        duration_days = dur_res['days'] if (dur_res['found'] and dur_res['is_valid']) else None

        # 2. Extract Budget if present
        budget = self._extract_budget(message)
        if budget is not None:
            is_valid_b, b_val, b_err = agent_tools.validate_budget(budget)
            if not is_valid_b:
                err_msg = (
                    f"عفواً، {b_err}" if is_arabic
                    else f"Sorry, {b_err}"
                )
                return {
                    'text': err_msg,
                    'speech_text': err_msg,
                    'action': 'invalid_budget',
                    'items': [],
                    'calculations': {},
                    'updated_state': session_state
                }
            budget = b_val

        # 3. Extract Categories
        categories = category_matcher.extract_requested_categories(message)

        # 4. Check for direct single-product ordering or stock queries
        # E.g. "I want one pack of water" / "عايز كيس مياه" / "عايز علبة جبنة"
        direct_order = self._check_direct_product_request(message)
        if direct_order:
            return self._handle_direct_product(direct_order, is_arabic, session_state)

        # 5. Check if user is asking for recommendations (by budget, category, duration, or general)
        if budget is not None or categories or duration_days is not None or self._is_recommendation_intent(message):
            # If duration is requested but budget is not provided, use default reasonable budget or ask
            rec_budget = budget if budget is not None else 1000.0
            
            rec_result = agent_tools.recommend_products(
                budget=rec_budget,
                categories=categories if categories else None,
                duration_days=int(duration_days) if duration_days is not None else None
            )

            if not rec_result['success']:
                err_text = rec_result.get('error', 'Unable to generate recommendation.')
                return {
                    'text': err_text,
                    'speech_text': err_text,
                    'action': 'recommend_error',
                    'items': [],
                    'calculations': {},
                    'updated_state': session_state
                }

            # Build rich explanation
            explanation = rec_result['explanation_ar'] if is_arabic else rec_result['explanation_en']
            speech_summary = (
                f"رشحت لك {rec_result['items_count']} منتجات بإجمالي {rec_result['total_spent']} جنيه. هل تود تأكيد الطلب؟"
                if is_arabic
                else f"I have recommended {rec_result['items_count']} products totaling {rec_result['total_spent']} EGP. Would you like to confirm this order?"
            )

            # Store as pending order so user can say "confirm" or "proceed"
            session_state['pending_order'] = {
                'items': [
                    {'product_id': it['product_id'], 'quantity': it['quantity'], 'unit_price': it['unit_price'], 'name_en': it['name_en'], 'name_ar': it['name_ar']}
                    for it in rec_result['items']
                ],
                'duration_days': duration_days,
                'total_amount': rec_result['total_spent']
            }

            return {
                'text': explanation,
                'speech_text': speech_summary,
                'action': 'recommend',
                'items': rec_result['items'],
                'calculations': {
                    'budget': rec_result['budget'],
                    'total_spent': rec_result['total_spent'],
                    'remaining_budget': rec_result['remaining_budget'],
                    'utilization_percent': rec_result['utilization_percent'],
                    'duration_days': rec_result['duration_days'],
                    'duration_label': rec_result['duration_label_ar'] if is_arabic else rec_result['duration_label_en'],
                    'daily_spending': rec_result['daily_spending'],
                    'daily_budget': rec_result['daily_budget']
                },
                'updated_state': session_state
            }

        # 6. Fallback general search or conversational answer
        search_res = agent_tools.search_products(query=message, limit=5)
        if search_res:
            items_text = ", ".join([p['name_ar'] if is_arabic else p['name_en'] for p in search_res[:3]])
            msg_text = (
                f"وجدت منتجات ذات صلة: {items_text}. يمكنك طلب أي منتج أو تحديد ميزانية ومدة."
                if is_arabic
                else f"I found related products: {items_text}. You can request an order or specify a budget and duration."
            )
            return {
                'text': msg_text,
                'speech_text': msg_text,
                'action': 'search_results',
                'items': search_res,
                'calculations': {},
                'updated_state': session_state
            }

        general_help_en = (
            "I am your AI shopping assistant. You can tell me your budget (e.g. 2,000 EGP), "
            "shopping duration (from 1 to 365 days), and preferred categories (like dairy or legumes), "
            "or simply ask for specific items like water or milk."
        )
        general_help_ar = (
            "أنا مساعدك الذكي للتسوق. يمكنك تحديد ميزانيتك (مثلاً 2000 جنيه)، "
            "ومدة التسوق (من يوم حتى 365 يوم)، وفئات المنتجات المطلوبة (مثل الألبان أو البقوليات)، "
            "أو طلب منتجات محددة مباشرة مثل كرتونة مياه أو حليب."
        )
        msg_resp = general_help_ar if is_arabic else general_help_en
        return {
            'text': msg_resp,
            'speech_text': msg_resp,
            'action': 'general_help',
            'items': [],
            'calculations': {},
            'updated_state': session_state
        }

    def _extract_budget(self, text: str) -> Optional[float]:
        """Extracts numerical budget from phrases like '2,000 EGP', '2000 جنيه', 'بميزانية 500'."""
        text = text.translate(duration_parser.ARABIC_DIGITS)
        # Look for explicit currency or budget keywords
        patterns = [
            r'(?:worth|budget|amount|around|up\s+to|for)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:egp|le|pounds?|geneh|جنيه|ج\.م|جنية)',
            r'(?:بميزانية|بمبلغ|بقيمة|بحوالي|بـ|ب)\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:جنيه|ج\.م|جنية|egp)?',
            r'\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:egp|جنيه|ج\.م)\b'
        ]
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                val_str = m.group(1).replace(',', '')
                try:
                    return float(val_str)
                except ValueError:
                    pass
        return None

    def _is_recommendation_intent(self, text: str) -> bool:
        norm = text.lower()
        rec_words = ['recommend', 'suggest', 'plan', 'basket', 'cart', 'رشح', 'اقترح', 'خطة', 'عاوز', 'عايز', 'احتياجات']
        return any(w in norm for w in rec_words)

    def _is_confirmation_intent(self, text: str) -> bool:
        norm = text.lower().strip()
        confirm_words = [
            'confirm', 'yes', 'proceed', 'order', 'buy', 'checkout', 'ok', 'sure',
            'نعم', 'أكد', 'اكد', 'تأكيد', 'موافق', 'اشتري', 'تم', 'تمام', 'نفذ'
        ]
        return any(w in norm for w in confirm_words)

    def _check_direct_product_request(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Detects requests like:
        - "I want one pack of water"
        - "I want 2 bottles of milk"
        - "عايز كرتونة مياه"
        - "عايز باكت مياه"
        """
        norm = text.lower()
        norm_ar = duration_parser.normalize_text(text)

        # Check for water pack request specifically (Section 6 & Test H)
        is_water = ('water' in norm or 'مياه' in norm or 'ماء' in norm) and 'watercress' not in norm and 'جرجير' not in norm_ar and 'watermelon' not in norm and 'بطيخ' not in norm_ar
        if is_water and any(w in norm for w in ['want', 'need', 'buy', 'order', 'عايز', 'عاوز', 'اشتري', 'هات']):
            # Quantity detection
            qty = 1
            if re.search(r'\b(?:two|2|اتنين|اثنين)\b', norm):
                qty = 2
            elif re.search(r'\b(?:three|3|تلاتة|ثلاثة)\b', norm):
                qty = 3
            
            # Find water pack product in DB (excluding watercress/جرجير and watermelon/بطيخ)
            water_prods = agent_tools.search_products(query="water", limit=10)
            chosen = None
            for p in water_prods:
                name_l = (p.get('name_en') or '').lower()
                name_ar_p = (p.get('name_ar') or '')
                if 'watercress' in name_l or 'جرجير' in name_ar_p or 'watermelon' in name_l or 'بطيخ' in name_ar_p:
                    continue
                if 'water' in name_l or 'ماء' in name_ar_p or 'مياه' in name_ar_p:
                    chosen = p
                    break

            if chosen:
                return {
                    'product': chosen,
                    'quantity': qty
                }

        # Check for other direct products e.g. "I want [quantity] of [product]"
        m_prod = re.search(r'(?:i want|i need|give me|order|عايز|عاوز)\s+(\d+)?\s*(pack|packs|bottle|bottles|كيس|علبة|كرتونة|باكت)?\s*(?:of\s+)?([a-zA-Z\u0600-\u06FF\s]+)', text, re.IGNORECASE)
        if m_prod:
            qty_str = m_prod.group(1)
            qty = int(qty_str) if qty_str else 1
            prod_name = m_prod.group(3).strip()
            # Search for this product
            matches = agent_tools.search_products(query=prod_name, limit=1)
            if matches:
                return {
                    'product': matches[0],
                    'quantity': qty
                }

        return None

    def _handle_direct_product(self, direct_req: Dict[str, Any], is_arabic: bool, session_state: Dict[str, Any]) -> Dict[str, Any]:
        prod = direct_req['product']
        qty = direct_req['quantity']
        stock = prod['stock']
        price = float(prod['price'])
        subtotal = round(price * qty, 2)
        p_name = prod['name_ar'] if is_arabic else prod['name_en']

        if stock < qty:
            msg_en = f"Sorry, '{p_name}' has only {stock} units left in stock. Would you like to order {stock} instead?"
            msg_ar = f"عفواً، يتوفر فقط {stock} وحدات من '{p_name}'. هل تود طلب {stock} بدلاً من ذلك؟"
            text_resp = msg_ar if is_arabic else msg_en
            return {
                'text': text_resp,
                'speech_text': text_resp,
                'action': 'insufficient_stock',
                'items': [prod],
                'calculations': {},
                'updated_state': session_state
            }

        # Ask for confirmation before deducting inventory
        session_state['pending_order'] = {
            'items': [{'product_id': prod['id'], 'quantity': qty, 'unit_price': price, 'name_en': prod['name_en'], 'name_ar': prod['name_ar']}],
            'total_amount': subtotal,
            'duration_days': None
        }

        msg_en = (
            f"You requested {qty} pack of '{prod['name_en']}'. Current stock is {stock}. "
            f"Unit price: {price:.2f} EGP (Subtotal: {subtotal:.2f} EGP). "
            "⚠️ Notice: This voiced order is PENDING and NOT yet confirmed. Stock has NOT been deducted. "
            "Please confirm your order to proceed."
        )
        msg_ar = (
            f"طلبك: {qty} من '{prod['name_ar']}'. المخزون الحالي في قاعدة البيانات: {stock}. "
            f"سعر الوحدة: {price:.2f} جنيه (الإجمالي: {subtotal:.2f} جنيه). "
            "⚠️ تنبيه: الطلب الصوتي معلّق وغير مؤكد بعد، ولم يتم خصم المخزون. "
            "يرجى قول 'تأكيد الطلب' أو الضغط على زر التأكيد لإتمام الشراء وخصم العدد من المخزون."
        )
        text_resp = msg_ar if is_arabic else msg_en

        return {
            'text': text_resp,
            'speech_text': text_resp,
            'action': 'order_pending',
            'is_pending_voice_order': True,
            'items': [{**prod, 'quantity': qty, 'subtotal': subtotal}],
            'calculations': {'total': subtotal},
            'updated_state': session_state
        }

    def _handle_order_confirmation(self, pending_order: Dict[str, Any], is_arabic: bool, session_state: Dict[str, Any]) -> Dict[str, Any]:
        """Executes atomic database transaction, decrements stock, creates order, and sends email receipt."""
        try:
            target_email = pending_order.get('customer_email') or "moornafea@gmail.com"
            order_res = agent_tools.create_order(
                items=pending_order['items'],
                customer_name="Customer",
                duration_days=pending_order.get('duration_days'),
                customer_email=target_email
            )
            session_state.pop('pending_order', None)

            order_id = order_res['order_id']
            total = order_res['total_amount']
            items_count = len(order_res['items'])
            stock_updates = [
                {
                    'product_id': it['product_id'],
                    'name_en': it['name_en'],
                    'name_ar': it['name_ar'],
                    'quantity': it['quantity'],
                    'stock_before': it['stock_before'],
                    'stock_after': it['stock_after']
                }
                for it in order_res['items']
            ]

            updates_text_en = ", ".join([f"{it['name_en']} stock decreased from {it['stock_before']} to {it['stock_after']}" for it in stock_updates])
            updates_text_ar = ", ".join([f"تم تقليل مخزون '{it['name_ar']}' من {it['stock_before']} إلى {it['stock_after']}" for it in stock_updates])

            # Success message with explicit inventory deduction confirmation and email notification
            msg_en = (
                f"✅ Order #{order_id} confirmed successfully! {items_count} items processed. "
                f"Total amount: {total:,.2f} EGP. Live Inventory updated: {updates_text_en}. "
                f"📧 Invoice receipt sent to {target_email}."
            )
            msg_ar = (
                f"✅ تم تأكيد طلبك رقم #{order_id} بنجاح! تم معالجة {items_count} أصناف "
                f"بإجمالي {total:,.2f} جنيه. تم تحديث المخزون في قاعدة البيانات فورياً: {updates_text_ar}. "
                f"📧 تم إرسال تفاصيل الفاتورة إلى {target_email}."
            )
            text_resp = msg_ar if is_arabic else msg_en

            # Auto-add confirmed items into shopping cart
            current_cart = session_state.get('cart', {'items': []})
            for it in order_res['items']:
                pid = it['product_id']
                qty = it['quantity']
                existing = next((c for c in current_cart.get('items', []) if c.get('product_id') == pid), None)
                if existing:
                    existing['quantity'] += qty
                else:
                    current_cart.setdefault('items', []).append({
                        'product_id': pid,
                        'name_en': it.get('name_en', ''),
                        'name_ar': it.get('name_ar', ''),
                        'quantity': qty,
                        'unit_price': it.get('unit_price', 0),
                        'subtotal': round(it.get('unit_price', 0) * qty, 2)
                    })
            session_state['cart'] = agent_tools.calculate_cart_total(current_cart.get('items', []))

            return {
                'text': text_resp,
                'speech_text': text_resp,
                'action': 'order_created',
                'order_id': order_id,
                'items': order_res['items'],
                'stock_updates': stock_updates,
                'email_sent_to': target_email,
                'cart': session_state['cart'],
                'calculations': {'total': total},
                'updated_state': session_state
            }

        except Exception as e:
            logger.error(f"Order creation failed: {e}")
            err_en = f"Order processing failed: {str(e)}"
            err_ar = f"فشلت عملية إنشاء الطلب: {str(e)}"
            text_resp = err_ar if is_arabic else err_en
            return {
                'text': text_resp,
                'speech_text': text_resp,
                'action': 'order_error',
                'items': [],
                'calculations': {},
                'updated_state': session_state
            }

    def _handle_cart_flow(self, message: str, is_arabic: bool, session_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        norm = message.lower().strip()
        norm_ar = duration_parser.normalize_text(message)

        # 1. Add to cart
        is_add_cart = any(w in norm for w in ['add to cart', 'add to my cart', 'put in cart', 'add in cart']) or \
                      any(w in norm_ar for w in ['اضف الي السلة', 'اضف الى السلة', 'اضف للسلة', 'حط في السلة', 'ضيف للسلة', 'اضافة للسلة', 'ضيف في السلة', 'حط في العربة', 'اضف للعربة'])
        
        if not is_add_cart:
            if ('cart' in norm and any(w in norm for w in ['add', 'put', 'insert'])) or \
               (('سلة' in norm_ar or 'عربة' in norm_ar) and any(w in norm_ar for w in ['اضف', 'ضيف', 'حط', 'ضع'])):
                is_add_cart = True

        if is_add_cart:
            qty = 1
            m_num = re.search(r'\b(?:add|put|اضف|ضيف|حط)\s+(\d+)\b', message, re.IGNORECASE)
            if m_num:
                qty = int(m_num.group(1))
            elif re.search(r'\b(two|2|اتنين|اثنين)\b', norm):
                qty = 2
            elif re.search(r'\b(three|3|تلاتة|ثلاثة)\b', norm):
                qty = 3
            elif re.search(r'\b(four|4|اربعة|أربعة)\b', norm):
                qty = 4
            elif re.search(r'\b(five|5|خمسة)\b', norm):
                qty = 5

            clean_q = re.sub(r'\b(add|to|my|the|cart|put|in|pack|packs|bottle|bottles|of|please)\b', ' ', norm, flags=re.IGNORECASE)
            clean_q = re.sub(r'\b(اضف|ضيف|حط|الي|الى|في|السلة|عربة|التسوق|كرتونة|باكت|علبة|كيس|من فضلك|لو سمحت|من)\b', ' ', clean_q)
            clean_q = re.sub(r'\b(\d+|two|three|four|five|اتنين|اثنين|تلاتة|اربعة|خمسة)\b', ' ', clean_q).strip()

            if not clean_q or len(clean_q) < 2:
                if 'water' in norm or 'مياه' in norm or 'ماء' in norm:
                    clean_q = 'water'
                else:
                    clean_q = message

            cart = session_state.get('cart', {'items': []})
            res = agent_tools.add_to_cart(cart, clean_q, qty)
            if res['success']:
                session_state['cart'] = res['cart']
                item = res['added_item']
                total = res['cart']['total']
                msg_en = (
                    f"I've added {qty} pack(s) of '{item['name_en']}' to your cart. "
                    f"Current cart total: {total:,.2f} EGP ({res['cart']['items_count']} items). "
                    "Would you like to add anything else or proceed to checkout?"
                )
                msg_ar = (
                    f"أضفت {qty} من '{item['name_ar']}' إلى سلة التسوق. "
                    f"إجمالي السلة الحالي: {total:,.2f} جنيه ({res['cart']['items_count']} منتجات). "
                    "هل تود إضافة منتج آخر أم إتمام الشراء؟"
                )
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'cart_updated',
                    'cart': res['cart'],
                    'items': res['cart']['items'],
                    'calculations': {'total': total},
                    'updated_state': session_state
                }
            else:
                err_text = res.get('error', 'Could not add to cart.')
                return {
                    'text': err_text,
                    'speech_text': err_text,
                    'action': 'cart_error',
                    'updated_state': session_state
                }

        # 2. View cart or check total ("What's my total?", "what is in my cart?", "view cart", "show cart")
        is_view_cart = any(w in norm for w in ["what's my total", "what is my total", "cart total", "view cart", "show cart", "my cart", "what is in my cart"]) or \
                       any(w in norm_ar for w in ['اجمالي السلة', 'إجمالي السلة', 'كام الحساب', 'كام الاجمالي', 'عرض السلة', 'وريني السلة', 'محتويات السلة', 'سلة التسوق'])

        if is_view_cart:
            cart = agent_tools.get_cart(session_state.get('cart', {}))
            session_state['cart'] = cart
            if not cart['items']:
                msg_en = "Your shopping cart is currently empty. You can add items by saying 'Add 2 packs of water to my cart'."
                msg_ar = "سلة التسوق فارغة حالياً. يمكنك إضافة منتجات بالقول 'أضف 2 مياه إلى السلة'."
                text = msg_ar if is_arabic else msg_en
            else:
                items_str_en = ", ".join([f"{it['quantity']}x {it['name_en']} ({it['subtotal']:.2f} EGP)" for it in cart['items']])
                items_str_ar = ", ".join([f"{it['quantity']}x {it['name_ar']} ({it['subtotal']:.2f} جنيه)" for it in cart['items']])
                msg_en = (
                    f"Your current cart total is {cart['total']:,.2f} EGP for {cart['items_count']} item(s): {items_str_en}. "
                    "You can say 'Checkout' to place your order or remove items."
                )
                msg_ar = (
                    f"إجمالي سلة التسوق الحالية هو {cart['total']:,.2f} جنيه لعدد {cart['items_count']} منتجات: {items_str_ar}. "
                    "يمكنك قول 'إتمام الشراء' لتأكيد الطلب."
                )
                text = msg_ar if is_arabic else msg_en

            return {
                'text': text,
                'speech_text': f"Your cart total is {cart['total']:.2f} EGP." if not is_arabic else f"إجمالي السلة {cart['total']:.2f} جنيه.",
                'action': 'cart_view',
                'cart': cart,
                'items': cart['items'],
                'calculations': {'total': cart['total']},
                'updated_state': session_state
            }

        # 3. Remove from cart
        is_remove_cart = any(w in norm for w in ['remove from cart', 'delete from cart']) or \
                         any(w in norm_ar for w in ['احذف من السلة', 'شيل من السلة', 'امسح من السلة', 'حذف من السلة'])
        if is_remove_cart:
            clean_q = re.sub(r'\b(remove|delete|from|my|the|cart|please)\b', ' ', norm, flags=re.IGNORECASE)
            clean_q = re.sub(r'\b(احذف|شيل|امسح|حذف|من|السلة|عربة|التسوق|لو سمحت)\b', ' ', clean_q).strip()
            res = agent_tools.remove_from_cart(session_state.get('cart', {}), clean_q)
            if res['success']:
                session_state['cart'] = res['cart']
                rem = res['removed_item']
                text = f"تم حذف '{rem['name_ar']}' من السلة." if is_arabic else f"Removed '{rem['name_en']}' from cart."
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'cart_updated',
                    'cart': res['cart'],
                    'items': res['cart']['items'],
                    'updated_state': session_state
                }
            else:
                return {
                    'text': res.get('error', 'Could not remove item.'),
                    'speech_text': res.get('error', 'Could not remove item.'),
                    'action': 'cart_error',
                    'updated_state': session_state
                }

        # 4. Cart checkout ("checkout", "proceed to checkout", "إتمام الشراء", "تأكيد السلة", "شراء السلة")
        is_checkout = any(w in norm for w in ['checkout', 'proceed to checkout', 'buy cart', 'confirm cart', 'checkout cart']) or \
                      any(w in norm_ar for w in ['اتمام الشراء', 'إتمام الشراء', 'شراء السلة', 'تأكيد السلة', 'تنفيذ السلة'])
        if is_checkout:
            cart = session_state.get('cart', {'items': []})
            if not cart.get('items'):
                msg_en = "Your shopping cart is empty. Please add items before checking out."
                msg_ar = "سلة التسوق فارغة. يرجى إضافة منتجات قبل إتمام الشراء."
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'cart_empty',
                    'updated_state': session_state
                }
            try:
                res = agent_tools.checkout(cart, customer_name="Customer", customer_email="moornafea@gmail.com")
                session_state['cart'] = res['cart']
                order = res['order']
                oid = order['order_id']
                total = order['total_amount']
                msg_en = (
                    f"✅ Checkout completed successfully! Order #{oid} has been placed. "
                    f"Total: {total:,.2f} EGP. Stock has been deducted and confirmation email sent to moornafea@gmail.com."
                )
                msg_ar = (
                    f"✅ تم إتمام الشراء بنجاح! تم إنشاء الطلب رقم #{oid} بإجمالي {total:,.2f} جنيه. "
                    "تم خصم الكميات من المخزون وإرسال الفاتورة إلى moornafea@gmail.com."
                )
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'order_created',
                    'order_id': oid,
                    'order': order,
                    'items': order['items'],
                    'calculations': {'total': total},
                    'updated_state': session_state
                }
            except Exception as e:
                err = str(e)
                return {
                    'text': f"Checkout failed: {err}",
                    'speech_text': f"Checkout failed: {err}",
                    'action': 'checkout_error',
                    'updated_state': session_state
                }

        return None

    def _handle_complaint_flow(self, message: str, is_arabic: bool, session_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        norm = message.lower().strip()
        norm_ar = duration_parser.normalize_text(message)

        # Check if there is a pending complaint waiting for an order ID
        pending_comp = session_state.get('pending_complaint')
        if pending_comp:
            m_oid = re.search(r'(?:order|#|رقم|الطلب)?\s*#?(\d+)', message, re.IGNORECASE)
            order_id = int(m_oid.group(1)) if m_oid else None
            
            is_skip = any(w in norm for w in ['no', 'skip', 'without', 'none', "don't have", 'dont have']) or \
                      any(w in norm_ar for w in ['لا', 'بدون', 'مش معايا', 'ما عندي', 'تخطي'])
            
            if order_id or is_skip or len(norm) < 15:
                session_state.pop('pending_complaint', None)
                res = agent_tools.submit_complaint(
                    description=pending_comp['description'],
                    category=pending_comp.get('category'),
                    order_id=order_id,
                    customer_name="Customer"
                )
                cid = res['complaint_id']
                cat = res['category']
                link_text_en = f"linked to Order #{order_id}" if order_id else "without an associated order"
                link_text_ar = f"ومرتبطة بالطلب #{order_id}" if order_id else "بدون ربط برقم طلب"
                
                msg_en = (
                    f"✅ Your complaint has been submitted successfully! Complaint ID: {cid} ({link_text_en}). "
                    f"Category: {cat}. Our customer service team is reviewing it."
                )
                msg_ar = (
                    f"✅ تم تسجيل شكواك بنجاح! رقم الشكوى: {cid} ({link_text_ar}). "
                    f"التصنيف: {cat}. جاري متابعتها من فريق خدمة العملاء."
                )
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'complaint_submitted',
                    'complaint': res,
                    'complaint_id': cid,
                    'updated_state': session_state
                }

        # Check for checking status of existing complaint
        is_status_query = any(w in norm for w in ['status of complaint', 'complaint status', 'check complaint', 'my complaint']) or \
                          any(w in norm_ar for w in ['حالة الشكوى', 'استعلام عن شكوى', 'متابعة شكوى', 'شكوتي'])
        if is_status_query:
            m_cid = re.search(r'(?:cmp-?|#|رقم\s*)?(\d+)', norm, re.IGNORECASE)
            if m_cid:
                cid = int(m_cid.group(1))
                stat = agent_tools.get_complaint_status(cid)
                if stat:
                    msg_en = f"Complaint {stat['complaint_id']} status is '{stat['status']}'. Category: {stat['category']}. Description: {stat['description']}."
                    msg_ar = f"حالة الشكوى {stat['complaint_id']} هي '{stat['status']}'. التصنيف: {stat['category']}. التفاصيل: {stat['description']}."
                    text = msg_ar if is_arabic else msg_en
                    return {
                        'text': text,
                        'speech_text': text,
                        'action': 'complaint_status',
                        'complaint': stat,
                        'updated_state': session_state
                    }
                else:
                    msg_en = f"Complaint CMP-{cid} was not found."
                    msg_ar = f"لم يتم العثور على الشكوى رقم CMP-{cid}."
                    text = msg_ar if is_arabic else msg_en
                    return {
                        'text': text,
                        'speech_text': text,
                        'action': 'complaint_not_found',
                        'updated_state': session_state
                    }

        # Check for new complaint statement
        is_complaint = any(w in norm for w in ['complaint', 'damaged', 'broken product', 'spoiled', 'missing item', 'missing product', 'wrong item', 'wrong order', 'incorrect order', 'payment issue', 'late delivery']) or \
                       any(w in norm_ar for w in ['شكوى', 'اشتكي', 'منتج تالف', 'تالف', 'مكسور', 'بايظ', 'ناقص', 'طلب خاطئ', 'غلط', 'مشكلة في الدفع', 'تاخير التوصيل', 'تأخير التوصيل'])
        
        if is_complaint:
            m_oid = re.search(r'(?:order|#|الطلب|طلب|رقم)\s*#?(\d+)', message, re.IGNORECASE)
            order_id = int(m_oid.group(1)) if m_oid else None
            cat = agent_tools.classify_complaint_category(message)

            if order_id:
                res = agent_tools.submit_complaint(
                    description=message,
                    category=cat,
                    order_id=order_id,
                    customer_name="Customer"
                )
                cid = res['complaint_id']
                msg_en = (
                    f"I'm sorry to hear that. I have registered your complaint (ID: {cid}) for Order #{order_id} "
                    f"under category '{cat}'. Our team will resolve it promptly."
                )
                msg_ar = (
                    f"نعتذر بشدة عن ذلك. لقد قمت بتسجيل شكواك برقم (ID: {cid}) للطلب #{order_id} "
                    f"تحت تصنيف '{cat}'. سيتواصل معك فريق الدعم فوراً."
                )
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'complaint_submitted',
                    'complaint': res,
                    'complaint_id': cid,
                    'updated_state': session_state
                }
            else:
                session_state['pending_complaint'] = {
                    'description': message,
                    'category': cat
                }
                msg_en = "I'm sorry about that. I can register a complaint for you. Could you provide your order number?"
                msg_ar = "نعتذر جداً عن هذه التجربة. يمكنني تسجيل شكوى لك فوراً، هل يمكنك تزويدي برقم الطلب؟"
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'complaint_need_order_id',
                    'updated_state': session_state
                }

        return None

    def _handle_orders_flow(self, message: str, is_arabic: bool, session_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        norm = message.lower().strip()
        norm_ar = duration_parser.normalize_text(message)

        # 1. Cancel order intent
        is_cancel = any(w in norm for w in ['cancel order', 'cancel my order', 'void order']) or \
                    any(w in norm_ar for w in ['الغاء الطلب', 'إلغاء الطلب', 'الغي الطلب', 'كنسل الطلب'])
        if is_cancel:
            m_oid = re.search(r'(?:order|#|الطلب|طلب|رقم)\s*#?(\d+)', message, re.IGNORECASE)
            if m_oid:
                oid = int(m_oid.group(1))
                session_state['pending_cancellation'] = {'order_id': oid}
                msg_en = f"Are you sure you want to cancel Order #{oid}? Please confirm to restore the inventory."
                msg_ar = f"هل أنت متأكد من رغبتك في إلغاء الطلب #{oid}؟ يرجى قول 'تأكيد' أو 'نعم' لاستعادة المخزون."
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'confirm_cancellation_required',
                    'order_id': oid,
                    'updated_state': session_state
                }
            else:
                msg_en = "Please specify the order number you want to cancel (e.g., 'Cancel order #5')."
                msg_ar = "يرجى تحديد رقم الطلب الذي ترغب في إلغائه (مثال: 'إلغاء الطلب رقم 5')."
                text = msg_ar if is_arabic else msg_en
                return {
                    'text': text,
                    'speech_text': text,
                    'action': 'order_cancel_missing_id',
                    'updated_state': session_state
                }

        # 2. View orders intent
        is_view_orders = any(w in norm for w in ['show orders', 'view orders', 'my orders', 'list orders']) or \
                         any(w in norm_ar for w in ['عرض الطلبات', 'طلباتي', 'وريني الطلبات', 'قائمة الطلبات'])
        if is_view_orders:
            orders = agent_tools.get_customer_orders(customer_name="Customer", customer_email="moornafea@gmail.com")
            if not orders:
                msg_en = "You have no previous orders recorded."
                msg_ar = "لا توجد لديك طلبات سابقة مسجلة."
                text = msg_ar if is_arabic else msg_en
            else:
                summaries = [f"Order #{o['id']} ({o['status'].upper()}) - {o['total_amount']:,.2f} EGP" for o in orders[:5]]
                msg_en = f"You have {len(orders)} order(s). Recent orders: " + "; ".join(summaries)
                msg_ar = f"لديك {len(orders)} طلب(ات). أحدث الطلبات: " + "؛ ".join(summaries)
                text = msg_ar if is_arabic else msg_en
            return {
                'text': text,
                'speech_text': text,
                'action': 'orders_list',
                'orders': orders,
                'updated_state': session_state
            }

        return None
