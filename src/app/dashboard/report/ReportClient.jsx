'use client'

import { useState } from 'react'
import { TrendingDown, TrendingUp, Wallet, AlertOctagon, Tag, Building2, FileText, ShieldCheck, CreditCard } from 'lucide-react'
import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'
import CurrencyInput from '@/components/CurrencyInput'

import { BarChart3, PieChart } from 'lucide-react'

export default function ReportClient({ transactions = [], summary = {}, analytics = {}, dropdownConfig = {} }) {
  const [activeTab, setActiveTab] = useState('buku_besar')
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
    { label: "Suntikan Otomatis King", value: summary.tabungan_fixed_in || 2000000, isPositive: true },
    { label: "Masuk Buku Besar", value: Math.max(0, Number(summary.tabungan?.masuk || 0) - (summary.tabungan_fixed_in || 2000000)), isPositive: true },
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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 max-w-7xl mx-auto">
      
      <div className="flex justify-end">
        <div className="flex shadow-2xl rounded-xl">
          <MonthFilter />
        </div>
      </div>

      {/* TABS Navigation */}
      <div className="flex items-center gap-1 border-b border-white/10 w-full overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('buku_besar')}
          className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'buku_besar' ? 'text-primary border-primary' : 'text-foreground/60 border-transparent hover:text-foreground'}`}
        >
          <Wallet className="w-4 h-4" /> Kas & Buku Besar
        </button>
        <button 
          onClick={() => setActiveTab('analisa_laba')}
          className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'analisa_laba' ? 'text-primary border-primary' : 'text-foreground/60 border-transparent hover:text-foreground'}`}
        >
          <PieChart className="w-4 h-4" /> Analisa Penjualan
        </button>
      </div>

      {activeTab === 'buku_besar' ? (
        <>
          {/* 1. BREAKDOWN MUTASI KHUSUS KING */}
          <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Ringkasan Mutasi KING</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          <MetricCard 
            title="Pendapatan Masuk"
            value={summary.king?.pendapatan}
            subtitle="Total Uang Masuk KING"
          />
          <MetricCard 
            title="Pengeluaran Harian"
            value={summary.king?.pengeluaran_harian}
            subtitle="Total Uang Keluar (Non-HPP)"
          />
          <MetricCard 
            title="Pengeluaran Tetap"
            value={summary.king?.pengeluaran_tetap}
            subtitle="Settlement Wajib Bulanan"
          />
          <MetricCard 
            title="Pemakaian Cup (Gudang)"
            value={summary.king?.pemakaian_gudang}
            subtitle="Alokasi HPP Gudang"
          />
          <MetricCard 
            title="Pemakaian Global & Mesin"
            value={summary.king?.pemakaian_global}
            subtitle="Alokasi HPP Bahan & Mesin Sablon"
          />
          
          <div className="glass-card p-4 flex flex-col justify-center border-primary/30">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Saldo Real (Kas KING)</span>
            <span className={`metric-value-compact mt-3 ${summary.king?.saldo_bersih < 0 ? 'text-red-400' : 'text-green-400'}`}>
              Rp {Number(summary.king?.saldo_bersih || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-medium text-foreground/60 mt-2">Bersih setelah seluruh pemotongan alokasi</span>
          </div>
        </div>
      </section>

      {/* 2. BREAKDOWN MASING-MASING WORKSHOP */}
      <section className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Pos Saldo Divisi & Tabungan</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WorkshopCard 
             title="GUDANG"
             masuk={summary.gudang?.masuk}
             keluar={summary.gudang?.keluar}
             akhir={summary.gudang?.akhir}
             details={gudangDetails}
          />
          <WorkshopCard 
             title="GLOBAL"
             masuk={summary.global?.masuk}
             keluar={summary.global?.keluar}
             akhir={summary.global?.akhir}
             details={globalDetails}
          />
          <WorkshopCard 
             title="TABUNGAN (Finish 2028)"
             masuk={summary.tabungan?.masuk}
             keluar={summary.tabungan?.keluar}
             akhir={summary.tabungan?.akhir}
             details={tabunganDetails}
          />
        </div>
      </section>

      {/* 3. DETAIL MUTASI KING */}
      <section className="space-y-4 pt-4 border-t border-white/5">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* GRAND TOTAL KESELURUHAN */}
          <div className="col-span-full mb-2">
            <div className="glass-card p-4 border-primary/30">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Grand Total Semua Referensi (KING)</span>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-8">
                  <div className="flex flex-col">
                    <span className="text-foreground/50 text-sm font-medium">Total Masuk</span>
                    <span className="font-bold text-green-400 text-lg">
                      Rp {summaryRefs.reduce((a, c) => a + c.masuk, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground/50 text-sm font-medium">Total Keluar</span>
                    <span className="font-bold text-red-400 text-lg">
                      Rp {summaryRefs.reduce((a, c) => a + c.keluar, 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:items-end">
                  <span className="text-foreground/80 font-bold text-sm">Selisih Bersih Keseluruhan</span>
                  <span className={`metric-value-compact ${summaryRefs.reduce((a, c) => a + c.masuk, 0) - summaryRefs.reduce((a, c) => a + c.keluar, 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Rp {(summaryRefs.reduce((a, c) => a + c.masuk, 0) - summaryRefs.reduce((a, c) => a + c.keluar, 0)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
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
            <div key={item.reference} className="glass-card p-4 border-white/5 hover:border-primary/30 transition-colors">
              <span className="text-xs font-black text-primary uppercase tracking-widest">{item.reference}</span>
              <div className="mt-4 space-y-3">
                {item.masuk > 0 && (
                  <div className="flex justify-between items-end text-sm">
                    <span className="text-foreground/50 font-medium">Masuk</span>
                    <span className="font-bold text-green-400 text-base">
                      Rp {item.masuk.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {item.keluar > 0 && (
                  <div className="flex justify-between items-end text-sm">
                    <span className="text-foreground/50 font-medium">Keluar</span>
                    <span className="font-bold text-red-400 text-base">
                      Rp {item.keluar.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                {item.masuk > 0 && item.keluar > 0 && (
                  <div className="flex justify-between items-end text-sm pt-3 border-t border-white/5 mt-2">
                    <span className="text-foreground/80 font-bold">Selisih Bersih</span>
                    <span className={`font-black text-lg ${item.masuk - item.keluar >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Rp {(item.masuk - item.keluar).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SALDO & BALANCE */}
      <section className="space-y-4 pt-6 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Buku Besar & Kas Realtime</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* BUKU BESAR */}
          <div className="glass-card flex flex-col p-4 border-white/5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              Total Pembukuan Digital
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60">Saldo Gudang</span>
                <span className="font-bold text-foreground">Rp {Number(summary.gudang?.akhir || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60">Saldo Global</span>
                <span className="font-bold text-foreground">Rp {Number(summary.global?.akhir || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60">Saldo Tabungan</span>
                <span className="font-bold text-foreground">Rp {Number(summary.tabungan?.akhir || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60">Saldo Kas King</span>
                <span className={`font-bold ${summary.king?.saldo_bersih < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  Rp {Number(summary.king?.saldo_bersih || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between items-center mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-sm font-semibold text-primary uppercase tracking-wide">Total Buku Besar</span>
                <span className="metric-value-compact text-primary">Rp {Number(summary.total_buku_besar || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* SALDO FISIK BANK */}
          <div className="glass-card flex flex-col p-4 border-white/5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              Uang Tersedia di Bank
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> Bank BCA
                </span>
                <span className="font-bold text-foreground">Rp {Number(summary.physicalBalances?.BCA || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-accent" /> Bank MANDIRI
                </span>
                <span className="font-bold text-foreground">Rp {Number(summary.physicalBalances?.Mandiri || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm font-medium text-foreground/60 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" /> Kas Tunai
                </span>
                <span className="font-bold text-foreground">Rp {Number(summary.physicalBalances?.Cash || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center mt-auto p-3 rounded-lg bg-accent/5 border border-accent/20">
                <span className="text-sm font-semibold text-accent uppercase tracking-wide">Total Fisik Bank</span>
                <span className="metric-value-compact text-accent">Rp {Number(totalPembukuanFisik).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* MISS KEUANGAN */}
          <div className={`glass-card flex flex-col p-4 border-l-4 overflow-hidden relative ${missValue === 0 ? 'border-green-500 bg-gradient-to-br from-green-500/5 to-transparent' : missValue > 0 ? 'border-blue-500 bg-gradient-to-br from-blue-500/5 to-transparent' : 'border-red-500 bg-gradient-to-br from-red-500/5 to-transparent'}`}>
            <div className="flex justify-between items-start mb-4">
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
              <span className={`metric-value-prominent ${missValue === 0 ? 'text-green-500' : missValue > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                {missValue > 0 ? '+' : ''}Rp {missValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onMouseDown={event => event.target === event.currentTarget && setIsBalanceModalOpen(false)}>
          <div className="glass-card w-full max-w-sm p-4 flex flex-col gap-4 animate-in zoom-in-95 duration-200 border border-white/10 rounded-2xl">
            <div>
              <h3 className="text-2xl font-black text-primary">Cek Uang Fisik</h3>
              <p className="text-sm text-foreground/50 mt-2 leading-relaxed">Masukkan nominal uang fisik yang ada di rekening saat ini untuk mengetahui selisihnya.</p>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Saldo BCA</label>
                <CurrencyInput
                  value={inputBCA} 
                  onChange={e => setInputBCA(e.target.value)} 
                  className="glass-input w-full font-mono text-xl py-3 px-4 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Saldo MANDIRI</label>
                <CurrencyInput
                  value={inputMandiri} 
                  onChange={e => setInputMandiri(e.target.value)} 
                  className="glass-input w-full font-mono text-xl py-3 px-4 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider">Uang Laci (Cash)</label>
                <CurrencyInput
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
      </>
      ) : (
        /* TAB 2: ANALISA PENJUALAN & LABA */
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
          
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                <BarChart3 className="w-5 h-5 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Pemecahan Omset Penjualan</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="Gelas Sablon & Printing"
                value={analytics.omset_sablon}
                subtitle="Penjualan khusus sablon cup"
              />
              <MetricCard 
                title="Gelas Polos"
                value={analytics.omset_polos}
                subtitle="Penjualan cup tanpa sablon"
              />
              <MetricCard 
                title="Sablon Plastik"
                value={analytics.omset_plastik}
                subtitle="Sablon kantong plastik"
              />
              <MetricCard 
                title="Sablon Lid Sealer"
                value={analytics.omset_sealer}
                subtitle="Sablon penutup gelas"
              />
              <div className="col-span-full">
                <div className="glass-card p-4 flex flex-col justify-center border-primary/30">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">Total Omset Bulan Terpilih</span>
                  <span className="metric-value-prominent mt-3 text-primary">
                    Rp {Number(analytics.total_omset || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs font-medium text-foreground/60 mt-2 flex gap-2">
                    {analytics.piutang_omset > 0 && <span className="text-yellow-400">(Terdapat Piutang: Rp {analytics.piutang_omset.toLocaleString('id-ID', { maximumFractionDigits: 0 })})</span>}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <PieChart className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Bagi Hasil & Royalty (HPP Lunas)</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* KOTAK GLOBAL */}
              <div className="glass-card p-4 flex flex-col">
                <h3 className="font-semibold text-primary mb-4">Analisa Workshop Global</h3>
                
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                    <span className="text-foreground/60 font-medium">Nilai HPP Pokok (Modal Asli)</span>
                    <span className="font-bold text-foreground">Rp {Number(analytics.hpp_global || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                    <span className="text-foreground/60 font-medium">Profit Kotor Global (Margin)</span>
                    <span className="font-bold text-green-400">Rp {Number(analytics.margin_global || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                    <span className="text-foreground/60 font-medium flex items-center gap-2">
                      Royalty Sewa Mesin <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md">Owner Only</span>
                    </span>
                    <span className="font-bold text-foreground">Rp {Number(analytics.royalty_mesin || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                  </div>
                  
                  <div className="pt-4 mt-4 border-t border-border">
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">Hak Bersih Owner Global (Akhir Bulan)</span>
                      <span className="metric-value text-primary">
                        Rp {((Number(analytics.margin_global || 0) * 0.5) + Number(analytics.royalty_mesin || 0)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-foreground/60 font-medium mt-1">Rumus: (50% x Profit Kotor Global) + Royalty Sewa Mesin</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KOTAK GUDANG */}
              <div className="glass-card p-4 flex flex-col">
                <h3 className="font-semibold text-accent mb-4">Analisa Workshop Gudang</h3>
                
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                    <span className="text-foreground/60 font-medium">Nilai HPP Pokok (Modal Asli)</span>
                    <span className="font-bold text-foreground">Rp {Number(analytics.hpp_gudang || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                    <span className="text-foreground/60 font-medium">Profit Gudang (Margin)</span>
                    <span className="font-bold text-green-400">Rp {Number(analytics.margin_gudang || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                    <span className="text-foreground/60 font-medium flex items-center gap-2">
                      Suntikan Profit dari Global <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-md">50% Margin</span>
                    </span>
                    <span className="font-bold text-accent">Rp {(Number(analytics.margin_global || 0) * 0.5).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                  </div>
                  
                  <div className="pt-4 mt-4 border-t border-border">
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-accent/5 border border-accent/20">
                      <span className="text-xs font-semibold text-accent uppercase tracking-wide">Hak Bersih Gudang (Akhir Bulan)</span>
                      <span className="metric-value text-accent">
                        Rp {(Number(analytics.margin_gudang || 0) + (Number(analytics.margin_global || 0) * 0.5)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-foreground/60 font-medium mt-1">Rumus: Profit Gudang + (50% x Profit Kotor Global)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      )}

    </div>
  )
}

function MetricCard({ title, value, subtitle }) {
  return (
    <div className="glass-card p-4 flex flex-col justify-center">
      <span className="text-xs font-semibold text-primary uppercase tracking-wide">{title}</span>
      <span className="metric-value-compact text-foreground mt-2">
        Rp {Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
      </span>
      <span className="text-xs font-medium text-foreground/60 mt-2">{subtitle}</span>
    </div>
  )
}

function WorkshopCard({ title, masuk, keluar, akhir, details = [] }) {
  return (
    <div className="glass-card p-4 flex flex-col">
      <h3 className="font-semibold text-primary mb-4">{title}</h3>
      
      <div className="space-y-4 flex-1">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Total Pemasukan</span>
          <span className="metric-value-compact text-foreground">Rp {Number(masuk || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Total Belanja (PO)</span>
          <span className="metric-value-compact text-foreground">Rp {Number(keluar || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
        </div>

        {details.length > 0 && (
          <div className="pt-2 pb-1 flex flex-col gap-2 mt-2">
            {details.map((d, i) => {
              if (d.value === 0) return null;
              return (
                <div key={i} className="flex justify-between items-center text-[10px] font-medium text-foreground/60 border-b border-white/5 pb-1 last:border-0">
                  <span className="uppercase tracking-wider">{d.label}</span>
                  <span className={d.isPositive ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {d.isPositive ? '+' : '-'} Rp {Number(d.value).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="pt-4 mt-auto border-t border-border flex flex-col gap-2">
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">Saldo Tersedia</span>
          <span className="metric-value-compact text-accent">Rp {Number(akhir || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  )
}
