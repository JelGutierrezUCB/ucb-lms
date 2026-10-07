'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RatingChip } from './RatingScale'
import {
  RECOMMENDATION_LABELS,
  type Recommendation,
  type ReviewAnswers,
  type TemplateSnapshot,
} from '@/lib/introReviews/types'

// Read-only rendering of a review: both people's ratings side by side, the
// answers, narrative and (90-day) recommendation.
export function ReviewDocument({
  template,
  self,
  evaluator,
  revieweeName,
  showEvaluator = true,
}: {
  template: TemplateSnapshot
  self: ReviewAnswers | null
  evaluator: ReviewAnswers | null
  revieweeName: string
  showEvaluator?: boolean
}) {
  const first = revieweeName.split(' ')[0]
  const groups: { key: 'core' | 'rprs'; title: string }[] = [
    { key: 'core', title: 'UCBE Core Values' },
    { key: 'rprs', title: 'Right Person, Right Seat (RPRS)' },
  ]
  const evalQs = template.questions.filter(q => q.audience === 'evaluator')
  const selfQs = template.questions.filter(q => q.audience === 'reviewee')

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Ratings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {groups.map(g => (
            <div key={g.key} className="space-y-2">
              <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide">{g.title}</h3>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {template.ratingItems
                  .filter(i => i.group === g.key)
                  .map(item => (
                    <div key={item.id} className="p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <p className="flex-1 font-medium text-slate-900 text-sm">{item.label}</p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          {first}: <RatingChip value={self?.ratings?.[item.id]} />
                        </span>
                        {showEvaluator && (
                          <span className="flex items-center gap-1.5">
                            Evaluator: <RatingChip value={evaluator?.ratings?.[item.id]} />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          {!self && <p className="text-sm text-slate-400">The self-review was not submitted.</p>}
        </CardContent>
      </Card>

      {showEvaluator && evalQs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluator questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {evalQs.map(q => (
              <div key={q.id}>
                <p className="font-medium text-slate-800">{q.text}</p>
                <p className="text-slate-600 whitespace-pre-wrap">{evaluator?.answers?.[q.id] || '—'}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{first}’s comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {selfQs.map(q => (
            <div key={q.id}>
              <p className="font-medium text-slate-800">{q.text}</p>
              <p className="text-slate-600 whitespace-pre-wrap">{self?.answers?.[q.id] || '—'}</p>
            </div>
          ))}
          <p className="text-slate-600 whitespace-pre-wrap">{self?.comments || (self ? '—' : 'Not submitted.')}</p>
        </CardContent>
      </Card>

      {showEvaluator && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluator’s narrative</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-slate-600 whitespace-pre-wrap">{evaluator?.narrative || '—'}</p>
            {template.hasRecommendation && (
              <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                <p className="font-semibold text-slate-900">Recommendation</p>
                {(Object.keys(RECOMMENDATION_LABELS) as Recommendation[]).map(key => {
                  const chosen = evaluator?.recommendation === key
                  const label =
                    key === 'extend_period' && chosen && evaluator?.extendDays
                      ? `Extend introductory period for another ${evaluator.extendDays} days.`
                      : RECOMMENDATION_LABELS[key]
                  return (
                    <p key={key} className={chosen ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                      {chosen ? '☑' : '☐'} {label}
                    </p>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
