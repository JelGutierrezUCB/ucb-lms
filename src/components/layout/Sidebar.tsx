'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FolderOpen,
  Sparkles,
  UserCheck,
  GraduationCap,
  BarChart3,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { FeedbackDialog } from './FeedbackDialog'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['admin', 'manager', 'employee'],
  },
  {
    href: '/training',
    label: 'My Training',
    icon: <BookOpen className="h-5 w-5" />,
    roles: ['admin', 'manager', 'employee'],
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: <Users className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    href: '/admin/modules',
    label: 'Training Modules',
    icon: <FolderOpen className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    href: '/training-generator',
    label: 'AI Generator',
    icon: <Sparkles className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    roles: ['admin', 'manager'],
  },
  {
    href: '/manager/employees',
    label: 'My Employees',
    icon: <UserCheck className="h-5 w-5" />,
    roles: ['admin', 'manager'],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  if (!profile) return null

  const visibleItems = navItems.filter(item => item.roles.includes(profile.role))

  return (
    <div className="flex flex-col h-full w-64 bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">UCB Training</p>
          <p className="text-xs text-slate-400">Learning Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <MessageSquare className="h-5 w-5" />
          Tell Us What You Think
        </button>
      </nav>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      {/* User info at bottom */}
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold shrink-0">
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
