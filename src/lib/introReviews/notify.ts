import { sendEmail, notificationEmailHtml, getSender, type EmailAttachment } from '@/lib/email'
import { buildIcs } from './ics'
import { fmtInTz, fmtDateOnly, selfReviewDeadline } from './time'
import { REVIEW_CLOSING_NOTE } from './templates'
import { getHrAdmins, managers, participants, type AdminDb, type Bundle } from './server'
import { RECOMMENDATION_LABELS, type PersonLite, type ReviewAnswers } from './types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ucb-lms-kappa.vercel.app'

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const firstName = (p: PersonLite) => p.full_name.split(' ')[0]
const dayLabel = (b: Bundle) => `${b.review.review_day}-day introductory review`
export const reviewLink = (id: string) => `/reviews/${id}`

// In-app notification + email in one call. The text is plain; it's escaped
// before it goes into the email HTML so names/reasons can't inject markup.
export async function notifyPerson(
  db: AdminDb,
  person: PersonLite,
  opts: { type: string; title: string; text: string; link: string; attachments?: EmailAttachment[] }
) {
  await db.from('notifications').insert({
    user_id: person.id,
    type: opts.type,
    title: opts.title,
    message: opts.text,
    link: opts.link,
  })
  if (person.email) {
    await sendEmail({
      to: person.email,
      subject: opts.title,
      html: notificationEmailHtml({
        fullName: escapeHtml(person.full_name ?? 'there'),
        title: escapeHtml(opts.title),
        message: escapeHtml(opts.text).replace(/\n/g, '<br>'),
        link: `${APP_URL}${opts.link}`,
      }),
      attachments: opts.attachments,
    })
  }
}

export async function notifyMany(
  db: AdminDb,
  people: PersonLite[],
  build: (p: PersonLite) => { type: string; title: string; text: string; link: string; attachments?: EmailAttachment[] }
) {
  const seen = new Set<string>()
  await Promise.all(
    people
      .filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)))
      .map(p => notifyPerson(db, p, build(p)))
  )
}

export async function notifyHr(
  db: AdminDb,
  opts: { type: string; title: string; text: string; link: string },
  excludeIds: string[] = []
) {
  const admins = (await getHrAdmins(db)).filter(a => !excludeIds.includes(a.id))
  await notifyMany(db, admins, () => opts)
}

// "Your time: … / Maria's time: …" — everyone sees the call in their own zone
// plus the other people's, so a Manila/Chicago call is never ambiguous.
export function timeBlock(when: Date, viewer: PersonLite, others: PersonLite[]): string {
  const lines = [`Your time: ${fmtInTz(when, viewer.timezone)}`]
  const seen = new Set([viewer.timezone || 'UTC'])
  for (const o of others) {
    const tz = o.timezone || 'UTC'
    if (seen.has(tz)) continue
    seen.add(tz)
    lines.push(`${firstName(o)}'s time: ${fmtInTz(when, tz)}`)
  }
  return lines.join('\n')
}

const recommendationText = (a: ReviewAnswers | null) => {
  if (!a?.recommendation) return null
  return a.recommendation === 'extend_period' && a.extendDays
    ? `Extend introductory period for another ${a.extendDays} days.`
    : RECOMMENDATION_LABELS[a.recommendation]
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function notifyEnrolled(
  db: AdminDb,
  b: Bundle,
  dueDates: { day: number; date: string }[],
  updated: boolean
) {
  const schedule = dueDates.map(d => `• ${d.day}-day review — due ${fmtDateOnly(d.date)}`).join('\n')
  const intro = updated
    ? `The introductory review schedule for ${b.reviewee.full_name} was updated.`
    : `Introductory reviews have been set up for ${b.reviewee.full_name}.`
  await notifyMany(db, participants(b), p => ({
    type: 'review_enrolled',
    title: updated ? 'Introductory review dates updated' : 'Introductory reviews scheduled',
    text:
      `${intro}\n\n${schedule}\n\n` +
      (p.id === b.reviewee.id
        ? 'Your supervisor will propose a time for each review call. Submit your self-review at least 1 day before each call.'
        : 'Please propose times for each review call in the portal.'),
    link: reviewLink(b.review.id),
  }))
}

export async function notifySlotsProposed(db: AdminDb, b: Bundle, slots: Date[], proposer: string, note?: string) {
  const mgrs = managers(b)
  const lines = slots.map((s, i) => `Option ${i + 1}\n${timeBlock(s, b.reviewee, mgrs)}`).join('\n\n')
  await notifyPerson(db, b.reviewee, {
    type: 'review_slots',
    title: `Pick a time for your ${b.review.review_day}-day review`,
    text:
      `${proposer} proposed ${slots.length === 1 ? 'a time' : 'times'} for your ${dayLabel(b)}:\n\n${lines}` +
      (note ? `\n\nNote: ${note}` : '') +
      '\n\nOpen the portal to confirm the one that works for you.',
    link: reviewLink(b.review.id),
  })
}

export async function notifySlotsDeclined(db: AdminDb, b: Bundle, note?: string) {
  await notifyMany(db, managers(b), () => ({
    type: 'review_slots_declined',
    title: `${b.reviewee.full_name} needs different times`,
    text:
      `${b.reviewee.full_name} can't make any of the proposed times for the ${dayLabel(b)}.` +
      (note ? `\n\nNote: ${note}` : '') +
      '\n\nPlease propose new times in the portal.',
    link: reviewLink(b.review.id),
  }))
}

function makeIcs(b: Bundle, method: 'REQUEST' | 'CANCEL', start: Date, sequence: number) {
  const sender = getSender()
  const all = participants(b)
  return buildIcs({
    uid: `${b.review.id}@ucb-training-portal`,
    sequence,
    method,
    start,
    durationMin: b.review.call_duration_min,
    summary: `${b.review.review_day}-Day Introductory Review — ${b.reviewee.full_name}`,
    description:
      `Introductory review (${b.review.review_day}-day) for ${b.reviewee.full_name}.\n` +
      `Self-review is due 24 hours before the call.\n` +
      `Open in the portal: ${APP_URL}${reviewLink(b.review.id)}`,
    location: b.review.call_link,
    url: `${APP_URL}${reviewLink(b.review.id)}`,
    organizerEmail: sender.email,
    organizerName: sender.name,
    attendees: all.filter(p => p.email).map(p => ({ email: p.email, name: p.full_name })),
  })
}

const icsAttachment = (ics: string, method: 'REQUEST' | 'CANCEL'): EmailAttachment => ({
  filename: 'invite.ics',
  content: Buffer.from(ics, 'utf-8'),
  contentType: `text/calendar; method=${method}; charset=UTF-8`,
})

export async function notifyCallScheduled(db: AdminDb, b: Bundle, when: Date, previous: Date | null) {
  const ics = icsAttachment(makeIcs(b, 'REQUEST', when, b.review.call_sequence), 'REQUEST')
  const deadline = selfReviewDeadline(when.toISOString())
  await notifyMany(db, participants(b), p => {
    const others = participants(b).filter(o => o.id !== p.id)
    const isReviewee = p.id === b.reviewee.id
    return {
      type: 'review_scheduled',
      title: previous
        ? `Review call moved — ${b.reviewee.full_name} (${b.review.review_day}-day)`
        : `Review call scheduled — ${b.reviewee.full_name} (${b.review.review_day}-day)`,
      text:
        (previous ? `The ${dayLabel(b)} call was moved from ${fmtInTz(previous, p.timezone)}.\n\n` : '') +
        `${timeBlock(when, p, others)}\n` +
        `Length: ${b.review.call_duration_min} minutes` +
        (b.review.call_link ? `\nJoin link: ${b.review.call_link}` : '') +
        '\n\n' +
        (isReviewee
          ? `Your self-review is due by ${fmtInTz(deadline!, p.timezone)} (24 hours before the call).`
          : `${b.reviewee.full_name}'s self-review is due by ${fmtInTz(deadline!, p.timezone)}, so you can read it before the call.`) +
        '\n\nA calendar invite is attached — accepting it adds the call to your Outlook calendar.',
      link: reviewLink(b.review.id),
      attachments: [ics],
    }
  })
}

export async function notifyCallCancelled(db: AdminDb, b: Bundle, was: Date) {
  const ics = icsAttachment(makeIcs(b, 'CANCEL', was, b.review.call_sequence), 'CANCEL')
  await notifyMany(db, participants(b), p => ({
    type: 'review_cancelled',
    title: `Review call cancelled — ${b.reviewee.full_name} (${b.review.review_day}-day)`,
    text: `The ${dayLabel(b)} call that was set for ${fmtInTz(was, p.timezone)} was cancelled. A new time will be proposed in the portal.`,
    link: reviewLink(b.review.id),
    attachments: [ics],
  }))
}

export async function notifySelfSubmitted(db: AdminDb, b: Bundle) {
  await notifyMany(db, managers(b), p => ({
    type: 'review_self_submitted',
    title: `${b.reviewee.full_name} submitted their self-review`,
    text:
      `${b.reviewee.full_name}'s self-review for the ${dayLabel(b)} is ready to read.` +
      (b.review.call_at ? `\n\nCall: ${fmtInTz(new Date(b.review.call_at), p.timezone)}` : ''),
    link: reviewLink(b.review.id),
  }))
}

export async function notifyEvaluated(db: AdminDb, b: Bundle, submitterId: string) {
  const targets = [b.reviewee, ...(b.supervisor && b.supervisor.id !== submitterId ? [b.supervisor] : [])]
  await notifyMany(db, targets, p => ({
    type: 'review_ready_to_sign',
    title: `Your ${b.review.review_day}-day review is ready to sign`,
    text:
      p.id === b.reviewee.id
        ? `${b.reviewee.full_name}'s ${dayLabel(b)} has been completed by the evaluator. Please read it and sign in the portal.`
        : `The ${dayLabel(b)} for ${b.reviewee.full_name} has been completed. Please read it and sign in the portal.`,
    link: reviewLink(b.review.id),
  }))
}

export async function notifySigned(db: AdminDb, b: Bundle, signerName: string, remaining: PersonLite[]) {
  await notifyMany(db, remaining, () => ({
    type: 'review_signed',
    title: `${signerName} signed the ${b.review.review_day}-day review`,
    text: `${signerName} signed the ${dayLabel(b)} for ${b.reviewee.full_name}. Your signature is still needed.`,
    link: reviewLink(b.review.id),
  }))
}

export async function notifyCompleted(db: AdminDb, b: Bundle) {
  const rec = b.review.review_day === 90 ? recommendationText(b.review.evaluator_answers) : null
  const link = reviewLink(b.review.id)
  const hr = await getHrAdmins(db)
  const signers = participants(b)
  const signerIds = new Set(signers.map(s => s.id))

  await notifyMany(db, signers, p => ({
    type: 'review_completed',
    title: `${b.review.review_day}-day review signed and complete`,
    text:
      `The ${dayLabel(b)} for ${b.reviewee.full_name} is fully signed. The signed PDF is available in the portal.` +
      (p.id === b.reviewee.id && b.review.review_day === 90 ? `\n\n${REVIEW_CLOSING_NOTE}` : ''),
    link,
  }))

  await notifyMany(
    db,
    hr.filter(a => !signerIds.has(a.id)),
    () => ({
      type: 'review_completed',
      title: `${b.reviewee.full_name}: ${b.review.review_day}-day review complete`,
      text:
        `The ${dayLabel(b)} for ${b.reviewee.full_name} is fully signed.` +
        (rec ? `\n\nRecommendation: ${rec}` : ''),
      link,
    })
  )
}
