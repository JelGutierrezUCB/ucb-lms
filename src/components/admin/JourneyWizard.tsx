'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Pencil, Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn, getCategoryLabel } from '@/lib/utils'
import { COMPANIES, COMPANY_DEPARTMENTS } from '@/types'
import type { JobRole, LearningPath, LearningPathKind, LearningPathTarget } from '@/types'
import { ACCOUNT_TYPES, Chip, matchesAudience, type ModuleLite, type PersonLite } from './journey-shared'

const STEPS = [
  { title: 'Details', hint: 'Name your journey' },
  { title: 'Trainings', hint: 'Choose the steps, in order' },
  { title: 'Audience', hint: 'Decide who gets it' },
  { title: 'Review & publish', hint: 'Check everything and go live' },
] as const

// Step-by-step builder for a learning journey: Details → Trainings → Audience →
// Review & publish. Each step only asks for one kind of decision, and the
// last step summarises everything (including how many people will get it)
// before anything is saved.
export function JourneyWizard({
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

  const [step, setStep] = useState(0)
  const [attempted, setAttempted] = useState(false) // show validation hints after a failed "Next"
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)

  const [title, setTitle] = useState(path?.title ?? '')
  const [description, setDescription] = useState(path?.description ?? '')
  const [kind, setKind] = useState<LearningPathKind>(path?.kind ?? 'learning')
  const [moduleIds, setModuleIds] = useState<string[]>(initialModuleIds)
  const [companies, setCompanies] = useState<string[]>(initialTargets.filter(t => t.kind === 'company').map(t => t.value))
  const [departments, setDepartments] = useState<string[]>(initialTargets.filter(t => t.kind === 'department').map(t => t.value))
  const [roleIds, setRoleIds] = useState<string[]>(initialTargets.filter(t => t.kind === 'job_role').map(t => t.value))
  const [managerIds, setManagerIds] = useState<string[]>(initialTargets.filter(t => t.kind === 'supervisor').map(t => t.value))
  const [accountTypes, setAccountTypes] = useState<string[]>(initialTargets.filter(t => t.kind === 'account_role').map(t => t.value))
  const [autoNewHires, setAutoNewHires] = useState(path?.auto_enroll_new_hires ?? false)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles])
  const available = modules.filter(m => !moduleIds.includes(m.id))
  const totalMinutes = moduleIds.reduce((sum, id) => sum + (moduleById.get(id)?.estimated_minutes ?? 0), 0)

  // Company / department choices come from the user records (plus what users can be given).
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
  const managerOptions = useMemo(() => {
    const ids = new Set([...people.map(p => p.manager_id).filter((id): id is string => !!id), ...managerIds])
    return [...ids]
      .map(id => ({ id, name: people.find(p => p.id === id)?.full_name ?? 'Unknown', team: people.filter(p => p.manager_id === id).length }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [people, managerIds])

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])

  const hasFilters = companies.length + departments.length + roleIds.length + managerIds.length + accountTypes.length > 0
  const matchCount = useMemo(
    () => people.filter(p => matchesAudience(p, { companies, departments, roleIds, supervisorIds: managerIds, accountTypes })).length,
    [people, companies, departments, roleIds, managerIds, accountTypes]
  )

  // What each step needs before you can move on.
  const problem = (s: number): string | null => {
    if (s === 0 && !title.trim()) return 'Give your journey a title to continue.'
    if (s === 1 && moduleIds.length === 0) return 'Add at least one training to continue.'
    return null
  }

  function goTo(target: number) {
    if (target > step) {
      for (let s = step; s < target; s++) {
        if (problem(s)) {
          setAttempted(true)
          setStep(s)
          return
        }
      }
    }
    setAttempted(false)
    setStep(target)
  }

  const move = (index: number, delta: number) =>
    setModuleIds(ids => {
      const next = [...ids]
      const target = index + delta
      if (target < 0 || target >= next.length) return ids
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  async function finish(publish: boolean) {
    setSaving(publish ? 'publish' : 'draft')
    try {
      const fields = {
        title: title.trim(),
        description: description.trim() || null,
        kind,
        // Audience lives in learning_path_targets; the old single-role column is unused
        job_role_id: null,
        auto_enroll_new_hires: autoNewHires,
        is_published: publish,
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

      const { error: targetsDelError } = await supabase.from('learning_path_targets').delete().eq('path_id', pathId)
      if (targetsDelError) throw targetsDelError
      const targetRows = [
        ...companies.map(value => ({ path_id: pathId, kind: 'company', value })),
        ...departments.map(value => ({ path_id: pathId, kind: 'department', value })),
        ...roleIds.map(value => ({ path_id: pathId, kind: 'job_role', value })),
        ...managerIds.map(value => ({ path_id: pathId, kind: 'supervisor', value })),
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
      if (publish && hasFilters) {
        const { data, error } = await supabase.rpc('sync_learning_path', { p_path: pathId })
        if (error) throw error
        enrolled = (data as number) ?? 0
      }

      toast.success(
        publish ? (path?.is_published ? 'Journey saved' : 'Journey published') : 'Saved as a draft',
        enrolled > 0 ? { description: `${enrolled} matching ${enrolled === 1 ? 'person is' : 'people are'} enrolled.` } : undefined
      )
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save learning journey')
    } finally {
      setSaving(null)
    }
  }

  const isLast = step === STEPS.length - 1
  const stepProblem = attempted ? problem(step) : null

  const audienceSummary: { label: string; values: string[] }[] = [
    { label: 'Company', values: companies },
    { label: 'Department', values: departments },
    { label: 'Job role', values: roleIds.map(id => roleById.get(id)?.name ?? 'Unknown role') },
    { label: 'Manager', values: managerIds.map(id => managerOptions.find(m => m.id === id)?.name ?? 'Unknown') },
    { label: 'Account type', values: accountTypes.map(a => ACCOUNT_TYPES.find(t => t.value === a)?.label ?? a) },
  ].filter(g => g.values.length > 0)

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {/* Header + stepper */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 pt-5 pb-4 sm:px-6">
          <DialogTitle>{path ? 'Edit learning journey' : 'New learning journey'}</DialogTitle>
          <DialogDescription className="mt-0.5">
            Step {step + 1} of {STEPS.length} · {STEPS[step].hint}
          </DialogDescription>

          <ol className="mt-4 flex items-center">
            {STEPS.map((s, i) => {
              const done = i < step
              const current = i === step
              return (
                <li key={s.title} className="flex flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    className="group flex items-center gap-2"
                    aria-current={current ? 'step' : undefined}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                        done && 'border-green-500 bg-green-500 text-white',
                        current && 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100',
                        !done && !current && 'border-slate-300 bg-white text-slate-400 group-hover:border-slate-400'
                      )}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span className={cn('hidden text-sm font-medium sm:inline', current ? 'text-slate-900' : 'text-slate-500')}>
                      {s.title}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span className={cn('mx-2 h-0.5 flex-1 sm:mx-3', i < step ? 'bg-green-400' : 'bg-slate-200')} />
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        {/* Step body */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-5 sm:px-6">
          {stepProblem && (
            <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {stepProblem}
            </p>
          )}

          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Journey title</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Warehouse New Hire Onboarding"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description <span className="font-normal text-slate-400">(optional)</span></Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What this journey covers and who it's for. Learners see this at the top of their roadmap."
                />
              </div>
              <div className="space-y-2">
                <Label>What kind of journey is it?</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ['learning', 'Learning journey', 'Ongoing training for a role or team.'],
                    ['onboarding', 'New-hire onboarding', 'The first steps for someone joining. Shown with an onboarding badge and pinned to the top of their dashboard.'],
                  ] as const).map(([value, label, help]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setKind(value)}
                      aria-pressed={kind === value}
                      className={cn(
                        'rounded-xl border-2 p-4 text-left transition-colors',
                        kind === value ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium text-slate-900">
                        {value === 'onboarding' && <Sparkles className="h-4 w-4 text-blue-600" />}
                        {label}
                        {kind === value && <Check className="ml-auto h-4 w-4 text-blue-600" />}
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">{help}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Add the trainings people should complete, then put them in the order you want them taken. Learners see them as
                numbered steps on a roadmap.
              </p>

              {moduleIds.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                  No trainings yet — add your first one below.
                </p>
              ) : (
                <ol className="space-y-2">
                  {moduleIds.map((id, i) => {
                    const m = moduleById.get(id)
                    return (
                      <li key={id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{m?.title ?? 'Unavailable training'}</p>
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
                  <SelectValue placeholder={available.length === 0 ? 'Every training has been added' : 'Add a training…'} />
                </SelectTrigger>
                <SelectContent>
                  {available.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {moduleIds.length > 0 && (
                <p className="text-xs text-slate-500">
                  {moduleIds.length} training{moduleIds.length === 1 ? '' : 's'} · about {totalMinutes} min in total
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-slate-500">
                  Choose who this journey is for. It uses each person&apos;s details from the Users page and stays up to date as
                  those details change. Pick as many as you like — a person needs to match every group you fill in (any one
                  choice within a group counts).
                </p>
                <p className="mt-1 text-xs text-slate-400">Prefer to pick people yourself? Skip this step and use Enroll on the journey later.</p>
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
                <p className="text-sm font-medium text-slate-700">Manager</p>
                {managerOptions.length === 0 ? (
                  <p className="text-xs text-slate-400">No managers assigned yet — set a manager on a user in the Users page.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {managerOptions.map(m => (
                      <Chip key={m.id} on={managerIds.includes(m.id)} onClick={() => toggle(managerIds, setManagerIds, m.id)}>
                        {m.name} <span className="opacity-60">({m.team})</span>
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

              <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                <Checkbox checked={autoNewHires} onCheckedChange={v => setAutoNewHires(!!v)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Also enroll every newly created user</span>
                  <span className="block text-xs text-slate-400">Good for onboarding journeys: anyone added from now on gets this automatically.</span>
                </span>
              </label>

              <p className={cn('rounded-lg px-3 py-2 text-sm', hasFilters ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-500')}>
                {hasFilters
                  ? `${matchCount} current ${matchCount === 1 ? 'user matches' : 'users match'} these filters.`
                  : autoNewHires
                    ? 'No filters selected — only new users will be enrolled automatically.'
                    : 'No filters selected — nobody is enrolled automatically.'}
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Take a last look. Use <span className="font-medium">Edit</span> to change anything, then publish — or save as a
                draft to finish later.
              </p>

              <ReviewBlock title="Details" onEdit={() => goTo(0)}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{title.trim() || 'Untitled journey'}</p>
                  {kind === 'onboarding' && <Badge className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Onboarding</Badge>}
                </div>
                {description.trim() && <p className="mt-1 text-sm text-slate-500">{description.trim()}</p>}
              </ReviewBlock>

              <ReviewBlock title={`Trainings (${moduleIds.length}) · about ${totalMinutes} min`} onEdit={() => goTo(1)}>
                {moduleIds.length === 0 ? (
                  <p className="text-sm text-amber-700">No trainings added yet.</p>
                ) : (
                  <ol className="space-y-0.5 text-sm text-slate-700">
                    {moduleIds.map((id, i) => (
                      <li key={id} className="truncate">
                        <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                        {moduleById.get(id)?.title ?? 'Unavailable training'}
                      </li>
                    ))}
                  </ol>
                )}
              </ReviewBlock>

              <ReviewBlock title="Audience" onEdit={() => goTo(2)}>
                {audienceSummary.length === 0 && !autoNewHires ? (
                  <p className="text-sm text-slate-500">No automatic audience — you&apos;ll enroll people yourself with the Enroll button.</p>
                ) : (
                  <div className="space-y-1.5 text-sm text-slate-700">
                    {audienceSummary.map(g => (
                      <p key={g.label}>
                        <span className="font-medium">{g.label}:</span> {g.values.join(', ')}
                      </p>
                    ))}
                    {autoNewHires && <p><span className="font-medium">Every new user</span> is enrolled automatically.</p>}
                    {hasFilters && (
                      <p className="pt-1 text-blue-700">
                        {matchCount} current {matchCount === 1 ? 'user matches' : 'users match'} and will be enrolled when you publish.
                      </p>
                    )}
                  </div>
                )}
              </ReviewBlock>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button variant="ghost" onClick={onClose} className="sm:mr-auto">Cancel</Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {step > 0 && (
              <Button variant="outline" onClick={() => goTo(step - 1)} disabled={!!saving}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            )}
            {!isLast ? (
              <Button onClick={() => goTo(step + 1)}>
                Next <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="outline" loading={saving === 'draft'} disabled={!!saving} onClick={() => finish(false)}>
                  {path?.is_published ? 'Unpublish (save as draft)' : 'Save as draft'}
                </Button>
                <Button loading={saving === 'publish'} disabled={!!saving} onClick={() => finish(true)}>
                  {path?.is_published ? 'Save changes' : 'Publish journey'}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
      {children}
    </section>
  )
}
