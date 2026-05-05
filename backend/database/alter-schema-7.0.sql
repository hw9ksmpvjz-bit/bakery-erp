-- ============================================
-- 7.0 財務管理 - 數據庫結構
-- 會計憑證、科目、財務報表
-- ============================================

-- ============================================
-- 會計科目表
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(20) NOT NULL UNIQUE, -- 科目編號
    name VARCHAR(100) NOT NULL, -- 科目名稱
    category VARCHAR(20) NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    -- asset:資產, liability:負債, equity:權益, revenue:收入, expense:費用
    
    parent_id INTEGER DEFAULT 0, -- 父科目ID，0為頂級科目
    level INTEGER DEFAULT 1, -- 科目層級
    
    balance_direction VARCHAR(10) NOT NULL CHECK (balance_direction IN ('debit', 'credit')),
    -- debit:借方, credit:貸方
    
    is_active INTEGER DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入標準會計科目
INSERT OR IGNORE INTO accounting_subjects (code, name, category, level, balance_direction) VALUES
-- 資產類
('1001', '庫存現金', 'asset', 1, 'debit'),
('1002', '銀行存款', 'asset', 1, 'debit'),
('1122', '應收賬款', 'asset', 1, 'debit'),
('1403', '原材料', 'asset', 1, 'debit'),
('1405', '庫存商品', 'asset', 1, 'debit'),
('1601', '固定資產', 'asset', 1, 'debit'),

-- 負債類
('2202', '應付賬款', 'liability', 1, 'credit'),
('2211', '應付職工薪酬', 'liability', 1, 'credit'),
('2221', '應交稅費', 'liability', 1, 'credit'),
('2241', '其他應付款', 'liability', 1, 'credit'),

-- 權益類
('4001', '實收資本', 'equity', 1, 'credit'),
('4103', '本年利潤', 'equity', 1, 'credit'),
('4104', '利潤分配', 'equity', 1, 'credit'),

-- 收入類
('6001', '主營業務收入', 'revenue', 1, 'credit'),
('6051', '其他業務收入', 'revenue', 1, 'credit'),
('6301', '營業外收入', 'revenue', 1, 'credit'),

-- 費用類
('6401', '主營業務成本', 'expense', 1, 'debit'),
('6403', '稅金及附加', 'expense', 1, 'debit'),
('6601', '銷售費用', 'expense', 1, 'debit'),
('6602', '管理費用', 'expense', 1, 'debit'),
('6603', '財務費用', 'expense', 1, 'debit'),
('6711', '營業外支出', 'expense', 1, 'debit'),
('6801', '所得稅費用', 'expense', 1, 'debit');

-- ============================================
-- 會計憑證表
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no VARCHAR(50) NOT NULL UNIQUE, -- 憑證號
    voucher_date DATE NOT NULL, -- 憑證日期
    
    -- 憑證類型
    voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('receipt', 'payment', 'transfer', 'adjustment')),
    -- receipt:收款憑證, payment:付款憑證, transfer:轉賬憑證, adjustment:調整憑證
    
    -- 金額
    total_debit DECIMAL(12, 2) NOT NULL, -- 借方總額
    total_credit DECIMAL(12, 2) NOT NULL, -- 貸方總額
    
    -- 來源（自動生成或手工錄入）
    source_type VARCHAR(50), -- 來源類型
    source_id INTEGER, -- 來源ID
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    -- draft:草稿, posted:已記賬, cancelled:已作廢
    
    summary TEXT, -- 摘要
    
    posted_by INTEGER, -- 記賬人
    posted_at DATETIME, -- 記賬時間
    
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (posted_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- 會計憑證明細表
-- ============================================
CREATE TABLE IF NOT EXISTS accounting_voucher_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    
    subject_id INTEGER NOT NULL, -- 科目ID
    subject_code VARCHAR(20), -- 科目編號（冗余）
    subject_name VARCHAR(100), -- 科目名稱（冗余）
    
    summary TEXT, -- 摘要
    
    debit_amount DECIMAL(12, 2) DEFAULT 0, -- 借方金額
    credit_amount DECIMAL(12, 2) DEFAULT 0, -- 貸方金額
    
    -- 輔助核算
    auxiliary_type VARCHAR(50), -- 輔助核算類型（客戶/供應商/部門/項目）
    auxiliary_id INTEGER, -- 輔助核算ID
    auxiliary_name VARCHAR(100), -- 輔助核算名稱
    
    sort_order INTEGER DEFAULT 0, -- 排序
    FOREIGN KEY (voucher_id) REFERENCES accounting_vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id)
);

-- ============================================
-- 科目餘額表（用於快速查詢和報表生成）
-- ============================================
CREATE TABLE IF NOT EXISTS subject_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    accounting_period VARCHAR(7) NOT NULL, -- 會計期間（YYYY-MM）
    
    -- 期初餘額
    opening_debit DECIMAL(12, 2) DEFAULT 0,
    opening_credit DECIMAL(12, 2) DEFAULT 0,
    
    -- 本期發生額
    current_debit DECIMAL(12, 2) DEFAULT 0,
    current_credit DECIMAL(12, 2) DEFAULT 0,
    
    -- 期末餘額
    closing_debit DECIMAL(12, 2) DEFAULT 0,
    closing_credit DECIMAL(12, 2) DEFAULT 0,
    
    FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id),
    UNIQUE(subject_id, accounting_period)
);

-- ============================================
-- 期初餘額表
-- ============================================
CREATE TABLE IF NOT EXISTS opening_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    fiscal_year INTEGER NOT NULL, -- 財政年度
    
    debit_balance DECIMAL(12, 2) DEFAULT 0, -- 借方餘額
    credit_balance DECIMAL(12, 2) DEFAULT 0, -- 貸方餘額
    
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (subject_id) REFERENCES accounting_subjects(id),
    UNIQUE(subject_id, fiscal_year)
);

-- ============================================
-- 視圖 - 科目匯總表
-- ============================================
CREATE VIEW IF NOT EXISTS v_subject_summary AS
SELECT 
    s.*,
    COALESCE(sb.closing_debit - sb.closing_credit, 0) as debit_balance,
    COALESCE(sb.closing_credit - sb.closing_debit, 0) as credit_balance,
    sb.accounting_period
FROM accounting_subjects s
LEFT JOIN subject_balances sb ON s.id = sb.subject_id
WHERE s.is_active = 1
ORDER BY s.code;

-- ============================================
-- 視圖 - 憑證明細查詢
-- ============================================
CREATE VIEW IF NOT EXISTS v_voucher_details AS
SELECT 
    av.*,
    avi.subject_id,
    avi.subject_code,
    avi.subject_name,
    avi.summary as item_summary,
    avi.debit_amount,
    avi.credit_amount,
    avi.auxiliary_type,
    avi.auxiliary_name,
    avi.sort_order,
    creator.real_name as creator_name,
    poster.real_name as posted_by_name
FROM accounting_vouchers av
JOIN accounting_voucher_items avi ON av.id = avi.voucher_id
LEFT JOIN users creator ON av.created_by = creator.id
LEFT JOIN users poster ON av.posted_by = poster.id
ORDER BY av.voucher_date DESC, av.voucher_no, avi.sort_order;

-- ============================================
-- 視圖 - 資產負債表（簡化版）
-- ============================================
CREATE VIEW IF NOT EXISTS v_balance_sheet AS
SELECT 
    s.code,
    s.name,
    s.category,
    s.balance_direction,
    COALESCE(sb.closing_debit, 0) - COALESCE(sb.closing_credit, 0) as balance_amount,
    sb.accounting_period
FROM accounting_subjects s
LEFT JOIN subject_balances sb ON s.id = sb.subject_id
WHERE s.level = 1 AND s.is_active = 1
ORDER BY s.code;

-- ============================================
-- 視圖 - 利潤表（簡化版）
-- ============================================
CREATE VIEW IF NOT EXISTS v_income_statement AS
SELECT 
    s.code,
    s.name,
    s.category,
    COALESCE(sb.current_credit, 0) - COALESCE(sb.current_debit, 0) as amount,
    sb.accounting_period
FROM accounting_subjects s
LEFT JOIN subject_balances sb ON s.id = sb.subject_id
WHERE s.category IN ('revenue', 'expense') AND s.level = 1 AND s.is_active = 1
ORDER BY s.code;

-- ============================================
-- 觸發器 - 自動更新憑證時間
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_accounting_vouchers_timestamp 
AFTER UPDATE ON accounting_vouchers
BEGIN
    UPDATE accounting_vouchers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 測試數據 - 創建測試憑證
-- ============================================
-- 創建一筆銷售收入的測試憑證
INSERT OR IGNORE INTO accounting_vouchers 
(voucher_no, voucher_date, voucher_type, total_debit, total_credit, status, summary, created_by)
SELECT 
    'VO202405010001',
    date('now'),
    'receipt',
    1000.00,
    1000.00,
    'posted',
    '收到客戶貨款',
    1
WHERE NOT EXISTS (SELECT 1 FROM accounting_vouchers WHERE voucher_no = 'VO202405010001');

-- 添加憑證明細
INSERT OR IGNORE INTO accounting_voucher_items 
(voucher_id, subject_id, subject_code, subject_name, summary, debit_amount, credit_amount, sort_order)
SELECT 
    (SELECT id FROM accounting_vouchers WHERE voucher_no = 'VO202405010001'),
    (SELECT id FROM accounting_subjects WHERE code = '1002'),
    '1002',
    '銀行存款',
    '收到客戶貨款',
    1000.00,
    0,
    1
WHERE NOT EXISTS (SELECT 1 FROM accounting_voucher_items WHERE voucher_id = (SELECT id FROM accounting_vouchers WHERE voucher_no = 'VO202405010001'));

INSERT OR IGNORE INTO accounting_voucher_items 
(voucher_id, subject_id, subject_code, subject_name, summary, debit_amount, credit_amount, sort_order)
SELECT 
    (SELECT id FROM accounting_vouchers WHERE voucher_no = 'VO202405010001'),
    (SELECT id FROM accounting_subjects WHERE code = '1122'),
    '1122',
    '應收賬款',
    '收到客戶貨款',
    0,
    1000.00,
    2
WHERE NOT EXISTS (SELECT 1 FROM accounting_voucher_items WHERE voucher_id = (SELECT id FROM accounting_vouchers WHERE voucher_no = 'VO202405010001') AND subject_code = '1122');
