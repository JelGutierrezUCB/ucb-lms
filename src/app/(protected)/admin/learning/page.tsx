import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { LearningTabs, type LearningTab } from '@/components/learning/LearningTabs'
import { JourneyBuilderContent } from '@/components/learning/JourneyBuilderContent'
import { AssignmentRulesContent } from '@/components/learning/AssignmentRulesContent'

export const dynamic = 'force-dynamic'

// One home for everything about learning journeys and assigning courses:
// build journeys and set assignment rules. (Admins see their own journeys in
// the learner view.)
export default async function LearningManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { tab } = await searchParams
  const active: LearningTab = tab === 'rules' ? 'rules' : 'builder'

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Learning Management" />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <LearningTabs active={active} />
        {active === 'builder' && <JourneyBuilderContent userId={user.id} />}
        {active === 'rules' && <AssignmentRulesContent userId={user.id} />}
      </main>
    </div>
  )
}
