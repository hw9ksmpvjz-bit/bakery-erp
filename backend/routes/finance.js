/**
 * 應收應付路由
 * 客戶欠款、供應商欠款、收付款管理、對賬
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
// 應收管理（客戶欠款）
// ============================================

/**
 * @GET /api/finance/receivables
 * 獲取應收賬款列表
 */
router.get('/receivables', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('customer_id').optional().isInt(),
  query('status').optional().isIn(['unpaid', 'partial', 'paid', 'overdue']),
  query('age_group').optional().isIn(['0-30天', '31-60天', '61-90天', '90天以上'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const customerId = req.query.customer_id;
    const status = req.query.status;
    const ageGroup = req.query.age_group;

    let conditions = ['1=1'];
    let params = [];

    if (customerId) {
      conditions.push('r.customer_id = ?');
      params.push(customerId);
    }

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    let sql = `
      SELECT r.*, c.name as customer_name, c.code as customer_code,
             julianday('now') - julianday(r.invoice_date) as age_days
      FROM receivables r
      JOIN customers c ON r.customer_id = c.id
      WHERE ${conditions.join(' AND ')}
    `;

    if (ageGroup) {
      const ageCondition = {
        '0-30天': 'age_days <= 30',
        '31-60天': 'age_days > 30 AND age_days <= 60',
        '61-90天': 'age_days > 60 AND age_days <= 90',
        '90天以上': 'age_days > 90'
      }[ageGroup];
      if (ageCondition) {
        sql = `SELECT * FROM (${sql}) WHERE ${ageCondition}`;
      }
    }

    const countResult = db.prepare(`SELECT COUNT(*) as total FROM (${sql})`).get(...params);

    const offset = (page - 1) * pageSize;
    const list = db.prepare(`${sql} ORDER BY r.invoice_date DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

    // 統計
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(remaining_amount) as total_remaining,
        SUM(CASE WHEN status = 'overdue' THEN remaining_amount ELSE 0 END) as overdue_amount
      FROM receivables
      WHERE status IN ('unpaid', 'partial', 'overdue')
    `).get();

    res.json({
      success: true,
      data: { list, stats, pagination: { page, pageSize, total: countResult.total } }
    });

  } catch (error) {
    console.error('獲取應收賬款錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/finance/receipt-vouchers
 * 創建收款單
 */
router.post('/receipt-vouchers', [
  body('customer_id').isInt(),
  body('items').isArray({ min: 1 }),
  body('items.*.receivable_id').isInt(),
  body('items.*.amount').isFloat({ min: 0.01 }),
  body('payment_method').notEmpty(),
  body('receipt_date').isDate()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const { customer_id, items, payment_method, receipt_date, remark } = req.body;
    const db = getDatabase();

    const result = db.transaction(() => {
      const voucherNo = generateOrderNo('RV');

      // 計算收款總額
      let totalAmount = 0;
      const processedItems = [];

      for (const item of items) {
        const receivable = db.prepare('SELECT * FROM receivables WHERE id = ? AND customer_id = ?').get(item.receivable_id, customer_id);
        if (!receivable) {
          throw new Error(`應收賬款 ${item.receivable_id} 不存在`);
        }

        if (item.amount > receivable.remaining_amount) {
          throw new Error(`收款金額超過剩餘欠款，最多可收 ${receivable.remaining_amount}`);
        }

        totalAmount += item.amount;
        processedItems.push({ ...item, receivable });
      }

      // 創建收款單
      const method = db.prepare('SELECT * FROM payment_methods WHERE code = ?').get(payment_method);
      const voucherResult = db.prepare(`
        INSERT INTO receipt_vouchers (voucher_no, customer_id, total_amount, payment_method, payment_method_name, receipt_date, created_by, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(voucherNo, customer_id, totalAmount, payment_method, method?.name || payment_method, receipt_date, req.userId, remark);

      const voucherId = voucherResult.lastInsertRowid;

      // 處理每個收款項目
      for (const item of processedItems) {
        // 創建明細
        db.prepare(`
          INSERT INTO receipt_voucher_items (voucher_id, receivable_id, amount, remark)
          VALUES (?, ?, ?, ?)
        `).run(voucherId, item.receivable_id, item.amount, remark);

        // 更新應收賬款
        const newPaidAmount = item.receivable.paid_amount + item.amount;
        const newRemaining = item.receivable.total_amount - newPaidAmount;
        const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

        db.prepare(`
          UPDATE receivables 
          SET paid_amount = ?, remaining_amount = ?, status = ?, 
              last_payment_date = ?, last_payment_amount = ?
          WHERE id = ?
        `).run(newPaidAmount, newRemaining, newStatus, receipt_date, item.amount, item.receivable_id);

        // 更新客戶餘額
        db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(item.amount, customer_id);
      }

      // 完成收款單
      db.prepare('UPDATE receipt_vouchers SET status = "completed", completed_at = datetime("now") WHERE id = ?').run(voucherId);

      return { voucherId, voucherNo, totalAmount };
    })();

    logOperation(req.userId, req.username, 'finance', 'create_receipt', 'receipt_vouchers', result.voucherId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '收款單創建成功',
      data: { voucher_no: result.voucherNo, total_amount: result.totalAmount }
    });

  } catch (error) {
    console.error('創建收款單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

// ============================================
// 應付管理（供應商欠款）
// ============================================

/**
 * @GET /api/finance/payables
 * 獲取應付賬款列表
 */
router.get('/payables', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('supplier_id').optional().isInt(),
  query('status').optional().isIn(['unpaid', 'partial', 'paid', 'overdue'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const supplierId = req.query.supplier_id;
    const status = req.query.status;

    let conditions = ['1=1'];
    let params = [];

    if (supplierId) {
      conditions.push('p.supplier_id = ?');
      params.push(supplierId);
    }

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM payables p 
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    const offset = (page - 1) * pageSize;
    const list = db.prepare(`
      SELECT p.*, s.name as supplier_name, s.code as supplier_code,
             julianday('now') - julianday(p.invoice_date) as age_days
      FROM payables p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.invoice_date DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    // 統計
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(remaining_amount) as total_remaining,
        SUM(CASE WHEN status = 'overdue' THEN remaining_amount ELSE 0 END) as overdue_amount
      FROM payables
      WHERE status IN ('unpaid', 'partial', 'overdue')
    `).get();

    res.json({
      success: true,
      data: { list, stats, pagination: { page, pageSize, total: countResult.total } }
    });

  } catch (error) {
    console.error('獲取應付賬款錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/finance/payment-vouchers
 * 創建付款單
 */
router.post('/payment-vouchers', [
  body('supplier_id').isInt(),
  body('items').isArray({ min: 1 }),
  body('items.*.payable_id').isInt(),
  body('items.*.amount').isFloat({ min: 0.01 }),
  body('payment_method').notEmpty(),
  body('payment_date').isDate()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const { supplier_id, items, payment_method, payment_date, remark } = req.body;
    const db = getDatabase();

    const result = db.transaction(() => {
      const voucherNo = generateOrderNo('PV');

      // 計算付款總額
      let totalAmount = 0;
      const processedItems = [];

      for (const item of items) {
        const payable = db.prepare('SELECT * FROM payables WHERE id = ? AND supplier_id = ?').get(item.payable_id, supplier_id);
        if (!payable) {
          throw new Error(`應付賬款 ${item.payable_id} 不存在`);
        }

        if (item.amount > payable.remaining_amount) {
          throw new Error(`付款金額超過剩餘欠款，最多可付 ${payable.remaining_amount}`);
        }

        totalAmount += item.amount;
        processedItems.push({ ...item, payable });
      }

      // 創建付款單
      const method = db.prepare('SELECT * FROM payment_methods WHERE code = ?').get(payment_method);
      const voucherResult = db.prepare(`
        INSERT INTO payment_vouchers (voucher_no, supplier_id, total_amount, payment_method, payment_method_name, payment_date, created_by, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(voucherNo, supplier_id, totalAmount, payment_method, method?.name || payment_method, payment_date, req.userId, remark);

      const voucherId = voucherResult.lastInsertRowid;

      // 處理每個付款項目
      for (const item of processedItems) {
        // 創建明細
        db.prepare(`
          INSERT INTO payment_voucher_items (voucher_id, payable_id, amount, remark)
          VALUES (?, ?, ?, ?)
        `).run(voucherId, item.payable_id, item.amount, remark);

        // 更新應付賬款
        const newPaidAmount = item.payable.paid_amount + item.amount;
        const newRemaining = item.payable.total_amount - newPaidAmount;
        const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

        db.prepare(`
          UPDATE payables 
          SET paid_amount = ?, remaining_amount = ?, status = ?, 
              last_payment_date = ?, last_payment_amount = ?
          WHERE id = ?
        `).run(newPaidAmount, newRemaining, newStatus, payment_date, item.amount, item.payable_id);
      }

      // 完成付款單
      db.prepare('UPDATE payment_vouchers SET status = "completed", completed_at = datetime("now") WHERE id = ?').run(voucherId);

      return { voucherId, voucherNo, totalAmount };
    })();

    logOperation(req.userId, req.username, 'finance', 'create_payment', 'payment_vouchers', result.voucherId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '付款單創建成功',
      data: { voucher_no: result.voucherNo, total_amount: result.totalAmount }
    });

  } catch (error) {
    console.error('創建付款單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

// ============================================
// 對賬管理
// ============================================

/**
 * @POST /api/finance/reconciliation-statements
 * 創建對賬單
 */
router.post('/reconciliation-statements', [
  body('party_type').isIn(['customer', 'supplier']),
  body('party_id').isInt(),
  body('start_date').isDate(),
  body('end_date').isDate()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '參數錯誤', errors: errors.array() });
    }

    const { party_type, party_id, start_date, end_date } = req.body;
    const db = getDatabase();

    const result = db.transaction(() => {
      const statementNo = generateOrderNo('RS');

      let partyName;
      let openingBalance = 0;
      let transactions = [];

      if (party_type === 'customer') {
        const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(party_id);
        partyName = customer?.name;

        // 計算期初餘額（對賬開始日期前的欠款）
        openingBalance = db.prepare(`
          SELECT COALESCE(SUM(remaining_amount), 0) as balance
          FROM receivables
          WHERE customer_id = ? AND invoice_date < ?
          AND status IN ('unpaid', 'partial', 'overdue')
        `).get(party_id, start_date).balance || 0;

        // 獲取期間交易
        transactions = db.prepare(`
          SELECT invoice_date as date, '銷售' as type, source_no as doc_no, total_amount as debit, 0 as credit
          FROM receivables
          WHERE customer_id = ? AND invoice_date BETWEEN ? AND ?
          UNION ALL
          SELECT rv.receipt_date as date, '收款' as type, rv.voucher_no as doc_no, 0 as debit, rvi.amount as credit
          FROM receipt_voucher_items rvi
          JOIN receipt_vouchers rv ON rvi.voucher_id = rv.id
          JOIN receivables r ON rvi.receivable_id = r.id
          WHERE r.customer_id = ? AND rv.receipt_date BETWEEN ? AND ? AND rv.status = 'completed'
          ORDER BY date
        `).all(party_id, start_date, end_date, party_id, start_date, end_date);

      } else {
        const supplier = db.prepare('SELECT name FROM suppliers WHERE id = ?').get(party_id);
        partyName = supplier?.name;

        // 計算期初餘額
        openingBalance = db.prepare(`
          SELECT COALESCE(SUM(remaining_amount), 0) as balance
          FROM payables
          WHERE supplier_id = ? AND invoice_date < ?
          AND status IN ('unpaid', 'partial', 'overdue')
        `).get(party_id, start_date).balance || 0;

        // 獲取期間交易
        transactions = db.prepare(`
          SELECT invoice_date as date, '採購' as type, source_no as doc_no, 0 as credit, total_amount as debit
          FROM payables
          WHERE supplier_id = ? AND invoice_date BETWEEN ? AND ?
          UNION ALL
          SELECT pv.payment_date as date, '付款' as type, pv.voucher_no as doc_no, pvi.amount as credit, 0 as debit
          FROM payment_voucher_items pvi
          JOIN payment_vouchers pv ON pvi.voucher_id = pv.id
          JOIN payables p ON pvi.payable_id = p.id
          WHERE p.supplier_id = ? AND pv.payment_date BETWEEN ? AND ? AND pv.status = 'completed'
          ORDER BY date
        `).all(party_id, start_date, end_date, party_id, start_date, end_date);
      }

      // 計算本期增減和期末餘額
      let totalDebit = 0;
      let totalCredit = 0;
      let runningBalance = openingBalance;

      const items = transactions.map(t => {
        const debit = parseFloat(t.debit) || 0;
        const credit = parseFloat(t.credit) || 0;
        totalDebit += debit;
        totalCredit += credit;
        runningBalance = runningBalance + debit - credit;

        return {
          transaction_date: t.date,
          transaction_type: t.type,
          document_no: t.doc_no,
          debit: debit,
          credit: credit,
          balance: runningBalance
        };
      });

      const closingBalance = openingBalance + totalDebit - totalCredit;

      // 創建對賬單
      const statementResult = db.prepare(`
        INSERT INTO reconciliation_statements 
        (statement_no, party_type, party_id, party_name, start_date, end_date, 
         opening_balance, total_debit, total_credit, closing_balance, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      `).run(statementNo, party_type, party_id, partyName, start_date, end_date,
        openingBalance, totalDebit, totalCredit, closingBalance);

      const statementId = statementResult.lastInsertRowid;

      // 創建對賬明細
      const insertItem = db.prepare(`
        INSERT INTO reconciliation_items 
        (statement_id, transaction_date, transaction_type, document_no, debit, credit, balance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(statementId, item.transaction_date, item.transaction_type, 
          item.document_no, item.debit, item.credit, item.balance);
      }

      return { statementId, statementNo, closingBalance };
    })();

    logOperation(req.userId, req.username, 'finance', 'create_reconciliation', 'reconciliation_statements', result.statementId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '對賬單創建成功',
      data: { statement_no: result.statementNo, closing_balance: result.closingBalance }
    });

  } catch (error) {
    console.error('創建對賬單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

module.exports = router;
