import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { getPortalView } from '@/lib/view'
import { getProxyTarget } from '@/lib/proxy'
import { getDict } from '@/lib/i18n/get-locale'
import { loadRecommendations } from '@/lib/recommendations'
import { LearnNextView } from '@/components/training/LearnNextView'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function LearnNextPage() {
  const t = await getDict()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single() as { data: Profile | null }
  if (!profile) redirect('/login')

  // Admin/manager viewing someone else's portal sees that person's picks.
  const proxyTarget = await getProxyTarget(user.id, profile.role)
  const effectiveUserId = proxyTarget?.id ?? user.id
  const effectiveJobRoleId = proxyTarget ? (proxyTarget.job_role_id ?? null) : (profile.job_role_id ?? null)

  if (!proxyTarget && (await getPortalView(profile.role)) === 'admin') {
    if (profile.role === 'admin') redirect('/admin')
    if (profile.role === 'manager') redirect('/manager')
  }

  const { items, jobRoleName, skillGapCount } = await loadRecommendations(supabase, effectiveUserId, effectiveJobRoleId)

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={t.learnNext.title} />
      <main className="flex-1 p-4 sm:p-6 space-y-4">
        <p className="text-sm text-slate-500">{t.learnNext.subtitle}</p>
        <LearnNextView
          userId={effectiveUserId}
          items={items}
          jobRoleName={jobRoleName}
          skillGapCount={skillGapCount}
          t={t}
        />
      </main>
    </div>
  )
}
