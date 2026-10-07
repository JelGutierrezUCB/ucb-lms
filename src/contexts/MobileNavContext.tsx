'use client'

import { createContext, useContext, useState } from 'react'

// Open/closed state for the slide-over navigation used below the `lg`
// breakpoint. The Header renders the hamburger button, the Sidebar renders
// the drawer — this is the shared switch between them.
interface MobileNavContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const MobileNavContext = createContext<MobileNavContextType>({
  open: false,
  setOpen: () => {},
})

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <MobileNavContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileNavContext.Provider>
  )
}

export function useMobileNav() {
  return useContext(MobileNavContext)
}
