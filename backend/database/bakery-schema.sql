-- ============================================
-- 烘焙業進銷存系統 - 數據庫表結構
-- 版本: 1.0.0 MVP
-- 支援: 10分店 + 1倉庫 + 1中央工廠
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. 基礎模塊 - 分店/組織表
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE, -- 分店編號
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('headquarters', 'factory', 'warehouse', 'store')),
    -- headquarters:總部, factory:中央工廠, warehouse:倉庫, store:分店
    address TEXT,
    phone VARCHAR(20),
    manager_name VARCHAR(50),
    manager_phone VARCHAR(20),
    business_hours VARCHAR(50), -- 營業時間
    status INTEGER DEFAULT 1 CHECK (status IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stores_type ON stores(type);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- ============================================
-- 2. 基礎模塊 - 角色權限表
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    permissions TEXT NOT NULL, -- JSON格式權限配置
    description TEXT,
    level INTEGER DEFAULT 1, -- 權限等級，數字越大權限越高
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 權限示例: {"products": ["view", "create", "edit", "delete"], "orders": ["view", "create"]}

-- ============================================
-- 3. 基礎模塊 - 用戶表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- bcrypt加密
    real_name VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    role_id INTEGER NOT NULL,
    store_id INTEGER NOT NULL, -- 所屬分店
    avatar VARCHAR(255),
    status INTEGER DEFAULT 1 CHECK (status IN (0, 1, 2)), -- 0:禁用, 1:啟用, 2:待審核
    last_login_at DATETIME,
    last_login_ip VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================
-- 4. 商品管理 - 商品分類表
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    type VARCHAR(20) DEFAULT 'product' CHECK (type IN ('product', 'material', 'semi_product')),
    -- product:成品, material:原料, semi_product:半成品
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ============================================
-- 5. 商品管理 - 商品/原料表
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku VARCHAR(50) NOT NULL UNIQUE, -- 商品編號
    name VARCHAR(200) NOT NULL,
    category_id INTEGER,
    type VARCHAR(20) NOT NULL CHECK (type IN ('finished', 'semi', 'material')),
    -- finished:成品(麵包蛋糕), semi:半成品(麵團), material:原料(麵粉雞蛋)
    barcode VARCHAR(50),
    specification VARCHAR(255), -- 規格
    unit VARCHAR(20) DEFAULT '個', -- 單位
    shelf_life_days INTEGER DEFAULT 1, -- 保質期(天)，烘焙品通常很短
    warning_days INTEGER DEFAULT 1, -- 预警提前天數
    
    -- 價格體系
    purchase_price DECIMAL(10, 2) DEFAULT 0, -- 採購價/成本價
    wholesale_price DECIMAL(10, 2) DEFAULT 0, -- 批發價
    retail_price DECIMAL(10, 2) DEFAULT 0, -- 零售價
    member_price DECIMAL(10, 2) DEFAULT 0, -- 會員價
    
    -- 庫存管理
    stock_quantity INTEGER DEFAULT 0, -- 當前庫存
    min_stock INTEGER DEFAULT 0, -- 最低庫存
    max_stock INTEGER DEFAULT 9999, -- 最高庫存
    
    -- 生產相關
    is_producible INTEGER DEFAULT 0, -- 是否可生產(成品/半成品)
    production_time INTEGER DEFAULT 0, -- 生產耗時(分鐘)
    
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ============================================
-- 6. 商品管理 - 配方表(BOM)
-- ============================================
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL, -- 成品/半成品ID
    version VARCHAR(10) DEFAULT '1.0', -- 配方版本
    is_default INTEGER DEFAULT 1, -- 是否默認配方
    total_cost DECIMAL(10, 2) DEFAULT 0, -- 總成本
    yield_quantity INTEGER DEFAULT 1, -- 出品數量
    description TEXT,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);

-- ============================================
-- 7. 商品管理 - 配方明細表
-- ============================================
CREATE TABLE IF NOT EXISTS recipe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL, -- 原料ID
    quantity DECIMAL(10, 3) NOT NULL, -- 用量
    unit VARCHAR(20) NOT NULL, -- 單位
    cost DECIMAL(10, 2) DEFAULT 0, -- 該原料成本
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES products(id)
);

-- ============================================
-- 8. 採購管理 - 供應商表
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_no VARCHAR(50),
    bank_name VARCHAR(100),
    bank_account VARCHAR(50),
    credit_level INTEGER DEFAULT 3 CHECK (credit_level IN (1, 2, 3, 4, 5)),
    status INTEGER DEFAULT 1,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. 採購管理 - 採購訂單表
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL,
    store_id INTEGER NOT NULL, -- 收貨分店/倉庫
    
    total_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    actual_amount DECIMAL(12, 2) DEFAULT 0,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'partial', 'completed', 'cancelled')),
    -- draft:草稿, pending:待審核, approved:已審核, partial:部分入庫, completed:已完成, cancelled:已取消
    
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
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_no ON purchase_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store ON purchase_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

-- ============================================
-- 10. 採購管理 - 採購訂單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    received_quantity DECIMAL(10, 3) DEFAULT 0,
    batch_no VARCHAR(50), -- 批次號
    expiry_date DATE, -- 有效期
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 11. 生產管理 - 生產計劃表
-- ============================================
CREATE TABLE IF NOT EXISTS production_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    product_id INTEGER NOT NULL, -- 生產的成品/半成品
    recipe_id INTEGER, -- 使用的配方
    
    plan_quantity INTEGER NOT NULL, -- 計劃生產數量
    actual_quantity INTEGER DEFAULT 0, -- 實際生產數量
    
    status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'processing', 'completed', 'cancelled')),
    -- planned:計劃中, processing:生產中, completed:已完成, cancelled:已取消
    
    plan_date DATE NOT NULL, -- 計劃生產日期
    start_time DATETIME,
    end_time DATETIME,
    
    store_id INTEGER NOT NULL, -- 生產地點(中央工廠)
    created_by INTEGER,
    completed_by INTEGER,
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (completed_by) REFERENCES users(id)
);

-- ============================================
-- 12. 生產管理 - 原料消耗表
-- ============================================
CREATE TABLE IF NOT EXISTS production_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    plan_quantity DECIMAL(10, 3) NOT NULL, -- 計劃用量
    actual_quantity DECIMAL(10, 3) DEFAULT 0, -- 實際用量
    unit VARCHAR(20) NOT NULL,
    batch_no VARCHAR(50), -- 使用的原料批次
    cost DECIMAL(10, 2) DEFAULT 0,
    FOREIGN KEY (production_id) REFERENCES production_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES products(id)
);

-- ============================================
-- 13. 庫存管理 - 庫存主表(按分店+批次)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    store_id INTEGER NOT NULL,
    batch_no VARCHAR(50) NOT NULL, -- 批次號
    quantity DECIMAL(10, 3) DEFAULT 0,
    
    -- 批次信息
    production_date DATE, -- 生產日期
    expiry_date DATE, -- 過期日期
    
    -- 成本信息
    unit_cost DECIMAL(10, 2) DEFAULT 0, -- 單位成本
    total_cost DECIMAL(12, 2) DEFAULT 0, -- 總成本
    
    status INTEGER DEFAULT 1, -- 0:鎖定, 1:可用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    UNIQUE(product_id, store_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date);

-- ============================================
-- 14. 庫存管理 - 庫存變動記錄表
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    store_id INTEGER NOT NULL,
    batch_no VARCHAR(50),
    
    type VARCHAR(20) NOT NULL CHECK (type IN ('purchase_in', 'production_in', 'transfer_in', 'sale_out', 'production_out', 'transfer_out', 'adjust', 'waste')),
    -- purchase_in:採購入庫, production_in:生產入庫, transfer_in:調撥入庫
    -- sale_out:銷售出庫, production_out:生產領料, transfer_out:調撥出庫
    -- adjust:盤點調整, waste:報廢
    
    quantity DECIMAL(10, 3) NOT NULL, -- 變動數量
    before_quantity DECIMAL(10, 3) NOT NULL,
    after_quantity DECIMAL(10, 3) NOT NULL,
    
    unit_cost DECIMAL(10, 2) DEFAULT 0,
    total_cost DECIMAL(12, 2) DEFAULT 0,
    
    reference_type VARCHAR(50), -- 關聯業務類型
    reference_id INTEGER, -- 關聯業務ID
    reference_no VARCHAR(50), -- 關聯單號
    
    operator_id INTEGER,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_store ON inventory_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_type ON inventory_logs(type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created ON inventory_logs(created_at);

-- ============================================
-- 15. 庫存管理 - 調撥單表
-- ============================================
CREATE TABLE IF NOT EXISTS transfer_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    from_store_id INTEGER NOT NULL, -- 調出分店
    to_store_id INTEGER NOT NULL, -- 調入分店
    
    total_items INTEGER DEFAULT 0,
    total_quantity DECIMAL(10, 3) DEFAULT 0,
    
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'received', 'cancelled')),
    -- pending:待發貨, shipped:已發貨, received:已收貨, cancelled:已取消
    
    ship_time DATETIME,
    receive_time DATETIME,
    
    shipped_by INTEGER,
    received_by INTEGER,
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (from_store_id) REFERENCES stores(id),
    FOREIGN KEY (to_store_id) REFERENCES stores(id),
    FOREIGN KEY (shipped_by) REFERENCES users(id),
    FOREIGN KEY (received_by) REFERENCES users(id)
);

-- ============================================
-- 16. 庫存管理 - 調撥明細表
-- ============================================
CREATE TABLE IF NOT EXISTS transfer_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    batch_no VARCHAR(50), -- 批次號
    remark TEXT,
    FOREIGN KEY (transfer_id) REFERENCES transfer_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 17. 銷售管理 - 會員表
-- ============================================
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_no VARCHAR(50) NOT NULL UNIQUE, -- 會員卡號
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    birthday DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    
    level INTEGER DEFAULT 1, -- 會員等級
    points INTEGER DEFAULT 0, -- 積分
    balance DECIMAL(10, 2) DEFAULT 0, -- 儲值餘額
    
    total_consumption DECIMAL(12, 2) DEFAULT 0, -- 累計消費
    order_count INTEGER DEFAULT 0, -- 訂單數
    last_consumption_at DATETIME,
    
    source_store_id INTEGER, -- 註冊分店
    referrer_id INTEGER, -- 推薦人
    
    status INTEGER DEFAULT 1,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (source_store_id) REFERENCES stores(id),
    FOREIGN KEY (referrer_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_level ON members(level);

-- ============================================
-- 18. 銷售管理 - 銷售訂單表
-- ============================================
CREATE TABLE IF NOT EXISTS sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    store_id INTEGER NOT NULL, -- 銷售分店
    
    -- 客戶信息
    member_id INTEGER, -- 會員ID(非會員為空)
    customer_name VARCHAR(100), -- 非會員客戶名
    customer_phone VARCHAR(20),
    
    -- 金額信息
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 商品總額
    discount_amount DECIMAL(12, 2) DEFAULT 0, -- 折扣金額
    member_discount DECIMAL(12, 2) DEFAULT 0, -- 會員折扣
    actual_amount DECIMAL(12, 2) DEFAULT 0, -- 實收金額
    
    -- 支付信息
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wechat', 'alipay', 'card', 'balance', 'mixed')),
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    change_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- 積分
    points_earned INTEGER DEFAULT 0, -- 獲得積分
    points_used INTEGER DEFAULT 0, -- 使用積分
    
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
    
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

CREATE INDEX IF NOT EXISTS idx_sales_orders_no ON sales_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_sales_orders_store ON sales_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_member ON sales_orders(member_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(order_date);

-- ============================================
-- 19. 銷售管理 - 銷售訂單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS sales_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL, -- 單價
    original_price DECIMAL(10, 2), -- 原價
    total_price DECIMAL(12, 2) NOT NULL,
    
    batch_no VARCHAR(50), -- 出庫批次
    cost_price DECIMAL(10, 2) DEFAULT 0, -- 成本價(用於利潤計算)
    
    remark TEXT,
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- 20. 報表管理 - 日結報表
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
    
    -- 收款統計
    cash_amount DECIMAL(12, 2) DEFAULT 0,
    wechat_amount DECIMAL(12, 2) DEFAULT 0,
    alipay_amount DECIMAL(12, 2) DEFAULT 0,
    card_amount DECIMAL(12, 2) DEFAULT 0,
    balance_amount DECIMAL(12, 2) DEFAULT 0,
    
    -- 會員統計
    new_members INTEGER DEFAULT 0, -- 新會員數
    member_orders INTEGER DEFAULT 0, -- 會員訂單數
    member_amount DECIMAL(12, 2) DEFAULT 0, -- 會員消費額
    
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    confirmed_by INTEGER,
    confirmed_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (confirmed_by) REFERENCES users(id),
    UNIQUE(store_id, report_date)
);

-- ============================================
-- 21. 日志管理 - 操作日志表
-- ============================================
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username VARCHAR(50),
    store_id INTEGER,
    module VARCHAR(50) NOT NULL, -- 模塊
    action VARCHAR(50) NOT NULL, -- 操作
    resource_type VARCHAR(50),
    resource_id INTEGER,
    old_value TEXT, -- JSON
    new_value TEXT, -- JSON
    ip_address VARCHAR(50),
    user_agent TEXT,
    result INTEGER DEFAULT 1,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_op_logs_user ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_op_logs_store ON operation_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_op_logs_module ON operation_logs(module);
CREATE INDEX IF NOT EXISTS idx_op_logs_created ON operation_logs(created_at);

-- ============================================
-- 22. 日志管理 - 登錄日志表
-- ============================================
CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username VARCHAR(50),
    login_type VARCHAR(20) DEFAULT 'password',
    ip_address VARCHAR(50),
    user_agent TEXT,
    status INTEGER DEFAULT 1,
    fail_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 觸發器 - 自動更新 updated_at
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

CREATE TRIGGER IF NOT EXISTS update_stores_timestamp 
AFTER UPDATE ON stores
BEGIN
    UPDATE stores SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 視圖 - 庫存預警（即將過期/低庫存）
-- ============================================
CREATE VIEW IF NOT EXISTS v_inventory_warning AS
SELECT 
    i.id,
    p.sku,
    p.name AS product_name,
    p.type,
    s.name AS store_name,
    i.batch_no,
    i.quantity,
    i.expiry_date,
    p.shelf_life_days,
    p.min_stock,
    CASE 
        WHEN i.expiry_date <= date('now', '+1 day') THEN 'expired_soon'
        WHEN i.expiry_date <= date('now', '+3 day') THEN 'expiring'
        WHEN i.quantity <= p.min_stock THEN 'low_stock'
        ELSE 'normal'
    END AS warning_type
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN stores s ON i.store_id = s.id
WHERE i.quantity > 0 
AND (i.expiry_date <= date('now', '+3 day') OR i.quantity <= p.min_stock);

-- ============================================
-- 視圖 - 商品庫存匯總
-- ============================================
CREATE VIEW IF NOT EXISTS v_product_stock_summary AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.type,
    c.name AS category_name,
    SUM(CASE WHEN s.type = 'factory' THEN i.quantity ELSE 0 END) AS factory_stock,
    SUM(CASE WHEN s.type = 'warehouse' THEN i.quantity ELSE 0 END) AS warehouse_stock,
    SUM(CASE WHEN s.type = 'store' THEN i.quantity ELSE 0 END) AS stores_stock,
    SUM(i.quantity) AS total_stock,
    p.min_stock,
    p.max_stock
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN inventory i ON p.id = i.product_id
LEFT JOIN stores s ON i.store_id = s.id
WHERE p.status = 1
GROUP BY p.id;

-- ============================================
-- 插入默認數據
-- ============================================

-- 默認角色
INSERT OR IGNORE INTO roles (id, name, code, permissions, level) VALUES
(1, '超級管理員', 'super_admin', '{"all": ["*"]}', 99),
(2, '總部管理員', 'hq_admin', '{"stores": ["view", "manage"], "products": ["view", "create", "edit"], "orders": ["view", "approve"], "reports": ["view"]}', 80),
(3, '店長', 'store_manager', '{"store": ["manage"], "products": ["view"], "orders": ["view", "create", "edit"], "staff": ["view", "manage"]}', 50),
(4, '生產主管', 'production_manager', '{"production": ["view", "create", "edit"], "materials": ["view", "consume"], "inventory": ["view"]}', 40),
(5, '倉庫管理員', 'warehouse_manager', '{"inventory": ["view", "in", "out", "transfer"], "purchase": ["view", "receive"]}', 40),
(6, '銷售員', 'sales', '{"sales": ["view", "create"], "members": ["view", "create", "edit"]}', 30),
(7, '財務', 'accountant', '{"reports": ["view"], "orders": ["view"], "finance": ["view"]}', 20);

-- 默認分店
INSERT OR IGNORE INTO stores (id, code, name, type, address, business_hours) VALUES
(1, 'HQ', '集團總部', 'headquarters', '總部地址', '09:00-18:00'),
(2, 'F01', '中央工廠', 'factory', '工廠地址', '06:00-22:00'),
(3, 'W01', '中央倉庫', 'warehouse', '倉庫地址', '08:00-20:00'),
(4, 'S01', '旗艦店', 'store', '旗艦店地址', '07:00-22:00'),
(5, 'S02', '分店-東區', 'store', '東區地址', '07:00-22:00'),
(6, 'S03', '分店-西區', 'store', '西區地址', '07:00-22:00'),
(7, 'S04', '分店-南區', 'store', '南區地址', '07:00-22:00'),
(8, 'S05', '分店-北區', 'store', '北區地址', '07:00-22:00'),
(9, 'S06', '分店-商場店', 'store', '商場地址', '10:00-22:00'),
(10, 'S07', '分店-社區店A', 'store', '社區A地址', '06:30-21:30'),
(11, 'S08', '分店-社區店B', 'store', '社區B地址', '06:30-21:30'),
(12, 'S09', '分店-寫字樓店', 'store', '寫字樓地址', '07:30-20:00'),
(13, 'S10', '分店-機場店', 'store', '機場地址', '06:00-23:00');

-- 默認超級管理員（密碼: admin123）
INSERT OR IGNORE INTO users (id, username, password, real_name, role_id, store_id, status) 
VALUES (1, 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', '系統管理員', 1, 1, 1);

-- 測試用戶
INSERT OR IGNORE INTO users (id, username, password, real_name, role_id, store_id, status) VALUES
(2, 'manager01', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', '店長01', 3, 4, 1),
(3, 'factory01', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', '生產主管', 4, 2, 1),
(4, 'warehouse01', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', '倉庫管理', 5, 3, 1),
(5, 'sales01', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G', '銷售員01', 6, 4, 1);

-- 商品分類
INSERT OR IGNORE INTO categories (id, name, parent_id, level, type) VALUES
(1, '麵包類', 0, 1, 'product'),
(2, '甜麵包', 1, 2, 'product'),
(3, '鹹麵包', 1, 2, 'product'),
(4, '歐包', 1, 2, 'product'),
(5, '蛋糕類', 0, 1, 'product'),
(6, '生日蛋糕', 5, 2, 'product'),
(7, '西點', 5, 2, 'product'),
(8, '飲品類', 0, 1, 'product'),
(9, '咖啡', 8, 2, 'product'),
(10, '茶飲', 8, 2, 'product'),
(11, '原料類', 0, 1, 'material'),
(12, '麵粉', 11, 2, 'material'),
(13, '乳製品', 11, 2, 'material'),
(14, '糖類', 11, 2, 'material'),
(15, '油脂', 11, 2, 'material'),
(16, '添加劑', 11, 2, 'material'),
(17, '半成品', 0, 1, 'semi_product');

-- 測試商品（成品）
INSERT OR IGNORE INTO products (id, sku, name, category_id, type, unit, shelf_life_days, warning_days, purchase_price, retail_price, member_price, stock_quantity, min_stock, is_producible, production_time) VALUES
(1, 'B001', '奶香吐司', 2, 'finished', '條', 3, 1, 8.00, 18.00, 16.00, 50, 20, 1, 180),
(2, 'B002', '全麥麵包', 4, 'finished', '個', 2, 1, 6.00, 15.00, 13.00, 30, 15, 1, 240),
(3, 'B003', '可頌', 4, 'finished', '個', 2, 1, 5.00, 12.00, 10.00, 40, 20, 1, 300),
(4, 'C001', '草莓蛋糕', 6, 'finished', '個', 2, 1, 35.00, 88.00, 78.00, 10, 5, 1, 120),
(5, 'C002', '提拉米蘇', 7, 'finished', '盒', 3, 1, 18.00, 45.00, 40.00, 20, 10, 1, 90),
(6, 'D001', '美式咖啡', 9, 'finished', '杯', 1, 0, 3.00, 22.00, 18.00, 0, 0, 0, 5),
(7, 'D002', '拿鐵', 9, 'finished', '杯', 1, 0, 5.00, 28.00, 24.00, 0, 0, 0, 8);

-- 測試商品（原料）
INSERT OR IGNORE INTO products (id, sku, name, category_id, type, unit, shelf_life_days, purchase_price, stock_quantity, min_stock, is_producible) VALUES
(101, 'M001', '高筋麵粉', 12, 'material', 'kg', 365, 6.50, 500, 100, 0),
(102, 'M002', '低筋麵粉', 12, 'material', 'kg', 365, 7.00, 300, 50, 0),
(103, 'M003', '鮮奶油', 13, 'material', 'L', 7, 35.00, 50, 10, 0),
(104, 'M004', '黃油', 15, 'material', 'kg', 180, 45.00, 80, 20, 0),
(105, 'M005', '白砂糖', 14, 'material', 'kg', 730, 8.00, 200, 50, 0),
(106, 'M006', '雞蛋', 13, 'material', '盒', 15, 25.00, 30, 10, 0);

-- 測試配方
INSERT OR IGNORE INTO recipes (id, product_id, version, is_default, yield_quantity, total_cost) VALUES
(1, 1, '1.0', 1, 10, 80.00); -- 奶香吐司配方

INSERT OR IGNORE INTO recipe_items (recipe_id, material_id, quantity, unit, cost) VALUES
(1, 101, 3.0, 'kg', 19.50), -- 高筋麵粉
(1, 103, 0.5, 'L', 17.50), -- 鮮奶油
(1, 104, 0.8, 'kg', 36.00), -- 黃油
(1, 105, 0.5, 'kg', 4.00), -- 白砂糖
(1, 106, 0.1, '盒', 2.50); -- 雞蛋

-- 測試供應商
INSERT OR IGNORE INTO suppliers (id, code, name, contact_person, phone, credit_level) VALUES
(1, 'S001', '麵粉供應商', '張經理', '13800138001', 5),
(2, 'S002', '乳製品供應商', '李經理', '13800138002', 5),
(3, 'S003', '包裝材料商', '王經理', '13800138003', 4);

-- 測試會員
INSERT OR IGNORE INTO members (id, card_no, name, phone, level, points, balance, total_consumption, order_count, source_store_id) VALUES
(1, 'M000001', '測試會員', '13900139001', 1, 100, 0, 500, 10, 4),
(2, 'M000002', 'VIP會員', '13900139002', 3, 500, 200, 2000, 25, 4),
(3, 'M000003', '新會員', '13900139003', 1, 0, 0, 0, 0, 5);
