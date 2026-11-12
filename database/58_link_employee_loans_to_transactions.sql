-- Link each loan disbursement to its Buku Besar transaction for safe edits.
BEGIN;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS employee_loan_id UUID
  REFERENCES employee_loans(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_employee_loan_id_unique
  ON transactions(employee_loan_id)
  WHERE employee_loan_id IS NOT NULL;

COMMIT;

-- Rollback, if needed:
-- DROP INDEX IF EXISTS transactions_employee_loan_id_unique;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS employee_loan_id;
