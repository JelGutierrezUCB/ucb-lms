'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, ChevronRight, CheckCircle2, Clock, Minus } from 'lucide-react'
import { getCategoryColor } from '@/lib/utils'

export type EmployeeStatus = {
  name: string
  dept: string
  status: 'completed' | 'in_progress' | 'not_started'
  done: number
  total: number
}

export type ModuleStat = {
  id: string
  title: string
  category: string
  assigned: number
  completed: number
  pct: number
}

export function ModuleCompletionList({
  moduleStats,
  moduleEmployeeBreakdown,
}: {
  moduleStats: ModuleStat[]
  moduleEmployeeBreakdown: Record<string, EmployeeStatus[]>
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (moduleStats.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-4">No published modules yet</p>
  }

  return (
    <div className="space-y-1">
      {moduleStats.map(m => {
        const isOpen = expanded === m.id
        const emps = moduleEmployeeBreakdown[m.id] ?? []
        const completedEmps = emps.filter(e => e.status === 'completed')
        const inProgressEmps = emps.filter(e => e.status === 'in_progress')
        const notStartedEmps = emps.filter(e => e.status === 'not_started')

        return (
          <div key={m.id} className="rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : m.id)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getCategoryColor(m.category) }}
                  />
                  <span className="text-sm font-medium text-slate-800 truncate">{m.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-slate-500">{m.completed}/{m.assigned}</span>
                  <Badge
                    variant={m.pct === 100 ? 'success' : m.pct > 50 ? 'warning' : 'outline'}
                    className="text-xs"
                  >
                    {m.pct}%
                  </Badge>
                </div>
              </div>
              <div className="mt-2 ml-6">
                <Progress value={m.pct} className="h-1.5" />
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 space-y-3">
                {emps.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No employees assigned to this module</p>
                ) : (
                  <>
                    {/* Status summary chips */}
                    <div className="flex gap-2 flex-wrap">
                      {completedEmps.length > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 rounded-full px-2.5 py-0.5 font-medium">
                          ✓ {completedEmps.length} completed
                        </span>
                      )}
                      {inProgressEmps.length > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-medium">
                          ◑ {inProgressEmps.length} in progress
                        </span>
                      )}
                      {notStartedEmps.length > 0 && (
                        <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2.5 py-0.5 font-medium">
                          — {notStartedEmps.length} not started
                        </span>
                      )}
                    </div>

                    {/* Employee list: completed, then in-progress, then not-started */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 max-h-52 overflow-y-auto">
                      {emps.map((emp, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                          {emp.status === 'completed' && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          )}
                          {emp.status === 'in_progress' && (
                            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                          {emp.status === 'not_started' && (
                            <Minus className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                          )}
                          <span className="text-xs text-slate-700 truncate flex-1">{emp.name}</span>
                          {emp.status === 'in_progress' && (
                            <span className="text-xs text-slate-400 shrink-0">
                              {emp.done}/{emp.total} sections
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
