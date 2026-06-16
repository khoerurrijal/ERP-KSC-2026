-- Menambahkan kolom order_type dan mockup_url ke sales_order_items
ALTER TABLE public.sales_order_items ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'Polos';
ALTER TABLE public.sales_order_items ADD COLUMN IF NOT EXISTS mockup_url TEXT;
