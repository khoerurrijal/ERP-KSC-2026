'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { Download, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export default function ExcelBulkImport({ title, templateData, onImport }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text: '' }

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_Template.xlsx`)
  }

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    setMessage(null)

    if (selectedFile) {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result
          const wb = XLSX.read(bstr, { type: 'binary' })
          const wsname = wb.SheetNames[0]
          const ws = wb.Sheets[wsname]
          const data = XLSX.utils.sheet_to_json(ws)
          setPreview(data)
        } catch (error) {
          setMessage({ type: 'error', text: 'Gagal membaca file Excel. Pastikan format sudah benar.' })
        }
      }
      reader.readAsBinaryString(selectedFile)
    }
  }

  const handleImport = async () => {
    if (preview.length === 0) return
    setLoading(true)
    setMessage(null)
    
    try {
      const result = await onImport(preview)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: `Berhasil mengimport ${preview.length} data ${title}.` })
        setPreview([])
        setFile(null)
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan sistem.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card p-6 flex flex-col gap-6 border-l-4 border-l-primary">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-foreground">Import {title}</h3>
          <p className="text-sm text-foreground/60 mt-1">Gunakan template untuk melakukan bulk insert</p>
        </div>
        <button onClick={handleDownloadTemplate} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" />
          Download Template
        </button>
      </div>

      <div className="p-8 border-2 border-dashed border-white/10 rounded-xl bg-white/5 text-center relative hover:bg-white/10 transition-all cursor-pointer">
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileUpload}
        />
        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
          <Upload className="w-8 h-8 text-primary" />
          <p className="text-sm font-medium text-foreground/80">
            {file ? file.name : "Klik atau seret file Excel ke sini"}
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground/80">Preview Data ({preview.length} baris)</h4>
            <button onClick={handleImport} disabled={loading} className="btn-primary flex items-center gap-2 text-sm px-6">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {loading ? 'Menyimpan...' : 'Simpan ke Database'}
            </button>
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5 text-foreground/70 uppercase text-xs">
                <tr>
                  {Object.keys(preview[0]).map((key) => (
                    <th key={key} className="px-4 py-3">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-4 py-3 text-foreground/80">{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && (
              <div className="px-4 py-3 text-xs text-center text-foreground/50 bg-black/20">
                ... dan {preview.length - 5} baris lainnya
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
