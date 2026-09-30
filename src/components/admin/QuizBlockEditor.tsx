'use client'

import { useRef, useState } from 'react'
import { Plus, Trash2, Check, ImagePlus, X, Loader2, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { QuizContent, QuizQuestion, QuestionType } from '@/types'

interface Props {
  content: QuizContent
  onChange: (content: QuizContent) => void
}

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  multiple_answer: 'Select All That Apply',
  true_false: 'True / False',
  long_answer: 'Long Answer',
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
      updateQuestion(id, { type, options: ['', '', '', ''], correct_index: 0, correct_indexes: undefined })
    } else if (type === 'true_false') {
      updateQuestion(id, { type, options: ['True', 'False'], correct_index: 0, correct_indexes: undefined })
    } else if (type === 'multiple_answer') {
      updateQuestion(id, { type, options: ['', '', '', ''], correct_indexes: [] })
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
    const newCorrectIndexes = (q.correct_indexes ?? [])
      .filter(i => i !== optIdx)
      .map(i => i > optIdx ? i - 1 : i)
    updateQuestion(qId, { options: newOptions, correct_index: newCorrect, correct_indexes: newCorrectIndexes })
  }

  const toggleCorrectAnswer = (qId: string, optIdx: number) => {
    const q = content.questions.find(q => q.id === qId)
    if (!q) return
    const current = q.correct_indexes ?? []
    const next = current.includes(optIdx) ? current.filter(i => i !== optIdx) : [...current, optIdx].sort()
    updateQuestion(qId, { correct_indexes: next })
  }

  const maxDraw = content.questions.length
  const bankActive = (content.draw_count ?? 0) > 0 && (content.draw_count ?? 0) < maxDraw

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-6">
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

        <div className="space-y-1.5">
          <Label>Draw per attempt</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={maxDraw}
              placeholder="All"
              value={content.draw_count ?? ''}
              onChange={e => {
                const v = e.target.value === '' ? null : Math.max(0, Math.min(maxDraw, Number(e.target.value)))
                onChange({ ...content, draw_count: v })
              }}
              className="w-24"
            />
            <span className="text-xs text-slate-400">of {maxDraw} question{maxDraw !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 pb-1.5 cursor-pointer">
          <Checkbox
            checked={content.randomize_order ?? false}
            onCheckedChange={v => onChange({ ...content, randomize_order: v === true })}
          />
          <Shuffle className="h-3.5 w-3.5 text-slate-400" /> Randomize order
        </label>
      </div>

      <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        Employees must score at least {content.passing_score}% to pass.
        {bankActive
          ? ` Each attempt draws ${content.draw_count} random question${content.draw_count !== 1 ? 's' : ''} from the ${maxDraw} below${content.randomize_order ? ', in random order' : ''}.`
          : content.randomize_order ? ' Questions are shown in random order each attempt.' : ''}
        {' '}Long-answer questions aren&apos;t auto-graded — they&apos;re recorded for manual review and don&apos;t count toward the score.
      </p>

      <div className="space-y-4">
        {content.questions.map((q, qi) => {
          const type: QuestionType = q.type ?? 'multiple_choice'
          return (
            <div key={q.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Label className="text-base">Question {qi + 1}</Label>
                <div className="flex items-center gap-2">
                  <Select value={type} onValueChange={v => setQuestionType(q.id, v as QuestionType)}>
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(TYPE_LABELS) as [QuestionType, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
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

              <QuestionImage question={q} onChange={updates => updateQuestion(q.id, updates)} />

              {type === 'true_false' && (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Correct answer</Label>
                  <div className="flex gap-2">
                    {['True', 'False'].map((label, oi) => (
                      <button
                        key={label}
                        onClick={() => updateQuestion(q.id, { correct_index: oi })}
                        className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                          q.correct_index === oi
                            ? 'border-green-500 bg-green-50 text-green-900'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {q.correct_index === oi && <Check className="h-4 w-4" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(type === 'multiple_choice' || type === 'multiple_answer') && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">
                      {type === 'multiple_answer'
                        ? 'Answer options (check every correct one — employees must select all of them, and only them)'
                        : 'Answer Options (click the checkmark to mark correct answer)'}
                    </Label>
                    {q.options.map((opt, oi) => {
                      const isCorrect = type === 'multiple_answer'
                        ? (q.correct_indexes ?? []).includes(oi)
                        : q.correct_index === oi
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <button
                            onClick={() => type === 'multiple_answer' ? toggleCorrectAnswer(q.id, oi) : updateQuestion(q.id, { correct_index: oi })}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 transition-colors ${
                              type === 'multiple_answer' ? 'rounded-md' : 'rounded-full'
                            } ${
                              isCorrect
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
                      )
                    })}
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
              )}

              {type === 'long_answer' && (
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

// ---------------------------------------------------------------------------

function QuestionImage({ question, onChange }: { question: QuizQuestion; onChange: (updates: Partial<QuizQuestion>) => void }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('training-images').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('training-images').getPublicUrl(path)
      onChange({ image_url: data.publicUrl })
    } catch (err: any) {
      toast.error(err.message ?? 'Image upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (question.image_url) {
    return (
      <div className="relative inline-block">
        <img src={question.image_url} alt="" className="max-h-40 rounded-lg border border-slate-200" />
        <button
          type="button"
          onClick={() => onChange({ image_url: null })}
          className="absolute -top-2 -right-2 rounded-full bg-white border border-slate-200 p-1 text-slate-500 hover:text-red-600 shadow-sm"
          aria-label="Remove image"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 mr-1.5" />}
        {uploading ? 'Uploading…' : 'Add image (optional)'}
      </Button>
    </div>
  )
}
