'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { VIEW_COOKIE, type PortalView } from '@/lib/view-shared'

interface ViewContextType {
  view: PortalView
  // Only admins and managers can switch; employees are always in the learner view.
  canSwitch: boolean
  setView: (view: PortalView) => void
}

// Pages that belong to the admin / manager console.
const ADMIN_ONLY_PREFIXES = ['/admin', '/manager', '/reports', '/certificates', '/training-generator']

const ViewContext = createContext<ViewContextType>({ view: 'learner', canSwitch: false, setView: () => {} })

export function ViewProvider({ initialView, children }: { initialView: PortalView; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { profile } = useAuth()
  const [view, setViewState] = useState<PortalView>(initialView)

  // The server decides the view from the cookie; follow it after a refresh.
  useEffect(() => setViewState(initialView), [initialView])

  const canSwitch = profile?.role === 'admin' || profile?.role === 'manager'

  // Opening an admin-console page directly (a bookmark, a notification link)
  // while in the learner view moves you to the admin view, so the navigation
  // always matches the page. Only reacts to page changes, so switching views
  // isn't undone before the navigation finishes.
  useEffect(() => {
    if (canSwitch && ADMIN_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      document.cookie = `${VIEW_COOKIE}=admin; path=/; max-age=31536000; samesite=lax`
      setViewState('admin')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const setView = (next: PortalView) => {
    if (!canSwitch || next === view) return
    document.cookie = `${VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    setViewState(next)
    const home = next === 'learner' ? '/dashboard' : profile?.role === 'admin' ? '/admin' : '/manager'
    router.push(home)
    router.refresh()
  }

  return <ViewContext.Provider value={{ view, canSwitch, setView }}>{children}</ViewContext.Provider>
}

export function useView() {
  return useContext(ViewContext)
}
