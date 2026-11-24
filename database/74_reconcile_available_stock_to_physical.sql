-- 74_reconcile_available_stock_to_physical.sql
-- Reconcile only available stock to the authoritative physical stock count,
-- keeping the unprocessed remainder of active SABLON orders reserved.
-- This data-only migration writes through stock_mutations; physical stock is unchanged.

BEGIN;

WITH produced AS (
    SELECT
        job_id,
        SUM(COALESCE(qty_processed, 0) + COALESCE(qty_defect, 0))::BIGINT AS qty_produced
    FROM public.production_logs
    GROUP BY job_id
), active_reserve AS (
    SELECT
        si.product_code,
        SUM(GREATEST(
            si.qty::BIGINT * COALESCE(si.unit_multiplier, 1) - COALESCE(pr.qty_produced, 0),
            0
        ))::BIGINT AS qty_reserved
    FROM public.sales_items si
    LEFT JOIN produced pr ON pr.job_id = si.id
    WHERE UPPER(TRIM(COALESCE(si.order_type, ''))) = 'SABLON'
      AND UPPER(TRIM(COALESCE(si.status, ''))) IN ('BARU MASUK', 'SIAP PROSES', 'PROSES')
    GROUP BY si.product_code
), targets AS (
    SELECT
        p.product_code,
        COALESCE(p.physical_stock, 0)::BIGINT AS physical_stock,
        COALESCE(p.stock_qty, 0)::BIGINT AS available_stock,
        COALESCE(ar.qty_reserved, 0)::BIGINT AS active_reserved,
        COALESCE(p.physical_stock, 0)::BIGINT - COALESCE(ar.qty_reserved, 0)::BIGINT AS target_available,
        COALESCE(p.physical_stock, 0)::BIGINT - COALESCE(ar.qty_reserved, 0)::BIGINT
            - COALESCE(p.stock_qty, 0)::BIGINT AS available_delta
    FROM public.products p
    LEFT JOIN active_reserve ar ON ar.product_code = p.product_code
    WHERE UPPER(TRIM(COALESCE(p.category, ''))) NOT IN ('JASA', 'JASA LAYANAN')
), inserted AS (
    INSERT INTO public.stock_mutations (
        product_code,
        mutation_type,
        reference_number,
        qty_tersedia_change,
        qty_fisik_change,
        notes
    )
    SELECT
        t.product_code,
        'OPNAME',
        'KSC-AVAILABLE-RECON-20261124:' || t.product_code,
        t.available_delta::INTEGER,
        0,
        FORMAT(
            'Rekonsiliasi stok tersedia sesuai hasil opname; fisik=%s, reserve SABLON aktif=%s, tersedia sebelum=%s, target=%s',
            t.physical_stock,
            t.active_reserved,
            t.available_stock,
            t.target_available
        )
    FROM targets t
    WHERE t.available_delta <> 0
      AND NOT EXISTS (
          SELECT 1
          FROM public.stock_mutations existing
          WHERE existing.mutation_type = 'OPNAME'
            AND existing.reference_number = 'KSC-AVAILABLE-RECON-20261124:' || t.product_code
      )
    RETURNING product_code, qty_tersedia_change, qty_fisik_change, notes
)
SELECT * FROM inserted ORDER BY product_code;

COMMIT;
