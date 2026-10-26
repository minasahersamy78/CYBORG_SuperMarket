/**
 * Cyborg Supermarket - Customer Web Storefront Server
 * Fully functional bilingual shopping experience with 3D AI Voice Assistant,
 * Smart Budget & Duration Grocery Planner, and Barcode Product Cards (features/data-1 format).
 */

const http = require('http');
const url = require('url');

const productsService = require('../backend/src/modules/products/products.service');
const cartService = require('../backend/src/modules/cart/cart.service');
const ordersService = require('../backend/src/modules/orders/orders.service');
const aiEngineService = require('../backend/src/modules/ai-engine/ai-engine.service');
const recommendationsService = require('../backend/src/modules/recommendations/recommendations.service');
const emailService = require('../backend/src/modules/email/email.service');

const PORT = process.env.CUSTOMER_WEB_PORT || 3002;

function sendHtml(res, content) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(content);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
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

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  if (pathname === '/api/products') {
    return sendJson(res, 200, productsService.list(parsed.query));
  }
  if (pathname === '/api/categories') {
    return sendJson(res, 200, productsService.getCategories());
  }
  if (method === 'POST' && pathname === '/api/ai') {
    const b = await parseBody(req);
    return sendJson(res, 200, { success: true, data: aiEngineService.parseVoiceOrTextQuery(b.query || '') });
  }
  if (method === 'POST' && pathname === '/api/recommendations/smart-basket') {
    const b = await parseBody(req);
    const result = recommendationsService.buildBasket({
      budget: parseFloat(b.budget) || 1000,
      durationDays: b.duration_days,
      categories: b.categories
    });
    return sendJson(res, result.success ? 200 : 400, result);
  }
  if (method === 'POST' && pathname === '/api/recommendations/parse-duration') {
    const b = await parseBody(req);
    const parsedRes = recommendationsService.parseDuration(b.text || '');
    return sendJson(res, parsedRes.valid ? 200 : 400, parsedRes);
  }
  if (method === 'POST' && (pathname === '/api/chatbot/feedback' || pathname === '/api/feedback')) {
    const b = await parseBody(req);
    const feedbackRes = emailService.sendChatbotFeedback({
      feedbackType: b.feedback_type || 'COMPLIMENT',
      customerName: b.customer_name || 'Website Shopper',
      message: b.message || 'Great experience with the Cyborg website storefront!',
      transcript: b.transcript || []
    }, 'cyborgcoding1@gmail.com');
    return sendJson(res, feedbackRes.statusCode, feedbackRes);
  }
  if (method === 'POST' && pathname === '/api/voice/order-confirm') {
    const b = await parseBody(req);
    const orderRes = ordersService.createOrder({
      items: b.items || [],
      source: 'VOICE_ASSISTANT',
      customer_name: b.customer_name || 'Moor Nafea (Voice Client)',
      payment_method: b.payment_method || 'CASH',
      delivery_address: b.delivery_address || 'Voice Express Delivery (Cairo)',
      idempotency_key: 'voice-order-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
    });
    return sendJson(res, orderRes.statusCode, {
      ...orderRes,
      email_dispatched_to: 'cyborgcoding1@gmail.com',
      voice_safety_cleared: true
    });
  }
  if (method === 'POST' && pathname === '/api/checkout') {
    const b = await parseBody(req);
    const orderRes = ordersService.createOrder({
      items: b.items || [],
      source: 'ONLINE',
      payment_method: b.payment_method || 'CASH',
      delivery_address: b.delivery_address || 'New Cairo, Sector 1',
      idempotency_key: 'web-order-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
    });
    return sendJson(res, orderRes.statusCode, orderRes);
  }

  // Serve Customer Storefront HTML
  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyborg Supermarket — Omnichannel Shopping & Voice AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <!-- Three.js for 3D Holographic AI Voice Orb -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>
    :root {
      --primary: #10B981;
      --primary-hover: #059669;
      --primary-dark: #047857;
      --accent-cyan: #06B6D4;
      --accent-sky: #38BDF8;
      --accent-amber: #F59E0B;
      --price-color: #22C55E;
      --bg-dark: #0B1120;
      --bg-surface: #0F172A;
      --bg-card: #151D30;
      --bg-card-hover: #1C2640;
      --card-border: #22304A;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --border: #1E293B;
      --font-en: 'Inter', -apple-system, sans-serif;
      --font-ar: 'Cairo', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    [data-theme="light"] {
      --bg-dark: #FFFFFF;
      --bg-surface: #F8FAFC;
      --bg-card: #FFFFFF;
      --bg-card-hover: #F1F5F9;
      --card-border: #E2E8F0;
      --text-main: #0F172A;
      --text-muted: #64748B;
      --border: #E2E8F0;
      --price-color: #10B981;
    }
    [data-theme="light"] .category-tabs {
      background: #FFFFFF !important;
    }
    [data-theme="light"] .cat-pill {
      background: #F1F5F9 !important;
      color: #334155 !important;
      border-color: #E2E8F0 !important;
    }
    [data-theme="light"] .cat-pill.active {
      background: #10B981 !important;
      color: #FFFFFF !important;
    }
    [data-theme="light"] .search-bar input {
      background: #FFFFFF !important;
      border-color: #CBD5E1 !important;
      color: #0F172A !important;
    }
    [data-theme="light"] .hero {
      background: radial-gradient(circle at 50% 0%, #E0F2FE 0%, #F8FAFC 70%) !important;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-surface);
      color: var(--text-main);
      font-family: var(--font-en);
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      line-height: 1.5;
    }
    body[dir="rtl"] { font-family: var(--font-ar); }

    /* Top Navigation */
    .nav {
      background: var(--bg-dark);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .brand-badge {
      background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .search-bar {
      flex: 1;
      max-width: 520px;
      margin: 0 24px;
      position: relative;
    }
    .search-bar input {
      width: 100%;
      background: #1E293B;
      border: 1px solid var(--border);
      color: var(--text-main);
      border-radius: 999px;
      padding: 10px 20px;
      font-size: 14px;
      outline: none;
      transition: all 0.2s ease;
    }
    .search-bar input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn {
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary {
      background: var(--primary);
      color: #042F2E;
      font-weight: 700;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: #1E293B;
      color: var(--text-main);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      background: #334155;
    }
    .btn-smart {
      background: linear-gradient(135deg, #0EA5E9, #8B5CF6);
      color: white;
    }
    .btn-cart {
      background: linear-gradient(135deg, var(--primary), #0D9488);
      color: white;
    }

    /* Hero Banner */
    .hero {
      background: radial-gradient(circle at 50% 0%, #13273D 0%, #0B1120 70%);
      padding: 36px 24px;
      text-align: center;
      border-bottom: 1px solid var(--border);
    }
    .hero-badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(16, 185, 129, 0.15);
      color: var(--primary);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .hero h1 {
      font-size: 32px;
      font-weight: 800;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    .hero p {
      color: var(--text-muted);
      font-size: 15px;
      max-width: 680px;
      margin: 0 auto;
    }

    /* Category Filter Tabs */
    .category-tabs {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 16px 28px;
      background: #0B1120;
      border-bottom: 1px solid var(--border);
      scrollbar-width: none;
    }
    .category-tabs::-webkit-scrollbar { display: none; }
    .cat-pill {
      background: #1E293B;
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .cat-pill:hover {
      color: var(--text-main);
      border-color: #475569;
    }
    .cat-pill.active {
      background: var(--primary);
      color: #042F2E;
      font-weight: 700;
      border-color: var(--primary);
    }

    /* Main Container & Product Grid (Matching features/data-1 format) */
    .container {
      max-width: 1380px;
      width: 100%;
      margin: 0 auto;
      padding: 28px 24px 80px;
    }
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 20px;
    }

    /* Product Card with Barcode Sticker */
    .product-card {
      background: var(--bg-card);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }
    .product-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--accent-cyan);
      transform: translateY(-4px);
      box-shadow: 0 12px 28px rgba(6, 182, 212, 0.15);
    }
    .img-box {
      height: 165px;
      background: #0D1424;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      position: relative;
      border-bottom: 1px solid var(--border);
    }
    .img-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      transition: transform 0.3s ease;
    }
    .product-card:hover .img-box img {
      transform: scale(1.06);
    }
    .card-body {
      padding: 14px;
      display: flex;
      flex-direction: column;
      flex: 1;
      text-align: center;
    }
    .prod-brand {
      font-size: 11px;
      font-weight: 700;
      color: var(--accent-cyan);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .prod-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.35;
      min-height: 36px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .prod-size {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    /* Vibrant Emerald Price Badge */
    .prod-price {
      font-size: 18px;
      font-weight: 800;
      color: var(--price-color);
      margin-bottom: 10px;
      font-family: var(--font-en);
    }

    /* Barcode Sticker (Matching features/data-1) */
    .barcode-sticker {
      background: #FFFFFF;
      border-radius: 6px;
      padding: 6px 8px 4px;
      margin-bottom: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      border: 1px solid #CBD5E1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .barcode-svg {
      width: 100%;
      height: 26px;
      display: block;
    }
    .barcode-digits {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    /* Modals & Drawers */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px); z-index: 100;
      display: none; align-items: center; justify-content: flex-end;
    }
    .modal-drawer {
      background: var(--bg-surface); width: 440px; height: 100%; padding: 24px;
      display: flex; flex-direction: column; box-shadow: -6px 0 30px rgba(0,0,0,0.5);
      border-left: 1px solid var(--border);
    }
    .drawer-title {
      font-size: 18px; font-weight: 700; border-bottom: 1px solid var(--border);
      padding-bottom: 16px; margin-bottom: 16px; display: flex;
      justify-content: space-between; align-items: center;
    }
    .cart-items-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .cart-row { display: flex; gap: 12px; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .cart-footer { border-top: 1px solid var(--border); padding-top: 16px; }

    /* Center Modal for Smart Basket & Voice */
    .center-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px); z-index: 110;
      display: none; align-items: center; justify-content: center;
      padding: 20px;
    }
    .center-modal-card {
      background: var(--bg-card);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      max-width: 640px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      padding: 28px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.7);
      position: relative;
    }

    /* Floating Action Dock */
    .dock-bar {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      gap: 12px;
      z-index: 90;
    }
    .dock-btn {
      padding: 12px 20px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      transition: all 0.2s ease;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .dock-btn:hover { transform: translateY(-3px); }
    .dock-voice {
      background: linear-gradient(135deg, #10B981, #06B6D4);
      color: #042F2E;
    }
    .dock-basket {
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      color: white;
    }

    /* 3D Orb Canvas Container */
    #orb-container {
      width: 180px;
      height: 180px;
      margin: 0 auto 16px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #orb-canvas {
      width: 100% !important;
      height: 100% !important;
      border-radius: 50%;
    }
  </style>
</head>
<body>

  <!-- Top Navbar -->
  <header class="nav">
    <div class="brand">
      <span>⚡</span>
      <span class="brand-badge">CYBORG</span>
      <span style="font-weight: 300; font-size: 16px; color: var(--text-muted);">SUPERMARKET</span>
    </div>
    <div class="search-bar">
      <input type="text" id="store-search" placeholder="Search 1,000 products by name, brand, or barcode..." oninput="searchCatalog(this.value)">
    </div>
    <div class="nav-actions">
      <button class="btn btn-smart" onclick="openSmartPlannerModal()">🛒 Smart Basket Planner</button>
      <button class="btn btn-secondary" id="theme-btn" onclick="toggleStoreTheme()" title="Toggle Dark/Light Mode">🌙 Dark</button>
      <button class="btn btn-secondary" onclick="openFeedbackModal()" title="Send feedback to cyborgcoding1@gmail.com">💌 Feedback</button>
      <button class="btn btn-secondary" onclick="toggleStoreLang()"><span id="lang-indicator">عربي / RTL</span></button>
      <button class="btn btn-cart" onclick="toggleCartDrawer()">🛒 Cart (<span id="cart-count">0</span>)</button>
    </div>
  </header>

  <!-- Hero -->
  <div class="hero">
    <div class="hero-badge">ENTERPRISE OMNICHANNEL ECOSYSTEM · 1,000 VERIFIED SKUS</div>
    <h1 id="hero-title">Omnichannel Supermarket Catalog & Voice AI</h1>
    <p id="hero-sub">Complete Cairo retail inventory with barcode stickers, duration grocery planning (1–365 days), and bilingual voice shopping.</p>
  </div>

  <!-- Category Filter Tabs -->
  <div class="category-tabs" id="cat-tabs">
    <button class="cat-pill active" onclick="filterCategory(null, this)">All Products (1,000)</button>
    <button class="cat-pill" onclick="filterCategory(1, this)">🥛 Fresh Food</button>
    <button class="cat-pill" onclick="filterCategory(2, this)">🥤 Beverages</button>
    <button class="cat-pill" onclick="filterCategory(3, this)">🥦 Frozen Food</button>
    <button class="cat-pill" onclick="filterCategory(4, this)">🥫 Food Cupboard</button>
    <button class="cat-pill" onclick="filterCategory(5, this)">🍎 Fruits & Vegetables</button>
  </div>

  <!-- Catalog Grid -->
  <main class="container">
    <div class="product-grid" id="product-container">
      <p style="padding: 48px; grid-column: 1/-1; text-align: center; color: var(--text-muted);">Loading live products from database...</p>
    </div>
  </main>

  <!-- Floating Dock -->
  <div class="dock-bar">
    <button class="dock-btn dock-basket" onclick="openSmartPlannerModal()">
      <span>📊</span>
      <span>Budget & Duration Planner</span>
    </button>
    <button class="dock-btn dock-voice" onclick="openVoiceModal()">
      <span>🎙️</span>
      <span>AI Voice Assistant (3D Orb)</span>
    </button>
  </div>

  <!-- Cart Drawer -->
  <div class="modal-overlay" id="cart-drawer-overlay" onclick="if(event.target===this) toggleCartDrawer()">
    <div class="modal-drawer">
      <div class="drawer-title">
        <span>Shopping Cart</span>
        <button onclick="toggleCartDrawer()" style="background:none; border:none; color:var(--text-muted); font-size:18px; cursor:pointer;">✕</button>
      </div>
      <div class="cart-items-list" id="cart-items">
        <p style="text-align: center; color: var(--text-muted); margin-top: 32px;">Your cart is empty.</p>
      </div>
      <div class="cart-footer">
        <div style="display:flex; justify-content:space-between; margin-bottom: 6px; font-size:13px; color:var(--text-muted);">
          <span>Subtotal</span>
          <span id="cart-subtotal">0.00 EGP</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 12px; font-size:13px; color:var(--text-muted);">
          <span>Egyptian VAT (14%)</span>
          <span id="cart-tax">0.00 EGP</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 18px; font-size:19px; font-weight:800; color:var(--price-color);">
          <span>Total</span>
          <span id="cart-total">0.00 EGP</span>
        </div>
        <button class="btn btn-primary" style="width:100%; padding:14px; font-size:15px; justify-content:center;" onclick="checkoutOrder()">Proceed to Checkout (EGP)</button>
      </div>
    </div>
  </div>

  <!-- 3D Voice Assistant Modal (From features/VOICE) -->
  <div class="center-modal-overlay" id="voice-modal-overlay" onclick="if(event.target===this) closeVoiceModal()">
    <div class="center-modal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <h2 style="font-size: 20px; font-weight:800;">🎙️ AI Shopping Agent ( لهجة مصرية )</h2>
          <span style="font-size:11px; padding:3px 8px; border-radius:999px; background:rgba(6,182,212,0.2); color:var(--accent-cyan); font-weight:700;">VOICE v2.0</span>
        </div>
        <button onclick="closeVoiceModal()" style="background:none; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;">✕</button>
      </div>

      <!-- 3D Orb -->
      <div id="orb-container">
        <canvas id="orb-canvas"></canvas>
      </div>

      <!-- Controls & Mute Toggle -->
      <div style="display:flex; justify-content:center; gap:12px; margin-bottom:16px;">
        <button id="btn-mic" class="btn btn-primary" onclick="toggleVoiceRecording()" style="padding:10px 20px;">
          <span id="mic-icon">🔴</span>
          <span id="mic-status">Start Voice (تحدث الآن)</span>
        </button>
        <button id="btn-mute" class="btn btn-secondary" onclick="toggleAudioMute()">
          <span id="mute-icon">🔊</span>
          <span id="mute-text">Sound ON</span>
        </button>
      </div>

      <!-- Speech Display -->
      <div style="background:#0D1424; border:1px solid var(--card-border); border-radius:12px; padding:16px; margin-bottom:16px;">
        <div style="font-size:11px; color:var(--accent-cyan); font-weight:700; margin-bottom:4px; text-transform:uppercase;">Voice Recognition / المحادثة</div>
        <div id="voice-transcript" style="font-size:14px; color:var(--text-main); min-height:40px;">Press 'Start Voice' and speak in Egyptian Arabic or English (e.g. "عايز لبن جهينة وجبنة بميزانية 500 جنيه لمدة أسبوعين")...</div>
      </div>

      <!-- Pending Safety Notice -->
      <div id="voice-safety-box" style="display:none; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:12px; padding:14px; margin-bottom:16px;">
        <div style="color:var(--accent-amber); font-weight:700; font-size:13px; margin-bottom:6px;">⚠️ Voiced Order Safety (لم يتم الخصم إلا بعد التأكيد)</div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">Stock is preserved and will NOT be deducted until you review and confirm below.</div>
        <div id="voice-pending-items" style="max-height:120px; overflow-y:auto; margin-bottom:12px;"></div>
        <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="confirmVoiceOrder()">Confirm Order & Email Receipt (cyborgcoding1@gmail.com)</button>
      </div>

      <div id="voice-confirmation-badge" style="display:none; background:rgba(16,185,129,0.15); border:1px solid var(--primary); border-radius:12px; padding:14px; color:var(--primary); font-size:13px; font-weight:600; text-align:center;">
        ✅ Order placed atomically and confirmation email dispatched to <b>cyborgcoding1@gmail.com</b>!
      </div>
    </div>
  </div>

  <!-- Smart Budget & Duration Planner Modal (From features/Recommendations) -->
  <div class="center-modal-overlay" id="planner-modal-overlay" onclick="if(event.target===this) closeSmartPlannerModal()">
    <div class="center-modal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <h2 style="font-size: 20px; font-weight:800;">📊 Smart Grocery Budget & Duration Planner</h2>
          <span style="font-size:11px; padding:3px 8px; border-radius:999px; background:rgba(99,102,241,0.2); color:#A5B4FC; font-weight:700;">1–365 DAYS</span>
        </div>
        <button onclick="closeSmartPlannerModal()" style="background:none; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;">✕</button>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
        <div>
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Total Budget (EGP / جنيه)</label>
          <input type="number" id="plan-budget" value="2000" min="50" max="50000" style="width:100%; background:#0D1424; border:1px solid var(--card-border); color:var(--text-main); border-radius:8px; padding:10px; font-size:14px;">
        </div>
        <div>
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px; font-weight:600;">Duration (المدة باليوم)</label>
          <select id="plan-duration" style="width:100%; background:#0D1424; border:1px solid var(--card-border); color:var(--text-main); border-radius:8px; padding:10px; font-size:14px;">
            <option value="7">1 Week / أسبوع (7 days)</option>
            <option value="14">2 Weeks / أسبوعين (14 days)</option>
            <option value="30" selected>1 Month / شهر (30 days)</option>
            <option value="60">2 Months / شهرين (60 days)</option>
            <option value="90">3 Months / 3 شهور (90 days)</option>
            <option value="180">6 Months / نص سنة (180 days)</option>
            <option value="365">1 Year / سنة كاملة (365 days)</option>
          </select>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:8px; font-weight:600;">Categories to Include (الأقسام المطلوبة):</label>
        <div style="display:flex; flex-wrap:wrap; gap:8px;" id="planner-categories">
          <label class="cat-pill" style="cursor:pointer;"><input type="checkbox" value="dairy" checked style="margin-right:6px;"> منتجات الألبان والبيض</label>
          <label class="cat-pill" style="cursor:pointer;"><input type="checkbox" value="rice" checked style="margin-right:6px;"> الأرز والمعكرونة والبقوليات</label>
          <label class="cat-pill" style="cursor:pointer;"><input type="checkbox" value="fresh" checked style="margin-right:6px;"> الخضار والفواكه الطازجة</label>
          <label class="cat-pill" style="cursor:pointer;"><input type="checkbox" value="frozen" checked style="margin-right:6px;"> الأغذية المجمدة</label>
          <label class="cat-pill" style="cursor:pointer;"><input type="checkbox" value="beverages" checked style="margin-right:6px;"> العصائر والمشروبات</label>
          <label class="cat-pill" style="cursor:pointer;"><input type="checkbox" value="snacks" checked style="margin-right:6px;"> بسكويت وكيك وسناكس</label>
        </div>
      </div>

      <button class="btn btn-primary" style="width:100%; justify-content:center; padding:12px; font-size:14px; margin-bottom:16px;" onclick="generateSmartBasket()">
        ⚡ Calculate Optimal Grocery Basket
      </button>

      <!-- Results Container -->
      <div id="planner-results" style="display:none; background:#0D1424; border:1px solid var(--card-border); border-radius:12px; padding:16px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:13px;">
          <span>Allocated: <b id="res-spent" style="color:var(--price-color);">0 EGP</b></span>
          <span>Daily Rate: <b id="res-rate" style="color:var(--accent-cyan);">0 EGP/day</b></span>
          <span>Buffer Remaining: <b id="res-buffer" style="color:var(--accent-amber);">0 EGP</b></span>
        </div>
        <div id="planner-items-list" style="max-height:180px; overflow-y:auto; margin-bottom:14px; font-size:12px;"></div>
        <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="addAllPlannedToCart()">🛒 Add Entire Optimized Basket to Cart</button>
      </div>
    </div>
  </div>

  <!-- Feedback / Compliments Modal -->
  <div class="center-modal-overlay" id="feedback-modal-overlay" onclick="if(event.target===this) closeFeedbackModal()">
    <div class="center-modal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <h2 style="font-size: 20px; font-weight:800;">💌 Customer Feedback & Compliments</h2>
        </div>
        <button onclick="closeFeedbackModal()" style="background:none; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;">✕</button>
      </div>
      <p style="font-size:13px; color:var(--text-muted); margin-bottom:14px;">
        Send your compliments or suggestions directly to store management at <b>cyborgcoding1@gmail.com</b>.
      </p>
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Your Name</label>
        <input type="text" id="feedback-name" value="Valued Shopper" style="width:100%; background:var(--bg-surface); border:1px solid var(--card-border); color:var(--text-main); border-radius:8px; padding:10px; font-size:14px;">
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Your Message / Compliment</label>
        <textarea id="feedback-msg" rows="4" placeholder="Write your compliments or feedback here..." style="width:100%; background:var(--bg-surface); border:1px solid var(--card-border); color:var(--text-main); border-radius:8px; padding:10px; font-size:14px; resize:vertical;"></textarea>
      </div>
      <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="submitFeedback()">Send to cyborgcoding1@gmail.com</button>
      <div id="feedback-success" style="display:none; margin-top:12px; padding:10px; background:rgba(16,185,129,0.15); border:1px solid var(--primary); border-radius:8px; color:var(--primary); font-size:12px; text-align:center;">
        ✅ Thank you! Your message was delivered to <b>cyborgcoding1@gmail.com</b>.
      </div>
    </div>
  </div>

  <script>
    let activeCategory = null;
    let storeLang = 'en';
    let currentTheme = localStorage.getItem('cyborg_theme') || 'dark';
    if (currentTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    function toggleStoreTheme() {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('cyborg_theme', 'dark');
        const btn = document.getElementById('theme-btn');
        if (btn) btn.textContent = '🌙 Dark';
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('cyborg_theme', 'light');
        const btn = document.getElementById('theme-btn');
        if (btn) btn.textContent = '☀️ Light';
      }
    }

    function openFeedbackModal() {
      document.getElementById('feedback-modal-overlay').classList.add('active');
    }
    function closeFeedbackModal() {
      document.getElementById('feedback-modal-overlay').classList.remove('active');
      document.getElementById('feedback-success').style.display = 'none';
    }
    async function submitFeedback() {
      const name = document.getElementById('feedback-name').value || 'Valued Shopper';
      const msg = document.getElementById('feedback-msg').value;
      if (!msg || !msg.trim()) { alert('Please enter your feedback message.'); return; }

      try {
        const res = await fetch('/api/chatbot/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_name: name, message: msg, feedback_type: 'COMPLIMENT' })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('feedback-success').style.display = 'block';
          document.getElementById('feedback-msg').value = '';
          setTimeout(() => { closeFeedbackModal(); }, 2500);
        } else {
          alert('Failed to send feedback: ' + (data.error || 'Server error'));
        }
      } catch (e) {
        alert('Network error submitting feedback');
      }
    }

    let cart = [];
    let isMuted = false;
    let recognition = null;
    let isRecording = false;
    let plannedBasketItems = [];
    let pendingVoiceItems = [];

    // Realistic Barcode Generator (Code-128 visual representation)
    function generateBarcodeSVG(code) {
      const barcodeStr = String(code || '622000000000').padStart(12, '0');
      let bars = '';
      let x = 6;
      for (let i = 0; i < barcodeStr.length; i++) {
        const d = parseInt(barcodeStr[i], 10) || 3;
        const w1 = (d % 3) + 1;
        const w2 = ((d + 1) % 2) + 1;
        bars += \`<rect x="\${x}" y="2" width="\${w1}" height="22" fill="#0F172A" />\`;
        x += w1 + 1;
        bars += \`<rect x="\${x}" y="2" width="\${w2}" height="22" fill="#0F172A" />\`;
        x += w2 + 2;
      }
      return \`
        <div class="barcode-sticker">
          <svg class="barcode-svg" viewBox="0 0 \${Math.max(x + 6, 120)} 26">
            \${bars}
          </svg>
          <div class="barcode-digits">\${barcodeStr}</div>
        </div>
      \`;
    }

    function toggleStoreLang() {
      if (storeLang === 'en') {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'ar');
        document.getElementById('lang-indicator').textContent = 'English / LTR';
        storeLang = 'ar';
      } else {
        document.documentElement.setAttribute('dir', 'ltr');
        document.documentElement.setAttribute('lang', 'en');
        document.getElementById('lang-indicator').textContent = 'عربي / RTL';
        storeLang = 'en';
      }
      renderProducts(window.lastLoadedProducts || []);
    }

    async function loadProducts(catId = null, query = '') {
      let endpoint = '/api/products?limit=32';
      if (catId) endpoint += '&category_id=' + catId;
      if (query) endpoint += '&q=' + encodeURIComponent(query);

      try {
        const res = await fetch(endpoint);
        const json = await res.json();
        if (json.success && json.data) {
          window.lastLoadedProducts = json.data;
          renderProducts(json.data);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
      }
    }

    function renderProducts(items) {
      const container = document.getElementById('product-container');
      if (!items || items.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 48px; color:var(--text-muted);">No matching products found in catalog.</p>';
        return;
      }
      container.innerHTML = items.map(p => {
        const title = storeLang === 'ar' ? (p.name_ar || p.name_en) : (p.name_en || p.name_ar);
        const img = p.image_url || 'https://via.placeholder.com/200?text=Cyborg+Product';
        const barcodeHtml = generateBarcodeSVG(p.barcode);

        return \`
          <div class="product-card">
            <div class="img-box">
              <img src="\${img}" alt="\${p.name_en}" onerror="this.src='https://via.placeholder.com/200?text=Cyborg'">
            </div>
            <div class="card-body">
              <div class="prod-brand">\${p.brand || 'Cyborg Retail'}</div>
              <div class="prod-name" title="\${title}">\${title}</div>
              <div class="prod-size">\${p.size || ''} \${p.format ? '· ' + p.format : ''}</div>
              <div class="prod-price">\${p.price.toFixed(2)} EGP</div>
              \${barcodeHtml}
              <button class="btn btn-primary" style="width:100%; justify-content:center; margin-top:auto;" onclick="addToCart(\${p.id}, '\${p.name_en.replace(/'/g, "")}', \${p.price})">
                + Add to Cart
              </button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function filterCategory(catId, btnEl) {
      activeCategory = catId;
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btnEl.classList.add('active');
      loadProducts(catId);
    }

    function searchCatalog(query) {
      loadProducts(activeCategory, query);
    }

    function toggleCartDrawer() {
      const el = document.getElementById('cart-drawer-overlay');
      el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
      renderCart();
    }

    function addToCart(id, name, price, qty = 1) {
      const exist = cart.find(x => x.product_id === id);
      if (exist) {
        exist.quantity += qty;
      } else {
        cart.push({ product_id: id, name, price, quantity: qty });
      }
      updateCartBadge();
    }

    function updateCartBadge() {
      const count = cart.reduce((acc, x) => acc + x.quantity, 0);
      document.getElementById('cart-count').textContent = count;
    }

    function renderCart() {
      const listEl = document.getElementById('cart-items');
      if (cart.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 32px;">Your cart is empty.</p>';
        document.getElementById('cart-subtotal').textContent = '0.00 EGP';
        document.getElementById('cart-tax').textContent = '0.00 EGP';
        document.getElementById('cart-total').textContent = '0.00 EGP';
        return;
      }

      let sub = 0;
      listEl.innerHTML = cart.map((item, idx) => {
        const lineTotal = item.price * item.quantity;
        sub += lineTotal;
        return \`
          <div class="cart-row">
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 700; color:var(--text-main);">\${item.name}</div>
              <div style="font-size: 12px; color: var(--price-color);">\${item.quantity} × \${item.price.toFixed(2)} EGP</div>
            </div>
            <div style="font-weight: 700; font-size: 14px;">\${lineTotal.toFixed(2)} EGP</div>
            <button onclick="cart.splice(\${idx}, 1); renderCart(); updateCartBadge();" style="background:none; border:none; color:#EF4444; cursor:pointer; font-size:16px;">✕</button>
          </div>
        \`;
      }).join('');

      const tax = sub * 0.14; // 14% Egyptian VAT
      const total = sub + tax;

      document.getElementById('cart-subtotal').textContent = sub.toFixed(2) + ' EGP';
      document.getElementById('cart-tax').textContent = tax.toFixed(2) + ' EGP';
      document.getElementById('cart-total').textContent = total.toFixed(2) + ' EGP';
    }

    async function checkoutOrder() {
      if (cart.length === 0) return alert('Cart is empty.');
      const btn = event.target;
      btn.textContent = 'Processing Checkout...';
      btn.disabled = true;

      const payload = {
        items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity })),
        payment_method: 'CASH',
        delivery_address: 'New Cairo, Sector 1'
      };

      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          alert('Order #' + json.data.id + ' placed successfully! Total: ' + json.data.total_amount + ' EGP');
          cart = [];
          updateCartBadge();
          toggleCartDrawer();
          loadProducts(activeCategory);
        } else {
          alert('Checkout failed: ' + (json.error || 'Server error'));
        }
      } catch (err) {
        alert('Network error during checkout');
      } finally {
        btn.textContent = 'Proceed to Checkout (EGP)';
        btn.disabled = false;
      }
    }

    // -------------------------------------------------------------
    // Smart Grocery Budget & Duration Planner (features/Recommendations)
    // -------------------------------------------------------------
    function openSmartPlannerModal() {
      document.getElementById('planner-modal-overlay').style.display = 'flex';
    }
    function closeSmartPlannerModal() {
      document.getElementById('planner-modal-overlay').style.display = 'none';
    }

    async function generateSmartBasket() {
      const budget = parseFloat(document.getElementById('plan-budget').value) || 2000;
      const durationDays = parseInt(document.getElementById('plan-duration').value, 10) || 30;
      const selectedCats = [];
      document.querySelectorAll('#planner-categories input:checked').forEach(c => selectedCats.push(c.value));

      try {
        const res = await fetch('/api/recommendations/smart-basket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget, duration_days: durationDays, categories: selectedCats })
        });
        const json = await res.json();
        if (json.success) {
          plannedBasketItems = json.items;
          document.getElementById('res-spent').textContent = json.total_spent_egp.toFixed(2) + ' EGP';
          document.getElementById('res-rate').textContent = json.daily_rate_egp.toFixed(2) + ' EGP/day';
          document.getElementById('res-buffer').textContent = json.remaining_buffer_egp.toFixed(2) + ' EGP';

          const listEl = document.getElementById('planner-items-list');
          listEl.innerHTML = json.items.map(it => \`
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
              <span>\${it.name_ar || it.name_en} × \${it.quantity}</span>
              <span style="color:var(--price-color);">\${it.subtotal.toFixed(2)} EGP</span>
            </div>
          \`).join('');

          document.getElementById('planner-results').style.display = 'block';
        } else {
          alert(json.error || 'Failed to calculate basket');
        }
      } catch (e) {
        alert('Network error calculating recommendation basket');
      }
    }

    function addAllPlannedToCart() {
      plannedBasketItems.forEach(it => {
        addToCart(it.product_id, it.name_en, it.unit_price, it.quantity);
      });
      closeSmartPlannerModal();
      toggleCartDrawer();
    }

    // -------------------------------------------------------------
    // 3D Holographic AI Voice Assistant (features/VOICE)
    // -------------------------------------------------------------
    let orbScene, orbCamera, orbRenderer, orbMesh;
    function init3DOrb() {
      if (orbRenderer) return;
      const container = document.getElementById('orb-container');
      const canvas = document.getElementById('orb-canvas');
      const width = container.clientWidth || 180;
      const height = container.clientHeight || 180;

      orbScene = new THREE.Scene();
      orbCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      orbCamera.position.z = 3.2;

      orbRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      orbRenderer.setSize(width, height);
      orbRenderer.setPixelRatio(window.devicePixelRatio);

      const geometry = new THREE.IcosahedronGeometry(1.0, 4);
      const material = new THREE.MeshPhongMaterial({
        color: 0x10B981,
        emissive: 0x06B6D4,
        emissiveIntensity: 0.5,
        wireframe: true,
        transparent: true,
        opacity: 0.85
      });
      orbMesh = new THREE.Mesh(geometry, material);
      orbScene.add(orbMesh);

      const light = new THREE.PointLight(0x38BDF8, 2, 50);
      light.position.set(2, 2, 3);
      orbScene.add(light);

      function animate() {
        requestAnimationFrame(animate);
        if (orbMesh) {
          orbMesh.rotation.x += isRecording ? 0.04 : 0.01;
          orbMesh.rotation.y += isRecording ? 0.05 : 0.015;
        }
        orbRenderer.render(orbScene, orbCamera);
      }
      animate();
    }

    function openVoiceModal() {
      document.getElementById('voice-modal-overlay').style.display = 'flex';
      setTimeout(init3DOrb, 50);
    }
    function closeVoiceModal() {
      document.getElementById('voice-modal-overlay').style.display = 'none';
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (recognition && isRecording) recognition.stop();
    }

    function toggleAudioMute() {
      isMuted = !isMuted;
      document.getElementById('mute-icon').textContent = isMuted ? '🔇' : '🔊';
      document.getElementById('mute-text').textContent = isMuted ? 'Sound MUTED' : 'Sound ON';
      if (isMuted && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }

    function speakText(text) {
      if (isMuted || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = storeLang === 'ar' ? 'ar-EG' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }

    function toggleVoiceRecording() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Web Speech API is not supported in this browser. Please use Chrome or Edge.');
        return;
      }
      if (isRecording) {
        recognition.stop();
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.lang = storeLang === 'ar' ? 'ar-EG' : 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        isRecording = true;
        document.getElementById('mic-icon').textContent = '⏹️';
        document.getElementById('mic-status').textContent = 'Listening... (جاري الاستماع)';
        if (orbMesh) orbMesh.material.color.setHex(0x06B6D4);
      };

      recognition.onresult = async (event) => {
        const text = event.results[0][0].transcript;
        document.getElementById('voice-transcript').textContent = 'You: ' + text;
        await processVoiceInput(text);
      };

      recognition.onerror = (e) => {
        console.error('Speech error:', e);
        document.getElementById('mic-status').textContent = 'Retry (حاول ثانية)';
      };

      recognition.onend = () => {
        isRecording = false;
        document.getElementById('mic-icon').textContent = '🔴';
        document.getElementById('mic-status').textContent = 'Start Voice (تحدث الآن)';
        if (orbMesh) orbMesh.material.color.setHex(0x10B981);
      };

      recognition.start();
    }

    async function processVoiceInput(text) {
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text })
        });
        const json = await res.json();
        if (json.success && json.data) {
          const ai = json.data;
          document.getElementById('voice-transcript').innerHTML = \`
            <div><b>You:</b> \${text}</div>
            <div style="color:var(--primary); margin-top:6px;"><b>Cyborg AI:</b> \${ai.message}</div>
          \`;
          speakText(ai.message);

          if (ai.intent === 'ADD_TO_CART' && ai.matched_products.length > 0) {
            const top = ai.matched_products[0];
            pendingVoiceItems = [{ product_id: top.id, name: top.name_ar || top.name_en, price: top.price, quantity: ai.entities.quantity || 1 }];
            document.getElementById('voice-pending-items').innerHTML = pendingVoiceItems.map(p => \`
              <div style="display:flex; justify-content:space-between; padding:4px 0;">
                <span>\${p.name} × \${p.quantity}</span>
                <span style="color:var(--price-color);">\${(p.price * p.quantity).toFixed(2)} EGP</span>
              </div>
            \`).join('');
            document.getElementById('voice-safety-box').style.display = 'block';
          }
        }
      } catch (err) {
        console.error('AI processing failed:', err);
      }
    }

    async function confirmVoiceOrder() {
      if (pendingVoiceItems.length === 0) return;
      try {
        const res = await fetch('/api/voice/order-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: pendingVoiceItems.map(p => ({ product_id: p.product_id, quantity: p.quantity })) })
        });
        const json = await res.json();
        if (json.success) {
          document.getElementById('voice-safety-box').style.display = 'none';
          document.getElementById('voice-confirmation-badge').style.display = 'block';
          speakText('تم تأكيد الطلب بنجاح وإرسال الفاتورة إلى بريدك الإلكتروني.');
          pendingVoiceItems = [];
          loadProducts(activeCategory);
        }
      } catch (e) {
        alert('Failed to place voice order');
      }
    }

    // Initialize catalog
    loadProducts();
  </script>
</body>
</html>`;

  sendHtml(res, html);
});

server.listen(PORT, () => {
  console.log(`Cyborg Customer Web Storefront listening on http://localhost:${PORT}`);
});
