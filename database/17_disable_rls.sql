-- 17_disable_rls.sql
-- Script untuk menonaktifkan RLS (Row Level Security) di semua tabel 
-- agar aplikasi bisa leluasa mengambil dan menyimpan data dari localhost tanpa diblokir.

ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE workshops DISABLE ROW LEVEL SECURITY;

ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items DISABLE ROW LEVEL SECURITY;

ALTER TABLE sales_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_items DISABLE ROW LEVEL SECURITY;

ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_loans DISABLE ROW LEVEL SECURITY;

-- Note: VIEW (seperti inventory_mutations) tidak memiliki RLS sendiri secara default,
-- ia mengikuti RLS dari tabel-tabel aslinya (yang sekarang sudah dimatikan di atas).
