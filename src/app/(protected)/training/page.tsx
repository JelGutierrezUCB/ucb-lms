import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Clock, BookOpen, Star } from 'lucide-react'
import Link from 'next/link'
import { cn, getCategoryColor, getCategoryLabel } from '@/lib/utils'
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

  // If viewing as proxy employee, show only their assigned modules
  // Admins/managers viewing their own training see all published modules
  const isProxy = effectiveUserId !== user.id
  if (!isProxy && ['admin', 'manager'].includes(currentProfile?.role ?? '')) {
    const { data } = await supabase
      .from('modules')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
    modules = data ?? []
  } else {
    if (assignedModuleIds.length) {
      const { data } = await supabase
        .from('modules')
        .select('*')
        .in('id', assignedModuleIds)
        .eq('is_published', true)
        .order('title')
      modules = data ?? []
    }
  }

  // Required (auto-assigned-to-everyone) modules always pin to the top
  modules = [...modules].sort((a, b) => Number(b.auto_assign_all) - Number(a.auto_assign_all))

  // Get progress for effective user
  const { data: sectionCounts } = await supabase
    .from('sections')
    .select('module_id, id')
    .in('module_id', modules.length ? modules.map(m => m.id) : [''])

  const { data: completedSections } = await supabase
    .from('section_progress')
    .select('section_id, sections!inner(module_id)')
    .eq('user_id', effectiveUserId)

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

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={proxyName ? `Training for ${proxyName}` : 'Training Catalog'} />
      <main className="flex-1 p-6">
        {modules.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {modules.map(mod => {
              const total = totalByModule[mod.id] ?? 0
              const completed = completedByModule[mod.id] ?? 0
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0
              const isAssigned = assignedModuleIds.includes(mod.id)
              const isRequired = mod.auto_assign_all

              return (
                <Link key={mod.id} href={`/training/${mod.id}${asParam}`}>
                  <Card
                    className={cn(
                      'h-full flex flex-col hover:shadow-md transition-shadow cursor-pointer group',
                      isRequired && 'ring-2 ring-amber-400 border-amber-300'
                    )}
                  >
                    <div
                      className="h-32 flex items-center justify-center rounded-t-xl relative"
                      style={{ backgroundColor: getCategoryColor(mod.category) }}
                    >
                      <span className="text-white text-5xl font-bold opacity-30">
                        {mod.title.charAt(0)}
                      </span>
                      {isRequired && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 text-xs font-semibold px-2.5 py-1">
                          <Star className="h-3 w-3 fill-current" /> Required
                        </div>
                      )}
                    </div>
                    <CardContent className="flex flex-col flex-1 pt-4 pb-5">
                      <div className="flex items-start gap-2 mb-2">
                        <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors flex-1">
                          {mod.title}
                        </p>
                        {isAssigned && <Badge variant="default">Assigned</Badge>}
                      </div>
                      <Badge
                        className="self-start mb-3"
                        style={{ backgroundColor: `${getCategoryColor(mod.category)}20`, color: getCategoryColor(mod.category) }}
                      >
                        {getCategoryLabel(mod.category)}
                      </Badge>
                      {mod.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{mod.description}</p>
                      )}
                      <div className="mt-auto space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />{mod.estimated_minutes} min
                          </span>
                          <span>{percent}% complete</span>
                        </div>
                        <Progress
                          value={percent}
                          indicatorClassName={percent === 100 ? 'bg-green-500' : undefined}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
