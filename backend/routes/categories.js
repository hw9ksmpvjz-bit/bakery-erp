/**
 * 商品分類管理路由
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/categories
 * 獲取分類列表（樹形結構）
 */
router.get('/', [
  query('type').optional().isIn(['product', 'material', 'semi_product']),
  query('level').optional().isInt()
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
    const type = req.query.type;
    const level = req.query.level;

    let conditions = ['status = 1'];
    let params = [];

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (level !== undefined) {
      conditions.push('level = ?');
      params.push(level);
    }

    const categories = db.prepare(`
      SELECT * FROM categories
      WHERE ${conditions.join(' AND ')}
      ORDER BY level, sort_order, id
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

    const tree = buildTree(categories);

    res.json({
      success: true,
      data: {
        list: categories,
        tree: tree
      }
    });

  } catch (error) {
    console.error('獲取分類列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/categories/:id
 * 獲取分類詳情
 */
router.get('/:id', [
  param('id').isInt()
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

    const categoryId = req.params.id;
    const db = getDatabase();

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: '分類不存在'
      });
    }

    // 獲取父分類名稱
    if (category.parent_id > 0) {
      const parent = db.prepare('SELECT name FROM categories WHERE id = ?').get(category.parent_id);
      category.parent_name = parent ? parent.name : null;
    }

    // 獲取子分類數量
    const childCount = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ? AND status = 1').get(categoryId);
    category.child_count = childCount.count;

    res.json({
      success: true,
      data: category
    });

  } catch (error) {
    console.error('獲取分類詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/categories
 * 創建分類
 */
router.post('/', [
  body('name').trim().notEmpty().withMessage('分類名稱不能為空'),
  body('type').isIn(['product', 'material', 'semi_product']).withMessage('請選擇分類類型'),
  body('parent_id').optional().isInt(),
  body('sort_order').optional().isInt()
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

    const { name, type, parent_id = 0, sort_order = 0 } = req.body;
    const db = getDatabase();

    // 計算層級
    let level = 1;
    if (parent_id > 0) {
      const parent = db.prepare('SELECT level FROM categories WHERE id = ?').get(parent_id);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: '父分類不存在'
        });
      }
      level = parent.level + 1;
    }

    // 檢查同級分類名稱是否重複
    const existing = db.prepare(
      'SELECT id FROM categories WHERE name = ? AND parent_id = ? AND type = ? AND status = 1'
    ).get(name, parent_id, type);

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '該分類名稱已存在'
      });
    }

    const result = db.prepare(`
      INSERT INTO categories (name, type, parent_id, level, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, type, parent_id, level, sort_order);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'categories', 'create', 'categories', result.lastInsertRowid, null, JSON.stringify({ name, type }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '分類創建成功',
      data: { id: result.lastInsertRowid }
    });

  } catch (error) {
    console.error('創建分類錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @PUT /api/categories/:id
 * 更新分類
 */
router.put('/:id', [
  param('id').isInt(),
  body('name').optional().trim(),
  body('sort_order').optional().isInt(),
  body('status').optional().isIn([0, 1])
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

    const categoryId = req.params.id;
    const { name, sort_order, status } = req.body;
    const db = getDatabase();

    // 檢查分類是否存在
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '分類不存在'
      });
    }

    // 構建更新字段
    const updates = [];
    const params = [];

    if (name !== undefined) {
      // 檢查名稱是否重複
      const nameExists = db.prepare(
        'SELECT id FROM categories WHERE name = ? AND parent_id = ? AND id != ? AND status = 1'
      ).get(name, existing.parent_id, categoryId);
      
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: '該分類名稱已存在'
        });
      }
      updates.push('name = ?');
      params.push(name);
    }

    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(sort_order);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有要更新的字段'
      });
    }

    params.push(categoryId);

    db.prepare(`
      UPDATE categories SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'categories', 'update', 'categories', categoryId, JSON.stringify(existing), JSON.stringify({ name, sort_order, status }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '分類更新成功'
    });

  } catch (error) {
    console.error('更新分類錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @DELETE /api/categories/:id
 * 刪除分類
 */
router.delete('/:id', [
  param('id').isInt()
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

    const categoryId = req.params.id;
    const db = getDatabase();

    // 檢查分類是否存在
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '分類不存在'
      });
    }

    // 檢查是否有子分類
    const hasChildren = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ? AND status = 1').get(categoryId);
    if (hasChildren.count > 0) {
      return res.status(400).json({
        success: false,
        message: '該分類下還有子分類，不能刪除'
      });
    }

    // 檢查是否有关联商品
    const hasProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ? AND status = 1').get(categoryId);
    if (hasProducts.count > 0) {
      return res.status(400).json({
        success: false,
        message: '該分類下還有商品，不能刪除'
      });
    }

    // 軟刪除
    db.prepare('UPDATE categories SET status = 0 WHERE id = ?').run(categoryId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'categories', 'delete', 'categories', categoryId, JSON.stringify(existing), null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '分類已刪除'
    });

  } catch (error) {
    console.error('刪除分類錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

module.exports = router;
