'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COMMON_TIMEZONES, DAY_LABELS, DEFAULT_SCHEDULE, defaultRegionForTimezone, effectiveSchedule } from '@/lib/introReviews/time'
import type { DayKey, HolidayRegion, Profile, WorkSchedule } from '@/types'

export interface ScheduleValues {
  timezone: string
  region: HolidayRegion
  schedule: WorkSchedule
  jobTitle: string
}

const DISPLAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function valuesFromProfile(p?: Partial<Profile> | null): ScheduleValues {
  const timezone = p?.timezone ?? ''
  return {
    timezone,
    region: p?.holiday_region ?? defaultRegionForTimezone(timezone),
    schedule: effectiveSchedule(p?.work_schedule),
    jobTitle: p?.job_title ?? '',
  }
}

// A one-line description for collapsed views: "Central — Chicago · Mon–Fri 9:00–17:00"
export function summarize(v: ScheduleValues): string {
  if (!v.timezone) return 'No timezone set'
  const tz = COMMON_TIMEZONES.find(t => t.value === v.timezone)?.label ?? v.timezone
  const on = DISPLAY_ORDER.filter(d => v.schedule[d])
  if (on.length === 0) return `${tz} · no working days`
  const first = v.schedule[on[0]]!
  const same = on.every(d => v.schedule[d]!.start === first.start && v.schedule[d]!.end === first.end)
  const days = on.map(d => DAY_LABELS[d].slice(0, 3)).join(', ')
  return same ? `${tz} · ${days} ${first.start}–${first.end}` : `${tz} · ${on.length} working days`
}

export async function saveScheduleValues(
  supabase: { from: (t: string) => any },
  personId: string,
  v: ScheduleValues
): Promise<string | null> {
  const { error } = await supabase
    .from('profiles')
    .update({
      timezone: v.timezone || null,
      holiday_region: v.region,
      work_schedule: v.schedule,
      job_title: v.jobTitle.trim() || null,
    })
    .eq('id', personId)
  return error ? error.message : null
}

export function WorkScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleValues
  onChange: (v: ScheduleValues) => void
}) {
  const setDay = (day: DayKey, win: { start: string; end: string } | null) =>
    onChange({ ...value, schedule: { ...value.schedule, [day]: win } })

  const knownTz = COMMON_TIMEZONES.some(t => t.value === value.timezone)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Job title</Label>
          <Input
            value={value.jobTitle}
            onChange={e => onChange({ ...value, jobTitle: e.target.value })}
            placeholder="e.g. Recruiting Coordinator"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Timezone</Label>
          <Select
            value={value.timezone || undefined}
            onValueChange={tz => onChange({ ...value, timezone: tz, region: defaultRegionForTimezone(tz) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose timezone" />
            </SelectTrigger>
            <SelectContent>
              {!knownTz && value.timezone && <SelectItem value={value.timezone}>{value.timezone}</SelectItem>}
              {COMMON_TIMEZONES.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Holiday calendar</Label>
          <Select value={value.region} onValueChange={r => onChange({ ...value, region: r as HolidayRegion })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="PH">Philippines</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Working hours (in their own timezone)</Label>
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
          {DISPLAY_ORDER.map(day => {
            const win = value.schedule[day]
            return (
              <div key={day} className="flex items-center gap-3 px-3 py-2">
                <label className="flex items-center gap-2 w-32 text-sm text-slate-700 cursor-pointer">
                  <Checkbox
                    checked={!!win}
                    onCheckedChange={c =>
                      setDay(day, c === true ? DEFAULT_SCHEDULE.mon ?? { start: '09:00', end: '17:00' } : null)
                    }
                  />
                  {DAY_LABELS[day]}
                </label>
                {win ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={win.start}
                      onChange={e => setDay(day, { ...win, start: e.target.value })}
                      className="h-8 w-32"
                    />
                    <span className="text-slate-400 text-sm">to</span>
                    <Input
                      type="time"
                      value={win.end}
                      onChange={e => setDay(day, { ...win, end: e.target.value })}
                      className="h-8 w-32"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Not working</span>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-400">
          Review calls are only offered inside everyone’s working hours, and never on the holiday calendar’s days off.
        </p>
      </div>
    </div>
  )
}
