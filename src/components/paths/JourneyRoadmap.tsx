import Link from 'next/link'
import { ArrowRight, Check, Clock, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ProgressRing } from '@/components/ui/progress-ring'
import { cn, formatDate, getCategoryLabel } from '@/lib/utils'
import type { UserPath } from '@/lib/learning-paths'

// One learning journey as a roadmap: a header with overall progress and the
// main "Continue" action, then the steps joined by a line so it's obvious
// what's done, what's next, and what's still ahead.
export function JourneyRoadmap({ journey }: { journey: UserPath }) {
  const { path, steps, percent, completedSteps, dueDate, nextStep, minutesLeft } = journey
  const complete = percent === 100

  return (
    <Card className={cn('overflow-hidden', path.kind === 'onboarding' && !complete && 'border-blue-200 ring-1 ring-blue-100')}>
      <div className="flex items-start gap-4 border-b border-slate-100 p-4 sm:p-6">
        <ProgressRing percent={percent} size={64} stroke={7} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{path.title}</h2>
            {path.kind === 'onboarding' && (
              <Badge className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> New hire onboarding</Badge>
            )}
            {complete && <Badge variant="success">Journey complete</Badge>}
          </div>
          {path.description && <p className="text-sm text-slate-500">{path.description}</p>}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span>{completedSteps} of {steps.length} steps done</span>
            {!complete && minutesLeft > 0 && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> about {minutesLeft} min left</span>
            )}
            {dueDate && !complete && <span>Due {formatDate(dueDate)}</span>}
          </p>
        </div>
        {nextStep && (
          <Link
            href={`/training/${nextStep.module.id}`}
            className="hidden sm:inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {nextStep.percent > 0 ? 'Continue' : 'Start'} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <ol className="p-4 sm:p-6">
        {steps.map((step, i) => {
          const done = step.percent === 100
          const current = nextStep?.module.id === step.module.id
          const last = i === steps.length - 1
          return (
            <li key={step.module.id} className="relative pl-12 pb-5 last:pb-0">
              {!last && (
                <span
                  aria-hidden
                  className={cn('absolute left-[17px] top-9 bottom-0 w-0.5', done ? 'bg-green-400' : 'bg-slate-200')}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  'absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold',
                  done && 'border-green-500 bg-green-500 text-white',
                  current && 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100',
                  !done && !current && 'border-slate-300 bg-white text-slate-400'
                )}
              >
                {done ? <Check className="h-5 w-5" /> : i + 1}
              </span>

              <Link
                href={`/training/${step.module.id}`}
                className={cn(
                  'group block rounded-xl border p-3 sm:p-4 transition-colors',
                  current ? 'border-blue-300 bg-blue-50/50 hover:bg-blue-50' : 'border-slate-200 hover:bg-slate-50',
                  done && 'bg-slate-50/60'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn('font-medium group-hover:text-blue-700', done ? 'text-slate-500' : 'text-slate-900')}>
                      {step.module.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {getCategoryLabel(step.module.category)} · {step.module.estimated_minutes} min
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      done && 'bg-green-100 text-green-700',
                      current && 'bg-blue-100 text-blue-700',
                      !done && !current && 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {done ? 'Completed' : current ? (step.percent > 0 ? `In progress · ${step.percent}%` : 'Up next') : 'Upcoming'}
                  </span>
                </div>
                {current && step.percent > 0 && (
                  <div className="mt-2.5 space-y-1">
                    <Progress value={step.percent} className="h-1.5" />
                    {step.nextSectionTitle && <p className="truncate text-xs text-blue-700">Next up: {step.nextSectionTitle}</p>}
                  </div>
                )}
              </Link>
            </li>
          )
        })}
      </ol>

      {/* Phones: the main action sits at the bottom, under the roadmap */}
      {nextStep && (
        <div className="border-t border-slate-100 p-4 sm:hidden">
          <Link
            href={`/training/${nextStep.module.id}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {nextStep.percent > 0 ? 'Continue' : 'Start'}: {nextStep.module.title} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </Card>
  )
}
