import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { BookOpen } from 'lucide-react'
import { CatalogGrid, type CatalogItem } from '@/components/training/CatalogGrid'
import { isProtectedModule } from '@/lib/protected-modules'
import type { Module } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  // Determine effective user ID — proxy support for managers/admins
  let effectiveUserId = user.id
  let proxyName: string | null = null

  if (params.as && ['admin', 'manager'].includes(currentProfile?.role ?? '')) {
    // Validate the as= param is a valid UUID and the user is their employee
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, full_name, manager_id, role')
      .eq('id', params.as)
      .single()

    if (
      targetProfile &&
      targetProfile.role === 'employee' &&
      (currentProfile?.role === 'admin' || targetProfile.manager_id === user.id)
    ) {
      effectiveUserId = targetProfile.id
      proxyName = targetProfile.full_name
    }
  }

  // Load modules
  let modules: Module[] = []
  let assignedModuleIds: string[] = []

  const { data: assignments } = await supabase
    .from('assignments')
    .select('module_id, section_id')
    .eq('user_id', effectiveUserId)

  assignedModuleIds = [...new Set((assignments ?? []).map((a: any) => a.module_id))]

  // Per module: null = whole module required (no restriction on which
  // sections count toward progress); a Set = only these specific sections
  // are required (assigned individually, not the whole module).
  const requiredSectionsByModule = new Map<string, Set<string> | null>()
  for (const a of assignments ?? []) {
    if (!a.section_id) {
      requiredSectionsByModule.set(a.module_id, null)
    } else if (requiredSectionsByModule.get(a.module_id) !== null) {
      const set = requiredSectionsByModule.get(a.module_id) ?? new Set<string>()
      set.add(a.section_id)
      requiredSectionsByModule.set(a.module_id, set)
    }
  }

  // If viewing as proxy employee, show only their assigned modules.
  // Admins/managers viewing their own training see all published modules,
  // PLUS anything explicitly assigned to them even if still a draft — an
  // assignment is a deliberate act and should always be visible to the
  // person it was given to, publish status aside.
  const isProxy = effectiveUserId !== user.id
  if (!isProxy && ['admin', 'manager'].includes(currentProfile?.role ?? '')) {
    const [{ data: published }, { data: assignedDrafts }] = await Promise.all([
      supabase.from('modules').select('*').eq('is_published', true).order('created_at', { ascending: false }),
      assignedModuleIds.length
        ? supabase.from('modules').select('*').in('id', assignedModuleIds).eq('is_published', false)
        : Promise.resolve({ data: [] as Module[] }),
    ])
    const seen = new Set<string>()
    modules = [...(published ?? []), ...(assignedDrafts ?? [])].filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
  } else {
    if (assignedModuleIds.length) {
      const { data } = await supabase
        .from('modules')
        .select('*')
        .in('id', assignedModuleIds)
        .order('title')
      modules = data ?? []
    }
  }

  // Required (auto-assigned-to-everyone) modules always pin to the top
  modules = [...modules].sort((a, b) => Number(b.auto_assign_all) - Number(a.auto_assign_all))

  // Employees can also browse (and search) every published course, not just
  // the ones assigned to them. Proxy views stay limited to the employee's own
  // assignments.
  let availableModules: Module[] = []
  const canBrowseAll = !isProxy && currentProfile?.role === 'employee'
  if (canBrowseAll) {
    const { data } = await supabase
      .from('modules')
      .select('*')
      .eq('is_published', true)
      .order('title')
    availableModules = (data ?? []).filter(m => !assignedModuleIds.includes(m.id) && !isProtectedModule(m.id))
  }
  const allModules = [...modules, ...availableModules]

  // Get progress for effective user (archived trainings don't count)
  const { data: sectionCounts } = await supabase
    .from('sections')
    .select('module_id, id')
    .in('module_id', allModules.length ? allModules.map(m => m.id) : [''])
    .eq('is_archived', false)

  const { data: completedSections } = await supabase
    .from('section_progress')
    .select('section_id, sections!inner(module_id, is_archived)')
    .eq('user_id', effectiveUserId)
    .eq('sections.is_archived', false)

  // A module's required set is null/absent (whole module or admin preview,
  // no restriction) or a specific Set of section ids (partial assignment).
  const isSectionRequired = (moduleId: string, sectionId: string) => {
    const required = requiredSectionsByModule.get(moduleId)
    return !required || required.has(sectionId)
  }

  const totalByModule: Record<string, number> = {}
  const completedByModule: Record<string, number> = {}

  for (const row of sectionCounts ?? []) {
    if (!isSectionRequired(row.module_id, row.id)) continue
    totalByModule[row.module_id] = (totalByModule[row.module_id] ?? 0) + 1
  }
  for (const row of (completedSections ?? []) as any[]) {
    const moduleId = row.sections?.module_id
    if (moduleId && isSectionRequired(moduleId, row.section_id)) {
      completedByModule[moduleId] = (completedByModule[moduleId] ?? 0) + 1
    }
  }

  const asParam = isProxy ? `?as=${effectiveUserId}` : ''

  const items: CatalogItem[] = allModules.map(mod => {
    const total = totalByModule[mod.id] ?? 0
    const completed = completedByModule[mod.id] ?? 0
    return {
      id: mod.id,
      title: mod.title,
      description: mod.description,
      category: mod.category,
      minutes: mod.estimated_minutes,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      required: mod.auto_assign_all,
      assigned: assignedModuleIds.includes(mod.id),
      isChecklist: mod.module_type === 'checklist',
    }
  })

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={proxyName ? `Training for ${proxyName}` : 'Training Catalog'} />
      <main className="flex-1 p-4 sm:p-6">
        {allModules.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No trainings available</p>
            <p className="text-slate-400 text-sm mt-1">
              {isProxy
                ? `${proxyName} has no training assigned yet`
                : currentProfile?.role === 'employee'
                  ? 'Your manager will assign trainings to you'
                  : 'Publish a module to make it visible here'}
            </p>
          </div>
        ) : (
          <CatalogGrid
            items={items}
            asParam={asParam}
            allowScopeToggle={canBrowseAll && availableModules.length > 0}
          />
        )}
      </main>
    </div>
  )
}
