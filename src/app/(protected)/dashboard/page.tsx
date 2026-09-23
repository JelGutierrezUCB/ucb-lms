import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { BookOpen, CheckCircle, Clock, TrendingUp, Target, Award, Download, AlertTriangle, PlayCircle, Lightbulb, Route } from 'lucide-react'
import Link from 'next/link'
import { getCategoryColor, getCategoryLabel, formatDate } from '@/lib/utils'
import { loadUserPaths } from '@/lib/learning-paths'
import { AssignedTrainings, type DashboardTraining } from '@/components/dashboard/AssignedTrainings'
import type { Profile, Module, Assignment, Certificate } from '@/types'

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

  // Employee dashboard. One assignment row per training when specific
  // trainings (not the whole module) were assigned, so group by module —
  // this list shows one card per module, not one per assignment row.
  const { data: assignments } = await supabase
    .from('assignments')
    .select('*, module:modules(*)')
    .eq('user_id', user.id)
    .order('assigned_at', { ascending: false }) as { data: (Assignment & { module: Module })[] | null }

  const moduleIds = [...new Set((assignments ?? []).map(a => a.module_id))]

  const { data: sectionCounts } = await supabase
    .from('sections')
    .select('module_id, id, title, order_index')
    .in('module_id', moduleIds.length ? moduleIds : [''])
    .eq('is_archived', false)
    .order('order_index')

  const { data: completedSections } = await supabase
    .from('section_progress')
    .select('section_id, completed_at, sections!inner(module_id, is_archived)')
    .eq('user_id', user.id)
    .eq('sections.is_archived', false)

  // Per module: null = whole module required; a Set = only these specific
  // sections are required (assigned individually).
  const requiredSectionsByModule = new Map<string, Set<string> | null>()
  const byModule = new Map<string, { rows: (Assignment & { module: Module })[] }>()
  for (const a of assignments ?? []) {
    if (!byModule.has(a.module_id)) byModule.set(a.module_id, { rows: [] })
    byModule.get(a.module_id)!.rows.push(a)

    if (!a.section_id) {
      requiredSectionsByModule.set(a.module_id, null)
    } else if (requiredSectionsByModule.get(a.module_id) !== null) {
      const set = requiredSectionsByModule.get(a.module_id) ?? new Set<string>()
      set.add(a.section_id)
      requiredSectionsByModule.set(a.module_id, set)
    }
  }

  const isSectionRequired = (moduleId: string, sectionId: string) => {
    const required = requiredSectionsByModule.get(moduleId)
    return !required || required.has(sectionId)
  }

  const totalByModule: Record<string, number> = {}
  const completedByModule: Record<string, number> = {}
  const lastActivityByModule: Record<string, string> = {}
  const completedSectionIds = new Set<string>()
  // Required sections per module, in course order — the first one not yet
  // completed is where "Continue" should drop the learner.
  const requiredSectionsInOrder = new Map<string, { id: string; title: string }[]>()

  for (const row of sectionCounts ?? []) {
    if (!isSectionRequired(row.module_id, row.id)) continue
    totalByModule[row.module_id] = (totalByModule[row.module_id] ?? 0) + 1
    const list = requiredSectionsInOrder.get(row.module_id) ?? []
    list.push({ id: row.id, title: row.title })
    requiredSectionsInOrder.set(row.module_id, list)
  }
  for (const row of (completedSections ?? []) as any[]) {
    const moduleId = row.sections?.module_id
    if (moduleId && isSectionRequired(moduleId, row.section_id)) {
      completedByModule[moduleId] = (completedByModule[moduleId] ?? 0) + 1
      completedSectionIds.add(row.section_id)
      if (!lastActivityByModule[moduleId] || row.completed_at > lastActivityByModule[moduleId]) {
        lastActivityByModule[moduleId] = row.completed_at
      }
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const assignmentsWithProgress = [...byModule.entries()]
    .map(([moduleId, { rows }]) => {
      const dueDates = rows.map(r => r.due_date).filter(Boolean) as string[]
      const earliestDueDate = dueDates.length ? dueDates.sort()[0] : null
      const percent = totalByModule[moduleId]
        ? Math.round(((completedByModule[moduleId] ?? 0) / totalByModule[moduleId]) * 100)
        : 0
      const nextSection = (requiredSectionsInOrder.get(moduleId) ?? []).find(s => !completedSectionIds.has(s.id))
      return {
        ...rows[0],
        module_id: moduleId,
        due_date: earliestDueDate,
        completed: completedByModule[moduleId] ?? 0,
        total: totalByModule[moduleId] ?? 0,
        percent,
        overdue: !!earliestDueDate && earliestDueDate < today && percent < 100,
        lastActivity: lastActivityByModule[moduleId] ?? null,
        nextSectionTitle: nextSection?.title ?? null,
      }
    })
    // Most urgent first: overdue, then required (auto-assigned-to-everyone),
    // then in progress, then not started (soonest due date first), finished last.
    .sort((a, b) => {
      const rank = (x: typeof a) =>
        x.percent === 100 ? 4 : x.overdue ? 0 : x.module?.auto_assign_all ? 1 : x.percent > 0 ? 2 : 3
      return rank(a) - rank(b) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
    })

  const completedCount = assignmentsWithProgress.filter(a => a.percent === 100).length
  const inProgressCount = assignmentsWithProgress.filter(a => a.percent > 0 && a.percent < 100).length
  const notStartedCount = assignmentsWithProgress.filter(a => a.percent === 0).length
  const overdueCount = assignmentsWithProgress.filter(a => a.overdue).length

  // "Continue where you left off": the in-progress training touched most recently.
  const continueItem = assignmentsWithProgress
    .filter(a => a.percent > 0 && a.percent < 100)
    .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''))[0] ?? null

  // Learning paths (job-role / onboarding sequences). Empty until paths exist.
  const userPaths = (await loadUserPaths(supabase, user.id)).filter(p => p.percent < 100)

  const dashboardTrainings: DashboardTraining[] = assignmentsWithProgress.map(a => ({
    moduleId: a.module_id,
    title: a.module?.title ?? 'Untitled training',
    category: a.module?.category ?? '',
    minutes: a.module?.estimated_minutes ?? 0,
    dueDate: a.due_date,
    percent: a.percent,
    required: !!a.module?.auto_assign_all,
    overdue: a.overdue,
    nextSectionTitle: a.nextSectionTitle,
  }))

  // Recommended: published trainings not assigned to this employee, favoring
  // the categories they already work in, then newest first. Only trainings
  // that actually have content are suggested.
  const { data: publishedModules } = await supabase
    .from('modules')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false }) as { data: Module[] | null }

  const assignedIds = new Set(moduleIds)
  const candidates = (publishedModules ?? []).filter(m => !assignedIds.has(m.id))
  const { data: candidateSections } = await supabase
    .from('sections')
    .select('module_id')
    .in('module_id', candidates.length ? candidates.map(m => m.id) : [''])
    .eq('is_archived', false)
  const modulesWithContent = new Set((candidateSections ?? []).map(s => s.module_id))

  const categoryWeight: Record<string, number> = {}
  for (const a of assignmentsWithProgress) {
    const c = a.module?.category
    if (c) categoryWeight[c] = (categoryWeight[c] ?? 0) + 1
  }
  const recommended = candidates
    .filter(m => modulesWithContent.has(m.id))
    .map((m, i) => ({ m, weight: categoryWeight[m.category] ?? 0, i }))
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
    .slice(0, 4)
    .map(x => x.m)

  // Score summary (condensed — full history lives at /score-summary)
  const { data: quizAttempts } = await supabase
    .from('quiz_attempts')
    .select('score, max_score')
    .eq('user_id', user.id)
  const scoredAttempts = (quizAttempts ?? []).filter(a => a.max_score > 0)
  const avgScore = scoredAttempts.length > 0
    ? Math.round(scoredAttempts.reduce((s, a) => s + (a.score / a.max_score) * 100, 0) / scoredAttempts.length)
    : null

  // My certificates
  const { data: myCertificates } = await supabase
    .from('certificates')
    .select('*')
    .eq('user_id', user.id)
    .order('issued_at', { ascending: false }) as { data: Certificate[] | null }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Dashboard" />

      <main className="flex-1 p-6 space-y-6">
        {/* Welcome banner */}
        <div className="rounded-2xl bg-gradient-to-r from-[#241B4E] to-[#3a2d7a] p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="bg-white rounded-xl p-3 shrink-0 self-start">
            <img
              src="/branding/ucb-environmental-logo.png"
              alt="UCB Environmental"
              className="h-12 w-auto"
            />
          </div>
          <div className="sm:border-l sm:border-white/20 sm:pl-6">
            <p className="text-xs uppercase tracking-widest text-[#7CC24A] font-semibold">UCB Training Portal</p>
            <h2 className="text-xl font-bold">Welcome back, {profile.full_name.split(' ')[0]}!</h2>
            <p className="text-sm text-white/70 mt-0.5">You're crushing it — keep that training streak alive! 🌱</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {[
            { label: 'Assigned', value: assignmentsWithProgress.length, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed', value: completedCount, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'In Progress', value: inProgressCount, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Not Started', value: notStartedCount, icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50' },
            { label: 'Overdue', value: overdueCount, icon: AlertTriangle, color: overdueCount > 0 ? 'text-red-600' : 'text-slate-400', bg: overdueCount > 0 ? 'bg-red-50' : 'bg-slate-50' },
          ].map((stat) => (
            <Card key={stat.label} className={stat.label === 'Overdue' ? 'col-span-2 lg:col-span-1' : undefined}>
              <CardContent className="p-4 sm:p-5">
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

        {/* Learning paths in progress */}
        {userPaths.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5 text-blue-600" /> My Learning Paths
              </CardTitle>
              <Link href="/paths" className="text-sm text-blue-600 hover:underline">View all</Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userPaths.slice(0, 3).map(p => (
                  <Link
                    key={p.path.id}
                    href="/paths"
                    className="block rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900 truncate">
                        {p.path.kind === 'onboarding' && (
                          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-blue-700">Onboarding</span>
                        )}
                        {p.path.title}
                      </p>
                      <span className="text-xs text-slate-500 shrink-0">{p.completedSteps}/{p.steps.length} done</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={p.percent} className="flex-1 h-1.5" />
                      <span className="text-xs text-slate-500 shrink-0">{p.percent}%</span>
                    </div>
                    {p.nextStep && (
                      <p className="text-sm text-slate-500 mt-2 truncate">Next: {p.nextStep.module.title}</p>
                    )}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Continue where you left off */}
        {continueItem && (
          <Link href={`/training/${continueItem.module_id}`} className="block group">
            <Card className="border-blue-200 bg-blue-50/40 group-hover:bg-blue-50 transition-colors">
              <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <PlayCircle className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Continue where you left off</p>
                  <p className="font-semibold text-slate-900 truncate">{continueItem.module?.title}</p>
                  {continueItem.nextSectionTitle && (
                    <p className="text-sm text-slate-500 truncate">Next up: {continueItem.nextSectionTitle}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={continueItem.percent} className="flex-1 h-1.5" />
                    <span className="text-xs text-slate-500 shrink-0">{continueItem.percent}%</span>
                  </div>
                </div>
                <span className="hidden sm:inline-flex shrink-0 items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white group-hover:bg-blue-700">
                  Resume
                </span>
              </CardContent>
            </Card>
          </Link>
        )}

        <Card>
          <CardHeader>
            <CardTitle>My Assigned Trainings</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignedTrainings trainings={dashboardTrainings} />
          </CardContent>
        </Card>

        {/* Recommended for you */}
        {recommended.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" /> Recommended for you
              </CardTitle>
              <Link href="/training" className="text-sm text-blue-600 hover:underline">Browse all courses</Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommended.map(m => (
                  <Link
                    key={m.id}
                    href={`/training/${m.id}`}
                    className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white font-bold"
                      style={{ backgroundColor: getCategoryColor(m.category) }}
                    >
                      {m.title.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{m.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {getCategoryLabel(m.category)} · {m.estimated_minutes} min
                      </p>
                      {m.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mt-1">{m.description}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Score summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Score Summary</CardTitle>
            <Link href="/score-summary" className="text-sm text-blue-600 hover:underline">View full history</Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Average Score</p>
                  <p className="text-xl font-bold text-slate-900">{avgScore !== null ? `${avgScore}%` : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Certificates Earned</p>
                  <p className="text-xl font-bold text-slate-900">{myCertificates?.length ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Quiz Attempts</p>
                  <p className="text-xl font-bold text-slate-900">{quizAttempts?.length ?? 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My certificates */}
        <Card>
          <CardHeader>
            <CardTitle>My Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            {!myCertificates || myCertificates.length === 0 ? (
              <div className="text-center py-10">
                <Award className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 font-medium text-sm">No certificates yet</p>
                <p className="text-slate-400 text-xs mt-1">Complete a training to earn one automatically.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myCertificates.map(cert => (
                  <div key={cert.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                      <Award className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{cert.module_title}</p>
                      <p className="text-xs text-slate-400">
                        Issued {formatDate(cert.issued_at)}
                        {cert.max_score ? ` · Score: ${cert.score}/${cert.max_score}` : ''}
                      </p>
                    </div>
                    <a
                      href={`/api/certificate?certificateId=${cert.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
