'use client'

import { useState } from 'react'
import { Save, Plus, Trash2, Settings, ListPlus, Banknote, Percent, Store, ShieldCheck, Users } from 'lucide-react'
import { updateDropdownConfig, updateCashflowConfig, updateStoreConfig, updateRolePermissions, updateUserRoles, updatePricelistConfig } from './actions'

export default function SettingsClient({ initialSettings }) {
  const [activeTab, setActiveTab] = useState('dropdowns')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  
  // Ensure default keys exist in dropdown_config
  const defaultDropdowns = {
    payment_method: ["BCA", "MANDIRI", "CASH"],
    payment_status_po: ["TEMPO", "LUNAS"],
    transaction_reference: ["PENJUALAN", "PEMBELIAN", "GAJI KARYAWAN", "LISTRIK WIFI", "MAINTENANCE", "HPP GUDANG", "BAYAR HPP GUDANG", "LAIN-LAIN"],
    customer_type: ["Umum", "Member", "Grosir"],
    order_type: ["SABLON", "POLOS"],
    kas_account: ["KING", "GLOBAL", "GUDANG", "TABUNGAN"],
    production_status: ["DRAFT", "BARU MASUK", "SIAP PROSES", "PROSES", "SUDAH JADI", "SIAP KIRIM", "DIKIRIM", "SUDAH DIAMBIL", "SELESAI"],
    category_mapping: {}
  }
  const mergedDropdowns = { ...defaultDropdowns, ...(initialSettings.dropdown_config || {}) }
  const [dropdowns, setDropdowns] = useState(mergedDropdowns)
  
  // State for Cashflow
  const [cashflow, setCashflow] = useState({
    king_fixed_expenses: initialSettings.cashflow_config?.king_fixed_expenses || 4100000,
    tabungan_fixed_in: initialSettings.cashflow_config?.tabungan_fixed_in || 2000000,
    profit_global_percent: initialSettings.cashflow_config?.profit_global_percent || 10,
    zakat_percent: initialSettings.cashflow_config?.zakat_percent || 3
  })
  // State for Pricelist & Margin
  const defaultMatrix = {
    "BOTOL": { "1": 0, "10": 0, "100": 1200, "500": 850, "1000": 500, "5000": 500, "10000": 500 },
    "BOX DUS": { "1": 0, "10": 0, "100": 1500, "500": 300, "1000": 200, "5000": 200, "10000": 200 },
    "CUP GOCUP": { "1": 0, "10": 0, "100": 0, "500": 260, "1000": 200, "5000": 170, "10000": 150 },
    "CUP INJECT": { "1": 0, "10": 0, "100": 0, "500": 400, "1000": 250, "5000": 220, "10000": 200 },
    "CUP PET": { "1": 0, "10": 0, "100": 0, "500": 400, "1000": 250, "5000": 220, "10000": 200 }
  }
  const defaultPrintingMatrix = {
    "3 Warna": { "5000": 0, "10000": 0, "30000": 0 },
    "4 Warna": { "5000": 0, "10000": 0, "30000": 0 }
  }
  const dbPricelist = initialSettings.pricelist_config || {}
  const [pricelist, setPricelist] = useState({
    profit_gudang_nominal: dbPricelist.profit_gudang_nominal ?? 50,
    profit_global_percent: dbPricelist.profit_global_percent ?? 10,
    margin_jual_polos_percent: dbPricelist.margin_jual_polos_percent ?? 15,
    save_profit_percent: dbPricelist.save_profit_percent ?? 30,
    sablon_matrix: (dbPricelist.sablon_matrix && Object.keys(dbPricelist.sablon_matrix).length > 0) ? dbPricelist.sablon_matrix : defaultMatrix,
    printing_matrix: (dbPricelist.printing_matrix && Object.keys(dbPricelist.printing_matrix).length > 0) ? dbPricelist.printing_matrix : defaultPrintingMatrix
  })

  // State for Store Config
  const [store, setStore] = useState({
    store_name: initialSettings.store_config?.store_name || 'KING SABLON',
    slogan: initialSettings.store_config?.slogan || 'Pusat Sablon Cup Plastik Terbaik',
    address: initialSettings.store_config?.address || 'Jl. Industri Raya No. 45, Jakarta Pusat',
    phone: initialSettings.store_config?.phone || '0812-3456-7890',
    email: initialSettings.store_config?.email || 'billing@kingsablon.com',
    logo_url: initialSettings.store_config?.logo_url || '',
    wa_message_template: initialSettings.store_config?.wa_message_template || 'Halo {customer_name},\n\nBerikut adalah invoice pesanan Anda dengan nomor *{invoice_number}*.\nTotal tagihan: Rp {total_amount}\nSisa pembayaran: Rp {sisa_bayar}\n\nTerima kasih!',
    banks: initialSettings.store_config?.banks || [
      { bank_name: 'Bank BCA', account_number: '123-456-7890', account_name: 'PT KING SABLON NUSANTARA' },
      { bank_name: 'Bank Mandiri', account_number: '098-765-4321', account_name: 'PT KING SABLON NUSANTARA' }
    ]
  })

  // State for Roles & Permissions
  const [rolePermissions, setRolePermissions] = useState(initialSettings.role_permissions || {})
  const [userRoles, setUserRoles] = useState(initialSettings.user_roles || [])
  
  const MENU_LIST = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'penjualan', label: 'Penjualan (SO)' },
    { key: 'marketplace', label: 'Marketplace' },
    { key: 'produksi', label: 'Produksi' },
    { key: 'gudang', label: 'Gudang (Inventory & PO)' },
    { key: 'keuangan', label: 'Keuangan (Kas, Payroll)' },
    { key: 'master_data', label: 'Master Data' },
    { key: 'laporan', label: 'Laporan' },
    { key: 'pengaturan', label: 'Pengaturan' }
  ]
  const ROLES = ['Owner', 'Admin', 'Operator']

  // Handlers for Dropdowns
  const handleAddDropdownItem = (key) => {
    const list = [...(dropdowns[key] || [])]
    list.push('')
    setDropdowns({ ...dropdowns, [key]: list })
  }

  const handleUpdateDropdownItem = (key, index, value) => {
    const list = [...(dropdowns[key] || [])]
    list[index] = value.toUpperCase()
    setDropdowns({ ...dropdowns, [key]: list })
  }

  const handleRemoveDropdownItem = (key, index) => {
    const list = [...(dropdowns[key] || [])]
    list.splice(index, 1)
    setDropdowns({ ...dropdowns, [key]: list })
  }

  const handleAddCategoryMapItem = (orderType) => {
    const map = { ...(dropdowns.category_mapping || {}) }
    if (!map[orderType]) map[orderType] = []
    map[orderType].push('')
    setDropdowns({ ...dropdowns, category_mapping: map })
  }

  const handleUpdateCategoryMapItem = (orderType, index, value) => {
    const map = { ...(dropdowns.category_mapping || {}) }
    map[orderType][index] = value
    setDropdowns({ ...dropdowns, category_mapping: map })
  }

  const handleRemoveCategoryMapItem = (orderType, index) => {
    const map = { ...(dropdowns.category_mapping || {}) }
    map[orderType].splice(index, 1)
    setDropdowns({ ...dropdowns, category_mapping: map })
  }

  // Handlers for Banks
  const handleAddBank = () => {
    setStore({
      ...store,
      banks: [...store.banks, { bank_name: '', account_number: '', account_name: '' }]
    })
  }

  const handleUpdateBank = (index, field, value) => {
    const newBanks = [...store.banks]
    newBanks[index][field] = value
    setStore({ ...store, banks: newBanks })
  }

  const handleRemoveBank = (index) => {
    const newBanks = [...store.banks]
    newBanks.splice(index, 1)
    setStore({ ...store, banks: newBanks })
  }

  // Handlers for Roles & Permissions
  const handleTogglePermission = (role, menuKey) => {
    const currentPerms = rolePermissions[role] || []
    let newPerms
    if (currentPerms.includes(menuKey)) {
      newPerms = currentPerms.filter(k => k !== menuKey)
    } else {
      newPerms = [...currentPerms, menuKey]
    }
    setRolePermissions({ ...rolePermissions, [role]: newPerms })
  }

  const handleAddUserRole = () => {
    setUserRoles([...userRoles, { email: '', role: 'Operator' }])
  }

  const handleUpdateUserRole = (index, field, value) => {
    const newUR = [...userRoles]
    newUR[index][field] = value
    setUserRoles(newUR)
  }

  const handleRemoveUserRole = (index) => {
    const newUR = [...userRoles]
    newUR.splice(index, 1)
    setUserRoles(newUR)
  }

  // Handle Saves
  const handleSaveDropdowns = async () => {
    setIsSaving(true)
    setError(null)
    const res = await updateDropdownConfig(dropdowns)
    if (!res.success) setError(res.error)
    setIsSaving(false)
  }

  const handleSaveCashflow = async () => {
    setIsSaving(true)
    setError(null)
    const res = await updateCashflowConfig(cashflow)
    if (!res.success) setError(res.error)
    setIsSaving(false)
  }

  const handleSavePricelist = async () => {
    setIsSaving(true)
    setError(null)
    const res = await updatePricelistConfig(pricelist)
    if (!res.success) setError(res.error)
    setIsSaving(false)
  }

  const handleSaveStore = async () => {
    setIsSaving(true)
    setError(null)
    const res = await updateStoreConfig(store)
    if (!res.success) setError(res.error)
    setIsSaving(false)
  }

  const handleSaveAccess = async () => {
    setIsSaving(true)
    setError(null)
    
    // validasi email user
    const filledUsers = userRoles.filter(u => u.email.trim() !== '')
    setUserRoles(filledUsers) // auto clean up empty ones

    const res1 = await updateRolePermissions(rolePermissions)
    const res2 = await updateUserRoles(filledUsers)
    
    if (!res1.success) setError(res1.error)
    else if (!res2.success) setError(res2.error)
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Pengaturan Sistem</h1>
          <p className="text-foreground/60 mt-1">Konfigurasi dinamis untuk dropdown form dan alur perhitungan kas.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-white/10 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('dropdowns')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'dropdowns' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-foreground/50 hover:text-foreground/80'
          }`}
        >
          <ListPlus className="w-4 h-4" />
          List Dropdown Form
        </button>
        <button
          onClick={() => setActiveTab('cashflow')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'cashflow' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-foreground/50 hover:text-foreground/80'
          }`}
        >
          <Banknote className="w-4 h-4" />
          Pengaturan Alur Kas Tetap
        </button>
        <button
          onClick={() => setActiveTab('pricelist')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'pricelist' 
              ? 'border-yellow-400 text-yellow-400' 
              : 'border-transparent text-foreground/50 hover:text-foreground/80'
          }`}
        >
          <Percent className="w-4 h-4" />
          Pricelist & Margin
        </button>
        <button
          onClick={() => setActiveTab('store')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'store' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-foreground/50 hover:text-foreground/80'
          }`}
        >
          <Store className="w-4 h-4" />
          Toko & Invoice
        </button>
        <button
          onClick={() => setActiveTab('access')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'access' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-foreground/50 hover:text-foreground/80'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Akses & Pengguna
        </button>
      </div>

      {/* Tab Content: Dropdowns */}
      {activeTab === 'dropdowns' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.keys(dropdowns).filter(k => k !== 'category_mapping').map(key => (
              <div key={key} className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-foreground/80 uppercase tracking-widest text-xs flex items-center gap-2">
                    <Settings className="w-3 h-3 text-primary" />
                    {key.replace(/_/g, ' ')}
                  </h3>
                  <button 
                    onClick={() => handleAddDropdownItem(key)}
                    className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {(dropdowns[key] || []).map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => handleUpdateDropdownItem(key, idx, e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-foreground uppercase"
                      />
                      <button 
                        onClick={() => handleRemoveDropdownItem(key, idx)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors border border-transparent hover:border-red-400/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {dropdowns[key].length === 0 && (
                    <div className="text-xs text-foreground/40 italic py-4 text-center">List kosong</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-white/10 pt-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <ListPlus className="w-5 h-5 text-primary" />
              Filter Kategori Berdasarkan Jenis Pesanan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from(new Set(dropdowns.order_type || [])).map(orderType => {
                const mapList = (dropdowns.category_mapping || {})[orderType] || []
                return (
                  <div key={orderType} className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-foreground/80 tracking-widest text-xs flex items-center gap-2">
                        <Settings className="w-3 h-3 text-accent" />
                        UNTUK: {orderType}
                      </h3>
                      <button 
                        onClick={() => handleAddCategoryMapItem(orderType)}
                        className="p-1.5 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {mapList.map((item, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => handleUpdateCategoryMapItem(orderType, idx, e.target.value)}
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 text-foreground"
                            placeholder="Kategori spesifik..."
                          />
                          <button 
                            onClick={() => handleRemoveCategoryMapItem(orderType, idx)}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors border border-transparent hover:border-red-400/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {mapList.length === 0 && (
                        <div className="text-xs text-foreground/40 italic py-4 text-center">Belum ada filter kategori</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveDropdowns}
              disabled={isSaving}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-[0_0_20px_rgba(var(--primary),0.3)] disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Menyimpan...' : 'Simpan Semua Dropdown'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Cashflow */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl">
          <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" />
              Pengaturan Nilai Tetap & Persentase
            </h3>

            <div className="space-y-6">
              {/* Gudang Profit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-sm font-bold text-foreground/80">Profit Gudang (%)</label>
                  <p className="text-xs text-foreground/40 mt-1">Margin profit Gudang dari harga beli dasar, sebelum dijual ke King (HPP King).</p>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={cashflow.profit_gudang_percent}
                    onChange={(e) => setCashflow({ ...cashflow, profit_gudang_percent: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-right focus:outline-none focus:border-primary/50 text-foreground font-mono text-lg"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-foreground/40">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Global Profit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-sm font-bold text-foreground/80">Profit Global (%)</label>
                  <p className="text-xs text-foreground/40 mt-1">Margin profit Global dari harga beli dasar.</p>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={cashflow.profit_global_percent}
                    onChange={(e) => setCashflow({ ...cashflow, profit_global_percent: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-right focus:outline-none focus:border-primary/50 text-foreground font-mono text-lg"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-foreground/40">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/10 w-full my-4" />

              {/* King Fixed Expenses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-sm font-bold text-foreground/80">Pengeluaran Tetap King (Rp)</label>
                  <p className="text-xs text-foreground/40 mt-1">Potongan otomatis setiap bulan untuk pengeluaran tetap divisi King.</p>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-foreground/40 font-bold">
                    Rp
                  </div>
                  <input
                    type="number"
                    value={cashflow.king_fixed_expenses}
                    onChange={(e) => setCashflow({ ...cashflow, king_fixed_expenses: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-right focus:outline-none focus:border-primary/50 text-foreground font-mono text-lg"
                  />
                </div>
              </div>

              {/* Tabungan Fixed In */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-sm font-bold text-foreground/80">Uang Masuk Tetap Tabungan (Rp)</label>
                  <p className="text-xs text-foreground/40 mt-1">Penambahan otomatis setiap bulan ke divisi Tabungan.</p>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-foreground/40 font-bold">
                    Rp
                  </div>
                  <input
                    type="number"
                    value={cashflow.tabungan_fixed_in}
                    onChange={(e) => setCashflow({ ...cashflow, tabungan_fixed_in: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-right focus:outline-none focus:border-primary/50 text-foreground font-mono text-lg"
                  />
                </div>
              </div>

              {/* Zakat */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-sm font-bold text-foreground/80">Zakat (%)</label>
                  <p className="text-xs text-foreground/40 mt-1">Persentase potongan zakat bulanan.</p>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={cashflow.zakat_percent}
                    onChange={(e) => setCashflow({ ...cashflow, zakat_percent: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-right focus:outline-none focus:border-primary/50 text-foreground font-mono text-lg"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-foreground/40">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveCashflow}
              disabled={isSaving}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-[0_0_20px_rgba(var(--primary),0.3)] disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Alur Kas'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Pricelist & Margin */}
      {activeTab === 'pricelist' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Kiri: Formula Jual Polos & Internal */}
            <div className="xl:col-span-4 space-y-6">
              <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 h-full">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Percent className="w-5 h-5 text-yellow-400" />
                  Formula Margin & Profit
                </h3>
                
                <div className="space-y-6">
                  {/* Gudang Nominal */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80">Profit Gudang (Rp / Pcs)</label>
                    <p className="text-xs text-foreground/40 mt-1">Margin profit Gudang dalam Rupiah (angka mati) per Pcs.</p>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-foreground/40 font-bold">Rp</div>
                      <input
                        type="number"
                        value={pricelist.profit_gudang_nominal}
                        onChange={(e) => setPricelist({ ...pricelist, profit_gudang_nominal: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-yellow-400/50 text-foreground font-mono"
                      />
                    </div>
                  </div>

                  {/* Global Profit */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80">Profit Global (%)</label>
                    <p className="text-xs text-foreground/40 mt-1">Margin profit Global dari HPP Dasar barang.</p>
                    <div className="relative">
                      <input
                        type="number"
                        value={pricelist.profit_global_percent}
                        onChange={(e) => setPricelist({ ...pricelist, profit_global_percent: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-yellow-400/50 text-foreground font-mono"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-foreground/40">
                        <Percent className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-white/10 w-full my-4" />

                  {/* Margin Jual Polos */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80">Margin Jual Polos (%)</label>
                    <p className="text-xs text-foreground/40 mt-1">Margin keuntungan King saat menjual barang polos ke Customer (sebelum Save Profit).</p>
                    <div className="relative">
                      <input
                        type="number"
                        value={pricelist.margin_jual_polos_percent}
                        onChange={(e) => setPricelist({ ...pricelist, margin_jual_polos_percent: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-yellow-400/50 text-foreground font-mono"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-foreground/40">
                        <Percent className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Save Profit */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-yellow-400">Tambahan Save Profit (%)</label>
                    <p className="text-xs text-foreground/40 mt-1">Bantalan mark-up otomatis di atas harga akhir (Polos/Sablon) sebagai ruang diskon (Save Profit).</p>
                    <div className="relative">
                      <input
                        type="number"
                        value={pricelist.save_profit_percent}
                        onChange={(e) => setPricelist({ ...pricelist, save_profit_percent: Number(e.target.value) })}
                        className="w-full bg-yellow-400/10 border border-yellow-400/30 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-yellow-400/80 text-yellow-400 font-mono font-bold"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-yellow-400/40">
                        <Percent className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Kanan: Matrix Jasa Sablon */}
            <div className="xl:col-span-8 space-y-6">
              <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 h-full overflow-hidden flex flex-col">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <ListPlus className="w-5 h-5 text-yellow-400" />
                  Matrix Tarif Jasa Sablon (Per Pcs)
                </h3>
                <p className="text-sm text-foreground/60 mb-6">Tarif jasa sablon murni (Rp) yang akan dijumlahkan dengan HPP King berdasarkan Kategori dan Tiering Qty.</p>
                
                <div className="overflow-x-auto custom-scrollbar flex-1">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 border-b border-white/10 text-foreground/80 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-xl whitespace-nowrap min-w-[120px]">Kategori</th>
                        {['1', '10', '100', '500', '1000', '5000', '10000'].map(tier => (
                          <th key={tier} className="px-3 py-3 text-center whitespace-nowrap">
                            &ge; {Number(tier) >= 1000 ? (Number(tier)/1000) + 'K' : tier} PCS
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {Object.keys(pricelist.sablon_matrix || {}).map((category) => (
                        <tr key={category} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-4 font-bold text-yellow-400 whitespace-nowrap">{category}</td>
                          {['1', '10', '100', '500', '1000', '5000', '10000'].map(tier => (
                            <td key={tier} className="px-2 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] text-foreground/40 font-mono">Rp</span>
                                <input
                                  type="number"
                                  value={pricelist.sablon_matrix[category][tier]}
                                  onChange={(e) => {
                                    const newMatrix = { ...pricelist.sablon_matrix }
                                    newMatrix[category] = { ...newMatrix[category], [tier]: Number(e.target.value) }
                                    setPricelist({ ...pricelist, sablon_matrix: newMatrix })
                                  }}
                                  className="w-16 sm:w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-xs focus:outline-none focus:border-yellow-400/50 text-foreground font-mono"
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {Object.keys(pricelist.sablon_matrix || {}).length === 0 && (
                    <div className="text-center py-12 text-foreground/40 italic">Belum ada matriks kategori.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Kanan Bawah: Matrix Jasa Printing */}
            <div className="xl:col-span-8 xl:col-start-5 space-y-6">
              <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 overflow-hidden flex flex-col">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <ListPlus className="w-5 h-5 text-blue-400" />
                  Matrix Tarif Jasa Printing (Per Pcs)
                </h3>
                <p className="text-sm text-foreground/60 mb-6">Tarif jasa printing murni (Rp) yang akan dijumlahkan dengan HPP King berdasarkan Kategori dan Tiering Qty.</p>
                
                <div className="overflow-x-auto custom-scrollbar flex-1">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white/5 border-b border-white/10 text-foreground/80 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-xl whitespace-nowrap min-w-[120px]">Varian Warna</th>
                        {['5000', '10000', '30000'].map(tier => (
                          <th key={tier} className="px-3 py-3 text-center whitespace-nowrap">
                            &ge; {Number(tier) >= 1000 ? (Number(tier)/1000) + 'K' : tier} PCS
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {Object.keys(pricelist.printing_matrix || {}).map((category) => (
                        <tr key={category} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-4 font-bold text-blue-400 whitespace-nowrap">{category}</td>
                          {['5000', '10000', '30000'].map(tier => (
                            <td key={tier} className="px-2 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] text-foreground/40 font-mono">Rp</span>
                                <input
                                  type="number"
                                  value={pricelist.printing_matrix[category][tier]}
                                  onChange={(e) => {
                                    const newMatrix = { ...pricelist.printing_matrix }
                                    newMatrix[category] = { ...newMatrix[category], [tier]: Number(e.target.value) }
                                    setPricelist({ ...pricelist, printing_matrix: newMatrix })
                                  }}
                                  className="w-16 sm:w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-center text-xs focus:outline-none focus:border-blue-400/50 text-foreground font-mono"
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSavePricelist}
              disabled={isSaving}
              className="flex items-center gap-2 bg-yellow-400 text-black px-8 py-3 rounded-xl font-bold hover:bg-yellow-500 transition-all active:scale-95 shadow-[0_0_20px_rgba(250,204,21,0.3)] disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Menyimpan...' : 'Simpan Pricelist & Margin'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Store & Invoice */}
      {activeTab === 'store' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Kiri: Profil Utama */}
            <div className="space-y-6">
              <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Store className="w-5 h-5 text-primary" />
                  Profil Utama Toko
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80">Nama Toko</label>
                    <input
                      type="text"
                      value={store.store_name}
                      onChange={(e) => setStore({ ...store, store_name: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80">Slogan</label>
                    <input
                      type="text"
                      value={store.slogan}
                      onChange={(e) => setStore({ ...store, slogan: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/80">Alamat Lengkap</label>
                    <textarea
                      value={store.address}
                      onChange={(e) => setStore({ ...store, address: e.target.value })}
                      className="w-full h-24 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground custom-scrollbar"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground/80">No Telepon / WA</label>
                      <input
                        type="text"
                        value={store.phone}
                        onChange={(e) => setStore({ ...store, phone: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground/80">Email</label>
                      <input
                        type="email"
                        value={store.email}
                        onChange={(e) => setStore({ ...store, email: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-white/10">
                    <label className="text-sm font-bold text-foreground/80">URL Logo Toko</label>
                    <input
                      type="text"
                      value={store.logo_url}
                      onChange={(e) => setStore({ ...store, logo_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground"
                    />
                    <p className="text-xs text-foreground/40 mt-1">Masukkan link URL gambar logo Anda. Kosongkan untuk menggunakan logo default.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Kanan: Template WA & Bank */}
            <div className="space-y-6">
              <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-primary" />
                  Pengaturan Rekening Bank
                </h3>
                
                <div className="space-y-4">
                  {store.banks.map((bank, index) => (
                    <div key={index} className="p-4 border border-white/10 rounded-xl relative group bg-white/5">
                      <button 
                        onClick={() => handleRemoveBank(index)}
                        className="absolute -top-3 -right-3 p-1.5 bg-red-500/20 text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Nama Bank (BCA)"
                            value={bank.bank_name}
                            onChange={(e) => handleUpdateBank(index, 'bank_name', e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                          />
                          <input
                            type="text"
                            placeholder="No Rekening"
                            value={bank.account_number}
                            onChange={(e) => handleUpdateBank(index, 'account_number', e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 font-mono"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Atas Nama"
                          value={bank.account_name}
                          onChange={(e) => handleUpdateBank(index, 'account_name', e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                        />
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={handleAddBank}
                    className="w-full py-3 rounded-xl border border-dashed border-white/20 text-foreground/50 hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> Tambah Rekening
                  </button>
                </div>
              </div>

              <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <ListPlus className="w-5 h-5 text-primary" />
                  Template Pesan WhatsApp
                </h3>
                <div className="space-y-2">
                  <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl text-xs text-foreground/80 leading-relaxed mb-3">
                    <p className="font-bold text-primary mb-1">Variabel Dinamis:</p>
                    Gunakan kode berikut dalam template Anda: <br/>
                    <code className="text-accent bg-black/40 px-1 py-0.5 rounded">{`{invoice_number}`}</code>
                    <code className="text-accent bg-black/40 px-1 py-0.5 rounded ml-1">{`{customer_name}`}</code>
                    <code className="text-accent bg-black/40 px-1 py-0.5 rounded ml-1">{`{total_amount}`}</code>
                    <code className="text-accent bg-black/40 px-1 py-0.5 rounded mt-1 inline-block">{`{sisa_bayar}`}</code>
                  </div>
                  <textarea
                    value={store.wa_message_template}
                    onChange={(e) => setStore({ ...store, wa_message_template: e.target.value })}
                    className="w-full h-40 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-foreground custom-scrollbar text-sm"
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveStore}
              disabled={isSaving}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-[0_0_20px_rgba(var(--primary),0.3)] disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Menyimpan...' : 'Simpan Profil Toko'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Access & Users */}
      {activeTab === 'access' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Matrix Role & Permission */}
          <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 overflow-hidden">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Matrix Hak Akses Menu
            </h3>
            <p className="text-sm text-foreground/60 mb-6">Centang menu yang boleh diakses oleh masing-masing Role.</p>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 border-b border-white/10 text-foreground/80 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-xl">Nama Menu</th>
                    {ROLES.map(role => (
                      <th key={role} className="px-6 py-4 text-center">{role}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {MENU_LIST.map((menu) => (
                    <tr key={menu.key} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground/90">{menu.label}</td>
                      {ROLES.map(role => {
                        const isChecked = (rolePermissions[role] || []).includes(menu.key)
                        return (
                          <td key={role} className="px-6 py-4 text-center">
                            <label className="flex items-center justify-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={() => handleTogglePermission(role, menu.key)}
                                className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary focus:ring-primary focus:ring-offset-background"
                              />
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Management */}
          <div className="bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                Daftar Pengguna (User Management)
              </h3>
              <button 
                onClick={handleAddUserRole}
                className="btn-secondary text-xs px-3 h-8 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah User
              </button>
            </div>
            <p className="text-sm text-foreground/60 mb-6">Daftarkan username / email user beserta Role-nya di sini agar mereka bisa login dan melihat menu yang sesuai.</p>
            
            <div className="space-y-3">
              {userRoles.map((ur, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 items-center p-3 border border-white/10 rounded-xl bg-white/5">
                  <div className="flex-1 w-full space-y-1">
                    <label className="text-xs text-foreground/60">Username / Email (Wajib Sama dgn Login)</label>
                    <input
                      type="text"
                      placeholder="admin / admin@kingsablon.com"
                      value={ur.email}
                      onChange={(e) => handleUpdateUserRole(index, 'email', e.target.value.toLowerCase())}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div className="w-full sm:w-48 space-y-1">
                    <label className="text-xs text-foreground/60">Role Akses</label>
                    <select
                      value={ur.role}
                      onChange={(e) => handleUpdateUserRole(index, 'role', e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/50 text-foreground [&>option]:bg-background"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-auto pt-5">
                    <button 
                      onClick={() => handleRemoveUserRole(index)}
                      className="p-2 w-full sm:w-auto text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-transparent hover:border-red-400/20 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {userRoles.length === 0 && (
                <div className="text-center py-8 text-foreground/40 italic text-sm">
                  Belum ada user yang didaftarkan rolenya.<br/>User yang tidak terdaftar otomatis dianggap Operator.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveAccess}
              disabled={isSaving}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-[0_0_20px_rgba(var(--primary),0.3)] disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Menyimpan...' : 'Simpan Akses & Pengguna'}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
