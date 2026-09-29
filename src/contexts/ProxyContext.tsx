'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Profile } from '@/types'
import { PROXY_COOKIE } from '@/lib/proxy-shared'

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

  // sessionStorage drives the client-side banner instantly; the cookie is what
  // lets server-rendered pages (which can't read sessionStorage) pick up the
  // same proxy target on their next request.
  const startProxy = useCallback((employee: Profile) => {
    setProxyUser(employee)
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(employee)) } catch {}
    try { document.cookie = `${PROXY_COOKIE}=${employee.id}; path=/; max-age=86400; samesite=lax` } catch {}
  }, [])

  const endProxy = useCallback(() => {
    setProxyUser(null)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
    try { document.cookie = `${PROXY_COOKIE}=; path=/; max-age=0; samesite=lax` } catch {}
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
