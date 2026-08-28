'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Filter, ChevronUp, ChevronDown } from 'lucide-react'
import { payPurchaseOrder } from './new/actions'

import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'
import PurchaseOrderWizard from '@/components/PurchaseOrderWizard'

export default function PurchasesClient({ purchaseOrders = [], purchaseItems = [], summary = {}, selectedMonth = '', dropdownConfig = {}, suppliers = [], products = [], workshops = [] }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('PO') // 'PO' | 'ITEMS'
  const [searchQuery, setSearchQuery] = useState('')
  const [itemSearchQuery, setItemSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState('BELUM LUNAS')
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [itemSortConfig, setItemSortConfig] = useState({ key: 'created_at', direction: 'desc' })

  // Modal State untuk Pelunasan
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payTargetId, setPayTargetId] = useState(null)
  const [payMethod, setPayMethod] = useState('BCA')
  const [isPaying, setIsPaying] = useState(false)

  // Pagination State
  const [poPage, setPoPage] = useState(1)
  const [itemPage, setItemPage] = useState(1)
  const pageSize = 50
  const [purchaseOrderDrawer, setPurchaseOrderDrawer] = useState(null)

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const openPayModal = (id) => {
    setPayTargetId(id)
    setPayMethod('BCA')
    setPayModalOpen(true)
  }

  const openPurchaseOrder = (purchaseOrder) => {
    setPurchaseOrderDrawer(purchaseOrder)
  }

  const openNewPurchaseOrder = () => {
    setPurchaseOrderDrawer({ mode: 'new' })
  }

  const closePurchaseOrder = () => {
    setPurchaseOrderDrawer(null)
  }

  const handlePurchaseOrderSaved = () => {
    setPurchaseOrderDrawer(null)
    router.refresh()
  }

  const drawerInitialData = useMemo(() => {
    if (!purchaseOrderDrawer || purchaseOrderDrawer.mode === 'new') return undefined

    const purchaseOrder = purchaseOrderDrawer
    const workshopId = workshops.find(workshop => workshop.code === purchaseOrder.workshop_code)?.id || ''

    return {
      id: purchaseOrder.id,
      po_number: purchaseOrder.po_number,
      date: purchaseOrder.date,
      supplier: purchaseOrder.supplier,
      notes: purchaseOrder.notes || '',
      status: purchaseOrder.status,
      payment_method: purchaseOrder.payment_method,
      items: (purchaseOrder.purchase_items || []).map((item, index) => {
        const product = products.find(currentProduct => currentProduct.product_code === item.product_code)
        return {
          id: item.id || `${purchaseOrder.id}-${index}`,
          workshop_id: workshopId,
          category: product?.category || '',
          product_id: item.product_code,
          product_search: product?.name || '',
          qty: item.qty,
          unit: item.unit || product?.unit || 'PCS',
          unit_multiplier: item.unit_multiplier || 1,
          unit_cost: item.unit_price
        }
      })
    }
  }, [purchaseOrderDrawer, products, workshops])

  const isNewPurchaseOrder = purchaseOrderDrawer?.mode === 'new'

  const handlePurchaseOrderRowKeyDown = (event, purchaseOrder) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPurchaseOrder(purchaseOrder)
    }
  }

  const submitPay = async () => {
    if (!payTargetId) return
    setIsPaying(true)
    const res = await payPurchaseOrder(payTargetId, payMethod)
    if (res.success) {
      alert('PO berhasil dilunasi dan tercatat di Buku Besar.')
      window.location.reload()
    } else {
      alert('Gagal melunasi: ' + res.error)
      setIsPaying(false)
    }
  }

  const renderSortIcon = (key, isItem = false) => {
    const config = isItem ? itemSortConfig : sortConfig
    if (config.key !== key) return null
    return config.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  const handleItemSort = (key) => {
    let direction = 'asc'
    if (itemSortConfig.key === key && itemSortConfig.direction === 'asc') direction = 'desc'
    setItemSortConfig({ key, direction })
  }

  const filteredAndSorted = useMemo(() => {
    let result = purchaseOrders.filter(po => {
      const matchSearch = ((po.po_number || '').toLowerCase().includes(searchQuery.toLowerCase())) || 
                          ((po.supplier || '').toLowerCase().includes(searchQuery.toLowerCase()))
      
      const isLunas = po.status === 'LUNAS' || po.payment_status === 'LUNAS'
      
      let matchStatus = true
      if (filterStatus === 'LUNAS') {
        matchStatus = isLunas
      } else if (filterStatus === 'BELUM LUNAS') {
        matchStatus = !isLunas
      }

      // Filter Bulan: 
      // Jika statusnya LUNAS, atau filternya LUNAS, kita potong berdasarkan bulan.
      // Jika statusnya BELUM LUNAS (Tempo), tampilkan semua tanpa mempedulikan bulan.
      let matchMonth = true
      if (!searchQuery && (filterStatus === 'LUNAS' || (isLunas && filterStatus === ''))) {
        matchMonth = po.date && po.date.startsWith(selectedMonth)
      }

      return matchSearch && matchStatus && matchMonth
    })

    result.sort((a, b) => {
      let valA = a[sortConfig.key]
      let valB = b[sortConfig.key]
      
      if (sortConfig.key === 'total_amount') {
         valA = a.purchase_items?.reduce((sum, i) => sum + Number(i.total_price || 0), 0) || 0
         valB = b.purchase_items?.reduce((sum, i) => sum + Number(i.total_price || 0), 0) || 0
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [purchaseOrders, searchQuery, filterStatus, sortConfig, selectedMonth])

  useEffect(() => {
    setPoPage(1)
  }, [searchQuery, filterStatus, sortConfig, selectedMonth])

  const paginatedPOs = useMemo(() => {
    const start = (poPage - 1) * pageSize
    return filteredAndSorted.slice(start, start + pageSize)
  }, [filteredAndSorted, poPage, pageSize])

  const filteredAndSortedItems = useMemo(() => {
    let result = purchaseItems.filter(item => {
      const matchSearch = ((item.products?.name || item.item_name || '').toLowerCase().includes(itemSearchQuery.toLowerCase())) ||
                          ((item.purchase_orders?.po_number || '').toLowerCase().includes(itemSearchQuery.toLowerCase())) ||
                          ((item.purchase_orders?.supplier || '').toLowerCase().includes(itemSearchQuery.toLowerCase()))
      
      // Filter Bulan
      let matchMonth = true
      if (!itemSearchQuery) {
        matchMonth = item.purchase_orders?.date && item.purchase_orders?.date.startsWith(selectedMonth)
      }

      return matchSearch && matchMonth
    })

    result.sort((a, b) => {
      let valA, valB
      if (itemSortConfig.key === 'date') {
        valA = a.purchase_orders?.date || ''
        valB = b.purchase_orders?.date || ''
      } else if (itemSortConfig.key === 'po_number') {
        valA = a.purchase_orders?.po_number || ''
        valB = b.purchase_orders?.po_number || ''
      } else if (itemSortConfig.key === 'supplier') {
        valA = a.purchase_orders?.supplier || ''
        valB = b.purchase_orders?.supplier || ''
      } else {
        valA = a[itemSortConfig.key]
        valB = b[itemSortConfig.key]
      }
      
      if (valA < valB) return itemSortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return itemSortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [purchaseItems, itemSearchQuery, itemSortConfig, selectedMonth])

  useEffect(() => {
    setItemPage(1)
  }, [itemSearchQuery, itemSortConfig, selectedMonth])

  const paginatedItems = useMemo(() => {
    const start = (itemPage - 1) * pageSize
    return filteredAndSortedItems.slice(start, start + pageSize)
  }, [filteredAndSortedItems, itemPage, pageSize])

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        <MonthFilter />
        <button type="button" onClick={openNewPurchaseOrder} className="btn-primary h-10 px-4 flex items-center justify-center gap-2 text-sm whitespace-nowrap w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Buat PO Baru
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="glass-card p-3 border-l-4 border-green-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Total Pembelian Gudang</p>
          <p className="text-xl font-bold text-foreground mt-2">Rp {(summary.beliGudang || 0).toLocaleString('id-ID')} <span className="text-xs font-normal text-foreground/50">Bulan Terpilih</span></p>
        </div>
        <div className="glass-card p-3 border-l-4 border-blue-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Total Pembelian Global</p>
          <p className="text-xl font-bold text-foreground mt-2">Rp {(summary.beliGlobal || 0).toLocaleString('id-ID')} <span className="text-xs font-normal text-foreground/50">Bulan Terpilih</span></p>
        </div>
        <div className="glass-card p-3 border-l-4 border-green-400">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Total Lunas</p>
          <p className="text-xl font-bold text-green-400 mt-2">Rp {(summary.lunas || 0).toLocaleString('id-ID')} <span className="text-xs font-normal text-foreground/50">Bulan Terpilih</span></p>
        </div>
        <div className="glass-card p-3 border-l-4 border-yellow-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Total Tempo Aktif</p>
          <p className="text-xl font-bold text-yellow-400 mt-2">Rp {(summary.tempo || 0).toLocaleString('id-ID')} <span className="text-xs font-normal text-foreground/50">Seluruh Waktu</span></p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 border-b border-white/10 mb-4 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('PO')}
          className={`pb-2 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'PO' ? 'border-primary text-primary' : 'border-transparent text-foreground/50 hover:text-foreground/80'}`}
        >
          Invoice PO
        </button>
        <button 
          onClick={() => setActiveTab('ITEMS')}
          className={`pb-2 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'ITEMS' ? 'border-primary text-primary' : 'border-transparent text-foreground/50 hover:text-foreground/80'}`}
        >
          Purchase Items
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder={activeTab === 'PO' ? "Cari supplier atau PO..." : "Cari item, supplier, atau PO..."}
              value={activeTab === 'PO' ? searchQuery : itemSearchQuery}
              onChange={e => activeTab === 'PO' ? setSearchQuery(e.target.value) : setItemSearchQuery(e.target.value)}
              className="glass-input !pl-10 h-10 w-full text-sm"
            />
          </div>
          {activeTab === 'PO' && (
            <CustomSelect 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)} 
              options={[
                { value: "", label: "Semua Status" },
                { value: "LUNAS", label: "Lunas Saja" },
                { value: "BELUM LUNAS", label: "Belum Lunas (Tempo)" }
              ]}
            />
          )}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'PO' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('date')}>Tanggal {renderSortIcon('date')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('supplier')}>Supplier {renderSortIcon('supplier')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('total_amount')}>Total Tagihan {renderSortIcon('total_amount')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('status')}>Status Bayar {renderSortIcon('status')}</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedPOs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-foreground/40">
                      {filterStatus === 'LUNAS' ? 'Tidak ada riwayat Lunas di bulan ini.' : 'Belum ada riwayat Purchase Order.'}
                    </td>
                  </tr>
                ) : paginatedPOs.map((item) => {
                  const totalAmount = item.purchase_items?.reduce((sum, i) => sum + Number(i.total_price || 0), 0) || 0
                  return (
                  <tr
                    key={item.id}
                    onClick={() => openPurchaseOrder(item)}
                    onKeyDown={(event) => handlePurchaseOrderRowKeyDown(event, item)}
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50"
                  >
                    <td className="px-4 py-3 text-foreground/90">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 text-foreground/90 font-medium">{item.supplier || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-blue-400">Rp {Number(totalAmount).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${item.status === 'LUNAS' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {item.status || 'BELUM LUNAS'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                      {item.status !== 'LUNAS' && (
                        <button onClick={(event) => { event.stopPropagation(); openPayModal(item.id) }} className="rounded-full bg-green-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-400">
                          Pelunasan
                        </button>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('date')}>Tanggal {renderSortIcon('date', true)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('po_number')}>No PO {renderSortIcon('po_number', true)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('supplier')}>Supplier {renderSortIcon('supplier', true)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('item_name')}>Nama Item {renderSortIcon('item_name', true)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('qty')}>Qty {renderSortIcon('qty', true)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('unit_price')}>Harga Satuan {renderSortIcon('unit_price', true)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('total_price')}>Total {renderSortIcon('total_price', true)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-foreground/40">
                      Tidak ada purchase items.
                    </td>
                  </tr>
                ) : paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-foreground/90">{item.purchase_orders?.date ? new Date(item.purchase_orders.date).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="px-4 py-3 text-foreground/90 font-medium">{item.purchase_orders?.po_number || '-'}</td>
                    <td className="px-4 py-3 text-foreground/90">{item.purchase_orders?.supplier || '-'}</td>
                    <td className="px-4 py-3 font-medium">{item.products?.name || item.item_name || '-'}</td>
                    <td className="px-4 py-3">{item.qty} {item.unit}</td>
                    <td className="px-4 py-3">Rp {Number(item.unit_price || 0).toLocaleString('id-ID')}</td>
                    <td className="px-4 py-3 font-semibold text-blue-400">Rp {Number(item.total_price || 0).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination Controls */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-foreground/70">
          {activeTab === 'PO' ? (
            <>
              <div>
                Menampilkan {filteredAndSorted.length === 0 ? 0 : (poPage - 1) * pageSize + 1} - {Math.min(poPage * pageSize, filteredAndSorted.length)} dari <span className="font-bold text-foreground">{filteredAndSorted.length}</span> PO
              </div>
              <div className="flex items-center gap-2">
                <button disabled={poPage <= 1} onClick={() => setPoPage(p => p - 1)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                  Previous
                </button>
                <span className="px-3 font-medium text-foreground">Halaman {poPage} dari {Math.ceil(filteredAndSorted.length / pageSize) || 1}</span>
                <button disabled={poPage >= Math.ceil(filteredAndSorted.length / pageSize)} onClick={() => setPoPage(p => p + 1)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                Menampilkan {filteredAndSortedItems.length === 0 ? 0 : (itemPage - 1) * pageSize + 1} - {Math.min(itemPage * pageSize, filteredAndSortedItems.length)} dari <span className="font-bold text-foreground">{filteredAndSortedItems.length}</span> item
              </div>
              <div className="flex items-center gap-2">
                <button disabled={itemPage <= 1} onClick={() => setItemPage(p => p - 1)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                  Previous
                </button>
                <span className="px-3 font-medium text-foreground">Halaman {itemPage} dari {Math.ceil(filteredAndSortedItems.length / pageSize) || 1}</span>
                <button disabled={itemPage >= Math.ceil(filteredAndSortedItems.length / pageSize)} onClick={() => setItemPage(p => p + 1)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {purchaseOrderDrawer && (
        <PurchaseOrderWizard
          suppliers={suppliers}
          products={products}
          workshops={workshops}
          initialData={isNewPurchaseOrder ? undefined : drawerInitialData}
          dropdownConfig={dropdownConfig}
          onClose={closePurchaseOrder}
          onSaved={handlePurchaseOrderSaved}
        />
      )}

      {/* MODAL PELUNASAN */}
      {payModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={event => event.target === event.currentTarget && setPayModalOpen(false)}>
          <div className="glass-card w-full max-w-md p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-bold text-foreground">Pelunasan PO</h3>
              <p className="text-sm text-foreground/60 mt-1">Pilih metode pembayaran untuk melunasi tagihan ini.</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground/80">Metode Pembayaran</label>
              <CustomSelect 
                value={payMethod} 
                onChange={e => setPayMethod(e.target.value)} 
                options={(dropdownConfig.payment_method || ["BCA", "MANDIRI", "CASH"]).map(method => ({
                  value: method,
                  label: method
                }))}
              />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button 
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 rounded-lg font-medium text-sm text-foreground/70 hover:bg-white/10 transition-colors"
                disabled={isPaying}
              >
                Batal
              </button>
              <button 
                onClick={submitPay}
                disabled={isPaying}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
              >
                {isPaying ? 'Memproses...' : 'Lunasi PO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
