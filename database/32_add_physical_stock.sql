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
