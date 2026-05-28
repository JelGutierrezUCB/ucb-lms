'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1rem',
          color: '#0f172a',
          fontSize: '0.875rem',
          fontWeight: '500',
        },
      }}
    />
  )
}
