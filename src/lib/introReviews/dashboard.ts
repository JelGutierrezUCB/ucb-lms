import { reviewAction } from './actions'
import { daysUntil, fmtDateOnly } from './time'
import type { ReviewLite, SignerRole } from './types'

export interface ReviewActionItem {
  id: string
  title: string
  subtitle: string
  action: string
  overdue: boolean
}

// What's waiting on this person across all their introductory reviews, for the
// dashboard cards. HR admins also get a count of every overdue review.
export async function getReviewActionItems(
  supabase: { from: (table: string) => any },
  userId: string,
  role: string
): Promise<{ items: ReviewActionItem[]; orgOverdue: number }> {
  const { data } = await supabase
    .from('intro_reviews')
    .select('id, user_id, review_day, due_date, supervisor_id, evaluator_id, status, call_at, slots, intro_review_signatures(role)')
    .neq('status', 'cancelled')
  const reviews = (data ?? []) as (ReviewLite & { intro_review_signatures?: { role: SignerRole }[] })[]
  if (reviews.length === 0) return { items: [], orgOverdue: 0 }

  const ids = [...new Set(reviews.map(r => r.user_id))]
  const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', ids)
  const names = new Map<string, string>(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))

  const items: ReviewActionItem[] = []
  for (const r of reviews) {
    const action = reviewAction(r, (r.intro_review_signatures ?? []).map(s => s.role), userId)
    if (!action) continue
    items.push({
      id: r.id,
      title: r.user_id === userId ? `Your ${r.review_day}-day review` : `${names.get(r.user_id) ?? 'Employee'} — ${r.review_day}-day review`,
      subtitle: `Due ${fmtDateOnly(r.due_date)}`,
      action,
      overdue: daysUntil(r.due_date) < 0,
    })
  }
  items.sort((a, b) => Number(b.overdue) - Number(a.overdue))

  const orgOverdue =
    role === 'admin'
      ? reviews.filter(r => r.status !== 'completed' && daysUntil(r.due_date) < 0).length
      : 0

  return { items, orgOverdue }
}
