import { createAdminClient } from '@/lib/supabase/server'
import { CourseCompletionsView, type CourseCompletion, type PersonStatus } from './CourseCompletionsView'

// Per course: who has completed it, and how many. Admins see everyone; a
// manager sees their own team. Uses the service-role client so the numbers
// don't depend on which assignments a manager happened to create themselves —
// the scope is enforced here, in code, before any query runs.
export async function CourseCompletionsContent({ viewerId, role }: { viewerId: string; role: 'admin' | 'manager' }) {
  const admin = await createAdminClient()

  const peopleQuery = admin
    .from('profiles')
    .select('id, full_name, department, company')
    .neq('is_active', false)
  const { data: people } = await (role === 'manager' ? peopleQuery.eq('manager_id', viewerId) : peopleQuery).order('full_name')

  const ids = (people ?? []).map(p => p.id)
  if (ids.length === 0) {
    return <CourseCompletionsView courses={[]} scopeLabel={role === 'manager' ? 'your team' : 'everyone'} />
  }

  const [{ data: assignments }, { data: progress }, { data: certs }, { data: sections }] = await Promise.all([
    admin.from('assignments').select('user_id, module_id, section_id, due_date, required').in('user_id', ids),
    admin.from('section_progress').select('user_id, section_id, completed_at').in('user_id', ids),
    admin.from('certificates').select('id, user_id, module_id, completed_at, score, max_score').in('user_id', ids),
    admin.from('sections').select('id, module_id').eq('is_archived', false),
  ])

  const sectionsByModule = new Map<string, string[]>()
  const moduleOfSection = new Map<string, string>()
  for (const s of sections ?? []) {
    moduleOfSection.set(s.id, s.module_id)
    sectionsByModule.set(s.module_id, [...(sectionsByModule.get(s.module_id) ?? []), s.id])
  }

  // What each person was assigned per course: the whole course, or just some trainings in it.
  type Info = { whole: boolean; sectionIds: Set<string>; due: string | null; required: boolean }
  const infoByKey = new Map<string, Info>()
  for (const a of assignments ?? []) {
    const key = `${a.user_id}|${a.module_id}`
    const cur = infoByKey.get(key) ?? { whole: false, sectionIds: new Set<string>(), due: null, required: false }
    if (!a.section_id) cur.whole = true
    else cur.sectionIds.add(a.section_id)
    if (a.due_date && (!cur.due || a.due_date < cur.due)) cur.due = a.due_date
    if (a.required !== false) cur.required = true
    infoByKey.set(key, cur)
  }

  const doneByUser = new Map<string, Map<string, string>>() // user -> section -> completed_at
  for (const p of progress ?? []) {
    const m = doneByUser.get(p.user_id) ?? new Map<string, string>()
    m.set(p.section_id, p.completed_at)
    doneByUser.set(p.user_id, m)
  }
  const certByKey = new Map((certs ?? []).map(c => [`${c.user_id}|${c.module_id}`, c]))

  // Everyone who was assigned a course, or has made progress in it.
  const keys = new Set<string>(infoByKey.keys())
  for (const [userId, done] of doneByUser) {
    for (const sectionId of done.keys()) {
      const moduleId = moduleOfSection.get(sectionId)
      if (moduleId) keys.add(`${userId}|${moduleId}`)
    }
  }
  for (const key of certByKey.keys()) keys.add(key)

  const moduleIds = [...new Set([...keys].map(k => k.split('|')[1]))]
  const { data: modules } = await admin
    .from('modules')
    .select('id, title, category, estimated_minutes, is_published')
    .in('id', moduleIds.length ? moduleIds : [''])

  const personById = new Map((people ?? []).map(p => [p.id, p]))
  const today = new Date().toISOString().split('T')[0]

  const byModule = new Map<string, PersonStatus[]>()
  for (const key of keys) {
    const [userId, moduleId] = key.split('|')
    const person = personById.get(userId)
    if (!person) continue

    const allSections = sectionsByModule.get(moduleId) ?? []
    const info = infoByKey.get(key)
    const required = info && !info.whole && info.sectionIds.size > 0
      ? allSections.filter(id => info.sectionIds.has(id))
      : allSections
    const done = doneByUser.get(userId)
    const doneRequired = required.filter(id => done?.has(id))
    const cert = certByKey.get(key)
    const complete = !!cert || (required.length > 0 && doneRequired.length >= required.length)
    const completedAt = cert?.completed_at
      ?? (complete ? doneRequired.map(id => done!.get(id)!).sort().at(-1) ?? null : null)
    const percent = required.length > 0 ? Math.round((doneRequired.length / required.length) * 100) : 0

    const status: PersonStatus['status'] = complete ? 'completed' : doneRequired.length > 0 ? 'in_progress' : 'not_started'
    const overdue = !complete && !!info?.required && !!info.due && info.due < today

    const list = byModule.get(moduleId) ?? []
    list.push({
      userId,
      name: person.full_name,
      department: person.department,
      status,
      percent: complete ? 100 : percent,
      completedAt,
      dueDate: info?.due ?? null,
      overdue,
      score: cert?.max_score ? `${cert.score}/${cert.max_score}` : null,
      certificateId: cert?.id ?? null,
      optional: !!info && !info.required,
    })
    byModule.set(moduleId, list)
  }

  const courses: CourseCompletion[] = (modules ?? [])
    .map(m => {
      const list = (byModule.get(m.id) ?? []).sort((a, b) => a.name.localeCompare(b.name))
      const completed = list.filter(p => p.status === 'completed')
      const lastCompleted = completed.map(p => p.completedAt ?? '').sort().at(-1) || null
      return {
        id: m.id,
        title: m.title,
        category: m.category,
        minutes: m.estimated_minutes,
        isPublished: m.is_published,
        assigned: list.length,
        completed: completed.length,
        inProgress: list.filter(p => p.status === 'in_progress').length,
        notStarted: list.filter(p => p.status === 'not_started').length,
        overdue: list.filter(p => p.overdue).length,
        lastCompletedAt: lastCompleted,
        people: list,
      }
    })
    .filter(c => c.assigned > 0)
    .sort((a, b) => a.title.localeCompare(b.title))

  return <CourseCompletionsView courses={courses} scopeLabel={role === 'manager' ? 'your team' : 'everyone'} />
}
