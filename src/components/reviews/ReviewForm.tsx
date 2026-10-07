'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RatingChip, RatingScale } from './RatingScale'
import {
  RATING_SYMBOLS,
  RECOMMENDATION_LABELS,
  type Recommendation,
  type ReviewAnswers,
  type ReviewRating,
  type TemplateSnapshot,
} from '@/lib/introReviews/types'

interface Props {
  reviewId: string
  mode: 'self' | 'evaluator'
  template: TemplateSnapshot
  initial: ReviewAnswers | null
  revieweeName: string
  // evaluator mode: what the employee submitted (read-only reference)
  selfAnswers?: ReviewAnswers | null
  selfMissing?: boolean
  onSubmitted: () => void
}

const EMPTY: ReviewAnswers = { ratings: {}, answers: {} }

export function ReviewForm({ reviewId, mode, template, initial, revieweeName, selfAnswers, selfMissing, onSubmitted }: Props) {
  const [data, setData] = useState<ReviewAnswers>(initial ?? EMPTY)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const firstRender = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const audience = mode === 'self' ? 'reviewee' : 'evaluator'
  const questions = template.questions.filter(q => q.audience === audience)
  const revieweeQuestions = template.questions.filter(q => q.audience === 'reviewee')

  const saveDraft = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/intro-reviews/${reviewId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: mode === 'self' ? 'reviewee' : 'evaluator', answers: data }),
      })
      if (res.ok) setSavedAt(new Date())
    } finally {
      setSaving(false)
    }
  }

  // Autosave 1.5s after the last change
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void saveDraft()
    }, 1500)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const setRating = (id: string, v: ReviewRating) => setData(d => ({ ...d, ratings: { ...d.ratings, [id]: v } }))
  const setAnswer = (id: string, v: string) => setData(d => ({ ...d, answers: { ...d.answers, [id]: v } }))

  const submit = async () => {
    const proceedWithoutSelf = mode === 'evaluator' && !!selfMissing
    const message =
      mode === 'self'
        ? 'Submit your self-review? Your supervisor will be able to read it, and you won’t be able to change it afterwards.'
        : proceedWithoutSelf
          ? `${revieweeName} hasn’t submitted a self-review. Submit your evaluation without it? You won’t be able to change it afterwards.`
          : 'Submit your evaluation? Everyone will then be asked to sign, and you won’t be able to change it afterwards.'
    if (!window.confirm(message)) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/intro-reviews/${reviewId}/${mode === 'self' ? 'self' : 'evaluate'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: data, proceedWithoutSelf }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not submit')
      toast.success(mode === 'self' ? 'Self-review submitted' : 'Evaluation submitted — signatures requested')
      onSubmitted()
    } catch (err: any) {
      toast.error(err.message ?? 'Could not submit')
    } finally {
      setSubmitting(false)
    }
  }

  const groups: { key: 'core' | 'rprs'; title: string }[] = [
    { key: 'core', title: 'UCBE Core Values' },
    { key: 'rprs', title: 'Right Person, Right Seat (RPRS)' },
  ]

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === 'self' ? 'Your self-review' : `Evaluation of ${revieweeName}`}
          </CardTitle>
          <p className="text-sm text-slate-500">
            {mode === 'self'
              ? 'Rate yourself honestly against each item below. Submit at least 1 day before your review call so your supervisor can read it first.'
              : 'Rate each item, answer the questions, and add your narrative. Read the self-review first if it has been submitted.'}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
            {(['check_plus', 'check', 'x'] as ReviewRating[]).map(r => (
              <span key={r} className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">{RATING_SYMBOLS[r]}</span>
                {r === 'check_plus' ? 'Exhibits it MOST of the time' : r === 'check' ? 'Exhibits it SOME of the time' : 'Does NOT exhibit it'}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {mode === 'evaluator' && selfMissing && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {revieweeName} hasn’t submitted their self-review yet. You can wait for it, or complete your evaluation without it.
            </div>
          )}

          {groups.map(g => (
            <div key={g.key} className="space-y-3">
              <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide">{g.title}</h3>
              {template.ratingItems
                .filter(i => i.group === g.key)
                .map(item => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                      <RatingScale value={data.ratings[item.id]} onChange={v => setRating(item.id, v)} />
                      {mode === 'evaluator' && selfAnswers && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                          {revieweeName.split(' ')[0]} rated: <RatingChip value={selfAnswers.ratings?.[item.id]} />
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {mode === 'evaluator' && selfAnswers && (selfAnswers.comments || revieweeQuestions.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{revieweeName.split(' ')[0]}’s answers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {revieweeQuestions.map(q => (
              <div key={q.id}>
                <p className="font-medium text-slate-800">{q.text}</p>
                <p className="text-slate-600 whitespace-pre-wrap">{selfAnswers.answers?.[q.id] || '—'}</p>
              </div>
            ))}
            <div>
              <p className="font-medium text-slate-800">Reviewee’s comments</p>
              <p className="text-slate-600 whitespace-pre-wrap">{selfAnswers.comments || '—'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{mode === 'self' ? 'A few questions' : 'Questions'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="space-y-1.5">
              <p className="text-sm font-medium text-slate-800">
                {i + 1}. {q.text}
                {q.hint && <span className="ml-2 text-xs font-normal text-slate-400">({q.hint})</span>}
              </p>
              <Textarea rows={3} value={data.answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)} placeholder="Type your answer…" />
            </div>
          ))}

          {mode === 'self' ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-800">Your comments (optional)</p>
              <Textarea
                rows={4}
                value={data.comments ?? ''}
                onChange={e => setData(d => ({ ...d, comments: e.target.value }))}
                placeholder="Anything you’d like your supervisor to know — what’s going well, where you need support…"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-800">Evaluator’s narrative</p>
              <Textarea
                rows={5}
                value={data.narrative ?? ''}
                onChange={e => setData(d => ({ ...d, narrative: e.target.value }))}
                placeholder="Overall summary of how the introductory period is going…"
              />
            </div>
          )}

          {mode === 'evaluator' && template.hasRecommendation && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">Recommendation</p>
              {(Object.keys(RECOMMENDATION_LABELS) as Recommendation[]).map(key => (
                <label key={key} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="recommendation"
                    className="mt-1"
                    checked={data.recommendation === key}
                    onChange={() => setData(d => ({ ...d, recommendation: key }))}
                  />
                  <span className="flex items-center gap-2 flex-wrap">
                    {key === 'extend_period' ? 'Extend introductory period for another' : RECOMMENDATION_LABELS[key]}
                    {key === 'extend_period' && (
                      <>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          className="h-8 w-20"
                          value={data.extendDays ?? ''}
                          onChange={e => setData(d => ({ ...d, recommendation: 'extend_period', extendDays: Number(e.target.value) || undefined }))}
                        />
                        days
                      </>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving draft…
            </>
          ) : savedAt ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Draft saved {savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </>
          ) : (
            'Your progress is saved automatically as you type.'
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void saveDraft()} disabled={saving || submitting}>
            Save draft
          </Button>
          <Button onClick={submit} loading={submitting}>
            {mode === 'self' ? 'Submit self-review' : selfMissing ? 'Submit without self-review' : 'Submit evaluation'}
          </Button>
        </div>
      </div>
    </div>
  )
}
