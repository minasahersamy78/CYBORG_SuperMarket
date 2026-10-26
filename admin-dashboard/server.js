/**
 * Cyborg Supermarket - Administration Web Dashboard Server
 * Unified Cyber-Clean Emerald/Dark UI with Barcode Catalog (features/data-1 format)
 * and AI Voice / Recommendations Operations Monitor.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const reportsService = require('../backend/src/modules/reports/reports.service');
const productsService = require('../backend/src/modules/products/products.service');
const ordersService = require('../backend/src/modules/orders/orders.service');
const shiftsService = require('../backend/src/modules/shifts/shifts.service');
const inventoryService = require('../backend/src/modules/inventory/inventory.service');
const recommendationsService = require('../backend/src/modules/recommendations/recommendations.service');
const db = require('../backend/src/database/db');

const PORT = process.env.ADMIN_PORT || 3001;

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

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (pathname === '/api/overview') {
    const data = reportsService.getDashboardOverview();
    return sendJson(res, 200, data);
  }

  if (pathname === '/api/products') {
    const data = productsService.list(parsed.query);
    return sendJson(res, 200, data);
  }

  if (pathname === '/api/orders') {
    const data = ordersService.listOrders(parsed.query);
    return sendJson(res, 200, data);
  }

  const cancelMatch = pathname.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)\/cancel$/);
  if (req.method === 'POST' && cancelMatch) {
    const orderId = cancelMatch[1];
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let b = {};
      try { b = JSON.parse(body); } catch (_) {}
      const resData = ordersService.cancelOrder(orderId, b.reason || 'Admin Dashboard Cancel', { sub: 'admin', role: 'STORE_MANAGER' });
      return sendJson(res, resData.statusCode || 200, resData);
    });
    return;
  }

  if (pathname === '/api/shifts') {
    const shifts = db.query('SELECT * FROM shifts ORDER BY started_at DESC LIMIT 20;');
    return sendJson(res, 200, { success: true, data: shifts });
  }

  if (pathname === '/api/voice-orders') {
    const orders = db.query("SELECT * FROM orders WHERE source = 'VOICE_ASSISTANT' OR source = 'ONLINE' ORDER BY created_at DESC LIMIT 20;");
    return sendJson(res, 200, {
      success: true,
      data: orders,
      email_recipient: 'cyborgcoding1@gmail.com',
      recommendations_active: true
    });
  }

  if (pathname === '/api/audit-logs') {
    const logs = db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 25;');
    return sendJson(res, 200, { success: true, data: logs });
  }

  // Serve Single Page Admin Dashboard
  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyborg Supermarket — Enterprise Operations & AI Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #10B981;
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
      --danger: #EF4444;
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
    [data-theme="light"] .sidebar, [data-theme="light"] .header {
      background: #FFFFFF !important;
    }
    [data-theme="light"] .brand-title {
      background: none !important;
      -webkit-text-fill-color: #0F172A !important;
      color: #0F172A !important;
    }
    [data-theme="light"] .search-input {
      background: #FFFFFF !important;
      border-color: #CBD5E1 !important;
      color: #0F172A !important;
    }
    [data-theme="light"] th {
      background: #F1F5F9 !important;
      color: #475569 !important;
    }
    [data-theme="light"] tr:hover {
      background: #F8FAFC !important;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-surface);
      color: var(--text-main);
      font-family: var(--font-en);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
    }
    body[dir="rtl"] { font-family: var(--font-ar); }

    /* Sidebar */
    .sidebar {
      width: 270px;
      background: var(--bg-dark);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      box-shadow: 4px 0 20px rgba(0,0,0,0.3);
    }
    body[dir="rtl"] .sidebar { border-right: none; border-left: 1px solid var(--border); }
    .brand {
      padding: 24px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 20px; color: #042F2E;
    }
    .brand-title {
      font-size: 16px; font-weight: 800; letter-spacing: -0.5px;
      background: linear-gradient(135deg, #F8FAFC, #94A3B8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .nav { padding: 16px 12px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .nav-btn {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-radius: 10px;
      color: var(--text-muted); text-decoration: none;
      font-size: 13px; font-weight: 600; cursor: pointer;
      border: 1px solid transparent; background: transparent; width: 100%; text-align: left;
      transition: all 0.2s ease;
    }
    body[dir="rtl"] .nav-btn { text-align: right; }
    .nav-btn:hover {
      background: var(--bg-card);
      color: var(--text-main);
      border-color: var(--card-border);
    }
    .nav-btn.active {
      background: rgba(16, 185, 129, 0.15);
      color: var(--primary);
      border-color: rgba(16, 185, 129, 0.4);
      font-weight: 700;
    }

    /* Content Area */
    .main { flex: 1; display: flex; flex-direction: column; height: 100vh; overflow-y: auto; }
    .header {
      padding: 18px 32px;
      background: var(--bg-dark);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 40;
    }
    .header-actions { display: flex; align-items: center; gap: 14px; }
    .btn {
      padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border); background: var(--bg-card);
      color: var(--text-main); display: inline-flex; align-items: center; gap: 8px;
      transition: all 0.2s ease;
    }
    .btn:hover { background: var(--bg-card-hover); }
    .btn-primary { background: var(--primary); border-color: var(--primary); color: #042F2E; font-weight: 700; }
    .btn-primary:hover { background: #059669; }

    .badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #34D399; }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #FBBF24; }
    .badge-cyan { background: rgba(6, 182, 212, 0.2); color: #38BDF8; }

    /* Dashboard Grid */
    .dashboard-content { padding: 32px; flex: 1; }
    .metrics-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 20px; margin-bottom: 28px;
    }
    .metric-card {
      background: var(--bg-card); border: 1px solid var(--card-border);
      border-radius: 14px; padding: 22px;
      transition: transform 0.2s ease;
    }
    .metric-card:hover { transform: translateY(-2px); border-color: var(--primary); }
    .metric-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .metric-value { font-size: 28px; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px; }
    .metric-sub { font-size: 12px; color: var(--text-muted); margin-top: 6px; }

    /* Cards & Tables */
    .card {
      background: var(--bg-card); border: 1px solid var(--card-border);
      border-radius: 14px; padding: 24px; margin-bottom: 24px;
    }
    .card-title {
      font-size: 16px; font-weight: 700; margin-bottom: 16px;
      display: flex; justify-content: space-between; align-items: center;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--border);
      color: var(--text-muted); font-weight: 600; font-size: 12px; text-transform: uppercase;
    }
    body[dir="rtl"] th { text-align: right; }
    td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    tr:hover td { background: rgba(255,255,255,0.03); }

    /* Product Cards Grid (features/data-1 format) */
    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 18px;
      margin-top: 16px;
    }
    .admin-prod-card {
      background: #0D1424;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      text-align: center;
      transition: all 0.2s ease;
    }
    .admin-prod-card:hover {
      border-color: var(--accent-cyan);
      transform: translateY(-3px);
    }
    .admin-img-box {
      height: 130px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }
    .admin-img-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    /* Realistic Barcode Sticker */
    .barcode-sticker {
      background: #FFFFFF;
      border-radius: 6px;
      padding: 5px 8px 3px;
      margin-top: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      border: 1px solid #CBD5E1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .barcode-svg { width: 100%; height: 22px; display: block; }
    .barcode-digits {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
      letter-spacing: 1px;
    }

    .search-input {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-main); padding: 8px 16px; border-radius: 8px;
      font-size: 13px; width: 280px; outline: none;
    }
    .search-input:focus { border-color: var(--primary); }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <div class="brand-title">CYBORG SUPERMARKET</div>
        <div style="font-size: 11px; color: var(--text-muted);">Enterprise Operations HQ</div>
      </div>
    </div>
    <nav class="nav">
      <button class="nav-btn active" onclick="showTab('overview', this)">📊 Overview & Reports</button>
      <button class="nav-btn" onclick="showTab('products', this)">📦 Product Catalog (1,000 SKUs)</button>
      <button class="nav-btn" onclick="showTab('orders', this)">🛒 Order Management</button>
      <button class="nav-btn" onclick="showTab('voice', this)">🎙️ AI Voice & Recommendations</button>
      <button class="nav-btn" onclick="showTab('inventory', this)">⚠️ Inventory & Replenishment</button>
      <button class="nav-btn" onclick="showTab('shifts', this)">💵 Cashier Shifts (POS)</button>
      <button class="nav-btn" onclick="showTab('audit', this)">🛡️ Security & Audit Logs</button>
    </nav>
    <div style="padding: 16px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-muted);">
      <div>Active DB: <strong>data/cyborg_supermarket.db</strong></div>
      <div>REST API: <strong>http://localhost:3000</strong></div>
      <div style="margin-top:4px;">Voice Order Mail: <strong>cyborgcoding1@gmail.com</strong></div>
    </div>
  </aside>

  <!-- Main Content -->
  <div class="main">
    <header class="header">
      <h2 id="page-title" style="font-size: 18px; font-weight: 800;">Operational Overview</h2>
      <div class="header-actions">
        <input type="text" id="global-search" class="search-input" placeholder="Search catalog, barcodes..." oninput="handleSearch(this.value)">
        <button class="btn" id="theme-btn" onclick="toggleAdminTheme()" title="Toggle Dark/Light Mode">🌙 Dark</button>
        <button class="btn" onclick="toggleLanguage()">🌐 <span id="lang-btn-text">عربي / RTL</span></button>
        <button class="btn btn-primary" onclick="refreshCurrentTab()">🔄 Refresh Live Data</button>
      </div>
    </header>

    <div class="dashboard-content" id="content-area">
      <!-- Injected dynamically based on tab -->
    </div>
  </div>

  <script>
    let currentLang = 'en';
    let currentTab = 'overview';
    let cachedProducts = [];

    let currentAdminTheme = localStorage.getItem('cyborg_admin_theme') || 'dark';
    if (currentAdminTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    function toggleAdminTheme() {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('cyborg_admin_theme', 'dark');
        const b = document.getElementById('theme-btn');
        if (b) b.textContent = '🌙 Dark';
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('cyborg_admin_theme', 'light');
        const b = document.getElementById('theme-btn');
        if (b) b.textContent = '☀️ Light';
      }
    }

    function generateBarcodeSVG(code) {
      const barcodeStr = String(code || '622000000000').padStart(12, '0');
      let bars = '';
      let x = 6;
      for (let i = 0; i < barcodeStr.length; i++) {
        const d = parseInt(barcodeStr[i], 10) || 3;
        const w1 = (d % 3) + 1;
        const w2 = ((d + 1) % 2) + 1;
        bars += \`<rect x="\${x}" y="2" width="\${w1}" height="18" fill="#0F172A" />\`;
        x += w1 + 1;
        bars += \`<rect x="\${x}" y="2" width="\${w2}" height="18" fill="#0F172A" />\`;
        x += w2 + 2;
      }
      return \`
        <div class="barcode-sticker">
          <svg class="barcode-svg" viewBox="0 0 \${Math.max(x + 6, 120)} 22">
            \${bars}
          </svg>
          <div class="barcode-digits">\${barcodeStr}</div>
        </div>
      \`;
    }

    function toggleLanguage() {
      if (currentLang === 'en') {
        document.documentElement.setAttribute('dir', 'rtl');
        document.documentElement.setAttribute('lang', 'ar');
        document.getElementById('lang-btn-text').textContent = 'English / LTR';
        currentLang = 'ar';
      } else {
        document.documentElement.setAttribute('dir', 'ltr');
        document.documentElement.setAttribute('lang', 'en');
        document.getElementById('lang-btn-text').textContent = 'عربي / RTL';
        currentLang = 'en';
      }
      refreshCurrentTab();
    }

    function showTab(tab, btnEl) {
      currentTab = tab;
      if (btnEl) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btnEl.classList.add('active');
      }
      refreshCurrentTab();
    }

    function refreshCurrentTab() {
      if (currentTab === 'overview') loadOverview();
      else if (currentTab === 'products') loadProductsTab();
      else if (currentTab === 'orders') loadOrdersTab();
      else if (currentTab === 'voice') loadVoiceTab();
      else if (currentTab === 'inventory') loadInventoryTab();
      else if (currentTab === 'shifts') loadShiftsTab();
      else if (currentTab === 'audit') loadAuditTab();
    }

    async function loadOverview() {
      document.getElementById('page-title').textContent = 'Operational Overview & Sales Metrics';
      const container = document.getElementById('content-area');
      container.innerHTML = '<p>Loading live metrics...</p>';

      try {
        const res = await fetch('/api/overview');
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          container.innerHTML = \`
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Active Catalog Products</div>
                <div class="metric-value">\${d.catalog.total_active_products.toLocaleString()}</div>
                <div class="metric-sub">100% Genuine Excel Records</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Total Revenue</div>
                <div class="metric-value" style="color:var(--price-color);">\${d.sales_summary.total_revenue_egp.toFixed(2)} EGP</div>
                <div class="metric-sub">\${d.sales_summary.total_orders} Total Orders Processed</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Channel Distribution</div>
                <div class="metric-value" style="font-size:22px; color:var(--accent-cyan);">\${d.sales_summary.pos_transactions} POS / \${d.sales_summary.online_orders} Online</div>
                <div class="metric-sub">Voice & Web Automated Ingestion</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Low Stock Alerts</div>
                <div class="metric-value" style="color:#F87171;">\${d.inventory.total_low_stock_alerts}</div>
                <div class="metric-sub">Critical Replenishment Threshold</div>
              </div>
            </div>

            <div class="card">
              <div class="card-title">
                <span>Category Catalog Distribution</span>
                <span class="badge badge-success">100% Grounded</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:12px;">
                \${d.catalog.category_breakdown.map(c => {
                  const pct = ((c.product_count / d.catalog.total_active_products) * 100).toFixed(1);
                  return \`
                    <div>
                      <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
                        <strong>\${c.name_en} (\${c.name_ar})</strong>
                        <span>\${c.product_count} products (\${pct}%)</span>
                      </div>
                      <div style="height:8px; background:#1E293B; border-radius:4px; overflow:hidden;">
                        <div style="width:\${pct}%; height:100%; background:linear-gradient(90deg, var(--primary), var(--accent-cyan));"></div>
                      </div>
                    </div>
                  \`;
                }).join('')}
              </div>
            </div>
          \`;
        }
      } catch (e) {
        container.innerHTML = '<p style="color:#EF4444;">Failed to load overview data.</p>';
      }
    }

    async function loadProductsTab(filterQuery = '') {
      document.getElementById('page-title').textContent = 'Product Catalog (1,000 SKUs) · features/data-1 Format';
      const container = document.getElementById('content-area');
      container.innerHTML = '<p>Loading product catalog with barcode stickers...</p>';

      try {
        const res = await fetch('/api/products?limit=24' + (filterQuery ? '&q=' + encodeURIComponent(filterQuery) : ''));
        const json = await res.json();
        if (json.success && json.data) {
          cachedProducts = json.data;
          container.innerHTML = \`
            <div class="card">
              <div class="card-title">
                <span>Standardized Product Cards with Barcode Graphics</span>
                <span class="badge badge-cyan">Visual Format: features/data-1</span>
              </div>
              <div class="catalog-grid">
                \${json.data.map(p => \`
                  <div class="admin-prod-card">
                    <div class="admin-img-box">
                      <img src="\${p.image_url || 'https://via.placeholder.com/150'}" alt="\${p.name_en}" onerror="this.src='https://via.placeholder.com/150'">
                    </div>
                    <div style="font-size:11px; color:var(--accent-cyan); font-weight:700;">\${p.brand || 'Local Essentials'}</div>
                    <div style="font-size:13px; font-weight:700; min-height:36px; margin:4px 0;">\${currentLang === 'ar' ? p.name_ar : p.name_en}</div>
                    <div style="font-size:16px; font-weight:800; color:var(--price-color); margin-bottom:4px;">\${p.price.toFixed(2)} EGP</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">Stock: <b>\${p.available_quantity}</b> units</div>
                    \${generateBarcodeSVG(p.barcode)}
                  </div>
                \`).join('')}
              </div>
            </div>
          \`;
        }
      } catch (e) {
        container.innerHTML = '<p style="color:#EF4444;">Failed to load products.</p>';
      }
    }

    async function loadVoiceTab() {
      document.getElementById('page-title').textContent = '🎙️ AI Voice Orders & Recommendations Audit Log';
      const container = document.getElementById('content-area');
      container.innerHTML = '<p>Loading Voice AI activities...</p>';

      try {
        const res = await fetch('/api/voice-orders');
        const json = await res.json();
        if (json.success) {
          container.innerHTML = \`
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-label">Voice & AI Orders Engine</div>
                <div class="metric-value" style="color:var(--primary);">ACTIVE</div>
                <div class="metric-sub">Bilingual STT/TTS (Egyptian Arabic & English)</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Automatic Invoicing Recipient</div>
                <div class="metric-value" style="font-size:18px; color:var(--accent-cyan);">cyborgcoding1@gmail.com</div>
                <div class="metric-sub">Instant Dispatch on Order Confirmation</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Voiced Order Safety Protocol</div>
                <div class="metric-value" style="font-size:22px; color:var(--accent-amber);">ENFORCED</div>
                <div class="metric-sub">Stock Preserved Until Explicit Confirmation</div>
              </div>
            </div>

            <div class="card">
              <div class="card-title">
                <span>Recent AI Voice Orders & Synchronizations</span>
                <span class="badge badge-success">Audited</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Source</th>
                    <th>Subtotal</th>
                    <th>Total (14% VAT)</th>
                    <th>Payment</th>
                    <th>Invoice Dispatched</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  \${json.data.map(o => \`
                    <tr>
                      <td><b>#\${o.id}</b></td>
                      <td>\${o.customer_name || 'Voice Shopper'}</td>
                      <td><span class="badge \${o.source === 'VOICE_ASSISTANT' ? 'badge-cyan' : 'badge-success'}">\${o.source}</span></td>
                      <td>\${o.subtotal.toFixed(2)} EGP</td>
                      <td><b style="color:var(--price-color);">\${o.total_amount.toFixed(2)} EGP</b></td>
                      <td>\${o.payment_method}</td>
                      <td><span class="badge badge-success">Sent to cyborgcoding1@gmail.com</span></td>
                      <td style="color:var(--text-muted); font-size:12px;">\${o.created_at}</td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          \`;
        }
      } catch (e) {
        container.innerHTML = '<p style="color:#EF4444;">Failed to load voice orders audit.</p>';
      }
    }

    async function loadOrdersTab() {
      document.getElementById('page-title').textContent = 'Order Management';
      const container = document.getElementById('content-area');
      const res = await fetch('/api/orders?limit=20');
      const json = await res.json();
      if (json.success) {
        container.innerHTML = \`
          <div class="card">
            <div class="card-title">Recent Transactions Across POS & Online</div>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th><th>Customer</th><th>Source</th><th>Status</th><th>Total</th><th>Payment</th><th>Date</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                \${json.data.map(o => {
                  const isCancellable = ['CONFIRMED', 'PENDING', 'PREPARING', 'READY'].includes(o.status);
                  const isCancelled = o.status === 'CANCELLED';
                  let statusBadge = \`<span class="badge badge-success">\${o.status}</span>\`;
                  if (isCancelled) statusBadge = \`<span class="badge" style="background:rgba(239,68,68,0.2); color:#EF4444;">CANCELLED</span>\`;
                  else if (o.status === 'PENDING') statusBadge = \`<span class="badge" style="background:rgba(245,158,11,0.2); color:#F59E0B;">PENDING</span>\`;

                  return \`
                    <tr>
                      <td>#\${o.id}</td>
                      <td>\${o.customer_name || 'Walk-in'}</td>
                      <td><span class="badge badge-cyan">\${o.source}</span></td>
                      <td>\${statusBadge}</td>
                      <td><b style="color:var(--price-color);">\${o.total_amount.toFixed(2)} EGP</b></td>
                      <td>\${o.payment_method}</td>
                      <td style="color:var(--text-muted); font-size:12px;">\${o.created_at}</td>
                      <td>
                        \${isCancellable ? \`
                          <button class="btn btn-sm" style="background:#EF4444; color:white; padding:4px 10px; font-size:11px; border-radius:6px;" onclick="cancelOrderFromAdmin('\${o.id}')">Cancel & Restore Stock</button>
                        \` : (isCancelled ? '<span style="color:#EF4444; font-size:11px;">Restored</span>' : '<span style="color:#10B981; font-size:11px;">Completed</span>')}
                      </td>
                    </tr>
                  \`;
                }).join('')}
              </tbody>
            </table>
          </div>
        \`;
      }
    }

    async function cancelOrderFromAdmin(orderId) {
      if (!confirm('Are you sure you want to cancel order #' + orderId + '? All item quantities will be atomically restored to supermarket inventory.')) return;
      try {
        const res = await fetch('/api/orders/' + orderId + '/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Admin dashboard manager cancellation' })
        });
        const json = await res.json();
        if (json.success) {
          alert('Order #' + orderId + ' successfully cancelled and stock restored to inventory!');
          loadOrdersTab();
        } else {
          alert('Cancellation failed: ' + (json.error || 'Server error'));
        }
      } catch (e) {
        alert('Network error cancelling order');
      }
    }

    async function loadShiftsTab() {
      document.getElementById('page-title').textContent = 'Cashier Shifts & POS Audit';
      const container = document.getElementById('content-area');
      const res = await fetch('/api/shifts');
      const json = await res.json();
      if (json.success) {
        container.innerHTML = \`
          <div class="card">
            <div class="card-title">Terminal Shift Closures & Discrepancies</div>
            <table>
              <thead>
                <tr>
                  <th>Shift ID</th><th>Cashier</th><th>Terminal</th><th>Opening</th><th>Total Sales</th><th>Discrepancy</th><th>Closed</th>
                </tr>
              </thead>
              <tbody>
                \${json.data.map(s => \`
                  <tr>
                    <td><b>\${s.id}</b></td>
                    <td>\${s.cashier_name || 'Cashier'}</td>
                    <td><code>\${s.terminal_id}</code></td>
                    <td>\${s.opening_balance.toFixed(2)} EGP</td>
                    <td>\${s.total_sales.toFixed(2)} EGP</td>
                    <td style="color:\${s.discrepancy < 0 ? '#EF4444' : 'var(--price-color)'}; font-weight:700;">\${s.discrepancy.toFixed(2)} EGP</td>
                    <td><span class="badge \${s.is_closed ? 'badge-success' : 'badge-warning'}">\${s.is_closed ? 'CLOSED' : 'OPEN'}</span></td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>
        \`;
      }
    }

    async function loadInventoryTab() {
      document.getElementById('page-title').textContent = 'Inventory & Low Stock Alerts';
      const container = document.getElementById('content-area');
      const res = await fetch('/api/products?limit=100');
      const json = await res.json();
      if (json.success) {
        const lowStock = json.data.filter(p => p.available_quantity <= 15);
        container.innerHTML = \`
          <div class="card">
            <div class="card-title">Low Stock Replenishment Tracker (\${lowStock.length} Items)</div>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Barcode</th><th>Name</th><th>Category</th><th>Available Stock</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                \${lowStock.map(p => \`
                  <tr>
                    <td>#\${p.id}</td>
                    <td><code>\${p.barcode}</code></td>
                    <td>\${currentLang === 'ar' ? p.name_ar : p.name_en}</td>
                    <td>\${p.category_name_en}</td>
                    <td><b style="color:#EF4444;">\${p.available_quantity} units</b></td>
                    <td><span class="badge badge-warning">REORDER REQUIRED</span></td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>
        \`;
      }
    }

    async function loadAuditTab() {
      document.getElementById('page-title').textContent = 'Security & Audit Logs';
      const container = document.getElementById('content-area');
      const res = await fetch('/api/audit-logs');
      const json = await res.json();
      if (json.success) {
        container.innerHTML = \`
          <div class="card">
            <div class="card-title">Immutable Security Trail & System Events</div>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th><th>Action</th><th>User</th><th>Details</th>
                </tr>
              </thead>
              <tbody>
                \${json.data.map(l => \`
                  <tr>
                    <td style="font-size:12px; color:var(--text-muted);">\${l.created_at}</td>
                    <td><code>\${l.action}</code></td>
                    <td>\${l.user_id || 'System'}</td>
                    <td>\${l.details || '—'}</td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>
        \`;
      }
    }

    function handleSearch(query) {
      if (currentTab === 'products') {
        loadProductsTab(query);
      }
    }

    // Initial load
    loadOverview();
  </script>
</body>
</html>`;

  sendHtml(res, html);
});

server.listen(PORT, () => {
  console.log(`Cyborg Admin Dashboard listening on http://localhost:${PORT}`);
});
