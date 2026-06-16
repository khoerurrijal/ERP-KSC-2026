'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export default function MonthFilter({ value, onChange }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  const [selectedMonth, setSelectedMonth] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [displayYear, setDisplayYear] = useState(new Date().getFullYear())
  
  const popoverRef = useRef(null)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedMonth(value)
      if (value) setDisplayYear(parseInt(value.split('-')[0]))
    } else {
      const monthParam = searchParams.get('month')
      if (monthParam) {
        setSelectedMonth(monthParam)
        setDisplayYear(parseInt(monthParam.split('-')[0]))
      } else {
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setSelectedMonth(currentMonth)
        setDisplayYear(now.getFullYear())
      }
    }
  }, [searchParams, value])

  useEffect(() => {
    // Click outside to close
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [popoverRef])

  const handleSelect = (year, monthIndex) => {
    const newMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
    setIsOpen(false)
    
    if (onChange) {
      onChange(newMonth)
    } else {
      // Update URL
      const params = new URLSearchParams(searchParams)
      params.set('month', newMonth)
      window.location.href = `${pathname}?${params.toString()}`
    }
  }

  // Format Display
  const getDisplayLabel = () => {
    if (!selectedMonth) return 'Pilih Bulan'
    const [y, m] = selectedMonth.split('-')
    return `${MONTHS[parseInt(m) - 1]} ${y}`
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="glass-input h-10 px-4 flex items-center gap-2 text-sm font-medium hover:bg-white/10 transition-colors"
      >
        <Calendar className="w-4 h-4 text-primary" />
        {getDisplayLabel()}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 p-4 w-64 bg-[#18181B] rounded-xl shadow-2xl border border-white/10 z-[9999] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
            <button 
              onClick={() => setDisplayYear(y => y - 1)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground/80" />
            </button>
            <span className="font-bold text-lg text-primary">{displayYear}</span>
            <button 
              onClick={() => setDisplayYear(y => y + 1)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground/80" />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((m, idx) => {
              const isSelected = selectedMonth === `${displayYear}-${String(idx + 1).padStart(2, '0')}`
              return (
                <button
                  key={m}
                  onClick={() => handleSelect(displayYear, idx)}
                  className={`py-2 px-1 text-sm rounded-lg font-medium transition-all duration-200
                    ${isSelected 
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105' 
                      : 'hover:bg-white/10 text-foreground/80 hover:text-foreground'
                    }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
