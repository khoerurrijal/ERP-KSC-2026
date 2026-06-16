'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag, TrendingUp, Wallet, Save, X } from 'lucide-react'
import { processMarketplaceSettlement } from './actions'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'

export default function MarketplaceClient({ marketplaceOrders = [] }) {
  const [filterStatus, setFilterStatus] = useState('BELUM_LUNAS') // 'ALL' | 'BELUM_LUNAS' | 'LUNAS'
  
  const filteredOrders = useMemo(() => {
    return marketplaceOrders.filter(item => {
      if (filterStatus === 'ALL') return true
      if (filterStatus === 'BELUM_LUNAS') return item.payment_status !== 'LUNAS'
      return item.payment_status === 'LUNAS'
    })
  }, [marketplaceOrders, filterStatus])

  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  // State for inline pencairan inputs
  const [inputPencairan, setInputPencairan] = useState({})

  // Dynamic Summary Stats
  const activeOrders = useMemo(() => marketplaceOrders.filter(o => o.payment_status !== 'LUNAS'), [marketplaceOrders])
  const shopeeCount = activeOrders.filter(o => (o.customers?.name || '').toLowerCase().includes('shopee')).length
  const topedCount = activeOrders.filter(o => (o.customers?.name || '').toLowerCase().includes('tokopedia')).length
  const tiktokCount = activeOrders.filter(o => (o.customers?.name || '').toLowerCase().includes('tiktok')).length

  // Settlement Modal State
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
  const [settlementMethod, setSettlementMethod] = useState('BCA')
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0])

  const handleInputChange = (id, value) => {
    setInputPencairan(prev => ({
      ...prev,
      [id]: value
    }))
  }

  // Calculate summary based on currently inputted valid amounts for BELUM_LUNAS items
  const settlementData = useMemo(() => {
    const data = []
    Object.entries(inputPencairan).forEach(([id, val]) => {
      const numVal = Number(val)
      if (numVal > 0) {
        // Ensure the order is actually BELUM_LUNAS
        const order = marketplaceOrders.find(o => o.id.toString() === id.toString() && o.payment_status !== 'LUNAS')
        if (order) {
          data.push({ orderId: order.id, amount: numVal, invoice_number: order.invoice_number })
        }
      }
    })
    return data
  }, [inputPencairan, marketplaceOrders])

  const totalBersihCair = settlementData.reduce((sum, item) => sum + item.amount, 0)

  const handleProcessSettlement = async () => {
    if (settlementData.length === 0) return alert('Pilih minimal 1 pesanan dengan mengisi nominal pencairan!')

    setIsSaving(true)
    try {
      const res = await processMarketplaceSettlement(settlementData, settlementMethod, settlementDate)
      if (res.success) {
        alert('Pencairan berhasil diproses dan dicatat di Buku Besar!')
        setIsSettlementModalOpen(false)
        setInputPencairan({}) // reset
        router.refresh()
      } else {
        alert('Gagal memproses pencairan: ' + res.error)
      }
    } catch (e) {
      console.error(e)
      alert('Terjadi kesalahan')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Marketplace & Keuangan
          </h1>
          <p className="text-sm text-foreground/60 mt-1">
            Pantau pesanan Marketplace dan isi nominal untuk Pencairan Dana (Settlement).
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-orange-500">
          <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">Shopee</p>
          <p className="text-2xl font-black text-foreground mt-2">{shopeeCount} <span className="text-sm font-normal text-foreground/50">Pesanan Aktif</span></p>
        </div>
        <div className="glass-card p-6 border-l-4 border-green-500">
          <p className="text-xs font-bold text-green-400 uppercase tracking-wider">Tokopedia</p>
          <p className="text-2xl font-black text-foreground mt-2">{topedCount} <span className="text-sm font-normal text-foreground/50">Pesanan Aktif</span></p>
        </div>
        <div className="glass-card p-6 border-l-4 border-black/50 dark:border-white/50 bg-white/5">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">TikTok Shop</p>
          <p className="text-2xl font-black text-foreground mt-2">{tiktokCount} <span className="text-sm font-normal text-foreground/50">Pesanan Aktif</span></p>
        </div>
      </div>

      <div className="glass-card flex flex-col overflow-visible relative">
        <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> 
            Daftar Pesanan Marketplace
          </h2>
          <div className="w-48">
            <CustomSelect 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)} 
              options={[
                { value: "ALL", label: "Semua Status Cair" },
                { value: "BELUM_LUNAS", label: "Belum Cair (Belum Lunas)" },
                { value: "LUNAS", label: "Sudah Cair (Lunas)" }
              ]}
            />
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/60 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Tanggal Order</th>
                <th className="px-4 py-3">No. Pesanan / Resi</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3 text-right">Nilai Tagihan</th>
                <th className="px-4 py-3 text-right">Pencairan (Rp)</th>
                <th className="px-4 py-3 text-right">Status Pencairan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-foreground/40">Belum ada data pesanan marketplace.</td>
                </tr>
              ) : filteredOrders.map(item => (
                <tr key={item.id} className={`hover:bg-white/5 ${inputPencairan[item.id] > 0 ? 'bg-primary/5' : ''}`}>
                  <td className="px-4 py-3 text-foreground/80">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 font-medium text-xs">{item.marketplace_receipt || item.invoice_number || '-'}</td>
                  <td className="px-4 py-3 text-orange-400 font-bold">{item.customers?.name || item.customers?.type}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">Rp {Number(item.total_amount || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right">
                    {item.payment_status === 'LUNAS' ? (
                      <span className="font-bold text-green-400">
                        Rp {Number(item.marketplace_pencairan || 0).toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <input 
                        type="number" 
                        placeholder="Isi Nominal..."
                        className="glass-input w-32 h-9 text-xs px-2 text-right focus:ring-primary focus:border-primary border-white/20 bg-background/50"
                        value={inputPencairan[item.id] || ''}
                        onChange={e => handleInputChange(item.id, e.target.value)}
                        disabled={isSaving}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 text-[10px] rounded-full ${item.payment_status === 'LUNAS' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {item.payment_status === 'LUNAS' ? 'Sudah Cair' : 'Menunggu Cair'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Bottom Summary Bar */}
      {settlementData.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-40 animate-in slide-in-from-bottom-10 flex justify-center pointer-events-none">
          <div className="bg-background/80 backdrop-blur-xl border border-primary/30 shadow-2xl shadow-primary/20 rounded-2xl p-4 flex items-center justify-between gap-8 max-w-4xl w-full pointer-events-auto">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider">Summary Pencairan</p>
                <p className="text-xl font-bold text-foreground">
                  {settlementData.length} <span className="text-sm font-normal text-foreground/60">Pesanan Terpilih</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-foreground/60 uppercase tracking-wider mb-1">Total Bersih Cair</p>
              <p className="text-2xl font-black text-green-400">
                Rp {totalBersihCair.toLocaleString('id-ID')}
              </p>
            </div>
            <button 
              onClick={() => setIsSettlementModalOpen(true)}
              className="btn-primary h-12 px-6 flex items-center gap-2 text-sm bg-green-500 hover:bg-green-600 text-black border-none whitespace-nowrap shadow-lg shadow-green-500/20"
            >
              Proses Cairkan Sekarang
            </button>
          </div>
        </div>
      )}

      {/* Modal Settlement Confirmation */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-foreground">Konfirmasi Pencairan Dana</h3>
              <button onClick={() => setIsSettlementModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl text-center mb-4">
                <p className="text-sm text-foreground/80 mb-1">Total Uang Masuk Kas</p>
                <p className="text-3xl font-black text-green-400">Rp {totalBersihCair.toLocaleString('id-ID')}</p>
                <p className="text-xs text-foreground/50 mt-2">Dari {settlementData.length} pesanan marketplace</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Tanggal Pencairan</label>
                  <CustomDatePicker value={settlementDate} onChange={setSettlementDate} className="!h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-foreground/60 block">Masuk Ke Kas</label>
                  <CustomSelect 
                    value={settlementMethod} 
                    onChange={e => setSettlementMethod(e.target.value)} 
                    options={[
                      { value: "BCA", label: "BCA" },
                      { value: "Mandiri", label: "Mandiri" },
                      { value: "Cash", label: "Cash" }
                    ]}
                  />
                </div>
              </div>
              <p className="text-xs text-foreground/50 italic mt-2">
                * Pastikan nominal sudah sesuai dengan yang masuk ke rekening Bapak. Tindakan ini akan melunasi pesanan dan memotong HPP di Buku Besar.
              </p>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setIsSettlementModalOpen(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              <button onClick={handleProcessSettlement} disabled={isSaving} className="btn-primary px-4 h-10 text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> {isSaving ? 'Memproses...' : 'Simpan & Lunas'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
