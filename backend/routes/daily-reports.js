/**
 * 日結管理路由
 * 自動匯總當日銷售、按支付方式對賬、生成日結單、鎖定數據
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/daily-reports
 * 獲取日結單列表
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('store_id').optional().isInt(),
  query('start_date').optional().isDate(),
  query('end_date').optional().isDate(),
  query('status').optional().isIn(['draft', 'confirmed'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const storeId = req.query.store_id;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const status = req.query.status;

    const conditions = ['1=1'];
    const params = [];

    if (!req.isSuperAdmin) {
      conditions.push('dr.store_id = ?');
      params.push(req.storeId);
    } else if (storeId) {
      conditions.push('dr.store_id = ?');
      params.push(storeId);
    }

    if (startDate) {
      conditions.push('dr.report_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('dr.report_date <= ?');
      params.push(endDate);
    }

    if (status) {
      conditions.push('dr.status = ?');
      params.push(status);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM daily_reports dr WHERE ${conditions.join(' AND ')}`).get(...params);

    const offset = (page - 1) * pageSize;
    const reports = db.prepare(`
      SELECT dr.*, 
             s.name as store_name,
             confirmer.real_name as confirmed_by_name
      FROM daily_reports dr
      JOIN stores s ON dr.store_id = s.id
      LEFT JOIN users confirmer ON dr.confirmed_by = confirmer.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY dr.report_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: reports,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });

  } catch (error) {
    console.error('獲取日結單列表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/daily-reports/preview
 * 預覽日結數據（未生成日結單前）
 */
router.get('/preview', [
  query('store_id').isInt(),
  query('date').isDate()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const storeId = req.query.store_id;
    const date = req.query.date;

    // 數據隔離
    if (!req.isSuperAdmin && parseInt(storeId) !== req.storeId) {
      return res.status(403).json({ success: false, message: '無權查看' });
    }

    // 檢查是否已結帳
    const existingReport = db.prepare('SELECT * FROM daily_reports WHERE store_id = ? AND report_date = ?').get(storeId, date);
    if (existingReport) {
      return res.status(400).json({ success: false, message: '該日期已結帳' });
    }

    // 獲取當日銷售數據
    const salesStats = db.prepare(`
      SELECT 
        COUNT(*) as sales_count,
        COALESCE(SUM(total_amount), 0) as sales_amount,
        COALESCE(SUM(actual_amount), 0) as actual_amount,
        COALESCE(SUM(
          (SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)
        ), 0) as sales_cost
      FROM sales_orders so
      WHERE so.store_id = ? AND DATE(so.created_at) = ? AND so.status = 'completed'
    `).get(storeId, date);

    // 按支付方式統計
    const paymentStats = db.prepare(`
      SELECT 
        sp.payment_method,
        sp.payment_method_name,
        COALESCE(SUM(sp.amount), 0) as amount,
        COUNT(DISTINCT sp.order_id) as transaction_count
      FROM sales_payments sp
      JOIN sales_orders so ON sp.order_id = so.id
      WHERE so.store_id = ? AND DATE(so.created_at) = ? AND so.status = 'completed'
      GROUP BY sp.payment_method
    `).all(storeId, date);

    // 獲取退貨數據
    const returnStats = db.prepare(`
      SELECT 
        COUNT(*) as return_count,
        COALESCE(SUM(total_amount), 0) as return_amount
      FROM sales_returns sr
      JOIN sales_orders so ON sr.order_id = so.id
      WHERE so.store_id = ? AND DATE(sr.created_at) = ? AND sr.status = 'completed'
    `).get(storeId, date);

    // 獲取會員統計
    const memberStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT so.member_id) as member_orders,
        COALESCE(SUM(CASE WHEN so.member_id IS NOT NULL THEN so.actual_amount ELSE 0 END), 0) as member_amount,
        (SELECT COUNT(*) FROM members WHERE source_store_id = ? AND DATE(created_at) = ?) as new_members
      FROM sales_orders so
      WHERE so.store_id = ? AND DATE(so.created_at) = ? AND so.status = 'completed'
    `).get(storeId, storeId, date, storeId, date);

    // 獲取未結帳訂單列表
    const unsettledOrders = db.prepare(`
      SELECT so.id, so.order_no, so.total_amount, so.actual_amount, so.created_at
      FROM sales_orders so
      WHERE so.store_id = ? AND DATE(so.created_at) = ? AND so.status = 'completed' AND so.is_settled = 0
      ORDER BY so.created_at
    `).all(storeId, date);

    const profit = salesStats.sales_amount - salesStats.sales_cost;

    res.json({
      success: true,
      data: {
        date,
        store_id: storeId,
        is_preview: true,
        sales: {
          count: salesStats.sales_count,
          amount: salesStats.sales_amount,
          cost: salesStats.sales_cost,
          profit: profit,
          profit_rate: salesStats.sales_amount > 0 ? (profit / salesStats.sales_amount * 100).toFixed(2) : 0
        },
        payments: paymentStats,
        returns: returnStats,
        members: memberStats,
        unsettled_orders: {
          count: unsettledOrders.length,
          total_amount: unsettledOrders.reduce((sum, o) => sum + o.actual_amount, 0),
          orders: unsettledOrders
        }
      }
    });

  } catch (error) {
    console.error('預覽日結數據錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/daily-reports
 * 生成日結單
 */
router.post('/', [
  body('store_id').isInt(),
  body('date').isDate()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const { store_id, date } = req.body;
    const db = getDatabase();

    // 數據隔離
    if (!req.isSuperAdmin && store_id !== req.storeId) {
      return res.status(403).json({ success: false, message: '無權操作' });
    }

    // 檢查是否已結帳
    const existingReport = db.prepare('SELECT * FROM daily_reports WHERE store_id = ? AND report_date = ?').get(store_id, date);
    if (existingReport) {
      return res.status(400).json({ success: false, message: '該日期已結帳，不能重複結帳' });
    }

    const result = db.transaction(() => {
      // 獲取當日銷售統計
      const salesStats = db.prepare(`
        SELECT 
          COUNT(*) as sales_count,
          COALESCE(SUM(total_amount), 0) as sales_amount,
          COALESCE(SUM(
            (SELECT SUM(unit_cost * quantity) FROM sales_order_items WHERE order_id = so.id)
          ), 0) as sales_cost
        FROM sales_orders so
        WHERE so.store_id = ? AND DATE(so.created_at) = ? AND so.status = 'completed'
      `).get(store_id, date);

      // 按支付方式統計
      const paymentStats = db.prepare(`
        SELECT 
          sp.payment_method,
          COALESCE(SUM(sp.amount), 0) as amount
        FROM sales_payments sp
        JOIN sales_orders so ON sp.order_id = so.id
        WHERE so.store_id = ? AND DATE(so.created_at) = ? AND so.status = 'completed'
        GROUP BY sp.payment_method
      `).all(store_id, date);

      // 獲取退貨統計
      const returnStats = db.prepare(`
        SELECT 
          COUNT(*) as return_count,
          COALESCE(SUM(total_amount), 0) as return_amount
        FROM sales_returns sr
        JOIN sales_orders so ON sr.order_id = so.id
        WHERE so.store_id = ? AND DATE(sr.created_at) = ? AND sr.status = 'completed'
      `).get(store_id, date);

      // 獲取會員統計
      const memberStats = db.prepare(`
        SELECT 
          COUNT(DISTINCT so.member_id) as member_orders,
          COALESCE(SUM(CASE WHEN so.member_id IS NOT NULL THEN so.actual_amount ELSE 0 END), 0) as member_amount,
          (SELECT COUNT(*) FROM members WHERE source_store_id = ? AND DATE(created_at) = ?) as new_members
        FROM sales_orders so
        WHERE so.store_id = ? AND DATE(so.created_at) = ? AND so.status = 'completed'
      `).get(store_id, store_id, date, store_id, date);

      // 整理支付方式金額
      const paymentAmounts = {};
      paymentStats.forEach(p => {
        paymentAmounts[p.payment_method] = p.amount;
      });

      const profit = salesStats.sales_amount - salesStats.sales_cost;

      // 創建日結單
      const reportResult = db.prepare(`
        INSERT INTO daily_reports (
          store_id, report_date,
          sales_count, sales_amount, sales_cost, sales_profit,
          cash_amount, wechat_amount, alipay_amount, balance_amount, card_amount,
          return_count, return_amount,
          new_members, member_orders, member_amount,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      `).run(
        store_id, date,
        salesStats.sales_count, salesStats.sales_amount, salesStats.sales_cost, profit,
        paymentAmounts.cash || 0, paymentAmounts.wechat || 0, paymentAmounts.alipay || 0, 
        paymentAmounts.balance || 0, paymentAmounts.card || 0,
        returnStats.return_count, returnStats.return_amount,
        memberStats.new_members, memberStats.member_orders, memberStats.member_amount
      );

      const reportId = reportResult.lastInsertRowid;

      // 標記訂單為已結帳
      db.prepare(`
        UPDATE sales_orders 
        SET is_settled = 1, settled_at = datetime('now'), daily_report_id = ?
        WHERE store_id = ? AND DATE(created_at) = ? AND status = 'completed' AND is_settled = 0
      `).run(reportId, store_id, date);

      return { reportId, salesStats, profit };
    })();

    logOperation(req.userId, req.username, 'daily_reports', 'create', 'daily_reports', result.reportId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '日結單生成成功',
      data: {
        id: result.reportId,
        sales_count: result.salesStats.sales_count,
        sales_amount: result.salesStats.sales_amount,
        profit: result.profit
      }
    });

  } catch (error) {
    console.error('生成日結單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

/**
 * @POST /api/daily-reports/:id/confirm
 * 確認日結單（鎖定數據）
 */
router.post('/:id/confirm', [
  param('id').isInt()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const reportId = req.params.id;
    const db = getDatabase();

    const report = db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: '日結單不存在' });
    }

    if (report.status === 'confirmed') {
      return res.status(400).json({ success: false, message: '日結單已確認' });
    }

    // 數據隔離
    if (!req.isSuperAdmin && report.store_id !== req.storeId) {
      return res.status(403).json({ success: false, message: '無權確認' });
    }

    db.prepare(`
      UPDATE daily_reports 
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = datetime('now')
      WHERE id = ?
    `).run(req.userId, reportId);

    logOperation(req.userId, req.username, 'daily_reports', 'confirm', 'daily_reports', reportId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({ success: true, message: '日結單已確認，數據已鎖定' });

  } catch (error) {
    console.error('確認日結單錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/daily-reports/:id/unsettlement-approve
 * 反結帳審批
 */
router.post('/:id/unsettlement-approve', [
  param('id').isInt(),
  body('action').isIn(['approve', 'reject'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const reportId = req.params.id;
    const { action } = req.body;
    const db = getDatabase();

    const report = db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: '日結單不存在' });
    }

    if (report.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: '只有已確認的日結單可以申請反結帳' });
    }

    // 只有超級管理員可以審批反結帳
    if (!req.isSuperAdmin) {
      return res.status(403).json({ success: false, message: '只有超級管理員可以審批反結帳' });
    }

    if (action === 'approve') {
      db.transaction(() => {
        // 更新日結單
        db.prepare('UPDATE daily_reports SET status = "draft" WHERE id = ?').run(reportId);

        // 取消訂單的結帳標記
        db.prepare('UPDATE sales_orders SET is_settled = 0, settled_at = NULL, daily_report_id = NULL WHERE daily_report_id = ?').run(reportId);
      })();

      logOperation(req.userId, req.username, 'daily_reports', 'unsettlement_approve', 'daily_reports', reportId, null, null, req.ip, req.headers['user-agent'], 1);

      res.json({ success: true, message: '反結帳已審批通過' });
    } else {
      res.json({ success: true, message: '反結帳申請已駁回' });
    }

  } catch (error) {
    console.error('反結帳審批錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/daily-reports/:id
 * 獲取日結單詳情
 */
router.get('/:id', [
  param('id').isInt()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const reportId = req.params.id;
    const db = getDatabase();

    const report = db.prepare(`
      SELECT dr.*, 
             s.name as store_name,
             confirmer.real_name as confirmed_by_name
      FROM daily_reports dr
      JOIN stores s ON dr.store_id = s.id
      LEFT JOIN users confirmer ON dr.confirmed_by = confirmer.id
      WHERE dr.id = ?
    `).get(reportId);

    if (!report) {
      return res.status(404).json({ success: false, message: '日結單不存在' });
    }

    // 數據隔離
    if (!req.isSuperAdmin && report.store_id !== req.storeId) {
      return res.status(403).json({ success: false, message: '無權查看' });
    }

    // 獲取關聯訂單
    const orders = db.prepare(`
      SELECT id, order_no, total_amount, actual_amount, created_at, member_id
      FROM sales_orders
      WHERE daily_report_id = ?
      ORDER BY created_at
    `).all(reportId);

    report.orders = orders;

    res.json({ success: true, data: report });

  } catch (error) {
    console.error('獲取日結單詳情錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

module.exports = router;
