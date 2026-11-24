-- 73_inventory_pipeline_current_balances.sql
-- Show current mutation-maintained stock balances and active stock order stages.
-- This view does not change stock balances or reconcile historical mutations.

CREATE OR REPLACE VIEW public.product_pipeline_view AS
SELECT
    p.product_code,
    p.name AS product_name,
    p.category,
    COALESCE(p.physical_stock, 0)::BIGINT AS fisik,
    COALESCE(p.stock_qty, 0)::BIGINT AS tersedia,
    COALESCE(SUM(CASE WHEN si.status IN ('DRAFT', 'BARU MASUK') THEN si.qty ELSE 0 END), 0) AS qty_booking,
    COALESCE(SUM(CASE WHEN si.status = 'PROSES' THEN si.qty ELSE 0 END), 0) AS qty_proses,
    COALESCE(SUM(CASE WHEN si.status = 'SUDAH JADI' THEN si.qty ELSE 0 END), 0) AS qty_siap,
    COALESCE(SUM(CASE WHEN si.status IN ('DIKIRIM', 'TERKIRIM', 'SUDAH DIAMBIL') THEN si.qty ELSE 0 END), 0) AS qty_selesai
FROM public.products p
LEFT JOIN public.sales_items si
    ON p.product_code = si.product_code
    AND UPPER(TRIM(COALESCE(si.order_type, 'POLOS'))) IN ('POLOS', 'SABLON')
    AND UPPER(TRIM(COALESCE(p.category, ''))) NOT IN ('JASA', 'JASA LAYANAN')
    AND UPPER(TRIM(COALESCE(si.status, ''))) <> 'BATAL'
GROUP BY p.product_code, p.name, p.category, p.physical_stock, p.stock_qty;

GRANT SELECT ON public.product_pipeline_view TO anon, authenticated;
