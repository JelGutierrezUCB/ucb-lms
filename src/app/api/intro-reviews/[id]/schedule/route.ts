import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  canManageReview,
  getAuthedUser,
  isInvolved,
  loadBundle,
  loadHolidaySets,
  resetCallReminders,
  type AdminDb,
  type Bundle,
} from '@/lib/introReviews/server'
import { checkSlot } from '@/lib/introReviews/scheduling'
import {
  notifyCallCancelled,
  notifyCallScheduled,
  notifyHr,
  notifySlotsDeclined,
  notifySlotsProposed,
  reviewLink,
} from '@/lib/introReviews/notify'
import { fmtInTz } from '@/lib/introReviews/time'

export const dynamic = 'force-dynamic'

type Body =
  | { action: 'propose'; slots: string[]; callLink?: string; note?: string; lateReason?: string; override?: boolean }
  | { action: 'set'; slot: string; callLink?: string; lateReason?: string; override?: boolean }
  | { action: 'confirm'; slot: string }
  | { action: 'decline'; note?: string }
  | { action: 'cancel' }

const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status })

const validLink = (v: unknown): string | null | undefined => {
  if (v === undefined) return undefined
  if (typeof v !== 'string' || !v.trim()) return null
  const t = v.trim()
  return /^https?:\/\/\S+$/i.test(t) && t.length <= 500 ? t : undefined
}

// Writes the confirmed call time and sends the (re)schedule invite to everyone.
async function applyCall(db: AdminDb, b: Bundle, when: Date, callLink: string | null | undefined) {
  const previous = b.review.call_at ? new Date(b.review.call_at) : null
  const sequence = previous ? b.review.call_sequence + 1 : b.review.call_sequence
  await db
    .from('intro_reviews')
    .update({
      call_at: when.toISOString(),
      call_sequence: sequence,
      slots: [],
      slots_proposed_at: null,
      slots_note: null,
      ...(callLink !== undefined ? { call_link: callLink } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', b.review.id)
  await resetCallReminders(db, b.review.id)
  const fresh = await loadBundle(db, b.review.id)
  if (fresh) await notifyCallScheduled(db, fresh, when, previous)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthedUser()
  if (!user) return fail('Unauthorized', 401)

  const body = (await req.json()) as Body
  const db = createAdminClient()
  const b = await loadBundle(db, id)
  if (!b) return fail('Review not found', 404)
  if (!isInvolved(user, b.review)) return fail('Forbidden', 403)

  if (b.review.status === 'completed' || b.review.status === 'cancelled') {
    return fail('This review is closed.', 409)
  }
  if (b.review.status === 'awaiting_signatures') {
    return fail('The call has already happened and the review is waiting for signatures.', 409)
  }

  const manage = canManageReview(user, b.review)
  const isReviewee = user.id === b.review.user_id
  const holidays = await loadHolidaySets(db)

  // ── Manager proposes 1–3 times ──
  if (body.action === 'propose') {
    if (!manage) return fail('Only the supervisor or HR can propose times', 403)
    const slots = Array.isArray(body.slots) ? body.slots.slice(0, 3) : []
    if (slots.length === 0) return fail('Add at least one time')
    const override = user.role === 'admin' && !!body.override

    const problems: string[] = []
    let anyLate = false
    for (let i = 0; i < slots.length; i++) {
      const check = await checkSlot(db, b, slots[i], { override, holidays })
      check.problems.forEach(p => problems.push(slots.length > 1 ? `Option ${i + 1}: ${p}` : p))
      anyLate = anyLate || check.late
    }
    if (problems.length > 0) return fail(problems.join(' '), 400, { problems })

    const reason = typeof body.lateReason === 'string' ? body.lateReason.trim() : ''
    if (anyLate && reason.length < 5) {
      return fail('These times fall after the review’s due date. Add a reason so HR knows why.', 400, {
        code: 'LATE_REASON_REQUIRED',
      })
    }

    const link = validLink(body.callLink)
    if (body.callLink && link === undefined) return fail('The meeting link must start with http:// or https://')

    await db
      .from('intro_reviews')
      .update({
        slots: slots.map(s => new Date(s).toISOString()),
        slots_proposed_at: new Date().toISOString(),
        slots_note: body.note?.toString().trim().slice(0, 500) || null,
        ...(link !== undefined ? { call_link: link } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    await resetCallReminders(db, id)

    if (anyLate) {
      await notifyHr(
        db,
        {
          type: 'review_late',
          title: `Review scheduled after due date — ${b.reviewee.full_name} (${b.review.review_day}-day)`,
          text: `${user.full_name} proposed times after the due date (${b.review.due_date}).\nReason: ${reason}`,
          link: reviewLink(id),
        },
        [user.id]
      )
    }
    await notifySlotsProposed(db, b, slots.map(s => new Date(s)), user.full_name, body.note?.toString().trim())
    return NextResponse.json({ ok: true })
  }

  // ── Manager sets the time directly (already agreed on chat) ──
  if (body.action === 'set') {
    if (!manage) return fail('Only the supervisor or HR can set the time', 403)
    const override = user.role === 'admin' && !!body.override
    const check = await checkSlot(db, b, body.slot, { override, holidays })
    if (check.problems.length > 0) return fail(check.problems.join(' '), 400, { problems: check.problems })

    const reason = typeof body.lateReason === 'string' ? body.lateReason.trim() : ''
    if (check.late && reason.length < 5) {
      return fail('That time falls after the review’s due date. Add a reason so HR knows why.', 400, {
        code: 'LATE_REASON_REQUIRED',
      })
    }
    const link = validLink(body.callLink)
    if (body.callLink && link === undefined) return fail('The meeting link must start with http:// or https://')

    if (check.late) {
      await notifyHr(
        db,
        {
          type: 'review_late',
          title: `Review scheduled after due date — ${b.reviewee.full_name} (${b.review.review_day}-day)`,
          text: `${user.full_name} scheduled the call for ${fmtInTz(new Date(body.slot), b.reviewee.timezone)} (${b.reviewee.full_name}'s time), after the due date (${b.review.due_date}).\nReason: ${reason}`,
          link: reviewLink(id),
        },
        [user.id]
      )
    }
    await applyCall(db, b, new Date(body.slot), link)
    return NextResponse.json({ ok: true })
  }

  // ── Employee picks one of the proposed times ──
  if (body.action === 'confirm') {
    if (!isReviewee) return fail('Only the employee can confirm a proposed time', 403)
    const pick = new Date(body.slot)
    const allowed = (b.review.slots ?? []).some(s => new Date(s).getTime() === pick.getTime())
    if (!allowed) return fail('That time is no longer one of the proposed options. Refresh and try again.', 409)
    // Hours/holidays were validated when proposed; re-check only for new conflicts
    const check = await checkSlot(db, b, body.slot, { override: true, holidays })
    if (check.problems.length > 0) {
      return fail(`${check.problems.join(' ')} Ask your supervisor for another time.`, 409, { problems: check.problems })
    }
    await applyCall(db, b, pick, undefined)
    return NextResponse.json({ ok: true })
  }

  // ── Employee: none of these work ──
  if (body.action === 'decline') {
    if (!isReviewee) return fail('Only the employee can ask for different times', 403)
    await db
      .from('intro_reviews')
      .update({ slots: [], slots_proposed_at: null, slots_note: null, updated_at: new Date().toISOString() })
      .eq('id', id)
    await resetCallReminders(db, id)
    await notifySlotsDeclined(db, b, body.note?.toString().trim().slice(0, 500))
    return NextResponse.json({ ok: true })
  }

  // ── Cancel the booked call (removes it from everyone's calendar) ──
  if (body.action === 'cancel') {
    if (!manage) return fail('Only the supervisor or HR can cancel the call', 403)
    if (!b.review.call_at) return fail('There is no booked call to cancel', 409)
    const was = new Date(b.review.call_at)
    await db
      .from('intro_reviews')
      .update({
        call_at: null,
        slots: [],
        slots_proposed_at: null,
        call_sequence: b.review.call_sequence + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    await resetCallReminders(db, id)
    const fresh = await loadBundle(db, id)
    if (fresh) await notifyCallCancelled(db, fresh, was)
    return NextResponse.json({ ok: true })
  }

  return fail('Unknown action')
}
