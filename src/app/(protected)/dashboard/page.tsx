import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BookOpen, CheckCircle, Clock, TrendingUp, Star, Target, Award, Download } from 'lucide-react'
import Link from 'next/link'
import { cn, getCategoryColor, getCategoryLabel, formatDate } from '@/lib/utils'
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
    .select('module_id, id')
    .in('module_id', moduleIds.length ? moduleIds : [''])
    .eq('is_archived', false)

  const { data: completedSections } = await supabase
    .from('section_progress')
    .select('section_id, sections!inner(module_id, is_archived)')
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

  for (const row of sectionCounts ?? []) {
    if (!isSectionRequired(row.module_id, row.id)) continue
    totalByModule[row.module_id] = (totalByModule[row.module_id] ?? 0) + 1
  }
  for (const row of (completedSections ?? []) as any[]) {
    const moduleId = row.sections?.module_id
    if (moduleId && isSectionRequired(moduleId, row.section_id)) {
      completedByModule[moduleId] = (completedByModule[moduleId] ?? 0) + 1
    }
  }

  const assignmentsWithProgress = [...byModule.entries()]
    .map(([moduleId, { rows }]) => {
      const dueDates = rows.map(r => r.due_date).filter(Boolean) as string[]
      const earliestDueDate = dueDates.length ? dueDates.sort()[0] : null
      return {
        ...rows[0],
        module_id: moduleId,
        due_date: earliestDueDate,
        completed: completedByModule[moduleId] ?? 0,
        total: totalByModule[moduleId] ?? 0,
        percent: totalByModule[moduleId]
          ? Math.round(((completedByModule[moduleId] ?? 0) / totalByModule[moduleId]) * 100)
          : 0,
      }
    })
    // Required (auto-assigned-to-everyone) trainings always pin to the top
    .sort((a, b) => Number(b.module?.auto_assign_all) - Number(a.module?.auto_assign_all))

  const completedCount = assignmentsWithProgress.filter(a => a.percent === 100).length
  const inProgressCount = assignmentsWithProgress.filter(a => a.percent > 0 && a.percent < 100).length
  const notStartedCount = assignmentsWithProgress.filter(a => a.percent === 0).length

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
        {/* Welcome banner — white so the logo (opaque white background) sits naturally */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 flex flex-col items-center text-center gap-4">
          <img
            src="/branding/ucb-family-of-logos.png"
            alt="UCB — a family of companies"
            className="h-20 sm:h-24 w-auto"
          />
          <div className="border-t border-slate-200 pt-4 w-full max-w-md">
            <p className="text-xs uppercase tracking-widest text-green-600 font-semibold">UCB Training Portal</p>
            <h2 className="text-xl font-bold text-[#241B4E]">Welcome back, {profile.full_name.split(' ')[0]}!</h2>
            <p className="text-sm text-slate-500 mt-0.5">Keep up the great work on your training.</p>
          </div>
        </div>

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
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-xl border transition-all group',
                      a.module?.auto_assign_all
                        ? 'border-amber-300 ring-1 ring-amber-300 bg-amber-50/40 hover:bg-amber-50'
                        : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'
                    )}
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
                        {a.module?.auto_assign_all && (
                          <Badge className="bg-amber-400 text-amber-950 flex items-center gap-1">
                            <Star className="h-3 w-3 fill-current" /> Required
                          </Badge>
                        )}
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
