-- 36_inventory_ledger_and_triggers.sql
-- Run in Supabase SQL Editor

-- 1. Create Ledger Table
CREATE TABLE IF NOT EXISTS public.stock_mutations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_code VARCHAR(50) NOT NULL,
    mutation_type VARCHAR(50) NOT NULL, -- IN, OUT_POLOS, OUT_SABLON, PROD_SABLON, OPNAME, REVERT
    reference_id UUID, -- ID of source row (e.g. sales_items.id, purchase_items.id, production_logs.id)
    reference_number VARCHAR(100), -- Human readable ref (optional)
    qty_tersedia_change INTEGER DEFAULT 0,
    qty_fisik_change INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Function to automatically apply mutations to products table
CREATE OR REPLACE FUNCTION apply_mutation_to_product()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET 
        stock_qty = COALESCE(stock_qty, 0) + NEW.qty_tersedia_change,
        physical_stock = COALESCE(physical_stock, 0) + NEW.qty_fisik_change
    WHERE product_code = NEW.product_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_mutation ON public.stock_mutations;
CREATE TRIGGER trg_apply_mutation
AFTER INSERT ON public.stock_mutations
FOR EACH ROW EXECUTE FUNCTION apply_mutation_to_product();


-- 3. Trigger for PURCHASE ITEMS (PO)
CREATE OR REPLACE FUNCTION handle_purchase_items_mutation()
RETURNS TRIGGER AS $$
DECLARE
    po_num VARCHAR;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT po_number INTO po_num FROM public.purchase_orders WHERE id = NEW.po_id;
        INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
        VALUES (NEW.product_code, 'IN', NEW.id, po_num, NEW.qty * COALESCE(NEW.unit_multiplier, 1), NEW.qty * COALESCE(NEW.unit_multiplier, 1), 'Pembelian PO');
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT po_number INTO po_num FROM public.purchase_orders WHERE id = OLD.po_id;
        INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
        VALUES (OLD.product_code, 'REVERT_IN', OLD.id, po_num, -(OLD.qty * COALESCE(OLD.unit_multiplier, 1)), -(OLD.qty * COALESCE(OLD.unit_multiplier, 1)), 'Pembatalan Pembelian PO');
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT po_number INTO po_num FROM public.purchase_orders WHERE id = NEW.po_id;
        
        -- Calculate deltas
        DECLARE
            old_qty_total INTEGER := OLD.qty * COALESCE(OLD.unit_multiplier, 1);
            new_qty_total INTEGER := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
            delta_qty INTEGER := new_qty_total - old_qty_total;
        BEGIN
            IF delta_qty <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'IN', NEW.id, po_num, delta_qty, delta_qty, 'Revisi Pembelian PO');
            END IF;
        END;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_items_mutation ON public.purchase_items;
CREATE TRIGGER trg_purchase_items_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION handle_purchase_items_mutation();


-- 4. Trigger for SALES ITEMS (SO)
CREATE OR REPLACE FUNCTION handle_sales_items_mutation()
RETURNS TRIGGER AS $$
DECLARE
    so_num VARCHAR;
    is_polos BOOLEAN;
    actual_qty INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = NEW.so_id;
        
        -- Determine if POLOS or SABLON
        is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
        actual_qty := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
        
        IF is_polos THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -actual_qty, -actual_qty, 'Penjualan Polos');
        ELSE
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, 0, 'Penjualan Sablon (Pending Produksi)');
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = OLD.so_id;
        is_polos := (OLD.order_type IS NULL OR UPPER(OLD.order_type) = 'POLOS' OR UPPER(OLD.order_type) NOT IN ('SABLON', 'PRINTING'));
        actual_qty := OLD.qty * COALESCE(OLD.unit_multiplier, 1);

        IF is_polos THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (OLD.product_code, 'REVERT_OUT_POLOS', OLD.id, so_num, actual_qty, actual_qty, 'Pembatalan Penjualan Polos');
        ELSE
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (OLD.product_code, 'REVERT_OUT_SABLON', OLD.id, so_num, actual_qty, 0, 'Pembatalan Penjualan Sablon');
        END IF;
        
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = NEW.so_id;
        
        DECLARE
            old_actual_qty INTEGER := OLD.qty * COALESCE(OLD.unit_multiplier, 1);
            new_actual_qty INTEGER := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
            delta_qty INTEGER := new_actual_qty - old_actual_qty;
            is_polos BOOLEAN;
        BEGIN
            is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
            
            IF delta_qty <> 0 THEN
                IF is_polos THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -delta_qty, -delta_qty, 'Revisi Penjualan Polos');
                ELSE
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, 0, 'Revisi Penjualan Sablon');
                END IF;
            END IF;
        END;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_items_mutation ON public.sales_items;
CREATE TRIGGER trg_sales_items_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.sales_items
FOR EACH ROW EXECUTE FUNCTION handle_sales_items_mutation();


-- 5. Trigger for PRODUCTION LOGS
CREATE OR REPLACE FUNCTION handle_production_logs_mutation()
RETURNS TRIGGER AS $$
DECLARE
    prod_code VARCHAR;
    so_num VARCHAR;
    total_processed INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Find product_code from sales_items
        SELECT si.product_code, so.invoice_number INTO prod_code, so_num 
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = NEW.job_id;
        
        total_processed := COALESCE(NEW.qty_processed, 0) + COALESCE(NEW.qty_defect, 0);
        
        IF prod_code IS NOT NULL THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (prod_code, 'PROD_SABLON', NEW.id, so_num, 0, -total_processed, 'Proses Produksi Sablon');
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT si.product_code, so.invoice_number INTO prod_code, so_num 
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = OLD.job_id;
        
        total_processed := COALESCE(OLD.qty_processed, 0) + COALESCE(OLD.qty_defect, 0);
        
        IF prod_code IS NOT NULL THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (prod_code, 'REVERT_PROD_SABLON', OLD.id, so_num, 0, total_processed, 'Pembatalan Proses Produksi');
        END IF;
        
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT si.product_code, so.invoice_number INTO prod_code, so_num 
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = NEW.job_id;
        
        DECLARE
            old_total INTEGER := COALESCE(OLD.qty_processed, 0) + COALESCE(OLD.qty_defect, 0);
            new_total INTEGER := COALESCE(NEW.qty_processed, 0) + COALESCE(NEW.qty_defect, 0);
            delta_total INTEGER := new_total - old_total;
        BEGIN
            IF delta_total <> 0 AND prod_code IS NOT NULL THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (prod_code, 'PROD_SABLON', NEW.id, so_num, 0, -delta_total, 'Revisi Proses Produksi');
            END IF;
        END;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_production_logs_mutation ON public.production_logs;
CREATE TRIGGER trg_production_logs_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.production_logs
FOR EACH ROW EXECUTE FUNCTION handle_production_logs_mutation();

-- Done
