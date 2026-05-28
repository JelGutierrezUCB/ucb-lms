import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: 'UCB Training Portal',
  description: 'UCB Learning Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
