/**
 * 庫存管理路由
 * 烘焙行業核心：效期管理、臨期預警、報廢流程、批次跟蹤
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
// 庫存查詢
// ============================================

/**
 * @GET /api/inventory
 * 獲取庫存列表（支援效期篩選）
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('product_id').optional().isInt(),
  query('store_id').optional().isInt(),
  query('expiry_status').optional().isIn(['normal', 'warning', 'critical', 'expired']),
  query('batch_type').optional().isIn(['product', 'material'])
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const productId = req.query.product_id;
    const storeId = req.query.store_id;
    const expiryStatus = req.query.expiry_status;
    const batchType = req.query.batch_type;

    // 數據隔離
    const effectiveStoreId = req.isSuperAdmin ? (storeId || req.storeId) : req.storeId;

    let sql, countSql, params;

    if (batchType === 'material' || !batchType) {
      // 原料庫存查詢
      sql = `
        SELECT 
          mb.id as batch_id,
          mb.batch_no,
          'material' as batch_type,
          p.id as product_id,
          p.sku,
          p.name as product_name,
          p.type,
          s.id as store_id,
          s.name as store_name,
          mb.production_date,
          mb.expiry_date,
          mb.remaining_quantity as quantity,
          mb.unit,
          mb.unit_cost,
          mb.status,
          CASE 
            WHEN mb.expiry_date < date('now') THEN 'expired'
            WHEN mb.expiry_date <= date('now', '+3 day') THEN 'critical'
            WHEN mb.expiry_date <= date('now', '+7 day') THEN 'warning'
            ELSE 'normal'
          END as expiry_status,
          ROUND(julianday(mb.expiry_date) - julianday('now'), 0) as days_until_expiry
        FROM material_batches mb
        JOIN products p ON mb.product_id = p.id
        JOIN stores s ON mb.store_id = s.id
        WHERE mb.store_id = ? AND mb.remaining_quantity > 0
      `;
      countSql = `SELECT COUNT(*) as total FROM material_batches WHERE store_id = ? AND remaining_quantity > 0`;
      params = [effectiveStoreId];
    } else {
      // 成品庫存查詢
      sql = `
        SELECT 
          pb.id as batch_id,
          pb.batch_no,
          'product' as batch_type,
          p.id as product_id,
          p.sku,
          p.name as product_name,
          p.type,
          s.id as store_id,
          s.name as store_name,
          pb.production_date,
          pb.expiry_date,
          pb.remaining_quantity as quantity,
          pb.unit,
          pb.unit_cost,
          pb.status,
          CASE 
            WHEN pb.expiry_date < date('now') THEN 'expired'
            WHEN pb.expiry_date <= date('now', '+1 day') THEN 'critical'
            WHEN pb.expiry_date <= date('now', '+3 day') THEN 'warning'
            ELSE 'normal'
          END as expiry_status,
          ROUND(julianday(pb.expiry_date) - julianday('now'), 0) as days_until_expiry
        FROM product_batches pb
        JOIN products p ON pb.product_id = p.id
        JOIN stores s ON pb.store_id = s.id
        WHERE pb.store_id = ? AND pb.remaining_quantity > 0
      `;
      countSql = `SELECT COUNT(*) as total FROM product_batches WHERE store_id = ? AND remaining_quantity > 0`;
      params = [effectiveStoreId];
    }

    // 添加篩選條件
    if (productId) {
      sql += ` AND ${batchType === 'material' ? 'mb' : 'pb'}.product_id = ?`;
      countSql += ` AND product_id = ?`;
      params.push(productId);
    }

    // 執行查詢
    const countResult = db.prepare(countSql).get(...params);
    
    const offset = (page - 1) * pageSize;
    sql += ` ORDER BY expiry_date ASC LIMIT ? OFFSET ?`;
    
    const inventory = db.prepare(sql).all(...params, pageSize, offset);

    // 如果請求了效期篩選，在前端過濾
    let filteredInventory = inventory;
    if (expiryStatus) {
      filteredInventory = inventory.filter(item => item.expiry_status === expiryStatus);
    }

    res.json({
      success: true,
      data: {
        list: filteredInventory,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取庫存列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/inventory/expiry-warnings
 * 獲取臨期預警列表
 */
router.get('/expiry-warnings', [
  query('store_id').optional().isInt(),
  query('level').optional().isIn(['warning', 'critical', 'expired', 'all'])
], (req, res) => {
  try {
    const db = getDatabase();
    const storeId = req.query.store_id;
    const level = req.query.level || 'all';

    // 數據隔離
    const effectiveStoreId = req.isSuperAdmin ? (storeId || req.storeId) : req.storeId;

    // 原料臨期查詢
    let materialSql = `
      SELECT 
        mb.id as batch_id,
        mb.batch_no,
        'material' as batch_type,
        p.id as product_id,
        p.sku,
        p.name as product_name,
        s.name as store_name,
        mb.expiry_date,
        mb.remaining_quantity as quantity,
        mb.unit,
        CASE 
          WHEN mb.expiry_date < date('now') THEN 'expired'
          WHEN mb.expiry_date <= date('now', '+3 day') THEN 'critical'
          ELSE 'warning'
        END as warning_level,
        ROUND(julianday(mb.expiry_date) - julianday('now'), 0) as days_remaining
      FROM material_batches mb
      JOIN products p ON mb.product_id = p.id
      JOIN stores s ON mb.store_id = s.id
      WHERE mb.store_id = ? AND mb.remaining_quantity > 0
      AND (
        mb.expiry_date < date('now')
        OR mb.expiry_date <= date('now', '+7 day')
      )
    `;

    // 成品臨期查詢
    let productSql = `
      SELECT 
        pb.id as batch_id,
        pb.batch_no,
        'product' as batch_type,
        p.id as product_id,
        p.sku,
        p.name as product_name,
        s.name as store_name,
        pb.expiry_date,
        pb.remaining_quantity as quantity,
        pb.unit,
        CASE 
          WHEN pb.expiry_date < date('now') THEN 'expired'
          WHEN pb.expiry_date <= date('now', '+1 day') THEN 'critical'
          ELSE 'warning'
        END as warning_level,
        ROUND(julianday(pb.expiry_date) - julianday('now'), 0) as days_remaining
      FROM product_batches pb
      JOIN products p ON pb.product_id = p.id
      JOIN stores s ON pb.store_id = s.id
      WHERE pb.store_id = ? AND pb.remaining_quantity > 0
      AND (
        pb.expiry_date < date('now')
        OR pb.expiry_date <= date('now', '+3 day')
      )
    `;

    const materialWarnings = db.prepare(materialSql).all(effectiveStoreId);
    const productWarnings = db.prepare(productSql).all(effectiveStoreId);

    let allWarnings = [...materialWarnings, ...productWarnings];

    // 按級別篩選
    if (level !== 'all') {
      allWarnings = allWarnings.filter(w => w.warning_level === level);
    }

    // 按剩餘天數排序（過期的在最前面）
    allWarnings.sort((a, b) => a.days_remaining - b.days_remaining);

    // 統計
    const stats = {
      total: allWarnings.length,
      expired: allWarnings.filter(w => w.warning_level === 'expired').length,
      critical: allWarnings.filter(w => w.warning_level === 'critical').length,
      warning: allWarnings.filter(w => w.warning_level === 'warning').length
    };

    res.json({
      success: true,
      data: {
        list: allWarnings,
        statistics: stats
      }
    });

  } catch (error) {
    console.error('獲取臨期預警錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

// ============================================
// 報廢管理
// ============================================

/**
 * @GET /api/inventory/scrap-orders
 * 獲取報廢單列表
 */
router.get('/scrap-orders', [
  query('page').optional().isInt({ min: 1 }),
  query('status').optional().isIn(['draft', 'pending', 'approved', 'completed'])
], (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = 20;
    const status = req.query.status;

    let conditions = ['1=1'];
    let params = [];

    // 數據隔離
    if (!req.isSuperAdmin) {
      conditions.push('so.store_id = ?');
      params.push(req.storeId);
    }

    if (status) {
      conditions.push('so.status = ?');
      params.push(status);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM scrap_orders so WHERE ${conditions.join(' AND ')}
    `).get(...params);

    const offset = (page - 1) * pageSize;
    const orders = db.prepare(`
      SELECT so.*, s.name as store_name, creator.real_name as creator_name
      FROM scrap_orders so
      JOIN stores s ON so.store_id = s.id
      LEFT JOIN users creator ON so.created_by = creator.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY so.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: orders,
        pagination: {
          page, pageSize, total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取報廢單列表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @POST /api/inventory/scrap-orders
 * 創建報廢單
 */
router.post('/scrap-orders', [
  body('store_id').isInt(),
  body('reason_category').isIn(['expired', 'damaged', 'quality', 'other']),
  body('items').isArray({ min: 1 }),
  body('items.*.batch_id').isInt(),
  body('items.*.batch_type').isIn(['product', 'material']),
  body('items.*.quantity').isFloat({ min: 0.01 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const { store_id, reason_category, reason_description, items } = req.body;
    const db = getDatabase();

    // 數據隔離
    if (!req.isSuperAdmin && store_id !== req.storeId) {
      return res.status(403).json({ success: false, message: '無權操作' });
    }

    const result = db.transaction(() => {
      const scrapNo = generateOrderNo('SC');
      
      // 創建報廢單
      const orderResult = db.prepare(`
        INSERT INTO scrap_orders (scrap_no, store_id, reason_category, reason_description, status, created_by)
        VALUES (?, ?, ?, ?, 'draft', ?)
      `).run(scrapNo, store_id, reason_category, reason_description, req.userId);

      const scrapId = orderResult.lastInsertRowid;
      let totalQuantity = 0;
      let totalCost = 0;

      // 添加報廢明細
      for (const item of items) {
        let batch, productId;
        
        if (item.batch_type === 'product') {
          batch = db.prepare('SELECT * FROM product_batches WHERE id = ?').get(item.batch_id);
          productId = batch.product_id;
        } else {
          batch = db.prepare('SELECT * FROM material_batches WHERE id = ?').get(item.batch_id);
          productId = batch.product_id;
        }

        if (!batch || batch.remaining_quantity < item.quantity) {
          throw new Error('庫存不足或批次不存在');
        }

        const itemCost = item.quantity * batch.unit_cost;
        totalQuantity += item.quantity;
        totalCost += itemCost;

        db.prepare(`
          INSERT INTO scrap_order_items (scrap_id, product_id, batch_id, batch_type, quantity, unit, unit_cost, total_cost)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(scrapId, productId, item.batch_id, item.batch_type, item.quantity, batch.unit, batch.unit_cost, itemCost);
      }

      // 更新總額
      db.prepare(`
        UPDATE scrap_orders SET total_items = ?, total_quantity = ?, total_cost = ? WHERE id = ?
      `).run(items.length, totalQuantity, totalCost, scrapId);

      return { scrapId, scrapNo };
    })();

    logOperation(req.userId, req.username, 'inventory', 'create_scrap', 'scrap_orders', result.scrapId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '報廢單創建成功',
      data: { id: result.scrapId, scrap_no: result.scrapNo }
    });

  } catch (error) {
    console.error('創建報廢單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

/**
 * @POST /api/inventory/scrap-orders/:id/approve
 * 審批報廢單並執行扣減
 */
router.post('/scrap-orders/:id/approve', [
  param('id').isInt(),
  body('action').isIn(['approve', 'reject'])
], (req, res) => {
  try {
    const scrapId = req.params.id;
    const { action } = req.body;
    const db = getDatabase();

    const order = db.prepare('SELECT * FROM scrap_orders WHERE id = ?').get(scrapId);
    if (!order) {
      return res.status(404).json({ success: false, message: '報廢單不存在' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只有草稿狀態可審批' });
    }

    if (action === 'approve') {
      // 執行扣減
      db.transaction(() => {
        // 更新狀態
        db.prepare(`
          UPDATE scrap_orders SET status = 'completed', approved_by = ?, approved_at = datetime('now'), completed_at = datetime('now')
          WHERE id = ?
        `).run(req.userId, scrapId);

        // 扣減庫存
        const items = db.prepare('SELECT * FROM scrap_order_items WHERE scrap_id = ?').all(scrapId);
        
        for (const item of items) {
          if (item.batch_type === 'product') {
            // 扣減成品批次
            db.prepare('UPDATE product_batches SET remaining_quantity = remaining_quantity - ?, status = CASE WHEN remaining_quantity - ? <= 0 THEN "scrapped" ELSE status END WHERE id = ?')
              .run(item.quantity, item.quantity, item.batch_id);
            
            // 更新商品總庫存
            db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?')
              .run(item.quantity, item.product_id);
          } else {
            // 扣減原料批次
            db.prepare('UPDATE material_batches SET remaining_quantity = remaining_quantity - ?, status = CASE WHEN remaining_quantity - ? <= 0 THEN "scrapped" ELSE status END WHERE id = ?')
              .run(item.quantity, item.quantity, item.batch_id);
            
            db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?')
              .run(item.quantity, item.product_id);
          }

          // 記錄庫存變動
          db.prepare(`
            INSERT INTO inventory_logs (product_id, store_id, type, quantity, before_quantity, after_quantity, reference_type, reference_id, operator_id)
            SELECT product_id, ?, 'waste', -quantity, 
                   (SELECT stock_quantity + quantity FROM products WHERE id = product_id),
                   (SELECT stock_quantity FROM products WHERE id = product_id),
                   'scrap_order', ?, ?
            FROM scrap_order_items WHERE id = ?
          `).run(order.store_id, scrapId, req.userId, item.id);
        }
      })();

      logOperation(req.userId, req.username, 'inventory', 'approve_scrap', 'scrap_orders', scrapId, null, null, req.ip, req.headers['user-agent'], 1);
      
      res.json({ success: true, message: '報廢單已審批，庫存已扣減' });
    } else {
      db.prepare('UPDATE scrap_orders SET status = "cancelled" WHERE id = ?').run(scrapId);
      res.json({ success: true, message: '報廢單已取消' });
    }

  } catch (error) {
    console.error('審批報廢單錯誤:', error);
    res.status(500).json({ success: false, message: error.message || '服務器錯誤' });
  }
});

module.exports = router;
