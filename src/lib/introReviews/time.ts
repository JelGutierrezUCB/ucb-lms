import type { DayKey, HolidayRegion, WorkSchedule } from '@/types'

// ── Work schedules ───────────────────────────────────────────────────────────
export const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const DAY_LABELS: Record<DayKey, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
}

export const DEFAULT_SCHEDULE: WorkSchedule = {
  mon: { start: '09:00', end: '17:00' },
  tue: { start: '09:00', end: '17:00' },
  wed: { start: '09:00', end: '17:00' },
  thu: { start: '09:00', end: '17:00' },
  fri: { start: '09:00', end: '17:00' },
  sat: null,
  sun: null,
}

export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern — New York' },
  { value: 'America/Chicago', label: 'Central — Chicago' },
  { value: 'America/Denver', label: 'Mountain — Denver' },
  { value: 'America/Phoenix', label: 'Arizona — Phoenix' },
  { value: 'America/Los_Angeles', label: 'Pacific — Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska — Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii — Honolulu' },
  { value: 'Asia/Manila', label: 'Philippines — Manila' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Tokyo', label: 'Japan — Tokyo' },
  { value: 'Europe/London', label: 'United Kingdom — London' },
  { value: 'Australia/Sydney', label: 'Australia — Sydney' },
  { value: 'UTC', label: 'UTC' },
]

export function defaultRegionForTimezone(tz: string | null | undefined): HolidayRegion {
  return tz === 'Asia/Manila' ? 'PH' : 'US'
}

export function effectiveSchedule(s: WorkSchedule | null | undefined): WorkSchedule {
  return s && Object.keys(s).length > 0 ? s : DEFAULT_SCHEDULE
}

// ── Calendar-date helpers (YYYY-MM-DD strings, no timezone involved) ─────────
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function daysUntil(dateYmd: string, fromYmd: string = ymd(new Date())): number {
  return Math.round((parseYmd(dateYmd).getTime() - parseYmd(fromYmd).getTime()) / 86400000)
}

export function isBusinessDay(d: Date, holidays: Set<string>): boolean {
  const dow = d.getUTCDay()
  return dow !== 0 && dow !== 6 && !holidays.has(ymd(d))
}

// The Nth business day counting the First Day as day 1 (if the First Day
// isn't itself a business day, day 1 is the next one).
export function nthBusinessDay(firstDay: string, n: number, holidays: Set<string>): string {
  let d = parseYmd(firstDay)
  let count = 0
  for (let i = 0; i < 2000; i++) {
    if (isBusinessDay(d, holidays)) {
      count++
      if (count === n) return ymd(d)
    }
    d = new Date(d.getTime() + 86400000)
  }
  throw new Error('Could not compute business day')
}

// ── Timezone helpers (all instants are UTC; zones only matter for display + hours) ──
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function zonedParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  } as Intl.DateTimeFormatOptions)
  const parts: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  }
}

export function localYmd(date: Date, tz: string): string {
  const p = zonedParts(date, tz)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

// "2026-10-06" + "09:00" as wall-clock time in `tz` → the UTC instant
export function zonedWallTimeToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const target = Date.UTC(y, m - 1, d, hh, mm)
  let utc = target
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(utc), tz)
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
    utc -= shown - target
  }
  return new Date(utc)
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Does a call starting at `start` fit entirely inside the person's working hours?
export function withinSchedule(
  start: Date,
  durationMin: number,
  schedule: WorkSchedule | null | undefined,
  tz: string
): boolean {
  const sched = effectiveSchedule(schedule)
  const s = zonedParts(start, tz)
  const e = zonedParts(new Date(start.getTime() + durationMin * 60000), tz)
  if (s.year !== e.year || s.month !== e.month || s.day !== e.day) return false // crosses midnight
  const win = sched[DAY_KEYS[s.weekday]]
  if (!win) return false
  return s.hour * 60 + s.minute >= toMinutes(win.start) && e.hour * 60 + e.minute <= toMinutes(win.end)
}

export function fmtInTz(date: Date, tz: string | null | undefined): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

// Same instant, shown once per distinct timezone: "Tue, Oct 6, 9:00 AM CDT / Tue, Oct 6, 10:00 PM GMT+8"
export function fmtMany(date: Date, tzs: (string | null | undefined)[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tz of tzs) {
    const key = tz || 'UTC'
    if (seen.has(key)) continue
    seen.add(key)
    out.push(fmtInTz(date, key))
  }
  return out.join(' / ')
}

export function fmtDateOnly(dateYmd: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(
    parseYmd(dateYmd)
  )
}

// The employee's self-review is due 24 hours before the call starts.
export function selfReviewDeadline(callAt: string | null): Date | null {
  return callAt ? new Date(new Date(callAt).getTime() - 24 * 3600 * 1000) : null
}
