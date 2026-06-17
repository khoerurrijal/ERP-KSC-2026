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
