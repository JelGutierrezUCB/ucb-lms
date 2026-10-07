import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthedUser, isInvolved, loadBundle } from '@/lib/introReviews/server'
import { generateReviewPdf } from '@/lib/introReviews/pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The signed review as a PDF, rebuilt on demand from the locked review data
// and signatures (so there's no separate file to keep in sync).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const b = await loadBundle(db, id)
  if (!b) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (!isInvolved(user, b.review)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: p } = await db.from('profiles').select('start_date').eq('id', b.review.user_id).single()
  const pdf = await generateReviewPdf(b, (p?.start_date as string | null) ?? null)

  const name = b.reviewee.full_name.replace(/[^a-z0-9]+/gi, '-')
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}-${b.review.review_day}-day-review.pdf"`,
    },
  })
}
