/**
 * 商品管理路由
 * 支援多單位換算、多配方版本
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken, requireStoreAccess } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/products
 * 獲取商品列表
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 }),
  query('keyword').optional().trim(),
  query('category_id').optional().isInt(),
  query('type').optional().isIn(['finished', 'semi', 'material']),
  query('status').optional().isIn(['0', '1'])
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
    const keyword = req.query.keyword;
    const categoryId = req.query.category_id;
    const type = req.query.type;
    const status = req.query.status;

    // 構建查詢條件
    const conditions = ['1=1'];
    const params = [];

    if (keyword) {
      conditions.push('(p.sku LIKE ? OR p.name LIKE ? OR p.barcode LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (categoryId) {
      conditions.push('p.category_id = ?');
      params.push(categoryId);
    }

    if (type) {
      conditions.push('p.type = ?');
      params.push(type);
    }

    if (status !== undefined) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    // 查詢總數
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM products p
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    // 查詢數據
    const offset = (page - 1) * pageSize;
    const products = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    // 為每個商品加載單位信息
    for (let product of products) {
      const units = db.prepare(`
        SELECT * FROM product_units 
        WHERE product_id = ? AND status = 1 
        ORDER BY conversion_rate ASC
      `).all(product.id);
      product.units = units;
    }

    res.json({
      success: true,
      data: {
        list: products,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取商品列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/products/:id
 * 獲取商品詳情（含單位和配方）
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

    const productId = req.params.id;
    const db = getDatabase();

    // 商品基本信息
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    // 單位信息
    const units = db.prepare(`
      SELECT * FROM product_units 
      WHERE product_id = ? AND status = 1 
      ORDER BY conversion_rate ASC
    `).all(productId);
    product.units = units;

    // 配方信息（如果是可生產的商品）
    if (product.is_producible) {
      const recipes = db.prepare(`
        SELECT r.*, 
               (SELECT COUNT(*) FROM recipe_items WHERE recipe_id = r.id) as item_count
        FROM recipes r
        WHERE r.product_id = ? AND r.status = 1
        ORDER BY r.is_default DESC, r.created_at DESC
      `).all(productId);
      
      // 為每個配方加載明細
      for (let recipe of recipes) {
        const items = db.prepare(`
          SELECT ri.*, p.name as material_name, p.sku as material_sku, p.unit as material_unit
          FROM recipe_items ri
          JOIN products p ON ri.material_id = p.id
          WHERE ri.recipe_id = ?
          ORDER BY ri.sort_order
        `).all(recipe.id);
        recipe.items = items;
      }
      
      product.recipes = recipes;
    }

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('獲取商品詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/products
 * 創建商品
 */
router.post('/', [
  body('sku').trim().notEmpty().withMessage('商品編號不能為空'),
  body('name').trim().notEmpty().withMessage('商品名稱不能為空'),
  body('category_id').isInt().withMessage('請選擇分類'),
  body('type').isIn(['finished', 'semi', 'material']).withMessage('請選擇商品類型'),
  body('unit').trim().notEmpty().withMessage('基本單位不能為空'),
  body('purchase_price').isFloat({ min: 0 }),
  body('retail_price').isFloat({ min: 0 }),
  body('units').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const {
      sku, name, category_id, type, barcode, specification, unit,
      shelf_life_days, warning_days, purchase_price, wholesale_price,
      retail_price, member_price, min_stock, max_stock, description,
      is_producible, production_time, units
    } = req.body;

    const db = getDatabase();

    // 檢查SKU是否已存在
    const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '商品編號已存在'
      });
    }

    // 開始事務
    const result = db.transaction(() => {
      // 創建商品
      const productResult = db.prepare(`
        INSERT INTO products (
          sku, name, category_id, type, barcode, specification, unit,
          shelf_life_days, warning_days, purchase_price, wholesale_price,
          retail_price, member_price, min_stock, max_stock, description,
          is_producible, production_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sku, name, category_id, type, barcode, specification, unit,
        shelf_life_days || 1, warning_days || 1, purchase_price, wholesale_price || 0,
        retail_price, member_price || 0, min_stock || 0, max_stock || 9999, description,
        is_producible ? 1 : 0, production_time || 0
      );

      const productId = productResult.lastInsertRowid;

      // 創建默認單位
      db.prepare(`
        INSERT INTO product_units (product_id, unit_name, conversion_rate, is_default, is_purchase_unit, is_sale_unit)
        VALUES (?, ?, 1, 1, 1, 1)
      `).run(productId, unit);

      // 創建其他單位
      if (units && units.length > 0) {
        const insertUnit = db.prepare(`
          INSERT INTO product_units (
            product_id, unit_name, conversion_rate, is_default, 
            is_purchase_unit, is_sale_unit, barcode
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const u of units) {
          if (u.unit_name !== unit) { // 跳過基本單位
            insertUnit.run(
              productId, u.unit_name, u.conversion_rate, 0,
              u.is_purchase_unit ? 1 : 0, u.is_sale_unit ? 1 : 0, u.barcode
            );
          }
        }
      }

      return productId;
    })();

    // 記錄操作日志
    logOperation(req.userId, req.username, 'products', 'create', 'products', result, null, JSON.stringify({ sku, name }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '商品創建成功',
      data: { id: result }
    });

  } catch (error) {
    console.error('創建商品錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @PUT /api/products/:id
 * 更新商品
 */
router.put('/:id', [
  param('id').isInt(),
  body('name').optional().trim(),
  body('purchase_price').optional().isFloat({ min: 0 }),
  body('retail_price').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '參數錯誤',
        errors: errors.array()
      });
    }

    const productId = req.params.id;
    const updateData = req.body;
    const db = getDatabase();

    // 檢查商品是否存在
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    // 構建更新字段
    const allowedFields = [
      'name', 'category_id', 'barcode', 'specification', 'unit',
      'shelf_life_days', 'warning_days', 'purchase_price', 'wholesale_price',
      'retail_price', 'member_price', 'min_stock', 'max_stock', 'description',
      'is_producible', 'production_time', 'status'
    ];

    const updates = [];
    const params = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有要更新的字段'
      });
    }

    params.push(productId);

    db.prepare(`
      UPDATE products SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'products', 'update', 'products', productId, JSON.stringify(existing), JSON.stringify(updateData), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '商品更新成功'
    });

  } catch (error) {
    console.error('更新商品錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @DELETE /api/products/:id
 * 刪除商品（軟刪除）
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

    const productId = req.params.id;
    const db = getDatabase();

    // 檢查商品是否存在
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '商品不存在'
      });
    }

    // 檢查是否有庫存
    if (existing.stock_quantity > 0) {
      return res.status(400).json({
        success: false,
        message: '該商品還有庫存，不能刪除'
      });
    }

    // 軟刪除
    db.prepare('UPDATE products SET status = 0 WHERE id = ?').run(productId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'products', 'delete', 'products', productId, JSON.stringify(existing), null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '商品已禁用'
    });

  } catch (error) {
    console.error('刪除商品錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

module.exports = router;
