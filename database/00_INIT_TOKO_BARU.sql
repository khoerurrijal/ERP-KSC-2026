-- 01_auth_rbac.sql
-- Run this script in the Supabase SQL Editor

-- 1. Create Roles Table
CREATE TABLE public.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Permissions Table
CREATE TABLE public.permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g. 'so:read', 'inventory:write'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Role_Permissions Table (Many-to-Many)
CREATE TABLE public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. Create Users Extension Table 
-- (Links to Supabase auth.users to store additional data like role_id)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name VARCHAR(255),
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Insert Initial Roles
INSERT INTO public.roles (name) VALUES 
('Owner'),
('Admin'),
('Operator Mesin'),
('Operator'),
('Customer');

-- 6. Insert Basic Permissions (You can add more later)
INSERT INTO public.permissions (name, description) VALUES
('all', 'Super admin full access'),
('customer:read', 'Read customer data'),
('customer:write', 'Write customer data'),
('so:read', 'Read sales orders'),
('so:write', 'Write sales orders'),
('po:read', 'Read purchase orders'),
('po:write', 'Write purchase orders'),
('inventory:read', 'Read inventory'),
('inventory:write', 'Write inventory'),
('payroll:read', 'Read payrolls'),
('payroll:write', 'Write payrolls'),
('finance:read', 'Read finance mutations'),
('finance:write', 'Write finance mutations'),
('production:read', 'Read production data'),
('production:update', 'Update production status'),
('tracking:create', 'Create tracking logs'),
('packing:update', 'Update packing status');

-- 7. Assign Permissions to Roles (Example for Owner)
DO $$
DECLARE
    owner_role_id UUID;
    perm_all_id UUID;
BEGIN
    SELECT id INTO owner_role_id FROM public.roles WHERE name = 'Owner';
    SELECT id INTO perm_all_id FROM public.permissions WHERE name = 'all';
    
    INSERT INTO public.role_permissions (role_id, permission_id) 
    VALUES (owner_role_id, perm_all_id)
    ON CONFLICT DO NOTHING;
END $$;

-- Enable Row Level Security (RLS) on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow authenticated users to read roles & permissions)
CREATE POLICY "Allow read access for authenticated users on roles" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access for authenticated users on permissions" ON public.permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access for authenticated users on role_permissions" ON public.role_permissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow users to read their own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- 02_master_transaction_schema.sql
-- Run this script in the Supabase SQL Editor after 01_auth_rbac.sql

-- ==========================================
-- 2. MASTER DATA MODULE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.workshops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    balance DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    job_title VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    size_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(category_id, size_name)
);

-- ==========================================
-- 3. INVENTORY MODULE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.inventory (
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    qty INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (workshop_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.stock_mutations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    qty_change INTEGER NOT NULL, -- Positive for IN, Negative for OUT
    type VARCHAR(50) NOT NULL,   -- e.g., 'IN', 'OUT', 'OPNAME'
    ref_type VARCHAR(50),        -- e.g., 'PO', 'SO', 'MANUAL'
    ref_id UUID,                 -- ID of the related PO/SO item
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 4. PURCHASE ORDER MODULE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'Draft' NOT NULL, -- 'Draft', 'Tempo', 'Lunas'
    total_amount DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.po_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE, -- Gudang / Global
    qty INTEGER DEFAULT 0 NOT NULL,
    price DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 5. SALES ORDER & TRACKING MODULE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.sales_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'Draft' NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    dp_amount DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'Belum Lunas' NOT NULL, -- 'Belum Lunas', 'Lunas'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    so_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    order_type VARCHAR(50) NOT NULL, -- 'Sablon', 'Polos', 'dll'
    qty INTEGER DEFAULT 0 NOT NULL,
    price DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    status VARCHAR(50) DEFAULT 'Baru Masuk' NOT NULL, -- 'Baru Masuk', 'Proses', 'Sudah Jadi', 'Selesai'
    mockup_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.production_trackings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    so_item_id UUID REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status_from VARCHAR(50),
    status_to VARCHAR(50) NOT NULL,
    qty_processed INTEGER DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 6. PAYROLL MODULE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payrolls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    present_count INTEGER DEFAULT 0 NOT NULL,
    bonus_amount DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    piecework_amount DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    late_deduction DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    loan_deduction DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    total_salary DECIMAL(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 7. FINANCE MODULE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL, -- 'IN' or 'OUT'
    amount DECIMAL(15, 2) NOT NULL,
    ref_type VARCHAR(50), -- 'SO', 'PO', 'PAYROLL', 'LAINNYA'
    ref_id UUID,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_inventory_workshop_product ON public.inventory(workshop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_mutations_ref ON public.stock_mutations(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_so_id ON public.sales_order_items(so_id);
CREATE INDEX IF NOT EXISTS idx_production_trackings_so_item_id ON public.production_trackings(so_item_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_workshop_ref ON public.finance_transactions(workshop_id, ref_type);

-- Insert Default Workshops
INSERT INTO public.workshops (name, balance) VALUES 
('KING', 0),
('GLOBAL', 0),
('GUDANG', 0),
('TABUNGAN', 0)
ON CONFLICT (name) DO NOTHING;
-- 03_full_schema_v2.sql
-- Run this script in the Supabase SQL Editor
-- WARNING: This will drop existing tables to ensure a clean slate for v2

-- ==========================================
-- 0. CLEANUP (OPTIONAL)
-- ==========================================
DROP TABLE IF EXISTS public.finance_transactions CASCADE;
DROP TABLE IF EXISTS public.cash_transactions CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.payroll_transactions CASCADE;
DROP TABLE IF EXISTS public.payroll_periods CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.marketplace_order_items CASCADE;
DROP TABLE IF EXISTS public.marketplace_orders CASCADE;
DROP TABLE IF EXISTS public.marketplace_accounts CASCADE;
DROP TABLE IF EXISTS public.production_logs CASCADE;
DROP TABLE IF EXISTS public.production_jobs CASCADE;
DROP TABLE IF EXISTS public.production_trackings CASCADE;
DROP TABLE IF EXISTS public.sales_order_items CASCADE;
DROP TABLE IF EXISTS public.sales_orders CASCADE;
DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.stock_transaction_items CASCADE;
DROP TABLE IF EXISTS public.stock_mutations CASCADE;
DROP TABLE IF EXISTS public.stock_transactions CASCADE;
DROP TABLE IF EXISTS public.raw_materials CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.workshops CASCADE;

-- ==========================================
-- 1. MASTER WORKSHOPS & AUTH
-- ==========================================

CREATE TABLE public.workshops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(20) UNIQUE,
    name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE public.permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. MASTER DATA MODULE
-- ==========================================

CREATE TABLE public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_code VARCHAR(50) UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_code VARCHAR(50) UNIQUE,
    supplier_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50),
    selling_price DECIMAL(15, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.raw_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material_code VARCHAR(50) UNIQUE,
    material_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50),
    minimum_stock INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. INVENTORY MODULE
-- ==========================================

CREATE TABLE public.stock_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- IN, OUT, ADJ
    reference_type VARCHAR(50), -- PO, PRODUCTION, MANUAL
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.stock_transaction_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_transaction_id UUID REFERENCES public.stock_transactions(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL,
    unit_cost DECIMAL(15, 2) DEFAULT 0.00,
    subtotal DECIMAL(15, 2) DEFAULT 0.00
);

-- ==========================================
-- 4. PURCHASE ORDER MODULE
-- ==========================================

CREATE TABLE public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    po_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.raw_materials(id) ON DELETE CASCADE,
    qty INTEGER DEFAULT 0,
    price DECIMAL(15, 2) DEFAULT 0.00,
    subtotal DECIMAL(15, 2) DEFAULT 0.00
);

-- ==========================================
-- 5. SALES ORDER MODULE
-- ==========================================

CREATE TABLE public.sales_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_date DATE NOT NULL,
    due_date DATE,
    grand_total DECIMAL(15, 2) DEFAULT 0.00,
    notes TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.sales_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    qty INTEGER DEFAULT 0,
    price DECIMAL(15, 2) DEFAULT 0.00,
    subtotal DECIMAL(15, 2) DEFAULT 0.00,
    production_status VARCHAR(50) DEFAULT 'PENDING',
    marketplace_status VARCHAR(50),
    delivery_date DATE,
    notes TEXT
);

-- ==========================================
-- 6. PRODUCTION TRACKING
-- ==========================================

CREATE TABLE public.production_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sales_order_item_id UUID REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
    start_date DATE,
    target_date DATE,
    finish_date DATE,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.production_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    production_job_id UUID REFERENCES public.production_jobs(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 7. MARKETPLACE MODULE
-- ==========================================

CREATE TABLE public.marketplace_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    store_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.marketplace_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    marketplace_account_id UUID REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
    external_order_id VARCHAR(100) UNIQUE,
    customer_name VARCHAR(255),
    order_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50),
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.marketplace_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    marketplace_order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    qty INTEGER DEFAULT 0,
    price DECIMAL(15, 2) DEFAULT 0.00,
    subtotal DECIMAL(15, 2) DEFAULT 0.00
);

-- ==========================================
-- 8. PAYROLL MODULE
-- ==========================================

CREATE TABLE public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE,
    employee_name VARCHAR(255) NOT NULL,
    position VARCHAR(100),
    join_date DATE,
    salary_type VARCHAR(50),
    basic_salary DECIMAL(15, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.payroll_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT'
);

CREATE TABLE public.payroll_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    period_id UUID REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    basic_salary DECIMAL(15, 2) DEFAULT 0.00,
    bonus DECIMAL(15, 2) DEFAULT 0.00,
    overtime DECIMAL(15, 2) DEFAULT 0.00,
    late_deduction DECIMAL(15, 2) DEFAULT 0.00,
    other_deduction DECIMAL(15, 2) DEFAULT 0.00,
    net_salary DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 9. FINANCE MODULE (ACCOUNTING)
-- ==========================================

CREATE TABLE public.accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_code VARCHAR(50) UNIQUE,
    account_name VARCHAR(100) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    parent_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL
);

CREATE TABLE public.cash_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(10) NOT NULL, -- IN, OUT
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    reference_type VARCHAR(50),
    reference_id UUID
);

-- ==========================================
-- DEFAULT DATA
-- ==========================================

INSERT INTO public.workshops (code, name) VALUES 
('KING', 'Workshop KING'),
('GLOBAL', 'Workshop GLOBAL'),
('GUDANG', 'Gudang Pusat'),
('TABUNGAN', 'Rekening Tabungan')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.roles (name) VALUES 
('Super Admin'),
('Owner'),
('Manager'),
('Purchasing'),
('Finance'),
('Produksi'),
('Warehouse')
ON CONFLICT (name) DO NOTHING;

-- RLS Configuration (Basic)
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for authenticated users on workshops" ON public.workshops FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access for authenticated users on users" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
-- Add more policies as needed...
-- Menambahkan kolom order_type dan mockup_url ke sales_order_items
ALTER TABLE public.sales_order_items ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'Polos';
ALTER TABLE public.sales_order_items ADD COLUMN IF NOT EXISTS mockup_url TEXT;
-- Menambahkan relasi kepemilikan Workshop pada tabel Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES public.workshops(id) ON DELETE SET NULL;
-- 05_final_schema_v3.sql
-- Drop existing tables to cleanly apply the new structure (useful for fresh development environment)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS sales_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS purchase_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS workshops CASCADE;

-- 1. WORKSHOPS
CREATE TABLE workshops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Workshops
INSERT INTO workshops (code, name) VALUES 
('KING', 'KING'),
('GUDANG', 'GUDANG'),
('GLOBAL', 'GLOBAL');

-- 2. CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code VARCHAR(50) UNIQUE NOT NULL, -- e.g., ID0013
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100), -- e.g., Reseller, Reguler, Shopee
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PRODUCTS (Master Barang)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code VARCHAR(50) UNIQUE NOT NULL, -- e.g., STG010, DS-019
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL, -- e.g., CUP, TINTA, PLASTIK, SEALER
  workshop_code VARCHAR(50) REFERENCES workshops(code) ON DELETE SET NULL, -- Pemilik barang
  base_price NUMERIC DEFAULT 0, -- HPP / Harga Beli (untuk dialokasikan ke Gudang/Global)
  selling_price NUMERIC DEFAULT 0, -- Harga Jual Default
  stock_qty INTEGER DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'PCS',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. PURCHASE ORDERS (Kulakan)
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(100) UNIQUE NOT NULL,
  date DATE NOT NULL,
  supplier VARCHAR(255),
  total_amount NUMERIC DEFAULT 0,
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'LUNAS',
  workshop_code VARCHAR(50) REFERENCES workshops(code) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_code VARCHAR(50) REFERENCES products(product_code) ON DELETE SET NULL,
  qty INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL
);

-- 5. SALES ORDERS (Penjualan Sentral - 1 Pintu)
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  marketplace_receipt VARCHAR(100), -- No. Pesanan Shopee/Toped
  date DATE NOT NULL,
  customer_code VARCHAR(50) REFERENCES customers(customer_code) ON DELETE SET NULL,
  notes TEXT,
  total_amount NUMERIC DEFAULT 0,
  dp_amount NUMERIC DEFAULT 0,
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'BELUM LUNAS',
  status VARCHAR(50) DEFAULT 'PROSES',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sales_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  so_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
  order_type VARCHAR(50), -- SABLON / POLOS / TINTA
  product_code VARCHAR(50) REFERENCES products(product_code) ON DELETE SET NULL,
  mockup_url TEXT,
  qty INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  hpp_price NUMERIC DEFAULT 0, -- Snapshot HPP saat itu
  total_price NUMERIC NOT NULL
);

-- 6. TRANSACTIONS (Buku Besar & Arus Kas)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  reference VARCHAR(255), -- PENJUALAN, LISTRIK WIFI, dll
  description TEXT, -- Nama Brand atau Catatan
  payment_method VARCHAR(50), -- Cash, BCA, dll
  amount_in NUMERIC DEFAULT 0,
  amount_out NUMERIC DEFAULT 0,
  workshop_code VARCHAR(50) REFERENCES workshops(code) ON DELETE SET NULL, -- Milik siapa uangnya
  so_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL, -- Tautan ke SO jika ada
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS marketplace_pencairan NUMERIC(15,2) DEFAULT 0;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS salary_schemas CASCADE;

CREATE TABLE salary_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(100) UNIQUE NOT NULL,
    gaji_harian NUMERIC DEFAULT 0,
    uang_makan NUMERIC DEFAULT 0,
    bonus_mingguan NUMERIC DEFAULT 0,
    rate_borongan_sendiri NUMERIC DEFAULT 0,
    rate_produksi_bawahan NUMERIC DEFAULT 0,
    batas_qty_bonus_harian INTEGER DEFAULT 0,
    bonus_harian_dibawah_target NUMERIC DEFAULT 0,
    batas_qty_target_harian INTEGER DEFAULT 0,
    bonus_target_harian NUMERIC DEFAULT 0,
    fee_2_warna NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    salary_schema_id UUID REFERENCES salary_schemas(id) ON DELETE SET NULL,
    supervisor_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix permissions for Supabase anon and authenticated roles
GRANT ALL ON TABLE salary_schemas TO anon, authenticated;
GRANT ALL ON TABLE employees TO anon, authenticated;

-- Seed basic roles
INSERT INTO salary_schemas (role_name, gaji_harian, uang_makan, bonus_mingguan)
VALUES ('Owner', 0, 0, 0) ON CONFLICT DO NOTHING;

INSERT INTO salary_schemas (role_name, gaji_harian, uang_makan, bonus_mingguan)
VALUES ('Admin', 0, 0, 0) ON CONFLICT DO NOTHING;

INSERT INTO salary_schemas (
    role_name, 
    rate_borongan_sendiri, 
    rate_produksi_bawahan, 
    batas_qty_bonus_harian, 
    bonus_harian_dibawah_target,
    batas_qty_target_harian,
    bonus_target_harian,
    fee_2_warna
)
VALUES ('Operator Mesin', 20, 5, 3000, 35000, 5000, 0, 10000) ON CONFLICT DO NOTHING;

INSERT INTO salary_schemas (
    role_name, 
    gaji_harian, 
    uang_makan, 
    rate_borongan_sendiri, 
    bonus_mingguan,
    fee_2_warna
)
VALUES ('Operator', 0, 0, 10, 0, 0) ON CONFLICT DO NOTHING;
-- database/11_sprint4_schema.sql

-- 1. MOVE GAJI HARIAN & UANG MAKAN TO EMPLOYEES
-- We drop from salary_schemas, add to employees
ALTER TABLE salary_schemas DROP COLUMN IF EXISTS gaji_harian CASCADE;
ALTER TABLE salary_schemas DROP COLUMN IF EXISTS uang_makan CASCADE;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS gaji_harian NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS uang_makan NUMERIC DEFAULT 0;

-- 2. CREATE SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_name VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure UNIQUE constraint just in case the table was created manually without it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_supplier_name_key'
  ) THEN
    ALTER TABLE suppliers ADD CONSTRAINT suppliers_supplier_name_key UNIQUE (supplier_name);
  END IF;
END $$;

-- Seed Suppliers from existing purchase_orders
INSERT INTO suppliers (supplier_name)
SELECT DISTINCT supplier FROM purchase_orders WHERE supplier IS NOT NULL AND supplier != ''
ON CONFLICT (supplier_name) DO NOTHING;

-- Modify purchase_orders to reference suppliers table
-- For now we just add supplier_id, we keep the old text field just in case
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
UPDATE purchase_orders po SET supplier_id = s.id FROM suppliers s WHERE po.supplier = s.supplier_name;

-- 3. CREATE SYSTEM SETTINGS TABLE (For Pricelist Margin & Sablon Rates)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default pricelist settings
INSERT INTO system_settings (key, value)
VALUES ('pricelist_config', '{"profitMargin": 15, "sablonFee": {"CUP": {"500": 450, "1000": 350, "5000": 300, "10000": 250}, "PLASTIK": {"500": 350, "1000": 250, "5000": 200, "10000": 150}, "PAPERBOWL": {"500": 550, "1000": 450, "5000": 400, "10000": 350}}}')
ON CONFLICT (key) DO NOTHING;

-- 4. CREATE PRODUCTION LOGS
CREATE TABLE IF NOT EXISTS production_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES sales_items(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL, -- Operator that did the work
    qty_processed INTEGER NOT NULL,
    processed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CREATE PAYROLLS
CREATE TABLE IF NOT EXISTS payrolls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_id UUID REFERENCES payrolls(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    base_salary NUMERIC DEFAULT 0,
    meal_allowance NUMERIC DEFAULT 0,
    weekly_bonus NUMERIC DEFAULT 0,
    borongan_amount NUMERIC DEFAULT 0,
    bawahan_bonus NUMERIC DEFAULT 0,
    other_bonuses NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0
);

-- PERMISSIONS
GRANT ALL ON TABLE suppliers TO anon, authenticated;
GRANT ALL ON TABLE system_settings TO anon, authenticated;
GRANT ALL ON TABLE production_logs TO anon, authenticated;
GRANT ALL ON TABLE payrolls TO anon, authenticated;
GRANT ALL ON TABLE payroll_items TO anon, authenticated;
-- database/12_add_kasbon_column.sql

ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS kasbon_amount NUMERIC DEFAULT 0;
-- database/13_loans_schema.sql

-- 1. Insert TABUNGAN into workshops so it can be used as a ledger
INSERT INTO workshops (code, name) 
VALUES ('TABUNGAN', 'TABUNGAN')
ON CONFLICT (code) DO NOTHING;

-- 2. Create employee_loans table
CREATE TABLE IF NOT EXISTS employee_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('KASBON', 'PINJAMAN')),
    amount NUMERIC NOT NULL DEFAULT 0,
    tenor_weeks INTEGER DEFAULT 1,
    installment_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'BELUM LUNAS' CHECK (status IN ('BELUM LUNAS', 'LUNAS')),
    disbursed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON TABLE employee_loans TO anon, authenticated, service_role;
-- 14_audit_fixes.sql
-- Generated from Architecture & Data Audit Report

-- 1. Tambahkan constraint UPDATE CASCADE untuk mengamankan relasi text/varchar
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_customer_code_fkey;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_customer_code_fkey FOREIGN KEY (customer_code) REFERENCES customers(customer_code) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE sales_items DROP CONSTRAINT IF EXISTS sales_items_product_code_fkey;
ALTER TABLE sales_items ADD CONSTRAINT sales_items_product_code_fkey FOREIGN KEY (product_code) REFERENCES products(product_code) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_product_code_fkey;
ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_product_code_fkey FOREIGN KEY (product_code) REFERENCES products(product_code) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Amankan transaksi dari nilai minus
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS check_amounts_positive;
ALTER TABLE transactions ADD CONSTRAINT check_amounts_positive CHECK (amount_in >= 0 AND amount_out >= 0);

-- 3. Tambahkan kolom yang terlewat
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- 4. Cleaning Data PO lama (Mapping ulang NULL supplier_id)
UPDATE purchase_orders po 
SET supplier_id = s.id 
FROM suppliers s 
WHERE po.supplier = s.supplier_name AND po.supplier_id IS NULL;
-- 15_sync_inventory_stock.sql
-- Script untuk MENGHITUNG ULANG seluruh stok produk berdasarkan riwayat historis murni
-- (Total Pembelian - Total Penjualan)
-- Jalankan di SQL Editor Supabase

WITH StockCalculation AS (
    SELECT 
        p.product_code,
        p.name,
        COALESCE(beli.total_beli, 0) AS total_beli,
        COALESCE(jual.total_jual, 0) AS total_jual,
        (COALESCE(beli.total_beli, 0) - COALESCE(jual.total_jual, 0)) AS calculated_stock
    FROM 
        products p
    LEFT JOIN (
        -- Hitung total QTY yang dibeli per produk
        SELECT product_code, SUM(qty) as total_beli 
        FROM purchase_items 
        GROUP BY product_code
    ) beli ON p.product_code = beli.product_code
    LEFT JOIN (
        -- Hitung total QTY yang dijual per produk
        SELECT product_code, SUM(qty) as total_jual 
        FROM sales_items 
        GROUP BY product_code
    ) jual ON p.product_code = jual.product_code
)

-- Lakukan UPDATE pada tabel products
UPDATE products
SET stock_qty = sc.calculated_stock
FROM StockCalculation sc
WHERE products.product_code = sc.product_code;

-- (Opsional) Cek hasilnya:
-- SELECT product_code, name, stock_qty FROM products ORDER BY name;
-- 16_inventory_mutations_view.sql
-- Script untuk membuat VIEW SQL yang menggabungkan riwayat masuk (PO) dan keluar (SO)
-- Jalankan di SQL Editor Supabase

CREATE OR REPLACE VIEW inventory_mutations AS
SELECT 
  po.date AS mutation_date,
  'PO: ' || po.po_number AS reference,
  po.supplier AS actor,
  pi.product_code,
  p.name AS product_name,
  pi.qty AS qty_in,
  0 AS qty_out,
  po.created_at AS created_at
FROM purchase_items pi
JOIN purchase_orders po ON pi.po_id = po.id
JOIN products p ON pi.product_code = p.product_code

UNION ALL

SELECT 
  so.date AS mutation_date,
  'SO: ' || so.invoice_number AS reference,
  COALESCE(c.name, so.customer_code) AS actor,
  si.product_code,
  p.name AS product_name,
  0 AS qty_in,
  si.qty AS qty_out,
  so.created_at AS created_at
FROM sales_items si
JOIN sales_orders so ON si.so_id = so.id
JOIN products p ON si.product_code = p.product_code
LEFT JOIN customers c ON so.customer_code = c.customer_code;

-- Berikan akses agar API Supabase (anon & authenticated) bisa membacanya
GRANT SELECT ON inventory_mutations TO anon;
GRANT SELECT ON inventory_mutations TO authenticated;
-- 17_disable_rls.sql
-- Script untuk menonaktifkan RLS (Row Level Security) di semua tabel 
-- agar aplikasi bisa leluasa mengambil dan menyimpan data dari localhost tanpa diblokir.

ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshops DISABLE ROW LEVEL SECURITY;

ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items DISABLE ROW LEVEL SECURITY;

ALTER TABLE sales_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_items DISABLE ROW LEVEL SECURITY;

ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_loans DISABLE ROW LEVEL SECURITY;

-- Note: VIEW (seperti inventory_mutations) tidak memiliki RLS sendiri secara default,
-- ia mengikuti RLS dari tabel-tabel aslinya (yang sekarang sudah dimatikan di atas).
-- 18_fix_production_logs.sql
-- Run this in Supabase SQL Editor to fix the missing employee_id column error

-- Drop the old table that was created from 03_full_schema_v2
DROP TABLE IF EXISTS public.production_logs CASCADE;

-- Recreate with the correct schema from Sprint 4
CREATE TABLE public.production_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.sales_items(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    qty_processed INTEGER NOT NULL,
    processed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON TABLE public.production_logs TO anon, authenticated;

-- Force PostgREST to reload schema cache so the API picks up the new employee_id column
NOTIFY pgrst, 'reload schema';
-- 1. Tambahkan kolom status ke tabel sales_items
ALTER TABLE public.sales_items 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Proses';

-- 2. Sinkronkan status item lama dengan status invoice-nya (jika SO Selesai, item juga Selesai)
UPDATE public.sales_items
SET status = 'Selesai'
FROM public.sales_orders
WHERE public.sales_items.so_id = public.sales_orders.id
  AND public.sales_orders.status = 'Selesai';
-- Menghapus kolom status pada tabel sales_orders
-- Status sekarang murni dikendalikan per item di tabel sales_items

ALTER TABLE public.sales_orders 
DROP COLUMN IF EXISTS status;
CREATE OR REPLACE FUNCTION public.update_so_status_from_items()
RETURNS trigger AS $$
DECLARE
  v_so_id bigint;
  v_dp numeric;
  v_payment_status text;
  v_all_items_finished boolean;
  v_has_proses boolean;
  v_new_status text;
BEGIN
  -- Determine which so_id to check
  IF TG_TABLE_NAME = 'sales_items' THEN
    v_so_id := NEW.so_id;
  ELSIF TG_TABLE_NAME = 'sales_orders' THEN
    v_so_id := NEW.id;
  END IF;

  -- Fetch order details
  SELECT dp_amount, payment_status INTO v_dp, v_payment_status
  FROM public.sales_orders
  WHERE id = v_so_id;

  -- Jika dari tabel sales_orders dan payment_status baru saja diubah menjadi LUNAS,
  -- Kita update otomatis item yang eligible menjadi SELESAI.
  IF TG_TABLE_NAME = 'sales_orders' AND NEW.payment_status = 'LUNAS' THEN
    UPDATE public.sales_items 
    SET status = 'SELESAI'
    WHERE so_id = NEW.id 
      AND status IN ('DIKIRIM', 'TERKIRIM', 'SUDAH DIAMBIL', 'STOK KELUAR');
      
    -- Karena kita baru update item, kita harus pakai NEW.payment_status untuk evaluasi selanjutnya
    v_payment_status := NEW.payment_status;
    v_dp := NEW.dp_amount;
  END IF;

  -- Check items
  SELECT 
    bool_and(status IN ('SELESAI', 'SUDAH JADI', 'DIKIRIM', 'STOK KELUAR', 'SUDAH DIAMBIL')),
    bool_or(status NOT IN ('BARU MASUK', 'DRAFT'))
  INTO v_all_items_finished, v_has_proses
  FROM public.sales_items
  WHERE so_id = v_so_id;

  IF v_all_items_finished IS NULL THEN
    v_all_items_finished := false;
    v_has_proses := false;
  END IF;

  -- Calculate New Status
  IF COALESCE(v_has_proses, false) THEN
    -- Jika barang sudah mulai diproses/selesai
    IF v_payment_status = 'LUNAS' AND v_all_items_finished THEN
      v_new_status := 'SELESAI';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  ELSE
    -- Jika barang masih baru masuk / kosong
    IF COALESCE(v_dp, 0) = 0 THEN
      v_new_status := 'DRAFT';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  END IF;

  -- Perform the update
  IF TG_TABLE_NAME = 'sales_items' THEN
    UPDATE public.sales_orders SET status = v_new_status WHERE id = v_so_id AND status IS DISTINCT FROM v_new_status;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'sales_orders' THEN
    NEW.status := v_new_status;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_so_status_on_items ON public.sales_items;
CREATE TRIGGER trg_update_so_status_on_items
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.sales_items
FOR EACH ROW
EXECUTE FUNCTION public.update_so_status_from_items();

DROP TRIGGER IF EXISTS trg_update_so_status_on_order ON public.sales_orders;
CREATE TRIGGER trg_update_so_status_on_order
BEFORE INSERT OR UPDATE OF dp_amount, payment_status
ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_so_status_from_items();
-- database/22_add_beli_columns_to_sales_orders.sql

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS beli_gudang numeric DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS beli_global numeric DEFAULT 0;
CREATE OR REPLACE FUNCTION public.update_so_status_from_items()
RETURNS trigger AS $$
DECLARE
  v_so_id uuid;
  v_dp numeric;
  v_payment_status text;
  v_all_items_finished boolean;
  v_has_proses boolean;
  v_new_status text;
BEGIN
  -- Determine which so_id to check
  IF TG_TABLE_NAME = 'sales_items' THEN
    v_so_id := NEW.so_id;
  ELSIF TG_TABLE_NAME = 'sales_orders' THEN
    v_so_id := NEW.id;
  END IF;

  -- Fetch order details
  SELECT dp_amount, payment_status INTO v_dp, v_payment_status
  FROM public.sales_orders
  WHERE id = v_so_id;

  -- Jika dari tabel sales_orders dan payment_status baru saja diubah menjadi LUNAS,
  -- Kita update otomatis item yang eligible menjadi SELESAI.
  IF TG_TABLE_NAME = 'sales_orders' AND NEW.payment_status = 'LUNAS' THEN
    UPDATE public.sales_items 
    SET status = 'SELESAI'
    WHERE so_id = NEW.id 
      AND status IN ('DIKIRIM', 'TERKIRIM', 'SUDAH DIAMBIL', 'STOK KELUAR');
      
    -- Karena kita baru update item, kita harus pakai NEW.payment_status untuk evaluasi selanjutnya
    v_payment_status := NEW.payment_status;
    v_dp := NEW.dp_amount;
  END IF;

  -- Check items
  SELECT 
    bool_and(status IN ('SELESAI', 'SUDAH JADI', 'DIKIRIM', 'STOK KELUAR', 'SUDAH DIAMBIL')),
    bool_or(status NOT IN ('BARU MASUK', 'DRAFT'))
  INTO v_all_items_finished, v_has_proses
  FROM public.sales_items
  WHERE so_id = v_so_id;

  IF v_all_items_finished IS NULL THEN
    v_all_items_finished := false;
    v_has_proses := false;
  END IF;

  -- Calculate New Status
  IF COALESCE(v_has_proses, false) THEN
    -- Jika barang sudah mulai diproses/selesai
    IF v_payment_status = 'LUNAS' AND v_all_items_finished THEN
      v_new_status := 'SELESAI';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  ELSE
    -- Jika barang masih baru masuk / kosong
    IF COALESCE(v_dp, 0) = 0 THEN
      v_new_status := 'DRAFT';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  END IF;

  -- Perform the update
  IF TG_TABLE_NAME = 'sales_items' THEN
    UPDATE public.sales_orders SET status = v_new_status WHERE id = v_so_id AND status IS DISTINCT FROM v_new_status;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'sales_orders' THEN
    NEW.status := v_new_status;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 1. Fungsi untuk Trigger pada sales_items
CREATE OR REPLACE FUNCTION public.update_so_status_from_items_trigger()
RETURNS trigger AS $$
DECLARE
  v_so_id uuid;
  v_dp numeric;
  v_payment_status text;
  v_all_items_finished boolean;
  v_has_proses boolean;
  v_new_status text;
BEGIN
  v_so_id := NEW.so_id;

  SELECT dp_amount, payment_status INTO v_dp, v_payment_status
  FROM public.sales_orders
  WHERE id = v_so_id;

  SELECT 
    bool_and(status IN ('SELESAI', 'SUDAH JADI', 'DIKIRIM', 'STOK KELUAR', 'SUDAH DIAMBIL')),
    bool_or(status NOT IN ('BARU MASUK', 'DRAFT'))
  INTO v_all_items_finished, v_has_proses
  FROM public.sales_items
  WHERE so_id = v_so_id;

  IF v_all_items_finished IS NULL THEN
    v_all_items_finished := false;
    v_has_proses := false;
  END IF;

  IF COALESCE(v_has_proses, false) THEN
    IF v_payment_status = 'LUNAS' AND v_all_items_finished THEN
      v_new_status := 'SELESAI';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  ELSE
    IF COALESCE(v_dp, 0) = 0 THEN
      v_new_status := 'DRAFT';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  END IF;

  UPDATE public.sales_orders SET status = v_new_status WHERE id = v_so_id AND status IS DISTINCT FROM v_new_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fungsi untuk Trigger pada sales_orders
CREATE OR REPLACE FUNCTION public.update_so_items_from_order_trigger()
RETURNS trigger AS $$
DECLARE
  v_all_items_finished boolean;
  v_has_proses boolean;
  v_new_status text;
BEGIN
  -- Update items jika LUNAS
  IF NEW.payment_status = 'LUNAS' THEN
    UPDATE public.sales_items 
    SET status = 'SELESAI'
    WHERE so_id = NEW.id 
      AND status IN ('DIKIRIM', 'TERKIRIM', 'SUDAH DIAMBIL', 'STOK KELUAR');
  END IF;

  -- Cek status items
  SELECT 
    bool_and(status IN ('SELESAI', 'SUDAH JADI', 'DIKIRIM', 'STOK KELUAR', 'SUDAH DIAMBIL')),
    bool_or(status NOT IN ('BARU MASUK', 'DRAFT'))
  INTO v_all_items_finished, v_has_proses
  FROM public.sales_items
  WHERE so_id = NEW.id;

  IF v_all_items_finished IS NULL THEN
    v_all_items_finished := false;
    v_has_proses := false;
  END IF;

  IF COALESCE(v_has_proses, false) THEN
    IF NEW.payment_status = 'LUNAS' AND v_all_items_finished THEN
      v_new_status := 'SELESAI';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  ELSE
    IF COALESCE(NEW.dp_amount, 0) = 0 THEN
      v_new_status := 'DRAFT';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  END IF;

  NEW.status := v_new_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Replace the old triggers
DROP TRIGGER IF EXISTS trg_update_so_status_on_items ON public.sales_items;
CREATE TRIGGER trg_update_so_status_on_items
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.sales_items
FOR EACH ROW
EXECUTE FUNCTION public.update_so_status_from_items_trigger();

DROP TRIGGER IF EXISTS trg_update_so_status_on_order ON public.sales_orders;
CREATE TRIGGER trg_update_so_status_on_order
BEFORE INSERT OR UPDATE OF dp_amount, payment_status
ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_so_items_from_order_trigger();
-- Tambah kolom beli_gudang dan beli_global ke tabel sales_items
ALTER TABLE public.sales_items 
ADD COLUMN IF NOT EXISTS beli_gudang numeric DEFAULT 0;

ALTER TABLE public.sales_items 
ADD COLUMN IF NOT EXISTS beli_global numeric DEFAULT 0;

-- Hapus kolom beli_gudang dan beli_global dari tabel sales_orders
ALTER TABLE public.sales_orders 
DROP COLUMN IF EXISTS beli_gudang;

ALTER TABLE public.sales_orders 
DROP COLUMN IF EXISTS beli_global;
-- 26_production_defects.sql
-- Script untuk menambahkan kolom defect dan keterangan pada log produksi
-- dan memasukkannya ke dalam tabel Mutasi Stok
-- HARAP JALANKAN DI SUPABASE SQL EDITOR

-- 1. Tambah kolom qty_defect dan notes pada production_logs
ALTER TABLE public.production_logs ADD COLUMN IF NOT EXISTS qty_defect INTEGER DEFAULT 0;
ALTER TABLE public.production_logs ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Perbarui VIEW inventory_mutations agar menyertakan keterangan/notes, dan memotong defect produksi
-- VIEW ini menggabungkan Purchase Orders (Masuk), Sales Orders (Keluar), dan Production Defect (Keluar)
DROP VIEW IF EXISTS public.inventory_mutations;

CREATE OR REPLACE VIEW public.inventory_mutations AS
-- PO MASUK
SELECT 
  po.date AS mutation_date,
  'PO: ' || po.po_number AS reference,
  po.supplier AS actor,
  pi.product_code,
  p.name AS product_name,
  pi.qty AS qty_in,
  0 AS qty_out,
  0 AS qty_proses,
  0 AS qty_reject,
  NULL AS notes,
  NULL AS operator_name,
  po.created_at AS created_at
FROM purchase_items pi
JOIN purchase_orders po ON pi.po_id = po.id
JOIN products p ON pi.product_code = p.product_code

UNION ALL

-- SO KELUAR (Kecuali jenis pesanan SABLON yang belum diproduksi)
SELECT 
  so.date AS mutation_date,
  'SO: ' || so.invoice_number AS reference,
  COALESCE(c.name, so.customer_code) AS actor,
  si.product_code,
  p.name AS product_name,
  0 AS qty_in,
  si.qty AS qty_out,
  0 AS qty_proses,
  0 AS qty_reject,
  so.notes AS notes,
  NULL AS operator_name,
  so.created_at AS created_at
FROM sales_items si
JOIN sales_orders so ON si.so_id = so.id
JOIN products p ON si.product_code = p.product_code
LEFT JOIN customers c ON so.customer_code = c.customer_code
WHERE si.order_type IS NULL OR si.order_type != 'SABLON'

UNION ALL

-- PRODUKSI KELUAR (SABLON: Termasuk yang diproses dan direject)
SELECT 
  CAST(pl.processed_date AS DATE) AS mutation_date,
  'Produksi: ' || so.invoice_number AS reference,
  COALESCE(c.name, so.customer_code) AS actor,
  si.product_code,
  p.name AS product_name,
  0 AS qty_in,
  (pl.qty_processed + COALESCE(pl.qty_defect, 0)) AS qty_out,
  pl.qty_processed AS qty_proses,
  COALESCE(pl.qty_defect, 0) AS qty_reject,
  pl.notes AS notes,
  e.full_name AS operator_name,
  pl.created_at AS created_at
FROM production_logs pl
JOIN sales_items si ON pl.job_id = si.id
JOIN sales_orders so ON si.so_id = so.id
JOIN products p ON si.product_code = p.product_code
LEFT JOIN customers c ON so.customer_code = c.customer_code
LEFT JOIN employees e ON pl.employee_id = e.id
WHERE pl.qty_processed > 0 OR COALESCE(pl.qty_defect, 0) > 0;

-- Berikan akses agar API Supabase (anon & authenticated) bisa membacanya
GRANT SELECT ON public.inventory_mutations TO anon;
GRANT SELECT ON public.inventory_mutations TO authenticated;

-- =====================================================================
-- (OPSIONAL) UPDATE SYNC STOCK LOGIC
-- Jika Anda menjalankan ulang sinkronisasi manual.
-- =====================================================================
DROP VIEW IF EXISTS public.stock_calculation_v2;

CREATE OR REPLACE VIEW public.stock_calculation_v2 AS
SELECT 
    p.product_code,
    p.name,
    COALESCE(beli.total_beli, 0) AS total_beli,
    COALESCE(jual.total_jual, 0) AS total_jual,
    COALESCE(produksi.total_produksi, 0) AS total_produksi,
    (COALESCE(beli.total_beli, 0) - COALESCE(jual.total_jual, 0) - COALESCE(produksi.total_produksi, 0)) AS calculated_stock
FROM 
    products p
LEFT JOIN (
    SELECT product_code, SUM(qty) as total_beli 
    FROM purchase_items 
    GROUP BY product_code
) beli ON p.product_code = beli.product_code
LEFT JOIN (
    SELECT product_code, SUM(qty) as total_jual 
    FROM sales_items 
    WHERE order_type IS NULL OR order_type != 'SABLON'
    GROUP BY product_code
) jual ON p.product_code = jual.product_code
LEFT JOIN (
    SELECT si.product_code, SUM(pl.qty_processed + COALESCE(pl.qty_defect, 0)) as total_produksi
    FROM production_logs pl
    JOIN sales_items si ON pl.job_id = si.id
    GROUP BY si.product_code
) produksi ON p.product_code = produksi.product_code;

-- Script update stock jika dipanggil:
-- UPDATE products p SET stock_qty = sc.calculated_stock FROM stock_calculation_v2 sc WHERE p.product_code = sc.product_code;
-- 27_unit_conversion.sql
-- Script untuk menambahkan sistem satuan (Multi Unit) per produk
-- HARAP JALANKAN DI SUPABASE SQL EDITOR

-- 1. Buat Tabel product_units
CREATE TABLE IF NOT EXISTS public.product_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code VARCHAR(50) NOT NULL REFERENCES public.products(product_code) ON DELETE CASCADE,
  unit_name VARCHAR(50) NOT NULL,
  multiplier INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_code, unit_name)
);

-- Berikan akses ke tabel product_units
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on product_units" ON public.product_units;
CREATE POLICY "Allow all on product_units" ON public.product_units FOR ALL USING (true);
GRANT ALL ON public.product_units TO anon, authenticated, service_role;

-- 2. Tambah kolom unit & multiplier ke purchase_items dan sales_items
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'PCS';
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS unit_multiplier INTEGER DEFAULT 1;

ALTER TABLE public.sales_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'PCS';
ALTER TABLE public.sales_items ADD COLUMN IF NOT EXISTS unit_multiplier INTEGER DEFAULT 1;

-- 3. Perbarui VIEW inventory_mutations agar mengalikan QTY masuk/keluar dengan unit_multiplier
DROP VIEW IF EXISTS public.inventory_mutations;

CREATE OR REPLACE VIEW public.inventory_mutations AS
-- PO MASUK
SELECT 
  po.date AS mutation_date,
  'PO: ' || po.po_number AS reference,
  po.supplier AS actor,
  pi.product_code,
  p.name AS product_name,
  (pi.qty * COALESCE(pi.unit_multiplier, 1)) AS qty_in,
  0 AS qty_out,
  0 AS qty_proses,
  0 AS qty_reject,
  NULL AS notes,
  NULL AS operator_name,
  po.created_at AS created_at
FROM purchase_items pi
JOIN purchase_orders po ON pi.po_id = po.id
JOIN products p ON pi.product_code = p.product_code

UNION ALL

-- SO KELUAR (Kecuali jenis pesanan SABLON yang belum diproduksi)
SELECT 
  so.date AS mutation_date,
  'SO: ' || so.invoice_number AS reference,
  COALESCE(c.name, so.customer_code) AS actor,
  si.product_code,
  p.name AS product_name,
  0 AS qty_in,
  (si.qty * COALESCE(si.unit_multiplier, 1)) AS qty_out,
  0 AS qty_proses,
  0 AS qty_reject,
  so.notes AS notes,
  NULL AS operator_name,
  so.created_at AS created_at
FROM sales_items si
JOIN sales_orders so ON si.so_id = so.id
JOIN products p ON si.product_code = p.product_code
LEFT JOIN customers c ON so.customer_code = c.customer_code
WHERE si.order_type IS NULL OR si.order_type != 'SABLON'

UNION ALL

-- PRODUKSI KELUAR (SABLON: Termasuk yang diproses dan direject)
SELECT 
  CAST(pl.processed_date AS DATE) AS mutation_date,
  'Produksi: ' || so.invoice_number AS reference,
  COALESCE(c.name, so.customer_code) AS actor,
  si.product_code,
  p.name AS product_name,
  0 AS qty_in,
  (pl.qty_processed + COALESCE(pl.qty_defect, 0)) AS qty_out,
  pl.qty_processed AS qty_proses,
  COALESCE(pl.qty_defect, 0) AS qty_reject,
  pl.notes AS notes,
  e.full_name AS operator_name,
  pl.created_at AS created_at
FROM production_logs pl
JOIN sales_items si ON pl.job_id = si.id
JOIN sales_orders so ON si.so_id = so.id
JOIN products p ON si.product_code = p.product_code
LEFT JOIN customers c ON so.customer_code = c.customer_code
LEFT JOIN employees e ON pl.employee_id = e.id
WHERE pl.qty_processed > 0 OR COALESCE(pl.qty_defect, 0) > 0;

GRANT SELECT ON public.inventory_mutations TO anon;
GRANT SELECT ON public.inventory_mutations TO authenticated;

-- 4. Perbarui VIEW stock_calculation_v2
DROP VIEW IF EXISTS public.stock_calculation_v2;

CREATE OR REPLACE VIEW public.stock_calculation_v2 AS
SELECT 
    p.product_code,
    p.name,
    COALESCE(beli.total_beli, 0) AS total_beli,
    COALESCE(jual.total_jual, 0) AS total_jual,
    COALESCE(produksi.total_produksi, 0) AS total_produksi,
    (COALESCE(beli.total_beli, 0) - COALESCE(jual.total_jual, 0) - COALESCE(produksi.total_produksi, 0)) AS calculated_stock
FROM 
    products p
LEFT JOIN (
    SELECT product_code, SUM(qty * COALESCE(unit_multiplier, 1)) as total_beli 
    FROM purchase_items 
    GROUP BY product_code
) beli ON p.product_code = beli.product_code
LEFT JOIN (
    SELECT product_code, SUM(qty * COALESCE(unit_multiplier, 1)) as total_jual 
    FROM sales_items 
    WHERE order_type IS NULL OR order_type != 'SABLON'
    GROUP BY product_code
) jual ON p.product_code = jual.product_code
LEFT JOIN (
    SELECT si.product_code, SUM(pl.qty_processed + COALESCE(pl.qty_defect, 0)) as total_produksi
    FROM production_logs pl
    JOIN sales_items si ON pl.job_id = si.id
    GROUP BY si.product_code
) produksi ON p.product_code = produksi.product_code;

-- Add pricing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS hpp_murni NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_polos NUMERIC DEFAULT 0;

-- Optional: If you want to keep track of pack/roll price explicitly 
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_polos_pack_roll NUMERIC DEFAULT 0;
-- 1. Hapus kolom lama yang sudah tidak terpakai
ALTER TABLE products DROP COLUMN IF EXISTS selling_price;
ALTER TABLE products DROP COLUMN IF EXISTS price_polos_pack_roll;

-- 2. Buat tabel sablon_matrix
CREATE TABLE IF NOT EXISTS sablon_matrix (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(255) NOT NULL UNIQUE,
    min_1 NUMERIC DEFAULT 0,
    min_10 NUMERIC DEFAULT 0,
    min_100 NUMERIC DEFAULT 0,
    min_500 NUMERIC DEFAULT 0,
    min_1000 NUMERIC DEFAULT 0,
    min_5000 NUMERIC DEFAULT 0,
    min_10000 NUMERIC DEFAULT 0,
    status VARCHAR(50) DEFAULT 'AKTIF',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE sablon_matrix ENABLE ROW LEVEL SECURITY;

-- Create basic policies (Allow all for simplicity, or specific roles)
DROP POLICY IF EXISTS "Enable read access for all users" ON sablon_matrix;
CREATE POLICY "Enable read access for all users" ON sablon_matrix FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON sablon_matrix;
CREATE POLICY "Enable insert for authenticated users only" ON sablon_matrix FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON sablon_matrix;
CREATE POLICY "Enable update for authenticated users only" ON sablon_matrix FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON sablon_matrix;
CREATE POLICY "Enable delete for authenticated users only" ON sablon_matrix FOR DELETE USING (auth.role() = 'authenticated');
-- Memberikan hak akses ke tabel sablon_matrix
GRANT ALL PRIVILEGES ON public.sablon_matrix TO anon;
GRANT ALL PRIVILEGES ON public.sablon_matrix TO authenticated;
GRANT ALL PRIVILEGES ON public.sablon_matrix TO service_role;
-- 32_add_physical_stock.sql
-- Script untuk menambahkan Stok Fisik terpisah dari Stok Tersedia
-- HARAP JALANKAN DI SUPABASE SQL EDITOR

-- 1. Tambah kolom physical_stock
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS physical_stock INTEGER DEFAULT 0;

-- 2. Update stock_calculation_v2
DROP VIEW IF EXISTS public.stock_calculation_v2;

CREATE OR REPLACE VIEW public.stock_calculation_v2 AS
SELECT 
    p.product_code,
    p.name,
    COALESCE(beli.total_beli, 0) AS total_beli,
    COALESCE(jual_semua.total_jual, 0) AS total_jual_semua,
    COALESCE(jual_polos.total_jual, 0) AS total_jual_polos,
    COALESCE(produksi.total_produksi, 0) AS total_produksi,
    -- STOK TERSEDIA: Total Masuk - Total Semua Pesanan (Sablon + Polos)
    (COALESCE(beli.total_beli, 0) - COALESCE(jual_semua.total_jual, 0)) AS calculated_tersedia,
    -- STOK FISIK: Total Masuk - Total Pesanan Polos - Total Sablon yang sudah diproses
    (COALESCE(beli.total_beli, 0) - COALESCE(jual_polos.total_jual, 0) - COALESCE(produksi.total_produksi, 0)) AS calculated_fisik
FROM 
    products p
LEFT JOIN (
    SELECT product_code, SUM(qty) as total_beli 
    FROM purchase_items 
    GROUP BY product_code
) beli ON p.product_code = beli.product_code
LEFT JOIN (
    -- Total semua pesanan tanpa terkecuali
    SELECT product_code, SUM(qty) as total_jual 
    FROM sales_items 
    GROUP BY product_code
) jual_semua ON p.product_code = jual_semua.product_code
LEFT JOIN (
    -- Total pesanan selain SABLON
    SELECT product_code, SUM(qty) as total_jual 
    FROM sales_items 
    WHERE order_type IS NULL OR order_type != 'SABLON'
    GROUP BY product_code
) jual_polos ON p.product_code = jual_polos.product_code
LEFT JOIN (
    -- Total produksi sablon yang sudah dikerjakan
    SELECT si.product_code, SUM(pl.qty_processed + COALESCE(pl.qty_defect, 0)) as total_produksi
    FROM production_logs pl
    JOIN sales_items si ON pl.job_id = si.id
    GROUP BY si.product_code
) produksi ON p.product_code = produksi.product_code;

-- 3. Update data yang ada saat ini
UPDATE products p
SET 
    stock_qty = sc.calculated_tersedia,
    physical_stock = sc.calculated_fisik
FROM stock_calculation_v2 sc 
WHERE p.product_code = sc.product_code;
-- 33_add_is_active_products.sql
-- HARAP JALANKAN DI SUPABASE SQL EDITOR

-- 1. Tambah kolom is_active ke tabel products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Non-aktifkan kategori CUP_HOOK dan Unknown Product (opsional, sebagai contoh pembersihan)
UPDATE public.products SET is_active = FALSE WHERE category = 'CUP_HOOK';
UPDATE public.products SET is_active = FALSE WHERE name ILIKE 'Unknown Product%';
-- 34_cleanup_addons.sql
-- Menghapus semua produk dengan kategori 'ADDON' karena kita sekarang langsung menggunakan produk master

-- 1. Hapus transaksi penjualan yang mungkin terkait dengan ADDON ini (jika baru dicoba-coba)
-- (Dilewati agar aman, kita asumsikan belum ada yang terjual)

-- 2. Hapus dari product_units (jika ada)
DELETE FROM public.product_units WHERE product_code IN (SELECT product_code FROM public.products WHERE category = 'ADDON');

-- 3. Hapus produk dari master produk
DELETE FROM public.products WHERE category = 'ADDON';

-- JIKA GAGAL DIHAPUS KARENA SUDAH ADA TRANSAKSI, MAKA KITA NON-AKTIFKAN SAJA:
UPDATE public.products SET is_active = FALSE WHERE category = 'ADDON';


-- ==============================================================================
-- ?? PENGATURAN AWAL UNTUK TOKO BARU (SILAKAN UBAH SEBELUM DI-RUN DI SUPABASE)
-- ==============================================================================

-- 1. PENGATURAN WORKSHOP / GUDANG
-- Silakan ganti 'GUDANG_A' menjadi kode gudang/toko baru Anda
INSERT INTO workshops (code, name, address, is_active) VALUES 
('GUDANG_A', 'Gudang Utama Toko Baru', 'Alamat Toko Baru', true),
('GLOBAL', 'Produk Global (Addon/Tinta)', '-', true)
ON CONFLICT (code) DO NOTHING;

-- 2. PENGATURAN REKENING / METODE PEMBAYARAN
-- Silakan sesuaikan nama bank / e-wallet toko baru Anda
INSERT INTO financial_accounts (code, name, type, balance) VALUES
('CASH', 'Kas Tunai Toko', 'CASH', 0),
('BCA', 'BCA Owner', 'BANK', 0),
('MANDIRI', 'Mandiri Toko', 'BANK', 0),
('SHOPEEPAY', 'ShopeePay', 'EWALLET', 0)
ON CONFLICT (code) DO NOTHING;

-- Catatan:
-- Untuk Akun Kasir, silakan buat langsung dari menu Authentication -> Users di Supabase,
-- lalu masukkan profilnya di tabel 'users' jika diperlukan (atau biarkan trigger berjalan otomatis jika ada).

