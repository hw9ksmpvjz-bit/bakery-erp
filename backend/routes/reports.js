/**
 * 報表中心路由
 * 銷售報表、庫存報表、利潤報表
 */

const express = require('express');
const { query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/reports/sales
 * 銷售報表
 */
router.get('/sales', [
  query('start_date').isDate(),
  query('end_date').isDate(),
  query('store_id').optional().isInt(),
  query('group_by').optional().isIn(['date', 'product', 'store'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const { start_date, end_date, store_id, group_by = 'date' } = req.query;

    const storeCondition = store_id ? 'AND so.store_id = ?' : '';
    const params = store_id ? [start_date, end_date, store_id] : [start_date, end_date];

    let data;

    if (group_by === 'date') {
      // 按日期分組
      data = db.prepare(`
        SELECT 
          DATE(so.created_at) as date,
          COUNT(*) as order_count,
          SUM(so.total_amount) as total_amount,
          SUM(so.actual_amount) as actual_amount,
          SUM((SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) as total_cost,
          SUM(so.points_earned) as points_earned,
          COUNT(DISTINCT so.member_id) as member_count
        FROM sales_orders so
        WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.status = 'completed'
        ${storeCondition}
        GROUP BY DATE(so.created_at)
        ORDER BY date
      `).all(...params);
    } else if (group_by === 'product') {
      // 按商品分組
      data = db.prepare(`
        SELECT 
          p.id as product_id,
          p.sku,
          p.name as product_name,
          SUM(soi.quantity) as total_quantity,
          SUM(soi.total_price) as total_amount,
          SUM(soi.unit_cost * soi.quantity) as total_cost,
          SUM(soi.total_price - soi.unit_cost * soi.quantity) as total_profit
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.order_id = so.id
        JOIN products p ON soi.product_id = p.id
        WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.status = 'completed'
        ${storeCondition}
        GROUP BY p.id
        ORDER BY total_amount DESC
      `).all(...params);
    } else if (group_by === 'store') {
      // 按分店分組
      data = db.prepare(`
        SELECT 
          s.id as store_id,
          s.name as store_name,
          COUNT(*) as order_count,
          SUM(so.total_amount) as total_amount,
          SUM(so.actual_amount) as actual_amount,
          SUM((SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) as total_cost
        FROM sales_orders so
        JOIN stores s ON so.store_id = s.id
        WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.status = 'completed'
        ${store_id ? 'AND so.store_id = ?' : ''}
        GROUP BY s.id
        ORDER BY total_amount DESC
      `).all(...params);
    }

    // 總計
    const total = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(so.total_amount) as total_amount,
        SUM(so.actual_amount) as actual_amount,
        SUM((SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) as total_cost,
        SUM(so.points_earned) as total_points
      FROM sales_orders so
      WHERE DATE(so.created_at) BETWEEN ? AND ?
      AND so.status = 'completed'
      ${storeCondition}
    `).get(...params);

    res.json({
      success: true,
      data: {
        group_by,
        list: data,
        total: {
          ...total,
          total_profit: total.total_amount - total.total_cost,
          profit_rate: total.total_amount > 0 ? ((total.total_amount - total.total_cost) / total.total_amount * 100).toFixed(2) : 0
        }
      }
    });

  } catch (error) {
    console.error('獲取銷售報表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/reports/inventory
 * 庫存報表
 */
router.get('/inventory', [
  query('store_id').optional().isInt(),
  query('type').optional().isIn(['all', 'low', 'expiring', 'expired'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const { store_id, type = 'all' } = req.query;

    // 數據隔離
    const effectiveStoreId = req.isSuperAdmin ? (store_id || null) : req.storeId;

    let data;

    if (type === 'all') {
      // 庫存匯總
      const productInventory = db.prepare(`
        SELECT 
          p.id,
          p.sku,
          p.name,
          p.type,
          p.stock_quantity as total_quantity,
          p.min_stock,
          p.max_stock,
          p.purchase_price,
          p.retail_price,
          (p.stock_quantity * p.purchase_price) as inventory_value
        FROM products p
        WHERE p.status = 1
        ${effectiveStoreId ? 'AND EXISTS (SELECT 1 FROM product_batches WHERE product_id = p.id AND store_id = ?)' : ''}
        ORDER BY p.type, p.name
      `).all(effectiveStoreId ? [effectiveStoreId] : []);

      // 批次庫存明細
      const batchInventory = db.prepare(`
        SELECT 
          pb.batch_no,
          p.sku,
          p.name as product_name,
          p.type,
          s.name as store_name,
          pb.remaining_quantity,
          pb.unit_cost,
          (pb.remaining_quantity * pb.unit_cost) as batch_value,
          pb.production_date,
          pb.expiry_date,
          CASE 
            WHEN pb.expiry_date < date('now') THEN 'expired'
            WHEN pb.expiry_date <= date('now', '+3 day') THEN 'critical'
            WHEN pb.expiry_date <= date('now', '+7 day') THEN 'warning'
            ELSE 'normal'
          END as expiry_status
        FROM product_batches pb
        JOIN products p ON pb.product_id = p.id
        JOIN stores s ON pb.store_id = s.id
        WHERE pb.remaining_quantity > 0
        ${effectiveStoreId ? 'AND pb.store_id = ?' : ''}
        ORDER BY pb.expiry_date ASC
      `).all(effectiveStoreId ? [effectiveStoreId] : []);

      data = { product_inventory: productInventory, batch_inventory: batchInventory };
    } else if (type === 'low') {
      // 低庫存预警
      data = db.prepare(`
        SELECT 
          p.id,
          p.sku,
          p.name,
          p.stock_quantity,
          p.min_stock,
          (p.min_stock - p.stock_quantity) as shortage,
          p.unit
        FROM products p
        WHERE p.stock_quantity <= p.min_stock
        AND p.status = 1
        ORDER BY shortage DESC
      `).all();
    } else if (type === 'expiring' || type === 'expired') {
      // 臨期/過期商品
      const condition = type === 'expired' 
        ? "pb.expiry_date < date('now')"
        : "pb.expiry_date >= date('now') AND pb.expiry_date <= date('now', '+7 day')";
      
      data = db.prepare(`
        SELECT 
          pb.batch_no,
          p.sku,
          p.name as product_name,
          s.name as store_name,
          pb.remaining_quantity,
          pb.expiry_date,
          ROUND(julianday(pb.expiry_date) - julianday('now'), 0) as days_remaining
        FROM product_batches pb
        JOIN products p ON pb.product_id = p.id
        JOIN stores s ON pb.store_id = s.id
        WHERE ${condition}
        AND pb.remaining_quantity > 0
        ${effectiveStoreId ? 'AND pb.store_id = ?' : ''}
        ORDER BY pb.expiry_date ASC
      `).all(effectiveStoreId ? [effectiveStoreId] : []);
    }

    // 庫存統計
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        SUM(p.stock_quantity) as total_quantity,
        SUM(p.stock_quantity * p.purchase_price) as total_value,
        COUNT(CASE WHEN p.stock_quantity <= p.min_stock THEN 1 END) as low_stock_count
      FROM products p
      WHERE p.status = 1
    `).get();

    res.json({
      success: true,
      data: {
        type,
        ...data,
        stats
      }
    });

  } catch (error) {
    console.error('獲取庫存報表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/reports/profit
 * 利潤報表
 */
router.get('/profit', [
  query('start_date').isDate(),
  query('end_date').isDate(),
  query('store_id').optional().isInt(),
  query('group_by').optional().isIn(['date', 'product', 'category'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const { start_date, end_date, store_id, group_by = 'date' } = req.query;

    const storeCondition = store_id ? 'AND so.store_id = ?' : '';
    const params = store_id ? [start_date, end_date, store_id] : [start_date, end_date];

    let data;

    if (group_by === 'date') {
      data = db.prepare(`
        SELECT 
          DATE(so.created_at) as date,
          SUM(so.total_amount) as revenue,
          SUM((SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) as cost,
          SUM(so.total_amount - (SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) as profit,
          ROUND(
            (SUM(so.total_amount - (SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) * 100.0 / 
            NULLIF(SUM(so.total_amount), 0)), 2
          ) as profit_rate
        FROM sales_orders so
        WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.status = 'completed'
        ${storeCondition}
        GROUP BY DATE(so.created_at)
        ORDER BY date
      `).all(...params);
    } else if (group_by === 'product') {
      data = db.prepare(`
        SELECT 
          p.id as product_id,
          p.sku,
          p.name as product_name,
          SUM(soi.total_price) as revenue,
          SUM(soi.unit_cost * soi.quantity) as cost,
          SUM(soi.total_price - soi.unit_cost * soi.quantity) as profit,
          ROUND(
            (SUM(soi.total_price - soi.unit_cost * soi.quantity) * 100.0 / 
            NULLIF(SUM(soi.total_price), 0)), 2
          ) as profit_rate
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.order_id = so.id
        JOIN products p ON soi.product_id = p.id
        WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.status = 'completed'
        ${storeCondition}
        GROUP BY p.id
        ORDER BY profit DESC
      `).all(...params);
    } else if (group_by === 'category') {
      data = db.prepare(`
        SELECT 
          c.name as category_name,
          SUM(soi.total_price) as revenue,
          SUM(soi.unit_cost * soi.quantity) as cost,
          SUM(soi.total_price - soi.unit_cost * soi.quantity) as profit,
          ROUND(
            (SUM(soi.total_price - soi.unit_cost * soi.quantity) * 100.0 / 
            NULLIF(SUM(soi.total_price), 0)), 2
          ) as profit_rate
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.order_id = so.id
        JOIN products p ON soi.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE DATE(so.created_at) BETWEEN ? AND ?
        AND so.status = 'completed'
        ${storeCondition}
        GROUP BY c.id
        ORDER BY profit DESC
      `).all(...params);
    }

    // 總計
    const total = db.prepare(`
      SELECT 
        SUM(so.total_amount) as total_revenue,
        SUM((SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) as total_cost,
        SUM(so.total_amount - (SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) as total_profit,
        ROUND(
          (SUM(so.total_amount - (SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)) * 100.0 / 
          NULLIF(SUM(so.total_amount), 0)), 2
        ) as avg_profit_rate
      FROM sales_orders so
      WHERE DATE(so.created_at) BETWEEN ? AND ?
      AND so.status = 'completed'
      ${storeCondition}
    `).get(...params);

    res.json({
      success: true,
      data: {
        group_by,
        list: data,
        total
      }
    });

  } catch (error) {
    console.error('獲取利潤報表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/reports/dashboard
 * 儀表板數據
 */
router.get('/dashboard', [
  query('store_id').optional().isInt()
], (req, res) => {
  try {
    const db = getDatabase();
    const store_id = req.query.store_id;

    // 數據隔離
    const effectiveStoreId = req.isSuperAdmin ? (store_id || null) : req.storeId;
    const storeCondition = effectiveStoreId ? 'AND store_id = ?' : '';
    const params = effectiveStoreId ? [effectiveStoreId] : [];

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    // 今日銷售
    const todaySales = db.prepare(`
      SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(actual_amount), 0) as sales_amount
      FROM sales_orders
      WHERE DATE(created_at) = ?
      AND status = 'completed'
      ${storeCondition}
    `).get(today, ...params);

    // 本月銷售
    const monthSales = db.prepare(`
      SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(actual_amount), 0) as sales_amount
      FROM sales_orders
      WHERE strftime('%Y-%m', created_at) = ?
      AND status = 'completed'
      ${storeCondition}
    `).get(thisMonth, ...params);

    // 待處理事項
    const pendingTasks = {
      pending_purchase_orders: db.prepare(`
        SELECT COUNT(*) as count FROM purchase_orders WHERE status IN ('pending', 'approved') ${storeCondition}
      `).get(...params)?.count || 0,
      
      pending_transfer_orders: db.prepare(`
        SELECT COUNT(*) as count FROM transfer_orders WHERE status IN ('pending_approval', 'approved', 'shipped') ${storeCondition.replace('store_id', 'from_store_id')}
      `).get(...params)?.count || 0,
      
      pending_production_orders: db.prepare(`
        SELECT COUNT(*) as count FROM production_orders WHERE status IN ('pending', 'approved') ${storeCondition}
      `).get(...params)?.count || 0,
      
      expiry_warnings: db.prepare(`
        SELECT COUNT(*) as count FROM product_batches 
        WHERE expiry_date <= date('now', '+3 day') AND remaining_quantity > 0
        ${storeCondition.replace('store_id', 'product_batches.store_id')}
      `).get(...params)?.count || 0,
      
      low_stock_products: db.prepare(`
        SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock AND status = 1
      `).get()?.count || 0
    };

    // 庫存統計
    const inventoryStats = db.prepare(`
      SELECT 
        SUM(stock_quantity) as total_quantity,
        SUM(stock_quantity * purchase_price) as total_value
      FROM products
      WHERE status = 1
    `).get();

    res.json({
      success: true,
      data: {
        today: todaySales,
        this_month: monthSales,
        pending_tasks: pendingTasks,
        inventory: inventoryStats
      }
    });

  } catch (error) {
    console.error('獲取儀表板數據錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

module.exports = router;
