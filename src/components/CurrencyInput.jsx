'use client'

function formatGrouped(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '')
  return digits ? Number(digits).toLocaleString('id-ID') : ''
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
