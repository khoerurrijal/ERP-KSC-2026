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

