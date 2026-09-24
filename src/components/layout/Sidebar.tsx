'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  History,
  Route,
  Layers,
  Users,
  FolderOpen,
  Sparkles,
  UserCheck,
  GraduationCap,
  BarChart3,
  Award,
  ClipboardCheck,
  Settings2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useMobileNav } from '@/contexts/MobileNavContext'
import { useView } from '@/contexts/ViewContext'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  // Which account types see this item (learner items are for everyone)
  roles: string[]
  // Match the exact path only (dashboards, whose paths are prefixes of others)
  exact?: boolean
}

// Learner view: everything a person needs to do their own training. Same for
// every account type.
const learnerItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['admin', 'manager', 'employee'], exact: true },
  { href: '/training', label: 'My Training', icon: <BookOpen className="h-5 w-5" />, roles: ['admin', 'manager', 'employee'] },
  { href: '/paths', label: 'Learning Journeys', icon: <Route className="h-5 w-5" />, roles: ['admin', 'manager', 'employee'] },
  { href: '/training-history', label: 'My History', icon: <History className="h-5 w-5" />, roles: ['admin', 'manager', 'employee'] },
]

// Admin / manager view: managing people, courses, journeys and reporting.
const adminItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['admin'], exact: true },
  { href: '/manager', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['manager'], exact: true },
  { href: '/admin/users', label: 'Users', icon: <Users className="h-5 w-5" />, roles: ['admin'] },
  { href: '/manager/employees', label: 'My Employees', icon: <UserCheck className="h-5 w-5" />, roles: ['manager'] },
  { href: '/admin/modules', label: 'Training Modules', icon: <FolderOpen className="h-5 w-5" />, roles: ['admin'] },
  // Journey Builder and Assignment Rules, as tabs of one section
  { href: '/admin/learning', label: 'Learning Management', icon: <Layers className="h-5 w-5" />, roles: ['admin'] },
  { href: '/training-generator', label: 'AI Generator', icon: <Sparkles className="h-5 w-5" />, roles: ['admin'] },
  { href: '/reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" />, roles: ['admin', 'manager'] },
  { href: '/certificates', label: 'Certificates', icon: <Award className="h-5 w-5" />, roles: ['admin', 'manager'] },
  { href: '/training-history?tab=courses', label: 'Course Completions', icon: <ClipboardCheck className="h-5 w-5" />, roles: ['admin', 'manager'] },
]

function SidebarBody() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const { view, canSwitch, setView } = useView()

  if (!profile) return null

  const learnerView = view === 'learner'
  const items = learnerView ? learnerItems : adminItems.filter(item => item.roles.includes(profile.role))
  const consoleName = profile.role === 'admin' ? 'Admin' : 'Manager'

  const isActive = (item: NavItem) => {
    const base = item.href.split('?')[0]
    return item.exact ? pathname === base : pathname === base || pathname.startsWith(base + '/')
  }

  return (
    <div className="flex flex-col h-full w-64 bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', learnerView ? 'bg-blue-600' : 'bg-violet-600')}>
          {learnerView ? <GraduationCap className="h-5 w-5 text-white" /> : <Settings2 className="h-5 w-5 text-white" />}
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">UCB Training</p>
          <p className="text-xs text-slate-400">{learnerView ? 'Learning Portal' : `${consoleName} Console`}</p>
        </div>
      </div>

      {/* View switcher: admins and managers can move between their console and the learner view */}
      {canSwitch && (
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-800 p-1 text-xs font-semibold" role="group" aria-label="Switch view">
            {([['admin', consoleName], ['learner', 'Learner']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={cn(
                  'rounded-md px-2 py-1.5 transition-colors',
                  view === key
                    ? key === 'admin' ? 'bg-violet-600 text-white' : 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive(item)
                ? learnerView ? 'bg-blue-600 text-white' : 'bg-violet-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User info at bottom */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0', learnerView ? 'bg-blue-600' : 'bg-violet-600')}>
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{profile.role}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const { open, setOpen } = useMobileNav()

  // Any navigation (a link tap inside the drawer, or the browser back button)
  // closes the drawer so it never covers the page you just went to.
  useEffect(() => {
    setOpen(false)
  }, [pathname, setOpen])

  if (!profile) return null

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:block h-full shrink-0">
        <SidebarBody />
      </aside>

      {/* Mobile / tablet: slide-over drawer, opened from the Header hamburger */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative h-full max-w-[85vw]">
            <SidebarBody />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
