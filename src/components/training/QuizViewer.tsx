'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, HelpCircle, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ContentBlock, QuizContent } from '@/types'

interface Props {
  block: ContentBlock
  userId: string
  onPass: () => void
}

export function QuizViewer({ block, userId, onPass }: Props) {
  const content = block.content as QuizContent
  const [answers, setAnswers] = useState<Record<number, number | string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const mcQuestions = content.questions.filter(q => (q.type ?? 'multiple_choice') === 'multiple_choice')
  const totalQ = content.questions.length
  const allAnswered = content.questions.every((q, qi) => {
    const a = answers[qi]
    return (q.type ?? 'multiple_choice') === 'long_answer'
      ? typeof a === 'string' && a.trim().length > 0
      : a !== undefined
  })
  const answeredQ = content.questions.filter((q, qi) => {
    const a = answers[qi]
    return (q.type ?? 'multiple_choice') === 'long_answer'
      ? typeof a === 'string' && a.trim().length > 0
      : a !== undefined
  }).length

  const handleSelect = (qi: number, oi: number) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qi]: oi }))
  }

  const handleTextChange = (qi: number, value: string) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qi]: value }))
  }

  const handleSubmit = async () => {
    if (!allAnswered) { toast.error('Please answer all questions'); return }
    setSaving(true)

    const correctCount = content.questions.reduce((acc, q, qi) => {
      if ((q.type ?? 'multiple_choice') !== 'multiple_choice') return acc
      return acc + (answers[qi] === q.correct_index ? 1 : 0)
    }, 0)
    // Long-answer-only quizzes have nothing to auto-grade — treat as passed once submitted.
    const scorePercent = mcQuestions.length > 0
      ? Math.round((correctCount / mcQuestions.length) * 100)
      : 100

    const answerArray = content.questions.map((_, qi) => answers[qi])

    await supabase.from('quiz_attempts').insert({
      user_id: userId,
      content_block_id: block.id,
      score: correctCount,
      max_score: mcQuestions.length,
      answers: answerArray,
    })

    setScore(scorePercent)
    setSubmitted(true)
    setSaving(false)

    if (scorePercent >= content.passing_score) {
      toast.success(mcQuestions.length > 0 ? `Quiz passed with ${scorePercent}%!` : 'Answers submitted!')
      onPass()
    } else {
      toast.error(`Score: ${scorePercent}%. Need ${content.passing_score}% to pass.`)
    }
  }

  const handleRetry = () => {
    setAnswers({})
    setSubmitted(false)
    setScore(0)
  }

  const passed = submitted && score >= content.passing_score

  return (
    <div className="rounded-xl border-2 border-blue-100 bg-blue-50/30 p-6 space-y-6">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-slate-900">Knowledge Check</h3>
        <span className="text-sm text-slate-500">Passing score: {content.passing_score}%</span>
      </div>

      {submitted && (
        <div className={cn(
          'rounded-xl p-4 flex items-center gap-3',
          passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        )}>
          {passed
            ? <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
            : <XCircle className="h-6 w-6 text-red-600 shrink-0" />
          }
          <div>
            <p className={cn('font-semibold', passed ? 'text-green-700' : 'text-red-700')}>
              {passed ? `Passed! Score: ${score}%` : `Not passed. Score: ${score}%`}
            </p>
            <p className="text-sm text-slate-500">
              {passed
                ? 'Great work! You can now complete this section.'
                : `You need ${content.passing_score}% to pass. Review the material and try again.`}
            </p>
          </div>
          {!passed && (
            <Button variant="outline" size="sm" onClick={handleRetry} className="ml-auto shrink-0">
              Retry
            </Button>
          )}
        </div>
      )}

      {content.questions.map((q, qi) => {
        const isLongAnswer = (q.type ?? 'multiple_choice') === 'long_answer'
        const selected = answers[qi]
        const isCorrect = submitted && !isLongAnswer && selected === q.correct_index
        const isWrong = submitted && !isLongAnswer && selected !== undefined && selected !== q.correct_index

        if (isLongAnswer) {
          return (
            <div key={q.id} className="space-y-3">
              <p className="font-medium text-slate-900">
                {qi + 1}. {q.question}
              </p>
              <Textarea
                value={typeof selected === 'string' ? selected : ''}
                onChange={e => handleTextChange(qi, e.target.value)}
                disabled={submitted}
                placeholder="Type your answer here..."
                rows={4}
              />
              {submitted && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>Submitted for manual review — this doesn&apos;t affect your score.</span>
                </div>
              )}
            </div>
          )
        }

        return (
          <div key={q.id} className="space-y-3">
            <p className="font-medium text-slate-900">
              {qi + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isSelected = selected === oi
                const isCorrectOpt = oi === q.correct_index

                return (
                  <button
                    key={oi}
                    onClick={() => handleSelect(qi, oi)}
                    disabled={submitted}
                    className={cn(
                      'w-full text-left rounded-lg border-2 px-4 py-3 text-sm transition-all',
                      'flex items-center gap-3',
                      !submitted && !isSelected && 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50',
                      !submitted && isSelected && 'border-blue-500 bg-blue-50 text-blue-900',
                      submitted && isSelected && isCorrect && 'border-green-500 bg-green-50 text-green-900',
                      submitted && isSelected && isWrong && 'border-red-500 bg-red-50 text-red-900',
                      submitted && !isSelected && isCorrectOpt && 'border-green-300 bg-green-50/50 text-green-800',
                      submitted && !isSelected && !isCorrectOpt && 'border-slate-200 bg-white text-slate-400',
                    )}
                  >
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                      !submitted && isSelected ? 'border-blue-500 bg-blue-500 text-white' : '',
                      !submitted && !isSelected ? 'border-slate-300 text-slate-400' : '',
                      submitted && isSelected && isCorrect ? 'border-green-500 bg-green-500 text-white' : '',
                      submitted && isSelected && isWrong ? 'border-red-500 bg-red-500 text-white' : '',
                      submitted && !isSelected && isCorrectOpt ? 'border-green-500 text-green-600' : '',
                    )}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {submitted && isSelected && isCorrect && <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />}
                    {submitted && isSelected && isWrong && <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                  </button>
                )
              })}
            </div>
            {submitted && q.explanation && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                <span className="font-medium">Explanation: </span>{q.explanation}
              </div>
            )}
          </div>
        )
      })}

      {!submitted && (
        <Button
          onClick={handleSubmit}
          loading={saving}
          disabled={!allAnswered}
          className="w-full"
        >
          Submit Answers ({answeredQ}/{totalQ})
        </Button>
      )}
    </div>
  )
}
