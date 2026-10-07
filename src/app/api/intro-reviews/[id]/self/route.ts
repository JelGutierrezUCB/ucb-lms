import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthedUser, loadBundle } from '@/lib/introReviews/server'
import { sanitizeAnswers } from '@/lib/introReviews/validate'
import { notifySelfSubmitted } from '@/lib/introReviews/notify'

export const dynamic = 'force-dynamic'

// The employee submits their self-review. From here the manager can read it
// (ideally before the call) and the employee can no longer edit it.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { answers } = await req.json()
  const db = createAdminClient()
  const b = await loadBundle(db, id)
  if (!b) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (user.id !== b.review.user_id) {
    return NextResponse.json({ error: 'Only the employee can submit their self-review' }, { status: 403 })
  }
  if (b.review.status !== 'awaiting_self') {
    return NextResponse.json({ error: 'This self-review was already submitted or the review has moved on' }, { status: 409 })
  }

  const result = sanitizeAnswers(b.review.template_snapshot, answers, 'self', true)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const now = new Date().toISOString()
  // Conditional on status so a double-click can't submit (and notify) twice
  const { data: updated } = await db
    .from('intro_reviews')
    .update({ self_answers: result.value, self_submitted_at: now, status: 'awaiting_evaluator', updated_at: now })
    .eq('id', id)
    .eq('status', 'awaiting_self')
    .select('id')
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'This self-review was already submitted' }, { status: 409 })
  }

  await db.from('intro_review_drafts').delete().eq('review_id', id).eq('role', 'reviewee')

  const fresh = await loadBundle(db, id)
  if (fresh) await notifySelfSubmitted(db, fresh)
  return NextResponse.json({ ok: true })
}
