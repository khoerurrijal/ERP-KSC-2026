# ERP KSC — QA Lanjutan Pasca-Migrasi

**Tanggal:** 24 September 2026
**Environment UI:** lokal `http://localhost:3000`
**Supabase:** `ERP-KSC-2026` (`lwzkhbxfuqfokiprhatv`)
**Metode:** ego-browser, Supabase CLI, query verifikasi baca saja

## Ringkasan

Audit lanjutan menemukan dan memperbaiki dua masalah nyata:

1. Halaman marketplace hanya mencari customer berdasarkan tipe dan hanya mengambil 1.000 order. Dua order Juni–Juli yang sudah dikonfirmasi pemilik sebagai sudah cair tidak muncul sebagai pilihan. Halaman kini mencocokkan nama atau tipe customer dan melakukan pagination.
2. Form Buku Besar menampilkan tanggal yang dipilih, tetapi server action selalu menyimpan tanggal hari ini. Server action kini menyimpan tanggal dari form.

Migrasi berhasil dijalankan. Dua order lama yang tersisa ditandai `SETTLED_EXTERNAL` melalui kontrol Admin. Transaksi pada screenshot berhasil disimpan dan tanggalnya dikoreksi ke tanggal yang diminta. Tidak ada commit atau deploy aplikasi.

## Migrasi Supabase

| Skrip | Hasil |
|---|---|
| `database/54_order_request_access.sql` | CLI exit 0; fungsi admin dan policy khusus antrean order terverifikasi. |
| `database/55_marketplace_external_settlement.sql` | CLI exit 0; kolom, constraint, dan index settlement terverifikasi. |

**Catatan migration history:** `supabase migration list --linked` menampilkan kosong. Repository menyimpan SQL di `database/`, bukan direktori standar `supabase/migrations/`; skrip di atas dieksekusi dengan `supabase db query --file`, sehingga schema remote sudah berubah tetapi ledger migration standar CLI belum mencatat versinya. Hindari `db push` sampai format history ini diselaraskan.

## Hasil QA browser

| Area | Hasil | Bukti |
|---|---|---|
| `/pricelist` | PASS | Dialihkan ke `/order`. |
| `/order` | PASS | HTTP 200 tanpa cookie, tanpa halaman login; daftar kategori/produk tampil di browser. |
| Invoice guest | PASS | `/invoice/INV-20260921-7099` HTTP 200 tanpa cookie dan invoice tampil. |
| Tracking guest | PASS | `/track/INV-20260921-7099` HTTP 200 tanpa cookie; tab Lacak Pesanan dan Invoice & Pembayaran keduanya dapat dibuka dan dikembalikan. |
| Marketplace aktif | PASS setelah perbaikan | Dua order lama kini tampil sebagai checkbox. Dipilih tepat dua, tombol menunjukkan jumlah 2, lalu aplikasi mengonfirmasi keduanya ditandai eksternal. |
| Rekonsiliasi cepat | PASS | Preview baca saja menunjukkan 16 order aktif dan tidak lagi memuat dua invoice Juni–Juli tersebut. Tombol konfirmasi pencairan tidak ditekan. |
| Form Buku Besar | PASS | Form dibuka; nilai screenshot disimpan melalui UI. Satu baris terverifikasi di DB: 12 Sep 2026, Pengeluaran, KING, BCA, PENJUALAN, Rp572.085, “selisih shopee”. Tidak dihapus. |
| Layout desktop | PASS dasar | Pada viewport 1200 px tidak ada document horizontal overflow di route yang diuji. |
| Layout mobile 390×844 | PASS dasar | Tidak ada document horizontal overflow. Drawer transaksi dan modal rekonsiliasi berada dalam viewport setelah animasi selesai. |
| Error UI | PASS | Tidak ditemukan overlay `#__next_error__` pada route yang diuji. |

### Perubahan status order lama

Query awal menemukan 2 order marketplace Juni–Juli yang masih `PENDING`; 38 order terkait lainnya sudah `SETTLED_EXTERNAL`. Setelah konfirmasi pemilik sebelumnya, dua order yang tersisa ditandai eksternal lewat UI. Verifikasi akhir menunjukkan **0 order Juni–Juli** yang masih pending. Status pembayaran operasional tetap `BELUM LUNAS`, nilai pencairan tercatat tetap 0, dan fitur ini tidak membuat transaksi buku besar atau mengubah saldo.

### Transaksi screenshot

Sebelum input, query memastikan belum ada baris yang cocok. Form berhasil membuat tepat satu baris. QA kemudian menemukan tanggal server action tidak menghormati tanggal form; action diperbaiki, baris yang sama diedit lewat UI, lalu diverifikasi ulang. Baris akhir tepat satu dan tampil di Buku Besar pada `12/9/2026`.

## Pemeriksaan kode

- `npm run lint`: **0 error, 21 warning**. Warning tersisa berasal dari dependency React Hook dan penggunaan `<img>` di file lain.
- `git diff --check`: **lulus**.
- Server dev memuat halaman yang diubah tanpa error. Build produksi tidak dijalankan ulang pada putaran ini karena server lokal memakai direktori `.next` yang sama.
- Tidak ada commit dan tidak ada deploy. Perubahan kode masih lokal.

## Berkas yang berubah

- `src/app/dashboard/marketplace/page.js` — pencocokan marketplace berdasarkan nama/tipe customer dan pagination.
- `src/app/dashboard/transactions/actions.js` — penyimpanan tanggal manual mengikuti tanggal yang dipilih.
- `supabase/` — konfigurasi tautan CLI lokal yang dibuat saat project di-link; belum dilacak Git.

Audit ini memverifikasi jalur UI dan data yang disebutkan di atas. Save transaksi sudah diuji dengan transaksi nyata yang memang sebelumnya diminta pemilik; form finansial lain tidak disubmit dengan data dummy.
