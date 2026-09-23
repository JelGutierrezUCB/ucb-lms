'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Check, Layers, Pencil, Plus, Search, Sparkles, Trash2, UserPlus, X } from 'lucide-react'
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
import { cn, getCategoryLabel } from '@/lib/utils'
import type { JobRole, LearningPath, LearningPathKind, Module, Profile } from '@/types'

type ModuleLite = Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>
type PersonLite = Pick<Profile, 'id' | 'full_name' | 'department' | 'role' | 'job_role_id' | 'is_active'>

interface Props {
  paths: LearningPath[]
  items: { path_id: string; module_id: string; order_index: number }[]
  pathRoles: { path_id: string; job_role_id: string }[]
  enrollmentCounts: Record<string, number>
  roles: JobRole[]
  memberCounts: Record<string, number>
  modules: ModuleLite[]
  people: PersonLite[]
  currentUserId: string
}

export function PathManager({ paths, items, pathRoles, enrollmentCounts, roles, memberCounts, modules, people, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState<LearningPath | 'new' | null>(null)
  const [enrolling, setEnrolling] = useState<LearningPath | null>(null)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles])

  const itemsFor = (pathId: string) =>
    items.filter(i => i.path_id === pathId).sort((a, b) => a.order_index - b.order_index)

  const roleIdsFor = (pathId: string) =>
    pathRoles.filter(r => r.path_id === pathId).map(r => r.job_role_id)

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
              const pathRoleNames = roleIdsFor(path.id).map(id => roleById.get(id)?.name).filter(Boolean) as string[]
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
                      {pathRoleNames.map(name => <Badge key={name} variant="outline">Role: {name}</Badge>)}
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
          initialRoleIds={editing === 'new' ? [] : roleIdsFor(editing.id)}
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
          roles={roles}
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
  path, initialModuleIds, initialRoleIds, roles, modules, currentUserId, onClose,
}: {
  path: LearningPath | null
  initialModuleIds: string[]
  initialRoleIds: string[]
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
  const [roleIds, setRoleIds] = useState<string[]>(initialRoleIds)
  const [newRole, setNewRole] = useState('')
  const [addingRole, setAddingRole] = useState(false)
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

  // Create a job role without leaving the editor, and select it for this path.
  async function addRole() {
    const name = newRole.trim()
    if (!name) return
    setAddingRole(true)
    const { data, error } = await supabase.from('job_roles').insert({ name }).select('id').single()
    setAddingRole(false)
    if (error) { toast.error(error.code === '23505' ? 'That job role already exists' : error.message); return }
    setRoleIds(ids => [...ids, data.id])
    setNewRole('')
    toast.success(`Added "${name}"`)
    router.refresh()
  }

  async function save() {
    if (!title.trim()) { toast.error('Give the path a title'); return }
    if (published && moduleIds.length === 0) { toast.error('Add at least one training before publishing'); return }
    setSaving(true)
    try {
      const fields = {
        title: title.trim(),
        description: description.trim() || null,
        kind,
        // Roles live in learning_path_roles now; the old single-role column is unused
        job_role_id: null,
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

      // Replace the set of targeted job roles
      const { error: rolesDelError } = await supabase.from('learning_path_roles').delete().eq('path_id', pathId)
      if (rolesDelError) throw rolesDelError
      if (roleIds.length > 0) {
        const { error: rolesError } = await supabase
          .from('learning_path_roles')
          .insert(roleIds.map(job_role_id => ({ path_id: pathId, job_role_id })))
        if (rolesError) throw rolesError
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

          <div className="space-y-1.5 sm:max-w-xs">
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
            <Label>Auto-enroll these job roles</Label>
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {roles.map(r => {
                  const on = roleIds.includes(r.id)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoleIds(ids => on ? ids.filter(x => x !== r.id) : [...ids, r.id])}
                      aria-pressed={on}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors text-left',
                        on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5 shrink-0" />}
                      {r.name}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-slate-400">
              {roles.length === 0
                ? 'No job roles yet — add one below.'
                : `${roleIds.length} selected. Tap a role to select or unselect it; everyone with any selected role is enrolled automatically. Leave none selected to enroll people manually.`}
            </p>
            <div className="flex gap-2 sm:max-w-sm">
              <Input
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
                placeholder="Add another job role"
                aria-label="Add another job role"
              />
              <Button type="button" variant="outline" onClick={addRole} loading={addingRole} className="shrink-0">Add</Button>
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
  path, people, roles, roleById, onClose,
}: {
  path: LearningPath
  people: PersonLite[]
  roles: JobRole[]
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

  // Everyone holding a given job role — used by the role quick-select chips.
  const peopleInRole = (roleId: string) => people.filter(p => p.job_role_id === roleId).map(p => p.id)
  const roleFullySelected = (roleId: string) => {
    const ids = peopleInRole(roleId)
    return ids.length > 0 && ids.every(id => selected.has(id))
  }
  const toggleRole = (roleId: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      const ids = peopleInRole(roleId)
      const allIn = ids.length > 0 && ids.every(id => next.has(id))
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
            Everyone selected is assigned every training in this path. People already assigned a training keep their existing assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {roles.some(r => peopleInRole(r.id).length > 0) && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Add everyone in a job role</p>
              <div className="flex flex-wrap gap-2">
                {roles.filter(r => peopleInRole(r.id).length > 0).map(r => {
                  const on = roleFullySelected(r.id)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      aria-pressed={on}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm transition-colors text-left',
                        on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {r.name} <span className={on ? 'text-blue-100' : 'text-slate-400'}>({peopleInRole(r.id).length})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
