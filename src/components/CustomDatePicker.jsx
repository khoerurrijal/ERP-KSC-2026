'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export default function CustomDatePicker({ value, onChange, className = "" }) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef(null)
  const menuRef = useRef(null)
  const [menuStyle, setMenuStyle] = useState(null)
  
  // Parse initial value or use current date
  const initialDate = value ? new Date(value) : new Date()
  const [displayYear, setDisplayYear] = useState(initialDate.getFullYear())
  const [displayMonth, setDisplayMonth] = useState(initialDate.getMonth())

  useEffect(() => {
    if (value) {
      const d = new Date(value)
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

      const width = Math.min(288, Math.max(240, window.innerWidth - 24))
      const estimatedHeight = 340
      const opensAbove = anchor.bottom + estimatedHeight > window.innerHeight && anchor.top > estimatedHeight
      const left = Math.min(Math.max(12, anchor.left), window.innerWidth - width - 12)

      setMenuStyle({
        position: 'fixed',
        left,
        top: opensAbove ? anchor.top - 8 : anchor.bottom + 8,
        width,
        zIndex: 1100,
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
  }, [isOpen])

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
    const newDate = new Date(displayYear, displayMonth, day)
    const year = newDate.getFullYear()
    const month = String(newDate.getMonth() + 1).padStart(2, '0')
    const dateStr = String(newDate.getDate()).padStart(2, '0')
    const formatted = `${year}-${month}-${dateStr}`
    
    onChange(formatted)
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
    if (!value) return 'Pilih Tanggal'
    const d = new Date(value)
    if (isNaN(d.getTime())) return 'Pilih Tanggal'
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="glass-input h-10 px-4 w-full flex items-center justify-between gap-2 text-sm font-medium hover:bg-white/10 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{getDisplayLabel()}</span>
        </div>
      </button>

      {isOpen && menuStyle && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} style={menuStyle} className="p-4 bg-[#18181B] rounded-xl shadow-2xl border border-white/10 z-[1100] animate-in fade-in zoom-in-95 duration-200">
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
              const isSelected = value && new Date(value).getDate() === day && new Date(value).getMonth() === displayMonth && new Date(value).getFullYear() === displayYear
              const isToday = new Date().getDate() === day && new Date().getMonth() === displayMonth && new Date().getFullYear() === displayYear
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDate(day)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 
                    ${isSelected 
                      ? 'bg-primary text-primary-foreground font-bold shadow-[0_0_10px_rgba(212,175,55,0.5)]' 
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
        </div>,
        document.body
      )}
    </div>
  )
}
