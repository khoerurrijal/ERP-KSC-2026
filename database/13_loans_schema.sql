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
