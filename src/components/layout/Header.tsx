'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, ChevronDown, UserCog, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useProxy } from '@/contexts/ProxyContext'
import { useMobileNav } from '@/contexts/MobileNavContext'
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
import { NotificationBell } from './NotificationBell'

export function Header({ title }: { title?: string }) {
  const { profile, signOut } = useAuth()
  const { proxyUser, endProxy } = useProxy()
  const router = useRouter()
  const { setOpen: setMobileNavOpen } = useMobileNav()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="lg:hidden shrink-0 rounded-lg p-2 -ml-2 text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {title && <h1 className="text-lg font-semibold text-slate-900 truncate">{title}</h1>}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

        {profile && <NotificationBell userId={profile.id} />}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 text-white text-sm font-bold overflow-hidden shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
                ) : (
                  profile?.full_name.charAt(0).toUpperCase()
                )}
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
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center cursor-pointer">
                <UserCog className="h-4 w-4 mr-2" />
                Profile Settings
              </Link>
            </DropdownMenuItem>
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
