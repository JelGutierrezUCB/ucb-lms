import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { module: mod, userId, targetModuleId, retainedDocument } = await req.json()

  let moduleId: string
  let orderOffset = 0

  if (targetModuleId) {
    // Adding to an existing module — verify it exists, then append sections
    // after whatever's already there instead of creating a new module.
    const { data: existingModule, error: existingError } = await supabase
      .from('modules')
      .select('id')
      .eq('id', targetModuleId)
      .single()

    if (existingError || !existingModule) {
      return NextResponse.json({ error: 'Target module not found' }, { status: 400 })
    }

    moduleId = existingModule.id

    const { data: lastSection } = await supabase
      .from('sections')
      .select('order_index')
      .eq('module_id', moduleId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()

    orderOffset = (lastSection?.order_index ?? -1) + 1
  } else {
    // Create a new module
    const { data: moduleData, error: moduleError } = await supabase
      .from('modules')
      .insert({
        title: mod.title,
        description: mod.description,
        category: mod.category,
        estimated_minutes: mod.estimated_minutes,
        is_published: false,
        created_by: userId,
      })
      .select()
      .single()

    if (moduleError) return NextResponse.json({ error: moduleError.message }, { status: 400 })
    moduleId = moduleData.id
  }

  // Create sections and content blocks
  for (let si = 0; si < mod.sections.length; si++) {
    const section = mod.sections[si]

    const { data: sectionData, error: sectionError } = await supabase
      .from('sections')
      .insert({
        module_id: moduleId,
        title: section.title,
        order_index: orderOffset + si,
      })
      .select()
      .single()

    if (sectionError) continue

    for (let bi = 0; bi < section.content_blocks.length; bi++) {
      const block = section.content_blocks[bi]
      await supabase.from('content_blocks').insert({
        section_id: sectionData.id,
        type: block.type,
        order_index: bi,
        content: block.content,
      })
    }
  }

  // The admin chose to retain the original uploaded document — attach it as
  // one more training so employees can view/download the source material.
  if (retainedDocument?.storagePath) {
    const { data: docSection, error: docSectionError } = await supabase
      .from('sections')
      .insert({
        module_id: moduleId,
        title: 'Reference Document',
        order_index: orderOffset + mod.sections.length,
      })
      .select()
      .single()

    if (!docSectionError && docSection) {
      await supabase.from('content_blocks').insert({
        section_id: docSection.id,
        type: 'document',
        order_index: 0,
        content: {
          storage_path: retainedDocument.storagePath,
          file_name: retainedDocument.fileName,
          mime_type: retainedDocument.mimeType,
        },
      })
    }
  }

  return NextResponse.json({ moduleId })
}
