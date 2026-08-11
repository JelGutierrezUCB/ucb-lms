'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { timeAgo, cn } from '@/lib/utils'
import type { Notification } from '@/types'

export function NotificationHistory({ initialNotifications }: { initialNotifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const supabase = createClient()
  const router = useRouter()

  const unreadCount = notifications.filter(n => !n.read).length

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
  }

  const handleClick = (n: Notification) => {
    if (!n.read) markRead(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-600">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          {unreadCount > 0 && <span className="text-blue-600 font-medium"> · {unreadCount} unread</span>}
        </p>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <Card>
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No notifications yet</p>
            <p className="text-slate-400 text-sm mt-1">You'll see training assignments and reminders here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors',
                  !n.read && 'bg-blue-50/50'
                )}
              >
                <div className="flex items-start gap-3">
                  {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                  <div className={cn('min-w-0 flex-1', n.read && 'pl-5')}>
                    <p className="font-medium text-slate-800">{n.title}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
