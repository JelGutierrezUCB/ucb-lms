import type { createClient } from '@/lib/supabase/server'
import { isProtectedModule } from '@/lib/protected-modules'
import { loadUserPaths } from '@/lib/learning-paths'
import { computeSkillGaps, latestAssessmentBySkill } from '@/lib/skills'
import type {
  EmployeeSkillAssessment, JobRoleSkill, LearningResource, Module, ModuleSkill, ResourceSkill, ResourceType, Skill,
} from '@/types'

type Db = Awaited<ReturnType<typeof createClient>>

export type ReasonKind =
  | 'overdue' | 'required' | 'supervisor' | 'lowScore' | 'inProgress'
  | 'journey' | 'skillGap' | 'jobRole' | 'program' | 'category'

// Why something is being recommended. Locale-agnostic — the UI turns these
// into sentences (lib/recommendation-text.ts).
export type RecommendationReason =
  | { kind: 'overdue'; dueDate: string }
  | { kind: 'required'; dueDate: string | null }
  | { kind: 'supervisor'; note: string | null; byName: string | null }
  | { kind: 'lowScore'; percent: number; passing: number }
  | { kind: 'inProgress'; percent: number }
  | { kind: 'journey'; pathTitle: string }
  | { kind: 'skillGap'; skillName: string; currentLevel: number | null; requiredLevel: number }
  | { kind: 'jobRole'; roleName: string }
  | { kind: 'program'; programName: string; becauseOf: string }
  | { kind: 'category'; category: string }

export interface Recommendation {
  key: string
  type: 'module' | 'resource'
  id: string
  title: string
  description: string | null
  minutes: number | null
  category: string | null
  // Internal training page, or the external URL for a resource.
  href: string
  external: boolean
  resourceType: ResourceType | null
  provider: string | null
  isAiGenerated: boolean
  assigned: boolean
  percent: number
  reasons: RecommendationReason[]
  score: number
  primary: ReasonKind
  // Pending supervisor-recommendation rows behind this item (so they can be dismissed).
  supervisorRecIds: string[]
}

export interface RecommendationResult {
  items: Recommendation[]
  jobRoleName: string | null
  skillGapCount: number
}

// How strongly each signal points at "do this next". The final score is the
// strongest signal plus a fifth of the rest, so something flagged for several
// reasons rises above something flagged for one.
const BASE_SCORE: Record<ReasonKind, number> = {
  overdue: 100,
  supervisor: 90,
  required: 80,
  lowScore: 75,
  inProgress: 70,
  journey: 60,
  skillGap: 40,
  jobRole: 35,
  program: 30,
  category: 15,
}

function reasonScore(r: RecommendationReason, isResource: boolean): number {
  if (r.kind === 'skillGap') {
    const gap = Math.max(1, r.requiredLevel - (r.currentLevel ?? 0))
    const s = BASE_SCORE.skillGap + Math.min(gap, 4) * 8
    return isResource ? s * 0.9 : s
  }
  return BASE_SCORE[r.kind]
}

function combine(reasons: RecommendationReason[], isResource: boolean) {
  const scored = reasons.map(r => ({ r, s: reasonScore(r, isResource) })).sort((a, b) => b.s - a.s)
  const top = scored[0]
  const rest = scored.slice(1).reduce((sum, x) => sum + x.s, 0)
  return { score: Math.round(top.s + rest * 0.2), primary: top.r.kind as ReasonKind }
}

const MAX_ITEMS = 40
const MAX_WEAK_ITEMS = 3

export async function loadRecommendations(
  supabase: Db,
  userId: string,
  jobRoleId: string | null
): Promise<RecommendationResult> {
  const [
    assignmentsRes, modulesRes, progressRes, certsRes, attemptsRes, skillsRes, roleSkillsRes,
    moduleSkillsRes, resourceSkillsRes, resourcesRes, completionsRes, recsRes, assessmentsRes,
    programsRes, programModulesRes, roleRes, paths,
  ] = await Promise.all([
    supabase.from('assignments').select('module_id, section_id, due_date, required').eq('user_id', userId),
    supabase.from('modules')
      .select('id, title, description, category, estimated_minutes, module_type, auto_assign_all, is_ai_generated')
      .eq('is_published', true).eq('is_archived', false),
    supabase.from('section_progress').select('section_id').eq('user_id', userId),
    supabase.from('certificates').select('module_id').eq('user_id', userId),
    supabase.from('quiz_attempts').select('content_block_id, score, max_score').eq('user_id', userId),
    supabase.from('skills').select('*'),
    jobRoleId
      ? supabase.from('job_role_skills').select('*').eq('job_role_id', jobRoleId)
      : Promise.resolve({ data: [] as JobRoleSkill[] }),
    supabase.from('module_skills').select('*'),
    supabase.from('resource_skills').select('*'),
    supabase.from('learning_resources').select('*').eq('is_published', true),
    supabase.from('resource_completions').select('resource_id').eq('user_id', userId),
    supabase.from('training_recommendations').select('id, module_id, resource_id, recommended_by, note')
      .eq('user_id', userId).eq('status', 'pending'),
    supabase.from('employee_skill_assessments').select('*').eq('user_id', userId),
    supabase.from('programs').select('id, name'),
    supabase.from('program_modules').select('program_id, module_id'),
    jobRoleId
      ? supabase.from('job_roles').select('name').eq('id', jobRoleId).maybeSingle()
      : Promise.resolve({ data: null }),
    loadUserPaths(supabase, userId),
  ])

  const modules = ((modulesRes.data ?? []) as Pick<
    Module, 'id' | 'title' | 'description' | 'category' | 'estimated_minutes' | 'module_type' | 'auto_assign_all' | 'is_ai_generated'
  >[]).filter(m => !isProtectedModule(m.id))
  const moduleIds = modules.map(m => m.id)

  // Stage 2 — things keyed off the module list / the job role.
  const attempts = (attemptsRes.data ?? []) as { content_block_id: string; score: number; max_score: number }[]
  const attemptedBlockIds = [...new Set(attempts.map(a => a.content_block_id))]

  const [sectionsRes, blocksRes, roleModuleIds] = await Promise.all([
    supabase.from('sections').select('id, module_id').in('module_id', moduleIds.length ? moduleIds : ['']).eq('is_archived', false),
    attemptedBlockIds.length
      ? supabase.from('content_blocks').select('id, section_id, content').in('id', attemptedBlockIds).eq('type', 'quiz')
      : Promise.resolve({ data: [] as { id: string; section_id: string; content: any }[] }),
    loadRoleModuleIds(supabase, jobRoleId),
  ])

  // --- progress per module -------------------------------------------------
  const sections = (sectionsRes.data ?? []) as { id: string; module_id: string }[]
  const done = new Set((progressRes.data ?? []).map((p: any) => p.section_id as string))
  const assignments = (assignmentsRes.data ?? []) as { module_id: string; section_id: string | null; due_date: string | null; required: boolean | null }[]

  const sectionsByModule = new Map<string, string[]>()
  for (const s of sections) sectionsByModule.set(s.module_id, [...(sectionsByModule.get(s.module_id) ?? []), s.id])
  const sectionModule = new Map(sections.map(s => [s.id, s.module_id]))

  const percentOf = (moduleId: string) => {
    const rows = assignments.filter(a => a.module_id === moduleId)
    const all = sectionsByModule.get(moduleId) ?? []
    const wholeModule = rows.length === 0 || rows.some(r => !r.section_id)
    const scoped = wholeModule ? all : all.filter(id => rows.some(r => r.section_id === id))
    if (scoped.length === 0) return 0
    return Math.round((scoped.filter(id => done.has(id)).length / scoped.length) * 100)
  }

  const certModules = new Set((certsRes.data ?? []).map((c: any) => c.module_id as string).filter(Boolean))
  const moduleById = new Map(modules.map(m => [m.id, m]))
  const percentByModule = new Map(modules.map(m => [m.id, percentOf(m.id)]))
  const isCompleted = (id: string) => certModules.has(id) || (percentByModule.get(id) ?? 0) === 100

  // --- assessment results: best attempt per quiz vs its passing score -------
  const bestByBlock = new Map<string, number>()
  for (const a of attempts) {
    if (a.max_score <= 0) continue
    const pct = Math.round((a.score / a.max_score) * 100)
    bestByBlock.set(a.content_block_id, Math.max(bestByBlock.get(a.content_block_id) ?? 0, pct))
  }
  const lowScoreByModule = new Map<string, { percent: number; passing: number }>()
  for (const b of (blocksRes.data ?? []) as { id: string; section_id: string; content: any }[]) {
    const moduleId = sectionModule.get(b.section_id)
    const best = bestByBlock.get(b.id)
    if (!moduleId || best === undefined) continue
    const passing = Number(b.content?.passing_score ?? 70)
    if (best < passing) {
      const existing = lowScoreByModule.get(moduleId)
      if (!existing || best < existing.percent) lowScoreByModule.set(moduleId, { percent: best, passing })
    }
  }

  // --- skill gaps -----------------------------------------------------------
  const skills = (skillsRes.data ?? []) as Skill[]
  const skillById = new Map(skills.map(s => [s.id, s]))
  const roleSkills = ((roleSkillsRes.data ?? []) as JobRoleSkill[])
    .map(rs => ({ ...rs, skill: skillById.get(rs.skill_id) }))
    .filter((rs): rs is JobRoleSkill & { skill: Skill } => !!rs.skill)
  const current = latestAssessmentBySkill((assessmentsRes.data ?? []) as EmployeeSkillAssessment[])
  const gaps = computeSkillGaps(roleSkills, current).filter(g => g.gap > 0)
  const gapBySkill = new Map(gaps.map(g => [g.skill.id, g]))

  const skillGapReasons = (skillIds: string[]): RecommendationReason[] =>
    skillIds
      .map(id => gapBySkill.get(id))
      .filter((g): g is NonNullable<typeof g> => !!g)
      .map(g => ({ kind: 'skillGap' as const, skillName: g.skill.name, currentLevel: g.currentLevel, requiredLevel: g.requiredLevel }))

  const skillsByModule = new Map<string, string[]>()
  for (const ms of (moduleSkillsRes.data ?? []) as ModuleSkill[]) {
    skillsByModule.set(ms.module_id, [...(skillsByModule.get(ms.module_id) ?? []), ms.skill_id])
  }
  const skillsByResource = new Map<string, string[]>()
  for (const rs of (resourceSkillsRes.data ?? []) as ResourceSkill[]) {
    skillsByResource.set(rs.resource_id, [...(skillsByResource.get(rs.resource_id) ?? []), rs.skill_id])
  }

  // --- supervisor recommendations ------------------------------------------
  const recRows = (recsRes.data ?? []) as { id: string; module_id: string | null; resource_id: string | null; recommended_by: string | null; note: string | null }[]
  const recommenderIds = [...new Set(recRows.map(r => r.recommended_by).filter((x): x is string => !!x))]
  const nameById = new Map<string, string>()
  if (recommenderIds.length) {
    const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', recommenderIds)
    for (const p of people ?? []) nameById.set(p.id as string, p.full_name as string)
  }
  const supervisorReasonFor = (key: 'module_id' | 'resource_id', id: string) => {
    const rows = recRows.filter(r => r[key] === id)
    return {
      reasons: rows.map(r => ({
        kind: 'supervisor' as const,
        note: r.note,
        byName: r.recommended_by ? nameById.get(r.recommended_by) ?? null : null,
      })),
      ids: rows.map(r => r.id),
    }
  }

  // --- previous training / certifications -> related courses ----------------
  const programNames = new Map(((programsRes.data ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]))
  const programsOfModule = new Map<string, string[]>()
  for (const pm of (programModulesRes.data ?? []) as { program_id: string; module_id: string }[]) {
    programsOfModule.set(pm.module_id, [...(programsOfModule.get(pm.module_id) ?? []), pm.program_id])
  }
  // program id -> title of a course they already hold a certificate for in it
  const earnedInProgram = new Map<string, string>()
  for (const moduleId of certModules) {
    for (const programId of programsOfModule.get(moduleId) ?? []) {
      if (!earnedInProgram.has(programId)) earnedInProgram.set(programId, moduleById.get(moduleId)?.title ?? '')
    }
  }
  const completedCategories = new Set(
    modules.filter(m => isCompleted(m.id)).map(m => m.category)
  )

  const nextJourneyStep = new Map<string, string>() // module id -> journey title
  for (const p of paths) {
    if (p.nextStep && !nextJourneyStep.has(p.nextStep.module.id)) nextJourneyStep.set(p.nextStep.module.id, p.path.title)
  }

  const roleName = ((roleRes as any).data?.name as string | undefined) ?? null
  const today = new Date().toISOString().slice(0, 10)

  // --- build module candidates ---------------------------------------------
  const items: Recommendation[] = []
  let weakCount = 0

  for (const m of modules) {
    if (isCompleted(m.id)) continue
    // Only suggest trainings that actually have content.
    if ((sectionsByModule.get(m.id) ?? []).length === 0) continue

    const reasons: RecommendationReason[] = []
    const rows = assignments.filter(a => a.module_id === m.id)
    const assigned = rows.length > 0
    const requiredRows = rows.filter(r => r.required !== false)
    const isRequired = requiredRows.length > 0 || (m.auto_assign_all && assigned)

    if (isRequired) {
      const dues = requiredRows.map(r => r.due_date).filter((d): d is string => !!d).sort()
      const due = dues[0] ?? null
      reasons.push(due && due < today ? { kind: 'overdue', dueDate: due } : { kind: 'required', dueDate: due })
    }

    const sup = supervisorReasonFor('module_id', m.id)
    reasons.push(...sup.reasons)

    const low = lowScoreByModule.get(m.id)
    if (low) reasons.push({ kind: 'lowScore', percent: low.percent, passing: low.passing })

    const pct = percentByModule.get(m.id) ?? 0
    if (pct > 0) reasons.push({ kind: 'inProgress', percent: pct })

    const journeyTitle = nextJourneyStep.get(m.id)
    if (journeyTitle) reasons.push({ kind: 'journey', pathTitle: journeyTitle })

    reasons.push(...skillGapReasons(skillsByModule.get(m.id) ?? []))

    if (roleName && roleModuleIds.has(m.id)) reasons.push({ kind: 'jobRole', roleName })

    for (const programId of programsOfModule.get(m.id) ?? []) {
      const because = earnedInProgram.get(programId)
      if (because) reasons.push({ kind: 'program', programName: programNames.get(programId) ?? '', becauseOf: because })
    }

    if (reasons.length === 0 && completedCategories.has(m.category)) {
      reasons.push({ kind: 'category', category: m.category })
    }
    if (reasons.length === 0) continue

    const { score, primary } = combine(reasons, false)
    if (primary === 'category') {
      if (weakCount >= MAX_WEAK_ITEMS) continue
      weakCount++
    }

    items.push({
      key: `module:${m.id}`,
      type: 'module',
      id: m.id,
      title: m.title,
      description: m.description,
      minutes: m.estimated_minutes,
      category: m.category,
      href: `/training/${m.id}`,
      external: false,
      resourceType: null,
      provider: null,
      isAiGenerated: !!m.is_ai_generated,
      assigned,
      percent: pct,
      reasons,
      score,
      primary,
      supervisorRecIds: sup.ids,
    })
  }

  // --- external resources ---------------------------------------------------
  const completedResources = new Set((completionsRes.data ?? []).map((c: any) => c.resource_id as string))
  for (const r of (resourcesRes.data ?? []) as LearningResource[]) {
    if (completedResources.has(r.id)) continue
    if (!/^https?:\/\//i.test(r.url)) continue

    const sup = supervisorReasonFor('resource_id', r.id)
    const reasons: RecommendationReason[] = [
      ...sup.reasons,
      ...skillGapReasons(skillsByResource.get(r.id) ?? []),
    ]
    if (reasons.length === 0) continue

    const { score, primary } = combine(reasons, true)
    items.push({
      key: `resource:${r.id}`,
      type: 'resource',
      id: r.id,
      title: r.title,
      description: r.description,
      minutes: r.estimated_minutes,
      category: null,
      href: r.url,
      external: true,
      resourceType: r.resource_type,
      provider: r.provider,
      isAiGenerated: false,
      assigned: false,
      percent: 0,
      reasons,
      score,
      primary,
      supervisorRecIds: sup.ids,
    })
  }

  items.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))

  return { items: items.slice(0, MAX_ITEMS), jobRoleName: roleName, skillGapCount: gaps.length }
}

// Modules in published learning journeys aimed at the job role. (Assignment
// rules aimed at the role already show up as the person's own required
// assignments, and rules aren't readable by non-admins anyway.)
async function loadRoleModuleIds(supabase: Db, jobRoleId: string | null): Promise<Set<string>> {
  const ids = new Set<string>()
  if (!jobRoleId) return ids

  const { data: targets } = await supabase
    .from('learning_path_targets')
    .select('path_id')
    .eq('kind', 'job_role')
    .eq('value', jobRoleId)

  const pathIds = (targets ?? []).map((t: any) => t.path_id as string)
  if (pathIds.length) {
    const { data: publishedPaths } = await supabase.from('learning_paths').select('id').in('id', pathIds).eq('is_published', true)
    const published = (publishedPaths ?? []).map((p: any) => p.id as string)
    if (published.length) {
      const { data: items } = await supabase.from('learning_path_items').select('module_id').in('path_id', published)
      for (const i of items ?? []) ids.add((i as any).module_id)
    }
  }
  return ids
}
