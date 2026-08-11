import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { NotificationHistory } from '@/components/layout/NotificationHistory'
import type { Notification } from '@/types'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200) as { data: Notification[] | null }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Notifications" />
      <main className="flex-1 p-6">
        <NotificationHistory initialNotifications={notifications ?? []} />
      </main>
    </div>
  )
}
