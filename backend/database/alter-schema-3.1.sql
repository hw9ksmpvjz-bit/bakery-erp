-- ============================================
-- 3.1 採購管理 - 數據庫結構調整
-- 新增：採購入庫表、退貨表
-- ============================================

-- ============================================
-- 採購入庫記錄表
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no VARCHAR(50) NOT NULL UNIQUE, -- 入庫單號
    order_id INTEGER NOT NULL, -- 關聯採購訂單
    batch_no VARCHAR(50), -- 批次號
    received_by INTEGER, -- 入庫人
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (received_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_order ON purchase_receipts(order_id);

-- ============================================
-- 採購退貨表
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_no VARCHAR(50) NOT NULL UNIQUE, -- 退貨單號
    order_id INTEGER NOT NULL, -- 原採購訂單
    receipt_id INTEGER, -- 關聯入庫記錄
    
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 退貨總額
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
    
    reason TEXT, -- 退貨原因
    created_by INTEGER,
    approved_by INTEGER,
    approved_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (receipt_id) REFERENCES purchase_receipts(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_order ON purchase_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status ON purchase_returns(status);

-- ============================================
-- 採購退貨明細表
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL, -- 退貨數量
    unit_price DECIMAL(10, 2) NOT NULL, -- 退貨單價
    total_price DECIMAL(12, 2) NOT NULL,
    batch_no VARCHAR(50), -- 退貨批次
    remark TEXT,
    FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 觸發器 - 自動更新採購退貨時間
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_purchase_returns_timestamp 
AFTER UPDATE ON purchase_returns
BEGIN
    UPDATE purchase_returns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 視圖 - 採購統計
-- ============================================
CREATE VIEW IF NOT EXISTS v_purchase_statistics AS
SELECT 
    s.id as supplier_id,
    s.name as supplier_name,
    COUNT(po.id) as total_orders,
    COALESCE(SUM(CASE WHEN po.status = 'completed' THEN po.actual_amount ELSE 0 END), 0) as total_amount,
    COALESCE(SUM(CASE WHEN po.status IN ('draft', 'pending', 'approved', 'partial') THEN po.total_amount ELSE 0 END), 0) as pending_amount,
    MAX(po.order_date) as last_order_date
FROM suppliers s
LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status != 'cancelled'
WHERE s.status = 1
GROUP BY s.id;

-- ============================================
-- 視圖 - 待入庫採購訂單
-- ============================================
CREATE VIEW IF NOT EXISTS v_pending_receipt_orders AS
SELECT 
    po.*,
    s.name as supplier_name,
    SUM(poi.quantity - poi.received_quantity) as pending_quantity
FROM purchase_orders po
JOIN suppliers s ON po.supplier_id = s.id
JOIN purchase_order_items poi ON po.id = poi.order_id
WHERE po.status IN ('approved', 'partial')
AND poi.received_quantity < poi.quantity
GROUP BY po.id;
