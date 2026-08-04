'use client'

import { useState, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Search, ChevronDown, ChevronUp, BarChart3, CheckCircle, Clock, AlertCircle, Download,
  Check, X, Trash2, Award, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Profile, Module } from '@/types'
import { formatDate, getCategoryLabel } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// Production facility codes — employees at these locations get the Production tab
const PRODUCTION_CODES = ['HA', 'ML', 'HV', 'MLC', 'HVP']

function isProductionEmployee(dept: string | null | undefined) {
  if (!dept) return false
  return PRODUCTION_CODES.some(code => dept.toUpperCase().startsWith(code))
}

type ManualCompletion = {
  id: string
  user_id: string
  module_id: string
  score: number
  max_score: number
  passed: boolean
  trainer_id: string | null
  completion_date: string
  location: string | null
  notes: string | null
  created_at: string
}

interface Props {
  employees: Profile[]
  modules: Module[]
  assignments: { id: string; user_id: string; module_id: string; assigned_at: string; due_date: string | null }[]
  sections: { id: string; module_id: string; title: string; order_index: number }[]
  contentBlocks: { id: string; section_id: string; type: string }[]
  progress: { user_id: string; section_id: string; completed_at: string; sections: { module_id: string } }[]
  quizAttempts: { id: string; user_id: string; content_block_id: string; score: number; max_score: number; completed_at: string }[]
  manualCompletions?: ManualCompletion[]
  viewerRole: string
}

export function ReportsView({ employees, modules, assignments: rawAssignments, sections, contentBlocks, progress, quizAttempts, manualCompletions = [], viewerRole }: Props) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'all' | 'office' | 'production'>('all')
  const [search, setSearch] = useState('')
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const assignments = useMemo(
    () => rawAssignments.filter(a => !removedIds.has(a.id)),
    [rawAssignments, removedIds]
  )
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  // Production tab state
  const [prodFacility, setProdFacility] = useState('all')
  const [prodScope, setProdScope] = useState<'combined' | 'warehouse' | 'lms'>('combined')

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

  // Which content types (text/video/quiz) each module actually contains
  const sectionToModule = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of sections) map[s.id] = s.module_id
    return map
  }, [sections])

  const contentTypesByModule = useMemo(() => {
    const map: Record<string, { text: boolean; video: boolean; quiz: boolean }> = {}
    for (const cb of contentBlocks) {
      const moduleId = sectionToModule[cb.section_id]
      if (!moduleId) continue
      const entry = map[moduleId] ?? (map[moduleId] = { text: false, video: false, quiz: false })
      if (cb.type === 'text') entry.text = true
      else if (cb.type === 'video') entry.video = true
      else if (cb.type === 'quiz') entry.quiz = true
    }
    return map
  }, [contentBlocks, sectionToModule])

  const contentBlockToModule = useMemo(() => {
    const map: Record<string, string> = {}
    for (const cb of contentBlocks) {
      const moduleId = sectionToModule[cb.section_id]
      if (moduleId) map[cb.id] = moduleId
    }
    return map
  }, [contentBlocks, sectionToModule])

  // Best raw quiz score (not just %) per user per module, for the "Score" column
  const bestRawScoreByUserModule = useMemo(() => {
    const map: Record<string, { score: number; max: number; pct: number }> = {}
    for (const qa of quizAttempts) {
      const moduleId = contentBlockToModule[qa.content_block_id]
      if (!moduleId || qa.max_score <= 0) continue
      const key = `${qa.user_id}_${moduleId}`
      const pct = Math.round((qa.score / qa.max_score) * 100)
      if (!map[key] || pct > map[key].pct) map[key] = { score: qa.score, max: qa.max_score, pct }
    }
    return map
  }, [quizAttempts, contentBlockToModule])

  // Most recent manual completion per user per module (for certificates recorded outside the app)
  const manualByUserModule = useMemo(() => {
    const map: Record<string, ManualCompletion> = {}
    for (const m of manualCompletions) {
      const key = `${m.user_id}_${m.module_id}`
      if (!map[key] || m.completion_date > map[key].completion_date) map[key] = m
    }
    return map
  }, [manualCompletions])

  async function handleRemoveAssignment(assignmentId: string, employeeName: string, moduleTitle: string) {
    if (!confirm(`Remove "${moduleTitle}" from ${employeeName}? This cannot be undone.`)) return
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId)
    if (error) { toast.error(error.message); return }
    setRemovedIds(prev => new Set(prev).add(assignmentId))
    toast.success(`Removed "${moduleTitle}" from ${employeeName}`)
  }

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

  // Divide employees into office vs production
  const productionEmployees = useMemo(() => employees.filter(e => isProductionEmployee(e.department)), [employees])
  const officeEmployees = useMemo(() => employees.filter(e => !isProductionEmployee(e.department)), [employees])

  // Production facilities list
  const productionFacilities = useMemo(() => {
    const locs = [...new Set(productionEmployees.map(e => e.department).filter(Boolean))] as string[]
    return locs.sort()
  }, [productionEmployees])

  // Employees shown in current tab (all/office only — production has its own view)
  const tabEmployees = useMemo(() => {
    if (activeTab === 'office') return officeEmployees
    return employees
  }, [activeTab, employees, officeEmployees])

  // Per-employee summary
  const employeeData = useMemo(() => tabEmployees.map(emp => {
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

  function exportCSV() {
    const headers = ['Employee', 'Location', 'Trainings Completed', 'Trainings Assigned', 'Completion %', 'Avg Quiz Score', 'Total Attempts', 'Status']
    const rows = employeeData.map(({ emp, assignments: empA, completed, pct, avgScore, totalAttempts, status }) => [
      emp.full_name,
      emp.department ?? '',
      completed,
      empA.length,
      `${pct}%`,
      avgScore !== null ? `${avgScore}%` : '',
      totalAttempts,
      status.replace('_', ' '),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Production tab computed stats ──────────────────────────────
  const prodEmployees = useMemo(() =>
    prodFacility === 'all' ? productionEmployees : productionEmployees.filter(e => e.department === prodFacility),
    [productionEmployees, prodFacility]
  )

  const prodStats = useMemo(() => {
    const empIds = new Set(prodEmployees.map(e => e.id))
    const myAssignments = assignments.filter(a => empIds.has(a.user_id))
    const myManual = manualCompletions.filter(m => empIds.has(m.user_id))
    const today = new Date().toISOString().split('T')[0]

    // Warehouse stats
    const warehouseCompleted = myManual.filter(m => m.passed).length
    const warehouseRetakes = myManual.filter(m => !m.passed).length

    // LMS stats
    const lmsCompleted = myAssignments.filter(a => {
      const done = completedByUserModule[`${a.user_id}_${a.module_id}`] ?? 0
      const total = totalByModule[a.module_id] ?? 0
      return total > 0 && done >= total
    }).length
    const lmsPending = myAssignments.filter(a => {
      const done = completedByUserModule[`${a.user_id}_${a.module_id}`] ?? 0
      const total = totalByModule[a.module_id] ?? 0
      return !(total > 0 && done >= total)
    }).length

    // Combined completion
    const totalAssigned = myAssignments.length + myManual.length
    const totalCompleted = lmsCompleted + warehouseCompleted
    const combinedPct = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0

    // Per-employee status
    const empStats = prodEmployees.map(emp => {
      const empA = myAssignments.filter(a => a.user_id === emp.id)
      const empM = myManual.filter(m => m.user_id === emp.id)
      const lmsDone = empA.filter(a => {
        const done = completedByUserModule[`${emp.id}_${a.module_id}`] ?? 0
        const total = totalByModule[a.module_id] ?? 0
        return total > 0 && done >= total
      }).length
      const warehouseDone = empM.filter(m => m.passed).length
      const totalEmpAssigned = empA.length + empM.length
      const totalEmpDone = lmsDone + warehouseDone
      const overdue = empA.some(a => a.due_date && a.due_date < today && (completedByUserModule[`${emp.id}_${a.module_id}`] ?? 0) < (totalByModule[a.module_id] ?? 1))
      const failed = empM.some(m => !m.passed)
      const status = totalEmpAssigned === 0 ? 'unassigned'
        : overdue ? 'overdue'
        : failed ? 'failed'
        : totalEmpDone >= totalEmpAssigned ? 'complete'
        : totalEmpDone > 0 ? 'in_progress'
        : 'not_started'
      return { emp, lmsDone, warehouseDone, totalEmpAssigned, totalEmpDone, status, empA, empM }
    })

    const fullyTrained = empStats.filter(e => e.status === 'complete').length
    const inProgress = empStats.filter(e => e.status === 'in_progress').length
    const overdueCount = empStats.filter(e => e.status === 'overdue').length
    const failedCount = empStats.filter(e => e.status === 'failed').length

    return { warehouseCompleted, warehouseRetakes, lmsCompleted, lmsPending, combinedPct, totalAssigned, totalCompleted, empStats, fullyTrained, inProgress, overdueCount, failedCount }
  }, [prodEmployees, assignments, manualCompletions, completedByUserModule, totalByModule])

  return (
    <div className="space-y-6">
      {/* Division tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {([['all', 'All Divisions'], ['office', 'Office'], ['production', 'Production']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs text-slate-400">
              {key === 'all' ? employees.length : key === 'office' ? officeEmployees.length : productionEmployees.length}
            </span>
          </button>
        ))}
      </div>

      {/* Production tab */}
      {activeTab === 'production' && (
        <div className="space-y-5">
          {/* Filters row */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={prodFacility} onValueChange={setProdFacility}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All facilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                {productionFacilities.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {([['combined', 'Combined'], ['warehouse', 'Warehouse Only'], ['lms', 'LMS Only']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setProdScope(key)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    prodScope === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-500">{prodEmployees.length} employees</span>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {prodScope !== 'lms' && (
              <>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">Warehouse Completed</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{prodStats.warehouseCompleted}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">Retakes Required</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{prodStats.warehouseRetakes}</p>
                  </CardContent>
                </Card>
              </>
            )}
            {prodScope !== 'warehouse' && (
              <>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">LMS Completed</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{prodStats.lmsCompleted}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500">LMS Pending</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{prodStats.lmsPending}</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Overall completion */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800">
                  {prodScope === 'combined' ? 'Combined' : prodScope === 'warehouse' ? 'Warehouse' : 'LMS'} Production Completion
                </p>
                <span className="text-2xl font-bold text-slate-900">{prodStats.combinedPct}%</span>
              </div>
              <Progress value={prodStats.combinedPct} className="h-2" />
              <p className="text-xs text-slate-400">{prodStats.totalCompleted} of {prodStats.totalAssigned} assigned trainings completed</p>
              <div className="grid grid-cols-4 gap-3 pt-1">
                {[
                  { label: 'Employees', value: prodEmployees.length, color: 'text-slate-700' },
                  { label: 'Fully Trained', value: prodStats.fullyTrained, color: 'text-green-600' },
                  { label: 'In Progress', value: prodStats.inProgress, color: 'text-amber-600' },
                  { label: 'Overdue', value: prodStats.overdueCount, color: 'text-red-600' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Employee breakdown */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Facility</th>
                    {prodScope !== 'lms' && <th className="text-center px-4 py-3 font-medium text-slate-600">Warehouse</th>}
                    {prodScope !== 'warehouse' && <th className="text-center px-4 py-3 font-medium text-slate-600">LMS</th>}
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prodStats.empStats.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">No employees</td></tr>
                  ) : prodStats.empStats.map(({ emp, lmsDone, warehouseDone, empA, empM, status }) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {emp.full_name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900">{emp.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{emp.department ?? '—'}</td>
                      {prodScope !== 'lms' && (
                        <td className="px-4 py-3 text-center">
                          <span className="text-slate-700">{warehouseDone}/{empM.length}</span>
                          {empM.some(m => !m.passed) && <Badge variant="danger" className="ml-1 text-xs">Retake</Badge>}
                        </td>
                      )}
                      {prodScope !== 'warehouse' && (
                        <td className="px-4 py-3 text-center text-slate-700">{lmsDone}/{empA.length}</td>
                      )}
                      <td className="px-4 py-3 text-center">
                        {status === 'complete' ? <Badge variant="success">Trained</Badge>
                          : status === 'in_progress' ? <Badge variant="warning">In Progress</Badge>
                          : status === 'overdue' ? <Badge variant="danger">Overdue</Badge>
                          : status === 'failed' ? <Badge variant="danger">Retake</Badge>
                          : status === 'not_started' ? <Badge variant="outline">Not Started</Badge>
                          : <span className="text-slate-300 text-xs">Unassigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* All Divisions / Office tab content */}
      {activeTab !== 'production' && <>

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
        <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto gap-1.5">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
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
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100">
                                    <tr>
                                      <th className="text-left px-3 py-2 font-medium text-slate-600">Training</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Read</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Watch</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Test</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Score</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Certificate</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Completed</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Review</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Deadline</th>
                                      <th className="text-center px-3 py-2 font-medium text-slate-600">Remove</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {empA.map(a => {
                                      const mod = modules.find(m => m.id === a.module_id)
                                      if (!mod) return null
                                      const done = completedByUserModule[`${emp.id}_${a.module_id}`] ?? 0
                                      const total = totalByModule[a.module_id] ?? 0
                                      const isComplete = total > 0 && done >= total
                                      const key = `${emp.id}_${a.module_id}`
                                      const types = contentTypesByModule[a.module_id] ?? { text: false, video: false, quiz: false }
                                      const manual = manualByUserModule[key]
                                      const rawScore = manual
                                        ? { score: manual.score, max: manual.max_score }
                                        : bestRawScoreByUserModule[key]
                                      const hasCertificate = !!manual || isComplete
                                      const completedDate = manual ? manual.completion_date : completionDateByUserModule[key]
                                      const isOverdue = !!a.due_date && a.due_date < today && !isComplete

                                      const typeCell = (present: boolean) =>
                                        present
                                          ? <Check className="h-4 w-4 text-green-500 mx-auto" />
                                          : <X className="h-4 w-4 text-slate-300 mx-auto" />

                                      return (
                                        <tr key={a.id} className="hover:bg-slate-50">
                                          <td className="px-3 py-2.5">
                                            <p className="font-medium text-slate-800">{mod.title}</p>
                                            <p className="text-slate-400">{getCategoryLabel(mod.category)}</p>
                                          </td>
                                          <td className="px-3 py-2.5">{typeCell(types.text)}</td>
                                          <td className="px-3 py-2.5">{typeCell(types.video)}</td>
                                          <td className="px-3 py-2.5">{typeCell(types.quiz)}</td>
                                          <td className="px-3 py-2.5 text-center">
                                            {rawScore
                                              ? <span className={rawScore.max > 0 && (rawScore.score / rawScore.max) < 0.7 ? 'text-red-500' : 'text-slate-700'}>
                                                  {rawScore.score}/{rawScore.max} ({rawScore.max > 0 ? Math.round((rawScore.score / rawScore.max) * 100) : 0}%)
                                                </span>
                                              : <span className="text-slate-300">—</span>}
                                          </td>
                                          <td className="px-3 py-2.5 text-center">
                                            {hasCertificate ? (
                                              <a
                                                href={`/api/certificate?userId=${emp.id}&moduleId=${a.module_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                              >
                                                <Award className="h-3.5 w-3.5" /> View
                                              </a>
                                            ) : <span className="text-slate-300">—</span>}
                                          </td>
                                          <td className="px-3 py-2.5 text-center text-slate-500">
                                            {completedDate ? formatDate(completedDate) : '—'}
                                          </td>
                                          <td className="px-3 py-2.5 text-center">
                                            <Link
                                              href={`/training/${a.module_id}`}
                                              target="_blank"
                                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                            >
                                              <ExternalLink className="h-3.5 w-3.5" /> Review
                                            </Link>
                                          </td>
                                          <td className={`px-3 py-2.5 text-center ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                                            {a.due_date ? formatDate(a.due_date) : '—'}
                                          </td>
                                          <td className="px-3 py-2.5 text-center">
                                            <button
                                              onClick={() => handleRemoveAssignment(a.id, emp.full_name, mod.title)}
                                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                              title="Remove this training"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

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

      </> /* end All/Office tab */}
    </div>
  )
}
