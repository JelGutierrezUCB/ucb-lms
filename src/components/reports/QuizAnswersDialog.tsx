'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, XCircle, MessageSquare } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate } from '@/lib/utils'
import type { QuizContent } from '@/types'

interface Props {
  attemptId: string | null
  employeeName: string
  onOpenChange: (open: boolean) => void
}

type StoredAnswer = number | string | number[]

function arraysEqualAsSets(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

// Newer attempts store [{ id, answer }, ...] (id-keyed, so review stays
// correct even when the quiz draws a random subset or shuffles order).
// Older attempts stored a plain positional array — zip it against the
// question list in its stored order, which is always correct for those
// since randomization didn't exist yet when they were taken.
function normalizeAnswers(raw: unknown, questions: QuizContent['questions']): Map<string, StoredAnswer> {
  const map = new Map<string, StoredAnswer>()
  if (!Array.isArray(raw)) return map
  const looksIdKeyed = raw.length > 0 && typeof raw[0] === 'object' && raw[0] !== null && 'id' in (raw[0] as any)
  if (looksIdKeyed) {
    for (const entry of raw as { id: string; answer: StoredAnswer }[]) {
      if (entry.answer !== undefined) map.set(entry.id, entry.answer)
    }
  } else {
    (raw as StoredAnswer[]).forEach((a, i) => {
      if (a !== undefined && questions[i]) map.set(questions[i].id, a)
    })
  }
  return map
}

export function QuizAnswersDialog({ attemptId, employeeName, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizContent['questions']>([])
  const [answers, setAnswers] = useState<Map<string, StoredAnswer>>(new Map())
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const [attemptDate, setAttemptDate] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!attemptId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: attempt, error: attemptErr } = await supabase
          .from('quiz_attempts')
          .select('answers, completed_at, content_block_id')
          .eq('id', attemptId)
          .single()
        if (cancelled) return
        if (attemptErr || !attempt) { setError('Could not load this attempt'); return }

        const { data: block, error: blockErr } = await supabase
          .from('content_blocks')
          .select('content')
          .eq('id', attempt.content_block_id)
          .single()
        if (cancelled) return
        if (blockErr || !block) { setError('Could not load the quiz questions'); return }

        const content = block.content as QuizContent
        const qs = content.questions ?? []
        setQuestions(qs)
        const raw = attempt.answers as unknown
        setAnswers(normalizeAnswers(raw, qs))
        // Which questions were actually shown in this attempt — distinct from
        // "shown but left blank", relevant once a quiz can draw a random subset.
        const rawArray = Array.isArray(raw) ? raw : []
        const looksIdKeyed = rawArray.length > 0 && typeof rawArray[0] === 'object' && rawArray[0] !== null && 'id' in (rawArray[0] as any)
        setAnswered(looksIdKeyed
          ? new Set((rawArray as { id: string }[]).map(e => e.id))
          : new Set(qs.slice(0, rawArray.length).map(q => q.id)))
        setAttemptDate(attempt.completed_at)
      } catch {
        if (!cancelled) setError('Could not load this attempt')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [attemptId])

  return (
    <Dialog open={!!attemptId} onOpenChange={open => !open && onOpenChange(false)}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Quiz Answers</DialogTitle>
          <DialogDescription>
            <strong>{employeeName}</strong>{attemptDate ? ` — submitted ${formatDate(attemptDate)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-8 text-slate-400 text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-8 text-red-500 text-sm">{error}</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {questions.filter(q => answered.has(q.id)).map((q, qi) => {
              const type = q.type ?? 'multiple_choice'
              const isLongAnswer = type === 'long_answer'
              const isMultiAnswer = type === 'multiple_answer'
              const given = answers.get(q.id)

              if (isLongAnswer) {
                return (
                  <div key={q.id} className="space-y-2">
                    <p className="font-medium text-slate-900 text-sm">{qi + 1}. {q.question}</p>
                    {q.image_url && <img src={q.image_url} alt="" className="max-h-56 rounded-lg border border-slate-200" />}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">
                        {typeof given === 'string' && given.trim() ? given : <em className="text-slate-400">No answer given</em>}
                      </span>
                    </div>
                  </div>
                )
              }

              const givenIndexes = isMultiAnswer && Array.isArray(given) ? given : []
              const isCorrect = isMultiAnswer
                ? Array.isArray(given) && arraysEqualAsSets(given, q.correct_indexes ?? [])
                : given === q.correct_index

              return (
                <div key={q.id} className="space-y-2">
                  <p className="font-medium text-slate-900 text-sm">{qi + 1}. {q.question}</p>
                  {q.image_url && <img src={q.image_url} alt="" className="max-h-56 rounded-lg border border-slate-200" />}
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const wasGiven = isMultiAnswer ? givenIndexes.includes(oi) : given === oi
                      const isCorrectOpt = isMultiAnswer ? (q.correct_indexes ?? []).includes(oi) : oi === q.correct_index
                      return (
                        <div
                          key={oi}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                            wasGiven && isCorrectOpt && 'border-green-400 bg-green-50 text-green-900',
                            wasGiven && !isCorrectOpt && 'border-red-400 bg-red-50 text-red-900',
                            !wasGiven && isCorrectOpt && 'border-green-200 bg-green-50/50 text-green-700',
                            !wasGiven && !isCorrectOpt && 'border-slate-200 text-slate-500',
                          )}
                        >
                          {wasGiven && (isCorrectOpt ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />)}
                          <span>{opt}</span>
                          {!wasGiven && isCorrectOpt && <span className="text-xs ml-auto shrink-0">(correct answer)</span>}
                        </div>
                      )
                    })}
                    {(isMultiAnswer ? givenIndexes.length === 0 : given === undefined) && (
                      <p className="text-xs text-slate-400">No answer given</p>
                    )}
                    {isMultiAnswer && givenIndexes.length > 0 && !isCorrect && (
                      <p className="text-xs text-amber-600">Not fully correct — every correct option (and only those) must be selected.</p>
                    )}
                  </div>
                </div>
              )
            })}
            {questions.some(q => !answered.has(q.id)) && (
              <p className="text-xs text-slate-400">
                {questions.filter(q => !answered.has(q.id)).length} other question{questions.filter(q => !answered.has(q.id)).length !== 1 ? 's' : ''} in this quiz weren&apos;t drawn for this attempt.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
