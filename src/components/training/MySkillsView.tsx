'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Plus, Target } from 'lucide-react'
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
import { latestAssessmentBySkill, computeSkillGaps } from '@/lib/skills'
import { fmt } from '@/lib/i18n/dictionaries'
import type { Dict } from '@/lib/i18n/dictionaries'
import type { EmployeeSkillAssessment, JobRole, JobRoleSkill, Module, ModuleSkill, Skill } from '@/types'

type ModuleLite = Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>

interface Props {
  userId: string
  jobRole: JobRole | null
  skills: Skill[]
  jobRoleSkills: JobRoleSkill[]
  moduleSkills: ModuleSkill[]
  modules: ModuleLite[]
  assessments: EmployeeSkillAssessment[]
  t: Dict
}

export function MySkillsView({ userId, jobRole, skills, jobRoleSkills, moduleSkills, modules, assessments, t }: Props) {
  const [assessing, setAssessing] = useState<Skill | 'new' | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  const skillById = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills])
  const levelLabel = (level: number) => t.skillsPage.levels[level - 1] ?? `${level}`

  const requiredForRole = useMemo(
    () => jobRoleSkills
      .filter(jrs => jrs.job_role_id === jobRole?.id)
      .map(jrs => ({ ...jrs, skill: skillById.get(jrs.skill_id) }))
      .filter((jrs): jrs is JobRoleSkill & { skill: Skill } => !!jrs.skill),
    [jobRoleSkills, jobRole, skillById]
  )

  const currentBySkill = useMemo(() => latestAssessmentBySkill(assessments), [assessments])
  const gaps = useMemo(() => computeSkillGaps(requiredForRole, currentBySkill), [requiredForRole, currentBySkill])

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
  const rows = [
    ...gaps.map(g => ({ skill: g.skill, required: g.requiredLevel as number | null, gap: g.gap })),
    ...extraAssessedSkills.map(s => ({ skill: s, required: null as number | null, gap: 0 })),
  ]

  return (
    <div className="space-y-5">
      {jobRole ? (
        <>
          <p className="text-sm text-slate-500">{t.skillsPage.jobRole}: <span className="font-medium text-slate-700">{jobRole.name}</span></p>
          <div className={`rounded-lg px-4 py-2.5 text-sm ${gapCount > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
            {gapCount > 0
              ? fmt(t.skillsPage.gapCount, { count: gapCount, plural: gapCount === 1 ? '' : 's', role: jobRole.name })
              : requiredForRole.length > 0
                ? fmt(t.skillsPage.allMet, { role: jobRole.name })
                : fmt(t.skillsPage.noRequirements, { role: jobRole.name })}
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-500">
          {t.skillsPage.noJobRole}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {rows.map(row => {
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
                      ? `${levelLabel(current.proficiency_level)} (${current.proficiency_level}/5) · ${formatDate(current.assessed_at)}`
                      : t.skillsPage.notAssessed}
                    {row.required != null && ` · ${t.skillsPage.requires} ${levelLabel(row.required)} (${row.required}/5)`}
                  </p>
                </div>
                {hasGap && (
                  <Badge variant="warning" className="flex items-center gap-1 shrink-0">
                    <AlertTriangle className="h-3 w-3" /> {t.skillsPage.gap}
                  </Badge>
                )}
                {row.required != null && !hasGap && (
                  <Badge variant="success" className="flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> {t.skillsPage.met}
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
                  {t.skillsPage.rateYourself}
                </Button>
              </div>

              {hasGap && recommended.length > 0 && (
                <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400">{t.skillsPage.recommendedTraining}:</span>
                  {recommended.map(m => (
                    <Link key={m.id} href={`/training/${m.id}`} className="text-xs text-blue-600 hover:underline">
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
                        <span>{levelLabel(h.proficiency_level)} ({h.proficiency_level}/5)</span>
                        <span className="text-slate-400">
                          {h.source === 'supervisor' ? t.skillsPage.supervisor : t.skillsPage.self} · {formatDate(h.assessed_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
        {rows.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">{t.skillsPage.noSkillsYet}</p>
        )}
      </div>

      <Button variant="outline" onClick={() => setAssessing('new')}>
        <Plus className="h-4 w-4 mr-2" /> {t.skillsPage.rateAnotherSkill}
      </Button>

      {assessing && (
        <RateSkillDialog
          key={assessing === 'new' ? 'new' : assessing.id}
          preselected={assessing === 'new' ? null : assessing}
          skills={skills}
          userId={userId}
          t={t}
          onClose={() => setAssessing(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function RateSkillDialog({
  preselected, skills, userId, t, onClose,
}: {
  preselected: Skill | null
  skills: Skill[]
  userId: string
  t: Dict
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [skillId, setSkillId] = useState(preselected?.id ?? '')
  const [level, setLevel] = useState('3')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!skillId) { toast.error(t.skillsPage.chooseSkill); return }
    setSaving(true)
    const { error } = await supabase.from('employee_skill_assessments').insert({
      user_id: userId,
      skill_id: skillId,
      proficiency_level: Number(level),
      source: 'self',
      assessed_by: userId,
      notes: notes.trim() || null,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(t.skillsPage.saveAssessment)
    onClose()
    router.refresh()
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Target className="h-4 w-4 text-slate-500" /> {t.skillsPage.rateDialogTitle}</DialogTitle>
          <DialogDescription>{t.skillsPage.rateDialogBody}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.skillsPage.chooseSkill}</Label>
            <Select value={skillId} onValueChange={setSkillId} disabled={!!preselected}>
              <SelectTrigger>
                <SelectValue placeholder={t.skillsPage.chooseSkill} />
              </SelectTrigger>
              <SelectContent>
                {skills.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.skillsPage.proficiencyLevel}</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SKILL_PROFICIENCY_LEVELS.map(l => (
                  <SelectItem key={l.value} value={String(l.value)}>{l.value} — {t.skillsPage.levels[l.value - 1]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.skillsPage.notes}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>{t.skillsPage.saveAssessment}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
