-- Membersihkan logika otomatis (trigger) lama yang bertabrakan dengan sistem operasional baru

-- 1. Hapus trigger yang memaksa sales_orders update status berdasarkan item
DROP TRIGGER IF EXISTS trg_update_so_status_on_items ON public.sales_items;

-- 2. Hapus trigger yang memaksa sales_items menjadi SELESAI jika sales_orders LUNAS
DROP TRIGGER IF EXISTS trg_update_so_status_on_order ON public.sales_orders;

-- 3. Hapus fungsi trigger-nya
DROP FUNCTION IF EXISTS public.update_so_status_from_items();

-- Opsional: Memastikan kolom 'status' di sales_orders benar-benar tidak terpakai lagi
-- ALTER TABLE public.sales_orders DROP COLUMN IF EXISTS status;
