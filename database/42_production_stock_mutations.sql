-- 42_production_stock_mutations.sql
-- HARAP JALANKAN DI SUPABASE SQL EDITOR
-- Fungsi ini akan memotong stok fisik dan stok tersedia untuk penggunaan bahan baku Sablon & Defect.

CREATE OR REPLACE FUNCTION handle_production_logs_mutation()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
    v_product_code VARCHAR;
    v_invoice_number VARCHAR;
    v_qty_processed INTEGER;
    v_qty_defect INTEGER;
    v_old_processed INTEGER;
    v_old_defect INTEGER;
    v_delta_processed INTEGER;
    v_delta_defect INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Ambil product_code dan invoice_number dari job_id (sales_items)
        SELECT si.product_code, so.invoice_number 
        INTO v_product_code, v_invoice_number 
        FROM public.sales_items si 
        JOIN public.sales_orders so ON si.so_id = so.id 
        WHERE si.id = NEW.job_id;

        v_qty_processed := COALESCE(NEW.qty_processed, 0);
        v_qty_defect := COALESCE(NEW.qty_defect, 0);

        -- Qty Processed memotong stok fisik saja (Stok Tersedia/Booking sudah dipotong saat SO dibuat)
        IF v_qty_processed > 0 THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (v_product_code, 'OUT_PRODUKSI', NEW.id, v_invoice_number, 0, -v_qty_processed, 'Penggunaan Bahan Baku Sablon');
        END IF;

        -- Qty Defect memotong stok fisik DAN stok tersedia (karena ini bahan baku tambahan yang hancur, di luar booking awal)
        IF v_qty_defect > 0 THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (v_product_code, 'OUT_DEFECT', NEW.id, v_invoice_number, -v_qty_defect, -v_qty_defect, 'Defect Produksi Sablon');
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT si.product_code, so.invoice_number 
        INTO v_product_code, v_invoice_number 
        FROM public.sales_items si 
        JOIN public.sales_orders so ON si.so_id = so.id 
        WHERE si.id = NEW.job_id;

        v_old_processed := COALESCE(OLD.qty_processed, 0);
        v_old_defect := COALESCE(OLD.qty_defect, 0);
        v_qty_processed := COALESCE(NEW.qty_processed, 0);
        v_qty_defect := COALESCE(NEW.qty_defect, 0);

        v_delta_processed := v_qty_processed - v_old_processed;
        v_delta_defect := v_qty_defect - v_old_defect;

        -- Koreksi qty_processed (hanya memengaruhi fisik)
        IF v_delta_processed <> 0 THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (v_product_code, 'ADJ_PRODUKSI', NEW.id, v_invoice_number, 0, -v_delta_processed, 'Revisi Qty Produksi Sablon');
        END IF;

        -- Koreksi qty_defect (memengaruhi fisik & tersedia)
        IF v_delta_defect <> 0 THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (v_product_code, 'ADJ_DEFECT', NEW.id, v_invoice_number, -v_delta_defect, -v_delta_defect, 'Revisi Qty Defect Sablon');
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        SELECT si.product_code, so.invoice_number 
        INTO v_product_code, v_invoice_number 
        FROM public.sales_items si 
        JOIN public.sales_orders so ON si.so_id = so.id 
        WHERE si.id = OLD.job_id;

        v_old_processed := COALESCE(OLD.qty_processed, 0);
        v_old_defect := COALESCE(OLD.qty_defect, 0);

        -- Kembalikan fisik
        IF v_old_processed > 0 THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (v_product_code, 'REVERT_PRODUKSI', OLD.id, v_invoice_number, 0, v_old_processed, 'Hapus Log Produksi Sablon');
        END IF;

        -- Kembalikan fisik & tersedia
        IF v_old_defect > 0 THEN
            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
            VALUES (v_product_code, 'REVERT_DEFECT', OLD.id, v_invoice_number, v_old_defect, v_old_defect, 'Hapus Log Defect Sablon');
        END IF;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Menghapus trigger lama jika ada, lalu membuat yang baru
DROP TRIGGER IF EXISTS trg_production_logs_mutation ON public.production_logs;
CREATE TRIGGER trg_production_logs_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.production_logs
FOR EACH ROW EXECUTE FUNCTION handle_production_logs_mutation();
