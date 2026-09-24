'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Check, ListChecks, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatDate, getCategoryLabel } from '@/lib/utils'
import type { CourseRule, CourseRuleTarget, JobRole } from '@/types'
import { AudiencePicker, audienceMatches, type AudienceValue } from './AudiencePicker'
import { ACCOUNT_TYPES, type ModuleLite, type PersonLite } from './journey-shared'

type RuleModule = ModuleLite & { is_published: boolean }

interface Props {
  rules: CourseRule[]
  targets: CourseRuleTarget[]
  assignedCounts: Record<string, number>
  modules: RuleModule[]
  roles: JobRole[]
  people: PersonLite[]
  currentUserId: string
}

const dueText = (r: CourseRule) =>
  r.due_mode === 'fixed' && r.due_date ? `Due ${formatDate(r.due_date)}`
  : r.due_mode === 'relative' && r.due_days ? `Due ${r.due_days} day${r.due_days === 1 ? '' : 's'} after assigned`
  : 'No due date'

const audienceFromTargets = (targets: CourseRuleTarget[]): AudienceValue => ({
  companies: targets.filter(t => t.kind === 'company').map(t => t.value),
  departments: targets.filter(t => t.kind === 'department').map(t => t.value),
  roleIds: targets.filter(t => t.kind === 'job_role').map(t => t.value),
  managerIds: targets.filter(t => t.kind === 'supervisor').map(t => t.value),
  accountTypes: targets.filter(t => t.kind === 'account_role').map(t => t.value),
  personIds: targets.filter(t => t.kind === 'person').map(t => t.value),
})

export function RuleManager({ rules, targets, assignedCounts, modules, roles, people, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState<CourseRule | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles])
  const nameById = useMemo(() => new Map(people.map(p => [p.id, p.full_name])), [people])
  const targetsFor = (ruleId: string) => targets.filter(t => t.rule_id === ruleId)

  async function applyNow(rule: CourseRule) {
    setBusy(rule.id)
    try {
      const res = await fetch('/api/course-rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId: rule.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.assigned > 0 ? `Assigned ${data.assigned} ${data.assigned === 1 ? 'person' : 'people'}` : 'No one new to assign — everyone who matches already has it')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to apply rule')
    } finally {
      setBusy(null)
    }
  }

  async function deleteRule(rule: CourseRule) {
    if (!confirm('Delete this rule? People who were already assigned keep their assignment; new people just won\'t be assigned by it any more.')) return
    const { error } = await supabase.from('course_rules').delete().eq('id', rule.id)
    if (error) { toast.error(error.message); return }
    toast.success('Rule deleted')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Assignment rules</h2>
          <p className="text-sm text-slate-500">
            Assign a course to a group automatically — by company, department or facility, job role, manager&apos;s team or
            individual people — as required or optional, with a due date. New people are picked up as they&apos;re added or their
            details change.
          </p>
        </div>
        <Button onClick={() => setEditing('new')} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> New rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <ListChecks className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-500">No assignment rules yet</p>
          <p className="mt-1 text-sm text-slate-400">For example: &ldquo;Forklift Safety — required for the Warehouse department, due 14 days after they&apos;re assigned.&rdquo;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rules.map(rule => {
            const mod = moduleById.get(rule.module_id)
            const rt = targetsFor(rule.id)
            const individuals = rt.filter(t => t.kind === 'person')
            return (
              <Card key={rule.id} className={cn(!rule.is_active && 'opacity-70')}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{mod?.title ?? 'Unavailable course'}</p>
                      {mod && <p className="text-xs text-slate-400">{getCategoryLabel(mod.category)} · {mod.estimated_minutes} min</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={rule.requirement === 'required' ? 'default' : 'outline'}>
                        {rule.requirement === 'required' ? 'Required' : 'Optional'}
                      </Badge>
                      {!rule.is_active && <Badge variant="warning">Paused</Badge>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{dueText(rule)}</Badge>
                    {rt.filter(t => t.kind !== 'person').map(t => (
                      <Badge key={`${t.kind}:${t.value}`} variant="outline">
                        {{ company: 'Company', department: 'Dept', job_role: 'Role', supervisor: 'Manager', account_role: 'Type', person: 'Person' }[t.kind]}:{' '}
                        {t.kind === 'job_role' ? roleById.get(t.value)?.name ?? 'Unknown role'
                          : t.kind === 'supervisor' ? nameById.get(t.value) ?? 'Unknown'
                          : t.kind === 'account_role' ? ACCOUNT_TYPES.find(a => a.value === t.value)?.label ?? t.value
                          : t.value}
                      </Badge>
                    ))}
                    {individuals.length > 0 && (
                      <Badge variant="outline">{individuals.length} individual{individuals.length === 1 ? '' : 's'}</Badge>
                    )}
                    {rule.auto_enroll_new_hires && <Badge variant="warning">Every new user</Badge>}
                  </div>

                  {mod && !mod.is_published && (
                    <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> This course isn&apos;t published yet — people are assigned as soon as you publish it.
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-slate-400">{assignedCounts[rule.id] ?? 0} assigned by this rule</span>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => applyNow(rule)} loading={busy === rule.id} disabled={!rule.is_active}>
                        <Play className="mr-1.5 h-4 w-4" /> Apply now
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(rule)}>
                        <Pencil className="mr-1.5 h-4 w-4" /> Edit
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteRule(rule)} title="Delete rule" className="text-slate-400 hover:text-red-600">
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
        <RuleDialog
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? null : editing}
          initialAudience={editing === 'new' ? audienceFromTargets([]) : audienceFromTargets(targetsFor(editing.id))}
          modules={modules}
          roles={roles}
          people={people}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function RuleDialog({
  rule, initialAudience, modules, roles, people, currentUserId, onClose,
}: {
  rule: CourseRule | null
  initialAudience: AudienceValue
  modules: RuleModule[]
  roles: JobRole[]
  people: PersonLite[]
  currentUserId: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [moduleId, setModuleId] = useState(rule?.module_id ?? '')
  const [requirement, setRequirement] = useState<'required' | 'optional'>(rule?.requirement ?? 'required')
  const [dueMode, setDueMode] = useState<'none' | 'fixed' | 'relative'>(rule?.due_mode ?? 'none')
  const [dueDate, setDueDate] = useState(rule?.due_date ?? '')
  const [dueDays, setDueDays] = useState(String(rule?.due_days ?? 14))
  const [audience, setAudience] = useState<AudienceValue>(initialAudience)
  const [newHires, setNewHires] = useState(rule?.auto_enroll_new_hires ?? false)
  const [active, setActive] = useState(rule?.is_active ?? true)
  const [saving, setSaving] = useState(false)

  const selectedModule = modules.find(m => m.id === moduleId)
  const hasAudience = Object.values(audience).some(l => l.length > 0)
  const matchCount = people.filter(p => audienceMatches(p, audience)).length
  const today = new Date().toISOString().slice(0, 10)

  async function save() {
    if (!moduleId) { toast.error('Choose a course'); return }
    if (dueMode === 'fixed' && !dueDate) { toast.error('Pick a due date'); return }
    if (dueMode === 'relative' && !(Number(dueDays) >= 1)) { toast.error('Enter how many days people have (1 or more)'); return }
    if (!hasAudience && !newHires) { toast.error('Choose who this applies to — or tick "every new user"'); return }

    setSaving(true)
    try {
      const fields = {
        module_id: moduleId,
        requirement,
        due_mode: dueMode,
        due_date: dueMode === 'fixed' ? dueDate : null,
        due_days: dueMode === 'relative' ? Math.floor(Number(dueDays)) : null,
        auto_enroll_new_hires: newHires,
        is_active: active,
      }

      let ruleId = rule?.id
      if (rule) {
        const { error } = await supabase.from('course_rules').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', rule.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('course_rules').insert({ ...fields, created_by: currentUserId }).select('id').single()
        if (error) throw error
        ruleId = data.id
      }

      // Replace the audience, then apply the rule once everything is saved
      // (never per row, so a half-saved audience can't over-assign).
      const { error: delError } = await supabase.from('course_rule_targets').delete().eq('rule_id', ruleId)
      if (delError) throw delError
      const rows = [
        ...audience.companies.map(value => ({ rule_id: ruleId, kind: 'company', value })),
        ...audience.departments.map(value => ({ rule_id: ruleId, kind: 'department', value })),
        ...audience.roleIds.map(value => ({ rule_id: ruleId, kind: 'job_role', value })),
        ...audience.managerIds.map(value => ({ rule_id: ruleId, kind: 'supervisor', value })),
        ...audience.accountTypes.map(value => ({ rule_id: ruleId, kind: 'account_role', value })),
        ...audience.personIds.map(value => ({ rule_id: ruleId, kind: 'person', value })),
      ]
      if (rows.length > 0) {
        const { error } = await supabase.from('course_rule_targets').insert(rows)
        if (error) throw error
      }

      let assigned = 0
      if (active) {
        const res = await fetch('/api/course-rules/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ruleId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        assigned = data.assigned ?? 0
      }

      toast.success(rule ? 'Rule saved' : 'Rule created', {
        description: !active ? 'The rule is paused, so nobody was assigned.'
          : assigned > 0 ? `${assigned} ${assigned === 1 ? 'person was' : 'people were'} assigned.`
          : selectedModule && !selectedModule.is_published ? 'People will be assigned once the course is published.'
          : undefined,
      })
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit assignment rule' : 'New assignment rule'}</DialogTitle>
          <DialogDescription>Choose a course, whether it&apos;s required, when it&apos;s due, and who gets it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-1.5">
            <Label>1. Course</Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger><SelectValue placeholder="Choose a course…" /></SelectTrigger>
              <SelectContent>
                {modules.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.title}{m.is_published ? '' : ' (draft)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModule && !selectedModule.is_published && (
              <p className="text-xs text-amber-700">Draft course — people are assigned once you publish it.</p>
            )}
          </section>

          <section className="space-y-2">
            <Label>2. Required or optional?</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['required', 'Required', 'Counts toward completion. Shows as overdue after the due date.'],
                ['optional', 'Optional', 'Offered to the person, but never overdue and not counted against them.'],
              ] as const).map(([value, label, help]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRequirement(value)}
                  aria-pressed={requirement === value}
                  className={cn('rounded-xl border-2 p-3 text-left transition-colors', requirement === value ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300')}
                >
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    {label}
                    {requirement === value && <Check className="ml-auto h-4 w-4 text-blue-600" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{help}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <Label>3. Due date</Label>
            <div className="flex flex-wrap gap-2">
              {([['none', 'No due date'], ['fixed', 'A fixed date'], ['relative', 'Days after assigned']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDueMode(value)}
                  aria-pressed={dueMode === value}
                  className={cn('rounded-full border px-3 py-1 text-sm transition-colors', dueMode === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50')}
                >
                  {label}
                </button>
              ))}
            </div>
            {dueMode === 'fixed' && (
              <div className="space-y-1">
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="sm:w-52" aria-label="Due date" />
                {dueDate && dueDate < today && (
                  <p className="text-xs text-amber-700">That date has passed — people will be assigned as already overdue.</p>
                )}
              </div>
            )}
            {dueMode === 'relative' && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Input type="number" min={1} value={dueDays} onChange={e => setDueDays(e.target.value)} className="w-24" aria-label="Days to complete" />
                days after each person is assigned
              </div>
            )}
          </section>

          <section className="space-y-2">
            <Label>4. Who gets it</Label>
            <AudiencePicker value={audience} onChange={setAudience} people={people} roles={roles} />
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
              <Checkbox checked={newHires} onCheckedChange={v => setNewHires(!!v)} className="mt-0.5" />
              <span>
                <span className="font-medium">Also assign to every newly created user</span>
                <span className="block text-xs text-slate-400">Anyone added from now on gets this course automatically.</span>
              </span>
            </label>
            {hasAudience && (
              <p className="text-xs text-slate-500">{matchCount} current {matchCount === 1 ? 'person matches' : 'people match'} — anyone who already has this course keeps their existing assignment.</p>
            )}
          </section>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={active} onCheckedChange={v => setActive(!!v)} />
            Rule is active (untick to pause it without deleting)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>{rule ? 'Save & apply' : 'Create & apply'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
