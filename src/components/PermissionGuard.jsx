'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { accessRouteForPath } from '@/utils/role-access'
import { RoleAccessProvider } from '@/components/RoleAccessContext'

export default function PermissionGuard({ allowedPermissions = [], userRole, children }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isOperatorRole = ['Operator', 'Operator Mesin'].includes(userRole)
  const route = accessRouteForPath(pathname)
  const queryTab = route?.tabParam
    ? searchParams.get(route.tabParam) || route.defaultTab
    : null
  const tabPermission = queryTab && route?.tabs ? route.tabs[queryTab] : null
  const routePermissions = route?.permissions || (route?.tabs ? Object.values(route.tabs) : [])
  const hasAnyRoutePermission = routePermissions.some((permission) => allowedPermissions.includes(permission))
  const hasSelectedTabPermission = route?.mode === 'local'
    || !route?.tabParam
    || (Boolean(tabPermission) && allowedPermissions.includes(tabPermission))
  const hasRouteAccess = !route || (hasAnyRoutePermission && hasSelectedTabPermission)

  useEffect(() => {
    if (pathname === '/dashboard' && isOperatorRole) {
      router.replace('/production')
      return
    }

    if (!route?.tabParam || !hasAnyRoutePermission) return

    const requestedTab = searchParams.get(route.tabParam) || route.defaultTab
    if (route.tabs[requestedTab] && allowedPermissions.includes(route.tabs[requestedTab])) return

    const fallbackTab = Object.entries(route.tabs).find(([, permission]) => allowedPermissions.includes(permission))?.[0]
    if (!fallbackTab) return

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set(route.tabParam, fallbackTab)
    router.replace(`${pathname}?${nextParams.toString()}`)
  }, [allowedPermissions, hasAnyRoutePermission, isOperatorRole, pathname, route, router, searchParams])

  if (pathname === '/dashboard' && isOperatorRole) return null

  if (!hasRouteAccess) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
          <ShieldAlert className="h-10 w-10 text-red-500" />
        </div>
        <h1 className="mb-2 text-3xl font-black tracking-tight text-foreground">Akses Ditolak</h1>
        <p className="mx-auto max-w-md text-foreground/60">
          Akun Anda ({userRole}) tidak memiliki akses ke halaman atau tab ini. Hubungi Owner atau Admin jika perlu akses.
        </p>
      </div>
    )
  }

  return (
    <RoleAccessProvider permissions={allowedPermissions}>
      {children}
    </RoleAccessProvider>
  )
}
