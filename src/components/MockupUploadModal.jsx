'use client'

import { useState } from 'react'
import { X, UploadCloud, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { updateMockupUrl } from '@/app/actions/sales'
import { createClient } from '@/utils/supabase/client'

export default function MockupUploadModal({ isOpen, onClose, itemId, initialUrl = '' }) {
  const [url, setUrl] = useState(initialUrl || '')
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState(initialUrl || '')

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      const objUrl = URL.createObjectURL(selected)
      setPreview(objUrl)
    }
  }

  const handleSave = async () => {
    setIsUploading(true)
    try {
      let finalUrl = url;

      // Jika user memilih file fisik, upload ke Supabase Storage
      if (file) {
        const supabase = createClient()
        const fileExt = file.name.split('.').pop()
        const fileName = `${itemId}_${Date.now()}.${fileExt}`
        
        const { error: uploadError, data } = await supabase.storage
          .from('mockups')
          .upload(fileName, file)
          
        if (uploadError) {
          throw new Error('Gagal upload gambar: Pastikan bucket "mockups" tersedia dan public. ' + uploadError.message)
        }

        const { data: publicUrlData } = supabase.storage.from('mockups').getPublicUrl(fileName)
        finalUrl = publicUrlData.publicUrl
      }

      // Simpan URL (baik hasil upload maupun manual) ke database
      if (finalUrl) {
        const res = await updateMockupUrl(itemId, finalUrl)
        if (!res.success) throw new Error(res.error)
      }

      alert('Mockup berhasil disimpan!')
      window.location.reload()
    } catch (e) {
      alert(e.message || 'Terjadi kesalahan')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h3 className="font-bold text-foreground">Set Mockup / Desain</h3>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {preview && (
            <div className="w-full h-40 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
              <img src={preview} alt="Preview" className="max-h-full object-contain" />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
              <UploadCloud className="w-4 h-4" /> Upload File (JPG/PNG)
            </label>
            <div className="relative">
              <input 
                type="file" 
                accept="image/png, image/jpeg"
                onChange={handleFileChange}
                className="block w-full text-sm text-foreground/70 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-foreground/50 mt-1">Pilih gambar fisik jika ada. Gambar akan diupload ke server.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-xs text-foreground/50 font-medium">ATAU</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80 flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Paste Link URL
            </label>
            <input 
              type="url" 
              value={url}
              onChange={e => {
                setUrl(e.target.value)
                if (!file) setPreview(e.target.value)
              }}
              placeholder="https://..."
              className="glass-input w-full"
            />
            <p className="text-[10px] text-foreground/50">Gunakan link GDrive / Canva / Web untuk gambar external.</p>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
          <button onClick={onClose} className="btn-secondary px-4 h-10 text-sm">Batal</button>
          <button 
            disabled={isUploading || (!file && !url)} 
            onClick={handleSave} 
            className="btn-primary px-4 h-10 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isUploading ? 'Menyimpan...' : <><CheckCircle2 className="w-4 h-4" /> Simpan Mockup</>}
          </button>
        </div>
      </div>
    </div>
  )
}
