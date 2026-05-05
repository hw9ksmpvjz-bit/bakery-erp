/**
 * 生產報表路由
 * 產能統計、成本分析、生產日曆
 */

const express = require('express');
const { query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

/**
 * @GET /api/production/reports/capacity
 * 產能統計報表
 */
router.get('/reports/capacity', [
  query('start_date').isDate(),
  query('end_date').isDate(),
  query('store_id').optional().isInt()
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
    const { start_date, end_date, store_id } = req.query;

    const storeCondition = store_id ? 'AND store_id = ?' : '';
    const params = store_id ? [start_date, end_date, store_id] : [start_date, end_date];

    // 按日期統計產能
    const dailyStats = db.prepare(`
      SELECT 
        plan_date as date,
        COUNT(*) as order_count,
        SUM(plan_quantity) as total_plan,
        SUM(actual_quantity) as total_actual,
        SUM(loss_quantity) as total_loss,
        ROUND(SUM(actual_quantity) * 100.0 / SUM(plan_quantity), 2) as completion_rate
      FROM production_orders
      WHERE plan_date BETWEEN ? AND ?
      AND status = 'completed'
      ${storeCondition}
      GROUP BY plan_date
      ORDER BY plan_date
    `).all(...params);

    // 按商品統計產能
    const productStats = db.prepare(`
      SELECT 
        p.name as product_name,
        p.sku,
        COUNT(*) as order_count,
        SUM(plan_quantity) as total_plan,
        SUM(actual_quantity) as total_actual,
        SUM(loss_quantity) as total_loss,
        ROUND(SUM(actual_quantity) * 100.0 / SUM(plan_quantity), 2) as completion_rate
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      WHERE po.plan_date BETWEEN ? AND ?
      AND po.status = 'completed'
      ${storeCondition}
      GROUP BY po.product_id
      ORDER BY total_actual DESC
    `).all(...params);

    // 總計
    const totalStats = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(plan_quantity) as total_plan,
        SUM(actual_quantity) as total_actual,
        SUM(loss_quantity) as total_loss,
        ROUND(SUM(actual_quantity) * 100.0 / NULLIF(SUM(plan_quantity), 0), 2) as overall_completion_rate,
        AVG(julianday(end_time) - julianday(start_time)) * 24 as avg_production_hours
      FROM production_orders
      WHERE plan_date BETWEEN ? AND ?
      AND status = 'completed'
      ${storeCondition}
    `).get(...params);

    res.json({
      success: true,
      data: {
        daily_stats: dailyStats,
        product_stats: productStats,
        total_stats: totalStats
      }
    });

  } catch (error) {
    console.error('獲取產能報表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/production/reports/cost
 * 成本分析報表
 */
router.get('/reports/cost', [
  query('start_date').isDate(),
  query('end_date').isDate(),
  query('store_id').optional().isInt()
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
    const { start_date, end_date, store_id } = req.query;

    const storeCondition = store_id ? 'AND po.store_id = ?' : '';
    const params = store_id ? [start_date, end_date, store_id] : [start_date, end_date];

    // 按生產訂單統計成本
    const orderCosts = db.prepare(`
      SELECT 
        po.order_no,
        p.name as product_name,
        po.actual_quantity,
        COALESCE(mr.material_cost, 0) as material_cost,
        COALESCE(pl.loss_cost, 0) as loss_cost,
        COALESCE(mr.material_cost, 0) + COALESCE(pl.loss_cost, 0) as total_cost,
        CASE 
          WHEN po.actual_quantity > 0 
          THEN ROUND((COALESCE(mr.material_cost, 0) + COALESCE(pl.loss_cost, 0)) / po.actual_quantity, 4)
          ELSE 0 
        END as unit_cost
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      LEFT JOIN (
        SELECT production_order_id, SUM(total_cost) as material_cost
        FROM material_requisitions mr
        JOIN material_requisition_items mri ON mr.id = mri.requisition_id
        WHERE mr.status = 'completed'
        GROUP BY production_order_id
      ) mr ON po.id = mr.production_order_id
      LEFT JOIN (
        SELECT production_order_id, SUM(total_cost) as loss_cost
        FROM production_losses
        GROUP BY production_order_id
      ) pl ON po.id = pl.production_order_id
      WHERE po.plan_date BETWEEN ? AND ?
      AND po.status = 'completed'
      ${storeCondition}
      ORDER BY po.plan_date DESC
    `).all(...params);

    // 按商品統計平均成本
    const productCosts = db.prepare(`
      SELECT 
        p.name as product_name,
        p.sku,
        COUNT(*) as production_count,
        SUM(po.actual_quantity) as total_quantity,
        SUM(COALESCE(mr.material_cost, 0)) as total_material_cost,
        SUM(COALESCE(pl.loss_cost, 0)) as total_loss_cost,
        SUM(COALESCE(mr.material_cost, 0) + COALESCE(pl.loss_cost, 0)) as total_cost,
        ROUND(SUM(COALESCE(mr.material_cost, 0) + COALESCE(pl.loss_cost, 0)) / SUM(po.actual_quantity), 4) as avg_unit_cost,
        p.retail_price,
        ROUND(p.retail_price - (SUM(COALESCE(mr.material_cost, 0) + COALESCE(pl.loss_cost, 0)) / SUM(po.actual_quantity)), 2) as avg_profit
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      LEFT JOIN (
        SELECT production_order_id, SUM(total_cost) as material_cost
        FROM material_requisitions mr
        JOIN material_requisition_items mri ON mr.id = mri.requisition_id
        WHERE mr.status = 'completed'
        GROUP BY production_order_id
      ) mr ON po.id = mr.production_order_id
      LEFT JOIN (
        SELECT production_order_id, SUM(total_cost) as loss_cost
        FROM production_losses
        GROUP BY production_order_id
      ) pl ON po.id = pl.production_order_id
      WHERE po.plan_date BETWEEN ? AND ?
      AND po.status = 'completed'
      ${storeCondition}
      GROUP BY po.product_id
      ORDER BY total_cost DESC
    `).all(...params);

    // 損耗分析
    const lossAnalysis = db.prepare(`
      SELECT 
        loss_type,
        COUNT(*) as occurrence_count,
        SUM(quantity) as total_quantity,
        SUM(total_cost) as total_cost,
        ROUND(SUM(total_cost) * 100.0 / (SELECT SUM(total_cost) FROM production_losses pl2 
          JOIN production_orders po2 ON pl2.production_order_id = po2.id
          WHERE po2.plan_date BETWEEN ? AND ? ${storeCondition}), 2) as cost_percentage
      FROM production_losses pl
      JOIN production_orders po ON pl.production_order_id = po.id
      WHERE po.plan_date BETWEEN ? AND ?
      ${storeCondition}
      GROUP BY loss_type
      ORDER BY total_cost DESC
    `).all(...params, ...params);

    res.json({
      success: true,
      data: {
        order_costs: orderCosts,
        product_costs: productCosts,
        loss_analysis: lossAnalysis
      }
    });

  } catch (error) {
    console.error('獲取成本報表錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

/**
 * @GET /api/production/calendar
 * 生產日曆視圖
 */
router.get('/calendar', [
  query('year').isInt({ min: 2020, max: 2030 }),
  query('month').isInt({ min: 1, max: 12 }),
  query('store_id').optional().isInt()
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
    const { year, month, store_id } = req.query;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const storeCondition = store_id ? 'AND store_id = ?' : '';
    const params = store_id ? [startDate, endDate, store_id] : [startDate, endDate];

    // 獲取當月生產計劃
    const productions = db.prepare(`
      SELECT 
        po.id,
        po.order_no,
        po.plan_date as date,
        po.status,
        p.name as product_name,
        po.plan_quantity,
        po.actual_quantity,
        s.name as store_name,
        CASE po.status
          WHEN 'draft' THEN '#909399'
          WHEN 'pending' THEN '#E6A23C'
          WHEN 'approved' THEN '#409EFF'
          WHEN 'processing' THEN '#67C23A'
          WHEN 'completed' THEN '#10B981'
          WHEN 'cancelled' THEN '#F56C6C'
        END as color
      FROM production_orders po
      JOIN products p ON po.product_id = p.id
      JOIN stores s ON po.store_id = s.id
      WHERE po.plan_date BETWEEN ? AND ?
      ${storeCondition}
      ORDER BY po.plan_date
    `).all(...params);

    // 按日期分組
    const calendarData = {};
    productions.forEach(p => {
      if (!calendarData[p.date]) {
        calendarData[p.date] = [];
      }
      calendarData[p.date].push(p);
    });

    // 生成月曆數據
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateProductions = calendarData[date] || [];
      
      calendar.push({
        date,
        day,
        productions: dateProductions,
        total_plan: dateProductions.reduce((sum, p) => sum + p.plan_quantity, 0),
        total_actual: dateProductions.reduce((sum, p) => sum + (p.actual_quantity || 0), 0),
        order_count: dateProductions.length
      });
    }

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        month: parseInt(month),
        calendar: calendar,
        summary: {
          total_days_with_production: Object.keys(calendarData).length,
          total_orders: productions.length,
          total_plan: productions.reduce((sum, p) => sum + p.plan_quantity, 0),
          completed_orders: productions.filter(p => p.status === 'completed').length
        }
      }
    });

  } catch (error) {
    console.error('獲取生產日曆錯誤:', error);
    res.status(500).json({ success: false, message: '服務器錯誤' });
  }
});

module.exports = router;
