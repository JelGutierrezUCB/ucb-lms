import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadUserPaths } from '@/lib/learning-paths'
import { Header } from '@/components/layout/Header'
import { JourneyRoadmap } from '@/components/paths/JourneyRoadmap'
import { Route } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LearningPathsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const journeys = await loadUserPaths(supabase, user.id)
  const active = journeys.filter(j => j.percent < 100)
  const finished = journeys.filter(j => j.percent === 100)

  const stepsLeft = active.reduce((n, j) => n + (j.steps.length - j.completedSteps), 0)
  const minutesLeft = active.reduce((n, j) => n + j.minutesLeft, 0)

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="My Learning Journeys" />
      <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-4xl w-full mx-auto">
        {journeys.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Route className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-slate-700 font-semibold">No learning journeys yet</p>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              A learning journey is a step-by-step sequence of trainings chosen for your role. Once you&apos;re enrolled, it
              will show up here with a clear next step.
            </p>
            <Link href="/training" className="inline-block mt-5 text-sm font-medium text-blue-600 hover:underline">
              Browse the course catalog
            </Link>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <p className="text-sm text-slate-500">
                {active.length} active {active.length === 1 ? 'journey' : 'journeys'} · {stepsLeft} {stepsLeft === 1 ? 'step' : 'steps'} to go
                {minutesLeft > 0 && ` · about ${minutesLeft} min in total`}
              </p>
            )}

            {active.map(j => <JourneyRoadmap key={j.path.id} journey={j} />)}

            {finished.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Completed journeys</h2>
                {finished.map(j => <JourneyRoadmap key={j.path.id} journey={j} />)}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
