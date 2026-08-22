import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/utils/supabase/server'
import { runAuditScan } from '@/app/dashboard/audit/audit'

const fallbackAnswer = (report, message) => {
  const { critical, warning, total } = report.summary
  if (total === 0) return 'Audit tidak menemukan temuan saat ini.'
  return `Berdasarkan audit untuk pertanyaan "${message}": ditemukan ${total} temuan, terdiri dari ${critical} kritis dan ${warning} perlu ditinjau. Prioritaskan temuan kritis terlebih dahulu, lalu buka data terkait dari daftar audit.`
}

export async function POST(request) {
  const supabase = await createClient()

  try {
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
    if (!['ADMIN', 'OWNER'].includes(String(userRole).toUpperCase())) {
      return NextResponse.json({ error: 'Hanya Admin/Owner yang dapat menggunakan Audit Assistant.' }, { status: 403 })
    }

    const body = await request.json()
    const message = String(body?.message || '').trim().slice(0, 500)
    if (!message) return NextResponse.json({ error: 'Pertanyaan wajib diisi.' }, { status: 400 })

    const report = await runAuditScan(supabase)
    const context = JSON.stringify({ summary: report.summary, issues: report.issues.slice(0, 80) })
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ answer: fallbackAnswer(report, message), provider: 'rule-based-fallback' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.7-flash',
      systemInstruction: 'Kamu adalah Audit Assistant internal King Sablon. Jawab dalam bahasa Indonesia yang singkat dan jelas. Gunakan hanya data audit yang diberikan. Jangan mengarang data, jangan mengubah data, dan jangan menyarankan penghapusan tanpa verifikasi Admin. Jika perlu tindakan, arahkan Admin membuka temuan terkait dan melakukan konfirmasi manual.'
    })
    try {
      const result = await model.generateContent(`Pertanyaan Admin: ${message}\n\nData audit terbaru:\n${context}`)
      const answer = result.response.text()
      return NextResponse.json({ answer, provider: 'gemini' })
    } catch (aiError) {
      console.error('Gemini dashboard assistant error:', aiError)
      return NextResponse.json({ answer: fallbackAnswer(report, message), provider: 'rule-based-fallback' })
    }
  } catch (error) {
    console.error('Dashboard AI error:', error)
    return NextResponse.json({ error: 'Audit Assistant sedang tidak tersedia.' }, { status: 500 })
  }
}
