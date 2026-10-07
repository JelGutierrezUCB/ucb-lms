import { daysUntil, fmtDateOnly, fmtInTz, selfReviewDeadline } from './time'
import { requiredSignerRoles } from './actions'
import { notifyHr, notifyMany, reviewLink } from './notify'
import type { AdminDb, Bundle } from './server'
import { PERSON_COLS } from './server'
import type { PersonLite, ReviewRow, SignatureRow, SignerRole } from './types'

// Runs from the daily cron (see /api/cron/due-date-reminders). Every reminder
// is logged in intro_review_reminders so a review never gets the same nudge
// twice; rescheduling a call clears the call-dependent ones so they re-arm.
export async function runReviewReminders(db: AdminDb): Promise<{ sent: number }> {
  const { data: rows } = await db
    .from('intro_reviews')
    .select('*')
    .in('status', ['awaiting_self', 'awaiting_evaluator', 'awaiting_signatures'])
  if (!rows || rows.length === 0) return { sent: 0 }

  const reviews = rows as unknown as ReviewRow[]
  const reviewIds = reviews.map(r => r.id)
  const personIds = [
    ...new Set(reviews.flatMap(r => [r.user_id, r.supervisor_id, r.evaluator_id]).filter(Boolean) as string[]),
  ]

  const [{ data: people }, { data: logs }, { data: sigs }] = await Promise.all([
    db.from('profiles').select(PERSON_COLS).in('id', personIds),
    db.from('intro_review_reminders').select('review_id, kind').in('review_id', reviewIds),
    db.from('intro_review_signatures').select('*').in('review_id', reviewIds),
  ])

  const byId = new Map((people ?? []).map(p => [p.id as string, p as unknown as PersonLite]))
  const sent = new Map<string, Set<string>>()
  for (const l of logs ?? []) {
    const set = sent.get(l.review_id as string) ?? new Set<string>()
    set.add(l.kind as string)
    sent.set(l.review_id as string, set)
  }
  const sigsByReview = new Map<string, SignatureRow[]>()
  for (const s of (sigs ?? []) as unknown as SignatureRow[]) {
    sigsByReview.set(s.review_id, [...(sigsByReview.get(s.review_id) ?? []), s])
  }

  const now = new Date()
  let count = 0

  for (const r of reviews) {
    const reviewee = byId.get(r.user_id)
    if (!reviewee) continue
    const supervisor = r.supervisor_id ? byId.get(r.supervisor_id) ?? null : null
    const evaluator = r.evaluator_id ? byId.get(r.evaluator_id) ?? null : null
    const bundle: Bundle = { review: r, reviewee, supervisor, evaluator, signatures: sigsByReview.get(r.id) ?? [] }
    const mgrs = [supervisor, evaluator].filter(Boolean) as PersonLite[]
    const done = sent.get(r.id) ?? new Set<string>()
    const link = reviewLink(r.id)
    const label = `${r.review_day}-day review for ${reviewee.full_name}`
    const due = daysUntil(r.due_date)
    const dueText = fmtDateOnly(r.due_date)

    const mark = async (kind: string) => {
      await db.from('intro_review_reminders').upsert({ review_id: r.id, kind }, { onConflict: 'review_id,kind' })
      done.add(kind)
    }
    const once = async (kind: string, fn: () => Promise<void>) => {
      if (done.has(kind)) return
      await fn()
      await mark(kind)
      count++
    }

    const open = r.status === 'awaiting_self' || r.status === 'awaiting_evaluator'

    // ── Getting the call on the calendar ──
    if (open && !r.call_at) {
      const hasSlots = (r.slots ?? []).length > 0
      if (hasSlots && r.slots_proposed_at && now.getTime() - new Date(r.slots_proposed_at).getTime() > 24 * 3600 * 1000) {
        await once('pick_slot', () =>
          notifyMany(db, [reviewee], () => ({
            type: 'review_reminder',
            title: `Please pick a time for your ${r.review_day}-day review`,
            text: `Your supervisor proposed times for your ${r.review_day}-day review, but none has been confirmed yet. It's due ${dueText}.`,
            link,
          }))
        )
      }
      if (!hasSlots && due <= 7) {
        await once('schedule_prompt', () =>
          notifyMany(db, mgrs, () => ({
            type: 'review_reminder',
            title: `Schedule the ${label}`,
            text: `The ${label} is due ${dueText} and no call is booked yet. Propose times in the portal.`,
            link,
          }))
        )
      }
      if (due <= 2) {
        await once('schedule_overdue_hr', () =>
          notifyHr(db, {
            type: 'review_reminder',
            title: `Review not scheduled: ${reviewee.full_name} (${r.review_day}-day)`,
            text: `The ${label} is due ${dueText} and still has no confirmed call.`,
            link,
          })
        )
      }
    }

    // ── Self-review deadline (24h before the call) ──
    if (r.status === 'awaiting_self' && r.call_at) {
      const deadline = selfReviewDeadline(r.call_at)!
      const hours = (deadline.getTime() - now.getTime()) / 3600000
      if (hours <= 0) {
        await once('self_missed', () =>
          notifyMany(db, [reviewee, ...mgrs], p => ({
            type: 'review_reminder',
            title: `Self-review not submitted — ${reviewee.full_name} (${r.review_day}-day)`,
            text:
              p.id === reviewee.id
                ? `Your self-review for the ${r.review_day}-day review was due ${fmtInTz(deadline, p.timezone)}. Please submit it as soon as you can.`
                : `${reviewee.full_name}'s self-review was due ${fmtInTz(deadline, p.timezone)} and hasn't been submitted. You can wait for it, reschedule the call, or proceed without it.`,
            link,
          }))
        )
      } else if (hours <= 24) {
        if (!done.has('self_24h')) {
          await once('self_24h', () =>
            notifyMany(db, [reviewee], p => ({
              type: 'review_reminder',
              title: `Self-review due soon — ${r.review_day}-day review`,
              text: `Your self-review is due by ${fmtInTz(deadline, p.timezone)} (24 hours before your call). Please complete it in the portal.`,
              link,
            }))
          )
          await mark('self_48h')
        }
      } else if (hours <= 48 && !done.has('self_24h')) {
        await once('self_48h', () =>
          notifyMany(db, [reviewee], p => ({
            type: 'review_reminder',
            title: `Self-review coming up — ${r.review_day}-day review`,
            text: `Your self-review is due by ${fmtInTz(deadline, p.timezone)} (24 hours before your call).`,
            link,
          }))
        )
      }
    }

    // ── Call happened but the evaluation hasn't been filled in ──
    if (open && r.call_at && now.getTime() - new Date(r.call_at).getTime() > 24 * 3600 * 1000) {
      await once('evaluate_nudge', () =>
        notifyMany(db, mgrs, () => ({
          type: 'review_reminder',
          title: `Complete the evaluation — ${reviewee.full_name} (${r.review_day}-day)`,
          text: `The ${label} call has taken place. Please complete your evaluation so everyone can sign.`,
          link,
        }))
      )
    }

    // ── Waiting on signatures ──
    if (r.status === 'awaiting_signatures' && r.evaluator_submitted_at) {
      const ageDays = (now.getTime() - new Date(r.evaluator_submitted_at).getTime()) / 86400000
      const signedRoles = bundle.signatures.map(s => s.role)
      const missing = requiredSignerRoles(r).filter((role: SignerRole) => !signedRoles.includes(role))
      const roleToPerson = (role: SignerRole) =>
        role === 'reviewee' ? reviewee : role === 'supervisor' ? supervisor : evaluator
      const unsigned = missing.map(roleToPerson).filter(Boolean) as PersonLite[]

      if (ageDays >= 2 && unsigned.length > 0) {
        await once('sign_reminder', () =>
          notifyMany(db, unsigned, () => ({
            type: 'review_reminder',
            title: `Signature needed — ${reviewee.full_name} (${r.review_day}-day)`,
            text: `The ${label} is waiting for your signature.`,
            link,
          }))
        )
      }
      if (ageDays >= 5 && unsigned.length > 0) {
        await once('sign_overdue_hr', () =>
          notifyHr(db, {
            type: 'review_reminder',
            title: `Review awaiting signatures — ${reviewee.full_name} (${r.review_day}-day)`,
            text: `The ${label} has been waiting ${Math.floor(ageDays)} days for: ${unsigned.map(u => u.full_name).join(', ')}.`,
            link,
          })
        )
      }
    }

    // ── Past the due date and still open ──
    if (due < 0) {
      await once('review_overdue_hr', () =>
        notifyHr(db, {
          type: 'review_reminder',
          title: `Review overdue — ${reviewee.full_name} (${r.review_day}-day)`,
          text: `The ${label} was due ${dueText} and is not complete.`,
          link,
        })
      )
    }
  }

  return { sent: count }
}
