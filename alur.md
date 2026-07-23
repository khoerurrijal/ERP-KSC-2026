# Diagram Alur Data ERP King Sablon Cup

Dokumen ini memetakan alur data utama dalam ERP King Sablon Cup dan mengidentifikasi bagian-bagian alur data yang terputus (broken data flows) berdasarkan audit kode server actions, database triggers, dan file audit sistem.

---

## 1. Alur Transaksi Pembelian (Purchase Order) & Buku Besar
Diagram ini menunjukkan alur data ketika transaksi pembelian (PO) dibuat, diedit, atau dilunasi. Jalur merah/putus-putus menggambarkan hilangnya pencatatan pengeluaran kas di Buku Besar (`transactions`).

```mermaid
graph TD
    A[Mulai PO Baru] --> B{Status Pembayaran?}
    
    %% Alur Tempo
    B -->|TEMPO| C[Simpan PO & PO Items]
    C --> D[Stok Fisik & Tersedia Bertambah <br/>via DB Trigger]
    C --> E[Kas Tidak Berubah]
    
    %% Alur Lunas Awal
    B -->|LUNAS| F[Simpan PO & PO Items]
    F --> G[Stok Fisik & Tersedia Bertambah <br/>via DB Trigger]
    F -.-x|PUTUS: Tidak mencatat pengeluaran kas| H((Buku Besar: Transactions))
    
    %% Pelunasan Tempo
    E --> I[Pelunasan PO Tempo <br/>via payPurchaseOrder]
    I --> J[Update Status PO -> LUNAS]
    I --> K[Catat Kas Keluar di Ledger]
    K --> H
    
    %% Edit PO
    C --> L[Edit PO / Ubah Item <br/>via updatePurchaseOrder]
    L --> M[Stok Disesuaikan via DB Trigger]
    L -.-x|PUTUS: Total Transaksi Kas Tidak Disesuaikan| H

    classDef broken fill:#ffcccc,stroke:#ff3333,stroke-width:2px,stroke-dasharray: 5 5;
    class H broken;
```

### Penjelasan Celah Alur PO:
1. **Lunas Tanpa Buku Besar**: Server action `createPurchaseOrder` tidak memiliki logika untuk memasukkan record pengeluaran kas (`amount_out`) saat PO dibuat langsung sebagai `LUNAS`. Buku Besar hanya terisi jika PO dibuat sebagai `TEMPO` terlebih dahulu lalu dilunasi melalui `payPurchaseOrder`.
2. **Inkonsistensi Edit PO**: Fungsi `updatePurchaseOrder` membolehkan user mengubah kuantitas atau nominal item PO yang mengubah total biaya. Namun, transaksi kas keluar yang sudah ada di tabel `transactions` tidak ikut terupdate atau disesuaikan.

---

## 2. Alur Transaksi Penjualan (Sales Order) & Pembatalan Kas
Diagram ini menunjukkan siklus pesanan penjualan hingga pembatalan. Jalur merah/putus-putus menyoroti masalah *wiping history* (penghapusan data kas secara permanen) saat pesanan dibatalkan.

```mermaid
graph TD
    A[Mulai SO Baru] --> B{Status DP?}
    B -->|DP > 0| C[Simpan SO & Items]
    C --> D[Pencatatan Kas Masuk KING <br/>di Buku Besar]
    
    B -->|DP = 0| E[Simpan SO & Items]
    
    %% Alur Produksi Sablon
    C --> F{Tipe Order?}
    E --> F
    F -->|SABLON| G[Antrean Produksi: SIAP PROSES]
    G --> H[Progres Produksi via Operator]
    H --> I[Stok Fisik Berkurang via DB Trigger]
    H --> J[Status Item -> SIAP KIRIM / SELESAI]
    
    %% Alur Polos
    F -->|POLOS| K[Stok Fisik & Tersedia Langsung Berkurang]
    K --> J
    
    %% Alur Pembatalan (Cancel)
    J --> L[Pembatalan SO <br/>via cancelSalesOrder]
    L --> M[Semua Item -> BATAL]
    L --> N[Stok Fisik & Tersedia Disesuaikan]
    L -.-x|PUTUS: Hard Delete Riwayat Kas DP/Cicilan| O((Buku Besar: Transactions))

    classDef broken fill:#ffcccc,stroke:#ff3333,stroke-width:2px,stroke-dasharray: 5 5;
    class O broken;
```

### Penjelasan Celah Alur SO:
1. **Penghapusan Kas Masuk (Wiping Kas)**: Saat pesanan dibatalkan melalui `cancelSalesOrder`, sistem menghapus permanen (`delete`) seluruh log pembayaran DP dan cicilan dari tabel `transactions`. Secara bisnis, uang DP yang telah masuk ke kasir fisik tidak hilang/dikembalikan otomatis, sehingga penghapusan log digital ini membuat neraca kas sistem dan kas fisik di laci tidak cocok.

---

## 3. Alur Potongan Pinjaman, Penggajian & Buku Besar
Diagram ini memetakan alur potongan gaji karyawan untuk melunasi kasbon/pinjaman, serta mencatat pengeluaran kas di Buku Besar. Jalur merah/putus-putus menunjukkan masalah sinkronisasi UI-ke-DB dan hilangnya histori kas masuk pelunasan kasbon.

```mermaid
graph TD
    A[Generate Rekap Gaji <br/>via calculatePayroll] --> B[Ambil Data Gaji & Kasbon Aktif]
    B --> C[Kasir Edit Potongan Kasbon di UI]
    C --> D[Simpan Payroll <br/>via savePayroll]
    
    D --> E[Simpan ke payroll_items]
    D -.-x|PUTUS: Update saldo pinjaman memakai kalkulasi lama bukan UI| F[(Tabel: employee_loans)]
    
    D --> G[Potongan Cicilan PINJAMAN]
    G --> H[Transfer Kas Masuk ke TABUNGAN]
    
    D --> I[Potongan KASBON]
    I -.-x|PUTUS: Pelunasan Kasbon tidak tercatat di Buku Besar| J((Buku Besar: Transactions))

    classDef broken fill:#ffcccc,stroke:#ff3333,stroke-width:2px,stroke-dasharray: 5 5;
    class F,J broken;
```

### Penjelasan Celah Alur Payroll & Loan:
1. **UI vs DB Mismatch**: Di antarmuka penggajian, kasir dapat mengubah jumlah potongan kasbon secara manual. Namun, server action `savePayroll` memproses pemotongan saldo pinjaman di tabel `employee_loans` menggunakan data kalkulasi awal (`loanDeductions`), bukan nominal hasil modifikasi manual kasir di UI. Hal ini menyebabkan sisa saldo utang di database tidak sinkron dengan nominal bersih yang diterima karyawan.
2. **Pelunasan Kasbon Tanpa Catatan Ledger**: Saat Kasbon dipotong dari gaji, status kasbon berubah menjadi `LUNAS` di tabel `employee_loans`. Namun, sistem tidak menambahkan baris pencatatan kas masuk penyeimbang ke Buku Besar (`transactions`) untuk mendokumentasikan bahwa kasbon tersebut telah dilunasi/dikembalikan.
