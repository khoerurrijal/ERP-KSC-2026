'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'

export default function CustomSelect({ value, onChange, options, placeholder = "Pilih...", className = "", icon: Icon, searchable = false, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const popoverRef = useRef(null)

  useEffect(() => {
    // Close on click outside
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (optionValue) => {
    if (onChange) {
      // Simulate event object for compatibility with standard onChange handlers
      onChange({ target: { value: optionValue } })
    }
    setIsOpen(false)
    setSearchQuery('')
  }

  const selectedOption = options.find(opt => String(opt.value) === String(value))
  const displayLabel = selectedOption ? selectedOption.label : placeholder

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery) return options
    return options.filter(opt => 
      String(opt.label).toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [options, searchable, searchQuery])

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      <button 
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`glass-input h-10 px-4 w-full flex items-center justify-between gap-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-foreground/5'}`}
      >
        <div className="flex items-center gap-2 truncate w-full">
          {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
          <span className="truncate w-full text-left">{displayLabel}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-foreground/50 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 left-0 mt-2 p-2 min-w-[200px] bg-background/95 backdrop-blur-md rounded-xl shadow-2xl border border-card-border z-[9999] animate-in fade-in zoom-in-95 duration-200 max-h-60 flex flex-col">
          {searchable && (
            <div className="p-2 border-b border-card-border mb-2 shrink-0 relative">
              <Search className="w-3.5 h-3.5 text-foreground/50 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                autoFocus
                placeholder="Cari..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-foreground/5 border border-card-border rounded-md h-8 pl-8 pr-3 text-xs text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          )}
          <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-foreground/40">Tidak ada hasil</div>
            ) : filteredOptions.map((opt) => {
              const isSelected = String(value) === String(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg font-medium transition-all duration-200 flex items-center justify-between group shrink-0
                    ${isSelected 
                      ? 'bg-primary/20 text-primary' 
                      : 'hover:bg-foreground/10 text-foreground/80 hover:text-foreground'
                    }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
