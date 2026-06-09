'use client'

import { useState, useMemo, useRef } from 'react'
import { ClipboardList, Check, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Module } from '@/types'

// Production location codes
const PRODUCTION_LOCATIONS = ['HA', 'ML', 'HV']

interface Props {
  employees: Profile[]
  modules: Module[]
  currentUserId: string
  onClose: () => void
}

export function ManualCompletionDialog({ employees, modules, currentUserId, onClose }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [location, setLocation] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set())
  const [score, setScore] = useState('100')
  const [maxScore, setMaxScore] = useState('100')
  const [passed, setPassed] = useState(true)
  const [trainerId, setTrainerId] = useState('')
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Filter locations to production only
  const productionLocations = useMemo(() => {
    const allLocs = [...new Set(employees.map(e => e.department).filter(Boolean))] as string[]
    // Show locations that start with or match production codes, or show all if none match
    const prodLocs = allLocs.filter(l =>
      PRODUCTION_LOCATIONS.some(code => l.toUpperCase().startsWith(code) || l.toUpperCase().includes(code))
    )
    return prodLocs.length > 0 ? prodLocs.sort() : allLocs.sort()
  }, [employees])

  const filteredEmployees = useMemo(() =>
    location ? employees.filter(e => e.department === location) : [],
    [employees, location]
  )

  const publishedModules = useMemo(() => modules.filter(m => m.is_published), [modules])

  // All employees for trainer dropdown
  const allActiveEmployees = useMemo(() =>
    [...employees].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [employees]
  )

  function toggleEmployee(id: string) {
    setSelectedEmployees(prev => {
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

  async function uploadFile(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `manual-completions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage
      .from('training-files')
      .upload(path, file, { upsert: false })
    if (error) { console.error('Upload error:', error); return null }
    const { data } = supabase.storage.from('training-files').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!moduleId || selectedEmployees.size === 0) return
    setSaving(true)
    try {
      let fileUrl: string | null = null
      if (file) fileUrl = await uploadFile(file)

      const rows = Array.from(selectedEmployees).map(userId => ({
        user_id: userId,
        module_id: moduleId,
        score: parseInt(score) || 0,
        max_score: parseInt(maxScore) || 100,
        passed,
        trainer_id: trainerId || null,
        completion_date: completionDate,
        location: location || null,
        file_url: fileUrl,
        notes: notes.trim() || null,
        created_by: currentUserId,
      }))

      const { error } = await supabase.from('manual_completions').insert(rows)
      if (error) throw error

      setDone(true)
      setTimeout(() => { onClose(); window.location.reload() }, 1200)
    } catch (e) {
      console.error(e)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const scoreNum = parseInt(score) || 0
  const maxNum = parseInt(maxScore) || 100
  const scorePct = maxNum > 0 ? Math.round((scoreNum / maxNum) * 100) : 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" />
            Add Manual Completion
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Record classroom or paper-based training for production employees.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Location */}
          <div className="space-y-1.5">
            <Label>Facility (Production) <span className="text-red-500">*</span></Label>
            <Select value={location} onValueChange={v => { setLocation(v); setSelectedEmployees(new Set()) }}>
              <SelectTrigger>
                <SelectValue placeholder="Select facility..." />
              </SelectTrigger>
              <SelectContent>
                {productionLocations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Training module */}
          <div className="space-y-1.5">
            <Label>Training Module <span className="text-red-500">*</span></Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select training..." />
              </SelectTrigger>
              <SelectContent>
                {publishedModules.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Employees */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Employee(s) <span className="text-red-500">*</span></Label>
              {filteredEmployees.length > 0 && (
                <button onClick={toggleAllEmployees} className="text-xs text-blue-600 hover:underline">
                  {selectedEmployees.size === filteredEmployees.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            {!location ? (
              <p className="text-sm text-slate-400 border rounded-lg p-3">Select a facility first</p>
            ) : filteredEmployees.length === 0 ? (
              <p className="text-sm text-slate-400 border rounded-lg p-3">No employees at this location</p>
            ) : (
              <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                {filteredEmployees.map(emp => (
                  <label key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <Checkbox
                      checked={selectedEmployees.has(emp.id)}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                    />
                    <span className="text-sm text-slate-800">{emp.full_name}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedEmployees.size > 0 && (
              <p className="text-xs text-slate-500">{selectedEmployees.size} employee{selectedEmployees.size !== 1 ? 's' : ''} selected</p>
            )}
          </div>

          {/* Score */}
          <div className="space-y-1.5">
            <Label>Score</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={score}
                onChange={e => setScore(e.target.value)}
                className="w-24"
                placeholder="100"
              />
              <span className="text-slate-500">out of</span>
              <Input
                type="number"
                min={1}
                value={maxScore}
                onChange={e => setMaxScore(e.target.value)}
                className="w-24"
                placeholder="100"
              />
              <span className="text-sm text-slate-500">= {scorePct}%</span>
            </div>
          </div>

          {/* Pass/Fail */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="passed"
              checked={passed}
              onCheckedChange={v => setPassed(!!v)}
            />
            <label htmlFor="passed" className="text-sm font-medium text-slate-700 cursor-pointer">
              Passed <span className="text-slate-400 font-normal">(uncheck to mark as failed)</span>
            </label>
          </div>

          {/* Trainer */}
          <div className="space-y-1.5">
            <Label>Trainer / Instructor</Label>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select trainer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No trainer —</SelectItem>
                {allActiveEmployees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Completion Date</Label>
            <Input
              type="date"
              value={completionDate}
              onChange={e => setCompletionDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label>Upload File <span className="text-slate-400 text-xs font-normal">(PDF, JPG, PNG — optional)</span></Label>
            {file ? (
              <div className="flex items-center gap-2 border rounded-lg p-2.5">
                <Upload className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-700 truncate flex-1">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 rounded-lg p-3 text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                Click to upload...
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-slate-400 text-xs font-normal">(optional)</span></Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about the training session..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !moduleId || selectedEmployees.size === 0}
            className="gap-2"
          >
            {done ? (
              <><Check className="h-4 w-4" /> Saved!</>
            ) : saving ? 'Saving...' : `Save${selectedEmployees.size > 1 ? ` (${selectedEmployees.size})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
