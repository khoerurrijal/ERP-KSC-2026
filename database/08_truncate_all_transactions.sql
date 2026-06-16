-- PENGHAPUSAN DATA DUMMY / RESET TRANSAKSI
-- Gunakan script ini HANYA jika Anda ingin mengosongkan seluruh data transaksi (kembali ke 0).
-- Data Master (Pelanggan, Supplier, Produk, Workshop) TIDAK akan terhapus.

BEGIN;

-- Hapus seluruh riwayat transaksi arus kas / buku besar
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;

-- Hapus seluruh invoice, sales order, dan item detail pesanan (termasuk marketplace)
TRUNCATE TABLE sales_orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_items RESTART IDENTITY CASCADE;

-- Hapus seluruh PO / Restock barang
TRUNCATE TABLE purchase_orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE purchase_items RESTART IDENTITY CASCADE;

-- Reset stok semua barang kembali menjadi 0
UPDATE products SET stock_qty = 0;

COMMIT;

-- CATATAN:
-- Setelah script ini dijalankan di SQL Editor Supabase, 
-- semua data order dan transaksi akan bersih, aplikasi akan menjadi super ringan.
