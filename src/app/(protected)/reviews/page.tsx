import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ReviewsOverview, type OverviewReview } from '@/components/reviews/ReviewsOverview'
import type { ReviewLite, SignerRole } from '@/lib/introReviews/types'

export const dynamic = 'force-dynamic'

export default async function ReviewsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id, role, timezone').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Row-level security already limits this to reviews the viewer is part of
  // (HR admins see all).
  const { data: rows } = await supabase
    .from('intro_reviews')
    .select('id, user_id, review_day, due_date, supervisor_id, evaluator_id, status, call_at, slots')
  const reviews = (rows ?? []) as unknown as ReviewLite[]

  const ids = [...new Set(reviews.flatMap(r => [r.user_id, r.supervisor_id, r.evaluator_id]).filter(Boolean) as string[])]
  const reviewIds = reviews.map(r => r.id)
  const [{ data: people }, { data: sigs }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', ids.length ? ids : ['']),
    supabase.from('intro_review_signatures').select('review_id, role').in('review_id', reviewIds.length ? reviewIds : ['']),
  ])
  const names = new Map((people ?? []).map(p => [p.id as string, p.full_name as string]))
  const signed = new Map<string, SignerRole[]>()
  for (const s of sigs ?? []) {
    signed.set(s.review_id as string, [...(signed.get(s.review_id as string) ?? []), s.role as SignerRole])
  }

  const overview: OverviewReview[] = reviews.map(r => ({
    ...r,
    reviewee_name: names.get(r.user_id) ?? 'Unknown',
    supervisor_name: r.supervisor_id ? names.get(r.supervisor_id) ?? null : null,
    evaluator_name: r.evaluator_id ? names.get(r.evaluator_id) ?? null : null,
    signedRoles: signed.get(r.id) ?? [],
  }))

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Introductory Reviews" />
      <main className="flex-1 p-6">
        <ReviewsOverview
          viewerId={user.id}
          viewerRole={profile.role as string}
          viewerTz={(profile.timezone as string | null) ?? null}
          reviews={overview}
        />
      </main>
    </div>
  )
}
