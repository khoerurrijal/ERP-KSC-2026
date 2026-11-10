'use client'

import { createContext, useContext, useMemo } from 'react'

const RoleAccessContext = createContext(null)

export function RoleAccessProvider({ permissions = [], children }) {
  const value = useMemo(() => {
    const permissionSet = new Set(permissions)
    return {
      canAccess: (permission) => permissionSet.has(permission),
      anyAccess: (items) => items.some((permission) => permissionSet.has(permission)),
    }
  }, [permissions])

  return <RoleAccessContext.Provider value={value}>{children}</RoleAccessContext.Provider>
}

export function useRoleAccess() {
  const context = useContext(RoleAccessContext)
  return context || {
    canAccess: () => true,
    anyAccess: () => true,
  }
}
