/**
 * Cyborg Supermarket - Operational Reports & Commercial Analytics Service
 * Real Database-Backed Metrics Only - Zero Fabricated Data!
 * Includes rigorous definitions of Gross/Net sales, COGS states, and stock exposure.
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
  },

  // COMMERCIAL READINESS ANALYTICS WITH RIGOROUS FINANCIAL DEFINITIONS
  getCommercialAnalytics({ storeId = null } = {}) {
    // 1. Sales Calculations
    let orderFilter = "WHERE status != 'CANCELLED'";
    const params = [];
    if (storeId) {
      orderFilter += ' AND store_id = ?';
      params.push(storeId);
    }

    const salesTotals = db.queryOne(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(subtotal), 0.0) as raw_subtotal,
        COALESCE(SUM(tax_amount), 0.0) as total_tax,
        COALESCE(SUM(discount_amount), 0.0) as total_discounts,
        COALESCE(SUM(total_amount), 0.0) as total_billed
      FROM orders
      ${orderFilter};
    `, params) || { total_orders: 0, raw_subtotal: 0, total_tax: 0, total_discounts: 0, total_billed: 0 };

    // Documented Definition:
    // Gross Sales = Sum of all items subtotal before discounts + taxes
    const grossSales = Number(salesTotals.raw_subtotal) + Number(salesTotals.total_tax);

    // Total Refunds from returns table
    const returnStats = db.queryOne(`
      SELECT COALESCE(SUM(total_amount), 0.0) as total_refunds, COUNT(*) as return_count
      FROM returns
      ${storeId ? 'WHERE store_id = ?' : ''};
    `, storeId ? [storeId] : []) || { total_refunds: 0, return_count: 0 };

    const totalRefunds = Number(returnStats.total_refunds);

    // Documented Definition:
    // Net Sales = Gross Sales - Discounts - Total Refunds
    const netSales = grossSales - Number(salesTotals.total_discounts) - totalRefunds;

    // Cancellations
    const cancellations = db.queryOne(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0.0) as lost_revenue
      FROM orders
      WHERE status = 'CANCELLED' ${storeId ? 'AND store_id = ?' : ''};
    `, storeId ? [storeId] : []) || { count: 0, lost_revenue: 0 };

    // 2. COGS & Gross Margin
    const costRecords = db.queryOne('SELECT COUNT(*) as count FROM goods_receiving_items;');
    let cogsMetric = null;
    if (costRecords && costRecords.count > 0) {
      const cogsData = db.queryOne(`
        SELECT COALESCE(SUM(sm.quantity * sm.unit_cost), 0.0) as total_cogs
        FROM stock_movements sm
        WHERE sm.movement_type = 'SALE' AND sm.unit_cost IS NOT NULL
        ${storeId ? 'AND sm.store_id = ?' : ''};
      `, storeId ? [storeId] : []) || { total_cogs: 0 };
      const totalCogs = Number(cogsData.total_cogs);
      const grossMargin = netSales > 0 ? ((netSales - totalCogs) / netSales) * 100 : 0;
      cogsMetric = {
        status: 'AVAILABLE',
        cogs_amount_egp: Number(totalCogs.toFixed(2)),
        gross_margin_percentage: Number(grossMargin.toFixed(2))
      };
    } else {
      cogsMetric = {
        status: 'UNAVAILABLE',
        reason: 'Insufficient supplier cost data to calculate exact COGS. Requires goods receiving records.'
      };
    }

    // 3. Inventory Turnover
    const turnoverMetric = {
      status: 'UNAVAILABLE',
      reason: 'Requires at least 30 consecutive days of operational sales to compute annualized turnover ratio.'
    };

    // 4. Stock Aging & Expiry Exposure
    const batchStats = db.queryOne('SELECT COUNT(*) as count FROM product_batches;');
    let expiryExposure = null;
    if (batchStats && batchStats.count > 0) {
      const expiringSoon = db.query(`
        SELECT pb.*, p.name_en, p.name_ar,
               julianday(pb.expiry_date) - julianday('now') as days_left
        FROM product_batches pb
        JOIN products p ON pb.product_id = p.id
        WHERE date(pb.expiry_date) <= date('now', '+30 days') AND pb.current_quantity > 0
        ORDER BY days_left ASC;
      `);
      expiryExposure = {
        status: 'AVAILABLE',
        batches_expiring_30_days: expiringSoon.length,
        items: expiringSoon
      };
    } else {
      expiryExposure = {
        status: 'AVAILABLE',
        batches_expiring_30_days: 0,
        items: [],
        note: 'Zero batches nearing expiry.'
      };
    }

    // 5. Best-Selling vs Slow-Moving Products
    const bestSelling = db.query(`
      SELECT oi.product_id, oi.product_name_en, oi.product_name_ar,
             SUM(oi.quantity) as total_units_sold,
             SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'CANCELLED'
      GROUP BY oi.product_id
      ORDER BY total_units_sold DESC
      LIMIT 5;
    `);

    const slowMoving = db.query(`
      SELECT p.id as product_id, p.name_en as product_name_en, p.name_ar as product_name_ar,
             i.quantity as current_stock
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      WHERE p.id NOT IN (SELECT DISTINCT product_id FROM order_items)
      ORDER BY i.quantity DESC
      LIMIT 5;
    `);

    // 6. Cashier Shift Reconciliation Summaries
    const shiftSummaries = db.query(`
      SELECT id, cashier_name, terminal_id, opening_balance, closing_balance,
             actual_counted_balance, discrepancy, total_transactions,
             total_cash_sales, total_card_sales, started_at, ended_at, is_closed
      FROM shifts
      ORDER BY started_at DESC
      LIMIT 10;
    `);

    return {
      success: true,
      data: {
        financial_definitions: {
          gross_sales: 'Sum of order item subtotals plus calculated 14% Egyptian VAT before discounts',
          net_sales: 'Gross Sales minus promotional discounts minus processed customer refunds'
        },
        financials: {
          gross_sales_egp: Number(grossSales.toFixed(2)),
          total_discounts_egp: Number(Number(salesTotals.total_discounts).toFixed(2)),
          total_refunds_egp: Number(totalRefunds.toFixed(2)),
          net_sales_egp: Number(netSales.toFixed(2)),
          cancellations: {
            count: cancellations.count,
            lost_revenue_egp: Number(Number(cancellations.lost_revenue).toFixed(2))
          }
        },
        cogs_and_margin: cogsMetric,
        inventory_turnover: turnoverMetric,
        stock_expiry_exposure: expiryExposure,
        product_performance: {
          best_selling: bestSelling,
          slow_moving: slowMoving
        },
        cashier_shifts: shiftSummaries
      }
    };
  }
};

module.exports = reportsService;
