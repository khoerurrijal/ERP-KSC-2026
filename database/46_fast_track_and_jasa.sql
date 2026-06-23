-- 1. Tambah kolom is_fast_track ke sales_items
ALTER TABLE public.sales_items
ADD COLUMN IF NOT EXISTS is_fast_track BOOLEAN DEFAULT false;

-- 2. Pastikan JASA products ada
INSERT INTO public.products (product_code, product_name, category, unit, selling_price, is_active)
VALUES 
('SRV-FAST-TRACK', 'Biaya Layanan Fast Track', 'JASA', 'Layanan', 100000, true),
('SRV-2-WARNA', 'Jasa Sablon 2 Warna', 'JASA', 'Pcs', 250, true)
ON CONFLICT (product_code) DO NOTHING;

-- 3. Perbarui trigger stock mutations untuk mengabaikan JASA
CREATE OR REPLACE FUNCTION handle_sales_items_mutation()
RETURNS TRIGGER AS $$
DECLARE
    so_num VARCHAR;
    is_polos BOOLEAN;
    actual_qty INTEGER;
    prod_cat VARCHAR;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Ambil kategori produk
        SELECT category INTO prod_cat FROM public.products WHERE product_code = NEW.product_code;
        
        -- Abaikan jika produk adalah JASA (tidak potong stok fisik/tersedia)
        IF UPPER(prod_cat) = 'JASA' THEN
            RETURN NEW;
        END IF;

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
        SELECT category INTO prod_cat FROM public.products WHERE product_code = OLD.product_code;
        
        IF UPPER(prod_cat) = 'JASA' THEN
            RETURN OLD;
        END IF;

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
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Perbarui Production Log Trigger untuk mengabaikan JASA
CREATE OR REPLACE FUNCTION handle_production_logs_mutation()
RETURNS TRIGGER AS $$
DECLARE
    prod_code VARCHAR;
    so_num VARCHAR;
    total_processed INTEGER;
    prod_cat VARCHAR;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT si.product_code, so.invoice_number INTO prod_code, so_num 
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = NEW.job_id;
        
        IF prod_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = prod_code;
            IF UPPER(prod_cat) = 'JASA' THEN
                RETURN NEW;
            END IF;
        
            total_processed := COALESCE(NEW.qty_processed, 0) + COALESCE(NEW.qty_defect, 0);
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (prod_code, 'PROD_SABLON', NEW.id, so_num, 0, -total_processed, 'Proses Produksi Sablon');
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT si.product_code, so.invoice_number INTO prod_code, so_num 
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = OLD.job_id;

        IF prod_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = prod_code;
            IF UPPER(prod_cat) = 'JASA' THEN
                RETURN OLD;
            END IF;

            total_processed := COALESCE(OLD.qty_processed, 0) + COALESCE(OLD.qty_defect, 0);
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (prod_code, 'PROD_SABLON', OLD.id, so_num, 0, total_processed, 'Revert Proses Produksi Sablon (Dihapus)');
        END IF;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
