-- Backfill a legacy kasbon when its ledger description explicitly names the
-- employee and the full transaction match is one-to-one.
BEGIN;

WITH candidates AS (
  SELECT loan.id AS loan_id, transaction.id AS transaction_id
  FROM employee_loans AS loan
  JOIN employees AS employee ON employee.id = loan.employee_id
  JOIN transactions AS transaction
    ON transaction.employee_loan_id IS NULL
    AND transaction.reference = loan.type
    AND transaction.amount_out = loan.amount
    AND COALESCE(transaction.amount_in, 0) = 0
    AND transaction.workshop_code = 'KING'
    AND LOWER(BTRIM(transaction.description)) = LOWER(
      'Pencairan Kasbon Karyawan - bon ' || BTRIM(employee.full_name)
    )
    AND ABS(
      transaction.date - (loan.disbursed_date AT TIME ZONE 'Asia/Jakarta')::date
    ) <= 1
  WHERE loan.type = 'KASBON'
    AND NOT EXISTS (
      SELECT 1
      FROM transactions AS linked
      WHERE linked.employee_loan_id = loan.id
    )
),
unambiguous_pairs AS (
  SELECT candidate.loan_id, candidate.transaction_id
  FROM candidates AS candidate
  WHERE (
    SELECT COUNT(*)
    FROM candidates AS same_loan
    WHERE same_loan.loan_id = candidate.loan_id
  ) = 1
    AND (
      SELECT COUNT(*)
      FROM candidates AS same_transaction
      WHERE same_transaction.transaction_id = candidate.transaction_id
    ) = 1
)
UPDATE transactions AS transaction
SET employee_loan_id = pair.loan_id
FROM unambiguous_pairs AS pair
WHERE transaction.id = pair.transaction_id
  AND transaction.employee_loan_id IS NULL
RETURNING transaction.id AS transaction_id, transaction.employee_loan_id AS loan_id;

COMMIT;

-- If rollback is needed, clear only transaction_id values returned by this update,
-- and only if none of the linked loans or ledger transactions have since changed.
