-- Two-color SABLON is two production passes over one ordered physical quantity.
-- W1 consumes the stock once; W2 records the second print pass without consuming it again.
-- Defect mutations and the JASA/DLL/LAINNYA/PRINTING bypasses remain unchanged.

CREATE OR REPLACE FUNCTION public.handle_production_logs_mutation()
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
    v_item_notes TEXT;
    v_is_two_color BOOLEAN;
    v_old_color_two BOOLEAN;
    v_new_color_two BOOLEAN;
    prod_cat VARCHAR;
    v_order_type VARCHAR;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT si.product_code, si.order_type, si.notes, so.invoice_number
        INTO v_product_code, v_order_type, v_item_notes, v_invoice_number
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = NEW.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
               OR UPPER(TRIM(COALESCE(v_order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA', 'PRINTING') THEN
                RETURN NEW;
            END IF;

            v_is_two_color := COALESCE(v_item_notes, '') ~* '(2\s*warna|warna\s*ke-?2)';
            v_new_color_two := v_is_two_color AND COALESCE(NEW.notes, '') ~* '\[\[WARNA_PASS:2\]\]';
            v_qty_processed := CASE
                WHEN v_new_color_two THEN 0
                ELSE COALESCE(NEW.qty_processed, 0)
            END;
            v_qty_defect := COALESCE(NEW.qty_defect, 0);

            -- Qty Processed memotong stok fisik saja. W2 tidak memotong ulang.
            IF v_qty_processed <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'OUT_PRODUKSI', NEW.id, v_invoice_number, 0, -v_qty_processed, 'Penggunaan Bahan Baku Sablon');
            END IF;

            -- Qty Defect memotong stok fisik DAN stok tersedia, tetap mengikuti flow lama.
            IF v_qty_defect <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'OUT_DEFECT', NEW.id, v_invoice_number, -v_qty_defect, -v_qty_defect, 'Defect Produksi Sablon');
            END IF;
        END IF;

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        SELECT si.product_code, si.order_type, si.notes, so.invoice_number
        INTO v_product_code, v_order_type, v_item_notes, v_invoice_number
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = NEW.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
               OR UPPER(TRIM(COALESCE(v_order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA', 'PRINTING') THEN
                RETURN NEW;
            END IF;

            v_is_two_color := COALESCE(v_item_notes, '') ~* '(2\s*warna|warna\s*ke-?2)';
            v_old_color_two := v_is_two_color AND COALESCE(OLD.notes, '') ~* '\[\[WARNA_PASS:2\]\]';
            v_new_color_two := v_is_two_color AND COALESCE(NEW.notes, '') ~* '\[\[WARNA_PASS:2\]\]';
            v_old_processed := CASE WHEN v_old_color_two THEN 0 ELSE COALESCE(OLD.qty_processed, 0) END;
            v_old_defect := COALESCE(OLD.qty_defect, 0);
            v_qty_processed := CASE WHEN v_new_color_two THEN 0 ELSE COALESCE(NEW.qty_processed, 0) END;
            v_qty_defect := COALESCE(NEW.qty_defect, 0);

            v_delta_processed := v_qty_processed - v_old_processed;
            v_delta_defect := v_qty_defect - v_old_defect;

            -- Koreksi qty_processed hanya menyesuaikan konsumsi fisik W1.
            IF v_delta_processed <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'ADJ_PRODUKSI', NEW.id, v_invoice_number, 0, -v_delta_processed, 'Revisi Qty Produksi Sablon');
            END IF;

            -- Koreksi qty_defect tetap memengaruhi fisik & tersedia seperti sebelumnya.
            IF v_delta_defect <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'ADJ_DEFECT', NEW.id, v_invoice_number, -v_delta_defect, -v_delta_defect, 'Revisi Qty Defect Sablon');
            END IF;
        END IF;

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        SELECT si.product_code, si.order_type, si.notes, so.invoice_number
        INTO v_product_code, v_order_type, v_item_notes, v_invoice_number
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = OLD.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
               OR UPPER(TRIM(COALESCE(v_order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA', 'PRINTING') THEN
                RETURN OLD;
            END IF;

            v_is_two_color := COALESCE(v_item_notes, '') ~* '(2\s*warna|warna\s*ke-?2)';
            v_old_color_two := v_is_two_color AND COALESCE(OLD.notes, '') ~* '\[\[WARNA_PASS:2\]\]';
            v_old_processed := CASE WHEN v_old_color_two THEN 0 ELSE COALESCE(OLD.qty_processed, 0) END;
            v_old_defect := COALESCE(OLD.qty_defect, 0);

            -- Hanya kembalikan konsumsi fisik W1; hapus W2 tidak memutasi stok.
            IF v_old_processed <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'REVERT_PRODUKSI', OLD.id, v_invoice_number, 0, v_old_processed, 'Hapus Log Produksi Sablon');
            END IF;

            -- Pengembalian defect tetap mengikuti flow lama.
            IF v_old_defect <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'REVERT_DEFECT', OLD.id, v_invoice_number, v_old_defect, v_old_defect, 'Hapus Log Defect Sablon');
            END IF;
        END IF;

        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
