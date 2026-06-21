-- 41_fix_trigger_security.sql

-- Mengubah fungsi trigger agar berjalan dengan hak akses admin (SECURITY DEFINER)
-- Ini menyelesaikan error "permission denied for table stock_mutations" saat menambah item baru
CREATE OR REPLACE FUNCTION handle_sales_items_mutation()
RETURNS TRIGGER 
SECURITY DEFINER -- BARIS INI DITAMBAHKAN
AS $$
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
        
        -- Jangan kurangi stok jika statusnya BATAL sejak awal (meski jarang terjadi di INSERT)
        IF NEW.status != 'BATAL' THEN
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -actual_qty, -actual_qty, 'Penjualan Polos');
            ELSE
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, 0, 'Penjualan Sablon (Pending Produksi)');
            END IF;
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = OLD.so_id;
        is_polos := (OLD.order_type IS NULL OR UPPER(OLD.order_type) = 'POLOS' OR UPPER(OLD.order_type) NOT IN ('SABLON', 'PRINTING'));
        actual_qty := OLD.qty * COALESCE(OLD.unit_multiplier, 1);

        -- Hanya kembalikan stok jika sebelumnya tidak BATAL
        IF OLD.status != 'BATAL' THEN
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (OLD.product_code, 'REVERT_OUT_POLOS', OLD.id, so_num, actual_qty, actual_qty, 'Hapus Data Penjualan Polos');
            ELSE
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (OLD.product_code, 'REVERT_OUT_SABLON', OLD.id, so_num, actual_qty, 0, 'Hapus Data Penjualan Sablon');
            END IF;
        END IF;
        
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = NEW.so_id;
        
        DECLARE
            old_actual_qty INTEGER := OLD.qty * COALESCE(OLD.unit_multiplier, 1);
            new_actual_qty INTEGER := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
            delta_qty INTEGER := new_actual_qty - old_actual_qty;
        BEGIN
            is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
            
            -- LOGIKA PEMBATALAN (BATAL)
            IF OLD.status != 'BATAL' AND NEW.status = 'BATAL' THEN
                -- Revert all old quantities
                IF is_polos THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'REVERT_OUT_POLOS', NEW.id, so_num, old_actual_qty, old_actual_qty, 'Pembatalan Pesanan Polos');
                ELSE
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'REVERT_OUT_SABLON', NEW.id, so_num, old_actual_qty, 0, 'Pembatalan Pesanan Sablon');
                END IF;
            
            -- LOGIKA PENGEMBALIAN DARI BATAL KE AKTIF
            ELSIF OLD.status = 'BATAL' AND NEW.status != 'BATAL' THEN
                IF is_polos THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -new_actual_qty, -new_actual_qty, 'Aktivasi Kembali Pesanan Polos');
                ELSE
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -new_actual_qty, 0, 'Aktivasi Kembali Pesanan Sablon');
                END IF;

            -- LOGIKA UPDATE QTY BIASA
            ELSIF OLD.status != 'BATAL' AND NEW.status != 'BATAL' AND delta_qty <> 0 THEN
                IF is_polos THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -delta_qty, -delta_qty, 'Revisi Qty Pesanan Polos');
                ELSE
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, 0, 'Revisi Qty Pesanan Sablon');
                END IF;
            END IF;
        END;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Pastikan anon juga punya hak akses untuk insert secara eksplisit (jaga-jaga)
GRANT INSERT, UPDATE, SELECT ON public.stock_mutations TO anon;
GRANT INSERT, UPDATE, SELECT ON public.stock_mutations TO authenticated;
