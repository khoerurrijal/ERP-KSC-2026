'use client'

import { useMemo, useState } from 'react'

function getValue(row, key) {
  return key.split('.').reduce((value, part) => {
    const source = Array.isArray(value) ? value[0] : value
    return source?.[part]
  }, row)
}

function normalize(value) {
  if (value == null || value === '-') return ''
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return Number(value)
  if (value instanceof Date) return value.getTime()

  const text = String(value).trim()
  if (!text) return ''

  const dateMatch = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/)
  if (dateMatch) {
    const [, day, month, rawYear] = dateMatch
    const year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear)
    return new Date(year, Number(month) - 1, Number(day)).getTime()
  }

  const numericText = text.replace(/^Rp\s*/i, '').replace(/\s*(pcs|pc|roll|box|unit)$/i, '')
  if (/^-?[\d.,]+$/.test(numericText)) {
    const normalizedNumber = numericText.includes(',')
      ? numericText.replace(/\./g, '').replace(',', '.')
      : numericText.replace(/\./g, '')
    const number = Number(normalizedNumber)
    if (Number.isFinite(number)) return number
  }

  return text.toLocaleLowerCase('id-ID')
}

export default function useSortableRows(rows = []) {
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' })

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rows

    return [...rows].sort((left, right) => {
      const a = normalize(getValue(left, sortConfig.key))
      const b = normalize(getValue(right, sortConfig.key))
      let comparison

      if (typeof a === 'number' && typeof b === 'number') comparison = a - b
      else comparison = String(a).localeCompare(String(b), 'id', { numeric: true, sensitivity: 'base' })

      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [rows, sortConfig])

  const requestSort = key => setSortConfig(current => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
  }))

  return { sortedRows, sortConfig, requestSort }
}
