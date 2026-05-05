# 🥐 烘焙ERP - GitHub Codespaces 使用指南

## 快速開始（純雲端開發）

### 第一步：創建 Codespace

1. 打開您的 GitHub 倉庫頁面
2. 點擊綠色的 **"<> Code"** 按鈕
3. 切換到 **"Codespaces"** 標籤
4. 點擊 **"Create codespace on main"**

### 第二步：等待自動初始化

Codespace 創建後會自動：
- ✅ 安裝 Node.js 20
- ✅ 安裝前後端依賴
- ✅ 初始化 SQLite 數據庫
- ✅ 設置管理員賬號 (admin / admin123)
- ✅ 啟動前後端服務

### 第三步：訪問ERP系統

1. 等待右側出現 **"Ports"** 面板
2. 找到端口 **5173**（ERP前端）
3. 點擊 **"Open in Browser"** 🌐 圖標
4. 或使用自動彈出的預覽窗口

**公網訪問網址格式**：
```
https://<codespace-name>-5173.github.dev
```

### 第四步：登錄系統

- **賬號**: `admin`
- **密碼**: `admin123`

## 開發工作流程

### 您（用戶）的操作：
1. 在瀏覽器中打開 Codespace
2. 使用 ERP 系統
3. 發現問題或需要新功能 → 截圖並告訴我

### 我（OpenClaw）的操作：
1. 修改代碼並保存到倉庫
2. 您在 Codespace 中點擊 **"Pull"** 同步最新代碼
3. 服務自動重啟（或點擊重啟按鈕）
4. 刷新瀏覽器即可看到更新

## 日後遷移到正式服務器

Codespaces 環境與正式服務器完全兼容：

### 方案1：Vercel + Railway（推薦，低成本）
```bash
# 前端部署到 Vercel（免費）
# 後端部署到 Railway（免費額度足夠）
```

### 方案2：單台雲服務器
```bash
# 使用 PM2 管理後端
# Nginx 反向代理前端
# 成本約 50-100元/月
```

### 方案3：Serverless
```bash
# 前端：Vercel/Netlify（免費）
# 後端：Vercel Serverless Functions（免費額度）
# 數據庫：Supabase PostgreSQL（免費額度）
```

## 注意事項

1. **Codespaces 免費額度**：
   - 個人賬號：每月 60 小時免費
   - Pro 賬號：每月 180 小時免費
   - 超過後會自動休眠，數據不會丟失

2. **數據持久化**：
   - SQLite 數據庫保存在倉庫中
   - 重啟 Codespace 數據不丟失
   - 刪除 Codespace 後數據會丟失（重要數據請備份）

3. **性能**：
   - Codespaces 配置為 2核4GB（免費版）
   - 足夠 ERP 開發和測試使用

## 故障排除

### 如果服務沒有自動啟動
```bash
# 在 Codespace 終端中執行
bash .devcontainer/start.sh
```

### 如果端口沒有轉發
```bash
# 手動轉發端口
gh codespace ports forward 5173:5173
```

### 重置數據庫
```bash
cd /workspaces/erp-system/backend
rm data/erp.db
node -e "const { initializeDatabase } = require('./database/connection'); initializeDatabase();"
```

## 聯繫支持

如有問題，請截圖並描述現象，我會立即幫您解決。
