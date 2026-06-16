-- Add pricing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS hpp_murni NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_polos NUMERIC DEFAULT 0;

-- Optional: If you want to keep track of pack/roll price explicitly 
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_polos_pack_roll NUMERIC DEFAULT 0;
