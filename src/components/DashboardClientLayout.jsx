'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default function DashboardClientLayout({ allowedMenus, userRole, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col md:flex-row">
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 w-[min(16rem,calc(100vw-1.5rem))] print:hidden
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar 
          allowedMenus={allowedMenus} 
          userRole={userRole} 
          onCloseMobile={() => setIsSidebarOpen(false)} 
        />
      </div>

      {/* Main Content Area (Includes Topbar and Children) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative overflow-x-hidden print:min-h-0">
        
        {/* Topbar */}
        <div className="print:hidden w-full">
          <Topbar userRole={userRole} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        </div>

        {/* Main Content Scrollable Area */}
        <main className="flex-1 relative p-3 sm:p-4 md:p-6 print:p-0 print:m-0 print:w-full print:max-w-none">
          {/* Background decorations for main area */}
          <div className="fixed top-[-5%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px] pointer-events-none print:hidden" />
          <div className="fixed bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[150px] pointer-events-none print:hidden" />
          
          <div className="dashboard-content relative z-10 max-w-[1500px] mx-auto pb-8 sm:pb-12 print:pb-0 print:m-0 print:w-full print:max-w-none">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
