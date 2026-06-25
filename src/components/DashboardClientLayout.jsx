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
        md:relative md:translate-x-0 w-64
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar 
          allowedMenus={allowedMenus} 
          userRole={userRole} 
          onCloseMobile={() => setIsSidebarOpen(false)} 
        />
      </div>

      {/* Main Content Area (Includes Topbar and Children) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative overflow-x-hidden">
        
        {/* Topbar */}
        <Topbar userRole={userRole} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

        {/* Main Content Scrollable Area */}
        <main className="flex-1 relative p-4 md:p-8">
          {/* Background decorations for main area */}
          <div className="fixed top-[-5%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
          <div className="fixed bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[150px] pointer-events-none" />
          
          <div className="relative z-10 max-w-6xl mx-auto pb-20">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
