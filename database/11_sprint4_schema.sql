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
