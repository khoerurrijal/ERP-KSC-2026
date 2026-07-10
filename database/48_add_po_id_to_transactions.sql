-- Migration 48: Add po_id column to transactions for direct PO-to-transaction reference
-- Nullable, no backfill needed — existing rows tetap NULL (aman)
-- Sales transactions tetap menggunakan so_id
-- PO transactions menggunakan po_id

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL;

-- Index untuk performa lookup rollback dan duplicate guard
CREATE INDEX IF NOT EXISTS idx_transactions_po_id ON transactions(po_id);

-- Grant permissions (consistent with existing grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO anon, authenticated, service_role;
