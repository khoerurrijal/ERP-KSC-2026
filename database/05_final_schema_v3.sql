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
