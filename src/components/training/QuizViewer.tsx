'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, HelpCircle, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ContentBlock, QuizContent, QuizQuestion } from '@/types'

interface Props {
  block: ContentBlock
  userId: string
  onPass: () => void
}

type Answer = number | string | number[]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Draws the set of questions for one attempt: a random N-of-M subset when the
// quiz is set up as a question bank (incidentally randomizing their order too),
// otherwise the full set, shuffled if the quiz asks for randomized order.
function drawQuestions(content: QuizContent): QuizQuestion[] {
  const draw = content.draw_count
  if (draw && draw > 0 && draw < content.questions.length) {
    return shuffle(content.questions).slice(0, draw)
  }
  if (content.randomize_order) {
    return shuffle(content.questions)
  }
  return content.questions
}

function arraysEqualAsSets(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

export function QuizViewer({ block, userId, onPass }: Props) {
  const content = block.content as QuizContent
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>(() => drawQuestions(content))
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const totalQ = activeQuestions.length
  const isAnswered = (q: QuizQuestion) => {
    const a = answers[q.id]
    const type = q.type ?? 'multiple_choice'
    if (type === 'long_answer') return typeof a === 'string' && a.trim().length > 0
    if (type === 'multiple_answer') return Array.isArray(a) && a.length > 0
    return a !== undefined
  }
  const allAnswered = activeQuestions.every(isAnswered)
  const answeredQ = activeQuestions.filter(isAnswered).length

  const handleSelect = (qId: string, oi: number) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qId]: oi }))
  }

  const handleToggleMulti = (qId: string, oi: number) => {
    if (submitted) return
    setAnswers(prev => {
      const current = Array.isArray(prev[qId]) ? (prev[qId] as number[]) : []
      const next = current.includes(oi) ? current.filter(i => i !== oi) : [...current, oi]
      return { ...prev, [qId]: next }
    })
  }

  const handleTextChange = (qId: string, value: string) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  const isQuestionCorrect = (q: QuizQuestion) => {
    const type = q.type ?? 'multiple_choice'
    const a = answers[q.id]
    if (type === 'long_answer') return typeof a === 'string' && a.trim().length > 0
    if (type === 'multiple_answer') return Array.isArray(a) && arraysEqualAsSets(a, q.correct_indexes ?? [])
    return a === q.correct_index
  }

  const handleSubmit = async () => {
    if (!allAnswered) { toast.error('Please answer all questions'); return }
    setSaving(true)

    const correctCount = activeQuestions.reduce((acc, q) => acc + (isQuestionCorrect(q) ? 1 : 0), 0)
    const maxScore = totalQ
    const scorePercent = maxScore > 0 ? Math.round((correctCount / maxScore) * 100) : 100

    // Stored by question id (not position) so review stays accurate even
    // when the quiz draws a random subset or shuffles order per attempt.
    const answerRecord = activeQuestions.map(q => ({ id: q.id, answer: answers[q.id] }))

    await supabase.from('quiz_attempts').insert({
      user_id: userId,
      content_block_id: block.id,
      score: correctCount,
      max_score: maxScore,
      answers: answerRecord,
    })

    setScore(scorePercent)
    setSubmitted(true)
    setSaving(false)

    if (scorePercent >= content.passing_score) {
      toast.success(`Quiz passed with ${scorePercent}%!`)
      onPass()
    } else {
      toast.error(`Score: ${scorePercent}%. Need ${content.passing_score}% to pass.`)
    }
  }

  const handleRetry = () => {
    setActiveQuestions(drawQuestions(content))
    setAnswers({})
    setSubmitted(false)
    setScore(0)
  }

  const passed = submitted && score >= content.passing_score

  return (
    <div className="rounded-xl border-2 border-blue-100 bg-blue-50/30 p-6 space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <HelpCircle className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-slate-900">Knowledge Check</h3>
        <span className="text-sm text-slate-500">Passing score: {content.passing_score}%</span>
        {content.draw_count && content.draw_count > 0 && content.draw_count < content.questions.length && (
          <span className="text-sm text-slate-400">· {totalQ} of {content.questions.length} questions this attempt</span>
        )}
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
              Retake
            </Button>
          )}
        </div>
      )}

      {activeQuestions.map((q, qi) => {
        const type = q.type ?? 'multiple_choice'
        const isLongAnswer = type === 'long_answer'
        const isMultiAnswer = type === 'multiple_answer'
        const selected = answers[q.id]
        const isCorrect = submitted && !isLongAnswer && isQuestionCorrect(q)
        const isWrong = submitted && !isLongAnswer && isAnswered(q) && !isQuestionCorrect(q)

        if (isLongAnswer) {
          return (
            <div key={q.id} className="space-y-3">
              <p className="font-medium text-slate-900">
                {qi + 1}. {q.question}
              </p>
              {q.image_url && <img src={q.image_url} alt="" className="max-h-64 rounded-lg border border-slate-200" />}
              <Textarea
                value={typeof selected === 'string' ? selected : ''}
                onChange={e => handleTextChange(q.id, e.target.value)}
                disabled={submitted}
                placeholder="Type your answer here..."
                rows={4}
              />
              {submitted && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>Credited automatically for a complete answer — an admin can still review it in Reports.</span>
                </div>
              )}
            </div>
          )
        }

        const selectedIndexes = isMultiAnswer && Array.isArray(selected) ? selected : []

        return (
          <div key={q.id} className="space-y-3">
            <p className="font-medium text-slate-900">
              {qi + 1}. {q.question}
            </p>
            {q.image_url && <img src={q.image_url} alt="" className="max-h-64 rounded-lg border border-slate-200" />}
            {isMultiAnswer && (
              <p className="text-xs text-slate-500">Select all that apply.</p>
            )}
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isSelected = isMultiAnswer ? selectedIndexes.includes(oi) : selected === oi
                const isCorrectOpt = isMultiAnswer ? (q.correct_indexes ?? []).includes(oi) : oi === q.correct_index

                return (
                  <button
                    key={oi}
                    onClick={() => isMultiAnswer ? handleToggleMulti(q.id, oi) : handleSelect(q.id, oi)}
                    disabled={submitted}
                    className={cn(
                      'w-full text-left rounded-lg border-2 px-4 py-3 text-sm transition-all',
                      'flex items-center gap-3',
                      !submitted && !isSelected && 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50',
                      !submitted && isSelected && 'border-blue-500 bg-blue-50 text-blue-900',
                      submitted && isSelected && isCorrectOpt && 'border-green-500 bg-green-50 text-green-900',
                      submitted && isSelected && !isCorrectOpt && 'border-red-500 bg-red-50 text-red-900',
                      submitted && !isSelected && isCorrectOpt && 'border-green-300 bg-green-50/50 text-green-800',
                      submitted && !isSelected && !isCorrectOpt && 'border-slate-200 bg-white text-slate-400',
                    )}
                  >
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold border-2',
                      isMultiAnswer ? 'rounded-md' : 'rounded-full',
                      !submitted && isSelected ? 'border-blue-500 bg-blue-500 text-white' : '',
                      !submitted && !isSelected ? 'border-slate-300 text-slate-400' : '',
                      submitted && isSelected && isCorrectOpt ? 'border-green-500 bg-green-500 text-white' : '',
                      submitted && isSelected && !isCorrectOpt ? 'border-red-500 bg-red-500 text-white' : '',
                      submitted && !isSelected && isCorrectOpt ? 'border-green-500 text-green-600' : '',
                    )}>
                      {isMultiAnswer && isSelected ? <CheckCircle className="h-3.5 w-3.5" /> : String.fromCharCode(65 + oi)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {submitted && isSelected && isCorrectOpt && <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />}
                    {submitted && isSelected && !isCorrectOpt && <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                  </button>
                )
              })}
            </div>
            {submitted && isWrong && isMultiAnswer && (
              <p className="text-xs text-amber-600">You must select every correct option, and only the correct options, to earn credit.</p>
            )}
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
