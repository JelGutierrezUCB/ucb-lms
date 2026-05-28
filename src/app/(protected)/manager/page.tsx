import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, CheckCircle, Clock, AlertCircle, BarChart3, Play } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function ManagerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profile?.role ?? '')) redirect('/dashboard')

  // Get employees under this manager
  const employeesQuery = supabase
    .from('profiles')
    .select('id, full_name, department, email')
    .eq('role', 'employee')
    .order('full_name')

  if (profile?.role === 'manager') employeesQuery.eq('manager_id', user.id)

  const { data: employees } = await employeesQuery
  const employeeIds = (employees ?? []).map(e => e.id)

  const [
    { data: assignments },
    { data: sections },
    { data: recentAttempts },
  ] = await Promise.all([
    supabase.from('assignments')
      .select('user_id, module_id, due_date, modules!inner(id, title)')
      .in('user_id', employeeIds.length ? employeeIds : ['']),
    supabase.from('sections').select('id, module_id'),
    supabase.from('quiz_attempts')
      .select('user_id, score, max_score, completed_at')
      .in('user_id', employeeIds.length ? employeeIds : [''])
      .order('completed_at', { ascending: false })
      .limit(100),
  ])

  const { data: progress } = await supabase
    .from('section_progress')
    .select('user_id, section_id, sections!inner(module_id)')
    .in('user_id', employeeIds.length ? employeeIds : [''])

  // Build lookup tables
  const totalByModule: Record<string, number> = {}
  for (const s of sections ?? []) {
    totalByModule[s.module_id] = (totalByModule[s.module_id] ?? 0) + 1
  }

  const completedByUserModule: Record<string, number> = {}
  for (const p of (progress ?? []) as any[]) {
    const key = `${p.user_id}_${p.sections?.module_id}`
    completedByUserModule[key] = (completedByUserModule[key] ?? 0) + 1
  }

  // Compute per-employee stats
  const today = new Date().toISOString().split('T')[0]
  let completedAssignments = 0
  let overdueCount = 0

  const employeeStats = (employees ?? []).map(emp => {
    const empAssignments = (assignments ?? []).filter(a => a.user_id === emp.id)
    let completed = 0, inProgress = 0, notStarted = 0, overdue = 0
    for (const a of empAssignments) {
      const done = completedByUserModule[`${emp.id}_${a.module_id}`] ?? 0
      const total = totalByModule[a.module_id] ?? 0
      const pct = total > 0 ? done / total : 0
      if (pct === 1) { completed++; completedAssignments++ }
      else if (pct > 0) inProgress++
      else {
        notStarted++
        if (a.due_date && a.due_date < today) { overdue++; overdueCount++ }
      }
    }
    const overallPct = empAssignments.length > 0
      ? Math.round((completed / empAssignments.length) * 100) : 0

    // Best quiz score
    const empAttempts = (recentAttempts ?? []).filter(a => a.user_id === emp.id)
    const avgScore = empAttempts.length > 0
      ? Math.round(empAttempts.reduce((s, a) => s + (a.max_score > 0 ? (a.score / a.max_score) * 100 : 0), 0) / empAttempts.length)
      : null

    return { ...emp, completed, inProgress, notStarted, overdue, total: empAssignments.length, overallPct, avgScore }
  })

  const needsAttention = employeeStats.filter(e => e.overdue > 0 || (e.total > 0 && e.overallPct === 0))

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Manager Dashboard" />
      <main className="flex-1 p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'My Employees', value: employeeStats.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed', value: completedAssignments, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Assignments', value: (assignments ?? []).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Overdue', value: overdueCount, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
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

        {/* Needs attention */}
        {needsAttention.length > 0 && (
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Needs Attention ({needsAttention.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {needsAttention.map(emp => (
                  <div key={emp.id} className="flex items-center gap-3 bg-white rounded-lg border border-red-100 p-3">
                    <div className="h-8 w-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {emp.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{emp.full_name}</p>
                      <p className="text-xs text-slate-400">{emp.department}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {emp.overdue > 0 && <Badge variant="danger">{emp.overdue} overdue</Badge>}
                      {emp.overallPct === 0 && emp.total > 0 && <Badge variant="outline">Not started</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee progress table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Employee Progress</CardTitle>
              <div className="flex gap-2">
                <Link href="/reports"><Button variant="outline" size="sm" className="gap-2"><BarChart3 className="h-4 w-4" />Full Reports</Button></Link>
                <Link href="/manager/employees"><Button size="sm" className="gap-2"><Users className="h-4 w-4" />Manage & Assign</Button></Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {employeeStats.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Users className="h-10 w-10 mx-auto mb-2" />
                <p>No employees assigned to you yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-3 py-2.5 text-slate-600 font-medium">Employee</th>
                      <th className="text-left px-3 py-2.5 text-slate-600 font-medium">Site</th>
                      <th className="text-center px-3 py-2.5 text-slate-600 font-medium">Trainings</th>
                      <th className="text-left px-3 py-2.5 text-slate-600 font-medium min-w-[120px]">Progress</th>
                      <th className="text-center px-3 py-2.5 text-slate-600 font-medium">Avg Score</th>
                      <th className="text-center px-3 py-2.5 text-slate-600 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeStats.map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {emp.full_name.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-900">{emp.full_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs">{emp.department ?? '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-slate-700">{emp.completed}/{emp.total}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Progress value={emp.overallPct} className="flex-1 h-1.5" />
                            <span className="text-xs text-slate-500 w-8 text-right">{emp.overallPct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {emp.avgScore !== null ? (
                            <Badge variant={emp.avgScore >= 70 ? 'success' : 'danger'}>{emp.avgScore}%</Badge>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {emp.overdue > 0
                            ? <Badge variant="danger">Overdue</Badge>
                            : emp.overallPct === 100 && emp.total > 0
                              ? <Badge variant="success">Complete</Badge>
                              : emp.overallPct > 0
                                ? <Badge variant="warning">In Progress</Badge>
                                : emp.total > 0
                                  ? <Badge variant="outline">Not Started</Badge>
                                  : <span className="text-slate-300 text-xs">No assignments</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
