'use client'

import { useRef, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default function DashboardClientLayout({ allowedMenus, userRole, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const liquidGlassRootRef = useRef(null)

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-transparent text-foreground print:h-auto print:overflow-visible">
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[min(16rem,calc(100vw-1.5rem))] transform transition-transform duration-300 ease-in-out print:hidden md:transition-[width] md:duration-300
        ${isSidebarCollapsed ? 'md:w-16' : 'md:w-64'}
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>
        <Sidebar 
          allowedMenus={allowedMenus} 
          userRole={userRole} 
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(current => !current)}
          onCloseMobile={() => setIsSidebarOpen(false)} 
        />
      </div>

      {/* Main Content Area (Includes Topbar and Children) */}
      <div ref={liquidGlassRootRef} className={`liquid-glass-scene relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto transition-[margin] duration-300 print:ml-0 print:h-auto print:overflow-visible ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>

        <div className="liquid-glass-underlay" aria-hidden="true" />

        {/* Topbar stays sticky while the live page content scrolls behind its glass surface. */}
        <Topbar userRole={userRole} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} liquidGlassRootRef={liquidGlassRootRef} />

        {/* Main content stays in the glass scene so scrolling content is captured behind the topbar. */}
        <main className="relative z-10 min-h-0 shrink-0 overflow-x-hidden bg-transparent px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 md:px-5 md:pb-5 md:pt-5 print:relative print:inset-auto print:m-0 print:w-full print:max-w-none print:overflow-visible print:bg-transparent print:p-0">
          {/* Background decorations for main area */}
          <div className="dashboard-lightweight-decor fixed top-[-5%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px] pointer-events-none print:hidden" />
          <div className="dashboard-lightweight-decor fixed bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[150px] pointer-events-none print:hidden" />
          
          <div className="dashboard-content relative z-10 max-w-[1500px] mx-auto pb-6 sm:pb-8 print:pb-0 print:m-0 print:w-full print:max-w-none">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
