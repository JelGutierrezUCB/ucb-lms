import { SKILL_PROFICIENCY_LEVELS } from '@/types'
import type { Skill, JobRoleSkill, EmployeeSkillAssessment } from '@/types'

export function proficiencyLabel(level: number): string {
  return SKILL_PROFICIENCY_LEVELS.find(l => l.value === level)?.label ?? `Level ${level}`
}

// Reduces a person's full assessment history down to their current level per
// skill — the most recent row for each skill_id.
export function latestAssessmentBySkill(assessments: EmployeeSkillAssessment[]): Map<string, EmployeeSkillAssessment> {
  const map = new Map<string, EmployeeSkillAssessment>()
  for (const a of assessments) {
    const existing = map.get(a.skill_id)
    if (!existing || a.assessed_at > existing.assessed_at) map.set(a.skill_id, a)
  }
  return map
}

export interface SkillGap {
  skill: Skill
  requiredLevel: number
  currentLevel: number | null
  // requiredLevel - (currentLevel ?? 0). Positive means a gap; 0 or negative means met/exceeded.
  gap: number
  lastAssessedAt: string | null
}

// One row per required skill for a job role, current level (if ever
// assessed) vs. required level, sorted biggest gap first.
export function computeSkillGaps(
  requiredSkills: (JobRoleSkill & { skill: Skill })[],
  currentBySkill: Map<string, EmployeeSkillAssessment>
): SkillGap[] {
  return requiredSkills
    .map(rs => {
      const current = currentBySkill.get(rs.skill_id)
      const currentLevel = current?.proficiency_level ?? null
      return {
        skill: rs.skill,
        requiredLevel: rs.required_level,
        currentLevel,
        gap: rs.required_level - (currentLevel ?? 0),
        lastAssessedAt: current?.assessed_at ?? null,
      }
    })
    .sort((a, b) => b.gap - a.gap)
}
