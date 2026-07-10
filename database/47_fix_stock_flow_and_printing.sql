-- 47_fix_stock_flow_and_printing.sql
-- Memperbaiki alur mutasi stok sales_items (UPDATE, PRINTING physical stock) dan production_logs (koreksi dan update).

-- 1. Definisikan ulang handle_sales_items_mutation() dengan penanganan lengkap
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
        
        -- Abaikan jika produk adalah JASA (tidak potong stok fisik/tersedia)
        IF UPPER(prod_cat) = 'JASA' THEN
            RETURN NEW;
        END IF;

        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = NEW.so_id;
        
        -- Tentukan jenis order: POLOS, SABLON, atau PRINTING
        is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
        actual_qty := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
        
        -- Jangan potong stok jika statusnya BATAL sejak awal
        IF NEW.status != 'BATAL' THEN
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -actual_qty, -actual_qty, 'Penjualan Polos');
            ELSE
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, 0, 'Penjualan Sablon/Printing (Pending)');
            END IF;
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

        -- Hanya kembalikan stok jika statusnya tidak BATAL
        IF OLD.status != 'BATAL' THEN
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (OLD.product_code, 'REVERT_OUT_POLOS', OLD.id, so_num, actual_qty, actual_qty, 'Hapus Data Penjualan Polos');
            ELSE
                -- Untuk Sablon/Printing: kembalikan ketersediaan stok
                -- Untuk Printing yang sudah selesai dikirim/diambil: kembalikan juga stok fisik
                was_comp := (OLD.status IN ('DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'));
                IF UPPER(OLD.order_type) = 'PRINTING' AND was_comp THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (OLD.product_code, 'REVERT_OUT_SABLON', OLD.id, so_num, actual_qty, actual_qty, 'Hapus Data Penjualan Printing (Selesai)');
                ELSE
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (OLD.product_code, 'REVERT_OUT_SABLON', OLD.id, so_num, actual_qty, 0, 'Hapus Data Penjualan Sablon/Printing');
                END IF;
            END IF;
        END IF;

        RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
        SELECT category INTO prod_cat FROM public.products WHERE product_code = NEW.product_code;
        
        IF UPPER(prod_cat) = 'JASA' THEN
            RETURN NEW;
        END IF;

        SELECT invoice_number INTO so_num FROM public.sales_orders WHERE id = NEW.so_id;
        
        is_polos := (NEW.order_type IS NULL OR UPPER(NEW.order_type) = 'POLOS' OR UPPER(NEW.order_type) NOT IN ('SABLON', 'PRINTING'));
        actual_qty := NEW.qty * COALESCE(NEW.unit_multiplier, 1);
        old_actual_qty := OLD.qty * COALESCE(OLD.unit_multiplier, 1);
        delta_qty := actual_qty - old_actual_qty;

        -- KASUS 1: Perubahan status menjadi BATAL
        IF OLD.status != 'BATAL' AND NEW.status = 'BATAL' THEN
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'REVERT_OUT_POLOS', NEW.id, so_num, old_actual_qty, old_actual_qty, 'Pembatalan Pesanan Polos');
            ELSE
                was_comp := (OLD.status IN ('DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'));
                IF UPPER(OLD.order_type) = 'PRINTING' AND was_comp THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'REVERT_OUT_SABLON', NEW.id, so_num, old_actual_qty, old_actual_qty, 'Pembatalan Pesanan Printing (Selesai)');
                ELSE
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'REVERT_OUT_SABLON', NEW.id, so_num, old_actual_qty, 0, 'Pembatalan Pesanan Sablon/Printing');
                END IF;
            END IF;

        -- KASUS 2: Re-aktivasi status dari BATAL ke aktif
        ELSIF OLD.status = 'BATAL' AND NEW.status != 'BATAL' THEN
            IF is_polos THEN
                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -actual_qty, -actual_qty, 'Re-aktivasi Pesanan Polos');
            ELSE
                is_comp := (NEW.status IN ('DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'));
                IF UPPER(NEW.order_type) = 'PRINTING' AND is_comp THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, -actual_qty, 'Re-aktivasi Pesanan Printing (Selesai)');
                ELSE
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -actual_qty, 0, 'Re-aktivasi Pesanan Sablon/Printing');
                END IF;
            END IF;

        -- KASUS 3: Transaksi aktif (perubahan kuantitas atau tipe order atau status operasional)
        ELSIF OLD.status != 'BATAL' AND NEW.status != 'BATAL' THEN
            IF delta_qty <> 0 OR OLD.order_type <> NEW.order_type THEN
                IF is_polos THEN
                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                    VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -delta_qty, -delta_qty, 'Revisi Qty Pesanan Polos');
                ELSE
                    DECLARE
                        old_is_polos BOOLEAN := (OLD.order_type IS NULL OR UPPER(OLD.order_type) = 'POLOS' OR UPPER(OLD.order_type) NOT IN ('SABLON', 'PRINTING'));
                    BEGIN
                        IF old_is_polos AND NOT is_polos THEN
                            -- Polos -> Sablon/Printing (kembalikan fisik polos, kurangkan ketersediaan baru)
                            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                            VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, old_actual_qty, 'Tipe berubah dari Polos ke Sablon/Printing');
                        ELSIF NOT old_is_polos AND is_polos THEN
                            -- Sablon/Printing -> Polos (kurangkan fisik polos baru)
                            INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                            VALUES (NEW.product_code, 'OUT_POLOS', NEW.id, so_num, -delta_qty, -actual_qty, 'Tipe berubah dari Sablon/Printing ke Polos');
                        ELSE
                            -- Sablon/Printing -> Sablon/Printing
                            IF UPPER(NEW.order_type) = 'PRINTING' THEN
                                was_comp := (OLD.status IN ('DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'));
                                is_comp := (NEW.status IN ('DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'));
                                IF was_comp AND is_comp THEN
                                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, -delta_qty, 'Revisi Qty Pesanan Printing (Selesai)');
                                ELSIF NOT was_comp AND is_comp THEN
                                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, -actual_qty, 'Revisi Qty & Kirim Pesanan Printing');
                                ELSIF was_comp AND NOT is_comp THEN
                                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, old_actual_qty, 'Revisi Qty & Tarik Pengiriman Printing');
                                ELSE
                                    INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                                    VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, 0, 'Revisi Qty Pesanan Printing');
                                END IF;
                            ELSE
                                -- Sablon -> Sablon
                                INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                                VALUES (NEW.product_code, 'OUT_SABLON', NEW.id, so_num, -delta_qty, 0, 'Revisi Qty Pesanan Sablon');
                            END IF;
                        END IF;
                    END;
                END IF;
            ELSE
                -- Kuantitas sama (delta = 0), cek perubahan status pengiriman untuk PRINTING
                IF UPPER(NEW.order_type) = 'PRINTING' THEN
                    was_comp := (OLD.status IN ('DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'));
                    is_comp := (NEW.status IN ('DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'));
                    IF NOT was_comp AND is_comp THEN
                        INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                        VALUES (NEW.product_code, 'OUT_PRODUKSI', NEW.id, so_num, 0, -actual_qty, 'Penggunaan Bahan Baku Printing (Selesai)');
                    ELSIF was_comp AND NOT is_comp THEN
                        INSERT INTO public.stock_mutations (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes)
                        VALUES (NEW.product_code, 'REVERT_PRODUKSI', NEW.id, so_num, 0, actual_qty, 'Batal Penggunaan Bahan Baku Printing');
                    END IF;
                END IF;
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Definisikan ulang handle_production_logs_mutation() dengan penanganan lengkap (INSERT, UPDATE, DELETE)
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
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT si.product_code, so.invoice_number 
        INTO v_product_code, v_invoice_number 
        FROM public.sales_items si 
        JOIN public.sales_orders so ON si.so_id = so.id 
        WHERE si.id = NEW.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(prod_cat) = 'JASA' THEN
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
        SELECT si.product_code, so.invoice_number 
        INTO v_product_code, v_invoice_number 
        FROM public.sales_items si 
        JOIN public.sales_orders so ON si.so_id = so.id 
        WHERE si.id = NEW.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(prod_cat) = 'JASA' THEN
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
        SELECT si.product_code, so.invoice_number 
        INTO v_product_code, v_invoice_number 
        FROM public.sales_items si 
        JOIN public.sales_orders so ON si.so_id = so.id 
        WHERE si.id = OLD.job_id;

        IF v_product_code IS NOT NULL THEN
            SELECT category INTO prod_cat FROM public.products WHERE product_code = v_product_code;
            IF UPPER(prod_cat) = 'JASA' THEN
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
