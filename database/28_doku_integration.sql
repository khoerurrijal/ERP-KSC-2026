-- 28_doku_integration.sql

ALTER TABLE public.sales_orders
ADD COLUMN IF NOT EXISTS payment_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS doku_invoice_id VARCHAR(100);

-- Make sure RLS policies allow reading and updating these fields if needed
