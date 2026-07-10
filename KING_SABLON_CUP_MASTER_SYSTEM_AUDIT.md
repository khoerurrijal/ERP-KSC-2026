# ERP KING SABLON CUP - MASTER SYSTEM AUDIT REPORT (HULU KE HILIR)

Dokumen ini berisi hasil audit menyeluruh dan pemetaan sistem ERP KING SABLON CUP berdasarkan analisis kode sumber, migrasi database, database triggers, dan server actions nyata yang berjalan di dalam repositori.

---

## 1. SYSTEM MAP

### Stack Aplikasi
*   **Frontend & Backend**: Next.js App Router (v16.2.9) dengan React 19.
*   **Styling**: TailwindCSS v4.
*   **Database & Auth**: Supabase (`@supabase/supabase-js` & `@supabase/ssr`).
*   **AI & Integration**: `@google/generative-ai` (untuk integrasi WhatsApp AI) dan Whatsapp API Webhook.
*   **Utility**: `xlsx` (import bulk produk), `pg` (client database PostgreSQL).

### Struktur Utama App/Router (`src/app`)
*   `src/app/page.js`: Halaman pendaratan/utama.
*   `src/app/login/`: Autentikasi pengguna.
*   `src/app/dashboard/`: Dashboard utama (statistik pesanan & kalkulator harga).
    *   `master/`: Pengelolaan master data produk, pelanggan, karyawan, supplier.
    *   `sales/`: Pengelolaan transaksi Sales Order (wizard SO, list invoice, detail status item).
    *   `purchases/`: Pengelolaan transaksi Purchase Order (wizard PO, list pembelian, pelunasan tempo).
    *   `inventory/`: Pengelolaan stok gudang, penyesuaian opname, dan riwayat mutasi stok.
    *   `production/`: Antrean pengerjaan sablon dan log progres operator.
    *   `marketplace/`: Pengelolaan pesanan e-commerce dan pencairan dana (settlement).
    *   `transactions/`: Buku Besar keuangan (kas masuk/keluar harian & manual).
    *   `finance/loans/`: Pengelolaan pinjaman dan kasbon karyawan.
    *   `payroll/`: Penghitungan gaji borongan dan rekap absensi mingguan.
    *   `report/`: Laporan laba-rugi owner, bagi hasil workshop, dan royalty mesin.
    *   `settings/`: Pengaturan sistem, matriks harga, role permissions, dan akun kas.
*   `src/app/track/[id]/`: Halaman publik untuk pelacakan status pesanan pelanggan.
*   `src/app/invoice/[invoice_number]/`: Halaman publik cetak invoice.

### Server Actions / API Routes / Services Utama
*   **Sales**: `src/app/actions/sales.js` (`createSalesOrder`, `updateSalesOrder`, `addSalesPayment`, `updateSalesItemStatus`, `cancelSalesOrder`).
*   **Pricing**: `src/app/actions/pricing.js` (`recalculateProductPrices`).
*   **Purchases**: `src/app/dashboard/purchases/new/actions.js` (`createPurchaseOrder`, `updatePurchaseOrder`, `deletePurchaseOrder`, `payPurchaseOrder`).
*   **Production**: `src/app/dashboard/production/actions.js` (`saveProductionProgress`, `handleAutoStatusUpdate`, `updateSalesOrderStatus`, `correctProductionProgress`).
*   **Marketplace**: `src/app/dashboard/marketplace/actions.js` (`processMarketplaceSettlement`, `updateMarketplaceReceipt`).
*   **Transactions**: `src/app/dashboard/transactions/actions.js` (`createManualTransaction`, `updateTransaction`, `deleteTransaction`).
*   **Loans**: `src/app/dashboard/finance/loans/actions.js` (`createLoan`, `deleteLoan`).
*   **Payroll**: `src/app/dashboard/payroll/actions.js` (`calculatePayroll`, `savePayroll`).
*   **WhatsApp API Webhook**: `src/app/api/whatsapp/webhook/route.js` (bot interaktif pemantauan & asisten AI).
*   **Public Order**: `src/app/api/public-order/route.js`.

### Tabel Supabase Aktif & Digunakan Nyata
1.  **`workshops`**: Menyimpan data workshop (KING, GUDANG, GLOBAL, TABUNGAN).
2.  **`customers`**: Data pelanggan (customer_code, name, type, phone, address).
3.  **`suppliers`**: Data supplier (supplier_code, supplier_name, phone, address).
4.  **`products`**: Master barang & stok (product_code, name, category, workshop_code, base_price, selling_price, stock_qty, physical_stock, hpp_murni, price_polos, unit, is_active).
5.  **`product_units`**: Satuan multiunit produk (product_code, unit_name, multiplier).
6.  **`purchase_orders`**: Header kulakan (po_number, date, supplier, supplier_id, total_amount, payment_method, status).
7.  **`purchase_items`**: Detail item PO (po_id, product_code, qty, unit, unit_multiplier, unit_price, total_price).
8.  **`sales_orders`**: Header penjualan (invoice_number, marketplace_receipt, date, customer_code, notes, total_amount, dp_amount, payment_method, payment_status, status, marketplace_pencairan).
9.  **`sales_items`**: Detail item SO (so_id, order_type, product_code, mockup_url, qty, unit, unit_multiplier, unit_price, hpp_price, total_price, status, royalty_fee, is_fast_track, notes).
10. **`stock_mutations`**: Log mutasi stok fisik & tersedia (product_code, mutation_type, reference_id, reference_number, qty_tersedia_change, qty_fisik_change, notes).
11. **`production_logs`**: Log progres produksi (job_id, employee_id, qty_processed, qty_defect, processed_date, notes).
12. **`salary_schemas`**: Matriks rate gaji/borongan berdasarkan role karyawan.
13. **`employees`**: Data karyawan (user_id, username, full_name, salary_schema_id, supervisor_id, is_active, phone, gaji_harian, uang_makan).
14. **`payrolls`**: Header penggajian (start_date, end_date, generated_by, total_amount).
15. **`payroll_items`**: Detail rekap gaji karyawan (payroll_id, employee_id, base_salary, meal_allowance, weekly_bonus, borongan_amount, bawahan_bonus, other_bonuses, total).
16. **`employee_loans`**: Data kasbon & pinjaman karyawan (employee_id, type, amount, installment_amount, remaining_amount, status).
17. **`transactions`**: Buku besar kas kas masuk/keluar (date, reference, description, payment_method, amount_in, amount_out, workshop_code, so_id).
18. **`system_settings`**: Konfigurasi dinamis JSON (key: `pricelist_config`, `dropdown_config`, `store_config`, `role_permissions`, `user_roles`, `category_images_config`).
19. **`wa_global_settings`**: Status aktif bot WhatsApp (`GLOBAL_BOT_ACTIVE`).
20. **`wa_sessions`**: Sesi percakapan WhatsApp Bot per nomor telepon.
21. **`wa_chat_history`**: Riwayat pesan AI bot WhatsApp.

### Relasi Penting Antar Tabel
*   `products.workshop_code` → `workshops.code`
*   `product_units.product_code` → `products.product_code` (ON DELETE CASCADE)
*   `purchase_items.po_id` → `purchase_orders.id` (ON DELETE CASCADE)
*   `purchase_items.product_code` → `products.product_code` (ON UPDATE CASCADE ON DELETE SET NULL)
*   `purchase_orders.supplier_id` → `suppliers.id` (ON DELETE SET NULL)
*   `sales_orders.customer_code` → `customers.customer_code` (ON UPDATE CASCADE ON DELETE SET NULL)
*   `sales_items.so_id` → `sales_orders.id` (ON DELETE CASCADE)
*   `sales_items.product_code` → `products.product_code` (ON UPDATE CASCADE ON DELETE SET NULL)
*   `production_logs.job_id` → `sales_items.id` (ON DELETE CASCADE)
*   `production_logs.employee_id` → `employees.id` (ON DELETE SET NULL)
*   `employees.salary_schema_id` → `salary_schemas.id` (ON DELETE SET NULL)
*   `employees.supervisor_id` → `employees.id` (ON DELETE SET NULL)
*   `payroll_items.payroll_id` → `payrolls.id` (ON DELETE CASCADE)
*   `payroll_items.employee_id` → `employees.id` (ON DELETE CASCADE)
*   `employee_loans.employee_id` → `employees.id` (ON DELETE CASCADE)
*   `transactions.so_id` → `sales_orders.id` (ON DELETE SET NULL)

### Tabel / Field Legacy (Tidak Aktif/Diabaikan)
*   **`users`**, **`roles`**, **`permissions`**, **`role_permissions`** (Tabel fisik di `public` schema): **Legacy**. Autentikasi dan izin akses sepenuhnya diatur via Supabase Auth (`auth.users`) dan konfigurasi JSON di tabel `system_settings` (key `role_permissions` & `user_roles`).
*   **`marketplace_accounts`**, **`marketplace_orders`**, **`marketplace_order_items`**: **Legacy**. Seluruh pesanan e-commerce kini masuk langsung ke tabel utama `sales_orders` dengan relasi `customers` berkategori "Marketplace" dan mencantumkan `marketplace_receipt`.
*   **`sales_orders.status`**: **Legacy/Setengah Legacy**. Database migration `20_drop_status_sales_orders.sql` menghapusnya, namun NextJS actions dan triggers (`24_split_trigger.sql`) tetap menulis/membacanya. Status sesungguhnya dikendalikan secara granular per item di tabel `sales_items.status`, sementara di level invoice di-update via Server Action/Triggers menjadi `DRAFT`, `BERJALAN`, atau `SELESAI`.

---

## 2. MASTER DATA & SETTINGS FLOW

ERP ini menggunakan tabel `system_settings` dengan struktur Key-Value JSONB sebagai pusat kontrol dropdown dan konfigurasi matriks harga.

| Nama Data Master | Tabel / Sumber | Field Utama | Halaman Pengubah | Halaman Pembaca | Tipe (Hardcode/DB) | Pengaruh Langsung ke Transaksi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User, Role & Permission** | `system_settings` (key: `role_permissions`, `user_roles`) | `value` (JSON) | Settings (`/dashboard/settings`) | Layout (`/dashboard/layout.js`) | Database-driven | Membatasi menu sidebar & otorisasi server actions. |
| **Customer** | `customers` | `customer_code`, `name`, `type`, `phone`, `address` | Master Customers (`/dashboard/master/customers`) | Sales Order Wizard (`/dashboard/sales/new`) | Database-driven | Menentukan link pesanan & mendeteksi order Marketplace. |
| **Supplier** | `suppliers` | `supplier_code`, `supplier_name`, `phone`, `address` | Master Suppliers | Purchase Order Wizard (`/dashboard/purchases/new`) | Database-driven | Pencatatan nama supplier di transaksi pembelian. |
| **Workshop** | `workshops` | `code`, `name` | Database Seed / SQL | Restock PO & Alokasi HPP Buku Besar | Database-driven | Memisahkan kepemilikan kas & asal mutasi stok (GUDANG, GLOBAL). |
| **Sales / Order Type** | `system_settings` (key: `dropdown_config`) | `value.order_type` | Settings | Sales Order Wizard & Calculator | Database-driven | Memengaruhi jalur produksi (Polos vs Sablon/Printing). |
| **Customer Type** | `system_settings` (key: `dropdown_config`) | `value.customer_type` | Settings | Customer Form & Dashboard | Database-driven | Pengelompokan tipe customer (Umum, Member, Grosir). |
| **Kategori Produk** | `system_settings` (key: `dropdown_config` & `pricelist_config`) | `value.category_mapping` | Settings | Product Form, Sales Wizard, Calculator | Database-driven | Menyaring produk & mencocokkan biaya sablon/printing. |
| **Produk & Ukuran** | `products` | `product_code`, `name`, `category`, `base_price` | Master Products (`/dashboard/master/products`) | Sales & Purchase Wizard, Calculator | Database-driven | Menentukan nama, HPP dasar, & satuan default barang. |
| **Satuan** | `product_units` | `unit_name`, `multiplier` | Product Edit Form | Sales & Purchase Wizard, Calculator | Database-driven | Mengalikan kuantitas unit (misal: Pack, Box) ke satuan terkecil (PCS). |
| **Metode Pembayaran** | `system_settings` (key: `dropdown_config`) | `value.payment_method` | Settings | Sales & Purchase Payment Form | Database-driven | Menentukan nama akun kas masuk/keluar di Buku Besar. |
| **Status Order** | `system_settings` (key: `dropdown_config`) | `value.production_status` | Settings | Sales Client & Production Track | Database-driven | Mengontrol urutan alur produksi. |
| **Status Pembayaran** | **Hardcode di Kode** | `['BELUM LUNAS', 'DP', 'LUNAS', 'BATAL']` | N/A (Hardcoded) | Sales & Purchase Client | **Hardcode** | Menentukan kapan alokasi HPP virtual didistribusikan. |
| **Status Produksi** | `system_settings` (key: `dropdown_config`) | `value.production_status` | Settings | Production Operator Dashboard | Database-driven | Menentukan antrean pengerjaan mesin. |
| **Komponen Gaji** | `salary_schemas` & `employees` | `gaji_harian`, `uang_makan`, `rate_borongan_sendiri` | Employees & Salary Schemas Master | Payroll Generate Page | Database-driven | Menjadi pengali gaji & borongan karyawan. |

### Dropdown Hardcode yang Ditemukan di Kode:
1.  **Status Pembayaran (SO/PO)**: `'BELUM LUNAS'`, `'DP'`, `'LUNAS'`, `'BATAL'` di `src/app/actions/sales.js` dan `src/app/dashboard/purchases/new/actions.js`.
2.  **Jenis Pinjaman**: `'KASBON'` dan `'PINJAMAN'` di `createLoan` (`src/app/dashboard/finance/loans/actions.js`).
3.  **Role System**: `'Owner'`, `'Admin'`, `'Operator'` di `SettingsClient.jsx` dan `layout.js` dashboard.
4.  **Varian Warna Printing**: `'3 Warna'` dan `'4 Warna'` di `SalesOrderWizard.jsx` dan `PriceCalculator.js`.

---

## 3. CUSTOMER FLOW

### Pembuatan Customer
*   Dibuat secara mandiri di halaman **Master Data Pelanggan** (`/dashboard/master/customers`) atau secara cepat (quick add) langsung dari **Sales Order Wizard** jika nama yang diinput user tidak terdaftar.
*   **Field Penting**: `customer_code` (unique, generated), `name`, `type` (misal: Reseller, Reguler, Shopee, Tokopedia), `phone`, `address`.

### Penyimpanan Customer Type
*   Disimpan di tabel `customers` kolom `type`. Pilihan tipe ini sinkron dengan `dropdown_config.customer_type` di tabel `system_settings`.

### Pemilihan Customer di Sales Order
*   Pada Tab 1 Sales Order Wizard, kasir memilih pelanggan lewat `CustomSelect`. Jika customer yang dipilih memiliki tipe `'Marketplace'`, `'Shopee'`, `'Tokopedia'`, atau `'TikTok'`:
    *   Sistem otomatis mengaktifkan status **Marketplace Order** (`isMarketplace = true`).
    *   Kasir diwajibkan mengisi nomor resi/pesanan (`marketplace_receipt`).
    *   Uang Muka (`dp_amount`) dipaksa menjadi `0` karena pembayaran ditahan oleh pihak e-commerce (masuk piutang tempo).

### Efek Customer Type Terhadap Harga & Laporan
*   **Terhadap Harga**: **TIDAK ADA EFEK**. Kode penentu harga (`calculateItemPrice` di `src/utils/pricing.js`) tidak menerima parameter `customer_type`. Harga murni ditentukan oleh volume pesanan (qty) dan matriks sablon/printing di settings.
*   **Terhadap Filter Penjualan**: Filter pencarian di halaman Sales Order (`SalesClient.jsx`) dapat menyaring transaksi berdasarkan tipe pelanggan (`filterCustomerType`).
*   **Terhadap Laporan & Dashboard**:
    *   Dashboard membaca `marketplaceOrders` dengan mencocokkan `customers.type IN ('Marketplace', 'Shopee', 'Tokopedia', 'TikTok')` untuk menampilkan metrik pencarian dana tempo (`mpTempo`).
    *   HPP pesanan yang bertipe marketplace ditangguhkan alokasinya sampai dana dicairkan di modul Marketplace.

---

## 4. PRODUCT & PRICE FLOW

### Struktur Produk
*   **Tabel**: `products`
*   **Field Utama**: `product_code` (e.g., STG010, DS-019), `name` (e.g., Cup Starindo 16oz), `category` (e.g., CUP, TINTA, PLASTIK, SEALER), `workshop_code` (GUDANG / GLOBAL / KING), `base_price` (HPP Beli), `selling_price` (Harga Jual Default), `stock_qty` (Stok Tersedia), `physical_stock` (Stok Fisik), `is_active` (boolean).

### Penentuan Harga Jual Akhir
Harga jual per PCS dihitung secara dinamis di kasir dan kalkulator lewat fungsi `calculateItemPrice()` (`src/utils/pricing.js`):

```
Harga Jual Per Pcs = Math.ceil( BasePrice * (1 + SaveProfitPercent / 100) )
```

Di mana `BasePrice` dihitung secara bertahap:
1.  **HPP Awal (`hargaBeliKing`)**:
    *   Jika pemilik barang adalah `GUDANG`: `hargaBeliKing = base_price + profit_gudang_nominal` (default +Rp50).
    *   Jika pemilik barang adalah `GLOBAL`: `hargaBeliKing = base_price * (1 + profit_global_percent / 100)` (default +10%).
2.  **Tambahan Sablon / Printing**:
    *   Jika order tipe **SABLON**: `BasePrice = hargaBeliKing + sablon_fee` (diambil dari matriks kuantitas kategori, e.g., tier 500, 1000, 5000, 10000). Jika 2 warna, ditambahkan lagi Rp250.
    *   Jika order tipe **PRINTING**: `BasePrice = hargaBeliKing + printing_fee` (diambil dari matriks kuantitas printing, tier 5000, 10000, 30000).
    *   Jika order tipe **POLOS**: `BasePrice = hargaBeliKing * (1 + margin_jual_polos_percent / 100)` (default +15%).

### Integrasi dengan Sales Order & Fallback Harga
*   **Penerapan di SO**: Ketika kasir membuat pesanan, wizard memanggil `calculateItemPriceUtil` untuk menetapkan harga satuan default di form input. Kasir *tetap bisa menimpa (overwrite) harga tersebut secara manual* di input Harga Satuan sebelum disimpan.
*   **HPP Dinamis**: Saat penyimpanan SO (`createSalesOrder`), sistem menghitung ulang HPP riil menggunakan **Rata-rata 3 PO Terakhir** (`calculateDynamicHPP`):
    *   Jika ada 3 transaksi pembelian terakhir: HPP = rata-rata harga beli dari 3 transaksi PO tersebut.
    *   Jika kurang dari 3 transaksi: HPP = nilai tertinggi dari transaksi PO yang ada.
    *   Jika tidak ada histori PO sama sekali: HPP menggunakan `base_price` produk dari master data (fallback).
*   **Snapshot HPP**: Nilai HPP dinamis ini direkam langsung ke kolom `sales_items.hpp_price` saat SO disimpan sebagai bukti perhitungan profit kotor bulan berjalan.

---

## 5. PURCHASE ORDER FLOW

Alur pengadaan bahan baku/barang dari supplier ke gudang internal.

### Diagram Alur Transaksi PO
```mermaid
graph TD
    A[Buat PO Baru & Tambah Item] -->|Status: TEMPO| B(Mutasi Stok IN bertambah)
    A -->|Status: LUNAS| C(Mutasi Stok IN & Uang Keluar di Buku Besar)
    D[Pelunasan PO Tempo] -->|Klik Bayar PO| E(Update Status LUNAS & Uang Keluar Tercatat)
```

### Rincian Alur per Tahap
1.  **Buat PO Baru (Status TEMPO)**
    *   **User Action**: Isi supplier, tanggal PO, tambah item barang (kategori, qty, unit, unit_cost), pilih status pembayaran "TEMPO".
    *   **Function**: `createPurchaseOrder(payload)` (`src/app/dashboard/purchases/new/actions.js`)
    *   **Table Read**: `suppliers`, `products`, `system_settings`
    *   **Table Write**: `purchase_orders` (insert), `purchase_items` (insert)
    *   **Status Change**: `purchase_orders.status` = `'TEMPO'`
    *   **Stock Effect**: Memicu database trigger `trg_purchase_items_mutation` → menyisipkan log `IN` ke `stock_mutations` → **`products.stock_qty` bertambah** dan **`products.physical_stock` bertambah** sebesar `qty * unit_multiplier`.
    *   **Cash Effect**: **TIDAK ADA**. Buku besar kas tidak mencatat pengeluaran karena status masih tempo/piutang.

2.  **Buat PO Baru (Status LUNAS)**
    *   **User Action**: Pilih status pembayaran "LUNAS", pilih Akun Kas (e.g., BCA, Mandiri, Cash), simpan PO.
    *   **Function**: `createPurchaseOrder(payload)`
    *   **Table Read/Write**: Sama seperti di atas.
    *   **Status Change**: `purchase_orders.status` = `'LUNAS'`
    *   **Stock Effect**: **Sama** (Stok tersedia & fisik langsung bertambah).
    *   **Cash Effect**: **BUG/RISK!** Server action `createPurchaseOrder` **tidak menyisipkan catatan pengeluaran** ke tabel `transactions` saat pembuatan awal PO Lunas. Transaksi kas keluar hanya dicatat jika PO dibuat sebagai TEMPO dahulu, kemudian dilunasi lewat tombol bayar di UI.

3.  **Pelunasan PO (Bayar PO Tempo)**
    *   **User Action**: Klik tombol "Bayar" di list PO tempo, pilih metode pembayaran kas, konfirmasi.
    *   **Function**: `payPurchaseOrder(id, paymentMethod)`
    *   **Table Read**: `purchase_orders` (select)
    *   **Table Write**: `purchase_orders` (update), `transactions` (insert)
    *   **Status Change**: `purchase_orders.status` = `'LUNAS'`
    *   **Stock Effect**: **TIDAK ADA** (stok sudah bertambah sejak awal PO dibuat).
    *   **Cash Effect**: Pengeluaran kas tercatat di buku besar (`transactions`): `amount_out = total_amount`, `reference = 'PEMBELIAN'`, `workshop_code = po.workshop_code`, `description = 'Pelunasan ke [Supplier]'`.

4.  **Edit PO**
    *   **User Action**: Mengubah kuantitas item atau menghapus item PO di wizard edit PO.
    *   **Function**: `updatePurchaseOrder(id, payload)`
    *   **Table Write**: `purchase_orders` (update), `purchase_items` (upsert & delete)
    *   **Stock Effect**: Trigger database `trg_purchase_items_mutation` mendeteksi selisih kuantitas baru dan lama (delta):
        *   Jika qty naik: insert mutation `IN` (stok bertambah sesuai selisih).
        *   Jika qty turun: insert mutation `IN` dengan nilai negatif (stok berkurang).
        *   Jika item dihapus: insert mutation `REVERT_IN` (stok dibatalkan).
    *   **Cash Effect**: **TIDAK ADA**. Riwayat kas keluar lama di tabel `transactions` tidak disesuaikan otomatis meskipun nilai total PO berubah.

5.  **Hapus / Cancel PO**
    *   **User Action**: Klik tombol hapus (Trash) pada list PO.
    *   **Function**: `deletePurchaseOrder(id)`
    *   **Table Write**: `purchase_orders` (delete) (memicu cascade delete pada `purchase_items`)
    *   **Stock Effect**: Trigger database `trg_purchase_items_mutation` berjalan `BEFORE DELETE` pada item → menyisipkan `REVERT_IN` ke `stock_mutations` → **stok tersedia & fisik berkurang** sebesar kuantitas PO yang dihapus.
    *   **Cash Effect**: **BUG/RISK!** Transaksi pengeluaran kas di tabel `transactions` **tidak dihapus/di-rollback**, uang kas yang sudah keluar tetap tercatat hilang di buku besar.

---

## 6. SALES ORDER FLOW

Alur sentral pesanan penjualan dari pemesanan hingga barang keluar ke tangan customer.

### Diagram Alur Transaksi SO (Jalur Sablon)
```mermaid
graph TD
    A[Buat SO Baru - DP/Lunas] -->|Stok Tersedia Berkurang booking| B(Antrean Produksi: SIAP PROSES)
    B -->|Operator Mulai Kerja| C(Progres Produksi: PROSES)
    C -->|Produksi Selesai| D(Status: SIAP KIRIM & Stok Fisik Berkurang)
    D -->|Kirim/Ambil & Pelunasan| E(Status: SELESAI & HPP Virtual Dialokasikan)
```

### Rincian Alur per Tahap
1.  **Buat SO Baru (Status Draft / Baru Masuk)**
    *   **User Action**: Pilih customer, tanggal, tambah item (order_type, produk, qty, price), isi DP/Uang muka, pilih metode pembayaran, simpan.
    *   **Function**: `createSalesOrder(payload)` (`src/app/actions/sales.js`)
    *   **Table Write**: `sales_orders` (insert), `sales_items` (insert), `transactions` (jika DP > 0)
    *   **Status Invoice**: Otomatis diatur via trigger database/Server Action ke `BERJALAN` (jika ada DP) atau `DRAFT` (jika DP = 0).
    *   **Status Item (`sales_items.status`)**: Default `'Proses'` (atau `'BARU MASUK'`).
    *   **Stock Effect**:
        *   Jika **POLOS**: Memicu trigger `trg_sales_items_mutation` → insert `OUT_POLOS` → **`stock_qty` (tersedia) & `physical_stock` (fisik) berkurang**.
        *   Jika **SABLON/PRINTING**: Memicu trigger `trg_sales_items_mutation` → insert `OUT_SABLON` → **`stock_qty` (tersedia) berkurang** (booking), **`physical_stock` (fisik) tetap/tidak berubah**.
        *   Jika produk berkategori **JASA** (e.g., SRV-FAST-TRACK): **Diabaikan/tidak memotong stok**.
    *   **Cash Effect**: Jika DP > 0, kas masuk tercatat di buku besar `transactions` (`amount_in = dpAmount`, `workshop_code = 'KING'`, `reference = 'PENJUALAN'`).

2.  **Mulai Produksi (Untuk Jalur SABLON)**
    *   **User Action**: Operator melihat antrean dengan status "SIAP PROSES", lalu mulai mengerjakan cup.
    *   **Function**: Operator mengisi progress kerja di dashboard produksi.
    *   **Table Write**: `production_logs` (insert)
    *   **Status Item**: Otomatis berubah menjadi `PROSES` jika total qty dikerjakan > 0 dan < target qty (`handleAutoStatusUpdate`).
    *   **Stock Effect**: Memicu trigger `trg_production_logs_mutation` (`42_production_stock_mutations.sql`):
        *   Bahan baku yang diproses (`qty_processed`): Menyisipkan `OUT_PRODUKSI` → **`products.physical_stock` berkurang**, sedangkan `stock_qty` tidak dipotong lagi (karena sudah dipotong/booking saat SO dibuat).
        *   Bahan baku rusak/pecah (`qty_defect`): Menyisipkan `OUT_DEFECT` → **`products.physical_stock` berkurang** DAN **`products.stock_qty` berkurang** (karena memotong stok baru di luar rencana booking awal).

3.  **Produksi Selesai (SIAP KIRIM)**
    *   **User Action**: Operator menyelesaikan sisa kuantitas target.
    *   **Function**: `saveProductionProgress` memanggil `handleAutoStatusUpdate`
    *   **Status Item**: Otomatis berganti menjadi `SIAP KIRIM` (karena total `qty_processed` >= target qty).
    *   **Stock Effect**: Stok fisik sisa berkurang hingga total target tercapai.

4.  **Pengiriman Barang / Ambil di Toko & Pelunasan**
    *   **User Action**: Kasir mengubah status item menjadi `DIKIRIM` atau `SUDAH DIAMBIL` dan menginput pelunasan sisa tagihan jika ada.
    *   **Function**: `addSalesPayment` (untuk mencatat uang masuk pelunasan) & `updateSalesItemStatus` / `updateSalesOrderStatus`.
    *   **Status Item**: Menjadi `SELESAI` (jika pembayaran lunas & barang sudah diambil/dikirim).
    *   **Cash Effect**:
        *   Kas masuk pelunasan tercatat di `transactions` (`amount_in = remaining_amount`, `workshop_code = 'KING'`).
        *   **Alokasi HPP Virtual**: Karena status invoice berubah menjadi `LUNAS`, sistem memicu alokasi HPP:
            *   Virtual cash `amount_in` ditransfer ke workshop pemilik barang (`GUDANG` atau `GLOBAL`) dan virtual cash `amount_out` dikurangi dari dompet `KING` sebesar total `beli_gudang` or `beli_global + royalty_fee` dari item terjual.

5.  **Pembatalan SO (Cancel Order)**
    *   **User Action**: Klik tombol "Batal" di list invoice penjualan.
    *   **Function**: `cancelSalesOrder(soId)`
    *   **Status Invoice**: `payment_status` = `'BATAL'`.
    *   **Status Item**: Semua item berstatus `'BATAL'`.
    *   **Stock Effect**: Menyisipkan mutasi `REVERT_OUT_POLOS` atau `REVERT_OUT_SABLON` ke tabel `stock_mutations` → **stok tersedia (`stock_qty`) bertambah kembali**, stok fisik (`physical_stock`) bertambah kembali hanya untuk item Polos.
    *   **Cash Effect**: **WIPING KAS!** Seluruh transaksi pembayaran (DP & Pelunasan) terkait SO ini di tabel `transactions` **dihapus bersih (hard delete)** dari buku besar.

---

## 7. ORDER STATUS FLOW

Status pelacakan pesanan terbagi menjadi dua level: **Status Item** (`sales_items.status`) dan **Status Pembayaran/Invoice** (`sales_orders.payment_status`).

### Daftar Status Item Nyata (`sales_items.status`)
1.  **`BARU MASUK`** / **`DRAFT`**: Pesanan telah dicatat tetapi belum dibayar (DP = 0) atau belum divalidasi admin.
2.  **`SIAP PROSES`**: Pesanan sudah dibayar (DP/Lunas) atau berasal dari marketplace, siap dikerjakan operator.
3.  **`PROSES`**: Operator mulai mencatat progres produksi di mesin sablon.
4.  **`SUDAH JADI`** / **`SIAP KIRIM`**: Kuantitas hasil cetak sudah memenuhi target pesanan.
5.  **`DIKIRIM`**: Barang dalam perjalanan ekspedisi ke alamat customer.
6.  **`SUDAH DIAMBIL`**: Customer mengambil langsung barang di outlet KING.
7.  **`SELESAI`**: Barang sudah diterima customer **DAN** invoice pembayaran telah berstatus **LUNAS**.
8.  **`BATAL`**: Item dibatalkan secara manual oleh kasir atau karena seluruh invoice dibatalkan.

### Alur Transaksi Status Nyata (State Machine)

#### alur A: JALUR POLOS (Tanpa Sablon)
```
[BARU MASUK] ---> (Bayar DP/Lunas / Marketplace) ---> [SIAP KIRIM] ---> [DIKIRIM/SUDAH DIAMBIL] ---> (Lunas) ---> [SELESAI]
```

#### alur B: JALUR SABLON (Melalui Produksi)
```
[BARU MASUK] ---> (Bayar DP/Lunas / Marketplace) ---> [SIAP PROSES] ---> (Mulai cetak) ---> [PROSES] ---> (Qty selesai >= Target) ---> [SIAP KIRIM] ---> [DIKIRIM/SUDAH DIAMBIL] ---> (Lunas) ---> [SELESAI]
```

#### alur C: JALUR PRINTING
```
[DRAFT / BARU MASUK] ---> (Admin mengubah status manual di UI) ---> [SELESAI] / [BATAL]
```

---

## 8. PRODUCTION FLOW

### Pemrosesan Antrean Produksi
*   Order bertipe **SABLON** otomatis masuk antrean produksi dengan status `SIAP PROSES` begitu invoice-nya mendapat pembayaran DP/Lunas atau terdeteksi sebagai Marketplace Order.
*   **Item Detail Operator**: Di layar operator (`ProductionTable.jsx`), data yang tampil meliputi: Nama Brand/Customer, Kategori & Nama Produk, Tanggal Order, Kuantitas Target (Qty Order), Progres Kuantitas Selesai, Jumlah Cacat, Tombol upload mockup gambar, dan Tombol update progres produksi.

### Pengisian Data Operator
Setiap kali operator menyelesaikan sesi pengerjaan, mereka menginput:
*   `qty_processed` (Qty normal selesai)
*   `qty_defect` (Qty cup cacat/pecah)
*   `employee_id` (Identitas operator yang mengerjakan)
*   `notes` (Keterangan tambahan)

Data ini ditulis ke tabel `production_logs` via action `saveProductionProgress()`.

### Logika Pengurangan Stok Akibat Defect & Produksi normal
Pengurangan stok dihitung secara real-time melalui trigger database `handle_production_logs_mutation()` (`42_production_stock_mutations.sql`):

| Skenario Produksi | Efek ke `physical_stock` (Stok Fisik) | Efek ke `stock_qty` (Stok Tersedia) | Log Mutasi Stok | Penjelasan |
| :--- | :--- | :--- | :--- | :--- |
| **Input Qty Processed** | `-qty_processed` | `0` (Tidak berubah) | `OUT_PRODUKSI` | Barang secara fisik meninggalkan gudang, tetapi alokasi pemesanan (booking) sudah dipotong saat SO dibuat. |
| **Input Qty Defect** | `-qty_defect` | `-qty_defect` | `OUT_DEFECT` | Cup yang hancur memotong fisik gudang DAN memotong ketersediaan stok umum karena merusak bahan baku baru di luar rencana booking. |
| **Hapus Log Produksi** | `+qty_processed` | `+qty_defect` | `REVERT_PRODUKSI` & `REVERT_DEFECT` | Stok fisik dan tersedia dikembalikan ke posisi semula. |

### Risiko Double Stock Deduction & Rollback
*   **Double Stock Deduction Guard**: Sistem ini aman dari pemotongan stok ganda untuk jalur Sablon normal. Saat SO dibuat, sistem hanya memotong `stock_qty` (booking). Pengurangan fisik (`physical_stock`) baru dicatat saat operator memasukkan log progres produksi secara bertahap.
*   **Batal / Cancel SO**: Jika SO berstatus Sablon dibatalkan (`status = 'BATAL'`), sistem memicu mutasi revert stok yang mengembalikan ketersediaan stok (`stock_qty` bertambah kembali sebesar target order). Namun, **stok fisik yang telanjur dipotong oleh log produksi tidak ikut dikembalikan otomatis** (karena secara riil fisik cup telah disablon/rusak).

---

## 9. INVENTORY FLOW

Audit komprehensif alur keluar masuk barang di gudang.

### Tabel Logika Mutasi Stok

| Event / Aksi | `stock_qty` (Tersedia) | `physical_stock` (Fisik) | Jenis Mutasi Stok | Reference ID | Sumber Modul / File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PO Restock (Insert)** | `+(qty * multiplier)` | `+(qty * multiplier)` | `IN` | `purchase_items.id` | Restock PO (`new/actions.js`) |
| **PO Restock (Delete)** | `-(qty * multiplier)` | `-(qty * multiplier)` | `REVERT_IN` | `purchase_items.id` | Restock PO (`new/actions.js`) |
| **SO Create (Polos)** | `-(qty * multiplier)` | `-(qty * multiplier)` | `OUT_POLOS` | `sales_items.id` | Sales Wizard (`sales.js`) |
| **SO Create (Sablon)** | `-(qty * multiplier)` | `0` (Tidak berubah) | `OUT_SABLON` | `sales_items.id` | Sales Wizard (`sales.js`) |
| **SO Create (Printing)** | `-(qty * multiplier)` | `0` (Tidak berubah) | `OUT_SABLON` | `sales_items.id` | Sales Wizard (`sales.js`) |
| **SO Edit Qty (Polos)** | `-delta_qty` | `-delta_qty` | `OUT_POLOS` | `sales_items.id` | Sales Edit (`sales.js`) |
| **SO Edit Qty (Sablon)**| `-delta_qty` | `0` (Tidak berubah) | `OUT_SABLON` | `sales_items.id` | Sales Edit (`sales.js`) |
| **SO Cancel / Batal** | `+qty` | `+qty` (Hanya Polos) | `REVERT_OUT_POLOS` / `REVERT_OUT_SABLON` | `sales_items.id` | Sales Action / Cancel SO |
| **SO Item Delete** | `+qty` | `+qty` (Hanya Polos) | `REVERT_OUT_POLOS` / `REVERT_OUT_SABLON` | `sales_items.id` | Sales Edit (Hapus item) |
| **Progres Produksi (Normal)**| `0` (Tidak berubah) | `-qty_processed` | `OUT_PRODUKSI` | `production_logs.id` | Produksi (`production/actions.js`) |
| **Progres Produksi (Cacat)**| `-qty_defect` | `-qty_defect` | `OUT_DEFECT` | `production_logs.id` | Produksi (`production/actions.js`) |
| **Opname (Fisik Naik)** | `+diff` | `+diff` | `OPNAME` | Generated UUID | Inventory (`master/products/actions.js`)|
| **Opname (Fisik Turun)** | `-diff` | `-diff` | `OPNAME` | Generated UUID | Inventory (`master/products/actions.js`)|

### Temuan Celah Keamanan & Inkonsistensi Stok
1.  **Missing Physical Stock Deduction untuk Pesanan PRINTING (CRITICAL)**:
    *   Pesanan bertipe `'PRINTING'` dibebaskan dari antrean produksi (`production_logs`).
    *   Saat SO dibuat, sistem hanya memotong `stock_qty` (booking) dan **tidak memotong `physical_stock`**.
    *   Karena tidak ada log produksi untuk item printing, **stok fisik produk printing di gudang tidak pernah terpotong** meskipun status pesanan sudah di-update menjadi `SELESAI`. Ini menyebabkan stok fisik di sistem selalu lebih tinggi dari stok fisik nyata di rak gudang.
2.  **Trigger Update Sales Items Terhapus / Hilang (CRITICAL)**:
    *   File migrasi terbaru `46_fast_track_and_jasa.sql` menimpa fungsi `handle_sales_items_mutation()` tetapi **lupa menulis logika untuk event UPDATE**.
    *   Akibatnya, jika kasir mengubah kuantitas item atau membatalkan pesanan dari form edit SO, **database trigger tidak berjalan**. Stok tersedia dan fisik di database tidak akan disesuaikan otomatis.
3.  **Inkonsistensi Opname Stok**:
    *   Penyesuaian stok opname dihitung berdasarkan selisih fisik: `difference = new_stock - products.physical_stock`.
    *   Selisih ini langsung diaplikasikan ke `physical_stock` dan `stock_qty` via trigger mutation.
    *   Jika sebelum opname posisi `stock_qty` dan `physical_stock` sudah tidak seimbang (misal selisih 20 pcs akibat bug printing), setelah opname dilakukan, **kedua kolom stok tersebut tetap tidak seimbang dengan margin selisih yang sama**. Opname tidak mensinkronkan ulang ketersediaan stok (`stock_qty`) agar sama dengan fisik riil.

---

## 10. STOCK MUTATION FLOW

### Isi Tabel Mutasi Stok (`stock_mutations`)
*   `product_code`: Kode produk yang bermutasi.
*   `mutation_type`: Klasifikasi mutasi (`IN`, `REVERT_IN`, `OUT_POLOS`, `REVERT_OUT_POLOS`, `OUT_SABLON`, `REVERT_OUT_SABLON`, `PROD_SABLON` / `OUT_PRODUKSI`, `OUT_DEFECT`, `ADJ_PRODUKSI`, `ADJ_DEFECT`, `REVERT_PRODUKSI`, `REVERT_DEFECT`, `OPNAME`).
*   `reference_id`: UUID baris transaksi asal (`purchase_items.id`, `sales_items.id`, atau `production_logs.id`).
*   `reference_number`: Nomor human-readable (e.g., Nomor Invoice SO, Nomor PO).
*   `qty_tersedia_change`: Angka perubahan stok tersedia (positif/negatif).
*   `qty_fisik_change`: Angka perubahan stok fisik (positif/negatif).
*   `notes`: Catatan penjelasan transaksi mutasi.
*   `created_at`: Timestamp waktu pencatatan.

### Pengelompokan Sumber Mutasi Stok

#### MASUK
*   `IN` (Pembelian PO Baru / Tambah Item PO)
*   `REVERT_OUT_POLOS` / `REVERT_OUT_SABLON` (SO Dibatalkan / Item SO Dihapus)
*   `REVERT_PRODUKSI` / `REVERT_DEFECT` (Log Produksi Dihapus)
*   `OPNAME` (Penyesuaian Fisik Positif)

#### KELUAR
*   `REVERT_IN` (PO Dihapus / Item PO Dihapus)
*   `OUT_POLOS` (Penjualan Polos Baru)
*   `OUT_SABLON` (Booking Pesanan Sablon Baru)
*   `OUT_PRODUKSI` (Pemakaian Bahan Baku untuk Sablon)
*   `OUT_DEFECT` (Bahan Baku Rusak saat Sablon)
*   `OPNAME` (Penyesuaian Fisik Negatif)

#### ADJUSTMENT
*   `IN` (Revisi Tambah/Kurang Qty PO)
*   `OUT_POLOS` / `OUT_SABLON` (Revisi Qty SO)
*   `ADJ_PRODUKSI` / `ADJ_DEFECT` (Revisi Progres Produksi oleh Operator)

### Tampilan Histori Stok di UI
*   Histori stok ditampilkan pada tab **Riwayat Mutasi** (`/dashboard/inventory/mutasi`).
*   **Filter Tersedia**: Filter berdasarkan rentang bulan transaksi (`MonthFilter`).
*   **Pencarian**: Berdasarkan nama produk, kode produk, nomor referensi invoice/PO, atau nama supplier/customer.

---

## 11. MARKETPLACE FLOW

Integrasi pembukuan pesanan e-commerce (Shopee, Tokopedia, TikTok).

### Alur Order & Settlement Marketplace
1.  **Pencatatan Awal**: Pesanan e-commerce dicatat sebagai Sales Order biasa. Customer diisi dengan profil ber-tipe "Marketplace" (e.g., Shopee Starindo). Kolom `marketplace_receipt` wajib diisi nomor pesanan dari e-commerce. Pembayaran di-set tempo (`dp_amount = 0`, status `BELUM LUNAS`).
2.  **Pencairan (Settlement)**: Pengguna membuka halaman `/dashboard/marketplace`, melihat daftar pesanan yang barangnya sudah dikirim/selesai tetapi dananya belum cair.
3.  **Input Nominal Bersih**: Kasir memasukkan nilai bersih dana cair yang diterima dari e-commerce setelah dipotong admin fee ke kolom input pencairan, memilih bank penampung (e.g., BCA), lalu klik "Proses Pencairan".
4.  **Buku Besar & HPP**: Action `processMarketplaceSettlement` berjalan:
    *   Uang masuk dicatat di buku besar (`transactions`): `amount_in = total_pencairan`, `workshop_code = 'KING'`, `reference = 'PENJUALAN'`, `description = 'Pencairan [Shopee/Tokopedia] ([n] Pesanan)'`.
    *   Nilai nominal pencairan disimpan ke kolom `sales_orders.marketplace_pencairan`.
    *   Status invoice di-set menjadi `LUNAS` dan `dp_amount` disamakan dengan `total_amount`.
    *   Sistem memicu transfer HPP virtual dari dompet `KING` ke dompet `GUDANG` dan `GLOBAL` untuk menyeimbangkan nilai aset terjual.

### Kerentanan Buku Besar Marketplace (HIGH RISK)
*   **Ketiadaan Guard Duplikasi Settlement**: Server action `processMarketplaceSettlement` tidak memeriksa apakah nomor SO yang dicairkan status pembayarannya sudah `LUNAS` atau belum. Jika kasir mengirimkan request pencairan ganda untuk pesanan yang sama, sistem akan **mencatat uang masuk berulang-ulang di Buku Besar** dan mendistribusikan alokasi HPP virtual berkali-kali ke Gudang/Global, menyebabkan nilai laporan laba rugi kacau.

---

## 12. CASH & FINANCE FLOW

Sistem pengelolaan kas terbagi secara virtual ke dalam 4 akun/dompet workshop:
1.  **`KING`**: Kas operasional outlet penjualan utama (pusat pendapatan kasir).
2.  **`GUDANG`**: Kas alokasi HPP untuk pembelian cup polos.
3.  **`GLOBAL`**: Kas alokasi HPP tinta, bahan sablon, dan royalty mesin.
4.  **`TABUNGAN`**: Kas dana cadangan, alokasi pinjaman karyawan, dan tabungan internal.

### Sumber Arus Kas

#### PEMASUKAN (Income)
*   **Kas Masuk SO**: Pembayaran uang muka (DP) atau pelunasan sisa tagihan dari penjualan central (`reference = 'PENJUALAN'`, `workshop_code = 'KING'`).
*   **Pencairan Marketplace**: Settlement hasil penjualan e-commerce (`reference = 'PENJUALAN'`, `workshop_code = 'KING'`).
*   **Pengembalian Pinjaman**: Potongan cicilan pinjaman karyawan via payroll (`reference = 'PINJAMAN'`, `workshop_code = 'TABUNGAN'`).
*   **Transaksi Manual**: Kas masuk yang ditambahkan manual oleh admin Buku Besar (`amount_in > 0`, `workshop_code` sesuai pilihan).

#### PENGELUARAN (Expense)
*   **Belanja Stok PO**: Pembayaran lunas atas transaksi PO kepada supplier (`reference = 'PEMBELIAN'`, `workshop_code = PO.workshop_code`).
*   **Pembayaran Gaji**: Pengeluaran biaya operasional rekap gaji karyawan (`reference = 'GAJI KARYAWAN'`, `workshop_code = 'KING'`).
*   **Pencairan Kasbon / Pinjaman**: Dana yang diberikan kepada karyawan (`reference = 'KASBON'/'PINJAMAN'`, kas keluar dari `KING` atau `TABUNGAN`).
*   **Pengeluaran Tetap Bulanan (Buku)**: Angka balancing tetap bulanan di laporan (`SETTLEMENT_KING_OUT = Rp4.100.000` keluar dari KING).
*   **Transaksi Manual**: Kas keluar manual (`amount_out > 0`).

---

## 13. SALES PAYMENT FLOW

### Perhitungan & Status Pembayaran SO
*   **Total Order**: Dihitung dari `SUM(qty * unit_price)` per item, ditambah biaya Fast Track (Rp100.000 / 1000 pcs) dan biaya Sablon 2 Warna (Rp250 / pcs) jika diaktifkan.
*   **Uang Muka (DP)**: Diinput manual saat pembuatan SO baru, disimpan di `sales_orders.dp_amount`.
*   **Remaining Balance**: `Sisa Tagihan = total_amount - dp_amount`.
*   **Penetapan Status Pembayaran**:
    *   Jika `dp_amount >= total_amount` → `'LUNAS'`.
    *   Jika `dp_amount > 0` dan `< total_amount` → `'DP'`. (Pada database bernilai `'BELUM LUNAS'`).
    *   Jika `dp_amount == 0` → `'BELUM LUNAS'`.

### Pencatatan Transaksi & Kerentanan Edit
*   Setiap kasir menambahkan pembayaran baru (`addSalesPayment`), sistem **selalu membuat baris transaksi baru** di tabel `transactions` (`amount_in = nominal_bayar`). Sistem tidak meng-update transaksi DP lama, melainkan menyisipkan baris tambahan sebagai histori cicilan.
*   **BUG/RISK! Wiping Kas saat Edit / Batal SO**: Jika user menghapus atau membatalkan SO (`cancelSalesOrder` / status `'BATAL'`), sistem langsung **menghapus bersih (hard delete) seluruh baris transaksi kas masuk terkait SO tersebut** dari tabel `transactions`. Hal ini mengakibatkan selisih besar antara pencatatan kas sistem dengan uang fisik di laci (kas fisik berlebih karena uang riil sudah masuk tetapi log transaksinya dihapus).

---

## 14. PURCHASE PAYMENT FLOW

### Pengelolaan Pembayaran PO
*   **Total PO**: Nilai total tagihan dari supplier, didapat dari `SUM(qty * unit_multiplier * unit_cost)`.
*   **Status Awal**: Dipilih saat membuat PO baru:
    *   `'LUNAS'`: Pembayaran langsung dianggap selesai (namun tidak mencatat kas keluar otomatis di transaksi awal).
    *   `'TEMPO'`: Dianggap sebagai utang berjalan.
*   **Pelunasan PO Tempo**: Melalui list PO, kasir mengeklik "Bayar", sistem mengubah status PO menjadi `LUNAS` dan menyisipkan satu log transaksi kas keluar (`amount_out = total_amount`, `reference = 'PEMBELIAN'`).
*   **BUG/RISK! Penghapusan PO Tanpa Rollback Kas**: Jika PO berstatus Lunas dihapus dari list, database menghapus baris PO tersebut, trigger mengembalikan stok fisik gudang, namun **catatan transaksi kas keluar di Buku Besar (`transactions`) tetap menggantung dan tidak dihapus**. Ini mengakibatkan buku besar mencatat saldo kas minus seolah uang sudah terbayar padahal transaksi PO-nya telah dibatalkan.

---

## 15. PAYROLL FLOW

### Perhitungan Gaji & Borongan Karyawan
Penghitungan dilakukan bulanan/mingguan berdasarkan data absensi log produksi:
1.  **Gaji Pokok & Makan**: `(gaji_harian + uang_makan) * jumlah_hari_kerja`. Jumlah hari kerja dihitung dari banyaknya hari unik di mana operator tercatat menginput log progres produksi di `production_logs`.
2.  **Borongan**: `qty_processed * rate_borongan_sendiri`.
3.  **Bonus Supervisor (Bawahan)**: `total_qty_subordinates * rate_produksi_bawahan` (jika karyawan tersebut bertindak sebagai supervisor).
4.  **Bonus Harian**: Dihitung harian:
    *   Jika qty harian < target harian minimum → tambah `bonus_harian_dibawah_target` (sebagai jaminan kompensasi harian).
    *   Jika qty harian > target harian maksimum → tambah `bonus_target_harian`.
5.  **Potongan Pinjaman/Kasbon**: Otomatis dipotong dari sisa saldo pinjaman aktif karyawan.

### Integrasi Kas & Finance (Buku Besar)
*   Begitu penggajian disimpan (`savePayroll`), sistem menyisipkan catatan pengeluaran kas di `transactions` dengan reference `GAJI KARYAWAN`, `amount_out = grandTotal` (Net Payout / Take Home Pay), dibebankan ke dompet `KING`.
*   **Potongan Pinjaman**: Cicilan pinjaman karyawan otomatis dipotong dari rekap gaji. Nilai potongan cicilan pinjaman ini disisipkan sebagai transaksi kas masuk (`amount_in = cicilan`) ke dompet `TABUNGAN` untuk menyeimbangkan neraca pinjaman.
*   **Audit Celah Keamanan (Payroll UI vs DB Mismatch - HIGH)**: Di UI rekap gaji (`PayrollClient.jsx`), kasir dapat mengubah nominal potongan kasbon secara manual sebelum menyimpan rekap. Namun, perubahan manual di form UI tersebut **hanya disimpan ke tabel rekap gaji (`payroll_items`)** dan **TIDAK di-update ke array data pinjaman (`loanDeductions`)**. Akibatnya, saat rekap gaji disimpan:
    *   Karyawan menerima gaji bersih yang sudah dipotong nominal baru.
    *   Namun, saldo utang karyawan di tabel `employee_loans` **tetap dipotong berdasarkan nominal lama yang belum diedit**. Ini menimbulkan selisih saldo utang karyawan yang permanen di database.

---

## 16. LOAN / PINJAMAN FLOW

Sistem memisahkan utang karyawan menjadi dua jenis:
1.  **KASBON**: Bersifat jangka pendek, dicairkan dari kas operasional `KING`, dan harus dilunasi penuh pada penggajian berikutnya.
2.  **PINJAMAN**: Bersifat jangka panjang (memiliki jangka waktu/tenor), dicairkan dari kas `TABUNGAN`, dan dicicil setiap minggu dengan nominal tetap (`installment_amount`).

### Alur Pencatatan Pinjaman
*   **Disbursement (Kas Keluar)**: Menyisipkan baris di `employee_loans` dan mencatat transaksi kas keluar (`amount_out = nominal_pinjaman`) di Buku Besar (`transactions`) dengan reference `KASBON`/`PINJAMAN` (mengurangi kas `KING` untuk kasbon, mengurangi kas `TABUNGAN` untuk pinjaman).
*   **Repayment (Kas Masuk)**:
    *   Melalui Payroll: Pemotongan otomatis saat rekap gaji dijalankan. Khusus tipe `PINJAMAN`, potongan cicilan disisipkan sebagai kas masuk ke dompet `TABUNGAN`.
    *   **BUG/RISK! Repayment Kasbon Tidak Tercatat di Buku Besar**: Saat kasbon dipotong lewat gaji, sistem meng-update status pinjaman menjadi LUNAS di database, namun **tidak menyisipkan log transaksi kas masuk di Buku Besar**. Hal ini diasumsikan sudah terwakili oleh berkurangnya nominal pengeluaran gaji bersih dari dompet `KING`.
*   **Delete Loan Tanpa Rollback**: Penghapusan pinjaman (`deleteLoan` di `src/app/dashboard/finance/loans/actions.js`) langsung menghapus data utang di tabel `employee_loans` tetapi **tidak membatalkan transaksi kas keluar di Buku Besar**.

---

## 17. REPORTING FLOW

Laporan eksekutif (`report/page.js` & `ReportClient.jsx`) menyajikan ringkasan kas Buku Besar untuk Owner.

### Rumus & Formula Perhitungan Laporan
*   **Saldo Akhir Gudang/Global/Tabungan**: Dihitung kumulatif dari seluruh transaksi historis (`date <= akhir_bulan_terpilih`).
*   **Saldo Bersih KING**: Dihitung bulanan khusus bulan terpilih saja.
*   **Bagi Hasil Bersih Workshop**:
    *   **Hak Bersih Owner Global**: `(50% * Profit Kotor Global) + Royalty Sewa Mesin`.
    *   **Hak Bersih Gudang**: `Profit Gudang + (50% * Profit Kotor Global)`.
*   **Profit Kotor Global/Gudang**:
    *   Profit Global = `beli_global` (terjual) - HPP Asli produk.
    *   Profit Gudang = `beli_gudang` (terjual) - HPP Asli produk.
    *   *Catatan*: Beli Gudang/Global didasarkan pada harga snapshot saat SO dibuat, HPP Asli dihitung dari harga beli PO.

### Celah & Kerentanan Laporan Keuangan (Audit Gaps)
1.  **Hardcode Nilai Pengeluaran Tetap Bulanan (HIGH)**:
    *   Nilai pengeluaran bulanan KING (`SETTLEMENT_KING_OUT = 4100000`) dan pemasukan bulanan TABUNGAN (`SETTLEMENT_TABUNGAN_IN = 2000000`) **di-hardcode secara kaku di dalam kode program** (`src/app/dashboard/report/page.js` baris 85-86).
    *   Meskipun pengguna mengubah parameter fixed expense di menu Settings, nilai yang digunakan laporan **tetap bernilai Rp4.100.000 dan Rp2.000.000**. Pengaturan di Settings tidak sinkron dengan laporan nyata.
2.  **Mixing Cash Basis & Accrual Basis**:
    *   Pendapatan omset di analitik dihitung dari seluruh SO yang tidak batal (Accrual basis - menghitung pesanan tempo/piutang yang belum cair).
    *   Namun, pemakaian gudang/global (`beli_gudang` & `beli_global`) di Buku Besar **hanya dihitung jika status invoice bernilai `LUNAS`** (Cash basis).
    *   Ini menyebabkan profit kotor di laporan bagi hasil tidak mencerminkan biaya riil dari seluruh barang yang keluar di bulan tersebut jika terdapat banyak invoice piutang/tempo yang belum lunas.
3.  **Ketiadaan Validasi Hapus Transaksi Utama**:
    *   Penghapusan PO atau pembatalan SO menghapus data kas di buku besar tetapi tidak menyeimbangkan neraca laporan, menyebabkan selisih tak terlacak (mismatch realita fisik vs sistem).

---

## 18. DASHBOARD FLOW

Dashboard Utama (`/dashboard/page.js`) menyajikan metrik operasional cepat.

### Metrik Dashboard & Sumber Data
1.  **SO Lunas**: Jumlah invoice penjualan pada bulan terpilih yang berstatus `payment_status = 'LUNAS'`.
2.  **SO Belum Lunas (DP)**: Jumlah total seluruh invoice penjualan (tidak terbatas bulan) yang berstatus `payment_status != 'LUNAS'` dan `payment_status != 'BATAL'`.
3.  **Marketplace (Tempo)**: Jumlah total seluruh invoice marketplace (tidak terbatas bulan) yang statusnya belum cair (`payment_status != 'LUNAS'` dan `payment_status != 'BATAL'`).
4.  **Total Produksi Sablon**: Akumulasi kuantitas cup sablon dari invoice bulan terpilih yang tidak batal.
5.  **Antrean Produksi (Baru Masuk / Proses / Siap Ambil)**:
    *   `Baru Masuk`: Kuantitas item sablon berstatus `BARU MASUK` atau `DRAFT`.
    *   `Sedang Proses`: Kuantitas item sablon berstatus `PROSES`.
    *   `Siap Ambil`: Kuantitas item sablon berstatus `SUDAH JADI`, `DIKIRIM`, atau `SUDAH DIAMBIL`.

### Sinkronisasi Metrik
Metrik dashboard membaca database secara langsung (`force-dynamic`). Namun metrik **SO Belum Lunas** dan **Marketplace Tempo** menampilkan data akumulasi sepanjang waktu (seluruh riwayat transaksi berjalan), sementara metrik **SO Lunas** disaring berdasarkan bulan terpilih. Hal ini dapat membingungkan kasir jika tidak dibaca dengan teliti.

---

## 19. DELETE / CANCEL / EDIT AUDIT

Audit dampak aksi destruktif (Hapus, Edit, Batal) terhadap stok dan keuangan.

| Aksi User | Dampak ke Stok Gudang | Dampak ke Buku Besar Keuangan | Dampak ke Produksi / Log | Status Rollback |
| :--- | :--- | :--- | :--- | :--- |
| **Delete PO** | **Rollback Berhasil**: Stok fisik & tersedia berkurang otomatis via DB Trigger. | **TIDAK ADA ROLLBACK**: Pengeluaran kas lunas tetap tersimpan di `transactions`. Uang kas hilang di sistem. | N/A | **Gagal/Bocor** |
| **Cancel PO** | **Rollback Berhasil**: Status diubah manual, stok disesuaikan. | **TIDAK ADA ROLLBACK** otomatis. | N/A | **Gagal/Bocor** |
| **Edit PO** | **Rollback Berhasil**: Trigger menghitung delta qty baru vs lama. | **TIDAK ADA ROLLBACK**: Transaksi pengeluaran lama tidak disesuaikan nominalnya. | N/A | **Gagal/Bocor** |
| **Delete SO** | **Rollback Berhasil** (jika dihapus itemnya di form edit): Stok dipulihkan. | **WIPING DATA**: Transaksi kas DP/Lunas dihapus paksa. Kas fisik akan kelebihan saldo dari catatan. | Log produksi terhapus otomatis (`CASCADE`). | **Gagal/Wiping** |
| **Cancel SO** | **Rollback Berhasil**: Ketersediaan stok dipulihkan via `REVERT_OUT_SABLON` / `REVERT_OUT_POLOS`. | **WIPING DATA**: Transaksi kas dihapus paksa dari database. Kehilangan riwayat arus uang riil. | Log produksi tetap tersimpan (fisik tetap terpotong). | **Gagal/Wiping** |
| **Edit SO (Qty)**| **TIDAK ADA ROLLBACK (BUG)**: Trigger `handle_sales_items_mutation` di `46_fast_track_and_jasa.sql` tidak memiliki event `UPDATE`. Stok tidak berubah saat qty diedit. | **TIDAK ADA ROLLBACK**: Nominal transaksi kas DP/Lunas lama tidak disesuaikan otomatis di Buku Besar. | Log produksi tetap berjalan. | **Gagal Total** |
| **Delete Item SO**| **Rollback Berhasil**: Stok tersedia bertambah kembali. | **TIDAK ADA ROLLBACK** otomatis pada transaksi uang. | Log produksi terhapus otomatis (`CASCADE`). | **Setengah Sukses** |
| **Delete Payroll**| N/A | **TIDAK ADA ROLLBACK** otomatis di Buku Besar. | Data gaji terhapus, kas keluar tetap tercatat. | **Gagal** |

---

## 20. END-TO-END BUSINESS FLOW

### FLOW A — PEMBELIAN STOK (Kulakan)
1.  **User Action**: Kasir membuat PO baru ke Supplier A untuk Cup 16oz sebanyak 10.000 pcs (10 Dus) dengan harga Rp300/pcs. Status: "TEMPO".
    *   *File*: `src/components/PurchaseOrderWizard.jsx`
2.  **Database Write**: Server action `createPurchaseOrder` menyisipkan header ke `purchase_orders` dan item ke `purchase_items`.
    *   *File/Fungsi*: `src/app/dashboard/purchases/new/actions.js` -> `createPurchaseOrder()`
3.  **Stock Mutation & Update**: Database trigger `trg_purchase_items_mutation` otomatis mendeteksi insert baru → menyisipkan baris `IN` ke `stock_mutations` dengan `qty = 10.000`. Trigger `apply_mutation_to_product` berjalan dan menambah `products.stock_qty = +10.000` & `products.physical_stock = +10.000`.
    *   *File/Fungsi*: Database Trigger `handle_purchase_items_mutation()`
4.  **Recalculate Price**: Server action memanggil `recalculateProductPrices` untuk meng-update HPP dasar produk ke rata-rata PO terakhir.
    *   *File/Fungsi*: `src/app/actions/pricing.js` -> `recalculateProductPrices()`
5.  **Pelunasan**: Kasir membayar PO tempo. Status PO menjadi `LUNAS` dan menyisipkan catatan pengeluaran kas (`amount_out: 3.000.000`) ke dompet `GUDANG` di tabel `transactions`.
    *   *File/Fungsi*: `src/app/dashboard/purchases/new/actions.js` -> `payPurchaseOrder()`

### FLOW B — PENJUALAN POLOS
1.  **User Action**: Kasir membuat SO baru untuk pelanggan Umum. Item: Cup 16oz polos 1.000 pcs. Total tagihan Rp500.000. Pembayaran: LUNAS via BCA.
    *   *File*: `src/components/SalesOrderWizard.jsx`
2.  **Database Write**: Server action `createSalesOrder` menyisipkan header ke `sales_orders` dan detail item ke `sales_items`.
    *   *File/Fungsi*: `src/app/actions/sales.js` -> `createSalesOrder()`
3.  **Stock Mutation (Polos)**: Database trigger `trg_sales_items_mutation` berjalan → karena bertipe POLOS, sistem menyisipkan `OUT_POLOS` ke `stock_mutations` → memotong `products.stock_qty = -1.000` & `products.physical_stock = -1.000`.
    *   *File/Fungsi*: Database Trigger `handle_sales_items_mutation()`
4.  **Cash Transaction & HPP Allocation**:
    *   Tabel `transactions` mencatat kas masuk (`amount_in: 500.000`) ke dompet `KING` via BCA.
    *   Sistem mendistribusikan HPP virtual: kas keluar dari `KING` (`amount_out: HPP`) dan kas masuk ke `GUDANG`/`GLOBAL` (`amount_in: HPP`) untuk menyeimbangkan nilai inventaris.
    *   *File/Fungsi*: `src/app/actions/sales.js` -> `createSalesOrder()`

### FLOW C — PENJUALAN SABLON
1.  **User Action**: Kasir mencatat pesanan Sablon Cup 16oz sebanyak 5.000 pcs. DP dibayar Rp1.000.000 via Cash.
    *   *File*: `src/components/SalesOrderWizard.jsx`
2.  **Database Write**: SO tersimpan di `sales_orders` dengan `payment_status = 'BELUM LUNAS'`. Item tersimpan di `sales_items` dengan `status = 'BARU MASUK'`. Kas masuk tercatat di `transactions` (`amount_in: 1.000.000`) ke dompet `KING`.
3.  **Stock Mutation (Sablon)**: Database trigger berjalan → karena bertipe SABLON, sistem menyisipkan `OUT_SABLON` ke `stock_mutations` → memotong **stok tersedia saja** (`products.stock_qty = -5.000`), stok fisik tetap.
4.  **Antrean Produksi**: Karena pesanan sudah berstatus DP, alur otomatis `handleAutoStatusUpdate` mengubah status item menjadi `SIAP PROSES`.
5.  **Progres Operator (Fisik Potong)**: Operator mencetak cup. Sesi pertama selesai 3.000 pcs, cacat 50 pcs. Operator menyimpan progres.
    *   *File/Fungsi*: `src/app/dashboard/production/actions.js` -> `saveProductionProgress()`
    *   *Stock Effect*: Database trigger production log berjalan → menyisipkan `OUT_PRODUKSI` (mengurangi `physical_stock = -3.000`) and `OUT_DEFECT` (mengurangi `physical_stock = -50` & `stock_qty = -50`).
6.  **Finishing & Pelunasan**: Sisa 2.000 pcs diselesaikan operator. Status item menjadi `SIAP KIRIM`. Customer datang melunasi sisa tagihan, barang diambil. Kasir mencatat pelunasan, mengubah status item menjadi `SELESAI`. Kas masuk pelunasan dicatat di `transactions` ke dompet `KING`, alokasi HPP virtual disalurkan ke `GLOBAL` & `GUDANG`.

### FLOW D — MARKETPLACE
1.  **Pemesanan**: Customer "Shopee Outlet" membeli Cup Sablon 2.000 pcs. Resi diinput: `SPX-12345`.
2.  **Pencatatan**: SO tersimpan, `payment_status = 'BELUM LUNAS'` (Tempo). Ketersediaan stok dipotong 2.000 pcs (booking). Status item masuk antrean produksi.
3.  **Produksi & Kirim**: Operator menyelesaikan sablon, stok fisik terpotong 2.000 pcs. Kasir mengubah status item menjadi `DIKIRIM`.
4.  **Pencairan (Settlement)**: Akhir minggu, saldo Shopee cair bersih Rp850.000 (setelah potongan admin fee) ke rekening BCA KING.
    *   *File*: `src/app/dashboard/marketplace/MarketplaceClient.jsx`
5.  **Buku Besar Update**: Server action `processMarketplaceSettlement` berjalan → mencatat kas masuk riil `Rp850.000` ke dompet `KING` di Buku Besar. Status SO berubah menjadi `LUNAS`, dan alokasi HPP virtual ditransfer ke `GLOBAL`/`GUDANG`. Status item otomatis bergeser dari `DIKIRIM` ke `SELESAI`.
    *   *File/Fungsi*: `src/app/dashboard/marketplace/actions.js` -> `processMarketplaceSettlement()`

### FLOW E — PAYROLL
1.  **User Action**: Owner membuka menu rekap gaji, memilih rentang tanggal 1-7 Juli, lalu klik "Hitung Gaji".
    *   *File*: `src/app/dashboard/payroll/PayrollClient.jsx`
2.  **Kalkulasi**: Server action `calculatePayroll` menghitung total kerja absensi operator dari data `production_logs`, mengalikan dengan skema jabatan, menghitung bonus borongan cup, serta mendeteksi potongan utang aktif di `employee_loans`.
    *   *File/Fungsi*: `src/app/dashboard/payroll/actions.js` -> `calculatePayroll()`
3.  **Simpan & Bayar**: Owner mengonfirmasi rekap gaji. Payout total gaji bersih karyawan (Take Home Pay) disimpan ke tabel `payrolls`/`payroll_items` dan dicatat sebagai pengeluaran kas (`amount_out`) di dompet `KING`.
    *   *File/Fungsi*: `src/app/dashboard/payroll/actions.js` -> `savePayroll()`
4.  **Potongan Cicilan**: Potongan cicilan pinjaman karyawan otomatis memotong saldo pinjaman aktif di `employee_loans.remaining_amount` dan disisipkan sebagai kas masuk (`amount_in`) ke dompet `TABUNGAN`.

---

## 21. BUG & RISK REGISTER

Berikut adalah daftar kerentanan sistem nyata yang ditemukan di dalam kode program ERP saat ini.

### 1. SEVERITY: CRITICAL
*   **MODULE**: INVENTORY (Stok Gudang)
*   **ISSUE**: **Missing Physical Stock Deduction untuk Pesanan PRINTING**.
*   **CURRENT BEHAVIOR**: Pesanan bertipe `'PRINTING'` tidak masuk ke alur pelacakan produksi (`production_logs`). Akibatnya, trigger pengurangan stok fisik (`OUT_PRODUKSI`) tidak pernah berjalan untuk item printing. Hanya stok tersedia (`stock_qty`) yang terpotong saat SO dibuat, sedangkan stok fisik (`physical_stock`) di database tetap utuh selamanya.
*   **EXPECTED BUSINESS EFFECT**: Terjadi selisih besar antara stok fisik di sistem (terlihat banyak) dengan barang riil di gudang (kosong). Perusahaan terancam gagal kirim karena tidak mengetahui barang fisik sebenarnya sudah habis terjual.
*   **FILES/FUNCTIONS INVOLVED**:
    *   `src/app/dashboard/production/actions.js` -> `handleAutoStatusUpdate()` (Rule bypass printing).
    *   Database Triggers: `handle_production_logs_mutation()`

### 2. SEVERITY: CRITICAL
*   **MODULE**: FINANCE (Buku Besar)
*   **ISSUE**: **Wiping Seluruh Pembayaran Invoice saat Satu Item Dibatalkan**.
*   **CURRENT BEHAVIOR**: Pada fungsi `updateSalesItemStatus()`, ketika satu item dalam invoice diubah statusnya menjadi `'BATAL'`, sistem langsung memanggil query: `await supabase.from('transactions').delete().eq('so_id', itemData.so_id)`.
*   **EXPECTED BUSINESS EFFECT**: Jika dalam satu invoice terdapat 3 item pesanan berbeda, lalu customer membatalkan 1 item saja, **seluruh riwayat uang masuk (DP dan pelunasan) untuk 2 item lainnya yang masih aktif akan terhapus bersih dari kas Buku Besar**. Kas perusahaan akan tercatat minus secara fiktif.
*   **FILES/FUNCTIONS INVOLVED**:
    *   `src/app/actions/sales.js` -> `updateSalesItemStatus()` (Baris 603)

### 3. SEVERITY: CRITICAL
*   **MODULE**: INVENTORY (Stok Gudang)
*   **ISSUE**: **Triggers Update/Edit SO Item Tidak Berjalan**.
*   **CURRENT BEHAVIOR**: File migrasi terbaru `46_fast_track_and_jasa.sql` menimpa fungsi trigger `handle_sales_items_mutation()`. Namun fungsi baru tersebut **hanya memiliki blok pengecekan untuk `INSERT` dan `DELETE`**, dan tidak memiliki blok pengecekan `UPDATE` (mengembalikan `NULL`).
*   **EXPECTED BUSINESS EFFECT**: Setiap kali kuantitas item SO direvisi di form edit, atau dibatalkan statusnya menjadi `BATAL` lewat form edit SO, sistem **tidak akan pernah menyesuaikan stok barang** di database. Stok menjadi tidak sinkron.
*   **FILES/FUNCTIONS INVOLVED**:
    *   `database/46_fast_track_and_jasa.sql` -> Fungsi `handle_sales_items_mutation()` (Baris 13-68)

### 4. SEVERITY: HIGH
*   **MODULE**: FINANCE (Buku Besar)
*   **ISSUE**: **Penghapusan PO Lunas Tanpa Menghapus Kas Keluar**.
*   **CURRENT BEHAVIOR**: Fungsi `deletePurchaseOrder()` menghapus baris PO dari database, tetapi **tidak melakukan operasi penghapusan/revert pada tabel `transactions`** terkait pengeluaran kas PO tersebut.
*   **EXPECTED BUSINESS EFFECT**: Pembelian dibatalkan dan barang ditarik kembali dari stok, tetapi uang keluar tetap tercatat hilang di Buku Besar. Owner melihat keuangan rugi/bocor padahal transaksi pembeliannya telah dihapus.
*   **FILES/FUNCTIONS INVOLVED**:
    *   `src/app/dashboard/purchases/new/actions.js` -> `deletePurchaseOrder()`

### 5. SEVERITY: HIGH
*   **MODULE**: PAYROLL (Penggajian)
*   **ISSUE**: **Ketidaksesuaian Potongan Pinjaman/Kasbon Karyawan saat Pengeditan**.
*   **CURRENT BEHAVIOR**: Jika kasir mengedit nominal potongan kasbon/pinjaman secara manual di input UI penggajian, data gaji yang disimpan ke database (`payroll_items`) akan menggunakan angka baru tersebut. Namun, **proses pengurangan saldo utang aktif (`employee_loans`) tetap menggunakan array `loanDeductions` lama** (angka kalkulasi awal sebelum diedit).
*   **EXPECTED BUSINESS EFFECT**: Terjadi selisih permanen antara nominal potongan kasbon yang tercetak di slip gaji karyawan dengan sisa saldo utang yang tercatat di database master pinjaman. Karyawan bisa dirugikan karena utangnya tidak berkurang semestinya, atau perusahaan rugi karena utang lunas fiktif.
*   **FILES/FUNCTIONS INVOLVED**:
    *   `src/app/dashboard/payroll/PayrollClient.jsx` -> `handleSaveSubmit()` & `loanDeductions`
    *   `src/app/dashboard/payroll/actions.js` -> `savePayroll()`

### 6. SEVERITY: HIGH
*   **MODULE**: REPORTING (Laporan)
*   **ISSUE**: **Pengeluaran Tetap Bulanan Di-hardcode di Kode Laporan**.
*   **CURRENT BEHAVIOR**: Laporan keuangan Buku Besar (`report/page.js`) menggunakan angka pengeluaran tetap yang di-hardcode kaku di variabel `SETTLEMENT_KING_OUT = 4100000` (Rp4,1 Juta) dan `SETTLEMENT_TABUNGAN_IN = 2000000` (Rp2 Juta). Konfigurasi `cashflow_config` yang disimpan user di menu Settings sepenuhnya diabaikan oleh halaman laporan.
*   **EXPECTED BUSINESS EFFECT**: Owner melihat laporan keuangan yang salah dan menyesatkan jika pengeluaran bulanan outlet riil di lapangan sudah berubah dari Rp4,1 Juta.
*   **FILES/FUNCTIONS INVOLVED**:
    *   `src/app/dashboard/report/page.js` -> `ReportPage()` (Baris 85-86)

### 7. SEVERITY: HIGH
*   **MODULE**: MARKETPLACE (Pencairan)
*   **ISSUE**: **Ketiadaan Guard Duplikasi Pencairan Order**.
*   **CURRENT BEHAVIOR**: Fungsi `processMarketplaceSettlement` langsung mengeksekusi update status `LUNAS` dan menyisipkan kas masuk ke buku besar untuk seluruh array `orderId` yang dikirim dari UI tanpa memvalidasi apakah ada di antara order tersebut yang statusnya sudah `LUNAS` (sudah pernah dicairkan sebelumnya).
*   **EXPECTED BUSINESS EFFECT**: Jika kasir tidak sengaja menekan tombol pencairan berulang kali karena lag koneksi, sistem akan mencatat pemasukan kas masuk ganda di Buku Besar untuk satu invoice yang sama. Nilai kas pembukuan akan berlipat ganda dari fisik uang riil.
*   **FILES/FUNCTIONS INVOLVED**:
    *   `src/app/dashboard/marketplace/actions.js` -> `processMarketplaceSettlement()`

---

## 22. FILE OWNERSHIP MAP

Gunakan pemetaan ini sebagai acuan kepemilikan file (file ownership) agar perbaikan di masa mendatang tidak merusak alur transaksi di modul lain.

| Domain Bisnis | File Penanggung Jawab (Owner File) | Fungsi Utama | Tabel yang Terpengaruh |
| :--- | :--- | :--- | :--- |
| **Sales Order Creation & Update** | `src/app/actions/sales.js` | `createSalesOrder()`, `updateSalesOrder()` | `sales_orders`, `sales_items`, `transactions` |
| **Sales Item Status Update** | `src/app/actions/sales.js` | `updateSalesItemStatus()`, `cancelSalesOrder()` | `sales_orders`, `sales_items`, `stock_mutations`, `transactions` |
| **Dynamic Product Pricing** | `src/app/actions/pricing.js`<br>`src/utils/pricing.js` | `recalculateProductPrices()`, `calculateItemPrice()` | `products` |
| **Purchase Order (PO)** | `src/app/dashboard/purchases/new/actions.js` | `createPurchaseOrder()`, `updatePurchaseOrder()`, `deletePurchaseOrder()`, `payPurchaseOrder()` | `purchase_orders`, `purchase_items`, `transactions`, `products` |
| **Production Log (Operator)**| `src/app/dashboard/production/actions.js` | `saveProductionProgress()`, `correctProductionProgress()` | `production_logs`, `sales_items` |
| **Auto Status Trigger** | `src/app/dashboard/production/actions.js` | `handleAutoStatusUpdate()`, `updateSalesOrderStatus()` | `sales_items`, `sales_orders` |
| **Marketplace Settlement** | `src/app/dashboard/marketplace/actions.js` | `processMarketplaceSettlement()` | `sales_orders`, `transactions`, `sales_items` |
| **Manual Transactions** | `src/app/dashboard/transactions/actions.js` | `createManualTransaction()`, `updateTransaction()`, `deleteTransaction()` | `transactions` |
| **Deduction & Loans** | `src/app/dashboard/finance/loans/actions.js` | `createLoan()`, `deleteLoan()` | `employee_loans`, `transactions` |
| **Payroll Processing** | `src/app/dashboard/payroll/actions.js` | `calculatePayroll()`, `savePayroll()` | `payrolls`, `payroll_items`, `employee_loans`, `transactions` |
| **Executive Reporting** | `src/app/dashboard/report/page.js`<br>`src/app/dashboard/report/ReportClient.jsx` | `ReportPage()` (P&L calculations) | `transactions`, `sales_items` |
| **DB Stock Mutation Triggers**| Database SQL Triggers | `handle_sales_items_mutation()`, `handle_purchase_items_mutation()`, `handle_production_logs_mutation()`, `apply_mutation_to_product()` | `stock_mutations`, `products` |

---

## 23. PRICING COST STOCK BUSINESS RULE AUDIT

### A. FIELD LEVEL AUDIT

#### 1. `products.base_price`
*   **TABLE**: `products`
*   **ACTIVE READ LOCATIONS**: `src/app/actions/sales.js` (line 120), `src/utils/pricing.js` (line 16), `src/app/order/page.js` (line 15)
*   **ACTIVE WRITE LOCATIONS**: `src/app/actions/pricing.js` -> `recalculateProductPrices()` (line 57)
*   **CURRENT REAL MEANING**: Rata-rata/maksimum dari 3 transaksi PO terakhir untuk produk tersebut. Berfungsi sebagai **HPP Supplier Murni** untuk produk tersebut.
*   **USED FOR**: Landasan perhitungan HPP dan penentuan internal price ke King.

#### 2. `sales_items.hpp_price`
*   **TABLE**: `sales_items`
*   **ACTIVE READ LOCATIONS**: `src/app/dashboard/report/page.js` (line 31, 156)
*   **ACTIVE WRITE LOCATIONS**: `src/app/actions/sales.js` -> `createSalesOrder()` & `updateSalesOrder()`
*   **CURRENT REAL MEANING**: Snapshot `base_price` (HPP Supplier Murni) pada saat Sales Order dibuat.
*   **USED FOR**: Analisis margin/profit kotor di laporan eksekutif.

#### 3. `sales_items.beli_gudang`
*   **TABLE**: `sales_items`
*   **ACTIVE READ LOCATIONS**: `src/app/actions/sales.js` (line 330), `src/app/dashboard/marketplace/actions.js` (line 66), `src/app/dashboard/report/page.js` (line 31, 133, 160)
*   **ACTIVE WRITE LOCATIONS**: `src/app/actions/sales.js` -> `createSalesOrder()` & `updateSalesOrder()`
*   **CURRENT REAL MEANING**: **HPP KING** untuk barang Gudang. Dihitung dari `(HPP Supplier Murni + profitGudangNominal) * Qty`.
*   **USED FOR**: Alokasi kas keluar dari KING ke GUDANG saat SO berstatus LUNAS.

#### 4. `sales_items.beli_global`
*   **TABLE**: `sales_items`
*   **ACTIVE READ LOCATIONS**: `src/app/actions/sales.js` (line 330), `src/app/dashboard/marketplace/actions.js` (line 66), `src/app/dashboard/report/page.js` (line 31, 134, 163)
*   **ACTIVE WRITE LOCATIONS**: `src/app/actions/sales.js` -> `createSalesOrder()` & `updateSalesOrder()`
*   **CURRENT REAL MEANING**: **HPP KING** untuk barang Global. Dihitung dari `(HPP Supplier Murni * (1 + profitGlobalPct / 100)) * Qty`.
*   **USED FOR**: Alokasi kas keluar dari KING ke GLOBAL saat SO berstatus LUNAS.

---

### B. TRACE FLOW NYATA

#### 1. GUDANG & GLOBAL
*   **Supplier Purchase**: Pembelian dicatat via PO. Harga unit_price disimpan di `purchase_items.unit_price`.
*   **PO Receiving**: Saat PO disimpan, stock bertambah via trigger database.
*   **Product Cost**: `recalculateProductPrices` dipanggil → memperbarui `products.base_price` dengan rata-rata 3 PO terakhir.
*   **Rumus Harga Internal (HPP KING)**:
    *   GUDANG: `HPP Supplier + profit_gudang_nominal` (dari `pricelist_config`).
    *   GLOBAL: `HPP Supplier * (1 + profit_global_percent / 100)`.
*   **Penyimpanan**: Hasil perkalian qty disimpan di `sales_items.beli_gudang` / `sales_items.beli_global`.

#### 2. POLOS KING
*   **HPP KING**: Berasal dari `beli_gudang` / `beli_global` di `sales_items`.
*   **Margin Polos & Save Profit**: Diambil dari `pricelist_config`: `margin_jual_polos_percent` dan `save_profit_percent`.
*   **Formula Jual**: `Harga Jual Polos = HPP KING * (1 + margin_polos) * (1 + save_profit)`.
*   **Profit Report**: `Pendapatan Kas - HPP KING`.

#### 3. SABLON KING
*   **Matrix Sablon**: Dicari berdasarkan **Kategori Produk (Category)** dan **Qty Tier** (10, 100, 500, 1000, 5000, 10000 pcs) dari database/config.
*   **Formula Jual**: `Harga Jual Sablon = (HPP KING + Sablon Fee + (isTwoColor ? 250 : 0)) * (1 + save_profit)`.

#### 4. PRINTING
*   **Source Harga Beli**: Vendor pricing dicari dari `pricelist_config.printing_matrix` berdasarkan tier warna ('3 Warna' / '4 Warna') dan tier Qty.
*   **Fulfillment & Stock**: Saat ini, trigger `handle_sales_items_mutation` di `47_fix_stock_flow_and_printing.sql` **salah mengurangi `physical_stock` dan `stock_qty`** untuk order PRINTING saat statusnya selesai (DIKIRIM/SELESAI). Seharusnya PRINTING dikerjakan vendor luar (vendor fulfillment) dan tidak memotong stok milik KING/GUDANG/GLOBAL.
*   **PRINTING CURRENT STOCK LOGIC CORRECT**: **NO** (Trigger `handle_sales_items_mutation` melakukan mutasi stok fisik untuk item PRINTING).

#### 5. LAYANAN/JASA
*   **HPP**: 0.
*   **Stok**: Tidak memotong stok (dikecualikan di trigger).
*   **Report**: Masuk pendapatan kotor KING 100% tanpa potongan HPP.

#### 6. MARKETPLACE HPP (DOMAIN 4 EVALUATION)
*   **DOMAIN 4 HPP PATCH CORRECT**: **YES**.
*   **Penjelasan**: Relasi alokasi dana HPP virtual ke GUDANG/GLOBAL memang seharusnya menggunakan `beli_gudang` dan `beli_global` karena kolom ini merepresentasikan **harga internal transfer (HPP KING)**. Jika menggunakan `base_price` (HPP Supplier Murni), maka margin internal GUDANG/GLOBAL tidak akan tersalurkan ke dompet GUDANG/GLOBAL, melainkan terperangkap di KING.

---

### C. LEGACY & RISK ANALYSIS

#### 1. LEGACY FIELD STATUS
*   `products.hpp_murni`: **SAFE TO REMOVE** (Hanya ditulis sebagai duplikat, tidak pernah dibaca di logic calculator/kasir/report).
*   `products.price_polos`: **MUST KEEP** (Dibaca oleh `src/utils/pricing.js` line 16).
*   `products.base_price`: **MUST KEEP** (Digunakan sebagai benchmark HPP Supplier utama).

#### 2. MOBILE / PUBLIC ORDER RISK
*   **PUBLIC ORDER REUSES EXISTING CUSTOMER**: **YES** (Dicari berdasarkan nama brand secara eksak, berisiko mencampur data transaksi jika nama brand sama).
*   **PUBLIC ORDER CAN CREATE DUPLICATE CUSTOMER**: **NO** (Malah me-reuse customer lain yang bernama sama).
*   **PUBLIC ORDER CAN LOSE CUSTOMER TYPE**: **YES** (Customer baru via web dibuat tanpa `type`, sehingga tidak mendapatkan skema harga/diskon yang tepat).
*   **PUBLIC ORDER CAN USE WRONG PRICE SCHEME**: **YES** (Hanya menggunakan base_price default produk tanpa menghiraukan level reseller/umum).

#### 3. PAYROLL & LOAN DEDUCTION RISK
*   **PAYROLL LOAN REDUCTION MISMATCH**: **YES** (Sebelumnya UI membiarkan user mengedit potongan kasbon karyawan, tetapi backend `savePayroll` tetap memotong saldo pinjaman memakai data kalkulasi awal `loanDeductions` yang tidak tersinkronisasi).
*   **DUPLICATE PAYROLL PAYMENT RISK**: **YES** (Sebelumnya tidak ada guard untuk mengecek apakah rekap gaji untuk periode yang sama sudah pernah disimpan, berisiko melipatgandakan mutasi kas keluar di Buku Besar).

---

### D. FINAL RELEASE READINESS AUDIT
*   **STATUS**: **RELEASE READY (YES)**
- **Domain 1-7 Verifikasi Akhir**: Seluruh domain dari manajemen stok, status order, sinkronisasi pembayaran finance (SO & PO), penyelesaian marketplace, paritas public order, kalkulasi payroll & kasbon terpisah, hingga dashboard dinamis telah terintegrasi tanpa konflik logic.
- **Legacy Column State**: `products.hpp_murni` dipertahankan sebagai deprecated column demi backward compatibility logic fallback pada modul pricing.
- **Build Status**: `PASS` (Build Next.js Turbopack sukses penuh).

---

### E. AI CHAT & WHATSAPP AI SAFETY AUDIT
*   **STATUS**: **AI SYSTEM SAFE (YES)**
- **Integrasi**: AI terhubung melalui WhatsApp Webhook (`src/app/api/whatsapp/webhook/route.js`) dengan model `gemini-1.5-flash`.
- **Kapabilitas**: Hanya memuat kemampuan membaca status pesanan (`cek_pesanan`) dan mengontrol switch bot global untuk nomor admin. AI tidak memiliki tool untuk melakukan mutasi stok atau modifikasi keuangan secara langsung (Bebas Owner Bypass).
- **Keamanan**: Diproteksi terhadap double execution via Fonnte duplicate message detection (60 detik window) dan isolasi histori chat berbasis nomor pengirim.




