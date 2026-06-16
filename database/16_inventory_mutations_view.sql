-- 16_inventory_mutations_view.sql
-- Script untuk membuat VIEW SQL yang menggabungkan riwayat masuk (PO) dan keluar (SO)
-- Jalankan di SQL Editor Supabase

CREATE OR REPLACE VIEW inventory_mutations AS
SELECT 
  po.date AS mutation_date,
  'PO: ' || po.po_number AS reference,
  po.supplier AS actor,
  pi.product_code,
  p.name AS product_name,
  pi.qty AS qty_in,
  0 AS qty_out,
  po.created_at AS created_at
FROM purchase_items pi
JOIN purchase_orders po ON pi.po_id = po.id
JOIN products p ON pi.product_code = p.product_code

UNION ALL

SELECT 
  so.date AS mutation_date,
  'SO: ' || so.invoice_number AS reference,
  COALESCE(c.name, so.customer_code) AS actor,
  si.product_code,
  p.name AS product_name,
  0 AS qty_in,
  si.qty AS qty_out,
  so.created_at AS created_at
FROM sales_items si
JOIN sales_orders so ON si.so_id = so.id
JOIN products p ON si.product_code = p.product_code
LEFT JOIN customers c ON so.customer_code = c.customer_code;

-- Berikan akses agar API Supabase (anon & authenticated) bisa membacanya
GRANT SELECT ON inventory_mutations TO anon;
GRANT SELECT ON inventory_mutations TO authenticated;
