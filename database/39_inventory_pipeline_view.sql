-- 39_inventory_pipeline_view.sql
-- Script untuk membuat VIEW SQL yang menampilkan "Pipa/Funnel" stok produk
-- Mengagregasi status SO yang aktif

CREATE OR REPLACE VIEW public.product_pipeline_view AS
SELECT 
    p.product_code,
    p.name AS product_name,
    p.category,
    COALESCE(sc.calculated_fisik, 0) AS fisik,
    COALESCE(sc.calculated_tersedia, 0) AS tersedia,
    COALESCE(SUM(CASE WHEN si.status IN ('DRAFT', 'BARU MASUK') THEN si.qty ELSE 0 END), 0) AS qty_booking,
    COALESCE(SUM(CASE WHEN si.status IN ('PROSES') THEN si.qty ELSE 0 END), 0) AS qty_proses,
    COALESCE(SUM(CASE WHEN si.status IN ('SUDAH JADI') THEN si.qty ELSE 0 END), 0) AS qty_siap,
    COALESCE(SUM(CASE WHEN si.status IN ('SELESAI', 'DIKIRIM', 'TERKIRIM', 'SUDAH DIAMBIL', 'STOK KELUAR') THEN si.qty ELSE 0 END), 0) AS qty_selesai
FROM 
    public.products p
LEFT JOIN public.stock_calculation_v2 sc ON p.product_code = sc.product_code
LEFT JOIN public.sales_items si ON p.product_code = si.product_code
GROUP BY 
    p.product_code, p.name, p.category, sc.calculated_fisik, sc.calculated_tersedia;

GRANT SELECT ON public.product_pipeline_view TO anon, authenticated;
