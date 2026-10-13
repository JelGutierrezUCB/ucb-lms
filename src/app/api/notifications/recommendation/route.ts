import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUsers } from '@/lib/notifications'

// Tells an employee that a supervisor/admin recommended a training to them.
// Authorization comes from RLS: the recommendation row is only readable by
// its recommender (or an admin/their manager), so a caller can't notify
// about a recommendation they didn't make.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recommendationId } = await req.json()
  if (!recommendationId) return NextResponse.json({ error: 'Missing recommendationId' }, { status: 400 })

  const { data: rec } = await supabase
    .from('training_recommendations')
    .select('user_id, module_id, resource_id, recommended_by, note')
    .eq('id', recommendationId)
    .maybeSingle()

  if (!rec || rec.recommended_by !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let title = 'a training'
  if (rec.module_id) {
    const { data: m } = await supabase.from('modules').select('title').eq('id', rec.module_id).maybeSingle()
    if (m?.title) title = m.title
  } else if (rec.resource_id) {
    const { data: r } = await supabase.from('learning_resources').select('title').eq('id', rec.resource_id).maybeSingle()
    if (r?.title) title = r.title
  }

  const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const who = me?.full_name ?? 'Your supervisor'
  const note = rec.note ? ` "${rec.note}"` : ''

  await notifyUsers([rec.user_id], {
    type: 'recommendation',
    title: 'New training recommended for you',
    message: `${who} recommended "${title}" for you.${note}`,
    link: '/learn-next',
  })

  return NextResponse.json({ success: true })
}
