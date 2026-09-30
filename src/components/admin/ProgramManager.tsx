'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FolderKanban, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { getCategoryLabel } from '@/lib/utils'
import type { Program } from '@/types'
import type { ModuleLite } from './journey-shared'

// Restricted to the brand palette — the only colors the app's branding may use.
const PROGRAM_COLORS = ['#281D73', '#609D3B', '#714F36', '#E25820']

interface Props {
  programs: Program[]
  programModules: { program_id: string; module_id: string }[]
  modules: ModuleLite[]
  currentUserId: string
}

export function ProgramManager({ programs, programModules, modules, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState<Program | 'new' | null>(null)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const membersFor = (programId: string) =>
    programModules.filter(pm => pm.program_id === programId).map(pm => pm.module_id)

  async function deleteProgram(program: Program) {
    if (!confirm(`Delete "${program.name}"? Courses stay untouched — only the grouping is removed.`)) return
    const { error } = await supabase.from('programs').delete().eq('id', program.id)
    if (error) { toast.error(error.message); return }
    toast.success('Program deleted')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Programs</h2>
          <p className="text-sm text-slate-500">
            Group related courses under a named program for browsing and reporting. A course can belong to more than
            one program — unlike a learning journey, there's no order and no automatic enrollment.
          </p>
        </div>
        <Button onClick={() => setEditing('new')} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> New program
        </Button>
      </div>

      {programs.length === 0 ? (
        <div className="text-center py-14 rounded-xl border border-dashed border-slate-300 bg-white">
          <FolderKanban className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-medium">No programs yet</p>
          <p className="text-slate-400 text-sm mt-1">Create one to group related courses together, like &ldquo;Leadership Development&rdquo;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {programs.map(program => {
            const memberIds = membersFor(program.id)
            return (
              <Card key={program.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="h-3 w-3 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: program.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{program.name}</p>
                      {program.description && <p className="text-sm text-slate-500 line-clamp-2">{program.description}</p>}
                    </div>
                  </div>

                  <ul className="text-sm text-slate-600 space-y-0.5">
                    {memberIds.slice(0, 5).map(id => (
                      <li key={id} className="truncate">
                        <span className="text-slate-400 mr-1.5">•</span>
                        {moduleById.get(id)?.title ?? 'Unavailable course'}
                      </li>
                    ))}
                    {memberIds.length > 5 && <li className="text-slate-400">+ {memberIds.length - 5} more</li>}
                    {memberIds.length === 0 && <li className="text-slate-400">No courses added yet</li>}
                  </ul>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-slate-400">
                      {memberIds.length} course{memberIds.length === 1 ? '' : 's'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditing(program)}>
                        <Pencil className="h-4 w-4 mr-1.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteProgram(program)}
                        title="Delete program"
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <ProgramEditor
          key={editing === 'new' ? 'new' : editing.id}
          program={editing === 'new' ? null : editing}
          initialModuleIds={editing === 'new' ? [] : membersFor(editing.id)}
          modules={modules}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ProgramEditor({
  program, initialModuleIds, modules, currentUserId, onClose,
}: {
  program: Program | null
  initialModuleIds: string[]
  modules: ModuleLite[]
  currentUserId: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(program?.name ?? '')
  const [description, setDescription] = useState(program?.description ?? '')
  const [color, setColor] = useState(program?.color ?? PROGRAM_COLORS[0])
  const [moduleIds, setModuleIds] = useState<string[]>(initialModuleIds)
  const [saving, setSaving] = useState(false)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const available = modules.filter(m => !moduleIds.includes(m.id))

  const removeModule = (id: string) => setModuleIds(prev => prev.filter(m => m !== id))

  async function save() {
    if (!name.trim()) { toast.error('Give the program a name'); return }
    setSaving(true)
    try {
      let programId = program?.id
      const fields = { name: name.trim(), description: description.trim() || null, color }

      if (programId) {
        const { error } = await supabase.from('programs').update(fields).eq('id', programId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('programs')
          .insert({ ...fields, created_by: currentUserId })
          .select('id')
          .single()
        if (error) throw error
        programId = data.id
      }

      // Replace the membership set, same as course-rule audiences: delete
      // then re-insert, never per-row, so a half-saved set can't happen.
      const { error: delError } = await supabase.from('program_modules').delete().eq('program_id', programId)
      if (delError) throw delError
      if (moduleIds.length > 0) {
        const { error } = await supabase
          .from('program_modules')
          .insert(moduleIds.map(module_id => ({ program_id: programId, module_id })))
        if (error) throw error
      }

      toast.success(program ? 'Program updated' : 'Program created')
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save program')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{program ? 'Edit program' : 'New program'}</DialogTitle>
          <DialogDescription>
            Give it a name and add the courses that belong to it. Courses can belong to more than one program.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Leadership Development" />
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROGRAM_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Use color ${c}`}
                  aria-pressed={color === c}
                  className="h-7 w-7 rounded-full ring-offset-2 transition-shadow"
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Courses</Label>
            {moduleIds.length > 0 && (
              <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100 mb-2">
                {moduleIds.map(id => {
                  const m = moduleById.get(id)
                  return (
                    <li key={id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{m?.title ?? 'Unavailable course'}</p>
                        {m && <p className="text-xs text-slate-400">{getCategoryLabel(m.category)} · {m.estimated_minutes} min</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeModule(id)}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        aria-label="Remove course"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <Select value="" onValueChange={v => { if (v) setModuleIds(prev => [...prev, v]) }}>
              <SelectTrigger disabled={available.length === 0}>
                <SelectValue placeholder={available.length === 0 ? 'Every course has been added' : 'Add a course…'} />
              </SelectTrigger>
              <SelectContent>
                {available.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>{program ? 'Save changes' : 'Create program'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
