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
import { COMPANIES, COMPANY_DEPARTMENTS } from '@/types'
import type { JobRole, LearningPath, LearningPathKind, LearningPathTarget, Module, Profile } from '@/types'

type ModuleLite = Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>
type PersonLite = Pick<Profile, 'id' | 'full_name' | 'department' | 'company' | 'role' | 'manager_id' | 'job_role_id' | 'is_active'>

const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: 'employee', label: 'Employees' },
  { value: 'manager', label: 'Managers' },
  { value: 'admin', label: 'Admins' },
]

interface AudienceFilters {
  companies: string[]
  departments: string[]
  roleIds: string[]
  supervisorIds: string[]
  accountTypes: string[]
}

interface Props {
  paths: LearningPath[]
  items: { path_id: string; module_id: string; order_index: number }[]
  pathTargets: LearningPathTarget[]
  enrollmentCounts: Record<string, number>
  // Job roles come from the Users section (created on the user form)
  roles: JobRole[]
  modules: ModuleLite[]
  people: PersonLite[]
  currentUserId: string
}

// Same rule the database uses: every kind of filter that has a selection must
// match (any one value within a kind); no filters at all matches nobody.
function matchesAudience(p: PersonLite, f: AudienceFilters) {
  if (!f.companies.length && !f.departments.length && !f.roleIds.length && !f.supervisorIds.length && !f.accountTypes.length) return false
  return (
    (!f.companies.length || (p.company != null && f.companies.includes(p.company))) &&
    (!f.departments.length || (p.department != null && f.departments.includes(p.department))) &&
    (!f.roleIds.length || (p.job_role_id != null && f.roleIds.includes(p.job_role_id))) &&
    (!f.supervisorIds.length || (p.manager_id != null && f.supervisorIds.includes(p.manager_id))) &&
    (!f.accountTypes.length || f.accountTypes.includes(p.role))
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors text-left',
        on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      )}
    >
      {on && <Check className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  )
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
    if (!confirm(`Delete "${path.title}"? People already enrolled keep the trainings they were assigned, but the path itself is removed.`)) return
    const { error } = await supabase.from('learning_paths').delete().eq('id', path.id)
    if (error) { toast.error(error.message); return }
    toast.success('Learning path deleted')
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Learning paths</h2>
            <p className="text-sm text-slate-500">
              An ordered set of trainings. Enrolling someone assigns every training in it. A path can enroll people
              automatically by the Company, Department and Job role set on their user record, or every new hire.
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
            <p className="text-slate-400 text-sm mt-1">Create one for a company, department or job role, or an onboarding path for new hires.</p>
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

      {editing && (
        <PathEditorDialog
          key={editing === 'new' ? 'new' : editing.id}
          path={editing === 'new' ? null : editing}
          initialModuleIds={editing === 'new' ? [] : itemsFor(editing.id).map(i => i.module_id)}
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

function PathEditorDialog({
  path, initialModuleIds, initialTargets, roles, modules, people, currentUserId, onClose,
}: {
  path: LearningPath | null
  initialModuleIds: string[]
  initialTargets: LearningPathTarget[]
  roles: JobRole[]
  modules: ModuleLite[]
  people: PersonLite[]
  currentUserId: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState(path?.title ?? '')
  const [description, setDescription] = useState(path?.description ?? '')
  const [kind, setKind] = useState<LearningPathKind>(path?.kind ?? 'learning')
  const [companies, setCompanies] = useState<string[]>(initialTargets.filter(t => t.kind === 'company').map(t => t.value))
  const [departments, setDepartments] = useState<string[]>(initialTargets.filter(t => t.kind === 'department').map(t => t.value))
  const [roleIds, setRoleIds] = useState<string[]>(initialTargets.filter(t => t.kind === 'job_role').map(t => t.value))
  const [supervisorIds, setSupervisorIds] = useState<string[]>(initialTargets.filter(t => t.kind === 'supervisor').map(t => t.value))
  const [accountTypes, setAccountTypes] = useState<string[]>(initialTargets.filter(t => t.kind === 'account_role').map(t => t.value))
  const [autoNewHires, setAutoNewHires] = useState(path?.auto_enroll_new_hires ?? false)
  const [published, setPublished] = useState(path?.is_published ?? false)
  const [moduleIds, setModuleIds] = useState<string[]>(initialModuleIds)
  const [saving, setSaving] = useState(false)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const available = modules.filter(m => !moduleIds.includes(m.id))

  // Company / department choices are the ones users can be given (plus any
  // already in use), taken from the user records rather than a separate list.
  const companyOptions = useMemo(
    () => [...new Set([...COMPANIES, ...people.map(p => p.company).filter((c): c is string => !!c)])].sort(),
    [people]
  )
  const departmentOptions = useMemo(() => {
    const inScope = (c: string | null | undefined) => companies.length === 0 || (!!c && companies.includes(c))
    const configured = (companies.length ? companies : Object.keys(COMPANY_DEPARTMENTS)).flatMap(c => COMPANY_DEPARTMENTS[c] ?? [])
    const inUse = people.filter(p => inScope(p.company)).map(p => p.department).filter((d): d is string => !!d)
    return [...new Set([...configured, ...inUse, ...departments])].sort()
  }, [companies, departments, people])

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])

  // Supervisors are whoever has been set as someone's supervisor on the Users page.
  const supervisorOptions = useMemo(() => {
    const ids = new Set([...people.map(p => p.manager_id).filter((id): id is string => !!id), ...supervisorIds])
    return [...ids]
      .map(id => ({ id, name: people.find(p => p.id === id)?.full_name ?? 'Unknown', team: people.filter(p => p.manager_id === id).length }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [people, supervisorIds])

  const hasFilters = companies.length + departments.length + roleIds.length + supervisorIds.length + accountTypes.length > 0
  const matchCount = useMemo(
    () => people.filter(p => matchesAudience(p, { companies, departments, roleIds, supervisorIds, accountTypes })).length,
    [people, companies, departments, roleIds, supervisorIds, accountTypes]
  )

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
        // Audience lives in learning_path_targets; the old single-role column is unused
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

      // Replace the audience filters
      const { error: targetsDelError } = await supabase.from('learning_path_targets').delete().eq('path_id', pathId)
      if (targetsDelError) throw targetsDelError
      const targetRows = [
        ...companies.map(value => ({ path_id: pathId, kind: 'company', value })),
        ...departments.map(value => ({ path_id: pathId, kind: 'department', value })),
        ...roleIds.map(value => ({ path_id: pathId, kind: 'job_role', value })),
        ...supervisorIds.map(value => ({ path_id: pathId, kind: 'supervisor', value })),
        ...accountTypes.map(value => ({ path_id: pathId, kind: 'account_role', value })),
      ]
      if (targetRows.length > 0) {
        const { error: targetsError } = await supabase.from('learning_path_targets').insert(targetRows)
        if (targetsError) throw targetsError
      }

      if (moduleIds.length > 0) {
        const { error } = await supabase
          .from('learning_path_items')
          .insert(moduleIds.map((module_id, i) => ({ path_id: pathId, module_id, order_index: i })))
        if (error) throw error
      }

      // Apply the audience once everything above is saved (never per filter,
      // so a half-saved set of filters can't over-enroll anyone).
      let enrolled = 0
      if (published && hasFilters) {
        const { data, error } = await supabase.rpc('sync_learning_path', { p_path: pathId })
        if (error) throw error
        enrolled = (data as number) ?? 0
      }

      toast.success(
        path ? 'Learning path saved' : 'Learning path created',
        enrolled > 0 ? { description: `${enrolled} matching ${enrolled === 1 ? 'person is' : 'people are'} enrolled.` } : undefined
      )
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

          {/* Audience — taken from the Users section */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div>
              <Label>Who gets this path automatically</Label>
              <p className="text-xs text-slate-400 mt-0.5">
                Based on each person&apos;s details in Users: Company, Department, Job role, Manager and Account type. This
                stays in sync as you edit users. A person needs to match every group you fill in (any one choice within a group
                counts). Leave all empty to enroll people manually.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Company</p>
              <div className="flex flex-wrap gap-2">
                {companyOptions.map(c => (
                  <Chip key={c} on={companies.includes(c)} onClick={() => toggle(companies, setCompanies, c)}>{c}</Chip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Department</p>
              <div className="flex flex-wrap gap-2">
                {departmentOptions.map(d => (
                  <Chip key={d} on={departments.includes(d)} onClick={() => toggle(departments, setDepartments, d)}>{d}</Chip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Job role</p>
              {roles.length === 0 ? (
                <p className="text-xs text-slate-400">No job roles yet — add them on the Users page when you edit a user.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.map(r => (
                    <Chip key={r.id} on={roleIds.includes(r.id)} onClick={() => toggle(roleIds, setRoleIds, r.id)}>{r.name}</Chip>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Manager (their team)</p>
              {supervisorOptions.length === 0 ? (
                <p className="text-xs text-slate-400">No managers assigned yet — set a manager on a user in the Users page.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {supervisorOptions.map(s => (
                    <Chip key={s.id} on={supervisorIds.includes(s.id)} onClick={() => toggle(supervisorIds, setSupervisorIds, s.id)}>
                      {s.name} <span className="opacity-60">({s.team})</span>
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">Account type</p>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_TYPES.map(a => (
                  <Chip key={a.value} on={accountTypes.includes(a.value)} onClick={() => toggle(accountTypes, setAccountTypes, a.value)}>{a.label}</Chip>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              {hasFilters
                ? `${matchCount} current ${matchCount === 1 ? 'user matches' : 'users match'} these filters${published ? ' and will be enrolled when you save.' : ' (enrolled once the path is published).'}`
                : 'No filters selected — nobody is enrolled automatically.'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={autoNewHires} onCheckedChange={v => setAutoNewHires(!!v)} />
              Also enroll every newly created user (new-hire path)
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
            Everyone selected is assigned every training in this path. People already assigned a training keep their existing assignment.
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
