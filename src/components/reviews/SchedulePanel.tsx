'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarClock, CalendarX, Link2, Plus, Trash2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fmtInTz, selfReviewDeadline, withinSchedule, zonedWallTimeToUtc } from '@/lib/introReviews/time'
import type { PersonLite, ReviewRow } from '@/lib/introReviews/types'

interface Props {
  review: ReviewRow
  reviewee: PersonLite
  supervisor: PersonLite | null
  evaluator: PersonLite | null
  viewer: { id: string; role: string; timezone: string | null; isReviewee: boolean; canManage: boolean }
  // the call can only be (re)scheduled before the evaluation is submitted
  editable: boolean
}

interface Row {
  date: string
  time: string
}

const first = (p: PersonLite) => p.full_name.split(' ')[0]

export function SchedulePanel({ review, reviewee, supervisor, evaluator, viewer, editable }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'propose' | 'set'>('propose')
  const [rows, setRows] = useState<Row[]>([{ date: '', time: '' }])
  const [callLink, setCallLink] = useState(review.call_link ?? '')
  const [note, setNote] = useState('')
  const [lateReason, setLateReason] = useState('')
  const [needLate, setNeedLate] = useState(false)
  const [override, setOverride] = useState(false)
  const [busy, setBusy] = useState(false)
  const [declineNote, setDeclineNote] = useState('')
  const [showForm, setShowForm] = useState(false)

  const people = [reviewee, supervisor, evaluator].filter(
    (p, i, a): p is PersonLite => !!p && a.findIndex(o => o?.id === p.id) === i
  )
  const others = people.filter(p => p.id !== viewer.id)
  const entryTz = viewer.timezone ?? supervisor?.timezone ?? 'UTC'

  const call = review.call_at ? new Date(review.call_at) : null
  const deadline = selfReviewDeadline(review.call_at)
  const slots = (review.slots ?? []).map(s => new Date(s))

  const post = async (body: Record<string, unknown>, okMessage: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/intro-reviews/${review.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.code === 'LATE_REASON_REQUIRED') setNeedLate(true)
        throw new Error(json.error ?? 'Could not save')
      }
      toast.success(okMessage)
      setShowForm(false)
      setRows([{ date: '', time: '' }])
      setNeedLate(false)
      setLateReason('')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const toUtc = (r: Row) => (r.date && r.time ? zonedWallTimeToUtc(r.date, r.time, entryTz) : null)

  const submitForm = () => {
    const valid = rows.map(toUtc).filter(Boolean) as Date[]
    if (valid.length === 0) {
      toast.error('Pick a date and time first.')
      return
    }
    const common = { callLink: callLink.trim() || undefined, lateReason: lateReason.trim() || undefined, override: override || undefined }
    if (mode === 'set') {
      void post({ action: 'set', slot: valid[0].toISOString(), ...common }, 'Call scheduled — invites sent')
    } else {
      void post(
        { action: 'propose', slots: valid.map(d => d.toISOString()), note: note.trim() || undefined, ...common },
        `Sent to ${first(reviewee)} to confirm`
      )
    }
  }

  // Live preview of a typed time: what it is for everyone else, and a heads-up if it's outside their hours
  const preview = (r: Row) => {
    const utc = toUtc(r)
    if (!utc) return null
    const warnings = people
      .filter(p => p.timezone && !withinSchedule(utc, review.call_duration_min, p.work_schedule, p.timezone))
      .map(p => `Outside ${p.id === viewer.id ? 'your' : first(p) + '’s'} working hours`)
    return (
      <div className="text-xs space-y-0.5 mt-1">
        {others.map(p => (
          <p key={p.id} className="text-slate-500">
            {first(p)}: <span className="font-medium text-slate-700">{fmtInTz(utc, p.timezone)}</span>
          </p>
        ))}
        {warnings.map(w => (
          <p key={w} className="text-amber-600">
            ⚠ {w}
          </p>
        ))}
      </div>
    )
  }

  // ── Employee: pick one of the proposed times ──
  const employeePicker = viewer.isReviewee && slots.length > 0 && editable && (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {supervisor ? first(supervisor) : 'Your supervisor'} proposed {slots.length === 1 ? 'a time' : 'these times'}. Pick the one that works:
      </p>
      <div className="space-y-2">
        {slots.map(s => (
          <div key={s.toISOString()} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div className="text-sm">
              <p className="font-medium text-slate-900">{fmtInTz(s, viewer.timezone)}</p>
              {others
                .filter(p => (p.timezone || 'UTC') !== (viewer.timezone || 'UTC'))
                .slice(0, 1)
                .map(p => (
                  <p key={p.id} className="text-xs text-slate-500">
                    {first(p)}: {fmtInTz(s, p.timezone)}
                  </p>
                ))}
            </div>
            <Button size="sm" loading={busy} onClick={() => post({ action: 'confirm', slot: s.toISOString() }, 'Call confirmed — invite sent')}>
              Confirm this time
            </Button>
          </div>
        ))}
      </div>
      {review.slots_note && <p className="text-xs text-slate-500">Note from your supervisor: {review.slots_note}</p>}
      <div className="rounded-lg bg-slate-50 p-3 space-y-2">
        <Label className="text-xs">None of these work?</Label>
        <Textarea rows={2} value={declineNote} onChange={e => setDeclineNote(e.target.value)} placeholder="Optional: tell them when you’re available" />
        <Button variant="outline" size="sm" loading={busy} onClick={() => post({ action: 'decline', note: declineNote.trim() || undefined }, 'Asked for different times')}>
          Ask for different times
        </Button>
      </div>
    </div>
  )

  const managerForm = viewer.canManage && editable && showForm && (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <div className="flex gap-2 rounded-lg bg-slate-100 p-1 w-fit">
        {(
          [
            ['propose', 'Propose times'],
            ['set', 'Set a time directly'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {mode === 'propose'
          ? `Offer 1–3 times — ${first(reviewee)} picks one and everyone gets a calendar invite.`
          : `Use this when the time is already agreed — it’s booked immediately and invites go out.`}{' '}
        Times you enter are in <strong>{entryTz}</strong>.
      </p>

      <div className="space-y-3">
        {(mode === 'set' ? rows.slice(0, 1) : rows).map((r, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <Input type="date" value={r.date} onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="w-44" />
              <Input type="time" value={r.time} onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} className="w-32" />
              {mode === 'propose' && rows.length > 1 && (
                <button type="button" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" aria-label="Remove time">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {preview(r)}
          </div>
        ))}
        {mode === 'propose' && rows.length < 3 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setRows(rs => [...rs, { date: '', time: '' }])}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add another option
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <Video className="h-3.5 w-3.5" /> Meeting link (optional — Teams, Zoom…)
        </Label>
        <Input value={callLink} onChange={e => setCallLink(e.target.value)} placeholder="https://teams.microsoft.com/…" />
      </div>
      {mode === 'propose' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Note to {first(reviewee)} (optional)</Label>
          <Input value={note} onChange={e => setNote(e.target.value)} />
        </div>
      )}

      {needLate && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <Label className="text-xs text-amber-800">This is after the review’s due date — why? (HR will be told)</Label>
          <Textarea rows={2} value={lateReason} onChange={e => setLateReason(e.target.value)} />
        </div>
      )}

      {viewer.role === 'admin' && (
        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
          <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} />
          Admin: ignore working hours and holidays
        </label>
      )}

      <div className="flex gap-2">
        <Button onClick={submitForm} loading={busy}>
          {mode === 'propose' ? 'Send proposed times' : 'Book the call'}
        </Button>
        <Button variant="outline" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-blue-600" /> Review call
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {call ? (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-green-900">Scheduled</p>
            <div className="text-sm text-green-900 space-y-0.5">
              <p>
                Your time: <strong>{fmtInTz(call, viewer.timezone)}</strong>
              </p>
              {others
                .filter(p => (p.timezone || 'UTC') !== (viewer.timezone || 'UTC'))
                .filter((p, i, a) => a.findIndex(o => (o.timezone || 'UTC') === (p.timezone || 'UTC')) === i)
                .map(p => (
                  <p key={p.id}>
                    {first(p)}’s time: <strong>{fmtInTz(call, p.timezone)}</strong>
                  </p>
                ))}
            </div>
            <p className="text-xs text-green-800">{review.call_duration_min} minutes</p>
            {review.call_link && (
              <a href={review.call_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
                <Link2 className="h-4 w-4" /> Join the call
              </a>
            )}
            {deadline && review.status === 'awaiting_self' && (
              <p className="text-xs text-green-800 border-t border-green-200 pt-2">
                Self-review due by <strong>{fmtInTz(deadline, viewer.timezone)}</strong> (24 hours before the call).
              </p>
            )}
          </div>
        ) : slots.length > 0 && !viewer.isReviewee ? (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-1.5">
            <p className="text-sm font-semibold text-blue-900">Waiting for {first(reviewee)} to pick a time</p>
            {slots.map(s => (
              <p key={s.toISOString()} className="text-sm text-blue-900">
                • {fmtInTz(s, viewer.timezone)}
              </p>
            ))}
          </div>
        ) : !employeePicker ? (
          <p className="text-sm text-slate-500">
            {viewer.isReviewee ? 'Your supervisor will propose a time for this review call.' : 'No call is booked yet.'}
          </p>
        ) : null}

        {employeePicker}
        {managerForm}

        {viewer.canManage && editable && !showForm && (
          <div className="flex flex-wrap gap-2">
            <Button variant={call || slots.length ? 'outline' : 'primary'} onClick={() => setShowForm(true)}>
              <CalendarClock className="h-4 w-4 mr-1.5" />
              {call ? 'Reschedule' : slots.length ? 'Propose different times' : 'Schedule the call'}
            </Button>
            {call && (
              <Button
                variant="outline"
                loading={busy}
                onClick={() => {
                  if (window.confirm('Cancel this call? It will be removed from everyone’s calendar.')) {
                    void post({ action: 'cancel' }, 'Call cancelled')
                  }
                }}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <CalendarX className="h-4 w-4 mr-1.5" /> Cancel call
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
