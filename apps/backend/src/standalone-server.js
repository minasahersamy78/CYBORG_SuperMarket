/**
 * Cyborg Supermarket - Core Production API Server
 * Modular, Clean Architecture HTTP API Server
 */

const http = require('http');
const url = require('url');

const authService = require('./modules/auth/auth.service');
const productsService = require('./modules/products/products.service');
const inventoryService = require('./modules/inventory/inventory.service');
const ordersService = require('./modules/orders/orders.service');
const cartService = require('./modules/cart/cart.service');
const shiftsService = require('./modules/shifts/shifts.service');
const syncService = require('./modules/sync/sync.service');
const aiEngineService = require('./modules/ai-engine/ai-engine.service');
const reportsService = require('./modules/reports/reports.service');
const db = require('./database/db');

const PORT = process.env.APP_PORT || 3000;
const API_PREFIX = '/api/v1';

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Idempotency-Key',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Idempotency-Key'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  // Extract auth user if token present
  const authHeader = req.headers['authorization'];
  const actorUser = authService.validateToken(authHeader);

  try {
    // -------------------------------------------------------------
    // Health & Readiness
    // -------------------------------------------------------------
    if (pathname === '/health' || pathname === `${API_PREFIX}/health`) {
      const dbCheck = db.getOne('SELECT 1 as alive;');
      return sendJson(res, 200, {
        status: 'UP',
        timestamp: new Date().toISOString(),
        database: dbCheck && dbCheck.alive === 1 ? 'CONNECTED' : 'DISCONNECTED',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    }

    // -------------------------------------------------------------
    // OpenAPI / Swagger Contract Documentation
    // -------------------------------------------------------------
    if (pathname === `${API_PREFIX}/docs` || pathname === '/api/docs') {
      const docs = {
        openapi: '3.0.0',
        info: {
          title: 'Cyborg Supermarket Core API',
          version: '1.0.0',
          description: 'Production Omnichannel Supermarket API with Egyptian Arabic AI Assistant and Desktop POS Synchronization'
        },
        servers: [{ url: `http://localhost:${PORT}${API_PREFIX}` }],
        paths: {
          '/health': { get: { summary: 'Health check' } },
          '/auth/login': { post: { summary: 'User / Cashier login' } },
          '/auth/register': { post: { summary: 'Customer registration' } },
          '/auth/refresh': { post: { summary: 'Refresh access token' } },
          '/products': { get: { summary: 'Browse & search product catalog' } },
          '/products/{id}': { get: { summary: 'Product details by ID' } },
          '/products/barcode/{barcode}': { get: { summary: 'Fast barcode lookup for POS scanner' } },
          '/categories': { get: { summary: 'Get category & subcategory tree' } },
          '/inventory/{productId}': { get: { summary: 'Get product stock balance' } },
          '/inventory/adjust': { post: { summary: 'Adjust inventory quantity (RBAC)' } },
          '/orders': {
            post: { summary: 'Create order (POS / Online / Family Cart)' },
            get: { summary: 'List orders' }
          },
          '/orders/{id}': { get: { summary: 'Order details' } },
          '/orders/{id}/status': { put: { summary: 'Update order state transition' } },
          '/orders/{id}/refund': { post: { summary: 'Process order refund' } },
          '/cart/{cartId}': { get: { summary: 'Get cart with budget tracking' } },
          '/cart/{cartId}/items': { post: { summary: 'Add item to cart' } },
          '/shifts/start': { post: { summary: 'Open cashier shift' } },
          '/shifts/{id}/close': { put: { summary: 'Close cashier shift with discrepancy audit' } },
          '/shifts/{id}/summary': { get: { summary: 'Get shift summary' } },
          '/sync/delta': { get: { summary: 'Get delta sync events' } },
          '/sync/ingest': { post: { summary: 'Batch upload offline POS transactions' } },
          '/ai/voice': { post: { summary: 'Egyptian Arabic dialect voice/text parsing' } },
          '/ai/substitutions/{productId}': { get: { summary: 'Get out-of-stock product substitutions' } },
          '/ai/pantry/suggestions': { get: { summary: 'Get smart grocery replenishment list' } },
          '/reports/dashboard': { get: { summary: 'Real-time database analytics overview' } }
        }
      };
      return sendJson(res, 200, docs);
    }

    // -------------------------------------------------------------
    // Auth Endpoints
    // -------------------------------------------------------------
    if (method === 'POST' && pathname === `${API_PREFIX}/auth/login`) {
      const body = await parseBody(req);
      const result = authService.login(body.username_or_email || body.email || body.phone, body.password);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'POST' && pathname === `${API_PREFIX}/auth/register`) {
      const body = await parseBody(req);
      const result = authService.register(body);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'POST' && pathname === `${API_PREFIX}/auth/refresh`) {
      const body = await parseBody(req);
      const result = authService.refreshToken(body.refresh_token);
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // Product Catalog Endpoints
    // -------------------------------------------------------------
    if (method === 'GET' && pathname === `${API_PREFIX}/products`) {
      const result = productsService.list(query);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'GET' && pathname === `${API_PREFIX}/categories`) {
      const result = productsService.getCategories();
      return sendJson(res, result.statusCode, result);
    }

    const barcodeMatch = pathname.match(new RegExp(`^${API_PREFIX}/products/barcode/(.+)$`));
    if (method === 'GET' && barcodeMatch) {
      const barcode = decodeURIComponent(barcodeMatch[1]);
      const result = productsService.getByBarcode(barcode);
      return sendJson(res, result.statusCode, result);
    }

    const prodIdMatch = pathname.match(new RegExp(`^${API_PREFIX}/products/(\\d+)$`));
    if (method === 'GET' && prodIdMatch) {
      const id = parseInt(prodIdMatch[1], 10);
      const result = productsService.getById(id);
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // Inventory Endpoints
    // -------------------------------------------------------------
    const invMatch = pathname.match(new RegExp(`^${API_PREFIX}/inventory/(\\d+)$`));
    if (method === 'GET' && invMatch) {
      const id = parseInt(invMatch[1], 10);
      const result = inventoryService.getBalance(id, query.store_id || 1);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'POST' && pathname === `${API_PREFIX}/inventory/adjust`) {
      if (!authService.checkPermission(actorUser, ['INVENTORY_OPERATOR', 'STORE_MANAGER', 'SUPER_ADMIN'])) {
        return sendJson(res, 403, { success: false, statusCode: 403, error: 'Forbidden: Insufficient privileges to adjust inventory' });
      }
      const body = await parseBody(req);
      const result = inventoryService.adjustStock(body.product_id, body.delta_quantity, body.reason, actorUser ? actorUser.sub : 'operator');
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'GET' && pathname === `${API_PREFIX}/inventory/alerts/low-stock`) {
      const result = inventoryService.getLowStockAlerts(query.store_id || 1);
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // Order & Checkout Endpoints
    // -------------------------------------------------------------
    if (method === 'POST' && pathname === `${API_PREFIX}/orders`) {
      const body = await parseBody(req);
      const idempotencyKey = req.headers['idempotency-key'] || body.idempotency_key;
      const orderDto = { ...body, idempotency_key: idempotencyKey };
      const result = ordersService.createOrder(orderDto, actorUser);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'GET' && pathname === `${API_PREFIX}/orders`) {
      const result = ordersService.listOrders(query);
      return sendJson(res, result.statusCode, result);
    }

    const orderIdMatch = pathname.match(new RegExp(`^${API_PREFIX}/orders/([a-zA-Z0-9_-]+)$`));
    if (method === 'GET' && orderIdMatch) {
      const orderId = orderIdMatch[1];
      const result = ordersService.getOrderById(orderId);
      return sendJson(res, result.statusCode, result);
    }

    const orderStatusMatch = pathname.match(new RegExp(`^${API_PREFIX}/orders/([a-zA-Z0-9_-]+)/status$`));
    if (method === 'PUT' && orderStatusMatch) {
      if (!authService.checkPermission(actorUser, ['CASHIER', 'STORE_MANAGER', 'SUPER_ADMIN'])) {
        return sendJson(res, 403, { success: false, statusCode: 403, error: 'Forbidden: Cannot alter order status' });
      }
      const orderId = orderStatusMatch[1];
      const body = await parseBody(req);
      const result = ordersService.updateStatus(orderId, body.status, actorUser);
      return sendJson(res, result.statusCode, result);
    }

    const orderRefundMatch = pathname.match(new RegExp(`^${API_PREFIX}/orders/([a-zA-Z0-9_-]+)/refund$`));
    if (method === 'POST' && orderRefundMatch) {
      if (!authService.checkPermission(actorUser, ['STORE_MANAGER', 'SUPER_ADMIN', 'CASHIER'])) {
        return sendJson(res, 403, { success: false, statusCode: 403, error: 'Forbidden: Insufficient privileges for refunds' });
      }
      const orderId = orderRefundMatch[1];
      const body = await parseBody(req);
      const result = ordersService.processRefund(orderId, body.reason, actorUser);
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // Shopping Cart & Family Cart Endpoints
    // -------------------------------------------------------------
    const cartDetailsMatch = pathname.match(new RegExp(`^${API_PREFIX}/cart/([a-zA-Z0-9_-]+)$`));
    if (method === 'GET' && cartDetailsMatch) {
      const cartId = cartDetailsMatch[1];
      const result = cartService.getOrCreateCart(cartId, actorUser ? actorUser.sub : null);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'POST' && pathname === `${API_PREFIX}/cart`) {
      const body = await parseBody(req);
      const result = cartService.getOrCreateCart(null, actorUser ? actorUser.sub : null, body.is_family_cart, body.budget_limit);
      return sendJson(res, result.statusCode, result);
    }

    const cartAddMatch = pathname.match(new RegExp(`^${API_PREFIX}/cart/([a-zA-Z0-9_-]+)/items$`));
    if (method === 'POST' && cartAddMatch) {
      const cartId = cartAddMatch[1];
      const body = await parseBody(req);
      const result = cartService.addItem(cartId, body.product_id, body.quantity || 1, actorUser ? actorUser.sub : null);
      return sendJson(res, result.statusCode, result);
    }

    const cartItemMatch = pathname.match(new RegExp(`^${API_PREFIX}/cart/([a-zA-Z0-9_-]+)/items/(\\d+)$`));
    if (method === 'PUT' && cartItemMatch) {
      const cartId = cartItemMatch[1];
      const productId = parseInt(cartItemMatch[2], 10);
      const body = await parseBody(req);
      const result = cartService.updateItemQuantity(cartId, productId, body.quantity);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'DELETE' && cartItemMatch) {
      const cartId = cartItemMatch[1];
      const productId = parseInt(cartItemMatch[2], 10);
      const result = cartService.removeItem(cartId, productId);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'DELETE' && cartDetailsMatch) {
      const cartId = cartDetailsMatch[1];
      const result = cartService.clearCart(cartId);
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // POS Cashier Shifts Endpoints
    // -------------------------------------------------------------
    if (method === 'POST' && pathname === `${API_PREFIX}/shifts/start`) {
      if (!authService.checkPermission(actorUser, ['CASHIER', 'STORE_MANAGER', 'SUPER_ADMIN'])) {
        return sendJson(res, 403, { success: false, statusCode: 403, error: 'Forbidden: Cashier authorization required' });
      }
      const body = await parseBody(req);
      const result = shiftsService.startShift(body, actorUser);
      return sendJson(res, result.statusCode, result);
    }

    const shiftCloseMatch = pathname.match(new RegExp(`^${API_PREFIX}/shifts/([a-zA-Z0-9_-]+)/close$`));
    if (method === 'PUT' && shiftCloseMatch) {
      const shiftId = shiftCloseMatch[1];
      const body = await parseBody(req);
      const result = shiftsService.closeShift(shiftId, body.actual_counted_balance, body.notes);
      return sendJson(res, result.statusCode, result);
    }

    const shiftSummaryMatch = pathname.match(new RegExp(`^${API_PREFIX}/shifts/([a-zA-Z0-9_-]+)/summary$`));
    if (method === 'GET' && shiftSummaryMatch) {
      const shiftId = shiftSummaryMatch[1];
      const result = shiftsService.getShiftSummary(shiftId);
      return sendJson(res, result.statusCode, result);
    }

    const activeShiftMatch = pathname.match(new RegExp(`^${API_PREFIX}/shifts/active/([a-zA-Z0-9_-]+)$`));
    if (method === 'GET' && activeShiftMatch) {
      const termId = activeShiftMatch[1];
      const result = shiftsService.getActiveShift(termId);
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // Cloud-Local POS Synchronization Endpoints
    // -------------------------------------------------------------
    if (method === 'GET' && pathname === `${API_PREFIX}/sync/delta`) {
      const lastId = parseInt(query.last_id || 0, 10);
      const result = syncService.getDeltaEvents(lastId, query.limit || 100);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'POST' && pathname === `${API_PREFIX}/sync/ingest`) {
      const body = await parseBody(req);
      const result = syncService.ingestBatch(body.terminal_id || 'TERM-01', body.events || []);
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // AI Shopping Assistant & Egyptian Voice
    // -------------------------------------------------------------
    if (method === 'POST' && pathname === `${API_PREFIX}/ai/voice`) {
      const body = await parseBody(req);
      const textQuery = body.text_prompt || body.query || '';
      const result = aiEngineService.parseVoiceOrTextQuery(textQuery, body.locale || 'ar-EG');
      return sendJson(res, 200, { success: true, statusCode: 200, data: result });
    }

    const subMatch = pathname.match(new RegExp(`^${API_PREFIX}/ai/substitutions/(\\d+)$`));
    if (method === 'GET' && subMatch) {
      const prodId = parseInt(subMatch[1], 10);
      const result = aiEngineService.getSubstitutions(prodId);
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'GET' && pathname === `${API_PREFIX}/ai/pantry/suggestions`) {
      const result = aiEngineService.getPantrySuggestions(actorUser ? actorUser.sub : null);
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // Reports & Management Dashboard
    // -------------------------------------------------------------
    if (method === 'GET' && pathname === `${API_PREFIX}/reports/dashboard`) {
      const result = reportsService.getDashboardOverview();
      return sendJson(res, result.statusCode, result);
    }

    if (method === 'GET' && pathname === `${API_PREFIX}/reports/sales`) {
      const result = reportsService.getSalesReport();
      return sendJson(res, result.statusCode, result);
    }

    // -------------------------------------------------------------
    // Audit Logs
    // -------------------------------------------------------------
    if (method === 'GET' && pathname === `${API_PREFIX}/audit/logs`) {
      if (!authService.checkPermission(actorUser, ['STORE_MANAGER', 'SUPER_ADMIN', 'AUDITOR'])) {
        return sendJson(res, 403, { success: false, statusCode: 403, error: 'Forbidden: Auditor or Manager privileges required' });
      }
      const logs = db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50;');
      return sendJson(res, 200, { success: true, statusCode: 200, data: logs });
    }

    // 404 Not Found
    return sendJson(res, 404, {
      success: false,
      statusCode: 404,
      error: `Route '${method} ${pathname}' not found`,
      available_docs: `${API_PREFIX}/docs`
    });

  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, {
      success: false,
      statusCode: 500,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

// Also export start function
function start(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      console.log(`================================================================`);
      console.log(`CYBORG SUPERMARKET API RUNNING AT: http://localhost:${port}${API_PREFIX}`);
      console.log(`API Documentation at:              http://localhost:${port}${API_PREFIX}/docs`);
      console.log(`Health Check at:                   http://localhost:${port}/health`);
      console.log(`================================================================`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  start();
}

module.exports = { server, start };
