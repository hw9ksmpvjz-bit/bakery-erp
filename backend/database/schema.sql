-- ============================================
-- 企業級進銷存系統 - 數據庫表結構
-- 技術棧: SQLite
-- 版本: 1.0.0
-- ============================================

-- 開啟外鍵約束
PRAGMA foreign_keys = ON;

-- ============================================
-- 1. 基礎模塊 - 用戶表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- bcrypt加密
    real_name VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'admin', 'purchaser', 'sales', 'warehouse', 'accountant', 'staff')),
    status INTEGER DEFAULT 1 CHECK (status IN (0, 1)), -- 0:禁用, 1:啟用
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用戶表索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================
-- 2. 基礎模塊 - 系統配置表
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    config_type VARCHAR(20) DEFAULT 'string' CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
    description VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. 商品管理 - 商品分類表
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER DEFAULT 0, -- 0表示頂級分類
    level INTEGER DEFAULT 1, -- 分類層級
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 分類表索引
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);

-- ============================================
-- 4. 商品管理 - 商品屬性表
-- ============================================
CREATE TABLE IF NOT EXISTS product_attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    attribute_name VARCHAR(50) NOT NULL,
    attribute_value VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- 5. 商品管理 - 商品表
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku VARCHAR(50) NOT NULL UNIQUE, -- 商品編號
    name VARCHAR(200) NOT NULL,
    category_id INTEGER,
    barcode VARCHAR(50), -- 條碼
    specification VARCHAR(255), -- 規格
    unit VARCHAR(20) DEFAULT '件', -- 單位
    purchase_price DECIMAL(10, 2) DEFAULT 0, -- 採購價
    wholesale_price DECIMAL(10, 2) DEFAULT 0, -- 批發價
    retail_price DECIMAL(10, 2) DEFAULT 0, -- 零售價
    stock_quantity INTEGER DEFAULT 0, -- 當前庫存
    min_stock INTEGER DEFAULT 0, -- 最低庫存预警
    max_stock INTEGER DEFAULT 9999, -- 最高庫存限制
    description TEXT,
    status INTEGER DEFAULT 1 CHECK (status IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 商品表索引
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ============================================
-- 6. 採購管理 - 供應商表
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE, -- 供應商編號
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_no VARCHAR(50), -- 稅務登記號
    bank_name VARCHAR(100), -- 開戶行
    bank_account VARCHAR(50), -- 銀行賬號
    credit_level INTEGER DEFAULT 3 CHECK (credit_level IN (1, 2, 3, 4, 5)), -- 信用等級
    status INTEGER DEFAULT 1,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 供應商表索引
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ============================================
-- 7. 採購管理 - 採購訂單表
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) NOT NULL UNIQUE, -- 訂單編號
    supplier_id INTEGER NOT NULL,
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 訂單總額
    discount_amount DECIMAL(12, 2) DEFAULT 0, -- 折扣金額
    actual_amount DECIMAL(12, 2) DEFAULT 0, -- 實付金額
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'completed', 'cancelled')), 
    -- draft:草稿, pending:待審核, approved:已審核, completed:已完成, cancelled:已取消
    order_date DATE NOT NULL,
    delivery_date DATE,
    remark TEXT,
    created_by INTEGER,
    approved_by INTEGER,
    approved_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- 採購訂單索引
CREATE INDEX IF NOT EXISTS idx_purchase_orders_no ON purchase_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(order_date);

-- ============================================
-- 8. 採購管理 - 採購訂單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(12, 2) NOT NULL,
    received_quantity INTEGER DEFAULT 0, -- 已入庫數量
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 採購明細索引
CREATE INDEX IF NOT EXISTS idx_purchase_items_order ON purchase_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_order_items(product_id);

-- ============================================
-- 9. 銷售管理 - 客戶表
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE, -- 客戶編號
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) DEFAULT 'retail' CHECK (type IN ('wholesale', 'retail', 'vip')), -- 客戶類型
    contact_person VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    credit_limit DECIMAL(12, 2) DEFAULT 0, -- 信用額度
    balance DECIMAL(12, 2) DEFAULT 0, -- 當前餘額
    status INTEGER DEFAULT 1,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 客戶表索引
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);

-- ============================================
-- 10. 銷售管理 - 銷售訂單表
-- ============================================
CREATE TABLE IF NOT EXISTS sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) NOT NULL UNIQUE, -- 訂單編號
    customer_id INTEGER NOT NULL,
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 訂單總額
    discount_amount DECIMAL(12, 2) DEFAULT 0, -- 折扣金額
    actual_amount DECIMAL(12, 2) DEFAULT 0, -- 實收金額
    paid_amount DECIMAL(12, 2) DEFAULT 0, -- 已付金額
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'completed', 'cancelled')),
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')), -- 付款狀態
    order_date DATE NOT NULL,
    delivery_date DATE,
    remark TEXT,
    created_by INTEGER,
    approved_by INTEGER,
    approved_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- 銷售訂單索引
CREATE INDEX IF NOT EXISTS idx_sales_orders_no ON sales_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);

-- ============================================
-- 11. 銷售管理 - 銷售訂單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS sales_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(12, 2) NOT NULL,
    delivered_quantity INTEGER DEFAULT 0, -- 已出庫數量
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 銷售明細索引
CREATE INDEX IF NOT EXISTS idx_sales_items_order ON sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_product ON sales_order_items(product_id);

-- ============================================
-- 12. 庫存管理 - 庫存變動記錄表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjust', 'check')), -- 變動類型
    quantity INTEGER NOT NULL, -- 變動數量(正數為入,負數為出)
    before_quantity INTEGER NOT NULL, -- 變動前數量
    after_quantity INTEGER NOT NULL, -- 變動後數量
    reference_type VARCHAR(50), -- 關聯業務類型
    reference_id INTEGER, -- 關聯業務ID
    remark TEXT,
    operator_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- 庫存變動索引
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_logs(type);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory_logs(created_at);

-- ============================================
-- 13. 庫存管理 - 庫存盤點表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_no VARCHAR(50) NOT NULL UNIQUE, -- 盤點單號
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    total_products INTEGER DEFAULT 0, -- 盤點商品數
    profit_products INTEGER DEFAULT 0, -- 盤盈商品數
    loss_products INTEGER DEFAULT 0, -- 盤虧商品數
    remark TEXT,
    operator_id INTEGER,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- ============================================
-- 14. 庫存管理 - 庫存盤點明細表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_check_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    system_quantity INTEGER NOT NULL, -- 系統數量
    actual_quantity INTEGER NOT NULL, -- 實際數量
    difference INTEGER NOT NULL, -- 差異數量
    remark TEXT,
    FOREIGN KEY (check_id) REFERENCES inventory_checks(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 15. 日志管理 - 操作日志表
-- ============================================
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username VARCHAR(50),
    module VARCHAR(50) NOT NULL, -- 操作模塊
    action VARCHAR(50) NOT NULL, -- 操作類型
    resource_type VARCHAR(50), -- 資源類型
    resource_id INTEGER, -- 資源ID
    old_value TEXT, -- 舊值(JSON)
    new_value TEXT, -- 新值(JSON)
    ip_address VARCHAR(50),
    user_agent TEXT,
    result INTEGER DEFAULT 1 CHECK (result IN (0, 1)), -- 0:失敗, 1:成功
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 操作日志索引
CREATE INDEX IF NOT EXISTS idx_op_logs_user ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_op_logs_module ON operation_logs(module);
CREATE INDEX IF NOT EXISTS idx_op_logs_action ON operation_logs(action);
CREATE INDEX IF NOT EXISTS idx_op_logs_created ON operation_logs(created_at);

-- ============================================
-- 16. 日志管理 - 登錄日志表
-- ============================================
CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username VARCHAR(50),
    login_type VARCHAR(20) DEFAULT 'password' CHECK (login_type IN ('password', 'token', 'oauth')),
    ip_address VARCHAR(50),
    user_agent TEXT,
    status INTEGER DEFAULT 1 CHECK (status IN (0, 1)), -- 0:失敗, 1:成功
    fail_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 登錄日志索引
CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_status ON login_logs(status);
CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at);

-- ============================================
-- 17. 觸發器 - 自動更新 updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
AFTER UPDATE ON products
BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_categories_timestamp 
AFTER UPDATE ON categories
BEGIN
    UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_suppliers_timestamp 
AFTER UPDATE ON suppliers
BEGIN
    UPDATE suppliers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_customers_timestamp 
AFTER UPDATE ON customers
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 18. 視圖 - 庫存預警視圖
-- ============================================
CREATE VIEW IF NOT EXISTS v_low_stock_products AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.stock_quantity,
    p.min_stock,
    (p.min_stock - p.stock_quantity) AS shortage_quantity,
    c.name AS category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.stock_quantity <= p.min_stock AND p.status = 1;

-- ============================================
-- 19. 視圖 - 訂單統計視圖
-- ============================================
CREATE VIEW IF NOT EXISTS v_order_statistics AS
SELECT 
    DATE(created_at) AS order_date,
    COUNT(*) AS order_count,
    SUM(actual_amount) AS total_amount
FROM sales_orders
WHERE status = 'completed'
GROUP BY DATE(created_at);

-- ============================================
-- 20. 插入默認超級管理員
-- ============================================
INSERT OR IGNORE INTO users (id, username, password, real_name, role, status) 
VALUES (1, 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', '系統管理員', 'super_admin', 1);
-- 密碼: admin123 (bcrypt加密)

-- 插入默認系統配置
INSERT OR IGNORE INTO system_config (config_key, config_value, description) VALUES
('company_name', '企業進銷存管理系統', '公司名稱'),
('system_version', '1.0.0', '系統版本'),
('low_stock_threshold', '10', '低庫存预警閾值'),
('default_page_size', '20', '默認分頁大小'),
('session_timeout', '7200', '登錄超時時間(秒)');

-- ============================================
-- 21. 插入測試數據
-- ============================================
-- 測試分類
INSERT OR IGNORE INTO categories (id, name, parent_id, level) VALUES
(1, '電子產品', 0, 1),
(2, '手機', 1, 2),
(3, '電腦', 1, 2),
(4, '辦公用品', 0, 1),
(5, '文具', 4, 2);

-- 測試商品
INSERT OR IGNORE INTO products (id, sku, name, category_id, barcode, unit, purchase_price, wholesale_price, retail_price, stock_quantity, min_stock) VALUES
(1, 'P001', 'iPhone 15 Pro', 2, '1234567890123', '台', 6999.00, 7499.00, 7999.00, 50, 10),
(2, 'P002', 'MacBook Pro 14', 3, '1234567890124', '台', 12999.00, 13999.00, 14999.00, 20, 5),
(3, 'P003', '筆記本', 5, '1234567890125', '本', 5.00, 6.00, 8.00, 200, 50);

-- 測試供應商
INSERT OR IGNORE INTO suppliers (id, code, name, contact_person, phone, credit_level) VALUES
(1, 'S001', '深圳科技有限公司', '張經理', '13800138001', 5),
(2, 'S002', '廣州貿易公司', '李經理', '13800138002', 4);

-- 測試客戶
INSERT OR IGNORE INTO customers (id, code, name, type, contact_person, phone, credit_limit) VALUES
(1, 'C001', '北京零售店', 'retail', '王老板', '13900139001', 50000.00),
(2, 'C002', '上海批發商', 'wholesale', '趙經理', '13900139002', 100000.00);
