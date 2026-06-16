-- Menghapus kolom status pada tabel sales_orders
-- Status sekarang murni dikendalikan per item di tabel sales_items

ALTER TABLE public.sales_orders 
DROP COLUMN IF EXISTS status;
