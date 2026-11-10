-- Serialize production progress writes per sales item and reject stale forms.
-- The existing production_logs trigger still records the stock mutation in this transaction.

CREATE OR REPLACE FUNCTION public.record_production_progress_guarded(
    p_job_id UUID,
    p_employee_id UUID,
    p_qty_processed INTEGER,
    p_qty_defect INTEGER,
    p_notes TEXT,
    p_processed_date DATE,
    p_expected_total_qty INTEGER,
    p_correction_total INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_job_id UUID;
    v_current_total INTEGER;
    v_log_qty INTEGER;
    v_log_defect INTEGER;
    v_log_notes TEXT;
    v_log_id UUID;
BEGIN
    IF p_job_id IS NULL OR p_expected_total_qty IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_INPUT_INVALID';
    END IF;

    SELECT id
      INTO v_job_id
      FROM public.sales_items
     WHERE id = p_job_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_JOB_NOT_FOUND';
    END IF;

    SELECT COALESCE(SUM(qty_processed), 0)::INTEGER
      INTO v_current_total
      FROM public.production_logs
     WHERE job_id = p_job_id;

    IF v_current_total <> p_expected_total_qty THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_CHANGED';
    END IF;

    IF p_correction_total IS NULL THEN
        IF COALESCE(p_qty_processed, 0) <= 0 OR COALESCE(p_qty_defect, 0) < 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_PROGRESS_INPUT_INVALID';
        END IF;

        v_log_qty := p_qty_processed;
        v_log_defect := COALESCE(p_qty_defect, 0);
        v_log_notes := COALESCE(p_notes, '');
    ELSE
        IF p_correction_total < 0 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRODUCTION_CORRECTION_INVALID';
        END IF;

        v_log_qty := p_correction_total - v_current_total;
        v_log_defect := 0;
        v_log_notes := COALESCE(p_notes, 'Koreksi Qty oleh Admin');

        IF v_log_qty = 0 THEN
            RETURN NULL;
        END IF;
    END IF;

    INSERT INTO public.production_logs (
        job_id,
        employee_id,
        qty_processed,
        qty_defect,
        notes,
        processed_date
    ) VALUES (
        p_job_id,
        p_employee_id,
        v_log_qty,
        v_log_defect,
        v_log_notes,
        COALESCE(p_processed_date, CURRENT_DATE)
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_production_progress_guarded(UUID, UUID, INTEGER, INTEGER, TEXT, DATE, INTEGER, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_production_progress_guarded(UUID, UUID, INTEGER, INTEGER, TEXT, DATE, INTEGER, INTEGER)
    TO service_role;

NOTIFY pgrst, 'reload schema';
