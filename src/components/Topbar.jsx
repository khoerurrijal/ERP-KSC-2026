'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { LogOut, Sun, Moon, User, Menu, MessageCircle, Check, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { getWaBotStatus, toggleWaBotStatus } from '@/app/dashboard/settings/actions'

export default function Topbar({ userRole = '', onToggleSidebar }) {
  const pathname = usePathname()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isWaBotActive, setIsWaBotActive] = useState(true)
  const [isToggling, setIsToggling] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Fetch initial WA bot status
    getWaBotStatus().then(status => setIsWaBotActive(status))
  }, [])

  const handleToggleWaBot = async () => {
    try {
      setIsToggling(true)
      const newStatus = !isWaBotActive
      const res = await toggleWaBotStatus(newStatus)
      if (res?.success) {
        setIsWaBotActive(newStatus)
      } else {
        alert("Gagal mengubah status bot: " + (res?.error || "Unknown error"))
      }
    } catch (error) {
      console.error(error)
      alert("Terjadi kesalahan sistem: " + error.message)
    } finally {
      setIsToggling(false)
    }
  }

  const isDark = theme === 'dark' || (!theme && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Navigasi lama masih bisa membuka route internal `/dashboard/...`,
  // sementara rewrite baru memakai URL pendek. Samakan keduanya sebelum
  // mencari judul halaman agar top bar selalu terisi.
  const displayPathname = pathname === '/dashboard'
    ? pathname
    : pathname.replace(/^\/dashboard(?=\/)/, '')

  const pageMeta = [
    ['/dashboard', 'Dashboard', 'Ringkasan operasional King Sablon'],
    ['/sales', 'Sales Order', 'Kelola invoice, pembayaran, dan pesanan'],
    ['/marketplace', 'Marketplace', 'Rekonsiliasi pesanan dan pencairan'],
    ['/production/status', 'Status Pesanan', 'Ubah status dan konfirmasi pengiriman'],
    ['/production/shipping', 'Konfirmasi Pengiriman', 'Konfirmasi pesanan yang siap dikirim atau diambil'],
    ['/production', 'Produksi', 'Pantau proses produksi per item'],
    ['/status-pesanan', 'Status Pesanan', 'Ubah status dan konfirmasi pengiriman'],
    ['/inventory', 'Inventory', 'Pantau stok dan mutasi barang'],
    ['/purchases', 'Purchase Order', 'Kelola pembelian dan penerimaan'],
    ['/transactions', 'Transaksi', 'Buku besar dan mutasi keuangan'],
    ['/finance/loans', 'Kasbon & Pinjaman', 'Kelola pinjaman dan kasbon karyawan'],
    ['/payroll', 'Rekap Gaji', 'Kelola rekap dan pembayaran gaji'],
    ['/master/products', 'Produk', 'Kelola master produk dan harga'],
    ['/master/customers', 'Pelanggan', 'Kelola data pelanggan'],
    ['/master/suppliers', 'Supplier', 'Kelola data pemasok'],
    ['/master/employees', 'Karyawan', 'Kelola data karyawan'],
    ['/report', 'Laporan', 'Ringkasan keuangan dan performa usaha'],
    ['/audit', 'AI Audit', 'Pemeriksaan data dan kesehatan alur aplikasi'],
    ['/settings', 'Pengaturan', 'Kelola akses pengguna dan hak akses'],
    ['/system-config', 'Sistem Konfigurasi', 'Konfigurasi parameter operasional aplikasi'],
  ].find(([path]) => displayPathname === path || displayPathname.startsWith(`${path}/`)) || ['/', 'King Sablon ERP', '']

  return (
    <div className="w-full h-14 sm:h-16 bg-white/[0.04] backdrop-blur-xl border-b border-white/10 sticky top-0 z-40 flex items-center justify-between px-3 sm:px-4 lg:px-6">
      
      {/* Left: Mobile Hamburger & Logo */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Mobile Hamburger - Only visible on md:hidden */}
        <button 
          onClick={onToggleSidebar} 
          className="p-2 md:hidden bg-white/5 border border-white/10 rounded-xl text-foreground hover:bg-white/10 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-foreground truncate">{pageMeta[1]}</h1>
          <p className="text-[10px] sm:text-xs text-foreground/50 truncate">{pageMeta[2]}</p>
        </div>
      </div>

      {/* Center/Right: WA Bot Toggle & Profile */}
      <div className="flex items-center gap-3 ml-auto">
        
        {/* WA Bot Toggle Switch */}
        {(userRole === 'Owner' || userRole === 'Admin') && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/5 border border-white/10 px-2 sm:px-3 py-1.5 rounded-full relative z-50">
            <MessageCircle className={`w-4 h-4 ${isWaBotActive ? 'text-green-400' : 'text-foreground/40'}`} />
            <span className="text-xs font-bold hidden sm:block text-foreground/80 cursor-default">WA Bot</span>
            <button
              disabled={isToggling}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleToggleWaBot();
              }}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${isWaBotActive ? 'bg-green-500' : 'bg-foreground/20'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform flex items-center justify-center shadow-sm ${isWaBotActive ? 'translate-x-5' : 'translate-x-0'}`}>
                {isWaBotActive ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-foreground/40" />}
              </div>
            </button>
          </div>
        )}

        {/* Profile Button */}
        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all focus:outline-none"
          >
            <User className="w-5 h-5 text-primary" />
          </button>

          {/* Profile Dropdown / Popover */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-background border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-4 border-b border-white/10 bg-white/5">
                <span className="text-xs text-foreground/60 block mb-1">Login sebagai:</span>
                <span className="text-sm font-bold text-primary">{userRole}</span>
              </div>
              
              <div className="p-2 space-y-1">
                {mounted && (
                  <button 
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl hover:bg-white/5 transition-all font-medium text-foreground/80 hover:text-foreground"
                  >
                    {isDark ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-slate-800" />}
                    <span className="text-sm">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                )}
                
                <form action="/auth/signout" method="post">
                  <button type="submit" className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-medium">
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  )
}
