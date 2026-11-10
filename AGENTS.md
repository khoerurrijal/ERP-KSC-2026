<!-- BEGIN:nextjs-agent-rules -->
# Owner-locked ERP decisions

## Arti LOCKED — WAJIB
- Rule berlabel LOCKED adalah keputusan Owner dan baseline production. Jangan ditanyakan ulang, didesain ulang, disederhanakan, atau diubah hanya karena implementasi lama berbeda.
- Jika kode/database berbeda dari rule LOCKED, perlakukan sebagai BUG/REGRESSION IMPLEMENTASI. Audit read-only, buktikan penyimpangannya, lalu buat patch sekecil mungkin.
- Jangan menyentuh flow sehat saat memperbaiki bug lain. Tidak boleh refactor lintas modul, cleanup massal, rename besar, atau perubahan formula sampingan tanpa scope Owner yang eksplisit.
- Membuka kembali rule LOCKED hanya boleh jika Owner secara eksplisit mengatakan rule tersebut diubah/dibuka kembali.
- Sebelum perubahan production: audit kondisi aktual -> pisahkan fakta/asumsi -> siapkan rollback -> validasi/test -> apply minimal -> regression test -> laporkan bukti.

## LOCKED — akses publik & integrasi
- Guest hanya boleh membuat `customer_order_requests` berstatus pending; guest tidak boleh membuat customer, Sales Order, item, stok, invoice, atau transaksi operasional.
- `/order`, `/track`, dan `/invoice` adalah public tanpa login. `/pricelist` hanya redirect ke `/order`, bukan public entry point terpisah.
- DOKU disabled total sampai Owner memberi approval tertulis untuk mengaktifkannya kembali. QRIS dan transfer manual tetap dipakai.
- Satu event masuk WhatsApp boleh menghasilkan maksimal satu balasan outbound dan satu history model. Retry provider wajib atomic-dedup.

## LOCKED — stok & tipe order
- `JASA`, kategori `Jasa Layanan`, dan order type `DLL` adalah NON-STOCK. Tidak boleh membuat pengurangan/penambahan stok operasional.
- Mapping live `DLL -> Jasa Layanan` adalah keputusan final. Jangan ubah DLL menjadi barang stok.
- `PRINTING` adalah vendor fulfillment dan tidak menggunakan stok KING/GUDANG/GLOBAL. PRINTING wajib zero inventory mutation.
- Semua perubahan stok wajib memiliki jejak di `stock_mutations` / STOK_MUTASI. Jangan mengubah saldo stok langsung.
- POLOS tetap mengikuti flow stok POLOS yang sudah berjalan; jangan mengubah timing/jenis mutasinya tanpa approval Owner.
- SABLON tetap mengikuti flow reserve/produksi yang sudah berjalan; production log SABLON tetap menjadi bagian flow stok fisik sesuai implementasi sehat saat ini.
- Defect/cacat produksi tetap dicatat melalui mutasi; jangan menghapus jejak defect.
- Migration `56_fix_service_stock_bypass.sql` dan perilaku production setelah commit `dae9eb9` adalah baseline P0 yang sudah diverifikasi. Jangan meregresikan bypass JASA/DLL/PRINTING.
- Saldo historis yang terlanjur salah/negatif TIDAK boleh dibersihkan otomatis. Rekonsiliasi historis adalah pekerjaan terpisah dan harus memakai audit + STOK_MUTASI resmi.

## LOCKED — Sales Order & produksi
- Status operasional berada di level `sales_items` / detail item, bukan hanya header invoice.
- Satu invoice BOLEH memiliki beberapa item dengan status pengerjaan berbeda.
- Jangan memaksa semua item satu invoice mempunyai status produksi yang sama.
- Status granular production/shipping yang sudah live tetap dipertahankan. Jangan disederhanakan kembali hanya untuk mengikuti dokumen lama.
- Item service/DLL tidak boleh masuk alur produksi SABLON otomatis.

## LOCKED — marketplace & keuangan
- Settlement Shopee/Tokopedia tetap dicatat secara BATCH seperti flow production saat ini.
- Fee marketplace tidak perlu dibuat sebagai transaksi biaya terpisah. Selisih omzet kotor dengan settlement bersih menjadi dasar rekonsiliasi.
- `SETTLED_EXTERNAL` berarti order sudah dibayar di luar ERP dan tidak membuat cash transaction baru.
- Jangan menyamakan omzet kotor dengan dana settlement bersih.
- Semua pemasukan/pengeluaran riil tetap dicatat melalui `transactions`; jangan mengubah saldo kas langsung.
- PO hanya menggunakan status pembayaran `TEMPO` dan `LUNAS`.
- Untuk flow lama PO LUNAS yang benar-benar dihapus, transaksi terkait PO ikut rollback sesuai implementasi existing. Jangan diam-diam mengganti kebijakan ini menjadi VOID/reversal tanpa keputusan Owner baru.

## LOCKED — migration & production safety
- Repository KSC menyimpan migration operasional di `database/*.sql`. Migration 54/55/56 terbukti dijalankan dengan `supabase db query --file`.
- Jangan memakai `supabase db push` sampai migration history standar Supabase sengaja diselaraskan dan disetujui.
- Untuk migration berisiko: validasi terlebih dahulu dengan transaksi `BEGIN ... ROLLBACK` bila memungkinkan sebelum apply nyata.
- Migration harus fokus dan idempotent. Tidak boleh menambah atau menjalankan perubahan RLS global tanpa approval Owner.
- Setelah perubahan kritis wajib regression test minimal terhadap flow yang bersinggungan, lalu jalankan lint/build/diff-check yang relevan.
- Setiap dirty change wajib dikategorikan sebelum commit/deploy; file eksperimen, temporary, dan migration yang belum disetujui tidak boleh masuk production.

## BELUM LOCKED — JANGAN DIUBAH OTOMATIS
- Formula HPP histori PO belum final. Ada konflik implementasi antara 3 PO terakhir vs seluruh histori. Jangan mengubah HPP/harga live tanpa shadow audit dan keputusan Owner.
- Rekomendasi teknis sementara untuk evaluasi HPP adalah weighted average maksimal 3 PO terbaru berdasarkan actual quantity, tetapi ini BUKAN rule production sampai disetujui setelah shadow comparison.
- Aturan payroll terbaru belum diverifikasi ulang. Jangan mengubah formula payroll/denda berdasarkan catatan historis saja.
- Mekanisme khusus SO salah input/batal setelah sudah ada pembayaran belum menjadi flow production yang di-lock. Jangan membuat refund/reversal/transfer payment otomatis tanpa kasus nyata dan approval Owner.

## LOCKED — pencarian operasional
- Kolom pencarian umum yang dipakai karyawan tidak boleh mengandalkan nomor invoice otomatis sebagai kata kunci atau petunjuk default. Karyawan biasanya tidak mengetahui nomor tersebut.
- Pencarian umum harus cocok dengan istilah yang mudah diketahui pengguna, seperti nama pelanggan/brand, nama produk, status, keterangan pekerjaan, atau kode operasional yang memang digunakan pengguna.
- Nomor invoice boleh tetap tampil sebagai referensi internal dan dipakai pada halaman khusus yang memang meminta nomor invoice, seperti `/track` atau `/invoice`; jangan memasukkannya sebagai sumber pencarian umum.

# Project Instructions for AI Agent

## Framework
This project uses Next.js App Router and may use features newer than your training data.

If framework behavior is uncertain:
- Read only the specific documentation needed.
- Do NOT scan all documentation files.

## Repository Scope
Default scope:
- src/
- public/
- package.json
- next.config.mjs
- eslint.config.mjs
- postcss.config.mjs

Ignore by default:
- .next/
- node_modules/
- .git/
- database/backups/
- *.log
- dist/
- build/

Never recursively scan the entire repository unless explicitly requested.

## Working Rules
1. Read only files explicitly mentioned by the user.
2. Before changing code:
   - Explain the problem.
   - Give a short plan (3–5 bullets).
3. Prefer minimal patches.
4. Do not refactor unrelated files.
5. Do not rename files unless required.
6. Do not add dependencies unless necessary.
7. Do not modify environment variables unless requested.
8. Preserve existing project structure and coding style.

## Debugging Rules
For errors:
1. Identify the likely root cause.
2. Mention which file(s) need modification.
3. Provide the smallest possible fix.
4. Stop after solving the requested issue.

## Performance Rules
- Avoid reading large generated files.
- Avoid indexing unnecessary directories.
- Avoid repeatedly opening the same files.
- Ask for clarification if required files are missing.

## Response Format
For every task:
1. Problem summary
2. Proposed plan
3. Files to modify
4. Minimal patch
5. Verification steps

## Token Efficiency
- Never scan the whole repository for a single bug.
- Read at most 3 related files unless explicitly requested.
- Prefer searching by filename and error message first.
- For UI bugs, inspect only the affected page and directly imported components.
- Stop after producing the minimal fix.

<!-- END:nextjs-agent-rules -->
