'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Profile } from '@/types'

const STORAGE_KEY = 'ucb_proxy_user'

interface ProxyContextType {
  proxyUser: Profile | null
  startProxy: (employee: Profile) => void
  endProxy: () => void
  effectiveUserId: string | null
}

const ProxyContext = createContext<ProxyContextType>({
  proxyUser: null,
  startProxy: () => {},
  endProxy: () => {},
  effectiveUserId: null,
})

export function ProxyProvider({ children, currentUserId }: { children: React.ReactNode; currentUserId: string | null }) {
  const [proxyUser, setProxyUser] = useState<Profile | null>(null)

  // Restore proxy from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) setProxyUser(JSON.parse(stored))
    } catch {}
  }, [])

  const startProxy = useCallback((employee: Profile) => {
    setProxyUser(employee)
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(employee)) } catch {}
  }, [])

  const endProxy = useCallback(() => {
    setProxyUser(null)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  const effectiveUserId = proxyUser?.id ?? currentUserId

  return (
    <ProxyContext.Provider value={{ proxyUser, startProxy, endProxy, effectiveUserId }}>
      {children}
    </ProxyContext.Provider>
  )
}

export function useProxy() {
  return useContext(ProxyContext)
}
