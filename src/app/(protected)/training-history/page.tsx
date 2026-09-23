import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Award, CheckCircle, Download, History, TrendingUp } from 'lucide-react'
import { formatDate, getCategoryLabel } from '@/lib/utils'
import type { Assignment, Certificate, Module } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TrainingHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: progressRows }, { data: assignments }, { data: certificates }] = await Promise.all([
    supabase
      .from('section_progress')
      .select('section_id, completed_at, sections!inner(module_id, is_archived)')
      .eq('user_id', user.id)
      .eq('sections.is_archived', false),
    supabase
      .from('assignments')
      .select('module_id, section_id')
      .eq('user_id', user.id) as unknown as Promise<{ data: Pick<Assignment, 'module_id' | 'section_id'>[] | null }>,
    supabase
      .from('certificates')
      .select('*')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false }) as unknown as Promise<{ data: Certificate[] | null }>,
  ])

  // Group section completions by module
  const activity = new Map<string, { done: Set<string>; first: string; last: string }>()
  for (const row of (progressRows ?? []) as any[]) {
    const moduleId = row.sections?.module_id as string | undefined
    if (!moduleId) continue
    const entry = activity.get(moduleId) ?? { done: new Set<string>(), first: row.completed_at, last: row.completed_at }
    entry.done.add(row.section_id)
    if (row.completed_at < entry.first) entry.first = row.completed_at
    if (row.completed_at > entry.last) entry.last = row.completed_at
    activity.set(moduleId, entry)
  }

  const moduleIds = [...activity.keys()]

  const [{ data: modules }, { data: sections }] = await Promise.all([
    supabase.from('modules').select('*').in('id', moduleIds.length ? moduleIds : ['']) as unknown as Promise<{ data: Module[] | null }>,
    supabase
      .from('sections')
      .select('id, module_id')
      .in('module_id', moduleIds.length ? moduleIds : [''])
      .eq('is_archived', false),
  ])

  // Same rule the dashboard uses: if only specific trainings inside a module
  // were assigned (no whole-module assignment), only those count toward it.
  const requiredByModule = new Map<string, Set<string> | null>()
  for (const a of assignments ?? []) {
    if (!a.section_id) {
      requiredByModule.set(a.module_id, null)
    } else if (requiredByModule.get(a.module_id) !== null) {
      const set = requiredByModule.get(a.module_id) ?? new Set<string>()
      set.add(a.section_id)
      requiredByModule.set(a.module_id, set)
    }
  }

  const totalByModule: Record<string, number> = {}
  for (const s of sections ?? []) {
    const required = requiredByModule.get(s.module_id)
    if (required && !required.has(s.id)) continue
    totalByModule[s.module_id] = (totalByModule[s.module_id] ?? 0) + 1
  }

  const certByModule = new Map<string, Certificate>()
  for (const c of certificates ?? []) {
    if (c.module_id && !certByModule.has(c.module_id)) certByModule.set(c.module_id, c)
  }

  const rows = (modules ?? [])
    .map(m => {
      const a = activity.get(m.id)!
      const required = requiredByModule.get(m.id)
      const done = required ? [...a.done].filter(id => required.has(id)).length : a.done.size
      const total = totalByModule[m.id] ?? 0
      const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
      return { module: m, first: a.first, last: a.last, percent, cert: certByModule.get(m.id) ?? null }
    })
    .sort((a, b) => b.last.localeCompare(a.last))

  const completed = rows.filter(r => r.percent === 100).length
  const inProgress = rows.filter(r => r.percent < 100).length

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Training History" />
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        {rows.length === 0 ? (
          <div className="text-center py-20">
            <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No training history yet</p>
            <p className="text-slate-400 text-sm mt-1">Trainings you start or finish will be listed here.</p>
            <Link href="/training" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
              Go to my trainings
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'Completed', value: completed, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'In Progress', value: inProgress, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Certificates', value: certificates?.length ?? 0, icon: Award, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{s.label}</p>
                      <p className="text-2xl font-bold text-slate-900 mt-0.5">{s.value}</p>
                    </div>
                    <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Training</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Started</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Last activity</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[140px]">Progress</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Score</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(({ module: m, first, last, percent, cert }) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link href={`/training/${m.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                            {m.title}
                          </Link>
                          <p className="text-xs text-slate-400">{getCategoryLabel(m.category)}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(first)}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {formatDate(last)}
                          {percent === 100 && <Badge variant="success" className="ml-2">Completed</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={percent}
                              className="flex-1 h-1.5"
                              indicatorClassName={percent === 100 ? 'bg-green-500' : undefined}
                            />
                            <span className="text-xs text-slate-500 w-9 text-right">{percent}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {cert?.max_score ? `${cert.score}/${cert.max_score}` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {cert ? (
                            <a
                              href={`/api/certificate?certificateId=${cert.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
