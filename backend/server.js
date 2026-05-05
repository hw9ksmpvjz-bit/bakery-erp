/**
 * ERP 進銷存系統 - 後端服務
 * 技術棧: Node.js + Express + SQLite
 * 版本: 1.0.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { initializeDatabase } = require('./database/connection');
const { requestLogger, errorLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const recipeRoutes = require('./routes/recipes');
const categoryRoutes = require('./routes/categories');
const supplierRoutes = require('./routes/suppliers');
const customerRoutes = require('./routes/customers');
const purchaseRoutes = require('./routes/purchase');
const transferRoutes = require('./routes/transfers');
const productionRoutes = require('./routes/production');
const productionReportRoutes = require('./routes/production-reports');
const dailyReportRoutes = require('./routes/daily-reports');
const financeRoutes = require('./routes/finance');
const accountingRoutes = require('./routes/accounting');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const reportRoutes = require('./routes/reports');
// const logRoutes = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 安全中間件
// ============================================

// Helmet 安全標頭
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS 配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 請求頻率限制
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分鐘
  max: 100, // 每IP 100次請求
  message: { success: false, message: '請求過於頻繁，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// 嚴格頻率限制（登錄接口）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 5, // 5次嘗試
  message: { success: false, message: '登錄嘗試次數過多，請15分鐘後再試' },
});

// 請求體解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 請求日志
app.use(requestLogger);

// ============================================
// 靜態檔案服務
// ============================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// API 路由
// ============================================

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '服務正常運行',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 認證路由（登錄/註冊）
app.use('/api/auth', authLimiter, authRoutes);

// 其他路由（需要認證）
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/production', productionReportRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
// app.use('/api/logs', logRoutes);

// ============================================
// 錯誤處理
// ============================================

// 404 處理
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '接口不存在' 
  });
});

// 錯誤日志
app.use(errorLogger);

// 全局錯誤處理
app.use(errorHandler);

// ============================================
// 啟動服務
// ============================================

async function startServer() {
  try {
    // 初始化數據庫
    await initializeDatabase();
    console.log('✅ 數據庫連接成功');
    
    // 啟動服務
    app.listen(PORT, () => {
      console.log(`🚀 ERP 後端服務啟動成功`);
      console.log(`📡 監聽端口: ${PORT}`);
      console.log(`🌐 訪問地址: http://localhost:${PORT}`);
      console.log(`📚 API 文檔: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ 服務啟動失敗:', error.message);
    process.exit(1);
  }
}

// 啟動
startServer();

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('🛑 收到 SIGTERM 訊號，正在關閉服務...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 收到 SIGINT 訊號，正在關閉服務...');
  process.exit(0);
});

module.exports = app;