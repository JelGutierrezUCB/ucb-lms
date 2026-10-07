import type { Recommendation, ReviewAnswers, ReviewRating, TemplateSnapshot } from './types'

const RATINGS: ReviewRating[] = ['x', 'check', 'check_plus']
const RECOMMENDATIONS: Recommendation[] = ['extend_offer', 'continue_contractor', 'extend_period', 'end_employment']
const MAX_TEXT = 5000

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '')

export type Sanitized = { ok: true; value: ReviewAnswers } | { ok: false; error: string }

// Keeps only the fields the template knows about (so nothing arbitrary gets
// stored) and, when `complete` is set, enforces that everything required was filled in.
export function sanitizeAnswers(
  template: TemplateSnapshot,
  raw: unknown,
  mode: 'self' | 'evaluator',
  complete: boolean
): Sanitized {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<ReviewAnswers>
  const value: ReviewAnswers = { ratings: {}, answers: {} }

  for (const item of template.ratingItems) {
    const r = input.ratings?.[item.id]
    if (r && RATINGS.includes(r)) value.ratings[item.id] = r
    else if (complete) return { ok: false, error: `Please rate “${item.label}”.` }
  }

  const audience = mode === 'self' ? 'reviewee' : 'evaluator'
  for (const question of template.questions.filter(x => x.audience === audience)) {
    const text = clean(input.answers?.[question.id])
    if (text) value.answers[question.id] = text
    else if (complete) return { ok: false, error: 'Please answer every question before submitting.' }
  }

  if (mode === 'self') {
    const comments = clean(input.comments)
    if (comments) value.comments = comments
  } else {
    const narrative = clean(input.narrative)
    if (narrative) value.narrative = narrative
    else if (complete) return { ok: false, error: 'Please add your narrative before submitting.' }

    if (template.hasRecommendation) {
      if (input.recommendation && RECOMMENDATIONS.includes(input.recommendation)) {
        value.recommendation = input.recommendation
        if (input.recommendation === 'extend_period') {
          const days = Math.round(Number(input.extendDays))
          if (days >= 1 && days <= 365) value.extendDays = days
          else if (complete) return { ok: false, error: 'Enter how many days to extend the introductory period (1–365).' }
        }
      } else if (complete) {
        return { ok: false, error: 'Please choose a recommendation.' }
      }
    }
  }

  return { ok: true, value }
}
