-- 33_add_is_active_products.sql
-- HARAP JALANKAN DI SUPABASE SQL EDITOR

-- 1. Tambah kolom is_active ke tabel products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Non-aktifkan kategori CUP_HOOK dan Unknown Product (opsional, sebagai contoh pembersihan)
UPDATE public.products SET is_active = FALSE WHERE category = 'CUP_HOOK';
UPDATE public.products SET is_active = FALSE WHERE name ILIKE 'Unknown Product%';
