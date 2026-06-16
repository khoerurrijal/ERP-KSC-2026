-- database/22_add_beli_columns_to_sales_orders.sql

ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS beli_gudang numeric DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS beli_global numeric DEFAULT 0;
