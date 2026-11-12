-- Backfill product and quantity descriptions for historical, sales-order-linked
-- virtual HPP transactions. Amounts, dates, workshops, and stock records are untouched.
BEGIN;

WITH source_items AS (
  SELECT
    item.so_id,
    'GUDANG'::text AS source,
    COALESCE(NULLIF(BTRIM(product.name), ''), NULLIF(BTRIM(item.product_code), ''), 'Produk') AS product_name,
    COALESCE(NULLIF(BTRIM(item.unit), ''), 'PCS') AS unit,
    SUM(item.qty)::numeric AS quantity
  FROM sales_items AS item
  LEFT JOIN products AS product ON product.product_code = item.product_code
  WHERE COALESCE(item.beli_gudang, 0) > 0
  GROUP BY
    item.so_id,
    COALESCE(NULLIF(BTRIM(product.name), ''), NULLIF(BTRIM(item.product_code), ''), 'Produk'),
    COALESCE(NULLIF(BTRIM(item.unit), ''), 'PCS')

  UNION ALL

  SELECT
    item.so_id,
    'GLOBAL'::text AS source,
    COALESCE(NULLIF(BTRIM(product.name), ''), NULLIF(BTRIM(item.product_code), ''), 'Produk') AS product_name,
    COALESCE(NULLIF(BTRIM(item.unit), ''), 'PCS') AS unit,
    SUM(item.qty)::numeric AS quantity
  FROM sales_items AS item
  LEFT JOIN products AS product ON product.product_code = item.product_code
  WHERE COALESCE(item.beli_global, 0) > 0
     OR COALESCE(item.royalty_fee, 0) > 0
  GROUP BY
    item.so_id,
    COALESCE(NULLIF(BTRIM(product.name), ''), NULLIF(BTRIM(item.product_code), ''), 'Produk'),
    COALESCE(NULLIF(BTRIM(item.unit), ''), 'PCS')
),
product_summaries AS (
  SELECT
    item.so_id,
    item.source,
    STRING_AGG(
      item.product_name || ' x ' || TRIM_SCALE(item.quantity)::text || ' ' || item.unit,
      ', ' ORDER BY item.product_name, item.unit
    ) AS product_summary
  FROM source_items AS item
  GROUP BY item.so_id, item.source
),
targets AS (
  SELECT
    transaction.id,
    CASE
      WHEN transaction.workshop_code = 'GUDANG'
        AND transaction.description LIKE 'Alokasi HPP Cup/Barang Gudang%'
        THEN 'GUDANG: ' || summary.product_summary
      WHEN transaction.workshop_code = 'KING'
        AND transaction.description LIKE 'Potongan HPP untuk Gudang%'
        THEN 'KING KE GUDANG: ' || summary.product_summary
      WHEN transaction.workshop_code = 'GLOBAL'
        AND transaction.description LIKE 'Alokasi HPP Bahan & Royalty%'
        THEN 'GLOBAL: ' || summary.product_summary
      WHEN transaction.workshop_code = 'KING'
        AND transaction.description LIKE 'Potongan HPP/Royalty untuk Global%'
        THEN 'KING KE GLOBAL: ' || summary.product_summary
    END AS next_description
  FROM transactions AS transaction
  JOIN product_summaries AS summary
    ON summary.so_id = transaction.so_id
   AND summary.source = CASE
     WHEN transaction.description LIKE 'Alokasi HPP Cup/Barang Gudang%'
       OR transaction.description LIKE 'Potongan HPP untuk Gudang%'
       THEN 'GUDANG'
     ELSE 'GLOBAL'
   END
  WHERE transaction.payment_method = 'Virtual'
    AND transaction.so_id IS NOT NULL
    AND (
      (transaction.workshop_code = 'GUDANG'
        AND transaction.amount_in > 0
        AND transaction.description LIKE 'Alokasi HPP Cup/Barang Gudang%')
      OR (transaction.workshop_code = 'KING'
        AND transaction.amount_out > 0
        AND (transaction.description LIKE 'Potongan HPP untuk Gudang%'
          OR transaction.description LIKE 'Potongan HPP/Royalty untuk Global%'))
      OR (transaction.workshop_code = 'GLOBAL'
        AND transaction.amount_in > 0
        AND transaction.description LIKE 'Alokasi HPP Bahan & Royalty%')
    )
),
updated AS (
  UPDATE transactions AS transaction
  SET description = target.next_description
  FROM targets AS target
  WHERE transaction.id = target.id
    AND transaction.description IS DISTINCT FROM target.next_description
  RETURNING transaction.id
)
SELECT COUNT(*) AS updated_rows FROM updated;

COMMIT;

-- Rollback can restore the former generic invoice descriptions from sales_orders.invoice_number.
-- Marketplace batch rows without so_id are intentionally excluded because their order membership is ambiguous.
