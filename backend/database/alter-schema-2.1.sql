-- ============================================
-- 2.1 商品管理 - 數據庫結構調整
-- 新增：多單位換算、FIFO批次管理
-- ============================================

-- ============================================
-- 商品多單位換算表
-- ============================================
CREATE TABLE IF NOT EXISTS product_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    unit_name VARCHAR(20) NOT NULL, -- 單位名稱（箱、盒、個）
    conversion_rate DECIMAL(10, 4) NOT NULL DEFAULT 1, -- 換算率（相對於基本單位）
    is_default INTEGER DEFAULT 0, -- 是否默認單位
    is_purchase_unit INTEGER DEFAULT 0, -- 是否採購單位
    is_sale_unit INTEGER DEFAULT 0, -- 是否銷售單位
    barcode VARCHAR(50), -- 該單位條碼
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(product_id, unit_name)
);

CREATE INDEX IF NOT EXISTS idx_product_units_product ON product_units(product_id);

-- ============================================
-- 原料批次表（FIFO管理）
-- ============================================
CREATE TABLE IF NOT EXISTS material_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no VARCHAR(50) NOT NULL, -- 批次號
    product_id INTEGER NOT NULL, -- 原料ID
    supplier_id INTEGER, -- 供應商ID
    purchase_order_id INTEGER, -- 採購訂單ID
    
    -- 數量信息
    initial_quantity DECIMAL(10, 3) NOT NULL, -- 初始數量
    remaining_quantity DECIMAL(10, 3) NOT NULL, -- 剩餘數量
    unit VARCHAR(20) NOT NULL,
    
    -- 成本信息（FIFO核心）
    unit_cost DECIMAL(10, 4) NOT NULL, -- 單位成本
    total_cost DECIMAL(12, 2) NOT NULL, -- 總成本
    
    -- 日期信息
    production_date DATE, -- 生產日期
    expiry_date DATE, -- 有效期
    received_at DATETIME, -- 入庫時間（FIFO排序依據）
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'empty', 'expired')),
    -- active:可用, locked:鎖定, empty:已用完, expired:已過期
    
    store_id INTEGER NOT NULL, -- 所在倉庫/分店
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    UNIQUE(product_id, store_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_material_batches_product ON material_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_material_batches_store ON material_batches(store_id);
CREATE INDEX IF NOT EXISTS idx_material_batches_status ON material_batches(status);
CREATE INDEX IF NOT EXISTS idx_material_batches_received ON material_batches(received_at);
CREATE INDEX IF NOT EXISTS idx_material_batches_expiry ON material_batches(expiry_date);

-- ============================================
-- 批次消耗記錄表（FIFO追蹤）
-- ============================================
CREATE TABLE IF NOT EXISTS batch_consumptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL, -- 消耗的批次
    reference_type VARCHAR(50) NOT NULL, -- 消耗類型（生產領料、調撥等）
    reference_id INTEGER NOT NULL, -- 關聯單據ID
    quantity DECIMAL(10, 3) NOT NULL, -- 消耗數量
    unit_cost DECIMAL(10, 4) NOT NULL, -- 當時成本（FIFO成本）
    total_cost DECIMAL(12, 2) NOT NULL, -- 總成本
    consumed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES material_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_batch_consumptions_batch ON batch_consumptions(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_consumptions_reference ON batch_consumptions(reference_type, reference_id);

-- ============================================
-- 視圖 - 原料批次庫存（按FIFO排序）
-- ============================================
CREATE VIEW IF NOT EXISTS v_material_batches_fifo AS
SELECT 
    mb.*,
    p.name as product_name,
    p.sku as product_sku,
    s.name as store_name,
    CASE 
        WHEN mb.expiry_date < date('now') THEN 'expired'
        WHEN mb.expiry_date <= date('now', '+3 day') THEN 'expiring_soon'
        ELSE 'normal'
    END as expiry_status
FROM material_batches mb
JOIN products p ON mb.product_id = p.id
JOIN stores s ON mb.store_id = s.id
WHERE mb.status = 'active' AND mb.remaining_quantity > 0
ORDER BY mb.received_at ASC; -- FIFO：先入庫的先出

-- ============================================
-- 視圖 - 商品庫存匯總（含多單位）
-- ============================================
CREATE VIEW IF NOT EXISTS v_product_stock_with_units AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.type,
    p.stock_quantity as base_quantity,
    p.unit as base_unit,
    pu.unit_name,
    pu.conversion_rate,
    ROUND(p.stock_quantity / pu.conversion_rate, 2) as converted_quantity,
    pu.is_default,
    pu.is_purchase_unit,
    pu.is_sale_unit
FROM products p
LEFT JOIN product_units pu ON p.id = pu.product_id AND pu.status = 1
WHERE p.status = 1;

-- ============================================
-- 插入測試數據 - 多單位
-- ============================================
INSERT OR IGNORE INTO product_units (product_id, unit_name, conversion_rate, is_default, is_purchase_unit, is_sale_unit, barcode) VALUES
-- 奶香吐司：基本單位是"個"
(1, '個', 1, 1, 0, 1, 'B001-01'),
(1, '盒', 10, 0, 0, 0, 'B001-10'),
(1, '箱', 100, 0, 1, 0, 'B001-100'),
-- 高筋麵粉：基本單位是"kg"
(101, 'kg', 1, 1, 1, 0, 'M001-01'),
(101, '袋', 25, 0, 1, 0, 'M001-25'),
(101, '噸', 1000, 0, 1, 0, 'M001-1000');

-- ============================================
-- 插入測試數據 - 原料批次（FIFO示例）
-- ============================================
INSERT OR IGNORE INTO material_batches 
(batch_no, product_id, supplier_id, initial_quantity, remaining_quantity, unit, unit_cost, total_cost, production_date, expiry_date, received_at, store_id) VALUES
-- 高筋麵粉 第一批（先入）
('MB20240501001', 101, 1, 500, 200, 'kg', 6.50, 3250.00, '2024-04-15', '2025-04-15', '2024-05-01 08:00:00', 3),
-- 高筋麵粉 第二批（後入）
('MB20240515001', 101, 1, 300, 300, 'kg', 6.80, 2040.00, '2024-05-01', '2025-05-01', '2024-05-15 10:00:00', 3),
-- 鮮奶油 批次
('MB20240510001', 103, 2, 50, 30, 'L', 35.00, 1750.00, '2024-05-08', '2024-05-15', '2024-05-10 09:00:00', 3);
