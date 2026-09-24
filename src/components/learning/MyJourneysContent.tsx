import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadUserPaths } from '@/lib/learning-paths'
import { JourneyRoadmap } from '@/components/paths/JourneyRoadmap'
import { Route } from 'lucide-react'

// The signed-in person's own learning journeys, drawn as road roadmaps.
// Used on the learner page (/paths) and as a tab in Learning Management.
export async function MyJourneysContent({ userId }: { userId: string }) {
  const supabase = await createClient()

  const journeys = await loadUserPaths(supabase, userId)
  const active = journeys.filter(j => j.percent < 100)
  const finished = journeys.filter(j => j.percent === 100)

  const stepsLeft = active.reduce((n, j) => n + (j.steps.length - j.completedSteps), 0)
  const minutesLeft = active.reduce((n, j) => n + j.minutesLeft, 0)

  if (journeys.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
          <Route className="h-8 w-8 text-blue-600" />
        </div>
        <p className="font-semibold text-slate-700">No learning journeys yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
          A learning journey is a step-by-step sequence of trainings chosen for your role. Once you&apos;re enrolled, it
          will show up here with a clear next step.
        </p>
        <Link href="/training" className="mt-5 inline-block text-sm font-medium text-blue-600 hover:underline">
          Browse the course catalog
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
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
    </div>
  )
}
