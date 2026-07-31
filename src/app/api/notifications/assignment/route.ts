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

  const { userIds, moduleId, moduleTitle, dueDate } = await req.json()
  if (!Array.isArray(userIds) || userIds.length === 0 || !moduleId || !moduleTitle) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const dueDateText = dueDate ? ` It's due by ${new Date(dueDate).toLocaleDateString()}.` : ''

  await notifyUsers(userIds, {
    type: 'assignment',
    title: 'New training assigned',
    message: `You've been assigned "${moduleTitle}".${dueDateText}`,
    link: `/training/${moduleId}`,
  })

  return NextResponse.json({ success: true })
}
