'use client'

import { useState, useMemo } from 'react'
import { Search, Plus, Factory, X, CheckCircle2, Package, Save, ChevronUp, ChevronDown } from 'lucide-react'

import { saveProductionProgress, updateSalesOrderStatus } from '@/app/dashboard/production/actions'
import CustomSelect from '@/components/CustomSelect'

const getDisplayStatus = (st) => {
  if (!st) return 'BARU MASUK'
  return st.toUpperCase()
}

const getStatusColor = (st) => {
  const s = getDisplayStatus(st)
  if (s === 'BARU MASUK') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
  if (s === 'PROSES') return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  if (s === 'SUDAH JADI') return 'bg-green-400/20 text-green-300 border-green-400/40 shadow-[0_0_10px_rgba(74,222,128,0.2)]'
  if (s === 'DIKIRIM' || s === 'TERKIRIM') return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
  if (s === 'SELESAI') return 'bg-green-500/10 text-green-500 border-green-500/20'
  return 'bg-white/10 text-foreground border-white/20'
}

export default function ProductionTable({ productionJobs, operators = [], currentUser = '' }) {
  const [activeTab, setActiveTab] = useState('SO') // 'SO' | 'PRODUKSI'
  
  const [selectedJob, setSelectedJob] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStatusJob, setSelectedStatusJob] = useState(null)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  
  // Form State
  const [employeeId, setEmployeeId] = useState('')
  const [qtyProcessed, setQtyProcessed] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sortConfigSO, setSortConfigSO] = useState({ key: 'target_date', direction: 'asc' })

  // TAB 2: Tracking Produksi (Detail Item)
  // Aturan: Hanya tampilkan PROSES atau BARU MASUK
  const filteredJobs = (productionJobs || []).filter(j => 
    (j.item_status?.toUpperCase() === 'PROSES' || j.item_status?.toUpperCase() === 'BARU MASUK') &&
    ((j.sales_order_items?.sales_orders?.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
     (j.sales_order_items?.sales_orders?.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
     (j.sales_order_items?.products?.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // TAB 1: Tracking Sales Order (Detail Item)
  // Aturan: Tampilkan SUDAH JADI, DIKIRIM, TERKIRIM
  const trackingSoItems = (productionJobs || []).filter(j => 
    (j.item_status?.toUpperCase() === 'SUDAH JADI' || 
     j.item_status?.toUpperCase() === 'DIKIRIM' || 
     j.item_status?.toUpperCase() === 'TERKIRIM') &&
    ((j.sales_order_items?.sales_orders?.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
     (j.sales_order_items?.sales_orders?.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
     (j.sales_order_items?.products?.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const sortedTrackingSoItems = useMemo(() => {
    let result = [...trackingSoItems]
    result.sort((a, b) => {
      let valA = ''
      let valB = ''
      switch (sortConfigSO.key) {
        case 'invoice_number':
          valA = a.sales_order_items?.sales_orders?.invoice_number || ''
          valB = b.sales_order_items?.sales_orders?.invoice_number || ''
          break;
        case 'customer_name':
          valA = a.sales_order_items?.sales_orders?.customers?.name || ''
          valB = b.sales_order_items?.sales_orders?.customers?.name || ''
          break;
        case 'product_name':
          valA = a.sales_order_items?.products?.product_name || a.sales_order_items?.products?.name || ''
          valB = b.sales_order_items?.products?.product_name || b.sales_order_items?.products?.name || ''
          break;
        case 'target_date':
          valA = a.target_date || ''
          valB = b.target_date || ''
          break;
        case 'item_status':
          valA = a.item_status || ''
          valB = b.item_status || ''
          break;
      }
      if (valA < valB) return sortConfigSO.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfigSO.direction === 'asc' ? 1 : -1
      return 0
    })
    return result
  }, [trackingSoItems, sortConfigSO])

  const handleSortSO = (key) => {
    let direction = 'asc'
    if (sortConfigSO.key === key && sortConfigSO.direction === 'asc') direction = 'desc'
    setSortConfigSO({ key, direction })
  }

  const renderSortIconSO = (key) => {
    if (sortConfigSO.key !== key) return null
    return sortConfigSO.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  // Tracking Sales Order (Grouped by Invoice)
  const groupedOrders = useMemo(() => {
    const groups = {}
    productionJobs.forEach(job => {
      const soId = job.so_id
      if (!soId) return

      if (!groups[soId]) {
        groups[soId] = {
          id: soId,
          invoice_number: job.sales_order_items?.sales_orders?.invoice_number,
          customer_name: job.sales_order_items?.sales_orders?.customers?.name,
          target_date: job.target_date,
          status: job.status,
          items: [],
          allFinished: true
        }
      }
      
      const isFinished = job.qty_processed >= job.qty_target
      if (!isFinished) {
        groups[soId].allFinished = false
      }

      groups[soId].items.push(job)
    })

    return Object.values(groups).filter(so => 
      (so.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (so.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [productionJobs, searchQuery])

  const handleOpenModal = (job) => {
    setSelectedJob(job)
    setEmployeeId('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedJob(null)
    setQtyProcessed('')
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
        qty_processed: parseInt(qtyProcessed)
      })

      if (res.success) {
        if (res.isFinished || (parseInt(qtyProcessed) + selectedJob.qty_processed >= selectedJob.qty_target)) {
          alert(`Pesanan sudah jadi! (Tercatat tambahan ${qtyProcessed} pcs). Item akan dipindahkan ke tab Tracking Sales Order.`)
          window.location.reload()
        } else {
          alert(`Berhasil mencatat ${qtyProcessed} pcs.`)
          handleCloseModal()
          window.location.reload()
        }
      } else {
        alert('Gagal mencatat: ' + res.error)
      }
    } catch (e) {
      alert('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenStatusModal = (job) => {
    setSelectedStatusJob(job)
    setIsStatusModalOpen(true)
  }

  const updateStatus = async (newStatus) => {
    setLoading(true)
    try {
      await updateSalesOrderStatus(selectedStatusJob.id, newStatus)
      window.location.reload()
    } catch (error) {
      console.error(error)
      alert('Gagal update status pesanan')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Factory className="w-6 h-6 text-purple-400" />
            Tracking Produksi
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Pantau status pengerjaan pesanan sablon dari hulu ke hilir.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input 
              type="text" 
              placeholder="Cari nomor Invoice/Job..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="glass-input !pl-10 h-10 w-64 text-sm"
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-white/10 pb-2">
        <button 
          onClick={() => setActiveTab('SO')} 
          className={`pb-2 px-2 text-sm font-bold transition-colors ${activeTab === 'SO' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}
        >
          Tracking Sales Order
        </button>
        <button 
          onClick={() => setActiveTab('PRODUKSI')} 
          className={`pb-2 px-2 text-sm font-bold transition-colors ${activeTab === 'PRODUKSI' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}
        >
          Tracking Produksi
        </button>
      </div>

      {activeTab === 'SO' && (
        <div className="glass-card overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-foreground/60 uppercase bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSortSO('invoice_number')}>No. Invoice {renderSortIconSO('invoice_number')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSortSO('customer_name')}>Customer {renderSortIconSO('customer_name')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSortSO('product_name')}>Item Sablon {renderSortIconSO('product_name')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSortSO('target_date')}>Target Selesai {renderSortIconSO('target_date')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSortSO('item_status')}>Status Item {renderSortIconSO('item_status')}</th>
                  <th className="px-6 py-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedTrackingSoItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-foreground/50">
                      Tidak ada pesanan yang siap dikonfirmasi (Sudah Jadi / Dikirim).
                    </td>
                  </tr>
                ) : (
                  sortedTrackingSoItems.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium">
                        {item.sales_order_items?.sales_orders?.invoice_number || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{item.sales_order_items?.sales_orders?.customers?.name || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{item.sales_order_items?.products?.product_name || '-'}</div>
                        <div className="text-xs text-foreground/60 mt-1">{item.sales_order_items?.qty} pcs</div>
                      </td>
                      <td className="px-6 py-4 text-foreground/60">
                        {item.target_date ? new Date(item.target_date).toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(item.item_status)}`}>
                          {getDisplayStatus(item.item_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {getDisplayStatus(item.item_status) === 'SUDAH JADI' && (
                            <button 
                              onClick={() => handleOpenStatusModal(item)}
                              className="px-3 py-1.5 text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition-all border border-primary/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                            >
                              Konfirmasi Kirim
                            </button>
                          )}
                          {getDisplayStatus(item.item_status) === 'DIKIRIM' && (
                            <button 
                              onClick={() => handleOpenStatusModal(item)}
                              className="px-3 py-1.5 text-xs font-bold bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition-all border border-primary/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                            >
                              Update Status
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'PRODUKSI' && (
        <div className="glass-card overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Nama / Brand</th>
                  <th className="px-6 py-4 font-medium">Mockup / Desain</th>
                  <th className="px-6 py-4 font-medium">Produk & Qty Target</th>
                  <th className="px-6 py-4 font-medium">Progress (Selesai)</th>
                  <th className="px-6 py-4 font-medium">Target Selesai</th>
                  <th className="px-6 py-4 font-medium">Status Item</th>
                  <th className="px-6 py-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredJobs?.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-foreground/40">
                      Belum ada antrean pekerjaan sablon saat ini.
                    </td>
                  </tr>
                ) : filteredJobs?.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-purple-400">
                      {item.sales_order_items?.sales_orders?.customers?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-16 h-16 rounded-md bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden">
                         <span className="text-xs text-foreground/40">No Image</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground/90">{item.sales_order_items?.products?.name || '-'}</p>
                      <p className="text-xs text-foreground/60">{item.qty_target} pcs</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-green-400">{item.qty_processed} pcs</p>
                      <p className="text-xs text-orange-400">Kurang: {Math.max(0, item.qty_target - item.qty_processed)} pcs</p>
                    </td>
                    <td className="px-6 py-4 text-foreground/90">
                      {item.target_date ? new Date(item.target_date).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(item.item_status)}`}>
                        {getDisplayStatus(item.item_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleOpenModal(item)} className="text-accent hover:text-accent/80 font-medium text-xs">
                        Input Qty Dikerjakan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Input Qty Operator */}
      {isModalOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Jumlah Qty Dikerjakan Hari Ini</label>
                <input 
                  type="number" 
                  min="1"
                  max={Math.max(0, selectedJob.qty_target - selectedJob.qty_processed)}
                  value={qtyProcessed} 
                  onChange={e => setQtyProcessed(e.target.value)} 
                  placeholder="Berapa pcs?"
                  className="glass-input w-full" 
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

      {/* Modal Update Status */}
      {isStatusModalOpen && selectedStatusJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-foreground">Update Status Item</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground/80 mb-4">Ubah status untuk item sablon ini:</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  disabled={loading}
                  onClick={() => updateStatus('DIKIRIM')}
                  className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-indigo-400 transition-colors"
                >
                  Tandai sebagai "Dikirim"
                </button>
                <button 
                  disabled={loading}
                  onClick={() => updateStatus('SUDAH DIAMBIL')}
                  className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-emerald-400 transition-colors"
                >
                  Tandai sebagai "Sudah Diambil"
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
