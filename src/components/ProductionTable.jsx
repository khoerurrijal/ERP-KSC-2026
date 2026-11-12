'use client'

import { Fragment, useState, useMemo, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X, CheckCircle2, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react'

import { saveProductionProgress, correctProductionProgress } from '@/app/dashboard/production/actions'
import CustomSelect from '@/components/CustomSelect'
import CustomDatePicker from '@/components/CustomDatePicker'
import TrackingTimeline from '@/components/TrackingTimeline'
import Image from 'next/image'
import MockupUploadModal from '@/components/MockupUploadModal'
import ImageViewerModal from '@/components/ImageViewerModal'
import { matchesSearchText, stripGeneratedInvoiceNumbers } from '@/utils/search'
import { useRoleAccess } from '@/components/RoleAccessContext'

const getDisplayStatus = (st) => {
  if (!st) return 'BARU MASUK'
  return st.toUpperCase()
}

const formatMobileQuantity = (value) => Number(value || 0).toLocaleString('id-ID')
const getJakartaMonthKey = (value) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  return year && month ? `${year}-${month}` : ''
}
const getJakartaDateKey = (value) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : ''
}

const getStatusColor = (st) => {
  const s = getDisplayStatus(st)
  if (s === 'BARU MASUK') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  if (s === 'SIAP PROSES' || s === 'PERSIAPAN GUDANG') return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
  if (s === 'PROSES') return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  if (s === 'SUDAH JADI') return 'bg-green-400/20 text-green-300 border-green-400/40 shadow-[0_0_10px_rgba(74,222,128,0.2)]'
  if (s === 'SIAP KIRIM') return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  if (s === 'DIKIRIM' || s === 'SUDAH DIAMBIL') return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
  if (s === 'SELESAI') return 'bg-green-500/10 text-green-500 border-green-500/20'
  return 'bg-white/10 text-foreground border-white/20'
}

export default function ProductionTable({ productionJobs, productionHistory = [], operators = [], currentEmployeeId = '', userRole = 'Operator', initialTab = null, hideTabs = false, showAccumulationTab = false, hideHeader = false, title = 'Produksi', initialSearch = '' }) {
  const { canAccess } = useRoleAccess()
  const router = useRouter()
  const pathname = usePathname()
  const currentSearchParams = useSearchParams()
  const canSeeOrdersTab = canAccess('production.status.orders')
  const canSeeProductionTab = canAccess('production.queue')
  const isOperatorAccount = ['operator', 'operator mesin'].includes(String(userRole).toLowerCase())
  const safeInitialTab = initialTab === 'SO' && canSeeOrdersTab
    ? 'SO'
    : initialTab === 'PRODUKSI' && canSeeProductionTab
      ? 'PRODUKSI'
      : canSeeProductionTab ? 'PRODUKSI' : 'SO'
  const [activeTab, setActiveTab] = useState(safeInitialTab) // 'SO' | 'PRODUKSI'
  
  const [selectedJob, setSelectedJob] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Correction Modal
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)
  const [correctionQty, setCorrectionQty] = useState('')

  // Form State
  const [employeeId, setEmployeeId] = useState('')
  const [qtyProcessed, setQtyProcessed] = useState('')
  const [qtyDefect, setQtyDefect] = useState('')
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [loading, setLoading] = useState(false)

  // Mockup popup state
  const [mockupModal, setMockupModal] = useState({ isOpen: false, itemId: null, url: '' })
  const [zoomImage, setZoomImage] = useState(null)

  const [sortConfig, setSortConfig] = useState({ key: 'target_date', direction: 'asc' })
  const [accumulationSort, setAccumulationSort] = useState({ key: 'qty', direction: 'desc' })
  const [accumulationDateFrom, setAccumulationDateFrom] = useState(() => `${getJakartaMonthKey(new Date())}-01`)
  const [accumulationDateTo, setAccumulationDateTo] = useState(() => getJakartaDateKey(new Date()))
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null)

  const [soPage, setSoPage] = useState(1)
  const [prodPage, setProdPage] = useState(1)
  const isLightweightRole = !['Owner', 'Admin'].includes(userRole)
  const pageSize = isLightweightRole ? 20 : 50
  const selectedJobRemainingQty = selectedJob
    ? Math.max(0, Number(selectedJob.qty_target || 0) - Number(selectedJob.qty_processed || 0))
    : 0
  const qtySuggestions = [...new Set([500, 1000, 5000, selectedJobRemainingQty]
    .map(qty => Math.min(qty, selectedJobRemainingQty))
    .filter(qty => qty > 0))]

  const updateSearchParam = useCallback((value) => {
    const params = new URLSearchParams(Array.from(currentSearchParams.entries()))
    if (value) params.set('search', value)
    else params.delete('search')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [currentSearchParams, pathname, router])

  useEffect(() => {
    const timer = setTimeout(() => {
      if ((initialSearch || '') !== searchQuery) updateSearchParam(searchQuery.trim())
    }, 350)
    return () => clearTimeout(timer)
  }, [initialSearch, searchQuery, updateSearchParam])

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  // TAB 2: Tracking Produksi (Input Qty by Operator)
  const filteredAndSortedJobs = useMemo(() => {
    const normalizedSearch = searchQuery.replace(/[(),\"]/g, ' ').trim().toLowerCase()
    const isSearching = Boolean(normalizedSearch)
    let result = (productionJobs || []).filter(j => 
      (isSearching || (
        j.order_type?.toUpperCase() === 'SABLON' &&
        ['PROSES', 'SIAP PROSES', 'BARU MASUK'].includes(j.item_status?.toUpperCase())
      )) &&
      (!isSearching ||
       matchesSearchText(j.sales_order_items?.sales_orders?.customers?.name, normalizedSearch) ||
       matchesSearchText(j.sales_order_items?.products?.product_name, normalizedSearch) ||
       matchesSearchText(stripGeneratedInvoiceNumbers(j.notes), normalizedSearch) ||
       matchesSearchText(j.item_status, normalizedSearch))
    )

    const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })
    result.sort((a, b) => {
      let comparison = 0
      if (sortConfig.key === 'qty_target') {
        comparison = Number(a.qty_target || 0) - Number(b.qty_target || 0)
      } else {
        let valueA
        let valueB
        if (sortConfig.key === 'customer') {
          valueA = a.sales_order_items?.sales_orders?.customers?.name || ''
          valueB = b.sales_order_items?.sales_orders?.customers?.name || ''
        } else if (sortConfig.key === 'product') {
          valueA = a.sales_order_items?.products?.name || ''
          valueB = b.sales_order_items?.products?.name || ''
        } else {
          valueA = a[sortConfig.key] || ''
          valueB = b[sortConfig.key] || ''
        }

        if (sortConfig.key === 'target_date') {
          const dateA = Date.parse(valueA)
          const dateB = Date.parse(valueB)
          comparison = (Number.isFinite(dateA) ? dateA : 0) - (Number.isFinite(dateB) ? dateB : 0)
        } else {
          comparison = collator.compare(String(valueA), String(valueB))
        }
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })

    return result
  }, [productionJobs, searchQuery, sortConfig])

  // TAB 1: Tracking Sales Order (Visual Timeline)
  const normalizedSearch = searchQuery.replace(/[(),\"]/g, ' ').trim().toLowerCase()
  const isSearching = Boolean(normalizedSearch)
  const trackingSoItems = (productionJobs || []).filter(j =>
    (isSearching || !['SELESAI', 'BATAL'].includes(j.item_status?.toUpperCase())) &&
    (!isSearching ||
      matchesSearchText(j.sales_order_items?.sales_orders?.customers?.name, normalizedSearch) ||
      matchesSearchText(j.sales_order_items?.products?.product_name, normalizedSearch) ||
      matchesSearchText(stripGeneratedInvoiceNumbers(j.notes), normalizedSearch) ||
      matchesSearchText(j.item_status, normalizedSearch))
  )

  const paginatedProdJobs = useMemo(() => {
    const start = (prodPage - 1) * pageSize
    return filteredAndSortedJobs.slice(start, start + pageSize)
  }, [filteredAndSortedJobs, prodPage, pageSize])

  const paginatedSoItems = useMemo(() => {
    const start = (soPage - 1) * pageSize
    return trackingSoItems.slice(start, start + pageSize)
  }, [trackingSoItems, soPage, pageSize])

  const canSeeAccumulationTab = showAccumulationTab && canSeeProductionTab && ['Owner', 'Admin'].includes(userRole)
  const productionAccumulation = useMemo(() => {
    const groups = new Map()
    const matchingLogs = (productionHistory || []).filter(log =>
      getJakartaDateKey(log.created_at) >= accumulationDateFrom &&
      getJakartaDateKey(log.created_at) <= accumulationDateTo &&
      (!normalizedSearch ||
        matchesSearchText(log.employee_name, normalizedSearch) ||
        matchesSearchText(log.product_name, normalizedSearch) ||
        matchesSearchText(log.customer_name, normalizedSearch) ||
        matchesSearchText(log.invoice_number, normalizedSearch))
    )

    matchingLogs.forEach(log => {
      const key = String(log.employee_id || 'unknown')
      if (!groups.has(key)) {
        groups.set(key, {
          employee_id: key,
          employee_name: log.employee_name || 'Karyawan tidak diketahui',
          qty: 0,
          log_count: 0,
          latest_at: log.created_at,
          logs: []
        })
      }
      const group = groups.get(key)
      group.qty += Number(log.qty_processed || 0)
      group.log_count += 1
      if (Date.parse(log.created_at || '') > Date.parse(group.latest_at || '')) group.latest_at = log.created_at
      group.logs.push(log)
    })

    const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })
    return [...groups.values()].sort((a, b) => {
      let comparison = 0
      if (accumulationSort.key === 'qty') comparison = a.qty - b.qty
      else if (accumulationSort.key === 'logs') comparison = a.log_count - b.log_count
      else if (accumulationSort.key === 'latest') comparison = Date.parse(a.latest_at || '') - Date.parse(b.latest_at || '')
      else comparison = collator.compare(a.employee_name, b.employee_name)
      if (comparison === 0) comparison = collator.compare(a.employee_name, b.employee_name)
      return accumulationSort.direction === 'asc' ? comparison : -comparison
    })
  }, [productionHistory, normalizedSearch, accumulationDateFrom, accumulationDateTo, accumulationSort])

  const handleAccumulationSort = (key) => {
    setAccumulationSort(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const renderAccumulationSortIcon = (key) => {
    if (accumulationSort.key !== key) return null
    return accumulationSort.direction === 'asc'
      ? <ChevronUp className="ml-1 inline h-3 w-3" />
      : <ChevronDown className="ml-1 inline h-3 w-3" />
  }

  const handleOpenModal = (job) => {
    setSelectedJob(job)
    
    // Automatically attribute production to the signed-in operator.
    if (isOperatorAccount && currentEmployeeId) {
      setEmployeeId(String(currentEmployeeId))
    } else {
      setEmployeeId('')
    }
    
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedJob(null)
    setQtyProcessed('')
    setQtyDefect('')
    setNotes('')
  }

  const handleOpenCorrection = (job) => {
    setSelectedJob(job)
    setCorrectionQty(job.qty_processed || 0)
    
    // Automatically attribute corrections to the signed-in operator.
    if (isOperatorAccount && currentEmployeeId) {
      setEmployeeId(String(currentEmployeeId))
    } else {
      setEmployeeId('')
    }
    
    setIsCorrectionModalOpen(true)
  }

  const submitCorrection = async () => {
    if (!employeeId) {
      alert("Harap pilih Admin/Operator yang bertanggung jawab atas koreksi ini.");
      return;
    }
    const confirm = window.confirm(`Anda yakin ingin mengubah Qty Dikerjakan menjadi ${correctionQty} pcs? Ini akan memundurkan/mengubah status item secara otomatis.`);
    if (!confirm) return;

    setLoading(true)
    try {
      const res = await correctProductionProgress(selectedJob.id, parseInt(correctionQty) || 0, employeeId, Number(selectedJob.qty_processed || 0));
      if (res.success) {
        alert("Koreksi Qty berhasil disimpan.");
        window.location.reload();
      } else {
        alert("Gagal: " + res.error);
      }
    } catch (e) {
      alert("Error system");
    } finally {
      setLoading(false);
    }
  }

  const handleSubmitQty = async () => {
    if (!employeeId || !qtyProcessed) {
      alert("Harap pilih Operator dan isi Qty yang dikerjakan.")
      return
    }

    setLoading(true)
    try {
      const res = await saveProductionProgress({
        job_id: selectedJob.id,
        employee_id: employeeId,
        qty_processed: parseInt(qtyProcessed) || 0,
        qty_defect: parseInt(qtyDefect) || 0,
        expected_total_qty: Number(selectedJob.qty_processed || 0),
        notes: notes
      })

      if (res.success) {
        alert(`Berhasil mencatat progress.`);
        window.location.reload()
      } else {
        alert('Gagal mencatat: ' + res.error)
      }
    } catch (e) {
      alert('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 lg:space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-10 sm:pb-20">
      {!hideHeader && <div className="flex">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari pelanggan, produk, atau status..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setSoPage(1)
                setProdPage(1)
              }}
              className="glass-input !pl-10 h-10 w-full md:w-72 text-sm"
            />
          </div>
        </div>
      </div>}

      {/* Tabs */}
      {(canSeeAccumulationTab || (!hideTabs && (canSeeOrdersTab || canSeeProductionTab))) && (
        <div className="flex items-center gap-1 border-b border-white/10 pb-1 overflow-x-auto hide-scrollbar">
          {canSeeAccumulationTab ? (
            <>
              <button
                onClick={() => setActiveTab('PRODUKSI')}
                className={`pb-2 px-3 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'PRODUKSI' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}
              >
                Antrean Produksi
              </button>
              <button
                onClick={() => setActiveTab('AKUMULASI')}
                className={`pb-2 px-3 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'AKUMULASI' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}
              >
                Akumulasi Produksi
              </button>
            </>
          ) : (
            <>
              {canSeeOrdersTab && <button
                onClick={() => setActiveTab('SO')}
                className={`pb-2 px-3 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'SO' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}
              >
                Tracking Sales Order
              </button>}
              {canSeeProductionTab && <button
                onClick={() => setActiveTab('PRODUKSI')}
                className={`pb-2 px-3 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${activeTab === 'PRODUKSI' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}
              >
                Tracking Produksi
              </button>}
            </>
          )}
        </div>
      )}

      {activeTab === 'SO' && (
        <div className="space-y-4">
          {paginatedSoItems.length === 0 ? (
             <div className="glass-card p-12 text-center text-foreground/50">
               Tidak ada pesanan aktif.
             </div>
          ) : (
            paginatedSoItems.map(item => {
              const paymentStatus = item.sales_order_items?.sales_orders?.payment_status || 'BELUM LUNAS'
              return (
                <div key={item.id} className="glass-card p-3 sm:p-4 animate-in fade-in flex flex-col xl:flex-row items-center gap-4">
                  {/* Bagian Kiri: Info Pelanggan */}
                  <div className="w-full xl:w-[250px] shrink-0">
                    <h3 className="font-bold text-base text-white">{item.sales_order_items?.sales_orders?.customers?.name || 'Pelanggan'}</h3>
                    <p className="text-xs text-foreground/70 uppercase">
                      {item.sales_order_items?.products?.product_name || item.sales_order_items?.products?.name} ({item.qty_target} {item.unit || 'pcs'})
                    </p>
                    <p className="text-[10px] text-foreground/50 mt-0.5">{item.sales_order_items?.sales_orders?.invoice_number}</p>
                  </div>
                  
                  {/* Bagian Tengah: Timeline UI */}
                  <div className="flex-1 w-full overflow-hidden min-w-0">
                    <TrackingTimeline 
                      currentStatus={item.item_status} 
                      paymentStatus={paymentStatus}
                      targetDate={item.target_date} 
                    />
                  </div>

                </div>
              )
            })
          )}
          {/* Pagination Controls for SO */}
          <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-foreground/70 rounded-xl">
            <div>
              Menampilkan {trackingSoItems.length === 0 ? 0 : (soPage - 1) * pageSize + 1} - {Math.min(soPage * pageSize, trackingSoItems.length)} dari <span className="font-bold text-foreground">{trackingSoItems.length}</span> pesanan
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={soPage <= 1}
                onClick={() => setSoPage(p => p - 1)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 font-medium text-foreground">
                Halaman {soPage} dari {Math.ceil(trackingSoItems.length / pageSize) || 1}
              </span>
              <button
                disabled={soPage >= Math.ceil(trackingSoItems.length / pageSize)}
                onClick={() => setSoPage(p => p + 1)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'AKUMULASI' && canSeeAccumulationTab && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end">
            <div className="w-full space-y-1.5 sm:w-56">
              <label className="text-xs font-medium text-foreground/60">Dari</label>
              <CustomDatePicker
                value={accumulationDateFrom}
                onChange={date => {
                  setAccumulationDateFrom(date)
                  if (date > accumulationDateTo) setAccumulationDateTo(date)
                  setExpandedEmployeeId(null)
                }}
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-56">
              <label className="text-xs font-medium text-foreground/60">Ke</label>
              <CustomDatePicker
                value={accumulationDateTo}
                onChange={date => {
                  setAccumulationDateTo(date)
                  if (date < accumulationDateFrom) setAccumulationDateFrom(date)
                  setExpandedEmployeeId(null)
                }}
              />
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-foreground/60">
                  <tr>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleAccumulationSort('name')} className="font-semibold hover:text-foreground">
                        Karyawan {renderAccumulationSortIcon('name')}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleAccumulationSort('qty')} className="font-semibold hover:text-foreground">
                        Total Produksi {renderAccumulationSortIcon('qty')}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleAccumulationSort('logs')} className="font-semibold hover:text-foreground">
                        Catatan {renderAccumulationSortIcon('logs')}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => handleAccumulationSort('latest')} className="font-semibold hover:text-foreground">
                        Terakhir Produksi {renderAccumulationSortIcon('latest')}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {productionAccumulation.length === 0 ? (
                    <tr><td colSpan="5" className="px-6 py-12 text-center text-foreground/45">Belum ada catatan produksi yang cocok.</td></tr>
                  ) : productionAccumulation.map(group => {
                    const isExpanded = expandedEmployeeId === group.employee_id
                    return (
                      <Fragment key={group.employee_id}>
                        <tr className="hover:bg-white/5">
                          <td className="px-4 py-3 font-semibold text-foreground">{group.employee_name}</td>
                          <td className="px-4 py-3 font-bold text-green-400">{formatMobileQuantity(group.qty)} pcs</td>
                          <td className="px-4 py-3 text-foreground/70">{formatMobileQuantity(group.log_count)}</td>
                          <td className="px-4 py-3 text-foreground/70">
                            {group.latest_at ? new Date(group.latest_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() => setExpandedEmployeeId(isExpanded ? null : group.employee_id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-foreground/75 hover:bg-white/5 hover:text-foreground"
                            >
                              {isExpanded ? 'Tutup' : 'Lihat'}
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan="5" className="bg-black/15 px-4 py-3">
                              <div className="space-y-2">
                                {group.logs.map((log, index) => (
                                  <div key={log.id || `${group.employee_id}-${log.created_at}-${index}`} className="grid grid-cols-1 gap-1 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                                    <span className="text-foreground/50">
                                      {log.created_at ? new Date(log.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </span>
                                    <span className="min-w-0 text-foreground/75">
                                      <span className="font-semibold text-foreground">{log.product_name}</span>
                                      <span className="block truncate text-foreground/45">{log.customer_name} · {log.invoice_number}</span>
                                    </span>
                                    <span className="font-bold text-green-400">{formatMobileQuantity(log.qty_processed)} pcs</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'PRODUKSI' && (
        <>
        {isLightweightRole && <div className="space-y-2 lg:hidden">
          {paginatedProdJobs.length === 0 ? <div className="rounded-xl border border-stone-200 bg-white p-5 text-center text-sm text-stone-500">Belum ada antrean pekerjaan sablon saat ini.</div> : paginatedProdJobs.map(item => (
            <article key={item.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-stone-900">{item.sales_order_items?.sales_orders?.customers?.name || 'Pelanggan'}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getStatusColor(item.item_status)}`}>{getDisplayStatus(item.item_status)}</span>
              </div>
              <div className="mt-2 flex items-start gap-2">
                {item.mockup_url && <button type="button" onClick={() => setZoomImage(item.mockup_url)} className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-stone-200" title="Lihat Mockup"><Image src={item.mockup_url} fill className="object-cover" alt="Mockup" sizes="44px" /></button>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-800">{item.sales_order_items?.products?.name || '-'}</p>
                  <p className="text-xs text-stone-500">Target {formatMobileQuantity(item.qty_target)} {item.unit || 'pcs'}</p>
                  {item.notes && <p className="mt-0.5 truncate text-xs text-stone-500">{item.notes}</p>}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-stone-100 pt-2 text-xs">
                <p className="min-w-0 truncate"><span className="font-bold text-green-700">{formatMobileQuantity(item.qty_processed)} {item.unit || 'pcs'} selesai</span><span className="ml-1 text-orange-700">· Sisa {formatMobileQuantity(Math.max(0, item.qty_target - item.qty_processed))}</span></p>
                <p className={`shrink-0 font-semibold ${item.is_fast_track ? 'text-red-700' : 'text-blue-700'}`}>{item.target_date ? new Date(item.target_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}{item.is_fast_track && <span className="ml-1 text-red-700" aria-label="Fast Track" title="Fast Track">⚡</span>}</p>
              </div>
              {item.order_type?.toUpperCase() === 'SABLON' && ['BARU MASUK', 'SIAP PROSES', 'PROSES'].includes(item.item_status?.toUpperCase()) && <button type="button" onClick={() => handleOpenModal(item)} className="mt-2 min-h-11 w-full rounded-lg bg-[#755615] px-4 py-2 text-sm font-bold text-white">Input Qty</button>}
            </article>
          ))}
          {filteredAndSortedJobs.length > pageSize && <div className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 text-xs">
            <button type="button" disabled={prodPage <= 1} onClick={() => setProdPage(page => page - 1)} className="min-h-11 rounded-lg border border-stone-200 px-3 font-semibold text-stone-700 disabled:opacity-40">Sebelumnya</button>
            <span className="text-center text-stone-600">{prodPage} / {Math.ceil(filteredAndSortedJobs.length / pageSize)} · {filteredAndSortedJobs.length} pekerjaan</span>
            <button type="button" disabled={prodPage >= Math.ceil(filteredAndSortedJobs.length / pageSize)} onClick={() => setProdPage(page => page + 1)} className="min-h-11 rounded-lg border border-stone-200 px-3 font-semibold text-stone-700 disabled:opacity-40">Berikutnya</button>
          </div>}
        </div>}
        <div className={`${isLightweightRole ? 'hidden lg:block' : ''} glass-card overflow-hidden animate-in fade-in`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('customer')}>Nama / Brand {renderSortIcon('customer')}</th>
                  <th className="px-4 py-3 font-medium">Mockup / Desain</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('product')}>Produk & Qty Target {renderSortIcon('product')}</th>
                  <th className="px-4 py-3 font-medium">Progress (Selesai)</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('target_date')}>Tgl Order & Target {renderSortIcon('target_date')}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('item_status')}>Status Item {renderSortIcon('item_status')}</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedProdJobs?.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-foreground/40">
                      Belum ada antrean pekerjaan sablon saat ini.
                    </td>
                  </tr>
                ) : paginatedProdJobs?.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-purple-400">
                      {item.sales_order_items?.sales_orders?.customers?.name || '-'}
                      <div className="text-xs text-foreground/50">{item.sales_order_items?.sales_orders?.invoice_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      {item.mockup_url ? (
                        <button onClick={() => setZoomImage(item.mockup_url)} className="relative w-12 h-12 rounded-md border border-white/20 overflow-hidden block hover:opacity-80 transition-opacity" title="Lihat Mockup">
                          <Image src={item.mockup_url} fill className="object-cover" alt="Mockup" sizes="48px" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-foreground/40 italic">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground/90">{item.sales_order_items?.products?.name || '-'}</p>
                      {item.notes && <p className="text-[10px] text-foreground/60 italic mt-0.5 whitespace-pre-line">{item.notes}</p>}
                      <p className="text-xs text-foreground/60 mt-1">{item.qty_target} {item.unit || 'pcs'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-green-400">{item.qty_processed} pcs</p>
                      <p className="text-xs text-orange-400">Kurang: {Math.max(0, item.qty_target - item.qty_processed)} pcs</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs text-foreground/60 flex items-center gap-1">
                          <span className="font-medium text-foreground/80">Order:</span> 
                          {item.order_date ? new Date(item.order_date).toLocaleDateString('id-ID') : '-'}
                        </div>
                        <div className="text-sm font-semibold flex items-center gap-1">
                          <span className="text-foreground/80 font-medium text-xs">Target:</span> 
                          <span className={item.is_fast_track ? "text-red-400" : "text-blue-400"}>
                            {item.target_date ? new Date(item.target_date).toLocaleDateString('id-ID') : '-'}
                          </span>
                        </div>
                        {item.is_fast_track && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full w-fit">FAST TRACK</span>
                        )}
                        {item.is_two_color && (
                          <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full w-fit">2 WARNA</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(item.item_status)}`}>
                        {getDisplayStatus(item.item_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.order_type?.toUpperCase() === 'SABLON' && ['BARU MASUK', 'SIAP PROSES', 'PROSES'].includes(item.item_status?.toUpperCase()) ? (
                        <button onClick={() => handleOpenModal(item)} className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 font-medium text-xs rounded-lg transition-all">
                          Input Qty
                        </button>
                      ) : <span className="text-xs text-foreground/40">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls for Produksi */}
          <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-foreground/70">
            <div>
              Menampilkan {filteredAndSortedJobs.length === 0 ? 0 : (prodPage - 1) * pageSize + 1} - {Math.min(prodPage * pageSize, filteredAndSortedJobs.length)} dari <span className="font-bold text-foreground">{filteredAndSortedJobs.length}</span> pekerjaan
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={prodPage <= 1}
                onClick={() => setProdPage(p => p - 1)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 font-medium text-foreground">
                Halaman {prodPage} dari {Math.ceil(filteredAndSortedJobs.length / pageSize) || 1}
              </span>
              <button
                disabled={prodPage >= Math.ceil(filteredAndSortedJobs.length / pageSize)}
                onClick={() => setProdPage(p => p + 1)}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Modal Input Qty Operator */}
      {isModalOpen && selectedJob && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={event => event.target === event.currentTarget && handleCloseModal()}>
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-foreground">Update Progress Produksi</h3>
              <button onClick={handleCloseModal} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl text-sm mb-4">
                <p className="text-foreground/80">Pelanggan: <span className="font-bold text-primary">{selectedJob.sales_order_items?.sales_orders?.customers?.name || selectedJob.sales_order_items?.sales_orders?.invoice_number}</span></p>
                <p className="text-foreground/80">Produk: <span className="font-bold text-foreground">{selectedJob.sales_order_items?.products?.product_name || selectedJob.sales_order_items?.products?.name}</span></p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 mb-1 block">Nama Operator <span className="text-red-400">*</span></label>
                <CustomSelect 
                  value={employeeId} 
                  onChange={e => setEmployeeId(e.target.value)} 
                  options={[
                    { value: "", label: "- Pilih Karyawan (Operator) -" },
                    ...operators.map(op => ({ value: op.id, label: `${op.full_name} (${op.role_name})` }))
                  ]}
                  disabled={isOperatorAccount}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Jumlah Qty Dikerjakan Hari Ini <span className="text-red-400">*</span></label>
                <input 
                  type="number" 
                  min="1"
                  max={selectedJobRemainingQty}
                  value={qtyProcessed} 
                  onChange={e => setQtyProcessed(e.target.value)} 
                  placeholder="Berapa pcs?"
                  className="glass-input w-full" 
                />
                {qtySuggestions.length > 0 && <div className="space-y-2">
                  <p className="text-xs text-foreground/60">Saran cepat</p>
                  <div className="flex flex-wrap gap-2">
                    {qtySuggestions.map(qty => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setQtyProcessed(String(qty))}
                        className="min-h-10 rounded-lg border border-primary/20 bg-primary/5 px-3 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        {qty === selectedJobRemainingQty ? `Sisa ${qty.toLocaleString('id-ID')} pcs` : `${qty.toLocaleString('id-ID')} pcs`}
                      </button>
                    ))}
                  </div>
                </div>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Jumlah Qty Rusak / Cacat</label>
                <input 
                  type="number" 
                  min="0"
                  value={qtyDefect} 
                  onChange={e => setQtyDefect(e.target.value)} 
                  placeholder="Isi jika ada barang reject"
                  className="glass-input w-full border-red-500/30 focus:border-red-400" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Keterangan / Notes</label>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Keterangan tambahan (opsional)"
                  className="glass-input w-full min-h-[80px] resize-none" 
                />
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={handleCloseModal} className="btn-secondary px-4 h-10 text-sm">Batal</button>
              <button disabled={loading} onClick={handleSubmitQty} className="btn-primary px-4 h-10 text-sm flex items-center gap-2 disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> {loading ? 'Menyimpan...' : 'Simpan Progress'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Koreksi Qty */}
      {isCorrectionModalOpen && selectedJob && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={event => event.target === event.currentTarget && setIsCorrectionModalOpen(false)}>
          <div className="bg-background border border-red-500/30 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-red-500/20 flex justify-between items-center bg-red-500/5">
              <h3 className="font-bold text-red-400">Koreksi Qty Dikerjakan (Revisi)</h3>
              <button onClick={() => setIsCorrectionModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground/80">Gunakan fitur ini jika terjadi kesalahan input Qty oleh operator, atau jika ada barang reject massal yang membuat progress harus diulang.</p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80 mb-1 block">Otorisasi Admin <span className="text-red-400">*</span></label>
                <CustomSelect 
                  value={employeeId} 
                  onChange={e => setEmployeeId(e.target.value)} 
                  options={[
                    { value: "", label: "- Pilih Admin / User -" },
                    ...operators.map(op => ({ value: op.id, label: `${op.full_name} (${op.role_name})` }))
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Total Qty yang BENAR saat ini <span className="text-red-400">*</span></label>
                <input 
                  type="number" 
                  min="0"
                  max={selectedJob.qty_target}
                  value={correctionQty} 
                  onChange={e => setCorrectionQty(e.target.value)} 
                  className="glass-input w-full font-bold text-lg" 
                />
                <p className="text-xs text-red-400/80">Status item akan **otomatis mundur** jika qty baru lebih kecil dari target.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                 <button onClick={() => setIsCorrectionModalOpen(false)} className="btn-secondary px-4 h-10 text-sm">Batal</button>
                 <button disabled={loading} onClick={submitCorrection} className="px-4 h-10 text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-all border border-red-500/30 disabled:opacity-50">
                   {loading ? 'Menyimpan...' : 'Terapkan Koreksi'}
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

      {/* Image Zoom Modal */}
      <ImageViewerModal 
        isOpen={!!zoomImage} 
        onClose={() => setZoomImage(null)} 
        imageUrl={zoomImage} 
      />

    </div>
  )
}
