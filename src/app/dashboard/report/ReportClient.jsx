'use client'

import { useState } from 'react'
import { TrendingDown, TrendingUp, Wallet, AlertOctagon, Tag, Building2, FileText, ShieldCheck, CreditCard } from 'lucide-react'
import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'

export default function ReportClient({ transactions = [], summary = {}, dropdownConfig = {} }) {
  const [filterRef, setFilterRef] = useState('')
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false)
  
  // Local state for physical inputs
  const [inputBCA, setInputBCA] = useState(summary.physicalBalances?.BCA || 0)
  const [inputMandiri, setInputMandiri] = useState(summary.physicalBalances?.Mandiri || 0)
  const [inputCash, setInputCash] = useState(summary.physicalBalances?.Cash || 0)

  const totalFisikInput = Number(inputBCA) + Number(inputMandiri) + Number(inputCash)
  const totalPembukuanFisik = (summary.physicalBalances?.BCA || 0) + (summary.physicalBalances?.Mandiri || 0) + (summary.physicalBalances?.Cash || 0)
  const missValue = totalFisikInput - totalPembukuanFisik

  // Calculate details for Gudang
  let hppGudangMasuk = 0;
  let poGudangKeluar = 0;
  let lainGudangMasuk = 0;
  let lainGudangKeluar = 0;

  let hppGlobalMasuk = 0;
  let poGlobalKeluar = 0;
  let lainGlobalMasuk = 0;
  let lainGlobalKeluar = 0;

  transactions.forEach(t => {
    const amountIn = Number(t.amount_in || 0);
    const amountOut = Number(t.amount_out || 0);
    const desc = (t.description || '').toUpperCase();
    const ref = (t.reference || '').toUpperCase();

    if (t.workshop_code === 'GUDANG') {
      if (desc.includes('HPP') || desc.includes('DARI KING')) hppGudangMasuk += amountIn;
      else lainGudangMasuk += amountIn;

      if (ref === 'PEMBELIAN') poGudangKeluar += amountOut;
      else lainGudangKeluar += amountOut;
    }

    if (t.workshop_code === 'GLOBAL') {
      if (desc.includes('HPP') || desc.includes('ROYALTY') || desc.includes('DARI KING')) hppGlobalMasuk += amountIn;
      else lainGlobalMasuk += amountIn;

      if (ref === 'PEMBELIAN') poGlobalKeluar += amountOut;
      else lainGlobalKeluar += amountOut;
    }
  });

  const gudangDetails = [
    { label: "Pemakaian dari King", value: hppGudangMasuk, isPositive: true },
    { label: "Tagihan Lunas (PO)", value: poGudangKeluar, isPositive: false },
    { label: "Masuk Buku Besar", value: lainGudangMasuk, isPositive: true },
    { label: "Keluar Buku Besar", value: lainGudangKeluar, isPositive: false }
  ];

  const globalDetails = [
    { label: "Pemakaian dari King", value: hppGlobalMasuk, isPositive: true },
    { label: "Tagihan Lunas (PO)", value: poGlobalKeluar, isPositive: false },
    { label: "Masuk Buku Besar", value: lainGlobalMasuk, isPositive: true },
    { label: "Keluar Buku Besar", value: lainGlobalKeluar, isPositive: false }
  ];

  const tabunganDetails = [
    { label: "Suntikan Otomatis King", value: 2000000, isPositive: true },
    { label: "Masuk Buku Besar", value: Math.max(0, Number(summary.tabungan?.masuk || 0) - 2000000), isPositive: true },
    { label: "Keluar Buku Besar", value: summary.tabungan?.keluar || 0, isPositive: false }
  ];

  const groupedByRef = transactions
    .reduce((acc, curr) => {
      const amountIn = Number(curr.amount_in || 0);
      const amountOut = Number(curr.amount_out || 0);

      if (curr.workshop_code === 'KING') {
        if (curr.reference === 'ADJUSTMENT_EXCEL' || curr.reference === 'ADJUST_BANK_EXCEL') return acc

        if (curr.reference === 'ADJUSTMENT_DETAIL') {
          const targetRef = (curr.description || 'LAIN-LAIN').trim().toUpperCase()
          if (!acc[targetRef]) acc[targetRef] = { masuk: 0, keluar: 0 }
          acc[targetRef].keluar -= amountIn
          acc[targetRef].masuk -= amountOut
          return acc
        }

        let ref = (curr.reference || 'LAIN-LAIN').trim().toUpperCase()
        if (!acc[ref]) acc[ref] = { masuk: 0, keluar: 0 }
        acc[ref].masuk += amountIn
        acc[ref].keluar += amountOut
      }
      return acc
    }, {})

  let summaryRefs = Object.keys(groupedByRef).map(key => ({
    reference: key,
    masuk: groupedByRef[key].masuk,
    keluar: groupedByRef[key].keluar,
  })).sort((a, b) => a.reference.localeCompare(b.reference))

  if (filterRef) {
    summaryRefs = summaryRefs.filter(d => d.reference === filterRef)
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto">
      
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-yellow-200 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Laporan Eksekutif (Owner)
          </h1>
          <p className="text-sm text-foreground/60 mt-2 max-w-xl leading-relaxed">
            Ringkasan posisi keuangan, mutasi kas, dan performa setiap lini usaha (Workshop & Gudang) yang disajikan secara terintegrasi.
          </p>
        </div>
        <div className="flex shadow-2xl rounded-xl">
          <MonthFilter />
        </div>
      </header>

      {/* 1. BREAKDOWN MUTASI KHUSUS KING */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
            <FileText className="w-5 h-5 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Ringkasan Mutasi KING</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          <MetricCard 
            title="Pendapatan Masuk"
            value={summary.king?.pendapatan}
            subtitle="Total Uang Masuk KING"
            color="text-green-400"
            bg="bg-green-500/5"
            border="border-green-500/20"
            glow="bg-green-500/20"
          />
          <MetricCard 
            title="Pengeluaran Harian"
            value={summary.king?.pengeluaran_harian}
            subtitle="Total Uang Keluar (Non-HPP)"
            color="text-red-400"
            bg="bg-red-500/5"
            border="border-red-500/20"
            glow="bg-red-500/20"
          />
          <MetricCard 
            title="Pengeluaran Tetap"
            value={summary.king?.pengeluaran_tetap}
            subtitle="Settlement Wajib Bulanan"
            color="text-pink-400"
            bg="bg-pink-500/5"
            border="border-pink-500/20"
            glow="bg-pink-500/20"
          />
          <MetricCard 
            title="Pemakaian Cup (Gudang)"
            value={summary.king?.pemakaian_gudang}
            subtitle="Alokasi HPP Gudang"
            color="text-blue-400"
            bg="bg-blue-500/5"
            border="border-blue-500/20"
            glow="bg-blue-500/20"
          />
          <MetricCard 
            title="Pemakaian Global & Mesin"
            value={summary.king?.pemakaian_global}
            subtitle="Alokasi HPP Bahan & Mesin Sablon"
            color="text-orange-400"
            bg="bg-orange-500/5"
            border="border-orange-500/20"
            glow="bg-orange-500/20"
          />
          
          <div className="rounded-3xl p-8 flex flex-col justify-center border border-yellow-500/40 bg-gradient-to-br from-yellow-500/20 to-transparent relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-2xl shadow-yellow-500/10">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-yellow-500/20 blur-3xl rounded-full" />
            <span className="text-sm font-black text-yellow-400 uppercase tracking-widest relative z-10">Saldo Real (Kas KING)</span>
            <span className={`text-4xl font-black mt-3 relative z-10 ${summary.king?.saldo_bersih < 0 ? 'text-red-400' : 'text-green-400'}`}>
              Rp {Number(summary.king?.saldo_bersih || 0).toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-medium text-yellow-500/70 mt-2 relative z-10">Bersih setelah seluruh pemotongan alokasi</span>
          </div>
        </div>
      </section>

      {/* 2. BREAKDOWN MASING-MASING WORKSHOP */}
      <section className="space-y-6 pt-6 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Pos Saldo Divisi & Tabungan</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <WorkshopCard 
             title="GUDANG"
             masuk={summary.gudang?.masuk}
             keluar={summary.gudang?.keluar}
             akhir={summary.gudang?.akhir}
             colorTheme="purple"
             details={gudangDetails}
          />
          <WorkshopCard 
             title="GLOBAL"
             masuk={summary.global?.masuk}
             keluar={summary.global?.keluar}
             akhir={summary.global?.akhir}
             colorTheme="blue"
             details={globalDetails}
          />
          <WorkshopCard 
             title="TABUNGAN (Finish 2028)"
             masuk={summary.tabungan?.masuk}
             keluar={summary.tabungan?.keluar}
             akhir={summary.tabungan?.akhir}
             colorTheme="green"
             details={tabunganDetails}
          />
        </div>
      </section>

      {/* 3. DETAIL MUTASI KING */}
      <section className="space-y-6 pt-6 border-t border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-foreground/80" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Detail Mutasi (Berdasarkan Referensi)</h2>
          </div>
          <CustomSelect
            value={filterRef}
            onChange={e => setFilterRef(e.target.value)}
            className="w-full sm:w-64"
            icon={Tag}
            options={[
              { value: "", label: "Semua Kategori" },
              ...(dropdownConfig.transaction_reference || ["PENJUALAN", "PEMBELIAN", "GAJI KARYAWAN", "LISTRIK WIFI", "MAINTENANCE", "HPP GUDANG", "BAYAR HPP GUDANG", "LAIN-LAIN"]).map(ref => ({
                value: ref,
                label: ref
              }))
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {/* GRAND TOTAL KESELURUHAN */}
          <div className="col-span-full mb-2">
            <div className="glass-card p-6 border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent">
              <span className="text-xs font-black text-yellow-500 uppercase tracking-widest">GRAND TOTAL SEMUA REFERENSI (KING)</span>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-8">
                  <div className="flex flex-col">
                    <span className="text-foreground/50 text-sm font-medium">Total Masuk</span>
                    <span className="font-bold text-green-400 text-lg">
                      Rp {summaryRefs.reduce((a, c) => a + c.masuk, 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground/50 text-sm font-medium">Total Keluar</span>
                    <span className="font-bold text-red-400 text-lg">
                      Rp {summaryRefs.reduce((a, c) => a + c.keluar, 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:items-end">
                  <span className="text-foreground/80 font-bold text-sm">Selisih Bersih Keseluruhan</span>
                  <span className={`font-black text-2xl ${summaryRefs.reduce((a, c) => a + c.masuk, 0) - summaryRefs.reduce((a, c) => a + c.keluar, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Rp {(summaryRefs.reduce((a, c) => a + c.masuk, 0) - summaryRefs.reduce((a, c) => a + c.keluar, 0)).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {summaryRefs.length === 0 && (
            <div className="col-span-full p-8 text-center text-foreground/40 border border-white/5 border-dashed rounded-2xl">
              Belum ada data mutasi di periode ini.
            </div>
          )}
          {summaryRefs.map((item) => (
            <div key={item.reference} className="glass-card p-6 border-white/5 hover:border-primary/30 transition-colors">
              <span className="text-xs font-black text-primary uppercase tracking-widest">{item.reference}</span>
              <div className="mt-4 space-y-3">
                {item.masuk > 0 && (
                  <div className="flex justify-between items-end text-sm">
                    <span className="text-foreground/50 font-medium">Masuk</span>
                    <span className="font-bold text-green-400 text-base">
                      Rp {item.masuk.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
                {item.keluar > 0 && (
                  <div className="flex justify-between items-end text-sm">
                    <span className="text-foreground/50 font-medium">Keluar</span>
                    <span className="font-bold text-red-400 text-base">
                      Rp {item.keluar.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
                {item.masuk > 0 && item.keluar > 0 && (
                  <div className="flex justify-between items-end text-sm pt-3 border-t border-white/5 mt-2">
                    <span className="text-foreground/80 font-bold">Selisih Bersih</span>
                    <span className={`font-black text-lg ${item.masuk - item.keluar >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Rp {(item.masuk - item.keluar).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SALDO & BALANCE */}
      <section className="space-y-6 pt-10 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <Wallet className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Buku Besar & Kas Realtime</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* BUKU BESAR */}
          <div className="glass-card flex flex-col p-6 border-white/5">
            <h3 className="font-bold text-foreground/80 flex items-center gap-2 mb-6">
              Total Pembukuan Digital
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60">Saldo Gudang</span>
                <span className="font-bold text-foreground">Rp {Number(summary.gudang?.akhir || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60">Saldo Global</span>
                <span className="font-bold text-foreground">Rp {Number(summary.global?.akhir || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60">Saldo Tabungan</span>
                <span className="font-bold text-foreground">Rp {Number(summary.tabungan?.akhir || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60">Saldo Kas King</span>
                <span className={`font-bold ${summary.king?.saldo_bersih < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  Rp {Number(summary.king?.saldo_bersih || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center mt-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-sm font-black text-blue-400 uppercase tracking-wider">Total Buku Besar</span>
                <span className="text-xl font-black text-blue-400">Rp {Number(summary.total_buku_besar || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* SALDO FISIK BANK */}
          <div className="glass-card flex flex-col p-6 border-white/5">
            <h3 className="font-bold text-foreground/80 flex items-center gap-2 mb-6">
              Uang Tersedia di Bank
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-400" /> Bank BCA
                </span>
                <span className="font-bold text-foreground">Rp {Number(summary.physicalBalances?.BCA || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-yellow-400" /> Bank MANDIRI
                </span>
                <span className="font-bold text-foreground">Rp {Number(summary.physicalBalances?.Mandiri || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-green-400" /> Kas Tunai
                </span>
                <span className="font-bold text-foreground">Rp {Number(summary.physicalBalances?.Cash || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center mt-auto p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <span className="text-sm font-black text-green-400 uppercase tracking-wider">Total Fisik Bank</span>
                <span className="text-xl font-black text-green-400">Rp {Number(totalPembukuanFisik).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* MISS KEUANGAN */}
          <div className={`glass-card flex flex-col p-6 border-l-4 overflow-hidden relative ${missValue === 0 ? 'border-green-500 bg-gradient-to-br from-green-500/5 to-transparent' : missValue > 0 ? 'border-blue-500 bg-gradient-to-br from-blue-500/5 to-transparent' : 'border-red-500 bg-gradient-to-br from-red-500/5 to-transparent'}`}>
            <div className="flex justify-between items-start mb-6">
              <h3 className={`font-bold flex items-center gap-2 ${missValue === 0 ? 'text-green-500' : missValue > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                <AlertOctagon className="w-5 h-5" /> Status Pencatatan
              </h3>
              <button 
                onClick={() => setIsBalanceModalOpen(true)}
                className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full font-medium transition-colors border border-white/10"
              >
                Cek Selisih
              </button>
            </div>
            
            <div className="flex flex-col justify-center items-center text-center flex-1">
              <span className="text-xs font-medium text-foreground/50 uppercase tracking-widest mb-3">Selisih Realita vs Sistem</span>
              <span className={`text-4xl lg:text-5xl font-black tracking-tight ${missValue === 0 ? 'text-green-500' : missValue > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                {missValue > 0 ? '+' : ''}Rp {missValue.toLocaleString('id-ID')}
              </span>
              
              <div className="mt-6 w-full">
                {missValue === 0 ? (
                  <div className="text-xs text-green-400 font-bold bg-green-500/10 px-4 py-2.5 rounded-xl border border-green-500/20">
                    Sistem 100% Seimbang
                  </div>
                ) : missValue > 0 ? (
                  <div className="text-xs text-blue-400 font-bold bg-blue-500/10 px-4 py-2.5 rounded-xl border border-blue-500/20">
                    Uang Fisik Lebih Besar
                  </div>
                ) : (
                  <div className="text-xs text-red-400 font-bold bg-red-500/10 px-4 py-2.5 rounded-xl border border-red-500/20">
                    Uang Fisik Hilang / Kurang
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BALANCE MODAL */}
      {isBalanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-sm p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-200 shadow-2xl border border-white/10 rounded-3xl">
            <div>
              <h3 className="text-2xl font-black text-primary">Cek Uang Fisik</h3>
              <p className="text-sm text-foreground/50 mt-2 leading-relaxed">Masukkan nominal uang fisik yang ada di rekening saat ini untuk mengetahui selisihnya.</p>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Saldo BCA</label>
                <input 
                  type="number" 
                  value={inputBCA} 
                  onChange={e => setInputBCA(e.target.value)} 
                  className="glass-input w-full font-mono text-xl py-3 px-4 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Saldo MANDIRI</label>
                <input 
                  type="number" 
                  value={inputMandiri} 
                  onChange={e => setInputMandiri(e.target.value)} 
                  className="glass-input w-full font-mono text-xl py-3 px-4 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Uang Laci (Cash)</label>
                <input 
                  type="number" 
                  value={inputCash} 
                  onChange={e => setInputCash(e.target.value)} 
                  className="glass-input w-full font-mono text-xl py-3 px-4 rounded-xl"
                />
              </div>
            </div>
            <div className="mt-4 pt-6 border-t border-white/5">
              <button 
                onClick={() => setIsBalanceModalOpen(false)}
                className="btn-primary w-full py-3 text-sm font-bold rounded-xl"
              >
                Selesai & Hitung Selisih
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function MetricCard({ title, value, subtitle, color, bg, border, glow }) {
  return (
    <div className={`rounded-3xl p-6 flex flex-col justify-center border ${border} ${bg} relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${glow} blur-2xl opacity-50`} />
      <span className={`text-xs font-black ${color} uppercase tracking-widest relative z-10`}>{title}</span>
      <span className="text-3xl font-black text-foreground mt-3 relative z-10">
        Rp {Number(value || 0).toLocaleString('id-ID')}
      </span>
      <span className="text-xs font-medium text-foreground/50 mt-2 relative z-10">{subtitle}</span>
    </div>
  )
}

function WorkshopCard({ title, masuk, keluar, akhir, colorTheme, details = [] }) {
  const themes = {
    purple: { border: 'border-purple-500/20', bg: 'bg-gradient-to-br from-purple-500/10 to-transparent', text: 'text-purple-400', glow: 'bg-purple-500/20' },
    blue: { border: 'border-blue-500/20', bg: 'bg-gradient-to-br from-blue-500/10 to-transparent', text: 'text-blue-400', glow: 'bg-blue-500/20' },
    green: { border: 'border-green-500/20', bg: 'bg-gradient-to-br from-green-500/10 to-transparent', text: 'text-green-400', glow: 'bg-green-500/20' }
  }
  const t = themes[colorTheme]

  return (
    <div className={`rounded-3xl p-8 border ${t.border} ${t.bg} hover:shadow-2xl transition-all duration-500 relative overflow-hidden group flex flex-col`}>
      <div className={`absolute -right-10 -bottom-10 w-40 h-40 rounded-full ${t.glow} blur-3xl opacity-50 group-hover:opacity-100 transition-opacity`} />
      <h3 className={`font-black ${t.text} text-xl tracking-widest mb-8 relative z-10`}>{title}</h3>
      
      <div className="space-y-5 relative z-10 flex-1">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Total Pemasukan</span>
          <span className="text-xl font-bold text-foreground">Rp {Number(masuk || 0).toLocaleString('id-ID')}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Total Belanja (PO)</span>
          <span className="text-xl font-bold text-foreground">Rp {Number(keluar || 0).toLocaleString('id-ID')}</span>
        </div>

        {details.length > 0 && (
          <div className="pt-2 pb-1 flex flex-col gap-2 mt-2">
            {details.map((d, i) => {
              if (d.value === 0) return null;
              return (
                <div key={i} className="flex justify-between items-center text-[10px] font-medium text-foreground/60 border-b border-white/5 pb-1 last:border-0">
                  <span className="uppercase tracking-wider">{d.label}</span>
                  <span className={d.isPositive ? 'text-green-400/90 font-bold' : 'text-red-400/90 font-bold'}>
                    {d.isPositive ? '+' : '-'} Rp {Number(d.value).toLocaleString('id-ID')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="pt-6 mt-auto border-t border-white/10 flex flex-col gap-2">
          <span className={`text-xs font-black ${t.text} uppercase tracking-widest`}>Saldo Tersedia</span>
          <span className={`text-3xl font-black ${t.text}`}>Rp {Number(akhir || 0).toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  )
}
