'use client'

import { useState, useMemo, Fragment } from 'react'
import { Search, ChevronDown, ChevronUp, BarChart3, CheckCircle, Clock, AlertCircle, Trophy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Profile, Module } from '@/types'
import { formatDate } from '@/lib/utils'

interface Props {
  employees: Profile[]
  modules: Module[]
  assignments: { id: string; user_id: string; module_id: string; assigned_at: string; due_date: string | null }[]
  sections: { id: string; module_id: string; title: string; order_index: number }[]
  progress: { user_id: string; section_id: string; completed_at: string; sections: { module_id: string } }[]
  quizAttempts: { id: string; user_id: string; content_block_id: string; score: number; max_score: number; completed_at: string }[]
  viewerRole: string
}

export function ReportsView({ employees, modules, assignments, sections, progress, quizAttempts, viewerRole }: Props) {
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Build lookup tables
  const totalByModule = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of sections) {
      map[s.module_id] = (map[s.module_id] ?? 0) + 1
    }
    return map
  }, [sections])

  const completedByUserModule = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of progress) {
      const moduleId = p.sections?.module_id
      if (moduleId) {
        const key = `${p.user_id}_${moduleId}`
        map[key] = (map[key] ?? 0) + 1
      }
    }
    return map
  }, [progress])

  const completionDateByUserModule = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of progress) {
      const moduleId = p.sections?.module_id
      if (!moduleId) continue
      const key = `${p.user_id}_${moduleId}`
      if (!map[key] || p.completed_at > map[key]) map[key] = p.completed_at
    }
    return map
  }, [progress])

  // Best score per user per block
  const bestScoreByUserBlock = useMemo(() => {
    const map: Record<string, { score: number; max: number; pct: number; attempts: number }> = {}
    for (const a of quizAttempts) {
      const key = `${a.user_id}_${a.content_block_id}`
      const pct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0
      if (!map[key] || pct > map[key].pct) {
        map[key] = { score: a.score, max: a.max_score, pct, attempts: 0 }
      }
      map[key].attempts = (map[key].attempts ?? 0) + 1
    }
    return map
  }, [quizAttempts])

  const departments = useMemo(() => {
    const depts = [...new Set(employees.map(e => e.department).filter(Boolean))]
    return depts.sort() as string[]
  }, [employees])

  // Per-employee summary
  const employeeData = useMemo(() => employees.map(emp => {
    const empAssignments = assignments.filter(a => a.user_id === emp.id)
    let completed = 0, overdue = 0
    for (const a of empAssignments) {
      const done = completedByUserModule[`${emp.id}_${a.module_id}`] ?? 0
      const total = totalByModule[a.module_id] ?? 0
      if (total > 0 && done >= total) completed++
      else if (a.due_date && a.due_date < today) overdue++
    }
    const pct = empAssignments.length > 0 ? Math.round((completed / empAssignments.length) * 100) : 0

    const empAttempts = quizAttempts.filter(a => a.user_id === emp.id)
    const avgScore = empAttempts.length > 0
      ? Math.round(empAttempts.reduce((s, a) => s + (a.max_score > 0 ? (a.score / a.max_score) * 100 : 0), 0) / empAttempts.length)
      : null
    const bestScore = empAttempts.length > 0
      ? Math.max(...empAttempts.map(a => a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0))
      : null

    const status = overdue > 0 ? 'overdue'
      : pct === 100 && empAssignments.length > 0 ? 'complete'
      : pct > 0 ? 'in_progress'
      : empAssignments.length > 0 ? 'not_started'
      : 'unassigned'

    return {
      emp,
      assignments: empAssignments,
      completed,
      overdue,
      pct,
      avgScore,
      bestScore,
      totalAttempts: empAttempts.length,
      status,
    }
  }), [employees, assignments, completedByUserModule, totalByModule, quizAttempts, today])

  const filtered = useMemo(() => employeeData.filter(ed => {
    if (search && !ed.emp.full_name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterDept !== 'all' && ed.emp.department !== filterDept) return false
    if (filterStatus !== 'all' && ed.status !== filterStatus) return false
    return true
  }), [employeeData, search, filterDept, filterStatus])

  // Summary stats
  const totalComplete = employeeData.filter(e => e.status === 'complete').length
  const totalOverdue = employeeData.filter(e => e.status === 'overdue').length
  const avgCompletion = employeeData.length > 0
    ? Math.round(employeeData.reduce((s, e) => s + e.pct, 0) / employeeData.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: employees.length, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Fully Complete', value: totalComplete, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Avg Completion', value: `${avgCompletion}%`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'With Overdue', value: totalOverdue, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search employee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {departments.length > 0 && (
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{filtered.length} of {employees.length} employees</span>
      </div>

      {/* Employee table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Location</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Trainings</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 min-w-[140px]">Progress</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Avg Score</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Attempts</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">No employees match your filters</td>
                </tr>
              ) : filtered.map(({ emp, assignments: empA, completed, overdue, pct, avgScore, totalAttempts, status }) => {
                const isExpanded = expandedEmployee === emp.id
                return (
                  <Fragment key={emp.id}>
                    <tr
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {emp.full_name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900">{emp.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{emp.department ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{completed}/{empA.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="flex-1 h-1.5" />
                          <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {avgScore !== null
                          ? <Badge variant={avgScore >= 70 ? 'success' : 'danger'}>{avgScore}%</Badge>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">{totalAttempts || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {status === 'overdue' ? <Badge variant="danger">Overdue</Badge>
                          : status === 'complete' ? <Badge variant="success">Complete</Badge>
                          : status === 'in_progress' ? <Badge variant="warning">In Progress</Badge>
                          : status === 'not_started' ? <Badge variant="outline">Not Started</Badge>
                          : <span className="text-slate-300 text-xs">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Module Detail for {emp.full_name}</p>
                            {empA.length === 0 ? (
                              <p className="text-slate-400 text-sm">No training assignments</p>
                            ) : empA.map(a => {
                              const mod = modules.find(m => m.id === a.module_id)
                              if (!mod) return null
                              const done = completedByUserModule[`${emp.id}_${a.module_id}`] ?? 0
                              const total = totalByModule[a.module_id] ?? 0
                              const modPct = total > 0 ? Math.round((done / total) * 100) : 0
                              const completedDate = completionDateByUserModule[`${emp.id}_${a.module_id}`]
                              const empModAttempts = quizAttempts.filter(qa => qa.user_id === emp.id)
                              const modScores = empModAttempts.map(qa => qa.max_score > 0 ? Math.round((qa.score / qa.max_score) * 100) : 0)
                              const bestModScore = modScores.length > 0 ? Math.max(...modScores) : null

                              return (
                                <div key={a.id} className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <p className="font-medium text-slate-800 text-sm">{mod.title}</p>
                                      <Badge variant={modPct === 100 ? 'success' : modPct > 0 ? 'warning' : 'outline'} className="text-xs">
                                        {modPct === 100 ? 'Complete' : modPct > 0 ? `${modPct}%` : 'Not started'}
                                      </Badge>
                                      {a.due_date && a.due_date < today && modPct < 100 && (
                                        <Badge variant="danger" className="text-xs">Overdue</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Progress value={modPct} className="flex-1 h-1" />
                                      <span className="text-xs text-slate-400 shrink-0">{done}/{total} sections</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 shrink-0 text-xs text-slate-500">
                                    {bestModScore !== null && (
                                      <div className="flex items-center gap-1">
                                        <Trophy className="h-3.5 w-3.5 text-amber-500" />
                                        <span>Best: {bestModScore}%</span>
                                      </div>
                                    )}
                                    {completedDate && (
                                      <span>Done: {formatDate(completedDate)}</span>
                                    )}
                                    {a.due_date && (
                                      <span className={a.due_date < today && modPct < 100 ? 'text-red-500' : ''}>
                                        Due: {formatDate(a.due_date)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}

                            {/* Quiz attempt history */}
                            {quizAttempts.filter(qa => qa.user_id === emp.id).length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quiz History</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                                    <thead className="bg-slate-100">
                                      <tr>
                                        <th className="text-left px-3 py-2 text-slate-600 font-medium">Date</th>
                                        <th className="text-center px-3 py-2 text-slate-600 font-medium">Score</th>
                                        <th className="text-center px-3 py-2 text-slate-600 font-medium">Result</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {quizAttempts.filter(qa => qa.user_id === emp.id).slice(0, 20).map(qa => {
                                        const pct = qa.max_score > 0 ? Math.round((qa.score / qa.max_score) * 100) : 0
                                        return (
                                          <tr key={qa.id}>
                                            <td className="px-3 py-2 text-slate-500">{formatDate(qa.completed_at)}</td>
                                            <td className="px-3 py-2 text-center font-medium">{qa.score}/{qa.max_score} ({pct}%)</td>
                                            <td className="px-3 py-2 text-center">
                                              <Badge variant={pct >= 70 ? 'success' : 'danger'} className="text-xs">
                                                {pct >= 70 ? 'Passed' : 'Failed'}
                                              </Badge>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
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
