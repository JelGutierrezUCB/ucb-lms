import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { canManageReview, getAuthedUser, loadBundle } from '@/lib/introReviews/server'
import { sanitizeAnswers } from '@/lib/introReviews/validate'

export const dynamic = 'force-dynamic'

// Autosave for an in-progress self-review / evaluation. Drafts live in their
// own table so the other party can never read them before submission.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, answers } = await req.json()
  if (role !== 'reviewee' && role !== 'evaluator') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const db = createAdminClient()
  const b = await loadBundle(db, id)
  if (!b) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  if (role === 'reviewee') {
    if (user.id !== b.review.user_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (b.review.status !== 'awaiting_self') {
      return NextResponse.json({ error: 'The self-review is already submitted' }, { status: 409 })
    }
  } else {
    if (!canManageReview(user, b.review)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (b.review.status !== 'awaiting_self' && b.review.status !== 'awaiting_evaluator') {
      return NextResponse.json({ error: 'The evaluation is already submitted' }, { status: 409 })
    }
  }

  const result = sanitizeAnswers(b.review.template_snapshot, answers, role === 'reviewee' ? 'self' : 'evaluator', false)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  await db
    .from('intro_review_drafts')
    .upsert(
      { review_id: id, role, answers: result.value, updated_at: new Date().toISOString() },
      { onConflict: 'review_id,role' }
    )
  return NextResponse.json({ ok: true })
}
