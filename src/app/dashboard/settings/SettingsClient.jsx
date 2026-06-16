'use client'

import { useState } from 'react'
import { Save, Plus, Trash2, Settings, ListPlus, Banknote, Percent, Store } from 'lucide-react'
import { updateDropdownConfig, updateCashflowConfig, updateStoreConfig } from './actions'

export default function SettingsClient({ initialSettings }) {
  const [activeTab, setActiveTab] = useState('dropdowns')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  
  // State for Dropdowns
  const [dropdowns, setDropdowns] = useState(initialSettings.dropdown_config || {})
  
  // State for Cashflow
  const [cashflow, setCashflow] = useState({
    king_fixed_expenses: initialSettings.cashflow_config?.king_fixed_expenses || 4100000,
    tabungan_fixed_in: initialSettings.cashflow_config?.tabungan_fixed_in || 2000000,
    profit_global_percent: initialSettings.cashflow_config?.profit_global_percent || 10,
    zakat_percent: initialSettings.cashflow_config?.zakat_percent || 3,
    virtual_balance: initialSettings.cashflow_config?.virtual_balance || 42289347
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

  const handleSaveStore = async () => {
    setIsSaving(true)
    setError(null)
    const res = await updateStoreConfig(store)
    if (!res.success) setError(res.error)
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
          Pengaturan Alur Kas & Profit
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
      </div>

      {/* Tab Content: Dropdowns */}
      {activeTab === 'dropdowns' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.keys(dropdowns).map(key => (
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
              <div className="h-px bg-white/10 w-full my-4" />

              {/* Saldo Kas Virtual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-sm font-bold text-foreground/80">Saldo Kas Virtual (Rp)</label>
                  <p className="text-xs text-foreground/40 mt-1">Angka penyeimbang kas yang akan tampil sebagai Kas Fisik Realtime di Laporan (Report).</p>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-foreground/40 font-bold">
                    Rp
                  </div>
                  <input
                    type="number"
                    value={cashflow.virtual_balance}
                    onChange={(e) => setCashflow({ ...cashflow, virtual_balance: Number(e.target.value) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-right focus:outline-none focus:border-primary/50 text-foreground font-mono text-lg text-yellow-400"
                  />
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
    </div>
  )
}
