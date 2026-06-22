'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, TrendingUp, Filter, ChevronUp, ChevronDown, Edit, X, Save, Clock, Edit3, Package, FileText, ExternalLink, Printer, XCircle, Camera } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { addSalesPayment, updateSalesItemStatus, cancelSalesOrder } from '@/app/actions/sales'
import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'
import MockupUploadModal from '@/components/MockupUploadModal'

export default function SalesClient({ salesOrders = [], salesItems = [], dropdownConfig = {} }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Status order is now dynamic from settings
  const productionStatuses = dropdownConfig.production_status || ['DRAFT', 'BARU MASUK', 'SIAP PROSES', 'PROSES', 'SUDAH JADI', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI']

  // Tab State: 'INVOICE' | 'ITEMS'
  const [activeTab, setActiveTab] = useState('INVOICE')

  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState('BELUM_LUNAS') 
  const [filterCustomerType, setFilterCustomerType] = useState('ALL')
  const [itemFilterStatus, setItemFilterStatus] = useState('ALL') // For items tab
  
  // Correction popup state
  const [correctionModal, setCorrectionModal] = useState({ isOpen: false, itemId: null, currentStatus: '', targetStatus: '', targetQty: '' })
  const [isCorrecting, setIsCorrecting] = useState(false) // For items tab

  // Mockup popup state
  const [mockupModal, setMockupModal] = useState({ isOpen: false, itemId: null, url: '' })

  const filterMonth = searchParams.get('month') || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()
  
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' })
  const [itemSortConfig, setItemSortConfig] = useState({ key: 'created_at', direction: 'desc' })
  
  // Modal Edit State
  const [editingOrder, setEditingOrder] = useState(null)
  const [paymentHistory, setPaymentHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  
  const [newPaymentAmount, setNewPaymentAmount] = useState('')
  const [newPaymentMethod, setNewPaymentMethod] = useState('BCA')
  const [newPaymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [isSaving, setIsSaving] = useState(false)

  // Items status loading
  const [updatingItem, setUpdatingItem] = useState(null)

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
    // Kita panggil action updateSalesItemStatus untuk memaksa update status
    // Tapi kita juga bisa panggil action baru untuk update qty dan status sekaligus
    // Karena ini khusus SalesClient, kita bisa gunakan fungsi khusus atau fetch langsung
    
    try {
      const supabase = await createClient();
      
      // Update Qty di production_logs (koreksi selisih)
      // Daripada menghitung selisih ribet, kita insert log koreksi khusus jika butuh,
      // Tapi updateSalesItemStatus akan memaksa status berubah.
      // Kita panggil fungsi update status biasa DITAMBAH insert log koreksi (atau biarkan fungsi server yang handle)
      
      // Untuk mempermudah, kita panggil updateSalesItemStatus, lalu insert log koreksi manual
      await updateSalesItemStatus(correctionModal.itemId, correctionModal.targetStatus);
      
      // Insert log untuk reset qty
      // Ambil current qty
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
      window.location.reload(); // Reload untuk memperbarui data
    } catch (e) {
      alert("Terjadi kesalahan.");
    } finally {
      setIsCorrecting(false);
    }
  }

  const handleCancelSalesOrder = async (soId, invoiceNumber) => {
    const confirm = window.confirm(`Peringatan: Anda akan membatalkan pesanan ${invoiceNumber}. Ini akan mengembalikan stok tersedia dan menghapus riwayat pembayaran. Lanjutkan?`);
    if (!confirm) return;

    setUpdatingItem(soId); // Reuse updatingItem state for loading
    const { success, error } = await cancelSalesOrder(soId);
    setUpdatingItem(null);

    if (!success) {
      alert(error || 'Gagal membatalkan pesanan');
    } else {
      alert(`Pesanan ${invoiceNumber} berhasil dibatalkan.`);
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
    let filtered = salesOrders.filter(order => {
      const matchSearch = order.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const orderMonth = order.date?.substring(0, 7)
      const matchMonth = filterMonth ? orderMonth === filterMonth : true

      let matchStatus = true
      if (filterStatus === 'BELUM_LUNAS') {
        matchStatus = order.payment_status === 'BELUM LUNAS' || order.payment_status === 'DP'
      } else if (filterStatus === 'LUNAS') {
        matchStatus = order.payment_status === 'LUNAS'
      }

      let matchCustomerType = true
      if (filterCustomerType !== 'ALL') {
        matchCustomerType = (order.customers?.type || 'REGULER').toUpperCase() === filterCustomerType.toUpperCase()
      }

      return matchSearch && matchMonth && matchStatus && matchCustomerType
    })

    return filtered.sort((a, b) => {
      let aVal = a[sortConfig.key]
      let bVal = b[sortConfig.key]

      if (sortConfig.key === 'customers_name') {
        aVal = a.customers?.name || ''
        bVal = b.customers?.name || ''
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [salesOrders, searchQuery, filterMonth, filterStatus, filterCustomerType, sortConfig])

  // Memoized Item Data
  const filteredAndSortedItems = useMemo(() => {
    let filtered = salesItems.filter(item => {
      const matchSearch = item.sales_orders?.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.sales_orders?.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.products?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const itemMonth = item.sales_orders?.date?.substring(0, 7)
      const matchMonth = filterMonth ? itemMonth === filterMonth : true

      let matchStatus = true
      if (itemFilterStatus !== 'ALL') {
        matchStatus = (item.status || 'BARU MASUK').toUpperCase() === itemFilterStatus
      }

      return matchSearch && matchMonth && matchStatus
    })

    return filtered.sort((a, b) => {
      let aVal = a[itemSortConfig.key]
      let bVal = b[itemSortConfig.key]

      if (itemSortConfig.key === 'customers_name') {
        aVal = a.sales_orders?.customers?.name || ''
        bVal = b.sales_orders?.customers?.name || ''
      } else if (itemSortConfig.key === 'invoice_number') {
        aVal = a.sales_orders?.invoice_number || ''
        bVal = b.sales_orders?.invoice_number || ''
      } else if (itemSortConfig.key === 'product_name') {
        aVal = a.products?.name || ''
        bVal = b.products?.name || ''
      }

      if (aVal < bVal) return itemSortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return itemSortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [salesItems, searchQuery, filterMonth, itemFilterStatus, itemSortConfig])

  const totalOmset = useMemo(() => salesOrders.filter(o => o.date?.substring(0, 7) === filterMonth).reduce((sum, o) => sum + Number(o.grand_total || o.total_amount || 0), 0), [salesOrders, filterMonth])
  const totalPiutang = useMemo(() => salesOrders.filter(o => o.date?.substring(0, 7) === filterMonth).reduce((sum, o) => sum + Math.max(0, Number(o.grand_total || o.total_amount || 0) - Number(o.dp_amount || 0)), 0), [salesOrders, filterMonth])

  const renderSortIcon = (key, config) => {
    if (config.key !== key) return <span className="inline-block w-3 opacity-0">&#8597;</span>
    return config.direction === 'asc' ? <ChevronUp className="inline-block w-3 h-3 text-primary" /> : <ChevronDown className="inline-block w-3 h-3 text-primary" />
  }

  return (
    <div className="space-y-6">
      {/* Header and KPI */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Transaksi Penjualan
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Kelola invoice dan pelacakan status produksi barang.</p>
        </div>
        <Link href="/dashboard/sales/new" className="btn-primary px-4 h-10 text-sm flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-4 h-4" /> Buat Sales Order Baru
        </Link>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-foreground/60 font-medium">Total Omset (Bulan Ini)</p>
            <p className="text-xl font-bold text-white">Rp {totalOmset.toLocaleString('id-ID')}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-foreground/60 font-medium">Total Piutang Berjalan</p>
            <p className="text-xl font-bold text-white">Rp {totalPiutang.toLocaleString('id-ID')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/5 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('INVOICE')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'INVOICE' ? 'bg-primary text-white shadow-lg' : 'text-foreground/60 hover:text-white'}`}
        >
          <FileText className="w-4 h-4" /> Data Invoice & Pembayaran
        </button>
        <button 
          onClick={() => setActiveTab('ITEMS')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'ITEMS' ? 'bg-primary text-white shadow-lg' : 'text-foreground/60 hover:text-white'}`}
        >
          <Package className="w-4 h-4" /> Status Item Produksi
        </button>
      </div>

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
        
        <div className="hidden sm:block">
          <MonthFilter />
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
                  onChange={e => setFilterStatus(e.target.value)} 
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
                  onChange={e => setFilterCustomerType(e.target.value)} 
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
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('date')}>Tanggal {renderSortIcon('date', sortConfig)}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('customers_name')}>Pelanggan {renderSortIcon('customers_name', sortConfig)}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('grand_total')}>Total Nominal {renderSortIcon('grand_total', sortConfig)}</th>
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
                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 text-foreground/90">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                      <td className="px-6 py-4 text-foreground/90 font-medium">
                        {item.customers?.name}
                        <br/><span className="text-[10px] text-foreground/50">{item.invoice_number}</span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-green-400">Rp {Number(item.grand_total || item.total_amount || 0).toLocaleString('id-ID')}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/10 ${item.payment_status === 'LUNAS' ? 'bg-green-500/20 text-green-400' : item.payment_status === 'BATAL' ? 'bg-red-500/20 text-red-500' : item.payment_status === 'DP' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                          {item.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex flex-wrap items-center justify-end gap-3">
                        <a href={`/track/${item.invoice_number || item.id}`} target="_blank" className="text-white/40 hover:text-white font-medium text-xs flex items-center gap-1 transition-colors">
                          <Navigation className="w-3 h-3" /> Track
                        </a>
                        {item.payment_status !== 'BATAL' && (
                          <>
                            {(item.payment_status === 'BELUM LUNAS' || item.payment_status === 'DP') && (
                              <Link href={`/dashboard/sales/edit/${item.id}`} className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center gap-1 transition-colors">
                                <Edit3 className="w-3 h-3" /> Edit
                              </Link>
                            )}
                            <button onClick={() => handleEditClick(item)} className="text-primary hover:text-primary/80 font-medium text-xs flex items-center gap-1 transition-colors">
                              <Clock className="w-3 h-3" /> Bayar
                            </button>
                            <button onClick={() => handleCancelSalesOrder(item.id, item.invoice_number)} disabled={updatingItem === item.id} className="text-red-500 hover:text-red-400 font-medium text-xs flex items-center gap-1 transition-colors disabled:opacity-50">
                              <XCircle className="w-3 h-3" /> {updatingItem === item.id ? 'Loading...' : 'Batal'}
                            </button>
                            <Link href={`/dashboard/sales/${item.id}/invoice`} className="text-purple-400 hover:text-purple-300 font-medium text-xs flex items-center gap-1 transition-colors">
                              <Printer className="w-3 h-3" /> Print
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: ITEMS */
          <div className="overflow-x-auto min-h-[400px]">
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
                {filteredAndSortedItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-foreground/40">
                      Belum ada data barang.
                    </td>
                  </tr>
                ) : filteredAndSortedItems.map((item) => {
                  const currentStatus = (item.status || 'BARU MASUK').toUpperCase();
                  const isUpdating = updatingItem === item.id;
                  
                  let itemStatuses = productionStatuses;
                  if (item.order_type?.toUpperCase() === 'POLOS') {
                    const polosStatuses = ['BARU MASUK', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI'];
                    itemStatuses = productionStatuses.filter(s => polosStatuses.includes(s.toUpperCase()));
                    if (itemStatuses.length === 0) itemStatuses = polosStatuses;
                  }
                  
                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2 align-middle">
                        <p className="text-xs text-foreground/80">{item.sales_orders?.date ? new Date(item.sales_orders.date).toLocaleDateString('id-ID') : '-'}</p>
                        <p className="text-[9px] text-foreground/40 mt-0.5">{item.sales_orders?.invoice_number}</p>
                      </td>
                      <td className="px-4 py-2 align-middle text-xs font-semibold text-white/90">
                        {item.sales_orders?.customers?.name}
                        {item.sales_orders?.payment_status === 'LUNAS' ? 
                          <span className="ml-2 text-[8px] font-bold bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">LUNAS</span> : 
                          <span className="ml-2 text-[8px] font-bold bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">DP/BL</span>}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <p className="text-xs text-white font-bold">{item.products?.name || item.product_code}</p>
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
                                window.open(item.mockup_url, '_blank');
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
                            <select 
                              value={currentStatus}
                              disabled={isUpdating}
                              onChange={(e) => handleItemStatusChange(item.id, currentStatus, e.target.value)}
                              className={`w-full appearance-none outline-none border rounded-md px-2.5 py-1 text-[11px] font-bold transition-all
                                ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                                ${currentStatus === 'SELESAI' || currentStatus === 'DIKIRIM' || currentStatus === 'SUDAH DIAMBIL' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                                  currentStatus === 'PROSES' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                                  currentStatus === 'SIAP KIRIM' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                  'bg-white/5 text-foreground border-white/10 hover:border-white/20'}`}
                            >
                              {itemStatuses.map(statusOption => (
                                <option key={statusOption} value={statusOption} className="bg-[#1a1f2e] text-white">
                                  {statusOption}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-current pointer-events-none opacity-50" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Edit Pembayaran (Unchanged) */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                    <input 
                      type="number" 
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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

    </div>
  )
}
