'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProxy } from '@/contexts/ProxyContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { getRoleLabel } from '@/lib/utils'

export function Header({ title }: { title?: string }) {
  const { profile, signOut } = useAuth()
  const { proxyUser, endProxy } = useProxy()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
      <div>
        {title && <h1 className="text-lg font-semibold text-slate-900">{title}</h1>}
      </div>

      <div className="flex items-center gap-3">
        {/* Proxy indicator */}
        {proxyUser && (
          <div className="flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-amber-700 font-medium">Training as: {proxyUser.full_name}</span>
            <button
              onClick={() => { endProxy(); router.push('/training') }}
              className="ml-1 text-amber-600 hover:text-amber-800 font-semibold text-xs underline"
            >
              End Session
            </button>
          </div>
        )}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 text-white text-sm font-bold">
                {profile?.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
                <p className="text-xs text-slate-500">{getRoleLabel(profile?.role ?? '')}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
