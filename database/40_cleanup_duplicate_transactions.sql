
-- ==========================================
-- 40_CLEANUP_DUPLICATE_TRANSACTIONS.sql
-- ==========================================

-- 1. Hapus Penyesuaian Saldo Excel Lama
DELETE FROM public.transactions 
WHERE reference IN ('ADJUSTMENT_EXCEL', 'ADJUST_BANK_EXCEL');

-- 2. Hapus Transaksi Duplikat Secara Akurat (Menyimpan 1 data yang paling awal di-insert)
-- Logika: Menggunakan ROW_NUMBER untuk mengelompokkan data yang SAMA PERSIS.
-- Data pertama (paling tua) diberi nomor 1. Nomor 2 dan seterusnya (duplikatnya) akan dihapus.
DELETE FROM public.transactions
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY date, COALESCE(description, ''), amount_in, amount_out, workshop_code, COALESCE(payment_method, '')
                   ORDER BY created_at ASC
               ) as rnum
        FROM public.transactions
        WHERE reference IS NULL OR reference NOT IN ('ADJUSTMENT_EXCEL', 'ADJUST_BANK_EXCEL')
    ) t
    WHERE t.rnum > 1
);
