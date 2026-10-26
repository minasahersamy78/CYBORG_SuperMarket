/**
 * Cyborg Supermarket - Customer Web Storefront Server
 * Fully functional bilingual shopping experience with 3D AI Voice Assistant,
 * Cyber Dark Glassmorphic Styling, Smart Budget & Duration Grocery Planner,
 * Voiced Order Safety, Complaints Management, Cart Drawer, and Barcode Cards.
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const productsService = require('../backend/src/modules/products/products.service');
const cartService = require('../backend/src/modules/cart/cart.service');
const ordersService = require('../backend/src/modules/orders/orders.service');
const aiEngineService = require('../backend/src/modules/ai-engine/ai-engine.service');
const recommendationsService = require('../backend/src/modules/recommendations/recommendations.service');
const emailService = require('../backend/src/modules/email/email.service');
const { supportService } = require('../backend/src/modules/support/support.service');

const PORT = process.env.CUSTOMER_WEB_PORT || 3002;
const HTML_PATH = path.join(__dirname, 'src', 'views', 'index.html');

// In-memory web session cart
let webCart = { items: [], items_count: 0, total: 0.0 };

function sendHtml(res, content) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(content);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { resolve({}); }
    });
  });
}

function recalcCart() {
  webCart.items_count = webCart.items.reduce((s, it) => s + (it.quantity || 1), 0);
  webCart.total = parseFloat(webCart.items.reduce((s, it) => s + (it.quantity || 1) * (parseFloat(it.price) || 0), 0).toFixed(2));
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  // 1. Products API
  if (pathname === '/api/products') {
    const listRes = productsService.list({ ...parsed.query, limit: parsed.query.limit || 100 });
    const rawList = listRes.data || listRes.items || [];
    const formatted = rawList.map(p => ({
      id: p.id,
      barcode: p.barcode,
      name_en: p.name_en,
      name_ar: p.name_ar,
      category_en: p.category_name_en || 'Grocery',
      category_ar: p.category_name_ar || 'بقالة',
      price: parseFloat(p.price || 0),
      stock: p.stock_quantity !== undefined ? p.stock_quantity : (p.stock || 20),
      image_url: p.image_url || null
    }));
    return sendJson(res, 200, {
      success: true,
      count: formatted.length,
      products: formatted,
      items: formatted,
      data: formatted
    });
  }

  // 2. Categories API
  if (pathname === '/api/categories') {
    return sendJson(res, 200, productsService.getCategories());
  }

  // 3. Live Inventory API
  if (pathname === '/api/inventory') {
    const listRes = productsService.list({ limit: 100 });
    const rawList = listRes.data || listRes.items || [];
    const inventory = rawList.map(p => ({
      id: p.id,
      barcode: p.barcode,
      name_en: p.name_en,
      name_ar: p.name_ar,
      category_en: p.category_name_en || 'Grocery',
      price: parseFloat(p.price || 0),
      stock: p.stock_quantity !== undefined ? p.stock_quantity : 20
    }));
    return sendJson(res, 200, { success: true, count: inventory.length, inventory });
  }

  // 4. Cart API (VOICE UPDATES Section 13)
  if (method === 'GET' && pathname === '/api/cart') {
    return sendJson(res, 200, { success: true, cart: webCart });
  }

  if (method === 'POST' && pathname === '/api/cart/add') {
    const b = await parseBody(req);
    const target = b.product_id || b.product_name;
    const qty = parseInt(b.quantity || 1, 10);
    const listRes = productsService.list({ limit: 100 });
    const rawList = listRes.data || listRes.items || [];
    const prod = rawList.find(p => p.id === parseInt(target, 10) || (p.name_en && p.name_en.toLowerCase().includes(String(target).toLowerCase())));
    
    if (prod) {
      const existing = webCart.items.find(it => it.product_id === prod.id);
      if (existing) {
        existing.quantity += qty;
      } else {
        webCart.items.push({
          product_id: prod.id,
          name_en: prod.name_en,
          name_ar: prod.name_ar,
          barcode: prod.barcode,
          price: parseFloat(prod.price),
          quantity: qty,
          category_en: prod.category_name_en || 'General'
        });
      }
      recalcCart();
      return sendJson(res, 200, { success: true, message: `Added ${prod.name_en} to cart.`, cart: webCart });
    }
    return sendJson(res, 400, { success: false, error: 'Product not found' });
  }

  if (method === 'POST' && pathname === '/api/cart/update') {
    const b = await parseBody(req);
    const pid = parseInt(b.product_id, 10);
    const qty = parseInt(b.quantity, 10);
    const item = webCart.items.find(it => it.product_id === pid);
    if (item) {
      if (qty <= 0) {
        webCart.items = webCart.items.filter(it => it.product_id !== pid);
      } else {
        item.quantity = qty;
      }
      recalcCart();
      return sendJson(res, 200, { success: true, cart: webCart });
    }
    return sendJson(res, 400, { success: false, error: 'Item not in cart' });
  }

  if (method === 'POST' && pathname === '/api/cart/remove') {
    const b = await parseBody(req);
    const pid = parseInt(b.product_id, 10);
    webCart.items = webCart.items.filter(it => it.product_id !== pid);
    recalcCart();
    return sendJson(res, 200, { success: true, cart: webCart });
  }

  if (method === 'POST' && pathname === '/api/cart/checkout') {
    const b = await parseBody(req);
    if (!webCart.items.length) {
      return sendJson(res, 400, { success: false, error: 'Cart is empty' });
    }
    const orderItems = webCart.items.map(it => ({
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.price
    }));

    const orderRes = ordersService.createOrder({
      items: orderItems,
      source: 'ONLINE',
      customer_name: b.customer_name || 'Customer',
      payment_method: 'CASH',
      delivery_address: 'Customer Express Delivery',
      idempotency_key: 'cart-chk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
    });

    if (orderRes.success) {
      webCart = { items: [], items_count: 0, total: 0.0 };
      emailService.sendOrderNotification(orderRes.data, 'cyborgcoding1@gmail.com');
      return sendJson(res, 200, {
        success: true,
        order_id: orderRes.data.id,
        order: orderRes.data,
        total: orderRes.data.total_amount,
        message: `Order #${orderRes.data.id} placed successfully.`
      });
    }
    return sendJson(res, 400, { success: false, error: orderRes.error || 'Checkout failed' });
  }

  // 5. Orders API & Cancellation with Stock Restoration (VOICE UPDATES Section 14)
  if (method === 'GET' && pathname === '/api/orders') {
    const ordersRes = ordersService.listOrders ? ordersService.listOrders({ limit: 50 }) : { data: [] };
    const orders = ordersRes.data || (Array.isArray(ordersRes) ? ordersRes : []);
    return sendJson(res, 200, { success: true, count: orders.length, orders });
  }

  if (method === 'POST' && pathname.startsWith('/api/orders/') && pathname.endsWith('/cancel')) {
    const parts = pathname.split('/');
    const orderId = parts[parts.length - 2];
    const b = await parseBody(req);
    const cancelRes = ordersService.cancelOrder(orderId, b.reason || 'Customer requested voice cancellation');
    if (cancelRes.success) {
      emailService.sendChatbotFeedback({
        feedbackType: 'ORDER_CANCELLATION',
        customerName: b.customer_name || 'Customer',
        message: `Order #${orderId} was cancelled. Inventory stock was restored.`
      }, 'cyborgcoding1@gmail.com');
      return sendJson(res, 200, {
        success: true,
        order_id: orderId,
        status: 'cancelled',
        message: `Order #${orderId} has been successfully cancelled and stock restored.`
      });
    }
    return sendJson(res, 400, { success: false, error: cancelRes.error || 'Cannot cancel order' });
  }

  // 6. Complaints API (VOICE UPDATES Section 12)
  if (method === 'POST' && pathname === '/api/complaints') {
    const b = await parseBody(req);
    const category = b.category || 'General Inquiry';
    const description = b.description || b.message || 'No description provided';
    const ticket = supportService.createTicket({
      customerId: 'usr-web-client',
      orderId: b.order_id || null,
      category,
      subject: `[Website Complaint] ${category}`,
      message: description
    });

    emailService.sendChatbotFeedback({
      feedbackType: 'COMPLAINT',
      customerName: b.customer_name || 'Customer',
      message: `Category: ${category}\nOrder ID: ${b.order_id || 'N/A'}\nDescription: ${description}`
    }, 'cyborgcoding1@gmail.com');

    return sendJson(res, 201, {
      success: true,
      complaint_id: ticket.id,
      ticket_number: ticket.ticket_number,
      status: ticket.status,
      message: 'Complaint submitted successfully and forwarded to management.'
    });
  }

  if (method === 'GET' && pathname === '/api/complaints') {
    const tickets = supportService.getAllTickets ? supportService.getAllTickets({}) : [];
    return sendJson(res, 200, { success: true, count: tickets.length, complaints: tickets });
  }

  if (method === 'GET' && pathname.startsWith('/api/complaints/')) {
    const cid = pathname.split('/').pop();
    const ticket = supportService.getTicketById(cid, 'AGENT', null);
    if (ticket) {
      return sendJson(res, 200, { success: true, complaint: ticket });
    }
    return sendJson(res, 404, { success: false, error: 'Complaint ticket not found' });
  }

  // 7. Conversational Chat API with Smart Planner, Voiced Order Safety & Egyptian Arabic / English NLP
  if (method === 'POST' && pathname === '/api/chat') {
    const b = await parseBody(req);
    const msg = (b.message || '').trim();
    const isEgyptian = b.locale === 'ar-EG' || b.lang === 'ar' || b.is_arabic === true || /[\u0600-\u06FF]/.test(msg);
    const norm = msg.toLowerCase();

    // 1. Order Confirmation (Egyptian Arabic / English)
    if (norm.includes('تمام') || norm.includes('أكد') || norm.includes('تأكيد') || norm.includes('اه') || norm.includes('ايوة') || norm.includes('نفذ') || norm.includes('confirm') || norm.includes('yes')) {
      if (b.session_state && b.session_state.pending_order) {
        const pOrder = b.session_state.pending_order;
        const orderRes = ordersService.createOrder({
          source: 'ONLINE',
          customer_name: b.customer_name || 'Customer',
          customer_email: 'cyborgcoding1@gmail.com',
          delivery_address: 'Home Delivery',
          items: pOrder.items || []
        });

        if (orderRes.success) {
          const ordId = orderRes.data.id;
          webCart = { items: [], items_count: 0, total: 0.0 };
          const replyAr = `تمام يا فندم! تم تأكيد طلبك بنجاح برقم #${ordId}، وخصمنا الكميات من المخزن. ألف هنا وشفا!`;
          const replyEn = `Order #${ordId} has been confirmed successfully! Stock has been deducted. Thank you for shopping with us!`;
          return sendJson(res, 200, {
            success: true,
            action: 'order_created',
            order_id: ordId,
            order: orderRes.data,
            text: isEgyptian ? replyAr : replyEn,
            speech_text: isEgyptian ? replyAr : replyEn,
            cart: webCart,
            updated_state: { ...b.session_state, pending_order: null }
          });
        }
      }
    }

    // 2. Order Cancellation (Egyptian Arabic / English)
    if (norm.includes('إلغاء') || norm.includes('الغاء') || norm.includes('كنسل') || norm.includes('مش عايز') || norm.includes('لا') || norm.includes('cancel')) {
      if (b.session_state && b.session_state.pending_order) {
        const replyAr = `تمام يا فندم، لغيت الطلب ومفيش أي حاجة اتخصمت من المخزن ولا من حسابك. تحت أمرك في أي وقت!`;
        const replyEn = `The order has been cancelled. No items were deducted from stock. Feel free to continue browsing!`;
        return sendJson(res, 200, {
          success: true,
          action: 'order_cancelled',
          text: isEgyptian ? replyAr : replyEn,
          speech_text: isEgyptian ? replyAr : replyEn,
          updated_state: { ...b.session_state, pending_order: null }
        });
      }
    }

    // 3. Smart Duration & Budget Grocery Planner (1–365 Days)
    const isPlanIntent = /خزين|ميزانية|خطة|خطه|سلة|سله|توفير|لمدة|لمده|budget|plan|recommend|worth/i.test(norm) ||
      /(شهر|اسبوع|أسبوع|شهور|يوم|ايام|أيام|سنة|سنه|days|weeks|months|years)/i.test(norm);
    const parsedDuration = isPlanIntent ? recommendationsService.parseDuration(msg) : { valid: false };
    if (parsedDuration.valid) {
      const days = parsedDuration.days || 7;
      const budget = (parsedDuration.budget && parsedDuration.budget > 0) ? parsedDuration.budget : (days * 150.0);
      const basket = recommendationsService.buildBasket({ budget, durationDays: days, categories: parsedDuration.categories });
      const items = basket.items || (basket.data ? basket.data.items : []);
      const total = basket.total_spent_egp !== undefined ? basket.total_spent_egp : (basket.data ? basket.data.total_cost : budget);

      const replyAr = `عملتلك خطة خزين ذكية لـ ${days} يوم بميزانية ${budget} جنيه، فيها ${items.length} صنف بإجمالي ${total} جنيه. الأصناف معروضة في بانر الأمان ومش مخصومة من المخزن.. لما تراجعهم قولي "تمام" أو اضغط "تأكيد الطلب" عشان نخصمهم ونجهزهم!`;
      const replyEn = `I formulated a smart grocery plan for ${days} days within ${budget} EGP (${items.length} items, Total: ${total} EGP). Items are placed in Pending Review — stock is preserved until confirmed.`;

      const pendingOrderObj = {
        days,
        budget,
        total_cost: total,
        items: items.map(it => ({
          product_id: it.product_id || it.id,
          name_en: it.name_en,
          name_ar: it.name_ar,
          price: it.unit_price !== undefined ? it.unit_price : it.price,
          unit_price: it.unit_price !== undefined ? it.unit_price : it.price,
          quantity: it.quantity || 1,
          image: it.image_url || it.image || null
        }))
      };

      return sendJson(res, 200, {
        success: true,
        action: 'smart_basket',
        text: isEgyptian ? replyAr : replyEn,
        speech_text: isEgyptian ? replyAr : replyEn,
        items: pendingOrderObj.items,
        calculations: { budget, duration_days: days, total_cost: total, buffer: budget - total },
        requires_confirmation: true,
        updated_state: { ...(b.session_state || {}), pending_order: pendingOrderObj }
      });
    }

    // 4. Egyptian Arabic & English NLP Intent Parsing (ADD_TO_CART, CHECK_PRICE, SEARCH_PRODUCT)
    const nlpRes = aiEngineService.parseVoiceOrTextQuery(msg, isEgyptian ? 'ar-EG' : 'en-US');
    const matched = nlpRes.matched_products || [];

    if (nlpRes.intent === 'ADD_TO_CART' && matched.length > 0) {
      const top = matched[0];
      const qty = (nlpRes.entities && nlpRes.entities.quantity) || 1;
      const existing = webCart.items.find(it => it.product_id === top.id);
      if (existing) {
        existing.quantity += qty;
      } else {
        webCart.items.push({
          product_id: top.id,
          name_en: top.name_en,
          name_ar: top.name_ar,
          barcode: top.barcode,
          price: parseFloat(top.price),
          quantity: qty,
          category_en: top.category_name_en || 'General'
        });
      }
      webCart.items_count = webCart.items.reduce((s, i) => s + (i.quantity || 1), 0);
      webCart.total = webCart.items.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);

      const replyAr = `تحت أمرك يا فندم! ضفتلك "${top.name_ar}" (${qty} علبة/قطعة) في السلة بسعر ${top.price * qty} جنيه، ومتاح منه ${top.stock_quantity || 20} في المخزن. تحب أجبلك حاجة تانية معاه؟`;
      const replyEn = `Added ${qty}x "${top.name_en}" to your cart for ${(top.price * qty).toFixed(2)} EGP. We have ${top.stock_quantity || 20} in stock. Would you like anything else?`;

      return sendJson(res, 200, {
        success: true,
        action: 'cart_updated',
        text: isEgyptian ? replyAr : replyEn,
        speech_text: isEgyptian ? replyAr : replyEn,
        cart: webCart,
        items: [top]
      });
    }

    if (nlpRes.intent === 'CHECK_PRICE' && matched.length > 0) {
      const top = matched[0];
      const replyAr = `سعر "${top.name_ar}" هو ${top.price} جنيه مصري ومتاح منه ${top.stock_quantity || 20} في المخزن.`;
      const replyEn = `The price of "${top.name_en}" is ${top.price} EGP and we have ${top.stock_quantity || 20} in stock.`;
      return sendJson(res, 200, {
        success: true,
        action: 'price_check',
        text: isEgyptian ? replyAr : replyEn,
        speech_text: isEgyptian ? replyAr : replyEn,
        items: [top]
      });
    }

    if (matched.length > 0) {
      const namesAr = matched.slice(0, 3).map(p => p.name_ar || p.name_en).join('، ');
      const namesEn = matched.slice(0, 3).map(p => p.name_en).join(', ');
      const replyAr = `لقيتلك الأصناف دي في المتجر يا فندم: ${namesAr}. تحب أضيفلك حاجة منهم في السلة؟`;
      const replyEn = `I found these items in the store: ${namesEn}. Would you like to add any to your cart?`;
      return sendJson(res, 200, {
        success: true,
        action: 'search_results',
        text: isEgyptian ? replyAr : replyEn,
        speech_text: isEgyptian ? replyAr : replyEn,
        items: matched
      });
    }

    // 5. General Catalog Search
    const searchRes = productsService.list({ q: msg, limit: 5 });
    const rawFound = searchRes.data || searchRes.items || [];
    if (rawFound.length > 0) {
      const namesAr = rawFound.slice(0, 3).map(p => p.name_ar || p.name_en).join('، ');
      const namesEn = rawFound.slice(0, 3).map(p => p.name_en).join(', ');
      const replyAr = `لقيتلك ${rawFound.length} صنف مطابق لطلبك: ${namesAr}. قولي لو حابب تضيف أي صنف في السلة!`;
      const replyEn = `I found ${rawFound.length} matching items: ${namesEn}. Let me know if you would like to add any to your cart!`;
      return sendJson(res, 200, {
        success: true,
        action: 'search_results',
        text: isEgyptian ? replyAr : replyEn,
        speech_text: isEgyptian ? replyAr : replyEn,
        items: rawFound
      });
    }

    // 6. Default Warm Friendly Dialogue
    const defaultAr = `أهلاً بيك يا فندم في سايبورغ سوبرماركت! أنا مساعدك الذكي.. تقدر تقولي مثلاً: "عايز اتنين لبن جهينة"، أو "بكام كرتونة المياه؟"، أو تطلب خطة خزين كاملة زي: "خزين أسبوعين بـ 2000 جنيه"، وأنا تحت أمرك!`;
    const defaultEn = `Welcome to Cyborg Supermarket! I am your AI assistant. You can speak grocery requests (e.g., "Add 2 Juhayna milk"), check prices, or plan grocery budgets (e.g., "2 weeks groceries for 2000 EGP").`;

    return sendJson(res, 200, {
      success: true,
      action: 'general_dialogue',
      text: isEgyptian ? defaultAr : defaultEn,
      speech_text: isEgyptian ? defaultAr : defaultEn,
      items: []
    });
  }

  // 8. Direct Recommendation Endpoint
  if (method === 'POST' && (pathname === '/api/recommend' || pathname === '/api/recommendations/smart-basket')) {
    const b = await parseBody(req);
    const result = recommendationsService.buildBasket({
      budget: parseFloat(b.budget) || 1000,
      durationDays: b.duration_days,
      categories: b.categories
    });
    return sendJson(res, result.success ? 200 : 400, result);
  }

  // 9. Duration Parser Endpoint
  if (method === 'POST' && pathname === '/api/recommendations/parse-duration') {
    const b = await parseBody(req);
    const parsedRes = recommendationsService.parseDuration(b.text || '');
    return sendJson(res, parsedRes.valid ? 200 : 400, parsedRes);
  }

  // 10. Email Resend / Receipt Endpoint
  if (method === 'POST' && pathname === '/api/order/email') {
    const b = await parseBody(req);
    const order = ordersService.getOrderById ? ordersService.getOrderById(b.order_id) : { id: b.order_id, total_amount: b.total || 0, items: [] };
    emailService.sendOrderNotification(order, 'cyborgcoding1@gmail.com');
    return sendJson(res, 200, { success: true, message: 'Receipt dispatched to cyborgcoding1@gmail.com' });
  }

  // 11. Legacy feedback endpoint
  if (method === 'POST' && (pathname === '/api/chatbot/feedback' || pathname === '/api/feedback')) {
    const b = await parseBody(req);
    const feedbackRes = emailService.sendChatbotFeedback({
      feedbackType: b.feedback_type || 'COMPLIMENT',
      customerName: b.customer_name || 'Website Shopper',
      message: b.message || 'Great experience with Cyborg Supermarket!',
      transcript: b.transcript || []
    }, 'cyborgcoding1@gmail.com');
    return sendJson(res, feedbackRes.statusCode || 200, feedbackRes);
  }

  // 12. Serve Primary Front-end HTML
  if (pathname === '/' || pathname === '/index.html' || pathname === '') {
    try {
      const htmlContent = fs.readFileSync(HTML_PATH, 'utf8');
      return sendHtml(res, htmlContent);
    } catch (err) {
      return sendHtml(res, '<h1>Cyborg Supermarket Storefront</h1><p>Loading application...</p>');
    }
  }

  // Default fallback
  sendJson(res, 404, { success: false, error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`[Customer Web Storefront] Running at http://localhost:${PORT}`);
});
