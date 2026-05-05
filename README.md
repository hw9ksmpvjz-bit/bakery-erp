# 烘焙業ERP管理系統

🥐 專為烘焙行業打造的進銷存管理系統

## 系統概述

本系統是針對烘焙行業特點開發的企業級ERP管理系統，支援多分店、多業態、完整的財務管理。

### 核心功能

- ✅ **基礎管理**：用戶權限、分店管理、角色控制
- ✅ **商品管理**：SKU管理、多單位換算、配方BOM、效期管理
- ✅ **採購管理**：供應商管理、採購訂單、分批入庫、FIFO批次
- ✅ **生產管理**：生產計劃、原料領料、損耗記錄、成本核算
- ✅ **庫存管理**：實時庫存、效期预警、調撥管理、盤點
- ✅ **銷售管理**：POS開單、多支付、會員積分、退貨管理
- ✅ **財務管理**：應收應付、會計憑證、三大報表
- ✅ **報表中心**：銷售報表、庫存報表、利潤分析

## 技術棧

### 後端
- **運行環境**: Node.js 18+
- **框架**: Express.js
- **數據庫**: SQLite (better-sqlite3)
- **認證**: JWT
- **安全**: bcrypt、helmet、rate-limit

### 前端
- **框架**: Vue 3 (Composition API)
- **構建工具**: Vite
- **UI組件庫**: Element Plus
- **狀態管理**: Pinia
- **圖表**: ECharts
- **樣式**: SCSS (橙色主題)

## 快速開始

### 環境要求
- Node.js >= 18.0.0
- npm >= 9.0.0

### 一鍵部署

```bash
# 1. 進入項目目錄
cd erp-system

# 2. 運行部署腳本
./scripts/deploy.sh

# 3. 啟動後端服務
cd backend
npm start

# 4. 新開終端，啟動前端
cd frontend
npm run dev
```

### 手動部署

#### 後端部署

```bash
cd backend

# 安裝依賴
npm install

# 初始化數據庫
npm run init-db

# 啟動服務
npm start
```

#### 前端部署

```bash
cd frontend

# 安裝依賴
npm install

# 開發模式
npm run dev

# 生產構建
npm run build
```

## 訪問地址

- **前端界面**: http://localhost:5173
- **後端API**: http://localhost:3000
- **API文檔**: http://localhost:3000/api/health

## 默認賬號

- **賬號**: admin
- **密碼**: admin123
- **角色**: 超級管理員

## 項目結構

```
erp-system/
├── backend/              # 後端代碼
│   ├── database/         # 數據庫表結構
│   ├── middleware/       # 中間件
│   ├── routes/           # API路由
│   ├── utils/            # 工具函數
│   └── server.js         # 服務入口
├── frontend/             # 前端代碼
│   ├── src/
│   │   ├── views/        # 頁面組件
│   │   ├── layouts/      # 佈局組件
│   │   ├── stores/       # Pinia狀態
│   │   └── styles/       # 全局樣式
│   └── index.html
├── scripts/              # 部署腳本
└── docs/                 # 文檔
```

## API接口列表

### 認證模塊
- POST `/api/auth/login` - 登錄
- POST `/api/auth/logout` - 登出
- GET `/api/auth/profile` - 獲取個人信息

### 商品模塊
- GET `/api/products` - 商品列表
- POST `/api/products` - 創建商品
- GET `/api/recipes` - 配方列表

### 採購模塊
- GET `/api/purchase/orders` - 採購訂單
- POST `/api/purchase/orders` - 創建訂單
- POST `/api/purchase/orders/:id/approve` - 審批訂單

### 生產模塊
- GET `/api/production/orders` - 生產計劃
- POST `/api/production/orders` - 創建計劃
- POST `/api/production/orders/:id/complete` - 完成生產

### 銷售模塊
- GET `/api/sales/orders` - 銷售訂單
- POST `/api/sales/orders` - POS開單
- POST `/api/sales/returns` - 退貨

### 庫存模塊
- GET `/api/inventory` - 庫存查詢
- GET `/api/inventory/expiry-warnings` - 效期预警
- GET `/api/transfers` - 調撥單

### 財務模塊
- GET `/api/finance/receivables` - 應收賬款
- GET `/api/finance/payables` - 應付賬款
- POST `/api/finance/receipt-vouchers` - 收款單

### 報表模塊
- GET `/api/reports/sales` - 銷售報表
- GET `/api/reports/inventory` - 庫存報表
- GET `/api/reports/profit` - 利潤報表
- GET `/api/reports/dashboard` - 儀表板

## 烘焙行業特性

本系統針對烘焙行業特點進行了專門設計：

1. **效期管理**: 每個批次綁定生產日期和效期，自動预警
2. **FIFO出庫**: 原料和成品都支援先進先出
3. **配方管理**: 支援BOM配方，自動計算成本
4. **批次追溯**: 從原料採購到成品銷售全流程追溯
5. **損耗記錄**: 生產過程中的損耗單獨記錄

## 開發團隊

- 開發週期: 100小時
- 代碼行數: 20000+
- 功能模塊: 8大模塊
- API接口: 100+

## 許可證

MIT License

## 聯繫方式

如有問題或建議，歡迎提 Issue 或 PR。

---

🥐 讓烘焙管理更簡單！