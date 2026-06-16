-- Tambah kolom beli_gudang dan beli_global ke tabel sales_items
ALTER TABLE public.sales_items 
ADD COLUMN IF NOT EXISTS beli_gudang numeric DEFAULT 0;

ALTER TABLE public.sales_items 
ADD COLUMN IF NOT EXISTS beli_global numeric DEFAULT 0;

-- Hapus kolom beli_gudang dan beli_global dari tabel sales_orders
ALTER TABLE public.sales_orders 
DROP COLUMN IF EXISTS beli_gudang;

ALTER TABLE public.sales_orders 
DROP COLUMN IF EXISTS beli_global;
