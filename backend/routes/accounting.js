/**
 * 財務管理路由
 * 會計憑證、科目、財務報表
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');
const { generateOrderNo } = require('../utils/helpers');

const router = express.Router();

router.use(authenticateToken);

// ============================================
// 會計科目管理
// ============================================

/**
 * @GET /api/accounting/subjects
 * 獲取會計科目列表
 */
router.get('/subjects', [
  query('category').optional().isIn(['asset', 'liability', 'equity', 'revenue', 'expense'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const category = req.query.category;

    let conditions = ['is_active = 1'];
    let params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    const subjects = db.prepare(`
      SELECT * FROM accounting_subjects
      WHERE ${conditions.join(' AND ')}
      ORDER BY code
    `).all(...params);

    // 構建樹形結構
    const buildTree = (items, parentId = 0) => {
      return items
        .filter(item => item.parent_id === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }));
    };

    const tree = buildTree(subjects);

    res.json({
      success: true,
      data: {
        list: subjects,
        tree: tree
      }
    });

  } catch (error) {
    console.error('獲取會計科目錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/accounting/subjects
 * 創建會計科目
 */
router.post('/subjects', [
  body('code').trim().notEmpty().withMessage('科目編號不能為空'),
  body('name').trim().notEmpty().withMessage('科目名稱不能為空'),
  body('category').isIn(['asset', 'liability', 'equity', 'revenue', 'expense']).withMessage('請選擇科目類別'),
  body('balance_direction').isIn(['debit', 'credit']).withMessage('請選擇餘額方向')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const { code, name, category, parent_id = 0, balance_direction, description } = req.body;
    const db = getDatabase();

    // 檢查編號是否已存在
    const existing = db.prepare('SELECT id FROM accounting_subjects WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({ success: false, message: '科目編號已存在' });
    }

    // 計算層級
    let level = 1;
    if (parent_id > 0) {
      const parent = db.prepare('SELECT level FROM accounting_subjects WHERE id = ?').get(parent_id);
      if (parent) {
        level = parent.level + 1;
      }
    }

    const result = db.prepare(`
      INSERT INTO accounting_subjects (code, name, category, parent_id, level, balance_direction, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(code, name, category, parent_id, level, balance_direction, description);

    logOperation(req.userId, req.username, 'accounting', 'create_subject', 'accounting_subjects', result.lastInsertRowid, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '會計科目創建成功',
      data: { id: result.lastInsertRowid }
    });

  } catch (error) {
    console.error('創建會計科目錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

// ============================================
// 會計憑證管理
// ============================================

/**
 * @GET /api/accounting/vouchers
 * 獲取會計憑證列表
 */
router.get('/vouchers', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('start_date').optional().isDate(),
  query('end_date').optional().isDate(),
  query('status').optional().isIn(['draft', 'posted', 'cancelled'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const status = req.query.status;

    let conditions = ['1=1'];
    let params = [];

    if (startDate) {
      conditions.push('voucher_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('voucher_date <= ?');
      params.push(endDate);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM accounting_vouchers WHERE ${conditions.join(' AND ')}`).get(...params);

    const offset = (page - 1) * pageSize;
    const vouchers = db.prepare(`
      SELECT av.*, 
             creator.real_name as creator_name,
             poster.real_name as posted_by_name
      FROM accounting_vouchers av
      LEFT JOIN users creator ON av.created_by = creator.id
      LEFT JOIN users poster ON av.posted_by = poster.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY av.voucher_date DESC, av.voucher_no DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: vouchers,
        pagination: { page, pageSize, total: countResult.total, totalPages: Math.ceil(countResult.total / pageSize) }
      }
    });

  } catch (error) {
    console.error('獲取會計憑證列表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/accounting/vouchers/:id
 * 獲取會計憑證詳情
 */
router.get('/vouchers/:id', [
  param('id').isInt()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const voucherId = req.params.id;
    const db = getDatabase();

    const voucher = db.prepare(`
      SELECT av.*, 
             creator.real_name as creator_name,
             poster.real_name as posted_by_name
      FROM accounting_vouchers av
      LEFT JOIN users creator ON av.created_by = creator.id
      LEFT JOIN users poster ON av.posted_by = poster.id
      WHERE av.id = ?
    `).get(voucherId);

    if (!voucher) {
      return res.status(404).json({ success: false, message: '憑證不存在' });
    }

    // 獲取憑證明細
    const items = db.prepare(`
      SELECT avi.*, s.code as subject_code, s.name as subject_name
      FROM accounting_voucher_items avi
      JOIN accounting_subjects s ON avi.subject_id = s.id
      WHERE avi.voucher_id = ?
      ORDER BY avi.sort_order
    `).all(voucherId);

    voucher.items = items;

    res.json({ success: true, data: voucher });

  } catch (error) {
    console.error('獲取會計憑證詳情錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/accounting/vouchers
 * 創建會計憑證
 */
router.post('/vouchers', [
  body('voucher_date').isDate().withMessage('請選擇憑證日期'),
  body('voucher_type').isIn(['receipt', 'payment', 'transfer', 'adjustment']).withMessage('請選擇憑證類型'),
  body('items').isArray({ min: 2 }).withMessage('憑證至少需要2條明細'),
  body('items.*.subject_id').isInt(),
  body('items.*.debit_amount').optional().isFloat({ min: 0 }),
  body('items.*.credit_amount').optional().isFloat({ min: 0 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const { voucher_date, voucher_type, items, summary } = req.body;
    const db = getDatabase();

    // 驗證借貸平衡
    let totalDebit = 0;
    let totalCredit = 0;

    for (const item of items) {
      const debit = parseFloat(item.debit_amount) || 0;
      const credit = parseFloat(item.credit_amount) || 0;

      if (debit === 0 && credit === 0) {
        return res.status(400).json({ success: false, message: '每條明細必須有借方或貸方金額' });
      }

      if (debit > 0 && credit > 0) {
        return res.status(400).json({ success: false, message: '每條明細不能同時有借方和貸方金額' });
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, message: '借方總額必須等於貸方總額' });
    }

    const result = db.transaction(() => {
      const voucherNo = generateOrderNo('VO');

      // 創建憑證
      const voucherResult = db.prepare(`
        INSERT INTO accounting_vouchers (voucher_no, voucher_date, voucher_type, total_debit, total_credit, summary, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(voucherNo, voucher_date, voucher_type, totalDebit, totalCredit, summary, req.userId);

      const voucherId = voucherResult.lastInsertRowid;

      // 創建憑證明細
      const insertItem = db.prepare(`
        INSERT INTO accounting_voucher_items (voucher_id, subject_id, subject_code, subject_name, summary, debit_amount, credit_amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const subject = db.prepare('SELECT code, name FROM accounting_subjects WHERE id = ?').get(item.subject_id);

        if (!subject) {
          throw new Error(`科目 ${item.subject_id} 不存在`);
        }

        insertItem.run(
          voucherId,
          item.subject_id,
          subject.code,
          subject.name,
          item.summary || summary,
          item.debit_amount || 0,
          item.credit_amount || 0,
          i + 1
        );
      }

      return { voucherId, voucherNo };
    })();

    logOperation(req.userId, req.username, 'accounting', 'create_voucher', 'accounting_vouchers', result.voucherId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '會計憑證創建成功',
      data: { id: result.voucherId, voucher_no: result.voucherNo }
    });

  } catch (error) {
    console.error('創建會計憑證錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

/**
 * @POST /api/accounting/vouchers/:id/post
 * 記賬（審核憑證）
 */
router.post('/vouchers/:id/post', [
  param('id').isInt()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const voucherId = req.params.id;
    const db = getDatabase();

    const voucher = db.prepare('SELECT * FROM accounting_vouchers WHERE id = ?').get(voucherId);
    if (!voucher) {
      return res.status(404).json({ success: false, message: '憑證不存在' });
    }

    if (voucher.status === 'posted') {
      return res.status(400).json({ success: false, message: '憑證已記賬' });
    }

    if (voucher.status === 'cancelled') {
      return res.status(400).json({ success: false, message: '憑證已作廢，不能記賬' });
    }

    db.prepare(`
      UPDATE accounting_vouchers 
      SET status = 'posted', posted_by = ?, posted_at = datetime('now')
      WHERE id = ?
    `).run(req.userId, voucherId);

    logOperation(req.userId, req.username, 'accounting', 'post_voucher', 'accounting_vouchers', voucherId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({ success: true, message: '憑證記賬成功' });

  } catch (error) {
    console.error('記賬錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

// ============================================
// 財務報表
// ============================================

/**
 * @GET /api/accounting/reports/balance-sheet
 * 資產負債表
 */
router.get('/reports/balance-sheet', [
  query('period').notEmpty().withMessage('請指定會計期間（YYYY-MM）')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const period = req.query.period;

    // 獲取資產類科目
    const assets = db.prepare(`
      SELECT s.code, s.name, 
             COALESCE(sb.closing_debit, 0) - COALESCE(sb.closing_credit, 0) as amount
      FROM accounting_subjects s
      LEFT JOIN subject_balances sb ON s.id = sb.subject_id AND sb.accounting_period = ?
      WHERE s.category = 'asset' AND s.level = 1 AND s.is_active = 1
      ORDER BY s.code
    `).all(period);

    // 獲取負債類科目
    const liabilities = db.prepare(`
      SELECT s.code, s.name, 
             COALESCE(sb.closing_credit, 0) - COALESCE(sb.closing_debit, 0) as amount
      FROM accounting_subjects s
      LEFT JOIN subject_balances sb ON s.id = sb.subject_id AND sb.accounting_period = ?
      WHERE s.category = 'liability' AND s.level = 1 AND s.is_active = 1
      ORDER BY s.code
    `).all(period);

    // 獲取權益類科目
    const equity = db.prepare(`
      SELECT s.code, s.name, 
             COALESCE(sb.closing_credit, 0) - COALESCE(sb.closing_debit, 0) as amount
      FROM accounting_subjects s
      LEFT JOIN subject_balances sb ON s.id = sb.subject_id AND sb.accounting_period = ?
      WHERE s.category = 'equity' AND s.level = 1 AND s.is_active = 1
      ORDER BY s.code
    `).all(period);

    // 計算合計
    const totalAssets = assets.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const totalLiabilities = liabilities.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const totalEquity = equity.reduce((sum, item) => sum + Math.max(0, item.amount), 0);

    res.json({
      success: true,
      data: {
        period,
        assets: { items: assets, total: totalAssets },
        liabilities: { items: liabilities, total: totalLiabilities },
        equity: { items: equity, total: totalEquity },
        total_liabilities_and_equity: totalLiabilities + totalEquity
      }
    });

  } catch (error) {
    console.error('獲取資產負債表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/accounting/reports/income-statement
 * 利潤表
 */
router.get('/reports/income-statement', [
  query('period').notEmpty().withMessage('請指定會計期間（YYYY-MM）')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const period = req.query.period;

    // 獲取收入類科目
    const revenues = db.prepare(`
      SELECT s.code, s.name, COALESCE(sb.current_credit, 0) - COALESCE(sb.current_debit, 0) as amount
      FROM accounting_subjects s
      LEFT JOIN subject_balances sb ON s.id = sb.subject_id AND sb.accounting_period = ?
      WHERE s.category = 'revenue' AND s.level = 1 AND s.is_active = 1
      ORDER BY s.code
    `).all(period);

    // 獲取費用類科目
    const expenses = db.prepare(`
      SELECT s.code, s.name, COALESCE(sb.current_debit, 0) - COALESCE(sb.current_credit, 0) as amount
      FROM accounting_subjects s
      LEFT JOIN subject_balances sb ON s.id = sb.subject_id AND sb.accounting_period = ?
      WHERE s.category = 'expense' AND s.level = 1 AND s.is_active = 1
      ORDER BY s.code
    `).all(period);

    // 計算合計
    const totalRevenue = revenues.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const totalExpense = expenses.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const netIncome = totalRevenue - totalExpense;

    res.json({
      success: true,
      data: {
        period,
        revenues: { items: revenues, total: totalRevenue },
        expenses: { items: expenses, total: totalExpense },
        net_income: netIncome
      }
    });

  } catch (error) {
    console.error('獲取利潤表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/accounting/reports/cash-flow
 * 現金流量表（簡化版）
 */
router.get('/reports/cash-flow', [
  query('start_date').isDate(),
  query('end_date').isDate()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const { start_date, end_date } = req.query;

    // 經營活動現金流量
    const operating = db.prepare(`
      SELECT 
        '銷售商品收到的現金' as item,
        COALESCE(SUM(CASE WHEN av.voucher_type = 'receipt' THEN avi.debit_amount ELSE 0 END), 0) as inflow,
        0 as outflow
      FROM accounting_vouchers av
      JOIN accounting_voucher_items avi ON av.id = avi.voucher_id
      WHERE av.voucher_date BETWEEN ? AND ?
      AND av.status = 'posted'
      AND avi.subject_code IN ('1001', '1002')
      UNION ALL
      SELECT 
        '購買商品支付的現金' as item,
        0 as inflow,
        COALESCE(SUM(CASE WHEN av.voucher_type = 'payment' THEN avi.credit_amount ELSE 0 END), 0) as outflow
      FROM accounting_vouchers av
      JOIN accounting_voucher_items avi ON av.id = avi.voucher_id
      WHERE av.voucher_date BETWEEN ? AND ?
      AND av.status = 'posted'
      AND avi.subject_code IN ('1001', '1002')
    `).all(start_date, end_date, start_date, end_date);

    const totalInflow = operating.reduce((sum, item) => sum + item.inflow, 0);
    const totalOutflow = operating.reduce((sum, item) => sum + item.outflow, 0);
    const netFlow = totalInflow - totalOutflow;

    res.json({
      success: true,
      data: {
        start_date,
        end_date,
        operating_activities: operating,
        total_inflow: totalInflow,
        total_outflow: totalOutflow,
        net_cash_flow: netFlow
      }
    });

  } catch (error) {
    console.error('獲取現金流量表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

module.exports = router;
