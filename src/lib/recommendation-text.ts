import { fmt, type Dict } from '@/lib/i18n/dictionaries'
import { formatDate, getCategoryLabel } from '@/lib/utils'
import type { RecommendationReason } from '@/lib/recommendations'

// Turns a structured reason into one plain-language sentence for the learner.
export function reasonText(t: Dict, r: RecommendationReason): string {
  const level = (n: number) => t.skillsPage.levels[n - 1] ?? String(n)
  const L = t.learnNext

  switch (r.kind) {
    case 'overdue':
      return fmt(L.reasonOverdue, { date: formatDate(r.dueDate) })
    case 'required':
      return r.dueDate ? fmt(L.reasonRequiredDue, { date: formatDate(r.dueDate) }) : L.reasonRequired
    case 'supervisor':
      return r.byName ? fmt(L.reasonSupervisor, { name: r.byName }) : L.reasonSupervisorAnon
    case 'lowScore':
      return fmt(L.reasonLowScore, { percent: r.percent, passing: r.passing })
    case 'inProgress':
      return fmt(L.reasonInProgress, { percent: r.percent })
    case 'journey':
      return fmt(L.reasonJourney, { path: r.pathTitle })
    case 'skillGap':
      return r.currentLevel != null
        ? fmt(L.reasonSkillGap, { skill: r.skillName, current: level(r.currentLevel), required: level(r.requiredLevel) })
        : fmt(L.reasonSkillGapUnassessed, { skill: r.skillName, required: level(r.requiredLevel) })
    case 'jobRole':
      return fmt(L.reasonJobRole, { role: r.roleName })
    case 'program':
      return fmt(L.reasonProgram, { program: r.programName, course: r.becauseOf })
    case 'category':
      return fmt(L.reasonCategory, { category: getCategoryLabel(r.category) })
  }
}
