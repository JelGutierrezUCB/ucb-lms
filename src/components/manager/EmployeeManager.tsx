'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, BookOpen, Plus, Trash2, ChevronDown, ChevronUp, Play } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useProxy } from '@/contexts/ProxyContext'
import { formatDate, getCategoryColor, getCategoryLabel } from '@/lib/utils'
import type { Profile, Module, Assignment } from '@/types'

interface Props {
  employees: Profile[]
  modules: Module[]
  assignments: Assignment[]
  totalByModule: Record<string, number>
  completedByUserModule: Record<string, number>
  managerId: string
}

export function EmployeeManager({
  employees,
  modules,
  assignments: initialAssignments,
  totalByModule,
  completedByUserModule,
  managerId,
}: Props) {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [assignDialog, setAssignDialog] = useState<Profile | null>(null)
  const [selectedModule, setSelectedModule] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const { startProxy } = useProxy()
  const router = useRouter()
  const supabase = createClient()

  const getEmployeeAssignments = (userId: string) =>
    assignments.filter(a => a.user_id === userId)

  const getProgress = (userId: string, moduleId: string) => {
    const total = totalByModule[moduleId] ?? 0
    const completed = completedByUserModule[`${userId}_${moduleId}`] ?? 0
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }

  const handleStartProxy = (employee: Profile) => {
    startProxy(employee)
    toast.success(`Now training as ${employee.full_name}`)
    router.push(`/training?as=${employee.id}`)
  }

  const handleAssign = async () => {
    if (!assignDialog || !selectedModule) { toast.error('Select a module'); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        user_id: assignDialog.id,
        module_id: selectedModule,
        assigned_by: managerId,
        due_date: dueDate || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') toast.error('This training is already assigned')
      else toast.error(error.message)
    } else {
      setAssignments(prev => [...prev, data])
      toast.success('Training assigned!')
    }
    setAssignDialog(null)
    setSelectedModule('')
    setDueDate('')
    setLoading(false)
  }

  const handleUnassign = async (assignmentId: string) => {
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId)
    if (error) { toast.error(error.message); return }
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))
    toast.success('Assignment removed')
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-20">
        <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No employees assigned to you</p>
        <p className="text-slate-400 text-sm mt-1">Ask an admin to assign employees to your team</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-600">{employees.length} employee{employees.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Proxy login: click "Start Training" to train as an employee</span>
          </div>
        </div>
      </div>

      {employees.map(employee => {
        const empAssignments = getEmployeeAssignments(employee.id)
        const isExpanded = expanded === employee.id

        return (
          <Card key={employee.id}>
            {/* Employee header */}
            <div className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white font-bold">
                {employee.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{employee.full_name}</p>
                <p className="text-sm text-slate-500">
                  {employee.email}
                  {employee.department && ` · ${employee.department}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline">{empAssignments.length} training{empAssignments.length !== 1 ? 's' : ''}</Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setAssignDialog(employee)}
                  title="Assign training"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Assign
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStartProxy(employee)}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Start Training
                </Button>
                <button
                  onClick={() => setExpanded(isExpanded ? null : employee.id)}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-700"
                >
                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Expanded: assigned trainings */}
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                {empAssignments.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">
                    No trainings assigned yet.{' '}
                    <button
                      onClick={() => setAssignDialog(employee)}
                      className="text-blue-600 hover:underline"
                    >
                      Assign one now.
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-700 mb-3">Assigned Trainings</p>
                    {empAssignments.map(a => {
                      const mod = modules.find(m => m.id === a.module_id)
                      if (!mod) return null
                      const { percent } = getProgress(employee.id, a.module_id)
                      return (
                        <div key={a.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
                            style={{ backgroundColor: getCategoryColor(mod.category) }}
                          >
                            {mod.title.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900 text-sm">{mod.title}</p>
                              <Badge
                                variant={percent === 100 ? 'success' : percent > 0 ? 'warning' : 'outline'}
                                className="shrink-0"
                              >
                                {percent === 100 ? 'Done' : percent > 0 ? `${percent}%` : 'Not started'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <Progress value={percent} className="flex-1 h-1.5" indicatorClassName={percent === 100 ? 'bg-green-500' : undefined} />
                              {a.due_date && <span className="text-xs text-slate-400 shrink-0">Due {formatDate(a.due_date)}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnassign(a.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                            title="Remove assignment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}

      {/* Assign training dialog */}
      <Dialog open={!!assignDialog} onOpenChange={open => !open && setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Training</DialogTitle>
            <DialogDescription>
              Assign a training module to <strong>{assignDialog?.full_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Training Module</Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a module..." />
                </SelectTrigger>
                <SelectContent>
                  {modules
                    .filter(m => !getEmployeeAssignments(assignDialog?.id ?? '').find(a => a.module_id === m.id))
                    .map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.title} — {getCategoryLabel(m.category)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Cancel</Button>
            <Button loading={loading} onClick={handleAssign}>Assign Training</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
