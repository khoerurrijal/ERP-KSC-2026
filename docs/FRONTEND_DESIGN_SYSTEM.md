# Design System dan Peta Audit UI King Sablon ERP

Dokumen ini menetapkan dasar tampilan bersama untuk seluruh halaman ERP, form, dan popup. Pemetaan mencakup route yang dirender dari `src/app` serta route pendek yang diarahkan melalui rewrite `next.config.mjs`.

## Hasil audit kondisi sekarang

- Semua halaman internal menggunakan `DashboardClientLayout`, `Sidebar`, dan `Topbar`; halaman publik memiliki layout masing-masing. Ini menjadi titik penerapan token dan pola kontrol bersama.
- `src/app/globals.css` semula memakai aurora animasi seluruh layar, watermark campuran gambar, filter blur 40px, panel blur 24px, dan shadow besar. Aurora animasi dan blur panel/glow dashboard dinonaktifkan; watermark logo tetap tampil statis di dark mode dan disembunyikan di light mode agar lebih ringan.
- Tema light lama memakai cream, hijau tua, dan mocha, sedangkan dark memakai emas dan ungu. Banyak komponen mengabaikan token tema dengan warna hard-code seperti `bg-white/5`, `text-white`, `bg-black/60`, `bg-[#18181B]`, dan opacity putih.
- Form dan popup dibangun dengan kelas lokal yang beragam. Overlay, warna permukaan, radius, padding, serta intensitas blur/shadow berubah antarhalaman; kelas warna lama sekarang dinormalisasi oleh lapisan token bersama. Panel lawas dengan radius 2xl/3xl, gradient, atau blur juga dinormalisasi agar memakai permukaan, radius, shadow, dan padding panel yang sama.
- Skala teks banyak memakai 10px dan 12px untuk catatan/status. Ukuran 10px sulit dibaca pada tabel dan layar resolusi rendah.
- Spacing panel beragam (`p-3` sampai `p-6`), radius dari `rounded-lg` hingga `rounded-2xl`, dan jarak antarkomponen tidak punya aturan tunggal. Sebagian tabel sudah dipadatkan secara global.
- Inter dipakai untuk seluruh UI, angka, nominal, dan kode. Gunakan digit tabular agar angka sejajar tanpa mengganti jenis font.
- Topbar dan sidebar sekarang ditempatkan tetap pada viewport; area konten internal yang bergulir. Navigasi drawer mobile ditutup sesudah link dipilih supaya backdrop tidak menahan klik.

## Token dasar

Token semantik di bawah berada di `src/app/globals.css`. Komponen lama memakai lapisan kompatibilitas yang mengarahkan warna putih/abu/status dan permukaan popup ke token; komponen baru sebaiknya memakai nama token langsung.

| Peran | Dark | Light | Pemakaian |
|---|---|---|---|
| Latar aplikasi | `#09090B` | `#F4F6F8` | Latar halaman |
| Teks utama | `#FAFAFA` | `#17212B` | Judul dan isi utama |
| Aksen utama | `#D4AF37` | `#8A6500` | Aksi utama, pilihan aktif |
| Aksen kedua | `#C084FC` | `#68439B` | Aksi/tautan sekunder |
| Permukaan | `#151517` | `#FFFFFF` | Panel, kartu, popup |
| Permukaan naik | `#1D1D20` | `#FFFFFF` | Header panel, menu pilihan |
| Permukaan redup | putih 5% | `#EEF1F4` | Hover, baris alternatif |
| Garis batas | putih 10% | `#D8DEE7` | Pemisah dan outline |
| Teks redup | `#A1A1AA` | `#5D6876` | Label sekunder |
| Berhasil / peringatan / gagal / info | hijau / kuning / merah / biru | hijau / kuning / merah / biru yang lebih gelap | Status saja; jangan dipakai dekoratif |

### Tipografi

| Gaya | Ukuran / tinggi baris | Aturan |
|---|---|---|
| Judul halaman | 22px / 28px, semibold | Satu judul utama per halaman |
| Judul bagian/panel (h2) | 16px / 22px, semibold | Header kartu dan bagian |
| Subjudul (h3) | 15px / 20px, semibold | Kelompok dalam panel dan dialog |
| Isi | 14px / 20px, regular | Teks form dan tabel |
| Label/keterangan | 12px / 16px | Batas minimum untuk metadata dan label |
| Angka ringkasan | 15–20px; angka utama 20–26px, responsif | Inter, digit tabular; hindari loncatan ukuran antar kartu |
| Angka tabel/kode | 12–14px, mengikuti kepadatan tabel | Inter, digit tabular; angka rata kanan dan sejajar |

Gunakan satu font Inter untuk teks, angka, nominal, invoice, dan kode. Digit tabular menjaga kolom angka tetap rapi tanpa memberi kesan monospace. Skala judul, utilitas font besar, dan font field form dipatok global; ukuran metadata lama di bawah 12px dinaikkan agar terbaca. Angka ringkasan memakai tingkat compact, umum, dan utama yang sama di semua modul. Angka tampilan memakai batas nol pecahan agar nominal/qty tidak menunjukkan angka desimal sisa pembulatan.

### Spacing, panel, dan kontrol

- Gunakan kelipatan 4px. Padding halaman internal: 12px layar kecil, 16px layar sedang, 20px desktop. Jarak antarbagian 16px; antargrup form 12px; padding panel 16px.
- Gunakan gap kolom 12–16px. Kurangi ruang kosong besar dengan grid responsif dan panel yang memakai lebar tersedia; jangan menghilangkan ruang antar-label atau memadatkan kontrol sampai sulit disentuh.
- Radius: 8px kontrol, 12px kartu/panel, 16px dialog. Hindari radius pill untuk permukaan besar.
- Input/select minimal 40px tinggi. Tombol utama dan sekunder minimal 40px; tombol ikon minimal area klik 40×40px.
- Tabel data memakai sel 8px vertikal × 12px horizontal pada mode padat, teks minimal 12px, header jelas, dan nilai nominal rata kanan. Beri opsi layout kartu di layar kecil untuk mencegah tabel melebar di luar viewport.
- Dialog memakai permukaan token, border token, overlay konsisten, header/body/footer yang jelas, tinggi maksimum mengikuti viewport, dan body dialog yang bisa digulir. Hindari membuat dialog bertumpuk kecuali alur memang membutuhkan konfirmasi.

### Aturan light mode dan perangkat rendah

- Light mode memakai permukaan solid; tidak memakai `backdrop-filter`, blur besar, aurora animasi, watermark campuran, atau shadow berlapis.
- Topbar dark memakai satu panel WebGL LiquidGlass yang menangkap konten halaman di belakangnya; topbar light tetap solid tanpa blur dan pustaka tidak dimuat demi performa.
- Jika WebGL tidak tersedia atau reduced transparency aktif, topbar memakai permukaan gelap CSS statis.
- Jangan menambahkan animasi dekoratif layar penuh. Gerakan yang tersisa singkat, tidak memblokir input, dan menghormati `prefers-reduced-motion`.
- Hindari gambar latar resolusi besar di belakang data dan hindari filter CSS pada area scroll.
- Pakai CSS token dan komponen native yang sudah ada; jangan menambah library UI, font, atau animasi untuk elemen sederhana.
- Pada patch ini, palet token light diselaraskan; animasi/blur panel dan dekorasi dashboard dimatikan; watermark tetap dipakai di dark mode; panel/input dibuat solid; shadow diringankan; warna status dipetakan ke token semantik. Permukaan putih khusus invoice cetak tetap dipertahankan.
- Font utama menunjuk langsung ke Inter yang sudah diunduh oleh `next/font`; field/tombol berukuran minimum 40px, teks label/metadata yang sebelumnya 7–11px dinaikkan ke 12px.

## Peta seluruh halaman

### Publik dan akses

| URL | Implementasi | Fokus konsistensi |
|---|---|---|
| `/` | `src/app/page.js` | Landing/redirect; jaga tipografi dan tombol publik |
| `/login` | `src/app/login/page.js` | Form login, validasi, state submit dan pesan gagal |
| `/order` | `src/app/order/page.js`, `OrderClient.jsx` | Katalog, form pesanan, pemilih produk, cart drawer, checkout |
| `/order/received` | `src/app/order/received/page.js` | Ringkasan dan status setelah pengajuan |
| `/track/[id]` | `src/app/track/[id]/page.js`, `TrackClient.jsx` | Timeline, status, popup QRIS |
| `/invoice/[invoice_number]` | `src/app/invoice/[invoice_number]/page.js`, `PublicInvoiceClient.jsx` | Invoice publik dan tindakan cetak |
| `/pricelist` | `src/app/pricelist/page.js` | Redirect ke `/order` sesuai keputusan LOCKED |

### ERP internal

| URL | Implementasi | Form/popup dan fokus audit |
|---|---|---|
| `/dashboard` | `src/app/dashboard/page.js` | Filter bulan, pencarian stok, kalkulator harga, kartu statistik/antrian/tempo |
| `/sales` | `src/app/dashboard/sales/page.js`, `SalesClient.jsx`, `SalesData.jsx` | Lookup SO, edit pembayaran/status, upload mockup, viewer gambar |
| `/sales/new` | `src/app/dashboard/sales/new/page.js`, `SalesOrderWizard.jsx` | Wizard buat SO dan seluruh input item |
| `/sales/edit/[id]` | `src/app/dashboard/sales/edit/[id]/page.js`, `SalesOrderWizard.jsx` | Form edit SO dengan pola field yang sama dengan form baru |
| `/sales/[id]/invoice` | `src/app/dashboard/sales/[id]/invoice/page.js`, `InvoiceClient.jsx` | Detail dan cetak invoice |
| `/dashboard/order-requests` dan `/dashboard/order-requests/[id]` | `src/app/dashboard/order-requests/` | Daftar dan detail permintaan; alur internal perlu membedakan aksi guest dan pembuatan SO sesuai LOCKED |
| `/marketplace` | `src/app/dashboard/marketplace/MarketplaceClient.jsx` | Settlement, aksi cepat, dan settlement batch |
| `/production` | `src/app/dashboard/production/ProductionData.jsx`, `ProductionTable.jsx` | Lookup lintas status, filter, update progress, koreksi qty, mockup |
| `/status-pesanan` | `src/app/dashboard/production/status/StatusPesananClient.jsx` | Daftar/status item pesanan |
| `/shipping` | `src/app/dashboard/production/shipping/ShippingConfirmationClient.jsx` | Konfirmasi pengiriman |
| `/inventory` | `src/app/dashboard/inventory/InventoryClient.jsx`, `InventoryData.jsx` | Lookup produk/stok, tab tabel, modal opname |
| `/inventory/mutasi` | `src/app/dashboard/inventory/mutasi/MutasiClient.jsx` | Pencarian histori mutasi; pertahankan aturan audit stok LOCKED |
| `/purchases` | `src/app/dashboard/purchases/PurchasesClient.jsx` | Lookup PO, tab invoice/item, bulan/status, dialog pelunasan |
| `/purchases/new` | `src/app/dashboard/purchases/new/page.js`, `PurchaseOrderWizard.jsx` | Wizard pembelian |
| `/purchases/[id]/edit` | `src/app/dashboard/purchases/[id]/edit/page.js`, `PurchaseOrderWizard.jsx` | Form edit pembelian |
| `/transactions` | `src/app/dashboard/transactions/TransactionsClient.jsx` | Lookup transaksi, filter, tambah/edit manual |
| `/finance/loans` | `src/app/dashboard/finance/loans/LoansClient.jsx` | Form dan status kasbon/pinjaman |
| `/payroll` | `src/app/dashboard/payroll/PayrollClient.jsx` | Form dan tabel payroll; jangan mengubah formula payroll BELUM LOCKED |
| `/report` | `src/app/dashboard/report/ReportClient.jsx` | Panel laporan dan dialog detail saldo |
| `/audit` | `src/app/dashboard/audit/AuditClient.jsx` | Panel temuan dan form tanya AI |
| `/master/products` | `src/app/dashboard/master/products/ProductsClient.jsx` | Lookup katalog, tambah/edit produk |
| `/master/customers` | `src/app/dashboard/master/customers/CustomersClient.jsx` | Lookup pelanggan, tambah/edit |
| `/master/suppliers` | `src/app/dashboard/master/suppliers/SuppliersClient.jsx` | Lookup supplier, tambah/edit |
| `/master/employees` | `src/app/dashboard/master/employees/EmployeesClient.jsx` | Tambah/edit karyawan |
| `/settings` dan `/settings/access` | `src/app/dashboard/settings/` | Akses/konfigurasi; konsistenkan field, switch, helper text |
| `/settings/salary-schemas` | `src/app/dashboard/settings/salary-schemas/SalarySchemaClient.jsx` | Form skema gaji; formula di luar ruang desain |
| `/system-config` | `src/app/dashboard/settings/page.js` | Konfigurasi sistem |

## Peta komponen bersama dan popup

Audit menemukan form, modal, atau overlay di file berikut. Seluruhnya masuk target pola input, dialog, overlay, tombol, focus state, dan warna token:

- Shell/navigasi/feedback: `src/components/DashboardClientLayout.jsx`, `Sidebar.js`, `Topbar.jsx`, `CustomAlertProvider.jsx`.
- Input dan kontrol bersama: `CustomSelect.jsx`, `CustomDatePicker.jsx`, `MonthFilter.jsx`, `CurrencyInput.jsx`, `StockSearchWidget.js`.
- Dialog/media bersama: `MockupUploadModal.jsx`, `ImageViewerModal.jsx`.
- Wizard/operasional: `SalesOrderWizard.jsx`, `PurchaseOrderWizard.jsx`, `ProductionTable.jsx`, `src/app/dashboard/production/shipping/ShippingConfirmationClient.jsx`.
- SO dan PO: `src/app/dashboard/sales/SalesClient.jsx`, `src/app/dashboard/purchases/PurchasesClient.jsx`, `src/app/dashboard/inventory/InventoryClient.jsx`.
- Master data: `src/app/dashboard/master/customers/CustomersClient.jsx`, `products/ProductsClient.jsx`, `suppliers/SuppliersClient.jsx`, `employees/EmployeesClient.jsx`.
- Keuangan dan sistem: `src/app/dashboard/transactions/TransactionsClient.jsx`, `finance/loans/LoansClient.jsx`, `payroll/PayrollClient.jsx`, `report/ReportClient.jsx`, `settings/salary-schemas/SalarySchemaClient.jsx`, `audit/AuditClient.jsx`, `marketplace/MarketplaceClient.jsx`.
- Publik: `src/app/login/page.js`, `src/app/order/OrderClient.jsx`, `src/app/track/[id]/TrackClient.jsx`, `src/app/invoice/[invoice_number]/PublicInvoiceClient.jsx`.

## Aturan konsistensi pencarian

- Kotak cari halaman melakukan lookup pada kumpulan data yang relevan, dan tidak diam-diam terkunci oleh filter bulan/status/tab. Filter dapat dipakai lagi setelah lookup dibersihkan.
- Field lookup punya label/placeholder yang menyebut objek yang dicari, tombol hapus yang mudah ditemukan, keadaan loading, hasil kosong, dan pesan gagal yang jelas.
- Input pencarian di dalam `CustomSelect` hanya untuk menyaring opsi dropdown, bukan lookup database halaman.
- Tabel hasil lookup tidak menyembunyikan data berbeda status/bulan; tampilkan status sebagai kolom. Aksi operasional mengikuti aturan status item LOCKED.

## Urutan penerapan design system

1. **Fondasi dan komponen global — diterapkan**: token semantik, font, input/select, tombol, permukaan, tabel padat, overlay/dialog, status, focus state, dan jembatan untuk kelas lama.
2. **ERP operasional — diterapkan melalui token global**: dashboard, lookup, Sales Order/produksi, gudang/PO, keuangan, master data, laporan, dan pengaturan. Kasus jarak kosong/overlap yang tampak di Dashboard juga dirapikan.
3. **Halaman publik — tercakup oleh token/kontrol global**: login, order, tracking, invoice tetap memakai layout publik masing-masing.
4. **Review visual lanjutan** — jalankan cek route dark/light desktop/mobile, seluruh popup/form, keyboard/focus, scrolling, empty/loading/error state, dan prefers-reduced-motion pada perubahan UI berikutnya.

Setiap tahap UI dijaga tetap terpisah dari perubahan formula, alur stok, transaksi keuangan, RLS, dan migration database.
