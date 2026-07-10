-- Migration 49: Fix Printing Stock Logic (Bypass Printing from Stock Mutations)
-- Business Rule: PRINTING is vendor fulfillment and does not deduct King/Gudang/Global stock.

CREATE OR REPLACE FUNCTION handle_sales_items_mutation()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
    so_num VARCHAR;
    is_polos BOOLEAN;
    prod_cat VARCHAR;
    actual_qty INTEGER;
    old_actual_qty INTEGER;
    delta_qty INTEGER;
    was_comp BOOLEAN;
    is_comp BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Ambil kategori produk
        SELECT category INTO prod_cat FROM public.products WHERE product_code = NEW.product_code;
        
        -- Abaikan jika produk adalah JASA atau order bertipe PRINTING
        IF UPPER(prod_cat) = 'JASA' OR UPPER(COALESCE(NEW.order_type, '')) = 'PRINTING' THEN
            RETURN NEW;
        END IF;

        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = NEW.so_id;
        
        -- Tentukan jenis order: POLOS atau SABLON (PRINTING sudah dibypass di atas)
        is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
        actual_qty := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
        
        -- Jangan potong stok jika statusnya BATAL sejak awal
        IF NEW.status != 'BATAL' THEN
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -actual_qty, -actual_qty, 'Penjualan Polos');
            ELSE
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, 0, 'Penjualan Sablon (Pending)');
            END IF;
        END IF;
        
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        SELECT category INTO prod_cat FROM public.products WHERE product_code = OLD.product_code;
        
        IF UPPER(prod_cat) = 'JASA' OR UPPER(COALESCE(OLD.order_type, '')) = 'PRINTING' THEN
            RETURN OLD;
        END IF;

        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = OLD.so_id;
        is_polos := (OLD.order_type IS NULL OR UPPER(OLD.order_type) = 'POLOS' OR UPPER(OLD.order_type) NOT IN ('SABLON', 'PRINTING'));
        actual_qty := OLD.qty * COALESCE(OLD.unit_multiplier, 1);

        -- Hanya kembalikan stok jika statusnya tidak BATAL
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
        SELECT category INTO prod_cat FROM public.products WHERE product_code = NEW.product_code;
        
        IF UPPER(prod_cat) = 'JASA' THEN
            RETURN NEW;
        END IF;

        -- Jika transisi dari/ke PRINTING atau keduanya PRINTING, tangani secara khusus untuk menghindari kebocoran stok
        IF UPPER(COALESCE(OLD.order_type, '')) = 'PRINTING' AND UPPER(COALESCE(NEW.order_type, '')) = 'PRINTING' THEN
            -- PRINTING -> PRINTING: bypass seluruh mutasi stok
            RETURN NEW;
        END IF;

        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = NEW.so_id;
        
        actual_qty := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
        old_actual_qty := OLD.qty * COALESCE(OLD.unit_multiplier, 1);
        delta_qty := actual_qty - old_actual_qty;

        -- KASUS 1: Perubahan status menjadi BATAL
        IF OLD.status != 'BATAL' AND NEW.status = 'BATAL' THEN
            -- Jika tipenya berubah menjadi PRINTING (atau dari PRINTING) saat batal, sesuaikan pemulihan stok
            IF UPPER(COALESCE(OLD.order_type, '')) = 'PRINTING' THEN
                -- Tidak memulihkan stok apa-apa karena PRINTING tidak pernah mengurangi stok
                RETURN NEW;
            END IF;

            is_polos := (OLD.order_type IS NULL OR UPPER(OLD.order_type) = 'POLOS' OR UPPER(OLD.order_type) NOT IN ('SABLON', 'PRINTING'));
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'REVERT_OUT_POLOS', NEW.id, so_num, old_actual_qty, old_actual_qty, 'Pembatalan Pesanan Polos');
            ELSE
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'REVERT_OUT_SABLON', NEW.id, so_num, old_actual_qty, 0, 'Pembatalan Pesanan Sablon');
            END IF;

        -- KASUS 2: Re-aktivasi status dari BATAL ke aktif
        ELSIF OLD.status = 'BATAL' AND NEW.status != 'BATAL' THEN
            IF UPPER(COALESCE(NEW.order_type, '')) = 'PRINTING' THEN
                -- Tidak memotong stok karena reaktivasi sebagai PRINTING
                RETURN NEW;
            END IF;

            is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -actual_qty, -actual_qty, 'Re-aktivasi Pesanan Polos');
            ELSE
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, 0, 'Re-aktivasi Pesanan Sablon');
            END IF;

        -- KASUS 3: Transaksi aktif (perubahan kuantitas, tipe order, atau status operasional)
        ELSIF OLD.status != 'BATAL' AND NEW.status != 'BATAL' THEN
            -- Tangani jika salah satu (OLD atau NEW) adalah PRINTING (transisi tipe)
            IF UPPER(COALESCE(OLD.order_type, '')) = 'PRINTING' AND UPPER(COALESCE(NEW.order_type, '')) != 'PRINTING' THEN
                -- PRINTING -> POLOS/SABLON: Potong stok baru sepenuhnya
                is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
                IF is_polos THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -actual_qty, -actual_qty, 'Perubahan tipe dari Printing ke Polos');
                ELSE
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, 0, 'Perubahan tipe dari Printing ke Sablon');
                END IF;
                RETURN NEW;
            ELSIF UPPER(COALESCE(OLD.order_type, '')) != 'PRINTING' AND UPPER(COALESCE(NEW.order_type, '')) = 'PRINTING' THEN
                -- POLOS/SABLON -> PRINTING: Kembalikan stok lama sepenuhnya
                DECLARE
                    old_is_polos BOOLEAN := (OLD.order_type IS NULL OR UPPER(OLD.order_type) = 'POLOS' OR UPPER(OLD.order_type) NOT IN ('SABLON', 'PRINTING'));
                BEGIN
                    IF old_is_polos THEN
                        INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                        VALUES (NEW.product_code, 'REVERT_OUT_POLOS', NEW.id, so_num, old_actual_qty, old_actual_qty, 'Perubahan tipe dari Polos ke Printing');
                    ELSE
                        INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                        VALUES (NEW.product_code, 'REVERT_OUT_SABLON', NEW.id, so_num, old_actual_qty, 0, 'Perubahan tipe dari Sablon ke Printing');
                    END IF;
                END;
                RETURN NEW;
            END IF;

            -- Standard POLOS / SABLON updates (PRINTING has been handled above)
            is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
            IF delta_qty <> 0 OR OLD.order_type <> NEW.order_type THEN
                IF is_polos THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -delta_qty, -delta_qty, 'Revisi Qty Pesanan Polos');
                ELSE
                    DECLARE
                        old_is_polos BOOLEAN := (OLD.order_type IS NULL OR UPPER(OLD.order_type) = 'POLOS' OR UPPER(OLD.order_type) NOT IN ('SABLON', 'PRINTING'));
                    BEGIN
                        IF old_is_polos AND NOT is_polos THEN
                            -- Polos -> Sablon (kembalikan fisik polos, kurangkan ketersediaan baru)
                            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                            VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, old_actual_qty, 'Tipe berubah dari Polos ke Sablon');
                        ELSIF NOT old_is_polos AND is_polos THEN
                            -- Sablon -> Polos (kurangkan fisik polos baru)
                            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                            VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -delta_qty, -actual_qty, 'Tipe berubah dari Sablon ke Polos');
                        ELSE
                            -- Sablon -> Sablon
                            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                            VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, 0, 'Revisi Qty Pesanan Sablon');
                        END IF;
                    END;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
