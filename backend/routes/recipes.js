/**
 * 配方管理路由
 * 支援多版本配方、成本計算
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { logOperation } = require('../utils/logger');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/recipes
 * 獲取配方列表
 */
router.get('/', [
  query('product_id').optional().isInt(),
  query('page').optional().isInt({ min: 1 }),
  query('pageSize').optional().isInt({ min: 1, max: 100 })
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
    const productId = req.query.product_id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;

    let conditions = ['r.status = 1'];
    let params = [];

    if (productId) {
      conditions.push('r.product_id = ?');
      params.push(productId);
    }

    // 查詢總數
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM recipes r
      WHERE ${conditions.join(' AND ')}
    `).get(...params);

    // 查詢數據
    const offset = (page - 1) * pageSize;
    const recipes = db.prepare(`
      SELECT r.*, 
             p.sku as product_sku, 
             p.name as product_name,
             p.unit as product_unit,
             (SELECT COUNT(*) FROM recipe_items WHERE recipe_id = r.id) as item_count,
             (SELECT SUM(quantity) FROM recipe_items WHERE recipe_id = r.id) as total_quantity
      FROM recipes r
      JOIN products p ON r.product_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.is_default DESC, r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({
      success: true,
      data: {
        list: recipes,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    });

  } catch (error) {
    console.error('獲取配方列表錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @GET /api/recipes/:id
 * 獲取配方詳情（含明細）
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

    const recipeId = req.params.id;
    const db = getDatabase();

    // 配方基本信息
    const recipe = db.prepare(`
      SELECT r.*, 
             p.sku as product_sku, 
             p.name as product_name,
             p.unit as product_unit,
             p.retail_price as product_retail_price
      FROM recipes r
      JOIN products p ON r.product_id = p.id
      WHERE r.id = ? AND r.status = 1
    `).get(recipeId);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: '配方不存在'
      });
    }

    // 配方明細
    const items = db.prepare(`
      SELECT ri.*, 
             p.sku as material_sku, 
             p.name as material_name,
             p.unit as material_unit,
             p.purchase_price as material_price
      FROM recipe_items ri
      JOIN products p ON ri.material_id = p.id
      WHERE ri.recipe_id = ?
      ORDER BY ri.sort_order
    `).all(recipeId);

    recipe.items = items;

    // 計算成本利潤
    const totalMaterialCost = items.reduce((sum, item) => sum + (item.cost || 0), 0);
    const costPerUnit = totalMaterialCost / recipe.yield_quantity;
    const profit = recipe.product_retail_price - costPerUnit;
    const profitRate = recipe.product_retail_price > 0 ? (profit / recipe.product_retail_price * 100).toFixed(2) : 0;

    recipe.cost_analysis = {
      total_material_cost: totalMaterialCost,
      cost_per_unit: costPerUnit.toFixed(4),
      retail_price: recipe.product_retail_price,
      profit: profit.toFixed(2),
      profit_rate: profitRate + '%'
    };

    res.json({
      success: true,
      data: recipe
    });

  } catch (error) {
    console.error('獲取配方詳情錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @POST /api/recipes
 * 創建配方
 */
router.post('/', [
  body('product_id').isInt().withMessage('請選擇成品'),
  body('version').trim().notEmpty().withMessage('版本號不能為空'),
  body('yield_quantity').isInt({ min: 1 }).withMessage('出品數量必須大於0'),
  body('items').isArray({ min: 1 }).withMessage('至少需要一個原料')
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

    const { product_id, version, yield_quantity, description, items } = req.body;
    const db = getDatabase();

    // 檢查成品是否存在
    const product = db.prepare('SELECT id, is_producible FROM products WHERE id = ? AND status = 1').get(product_id);
    if (!product) {
      return res.status(400).json({
        success: false,
        message: '成品不存在或已禁用'
      });
    }

    if (!product.is_producible) {
      return res.status(400).json({
        success: false,
        message: '該商品未標記為可生產'
      });
    }

    // 檢查版本是否已存在
    const existingVersion = db.prepare(
      'SELECT id FROM recipes WHERE product_id = ? AND version = ? AND status = 1'
    ).get(product_id, version);
    
    if (existingVersion) {
      return res.status(400).json({
        success: false,
        message: '該版本號已存在'
      });
    }

    // 開始事務
    const result = db.transaction(() => {
      // 如果不是第一個配方，設為非默認
      const isFirst = db.prepare('SELECT COUNT(*) as count FROM recipes WHERE product_id = ? AND status = 1').get(product_id);
      const isDefault = isFirst.count === 0 ? 1 : 0;

      // 創建配方
      const recipeResult = db.prepare(`
        INSERT INTO recipes (product_id, version, is_default, yield_quantity, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(product_id, version, isDefault, yield_quantity, description);

      const recipeId = recipeResult.lastInsertRowid;

      // 創建配方明細
      let totalCost = 0;
      const insertItem = db.prepare(`
        INSERT INTO recipe_items (recipe_id, material_id, quantity, unit, cost, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // 檢查原料是否存在
        const material = db.prepare('SELECT id, purchase_price, unit FROM products WHERE id = ? AND type = "material" AND status = 1').get(item.material_id);
        if (!material) {
          throw new Error(`原料ID ${item.material_id} 不存在`);
        }

        const cost = (material.purchase_price || 0) * item.quantity;
        totalCost += cost;

        insertItem.run(recipeId, item.material_id, item.quantity, item.unit || material.unit, cost, i);
      }

      // 更新配方總成本
      db.prepare('UPDATE recipes SET total_cost = ? WHERE id = ?').run(totalCost, recipeId);

      return recipeId;
    })();

    // 記錄操作日志
    logOperation(req.userId, req.username, 'recipes', 'create', 'recipes', result, null, JSON.stringify({ product_id, version }), req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '配方創建成功',
      data: { id: result }
    });

  } catch (error) {
    console.error('創建配方錯誤:', error);
    res.status(500).json({
      success: false,
      message: error.message || '服務器錯誤'
    });
  }
});

/**
 * @PUT /api/recipes/:id/set-default
 * 設為默認配方
 */
router.put('/:id/set-default', [
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

    const recipeId = req.params.id;
    const db = getDatabase();

    // 獲取配方信息
    const recipe = db.prepare('SELECT product_id FROM recipes WHERE id = ? AND status = 1').get(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: '配方不存在'
      });
    }

    // 將該商品的所有配方設為非默認
    db.prepare('UPDATE recipes SET is_default = 0 WHERE product_id = ?').run(recipe.product_id);
    
    // 設當前配方為默認
    db.prepare('UPDATE recipes SET is_default = 1 WHERE id = ?').run(recipeId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'recipes', 'set_default', 'recipes', recipeId, null, null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '已設為默認配方'
    });

  } catch (error) {
    console.error('設置默認配方錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

/**
 * @DELETE /api/recipes/:id
 * 刪除配方
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

    const recipeId = req.params.id;
    const db = getDatabase();

    // 檢查配方是否存在
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND status = 1').get(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: '配方不存在'
      });
    }

    // 檢查是否為默認配方
    if (recipe.is_default) {
      return res.status(400).json({
        success: false,
        message: '默認配方不能刪除，請先設置其他配方為默認'
      });
    }

    // 軟刪除
    db.prepare('UPDATE recipes SET status = 0 WHERE id = ?').run(recipeId);

    // 記錄操作日志
    logOperation(req.userId, req.username, 'recipes', 'delete', 'recipes', recipeId, JSON.stringify(recipe), null, req.ip, req.headers['user-agent'], 1);

    res.json({
      success: true,
      message: '配方已刪除'
    });

  } catch (error) {
    console.error('刪除配方錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

module.exports = router;
