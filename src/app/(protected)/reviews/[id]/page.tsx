import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ReviewDetail } from '@/components/reviews/ReviewDetail'
import { PERSON_COLS } from '@/lib/introReviews/server'
import type { PersonLite, ReviewAnswers, ReviewRow, SignatureRow } from '@/lib/introReviews/types'

export const dynamic = 'force-dynamic'

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('id, role, full_name, timezone').eq('id', user.id).single()
  if (!me) redirect('/login')

  // Row-level security means anyone who isn't the reviewee, their
  // supervisor/evaluator, or HR simply gets nothing back here.
  const { data: row } = await supabase.from('intro_reviews').select('*').eq('id', id).maybeSingle()
  if (!row) notFound()
  const review = row as unknown as ReviewRow

  const ids = [review.user_id, review.supervisor_id, review.evaluator_id].filter(Boolean) as string[]
  const [{ data: people }, { data: sigs }, { data: drafts }, { data: startRow }] = await Promise.all([
    supabase.from('profiles').select(PERSON_COLS).in('id', ids),
    supabase.from('intro_review_signatures').select('*').eq('review_id', id),
    // RLS only returns the viewer's own draft(s)
    supabase.from('intro_review_drafts').select('role, answers').eq('review_id', id),
    supabase.from('profiles').select('start_date').eq('id', review.user_id).single(),
  ])

  const byId = new Map((people ?? []).map(p => [p.id as string, p as unknown as PersonLite]))
  const reviewee = byId.get(review.user_id)
  if (!reviewee) notFound()

  const isAdmin = me.role === 'admin'
  const isReviewee = user.id === review.user_id
  const canManage = isAdmin || user.id === review.supervisor_id || user.id === review.evaluator_id

  const draft = (role: 'reviewee' | 'evaluator') =>
    ((drafts ?? []).find(d => d.role === role)?.answers as ReviewAnswers | undefined) ?? null

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Introductory Review" />
      <main className="flex-1 p-6">
        <ReviewDetail
          review={review}
          reviewee={reviewee}
          supervisor={review.supervisor_id ? byId.get(review.supervisor_id) ?? null : null}
          evaluator={review.evaluator_id ? byId.get(review.evaluator_id) ?? null : null}
          signatures={(sigs ?? []) as unknown as SignatureRow[]}
          viewer={{
            id: user.id,
            role: me.role as string,
            fullName: me.full_name as string,
            timezone: (me.timezone as string | null) ?? null,
            isReviewee,
            canManage,
          }}
          draftSelf={isReviewee ? draft('reviewee') : null}
          draftEvaluator={canManage ? draft('evaluator') : null}
          firstDay={(startRow?.start_date as string | null) ?? null}
        />
      </main>
    </div>
  )
}
