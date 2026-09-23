import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadUserPaths } from '@/lib/learning-paths'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, ChevronRight, Route, Sparkles } from 'lucide-react'
import { cn, formatDate, getCategoryLabel } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function LearningPathsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const paths = await loadUserPaths(supabase, user.id)

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Learning Paths" />
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        {paths.length === 0 ? (
          <div className="text-center py-20">
            <Route className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No learning paths yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Learning paths are step-by-step sequences of trainings for your role. You&apos;ll see yours here once you&apos;re enrolled.
            </p>
          </div>
        ) : (
          paths.map(({ path, steps, percent, completedSteps, dueDate, nextStep }) => (
            <Card key={path.id} className={cn(path.kind === 'onboarding' && percent < 100 && 'border-blue-200 ring-1 ring-blue-200')}>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-slate-900">{path.title}</h2>
                    {path.kind === 'onboarding' && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> New hire onboarding
                      </Badge>
                    )}
                    {percent === 100 && <Badge variant="success">Completed</Badge>}
                  </div>
                  {path.description && <p className="text-sm text-slate-500">{path.description}</p>}
                  <div className="flex items-center gap-3">
                    <Progress
                      value={percent}
                      className="flex-1 h-2"
                      indicatorClassName={percent === 100 ? 'bg-green-500' : undefined}
                    />
                    <span className="text-sm text-slate-600 shrink-0">
                      {completedSteps} of {steps.length} · {percent}%
                    </span>
                  </div>
                  {dueDate && <p className="text-xs text-slate-400">Due {formatDate(dueDate)}</p>}
                </div>

                <ol className="space-y-2">
                  {steps.map((step, i) => {
                    const isDone = step.percent === 100
                    const isNext = nextStep?.module.id === step.module.id
                    return (
                      <li key={step.module.id}>
                        <Link
                          href={`/training/${step.module.id}`}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border p-3 transition-colors group',
                            isNext
                              ? 'border-blue-300 bg-blue-50/50 hover:bg-blue-50'
                              : 'border-slate-200 hover:bg-slate-50'
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                              isDone ? 'bg-green-100 text-green-700' : isNext ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            {isDone ? <CheckCircle className="h-5 w-5" /> : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 group-hover:text-blue-700 truncate">{step.module.title}</p>
                            <p className="text-xs text-slate-400">
                              {getCategoryLabel(step.module.category)} · {step.module.estimated_minutes} min
                              {!isDone && step.percent > 0 && ` · ${step.percent}% done`}
                            </p>
                            {isNext && step.percent > 0 && step.nextSectionTitle && (
                              <p className="text-xs text-blue-700 truncate">Next up: {step.nextSectionTitle}</p>
                            )}
                          </div>
                          {isNext ? (
                            <span className="hidden sm:inline-flex shrink-0 items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
                              {step.percent > 0 ? 'Continue' : 'Start'}
                            </span>
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  )
}
