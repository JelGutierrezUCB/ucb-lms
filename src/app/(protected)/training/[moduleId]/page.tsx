import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { TrainingPlayer } from '@/components/training/TrainingPlayer'
import type { Module, Section, ContentBlock } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TrainingModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string }>
  searchParams: Promise<{ as?: string }>
}) {
  const { moduleId } = await params
  const sp = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  // Determine effective user ID
  let effectiveUserId = user.id
  let proxyName: string | null = null

  if (sp.as && ['admin', 'manager'].includes(currentProfile?.role ?? '')) {
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, full_name, manager_id, role')
      .eq('id', sp.as)
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

  const { data: module } = await supabase
    .from('modules')
    .select('*')
    .eq('id', moduleId)
    .single() as { data: Module | null }

  if (!module) notFound()

  const { data: sections } = await supabase
    .from('sections')
    .select('*')
    .eq('module_id', moduleId)
    .order('order_index') as { data: Section[] | null }

  const sectionIds = (sections ?? []).map(s => s.id)
  const { data: contentBlocks } = await supabase
    .from('content_blocks')
    .select('*')
    .in('section_id', sectionIds.length ? sectionIds : [''])
    .order('order_index') as { data: ContentBlock[] | null }

  // Load completed sections for the effective user
  const { data: completedSections } = await supabase
    .from('section_progress')
    .select('section_id')
    .eq('user_id', effectiveUserId)

  const completedIds = new Set((completedSections ?? []).map((r: any) => r.section_id))

  const sectionsWithBlocks = (sections ?? []).map(s => ({
    ...s,
    content_blocks: (contentBlocks ?? []).filter(b => b.section_id === s.id),
    is_completed: completedIds.has(s.id),
  }))

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={proxyName ? `${module.title} — ${proxyName}` : module.title} />
      <main className="flex-1 overflow-auto">
        <TrainingPlayer
          module={module}
          sections={sectionsWithBlocks}
          userId={effectiveUserId}
        />
      </main>
    </div>
  )
}
