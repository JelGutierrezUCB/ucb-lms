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

export function QuizAnswersDialog({ attemptId, employeeName, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizContent['questions']>([])
  const [answers, setAnswers] = useState<Record<number, number | string>>({})
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
        setQuestions(content.questions ?? [])
        const answerArray = (attempt.answers ?? []) as (number | string)[]
        setAnswers(Object.fromEntries(answerArray.map((a, i) => [i, a])))
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
            {questions.map((q, qi) => {
              const isLongAnswer = (q.type ?? 'multiple_choice') === 'long_answer'
              const given = answers[qi]

              if (isLongAnswer) {
                return (
                  <div key={q.id} className="space-y-2">
                    <p className="font-medium text-slate-900 text-sm">{qi + 1}. {q.question}</p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">
                        {typeof given === 'string' && given.trim() ? given : <em className="text-slate-400">No answer given</em>}
                      </span>
                    </div>
                  </div>
                )
              }

              const isCorrect = given === q.correct_index
              return (
                <div key={q.id} className="space-y-2">
                  <p className="font-medium text-slate-900 text-sm">{qi + 1}. {q.question}</p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const wasGiven = given === oi
                      const isCorrectOpt = oi === q.correct_index
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
                          {wasGiven && (isCorrect ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />)}
                          <span>{opt}</span>
                          {!wasGiven && isCorrectOpt && <span className="text-xs ml-auto shrink-0">(correct answer)</span>}
                        </div>
                      )
                    })}
                    {given === undefined && <p className="text-xs text-slate-400">No answer given</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
