'use client'

import { useState, useTransition } from 'react'
import { Settings, Save, AlertCircle, TrendingUp, PaintBucket, Calculator, Layers, Loader2 } from 'lucide-react'
import { savePricelistConfig } from './actions'

export default function PricelistClient({ initialConfig }) {
  const [profitMargin, setProfitMargin] = useState(initialConfig?.profitMargin || 15)
  const [isPending, startTransition] = useTransition()
  
  // Matrix pricing for Jasa Sablon per pcs based on tier
  const [sablonFee, setSablonFee] = useState(initialConfig?.sablonFee || {
    CUP: { '500': 450, '1000': 350, '5000': 300, '10000': 250 },
    PLASTIK: { '500': 350, '1000': 250, '5000': 200, '10000': 150 },
    PAPERBOWL: { '500': 550, '1000': 450, '5000': 400, '10000': 350 },
  })

  const handleSave = () => {
    startTransition(async () => {
      const config = { profitMargin, sablonFee }
      const res = await savePricelistConfig(config)
      if (res.success) {
        alert('Pengaturan Pricelist berhasil disimpan! Harga jual seluruh produk otomatis disinkronkan.')
      } else {
        alert('Gagal menyimpan: ' + res.error)
      }
    })
  }

  const handleFeeChange = (category, tier, value) => {
    setSablonFee(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [tier]: Number(value)
      }
    }))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Pengaturan Formula Pricelist (Owner)
        </h1>
        <p className="text-sm text-foreground/60 mt-1">
          Atur strategi harga jual produk polos dan matrix harga tiering jasa sablon.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* PANEL 1: HARGA BELI & JUAL POLOS */}
        <div className="glass-card p-6 flex flex-col gap-4 border-l-4 border-blue-500 md:col-span-1">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-foreground">Formula Harga Jual Polos</h2>
          </div>
          
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
            <Calculator className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-400">Harga Beli Rata-Rata</p>
              <p className="text-xs text-foreground/70 mt-1 leading-relaxed">
                Sistem otomatis mengambil rata-rata Unit Cost dari <strong>3 riwayat PO terakhir</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-foreground/80">Margin Jual Polos (%)</label>
            <div className="relative">
              <input 
                type="number" 
                value={profitMargin} 
                onChange={(e) => setProfitMargin(e.target.value)}
                className="glass-input w-full pl-4 pr-12 font-bold text-blue-400" 
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 font-bold">%</span>
            </div>
            <p className="text-[10px] text-foreground/40 mt-1">
              Contoh: Modal Rp 1.000 + 15% = Rp 1.150 / pcs.
            </p>
          </div>
        </div>

        {/* PANEL 2: TARIF JASA SABLON TIERING */}
        <div className="glass-card p-0 flex flex-col border-l-4 border-primary md:col-span-2 overflow-hidden">
          <div className="p-6 pb-4 border-b border-white/10 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Matrix Tarif Jasa Sablon (Per Pcs)</h2>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 border-b border-white/10 text-foreground/60 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium text-center">&ge; 500 pcs</th>
                  <th className="px-4 py-3 font-medium text-center">&ge; 1.000 pcs</th>
                  <th className="px-4 py-3 font-medium text-center">&ge; 5.000 pcs</th>
                  <th className="px-4 py-3 font-medium text-center">&ge; 10.000 pcs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                
                {Object.keys(sablonFee).map((category) => (
                  <tr key={category} className="hover:bg-white/5">
                    <td className="px-4 py-4 font-bold text-primary">{category === 'CUP' ? 'CUP / INJEK' : category}</td>
                    {['500', '1000', '5000', '10000'].map(tier => (
                      <td key={tier} className="px-2 py-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-foreground/40 font-bold">Rp</span>
                          <input 
                            type="number"
                            value={sablonFee[category][tier]}
                            onChange={(e) => handleFeeChange(category, tier, e.target.value)}
                            className="glass-input w-full pl-8 pr-2 h-9 text-xs font-bold text-foreground"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                
              </tbody>
            </table>
            
            <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20 flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">
                Kalkulator harga otomatis memilih tarif jasa sablon termurah berdasarkan Qty yang diinput konsumen. 
                <br/>Total Harga = <strong>(Harga Jual Polos) + (Tarif Jasa Sablon Sesuai Tier Qty)</strong>.
              </p>
            </div>
          </div>
        </div>

      </div>

      <div className="flex justify-end pt-6">
        <button disabled={isPending} onClick={handleSave} className="btn-primary flex items-center gap-2 px-8 h-12 shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50">
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isPending ? 'Menyimpan & Sinkronisasi...' : 'Simpan Pengaturan'}
        </button>
      </div>

    </div>
  )
}
