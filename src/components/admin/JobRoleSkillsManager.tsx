'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SKILL_PROFICIENCY_LEVELS } from '@/types'
import type { JobRole, JobRoleSkill, Skill } from '@/types'

interface Props {
  jobRoles: JobRole[]
  skills: Skill[]
  jobRoleSkills: JobRoleSkill[]
}

export function JobRoleSkillsManager({ jobRoles, skills, jobRoleSkills }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [selectedRoleId, setSelectedRoleId] = useState(jobRoles[0]?.id ?? '')
  const [addingSkillId, setAddingSkillId] = useState('')
  const [addingLevel, setAddingLevel] = useState('3')
  const [saving, setSaving] = useState(false)

  const skillById = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills])
  const requirementsForRole = useMemo(
    () => jobRoleSkills.filter(jrs => jrs.job_role_id === selectedRoleId),
    [jobRoleSkills, selectedRoleId]
  )
  const availableSkills = useMemo(
    () => skills.filter(s => !requirementsForRole.some(r => r.skill_id === s.id)),
    [skills, requirementsForRole]
  )

  async function addRequirement() {
    if (!selectedRoleId || !addingSkillId) return
    setSaving(true)
    const { error } = await supabase.from('job_role_skills').insert({
      job_role_id: selectedRoleId,
      skill_id: addingSkillId,
      required_level: Number(addingLevel),
    })
    if (error) { toast.error(error.message) } else {
      toast.success('Requirement added')
      setAddingSkillId('')
      setAddingLevel('3')
      router.refresh()
    }
    setSaving(false)
  }

  async function updateLevel(skillId: string, level: string) {
    const { error } = await supabase
      .from('job_role_skills')
      .update({ required_level: Number(level) })
      .eq('job_role_id', selectedRoleId)
      .eq('skill_id', skillId)
    if (error) { toast.error(error.message); return }
    router.refresh()
  }

  async function removeRequirement(skillId: string) {
    const { error } = await supabase
      .from('job_role_skills')
      .delete()
      .eq('job_role_id', selectedRoleId)
      .eq('skill_id', skillId)
    if (error) { toast.error(error.message); return }
    toast.success('Requirement removed')
    router.refresh()
  }

  if (jobRoles.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border border-dashed border-slate-300 bg-white">
        <UserCog className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-500 font-medium">No job roles yet</p>
        <p className="text-slate-400 text-sm mt-1">Add job roles from the Users page, then set their required skills here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {jobRoles.map(role => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedRoleId(role.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedRoleId === role.id
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {role.name}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {requirementsForRole.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">No required skills set for this job role yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requirementsForRole.map(req => {
              const skill = skillById.get(req.skill_id)
              return (
                <li key={req.skill_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{skill?.name ?? 'Unknown skill'}</p>
                    {skill?.category && <Badge variant="outline" className="mt-1">{skill.category}</Badge>}
                  </div>
                  <Select value={String(req.required_level)} onValueChange={v => updateLevel(req.skill_id, v)}>
                    <SelectTrigger className="w-40 h-8 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SKILL_PROFICIENCY_LEVELS.map(l => (
                        <SelectItem key={l.value} value={String(l.value)}>{l.value} — {l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => removeRequirement(req.skill_id)}
                    className="shrink-0 p-1 text-slate-400 hover:text-red-600"
                    aria-label="Remove requirement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex items-center gap-2 border-t border-slate-100 p-3">
          <Select value={addingSkillId} onValueChange={setAddingSkillId}>
            <SelectTrigger className="flex-1" disabled={availableSkills.length === 0}>
              <SelectValue placeholder={availableSkills.length === 0 ? 'Every skill already required' : 'Add a required skill…'} />
            </SelectTrigger>
            <SelectContent>
              {availableSkills.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={addingLevel} onValueChange={setAddingLevel}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILL_PROFICIENCY_LEVELS.map(l => (
                <SelectItem key={l.value} value={String(l.value)}>{l.value} — {l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addRequirement} loading={saving} disabled={!addingSkillId}>
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </div>
      </div>
    </div>
  )
}
