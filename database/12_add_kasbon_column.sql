-- database/12_add_kasbon_column.sql

ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS kasbon_amount NUMERIC DEFAULT 0;
