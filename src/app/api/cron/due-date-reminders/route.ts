import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { notifyUsers } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` for scheduled invocations
// when the CRON_SECRET env var is set on the project. See vercel.json for the schedule.
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = await createAdminClient()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const { data: assignments } = await admin
    .from('assignments')
    .select('user_id, module_id, modules(title)')
    .eq('due_date', tomorrowStr)

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ notified: 0 })
  }

  let notified = 0

  for (const a of assignments) {
    const moduleTitle = (a.modules as unknown as { title: string } | null)?.title ?? 'a training module'

    const { data: sections } = await admin.from('sections').select('id').eq('module_id', a.module_id)
    const sectionIds = (sections ?? []).map(s => s.id)

    let doneCount = 0
    if (sectionIds.length > 0) {
      const { count } = await admin
        .from('section_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', a.user_id)
        .in('section_id', sectionIds)
      doneCount = count ?? 0
    }

    const { count: manualCount } = await admin
      .from('manual_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', a.user_id)
      .eq('module_id', a.module_id)

    const isComplete = (sectionIds.length > 0 && doneCount >= sectionIds.length) || (manualCount ?? 0) > 0
    if (isComplete) continue

    await notifyUsers([a.user_id], {
      type: 'due_soon',
      title: 'Training due tomorrow',
      message: `"${moduleTitle}" is due tomorrow. Complete it soon to stay on track.`,
      link: `/training/${a.module_id}`,
    })
    notified++
  }

  return NextResponse.json({ notified })
}
