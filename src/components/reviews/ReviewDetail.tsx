'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Clock, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { requiredSignerRoles, signerRolesFor, statusInfo } from '@/lib/introReviews/actions'
import { fmtDateOnly } from '@/lib/introReviews/time'
import type { PersonLite, ReviewAnswers, ReviewRow, SignatureRow } from '@/lib/introReviews/types'
import { ReviewDocument } from './ReviewDocument'
import { ReviewForm } from './ReviewForm'
import { SchedulePanel } from './SchedulePanel'
import { SignaturePanel } from './SignaturePanel'

interface Props {
  review: ReviewRow
  reviewee: PersonLite
  supervisor: PersonLite | null
  evaluator: PersonLite | null
  signatures: SignatureRow[]
  viewer: { id: string; role: string; fullName: string; timezone: string | null; isReviewee: boolean; canManage: boolean }
  draftSelf: ReviewAnswers | null
  draftEvaluator: ReviewAnswers | null
  firstDay: string | null
}

export function ReviewDetail({ review, reviewee, supervisor, evaluator, signatures, viewer, draftSelf, draftEvaluator, firstDay }: Props) {
  const router = useRouter()
  const info = statusInfo(review)
  const status = review.status
  const tpl = review.template_snapshot

  const signedRoles = signatures.map(s => s.role)
  const requiredRoles = requiredSignerRoles(review)
  const myUnsigned = signerRolesFor(review, viewer.id).filter(r => !signedRoles.includes(r))
  const refresh = () => router.refresh()

  const editableCall = status === 'awaiting_self' || status === 'awaiting_evaluator'

  const steps = [
    { label: 'Call scheduled', done: !!review.call_at || status === 'awaiting_signatures' || status === 'completed' },
    { label: 'Self-review', done: !!review.self_submitted_at },
    { label: 'Evaluation', done: !!review.evaluator_submitted_at },
    { label: 'Signatures', done: status === 'completed' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/reviews" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> All reviews
      </Link>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-green-700 font-semibold">Introductory review</p>
              <h1 className="text-2xl font-bold text-slate-900">
                {review.review_day}-day review — {reviewee.full_name}
              </h1>
              <p className="text-sm text-slate-500">{reviewee.job_title ?? ''}</p>
            </div>
            <Badge variant={info.variant}>{info.overdue ? `Overdue · ${info.label}` : info.label}</Badge>
          </div>

          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-xs text-slate-400">First Day</dt>
              <dd className="font-medium text-slate-800">{firstDay ? fmtDateOnly(firstDay) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Due</dt>
              <dd className={`font-medium ${info.overdue ? 'text-red-600' : 'text-slate-800'}`}>{fmtDateOnly(review.due_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Supervisor</dt>
              <dd className="font-medium text-slate-800">{supervisor?.full_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Evaluator</dt>
              <dd className="font-medium text-slate-800">{evaluator?.full_name ?? '—'}</dd>
            </div>
          </dl>

          <ol className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            {steps.map(s => (
              <li key={s.label} className={`flex items-center gap-1.5 text-sm ${s.done ? 'text-green-700' : 'text-slate-400'}`}>
                {s.done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                {s.label}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {status === 'cancelled' && (
        <Card>
          <CardContent className="p-5 text-sm text-slate-500">This review was cancelled.</CardContent>
        </Card>
      )}

      {(editableCall || review.call_at) && status !== 'cancelled' && (
        <SchedulePanel
          review={review}
          reviewee={reviewee}
          supervisor={supervisor}
          evaluator={evaluator}
          viewer={viewer}
          editable={editableCall}
        />
      )}

      {/* ── Employee fills in their self-review ── */}
      {status === 'awaiting_self' && viewer.isReviewee && (
        <ReviewForm
          key="self"
          reviewId={review.id}
          mode="self"
          template={tpl}
          initial={draftSelf}
          revieweeName={reviewee.full_name}
          onSubmitted={refresh}
        />
      )}

      {/* ── Evaluator (can start before the self-review arrives) ── */}
      {(status === 'awaiting_evaluator' || status === 'awaiting_self') && viewer.canManage && !viewer.isReviewee && (
        <ReviewForm
          key="evaluator"
          reviewId={review.id}
          mode="evaluator"
          template={tpl}
          initial={draftEvaluator}
          revieweeName={reviewee.full_name}
          selfAnswers={review.self_answers}
          selfMissing={status === 'awaiting_self'}
          onSubmitted={refresh}
        />
      )}

      {status === 'awaiting_evaluator' && viewer.isReviewee && (
        <>
          <Card>
            <CardContent className="p-5 flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Your self-review is submitted</p>
                <p className="text-sm text-slate-500">
                  Your supervisor will complete their evaluation after the call, and then you’ll be asked to sign.
                </p>
              </div>
            </CardContent>
          </Card>
          <ReviewDocument template={tpl} self={review.self_answers} evaluator={null} revieweeName={reviewee.full_name} showEvaluator={false} />
        </>
      )}

      {/* HR looking at a review they aren't part of */}
      {(status === 'awaiting_self' || status === 'awaiting_evaluator') && !viewer.isReviewee && !viewer.canManage && (
        <Card>
          <CardContent className="p-5 text-sm text-slate-500">This review is still in progress.</CardContent>
        </Card>
      )}

      {/* ── Locked: everyone reads and signs exactly this ── */}
      {(status === 'awaiting_signatures' || status === 'completed') && (
        <>
          <ReviewDocument template={tpl} self={review.self_answers} evaluator={review.evaluator_answers} revieweeName={reviewee.full_name} />
          <SignaturePanel
            review={review}
            reviewee={reviewee}
            supervisor={supervisor}
            evaluator={evaluator}
            signatures={signatures}
            requiredRoles={requiredRoles}
            myUnsignedRoles={myUnsigned}
            viewerIsReviewee={viewer.isReviewee}
            viewerFullName={viewer.fullName}
          />
        </>
      )}
    </div>
  )
}
