-- 1. Fungsi untuk Trigger pada sales_items
CREATE OR REPLACE FUNCTION public.update_so_status_from_items_trigger()
RETURNS trigger AS $$
DECLARE
  v_so_id uuid;
  v_dp numeric;
  v_payment_status text;
  v_all_items_finished boolean;
  v_has_proses boolean;
  v_new_status text;
BEGIN
  v_so_id := NEW.so_id;

  SELECT dp_amount, payment_status INTO v_dp, v_payment_status
  FROM public.sales_orders
  WHERE id = v_so_id;

  SELECT 
    bool_and(status IN ('SELESAI', 'SUDAH JADI', 'DIKIRIM', 'STOK KELUAR', 'SUDAH DIAMBIL')),
    bool_or(status NOT IN ('BARU MASUK', 'DRAFT'))
  INTO v_all_items_finished, v_has_proses
  FROM public.sales_items
  WHERE so_id = v_so_id;

  IF v_all_items_finished IS NULL THEN
    v_all_items_finished := false;
    v_has_proses := false;
  END IF;

  IF COALESCE(v_has_proses, false) THEN
    IF v_payment_status = 'LUNAS' AND v_all_items_finished THEN
      v_new_status := 'SELESAI';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  ELSE
    IF COALESCE(v_dp, 0) = 0 THEN
      v_new_status := 'DRAFT';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  END IF;

  UPDATE public.sales_orders SET status = v_new_status WHERE id = v_so_id AND status IS DISTINCT FROM v_new_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fungsi untuk Trigger pada sales_orders
CREATE OR REPLACE FUNCTION public.update_so_items_from_order_trigger()
RETURNS trigger AS $$
DECLARE
  v_all_items_finished boolean;
  v_has_proses boolean;
  v_new_status text;
BEGIN
  -- Update items jika LUNAS
  IF NEW.payment_status = 'LUNAS' THEN
    UPDATE public.sales_items 
    SET status = 'SELESAI'
    WHERE so_id = NEW.id 
      AND status IN ('DIKIRIM', 'TERKIRIM', 'SUDAH DIAMBIL', 'STOK KELUAR');
  END IF;

  -- Cek status items
  SELECT 
    bool_and(status IN ('SELESAI', 'SUDAH JADI', 'DIKIRIM', 'STOK KELUAR', 'SUDAH DIAMBIL')),
    bool_or(status NOT IN ('BARU MASUK', 'DRAFT'))
  INTO v_all_items_finished, v_has_proses
  FROM public.sales_items
  WHERE so_id = NEW.id;

  IF v_all_items_finished IS NULL THEN
    v_all_items_finished := false;
    v_has_proses := false;
  END IF;

  IF COALESCE(v_has_proses, false) THEN
    IF NEW.payment_status = 'LUNAS' AND v_all_items_finished THEN
      v_new_status := 'SELESAI';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  ELSE
    IF COALESCE(NEW.dp_amount, 0) = 0 THEN
      v_new_status := 'DRAFT';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  END IF;

  NEW.status := v_new_status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Replace the old triggers
DROP TRIGGER IF EXISTS trg_update_so_status_on_items ON public.sales_items;
CREATE TRIGGER trg_update_so_status_on_items
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.sales_items
FOR EACH ROW
EXECUTE FUNCTION public.update_so_status_from_items_trigger();

DROP TRIGGER IF EXISTS trg_update_so_status_on_order ON public.sales_orders;
CREATE TRIGGER trg_update_so_status_on_order
BEFORE INSERT OR UPDATE OF dp_amount, payment_status
ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_so_items_from_order_trigger();
