import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, getCategoryLabel } from '@/lib/utils'
import { Award, Target, ListChecks, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PASS_THRESHOLD = 70

export default async function ScoreSummaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: quizAttempts } = await supabase
    .from('quiz_attempts')
    .select('id, content_block_id, score, max_score, completed_at')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false })

  const attempts = quizAttempts ?? []
  const blockIds = [...new Set(attempts.map(a => a.content_block_id))]

  const { data: contentBlocks } = await supabase
    .from('content_blocks')
    .select('id, section_id')
    .in('id', blockIds.length ? blockIds : [''])

  const sectionIds = [...new Set((contentBlocks ?? []).map(cb => cb.section_id))]

  const { data: sections } = await supabase
    .from('sections')
    .select('id, module_id')
    .in('id', sectionIds.length ? sectionIds : [''])

  const moduleIds = [...new Set((sections ?? []).map(s => s.module_id))]

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title, category')
    .in('id', moduleIds.length ? moduleIds : [''])

  const sectionToModule: Record<string, string> = {}
  for (const s of sections ?? []) sectionToModule[s.id] = s.module_id

  const blockToModule: Record<string, string> = {}
  for (const cb of contentBlocks ?? []) {
    const moduleId = sectionToModule[cb.section_id]
    if (moduleId) blockToModule[cb.id] = moduleId
  }

  const moduleById: Record<string, { title: string; category: string }> = {}
  for (const m of modules ?? []) moduleById[m.id] = { title: m.title, category: m.category }

  // Best score per module
  const bestByModule: Record<string, { score: number; max: number; pct: number }> = {}
  for (const a of attempts) {
    const moduleId = blockToModule[a.content_block_id]
    if (!moduleId || a.max_score <= 0) continue
    const pct = Math.round((a.score / a.max_score) * 100)
    if (!bestByModule[moduleId] || pct > bestByModule[moduleId].pct) {
      bestByModule[moduleId] = { score: a.score, max: a.max_score, pct }
    }
  }

  const moduleScores = Object.entries(bestByModule)
    .map(([moduleId, best]) => ({ moduleId, mod: moduleById[moduleId], ...best }))
    .filter(m => m.mod)
    .sort((a, b) => a.mod.title.localeCompare(b.mod.title))

  const scored = attempts.filter(a => a.max_score > 0)
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, a) => s + (a.score / a.max_score) * 100, 0) / scored.length)
    : null
  const passedModules = moduleScores.filter(m => m.pct >= PASS_THRESHOLD).length

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="My Score Summary" />
      <main className="flex-1 p-6 space-y-6">
        {attempts.length === 0 ? (
          <div className="text-center py-20">
            <ListChecks className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No quiz attempts yet</p>
            <p className="text-slate-400 text-sm mt-1">Scores will show up here once you complete a quiz.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Average Score</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{avgScore !== null ? `${avgScore}%` : '—'}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Trainings Passed</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{passedModules}/{moduleScores.length}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <Award className="h-5 w-5 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Attempts</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{attempts.length}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <ListChecks className="h-5 w-5 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Per-module best score */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Training</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Best Score</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Result</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {moduleScores.map(m => (
                      <tr key={m.moduleId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{m.mod.title}</td>
                        <td className="px-4 py-3 text-slate-500">{getCategoryLabel(m.mod.category)}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{m.score}/{m.max} ({m.pct}%)</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={m.pct >= PASS_THRESHOLD ? 'success' : 'danger'}>
                            {m.pct >= PASS_THRESHOLD ? 'Passed' : 'Failed'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/training/${m.moduleId}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Attempt history */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quiz History</p>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Score</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attempts.slice(0, 30).map(a => {
                        const pct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0
                        return (
                          <tr key={a.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-500">{formatDate(a.completed_at)}</td>
                            <td className="px-4 py-3 text-center font-medium text-slate-700">{a.score}/{a.max_score} ({pct}%)</td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant={pct >= PASS_THRESHOLD ? 'success' : 'danger'}>
                                {pct >= PASS_THRESHOLD ? 'Passed' : 'Failed'}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
