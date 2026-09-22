-- Pisahkan order marketplace yang sudah dibayar di luar ERP dari status
-- pembayaran operasional. Tidak mengubah status pembayaran atau saldo.

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS marketplace_settlement_status TEXT NOT NULL DEFAULT 'PENDING';

DO $$
BEGIN
  ALTER TABLE public.sales_orders
    ADD CONSTRAINT sales_orders_marketplace_settlement_status_check
    CHECK (marketplace_settlement_status IN ('PENDING', 'SETTLED_EXTERNAL'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS sales_orders_marketplace_settlement_status_idx
  ON public.sales_orders (marketplace_settlement_status, date DESC);

COMMENT ON COLUMN public.sales_orders.marketplace_settlement_status IS
  'PENDING untuk antrean marketplace ERP; SETTLED_EXTERNAL berarti owner mengonfirmasi sudah dibayar di luar ERP tanpa membuat transaksi baru.';
