import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyUsers } from '@/lib/notifications'

// Fired client-side the moment an employee finishes every section of a
// module — notifies whoever assigned it (in-app + email), so admins/managers
// don't have to keep checking Reports to see who's finished.
export async function POST(req: NextRequest) {
  const { userId, moduleId } = await req.json()
  if (!userId || !moduleId) return NextResponse.json({ error: 'Missing userId or moduleId' }, { status: 400 })

  const admin = await createAdminClient()

  const [{ data: employee }, { data: mod }, { data: assignments }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', userId).single(),
    admin.from('modules').select('title').eq('id', moduleId).single(),
    admin.from('assignments').select('assigned_by').eq('user_id', userId).eq('module_id', moduleId),
  ])

  if (!employee || !mod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Notify whoever assigned it — excluding self-assignment (e.g. modules
  // auto-assigned to everyone record the new user themselves as assigned_by).
  const assignerIds = [...new Set((assignments ?? []).map(a => a.assigned_by))].filter(id => id !== userId)
  if (assignerIds.length === 0) return NextResponse.json({ success: true, notified: 0 })

  await notifyUsers(assignerIds, {
    type: 'completion',
    title: `${employee.full_name} completed ${mod.title}`,
    message: `${employee.full_name} just finished "${mod.title}" — you assigned this training to them.`,
    link: '/reports',
  })

  return NextResponse.json({ success: true, notified: assignerIds.length })
}
