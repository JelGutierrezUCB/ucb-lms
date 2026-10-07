import { fmtInTz, localYmd, withinSchedule } from './time'
import { participants, type AdminDb, type Bundle } from './server'

export interface SlotCheck {
  problems: string[]
  late: boolean // the call would land after the review's due date
}

// Everything that can go wrong with a proposed call time, checked server-side
// so it holds no matter how the request was made:
//  • in the past / too soon
//  • outside anyone's working hours, or on anyone's holiday (each in their own timezone)
//  • double-booking anyone already on another review call at that time
// `override` (admins only) skips the hours/holiday checks, never the conflict check.
export async function checkSlot(
  db: AdminDb,
  b: Bundle,
  slotIso: string,
  opts: { override: boolean; holidays: Record<string, Set<string>> }
): Promise<SlotCheck> {
  const problems: string[] = []
  const start = new Date(slotIso)
  if (isNaN(start.getTime())) return { problems: ['That time is not valid.'], late: false }

  if (start.getTime() < Date.now() + 30 * 60000) {
    problems.push('That time is in the past, or less than 30 minutes away.')
  }

  const people = participants(b)
  const duration = b.review.call_duration_min

  for (const p of people) {
    if (!p.timezone) {
      if (!opts.override) problems.push(`${p.full_name} has no timezone set yet — set their work schedule first.`)
      continue
    }
    if (opts.override) continue
    const region = p.holiday_region ?? 'US'
    if (opts.holidays[region]?.has(localYmd(start, p.timezone))) {
      problems.push(`${p.full_name} has a holiday on that day (${fmtInTz(start, p.timezone)}).`)
    } else if (!withinSchedule(start, duration, p.work_schedule, p.timezone)) {
      problems.push(`That is outside ${p.full_name}'s working hours (${fmtInTz(start, p.timezone)}).`)
    }
  }

  // Anyone on this call already booked on another review at the same time?
  const end = new Date(start.getTime() + duration * 60000)
  const { data: others } = await db
    .from('intro_reviews')
    .select('id, user_id, supervisor_id, evaluator_id, call_at, call_duration_min')
    .neq('id', b.review.id)
    .in('status', ['awaiting_self', 'awaiting_evaluator', 'awaiting_signatures'])
    .not('call_at', 'is', null)
    .gte('call_at', new Date(start.getTime() - 24 * 3600 * 1000).toISOString())
    .lte('call_at', new Date(start.getTime() + 24 * 3600 * 1000).toISOString())

  for (const o of others ?? []) {
    const oStart = new Date(o.call_at as string)
    const oEnd = new Date(oStart.getTime() + (o.call_duration_min as number) * 60000)
    if (!(start < oEnd && oStart < end)) continue
    const ids = new Set([o.user_id, o.supervisor_id, o.evaluator_id].filter(Boolean) as string[])
    const clash = people.find(p => ids.has(p.id))
    if (clash) problems.push(`${clash.full_name} is already booked on another review call at that time.`)
  }

  const revieweeTz = b.reviewee.timezone || 'UTC'
  const late = localYmd(start, revieweeTz) > b.review.due_date

  return { problems, late }
}
