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
