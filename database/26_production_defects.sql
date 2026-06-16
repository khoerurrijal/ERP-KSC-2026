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
