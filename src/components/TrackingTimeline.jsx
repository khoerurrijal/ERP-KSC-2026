'use client'

import React from 'react'
import { PackageOpen, Clock, Settings, Truck, CreditCard, CheckCircle } from 'lucide-react'

const STATUS_STEPS = [
  { key: 'BARU MASUK', label: 'Baru Masuk', icon: PackageOpen },
  { key: 'SIAP PROSES', label: 'Siap Proses', icon: Clock },
  { key: 'PROSES', label: 'Diproses', icon: Settings },
  { key: 'SIAP KIRIM', label: 'Menunggu Lunas', icon: CreditCard }, // Visual Only
  { key: 'SIAP KIRIM_ACTUAL', label: 'Siap Kirim', icon: PackageOpen }, // Kita gunakan key beda untuk bedakan
  { key: 'DIKIRIM', label: 'Dikirim', icon: Truck }, 
  { key: 'SELESAI', label: 'Selesai', icon: CheckCircle }
]

export default function TrackingTimeline({ 
  currentStatus, 
  paymentStatus,
  targetDate
}) {
  const status = (currentStatus || 'BARU MASUK').toUpperCase()
  
  const getStepState = (stepKey, stepLabel) => {
    if (stepLabel === 'Menunggu Lunas') {
      if (paymentStatus === 'LUNAS') return 'passed'
      else {
        if (['SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL'].includes(status)) return 'active-blinking'
        if (status === 'SELESAI') return 'passed'
        return 'future'
      }
    }

    const statusOrder = ['BARU MASUK', 'SIAP PROSES', 'PROSES', 'SUDAH JADI', 'SIAP KIRIM', 'DIKIRIM', 'SUDAH DIAMBIL', 'SELESAI']
    let currentIdx = statusOrder.indexOf(status)
    if (currentIdx === -1) currentIdx = 0 
    
    // Normalisasi target index
    let actualStepKey = stepKey === 'SIAP KIRIM_ACTUAL' ? 'SIAP KIRIM' : stepKey
    let targetIdx = statusOrder.indexOf(actualStepKey)
    if (actualStepKey === 'DIKIRIM') {
      targetIdx = Math.max(statusOrder.indexOf('DIKIRIM'), statusOrder.indexOf('SUDAH DIAMBIL'))
    }

    if (currentIdx > targetIdx) return 'passed'
    if (currentIdx === targetIdx) {
       if (status === 'SUDAH DIAMBIL' && actualStepKey === 'DIKIRIM') return 'active'
       if (status === actualStepKey) return 'active'
       return 'passed'
    }
    return 'future'
  }

  return (
    <div className="w-full py-8 relative">
      <div className="flex items-center justify-between w-full">
        {STATUS_STEPS.map((step, idx) => {
          const state = getStepState(step.key, step.label)
          
          let iconColor = 'text-white/20'
          let bgColor = 'bg-white/5 border-white/10'
          let glow = ''

          if (state === 'passed') {
            iconColor = 'text-purple-400'
            bgColor = 'bg-purple-500/20 border-purple-500/50'
          } else if (state === 'active') {
            iconColor = 'text-white'
            bgColor = 'bg-purple-500 border-purple-400'
            glow = 'shadow-[0_0_15px_rgba(168,85,247,0.6)] animate-[pulse_2s_ease-in-out_infinite]'
          } else if (state === 'active-blinking') {
            iconColor = 'text-yellow-400'
            bgColor = 'bg-yellow-500/20 border-yellow-500'
            glow = 'shadow-[0_0_15px_rgba(234,179,8,0.6)] animate-[pulse_1s_ease-in-out_infinite]'
          }

          // Tentukan apakah garis penghubung ke node BERIKUTNYA menyala
          let lineProgress = '0%'
          if (idx < STATUS_STEPS.length - 1) {
             const nextStep = STATUS_STEPS[idx+1]
             const nextState = getStepState(nextStep.key, nextStep.label)
             if (state === 'passed' || state === 'active' || state === 'active-blinking') {
               if (nextState === 'passed' || nextState === 'active' || nextState === 'active-blinking') {
                 lineProgress = '100%'
               } else if (state === 'active') {
                 lineProgress = '50%' // Animasi nanggung kalau sedang diproses
               }
             }
          }

          return (
            <React.Fragment key={idx}>
              {/* Node */}
              <div className="flex flex-col items-center relative z-10">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${bgColor} ${glow}`}>
                  <step.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${iconColor}`} />
                </div>

                {/* Label ditaruh absolut di bawah agar tidak merusak flex */}
                <div className="absolute top-10 text-center w-20 sm:w-24">
                  <p className={`text-[9px] sm:text-[10px] font-bold transition-colors ${state === 'future' ? 'text-white/40' : state === 'active-blinking' ? 'text-yellow-400' : 'text-white/80'}`}>
                    {step.label}
                  </p>
                  {step.label === 'Siap Kirim' && targetDate && state !== 'future' && (
                    <p className="text-[8px] sm:text-[9px] text-white/40 mt-0.5 whitespace-nowrap">
                      Est: {new Date(targetDate).toLocaleDateString('id-ID')}
                    </p>
                  )}
                </div>
              </div>

              {/* Garis Penghubung (Flex 1) */}
              {idx < STATUS_STEPS.length - 1 && (
                <div className="flex-1 h-[2px] bg-white/5 relative mx-1 sm:mx-2 overflow-hidden rounded-full">
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-1000 ease-out"
                    style={{ width: lineProgress }}
                  />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
