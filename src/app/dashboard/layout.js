import Sidebar from '@/components/Sidebar'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 relative min-h-screen overflow-x-hidden">
        {/* Background decorations for main area */}
        <div className="fixed top-[-5%] left-[20%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="relative z-10 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
