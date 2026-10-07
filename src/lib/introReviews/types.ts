import type { WorkSchedule, HolidayRegion } from '@/types'

export type ReviewDay = 7 | 30 | 60 | 90
export const REVIEW_DAYS: ReviewDay[] = [7, 30, 60, 90]

export type ReviewStatus =
  | 'awaiting_self'
  | 'awaiting_evaluator'
  | 'awaiting_signatures'
  | 'completed'
  | 'cancelled'

// ✗ = does not exhibit, ✓ = some of the time, ✓+ = most of the time
export type ReviewRating = 'x' | 'check' | 'check_plus'
export type SignerRole = 'reviewee' | 'supervisor' | 'evaluator'
export type Recommendation = 'extend_offer' | 'continue_contractor' | 'extend_period' | 'end_employment'

export interface RatingItem {
  id: string
  group: 'core' | 'rprs'
  label: string
  description: string
}

export interface ReviewQuestion {
  id: string
  text: string
  audience: 'evaluator' | 'reviewee'
  hint?: string
}

// Frozen onto each review when it's created, so a signed review never
// changes if the wording of the form is edited later.
export interface TemplateSnapshot {
  day: ReviewDay
  title: string
  ratingItems: RatingItem[]
  questions: ReviewQuestion[]
  hasRecommendation: boolean
  consentText: string
}

export interface ReviewAnswers {
  ratings: Record<string, ReviewRating>
  answers: Record<string, string>
  comments?: string // reviewee's comments
  narrative?: string // evaluator's narrative
  recommendation?: Recommendation // 90-day only
  extendDays?: number
}

export interface ReviewRow {
  id: string
  user_id: string
  review_day: ReviewDay
  due_date: string
  supervisor_id: string | null
  evaluator_id: string | null
  status: ReviewStatus
  call_at: string | null
  call_duration_min: number
  call_link: string | null
  call_sequence: number
  slots: string[]
  slots_proposed_at: string | null
  slots_note: string | null
  template_snapshot: TemplateSnapshot
  self_answers: ReviewAnswers | null
  self_submitted_at: string | null
  evaluator_answers: ReviewAnswers | null
  evaluator_submitted_at: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// The few columns the sidebar / dashboard cards / list need — no answers
export interface ReviewLite {
  id: string
  user_id: string
  review_day: ReviewDay
  due_date: string
  supervisor_id: string | null
  evaluator_id: string | null
  status: ReviewStatus
  call_at: string | null
  slots: string[]
}

export interface SignatureRow {
  id: string
  review_id: string
  signer_id: string | null
  role: SignerRole
  signer_name: string
  signature_type: 'typed' | 'drawn'
  signature_text: string | null
  signature_image: string | null
  consent_text: string
  content_hash: string
  signed_at: string
  ip_address: string | null
  user_agent: string | null
}

export interface PersonLite {
  id: string
  email: string
  full_name: string
  job_title?: string | null
  timezone?: string | null
  holiday_region?: HolidayRegion | null
  work_schedule?: WorkSchedule | null
}

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  extend_offer: 'Extend offer to continue as a regular and full-time employee.',
  continue_contractor: 'Continue the contractor engagement offer.',
  extend_period: 'Extend introductory period for another ___ days.',
  end_employment: 'End employment.',
}

export const RATING_LABELS: Record<ReviewRating, string> = {
  x: 'Does not exhibit',
  check: 'Some of the time',
  check_plus: 'Most of the time',
}

export const RATING_SYMBOLS: Record<ReviewRating, string> = {
  x: '✗',
  check: '✓',
  check_plus: '✓+',
}
