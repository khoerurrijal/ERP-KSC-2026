'use client'

/* Search input follows the URL so database results and browser history stay in sync. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useMemo, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, ArrowDownToLine, ArrowUpFromLine, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'
import { matchesSearchText, stripGeneratedInvoiceNumbers } from '@/utils/search'

export default function MutasiClient({ mutations = [], products = [], selectedMonth = '', initialSearch = '', error = null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [filterProduct, setFilterProduct] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  useEffect(() => {
    setSearchQuery(searchParams.get('mutationSearch') || '')
  }, [searchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalizedSearch = searchQuery.trim()
      const params = new URLSearchParams(searchParamsString)
      if ((params.get('mutationSearch') || '') === normalizedSearch) return

      if (normalizedSearch) params.set('mutationSearch', normalizedSearch)
      else params.delete('mutationSearch')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, 350)

    return () => window.clearTimeout(timer)
  }, [searchQuery, searchParamsString, pathname, router])

  const filteredMutations = useMemo(() => {
    const normalizedSearch = searchQuery.replace(/[(),"]/g, ' ').trim().toLowerCase()
    return mutations.filter(m => {
      const matchSearch = matchesSearchText(stripGeneratedInvoiceNumbers(m.reference), normalizedSearch) ||
                          matchesSearchText(m.actor, normalizedSearch) ||
                          matchesSearchText(m.product_name, normalizedSearch)
      
      const matchProduct = filterProduct ? m.product_code === filterProduct : true

      return matchSearch && matchProduct
    })
  }, [mutations, searchQuery, filterProduct])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterProduct, selectedMonth, mutations])

  const totalPages = Math.max(1, Math.ceil(filteredMutations.length / pageSize))
  const paginatedMutations = filteredMutations.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const firstVisibleMutation = filteredMutations.length ? (currentPage - 1) * pageSize + 1 : 0
  const lastVisibleMutation = Math.min(currentPage * pageSize, filteredMutations.length)

  // Hitung Total Masuk dan Keluar Bulan Ini (dari yang terfilter)
  const totalMasuk = filteredMutations.reduce((sum, m) => sum + Number(m.qty_in || 0), 0)
  const totalKeluar = filteredMutations.reduce((sum, m) => sum + Number(m.qty_out || 0), 0)

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 pb-12">
      <div className="flex justify-end">
        <MonthFilter />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          <strong>Peringatan:</strong> {error} <br/>
          (Pastikan Bapak sudah menjalankan file skrip `16_inventory_mutations_view.sql` di SQL Editor Supabase agar riwayat mutasi bisa terbaca).
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass-card p-4 border-l-4 border-green-500 flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Total Barang Masuk</p>
            <p className="metric-value mt-2 text-green-400">{totalMasuk.toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span className="text-xs font-normal text-foreground/50">PCS</span></p>
          </div>
          <ArrowDownToLine className="w-8 h-8 text-green-500/20" />
        </div>
        <div className="glass-card p-4 border-l-4 border-yellow-500 flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Total Barang Keluar</p>
            <p className="metric-value mt-2 text-yellow-400">{totalKeluar.toLocaleString('id-ID', { maximumFractionDigits: 0 })} <span className="text-xs font-normal text-foreground/50">PCS</span></p>
          </div>
          <ArrowUpFromLine className="w-8 h-8 text-yellow-500/20" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full relative z-50">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input 
            type="text" 
            placeholder="Cari referensi / nama supplier / customer..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="glass-input !pl-10 h-10 w-full text-sm"
          />
        </div>
        <div className="w-full sm:w-64">
          <CustomSelect 
            value={filterProduct} 
            onChange={e => setFilterProduct(e.target.value)} 
            icon={Filter}
            searchable
            placeholder="Filter produk..."
            options={[
              { value: "", label: "Semua Produk" },
              ...products.map(p => ({ value: p.product_code, label: p.name }))
            ]}
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm text-left">
            <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-white/10 text-foreground/70 uppercase text-[11px]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Waktu</th>
                <th className="px-3 py-2.5 font-medium">Pelanggan / Supplier</th>
                <th className="px-3 py-2.5 font-medium">Produk</th>
                <th className="px-3 py-2.5 font-medium text-right text-green-400">Masuk</th>
                <th className="px-3 py-2.5 font-medium text-right text-yellow-400">Keluar</th>
                <th className="px-3 py-2.5 font-medium text-right text-blue-400">Proses</th>
                <th className="px-3 py-2.5 font-medium text-right text-red-400">Reject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedMutations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-3 py-8 text-center text-foreground/40">
                    Tidak ada riwayat mutasi pada filter/bulan yang dipilih.
                  </td>
                </tr>
              ) : paginatedMutations.map((item, idx) => (
                <tr key={item.id || `${item.created_at}-${item.product_code}-${idx}`} className="hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-foreground/90 font-medium">{new Date(item.mutation_date).toLocaleDateString('id-ID')}</div>
                    <div className="text-[11px] text-foreground/50">{new Date(item.created_at).toLocaleTimeString('id-ID')}</div>
                  </td>
                  <td className="px-3 py-2 max-w-[220px]">
                    <div className="text-foreground/90 font-semibold truncate">{item.actor || 'Sistem ERP'}</div>
                  </td>
                  <td className="px-3 py-2 max-w-[260px] text-foreground/90">
                    <div className="truncate">{item.product_name}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.qty_in > 0 ? (
                      <span className="font-bold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full text-xs">
                        +{item.qty_in}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.qty_out > 0 ? (
                      <span className="font-bold text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-full text-xs">
                        -{item.qty_out}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.qty_proses > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full text-xs">
                          {item.qty_proses}
                        </span>
                        {item.operator_name && (
                          <span className="text-[10px] text-foreground/50">{item.operator_name}</span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.qty_reject > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full text-xs">
                          {item.qty_reject}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] text-foreground/50 italic max-w-[140px] break-words text-right">{item.notes}</span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-white/10 bg-white/5 px-3 py-3 text-xs text-foreground/65">
          <span>Menampilkan {firstVisibleMutation}–{lastVisibleMutation} dari {filteredMutations.length} mutasi</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              className="btn-secondary h-8 px-3 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
            </button>
            <span className="px-2 font-medium text-foreground">Halaman {currentPage} dari {totalPages}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              className="btn-secondary h-8 px-3 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Berikutnya <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
