'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, ArrowDownToLine, ArrowUpFromLine, Filter, History } from 'lucide-react'
import MonthFilter from '@/components/MonthFilter'
import CustomSelect from '@/components/CustomSelect'

export default function MutasiClient({ mutations = [], products = [], selectedMonth = '', error = null }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterProduct, setFilterProduct] = useState('')

  const filteredMutations = useMemo(() => {
    return mutations.filter(m => {
      const matchSearch = ((m.reference || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
                          ((m.actor || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
                          ((m.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchProduct = filterProduct ? m.product_code === filterProduct : true

      return matchSearch && matchProduct
    })
  }, [mutations, searchQuery, filterProduct])

  // Hitung Total Masuk dan Keluar Bulan Ini (dari yang terfilter)
  const totalMasuk = filteredMutations.reduce((sum, m) => sum + Number(m.qty_in || 0), 0)
  const totalKeluar = filteredMutations.reduce((sum, m) => sum + Number(m.qty_out || 0), 0)

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/dashboard/inventory" className="btn-secondary h-8 px-3 text-xs flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Kembali ke Inventory
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-purple-400" />
            Buku Mutasi Stok
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Lacak riwayat lengkap barang masuk dan keluar.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <MonthFilter />
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          <strong>Peringatan:</strong> {error} <br/>
          (Pastikan Bapak sudah menjalankan file skrip `16_inventory_mutations_view.sql` di SQL Editor Supabase agar riwayat mutasi bisa terbaca).
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-4 border-l-4 border-green-500 flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Total Barang Masuk</p>
            <p className="text-2xl font-bold text-green-400 mt-2">{totalMasuk.toLocaleString('id-ID')} <span className="text-xs font-normal text-foreground/50">PCS</span></p>
          </div>
          <ArrowDownToLine className="w-8 h-8 text-green-500/20" />
        </div>
        <div className="glass-card p-4 border-l-4 border-yellow-500 flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">Total Barang Keluar</p>
            <p className="text-2xl font-bold text-yellow-400 mt-2">{totalKeluar.toLocaleString('id-ID')} <span className="text-xs font-normal text-foreground/50">PCS</span></p>
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
            options={[
              { value: "", label: "Semua Produk" },
              ...products.map(p => ({ value: p.product_code, label: p.name }))
            ]}
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/5 border-b border-white/10 text-foreground/70 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Waktu Transaksi</th>
                <th className="px-6 py-4 font-medium">Pelanggan / Supplier</th>
                <th className="px-6 py-4 font-medium">Produk</th>
                <th className="px-6 py-4 font-medium text-right text-green-400">Masuk (IN)</th>
                <th className="px-6 py-4 font-medium text-right text-yellow-400">Keluar (OUT)</th>
                <th className="px-6 py-4 font-medium text-right text-blue-400">Proses</th>
                <th className="px-6 py-4 font-medium text-right text-red-400">Reject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredMutations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-foreground/40">
                    Tidak ada riwayat mutasi pada filter/bulan yang dipilih.
                  </td>
                </tr>
              ) : filteredMutations.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-foreground/90 font-medium">{new Date(item.mutation_date).toLocaleDateString('id-ID')}</div>
                    <div className="text-xs text-foreground/50">{new Date(item.created_at).toLocaleTimeString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-foreground/90 font-bold">{item.actor || 'Sistem ERP'}</div>
                  </td>
                  <td className="px-6 py-4 text-foreground/90">{item.product_name}</td>
                  <td className="px-6 py-4 text-right">
                    {item.qty_in > 0 ? (
                      <span className="font-bold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full text-xs">
                        +{item.qty_in}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {item.qty_out > 0 ? (
                      <span className="font-bold text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-full text-xs">
                        -{item.qty_out}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
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
                  <td className="px-6 py-4 text-right">
                    {item.qty_reject > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full text-xs">
                          {item.qty_reject}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] text-foreground/50 italic max-w-[100px] break-words text-right">{item.notes}</span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
