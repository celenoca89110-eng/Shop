const db = require('../config/db');

const PAID_STATUSES = [
  'paid', 'in_progress', 'completed',
  'subscription_active', 'subscription_cancelled', 'subscription_expired',
];

async function getShopStats(req, res, next) {
  try {
    const shopId = req.shop.id;

    const [revenueResult, ordersResult, customersResult, subsResult, monthlyResult, topProductsResult, recentOrdersResult] =
      await Promise.all([
        db.query(
          `SELECT COALESCE(SUM(total_cents), 0) AS total_revenue,
                  COALESCE(SUM(total_cents) FILTER (WHERE created_at >= date_trunc('month', now())), 0) AS month_revenue
           FROM orders WHERE shop_id = $1 AND status = ANY($2::order_status[])`,
          [shopId, PAID_STATUSES]
        ),
        db.query(
          `SELECT COUNT(*) AS total_orders FROM orders WHERE shop_id = $1 AND status = ANY($2::order_status[])`,
          [shopId, PAID_STATUSES]
        ),
        db.query(
          `SELECT COUNT(DISTINCT user_id) AS total_customers FROM orders WHERE shop_id = $1 AND status = ANY($2::order_status[])`,
          [shopId, PAID_STATUSES]
        ),
        db.query(`SELECT COUNT(*) AS active_subscriptions FROM subscriptions WHERE shop_id = $1 AND status = 'active'`, [shopId]),
        db.query(
          `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
                  SUM(total_cents) AS revenue_cents
           FROM orders
           WHERE shop_id = $1 AND status = ANY($2::order_status[]) AND created_at >= now() - interval '6 months'
           GROUP BY 1 ORDER BY 1 ASC`,
          [shopId, PAID_STATUSES]
        ),
        db.query(
          `SELECT oi.product_name_snapshot AS name, SUM(oi.quantity) AS units_sold,
                  SUM(oi.unit_price_cents * oi.quantity) AS revenue_cents
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.shop_id = $1 AND o.status = ANY($2::order_status[])
           GROUP BY oi.product_name_snapshot
           ORDER BY revenue_cents DESC LIMIT 5`,
          [shopId, PAID_STATUSES]
        ),
        db.query(
          `SELECT o.*, u.username FROM orders o JOIN users u ON u.id = o.user_id
           WHERE o.shop_id = $1 ORDER BY o.created_at DESC LIMIT 5`,
          [shopId]
        ),
      ]);

    return res.json({
      totalRevenueCents: parseInt(revenueResult.rows[0].total_revenue, 10),
      monthRevenueCents: parseInt(revenueResult.rows[0].month_revenue, 10),
      totalOrders: parseInt(ordersResult.rows[0].total_orders, 10),
      totalCustomers: parseInt(customersResult.rows[0].total_customers, 10),
      activeSubscriptions: parseInt(subsResult.rows[0].active_subscriptions, 10),
      monthlyRevenue: monthlyResult.rows.map((r) => ({ month: r.month, revenueCents: parseInt(r.revenue_cents, 10) })),
      topProducts: topProductsResult.rows.map((r) => ({
        name: r.name,
        unitsSold: parseInt(r.units_sold, 10),
        revenueCents: parseInt(r.revenue_cents, 10),
      })),
      recentOrders: recentOrdersResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getShopStats };
