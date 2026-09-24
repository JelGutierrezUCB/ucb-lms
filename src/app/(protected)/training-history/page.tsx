import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { PersonalHistoryContent } from '@/components/training/PersonalHistoryContent'
import { CourseCompletionsContent } from '@/components/training/CourseCompletionsContent'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Training History. Everyone sees their own history. Admins and managers also
// get "Course completions": for each course, who has completed it and how many
// (admins: everyone; managers: their own team).
export default async function TrainingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role as 'admin' | 'manager' | 'employee' | undefined
  const canSeeOthers = role === 'admin' || role === 'manager'

  const { tab } = await searchParams
  const active: 'courses' | 'mine' = canSeeOthers && tab !== 'mine' ? 'courses' : 'mine'

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Training History" />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        {canSeeOthers && (
          <nav aria-label="Training history sections" className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-1">
              {([
                ['courses', 'Course completions', GraduationCap],
                ['mine', 'My history', History],
              ] as const).map(([key, label, Icon]) => (
                <li key={key}>
                  <Link
                    href={`/training-history?tab=${key}`}
                    aria-current={active === key ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                      active === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {active === 'courses' && canSeeOthers ? (
          <CourseCompletionsContent viewerId={user.id} role={role as 'admin' | 'manager'} />
        ) : (
          <PersonalHistoryContent userId={user.id} />
        )}
      </main>
    </div>
  )
}
