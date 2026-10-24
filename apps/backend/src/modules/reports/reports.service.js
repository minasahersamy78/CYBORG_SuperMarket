/**
 * Cyborg Supermarket - Operational Reports & Analytics Service
 * Real Database-Backed Metrics Only - Zero Fabricated Data!
 */

const db = require('../../database/db');

const reportsService = {
  getDashboardOverview() {
    // 1. Total Active Products
    const prodCount = db.getOne('SELECT count(*) as total FROM products WHERE is_active = 1;');
    const totalProducts = prodCount ? parseInt(prodCount.total, 10) : 0;

    // 2. Category Distribution
    const categoryDistribution = db.query(`
      SELECT c.name_en, count(p.id) as product_count
      FROM categories c
      JOIN products p ON c.id = p.category_id
      WHERE c.parent_id IS NULL AND p.is_active = 1
      GROUP BY c.name_en
      ORDER BY product_count DESC;
    `);

    // 3. Orders & Transactions Metrics
    const orderStats = db.getOne(`
      SELECT
        count(*) as total_orders,
        COALESCE(SUM(total_amount), 0.0) as total_revenue,
        COALESCE(SUM(CASE WHEN source = 'POS' THEN 1 ELSE 0 END), 0) as pos_orders,
        COALESCE(SUM(CASE WHEN source = 'ONLINE' THEN 1 ELSE 0 END), 0) as online_orders,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) as pending_orders,
        COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as delivered_orders,
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN 1 ELSE 0 END), 0) as refunded_orders
      FROM orders;
    `);

    // 4. Inventory Alerts (items <= low_stock_threshold)
    const lowStockAlerts = db.query(`
      SELECT
        p.id, p.name_en, p.name_ar, p.barcode,
        i.quantity, i.reserved_qty, (i.quantity - i.reserved_qty) as available_quantity,
        i.low_stock_threshold
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE (i.quantity - i.reserved_qty) <= i.low_stock_threshold
      ORDER BY available_quantity ASC
      LIMIT 10;
    `);

    // 5. Active Shifts
    const activeShifts = db.query(`
      SELECT id, cashier_name, terminal_id, opening_balance, total_transactions, total_cash_sales, total_card_sales, started_at
      FROM shifts
      WHERE is_closed = 0;
    `);

    // 6. Recent Audit Activity
    const recentAudit = db.query(`
      SELECT action, actor_role, entity, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    return {
      success: true,
      statusCode: 200,
      data: {
        timestamp: new Date().toISOString(),
        currency: 'EGP',
        catalog: {
          total_active_products: totalProducts,
          category_breakdown: categoryDistribution
        },
        sales_summary: {
          total_orders: parseInt(orderStats.total_orders, 10),
          total_revenue_egp: parseFloat(Number(orderStats.total_revenue).toFixed(2)),
          pos_transactions: parseInt(orderStats.pos_orders, 10),
          online_orders: parseInt(orderStats.online_orders, 10),
          pending_orders: parseInt(orderStats.pending_orders, 10),
          delivered_orders: parseInt(orderStats.delivered_orders, 10),
          refunded_orders: parseInt(orderStats.refunded_orders, 10)
        },
        inventory: {
          total_low_stock_alerts: lowStockAlerts.length,
          critical_items: lowStockAlerts
        },
        operations: {
          active_shifts_count: activeShifts.length,
          active_shifts: activeShifts
        },
        recent_audit_logs: recentAudit
      }
    };
  },

  getSalesReport() {
    const dailySales = db.query(`
      SELECT
        strftime('%Y-%m-%d', created_at) as sale_date,
        source,
        count(*) as transaction_count,
        SUM(total_amount) as daily_revenue
      FROM orders
      WHERE status != 'CANCELLED'
      GROUP BY sale_date, source
      ORDER BY sale_date DESC;
    `);

    const topSellingProducts = db.query(`
      SELECT
        oi.product_id, oi.product_name_en, oi.product_name_ar, oi.barcode,
        SUM(oi.quantity) as units_sold,
        SUM(oi.subtotal) as total_sales_egp
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'CANCELLED'
      GROUP BY oi.product_id, oi.product_name_en, oi.product_name_ar, oi.barcode
      ORDER BY units_sold DESC
      LIMIT 10;
    `);

    return {
      success: true,
      statusCode: 200,
      data: {
        daily_trends: dailySales,
        top_products: topSellingProducts
      }
    };
  }
};

module.exports = reportsService;
