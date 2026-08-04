'use client'

import { Plus, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { QuizContent, QuizQuestion, QuestionType } from '@/types'

interface Props {
  content: QuizContent
  onChange: (content: QuizContent) => void
}

function generateQId() {
  return `q_${Math.random().toString(36).slice(2)}`
}

export function QuizBlockEditor({ content, onChange }: Props) {
  const updateQuestion = (id: string, updates: Partial<QuizQuestion>) => {
    onChange({
      ...content,
      questions: content.questions.map(q => q.id === id ? { ...q, ...updates } : q),
    })
  }

  const addQuestion = () => {
    const newQ: QuizQuestion = {
      id: generateQId(),
      type: 'multiple_choice',
      question: '',
      options: ['', '', '', ''],
      correct_index: 0,
      explanation: '',
    }
    onChange({ ...content, questions: [...content.questions, newQ] })
  }

  const removeQuestion = (id: string) => {
    onChange({ ...content, questions: content.questions.filter(q => q.id !== id) })
  }

  const setQuestionType = (id: string, type: QuestionType) => {
    if (type === 'multiple_choice') {
      updateQuestion(id, { type, options: ['', '', '', ''], correct_index: 0 })
    } else {
      updateQuestion(id, { type })
    }
  }

  const updateOption = (qId: string, optIdx: number, value: string) => {
    const q = content.questions.find(q => q.id === qId)
    if (!q) return
    const newOptions = [...q.options]
    newOptions[optIdx] = value
    updateQuestion(qId, { options: newOptions })
  }

  const addOption = (qId: string) => {
    const q = content.questions.find(q => q.id === qId)
    if (!q || q.options.length >= 6) return
    updateQuestion(qId, { options: [...q.options, ''] })
  }

  const removeOption = (qId: string, optIdx: number) => {
    const q = content.questions.find(q => q.id === qId)
    if (!q || q.options.length <= 2) return
    const newOptions = q.options.filter((_, i) => i !== optIdx)
    const newCorrect = q.correct_index >= optIdx
      ? Math.max(0, q.correct_index - 1)
      : q.correct_index
    updateQuestion(qId, { options: newOptions, correct_index: newCorrect })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="space-y-1.5">
          <Label>Passing Score (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={content.passing_score}
            onChange={e => onChange({ ...content, passing_score: Number(e.target.value) })}
            className="w-24"
          />
        </div>
        <div className="self-end text-sm text-slate-500">
          Employees must score at least {content.passing_score}% to pass.
          Long-answer questions aren&apos;t auto-graded — they&apos;re recorded for manual review
          and don&apos;t count toward the score.
        </div>
      </div>

      <div className="space-y-4">
        {content.questions.map((q, qi) => {
          const type: QuestionType = q.type ?? 'multiple_choice'
          return (
            <div key={q.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Label className="text-base">Question {qi + 1}</Label>
                <div className="flex items-center gap-2">
                  <Select value={type} onValueChange={v => setQuestionType(q.id, v as QuestionType)}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="long_answer">Long Answer</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => removeQuestion(q.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <Textarea
                value={q.question}
                onChange={e => updateQuestion(q.id, { question: e.target.value })}
                placeholder="Enter your question here..."
                rows={2}
              />

              {type === 'multiple_choice' ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Answer Options (click the checkmark to mark correct answer)</Label>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuestion(q.id, { correct_index: oi })}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            q.correct_index === oi
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-slate-300 text-slate-300 hover:border-green-400'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <Input
                          value={opt}
                          onChange={e => updateOption(q.id, oi, e.target.value)}
                          placeholder={`Option ${oi + 1}`}
                        />
                        {q.options.length > 2 && (
                          <button
                            onClick={() => removeOption(q.id, oi)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {q.options.length < 6 && (
                      <Button variant="ghost" size="sm" onClick={() => addOption(q.id)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-600">Explanation (shown after answering)</Label>
                    <Input
                      value={q.explanation ?? ''}
                      onChange={e => updateQuestion(q.id, { explanation: e.target.value })}
                      placeholder="Why is this the correct answer? (optional)"
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  Employees will answer this in a free-text box. It&apos;s recorded for you to review manually
                  in Reports — it isn&apos;t auto-graded or scored.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <Button variant="outline" onClick={addQuestion}>
        <Plus className="h-4 w-4 mr-2" />
        Add Question
      </Button>
    </div>
  )
}
