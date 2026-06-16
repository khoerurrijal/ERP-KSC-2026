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
