'use client'

function formatGrouped(value) {
  if (value == null || value === '') return ''

  const rawValue = String(value).trim()
  const indonesianGrouped = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(rawValue)
  const usGrouped = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(rawValue)
  const normalizedValue = indonesianGrouped
    ? Number(rawValue.replace(/\./g, '').replace(',', '.'))
    : usGrouped
      ? Number(rawValue.replace(/,/g, ''))
      : Number(value)
  const digits = rawValue.replace(/[^0-9]/g, '')
  const amount = Number.isFinite(normalizedValue)
    ? Math.round(normalizedValue)
    : digits ? Number(digits) : Number.NaN

  return Number.isFinite(amount) && amount >= 0
    ? amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })
    : ''
}

export default function CurrencyInput({ value, onChange, className = '', placeholder = '0', ...props }) {
  const handleChange = (event) => {
    const rawValue = event.target.value.replace(/[^0-9]/g, '')
    onChange?.({ target: { value: rawValue } })
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={formatGrouped(value)}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  )
}
