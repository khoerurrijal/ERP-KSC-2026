-- Keep virtual HPP descriptions limited to product names and quantities.
-- This changes transaction descriptions only; amounts, dates, references, and stock are untouched.
BEGIN;

WITH linked_targets AS (
  SELECT
    transaction.id,
    transaction.so_id,
    CASE
      WHEN transaction.workshop_code = 'GUDANG'
        AND (transaction.description LIKE 'GUDANG:%'
          OR transaction.description LIKE 'Alokasi HPP Cup/Barang Gudang%')
        THEN 'GUDANG'
      WHEN transaction.workshop_code = 'KING'
        AND (transaction.description LIKE 'KING KE GUDANG:%'
          OR transaction.description LIKE 'Potongan HPP untuk Gudang%')
        THEN 'GUDANG'
      WHEN transaction.workshop_code = 'GLOBAL'
        AND (transaction.description LIKE 'GLOBAL:%'
          OR transaction.description LIKE 'Alokasi HPP Bahan & Royalty%')
        THEN 'GLOBAL'
      WHEN transaction.workshop_code = 'KING'
        AND (transaction.description LIKE 'KING KE GLOBAL:%'
          OR transaction.description LIKE 'Potongan HPP/Royalty untuk Global%')
        THEN 'GLOBAL'
    END AS source
  FROM transactions AS transaction
  WHERE transaction.payment_method = 'Virtual'
    AND transaction.so_id IS NOT NULL
    AND (
      (transaction.workshop_code = 'GUDANG'
        AND (transaction.description LIKE 'GUDANG:%'
          OR transaction.description LIKE 'Alokasi HPP Cup/Barang Gudang%'))
      OR (transaction.workshop_code = 'KING'
        AND (transaction.description LIKE 'KING KE GUDANG:%'
          OR transaction.description LIKE 'Potongan HPP untuk Gudang%'
          OR transaction.description LIKE 'KING KE GLOBAL:%'
          OR transaction.description LIKE 'Potongan HPP/Royalty untuk Global%'))
      OR (transaction.workshop_code = 'GLOBAL'
        AND (transaction.description LIKE 'GLOBAL:%'
          OR transaction.description LIKE 'Alokasi HPP Bahan & Royalty%'))
    )
), linked_items AS (
  SELECT
    target.id AS transaction_id,
    COALESCE(NULLIF(BTRIM(product.name), ''), NULLIF(BTRIM(item.product_code), ''), 'Produk') AS product_name,
    COALESCE(NULLIF(BTRIM(item.unit), ''), 'PCS') AS unit,
    SUM(item.qty)::numeric AS quantity
  FROM linked_targets AS target
  JOIN sales_items AS item ON item.so_id = target.so_id
  LEFT JOIN products AS product ON product.product_code = item.product_code
  WHERE (target.source = 'GUDANG' AND COALESCE(item.beli_gudang, 0) > 0)
     OR (target.source = 'GLOBAL'
       AND (COALESCE(item.beli_global, 0) > 0 OR COALESCE(item.royalty_fee, 0) > 0))
  GROUP BY
    target.id,
    COALESCE(NULLIF(BTRIM(product.name), ''), NULLIF(BTRIM(item.product_code), ''), 'Produk'),
    COALESCE(NULLIF(BTRIM(item.unit), ''), 'PCS')
), linked_summaries AS (
  SELECT
    item.transaction_id,
    STRING_AGG(
      item.product_name || ' x ' || TRIM_SCALE(item.quantity)::text || ' ' || item.unit,
      ', ' ORDER BY item.product_name, item.unit
    ) AS next_description
  FROM linked_items AS item
  GROUP BY item.transaction_id
), linked_updated AS (
  UPDATE transactions AS transaction
  SET description = summary.next_description
  FROM linked_summaries AS summary
  WHERE transaction.id = summary.transaction_id
    AND transaction.description IS DISTINCT FROM summary.next_description
  RETURNING transaction.id
)
SELECT 'linked_sales_rows' AS category, COUNT(*) AS updated_rows FROM linked_updated;

WITH batch_targets AS (
  SELECT
    transaction.id,
    transaction.date,
    transaction.created_at,
    transaction.workshop_code,
    CASE
      WHEN transaction.description LIKE 'Alokasi HPP Cup/Barang Gudang%'
        OR transaction.description LIKE 'Potongan HPP untuk Gudang%'
        THEN 'GUDANG'
      WHEN transaction.description LIKE 'Alokasi HPP Bahan & Royalty%'
        OR transaction.description LIKE 'Potongan HPP/Royalty untuk Global%'
        THEN 'GLOBAL'
    END AS source,
    CASE WHEN COALESCE(transaction.amount_in, 0) > 0
      THEN transaction.amount_in::numeric
      ELSE COALESCE(transaction.amount_out, 0)::numeric
    END AS amount,
    SUBSTRING(transaction.description FROM '([0-9]+) Pesanan$')::integer AS expected_orders
  FROM transactions AS transaction
  WHERE transaction.payment_method = 'Virtual'
    AND transaction.so_id IS NULL
    AND transaction.description LIKE '%(Marketplace) - % Pesanan'
), settlement_rows AS (
  SELECT
    transaction.id,
    transaction.date,
    transaction.created_at,
    SUBSTRING(transaction.description FROM POSITION(' - INV-' IN transaction.description) + 3) AS invoice_list
  FROM transactions AS transaction
  WHERE transaction.reference = 'PENJUALAN'
    AND transaction.description LIKE 'Pencairan % - INV-%'
), batch_invoices AS (
  SELECT
    settlement.id AS settlement_id,
    settlement.date,
    settlement.created_at,
    BTRIM(invoice.invoice_number) AS invoice_number
  FROM settlement_rows AS settlement
  CROSS JOIN LATERAL REGEXP_SPLIT_TO_TABLE(settlement.invoice_list, ',\s*') AS invoice(invoice_number)
), batch_totals AS (
  SELECT
    invoice.settlement_id,
    invoice.date,
    invoice.created_at,
    COUNT(DISTINCT invoice.invoice_number) AS invoice_count,
    COUNT(DISTINCT sales_order.id) AS order_count,
    COALESCE(SUM(COALESCE(item.beli_gudang, 0)), 0)::numeric AS gudang_amount,
    COALESCE(SUM(COALESCE(item.beli_global, 0) + COALESCE(item.royalty_fee, 0)), 0)::numeric AS global_amount
  FROM batch_invoices AS invoice
  LEFT JOIN sales_orders AS sales_order ON sales_order.invoice_number = invoice.invoice_number
  LEFT JOIN sales_items AS item ON item.so_id = sales_order.id
  GROUP BY invoice.settlement_id, invoice.date, invoice.created_at
), batch_matches AS (
  SELECT
    target.id AS transaction_id,
    target.source,
    batch.settlement_id
  FROM batch_targets AS target
  JOIN batch_totals AS batch
    ON batch.date = target.date
   AND batch.created_at <= target.created_at
   AND target.created_at < batch.created_at + INTERVAL '30 seconds'
   AND batch.invoice_count = target.expected_orders
   AND batch.order_count = target.expected_orders
   AND ABS(ROUND(
     CASE WHEN target.source = 'GUDANG' THEN batch.gudang_amount ELSE batch.global_amount END,
     2
   ) - ROUND(target.amount, 2)) < 0.01
), unique_batch_matches AS (
  SELECT
    match.transaction_id,
    match.source,
    MIN(match.settlement_id::text)::uuid AS settlement_id
  FROM batch_matches AS match
  GROUP BY match.transaction_id, match.source
  HAVING COUNT(DISTINCT match.settlement_id) = 1
), batch_items AS (
  SELECT
    match.transaction_id,
    COALESCE(NULLIF(BTRIM(product.name), ''), NULLIF(BTRIM(item.product_code), ''), 'Produk') AS product_name,
    COALESCE(NULLIF(BTRIM(item.unit), ''), 'PCS') AS unit,
    SUM(item.qty)::numeric AS quantity
  FROM unique_batch_matches AS match
  JOIN batch_invoices AS invoice ON invoice.settlement_id = match.settlement_id
  JOIN sales_orders AS sales_order ON sales_order.invoice_number = invoice.invoice_number
  JOIN sales_items AS item ON item.so_id = sales_order.id
  LEFT JOIN products AS product ON product.product_code = item.product_code
  WHERE (match.source = 'GUDANG' AND COALESCE(item.beli_gudang, 0) > 0)
     OR (match.source = 'GLOBAL'
       AND (COALESCE(item.beli_global, 0) > 0 OR COALESCE(item.royalty_fee, 0) > 0))
  GROUP BY
    match.transaction_id,
    COALESCE(NULLIF(BTRIM(product.name), ''), NULLIF(BTRIM(item.product_code), ''), 'Produk'),
    COALESCE(NULLIF(BTRIM(item.unit), ''), 'PCS')
), batch_summaries AS (
  SELECT
    item.transaction_id,
    STRING_AGG(
      item.product_name || ' x ' || TRIM_SCALE(item.quantity)::text || ' ' || item.unit,
      ', ' ORDER BY item.product_name, item.unit
    ) AS next_description
  FROM batch_items AS item
  GROUP BY item.transaction_id
), batch_updated AS (
  UPDATE transactions AS transaction
  SET description = summary.next_description
  FROM batch_summaries AS summary
  WHERE transaction.id = summary.transaction_id
    AND transaction.description IS DISTINCT FROM summary.next_description
  RETURNING transaction.id
)
SELECT 'marketplace_batch_rows' AS category, COUNT(*) AS updated_rows FROM batch_updated;

SELECT
  COUNT(*) FILTER (WHERE so_id IS NOT NULL AND (
    description LIKE 'GUDANG:%' OR description LIKE 'KING KE GUDANG:%'
    OR description LIKE 'GLOBAL:%' OR description LIKE 'KING KE GLOBAL:%'
    OR description LIKE 'Alokasi HPP Cup/Barang Gudang%'
    OR description LIKE 'Potongan HPP untuk Gudang%'
    OR description LIKE 'Alokasi HPP Bahan & Royalty%'
    OR description LIKE 'Potongan HPP/Royalty untuk Global%'
  )) AS remaining_linked_labeled_rows,
  COUNT(*) FILTER (WHERE so_id IS NULL AND description LIKE '%(Marketplace) - % Pesanan')
    AS remaining_marketplace_batch_rows
FROM transactions
WHERE payment_method = 'Virtual';

COMMIT;

-- To roll back immediately: prepend BEGIN; then restore source labels to linked rows
-- from workshop_code/reference, and restore the marketplace suffix from the mapped
-- settlement invoice count; COMMIT after validating the affected row counts.
