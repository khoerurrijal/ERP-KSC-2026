# ERP KSC — QA & UI Audit Report

**Tanggal:** 24 September 2026
**Environment:** local `http://localhost:3000`
**Role:** authenticated admin session
**Scope:** route smoke test, form validation, dropdowns, public pages, marketplace settlement, mobile layout, lint, production build.

## Executive summary

Status: **PARTIAL — belum aman disebut clean/release-ready**.

Tidak ditemukan Next.js error overlay pada route yang diuji dan `npm run build` berhasil. Namun ada dua gap penting yang perlu dituntaskan sebelum menyatakan aplikasi selesai:

1. `/pricelist` masih membuka halaman price list dan link **Public Pricelist** masih tampil, padahal keputusan owner adalah entry point public fokus ke `/order` dan `/pricelist` diarahkan ke `/order`.
2. UI marketplace lokal belum memiliki penanda/checkbox **sudah dibayar di luar ERP**. Akibatnya order lama yang sebenarnya sudah cair masih tampil sebagai aktif dan berisiko ikut diproses rekonsiliasi.

## Hasil verifikasi

| Area | Hasil | Catatan |
|---|---|---|
| Route smoke | PASS | 35 route page dari `src/app` dirender; tidak ada overlay `#__next_error__` pada pemeriksaan eksplisit. |
| Production build | PASS | `npm run build` berhasil dengan akses network. Ada warning middleware convention deprecated. |
| Customer form | PASS validasi | Simpan kosong menampilkan `Nama pelanggan wajib diisi.`; dropdown tipe menampilkan REGULLER, RESELLER, SHOPEE, TOKOPEDIA. |
| Sales Order form | PASS validasi | Simpan kosong menampilkan `Pilih pelanggan terlebih dahulu.` |
| Purchase Order form | PASS validasi | Simpan kosong menampilkan `Pilih supplier terlebih dahulu.` |
| Manual transaction | PASS validasi | Simpan kosong menampilkan `Masukkan nominal yang valid!` |
| Product form | PASS validasi | Simpan kosong menampilkan `Nama produk wajib diisi.` |
| Supplier form | PASS validasi | Simpan kosong menampilkan `Nama supplier wajib diisi.` |
| Employee form | PASS validasi native | Tiga field utama memiliki `required` dan browser validation message. |
| Public `/order`, `/invoice`, `/track` | RENDER PASS | Halaman terbuka dan tidak menampilkan login gate dalam sesi browser. Isolasi guest tanpa cookie tidak diulang agar sesi admin dan data kerja tidak dirusak. |
| Mobile 390×844 | PASS layout dasar | Tidak ada document horizontal overflow. Tabel memakai horizontal scroll internal. |
| Screenshot pixel audit | TERBATAS | CDP `Page.captureScreenshot` timeout; penilaian visual menggunakan snapshot DOM, computed layout, dan overflow metrics. |

Tidak ada customer, product, supplier, employee, transaksi, atau settlement baru yang disimpan selama audit.

## Temuan prioritas

### P1 — Marketplace belum bisa menandai settlement eksternal

**Reproduksi:** buka `/dashboard/marketplace` pada viewport mobile/desktop.

**Bukti:** UI menampilkan `40 Pesanan Aktif` Shopee dan semua order berstatus `Menunggu Cair`. Tidak ada checkbox atau kontrol “dibayar di luar ERP”. Preview Rekonsiliasi Cepat menghasilkan **35 pesanan / Rp18.994.773** dan menunda **20 invoice** karena nomor pesanan dipakai beberapa invoice.

**Dampak:** order Juni/Juli yang sudah dicairkan di luar ERP tetap terlihat aktif. Admin berisiko menganggapnya belum cair atau memasukkannya ke settlement ulang. Ini memengaruhi buku besar, saldo kas, dan histori pencairan.

**Bukti source:** `src/app/dashboard/marketplace/MarketplaceClient.jsx` hanya menyediakan input nomor pesanan, input nominal pencairan, pencairan massal, dan rekonsiliasi cepat; belum ada kontrol external-settlement.

**Rekomendasi:** implementasikan penanda settlement eksternal yang idempotent, tampilkan statusnya di tabel dan filter default “belum cair”, lalu pastikan quick reconciliation mengecualikan baris yang sudah ditandai.

### P1 — Owner decision `/pricelist` belum diterapkan

**Reproduksi:** buka `/pricelist`.

**Aktual:** halaman penuh `Price List Terbaru` terbuka.

**Expected:** redirect ke `/order`.

**Dampak:** ada dua entry point public untuk harga/order dan keputusan owner belum menjadi aturan aplikasi. Link **Public Pricelist** juga masih ada di master-data navigation.

**Bukti source:** `src/app/pricelist/page.js` masih merender `PriceListClient`; `src/app/dashboard/master/layout.js` masih mendefinisikan tab `Public Pricelist` ke `/pricelist`.

### P1 — Lint gate gagal

`npm run lint` gagal dengan **23 errors dan 23 warnings**. Kelompok error utama:

- file legacy/root dengan parsing atau encoding rusak: `check.js`, `old_OrderClient.jsx`, `old_route.js`;
- `react-hooks/set-state-in-effect`: inventory, customers, purchases, sales, transactions, sidebar, topbar, picker/select components;
- `react-hooks/purity`: penggunaan `Date.now()` atau `Math.random()` pada beberapa komponen/form.

Ini belum terbukti menyebabkan runtime break pada smoke test, tetapi release gate lint tidak sehat dan perlu dipisahkan antara file eksperimen/legacy yang dikeluarkan dari lint dan source aktif yang diperbaiki.

### P2 — Tabel mobile usable, tetapi tindakan berada di luar viewport awal

Pada 390×844, document tidak melebar, tetapi beberapa tabel memakai scroll horizontal internal:

- marketplace: container sekitar 354 px, content sekitar 820 px;
- transactions: container sekitar 354 px, content sekitar 623 px;
- master employees: card sekitar 366 px, content sekitar 477 px.

Ini bukan page break, tetapi user mobile harus menggeser horizontal untuk melihat kolom nilai/aksi. Pertimbangkan card/list mode mobile atau sticky kolom identitas dan aksi.

### P2 — Data operasional perlu review, bukan bug UI

Dashboard menampilkan stok negatif pada beberapa item dan Audit Center menampilkan banyak temuan yang perlu ditinjau. Ini tidak menyebabkan route crash, tetapi berdampak pada keputusan stok/produksi dan perlu rekonsiliasi data terpisah sebelum menyatakan ERP sehat secara operasional.

### P3 — Direct `/order/received` tanpa konteks

Jika route `/order/received` dibuka langsung, nomor request tampil `-`. Ini bisa valid bila route memang hanya tujuan setelah submit, tetapi UX sebaiknya memberi fallback yang jelas atau redirect ke `/order` saat tidak ada request context.

## Route dan workflow yang ter-cover

- Dashboard, Sales Order list/new, Purchase Order list/new, Production, Production Status, Shipping, Inventory, Inventory Mutation.
- Marketplace, Customers, Products, Suppliers, Employees, Payroll, Loans, Reports, Transactions.
- Settings, Access, Salary Schemas, Audit, Order Requests.
- Public Order, Public Invoice, Public Track, Pricelist, Received Order.
- Validasi form kosong pada customer, sales order, purchase order, transaksi manual, product, supplier, employee.
- Dropdown customer type, customer lookup, transaction controls, marketplace platform/payment, product/category/workshop/satuan, employee position.

## Acceptance criteria yang belum terpenuhi

- `/pricelist` redirect ke `/order`: **FAIL**.
- Link public pricelist dihapus: **FAIL**.
- Order marketplace lama dapat ditandai sudah dibayar di luar ERP dan dikecualikan dari quick reconciliation: **FAIL pada build lokal yang diaudit**.
- Lint tanpa error: **FAIL**.
- Screenshot visual pixel-level desktop/mobile: **belum dapat diverifikasi karena browser CDP timeout**.
- Guest isolation tanpa login untuk public route: **belum diuji dengan menghapus/mengisolasi sesi**; route UI tidak menampilkan login gate dalam sesi audit.

## Kesimpulan dan urutan perbaikan

1. Selesaikan model/status settlement eksternal marketplace dan uji idempotency/quick reconciliation.
2. Terapkan redirect `/pricelist` ke `/order` dan hapus tab public pricelist.
3. Rapikan lint gate: keluarkan file legacy yang memang bukan source aktif, lalu perbaiki error lint pada source aktif.
4. Ulangi smoke test settlement, buku besar, saldo, stok, dan public guest dengan sesi terisolasi.
5. Setelah itu baru lakukan review visual pixel-level dengan screenshot desktop dan mobile.

**Catatan:** audit ini bersifat read-only terhadap data bisnis. Tidak ada perubahan source aplikasi yang dilakukan pada sesi audit ini; artifact ini adalah hasil report saja.
