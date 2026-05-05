-- ============================================
-- 6.0 應收應付 - 數據庫結構
-- 客戶欠款、供應商欠款、收付款管理
-- ============================================

-- ============================================
-- 應收賬款表（客戶欠款）
-- ============================================
CREATE TABLE IF NOT EXISTS receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL, -- 客戶ID
    
    -- 欠款信息
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 欠款總額
    paid_amount DECIMAL(12, 2) DEFAULT 0, -- 已還金額
    remaining_amount DECIMAL(12, 2) DEFAULT 0, -- 剩餘欠款
    
    -- 來源
    source_type VARCHAR(50), -- 來源類型（sales_order:銷售訂單）
    source_id INTEGER, -- 來源ID
    source_no VARCHAR(50), -- 來源單號
    
    -- 賬齡
    invoice_date DATE NOT NULL, -- 賬款日期
    due_date DATE, -- 到期日
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue')),
    
    -- 最後收款
    last_payment_date DATE,
    last_payment_amount DECIMAL(12, 2),
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_receivables_customer ON receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON receivables(due_date);

-- ============================================
-- 應付賬款表（供應商欠款）
-- ============================================
CREATE TABLE IF NOT EXISTS payables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL, -- 供應商ID
    
    -- 欠款信息
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 欠款總額
    paid_amount DECIMAL(12, 2) DEFAULT 0, -- 已付金額
    remaining_amount DECIMAL(12, 2) DEFAULT 0, -- 剩餘欠款
    
    -- 來源
    source_type VARCHAR(50), -- 來源類型（purchase_order:採購訂單）
    source_id INTEGER, -- 來源ID
    source_no VARCHAR(50), -- 來源單號
    
    -- 賬齡
    invoice_date DATE NOT NULL, -- 賬款日期
    due_date DATE, -- 到期日
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue')),
    
    -- 最後付款
    last_payment_date DATE,
    last_payment_amount DECIMAL(12, 2),
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE INDEX IF NOT EXISTS idx_payables_supplier ON payables(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_due_date ON payables(due_date);

-- ============================================
-- 收款單表
-- ============================================
CREATE TABLE IF NOT EXISTS receipt_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no VARCHAR(50) NOT NULL UNIQUE, -- 收款單號
    
    customer_id INTEGER NOT NULL, -- 客戶ID
    
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 收款總額
    
    -- 支付方式
    payment_method VARCHAR(50) NOT NULL, -- 支付方式
    payment_method_name VARCHAR(100),
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled')),
    
    receipt_date DATE NOT NULL, -- 收款日期
    
    created_by INTEGER,
    completed_at DATETIME,
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- 收款單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS receipt_voucher_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    receivable_id INTEGER NOT NULL, -- 關聯應收賬款
    
    amount DECIMAL(12, 2) NOT NULL, -- 收款金額
    
    remark TEXT,
    FOREIGN KEY (voucher_id) REFERENCES receipt_vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (receivable_id) REFERENCES receivables(id)
);

-- ============================================
-- 付款單表
-- ============================================
CREATE TABLE IF NOT EXISTS payment_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no VARCHAR(50) NOT NULL UNIQUE, -- 付款單號
    
    supplier_id INTEGER NOT NULL, -- 供應商ID
    
    total_amount DECIMAL(12, 2) DEFAULT 0, -- 付款總額
    
    -- 支付方式
    payment_method VARCHAR(50) NOT NULL, -- 支付方式
    payment_method_name VARCHAR(100),
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled')),
    
    payment_date DATE NOT NULL, -- 付款日期
    
    created_by INTEGER,
    completed_at DATETIME,
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- 付款單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS payment_voucher_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    payable_id INTEGER NOT NULL, -- 關聯應付賬款
    
    amount DECIMAL(12, 2) NOT NULL, -- 付款金額
    
    remark TEXT,
    FOREIGN KEY (voucher_id) REFERENCES payment_vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (payable_id) REFERENCES payables(id)
);

-- ============================================
-- 對賬單表
-- ============================================
CREATE TABLE IF NOT EXISTS reconciliation_statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    statement_no VARCHAR(50) NOT NULL UNIQUE, -- 對賬單號
    
    -- 對賬對象
    party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('customer', 'supplier')), -- 客戶/供應商
    party_id INTEGER NOT NULL, -- 對方ID
    party_name VARCHAR(200), -- 對方名稱
    
    -- 對賬期間
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- 對賬金額
    opening_balance DECIMAL(12, 2) DEFAULT 0, -- 期初餘額
    total_debit DECIMAL(12, 2) DEFAULT 0, -- 本期增加（欠款）
    total_credit DECIMAL(12, 2) DEFAULT 0, -- 本期減少（收款/付款）
    closing_balance DECIMAL(12, 2) DEFAULT 0, -- 期末餘額
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'disputed')),
    
    confirmed_by INTEGER,
    confirmed_at DATETIME,
    
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (confirmed_by) REFERENCES users(id)
);

-- ============================================
-- 對賬單明細表
-- ============================================
CREATE TABLE IF NOT EXISTS reconciliation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    statement_id INTEGER NOT NULL,
    
    transaction_date DATE NOT NULL, -- 交易日期
    transaction_type VARCHAR(50) NOT NULL, -- 交易類型
    document_no VARCHAR(50), -- 單據號
    
    debit DECIMAL(12, 2) DEFAULT 0, -- 借方（欠款增加）
    credit DECIMAL(12, 2) DEFAULT 0, -- 貸方（欠款減少）
    balance DECIMAL(12, 2) NOT NULL, -- 餘額
    
    remark TEXT,
    FOREIGN KEY (statement_id) REFERENCES reconciliation_statements(id) ON DELETE CASCADE
);

-- ============================================
-- 視圖 - 應收賬款匯總
-- ============================================
CREATE VIEW IF NOT EXISTS v_receivables_summary AS
SELECT 
    r.*,
    c.name as customer_name,
    c.code as customer_code,
    julianday('now') - julianday(r.invoice_date) as age_days,
    CASE 
        WHEN julianday('now') - julianday(r.invoice_date) <= 30 THEN '0-30天'
        WHEN julianday('now') - julianday(r.invoice_date) <= 60 THEN '31-60天'
        WHEN julianday('now') - julianday(r.invoice_date) <= 90 THEN '61-90天'
        ELSE '90天以上'
    END as age_group
FROM receivables r
JOIN customers c ON r.customer_id = c.id
WHERE r.status IN ('unpaid', 'partial', 'overdue');

-- ============================================
-- 視圖 - 應付賬款匯總
-- ============================================
CREATE VIEW IF NOT EXISTS v_payables_summary AS
SELECT 
    p.*,
    s.name as supplier_name,
    s.code as supplier_code,
    julianday('now') - julianday(p.invoice_date) as age_days,
    CASE 
        WHEN julianday('now') - julianday(p.invoice_date) <= 30 THEN '0-30天'
        WHEN julianday('now') - julianday(p.invoice_date) <= 60 THEN '31-60天'
        WHEN julianday('now') - julianday(p.invoice_date) <= 90 THEN '61-90天'
        ELSE '90天以上'
    END as age_group
FROM payables p
JOIN suppliers s ON p.supplier_id = s.id
WHERE p.status IN ('unpaid', 'partial', 'overdue');

-- ============================================
-- 觸發器 - 自動更新時間
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_receivables_timestamp 
AFTER UPDATE ON receivables
BEGIN
    UPDATE receivables SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_payables_timestamp 
AFTER UPDATE ON payables
BEGIN
    UPDATE payables SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 測試數據
-- ============================================
-- 創建測試應收賬款
INSERT OR IGNORE INTO receivables 
(customer_id, total_amount, paid_amount, remaining_amount, source_type, source_no, invoice_date, due_date, status)
SELECT 
    1, -- 測試客戶
    5000.00, -- 欠款5000
    0, -- 已還0
    5000.00, -- 剩餘5000
    'sales_order',
    'SO202405010001',
    date('now', '-10 day'), -- 10天前
    date('now', '+20 day'), -- 20天後到期
    'unpaid'
WHERE NOT EXISTS (SELECT 1 FROM receivables WHERE source_no = 'SO202405010001');

-- 創建測試應付賬款
INSERT OR IGNORE INTO payables 
(supplier_id, total_amount, paid_amount, remaining_amount, source_type, source_no, invoice_date, due_date, status)
SELECT 
    1, -- 測試供應商
    10000.00, -- 欠款10000
    3000.00, -- 已付3000
    7000.00, -- 剩餘7000
    'purchase_order',
    'PO202405010001',
    date('now', '-15 day'), -- 15天前
    date('now', '+15 day'), -- 15天後到期
    'partial'
WHERE NOT EXISTS (SELECT 1 FROM payables WHERE source_no = 'PO202405010001');
