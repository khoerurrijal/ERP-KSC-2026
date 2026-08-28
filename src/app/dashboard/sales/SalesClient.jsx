'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, Plus, TrendingUp, Filter, ChevronUp, ChevronDown, X, Save, Clock, Package, FileText, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { addSalesPayment, updateSalesItemStatus, cancelSalesOrder } from '@/app/actions/sales'
import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'
import CurrencyInput from '@/components/CurrencyInput'
import MockupUploadModal from '@/components/MockupUploadModal'
import ImageViewerModal from '@/components/ImageViewerModal'
import SalesOrderWizard from '@/components/SalesOrderWizard'

export default function SalesClient({ 
  salesOrders = [], 
  totalCount = 0,
  page = 1,
  pageSize = 50,
  salesItems = [], 
  dropdownConfig = {},
  searchParams: passedSearchParams = {},
  serverTotalOmset,
  serverTotalPiutang,
  customers = [],
  products = [],
  workshops = [],
  pricelistConfig = {},
  initialTab = 'INVOICE',
  embedded = false,
  showItemsTab = true
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const supabase = createClient()

  // Status order is now dynamic from settings
  const productionStatuses = dropdownConfig.production_status || ['DRAFT', 'BARU MASUK', 'SIAP PROSES', 'PROSES', 'SUDAH JADI', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI']

  // Tab State: 'INVOICE' | 'ITEMS'
  const [activeTab, setActiveTab] = useState(initialTab)

  const [searchQuery, setSearchQuery] = useState(passedSearchParams.search || '')
  const [debouncedSearch, setDebouncedSearch] = useState(passedSearchParams.search || '')
  const [showFilters, setShowFilters] = useState(Boolean(passedSearchParams.status || passedSearchParams.customerType))
  const [filterStatus, setFilterStatus] = useState(passedSearchParams.status || 'BELUM_LUNAS') 
  const [filterCustomerType, setFilterCustomerType] = useState(passedSearchParams.customerType || 'ALL')
  const [itemFilterStatus, setItemFilterStatus] = useState('ALL') // For items tab
  const [itemPage, setItemPage] = useState(1)
  const itemPageSize = 50
  const filterMonth = passedSearchParams.month || ''

  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [itemSortConfig, setItemSortConfig] = useState({ key: 'id', direction: 'desc' })
  const [editingOrder, setEditingOrder] = useState(null)
  const [newPaymentAmount, setNewPaymentAmount] = useState('')
  const [newPaymentMethod, setNewPaymentMethod] = useState('BCA')
  const [newPaymentDate, setNewPaymentDate] = useState('')
  const [paymentHistory, setPaymentHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingItem, setUpdatingItem] = useState(null)
  const [correctionModal, setCorrectionModal] = useState({ isOpen: false, itemId: null, currentStatus: '', targetStatus: '', targetQty: '' })
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [mockupModal, setMockupModal] = useState({ isOpen: false, itemId: null, url: '' })
  const [zoomImage, setZoomImage] = useState(null)
  const [salesOrderDrawer, setSalesOrderDrawer] = useState(null)

  const openSalesOrderDrawer = (order = null) => {
    setSalesOrderDrawer(order ? {
      ...order,
      items: order.sales_items || []
    } : { items: [] })
  }

  const closeSalesOrderDrawer = () => setSalesOrderDrawer(null)

  const refreshSalesOrderList = () => {
    setSalesOrderDrawer(null)
    router.refresh()
  }
  const updateQueryParams = useCallback((newParams) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    Object.entries(newParams).forEach(([key, val]) => {
      if (val) {
        params.set(key, val)
      } else {
        params.delete(key)
      }
    })
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, pathname, router])

  // Debounce search input 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      if ((passedSearchParams.search || '') !== searchQuery) {
        setItemPage(1)
        updateQueryParams({ search: searchQuery, page: '1' })
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery, passedSearchParams.search, updateQueryParams])

  const handleEditClick = async (order) => {
    setEditingOrder(order)
    setNewPaymentAmount('')
    setNewPaymentMethod('BCA')
    setNewPaymentDate(new Date().toISOString().split('T')[0])
    
    setIsLoadingHistory(true)
    const { data } = await supabase.from('transactions')
      .select('*')
      .eq('so_id', order.id)
      .eq('reference', 'PENJUALAN')
      .order('date', { ascending: true })
    
    setPaymentHistory(data || [])
    setIsLoadingHistory(false)
  }

  const closeEditModal = () => {
    setEditingOrder(null)
    setPaymentHistory([])
  }

  const handleSaveEdit = async () => {
    if (!newPaymentAmount || isNaN(newPaymentAmount) || Number(newPaymentAmount) <= 0) {
      alert('Masukkan nominal pembayaran yang valid')
      return
    }

    setIsSaving(true)
    const { success, error } = await addSalesPayment(editingOrder.id, {
      amount: Number(newPaymentAmount),
      method: newPaymentMethod,
      date: newPaymentDate
    })
    setIsSaving(false)

    if (success) {
      closeEditModal()
    } else {
      alert(error || 'Gagal menyimpan pembayaran')
    }
  }

  const handleItemStatusChange = async (itemId, currentStatus, newStatus) => {
    // Check for backward movement
    const currIdx = productionStatuses.indexOf((currentStatus || 'BARU MASUK').toUpperCase());
    const newIdx = productionStatuses.indexOf((newStatus).toUpperCase());

    if (newIdx < currIdx) {
      setCorrectionModal({ isOpen: true, itemId, currentStatus, targetStatus: newStatus, targetQty: '' });
      return;
    }

    setUpdatingItem(itemId);
    const { success, error } = await updateSalesItemStatus(itemId, newStatus);
    setUpdatingItem(null);

    if (!success) {
      alert(error || 'Gagal update status item');
    }
  }

  const submitStatusCorrection = async () => {
    if (!correctionModal.targetQty || isNaN(correctionModal.targetQty)) {
      alert("Harap masukkan Qty yang benar saat ini.");
      return;
    }
    
    setIsCorrecting(true);
    try {
      const supabase = await createClient();
      await updateSalesItemStatus(correctionModal.itemId, correctionModal.targetStatus);
      
      const { data: logs } = await supabase.from('production_logs').select('qty_processed').eq('job_id', correctionModal.itemId);
      const currentTotal = (logs || []).reduce((sum, item) => sum + item.qty_processed, 0);
      const adjustment = Number(correctionModal.targetQty) - currentTotal;
      
      if (adjustment !== 0) {
        await supabase.from('production_logs').insert([{
          job_id: correctionModal.itemId,
          qty_processed: adjustment,
          qty_defect: 0,
          notes: `Koreksi Status Mundur (${correctionModal.currentStatus} -> ${correctionModal.targetStatus})`,
          processed_date: new Date().toISOString()
        }]);
      }
      
      setCorrectionModal({ isOpen: false, itemId: null, currentStatus: '', targetStatus: '', targetQty: '' });
      window.location.reload();
    } catch (e) {
      alert("Terjadi kesalahan.");
    } finally {
      setIsCorrecting(false);
    }
  }

  const handleCancelSalesOrder = async (soId, invoiceNumber) => {
    const confirm = window.confirm(`Peringatan: Anda akan membatalkan pesanan ${invoiceNumber}. Ini akan mengembalikan stok tersedia dan menghapus riwayat pembayaran. Lanjutkan?`);
    if (!confirm) return;

    setUpdatingItem(soId);
    const { success, error } = await cancelSalesOrder(soId);
    setUpdatingItem(null);

    if (!success) {
      alert(error || 'Gagal membatalkan pesanan');
    } else {
      alert(`Pesanan ${invoiceNumber} berhasil dibatalkan.`);
      setSalesOrderDrawer(null)
      router.refresh()
    }
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const handleItemSort = (key) => {
    let direction = 'asc'
    if (itemSortConfig.key === key && itemSortConfig.direction === 'asc') direction = 'desc'
    setItemSortConfig({ key, direction })
  }

  // Memoized Invoice Data
  const filteredAndSortedOrders = useMemo(() => {
    return salesOrders
  }, [salesOrders])

  // Memoized Item Data
  const filteredAndSortedItems = useMemo(() => {
    const searchLower = (debouncedSearch || '').toLowerCase().trim()

    let filtered = salesItems.filter(item => {
      const so = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders
      const cust = Array.isArray(so?.customers) ? so?.customers[0] : so?.customers
      const prod = Array.isArray(item.products) ? item.products[0] : item.products

      const invoiceNum = (so?.invoice_number || '').toLowerCase()
      const customerName = (cust?.name || '').toLowerCase()
      const productName = (prod?.name || item.product_name || item.item_name || '').toLowerCase()
      const productCode = (item.product_code || '').toLowerCase()
      const notesStr = (item.notes || '').toLowerCase()
      const itemProdStatus = (item.status || 'BARU MASUK').toString().replace(/_/g, ' ').toUpperCase().trim()

      const matchSearch = !searchLower || 
        invoiceNum.includes(searchLower) ||
        customerName.includes(searchLower) ||
        productName.includes(searchLower) ||
        productCode.includes(searchLower) ||
        notesStr.includes(searchLower) ||
        itemProdStatus.toLowerCase().includes(searchLower)
      
      const rawDate = so?.date || ''
      let itemMonth = ''
      if (rawDate.includes('-')) {
        itemMonth = rawDate.substring(0, 7)
      } else if (rawDate.includes('/')) {
        const parts = rawDate.split('/')
        if (parts.length === 3) itemMonth = `${parts[2]}-${parts[1].padStart(2, '0')}`
      }

      const matchMonth = filterMonth ? itemMonth === filterMonth : true

      let matchStatus = true
      if (itemFilterStatus !== 'ALL') {
        const normFilterStatus = itemFilterStatus.toString().replace(/_/g, ' ').toUpperCase().trim()
        matchStatus = itemProdStatus === normFilterStatus
      }

      const paymentStatus = (so?.payment_status || '').toLowerCase()
      const searchIncludesPayment = searchLower && paymentStatus.includes(searchLower)
      const finalSearchMatch = matchSearch || searchIncludesPayment

      return finalSearchMatch && matchMonth && matchStatus
    })

    return filtered.sort((a, b) => {
      const soA = Array.isArray(a.sales_orders) ? a.sales_orders[0] : a.sales_orders
      const soB = Array.isArray(b.sales_orders) ? b.sales_orders[0] : b.sales_orders
      const custA = Array.isArray(soA?.customers) ? soA?.customers[0] : soA?.customers
      const custB = Array.isArray(soB?.customers) ? soB?.customers[0] : soB?.customers
      const prodA = Array.isArray(a.products) ? a.products[0] : a.products
      const prodB = Array.isArray(b.products) ? b.products[0] : b.products

      let aVal = a[itemSortConfig.key]
      let bVal = b[itemSortConfig.key]

      if (itemSortConfig.key === 'customers_name') {
        aVal = custA?.name || ''
        bVal = custB?.name || ''
      } else if (itemSortConfig.key === 'invoice_number') {
        aVal = soA?.invoice_number || ''
        bVal = soB?.invoice_number || ''
      } else if (itemSortConfig.key === 'product_name') {
        aVal = prodA?.name || a.product_name || a.item_name || ''
        bVal = prodB?.name || b.product_name || b.item_name || ''
      }

      if (aVal < bVal) return itemSortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return itemSortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [salesItems, debouncedSearch, filterMonth, itemFilterStatus, itemSortConfig])

  useEffect(() => {
    setItemPage(1)
  }, [debouncedSearch, filterMonth, itemFilterStatus, itemSortConfig])

  const paginatedItems = useMemo(() => {
    const start = (itemPage - 1) * itemPageSize
    return filteredAndSortedItems.slice(start, start + itemPageSize)
  }, [filteredAndSortedItems, itemPage, itemPageSize])

  const totalOmset = useMemo(() => {
    if (serverTotalOmset !== undefined) return serverTotalOmset
    return salesOrders.filter(o => !filterMonth || o.date?.substring(0, 7) === filterMonth).reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  }, [serverTotalOmset, salesOrders, filterMonth])

  const totalPiutang = useMemo(() => {
    if (serverTotalPiutang !== undefined) return serverTotalPiutang
    return salesOrders.filter(o => !filterMonth || o.date?.substring(0, 7) === filterMonth).reduce((sum, o) => sum + Math.max(0, Number(o.total_amount || 0) - Number(o.dp_amount || 0)), 0)
  }, [serverTotalPiutang, salesOrders, filterMonth])

  const renderSortIcon = (key, config) => {
    if (config.key !== key) return <span className="inline-block w-3 opacity-0">&#8597;</span>
    return config.direction === 'asc' ? <ChevronUp className="inline-block w-3 h-3 text-primary" /> : <ChevronDown className="inline-block w-3 h-3 text-primary" />
  }

  return (
    <div className="space-y-4">
      {/* Header and KPI */}
      {!embedded && <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        <div className="hidden sm:block">
          <MonthFilter />
        </div>
        <button type="button" onClick={() => openSalesOrderDrawer()} className="btn-primary h-10 px-4 text-sm flex items-center justify-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" /> Buat Sales Order Baru
        </button>
      </div>}

      {/* KPI Cards */}
      {!embedded && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass-card p-3 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-foreground/60 font-medium">Total Omset (Bulan Terpilih)</p>
            <p className="text-lg font-bold text-white">Rp {totalOmset.toLocaleString('id-ID')}</p>
          </div>
        </div>
        <div className="glass-card p-3 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-foreground/60 font-medium">Total Piutang Berjalan</p>
            <p className="text-lg font-bold text-white">Rp {totalPiutang.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>}

      {/* Tabs */}
      {!embedded && showItemsTab && <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('INVOICE')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-all ${activeTab === 'INVOICE' ? 'text-primary border-primary' : 'text-foreground/60 border-transparent hover:text-foreground'}`}
        >
          <FileText className="w-4 h-4" /> Data Invoice & Pembayaran
        </button>
        {showItemsTab && (
          <button
            onClick={() => setActiveTab('ITEMS')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-all ${activeTab === 'ITEMS' ? 'text-primary border-primary' : 'text-foreground/60 border-transparent hover:text-foreground'}`}
          >
            <Package className="w-4 h-4" /> Status Item Produksi
          </button>
        )}
      </div>}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input 
            type="text" 
            placeholder={activeTab === 'INVOICE' ? "Cari no invoice, pelanggan..." : "Cari produk, invoice, pelanggan..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input pl-9 w-full h-10"
          />
        </div>
        
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`h-10 px-4 rounded-xl border flex items-center gap-2 text-sm font-medium transition-all ${showFilters ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-foreground/70 hover:text-white'}`}
        >
          <Filter className="w-4 h-4" /> Filter {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Additional Filters Wrapper */}
      {showFilters && (
        <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 mb-6 relative z-50">
          <div className="space-y-1 block sm:hidden">
            <label className="text-xs text-foreground/60">Bulan</label>
            <MonthFilter />
          </div>
          
          {activeTab === 'INVOICE' ? (
            <>
              <div className="space-y-1">
                <label className="text-xs text-foreground/60">Status Pembayaran</label>
                <CustomSelect 
                  value={filterStatus} 
                  onChange={e => {
                    const val = e.target.value
                    setFilterStatus(val)
                    updateQueryParams({ status: val, page: '1' })
                  }} 
                  options={[
                    { value: "ALL", label: "Semua Pembayaran" },
                    { value: "BELUM_LUNAS", label: "Belum Lunas / DP" },
                    { value: "LUNAS", label: "Lunas" }
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-foreground/60">Tipe Pelanggan</label>
                <CustomSelect 
                  value={filterCustomerType} 
                  onChange={e => {
                    const val = e.target.value
                    setFilterCustomerType(val)
                    updateQueryParams({ customerType: val === 'ALL' ? '' : val, page: '1' })
                  }} 
                  options={[
                    { value: "ALL", label: "Semua Tipe" },
                    ...(dropdownConfig.customer_type || ["REGULLER", "RESELLER", "SHOPEE", "TOKOPEDIA"]).map(t => ({ value: t, label: t }))
                  ]}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-foreground/60">Status Barang (Item)</label>
              <CustomSelect 
                value={itemFilterStatus} 
                onChange={e => setItemFilterStatus(e.target.value)} 
                options={[
                  { value: "ALL", label: "Semua Status" },
                  ...productionStatuses.map(s => ({ value: s, label: s }))
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="glass-card overflow-hidden">
        {activeTab === 'INVOICE' ? (
          /* TAB 1: INVOICES */
          <div className="overflow-x-auto min-h-[180px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('date')}>Tanggal {renderSortIcon('date', sortConfig)}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('customers_name')}>Pelanggan {renderSortIcon('customers_name', sortConfig)}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('total_amount')}>Total Nominal {renderSortIcon('total_amount', sortConfig)}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('payment_status')}>Status Bayar {renderSortIcon('payment_status', sortConfig)}</th>
                  <th className="px-6 py-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAndSortedOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-foreground/40">
                      Belum ada riwayat Sales Order.
                    </td>
                  </tr>
                ) : filteredAndSortedOrders.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      onClick={() => openSalesOrderDrawer(item)}
                      className="cursor-pointer transition-colors group hover:bg-white/5"
                    >
                      <td className="px-4 py-3 text-foreground/90">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                      <td className="px-4 py-3 text-foreground/90 font-medium">
                        {item.customers?.name}
                        <br/><span className="text-[10px] text-foreground/50">{item.invoice_number}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-400">Rp {Number(item.total_amount || 0).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/10 ${item.payment_status === 'LUNAS' ? 'bg-green-500/20 text-green-400' : item.payment_status === 'BATAL' ? 'bg-red-500/20 text-red-500' : item.payment_status === 'DP' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                          {item.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.payment_status !== 'BATAL' && (
                            <button onClick={(event) => { event.stopPropagation(); handleEditClick(item) }} className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1.5 text-[11px] font-bold text-black transition-colors hover:bg-green-400">
                              <Clock className="w-3 h-3" /> Pelunasan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination Controls for Sales Orders */}
            <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-foreground/70">
              <div>
                Menampilkan {totalCount === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} dari <span className="font-bold text-foreground">{totalCount}</span> transaksi
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => updateQueryParams({ page: (page - 1).toString() })}
                  className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <span className="px-3 font-medium text-foreground">
                  Halaman {page} dari {Math.ceil(totalCount / pageSize) || 1}
                </span>
                <button
                  disabled={page >= Math.ceil(totalCount / pageSize)}
                  onClick={() => updateQueryParams({ page: (page + 1).toString() })}
                  className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: ITEMS */
          <div className="overflow-x-auto min-h-[180px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium">SO Date / Ref</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('customers_name')}>Pelanggan {renderSortIcon('customers_name', itemSortConfig)}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleItemSort('product_name')}>Produk {renderSortIcon('product_name', itemSortConfig)}</th>
                  <th className="px-4 py-3 font-medium text-center">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Status Operasional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-foreground/40">
                      Belum ada data barang.
                    </td>
                  </tr>
                ) : paginatedItems.map((item) => {
                  const so = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders
                  const cust = Array.isArray(so?.customers) ? so?.customers[0] : so?.customers
                  const prod = Array.isArray(item.products) ? item.products[0] : item.products

                  const currentStatus = (item.status || 'BARU MASUK').toString().replace(/_/g, ' ').toUpperCase().trim();
                  const isUpdating = updatingItem === item.id;
                  const deliveryStatuses = ['DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'];
                  const isDeliveryStatus = deliveryStatuses.includes(currentStatus);
                  const productionStatusChoices = productionStatuses.filter(status => !deliveryStatuses.includes(status.toUpperCase()));
                  
                  let itemStatuses = productionStatusChoices;
                  if (item.order_type?.toUpperCase() === 'POLOS') {
                    const polosStatuses = ['BARU MASUK', 'SIAP KIRIM'];
                    itemStatuses = productionStatusChoices.filter(s => polosStatuses.includes(s.toUpperCase()));
                    if (itemStatuses.length === 0) itemStatuses = polosStatuses;
                  }
                  
                  if (currentStatus === 'BATAL') {
                    itemStatuses = [...itemStatuses, 'BATAL'];
                  }

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2 align-middle">
                        <p className="text-xs text-foreground/80">{so?.date ? new Date(so.date).toLocaleDateString('id-ID') : '-'}</p>
                        <p className="text-[9px] text-foreground/40 mt-0.5">{so?.invoice_number || '-'}</p>
                      </td>
                      <td className="px-4 py-2 align-middle text-xs font-semibold text-white/90">
                        {cust?.name || '-'}
                        {so?.payment_status === 'LUNAS' ? 
                          <span className="ml-2 text-[8px] font-bold bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">LUNAS</span> : 
                          <span className="ml-2 text-[8px] font-bold bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">DP/BL</span>}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <p className="text-xs text-white font-bold">{prod?.name || item.product_code || '-'}</p>
                        <p className="text-[9px] text-primary/80 mt-0.5"><span className="bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded uppercase">{item.order_type}</span></p>
                      </td>
                      <td className="px-4 py-2 align-middle text-center">
                        <span className="font-semibold text-xs text-white/90">
                          {Number(item.qty * (item.unit_multiplier || 1)).toLocaleString('id-ID')} Pcs
                        </span>
                      </td>
                      <td className="px-4 py-2 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              if (item.mockup_url) {
                                setZoomImage(item.mockup_url);
                              } else {
                                setMockupModal({ isOpen: true, itemId: item.id, url: '' });
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setMockupModal({ isOpen: true, itemId: item.id, url: item.mockup_url || '' });
                            }}
                            title={item.mockup_url ? 'Klik Kiri: Lihat, Klik Kanan: Edit Mockup' : 'Set Mockup'}
                            className={`p-1.5 rounded-md transition-all border ${item.mockup_url ? 'bg-primary/20 border-primary/30 text-primary hover:bg-primary/30' : 'bg-white/5 border-white/10 text-foreground/60 hover:bg-white/10'}`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <div className="relative inline-block w-36 text-left">
                            {isDeliveryStatus ? (
                              <span className="block w-full rounded-md border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[11px] font-bold text-green-400">
                                {currentStatus}
                              </span>
                            ) : (
                              <>
                                <select
                                  value={currentStatus}
                                  disabled={isUpdating || currentStatus === 'BATAL'}
                                  onChange={(e) => handleItemStatusChange(item.id, currentStatus, e.target.value)}
                                  className={`w-full appearance-none outline-none border rounded-md px-2.5 py-1 text-[11px] font-bold transition-all
                                    ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                                    ${currentStatus === 'PROSES' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                      currentStatus === 'SIAP KIRIM' ? 'bg-blue-500/10 text-blue-400 border-blue-400/20' :
                                      'bg-white/5 text-foreground border-white/10 hover:border-white/20'}`}
                                >
                                  {itemStatuses.map(statusOption => (
                                    <option key={statusOption} value={statusOption} className="bg-[#1a1f2e] text-white">
                                      {statusOption}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-current pointer-events-none opacity-50" />
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {/* Pagination Controls for Items */}
            <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-foreground/70">
              <div>
                Menampilkan {filteredAndSortedItems.length === 0 ? 0 : (itemPage - 1) * itemPageSize + 1} - {Math.min(itemPage * itemPageSize, filteredAndSortedItems.length)} dari <span className="font-bold text-foreground">{filteredAndSortedItems.length}</span> item
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={itemPage <= 1}
                  onClick={() => setItemPage(p => p - 1)}
                  className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <span className="px-3 font-medium text-foreground">
                  Halaman {itemPage} dari {Math.ceil(filteredAndSortedItems.length / itemPageSize) || 1}
                </span>
                <button
                  disabled={itemPage >= Math.ceil(filteredAndSortedItems.length / itemPageSize)}
                  onClick={() => setItemPage(p => p + 1)}
                  className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {salesOrderDrawer && (
        <SalesOrderWizard
          customers={customers}
          products={products}
          workshops={workshops}
          dropdownConfig={dropdownConfig}
          pricelistConfig={pricelistConfig}
          initialData={salesOrderDrawer.id ? salesOrderDrawer : undefined}
          onClose={closeSalesOrderDrawer}
          onSaved={refreshSalesOrderList}
          onCancel={handleCancelSalesOrder}
        />
      )}

      {/* Modal Edit Pembayaran (Unchanged) */}
      {editingOrder && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={event => event.target === event.currentTarget && closeEditModal()}>
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-foreground">Riwayat & Tambah Pembayaran</h3>
              <button onClick={closeEditModal} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl text-sm mb-4">
                <p className="text-foreground/80">Ref: <span className="font-bold text-primary">{editingOrder.invoice_number}</span></p>
                <p className="text-foreground/80">Pelanggan: <span className="font-bold text-foreground">{editingOrder.customers?.name}</span></p>
                <p className="text-foreground/80 mt-2">Total Invoice: <span className="font-bold">Rp {Number(editingOrder.total_amount || 0).toLocaleString('id-ID')}</span></p>
                <p className="text-foreground/80">Telah Dibayar: <span className="font-bold text-green-400">Rp {Number(editingOrder.dp_amount || 0).toLocaleString('id-ID')}</span></p>
                <p className="text-foreground/80">Sisa Tagihan: <span className="font-bold text-orange-400">Rp {Math.max(0, Number(editingOrder.total_amount || 0) - Number(editingOrder.dp_amount || 0)).toLocaleString('id-ID')}</span></p>
              </div>

              {/* History Pembayaran */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 flex items-center gap-2"><Clock className="w-4 h-4" /> Riwayat Pembayaran</label>
                {isLoadingHistory ? (
                  <p className="text-xs text-foreground/40">Memuat riwayat...</p>
                ) : paymentHistory.length === 0 ? (
                  <p className="text-xs text-foreground/40 italic">Belum ada pembayaran sama sekali.</p>
                ) : (
                  <div className="space-y-2">
                    {paymentHistory.map(trx => (
                      <div key={trx.id} className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/10 text-xs">
                        <div>
                          <p className="font-semibold text-foreground/90">{new Date(trx.date).toLocaleDateString('id-ID')}</p>
                          <p className="text-foreground/60">{trx.payment_method}</p>
                        </div>
                        <p className="font-bold text-green-400">+ Rp {Number(trx.amount_in).toLocaleString('id-ID')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tambah Pembayaran Baru */}
              {editingOrder.payment_status !== 'LUNAS' && (
                <div className="mt-6 pt-4 border-t border-white/10 space-y-4">
                  <h4 className="text-sm font-bold text-foreground">Tambah Pembayaran Baru</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-foreground/60">Tanggal</label>
                      <CustomDatePicker value={newPaymentDate} onChange={setNewPaymentDate} className="!h-10" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-foreground/60">Metode Pembayaran</label>
                      <CustomSelect 
                        value={newPaymentMethod} 
                        onChange={e => setNewPaymentMethod(e.target.value)} 
                        options={(dropdownConfig.payment_method || ["BCA", "MANDIRI", "CASH"]).map(method => ({
                          value: method,
                          label: method
                        }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground/80">Nominal Pembayaran Baru (Rp)</label>
                    <CurrencyInput
                      value={newPaymentAmount} 
                      onChange={e => setNewPaymentAmount(e.target.value)} 
                      placeholder="Masukkan nominal..."
                      className="glass-input w-full h-10" 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={closeEditModal} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              {editingOrder.payment_status !== 'LUNAS' && (
                <button onClick={handleSaveEdit} disabled={isSaving} className="btn-primary px-4 h-10 text-sm flex items-center gap-2">
                  <Save className="w-4 h-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Koreksi Status Mundur */}
      {correctionModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={event => event.target === event.currentTarget && setCorrectionModal({ isOpen: false, itemId: null, currentStatus: '', targetStatus: '', targetQty: '' })}>
          <div className="bg-background border border-red-500/30 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-red-500/20 flex justify-between items-center bg-red-500/5">
              <h3 className="font-bold text-red-400">Koreksi Status & Qty</h3>
              <button onClick={() => setCorrectionModal({ isOpen: false, itemId: null, currentStatus: '', targetStatus: '', targetQty: '' })} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground/80">
                Anda memundurkan status dari <span className="font-bold text-white">{correctionModal.currentStatus}</span> ke <span className="font-bold text-red-400">{correctionModal.targetStatus}</span>. 
                Sistem mendeteksi kemungkinan adanya kesalahan/pembatalan produksi.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Total Qty yang BENAR Dikerjakan Saat Ini <span className="text-red-400">*</span></label>
                <input 
                  type="number" 
                  min="0"
                  value={correctionModal.targetQty} 
                  onChange={e => setCorrectionModal({...correctionModal, targetQty: e.target.value})} 
                  className="glass-input w-full font-bold text-lg border-red-500/30 focus:border-red-500/50" 
                  placeholder="Misal: 0 atau 500"
                />
                <p className="text-xs text-red-400/80">Masukkan Qty saat ini (misal 0 jika diulang dari awal).</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                 <button onClick={() => setCorrectionModal({ isOpen: false, itemId: null, currentStatus: '', targetStatus: '', targetQty: '' })} className="btn-secondary px-4 h-10 text-sm">Batal</button>
                 <button disabled={isCorrecting} onClick={submitStatusCorrection} className="px-4 h-10 text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-all border border-red-500/30 disabled:opacity-50 flex items-center gap-2">
                   {isCorrecting ? 'Memproses...' : 'Terapkan Koreksi'}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mockup Upload Modal */}
      <MockupUploadModal 
        isOpen={mockupModal.isOpen} 
        onClose={() => setMockupModal({ isOpen: false, itemId: null, url: '' })} 
        itemId={mockupModal.itemId} 
        initialUrl={mockupModal.url} 
      />

      <ImageViewerModal 
        isOpen={!!zoomImage} 
        onClose={() => setZoomImage(null)} 
        imageUrl={zoomImage} 
      />

    </div>
  )
}
