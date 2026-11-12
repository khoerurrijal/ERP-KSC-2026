'use client'

/* These effects synchronize the calendar viewport and portal geometry. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const parseDateValue = (value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  return value ? new Date(value) : new Date()
}

const getDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const formatDateLabel = (value) => {
  if (!value) return 'Pilih Tanggal'
  const date = parseDateValue(value)
  if (isNaN(date.getTime())) return 'Pilih Tanggal'
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export default function CustomDatePicker({ value, onChange, className = "", endValue, onRangeChange, menuZIndex = 2000 }) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef(null)
  const menuRef = useRef(null)
  const [menuStyle, setMenuStyle] = useState(null)
  const [rangeSelectionStep, setRangeSelectionStep] = useState('from')
  const isRange = typeof endValue === 'string' && typeof onRangeChange === 'function'
  
  const initialDate = parseDateValue(value)
  const [displayYear, setDisplayYear] = useState(initialDate.getFullYear())
  const [displayMonth, setDisplayMonth] = useState(initialDate.getMonth())

  useEffect(() => {
    if (value) {
      const d = parseDateValue(value)
      if (!isNaN(d.getTime())) {
        setDisplayYear(d.getFullYear())
        setDisplayMonth(d.getMonth())
      }
    }
  }, [value])

  useEffect(() => {
    function handleClickOutside(event) {
      const clickedButton = popoverRef.current?.contains(event.target)
      const clickedMenu = menuRef.current?.contains(event.target)
      if (!clickedButton && !clickedMenu) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null)
      return undefined
    }

    const updateMenuPosition = () => {
      const anchor = popoverRef.current?.getBoundingClientRect()
      if (!anchor) return

      const width = Math.min(288, window.innerWidth - 24)
      const estimatedHeight = isRange ? 420 : 340
      const spaceBelow = Math.max(0, window.innerHeight - anchor.bottom - 20)
      const spaceAbove = Math.max(0, anchor.top - 20)
      const opensAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
      const availableHeight = Math.min(estimatedHeight, opensAbove ? spaceAbove : spaceBelow)
      const left = Math.min(Math.max(12, anchor.left), window.innerWidth - width - 12)

      setMenuStyle({
        position: 'fixed',
        left,
        top: opensAbove ? anchor.top - 8 : anchor.bottom + 8,
        width,
        maxHeight: availableHeight,
        overflowY: 'auto',
        zIndex: menuZIndex,
        transform: opensAbove ? 'translateY(-100%)' : undefined
      })
    }

    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [isOpen, isRange, menuZIndex])

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11)
      setDisplayYear(y => y - 1)
    } else {
      setDisplayMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0)
      setDisplayYear(y => y + 1)
    } else {
      setDisplayMonth(m => m + 1)
    }
  }

  const handleSelectDate = (day) => {
    const formatted = getDateKey(new Date(displayYear, displayMonth, day))

    if (!isRange) {
      onChange(formatted)
      setIsOpen(false)
      return
    }

    if (rangeSelectionStep === 'from') {
      onRangeChange({ start: formatted, end: formatted })
      setRangeSelectionStep('to')
      return
    }

    const start = formatted < value ? formatted : value
    const end = formatted < value ? value : formatted
    onRangeChange({ start, end })
    setRangeSelectionStep('from')
    setIsOpen(false)
  }

  const handleCurrentMonth = () => {
    const today = getDateKey(new Date())
    onRangeChange({ start: `${today.slice(0, 7)}-01`, end: today })
    setRangeSelectionStep('from')
    setIsOpen(false)
  }

  // Get days in month
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay()

  // Generate calendar grid
  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const getDisplayLabel = () => {
    const startLabel = formatDateLabel(value)
    return isRange ? `${startLabel} – ${formatDateLabel(endValue)}` : startLabel
  }

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      <button 
        type="button"
        onClick={() => {
          if (!isOpen && isRange) setRangeSelectionStep('from')
          setIsOpen(!isOpen)
        }}
        className="glass-input h-10 px-4 w-full flex items-center justify-between gap-2 text-sm font-medium hover:bg-white/10 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{getDisplayLabel()}</span>
        </div>
      </button>

      {isOpen && menuStyle && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={menuStyle} className="p-4 bg-[#18181B] rounded-xl shadow-2xl border border-white/10 z-[2000] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
            <button 
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground/80" />
            </button>
            <span className="font-bold text-sm text-primary">{MONTHS[displayMonth]} {displayYear}</span>
            <button 
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground/80" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-[10px] font-bold text-foreground/50 uppercase">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="w-8 h-8"></div>
              }
              const dayKey = getDateKey(new Date(displayYear, displayMonth, day))
              const isStartDate = value && dayKey === value
              const isEndDate = isRange && endValue && dayKey === endValue
              const rangeStart = value < endValue ? value : endValue
              const rangeEnd = value < endValue ? endValue : value
              const isInRange = isRange && dayKey > rangeStart && dayKey < rangeEnd
              const isSelected = isStartDate || isEndDate
              const isToday = new Date().getDate() === day && new Date().getMonth() === displayMonth && new Date().getFullYear() === displayYear
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDate(day)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 
                    ${isSelected 
                      ? 'bg-primary text-primary-foreground font-bold shadow-[0_0_10px_rgba(212,175,55,0.5)]' 
                      : isInRange
                        ? 'bg-primary/20 text-primary'
                      : isToday
                        ? 'bg-white/10 text-primary font-bold border border-primary/50'
                        : 'hover:bg-white/10 text-foreground/80 hover:text-foreground'
                    }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          {isRange && (
            <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3">
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs leading-relaxed text-foreground/55">
                <span className={rangeSelectionStep === 'from' ? 'font-semibold text-primary' : ''}>Dari</span>
                <span>{formatDateLabel(value)}</span>
                <span className={rangeSelectionStep === 'to' ? 'font-semibold text-primary' : ''}>Ke</span>
                <span>{rangeSelectionStep === 'to' ? 'Pilih tanggal' : formatDateLabel(endValue)}</span>
              </div>
              <button
                type="button"
                onClick={handleCurrentMonth}
                className="glass-input flex h-10 w-full items-center justify-center gap-2 px-4 text-sm font-medium transition-colors hover:bg-white/10 focus:outline-none"
              >
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                Bulan Ini
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
