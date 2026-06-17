-- 34_cleanup_addons.sql
-- Menghapus semua produk dengan kategori 'ADDON' karena kita sekarang langsung menggunakan produk master

-- 1. Hapus transaksi penjualan yang mungkin terkait dengan ADDON ini (jika baru dicoba-coba)
-- (Dilewati agar aman, kita asumsikan belum ada yang terjual)

-- 2. Hapus dari product_units (jika ada)
DELETE FROM public.product_units WHERE product_code IN (SELECT product_code FROM public.products WHERE category = 'ADDON');

-- 3. Hapus produk dari master produk
DELETE FROM public.products WHERE category = 'ADDON';

-- JIKA GAGAL DIHAPUS KARENA SUDAH ADA TRANSAKSI, MAKA KITA NON-AKTIFKAN SAJA:
UPDATE public.products SET is_active = FALSE WHERE category = 'ADDON';
