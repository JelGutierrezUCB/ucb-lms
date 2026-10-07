import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { MyJourneysContent } from '@/components/learning/MyJourneysContent'
import { getProxyTarget } from '@/lib/proxy'

export const dynamic = 'force-dynamic'

export default async function LearningPathsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const proxyTarget = await getProxyTarget(user.id, profile?.role)
  const effectiveUserId = proxyTarget?.id ?? user.id

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={proxyTarget ? `${proxyTarget.full_name}'s Learning Journeys` : 'My Learning Journeys'} />
      <main className="flex-1 p-4 sm:p-6">
        <MyJourneysContent userId={effectiveUserId} />
      </main>
    </div>
  )
}
