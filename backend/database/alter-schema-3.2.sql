-- ============================================
-- 3.2 庫存管理 - 數據庫結構調整
-- 烘焙行業核心：效期管理、臨期預警、報廢流程、批次跟蹤
-- ============================================

-- ============================================
-- 庫存主表擴展（已存在，添加效期相關索引和視圖）
-- ============================================

-- 成品批次表（用於追溯生產批次）
CREATE TABLE IF NOT EXISTS product_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no VARCHAR(50) NOT NULL, -- 生產批次號
    product_id INTEGER NOT NULL, -- 成品ID
    recipe_id INTEGER, -- 使用的配方
    production_order_id INTEGER, -- 生產訂單ID
    
    -- 生產信息
    production_date DATE NOT NULL, -- 生產日期
    expiry_date DATE NOT NULL, -- 效期截止日
    shelf_life_days INTEGER NOT NULL, -- 保質期天數
    
    -- 數量信息
    initial_quantity DECIMAL(10, 3) NOT NULL, -- 初始數量
    remaining_quantity DECIMAL(10, 3) NOT NULL, -- 剩餘數量
    unit VARCHAR(20) NOT NULL,
    
    -- 成本信息
    unit_cost DECIMAL(10, 4) NOT NULL, -- 單位成本
    total_cost DECIMAL(12, 2) NOT NULL, -- 總成本
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired', 'scrapped', 'sold_out')),
    -- active:正常, expiring:臨期, expired:已過期, scrapped:已報廢, sold_out:已售完
    
    store_id INTEGER NOT NULL, -- 所在分店
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id),
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(product_id, store_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_store ON product_batches(store_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_status ON product_batches(status);

-- ============================================
-- 報廢單表
-- ============================================
CREATE TABLE IF NOT EXISTS scrap_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scrap_no VARCHAR(50) NOT NULL UNIQUE, -- 報廢單號
    store_id INTEGER NOT NULL, -- 報廢分店
    
    total_items INTEGER DEFAULT 0, -- 報廢品項數
    total_quantity DECIMAL(10, 3) DEFAULT 0, -- 報廢總數量
    total_cost DECIMAL(12, 2) DEFAULT 0, -- 報廢總成本
    
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'completed', 'cancelled')),
    -- draft:草稿, pending:待審批, approved:已審批, completed:已完成, cancelled:已取消
    
    reason_category VARCHAR(50), -- 報廢原因分類（過期/損壞/品質問題/其他）
    reason_description TEXT, -- 詳細說明
    
    created_by INTEGER,
    approved_by INTEGER,
    approved_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_scrap_orders_store ON scrap_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_scrap_orders_status ON scrap_orders(status);

-- ============================================
-- 報廢單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS scrap_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scrap_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL, -- 商品ID
    batch_id INTEGER, -- 批次ID（成品批次或原料批次）
    batch_type VARCHAR(20) CHECK (batch_type IN ('product', 'material')), -- 批次類型
    
    quantity DECIMAL(10, 3) NOT NULL, -- 報廢數量
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(10, 4) NOT NULL, -- 當時成本
    total_cost DECIMAL(12, 2) NOT NULL, -- 總成本
    
    reason TEXT, -- 該品項報廢原因
    FOREIGN KEY (scrap_id) REFERENCES scrap_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 庫存盤點表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_no VARCHAR(50) NOT NULL UNIQUE, -- 盤點單號
    store_id INTEGER NOT NULL, -- 盤點分店
    
    status VARCHAR(20) DEFAULT 'created' CHECK (status IN ('created', 'processing', 'pending_approval', 'completed', 'cancelled')),
    -- created:創建, processing:盤點中, pending_approval:待審批（有盤虧）, completed:已完成, cancelled:已取消
    
    total_products INTEGER DEFAULT 0, -- 盤點商品數
    profit_items INTEGER DEFAULT 0, -- 盤盈品項數
    loss_items INTEGER DEFAULT 0, -- 盤虧品項數
    profit_amount DECIMAL(12, 2) DEFAULT 0, -- 盤盈金額
    loss_amount DECIMAL(12, 2) DEFAULT 0, -- 盤虧金額
    
    check_date DATE NOT NULL, -- 盤點日期
    started_at DATETIME,
    completed_at DATETIME,
    
    created_by INTEGER,
    approved_by INTEGER, -- 盤虧審批人
    approved_at DATETIME,
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- ============================================
-- 庫存盤點明細表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_check_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    batch_id INTEGER, -- 批次ID
    batch_type VARCHAR(20) CHECK (batch_type IN ('product', 'material')),
    
    system_quantity DECIMAL(10, 3) NOT NULL, -- 系統數量
    actual_quantity DECIMAL(10, 3) NOT NULL, -- 實際數量
    difference DECIMAL(10, 3) NOT NULL, -- 差異數量（實際-系統）
    
    unit_cost DECIMAL(10, 4) NOT NULL, -- 單位成本
    difference_cost DECIMAL(12, 2) NOT NULL, -- 差異金額
    
    is_profitable INTEGER DEFAULT 0, -- 是否盤盈
    is_loss INTEGER DEFAULT 0, -- 是否盤虧
    
    reason TEXT, -- 差異原因
    FOREIGN KEY (check_id) REFERENCES inventory_checks(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 臨期預警配置表
-- ============================================
CREATE TABLE IF NOT EXISTS expiry_warning_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_type VARCHAR(20) NOT NULL, -- 商品類型（finished/semi/material）
    warning_days INTEGER NOT NULL DEFAULT 7, -- 臨期预警天數
    critical_days INTEGER NOT NULL DEFAULT 3, -- 緊急预警天數
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默認配置
INSERT OR IGNORE INTO expiry_warning_config (product_type, warning_days, critical_days) VALUES
('finished', 3, 1),   -- 成品：3天预警，1天緊急
('semi', 2, 1),       -- 半成品：2天预警，1天緊急
('material', 7, 3);   -- 原料：7天预警，3天緊急

-- ============================================
-- 視圖 - 成品庫存匯總（含效期狀態）
-- ============================================
CREATE VIEW IF NOT EXISTS v_product_inventory_with_expiry AS
SELECT 
    pb.id as batch_id,
    pb.batch_no,
    p.id as product_id,
    p.sku,
    p.name as product_name,
    p.type,
    p.shelf_life_days,
    s.id as store_id,
    s.name as store_name,
    pb.production_date,
    pb.expiry_date,
    pb.remaining_quantity,
    pb.unit,
    pb.unit_cost,
    pb.status,
    CASE 
        WHEN pb.expiry_date < date('now') THEN 'expired'
        WHEN pb.expiry_date <= date('now', '+1 day') THEN 'critical'
        WHEN pb.expiry_date <= date('now', '+3 day') AND p.type = 'finished' THEN 'warning'
        WHEN pb.expiry_date <= date('now', '+2 day') AND p.type = 'semi' THEN 'warning'
        WHEN pb.expiry_date <= date('now', '+7 day') AND p.type = 'material' THEN 'warning'
        ELSE 'normal'
    END as expiry_status,
    julianday(pb.expiry_date) - julianday('now') as days_until_expiry
FROM product_batches pb
JOIN products p ON pb.product_id = p.id
JOIN stores s ON pb.store_id = s.id
WHERE pb.remaining_quantity > 0 AND pb.status IN ('active', 'expiring');

-- ============================================
-- 視圖 - 臨期商品預警列表
-- ============================================
CREATE VIEW IF NOT EXISTS v_expiry_warnings AS
SELECT 
    v.*,
    CASE v.expiry_status
        WHEN 'expired' THEN 3
        WHEN 'critical' THEN 2
        WHEN 'warning' THEN 1
        ELSE 0
    END as warning_level
FROM v_product_inventory_with_expiry v
WHERE v.expiry_status IN ('warning', 'critical', 'expired')
ORDER BY warning_level DESC, v.days_until_expiry ASC;

-- ============================================
-- 視圖 - 庫存批次追溯（全流程）
-- ============================================
CREATE VIEW IF NOT EXISTS v_batch_traceability AS
SELECT 
    pb.id as batch_id,
    pb.batch_no,
    'product' as batch_type,
    p.id as product_id,
    p.name as product_name,
    p.type,
    po.id as production_order_id,
    po.order_no as production_order_no,
    po.plan_date as production_date,
    s.name as store_name,
    pb.initial_quantity,
    pb.remaining_quantity,
    -- 原料來源（通過配方關聯）
    (SELECT GROUP_CONCAT(DISTINCT mb.batch_no)
     FROM production_materials pm
     JOIN material_batches mb ON pm.batch_id = mb.id
     WHERE pm.production_id = po.id) as source_material_batches
FROM product_batches pb
JOIN products p ON pb.product_id = p.id
JOIN production_orders po ON pb.production_order_id = po.id
JOIN stores s ON pb.store_id = s.id

UNION ALL

SELECT 
    mb.id as batch_id,
    mb.batch_no,
    'material' as batch_type,
    p.id as product_id,
    p.name as product_name,
    p.type,
    po.id as purchase_order_id,
    po.order_no as purchase_order_no,
    date(mb.received_at) as purchase_date,
    s.name as store_name,
    mb.initial_quantity,
    mb.remaining_quantity,
    sup.name as supplier_name
FROM material_batches mb
JOIN products p ON mb.product_id = p.id
JOIN purchase_orders po ON mb.purchase_order_id = po.id
JOIN stores s ON mb.store_id = s.id
JOIN suppliers sup ON mb.supplier_id = sup.id;

-- ============================================
-- 觸發器 - 自動更新盤點時間
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_inventory_checks_timestamp 
AFTER UPDATE ON inventory_checks
BEGIN
    UPDATE inventory_checks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 測試數據 - 臨期商品（用於驗證預警功能）
-- ============================================
-- 創建一個明天過期的奶香吐司批次
INSERT OR IGNORE INTO product_batches 
(batch_no, product_id, recipe_id, production_date, expiry_date, shelf_life_days,
 initial_quantity, remaining_quantity, unit, unit_cost, total_cost, store_id, status)
SELECT 
    'TEST-EXPIRING-001',
    1, -- 奶香吐司
    1, -- 配方ID
    date('now', '-2 day'), -- 2天前生產
    date('now', '+1 day'), -- 明天過期
    3,
    50,
    20, -- 還剩20個
    '個',
    8.00,
    160.00,
    4, -- 旗艦店
    'expiring'
WHERE NOT EXISTS (SELECT 1 FROM product_batches WHERE batch_no = 'TEST-EXPIRING-001');

-- 創建一個已過期的草莓蛋糕批次
INSERT OR IGNORE INTO product_batches 
(batch_no, product_id, recipe_id, production_date, expiry_date, shelf_life_days,
 initial_quantity, remaining_quantity, unit, unit_cost, total_cost, store_id, status)
SELECT 
    'TEST-EXPIRED-001',
    4, -- 草莓蛋糕
    NULL,
    date('now', '-3 day'), -- 3天前生產
    date('now', '-1 day'), -- 昨天已過期
    2,
    10,
    5, -- 還剩5個
    '個',
    35.00,
    175.00,
    4, -- 旗艦店
    'expired'
WHERE NOT EXISTS (SELECT 1 FROM product_batches WHERE batch_no = 'TEST-EXPIRED-001');
