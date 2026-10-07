import { requiredRoles } from './templates'
import { daysUntil } from './time'
import type { ReviewLite, SignerRole } from './types'

// Pure helpers shared by the sidebar badge, dashboard cards, list page and
// detail page — "what does this person need to do on this review next?"

export function requiredSignerRoles(r: Pick<ReviewLite, 'review_day' | 'supervisor_id' | 'evaluator_id'>): SignerRole[] {
  const hasSeparateEvaluator = !!r.evaluator_id && r.evaluator_id !== r.supervisor_id
  return requiredRoles(r.review_day).filter(role => role !== 'evaluator' || hasSeparateEvaluator)
}

// The roles this person signs as. Supervisor and evaluator are usually the
// same person — then one signature (as supervisor) covers both.
export function signerRolesFor(r: ReviewLite, personId: string): SignerRole[] {
  const required = requiredSignerRoles(r)
  const roles: SignerRole[] = []
  if (r.user_id === personId && required.includes('reviewee')) roles.push('reviewee')
  if (r.supervisor_id === personId && required.includes('supervisor')) roles.push('supervisor')
  if (r.evaluator_id === personId && r.evaluator_id !== r.supervisor_id && required.includes('evaluator')) {
    roles.push('evaluator')
  }
  return roles
}

export function reviewAction(r: ReviewLite, signedRoles: SignerRole[], viewerId: string): string | null {
  if (r.status === 'completed' || r.status === 'cancelled') return null

  const due = daysUntil(r.due_date)
  const hasCall = !!r.call_at
  const hasSlots = (r.slots ?? []).length > 0
  const isReviewee = r.user_id === viewerId
  const isManager = r.supervisor_id === viewerId || r.evaluator_id === viewerId
  const unsigned = signerRolesFor(r, viewerId).some(role => !signedRoles.includes(role))

  if (isReviewee) {
    if (r.status === 'awaiting_self') {
      if (!hasCall && hasSlots) return 'Pick a time for your review call'
      if (hasCall || due <= 10) return 'Complete your self-review'
    }
    if (r.status === 'awaiting_signatures' && unsigned) return 'Sign your review'
  }

  if (isManager) {
    if ((r.status === 'awaiting_self' || r.status === 'awaiting_evaluator') && !hasCall && !hasSlots && due <= 14) {
      return 'Schedule the review call'
    }
    if (r.status === 'awaiting_evaluator') return 'Complete the evaluation'
    if (r.status === 'awaiting_signatures' && unsigned) return 'Sign the review'
  }

  return null
}

export function statusInfo(r: ReviewLite): {
  label: string
  variant: 'default' | 'success' | 'warning' | 'danger' | 'outline'
  overdue: boolean
} {
  const finished = r.status === 'completed' || r.status === 'cancelled'
  const overdue = !finished && daysUntil(r.due_date) < 0

  switch (r.status) {
    case 'completed':
      return { label: 'Completed', variant: 'success', overdue: false }
    case 'cancelled':
      return { label: 'Cancelled', variant: 'outline', overdue: false }
    case 'awaiting_signatures':
      return { label: 'Awaiting signatures', variant: overdue ? 'danger' : 'warning', overdue }
    case 'awaiting_evaluator':
      return { label: 'Awaiting evaluation', variant: overdue ? 'danger' : 'warning', overdue }
    default: {
      if (r.call_at) return { label: 'Call scheduled', variant: overdue ? 'danger' : 'default', overdue }
      if ((r.slots ?? []).length > 0) return { label: 'Awaiting time pick', variant: overdue ? 'danger' : 'warning', overdue }
      return { label: 'Not scheduled', variant: overdue ? 'danger' : 'outline', overdue }
    }
  }
}
