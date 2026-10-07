import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthedUser, loadBundle, loadHolidaySets, PERSON_COLS } from '@/lib/introReviews/server'
import { REVIEW_DAYS, type PersonLite } from '@/lib/introReviews/types'
import { buildTemplateSnapshot } from '@/lib/introReviews/templates'
import { nthBusinessDay } from '@/lib/introReviews/time'
import { notifyCallCancelled, notifyEnrolled } from '@/lib/introReviews/notify'

export const dynamic = 'force-dynamic'

// POST — HR admin enrolls an employee: creates (or re-dates) the 7/30/60/90-day
// reviews from their First Day and emails everyone involved.
export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Only admins can start reviews' }, { status: 403 })

  const { userId, startDate, supervisorId, evaluatorId } = await req.json()
  if (!userId || !supervisorId || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: 'Employee, First Day and supervisor are required' }, { status: 400 })
  }
  const evaluator = evaluatorId || supervisorId

  const db = createAdminClient()
  const { data: reviewee } = await db.from('profiles').select(PERSON_COLS).eq('id', userId).single()
  if (!reviewee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  const revieweeP = reviewee as unknown as PersonLite

  const holidays = await loadHolidaySets(db)
  const holidaySet = holidays[revieweeP.holiday_region ?? 'US'] ?? new Set<string>()
  const due = REVIEW_DAYS.map(day => ({ day, date: nthBusinessDay(startDate, day, holidaySet) }))

  const { data: existing } = await db.from('intro_reviews').select('id, review_day, status').eq('user_id', userId)
  const byDay = new Map((existing ?? []).map(e => [e.review_day as number, e]))

  let created = 0
  for (const d of due) {
    const ex = byDay.get(d.day)
    if (!ex) {
      const { error } = await db.from('intro_reviews').insert({
        user_id: userId,
        review_day: d.day,
        due_date: d.date,
        supervisor_id: supervisorId,
        evaluator_id: evaluator,
        template_snapshot: buildTemplateSnapshot(d.day),
        created_by: user.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      created++
    } else if (ex.status !== 'completed') {
      const revive =
        ex.status === 'cancelled'
          ? {
              status: 'awaiting_self',
              call_at: null,
              slots: [],
              self_answers: null,
              self_submitted_at: null,
              evaluator_answers: null,
              evaluator_submitted_at: null,
            }
          : {}
      await db
        .from('intro_reviews')
        .update({
          due_date: d.date,
          supervisor_id: supervisorId,
          evaluator_id: evaluator,
          updated_at: new Date().toISOString(),
          ...revive,
        })
        .eq('id', ex.id as string)
    }
  }

  await db.from('profiles').update({ start_date: startDate }).eq('id', userId)

  const { data: first } = await db
    .from('intro_reviews')
    .select('id')
    .eq('user_id', userId)
    .eq('review_day', 7)
    .single()
  if (first) {
    const bundle = await loadBundle(db, first.id as string)
    if (bundle) await notifyEnrolled(db, bundle, due, created === 0)
  }

  return NextResponse.json({ ok: true, created, due })
}

// DELETE ?userId= — HR admin stops an employee's reviews (enrolled by mistake,
// left the company…). Completed reviews are kept; open ones are cancelled and
// any booked call is cancelled in everyone's calendar.
export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Only admins can cancel reviews' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const db = createAdminClient()
  const { data: open } = await db
    .from('intro_reviews')
    .select('id, call_at')
    .eq('user_id', userId)
    .in('status', ['awaiting_self', 'awaiting_evaluator', 'awaiting_signatures'])

  for (const row of open ?? []) {
    const bundle = await loadBundle(db, row.id as string)
    const was = row.call_at ? new Date(row.call_at as string) : null
    await db
      .from('intro_reviews')
      .update({
        status: 'cancelled',
        call_at: null,
        slots: [],
        call_sequence: (bundle?.review.call_sequence ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id as string)
    if (bundle && was) {
      bundle.review.call_sequence += 1
      await notifyCallCancelled(db, bundle, was)
    }
  }

  return NextResponse.json({ ok: true, cancelled: (open ?? []).length })
}
