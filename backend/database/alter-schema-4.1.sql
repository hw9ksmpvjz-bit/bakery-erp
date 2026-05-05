-- ============================================
-- 4.1 生產管理 - 數據庫結構
-- 支援：生產計劃審批、自由領料、損耗記錄
-- ============================================

-- ============================================
-- 生產計劃表
-- ============================================
CREATE TABLE IF NOT EXISTS production_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) NOT NULL UNIQUE, -- 生產計劃單號
    
    product_id INTEGER NOT NULL, -- 生產的成品/半成品
    recipe_id INTEGER, -- 參考配方（可選）
    
    plan_quantity INTEGER NOT NULL, -- 計劃生產數量
    actual_quantity INTEGER DEFAULT 0, -- 實際生產數量
    loss_quantity DECIMAL(10, 3) DEFAULT 0, -- 損耗數量
    
    -- 狀態流程：draft → pending → approved → processing → completed → cancelled
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft',      -- 草稿
        'pending',    -- 待審批
        'approved',   -- 已審批
        'processing', -- 生產中
        'completed',  -- 已完成
        'cancelled'   -- 已取消
    )),
    
    plan_date DATE NOT NULL, -- 計劃生產日期
    start_time DATETIME, -- 實際開始時間
    end_time DATETIME, -- 實際結束時間
    
    store_id INTEGER NOT NULL, -- 生產地點（中央工廠）
    
    -- 審批信息
    approved_by INTEGER,
    approved_at DATETIME,
    approval_remark TEXT,
    
    -- 創建人
    created_by INTEGER,
    completed_by INTEGER,
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (completed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_store ON production_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_date ON production_orders(plan_date);

-- ============================================
-- 原料領料表（自由領料，不綁定配方）
-- ============================================
CREATE TABLE IF NOT EXISTS material_requisitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requisition_no VARCHAR(50) NOT NULL UNIQUE, -- 領料單號
    production_order_id INTEGER NOT NULL, -- 關聯生產計劃
    
    total_items INTEGER DEFAULT 0, -- 領料品項數
    total_quantity DECIMAL(10, 3) DEFAULT 0, -- 領料總數量
    total_cost DECIMAL(12, 2) DEFAULT 0, -- 領料總成本
    
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft',     -- 草稿
        'completed', -- 已完成（已出庫）
        'cancelled'  -- 已取消
    )),
    
    requisition_date DATE NOT NULL, -- 領料日期
    
    store_id INTEGER NOT NULL, -- 領料倉庫
    created_by INTEGER,
    completed_by INTEGER,
    completed_at DATETIME,
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (completed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_material_requisitions_production ON material_requisitions(production_order_id);

-- ============================================
-- 原料領料明細表
-- ============================================
CREATE TABLE IF NOT EXISTS material_requisition_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requisition_id INTEGER NOT NULL,
    
    material_id INTEGER NOT NULL, -- 原料ID
    batch_id INTEGER, -- 批次ID（FIFO出庫）
    batch_no VARCHAR(50), -- 批次號
    
    quantity DECIMAL(10, 3) NOT NULL, -- 領料數量
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(10, 4) NOT NULL, -- 當時成本（FIFO成本）
    total_cost DECIMAL(12, 2) NOT NULL,
    
    -- 與配方對比（可選，用於分析）
    recipe_quantity DECIMAL(10, 3), -- 配方建議用量
    variance DECIMAL(10, 3), -- 差異（實際-配方）
    
    FOREIGN KEY (requisition_id) REFERENCES material_requisitions(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES products(id)
);

-- ============================================
-- 生產損耗記錄表
-- ============================================
CREATE TABLE IF NOT EXISTS production_losses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_order_id INTEGER NOT NULL,
    
    loss_type VARCHAR(50) NOT NULL, -- 損耗類型（原料損耗/生產損耗/包裝損耗/其他）
    product_id INTEGER, -- 相關商品（可選）
    
    quantity DECIMAL(10, 3) NOT NULL, -- 損耗數量
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(10, 4) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    
    reason TEXT, -- 損耗原因
    recorded_by INTEGER,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (recorded_by) REFERENCES users(id)
);

-- ============================================
-- 生產入庫表（成品入庫）
-- ============================================
CREATE TABLE IF NOT EXISTS production_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no VARCHAR(50) NOT NULL UNIQUE, -- 入庫單號
    production_order_id INTEGER NOT NULL, -- 關聯生產計劃
    
    product_id INTEGER NOT NULL, -- 成品ID
    quantity INTEGER NOT NULL, -- 入庫數量
    unit VARCHAR(20) NOT NULL,
    
    batch_no VARCHAR(50) NOT NULL, -- 生成的批次號
    production_date DATE NOT NULL, -- 生產日期
    expiry_date DATE NOT NULL, -- 效期截止日
    shelf_life_days INTEGER NOT NULL, -- 保質期天數
    
    unit_cost DECIMAL(10, 4) NOT NULL, -- 單位成本（含原料+損耗）
    total_cost DECIMAL(12, 2) NOT NULL, -- 總成本
    
    store_id INTEGER NOT NULL, -- 入庫倉庫
    received_by INTEGER,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    remark TEXT,
    
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (received_by) REFERENCES users(id)
);

-- ============================================
-- 觸發器 - 自動更新時間
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_production_orders_timestamp 
AFTER UPDATE ON production_orders
BEGIN
    UPDATE production_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_material_requisitions_timestamp 
AFTER UPDATE ON material_requisitions
BEGIN
    UPDATE material_requisitions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 視圖 - 生產計劃匯總
-- ============================================
CREATE VIEW IF NOT EXISTS v_production_summary AS
SELECT 
    po.*,
    p.sku,
    p.name as product_name,
    p.unit,
    s.name as store_name,
    creator.real_name as creator_name,
    approver.real_name as approver_name,
    -- 領料統計
    (SELECT COALESCE(SUM(total_cost), 0) FROM material_requisitions mr 
     JOIN material_requisition_items mri ON mr.id = mri.requisition_id
     WHERE mr.production_order_id = po.id AND mr.status = 'completed') as material_cost,
    -- 損耗統計
    (SELECT COALESCE(SUM(total_cost), 0) FROM production_losses WHERE production_order_id = po.id) as loss_cost,
    -- 實際入庫
    (SELECT COALESCE(SUM(quantity), 0) FROM production_receipts WHERE production_order_id = po.id) as actual_receipt_quantity
FROM production_orders po
JOIN products p ON po.product_id = p.id
JOIN stores s ON po.store_id = s.id
LEFT JOIN users creator ON po.created_by = creator.id
LEFT JOIN users approver ON po.approved_by = approver.id;

-- ============================================
-- 測試數據 - 生產計劃示例
-- ============================================
INSERT OR IGNORE INTO production_orders 
(order_no, product_id, recipe_id, plan_quantity, plan_date, store_id, status, created_by)
SELECT 
    'PR202405010001',
    1, -- 奶香吐司
    1, -- 配方ID
    100, -- 計劃生產100個
    date('now'),
    2, -- 中央工廠
    'draft',
    1
WHERE NOT EXISTS (SELECT 1 FROM production_orders WHERE order_no = 'PR202405010001');
