'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Layers, Pencil, Plus, Search, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import type { JobRole, LearningPath, LearningPathTarget } from '@/types'
import { JourneyWizard } from './JourneyWizard'
import { ACCOUNT_TYPES, Chip, type ModuleLite, type PersonLite } from './journey-shared'

interface Props {
  paths: LearningPath[]
  items: { path_id: string; module_id: string; order_index: number; phase?: string | null; note?: string | null }[]
  pathTargets: LearningPathTarget[]
  enrollmentCounts: Record<string, number>
  // Job roles come from the Users section (created on the user form)
  roles: JobRole[]
  modules: ModuleLite[]
  people: PersonLite[]
  currentUserId: string
}

export function PathManager({ paths, items, pathTargets, enrollmentCounts, roles, modules, people, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState<LearningPath | 'new' | null>(null)
  const [enrolling, setEnrolling] = useState<LearningPath | null>(null)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles])
  const personName = useMemo(() => new Map(people.map(p => [p.id, p.full_name])), [people])

  const itemsFor = (pathId: string) =>
    items.filter(i => i.path_id === pathId).sort((a, b) => a.order_index - b.order_index)

  const targetsFor = (pathId: string) => pathTargets.filter(t => t.path_id === pathId)

  async function deletePath(path: LearningPath) {
    if (!confirm(`Delete "${path.title}"? People already enrolled keep the trainings they were assigned, but the journey itself is removed.`)) return
    const { error } = await supabase.from('learning_paths').delete().eq('id', path.id)
    if (error) { toast.error(error.message); return }
    toast.success('Learning journey deleted')
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Learning journeys</h2>
            <p className="text-sm text-slate-500">
              An ordered set of trainings. Enrolling someone assigns every training in it. A journey can enroll people
              automatically by the Company, Department and Job role set on their user record, or every new hire.
            </p>
          </div>
          <Button onClick={() => setEditing('new')} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> New journey
          </Button>
        </div>

        {paths.length === 0 ? (
          <div className="text-center py-14 rounded-xl border border-dashed border-slate-300 bg-white">
            <Layers className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 font-medium">No learning journeys yet</p>
            <p className="text-slate-400 text-sm mt-1">Create one for a company, department or job role, or an onboarding journey for new hires.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paths.map(path => {
              const pathItems = itemsFor(path.id)
              const targets = targetsFor(path.id)
              return (
                <Card key={path.id}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{path.title}</p>
                        {path.description && <p className="text-sm text-slate-500 line-clamp-2">{path.description}</p>}
                      </div>
                      <Badge variant={path.is_published ? 'success' : 'outline'}>
                        {path.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {path.kind === 'onboarding' && (
                        <Badge className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Onboarding</Badge>
                      )}
                      {targets.map(t => (
                        <Badge key={`${t.kind}:${t.value}`} variant="outline">
                          {{ company: 'Company', department: 'Dept', job_role: 'Role', supervisor: 'Manager', account_role: 'Type' }[t.kind]}:{' '}
                          {t.kind === 'job_role'
                            ? roleById.get(t.value)?.name ?? 'Unknown role'
                            : t.kind === 'supervisor'
                              ? personName.get(t.value) ?? 'Unknown'
                              : t.kind === 'account_role'
                                ? ACCOUNT_TYPES.find(a => a.value === t.value)?.label ?? t.value
                                : t.value}
                        </Badge>
                      ))}
                      {path.auto_enroll_new_hires && <Badge variant="warning">Auto-enrolls new hires</Badge>}
                    </div>

                    <ol className="text-sm text-slate-600 space-y-0.5">
                      {pathItems.slice(0, 5).map((i, idx) => (
                        <li key={i.module_id} className="truncate">
                          <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                          {moduleById.get(i.module_id)?.title ?? 'Unavailable training'}
                        </li>
                      ))}
                      {pathItems.length > 5 && <li className="text-slate-400">+ {pathItems.length - 5} more</li>}
                      {pathItems.length === 0 && <li className="text-slate-400">No trainings added yet</li>}
                    </ol>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-slate-400">
                        {pathItems.length} training{pathItems.length === 1 ? '' : 's'} · {enrollmentCounts[path.id] ?? 0} enrolled
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setEnrolling(path)} disabled={pathItems.length === 0}>
                          <UserPlus className="h-4 w-4 mr-1.5" /> Enroll
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(path)}>
                          <Pencil className="h-4 w-4 mr-1.5" /> Edit
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePath(path)} title="Delete journey" className="text-slate-400 hover:text-red-600">
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
      </section>

      {editing && (
        <JourneyWizard
          key={editing === 'new' ? 'new' : editing.id}
          path={editing === 'new' ? null : editing}
          initialSteps={editing === 'new' ? [] : itemsFor(editing.id).map(i => ({ moduleId: i.module_id, phase: i.phase ?? '', note: i.note ?? '' }))}
          initialTargets={editing === 'new' ? [] : targetsFor(editing.id)}
          roles={roles}
          modules={modules}
          people={people}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
        />
      )}

      {enrolling && (
        <EnrollDialog
          key={enrolling.id}
          path={enrolling}
          people={people}
          roleById={roleById}
          onClose={() => setEnrolling(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function EnrollDialog({
  path, people, roleById, onClose,
}: {
  path: LearningPath
  people: PersonLite[]
  roleById: Map<string, JobRole>
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people.filter(p =>
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      (p.department ?? '').toLowerCase().includes(q) ||
      (p.company ?? '').toLowerCase().includes(q) ||
      (p.job_role_id ? roleById.get(p.job_role_id)?.name.toLowerCase().includes(q) : false)
    )
  }, [people, query, roleById])

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Quick-select groups built from the user records: everyone in a company,
  // department or job role.
  const groups = useMemo(() => {
    const by = (label: string, key: (p: PersonLite) => string | null | undefined) => {
      const map = new Map<string, string[]>()
      for (const p of people) {
        const k = key(p)
        if (k) map.set(k, [...(map.get(k) ?? []), p.id])
      }
      return { label, entries: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])) }
    }
    return [
      by('Company', p => p.company),
      by('Department', p => p.department),
      by('Job role', p => (p.job_role_id ? roleById.get(p.job_role_id)?.name : null)),
      by('Manager', p => (p.manager_id ? people.find(x => x.id === p.manager_id)?.full_name : null)),
    ].filter(g => g.entries.length > 0)
  }, [people, roleById])

  const groupFullySelected = (ids: string[]) => ids.length > 0 && ids.every(id => selected.has(id))
  const toggleGroup = (ids: string[]) =>
    setSelected(prev => {
      const next = new Set(prev)
      const allIn = ids.every(id => next.has(id))
      for (const id of ids) {
        if (allIn) next.delete(id)
        else next.add(id)
      }
      return next
    })

  async function enroll() {
    if (selected.size === 0) { toast.error('Select at least one person'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/learning-paths/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathId: path.id, userIds: [...selected], dueDate: dueDate || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Enrolled ${selected.size} ${selected.size === 1 ? 'person' : 'people'} in "${path.title}"`)
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to enroll')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enroll in &ldquo;{path.title}&rdquo;</DialogTitle>
          <DialogDescription>
            Everyone selected is assigned every training in this journey. People already assigned a training keep their existing assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.label} className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">
                {g.label === 'Manager' ? "Add a manager's whole team" : `Add everyone in a ${g.label.toLowerCase()}`}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.entries.map(([name, ids]) => (
                  <Chip key={name} on={groupFullySelected(ids)} onClick={() => toggleGroup(ids)}>
                    {name} <span className="opacity-60">({ids.length})</span>
                  </Chip>
                ))}
              </div>
            </div>
          ))}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, company, department or job role" className="pl-9" />
          </div>

          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => setSelected(new Set(shown.map(p => p.id)))}>
              Select all shown ({shown.length})
            </button>
            <span className="text-slate-500">{selected.size} selected</span>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {shown.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-400">No people match.</p>
            ) : shown.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {[p.company, p.department, p.job_role_id ? roleById.get(p.job_role_id)?.name : null].filter(Boolean).join(' · ') || 'No company, department or role'}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Due date (optional)</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="sm:w-48" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={enroll}>Enroll {selected.size > 0 ? `(${selected.size})` : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
