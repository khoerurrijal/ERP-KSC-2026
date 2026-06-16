-- 14_audit_fixes.sql
-- Generated from Architecture & Data Audit Report

-- 1. Tambahkan constraint UPDATE CASCADE untuk mengamankan relasi text/varchar
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_customer_code_fkey;
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_customer_code_fkey FOREIGN KEY (customer_code) REFERENCES customers(customer_code) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE sales_items DROP CONSTRAINT IF EXISTS sales_items_product_code_fkey;
ALTER TABLE sales_items ADD CONSTRAINT sales_items_product_code_fkey FOREIGN KEY (product_code) REFERENCES products(product_code) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_product_code_fkey;
ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_product_code_fkey FOREIGN KEY (product_code) REFERENCES products(product_code) ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Amankan transaksi dari nilai minus
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS check_amounts_positive;
ALTER TABLE transactions ADD CONSTRAINT check_amounts_positive CHECK (amount_in >= 0 AND amount_out >= 0);

-- 3. Tambahkan kolom yang terlewat
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- 4. Cleaning Data PO lama (Mapping ulang NULL supplier_id)
UPDATE purchase_orders po 
SET supplier_id = s.id 
FROM suppliers s 
WHERE po.supplier = s.supplier_name AND po.supplier_id IS NULL;
