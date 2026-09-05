import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/utils/supabase/server'
import { runAuditScan } from '@/app/dashboard/audit/audit'
import { getAiModelCandidates, getConfiguredAiModel, isRetryableAiError } from '@/utils/aiAgent'

const fallbackAnswer = (report, message) => {
  const { critical, warning, total } = report.summary
  if (total === 0) return 'Audit tidak menemukan temuan saat ini.'
  return `Berdasarkan audit untuk pertanyaan "${message}": ditemukan ${total} temuan, terdiri dari ${critical} kritis dan ${warning} perlu ditinjau. Prioritaskan temuan kritis terlebih dahulu, lalu buka data terkait dari daftar audit.`
}

export async function POST(request) {
  const supabase = await createClient()
  const startedAt = Date.now()

  try {
    console.info('[dashboard-ai] request started')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sesi login tidak ditemukan.' }, { status: 401 })

    const { data: rolesData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'user_roles')
      .single()
    const userEmail = user.email?.toLowerCase() || ''
    const matchedUser = (rolesData?.value || []).find(role => {
      const inputEmail = (role.email || '').trim().toLowerCase()
      return inputEmail === userEmail || `${inputEmail}@kingsablon.com` === userEmail
    })
    const userRole = matchedUser?.role || 'Operator'
    if (!['ADMIN', 'OWNER'].includes(String(userRole).trim().toUpperCase())) {
      return NextResponse.json({ error: 'Hanya Admin/Owner yang dapat menggunakan Audit Assistant.' }, { status: 403 })
    }

    const body = await request.json()
    const message = String(body?.message || '').trim().slice(0, 500)
    if (!message) return NextResponse.json({ error: 'Pertanyaan wajib diisi.' }, { status: 400 })

    const history = Array.isArray(body?.history)
      ? body.history
        .filter(item => item && ['user', 'assistant'].includes(item.role))
        .slice(-8)
        .map(item => `${item.role === 'user' ? 'Admin' : 'Assistant'}: ${String(item.text || '').slice(0, 500)}`)
      : []
    const clientReport = body?.auditReport
    const report = clientReport?.summary && Array.isArray(clientReport.issues)
      ? {
          generatedAt: clientReport.generatedAt || new Date().toISOString(),
          summary: clientReport.summary,
          issues: clientReport.issues.slice(0, 80)
        }
      : await runAuditScan(supabase)
    const context = JSON.stringify({ summary: report.summary, issues: report.issues.slice(0, 80) })
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      console.warn('[dashboard-ai] GEMINI_API_KEY missing; returning fallback', { durationMs: Date.now() - startedAt })
      return NextResponse.json({ answer: fallbackAnswer(report, message), provider: 'rule-based-fallback' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const agentModel = await getConfiguredAiModel(supabase)
    const conversationContext = history.length > 0
      ? `Riwayat percakapan:\n${history.join('\n')}\n\n`
      : ''
    const prompt = `${conversationContext}Pertanyaan terbaru Admin: ${message}\n\nData audit terbaru:\n${context}`
    let lastAiError

    for (const modelName of getAiModelCandidates(agentModel).slice(0, 2)) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: 'Kamu adalah Audit Assistant internal King Sablon. Jawab dalam bahasa Indonesia yang singkat dan jelas. Gunakan hanya data audit yang diberikan. Jangan mengarang data, jangan mengubah data, dan jangan menyarankan penghapusan tanpa verifikasi Admin. Jika perlu tindakan, arahkan Admin membuka temuan terkait dan melakukan konfirmasi manual.'
        }, { timeout: 8000 })
        const result = await model.generateContent(prompt)
        const answer = result.response.text()
        console.info('[dashboard-ai] Gemini response completed', { durationMs: Date.now() - startedAt, model: modelName })
        return NextResponse.json({ answer, provider: 'gemini', model: modelName })
      } catch (aiError) {
        lastAiError = aiError
        if (!isRetryableAiError(aiError)) break
        console.warn('[dashboard-ai] retrying with fallback model', { failedModel: modelName, status: aiError.status || null })
      }
    }

    console.error('[dashboard-ai] all Gemini models failed:', lastAiError)
    return NextResponse.json({ answer: fallbackAnswer(report, message), provider: 'rule-based-fallback' })
  } catch (error) {
    console.error('[dashboard-ai] request failed:', error)
    return NextResponse.json({ error: 'Audit Assistant sedang tidak tersedia.' }, { status: 500 })
  }
}
