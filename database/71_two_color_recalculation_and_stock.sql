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
            v_new_color_two := v_is_two_color AND (
                COALESCE(NEW.notes, '') ~* '\[\[WARNA_PASS:2\]\]'
                OR (
                    COALESCE(NEW.notes, '') !~* '\[\[WARNA_PASS:[12]\]\]'
                    AND COALESCE(NEW.notes, '') ~* '^\s*(warna\s*(ke\s*)?-?\s*2|w2)\s*$'
                )
            );
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
            v_old_color_two := v_is_two_color AND (
                COALESCE(OLD.notes, '') ~* '\[\[WARNA_PASS:2\]\]'
                OR (
                    COALESCE(OLD.notes, '') !~* '\[\[WARNA_PASS:[12]\]\]'
                    AND COALESCE(OLD.notes, '') ~* '^\s*(warna\s*(ke\s*)?-?\s*2|w2)\s*$'
                )
            );
            v_new_color_two := v_is_two_color AND (
                COALESCE(NEW.notes, '') ~* '\[\[WARNA_PASS:2\]\]'
                OR (
                    COALESCE(NEW.notes, '') !~* '\[\[WARNA_PASS:[12]\]\]'
                    AND COALESCE(NEW.notes, '') ~* '^\s*(warna\s*(ke\s*)?-?\s*2|w2)\s*$'
                )
            );
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
            v_old_color_two := v_is_two_color AND (
                COALESCE(OLD.notes, '') ~* '\[\[WARNA_PASS:2\]\]'
                OR (
                    COALESCE(OLD.notes, '') !~* '\[\[WARNA_PASS:[12]\]\]'
                    AND COALESCE(OLD.notes, '') ~* '^\s*(warna\s*(ke\s*)?-?\s*2|w2)\s*$'
                )
            );
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

-- Mutate a production log, its stock-trigger effects, and the owning item status
-- in one transaction. The caller calculates status from this exact log snapshot;
-- the row lock and snapshot comparison reject stale/concurrent submissions.
CREATE OR REPLACE FUNCTION public.mutate_production_log_and_status(
    p_job_id UUID,
    p_log_id UUID,
    p_operation TEXT,
    p_expected_logs JSONB,
    p_qty_processed INTEGER,
    p_qty_defect INTEGER,
    p_notes TEXT,
    p_processed_date DATE,
    p_employee_id UUID,
    p_next_status TEXT,
    p_correction_total INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_old_status TEXT;
    v_current_logs JSONB;
    v_raw_total INTEGER;
    v_log_qty INTEGER;
    v_log_id UUID;
BEGIN
    IF p_job_id IS NULL OR p_operation IS NULL OR p_operation NOT IN ('INSERT', 'CORRECT', 'UPDATE', 'DELETE') THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_INPUT_INVALID';
    END IF;
    IF p_expected_logs IS NULL OR jsonb_typeof(p_expected_logs) <> 'array' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_INPUT_INVALID';
    END IF;
    IF upper(trim(coalesce(p_next_status, ''))) NOT IN (
        'BARU MASUK', 'SIAP PROSES', 'PROSES', 'SIAP KIRIM', 'SUDAH JADI',
        'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_STATUS_INVALID';
    END IF;

    SELECT status
      INTO v_old_status
      FROM public.sales_items
     WHERE id = p_job_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_JOB_NOT_FOUND';
    END IF;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', pl.id::TEXT,
                'qty_processed', pl.qty_processed,
                'qty_defect', pl.qty_defect,
                'notes', pl.notes,
                'processed_date', CASE WHEN pl.processed_date IS NULL THEN NULL ELSE to_char(pl.processed_date, 'YYYY-MM-DD') END,
                'employee_id', CASE WHEN pl.employee_id IS NULL THEN NULL ELSE pl.employee_id::TEXT END
            ) ORDER BY pl.id::TEXT
        ),
        '[]'::JSONB
    )
      INTO v_current_logs
      FROM public.production_logs pl
     WHERE pl.job_id = p_job_id;

    IF v_current_logs IS DISTINCT FROM p_expected_logs THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_CHANGED';
    END IF;

    SELECT COALESCE(SUM(qty_processed), 0)::INTEGER
      INTO v_raw_total
      FROM public.production_logs
     WHERE job_id = p_job_id;

    IF p_operation = 'INSERT' THEN
        IF p_log_id IS NOT NULL OR p_processed_date IS NULL
           OR COALESCE(p_qty_processed, 0) <= 0 OR COALESCE(p_qty_defect, 0) < 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_INPUT_INVALID';
        END IF;
        INSERT INTO public.production_logs (job_id, employee_id, qty_processed, qty_defect, notes, processed_date)
        VALUES (p_job_id, p_employee_id, p_qty_processed, COALESCE(p_qty_defect, 0), COALESCE(p_notes, ''), p_processed_date)
        RETURNING id INTO v_log_id;

    ELSIF p_operation = 'CORRECT' THEN
        IF p_log_id IS NOT NULL OR p_correction_total IS NULL OR p_correction_total < 0 OR p_processed_date IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_CORRECTION_INVALID';
        END IF;
        v_log_qty := p_correction_total - v_raw_total;
        IF v_log_qty <> 0 THEN
            INSERT INTO public.production_logs (job_id, employee_id, qty_processed, qty_defect, notes, processed_date)
            VALUES (p_job_id, p_employee_id, v_log_qty, 0, COALESCE(p_notes, 'Koreksi Qty oleh Admin'), p_processed_date)
            RETURNING id INTO v_log_id;
        END IF;

    ELSIF p_operation = 'UPDATE' THEN
        IF p_log_id IS NULL OR p_processed_date IS NULL OR p_qty_processed IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_INPUT_INVALID';
        END IF;
        UPDATE public.production_logs
           SET qty_processed = p_qty_processed,
               processed_date = p_processed_date,
               employee_id = p_employee_id
         WHERE id = p_log_id AND job_id = p_job_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_LOG_NOT_FOUND';
        END IF;
        v_log_id := p_log_id;

    ELSE
        IF p_log_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_INPUT_INVALID';
        END IF;
        DELETE FROM public.production_logs WHERE id = p_log_id AND job_id = p_job_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_LOG_NOT_FOUND';
        END IF;
        v_log_id := p_log_id;
    END IF;

    IF v_old_status IS DISTINCT FROM p_next_status THEN
        UPDATE public.sales_items SET status = p_next_status WHERE id = p_job_id;
    END IF;

    RETURN jsonb_build_object(
        'log_id', v_log_id,
        'old_status', v_old_status,
        'new_status', p_next_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_production_log_and_status(UUID, UUID, TEXT, JSONB, INTEGER, INTEGER, TEXT, DATE, UUID, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_production_log_and_status(UUID, UUID, TEXT, JSONB, INTEGER, INTEGER, TEXT, DATE, UUID, TEXT, INTEGER)
    TO service_role;

NOTIFY pgrst, 'reload schema';
