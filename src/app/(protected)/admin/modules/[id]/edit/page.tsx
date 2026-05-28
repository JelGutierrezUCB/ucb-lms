import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ModuleEditor } from '@/components/admin/ModuleEditor'
import type { Module, Section, ContentBlock } from '@/types'

export default async function EditModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: module } = await supabase
    .from('modules')
    .select('*')
    .eq('id', id)
    .single() as { data: Module | null }

  if (!module) notFound()

  const { data: sections } = await supabase
    .from('sections')
    .select('*')
    .eq('module_id', id)
    .order('order_index') as { data: Section[] | null }

  const sectionIds = (sections ?? []).map(s => s.id)
  const { data: contentBlocks } = await supabase
    .from('content_blocks')
    .select('*')
    .in('section_id', sectionIds.length ? sectionIds : [''])
    .order('order_index') as { data: ContentBlock[] | null }

  const sectionsWithBlocks = (sections ?? []).map(s => ({
    ...s,
    content_blocks: (contentBlocks ?? []).filter(b => b.section_id === s.id),
  }))

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={`Edit: ${module.title}`} />
      <main className="flex-1 p-6">
        <ModuleEditor module={module} initialSections={sectionsWithBlocks} createdBy={user.id} />
      </main>
    </div>
  )
}
