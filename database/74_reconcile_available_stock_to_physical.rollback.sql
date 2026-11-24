-- Roll back database/74_reconcile_available_stock_to_physical.sql through
-- compensating stock_mutations. This preserves the original audit trail.

BEGIN;

WITH originals AS (
    SELECT id, product_code, qty_tersedia_change
    FROM public.stock_mutations
    WHERE mutation_type = 'OPNAME'
      AND reference_number LIKE 'KSC-AVAILABLE-RECON-20261124:%'
      AND notes LIKE 'Rekonsiliasi stok tersedia sesuai hasil opname;%'
), inserted AS (
    INSERT INTO public.stock_mutations (
        product_code,
        mutation_type,
        reference_id,
        reference_number,
        qty_tersedia_change,
        qty_fisik_change,
        notes
    )
    SELECT
        o.product_code,
        'OPNAME',
        o.id,
        'KSC-AVAILABLE-RECON-20261124:ROLLBACK:' || o.product_code,
        -o.qty_tersedia_change,
        0,
        FORMAT('Rollback rekonsiliasi stok tersedia; mutation sumber=%s', o.id)
    FROM originals o
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.stock_mutations existing
        WHERE existing.reference_id = o.id
          AND existing.reference_number = 'KSC-AVAILABLE-RECON-20261124:ROLLBACK:' || o.product_code
    )
    RETURNING product_code, qty_tersedia_change, qty_fisik_change, notes
)
SELECT * FROM inserted ORDER BY product_code;

COMMIT;
