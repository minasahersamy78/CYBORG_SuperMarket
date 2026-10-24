/**
 * Cyborg Supermarket - Customer Web Storefront Server
 * Fully functional bilingual shopping experience with AI shopping assistant
 */

const http = require('http');
const url = require('url');

const productsService = require('../backend/src/modules/products/products.service');
const cartService = require('../backend/src/modules/cart/cart.service');
const ordersService = require('../backend/src/modules/orders/orders.service');
const aiEngineService = require('../backend/src/modules/ai-engine/ai-engine.service');

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
  <title>Cyborg Supermarket — Omnichannel Shopping</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0F766E;
      --primary-hover: #115E59;
      --accent: #F59E0B;
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --text: #0F172A;
      --text-muted: #64748B;
      --border: #E2E8F0;
      --font-en: 'Inter', sans-serif;
      --font-ar: 'Cairo', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg); color: var(--text); font-family: var(--font-en);
      display: flex; flex-direction: column; min-height: 100vh;
    }
    body[dir="rtl"] { font-family: var(--font-ar); }
    /* Navbar */
    .nav {
      background: #0B1120; color: white; padding: 16px 32px;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 50; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 20px; }
    .brand span { color: #38BDF8; }
    .search-bar { display: flex; align-items: center; background: white; border-radius: 999px; padding: 4px 16px; width: 440px; }
    .search-bar input { border: none; outline: none; width: 100%; font-size: 14px; padding: 6px; }
    .nav-actions { display: flex; align-items: center; gap: 16px; }
    .btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-cart { background: #38BDF8; color: #0B1120; font-weight: 700; position: relative; }
    .cart-badge { position: absolute; top: -6px; right: -6px; background: #EF4444; color: white; font-size: 11px; padding: 2px 6px; border-radius: 999px; }
    /* Hero Banner */
    .hero {
      background: linear-gradient(135deg, #0F766E 0%, #1E3A8A 100%);
      color: white; padding: 36px 32px; text-align: center;
    }
    .hero h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
    .hero p { opacity: 0.9; font-size: 15px; }
    /* Category Filter Tabs */
    .category-tabs {
      background: white; border-bottom: 1px solid var(--border);
      padding: 12px 32px; display: flex; gap: 8px; overflow-x: auto;
    }
    .cat-pill {
      padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 600;
      border: 1px solid var(--border); background: white; cursor: pointer;
      white-space: nowrap; transition: all 0.2s;
    }
    .cat-pill.active { background: var(--primary); color: white; border-color: var(--primary); }
    /* Product Grid */
    .container { max-width: 1320px; margin: 0 auto; padding: 32px 24px; flex: 1; width: 100%; }
    .product-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 24px;
    }
    .product-card {
      background: white; border: 1px solid var(--border); border-radius: 14px;
      overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s;
    }
    .product-card:hover { transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08); }
    .img-box {
      height: 180px; background: #F1F5F9; display: flex; align-items: center; justify-content: center;
      position: relative; overflow: hidden;
    }
    .img-box img { max-height: 160px; max-width: 90%; object-fit: contain; }
    .card-body { padding: 16px; display: flex; flex-direction: column; flex: 1; }
    .prod-brand { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
    .prod-name { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; margin-bottom: 8px; flex: 1; }
    .prod-price { font-size: 18px; font-weight: 800; color: var(--primary); margin-bottom: 12px; }
    .prod-size { font-size: 12px; color: var(--text-muted); font-weight: 500; }
    /* Cart Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100;
      display: none; align-items: center; justify-content: flex-end;
    }
    .modal-drawer {
      background: white; width: 440px; height: 100%; padding: 24px;
      display: flex; flex-direction: column; box-shadow: -4px 0 24px rgba(0,0,0,0.15);
    }
    .drawer-title { font-size: 18px; font-weight: 700; border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    .cart-items-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .cart-row { display: flex; gap: 12px; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #F1F5F9; }
    .cart-footer { border-top: 1px solid var(--border); padding-top: 16px; }
    /* AI Assistant Pill */
    .ai-bubble {
      position: fixed; bottom: 24px; right: 24px; background: #0B1120;
      color: white; border: 2px solid #38BDF8; border-radius: 999px;
      padding: 12px 24px; display: flex; align-items: center; gap: 12px;
      font-weight: 700; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 90;
    }
  </style>
</head>
<body>
  <!-- Nav -->
  <header class="nav">
    <div class="brand">⚡ CYBORG <span>SUPERMARKET</span></div>
    <div class="search-bar">
      <input type="text" id="store-search" placeholder="Search 1,000 products, e.g. 'لبن جهينة' or 'Dina Farms'..." oninput="searchCatalog(this.value)">
    </div>
    <div class="nav-actions">
      <button class="btn" style="background:#1E293B; color:white;" onclick="toggleStoreLang()"><span id="lang-indicator">عربي / RTL</span></button>
      <button class="btn btn-cart" onclick="toggleCartDrawer()">🛒 Cart (<span id="cart-count">0</span>)</button>
    </div>
  </header>

  <!-- Hero -->
  <div class="hero">
    <h1 id="hero-title">Omnichannel Egyptian Supermarket Catalog</h1>
    <p id="hero-sub">1,000 real products sourced directly from Cairo retail operations · Live stock & local pricing in EGP</p>
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
      <p style="padding: 32px; grid-column: 1/-1; text-align: center;">Loading real catalog from database...</p>
    </div>
  </main>

  <!-- Cart Drawer -->
  <div class="modal-overlay" id="cart-drawer-overlay" onclick="if(event.target===this) toggleCartDrawer()">
    <div class="modal-drawer">
      <div class="drawer-title">
        <span>Shopping Cart</span>
        <button onclick="toggleCartDrawer()" style="background:none; border:none; font-size:18px; cursor:pointer;">✕</button>
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
        <div style="display:flex; justify-content:space-between; margin-bottom: 18px; font-size:18px; font-weight:800; color:var(--primary);">
          <span>Total</span>
          <span id="cart-total">0.00 EGP</span>
        </div>
        <button class="btn btn-primary" style="width:100%; padding:14px; font-size:15px;" onclick="checkoutOrder()">Proceed to Checkout (EGP)</button>
      </div>
    </div>
  </div>

  <!-- AI Voice Shopping Pill -->
  <div class="ai-bubble" onclick="openAIAssistant()">
    <span>🎙️ AI Assistant (لهجة مصرية)</span>
  </div>

  <script>
    let activeCategory = null;
    let storeLang = 'en';
    let cart = [];

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
      let endpoint = '/api/products?limit=24';
      if (catId) endpoint += '&category_id=' + catId;
      if (query) endpoint += '&q=' + encodeURIComponent(query);

      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success && json.data) {
        window.lastLoadedProducts = json.data;
        renderProducts(json.data);
      }
    }

    function renderProducts(items) {
      const container = document.getElementById('product-container');
      if (items.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 48px;">No matching products found.</p>';
        return;
      }
      container.innerHTML = items.map(p => {
        const title = storeLang === 'ar' ? p.name_ar : p.name_en;
        const img = p.image_url || 'https://via.placeholder.com/200?text=Cyborg+Supermarket';
        return \`
          <div class="product-card">
            <div class="img-box">
              <img src="\${img}" alt="\${p.name_en}" onerror="this.src='https://via.placeholder.com/200?text=Product'">
            </div>
            <div class="card-body">
              <div class="prod-brand">\${p.brand || 'Local Essentials'}</div>
              <div class="prod-name">\${title}</div>
              <div class="prod-size">\${p.size || ''} · \${p.format}</div>
              <div class="prod-price">\${p.price.toFixed(2)} EGP</div>
              <button class="btn btn-primary" onclick="addToCart(\${p.id}, '\${p.name_en.replace(/'/g, "")}', \${p.price})">+ Add to Cart</button>
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

    function addToCart(id, name, price) {
      const exist = cart.find(x => x.product_id === id);
      if (exist) {
        exist.quantity++;
      } else {
        cart.push({ product_id: id, name, price, quantity: 1 });
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
      listEl.innerHTML = cart.map(item => {
        const lineTotal = item.price * item.quantity;
        sub += lineTotal;
        return \`
          <div class="cart-row">
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600;">\${item.name}</div>
              <div style="font-size: 12px; color: var(--text-muted);">\${item.quantity} x \${item.price.toFixed(2)} EGP</div>
            </div>
            <div style="font-weight: 700; font-size: 13px;">\${lineTotal.toFixed(2)} EGP</div>
          </div>
        \`;
      }).join('');

      const tax = sub * 0.14;
      const total = sub + tax;
      document.getElementById('cart-subtotal').textContent = sub.toFixed(2) + ' EGP';
      document.getElementById('cart-tax').textContent = tax.toFixed(2) + ' EGP';
      document.getElementById('cart-total').textContent = total.toFixed(2) + ' EGP';
    }

    async function checkoutOrder() {
      if (cart.length === 0) return alert('Your cart is empty');
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(x => ({ product_id: x.product_id, quantity: x.quantity })),
          payment_method: 'CASH',
          delivery_address: 'New Cairo Flagship Zone'
        })
      });
      const json = await res.json();
      if (json.success) {
        alert(\`Order \${json.data.id} confirmed! Total: \${json.data.total_amount} EGP. Status: \${json.data.status}\`);
        cart = [];
        updateCartBadge();
        toggleCartDrawer();
      } else {
        alert('Checkout error: ' + (json.error || 'Failed to place order'));
      }
    }

    async function openAIAssistant() {
      const promptText = prompt('تحدث أو اكتب طلبك باللهجة المصرية (مثال: عايز لبن جهينه كامل الدسم، أو بكام السمنة البلدي):', 'عايز لبن كامل الدسم');
      if (!promptText) return;
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: promptText })
      });
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        let msg = \`المساعد الذكي: \${d.message}\\n\\nالنية المكتشفة: \${d.intent} (دقة: \${(d.confidence*100).toFixed(0)}%)\\n\\n\`;
        if (d.matched_products && d.matched_products.length > 0) {
          msg += 'المنتجات المطابقة من قاعدة البيانات:\\n' + d.matched_products.map((p, i) => \`\${i+1}. \${p.name_ar} (\${p.price} ج.م)\`).join('\\n');
        }
        alert(msg);
        if (d.matched_products && d.matched_products.length > 0) {
          window.lastLoadedProducts = d.matched_products;
          renderProducts(d.matched_products);
        }
      }
    }

    loadProducts();
  </script>
</body>
</html>`;

  sendHtml(res, html);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`CYBORG CUSTOMER STOREFRONT RUNNING AT: http://localhost:${PORT}`);
  console.log(`================================================================`);
});

module.exports = server;
