'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Clock, Search, SearchX, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn, getCategoryColor, getCategoryLabel } from '@/lib/utils'

export interface CatalogItem {
  id: string
  title: string
  description: string | null
  category: string
  minutes: number
  percent: number
  required: boolean
  assigned: boolean
  isChecklist: boolean
}

type Scope = 'mine' | 'all'
type Status = 'all' | 'not_started' | 'in_progress' | 'completed'

const STATUS_OPTIONS: { key: Status; label: string }[] = [
  { key: 'all', label: 'Any status' },
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
]

function statusOf(percent: number): Exclude<Status, 'all'> {
  return percent === 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started'
}

interface Props {
  items: CatalogItem[]
  // "?as=<id>" when a manager is viewing an employee's training, else ''
  asParam: string
  // Employees can flip between their assigned trainings and every published
  // course; managers/admins and proxy views always see the list they were given.
  allowScopeToggle: boolean
}

export function CatalogGrid({ items, asParam, allowScopeToggle }: Props) {
  const assignedCount = items.filter(i => i.assigned).length
  const [scope, setScope] = useState<Scope>(allowScopeToggle && assignedCount > 0 ? 'mine' : 'all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState<Status>('all')

  const scoped = useMemo(
    () => (allowScopeToggle && scope === 'mine' ? items.filter(i => i.assigned) : items),
    [items, scope, allowScopeToggle]
  )

  const categories = useMemo(() => [...new Set(scoped.map(i => i.category))].sort(), [scoped])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scoped.filter(i => {
      if (category !== 'all' && i.category !== category) return false
      if (status !== 'all' && statusOf(i.percent) !== status) return false
      if (!q) return true
      return (
        i.title.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q) ||
        getCategoryLabel(i.category).toLowerCase().includes(q)
      )
    })
  }, [scoped, query, category, status])

  const filtersActive = query.trim() !== '' || category !== 'all' || status !== 'all'

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {allowScopeToggle && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            {([['mine', `My trainings (${assignedCount})`], ['all', `All courses (${items.length})`]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setScope(key); setCategory('all') }}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium transition-colors',
                  scope === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search courses by title, topic, or keyword"
              className="pl-9"
              aria-label="Search courses"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{getCategoryLabel(c)}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as Status)}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <p className="text-sm text-slate-500">
          {visible.length} of {scoped.length} {scoped.length === 1 ? 'course' : 'courses'}
          {filtersActive && (
            <button
              type="button"
              onClick={() => { setQuery(''); setCategory('all'); setStatus('all') }}
              className="ml-2 text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16">
          <SearchX className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No courses match your search</p>
          <p className="text-slate-400 text-sm mt-1">Try a different keyword or clear the filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visible.map(item => (
            <Link key={item.id} href={`/training/${item.id}${asParam}`}>
              <Card
                className={cn(
                  'h-full flex flex-col hover:shadow-md transition-shadow cursor-pointer group',
                  item.required && 'ring-2 ring-amber-400 border-amber-300'
                )}
              >
                <div
                  className="h-32 flex items-center justify-center rounded-t-xl relative"
                  style={{ backgroundColor: getCategoryColor(item.category) }}
                >
                  <span className="text-white text-5xl font-bold opacity-30">
                    {item.title.charAt(0)}
                  </span>
                  {item.required && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 text-xs font-semibold px-2.5 py-1">
                      <Star className="h-3 w-3 fill-current" /> Required
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-col flex-1 pt-4 pb-5">
                  <div className="flex items-start gap-2 mb-2">
                    <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors flex-1">
                      {item.title}
                    </p>
                    {item.assigned && <Badge variant="default">Assigned</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Badge
                      style={{ backgroundColor: `${getCategoryColor(item.category)}20`, color: getCategoryColor(item.category) }}
                    >
                      {getCategoryLabel(item.category)}
                    </Badge>
                    {item.isChecklist && <Badge variant="outline">Checklist</Badge>}
                  </div>
                  {item.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{item.description}</p>
                  )}
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />{item.minutes} min
                      </span>
                      <span>{item.percent}% complete</span>
                    </div>
                    <Progress
                      value={item.percent}
                      indicatorClassName={item.percent === 100 ? 'bg-green-500' : undefined}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
