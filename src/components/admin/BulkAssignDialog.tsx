'use client'

import { useState, useMemo } from 'react'
import { Users, BookOpen, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Module } from '@/types'

interface Props {
  employees: Profile[]
  modules: Module[]
  currentUserId: string
  onClose: () => void
}

export function BulkAssignDialog({ employees, modules, currentUserId, onClose }: Props) {
  const supabase = createClient()
  const [locationFilter, setLocationFilter] = useState('all')
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const locations = useMemo(() => {
    const locs = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[]
    return locs.sort()
  }, [employees])

  const filteredEmployees = useMemo(() =>
    locationFilter === 'all'
      ? employees
      : employees.filter(e => e.department === locationFilter),
    [employees, locationFilter]
  )

  const publishedModules = useMemo(() => modules.filter(m => m.is_published), [modules])

  function toggleEmployee(id: string) {
    setSelectedEmployees(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleModule(id: string) {
    setSelectedModules(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllEmployees() {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set())
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map(e => e.id)))
    }
  }

  function toggleAllModules() {
    if (selectedModules.size === publishedModules.length) {
      setSelectedModules(new Set())
    } else {
      setSelectedModules(new Set(publishedModules.map(m => m.id)))
    }
  }

  async function handleSave() {
    if (selectedEmployees.size === 0 || selectedModules.size === 0) return
    setSaving(true)
    try {
      const rows = []
      for (const userId of selectedEmployees) {
        for (const moduleId of selectedModules) {
          rows.push({
            user_id: userId,
            module_id: moduleId,
            assigned_by: currentUserId,
          })
        }
      }
      // Upsert to avoid duplicate assignments
      const { error } = await supabase
        .from('assignments')
        .upsert(rows, { onConflict: 'user_id,module_id', ignoreDuplicates: true })
      if (error) throw error
      setDone(true)
      setTimeout(() => { onClose(); window.location.reload() }, 1200)
    } catch (e) {
      console.error(e)
      alert('Failed to save assignments. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const impacted = selectedEmployees.size
  const assignmentCount = impacted * selectedModules.size

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Bulk Assign Trainings
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2">
          {/* Location filter */}
          <div className="space-y-1.5">
            <Label>Filter by Location</Label>
            <Select value={locationFilter} onValueChange={v => { setLocationFilter(v); setSelectedEmployees(new Set()) }}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Employees */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Employees</Label>
                <button
                  onClick={toggleAllEmployees}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {selectedEmployees.size === filteredEmployees.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <p className="text-sm text-slate-400 p-3 text-center">No employees in this location</p>
                ) : filteredEmployees.map(emp => (
                  <label key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <Checkbox
                      checked={selectedEmployees.has(emp.id)}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{emp.full_name}</p>
                      {emp.department && <p className="text-xs text-slate-400 truncate">{emp.department}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">{selectedEmployees.size} selected</p>
            </div>

            {/* Modules */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Training Modules</Label>
                <button
                  onClick={toggleAllModules}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {selectedModules.size === publishedModules.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {publishedModules.map(mod => (
                  <label key={mod.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <Checkbox
                      checked={selectedModules.has(mod.id)}
                      onCheckedChange={() => toggleModule(mod.id)}
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <p className="text-sm text-slate-800 truncate">{mod.title}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">{selectedModules.size} selected</p>
            </div>
          </div>

          {/* Impact summary */}
          {assignmentCount > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              <strong>{assignmentCount} assignment{assignmentCount !== 1 ? 's' : ''}</strong> will be created —{' '}
              {impacted} employee{impacted !== 1 ? 's' : ''} × {selectedModules.size} module{selectedModules.size !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || selectedEmployees.size === 0 || selectedModules.size === 0}
            className="gap-2"
          >
            {done ? (
              <><Check className="h-4 w-4" /> Assigned!</>
            ) : saving ? (
              'Saving...'
            ) : (
              `Assign ${assignmentCount > 0 ? assignmentCount : ''} Training${assignmentCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
