-- ============================================
-- 5.1 銷售管理 - 數據庫結構
-- 支援：多支付、會員積分、退貨審批、反結帳
-- ============================================

-- ============================================
-- 支付方式配置表
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE, -- 支付代碼
    name VARCHAR(100) NOT NULL, -- 支付名稱
    icon VARCHAR(50), -- 圖標
    is_active INTEGER DEFAULT 1, -- 是否啟用
    sort_order INTEGER DEFAULT 0, -- 排序
    config TEXT, -- 額外配置（JSON）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默認支付方式
INSERT OR IGNORE INTO payment_methods (code, name, icon, sort_order) VALUES
('cash', '現金', '💵', 1),
('wechat', '微信支付', '💚', 2),
('alipay', '支付寶', '💙', 3),
('balance', '會員餘額', '💳', 4),
('card', '銀行卡', '💳', 5);

-- ============================================
-- 積分規則配置表
-- ============================================
CREATE TABLE IF NOT EXISTS points_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    -- 消費積分規則
    consume_amount DECIMAL(10, 2) DEFAULT 1.00, -- 消費多少元
    points_earned INTEGER DEFAULT 1, -- 獲得多少積分
    -- 積分抵扣規則
    points_needed INTEGER DEFAULT 100, -- 多少積分
    deduct_amount DECIMAL(10, 2) DEFAULT 1.00, -- 抵扣多少元
    -- 會員等級倍率
    level_1_multiplier DECIMAL(3, 2) DEFAULT 1.00,
    level_2_multiplier DECIMAL(3, 2) DEFAULT 1.20,
    level_3_multiplier DECIMAL(3, 2) DEFAULT 1.50,
    level_4_multiplier DECIMAL(3, 2) DEFAULT 2.00,
    level_5_multiplier DECIMAL(3, 2) DEFAULT 3.00,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默認規則
INSERT OR IGNORE INTO points_rules (name, consume_amount, points_earned) VALUES
('默認規則', 1.00, 1);

-- ============================================
-- 銷售訂單表（擴展）
-- ============================================
CREATE TABLE IF NOT EXISTS sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) NOT NULL UNIQUE, -- 訂單號
    store_id INTEGER NOT NULL, -- 銷售分店
    
    -- 客戶信息
    member_id INTEGER, -- 會員ID
    customer_name VARCHAR(100), -- 非會員客戶名
    customer_phone VARCHAR(20),
    
    -- 金額信息
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 商品總額
    discount_amount DECIMAL(12, 2) DEFAULT 0, -- 折扣金額
    member_discount DECIMAL(12, 2) DEFAULT 0, -- 會員折扣
    points_deduction DECIMAL(12, 2) DEFAULT 0, -- 積分抵扣
    actual_amount DECIMAL(12, 2) DEFAULT 0, -- 實收金額
    
    -- 積分信息
    points_earned INTEGER DEFAULT 0, -- 獲得積分
    points_used INTEGER DEFAULT 0, -- 使用積分
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'partial_refunded')),
    payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    
    -- 結帳信息
    is_settled INTEGER DEFAULT 0, -- 是否已結帳
    settled_at DATETIME, -- 結帳時間
    daily_report_id INTEGER, -- 關聯日結單
    
    order_date DATE NOT NULL,
    completed_at DATETIME,
    
    created_by INTEGER, -- 收銀員
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- 銷售訂單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS sales_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    batch_id INTEGER, -- 出庫批次ID
    batch_no VARCHAR(50), -- 批次號
    
    quantity DECIMAL(10, 3) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL, -- 實售單價
    original_price DECIMAL(10, 2), -- 原價
    total_price DECIMAL(12, 2) NOT NULL,
    
    unit_cost DECIMAL(10, 4) DEFAULT 0, -- 成本價
    
    is_refunded INTEGER DEFAULT 0, -- 是否已退貨
    refunded_quantity DECIMAL(10, 3) DEFAULT 0,
    
    remark TEXT,
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 支付明細表（支援混合支付）
-- ============================================
CREATE TABLE IF NOT EXISTS sales_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 支付方式代碼
    payment_method_name VARCHAR(100), -- 支付方式名稱
    amount DECIMAL(12, 2) NOT NULL, -- 支付金額
    transaction_no VARCHAR(100), -- 第三方交易號
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE
);

-- ============================================
-- 退貨單表
-- ============================================
CREATE TABLE IF NOT EXISTS sales_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_no VARCHAR(50) NOT NULL UNIQUE, -- 退貨單號
    order_id INTEGER NOT NULL, -- 原訂單
    
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 退貨總額
    refund_points INTEGER DEFAULT 0, -- 退還積分
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
    -- pending:待審批（次日退貨）, approved:已審批, completed:已完成, cancelled:已取消
    
    -- 退貨類型
    return_type VARCHAR(20) DEFAULT 'same_day' CHECK (return_type IN ('same_day', 'next_day', 'after_settlement')),
    -- same_day:當日退貨, next_day:次日退貨（需審批）, after_settlement:結帳後退貨（需反結帳）
    
    -- 審批信息
    approved_by INTEGER,
    approved_at DATETIME,
    approval_remark TEXT,
    
    -- 反結帳信息
    requires_unsettlement INTEGER DEFAULT 0, -- 是否需要反結帳
    unsettlement_approved INTEGER DEFAULT 0, -- 反結帳是否已審批
    unsettlement_approved_by INTEGER,
    unsettlement_approved_at DATETIME,
    
    created_by INTEGER,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (unsettlement_approved_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- 退貨明細表
-- ============================================
CREATE TABLE IF NOT EXISTS sales_return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id INTEGER NOT NULL,
    order_item_id INTEGER NOT NULL, -- 原訂單明細
    product_id INTEGER NOT NULL,
    
    quantity DECIMAL(10, 3) NOT NULL, -- 退貨數量
    unit_price DECIMAL(10, 2) NOT NULL, -- 退貨單價
    total_amount DECIMAL(12, 2) NOT NULL,
    
    reason TEXT, -- 退貨原因
    FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (order_item_id) REFERENCES sales_order_items(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 日結單表
-- ============================================
CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    report_date DATE NOT NULL,
    
    -- 銷售統計
    sales_count INTEGER DEFAULT 0, -- 訂單數
    sales_amount DECIMAL(12, 2) DEFAULT 0, -- 銷售額
    sales_cost DECIMAL(12, 2) DEFAULT 0, -- 銷售成本
    sales_profit DECIMAL(12, 2) DEFAULT 0, -- 銷售利潤
    
    -- 收款統計（按支付方式）
    cash_amount DECIMAL(12, 2) DEFAULT 0,
    wechat_amount DECIMAL(12, 2) DEFAULT 0,
    alipay_amount DECIMAL(12, 2) DEFAULT 0,
    balance_amount DECIMAL(12, 2) DEFAULT 0,
    card_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- 退貨統計
    return_count INTEGER DEFAULT 0,
    return_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- 會員統計
    new_members INTEGER DEFAULT 0,
    member_orders INTEGER DEFAULT 0,
    member_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    
    confirmed_by INTEGER,
    confirmed_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (confirmed_by) REFERENCES users(id),
    UNIQUE(store_id, report_date)
);

-- ============================================
-- 觸發器 - 自動更新時間
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_sales_orders_timestamp 
AFTER UPDATE ON sales_orders
BEGIN
    UPDATE sales_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_sales_returns_timestamp 
AFTER UPDATE ON sales_returns
BEGIN
    UPDATE sales_returns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 視圖 - 銷售統計
-- ============================================
CREATE VIEW IF NOT EXISTS v_sales_summary AS
SELECT 
    DATE(so.created_at) as sale_date,
    so.store_id,
    s.name as store_name,
    COUNT(*) as order_count,
    SUM(so.total_amount) as total_amount,
    SUM(so.actual_amount) as actual_amount,
    SUM(so.points_earned) as total_points_earned,
    SUM(so.points_used) as total_points_used,
    COUNT(DISTINCT so.member_id) as member_count
FROM sales_orders so
JOIN stores s ON so.store_id = s.id
WHERE so.status = 'completed'
GROUP BY DATE(so.created_at), so.store_id;

-- ============================================
-- 測試數據
-- ============================================
-- 創建測試銷售訂單
INSERT OR IGNORE INTO sales_orders 
(order_no, store_id, member_id, total_amount, actual_amount, points_earned, status, order_date, created_by)
SELECT 
    'SO202405010001',
    4, -- 旗艦店
    1, -- 測試會員
    88.00, -- 總額
    88.00, -- 實收
    88, -- 積分
    'completed',
    date('now'),
    5 -- 銷售員
WHERE NOT EXISTS (SELECT 1 FROM sales_orders WHERE order_no = 'SO202405010001');

-- 添加支付明細
INSERT OR IGNORE INTO sales_payments (order_id, payment_method, payment_method_name, amount)
SELECT 
    (SELECT id FROM sales_orders WHERE order_no = 'SO202405010001'),
    'wechat',
    '微信支付',
    88.00
WHERE NOT EXISTS (SELECT 1 FROM sales_payments WHERE order_id = (SELECT id FROM sales_orders WHERE order_no = 'SO202405010001'));
