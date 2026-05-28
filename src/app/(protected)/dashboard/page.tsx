import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BookOpen, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { getCategoryColor, getCategoryLabel, formatDate } from '@/lib/utils'
import type { Profile, Module, Assignment } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null }

  if (!profile) redirect('/login')

  // Admins go to their dedicated dashboard
  if (profile.role === 'admin') redirect('/admin')
  if (profile.role === 'manager') redirect('/manager')

  // Employee dashboard
  const { data: assignments } = await supabase
    .from('assignments')
    .select('*, module:modules(*)')
    .eq('user_id', user.id)
    .order('assigned_at', { ascending: false }) as { data: (Assignment & { module: Module })[] | null }

  const moduleIds = (assignments ?? []).map(a => a.module_id)

  const { data: sectionCounts } = await supabase
    .from('sections')
    .select('module_id, id')
    .in('module_id', moduleIds.length ? moduleIds : [''])

  const { data: completedSections } = await supabase
    .from('section_progress')
    .select('section_id, sections!inner(module_id)')
    .eq('user_id', user.id)

  const totalByModule: Record<string, number> = {}
  const completedByModule: Record<string, number> = {}

  for (const row of sectionCounts ?? []) {
    totalByModule[row.module_id] = (totalByModule[row.module_id] ?? 0) + 1
  }
  for (const row of (completedSections ?? []) as any[]) {
    const moduleId = row.sections?.module_id
    if (moduleId) completedByModule[moduleId] = (completedByModule[moduleId] ?? 0) + 1
  }

  const assignmentsWithProgress = (assignments ?? []).map(a => ({
    ...a,
    completed: completedByModule[a.module_id] ?? 0,
    total: totalByModule[a.module_id] ?? 0,
    percent: totalByModule[a.module_id]
      ? Math.round(((completedByModule[a.module_id] ?? 0) / totalByModule[a.module_id]) * 100)
      : 0,
  }))

  const completedCount = assignmentsWithProgress.filter(a => a.percent === 100).length
  const inProgressCount = assignmentsWithProgress.filter(a => a.percent > 0 && a.percent < 100).length
  const notStartedCount = assignmentsWithProgress.filter(a => a.percent === 0).length

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={`Welcome back, ${profile.full_name.split(' ')[0]}`} />

      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Assigned', value: assignmentsWithProgress.length, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed', value: completedCount, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'In Progress', value: inProgressCount, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Not Started', value: notStartedCount, icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Assigned Trainings</CardTitle>
          </CardHeader>
          <CardContent>
            {assignmentsWithProgress.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No trainings assigned yet</p>
                <p className="text-slate-400 text-sm mt-1">Your manager will assign trainings to you</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignmentsWithProgress.map((a) => (
                  <Link
                    key={a.id}
                    href={`/training/${a.module_id}`}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white font-bold text-lg"
                      style={{ backgroundColor: getCategoryColor(a.module?.category ?? '') }}
                    >
                      {a.module?.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {a.module?.title}
                        </p>
                        <Badge variant={a.percent === 100 ? 'success' : a.percent > 0 ? 'warning' : 'outline'}>
                          {a.percent === 100 ? 'Complete' : a.percent > 0 ? 'In Progress' : 'Not Started'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {getCategoryLabel(a.module?.category ?? '')} · {a.module?.estimated_minutes} min
                        {a.due_date && ` · Due ${formatDate(a.due_date)}`}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={a.percent} className="flex-1 h-1.5" />
                        <span className="text-xs text-slate-500 shrink-0">{a.percent}%</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
