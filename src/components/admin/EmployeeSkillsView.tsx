'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Gauge, Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'
import { SKILL_PROFICIENCY_LEVELS } from '@/types'
import { proficiencyLabel, latestAssessmentBySkill, computeSkillGaps } from '@/lib/skills'
import type { EmployeeSkillAssessment, JobRole, JobRoleSkill, Module, ModuleSkill, Skill } from '@/types'

type EmployeeLite = { id: string; full_name: string; department: string | null; job_role_id: string | null }
type ModuleLite = Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>

interface Props {
  employees: EmployeeLite[]
  selectedId: string | null
  skills: Skill[]
  jobRoles: JobRole[]
  jobRoleSkills: JobRoleSkill[]
  moduleSkills: ModuleSkill[]
  modules: ModuleLite[]
  assessments: EmployeeSkillAssessment[]
  currentUserId: string
}

export function EmployeeSkillsView({
  employees, selectedId, skills, jobRoles, jobRoleSkills, moduleSkills, modules, assessments, currentUserId,
}: Props) {
  const router = useRouter()
  const [assessing, setAssessing] = useState<Skill | 'new' | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  const employee = employees.find(e => e.id === selectedId) ?? null
  const skillById = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills])
  const jobRole = employee?.job_role_id ? jobRoles.find(r => r.id === employee.job_role_id) ?? null : null

  const requiredForRole = useMemo(
    () => jobRoleSkills
      .filter(jrs => jrs.job_role_id === employee?.job_role_id)
      .map(jrs => ({ ...jrs, skill: skillById.get(jrs.skill_id) }))
      .filter((jrs): jrs is JobRoleSkill & { skill: Skill } => !!jrs.skill),
    [jobRoleSkills, employee, skillById]
  )

  const currentBySkill = useMemo(() => latestAssessmentBySkill(assessments), [assessments])
  const gaps = useMemo(() => computeSkillGaps(requiredForRole, currentBySkill), [requiredForRole, currentBySkill])

  // Full profile: required skills (already in `gaps`) plus any skill the
  // person has ever been assessed on, even outside their job role's requirements.
  const extraAssessedSkills = useMemo(() => {
    const requiredIds = new Set(requiredForRole.map(r => r.skill_id))
    return [...currentBySkill.values()]
      .filter(a => !requiredIds.has(a.skill_id))
      .map(a => skillById.get(a.skill_id))
      .filter((s): s is Skill => !!s)
  }, [currentBySkill, requiredForRole, skillById])

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const modulesForSkill = (skillId: string) =>
    moduleSkills.filter(ms => ms.skill_id === skillId).map(ms => moduleById.get(ms.module_id)).filter((m): m is ModuleLite => !!m)

  const gapCount = gaps.filter(g => g.gap > 0).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Users className="h-4 w-4 text-slate-400" />
        <Select value={selectedId ?? ''} onValueChange={id => router.push(`/employee-skills?userId=${id}`)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Choose an employee…" />
          </SelectTrigger>
          <SelectContent>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.full_name}{e.department ? ` — ${e.department}` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {employee && (
          <span className="text-sm text-slate-500">
            {jobRole ? `Job role: ${jobRole.name}` : 'No job role set — assign one on the Users page to compare against requirements.'}
          </span>
        )}
      </div>

      {!employee ? (
        <div className="text-center py-20 rounded-xl border border-dashed border-slate-300 bg-white">
          <Gauge className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 font-medium">
            {employees.length === 0 ? 'No employees to show' : 'Choose an employee to see their skill profile'}
          </p>
        </div>
      ) : (
        <>
          {jobRole && (
            <div className={`rounded-lg px-4 py-2.5 text-sm ${gapCount > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
              {gapCount > 0
                ? `${gapCount} skill gap${gapCount === 1 ? '' : 's'} vs. the ${jobRole.name} requirements`
                : requiredForRole.length > 0 ? `Meets every required skill for ${jobRole.name}` : `${jobRole.name} has no required skills set yet`}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {[...gaps.map(g => ({ skill: g.skill, required: g.requiredLevel as number | null, gap: g.gap })),
              ...extraAssessedSkills.map(s => ({ skill: s, required: null as number | null, gap: 0 }))]
              .map(row => {
                const current = currentBySkill.get(row.skill.id)
                const hasGap = row.required != null && row.gap > 0
                const recommended = hasGap ? modulesForSkill(row.skill.id) : []
                const expanded = historyFor === row.skill.id
                const history = assessments.filter(a => a.skill_id === row.skill.id)

                return (
                  <div key={row.skill.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-2">
                          {row.skill.name}
                          {row.skill.category && <Badge variant="outline">{row.skill.category}</Badge>}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {current
                            ? `${proficiencyLabel(current.proficiency_level)} (${current.proficiency_level}/5) · assessed ${formatDate(current.assessed_at)}`
                            : 'Not assessed yet'}
                          {row.required != null && ` · requires ${proficiencyLabel(row.required)} (${row.required}/5)`}
                        </p>
                      </div>
                      {hasGap && (
                        <Badge variant="warning" className="flex items-center gap-1 shrink-0">
                          <AlertTriangle className="h-3 w-3" /> Gap
                        </Badge>
                      )}
                      {row.required != null && !hasGap && (
                        <Badge variant="success" className="flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3" /> Met
                        </Badge>
                      )}
                      {history.length > 0 && (
                        <button
                          onClick={() => setHistoryFor(expanded ? null : row.skill.id)}
                          className="shrink-0 p-1 text-slate-400 hover:text-slate-700"
                          aria-label="Toggle history"
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setAssessing(row.skill)} className="shrink-0">
                        Assess
                      </Button>
                    </div>

                    {hasGap && recommended.length > 0 && (
                      <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-slate-400">Recommended training:</span>
                        {recommended.map(m => (
                          <Link key={m.id} href={`/admin/modules/${m.id}/edit`} className="text-xs text-blue-600 hover:underline">
                            {m.title}
                          </Link>
                        ))}
                      </div>
                    )}

                    {expanded && (
                      <div className="px-4 pb-3">
                        <ul className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200">
                          {history.map(h => (
                            <li key={h.id} className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-600">
                              <span>{proficiencyLabel(h.proficiency_level)} ({h.proficiency_level}/5)</span>
                              <span className="text-slate-400">
                                {h.source === 'supervisor' ? 'Supervisor' : 'Self'} · {formatDate(h.assessed_at)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            {gaps.length === 0 && extraAssessedSkills.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-10">No skills assessed yet for this person.</p>
            )}
          </div>

          <Button variant="outline" onClick={() => setAssessing('new')}>
            <Plus className="h-4 w-4 mr-2" /> Assess another skill
          </Button>
        </>
      )}

      {assessing && employee && (
        <AssessSkillDialog
          key={assessing === 'new' ? 'new' : assessing.id}
          preselected={assessing === 'new' ? null : assessing}
          skills={skills}
          employeeId={employee.id}
          currentUserId={currentUserId}
          onClose={() => setAssessing(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function AssessSkillDialog({
  preselected, skills, employeeId, currentUserId, onClose,
}: {
  preselected: Skill | null
  skills: Skill[]
  employeeId: string
  currentUserId: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [skillId, setSkillId] = useState(preselected?.id ?? '')
  const [level, setLevel] = useState('3')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!skillId) { toast.error('Choose a skill'); return }
    setSaving(true)
    const { error } = await supabase.from('employee_skill_assessments').insert({
      user_id: employeeId,
      skill_id: skillId,
      proficiency_level: Number(level),
      source: 'supervisor',
      assessed_by: currentUserId,
      notes: notes.trim() || null,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Assessment recorded')
    onClose()
    router.refresh()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assess skill</DialogTitle>
          <DialogDescription>Recorded as a supervisor assessment, timestamped now.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Skill</Label>
            <Select value={skillId} onValueChange={setSkillId} disabled={!!preselected}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a skill…" />
              </SelectTrigger>
              <SelectContent>
                {skills.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Proficiency level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SKILL_PROFICIENCY_LEVELS.map(l => (
                  <SelectItem key={l.value} value={String(l.value)}>{l.value} — {l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save assessment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
