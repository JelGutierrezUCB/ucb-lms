import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Role } from '@/types'
import type { PersonLite, ReviewRow, SignatureRow } from './types'

export type AdminDb = ReturnType<typeof createAdminClient>

export interface AuthedUser {
  id: string
  role: Role
  full_name: string
}

// The REAL signed-in user (never a "view as" proxy) — used for every
// permission check and every signature.
export async function getAuthedUser(): Promise<AuthedUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('id, role, full_name').eq('id', user.id).single()
  if (!profile) return null
  return { id: profile.id as string, role: profile.role as Role, full_name: profile.full_name as string }
}

export interface Bundle {
  review: ReviewRow
  reviewee: PersonLite
  supervisor: PersonLite | null
  evaluator: PersonLite | null
  signatures: SignatureRow[]
}

export const PERSON_COLS = 'id, email, full_name, job_title, timezone, holiday_region, work_schedule'

export async function loadBundle(db: AdminDb, reviewId: string): Promise<Bundle | null> {
  const { data: row } = await db.from('intro_reviews').select('*').eq('id', reviewId).maybeSingle()
  if (!row) return null
  const review = row as unknown as ReviewRow

  const ids = [review.user_id, review.supervisor_id, review.evaluator_id].filter(Boolean) as string[]
  const [{ data: people }, { data: sigs }] = await Promise.all([
    db.from('profiles').select(PERSON_COLS).in('id', ids),
    db.from('intro_review_signatures').select('*').eq('review_id', reviewId),
  ])
  const byId = new Map((people ?? []).map(p => [p.id as string, p as unknown as PersonLite]))
  const reviewee = byId.get(review.user_id)
  if (!reviewee) return null

  return {
    review,
    reviewee,
    supervisor: review.supervisor_id ? byId.get(review.supervisor_id) ?? null : null,
    evaluator: review.evaluator_id ? byId.get(review.evaluator_id) ?? null : null,
    signatures: (sigs ?? []) as unknown as SignatureRow[],
  }
}

// Everyone on the review call, de-duplicated (supervisor and evaluator are usually the same person)
export function participants(b: Bundle): PersonLite[] {
  const seen = new Set<string>()
  const out: PersonLite[] = []
  for (const p of [b.reviewee, b.supervisor, b.evaluator]) {
    if (p && !seen.has(p.id)) {
      seen.add(p.id)
      out.push(p)
    }
  }
  return out
}

export function managers(b: Bundle): PersonLite[] {
  return participants(b).filter(p => p.id !== b.reviewee.id)
}

export function canManageReview(user: AuthedUser, r: Pick<ReviewRow, 'supervisor_id' | 'evaluator_id'>): boolean {
  return user.role === 'admin' || user.id === r.supervisor_id || user.id === r.evaluator_id
}

export function isInvolved(user: AuthedUser, r: Pick<ReviewRow, 'user_id' | 'supervisor_id' | 'evaluator_id'>): boolean {
  return canManageReview(user, r) || user.id === r.user_id
}

export async function getHrAdmins(db: AdminDb): Promise<PersonLite[]> {
  const { data } = await db
    .from('profiles')
    .select(PERSON_COLS)
    .eq('role', 'admin')
    .or('is_active.is.null,is_active.eq.true')
  return (data ?? []) as unknown as PersonLite[]
}

export async function loadHolidaySets(db: AdminDb): Promise<Record<string, Set<string>>> {
  const { data } = await db.from('holidays').select('region, holiday_date')
  const out: Record<string, Set<string>> = { US: new Set(), PH: new Set() }
  for (const h of data ?? []) {
    const region = h.region as string
    if (!out[region]) out[region] = new Set()
    out[region].add(h.holiday_date as string)
  }
  return out
}

// Clears the call-dependent reminders so they fire again for the new time
export async function resetCallReminders(db: AdminDb, reviewId: string) {
  await db
    .from('intro_review_reminders')
    .delete()
    .eq('review_id', reviewId)
    .or('kind.like.self_%,kind.like.evaluate_%,kind.like.pick_slot%')
}
