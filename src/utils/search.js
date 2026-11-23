export function numericTokenPattern(query) {
  const normalizedQuery = String(query ?? '').trim()
  return /^\d+$/.test(normalizedQuery)
    ? `(^|[^0-9])${normalizedQuery}([^0-9]|$)`
    : null
}

export function buildAllTermsSearchFilter(fields, query, { numericSubstringFields = [] } = {}) {
  const terms = String(query ?? '').replace(/[(),\"]/g, ' ').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length || !fields.length) return ''

  const getTermFilters = term => fields.map(field => {
    const numericPattern = numericTokenPattern(term)
    if (numericPattern && !numericSubstringFields.includes(field)) {
      return `${field}.imatch."${numericPattern}"`
    }
    return `${field}.ilike.%${term}%`
  })

  if (terms.length === 1) return getTermFilters(terms[0]).join(',')
  return `and(${terms.map(term => `or(${getTermFilters(term).join(',')})`).join(',')})`
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
  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  return terms.every(term => {
    const allowNumericSubstring = numericSubstring && term.length >= 4
    const numericPattern = allowNumericSubstring ? null : numericTokenPattern(term)
    return numericPattern
      ? new RegExp(numericPattern).test(normalizedValue)
      : normalizedValue.includes(term)
  })
}
