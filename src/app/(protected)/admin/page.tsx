import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, BookOpen, GraduationCap, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getCategoryLabel, getCategoryColor } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [
    { data: allProfiles },
    { data: modules },
    { data: assignments },
    { data: sections },
    { data: recentAttempts },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, department').order('full_name'),
    supabase.from('modules').select('id, title, category, is_published, estimated_minutes'),
    supabase.from('assignments').select('user_id, module_id, assigned_at, due_date'),
    supabase.from('sections').select('id, module_id'),
    supabase.from('quiz_attempts')
      .select('user_id, score, max_score, completed_at, content_block_id')
      .order('completed_at', { ascending: false })
      .limit(200),
  ])

  const employees = (allProfiles ?? []).filter(p => p.role === 'employee')
  const managers = (allProfiles ?? []).filter(p => p.role === 'manager')
  const employeeIds = employees.map(e => e.id)

  // Section progress for employees
  const { data: progress } = await supabase
    .from('section_progress')
    .select('user_id, section_id, sections!inner(module_id)')
    .in('user_id', employeeIds.length ? employeeIds : [''])

  // Compute totals
  const totalByModule: Record<string, number> = {}
  for (const s of sections ?? []) {
    totalByModule[s.module_id] = (totalByModule[s.module_id] ?? 0) + 1
  }

  const completedByUserModule: Record<string, number> = {}
  for (const p of (progress ?? []) as any[]) {
    const key = `${p.user_id}_${p.sections?.module_id}`
    completedByUserModule[key] = (completedByUserModule[key] ?? 0) + 1
  }

  // Assignment completion stats
  const today = new Date().toISOString().split('T')[0]
  let completedCount = 0
  let overdueCount = 0
  let inProgressCount = 0
  let notStartedCount = 0

  for (const a of assignments ?? []) {
    const done = completedByUserModule[`${a.user_id}_${a.module_id}`] ?? 0
    const total = totalByModule[a.module_id] ?? 0
    const pct = total > 0 ? done / total : 0

    if (pct === 1) completedCount++
    else if (pct > 0) inProgressCount++
    else {
      notStartedCount++
      if (a.due_date && a.due_date < today) overdueCount++
    }
  }

  const totalAssignments = (assignments ?? []).length
  const overallCompletionRate = totalAssignments > 0
    ? Math.round((completedCount / totalAssignments) * 100)
    : 0

  // Per-module stats (published only)
  const publishedModules = (modules ?? []).filter(m => m.is_published)
  const moduleStats = publishedModules.map(m => {
    const assignedToModule = (assignments ?? []).filter(a => a.module_id === m.id)
    const completedForModule = assignedToModule.filter(a => {
      const done = completedByUserModule[`${a.user_id}_${a.module_id}`] ?? 0
      return done >= (totalByModule[m.id] ?? 1)
    }).length
    const pct = assignedToModule.length > 0
      ? Math.round((completedForModule / assignedToModule.length) * 100)
      : 0
    return { ...m, assigned: assignedToModule.length, completed: completedForModule, pct }
  }).sort((a, b) => b.assigned - a.assigned)

  // Recent quiz attempts enriched
  const recentWithNames = (recentAttempts ?? []).slice(0, 10).map(a => {
    const p = (allProfiles ?? []).find(pr => pr.id === a.user_id)
    return {
      ...a,
      name: p?.full_name ?? 'Unknown',
      department: p?.department ?? '',
      scorePct: a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0,
    }
  })

  // Department breakdown
  const deptMap: Record<string, { total: number; completed: number }> = {}
  for (const a of assignments ?? []) {
    const emp = employees.find(e => e.id === a.user_id)
    const dept = emp?.department ?? 'Unknown'
    if (!deptMap[dept]) deptMap[dept] = { total: 0, completed: 0 }
    deptMap[dept].total++
    const done = completedByUserModule[`${a.user_id}_${a.module_id}`] ?? 0
    if (done >= (totalByModule[a.module_id] ?? 1)) deptMap[dept].completed++
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Admin Dashboard" />
      <main className="flex-1 p-6 space-y-6">

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Employees', value: employees.length, sub: `${managers.length} managers`, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Training Modules', value: publishedModules.length, sub: `${(modules ?? []).length} total`, icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Completion Rate', value: `${overallCompletionRate}%`, sub: `${completedCount} of ${totalAssignments}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Overdue', value: overdueCount, sub: `${notStartedCount} not started`, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Assignment status breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Completed', value: completedCount, color: 'bg-green-500', icon: CheckCircle2, textColor: 'text-green-700' },
            { label: 'In Progress', value: inProgressCount, color: 'bg-amber-400', icon: TrendingUp, textColor: 'text-amber-700' },
            { label: 'Not Started', value: notStartedCount, color: 'bg-slate-300', icon: Clock, textColor: 'text-slate-600' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-sm text-slate-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Module completion breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Module Completion Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {moduleStats.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No published modules yet</p>
              ) : moduleStats.map(m => (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: getCategoryColor(m.category) }}
                      />
                      <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{m.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">{m.completed}/{m.assigned}</span>
                      <Badge variant={m.pct === 100 ? 'success' : m.pct > 50 ? 'warning' : 'outline'} className="text-xs">
                        {m.pct}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={m.pct} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent quiz activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Recent Quiz Activity</CardTitle>
                <Link href="/reports">
                  <Button variant="outline" size="sm">View All Reports</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentWithNames.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">No quiz attempts yet</p>
              ) : (
                <div className="space-y-2">
                  {recentWithNames.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="h-8 w-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {a.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.department}</p>
                      </div>
                      <Badge variant={a.scorePct >= 70 ? 'success' : 'danger'} className="shrink-0">
                        {a.scorePct}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Location/dept breakdown */}
        {Object.keys(deptMap).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Completion by Location / Department</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(deptMap).sort(([, a], [, b]) => b.total - a.total).map(([dept, stats]) => {
                  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
                  return (
                    <div key={dept} className="rounded-xl border border-slate-200 p-4 space-y-2">
                      <p className="text-sm font-semibold text-slate-800 truncate">{dept}</p>
                      <p className="text-2xl font-bold text-slate-900">{pct}%</p>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs text-slate-400">{stats.completed}/{stats.total} complete</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/admin/users">
              <Button variant="outline" className="gap-2"><Users className="h-4 w-4" />Manage Users</Button>
            </Link>
            <Link href="/admin/modules">
              <Button variant="outline" className="gap-2"><BookOpen className="h-4 w-4" />Training Modules</Button>
            </Link>
            <Link href="/admin/modules/new">
              <Button className="gap-2"><BookOpen className="h-4 w-4" />Create Module</Button>
            </Link>
            <Link href="/training-generator">
              <Button variant="secondary" className="gap-2"><GraduationCap className="h-4 w-4" />AI Generator</Button>
            </Link>
            <Link href="/reports">
              <Button variant="secondary" className="gap-2"><TrendingUp className="h-4 w-4" />View Reports</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
