import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { MyJourneysContent } from '@/components/learning/MyJourneysContent'

export const dynamic = 'force-dynamic'

export default async function LearningPathsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="My Learning Journeys" />
      <main className="flex-1 p-4 sm:p-6">
        <MyJourneysContent userId={user.id} />
      </main>
    </div>
  )
}
