import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { canManageReview, getAuthedUser, loadBundle } from '@/lib/introReviews/server'
import { sanitizeAnswers } from '@/lib/introReviews/validate'
import { notifyEvaluated } from '@/lib/introReviews/notify'

export const dynamic = 'force-dynamic'

// The evaluator (usually the supervisor) submits their ratings, answers and
// narrative. This locks the review's content — everyone then signs exactly this.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { answers, proceedWithoutSelf } = await req.json()
  const db = createAdminClient()
  const b = await loadBundle(db, id)
  if (!b) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (!canManageReview(user, b.review)) {
    return NextResponse.json({ error: 'Only the evaluator, supervisor or HR can submit the evaluation' }, { status: 403 })
  }

  const status = b.review.status
  if (status !== 'awaiting_evaluator' && status !== 'awaiting_self') {
    return NextResponse.json({ error: 'This evaluation was already submitted' }, { status: 409 })
  }
  if (status === 'awaiting_self' && !proceedWithoutSelf) {
    return NextResponse.json(
      {
        error: `${b.reviewee.full_name} hasn't submitted their self-review yet. You can wait for it, or proceed without it.`,
        code: 'SELF_REVIEW_MISSING',
      },
      { status: 409 }
    )
  }

  const result = sanitizeAnswers(b.review.template_snapshot, answers, 'evaluator', true)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const now = new Date().toISOString()
  const { data: updated } = await db
    .from('intro_reviews')
    .update({ evaluator_answers: result.value, evaluator_submitted_at: now, status: 'awaiting_signatures', updated_at: now })
    .eq('id', id)
    .in('status', ['awaiting_self', 'awaiting_evaluator'])
    .select('id')
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'This evaluation was already submitted' }, { status: 409 })
  }

  await db.from('intro_review_drafts').delete().eq('review_id', id)

  const fresh = await loadBundle(db, id)
  if (fresh) await notifyEvaluated(db, fresh, user.id)
  return NextResponse.json({ ok: true })
}
