const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/dashboard/stats
const getStats = asyncHandler(async (req, res) => {
  const [[todaySales]] = await db.query(
    `SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS count
     FROM sales WHERE DATE(created_at) = CURDATE()`
  );
  const [[monthSales]] = await db.query(
    `SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS count
     FROM sales WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
  );
  const [[products]] = await db.query('SELECT COUNT(*) AS count FROM products');
  const [[customers]] = await db.query('SELECT COUNT(*) AS count FROM customers');
  const [[lowStock]] = await db.query('SELECT COUNT(*) AS count FROM products WHERE stock <= low_stock_threshold');

  const [recentSales] = await db.query(
    `SELECT s.id, s.invoice_no, s.total, s.created_at, c.name AS customer
     FROM sales s LEFT JOIN customers c ON s.customer_id = c.id
     ORDER BY s.created_at DESC LIMIT 5`
  );

  const [topProducts] = await db.query(
    `SELECT p.name, SUM(si.quantity) AS units_sold, SUM(si.subtotal) AS revenue
     FROM sale_items si JOIN products p ON si.product_id = p.id
     GROUP BY si.product_id, p.name
     ORDER BY units_sold DESC LIMIT 5`
  );

  const [salesLast7Days] = await db.query(
    `SELECT DATE(created_at) AS date, COALESCE(SUM(total),0) AS revenue
     FROM sales
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date`
  );

  const [recentActivity] = await db.query(
    `SELECT a.action, a.details, a.created_at, u.username
     FROM activity_log a LEFT JOIN users u ON a.user_id = u.id
     ORDER BY a.created_at DESC LIMIT 8`
  );

  res.json({
    today: todaySales,
    month: monthSales,
    totalProducts: products.count,
    totalCustomers: customers.count,
    lowStockCount: lowStock.count,
    recentSales,
    topProducts,
    salesLast7Days,
    recentActivity
  });
});

module.exports = { getStats };
