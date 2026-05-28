import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { module: mod, userId } = await req.json()

  // Create module
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

  // Create sections and content blocks
  for (let si = 0; si < mod.sections.length; si++) {
    const section = mod.sections[si]

    const { data: sectionData, error: sectionError } = await supabase
      .from('sections')
      .insert({
        module_id: moduleData.id,
        title: section.title,
        order_index: si,
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

  return NextResponse.json({ moduleId: moduleData.id })
}
