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
