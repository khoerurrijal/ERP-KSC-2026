CREATE OR REPLACE FUNCTION public.update_so_status_from_items()
RETURNS trigger AS $$
DECLARE
  v_so_id uuid;
  v_dp numeric;
  v_payment_status text;
  v_all_items_finished boolean;
  v_has_proses boolean;
  v_new_status text;
BEGIN
  -- Determine which so_id to check
  IF TG_TABLE_NAME = 'sales_items' THEN
    v_so_id := NEW.so_id;
  ELSIF TG_TABLE_NAME = 'sales_orders' THEN
    v_so_id := NEW.id;
  END IF;

  -- Fetch order details
  SELECT dp_amount, payment_status INTO v_dp, v_payment_status
  FROM public.sales_orders
  WHERE id = v_so_id;

  -- Jika dari tabel sales_orders dan payment_status baru saja diubah menjadi LUNAS,
  -- Kita update otomatis item yang eligible menjadi SELESAI.
  IF TG_TABLE_NAME = 'sales_orders' AND NEW.payment_status = 'LUNAS' THEN
    UPDATE public.sales_items 
    SET status = 'SELESAI'
    WHERE so_id = NEW.id 
      AND status IN ('DIKIRIM', 'TERKIRIM', 'SUDAH DIAMBIL', 'STOK KELUAR');
      
    -- Karena kita baru update item, kita harus pakai NEW.payment_status untuk evaluasi selanjutnya
    v_payment_status := NEW.payment_status;
    v_dp := NEW.dp_amount;
  END IF;

  -- Check items
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

  -- Calculate New Status
  IF COALESCE(v_has_proses, false) THEN
    -- Jika barang sudah mulai diproses/selesai
    IF v_payment_status = 'LUNAS' AND v_all_items_finished THEN
      v_new_status := 'SELESAI';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  ELSE
    -- Jika barang masih baru masuk / kosong
    IF COALESCE(v_dp, 0) = 0 THEN
      v_new_status := 'DRAFT';
    ELSE
      v_new_status := 'BERJALAN';
    END IF;
  END IF;

  -- Perform the update
  IF TG_TABLE_NAME = 'sales_items' THEN
    UPDATE public.sales_orders SET status = v_new_status WHERE id = v_so_id AND status IS DISTINCT FROM v_new_status;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'sales_orders' THEN
    NEW.status := v_new_status;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
