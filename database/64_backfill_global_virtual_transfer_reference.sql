-- Tag KING virtual outflows paired with GLOBAL inflows so users can find
-- the transfer through the reference filter. This changes labels only.
BEGIN;

CREATE TEMP TABLE _codex64_global_transfer_references ON COMMIT DROP AS
SELECT
  k.id AS king_transaction_id,
  k.so_id,
  k.amount_out,
  k.description,
  global_pair.match_count AS global_match_count,
  global_pair.transaction_id AS global_transaction_id,
  gudang_pair.match_count AS gudang_match_count
FROM transactions k
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS match_count,
         (ARRAY_AGG(g.id ORDER BY g.created_at, g.id))[1] AS transaction_id
  FROM transactions g
  WHERE g.so_id = k.so_id
    AND g.payment_method = 'Virtual'
    AND g.workshop_code = 'GLOBAL'
    AND COALESCE(g.amount_in, 0) > 0
    AND ABS(g.amount_in - k.amount_out) <= 0.02
    AND g.description = k.description
) global_pair ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS match_count
  FROM transactions w
  WHERE w.so_id = k.so_id
    AND w.payment_method = 'Virtual'
    AND w.workshop_code = 'GUDANG'
    AND COALESCE(w.amount_in, 0) > 0
    AND ABS(w.amount_in - k.amount_out) <= 0.02
    AND w.description = k.description
) gudang_pair ON TRUE
WHERE k.so_id IS NOT NULL
  AND k.payment_method = 'Virtual'
  AND k.workshop_code = 'KING'
  AND COALESCE(k.amount_out, 0) > 0
  AND k.reference IS NULL
  AND global_pair.match_count > 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM _codex64_global_transfer_references
    WHERE global_match_count <> 1 OR gudang_match_count > 0
  ) THEN
    RAISE EXCEPTION 'A KING virtual outflow has an ambiguous GLOBAL pair; no references were changed';
  END IF;
END $$;

UPDATE transactions k
SET reference = 'BAYAR KE GLOBAL'
FROM _codex64_global_transfer_references c
WHERE k.id = c.king_transaction_id
  AND k.reference IS NULL;

SELECT COUNT(*) AS KING_GLOBAL_REFERENCES_ADDED,
       ROUND(SUM(amount_out)::numeric, 2) AS REFERENCED_VIRTUAL_OUTFLOW_TOTAL
FROM _codex64_global_transfer_references;

COMMIT;
