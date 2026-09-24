'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BookOpen, Search, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn, formatDate, getCategoryColor, getCategoryLabel } from '@/lib/utils'

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

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'required', label: 'Required' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
]

function matches(t: DashboardTraining, filter: Filter) {
  switch (filter) {
    case 'required': return t.required && t.percent < 100
    case 'in_progress': return t.percent > 0 && t.percent < 100
    case 'overdue': return t.overdue
    case 'completed': return t.percent === 100
    default: return true
  }
}

export function AssignedTrainings({ trainings }: { trainings: DashboardTraining[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>
    for (const f of FILTERS) c[f.key] = trainings.filter(t => matches(t, f.key)).length
    return c
  }, [trainings])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return trainings.filter(t => {
      if (!matches(t, filter)) return false
      if (!q) return true
      return t.title.toLowerCase().includes(q) || getCategoryLabel(t.category).toLowerCase().includes(q)
    })
  }, [trainings, filter, query])

  if (trainings.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No trainings assigned yet</p>
        <p className="text-slate-400 text-sm mt-1">Your manager will assign trainings to you</p>
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
            placeholder="Search my trainings"
            className="pl-9"
            aria-label="Search my trainings"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">No trainings match.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(t => (
            <Link
              key={t.moduleId}
              href={`/training/${t.moduleId}`}
              className={cn(
                'flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-all group',
                t.overdue
                  ? 'border-red-300 ring-1 ring-red-200 bg-red-50/40 hover:bg-red-50'
                  : t.required
                    ? 'border-amber-300 ring-1 ring-amber-300 bg-amber-50/40 hover:bg-amber-50'
                    : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'
              )}
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white font-bold text-lg"
                style={{ backgroundColor: getCategoryColor(t.category) }}
              >
                {t.title.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {t.title}
                  </p>
                  {t.overdue && (
                    <Badge variant="danger" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Overdue
                    </Badge>
                  )}
                  {t.required && (
                    <Badge className="bg-amber-400 text-amber-950 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> Required
                    </Badge>
                  )}
                  {t.optional && <Badge variant="outline">Optional</Badge>}
                  <Badge variant={t.percent === 100 ? 'success' : t.percent > 0 ? 'warning' : 'outline'}>
                    {t.percent === 100 ? 'Complete' : t.percent > 0 ? 'In Progress' : 'Not Started'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {getCategoryLabel(t.category)} · {t.minutes} min
                  {t.dueDate && ` · Due ${formatDate(t.dueDate)}`}
                </p>
                {t.percent > 0 && t.percent < 100 && t.nextSectionTitle && (
                  <p className="text-xs text-blue-700 mt-0.5 truncate">Next up: {t.nextSectionTitle}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={t.percent} className="flex-1 h-1.5" />
                  <span className="text-xs text-slate-500 shrink-0">{t.percent}%</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
