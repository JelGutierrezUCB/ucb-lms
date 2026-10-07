import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUsers } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { pathId, userIds, dueDate } = await req.json()
  if (!pathId || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // The DB function re-checks the caller's role and does the enrollment +
  // per-module assignments in one go.
  const { data: enrolled, error } = await supabase.rpc('enroll_users_in_path', {
    p_path: pathId,
    p_users: userIds,
    p_due: dueDate || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: path } = await supabase.from('learning_paths').select('title').eq('id', pathId).single()
  const dueText = dueDate ? ` It's due by ${new Date(dueDate).toLocaleDateString()}.` : ''

  await notifyUsers(userIds, {
    type: 'assignment',
    title: 'New learning journey assigned',
    message: `You've been enrolled in the learning journey "${path?.title ?? 'Learning journey'}".${dueText}`,
    link: '/paths',
  })

  return NextResponse.json({ success: true, enrolled })
}
