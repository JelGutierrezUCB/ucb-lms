'use client'

import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Users, Search, Check, Calendar } from 'lucide-react'

type Employee = {
  id: string
  full_name: string
  department: string | null
  email: string
}

type Props = {
  moduleId: string
  moduleTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignModuleDialog({ moduleId, moduleTitle, open, onOpenChange }: Props) {
  const supabase = createClient()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dueDate, setDueDate] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch employees + current assignments when dialog opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch('')

    Promise.all([
      supabase.from('profiles').select('id, full_name, department, email').eq('role', 'employee').eq('is_active', true).order('full_name'),
      supabase.from('assignments').select('user_id, due_date').eq('module_id', moduleId),
    ]).then(([empRes, assignRes]) => {
      if (empRes.error) { toast.error(empRes.error.message); return }
      if (assignRes.error) { toast.error(assignRes.error.message); return }

      setEmployees(empRes.data ?? [])
      const assignedIds = new Set((assignRes.data ?? []).map(a => a.user_id))
      setAssigned(assignedIds)
      setSelected(new Set(assignedIds))

      // Pre-fill due date if all assigned share the same one
      const dates = [...new Set((assignRes.data ?? []).map(a => a.due_date).filter(Boolean))]
      setDueDate(dates.length === 1 ? dates[0] : '')
    }).finally(() => setLoading(false))
  }, [open, moduleId])

  // Group by department
  const grouped = useMemo(() => {
    const q = search.toLowerCase()
    const filtered = employees.filter(e =>
      !q || e.full_name.toLowerCase().includes(q) || (e.department ?? '').toLowerCase().includes(q)
    )
    const map: Record<string, Employee[]> = {}
    for (const e of filtered) {
      const dept = e.department ?? 'No Department'
      if (!map[dept]) map[dept] = []
      map[dept].push(e)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [employees, search])

  const allVisible = useMemo(() => grouped.flatMap(([, emps]) => emps), [grouped])
  const allVisibleSelected = allVisible.every(e => selected.has(e.id))

  const toggleEmployee = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        allVisible.forEach(e => next.delete(e.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        allVisible.forEach(e => next.add(e.id))
        return next
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const toAdd = [...selected].filter(id => !assigned.has(id))
    const toRemove = [...assigned].filter(id => !selected.has(id))

    try {
      // Get current user (the admin doing the assignment)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('assignments')
          .delete()
          .eq('module_id', moduleId)
          .in('user_id', toRemove)
        if (error) throw error
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map(userId => ({
          user_id: userId,
          module_id: moduleId,
          assigned_by: user.id,
          ...(dueDate ? { due_date: dueDate } : {}),
        }))
        const { error } = await supabase.from('assignments').insert(rows)
        if (error) throw error
      }

      // Update due date for existing assignments that remain selected
      if (dueDate) {
        const toUpdate = [...selected].filter(id => assigned.has(id))
        if (toUpdate.length > 0) {
          const { error } = await supabase
            .from('assignments')
            .update({ due_date: dueDate })
            .eq('module_id', moduleId)
            .in('user_id', toUpdate)
          if (error) throw error
        }
      }

      const added = toAdd.length
      const removed = toRemove.length
      const parts = []
      if (added > 0) parts.push(`${added} assigned`)
      if (removed > 0) parts.push(`${removed} removed`)
      toast.success(parts.length ? parts.join(', ') : 'No changes made')
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save assignments')
    } finally {
      setSaving(false)
    }
  }

  const changesCount = useMemo(() => {
    const toAdd = [...selected].filter(id => !assigned.has(id)).length
    const toRemove = [...assigned].filter(id => !selected.has(id)).length
    return toAdd + toRemove
  }, [selected, assigned])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            Assign Training
          </DialogTitle>
          <DialogDescription className="truncate">
            <span className="font-medium text-slate-700">{moduleTitle}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-8 text-slate-400 text-sm">
            Loading employees…
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees or departments…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Due date */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-slate-600 shrink-0">
                <Calendar className="h-3.5 w-3.5" />
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {dueDate && (
                <button
                  onClick={() => setDueDate('')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Select all + count */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <button
                onClick={toggleAll}
                className="flex items-center gap-1.5 hover:text-slate-800 transition-colors"
              >
                <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                  allVisibleSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                }`}>
                  {allVisibleSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                {allVisibleSelected ? 'Deselect all' : 'Select all'}
              </button>
              <span>{selected.size} of {employees.length} selected</span>
            </div>

            {/* Employee list */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 max-h-72 pr-1">
              {grouped.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-4">No employees found</p>
              ) : grouped.map(([dept, emps]) => (
                <div key={dept}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{dept}</p>
                  <div className="space-y-0.5">
                    {emps.map(emp => {
                      const isSelected = selected.has(emp.id)
                      const wasAssigned = assigned.has(emp.id)
                      return (
                        <button
                          key={emp.id}
                          onClick={() => toggleEmployee(emp.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 truncate">{emp.full_name}</p>
                          </div>
                          {wasAssigned && !isSelected && (
                            <span className="text-xs text-red-400 shrink-0">Remove</span>
                          )}
                          {wasAssigned && isSelected && (
                            <span className="text-xs text-green-600 shrink-0">Assigned</span>
                          )}
                          {!wasAssigned && isSelected && (
                            <span className="text-xs text-blue-500 shrink-0">New</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={loading}>
            {changesCount > 0 ? `Save (${changesCount} change${changesCount !== 1 ? 's' : ''})` : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
