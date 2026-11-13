const TWO_COLOR_NOTE_PATTERN = /2\s*warna|warna\s*ke-?2/i
export const AUTOMATIC_COLOR_PASS_START_DATE = '2026-11-01'

export function getStoredProductionColorPass(notes) {
  return Number(String(notes || '').match(/\[\[WARNA_PASS:([12])\]\]/i)?.[1]) || null
}

function getProductionColorPassFromNotes(notes) {
  const storedPass = getStoredProductionColorPass(notes)
  if (storedPass) return storedPass

  const match = String(notes || '').match(/\bwarna\s*(?:ke\s*)?-?\s*([12])\b|\bw([12])\b/i)
  return Number(match?.[1] || match?.[2]) || null
}

export function getAutomaticProductionColorPass(progressQty, targetPerPass) {
  const progress = Math.max(0, Number(progressQty || 0))
  const target = Number(targetPerPass || 0)
  if (!Number.isFinite(progress) || !Number.isFinite(target) || target <= 0) return null
  if (progress < target) return 1
  if (progress < target * 2) return 2
  return null
}

export function getNextProductionColorPass(colorOneQty, colorTwoQty, targetPerPass) {
  const target = Number(targetPerPass || 0)
  if (!Number.isFinite(target) || target <= 0) return null
  if (Number(colorOneQty || 0) < target) return 1
  if (Number(colorTwoQty || 0) < target) return 2
  return null
}

function getProductionLogTime(log) {
  const createdAt = Date.parse(log.created_at || '')
  if (Number.isFinite(createdAt)) return createdAt
  const processedDate = Date.parse(`${String(log.processed_date || '').slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(processedDate) ? processedDate : 0
}

function getProductionLogDateKey(log) {
  const processedDate = String(log.processed_date || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(processedDate)) return processedDate

  const createdAt = Date.parse(log.created_at || '')
  if (!Number.isFinite(createdAt)) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(createdAt))
  const part = type => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isAutomaticProductionLog(log) {
  return getProductionLogDateKey(log) >= AUTOMATIC_COLOR_PASS_START_DATE
}

export function getAutomaticProductionProgressQty(logs = []) {
  return (logs || []).reduce((total, log) => (
    isAutomaticProductionLog(log)
      ? total + Number(log.qty_processed || 0)
      : total
  ), 0)
}

export function reconcileProductionColorPasses(jobs = [], logs = []) {
  const jobsById = new Map((jobs || []).map(job => [String(job.id), job]))
  const logsByJobId = new Map()

  for (const log of logs || []) {
    const jobId = String(log.job_id || '')
    if (!jobId || !jobsById.has(jobId)) continue
    const jobLogs = logsByJobId.get(jobId) || []
    jobLogs.push(log)
    logsByJobId.set(jobId, jobLogs)
  }

  const effectiveQtyByLogId = new Map((logs || [])
    .filter(log => log.id != null)
    .map(log => [String(log.id), Number(log.qty_processed || 0)]))
  const colorPassByLogId = new Map()
  const colorPassTotalsByJobId = new Map()

  for (const [jobId, jobLogs] of logsByJobId) {
    const job = jobsById.get(jobId)
    if (!TWO_COLOR_NOTE_PATTERN.test(job.notes || '')) continue

    const targetPerPass = Number(job.qty || 0) * Number(job.unit_multiplier || 1)
    if (!Number.isFinite(targetPerPass) || targetPerPass <= 0) {
      for (const log of jobLogs) {
        const storedPass = getStoredProductionColorPass(log.notes)
        if (storedPass && log.id != null) colorPassByLogId.set(String(log.id), storedPass)
      }
      continue
    }
    const orderedLogs = jobLogs
      .map((log, index) => ({ log, index }))
      .sort((a, b) => (
        getProductionLogTime(a.log) - getProductionLogTime(b.log)
        || String(a.log.id || a.index).localeCompare(String(b.log.id || b.index))
      ))

    // A negative admin correction cancels the latest earlier production inputs.
    // Keep the source rows in the database, but remove canceled quantities from
    // the live accumulation so a corrected duplicate is not counted twice.
    const unreversedInputs = []
    for (const { log } of orderedLogs) {
      if (!isAutomaticProductionLog(log)) continue
      const qty = Number(log.qty_processed || 0)
      if (qty > 0) {
        unreversedInputs.push({ log, remainingQty: qty })
        continue
      }
      if (qty >= 0) continue

      let correctionRemaining = Math.abs(qty)
      while (correctionRemaining > 0 && unreversedInputs.length) {
        const source = unreversedInputs[unreversedInputs.length - 1]
        const reversedQty = Math.min(source.remainingQty, correctionRemaining)
        source.remainingQty -= reversedQty
        correctionRemaining -= reversedQty
        if (source.log.id != null) {
          effectiveQtyByLogId.set(String(source.log.id), source.remainingQty)
        }
        if (source.remainingQty === 0) unreversedInputs.pop()
      }
      if (log.id != null) {
        // A correction can only cancel November-or-later input for this
        // accumulation. Any remainder belongs to older history and must not
        // reopen a current color target.
        effectiveQtyByLogId.set(String(log.id), 0)
      }
    }

    let legacyColorOneQty = 0
    const passTotals = { 1: 0, 2: 0 }

    for (const { log } of orderedLogs) {
      const isAutomaticPeriod = isAutomaticProductionLog(log)
      const processedQty = isAutomaticPeriod && log.id != null
        ? Number(effectiveQtyByLogId.get(String(log.id)) || 0)
        : Number(log.qty_processed || 0)
      const explicitColorPass = getProductionColorPassFromNotes(log.notes)
      let colorPass = isAutomaticPeriod
        ? (processedQty > 0
          ? (explicitColorPass || getNextProductionColorPass(passTotals[1], passTotals[2], targetPerPass))
          : processedQty < 0
            ? (explicitColorPass || (passTotals[2] > 0 ? 2 : 1))
            : null)
        : (explicitColorPass || (legacyColorOneQty < targetPerPass ? 1 : 2))
      if (log.id != null) colorPassByLogId.set(String(log.id), colorPass)
      if (isAutomaticPeriod) {
        if (processedQty > 0) {
          // Keep production at or below the ordered quantity for each color.
          // Any accidental excess stays in the source audit log but is omitted
          // from the live production accumulation.
          const acceptedQty = colorPass
            ? Math.min(processedQty, Math.max(0, targetPerPass - passTotals[colorPass]))
            : 0
          if (log.id != null) effectiveQtyByLogId.set(String(log.id), acceptedQty)
          if (!acceptedQty && log.id != null) colorPassByLogId.set(String(log.id), null)
          if (colorPass) passTotals[colorPass] += acceptedQty
        } else if (processedQty < 0 && colorPass) {
          passTotals[colorPass] += processedQty
        }
      } else if (explicitColorPass) {
        // Explicitly tagged historical passes are authoritative for stage
        // progress, even when their production date predates automation.
        if (processedQty > 0) {
          passTotals[colorPass] += Math.min(processedQty, Math.max(0, targetPerPass - passTotals[colorPass]))
        } else if (processedQty < 0) {
          passTotals[colorPass] = Math.max(0, passTotals[colorPass] + processedQty)
        }
        if (colorPass === 1) legacyColorOneQty += processedQty
      } else if (colorPass === 1) {
        legacyColorOneQty += processedQty
      }
    }

    colorPassTotalsByJobId.set(jobId, passTotals)
  }

  return { effectiveQtyByLogId, colorPassByLogId, colorPassTotalsByJobId }
}

export function inferProductionColorPasses(jobs = [], logs = []) {
  return reconcileProductionColorPasses(jobs, logs).colorPassByLogId
}
