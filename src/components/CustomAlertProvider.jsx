'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

const AlertContext = createContext({
  showAlert: () => {}
})

export const useAlert = () => useContext(AlertContext)

export function CustomAlertProvider({ children }) {
  const [alert, setAlert] = useState(null)

  const showAlert = (message, type = 'success') => {
    const id = Date.now()
    setAlert({ message: String(message), type, id })
  }

  // Override window.alert globally and handle auto-hide
  useEffect(() => {
    const originalAlert = window.alert
    window.alert = (msg) => {
      const lower = String(msg).toLowerCase()
      const isError = lower.includes('gagal') || lower.includes('error') || lower.includes('kesalahan') || lower.includes('invalid')
      showAlert(msg, isError ? 'error' : 'success')
    }

    return () => {
      window.alert = originalAlert
    }
  }, [])

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(prev => prev?.id === alert.id ? null : prev)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [alert])

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      
      {alert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-4 duration-300 w-full max-w-sm px-4 pointer-events-none">
          <div className={`
            pointer-events-auto glass-card p-4 rounded-xl flex items-start gap-3 shadow-2xl backdrop-blur-md
            ${alert.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}
          `}>
            <div className="shrink-0 mt-0.5">
              {alert.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 text-sm font-medium leading-tight pt-1 break-words">
              {alert.message}
            </div>

            <button 
              onClick={() => setAlert(null)}
              className={`shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors ${alert.type === 'success' ? 'text-green-500/60 hover:text-green-400' : 'text-red-500/60 hover:text-red-400'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  )
}

