export function numericTokenPattern(query) {
  const normalizedQuery = String(query ?? '').trim()
  return /^\d+$/.test(normalizedQuery)
    ? `(^|[^0-9])${normalizedQuery}([^0-9]|$)`
    : null
}

export function stripGeneratedInvoiceNumbers(value) {
  return String(value ?? '')
    .replace(/\bINV[\s:#-]*[A-Z0-9]+(?:-[A-Z0-9]+)*\b/gi, ' ')
    .replace(/\bINVOICE\s*(?:NO\.?)?[\s:#-]*[A-Z0-9]+(?:-[A-Z0-9]+)*\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function matchesSearchText(value, query, { numericSubstring = false } = {}) {
  const normalizedQuery = String(query ?? '').replace(/[(),\"]/g, ' ').trim().toLowerCase()
  if (!normalizedQuery) return true

  const normalizedValue = String(value ?? '').toLowerCase()
  const allowNumericSubstring = numericSubstring && normalizedQuery.length >= 4
  const numericPattern = allowNumericSubstring ? null : numericTokenPattern(normalizedQuery)
  return numericPattern
    ? new RegExp(numericPattern).test(normalizedValue)
    : normalizedValue.includes(normalizedQuery)
}
