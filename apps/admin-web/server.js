/**
 * Cyborg Supermarket - Administration Web Dashboard Server
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

  if (pathname === '/api/shifts') {
    const shifts = db.query('SELECT * FROM shifts ORDER BY started_at DESC LIMIT 20;');
    return sendJson(res, 200, { success: true, data: shifts });
  }

  // Serve Single Page Admin Dashboard
  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyborg Supermarket — Enterprise Operations Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0F766E;
      --primary-dark: #115E59;
      --accent: #F59E0B;
      --bg-dark: #0F172A;
      --bg-card: #1E293B;
      --bg-card-light: #334155;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --border: #334155;
      --danger: #EF4444;
      --success: #10B981;
      --font-en: 'Inter', -apple-system, sans-serif;
      --font-ar: 'Cairo', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: var(--font-en);
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
    }
    body[dir="rtl"] { font-family: var(--font-ar); }
    /* Sidebar */
    .sidebar {
      width: 260px;
      background: #0B1120;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    body[dir="rtl"] .sidebar { border-right: none; border-left: 1px solid var(--border); }
    .brand {
      padding: 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 20px; color: white;
    }
    .brand-title { font-size: 16px; font-weight: 700; letter-spacing: -0.5px; }
    .nav { padding: 16px 12px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .nav-btn {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border-radius: 8px;
      color: var(--text-muted); text-decoration: none;
      font-size: 14px; font-weight: 500; cursor: pointer;
      border: none; background: transparent; width: 100%; text-align: left;
      transition: all 0.2s;
    }
    body[dir="rtl"] .nav-btn { text-align: right; }
    .nav-btn:hover, .nav-btn.active {
      background: var(--bg-card);
      color: var(--text-main);
    }
    .nav-btn.active { color: #38BDF8; font-weight: 600; }
    /* Content Area */
    .main { flex: 1; display: flex; flex-direction: column; height: 100vh; overflow-y: auto; }
    .header {
      padding: 18px 32px;
      background: #0B1120;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
    }
    .header-actions { display: flex; align-items: center; gap: 16px; }
    .btn {
      padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: 1px solid var(--border); background: var(--bg-card);
      color: var(--text-main); display: inline-flex; align-items: center; gap: 8px;
    }
    .btn-primary { background: var(--primary); border-color: var(--primary); color: white; }
    .badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #34D399; }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #FBBF24; }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: #F87171; }
    /* Dashboard Grid */
    .dashboard-content { padding: 32px; flex: 1; }
    .metrics-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px; margin-bottom: 32px;
    }
    .metric-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 20px;
    }
    .metric-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }
    .metric-value { font-size: 28px; font-weight: 700; color: var(--text-main); letter-spacing: -0.5px; }
    .metric-sub { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
    /* Tables */
    .card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 24px; margin-bottom: 24px;
    }
    .card-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 12px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-weight: 600; }
    body[dir="rtl"] th { text-align: right; }
    td { padding: 12px; border-bottom: 1px solid rgba(51, 65, 85, 0.5); }
    tr:hover td { background: rgba(51, 65, 85, 0.3); }
    /* Search Bar */
    .search-input {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-main); padding: 8px 16px; border-radius: 8px;
      font-size: 13px; width: 320px; outline: none;
    }
    .search-input:focus { border-color: #38BDF8; }
  </style>
</head>
<body>
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div>
        <div class="brand-title">CYBORG SUPERMARKET</div>
        <div style="font-size: 11px; color: var(--text-muted);">Operations & Admin HQ</div>
      </div>
    </div>
    <nav class="nav">
      <button class="nav-btn active" onclick="showTab('overview')">📊 Overview & Reports</button>
      <button class="nav-btn" onclick="showTab('products')">📦 Product Catalog (1,000)</button>
      <button class="nav-btn" onclick="showTab('orders')">🛒 Order Management</button>
      <button class="nav-btn" onclick="showTab('inventory')">⚠️ Inventory & Alerts</button>
      <button class="nav-btn" onclick="showTab('shifts')">💵 Cashier Shifts (POS)</button>
      <button class="nav-btn" onclick="showTab('audit')">🛡️ Security & Audit Logs</button>
    </nav>
    <div style="padding: 16px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-muted);">
      <div>Database: <strong>data/cyborg_supermarket.db</strong></div>
      <div>Backend API: <strong>http://localhost:3000</strong></div>
    </div>
  </aside>

  <!-- Main Content -->
  <div class="main">
    <header class="header">
      <h2 id="page-title" style="font-size: 18px; font-weight: 700;">Operational Overview</h2>
      <div class="header-actions">
        <input type="text" id="global-search" class="search-input" placeholder="Search catalog, barcodes, orders..." oninput="handleSearch(this.value)">
        <button class="btn" onclick="toggleLanguage()">🌐 <span id="lang-btn-text">عربي / RTL</span></button>
        <button class="btn btn-primary" onclick="loadDashboard()">🔄 Refresh Live Data</button>
      </div>
    </header>

    <div class="dashboard-content" id="content-area">
      <!-- Live Metrics Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Active Catalog Products</div>
          <div class="metric-value" id="val-products">1,000</div>
          <div class="metric-sub">5 Categories · 143 Egyptian Brands</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Revenue</div>
          <div class="metric-value" id="val-revenue">0.00 EGP</div>
          <div class="metric-sub">Across POS & Mobile Orders</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Orders Handled</div>
          <div class="metric-value" id="val-orders">0</div>
          <div class="metric-sub" id="val-orders-sub">0 POS · 0 Online</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Low Stock Alerts</div>
          <div class="metric-value" style="color: #F87171;" id="val-alerts">0</div>
          <div class="metric-sub">Items requiring replenishment</div>
        </div>
      </div>

      <!-- Categories Breakdown -->
      <div class="card">
        <div class="card-title">
          <span>Catalog Distribution by Category</span>
          <span class="badge badge-success">Verified Real Dataset</span>
        </div>
        <div id="category-bars" style="display: flex; flex-direction: column; gap: 12px;"></div>
      </div>

      <!-- Products Sample Table -->
      <div class="card">
        <div class="card-title">
          <span>Real Imported Product Catalog (Sample)</span>
          <span style="font-size: 12px; color: var(--text-muted);">Source: super_market(1).xlsx</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Barcode</th>
              <th>Arabic Name</th>
              <th>English Name</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Price</th>
              <th>Available Stock</th>
            </tr>
          </thead>
          <tbody id="products-table-body">
            <tr><td colspan="8" style="text-align: center;">Loading real products from database...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let currentLang = 'en';
    let currentTab = 'overview';

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
    }

    async function loadDashboard() {
      try {
        const res = await fetch('/api/overview');
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          document.getElementById('val-products').textContent = d.catalog.total_active_products.toLocaleString();
          document.getElementById('val-revenue').textContent = d.sales_summary.total_revenue_egp.toFixed(2) + ' EGP';
          document.getElementById('val-orders').textContent = d.sales_summary.total_orders;
          document.getElementById('val-orders-sub').textContent = \`\${d.sales_summary.pos_transactions} POS · \${d.sales_summary.online_orders} Online\`;
          document.getElementById('val-alerts').textContent = d.inventory.total_low_stock_alerts;

          // Render Category Bars
          const barsDiv = document.getElementById('category-bars');
          barsDiv.innerHTML = d.catalog.category_breakdown.map(c => {
            const pct = ((c.product_count / d.catalog.total_active_products) * 100).toFixed(1);
            return \`
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
                  <strong>\${c.name_en}</strong>
                  <span>\${c.product_count} products (\${pct}%)</span>
                </div>
                <div style="height: 8px; background: var(--bg-card-light); border-radius: 4px; overflow: hidden;">
                  <div style="width: \${pct}%; height: 100%; background: linear-gradient(90deg, var(--primary), #38BDF8);"></div>
                </div>
              </div>
            \`;
          }).join('');
        }

        // Load Products Table
        const prodRes = await fetch('/api/products?limit=8');
        const prodJson = await prodRes.json();
        if (prodJson.success && prodJson.data) {
          const tbody = document.getElementById('products-table-body');
          tbody.innerHTML = prodJson.data.map(p => \`
            <tr>
              <td>#\${p.id}</td>
              <td><code>\${p.barcode}</code></td>
              <td style="font-family: var(--font-ar);">\${p.name_ar}</td>
              <td>\${p.name_en}</td>
              <td><span class="badge badge-success">\${p.category_name_en}</span></td>
              <td>\${p.brand || '—'}</td>
              <td><strong>\${p.price.toFixed(2)} EGP</strong></td>
              <td>\${p.available_quantity} units</td>
            </tr>
          \`).join('');
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function handleSearch(term) {
      if (!term || term.length < 2) {
        return loadDashboard();
      }
      const prodRes = await fetch('/api/products?limit=15&q=' + encodeURIComponent(term));
      const prodJson = await prodRes.json();
      if (prodJson.success && prodJson.data) {
        const tbody = document.getElementById('products-table-body');
        tbody.innerHTML = prodJson.data.map(p => \`
          <tr>
            <td>#\${p.id}</td>
            <td><code>\${p.barcode}</code></td>
            <td style="font-family: var(--font-ar);">\${p.name_ar}</td>
            <td>\${p.name_en}</td>
            <td><span class="badge badge-success">\${p.category_name_en}</span></td>
            <td>\${p.brand || '—'}</td>
            <td><strong>\${p.price.toFixed(2)} EGP</strong></td>
            <td>\${p.available_quantity} units</td>
          </tr>
        \`).join('');
      }
    }

    loadDashboard();
  </script>
</body>
</html>`;

  sendHtml(res, html);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`CYBORG ADMIN DASHBOARD RUNNING AT: http://localhost:${PORT}`);
  console.log(`================================================================`);
});

module.exports = server;
