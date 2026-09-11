import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Returns a short-lived signed URL for a "document" content block's file.
// The bucket is private, so every view goes through here rather than a
// direct storage link — this is where we check the requester is actually
// allowed to see the training the document belongs to.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contentBlockId } = await req.json()
  if (!contentBlockId) return NextResponse.json({ error: 'Missing contentBlockId' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const { data: block } = await supabase
    .from('content_blocks')
    .select('id, type, content, section:sections(module_id)')
    .eq('id', contentBlockId)
    .single() as any

  if (!block || block.type !== 'document') {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const moduleId = block.section?.module_id
  const isStaff = profile?.role === 'admin' || profile?.role === 'manager'

  if (!isStaff) {
    const { data: assignment } = await supabase
      .from('assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('module_id', moduleId)
      .maybeSingle()
    if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const content = block.content as { storage_path: string; file_name: string; mime_type?: string }

  const admin = await createAdminClient()
  const { data: signed, error } = await admin.storage
    .from('training-source-docs')
    .createSignedUrl(content.storage_path, 60 * 60) // 1 hour — enough to read through a document

  if (error || !signed) {
    return NextResponse.json({ error: `Failed to generate link: ${error?.message ?? 'unknown error'}` }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl, fileName: content.file_name, mimeType: content.mime_type })
}
