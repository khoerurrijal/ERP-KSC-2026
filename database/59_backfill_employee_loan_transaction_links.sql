-- Backfill only one-to-one, metadata-matched loan ledger rows.
-- Ambiguous groups are linked by stable chronological order only when loan and
-- transaction counts match and every paired transaction is within one day.
BEGIN;

WITH loan_rows AS (
  SELECT
    loan.id,
    loan.type AS reference,
    loan.amount AS amount_out,
    (loan.disbursed_date AT TIME ZONE 'Asia/Jakarta')::date AS local_date,
    loan.disbursed_date,
    CASE WHEN loan.type = 'KASBON' THEN 'KING' ELSE 'TABUNGAN' END AS workshop_code,
    CASE WHEN loan.type = 'KASBON'
      THEN 'Pencairan Kasbon Karyawan'
      ELSE 'Pencairan Pinjaman Karyawan'
    END || ' - ' || COALESCE(loan.notes, '') AS description
  FROM employee_loans AS loan
  WHERE NOT EXISTS (
    SELECT 1
    FROM transactions AS linked
    WHERE linked.employee_loan_id = loan.id
  )
),
ranked_loans AS (
  SELECT
    loan_rows.*,
    ROW_NUMBER() OVER (
      PARTITION BY reference, amount_out, description, workshop_code
      ORDER BY local_date, disbursed_date, id
    ) AS item_order,
    COUNT(*) OVER (
      PARTITION BY reference, amount_out, description, workshop_code
    ) AS group_size
  FROM loan_rows
),
ranked_transactions AS (
  SELECT
    transaction.id,
    transaction.reference,
    transaction.amount_out,
    transaction.description,
    transaction.workshop_code,
    transaction.date,
    ROW_NUMBER() OVER (
      PARTITION BY transaction.reference, transaction.amount_out, transaction.description, transaction.workshop_code
      ORDER BY transaction.date, transaction.created_at, transaction.id
    ) AS item_order,
    COUNT(*) OVER (
      PARTITION BY transaction.reference, transaction.amount_out, transaction.description, transaction.workshop_code
    ) AS group_size
  FROM transactions AS transaction
  WHERE transaction.employee_loan_id IS NULL
    AND COALESCE(transaction.amount_in, 0) = 0
    AND transaction.reference IN ('KASBON', 'PINJAMAN')
),
paired_rows AS (
  SELECT
    loan.id AS loan_id,
    transaction.id AS transaction_id,
    loan.reference,
    loan.amount_out,
    loan.description,
    loan.workshop_code,
    loan.group_size AS loan_group_size,
    transaction.group_size AS transaction_group_size,
    ABS(transaction.date - loan.local_date) <= 1 AS date_matches
  FROM ranked_loans AS loan
  JOIN ranked_transactions AS transaction
    USING (reference, amount_out, description, workshop_code, item_order)
),
safe_groups AS (
  SELECT
    reference,
    amount_out,
    description,
    workshop_code,
    MAX(loan_group_size) AS loan_group_size,
    MAX(transaction_group_size) AS transaction_group_size,
    COUNT(*) AS paired_count,
    BOOL_AND(date_matches) AS all_dates_match
  FROM paired_rows
  GROUP BY reference, amount_out, description, workshop_code
),
safe_pairs AS (
  SELECT paired.loan_id, paired.transaction_id
  FROM paired_rows AS paired
  JOIN safe_groups AS safe
    USING (reference, amount_out, description, workshop_code)
  WHERE safe.loan_group_size = safe.transaction_group_size
    AND safe.paired_count = safe.loan_group_size
    AND safe.all_dates_match
)
UPDATE transactions AS transaction
SET employee_loan_id = safe_pairs.loan_id
FROM safe_pairs
WHERE transaction.id = safe_pairs.transaction_id
  AND transaction.employee_loan_id IS NULL
RETURNING transaction.id AS transaction_id, transaction.employee_loan_id AS loan_id;

COMMIT;

-- If rollback is needed, clear only transaction_id values returned by this update,
-- and only if none of the linked loans or ledger transactions have since changed.
