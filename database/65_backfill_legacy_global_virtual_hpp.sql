-- Backfill legacy, paid, non-marketplace sales orders that have a GLOBAL HPP
-- snapshot but no linked virtual pair. Snapshot amounts are not changed.
-- Rollback: delete only the inserted GLOBAL/KING rows using the exact SO id,
-- date, amount, description, payment method, workshop, and reference created here.

BEGIN;

CREATE TEMP TABLE _codex65_legacy_global_orders ON COMMIT DROP AS
WITH item_totals AS (
  SELECT
    so_id,
    SUM(COALESCE(beli_global, 0)) AS global_hpp,
    SUM(COALESCE(royalty_fee, 0)) AS royalty
  FROM sales_items
  GROUP BY so_id
), global_descriptions AS (
  SELECT
    q.so_id,
    STRING_AGG(
      FORMAT('%s x %s %s', q.product_name, TRIM(TO_CHAR(q.qty, 'FM9999999990.###')), q.unit),
      ', ' ORDER BY q.product_name, q.unit
    ) AS description
  FROM (
    SELECT
      si.so_id,
      COALESCE(p.name, si.product_code) AS product_name,
      COALESCE(NULLIF(TRIM(si.unit), ''), 'PCS') AS unit,
      SUM(COALESCE(si.qty, 0)) AS qty
    FROM sales_items si
    LEFT JOIN products p ON p.product_code = si.product_code
    WHERE COALESCE(si.beli_global, 0) > 0
       OR COALESCE(si.royalty_fee, 0) > 0
    GROUP BY si.so_id, COALESCE(p.name, si.product_code), COALESCE(NULLIF(TRIM(si.unit), ''), 'PCS')
  ) q
  GROUP BY q.so_id
), eligible AS (
  SELECT
    so.id AS so_id,
    so.invoice_number,
    so.date AS order_date,
    it.global_hpp + it.royalty AS expected_amount,
    COALESCE(d.description, 'Produk') AS description
  FROM sales_orders so
  JOIN item_totals it ON it.so_id = so.id
  LEFT JOIN global_descriptions d ON d.so_id = so.id
  WHERE so.is_legacy_import = TRUE
    AND so.payment_status = 'LUNAS'
    AND so.marketplace_receipt IS NULL
    AND it.global_hpp + it.royalty > 0
), global_rows AS (
  SELECT
    so_id,
    COUNT(*) AS row_count,
    SUM(amount_in) AS amount,
    (ARRAY_AGG(description ORDER BY created_at, id))[1] AS description
  FROM transactions
  WHERE payment_method = 'Virtual'
    AND workshop_code = 'GLOBAL'
    AND COALESCE(amount_in, 0) > 0
    AND so_id IS NOT NULL
  GROUP BY so_id
), king_global_rows AS (
  SELECT
    t.so_id,
    COUNT(*) FILTER (WHERE t.reference = 'BAYAR KE GLOBAL') AS reference_row_count,
    COUNT(*) FILTER (WHERE COALESCE(t.amount_out, 0) > 0 AND t.description = e.description) AS matching_row_count,
    SUM(CASE WHEN COALESCE(t.amount_out, 0) > 0 AND t.description = e.description THEN t.amount_out ELSE 0 END) AS matching_amount,
    (ARRAY_AGG(t.id ORDER BY t.created_at, t.id) FILTER (WHERE COALESCE(t.amount_out, 0) > 0 AND t.description = e.description))[1] AS matching_transaction_id
  FROM transactions t
  JOIN eligible e ON e.so_id = t.so_id
  WHERE t.payment_method = 'Virtual'
    AND t.workshop_code = 'KING'
    AND t.so_id IS NOT NULL
  GROUP BY t.so_id
)
SELECT
  e.*,
  COALESCE(g.row_count, 0) AS global_row_count,
  COALESCE(g.amount, 0) AS global_amount,
  g.description AS global_description,
  COALESCE(k.reference_row_count, 0) AS king_global_reference_row_count,
  COALESCE(k.matching_row_count, 0) AS king_matching_row_count,
  COALESCE(k.matching_amount, 0) AS king_matching_amount,
  k.matching_transaction_id AS existing_king_transaction_id
FROM eligible e
LEFT JOIN global_rows g ON g.so_id = e.so_id
LEFT JOIN king_global_rows k ON k.so_id = e.so_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _codex65_legacy_global_orders
    WHERE (global_row_count = 0 AND (king_global_reference_row_count > 0 OR king_matching_row_count > 0))
       OR (global_row_count > 0 AND (
            global_row_count <> 1
            OR ABS(global_amount - expected_amount) > 0.02
            OR global_description IS DISTINCT FROM description
            OR king_matching_row_count <> 1
            OR ABS(king_matching_amount - expected_amount) > 0.02
          ))
       OR (global_row_count = 0 AND king_matching_row_count <> 0)
  ) THEN
    RAISE EXCEPTION 'Legacy GLOBAL order has a partial or mismatched virtual pair; no rows were inserted';
  END IF;
END $$;

CREATE TEMP TABLE _codex65_orders_to_insert ON COMMIT DROP AS
SELECT so_id, invoice_number, order_date, expected_amount, description
FROM _codex65_legacy_global_orders
WHERE global_row_count = 0
  AND king_global_reference_row_count = 0
  AND king_matching_row_count = 0;

INSERT INTO transactions (date, reference, description, payment_method, amount_in, workshop_code, so_id)
SELECT order_date, NULL, description, 'Virtual', expected_amount, 'GLOBAL', so_id
FROM _codex65_orders_to_insert;

INSERT INTO transactions (date, reference, description, payment_method, amount_out, workshop_code, so_id)
SELECT order_date, 'BAYAR KE GLOBAL', description, 'Virtual', expected_amount, 'KING', so_id
FROM _codex65_orders_to_insert;

-- Ensure the pairs inserted by this migration are complete and balanced.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _codex65_orders_to_insert e
    WHERE (SELECT COUNT(*) FROM transactions t
           WHERE t.so_id = e.so_id AND t.payment_method = 'Virtual'
             AND t.workshop_code = 'GLOBAL' AND ABS(COALESCE(t.amount_in, 0) - e.expected_amount) <= 0.02
             AND t.description = e.description) <> 1
       OR (SELECT COUNT(*) FROM transactions t
           WHERE t.so_id = e.so_id AND t.payment_method = 'Virtual'
             AND t.workshop_code = 'KING' AND t.reference = 'BAYAR KE GLOBAL'
             AND ABS(COALESCE(t.amount_out, 0) - e.expected_amount) <= 0.02
             AND t.description = e.description) <> 1
  ) THEN
    RAISE EXCEPTION 'Inserted GLOBAL/KING pairs failed validation';
  END IF;
END $$;

-- Normalize the reference on the three previously complete legacy pairs, if needed.
UPDATE transactions t
SET reference = 'BAYAR KE GLOBAL'
FROM _codex65_legacy_global_orders e
WHERE e.global_row_count = 1
  AND t.id = e.existing_king_transaction_id
  AND t.reference IS DISTINCT FROM 'BAYAR KE GLOBAL';

SELECT
  (SELECT COUNT(*) FROM _codex65_orders_to_insert) AS legacy_orders_backfilled,
  (SELECT ROUND(SUM(expected_amount)::numeric, 2) FROM _codex65_orders_to_insert) AS global_in_added,
  (SELECT ROUND(SUM(expected_amount)::numeric, 2) FROM _codex65_orders_to_insert) AS king_out_added,
  (SELECT COUNT(*) FROM _codex65_legacy_global_orders WHERE global_row_count = 1) AS existing_pairs_kept;

COMMIT;
