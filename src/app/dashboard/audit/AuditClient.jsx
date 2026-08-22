'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ExternalLink, RefreshCw, ShieldCheck, Sparkles, XCircle } from 'lucide-react'

const severityConfig = {
  critical: { label: 'Kritis', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/25', icon: XCircle },
  warning: { label: 'Perlu Ditinjau', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25', icon: AlertTriangle },
  info: { label: 'Informasi', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25', icon: CheckCircle2 }
}

const quickQuestions = [
  'Apa masalah paling kritis saat ini?',
  'Apakah ada data marketplace yang janggal?',
  'Mana yang harus saya perbaiki terlebih dahulu?'
]

export default function AuditClient({ initialReport }) {
  const router = useRouter()
  const [expandedIssue, setExpandedIssue] = useState(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Saya bisa membantu membaca hasil audit ini. Tanyakan masalah paling kritis atau data yang perlu diperiksa.' }
  ])
  const [isAsking, setIsAsking] = useState(false)

  const report = initialReport || { summary: { total: 0, critical: 0, warning: 0, info: 0 }, issues: [] }

  const askAssistant = async (prompt = question) => {
    const trimmed = prompt.trim()
    if (!trimmed || isAsking) return

    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: trimmed }])
    setIsAsking(true)

    try {
      const response = await fetch('/api/dashboard/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed })
      })
      const result = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: result.answer || result.error || 'Belum ada jawaban dari assistant.'
      }])
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { role: 'assistant', text: 'Assistant sedang tidak tersedia. Gunakan daftar temuan audit di bawah.' }])
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 pb-12">
      <div className="flex justify-end">
        <button onClick={() => router.refresh()} className="btn-secondary h-9 px-3 text-xs flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Jalankan Audit Ulang
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card p-4 border-l-4 border-red-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-bold">Kritis</p>
          <p className="text-3xl font-black text-red-400 mt-2">{report.summary.critical}</p>
        </div>
        <div className="glass-card p-4 border-l-4 border-amber-500">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-bold">Perlu Ditinjau</p>
          <p className="text-3xl font-black text-amber-400 mt-2">{report.summary.warning}</p>
        </div>
        <div className="glass-card p-4 border-l-4 border-primary">
          <p className="text-xs text-foreground/60 uppercase tracking-wider font-bold">Total Temuan</p>
          <p className="text-3xl font-black text-primary mt-2">{report.summary.total}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="glass-card p-4 xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-foreground flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Temuan Audit</h2>
              <p className="text-xs text-foreground/50 mt-1">Audit terakhir: {report.generatedAt ? new Date(report.generatedAt).toLocaleString('id-ID') : '-'}</p>
            </div>
            <span className="text-xs text-foreground/50">{report.issues.length} ditampilkan</span>
          </div>

          {report.issues.length === 0 ? (
            <div className="rounded-xl border border-green-500/25 bg-green-500/10 p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="font-bold text-green-300">Belum ditemukan masalah.</p>
              <p className="text-xs text-foreground/60 mt-1">Data yang diperiksa terlihat konsisten.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {report.issues.map(issue => {
                const config = severityConfig[issue.severity] || severityConfig.info
                const Icon = config.icon
                const expanded = expandedIssue === issue.id
                return (
                  <div key={issue.id} className={`rounded-xl border ${config.bg} overflow-hidden`}>
                    <button onClick={() => setExpandedIssue(expanded ? null : issue.id)} className="w-full p-4 text-left flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${config.color}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{issue.title}</span>
                          <span className={`text-[10px] uppercase font-bold ${config.color}`}>{config.label}</span>
                        </span>
                        <span className="block text-xs text-foreground/60 mt-1">{issue.description}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 shrink-0 text-foreground/50 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 pl-12 space-y-3">
                        <div className="text-xs text-foreground/60">
                          <span className="font-bold text-foreground/80">Kategori:</span> {issue.category}
                        </div>
                        {issue.records?.length > 0 && (
                          <div className="space-y-1">
                            {issue.records.slice(0, 10).map(record => (
                              <div key={`${issue.id}-${record.label}`} className="flex items-center justify-between gap-3 rounded-lg bg-black/10 px-3 py-2 text-xs">
                                <span className="text-foreground/70 truncate">{record.label}</span>
                                <span className="text-foreground/50 truncate">{record.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {issue.href && (
                          <Link href={issue.href} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                            Buka data terkait <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="glass-card p-4 flex flex-col min-h-[360px]">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-bold text-foreground">Audit Assistant</h2>
              <p className="text-xs text-foreground/50">Membantu membaca temuan, tidak mengubah data otomatis.</p>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[260px] pr-1">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`rounded-xl p-3 text-sm whitespace-pre-line ${message.role === 'user' ? 'bg-primary/15 text-foreground ml-6' : 'bg-white/5 text-foreground/80 mr-3'}`}>
                {message.text}
              </div>
            ))}
            {isAsking && <div className="text-xs text-foreground/50">Assistant sedang membaca audit...</div>}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {quickQuestions.map(prompt => (
              <button key={prompt} onClick={() => askAssistant(prompt)} className="text-[10px] px-2.5 py-1.5 rounded-full border border-primary/25 text-primary hover:bg-primary/10">
                <Sparkles className="w-3 h-3 inline mr-1" />{prompt}
              </button>
            ))}
          </div>
          <form onSubmit={event => { event.preventDefault(); askAssistant() }} className="flex gap-2 mt-3">
            <input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Tanya hasil audit..." className="glass-input h-10 flex-1 text-sm" />
            <button type="submit" disabled={isAsking || !question.trim()} className="btn-primary h-10 px-3 disabled:opacity-50">Kirim</button>
          </form>
        </section>
      </div>
    </div>
  )
}
