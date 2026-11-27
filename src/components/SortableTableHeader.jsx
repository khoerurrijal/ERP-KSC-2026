'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

export default function SortableTableHeader({ sortKey, sortConfig, onSort, children, className = '', buttonClassName = '' }) {
  const active = sortConfig?.key === sortKey
  const Icon = active
    ? sortConfig.direction === 'asc' ? ArrowUp : ArrowDown
    : ArrowUpDown

  return (
    <th
      scope="col"
      aria-sort={active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${buttonClassName}`}
      >
        {children}
        <Icon aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary' : 'text-current opacity-40'}`} />
      </button>
    </th>
  )
}
