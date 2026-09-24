import type { createClient } from '@/lib/supabase/server'
import type { LearningPath, Module } from '@/types'

type Db = Awaited<ReturnType<typeof createClient>>

export interface PathStep {
  module: Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes' | 'module_type'>
  percent: number
  // First unfinished section in the module, for "Next up" hints.
  nextSectionTitle: string | null
  // Roadmap details set by the admin: the phase this step belongs to, and a short note.
  phase: string | null
  note: string | null
}

export interface UserPath {
  path: LearningPath
  dueDate: string | null
  assignedAt: string
  source: string
  steps: PathStep[]
  completedSteps: number
  percent: number
  // Rough time still to go, from each training's estimate and how far along it is.
  minutesLeft: number
  // First step that isn't finished yet; null once the whole path is done.
  nextStep: PathStep | null
  // The whole-journey completion certificate, once every course is done.
  certificate: { id: string; issuedAt: string } | null
}

// Loads the learning paths a user is enrolled in, with per-step progress.
// Returns [] (rather than throwing) if the learning-path tables don't exist
// yet, so pages that show paths keep working before the migration is applied.
export async function loadUserPaths(supabase: Db, userId: string): Promise<UserPath[]> {
  const { data: enrollments, error } = await supabase
    .from('learning_path_enrollments')
    .select('due_date, assigned_at, source, path:learning_paths(*)')
    .eq('user_id', userId)

  if (error || !enrollments?.length) return []

  const enrolled = (enrollments as any[])
    .map(e => ({ ...e, path: (Array.isArray(e.path) ? e.path[0] : e.path) as LearningPath | null }))
    .filter(e => e.path && e.path.is_published)

  if (!enrolled.length) return []

  const pathIds = enrolled.map(e => e.path!.id)

  const { data: items } = await supabase
    .from('learning_path_items')
    .select('path_id, order_index, phase, note, module:modules(id, title, category, estimated_minutes, module_type)')
    .in('path_id', pathIds)
    .order('order_index')

  // Journey certificates (empty until the certificates migration exists / anything is earned)
  const { data: journeyCerts } = await supabase
    .from('journey_certificates')
    .select('id, path_id, issued_at')
    .eq('user_id', userId)
  const certByPath = new Map((journeyCerts ?? []).map(c => [c.path_id as string, { id: c.id as string, issuedAt: c.issued_at as string }]))

  const moduleIds = [...new Set((items ?? []).map((i: any) => (Array.isArray(i.module) ? i.module[0] : i.module)?.id).filter(Boolean))] as string[]

  const [{ data: sections }, { data: progress }] = await Promise.all([
    supabase
      .from('sections')
      .select('id, module_id, title, order_index')
      .in('module_id', moduleIds.length ? moduleIds : [''])
      .eq('is_archived', false)
      .order('order_index'),
    supabase.from('section_progress').select('section_id').eq('user_id', userId),
  ])

  const done = new Set((progress ?? []).map(p => p.section_id as string))
  const sectionsByModule = new Map<string, { id: string; title: string }[]>()
  for (const s of sections ?? []) {
    const list = sectionsByModule.get(s.module_id) ?? []
    list.push({ id: s.id, title: s.title })
    sectionsByModule.set(s.module_id, list)
  }

  const stepFor = (mod: PathStep['module'], phase: string | null, note: string | null): PathStep => {
    const secs = sectionsByModule.get(mod.id) ?? []
    const completed = secs.filter(s => done.has(s.id)).length
    return {
      module: mod,
      percent: secs.length > 0 ? Math.round((completed / secs.length) * 100) : 0,
      nextSectionTitle: secs.find(s => !done.has(s.id))?.title ?? null,
      phase,
      note,
    }
  }

  const result: UserPath[] = enrolled.map(e => {
    const steps = (items ?? [])
      .filter((i: any) => i.path_id === e.path!.id)
      .map((i: any) => ({
        module: (Array.isArray(i.module) ? i.module[0] : i.module) as PathStep['module'] | null,
        phase: ((i.phase as string | null)?.trim() || null),
        note: ((i.note as string | null)?.trim() || null),
      }))
      .filter((x): x is { module: PathStep['module']; phase: string | null; note: string | null } => !!x.module)
      .map(x => stepFor(x.module, x.phase, x.note))

    const completedSteps = steps.filter(s => s.percent === 100).length
    return {
      path: e.path!,
      dueDate: e.due_date,
      assignedAt: e.assigned_at,
      source: e.source,
      steps,
      completedSteps,
      percent: steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0,
      minutesLeft: steps.reduce((sum, s) => sum + Math.round((s.module.estimated_minutes ?? 0) * (100 - s.percent) / 100), 0),
      nextStep: steps.find(s => s.percent < 100) ?? null,
      certificate: certByPath.get(e.path!.id) ?? null,
    }
  })

  // Onboarding first, then unfinished before finished, then by title.
  return result.sort((a, b) => {
    const rank = (p: UserPath) => (p.path.kind === 'onboarding' ? 0 : 1) + (p.percent === 100 ? 2 : 0)
    return rank(a) - rank(b) || a.path.title.localeCompare(b.path.title)
  })
}
