'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, ClipboardCheck, Plus, Search, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { reviewAction, statusInfo } from '@/lib/introReviews/actions'
import { fmtDateOnly, fmtInTz } from '@/lib/introReviews/time'
import type { ReviewLite, SignerRole } from '@/lib/introReviews/types'
import { StartReviewsDialog } from './StartReviewsDialog'

export interface OverviewReview extends ReviewLite {
  reviewee_name: string
  supervisor_name: string | null
  evaluator_name: string | null
  signedRoles: SignerRole[]
}

type Filter = 'open' | 'action' | 'overdue' | 'completed' | 'all'

export function ReviewsOverview({
  viewerId,
  viewerRole,
  viewerTz,
  reviews,
}: {
  viewerId: string
  viewerRole: string
  viewerTz: string | null
  reviews: OverviewReview[]
}) {
  const [startOpen, setStartOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('open')
  const [search, setSearch] = useState('')

  const isAdmin = viewerRole === 'admin'
  const mine = reviews.filter(r => r.user_id === viewerId && r.status !== 'cancelled').sort((a, b) => a.review_day - b.review_day)
  const team = reviews.filter(r => r.user_id !== viewerId && r.status !== 'cancelled')

  const rows = useMemo(() => {
    return team
      .map(r => ({ r, action: reviewAction(r, r.signedRoles, viewerId), info: statusInfo(r) }))
      .filter(({ r, action, info }) => {
        if (search && !r.reviewee_name.toLowerCase().includes(search.toLowerCase())) return false
        if (filter === 'open') return r.status !== 'completed'
        if (filter === 'action') return !!action
        if (filter === 'overdue') return info.overdue
        if (filter === 'completed') return r.status === 'completed'
        return true
      })
      .sort((a, b) => {
        const done = Number(a.r.status === 'completed') - Number(b.r.status === 'completed')
        return done || a.r.due_date.localeCompare(b.r.due_date) || a.r.review_day - b.r.review_day
      })
  }, [team, filter, search, viewerId])

  const stats = useMemo(() => {
    const open = team.filter(r => r.status !== 'completed')
    return {
      needAction: team.filter(r => reviewAction(r, r.signedRoles, viewerId)).length,
      overdue: open.filter(r => statusInfo(r).overdue).length,
      unscheduled: open.filter(r => !r.call_at && (r.slots ?? []).length === 0 && r.status !== 'awaiting_signatures').length,
    }
  }, [team, viewerId])

  const callText = (r: ReviewLite) => (r.call_at ? fmtInTz(new Date(r.call_at), viewerTz) : '—')

  return (
    <div className="space-y-8">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setStartOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Start reviews for an employee
          </Button>
          <Link href="/reviews/settings">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-1.5" /> Holidays &amp; settings
            </Button>
          </Link>
        </div>
      )}

      {/* My own reviews */}
      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">My introductory reviews</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {mine.map(r => {
              const info = statusInfo(r)
              const action = reviewAction(r, r.signedRoles, viewerId)
              return (
                <Link key={r.id} href={`/reviews/${r.id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{r.review_day}-day</p>
                          <p className="text-xs text-slate-400">Due {fmtDateOnly(r.due_date)}</p>
                        </div>
                        <Badge variant={info.variant}>{info.overdue ? `Overdue · ${info.label}` : info.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {r.call_at ? callText(r) : 'No call booked yet'}
                      </p>
                      {action && (
                        <p className="text-sm font-medium text-blue-700 bg-blue-50 rounded-md px-2.5 py-1.5">{action} →</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Reviews I run (or all, for HR) */}
      {(team.length > 0 || isAdmin) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">{isAdmin ? 'All introductory reviews' : 'Team reviews'}</h2>

          <div className="grid grid-cols-3 gap-3 max-w-xl">
            {[
              { label: 'Need your action', value: stats.needAction, color: 'text-blue-600' },
              { label: 'Overdue', value: stats.overdue, color: 'text-red-600' },
              { label: 'Not scheduled', value: stats.unscheduled, color: 'text-amber-600' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-3">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open reviews</SelectItem>
                <SelectItem value="action">Needs my action</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="all">Everything</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Review</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Due</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Call (your time)</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Next step</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        <ClipboardCheck className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        Nothing here.{isAdmin ? ' Use “Start reviews for an employee” to set one up.' : ''}
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ r, action, info }) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{r.reviewee_name}</p>
                          <p className="text-xs text-slate-400">
                            Supervisor: {r.supervisor_name ?? '—'}
                            {r.evaluator_id && r.evaluator_id !== r.supervisor_id ? ` · Evaluator: ${r.evaluator_name ?? '—'}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.review_day}-day</td>
                        <td className={`px-4 py-3 ${info.overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                          {fmtDateOnly(r.due_date)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{callText(r)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={info.variant}>{info.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {action ? <span className="text-blue-700 font-medium">{action}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/reviews/${r.id}`} className="text-blue-600 hover:underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {mine.length === 0 && team.length === 0 && !isAdmin && (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            You don’t have any introductory reviews.
          </CardContent>
        </Card>
      )}

      {isAdmin && <StartReviewsDialog open={startOpen} onOpenChange={setStartOpen} />}
    </div>
  )
}
