-- IMPORTANT
-- This patch intentionally does NOT repair historical negative balances.
-- Apply first to stop new leakage, then reconcile historical service mutations separately.
-- Rollback: restore handle_sales_items_mutation() from migration 49 and
-- handle_production_logs_mutation() from migration 47.

-- Migration 56: Lock service items out of inventory mutations
-- Owner rule: JASA / Jasa Layanan / DLL are non-stock. PRINTING remains vendor/non-stock.
-- Scope: only stock mutation guards; historical balances are intentionally untouched.

CREATE OR REPLACE FUNCTION handle_sales_items_mutation()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
    so_num VARCHAR;
    is_polos BOOLEAN;
    prod_cat VARCHAR;
    old_prod_cat VARCHAR;
    old_is_service BOOLEAN;
    new_is_service BOOLEAN;
    old_is_polos BOOLEAN;
    actual_qty INTEGER;
    old_actual_qty INTEGER;
    delta_qty INTEGER;
    was_comp BOOLEAN;
    is_comp BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Ambil kategori produk
        SELECT category INTO prod_cat FROM public.products WHERE product_code = NEW.product_code;

        -- JASA/Jasa Layanan/DLL adalah non-stock; PRINTING tetap vendor/non-stock.
        IF UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
           OR UPPER(TRIM(COALESCE(NEW.order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA', 'PRINTING') THEN
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

        IF UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
           OR UPPER(TRIM(COALESCE(OLD.order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA', 'PRINTING') THEN
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
        SELECT category INTO old_prod_cat FROM public.products WHERE product_code = OLD.product_code;
        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = NEW.so_id;

        actual_qty := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
        old_actual_qty := OLD.qty * COALESCE(OLD.unit_multiplier, 1);
        delta_qty := actual_qty - old_actual_qty;

        new_is_service := UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
            OR UPPER(TRIM(COALESCE(NEW.order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA');
        old_is_service := UPPER(TRIM(COALESCE(old_prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
            OR UPPER(TRIM(COALESCE(OLD.order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA');

        -- Service -> service: tidak pernah menyentuh stok.
        IF old_is_service AND new_is_service THEN
            RETURN NEW;
        END IF;

        -- Service -> stock item: perlakukan sebagai aktivasi stok baru.
        IF old_is_service AND NOT new_is_service THEN
            IF NEW.status = 'BATAL' OR UPPER(TRIM(COALESCE(NEW.order_type, ''))) = 'PRINTING' THEN
                RETURN NEW;
            END IF;

            is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -actual_qty, -actual_qty, 'Perubahan tipe dari Jasa ke Polos');
            ELSE
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, 0, 'Perubahan tipe dari Jasa ke Sablon');
            END IF;
            RETURN NEW;
        END IF;

        -- Stock item -> service: pulihkan stok lama lalu hentikan semua mutasi berikutnya.
        IF NOT old_is_service AND new_is_service THEN
            IF OLD.status = 'BATAL' OR UPPER(TRIM(COALESCE(OLD.order_type, ''))) = 'PRINTING' THEN
                RETURN NEW;
            END IF;

            old_is_polos := (OLD.order_type IS NULL OR UPPER(OLD.order_type) = 'POLOS' OR UPPER(OLD.order_type) NOT IN ('SABLON', 'PRINTING'));
            IF old_is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (OLD.product_code, 'REVERT_OUT_POLOS', NEW.id, so_num, old_actual_qty, old_actual_qty, 'Perubahan tipe dari Polos ke Jasa');
            ELSE
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (OLD.product_code, 'REVERT_OUT_SABLON', NEW.id, so_num, old_actual_qty, 0, 'Perubahan tipe dari Sablon ke Jasa');
            END IF;
            RETURN NEW;
        END IF;

        -- Jika keduanya PRINTING, bypass seluruh mutasi stok.
        IF UPPER(COALESCE(OLD.order_type, '')) = 'PRINTING' AND UPPER(COALESCE(NEW.order_type, '')) = 'PRINTING' THEN
            RETURN NEW;
        END IF;

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

-- Production log guard: service/printing items must never mutate inventory
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
    prod_cat VARCHAR;
    v_order_type VARCHAR;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT si.product_code, si.order_type, so.invoice_number
        INTO v_product_code, v_order_type, v_invoice_number
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = NEW.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
               OR UPPER(TRIM(COALESCE(v_order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA', 'PRINTING') THEN
                RETURN NEW;
            END IF;

            v_qty_processed := COALESCE(NEW.qty_processed, 0);
            v_qty_defect := COALESCE(NEW.qty_defect, 0);

            -- Qty Processed memotong stok fisik saja
            IF v_qty_processed <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'OUT_PRODUKSI', NEW.id, v_invoice_number, 0, -v_qty_processed, 'Penggunaan Bahan Baku Sablon');
            END IF;

            -- Qty Defect memotong stok fisik DAN stok tersedia
            IF v_qty_defect <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'OUT_DEFECT', NEW.id, v_invoice_number, -v_qty_defect, -v_qty_defect, 'Defect Produksi Sablon');
            END IF;
        END IF;

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        SELECT si.product_code, si.order_type, so.invoice_number
        INTO v_product_code, v_order_type, v_invoice_number
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = NEW.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
               OR UPPER(TRIM(COALESCE(v_order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA', 'PRINTING') THEN
                RETURN NEW;
            END IF;

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
        END IF;

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        SELECT si.product_code, si.order_type, so.invoice_number
        INTO v_product_code, v_order_type, v_invoice_number
        FROM public.sales_items si
        JOIN public.sales_orders so ON si.so_id = so.id
        WHERE si.id = OLD.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(TRIM(COALESCE(prod_cat, ''))) IN ('JASA', 'JASA LAYANAN')
               OR UPPER(TRIM(COALESCE(v_order_type, ''))) IN ('DLL', 'JASA', 'LAINNYA', 'PRINTING') THEN
                RETURN OLD;
            END IF;

            v_old_processed := COALESCE(OLD.qty_processed, 0);
            v_old_defect := COALESCE(OLD.qty_defect, 0);

            -- Kembalikan fisik
            IF v_old_processed <> 0 THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (v_product_code, 'REVERT_PRODUKSI', OLD.id, v_invoice_number, 0, v_old_processed, 'Hapus Log Produksi Sablon');
            END IF;

            -- Kembalikan fisik & tersedia
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
