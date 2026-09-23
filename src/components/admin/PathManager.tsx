'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Layers, Pencil, Plus, Search, Sparkles, Trash2, UserPlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { getCategoryLabel } from '@/lib/utils'
import type { JobRole, LearningPath, LearningPathKind, Module, Profile } from '@/types'

type ModuleLite = Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>
type PersonLite = Pick<Profile, 'id' | 'full_name' | 'department' | 'role' | 'job_role_id' | 'is_active'>

interface Props {
  paths: LearningPath[]
  items: { path_id: string; module_id: string; order_index: number }[]
  enrollmentCounts: Record<string, number>
  roles: JobRole[]
  memberCounts: Record<string, number>
  modules: ModuleLite[]
  people: PersonLite[]
  currentUserId: string
}

const NONE = '__none__'

export function PathManager({ paths, items, enrollmentCounts, roles, memberCounts, modules, people, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState<LearningPath | 'new' | null>(null)
  const [enrolling, setEnrolling] = useState<LearningPath | null>(null)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles])

  const itemsFor = (pathId: string) =>
    items.filter(i => i.path_id === pathId).sort((a, b) => a.order_index - b.order_index)

  async function deletePath(path: LearningPath) {
    if (!confirm(`Delete "${path.title}"? People already enrolled keep the trainings they were assigned, but the path itself is removed.`)) return
    const { error } = await supabase.from('learning_paths').delete().eq('id', path.id)
    if (error) { toast.error(error.message); return }
    toast.success('Learning path deleted')
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Learning paths */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Learning paths</h2>
            <p className="text-sm text-slate-500">
              An ordered set of trainings. Enrolling someone assigns every training in it. Paths can enroll people
              automatically by job role, or every new hire.
            </p>
          </div>
          <Button onClick={() => setEditing('new')} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> New path
          </Button>
        </div>

        {paths.length === 0 ? (
          <div className="text-center py-14 rounded-xl border border-dashed border-slate-300 bg-white">
            <Layers className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 font-medium">No learning paths yet</p>
            <p className="text-slate-400 text-sm mt-1">Create one for a job role, or an onboarding path for new hires.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paths.map(path => {
              const pathItems = itemsFor(path.id)
              const role = path.job_role_id ? roleById.get(path.job_role_id) : null
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
                      {role && <Badge variant="outline">Role: {role.name}</Badge>}
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
                        <Button variant="ghost" size="icon" onClick={() => deletePath(path)} title="Delete path" className="text-slate-400 hover:text-red-600">
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

      <JobRolesPanel roles={roles} memberCounts={memberCounts} />

      {editing && (
        <PathEditorDialog
          key={editing === 'new' ? 'new' : editing.id}
          path={editing === 'new' ? null : editing}
          initialModuleIds={editing === 'new' ? [] : itemsFor(editing.id).map(i => i.module_id)}
          roles={roles}
          modules={modules}
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

function JobRolesPanel({ roles, memberCounts }: { roles: JobRole[]; memberCounts: Record<string, number> }) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function addRole() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    const { error } = await supabase.from('job_roles').insert({ name: trimmed })
    setSaving(false)
    if (error) { toast.error(error.code === '23505' ? 'That job role already exists' : error.message); return }
    setName('')
    toast.success(`Added "${trimmed}"`)
    router.refresh()
  }

  async function deleteRole(role: JobRole) {
    const members = memberCounts[role.id] ?? 0
    const msg = members > 0
      ? `Delete "${role.name}"? ${members} user${members === 1 ? '' : 's'} will be left with no job role.`
      : `Delete "${role.name}"?`
    if (!confirm(msg)) return
    const { error } = await supabase.from('job_roles').delete().eq('id', role.id)
    if (error) { toast.error(error.message); return }
    toast.success('Job role deleted')
    router.refresh()
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Job roles</h2>
        <p className="text-sm text-slate-500">
          Assign a job role to each user (Users page). Paths targeted at a role enroll everyone with that role.
        </p>
      </div>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-2 max-w-md">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addRole() }}
              placeholder="e.g. Forklift Operator, Account Manager"
              aria-label="New job role name"
            />
            <Button onClick={addRole} loading={saving} className="shrink-0">Add role</Button>
          </div>
          {roles.length === 0 ? (
            <p className="text-sm text-slate-400">No job roles yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map(role => (
                <span key={role.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-3 pr-1.5 py-1 text-sm text-slate-700">
                  {role.name}
                  <span className="text-xs text-slate-400">{memberCounts[role.id] ?? 0}</span>
                  <button
                    type="button"
                    onClick={() => deleteRole(role)}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-600"
                    aria-label={`Delete ${role.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------

function PathEditorDialog({
  path, initialModuleIds, roles, modules, currentUserId, onClose,
}: {
  path: LearningPath | null
  initialModuleIds: string[]
  roles: JobRole[]
  modules: ModuleLite[]
  currentUserId: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState(path?.title ?? '')
  const [description, setDescription] = useState(path?.description ?? '')
  const [kind, setKind] = useState<LearningPathKind>(path?.kind ?? 'learning')
  const [jobRoleId, setJobRoleId] = useState<string>(path?.job_role_id ?? '')
  const [autoNewHires, setAutoNewHires] = useState(path?.auto_enroll_new_hires ?? false)
  const [published, setPublished] = useState(path?.is_published ?? false)
  const [moduleIds, setModuleIds] = useState<string[]>(initialModuleIds)
  const [saving, setSaving] = useState(false)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const available = modules.filter(m => !moduleIds.includes(m.id))

  const move = (index: number, delta: number) =>
    setModuleIds(ids => {
      const next = [...ids]
      const target = index + delta
      if (target < 0 || target >= next.length) return ids
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  async function save() {
    if (!title.trim()) { toast.error('Give the path a title'); return }
    if (published && moduleIds.length === 0) { toast.error('Add at least one training before publishing'); return }
    setSaving(true)
    try {
      const fields = {
        title: title.trim(),
        description: description.trim() || null,
        kind,
        job_role_id: jobRoleId || null,
        auto_enroll_new_hires: autoNewHires,
        is_published: published,
      }

      let pathId = path?.id
      if (path) {
        const { error } = await supabase
          .from('learning_paths')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', path.id)
        if (error) throw error
        const { error: delError } = await supabase.from('learning_path_items').delete().eq('path_id', path.id)
        if (delError) throw delError
      } else {
        const { data, error } = await supabase
          .from('learning_paths')
          .insert({ ...fields, created_by: currentUserId })
          .select('id')
          .single()
        if (error) throw error
        pathId = data.id
      }

      if (moduleIds.length > 0) {
        const { error } = await supabase
          .from('learning_path_items')
          .insert(moduleIds.map((module_id, i) => ({ path_id: pathId, module_id, order_index: i })))
        if (error) throw error
      }

      toast.success(path ? 'Learning path saved' : 'Learning path created')
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save learning path')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{path ? 'Edit learning path' : 'New learning path'}</DialogTitle>
          <DialogDescription>Build an ordered sequence of trainings and choose who gets it automatically.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Warehouse New Hire Onboarding" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What this path covers and who it's for" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={v => setKind(v as LearningPathKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="learning">Learning path</SelectItem>
                  <SelectItem value="onboarding">New-hire onboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Auto-enroll by job role</Label>
              <Select value={jobRoleId || NONE} onValueChange={v => setJobRoleId(v === NONE ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No one (enroll manually)</SelectItem>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={autoNewHires} onCheckedChange={v => setAutoNewHires(!!v)} />
              Enroll every newly created user automatically (new-hire path)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={published} onCheckedChange={v => setPublished(!!v)} />
              Published — drafts are hidden from employees and never auto-enroll anyone
            </label>
          </div>

          <div className="space-y-2">
            <Label>Trainings, in order</Label>
            {moduleIds.length === 0 ? (
              <p className="text-sm text-slate-400 rounded-lg border border-dashed border-slate-300 p-4 text-center">
                No trainings yet — add one below.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {moduleIds.map((id, i) => {
                  const m = moduleById.get(id)
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <span className="w-5 text-sm text-slate-400">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{m?.title ?? 'Unavailable training'}</p>
                        {m && <p className="text-xs text-slate-400">{getCategoryLabel(m.category)} · {m.estimated_minutes} min</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === moduleIds.length - 1} aria-label="Move down">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setModuleIds(ids => ids.filter(x => x !== id))} aria-label="Remove" className="text-slate-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  )
                })}
              </ol>
            )}

            <Select value="" onValueChange={v => { if (v) setModuleIds(ids => [...ids, v]) }}>
              <SelectTrigger disabled={available.length === 0}>
                <SelectValue placeholder={available.length === 0 ? 'All trainings added' : 'Add a training…'} />
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
          <Button loading={saving} onClick={save}>{path ? 'Save changes' : 'Create path'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
            Everyone selected is assigned every training in this path. People already assigned a training keep their existing assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, department or job role" className="pl-9" />
          </div>

          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => setSelected(new Set(shown.map(p => p.id)))}>
              Select all shown ({shown.length})
            </button>
            <span className="text-slate-500">{selected.size} selected</span>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {shown.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-400">No people match.</p>
            ) : shown.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {[p.department, p.job_role_id ? roleById.get(p.job_role_id)?.name : null].filter(Boolean).join(' · ') || 'No department or role'}
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
