-- 15_sync_inventory_stock.sql
-- Script untuk MENGHITUNG ULANG seluruh stok produk berdasarkan riwayat historis murni
-- (Total Pembelian - Total Penjualan)
-- Jalankan di SQL Editor Supabase

WITH StockCalculation AS (
    SELECT 
        p.product_code,
        p.name,
        COALESCE(beli.total_beli, 0) AS total_beli,
        COALESCE(jual.total_jual, 0) AS total_jual,
        (COALESCE(beli.total_beli, 0) - COALESCE(jual.total_jual, 0)) AS calculated_stock
    FROM 
        products p
    LEFT JOIN (
        -- Hitung total QTY yang dibeli per produk
        SELECT product_code, SUM(qty) as total_beli 
        FROM purchase_items 
        GROUP BY product_code
    ) beli ON p.product_code = beli.product_code
    LEFT JOIN (
        -- Hitung total QTY yang dijual per produk
        SELECT product_code, SUM(qty) as total_jual 
        FROM sales_items 
        GROUP BY product_code
    ) jual ON p.product_code = jual.product_code
)

-- Lakukan UPDATE pada tabel products
UPDATE products
SET stock_qty = sc.calculated_stock
FROM StockCalculation sc
WHERE products.product_code = sc.product_code;

-- (Opsional) Cek hasilnya:
-- SELECT product_code, name, stock_qty FROM products ORDER BY name;
