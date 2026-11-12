-- Reclassify historical STG106 snapshots to GLOBAL and repair royalty postings
-- skipped by the payment-status transition path. All changes are attribution
-- transfers: product HPP totals are preserved and every virtual movement stays paired.
-- Rollback plan: before editing the affected sales orders, reverse the exact deltas
-- captured by the pre-apply audit: restore STG106 beli_gudang from beli_global,
-- reverse the same amount between GUDANG/GLOBAL virtual rows, then subtract the
-- royalty delta from its matching GLOBAL/KING pair. This script does not delete rows.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM products
    WHERE product_code = 'STG106' AND workshop_code = 'GLOBAL'
  ) THEN
    RAISE EXCEPTION 'STG106 must be configured as GLOBAL before this reclassification';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sales_items si
    JOIN sales_orders so ON so.id = si.so_id
    WHERE si.product_code = 'STG106'
      AND COALESCE(si.beli_gudang, 0) > 0
      AND so.marketplace_receipt IS NOT NULL
      AND so.marketplace_settlement_status IS DISTINCT FROM 'PENDING'
  ) THEN
    RAISE EXCEPTION 'A STG106 marketplace order is already settled; audit its batch before changing snapshots';
  END IF;
END $$;

CREATE TEMP TABLE _codex63_stg106_reclass ON COMMIT DROP AS
WITH item_totals AS (
  SELECT
    so_id,
    SUM(COALESCE(beli_gudang, 0)) AS gudang_snapshot,
    SUM(COALESCE(beli_global, 0)) AS global_snapshot
  FROM sales_items
  GROUP BY so_id
), global_tx AS (
  SELECT so_id,
    SUM(CASE WHEN payment_method = 'Virtual' AND workshop_code = 'GLOBAL' AND COALESCE(amount_in, 0) > 0 THEN amount_in ELSE 0 END) AS global_in
  FROM transactions
  WHERE so_id IS NOT NULL
  GROUP BY so_id
), moves AS (
  SELECT
    so.id AS so_id,
    so.invoice_number,
    so.date AS order_date,
    so.payment_status,
    so.marketplace_receipt,
    so.marketplace_settlement_status,
    SUM(COALESCE(si.beli_gudang, 0)) AS move_amount
  FROM sales_items si
  JOIN sales_orders so ON so.id = si.so_id
  JOIN products p ON p.product_code = si.product_code
  WHERE si.product_code = 'STG106'
    AND p.workshop_code = 'GLOBAL'
    AND COALESCE(si.beli_gudang, 0) > 0
  GROUP BY so.id
)
SELECT
  m.*,
  COALESCE(it.gudang_snapshot, 0) AS gudang_snapshot,
  COALESCE(it.global_snapshot, 0) AS global_snapshot,
  COALESCE(gt.global_in, 0) AS global_in_before,
  gudang_in.match_count AS gudang_in_match_count,
  gudang_in.transaction_id AS gudang_in_id,
  king_gudang.match_count AS king_gudang_match_count,
  king_gudang.transaction_id AS king_gudang_id,
  global_in.match_count AS global_in_match_count,
  global_in.transaction_id AS global_in_id,
  king_global.match_count AS king_global_match_count,
  king_global.transaction_id AS king_global_id
FROM moves m
LEFT JOIN item_totals it ON it.so_id = m.so_id
LEFT JOIN global_tx gt ON gt.so_id = m.so_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS match_count, (ARRAY_AGG(t.id ORDER BY t.created_at, t.id))[1] AS transaction_id
  FROM transactions t
  WHERE t.so_id = m.so_id
    AND t.payment_method = 'Virtual'
    AND t.workshop_code = 'GUDANG'
    AND COALESCE(t.amount_in, 0) > 0
    AND ABS(t.amount_in - COALESCE(it.gudang_snapshot, 0)) <= 0.02
) gudang_in ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS match_count, (ARRAY_AGG(t.id ORDER BY t.created_at, t.id))[1] AS transaction_id
  FROM transactions t
  WHERE t.so_id = m.so_id
    AND t.payment_method = 'Virtual'
    AND t.workshop_code = 'KING'
    AND COALESCE(t.amount_out, 0) > 0
    AND ABS(t.amount_out - COALESCE(it.gudang_snapshot, 0)) <= 0.02
) king_gudang ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS match_count, (ARRAY_AGG(t.id ORDER BY t.created_at, t.id))[1] AS transaction_id
  FROM transactions t
  WHERE t.so_id = m.so_id
    AND t.payment_method = 'Virtual'
    AND t.workshop_code = 'GLOBAL'
    AND COALESCE(t.amount_in, 0) > 0
    AND ABS(t.amount_in - COALESCE(gt.global_in, 0)) <= 0.02
) global_in ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS match_count, (ARRAY_AGG(t.id ORDER BY t.created_at, t.id))[1] AS transaction_id
  FROM transactions t
  WHERE t.so_id = m.so_id
    AND t.payment_method = 'Virtual'
    AND t.workshop_code = 'KING'
    AND COALESCE(t.amount_out, 0) > 0
    AND COALESCE(gt.global_in, 0) > 0
    AND ABS(t.amount_out - COALESCE(gt.global_in, 0)) <= 0.02
) king_global ON TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM _codex63_stg106_reclass
    WHERE marketplace_receipt IS NOT NULL
      AND marketplace_settlement_status IS DISTINCT FROM 'PENDING'
  ) THEN
    RAISE EXCEPTION 'STG106 marketplace settlement is not pending';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _codex63_stg106_reclass
    WHERE payment_status = 'LUNAS'
      AND marketplace_receipt IS NULL
      AND (
        gudang_in_match_count <> 1
        OR king_gudang_match_count <> 1
        OR gudang_snapshot < move_amount
        OR (global_in_before > 0 AND (global_in_match_count <> 1 OR king_global_match_count <> 1))
        OR (global_in_before = 0 AND (global_in_match_count <> 0 OR king_global_match_count <> 0))
      )
  ) THEN
    RAISE EXCEPTION 'A completed STG106 order does not have a unique matching virtual pair';
  END IF;
END $$;

-- Preserve each line's combined HPP while assigning STG106 to GLOBAL.
UPDATE sales_items si
SET beli_global = COALESCE(si.beli_global, 0) + COALESCE(si.beli_gudang, 0),
    beli_gudang = 0
FROM products p
WHERE p.product_code = si.product_code
  AND si.product_code = 'STG106'
  AND p.workshop_code = 'GLOBAL'
  AND COALESCE(si.beli_gudang, 0) > 0;

-- Move closed, non-marketplace order balances from GUDANG to GLOBAL.
UPDATE transactions t
SET amount_in = t.amount_in - r.move_amount
FROM _codex63_stg106_reclass r
WHERE r.payment_status = 'LUNAS'
  AND r.marketplace_receipt IS NULL
  AND t.id = r.gudang_in_id;

UPDATE transactions t
SET amount_out = t.amount_out - r.move_amount
FROM _codex63_stg106_reclass r
WHERE r.payment_status = 'LUNAS'
  AND r.marketplace_receipt IS NULL
  AND t.id = r.king_gudang_id;

UPDATE transactions t
SET amount_in = t.amount_in + r.move_amount
FROM _codex63_stg106_reclass r
WHERE r.payment_status = 'LUNAS'
  AND r.marketplace_receipt IS NULL
  AND r.global_in_id IS NOT NULL
  AND t.id = r.global_in_id;

UPDATE transactions t
SET amount_out = t.amount_out + r.move_amount
FROM _codex63_stg106_reclass r
WHERE r.payment_status = 'LUNAS'
  AND r.marketplace_receipt IS NULL
  AND r.king_global_id IS NOT NULL
  AND t.id = r.king_global_id;

CREATE TEMP TABLE _codex63_added_global_pairs ON COMMIT DROP AS
SELECT so_id, NULL::uuid AS global_tx_id, NULL::uuid AS king_tx_id
FROM _codex63_stg106_reclass
WHERE FALSE;

WITH added_global AS (
  INSERT INTO transactions (date, reference, description, payment_method, amount_in, workshop_code, so_id)
  SELECT r.order_date, NULL, 'Produk', 'Virtual', r.move_amount, 'GLOBAL', r.so_id
  FROM _codex63_stg106_reclass r
  WHERE r.payment_status = 'LUNAS'
    AND r.marketplace_receipt IS NULL
    AND r.global_in_id IS NULL
  RETURNING id, so_id
), added_king AS (
  INSERT INTO transactions (date, reference, description, payment_method, amount_out, workshop_code, so_id)
  SELECT r.order_date, NULL, 'Produk', 'Virtual', r.move_amount, 'KING', r.so_id
  FROM _codex63_stg106_reclass r
  JOIN added_global g ON g.so_id = r.so_id
  RETURNING id, so_id
)
INSERT INTO _codex63_added_global_pairs (so_id, global_tx_id, king_tx_id)
SELECT g.so_id, g.id, k.id
FROM added_global g
JOIN added_king k ON k.so_id = g.so_id;

-- Find only completed orders whose missing GLOBAL amount exactly equals their royalty.
CREATE TEMP TABLE _codex63_missing_royalty ON COMMIT DROP AS
WITH item_totals AS (
  SELECT so_id,
    SUM(COALESCE(beli_global, 0)) AS global_snapshot,
    SUM(COALESCE(royalty_fee, 0)) AS royalty_total
  FROM sales_items
  GROUP BY so_id
), global_tx AS (
  SELECT so_id,
    SUM(CASE WHEN payment_method = 'Virtual' AND workshop_code = 'GLOBAL' AND COALESCE(amount_in, 0) > 0 THEN amount_in ELSE 0 END) AS global_in
  FROM transactions
  WHERE so_id IS NOT NULL
  GROUP BY so_id
)
SELECT
  so.id AS so_id,
  so.invoice_number,
  so.date AS order_date,
  it.global_snapshot,
  it.royalty_total AS missing_royalty,
  COALESCE(gt.global_in, 0) AS global_in_before,
  global_row.match_count AS global_match_count,
  global_row.transaction_id AS global_tx_id,
  king_row.match_count AS king_match_count,
  king_row.transaction_id AS king_tx_id
FROM sales_orders so
JOIN item_totals it ON it.so_id = so.id
LEFT JOIN global_tx gt ON gt.so_id = so.id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS match_count, (ARRAY_AGG(t.id ORDER BY t.created_at, t.id))[1] AS transaction_id
  FROM transactions t
  WHERE t.so_id = so.id
    AND t.payment_method = 'Virtual'
    AND t.workshop_code = 'GLOBAL'
    AND COALESCE(t.amount_in, 0) > 0
    AND ABS(t.amount_in - COALESCE(gt.global_in, 0)) <= 0.02
) global_row ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS match_count, (ARRAY_AGG(t.id ORDER BY t.created_at, t.id))[1] AS transaction_id
  FROM transactions t
  WHERE t.so_id = so.id
    AND t.payment_method = 'Virtual'
    AND t.workshop_code = 'KING'
    AND COALESCE(t.amount_out, 0) > 0
    AND COALESCE(gt.global_in, 0) > 0
    AND ABS(t.amount_out - COALESCE(gt.global_in, 0)) <= 0.02
) king_row ON TRUE
WHERE so.payment_status = 'LUNAS'
  AND so.marketplace_receipt IS NULL
  AND so.date >= DATE '2026-06-13'
  AND it.royalty_total > 0
  AND ABS(it.global_snapshot - COALESCE(gt.global_in, 0)) <= 0.02;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM _codex63_missing_royalty
    WHERE global_in_before > 0
      AND (global_match_count <> 1 OR king_match_count <> 1)
  ) THEN
    RAISE EXCEPTION 'A royalty correction does not have a unique matching GLOBAL/KING pair';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _codex63_missing_royalty
    WHERE global_in_before <= 0
  ) THEN
    RAISE EXCEPTION 'Royalty-only posting needs a separate pair review';
  END IF;
END $$;

UPDATE transactions t
SET amount_in = t.amount_in + r.missing_royalty
FROM _codex63_missing_royalty r
WHERE t.id = r.global_tx_id;

UPDATE transactions t
SET amount_out = t.amount_out + r.missing_royalty
FROM _codex63_missing_royalty r
WHERE t.id = r.king_tx_id;

CREATE TEMP TABLE _codex63_impacted_orders ON COMMIT DROP AS
SELECT so_id FROM _codex63_stg106_reclass WHERE payment_status = 'LUNAS' AND marketplace_receipt IS NULL
UNION
SELECT so_id FROM _codex63_missing_royalty;

CREATE TEMP TABLE _codex63_descriptions ON COMMIT DROP AS
WITH item_buckets AS (
  SELECT
    si.so_id,
    b.bucket,
    COALESCE(p.name, si.product_code) AS product_name,
    COALESCE(NULLIF(TRIM(si.unit), ''), 'PCS') AS unit,
    SUM(COALESCE(si.qty, 0)) AS qty
  FROM sales_items si
  JOIN _codex63_impacted_orders impacted ON impacted.so_id = si.so_id
  LEFT JOIN products p ON p.product_code = si.product_code
  CROSS JOIN LATERAL (VALUES
    ('GUDANG'::text, COALESCE(si.beli_gudang, 0) > 0),
    ('GLOBAL'::text, COALESCE(si.beli_global, 0) > 0 OR COALESCE(si.royalty_fee, 0) > 0)
  ) b(bucket, include_item)
  WHERE b.include_item
  GROUP BY si.so_id, b.bucket, COALESCE(p.name, si.product_code), COALESCE(NULLIF(TRIM(si.unit), ''), 'PCS')
), summaries AS (
  SELECT
    so_id,
    STRING_AGG(
      FORMAT('%s x %s %s', product_name, TRIM(TO_CHAR(qty, 'FM9999999990.###')), unit),
      ', ' ORDER BY product_name, unit
    ) FILTER (WHERE bucket = 'GUDANG') AS gudang_description,
    STRING_AGG(
      FORMAT('%s x %s %s', product_name, TRIM(TO_CHAR(qty, 'FM9999999990.###')), unit),
      ', ' ORDER BY product_name, unit
    ) FILTER (WHERE bucket = 'GLOBAL') AS global_description
  FROM item_buckets
  GROUP BY so_id
)
SELECT * FROM summaries;

CREATE TEMP TABLE _codex63_description_targets ON COMMIT DROP AS
SELECT gudang_in_id AS transaction_id, so_id, 'GUDANG'::text AS bucket
FROM _codex63_stg106_reclass
WHERE payment_status = 'LUNAS' AND marketplace_receipt IS NULL AND gudang_in_id IS NOT NULL
UNION
SELECT king_gudang_id, so_id, 'GUDANG'::text
FROM _codex63_stg106_reclass
WHERE payment_status = 'LUNAS' AND marketplace_receipt IS NULL AND king_gudang_id IS NOT NULL
UNION
SELECT global_in_id, so_id, 'GLOBAL'::text
FROM _codex63_stg106_reclass
WHERE payment_status = 'LUNAS' AND marketplace_receipt IS NULL AND global_in_id IS NOT NULL
UNION
SELECT king_global_id, so_id, 'GLOBAL'::text
FROM _codex63_stg106_reclass
WHERE payment_status = 'LUNAS' AND marketplace_receipt IS NULL AND king_global_id IS NOT NULL
UNION
SELECT global_tx_id, so_id, 'GLOBAL'::text FROM _codex63_added_global_pairs
UNION
SELECT king_tx_id, so_id, 'GLOBAL'::text FROM _codex63_added_global_pairs
UNION
SELECT global_tx_id, so_id, 'GLOBAL'::text FROM _codex63_missing_royalty
UNION
SELECT king_tx_id, so_id, 'GLOBAL'::text FROM _codex63_missing_royalty;

UPDATE transactions t
SET description = COALESCE(
  CASE target.bucket
    WHEN 'GUDANG' THEN d.gudang_description
    ELSE d.global_description
  END,
  'Produk'
)
FROM _codex63_description_targets target
JOIN _codex63_descriptions d ON d.so_id = target.so_id
WHERE t.id = target.transaction_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _codex63_stg106_reclass r
    WHERE r.payment_status = 'LUNAS'
      AND r.marketplace_receipt IS NULL
      AND (
        ABS((SELECT SUM(COALESCE(si.beli_gudang, 0)) FROM sales_items si WHERE si.so_id = r.so_id)
          - (SELECT SUM(COALESCE(t.amount_in, 0)) FROM transactions t WHERE t.id = r.gudang_in_id)) > 0.02
        OR ABS((SELECT SUM(COALESCE(si.beli_global, 0) + COALESCE(si.royalty_fee, 0)) FROM sales_items si WHERE si.so_id = r.so_id)
          - (SELECT SUM(COALESCE(t.amount_in, 0)) FROM transactions t WHERE t.so_id = r.so_id AND t.workshop_code = 'GLOBAL' AND t.payment_method = 'Virtual')) > 0.02
      )
  ) THEN
    RAISE EXCEPTION 'Post-reclassification GLOBAL/GUDANG balances do not match the affected order snapshots';
  END IF;
END $$;

SELECT
  (SELECT COUNT(*) FROM _codex63_stg106_reclass) AS stg106_rows_reclassified,
  (SELECT ROUND(SUM(move_amount)::numeric, 2) FROM _codex63_stg106_reclass) AS stg106_total_reclassified,
  (SELECT COUNT(*) FROM _codex63_stg106_reclass WHERE payment_status = 'LUNAS' AND marketplace_receipt IS NULL) AS completed_normal_orders_moved,
  (SELECT COUNT(*) FROM _codex63_missing_royalty) AS royalty_orders_repaired,
  (SELECT ROUND(SUM(missing_royalty)::numeric, 2) FROM _codex63_missing_royalty) AS royalty_total_repaired;

COMMIT;
