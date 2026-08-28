'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Wallet, Save, X, Zap, ClipboardPaste } from 'lucide-react'
import { processMarketplaceSettlement, processQuickMarketplaceSettlement, previewQuickMarketplaceSettlement, updateMarketplaceReceipt } from './actions'
import { previewBulkMarketplaceSettlement, processBulkMarketplaceSettlement } from './actions'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'
import CurrencyInput from '@/components/CurrencyInput'

export default function MarketplaceClient({ marketplaceOrders = [], dropdownConfig = {} }) {
  const filteredOrders = marketplaceOrders

  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  // State for inline pencairan inputs
  const [inputPencairan, setInputPencairan] = useState({})
  
  // State for inline receipt inputs
  const [inputReceipts, setInputReceipts] = useState({})
  const [savingReceiptId, setSavingReceiptId] = useState(null)

  // Dynamic Summary Stats
  const activeOrders = useMemo(() => marketplaceOrders.filter(o => o.payment_status !== 'LUNAS' && o.payment_status !== 'BATAL'), [marketplaceOrders])
  const shopeeCount = activeOrders.filter(o => (o.customers?.name || '').toLowerCase().includes('shopee')).length
  const topedCount = activeOrders.filter(o => (o.customers?.name || '').toLowerCase().includes('tokopedia')).length
  const tiktokCount = activeOrders.filter(o => (o.customers?.name || '').toLowerCase().includes('tiktok')).length

  // Settlement Modal State
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
  const [settlementMethod, setSettlementMethod] = useState('BCA')
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0])

  // Quick reconciliation for historical marketplace settlements
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false)
  const [quickCutoffDate, setQuickCutoffDate] = useState(new Date().toISOString().split('T')[0])
  const [quickSettlementDate, setQuickSettlementDate] = useState(new Date().toISOString().split('T')[0])
  const [quickPlatform, setQuickPlatform] = useState('ALL')
  const [quickPreview, setQuickPreview] = useState(null)
  const [isQuickLoading, setIsQuickLoading] = useState(false)

  // Bulk settlement paste/import
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkPreview, setBulkPreview] = useState(null)
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [bulkSettlementDate, setBulkSettlementDate] = useState(new Date().toISOString().split('T')[0])

  const handleInputChange = (id, value) => {
    setInputPencairan(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const handleReceiptChange = (id, value) => {
    setInputReceipts(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const handleReceiptBlur = async (id, originalValue) => {
    const newValue = inputReceipts[id]
    if (newValue === undefined || newValue === originalValue) return // no change
    
    setSavingReceiptId(id)
    try {
      const res = await updateMarketplaceReceipt(id, newValue)
      if (!res.success) {
        alert('Gagal menyimpan No Pesanan: ' + res.error)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingReceiptId(null)
    }
  }

  // Calculate summary based on currently inputted valid amounts for BELUM_LUNAS items
  const settlementData = useMemo(() => {
    const data = []
    Object.entries(inputPencairan).forEach(([id, val]) => {
      const numVal = Number(val)
      if (numVal > 0) {
        // Ensure the order is actually BELUM_LUNAS
        const order = marketplaceOrders.find(o => o.id.toString() === id.toString() && o.payment_status !== 'LUNAS' && o.payment_status !== 'BATAL')
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
        const skipMsg = res.skipped > 0 ? ` (${res.skipped} pesanan dilewati karena sudah cair)` : ''
        alert(`Pencairan berhasil diproses dan dicatat di Buku Besar!${skipMsg}`)
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

  const handleQuickPreview = async () => {
    setIsQuickLoading(true)
    try {
      const res = await previewQuickMarketplaceSettlement(quickCutoffDate, quickPlatform)
      if (res.success) {
        setQuickPreview(res)
      } else {
        alert('Gagal mengambil preview: ' + res.error)
      }
    } catch (e) {
      console.error(e)
      alert('Terjadi kesalahan saat mengambil preview')
    } finally {
      setIsQuickLoading(false)
    }
  }

  const handleQuickSettlement = async () => {
    if (!quickPreview?.count) return
    if (!window.confirm(`Tandai ${quickPreview.count} pesanan sebagai sudah cair dengan total Rp ${quickPreview.total.toLocaleString('id-ID')}?`)) return

    setIsQuickLoading(true)
    try {
      const res = await processQuickMarketplaceSettlement(quickCutoffDate, quickPlatform, settlementMethod, quickSettlementDate)
      if (res.success) {
        alert(`Rekonsiliasi cepat berhasil untuk ${res.processed} pesanan.`)
        setIsQuickModalOpen(false)
        setQuickPreview(null)
        router.refresh()
      } else {
        alert('Gagal memproses rekonsiliasi: ' + res.error)
      }
    } catch (e) {
      console.error(e)
      alert('Terjadi kesalahan saat memproses rekonsiliasi')
    } finally {
      setIsQuickLoading(false)
    }
  }

  const handleBulkPreview = async () => {
    if (!bulkText.trim()) return alert('Paste data pencairan terlebih dahulu.')

    setIsBulkLoading(true)
    try {
      const res = await previewBulkMarketplaceSettlement(bulkText)
      if (res.success) {
        setBulkPreview(res)
      } else {
        alert('Gagal membaca data pencairan: ' + res.error)
      }
    } catch (e) {
      console.error(e)
      alert('Terjadi kesalahan saat membaca data pencairan')
    } finally {
      setIsBulkLoading(false)
    }
  }

  const handleBulkSettlement = async () => {
    const matchedCount = bulkPreview?.summary?.matchedCount || 0
    if (!matchedCount) return alert('Tidak ada data yang cocok untuk diproses.')

    const skippedCount = (bulkPreview?.summary?.inputCount || 0) - matchedCount
    const skipMessage = skippedCount > 0 ? ` ${skippedCount} baris tidak cocok akan dilewati.` : ''
    if (!window.confirm(`Proses ${matchedCount} pesanan dengan total Rp ${(bulkPreview.summary.matchedTotal || 0).toLocaleString('id-ID')}?${skipMessage}`)) return

    setIsBulkLoading(true)
    try {
      const res = await processBulkMarketplaceSettlement(bulkText, settlementMethod, bulkSettlementDate)
      if (res.success) {
        alert(`Pencairan massal berhasil untuk ${res.processed} pesanan.`)
        setIsBulkModalOpen(false)
        setBulkText('')
        setBulkPreview(null)
        router.refresh()
      } else {
        alert('Gagal memproses pencairan massal: ' + res.error)
      }
    } catch (e) {
      console.error(e)
      alert('Terjadi kesalahan saat memproses pencairan massal')
    } finally {
      setIsBulkLoading(false)
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            setBulkPreview(null)
            setIsBulkModalOpen(true)
          }}
          className="btn-primary h-10 px-4 text-sm flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black border-none"
        >
          <ClipboardPaste className="w-4 h-4" /> Pencairan Massal
        </button>
        <button
          onClick={() => {
            setQuickPreview(null)
            setIsQuickModalOpen(true)
          }}
          className="btn-primary h-10 px-4 text-sm flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black border-none"
        >
          <Zap className="w-4 h-4" /> Rekonsiliasi Cepat
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card p-4 border-l-4 border-orange-500">
          <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">Shopee</p>
          <p className="text-2xl font-black text-foreground mt-2">{shopeeCount} <span className="text-sm font-normal text-foreground/50">Pesanan Aktif</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-green-500">
          <p className="text-xs font-bold text-green-400 uppercase tracking-wider">Tokopedia</p>
          <p className="text-2xl font-black text-foreground mt-2">{topedCount} <span className="text-sm font-normal text-foreground/50">Pesanan Aktif</span></p>
        </div>
        <div className="glass-card p-4 border-l-4 border-black/50 dark:border-white/50 bg-white/5">
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
          <span className="text-xs text-foreground/50">Hanya pesanan aktif</span>
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
                  <td className="px-4 py-3 font-medium text-xs">
                    <div className="relative flex items-center">
                      <input 
                        type="text" 
                        placeholder={item.marketplace_receipt ? '' : 'Isi No. Pesanan'}
                        className="glass-input w-40 h-8 text-xs px-2 focus:ring-primary focus:border-primary border-transparent hover:border-white/20 bg-transparent hover:bg-white/5 transition-colors"
                        value={inputReceipts[item.id] !== undefined ? inputReceipts[item.id] : (item.marketplace_receipt || '')}
                        onChange={e => handleReceiptChange(item.id, e.target.value)}
                        onBlur={() => handleReceiptBlur(item.id, item.marketplace_receipt || '')}
                        disabled={savingReceiptId === item.id}
                      />
                      {savingReceiptId === item.id && <span className="absolute right-2 top-2 w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-orange-400 font-bold">{item.customers?.name || item.customers?.type}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">Rp {Number(item.total_amount || 0).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right">
                    {item.payment_status === 'LUNAS' ? (
                      <span className="font-bold text-green-400">
                        Rp {Number(item.marketplace_pencairan || 0).toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <CurrencyInput
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
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={event => event.target === event.currentTarget && setIsSettlementModalOpen(false)}
          role="presentation"
        >
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-visible flex flex-col" role="dialog" aria-modal="true" aria-labelledby="settlement-modal-title">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
              <h3 id="settlement-modal-title" className="font-bold text-foreground">Konfirmasi Pencairan Dana</h3>
              <button onClick={() => setIsSettlementModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 min-h-0 overflow-y-auto">
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
                    options={(dropdownConfig.payment_method || ["BCA", "MANDIRI", "CASH"]).map(method => ({
                      value: method,
                      label: method
                    }))}
                  />
                </div>
              </div>
              <p className="text-xs text-foreground/50 italic mt-2">
                * Pastikan nominal sudah sesuai dengan yang masuk ke rekening Bapak. Tindakan ini akan melunasi pesanan dan memotong HPP di Buku Besar.
              </p>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5 shrink-0">
              <button onClick={() => setIsSettlementModalOpen(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              <button onClick={handleProcessSettlement} disabled={isSaving} className="btn-primary px-4 h-10 text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> {isSaving ? 'Memproses...' : 'Simpan & Lunas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkModalOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={event => event.target === event.currentTarget && setIsBulkModalOpen(false)}
          role="presentation"
        >
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-visible flex flex-col" role="dialog" aria-modal="true" aria-labelledby="bulk-marketplace-modal-title">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-background/95 backdrop-blur-xl shrink-0">
              <div>
                <h3 id="bulk-marketplace-modal-title" className="font-bold text-foreground flex items-center gap-2"><ClipboardPaste className="w-4 h-4 text-green-400" /> Pencairan Massal Marketplace</h3>
                <p className="text-xs text-foreground/50 mt-1">Paste tabel dua kolom: total pencairan dan nomor pesanan marketplace.</p>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 min-h-0 overflow-y-auto">
              <textarea
                value={bulkText}
                onChange={e => {
                  setBulkText(e.target.value)
                  setBulkPreview(null)
                }}
                rows={8}
                className="glass-input w-full text-xs font-mono leading-relaxed resize-y"
                placeholder={'Paste dari Excel/Google Sheets/WhatsApp, contoh:\n781857\t26072909NKX8UC\n499661\t260726M71C3BVG'}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Tanggal pencairan</label>
                  <CustomDatePicker value={bulkSettlementDate} onChange={setBulkSettlementDate} className="!h-10" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Masuk ke kas</label>
                  <CustomSelect
                    value={settlementMethod}
                    onChange={e => setSettlementMethod(e.target.value)}
                    options={(dropdownConfig.payment_method || ['BCA', 'MANDIRI', 'CASH']).map(method => ({ value: method, label: method }))}
                  />
                </div>
              </div>

              {bulkPreview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                      <p className="text-[10px] text-green-300 uppercase font-bold">Cocok</p>
                      <p className="text-xl font-black text-green-400">{bulkPreview.summary.matchedCount}</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      <p className="text-[10px] text-red-300 uppercase font-bold">Tidak ditemukan</p>
                      <p className="text-xl font-black text-red-400">{bulkPreview.summary.notFoundCount}</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-[10px] text-amber-300 uppercase font-bold">Duplikat/sudah cair</p>
                      <p className="text-xl font-black text-amber-300">{bulkPreview.summary.duplicateCount + bulkPreview.summary.settledCount}</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                      <p className="text-[10px] text-primary uppercase font-bold">Total cocok</p>
                      <p className="text-lg font-black text-primary">Rp {(bulkPreview.summary.matchedTotal || 0).toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-white/10 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/5 text-foreground/60 uppercase">
                        <tr>
                          <th className="px-3 py-2">No Pesanan</th>
                          <th className="px-3 py-2">Nominal</th>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Pelanggan</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {bulkPreview.rows.map((row, index) => (
                          <tr key={`${row.receipt}-${row.line}-${index}`}>
                            <td className="px-3 py-2 font-mono">{row.receipt || '-'}</td>
                            <td className="px-3 py-2 text-right">Rp {Number(row.amount || 0).toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2">{row.invoiceNumber || '-'}</td>
                            <td className="px-3 py-2">{row.customerName || '-'}</td>
                            <td className={`px-3 py-2 font-bold ${row.status === 'COCOK' ? 'text-green-400' : row.status === 'SUDAH CAIR' ? 'text-amber-300' : 'text-red-400'}`}>{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-foreground/50">Hanya baris berstatus COCOK yang akan diproses. Baris bermasalah tetap aman dan tidak diubah.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5 shrink-0">
              <button onClick={() => setIsBulkModalOpen(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              {!bulkPreview ? (
                <button onClick={handleBulkPreview} disabled={isBulkLoading} className="btn-primary px-4 h-10 text-sm flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black border-none">
                  <ClipboardPaste className="w-4 h-4" /> {isBulkLoading ? 'Membaca...' : 'Preview Data'}
                </button>
              ) : (
                <button onClick={handleBulkSettlement} disabled={isBulkLoading || !bulkPreview.summary.matchedCount} className="btn-primary px-4 h-10 text-sm flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black border-none">
                  <Save className="w-4 h-4" /> {isBulkLoading ? 'Memproses...' : `Simpan ${bulkPreview.summary.matchedCount} yang Cocok`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isQuickModalOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={event => event.target === event.currentTarget && setIsQuickModalOpen(false)}
          role="presentation"
        >
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-visible flex flex-col" role="dialog" aria-modal="true" aria-labelledby="quick-marketplace-modal-title">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
              <div>
                <h3 id="quick-marketplace-modal-title" className="font-bold text-foreground">Rekonsiliasi Cepat Marketplace</h3>
                <p className="text-xs text-foreground/50 mt-1">Hanya memproses pesanan aktif yang belum lunas.</p>
              </div>
              <button onClick={() => setIsQuickModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Order sampai tanggal</label>
                  <CustomDatePicker value={quickCutoffDate} onChange={setQuickCutoffDate} className="!h-10" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Platform</label>
                  <CustomSelect
                    value={quickPlatform}
                    onChange={e => {
                      setQuickPlatform(e.target.value)
                      setQuickPreview(null)
                    }}
                    options={[
                      { value: 'ALL', label: 'Semua Marketplace' },
                      { value: 'SHOPEE', label: 'Shopee' },
                      { value: 'TOKOPEDIA', label: 'Tokopedia' },
                      { value: 'TIKTOK', label: 'TikTok' },
                      { value: 'LAINNYA', label: 'Marketplace Lainnya' }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Tanggal pencairan</label>
                  <CustomDatePicker value={quickSettlementDate} onChange={setQuickSettlementDate} className="!h-10" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground/80">Masuk ke kas</label>
                  <CustomSelect
                    value={settlementMethod}
                    onChange={e => setSettlementMethod(e.target.value)}
                    options={(dropdownConfig.payment_method || ["BCA", "MANDIRI", "CASH"]).map(method => ({ value: method, label: method }))}
                  />
                </div>
              </div>

              {quickPreview && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-bold text-amber-300">Preview pencairan</p>
                  <p className="text-sm text-foreground/80">{quickPreview.count} pesanan</p>
                  <p className="text-xl font-black text-amber-300">Rp {quickPreview.total.toLocaleString('id-ID')}</p>
                  {quickPreview.count === 0 && (
                    <p className="text-xs text-red-300">Tidak ada pesanan untuk filter ini. Pilih tanggal order yang lebih akhir atau platform yang sesuai.</p>
                  )}
                  {quickPreview.invoices?.length > 0 && (
                    <p className="text-xs text-foreground/50">Contoh invoice: {quickPreview.invoices.join(', ')}{quickPreview.count > quickPreview.invoices.length ? ' ...' : ''}</p>
                  )}
                  {quickPreview.excludedDuplicateCount > 0 && (
                    <p className="text-xs text-amber-300">{quickPreview.excludedDuplicateCount} invoice ditunda karena nomor pesanan marketplace dipakai beberapa invoice.</p>
                  )}
                  <p className="text-xs text-red-300">Nominal memakai total invoice, bukan nominal bersih setelah potongan marketplace.</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5 shrink-0">
              <button onClick={() => setIsQuickModalOpen(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              {!quickPreview ? (
                <button onClick={handleQuickPreview} disabled={isQuickLoading} className="btn-primary px-4 h-10 text-sm flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black border-none">
                  <Zap className="w-4 h-4" /> {isQuickLoading ? 'Memuat...' : 'Lihat Preview'}
                </button>
              ) : (
                <button
                  onClick={handleQuickSettlement}
                  disabled={isQuickLoading || !quickPreview.count}
                  className="btn-primary px-4 h-10 text-sm flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black border-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isQuickLoading ? 'Memproses...' : quickPreview.count ? 'Konfirmasi & Lunas' : 'Tidak ada pesanan'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
