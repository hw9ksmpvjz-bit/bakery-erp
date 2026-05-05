-- ============================================
-- 3.3 調撥管理 - 數據庫結構
-- 烘焙專屬：批次號綁定、效期檢查、調撥軌跡追溯、在途庫存關聯批次
-- ============================================

-- ============================================
-- 調撥單表（含批次追溯）
-- ============================================
CREATE TABLE IF NOT EXISTS transfer_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_no VARCHAR(50) NOT NULL UNIQUE, -- 調撥單號
    
    from_store_id INTEGER NOT NULL, -- 發貨店
    to_store_id INTEGER NOT NULL, -- 收貨店
    
    total_items INTEGER DEFAULT 0, -- 品項數
    total_quantity DECIMAL(10, 3) DEFAULT 0, -- 總數量
    total_cost DECIMAL(12, 2) DEFAULT 0, -- 總成本（按批次實際成本）
    
    -- 狀態流程：created → pending_approval → approved → shipped → in_transit → received → completed
    status VARCHAR(20) DEFAULT 'created' CHECK (status IN (
        'created',           -- 創建
        'pending_approval',  -- 待審批（發貨店主管）
        'approved',          -- 已審批
        'shipped',           -- 已發貨
        'in_transit',        -- 運輸中
        'received',          -- 已收貨
        'completed',         -- 已完成
        'cancelled'          -- 已取消
    )),
    
    -- 效期警告標記
    has_expiry_warning INTEGER DEFAULT 0, -- 是否包含臨期/過期批次
    expiry_warning_details TEXT, -- 警告詳情（JSON格式）
    
    -- 發貨信息
    shipped_by INTEGER, -- 發貨人
    shipped_at DATETIME,
    ship_remark TEXT,
    
    -- 收貨信息
    received_by INTEGER, -- 收貨人
    received_at DATETIME,
    receive_remark TEXT,
    
    -- 審批信息
    approved_by INTEGER, -- 發貨店主管
    approved_at DATETIME,
    approval_remark TEXT,
    
    -- 創建信息
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (from_store_id) REFERENCES stores(id),
    FOREIGN KEY (to_store_id) REFERENCES stores(id),
    FOREIGN KEY (shipped_by) REFERENCES users(id),
    FOREIGN KEY (received_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_orders_from_store ON transfer_orders(from_store_id);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_to_store ON transfer_orders(to_store_id);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_status ON transfer_orders(status);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_created ON transfer_orders(created_at);

-- ============================================
-- 調撥單明細表（強制綁定批次號）
-- ============================================
CREATE TABLE IF NOT EXISTS transfer_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id INTEGER NOT NULL,
    
    product_id INTEGER NOT NULL, -- 商品ID
    batch_id INTEGER NOT NULL, -- 批次ID（強制綁定）
    batch_type VARCHAR(20) NOT NULL CHECK (batch_type IN ('product', 'material')), -- 批次類型
    batch_no VARCHAR(50) NOT NULL, -- 批次號（冗余存儲，方便查詢）
    
    quantity DECIMAL(10, 3) NOT NULL, -- 調撥數量
    unit VARCHAR(20) NOT NULL,
    
    -- 批次效期信息（創建時快照）
    production_date DATE, -- 生產日期
    expiry_date DATE, -- 效期截止日
    remaining_shelf_life_days INTEGER, -- 剩餘效期天數
    
    -- 成本信息（按批次實際成本）
    unit_cost DECIMAL(10, 4) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    
    -- 效期警告
    expiry_warning_level VARCHAR(20), -- normal/warning/critical/expired
    
    remark TEXT,
    
    FOREIGN KEY (transfer_id) REFERENCES transfer_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_order_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_batch ON transfer_order_items(batch_id);

-- ============================================
-- 在途庫存表（關聯批次號）
-- ============================================
CREATE TABLE IF NOT EXISTS in_transit_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id INTEGER NOT NULL, -- 關聯調撥單
    transfer_no VARCHAR(50) NOT NULL,
    
    product_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL, -- 批次ID（關聯批次）
    batch_type VARCHAR(20) NOT NULL,
    batch_no VARCHAR(50) NOT NULL,
    
    from_store_id INTEGER NOT NULL, -- 發貨店
    to_store_id INTEGER NOT NULL, -- 收貨店
    
    quantity DECIMAL(10, 3) NOT NULL, -- 在途數量
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(10, 4) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    
    -- 效期信息
    production_date DATE,
    expiry_date DATE,
    
    -- 時間追蹤
    shipped_at DATETIME, -- 發貨時間
    estimated_arrival DATETIME, -- 預計到達時間
    received_at DATETIME, -- 實際收貨時間
    
    status VARCHAR(20) DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'received', 'exception')),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (transfer_id) REFERENCES transfer_orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (from_store_id) REFERENCES stores(id),
    FOREIGN KEY (to_store_id) REFERENCES stores(id)
);

CREATE INDEX IF NOT EXISTS idx_in_transit_transfer ON in_transit_inventory(transfer_id);
CREATE INDEX IF NOT EXISTS idx_in_transit_batch ON in_transit_inventory(batch_id);
CREATE INDEX IF NOT EXISTS idx_in_transit_from ON in_transit_inventory(from_store_id);
CREATE INDEX IF NOT EXISTS idx_in_transit_to ON in_transit_inventory(to_store_id);
CREATE INDEX IF NOT EXISTS idx_in_transit_status ON in_transit_inventory(status);

-- ============================================
-- 調撥軌跡記錄表（全流程追溯）
-- ============================================
CREATE TABLE IF NOT EXISTS transfer_traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    batch_type VARCHAR(20) NOT NULL,
    batch_no VARCHAR(50) NOT NULL,
    
    action VARCHAR(50) NOT NULL, -- create/approve/ship/in_transit/receive/complete
    action_name VARCHAR(100), -- 動作名稱
    
    from_store_id INTEGER, -- 發貨店ID
    to_store_id INTEGER, -- 收貨店ID
    operator_id INTEGER, -- 負責人ID
    operator_name VARCHAR(50), -- 負責人姓名
    
    action_time DATETIME DEFAULT CURRENT_TIMESTAMP, -- 操作時間
    remark TEXT,
    
    FOREIGN KEY (transfer_id) REFERENCES transfer_orders(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_traces_transfer ON transfer_traces(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_traces_batch ON transfer_traces(batch_id);

-- ============================================
-- 視圖 - 調撥單完整信息（含批次詳情）
-- ============================================
CREATE VIEW IF NOT EXISTS v_transfer_orders_detail AS
SELECT 
    to2.*,
    fs.name as from_store_name,
    ts.name as to_store_name,
    creator.real_name as creator_name,
    shipper.real_name as shipper_name,
    receiver.real_name as receiver_name,
    approver.real_name as approver_name
FROM transfer_orders to2
JOIN stores fs ON to2.from_store_id = fs.id
JOIN stores ts ON to2.to_store_id = ts.id
LEFT JOIN users creator ON to2.created_by = creator.id
LEFT JOIN users shipper ON to2.shipped_by = shipper.id
LEFT JOIN users receiver ON to2.received_by = receiver.id
LEFT JOIN users approver ON to2.approved_by = approver.id;

-- ============================================
-- 視圖 - 在途庫存明細（按批次）
-- ============================================
CREATE VIEW IF NOT EXISTS v_in_transit_detail AS
SELECT 
    iti.*,
    p.sku,
    p.name as product_name,
    p.type as product_type,
    fs.name as from_store_name,
    ts.name as to_store_name,
    CASE 
        WHEN iti.expiry_date < date('now') THEN 'expired'
        WHEN iti.expiry_date <= date('now', '+1 day') AND p.type = 'finished' THEN 'critical'
        WHEN iti.expiry_date <= date('now', '+3 day') AND p.type = 'finished' THEN 'warning'
        WHEN iti.expiry_date <= date('now', '+2 day') AND p.type = 'semi' THEN 'critical'
        WHEN iti.expiry_date <= date('now', '+7 day') AND p.type = 'material' THEN 'warning'
        ELSE 'normal'
    END as expiry_status
FROM in_transit_inventory iti
JOIN products p ON iti.product_id = p.id
JOIN stores fs ON iti.from_store_id = fs.id
JOIN stores ts ON iti.to_store_id = ts.id
WHERE iti.status = 'in_transit';

-- ============================================
-- 觸發器 - 自動更新調撥單時間
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_transfer_orders_timestamp 
AFTER UPDATE ON transfer_orders
BEGIN
    UPDATE transfer_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 觸發器 - 自動更新在途庫存時間
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_in_transit_timestamp 
AFTER UPDATE ON in_transit_inventory
BEGIN
    UPDATE in_transit_inventory SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 測試數據 - 創建調撥單示例
-- ============================================
-- 創建一個包含臨期商品的調撥單（用於測試效期警告）
INSERT OR IGNORE INTO transfer_orders 
(transfer_no, from_store_id, to_store_id, status, has_expiry_warning, expiry_warning_details, created_by)
SELECT 
    'TF202405010001',
    4, -- 旗艦店（發貨）
    5, -- 東區店（收貨）
    'created',
    1, -- 有臨期警告
    '{"warnings": [{"batch_no": "TEST-EXPIRING-001", "product_name": "奶香吐司", "warning_level": "critical", "days_remaining": 1}]}',
    1
WHERE NOT EXISTS (SELECT 1 FROM transfer_orders WHERE transfer_no = 'TF202405010001');

-- 添加調撥明細（綁定臨期批次）
INSERT OR IGNORE INTO transfer_order_items 
(transfer_id, product_id, batch_id, batch_type, batch_no, quantity, unit, 
 production_date, expiry_date, remaining_shelf_life_days,
 unit_cost, total_cost, expiry_warning_level)
SELECT 
    (SELECT id FROM transfer_orders WHERE transfer_no = 'TF202405010001'),
    1, -- 奶香吐司
    (SELECT id FROM product_batches WHERE batch_no = 'TEST-EXPIRING-001'),
    'product',
    'TEST-EXPIRING-001',
    10, -- 調撥10個
    '個',
    date('now', '-2 day'),
    date('now', '+1 day'),
    1,
    8.00,
    80.00,
    'critical'
WHERE NOT EXISTS (SELECT 1 FROM transfer_order_items WHERE batch_no = 'TEST-EXPIRING-001' AND transfer_id = (SELECT id FROM transfer_orders WHERE transfer_no = 'TF202405010001'));
