'use client'

import { useState, useMemo } from 'react'
import { Search, Factory, X, CheckCircle2, ChevronUp, ChevronDown, RefreshCw, Camera, Send, Truck } from 'lucide-react'

import { saveProductionProgress, updateSalesOrderStatus, correctProductionProgress } from '@/app/dashboard/production/actions'
import CustomSelect from '@/components/CustomSelect'
import TrackingTimeline from '@/components/TrackingTimeline'
import MockupUploadModal from '@/components/MockupUploadModal'

const getDisplayStatus = (st) => {
  if (!st) return 'BARU MASUK'
  return st.toUpperCase()
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

export default function ProductionTable({ productionJobs, operators = [], currentUser = '', userRole = 'Operator', currentUserName = '' }) {
  const [activeTab, setActiveTab] = useState(userRole === 'Operator' ? 'PRODUKSI' : 'SO') // 'SO' | 'PRODUKSI'
  
  const [selectedJob, setSelectedJob] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStatusJob, setSelectedStatusJob] = useState(null)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  
  // Correction Modal
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)
  const [correctionQty, setCorrectionQty] = useState('')

  // Form State
  const [employeeId, setEmployeeId] = useState('')
  const [qtyProcessed, setQtyProcessed] = useState('')
  const [qtyDefect, setQtyDefect] = useState('')
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  // Mockup popup state
  const [mockupModal, setMockupModal] = useState({ isOpen: false, itemId: null, url: '' })

  const [sortConfig, setSortConfig] = useState({ key: 'target_date', direction: 'asc' })

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
    let result = (productionJobs || []).filter(j => 
      (j.item_status?.toUpperCase() === 'PROSES' || j.item_status?.toUpperCase() === 'SIAP PROSES' || j.item_status?.toUpperCase() === 'BARU MASUK') &&
      ((j.sales_order_items?.sales_orders?.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
       (j.sales_order_items?.sales_orders?.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
       (j.sales_order_items?.products?.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    )

    result.sort((a, b) => {
      let valA, valB
      if (sortConfig.key === 'customer') {
        valA = a.sales_order_items?.sales_orders?.customers?.name || ''
        valB = b.sales_order_items?.sales_orders?.customers?.name || ''
      } else if (sortConfig.key === 'product') {
        valA = a.sales_order_items?.products?.name || ''
        valB = b.sales_order_items?.products?.name || ''
      } else if (sortConfig.key === 'target_date') {
        valA = a.target_date || ''
        valB = b.target_date || ''
      } else if (sortConfig.key === 'item_status') {
        valA = a.item_status || ''
        valB = b.item_status || ''
      } else if (sortConfig.key === 'qty_target') {
        valA = a.qty_target || 0
        valB = b.qty_target || 0
      } else {
        valA = a[sortConfig.key]
        valB = b[sortConfig.key]
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [productionJobs, searchQuery, sortConfig])

  // TAB 1: Tracking Sales Order (Visual Timeline)
  const trackingSoItems = (productionJobs || []).filter(j => 
    j.item_status?.toUpperCase() !== 'SELESAI' && j.item_status?.toUpperCase() !== 'DIBATALKAN' &&
    ((j.sales_order_items?.sales_orders?.customers?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
     (j.sales_order_items?.sales_orders?.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
     (j.sales_order_items?.products?.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleOpenModal = (job) => {
    setSelectedJob(job)
    
    // Automatically set operator if role is Operator
    if (userRole === 'Operator' && currentUserName) {
      const op = operators.find(o => o.full_name?.toLowerCase().includes(currentUserName.toLowerCase()))
      if (op) setEmployeeId(op.id.toString())
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
    
    // Automatically set operator if role is Operator
    if (userRole === 'Operator' && currentUserName) {
      const op = operators.find(o => o.full_name?.toLowerCase().includes(currentUserName.toLowerCase()))
      if (op) setEmployeeId(op.id.toString())
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
      const res = await correctProductionProgress(selectedJob.id, parseInt(correctionQty) || 0, employeeId);
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
        <div className="space-y-4">
          {trackingSoItems.length === 0 ? (
             <div className="glass-card p-12 text-center text-foreground/50">
               Tidak ada pesanan aktif.
             </div>
          ) : (
            trackingSoItems.map(item => {
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

                  {/* Bagian Kanan: Aksi (Sembunyikan Koreksi dari sini) */}
                  <div className="w-full xl:w-auto shrink-0 flex justify-end">
                     {getDisplayStatus(item.item_status) === 'SIAP KIRIM' && (
                        <button 
                          onClick={() => handleOpenStatusModal(item)}
                          title="Konfirmasi Kirim"
                          className="w-8 h-8 flex items-center justify-center bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition-all border border-primary/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                     )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'PRODUKSI' && (
        <div className="glass-card overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('customer')}>Nama / Brand {renderSortIcon('customer')}</th>
                  <th className="px-6 py-4 font-medium">Mockup / Desain</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('product')}>Produk & Qty Target {renderSortIcon('product')}</th>
                  <th className="px-6 py-4 font-medium">Progress (Selesai)</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('target_date')}>Target Selesai {renderSortIcon('target_date')}</th>
                  <th className="px-6 py-4 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('item_status')}>Status Item {renderSortIcon('item_status')}</th>
                  <th className="px-6 py-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAndSortedJobs?.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-foreground/40">
                      Belum ada antrean pekerjaan sablon saat ini.
                    </td>
                  </tr>
                ) : filteredAndSortedJobs?.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-purple-400">
                      {item.sales_order_items?.sales_orders?.customers?.name || '-'}
                      <div className="text-xs text-foreground/50">{item.sales_order_items?.sales_orders?.invoice_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      {item.mockup_url ? (
                        <a href={item.mockup_url} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-md border border-white/20 overflow-hidden block hover:opacity-80 transition-opacity" title="Lihat Mockup">
                          <img src={item.mockup_url} className="w-full h-full object-cover" alt="Mockup" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-foreground/40 italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground/90">{item.sales_order_items?.products?.name || '-'}</p>
                      <p className="text-xs text-foreground/60">{item.qty_target} {item.unit || 'pcs'}</p>
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
                      <button onClick={() => handleOpenModal(item)} className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 font-medium text-xs rounded-lg transition-all">
                        Input Qty
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
                  disabled={userRole === 'Operator'}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Jumlah Qty Dikerjakan Hari Ini <span className="text-red-400">*</span></label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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

      {/* Modal Update Status Manual (Siap Kirim -> Dikirim/Diambil) */}
      {isStatusModalOpen && selectedStatusJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-bold text-foreground">Konfirmasi Pengiriman</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-foreground/80 mb-4">Pilih tindakan akhir untuk pesanan ini:</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  disabled={loading}
                  onClick={() => updateStatus('DIKIRIM')}
                  className="w-full text-left px-4 py-4 bg-white/5 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/30 rounded-xl font-medium text-indigo-400 transition-all flex items-center gap-3"
                >
                  <Truck className="w-5 h-5" />
                  <div>
                    <p className="font-bold">Dikirim via Ekspedisi/Kurir</p>
                    <p className="text-xs text-foreground/50 font-normal">Barang diserahkan ke pihak pengirim</p>
                  </div>
                </button>
                <button 
                  disabled={loading}
                  onClick={() => updateStatus('SUDAH DIAMBIL')}
                  className="w-full text-left px-4 py-4 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-xl font-medium text-emerald-400 transition-all flex items-center gap-3"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <div>
                    <p className="font-bold">Diambil di Toko</p>
                    <p className="text-xs text-foreground/50 font-normal">Konsumen mengambil langsung fisik barang</p>
                  </div>
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
