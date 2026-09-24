'use client'

import { Fragment, useMemo, useState } from 'react'
import { Award, CheckCircle, ChevronDown, ChevronUp, Download, GraduationCap, Search, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn, formatDate, getCategoryLabel } from '@/lib/utils'

export interface PersonStatus {
  userId: string
  name: string
  department: string | null
  status: 'completed' | 'in_progress' | 'not_started'
  percent: number
  completedAt: string | null | undefined
  dueDate: string | null
  overdue: boolean
  score: string | null
  certificateId: string | null
  optional: boolean
}

export interface CourseCompletion {
  id: string
  title: string
  category: string
  minutes: number
  isPublished: boolean
  assigned: number
  completed: number
  inProgress: number
  notStarted: number
  overdue: number
  lastCompletedAt: string | null
  people: PersonStatus[]
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

export function CourseCompletionsView({ courses, scopeLabel }: { courses: CourseCompletion[]; scopeLabel: string }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [open, setOpen] = useState<string | null>(null)

  const categories = useMemo(() => [...new Set(courses.map(c => c.category))].sort(), [courses])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return courses.filter(c => {
      if (category !== 'all' && c.category !== category) return false
      if (!q) return true
      return c.title.toLowerCase().includes(q) || c.people.some(p => p.name.toLowerCase().includes(q))
    })
  }, [courses, query, category])

  const totals = useMemo(() => {
    const assigned = courses.reduce((n, c) => n + c.assigned, 0)
    const completed = courses.reduce((n, c) => n + c.completed, 0)
    const people = new Set(courses.flatMap(c => c.people.map(p => p.userId))).size
    return { assigned, completed, people, rate: pct(completed, assigned) }
  }, [courses])

  function exportCsv() {
    const rows = [['Course', 'Category', 'Person', 'Department', 'Status', 'Progress %', 'Completed on', 'Score', 'Due date', 'Overdue']]
    for (const c of visible) {
      for (const p of c.people) {
        rows.push([
          c.title, getCategoryLabel(c.category), p.name, p.department ?? '',
          p.status === 'completed' ? 'Completed' : p.status === 'in_progress' ? 'In progress' : 'Not started',
          String(p.percent), p.completedAt ? p.completedAt.slice(0, 10) : '', p.score ?? '', p.dueDate ?? '', p.overdue ? 'Yes' : '',
        ])
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `course-completions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (courses.length === 0) {
    return (
      <div className="py-20 text-center">
        <GraduationCap className="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <p className="font-medium text-slate-500">No course activity yet</p>
        <p className="mt-1 text-sm text-slate-400">Once trainings are assigned to {scopeLabel}, completions will be listed here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        {[
          { label: 'Courses in use', value: courses.length, icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'People', value: totals.people, icon: Users, color: 'text-slate-600', bg: 'bg-slate-100' },
          { label: 'Completions', value: totals.completed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Overall completion', value: `${totals.rate}%`, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-900">{s.value}</p>
              </div>
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', s.bg)}>
                <s.icon className={cn('h-5 w-5', s.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a course or person" className="pl-9" aria-label="Search courses or people" />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
        </select>
        <span className="text-sm text-slate-500 sm:ml-2">{visible.length} of {courses.length} courses · showing {scopeLabel}</span>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 sm:ml-auto">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Course</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Assigned</th>
                <th className="min-w-[180px] px-4 py-3 text-left font-medium text-slate-600">Completed</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">In progress</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Not started</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Overdue</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">No courses match your search</td></tr>
              ) : visible.map(c => {
                const isOpen = open === c.id
                const done = c.people.filter(p => p.status === 'completed')
                const notDone = c.people.filter(p => p.status !== 'completed')
                const rate = pct(c.completed, c.assigned)
                return (
                  <Fragment key={c.id}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(isOpen ? null : c.id)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{c.title}</p>
                        <p className="text-xs text-slate-400">
                          {getCategoryLabel(c.category)}{!c.isPublished && ' · Draft'}
                          {c.lastCompletedAt && ` · last completed ${formatDate(c.lastCompletedAt)}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">{c.assigned}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-16 shrink-0 font-semibold text-slate-900">{c.completed} of {c.assigned}</span>
                          <Progress value={rate} className="h-1.5 flex-1" indicatorClassName={rate === 100 ? 'bg-green-500' : undefined} />
                          <span className="w-9 shrink-0 text-right text-xs text-slate-500">{rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-amber-700">{c.inProgress || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{c.notStarted || <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">{c.overdue > 0 ? <Badge variant="danger">{c.overdue}</Badge> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3">
                        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <section>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">Completed ({done.length})</p>
                              {done.length === 0 ? (
                                <p className="text-sm text-slate-400">Nobody has completed this yet.</p>
                              ) : (
                                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                                  {done.map(p => (
                                    <li key={p.userId} className="flex items-center gap-3 px-3 py-2">
                                      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                                        <p className="truncate text-xs text-slate-400">
                                          {[p.department, p.completedAt ? `completed ${formatDate(p.completedAt)}` : null, p.score ? `score ${p.score}` : null].filter(Boolean).join(' · ')}
                                        </p>
                                      </div>
                                      {p.certificateId && (
                                        <a
                                          href={`/api/certificate?certificateId=${p.certificateId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={e => e.stopPropagation()}
                                          className="inline-flex shrink-0 items-center gap-1 text-xs text-blue-600 hover:underline"
                                        >
                                          <Award className="h-3.5 w-3.5" /> Certificate
                                        </a>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </section>

                            <section>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Not yet completed ({notDone.length})</p>
                              {notDone.length === 0 ? (
                                <p className="text-sm text-slate-400">Everyone assigned has completed it.</p>
                              ) : (
                                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                                  {notDone.map(p => (
                                    <li key={p.userId} className="flex items-center gap-3 px-3 py-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                                        <p className="truncate text-xs text-slate-400">
                                          {[p.department, p.dueDate ? `due ${formatDate(p.dueDate)}` : null, p.optional ? 'optional' : null].filter(Boolean).join(' · ')}
                                        </p>
                                      </div>
                                      {p.overdue && <Badge variant="danger">Overdue</Badge>}
                                      <Badge variant={p.status === 'in_progress' ? 'warning' : 'outline'}>
                                        {p.status === 'in_progress' ? `${p.percent}% done` : 'Not started'}
                                      </Badge>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </section>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
