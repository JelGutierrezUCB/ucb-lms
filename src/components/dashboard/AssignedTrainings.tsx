'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BookOpen, Search, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn, formatDate, getCategoryColor, getCategoryLabel } from '@/lib/utils'
import type { Dict } from '@/lib/i18n/dictionaries'

export interface DashboardTraining {
  moduleId: string
  title: string
  category: string
  minutes: number
  dueDate: string | null
  percent: number
  required: boolean
  // Optional training (set by an assignment rule): never counts as overdue
  optional: boolean
  overdue: boolean
  // Title of the first unfinished training in the module, for in-progress items.
  nextSectionTitle: string | null
}

type Filter = 'all' | 'required' | 'in_progress' | 'overdue' | 'completed'

function matches(item: DashboardTraining, filter: Filter) {
  switch (filter) {
    case 'required': return item.required && item.percent < 100
    case 'in_progress': return item.percent > 0 && item.percent < 100
    case 'overdue': return item.overdue
    case 'completed': return item.percent === 100
    default: return true
  }
}

export function AssignedTrainings({ trainings, t }: { trainings: DashboardTraining[]; t: Dict }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t.assignedTrainings.filterAll },
    { key: 'required', label: t.common.required },
    { key: 'in_progress', label: t.assignedTrainings.filterInProgress },
    { key: 'overdue', label: t.common.overdue },
    { key: 'completed', label: t.common.complete },
  ]

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>
    for (const f of FILTERS) c[f.key] = trainings.filter(item => matches(item, f.key)).length
    return c
  }, [trainings, FILTERS])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return trainings.filter(item => {
      if (!matches(item, filter)) return false
      if (!q) return true
      return item.title.toLowerCase().includes(q) || getCategoryLabel(item.category).toLowerCase().includes(q)
    })
  }, [trainings, filter, query])

  if (trainings.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">{t.assignedTrainings.noneAssignedTitle}</p>
        <p className="text-slate-400 text-sm mt-1">{t.assignedTrainings.noneAssignedBody}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sm:flex-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                filter === f.key
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {f.label}
              <span className={cn('ml-1.5 text-xs', filter === f.key ? 'text-blue-100' : 'text-slate-400')}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.assignedTrainings.searchPlaceholder}
            className="pl-9"
            aria-label={t.assignedTrainings.searchPlaceholder}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">{t.assignedTrainings.noMatches}</p>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <Link
              key={item.moduleId}
              href={`/training/${item.moduleId}`}
              className={cn(
                'flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all group',
                item.overdue
                  ? 'border-red-300 ring-1 ring-red-200 bg-red-50/40 hover:bg-red-50'
                  : item.required
                    ? 'border-amber-300 ring-1 ring-amber-300 bg-amber-50/40 hover:bg-amber-50'
                    : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'
              )}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white font-bold text-lg"
                style={{ backgroundColor: getCategoryColor(item.category) }}
              >
                {item.title.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {item.title}
                  </p>
                  {item.overdue && (
                    <Badge variant="danger" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {t.common.overdue}
                    </Badge>
                  )}
                  {item.required && (
                    <Badge className="bg-amber-400 text-amber-950 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> {t.common.required}
                    </Badge>
                  )}
                  {item.optional && <Badge variant="outline">{t.common.optional}</Badge>}
                  <Badge variant={item.percent === 100 ? 'success' : item.percent > 0 ? 'warning' : 'outline'}>
                    {item.percent === 100 ? t.common.complete : item.percent > 0 ? t.common.inProgress : t.common.notStarted}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {getCategoryLabel(item.category)} · {item.minutes} min
                  {item.dueDate && ` · ${t.common.due} ${formatDate(item.dueDate)}`}
                </p>
                {item.percent > 0 && item.percent < 100 && item.nextSectionTitle && (
                  <p className="text-xs text-blue-700 mt-0.5 truncate">{t.common.nextUp}: {item.nextSectionTitle}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={item.percent} className="flex-1 h-1.5" />
                  <span className="text-xs text-slate-500 shrink-0">{item.percent}%</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
