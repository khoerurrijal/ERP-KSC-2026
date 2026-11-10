'use client'

import { useEffect, useRef, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default function DashboardClientLayout({ allowedMenus, userRole, userName = '', children }) {
  const lightweight = !['Owner', 'Admin'].includes(userRole)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const liquidGlassRootRef = useRef(null)

  useEffect(() => {
    if (!lightweight) return undefined
    const root = document.documentElement
    const lightStyles = {
      'color-scheme': 'light',
      '--background': '#f8f7f4',
      '--foreground': '#1c1917',
      '--primary': '#755615',
      '--primary-foreground': '#ffffff',
      '--surface': '#ffffff',
      '--surface-raised': '#ffffff',
      '--surface-muted': '#f5f5f4',
      '--surface-hover': '#f1f0ec',
      '--muted': '#78716c',
      '--border': '#e7e5e4',
      '--card': '#ffffff',
      '--card-border': '#e7e5e4',
      '--scroll-track': '#f5f5f4',
      '--scroll-thumb': '#d6d3d1',
      '--scroll-thumb-hover': '#a8a29e',
    }
    const previousStyles = Object.fromEntries(Object.keys(lightStyles).map(property => [
      property,
      { value: root.style.getPropertyValue(property), priority: root.style.getPropertyPriority(property) },
    ]))

    Object.entries(lightStyles).forEach(([property, value]) => root.style.setProperty(property, value))
    return () => Object.entries(previousStyles).forEach(([property, previous]) => {
      if (previous.value) root.style.setProperty(property, previous.value, previous.priority)
      else root.style.removeProperty(property)
    })
  }, [lightweight])

  return (
    <div className={lightweight ? 'employee-light min-h-screen bg-[#f8f7f4] text-stone-900' : 'relative flex h-screen flex-col overflow-hidden bg-transparent text-foreground print:h-auto print:overflow-visible'}>
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className={`fixed inset-0 z-40 md:hidden ${lightweight ? 'bg-stone-900/20' : 'bg-black/60 backdrop-blur-sm animate-in fade-in'}`}
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
          lightweight={lightweight}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(current => !current)}
          onCloseMobile={() => setIsSidebarOpen(false)} 
        />
      </div>

      {/* Main Content Area (Includes Topbar and Children) */}
      <div ref={liquidGlassRootRef} className={lightweight ? `min-h-screen min-w-0 ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}` : `liquid-glass-scene relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto transition-[margin] duration-300 print:ml-0 print:h-auto print:overflow-visible ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>

        {!lightweight && <div className="liquid-glass-underlay" aria-hidden="true" />}

        {/* Topbar stays sticky while the live page content scrolls behind its glass surface. */}
        <Topbar userRole={userRole} userName={userName} lightweight={lightweight} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} liquidGlassRootRef={liquidGlassRootRef} />

        {/* Main content stays in the glass scene so scrolling content is captured behind the topbar. */}
        <main className={lightweight ? 'min-h-[calc(100vh-3.5rem)] overflow-x-hidden bg-[#f8f7f4] px-3 pb-8 pt-3 sm:px-4 sm:pt-4' : 'relative z-10 min-h-0 shrink-0 overflow-x-hidden bg-transparent px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 md:px-5 md:pb-5 md:pt-5 print:relative print:inset-auto print:m-0 print:w-full print:max-w-none print:overflow-visible print:bg-transparent print:p-0'}>
          {/* Background decorations for main area */}
          {!lightweight && <>
            <div className="dashboard-lightweight-decor fixed top-[-5%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px] pointer-events-none print:hidden" />
            <div className="dashboard-lightweight-decor fixed bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[150px] pointer-events-none print:hidden" />
          </>}
          
          <div className="dashboard-content relative z-10 max-w-[1500px] mx-auto pb-6 sm:pb-8 print:pb-0 print:m-0 print:w-full print:max-w-none">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
