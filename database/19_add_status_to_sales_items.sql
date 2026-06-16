-- 1. Tambahkan kolom status ke tabel sales_items
ALTER TABLE public.sales_items 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Proses';

-- 2. Sinkronkan status item lama dengan status invoice-nya (jika SO Selesai, item juga Selesai)
UPDATE public.sales_items
SET status = 'Selesai'
FROM public.sales_orders
WHERE public.sales_items.so_id = public.sales_orders.id
  AND public.sales_orders.status = 'Selesai';
