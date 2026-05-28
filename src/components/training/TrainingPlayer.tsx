'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Circle, ChevronRight, ChevronLeft, Trophy, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { TextViewer } from './TextViewer'
import { VideoViewer } from './VideoViewer'
import { QuizViewer } from './QuizViewer'
import { cn, getCategoryColor, getCategoryLabel } from '@/lib/utils'
import type { Module, ContentBlock, QuizContent } from '@/types'
import { useProxy } from '@/contexts/ProxyContext'

interface SectionWithBlocks {
  id: string
  title: string
  order_index: number
  content_blocks: ContentBlock[]
  is_completed: boolean
}

interface Props {
  module: Module
  sections: SectionWithBlocks[]
  userId: string
}

export function TrainingPlayer({ module, sections, userId }: Props) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [completedSections, setCompletedSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.is_completed).map(s => s.id))
  )
  const [quizPassed, setQuizPassed] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const { effectiveUserId } = useProxy()
  const supabase = createClient()
  const router = useRouter()

  const activeUserId = effectiveUserId ?? userId
  const currentSection = sections[currentSectionIndex]
  const totalSections = sections.length
  const completedCount = completedSections.size
  const progressPercent = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0
  const isLastSection = currentSectionIndex === totalSections - 1
  const isAllComplete = completedCount === totalSections

  const hasQuiz = currentSection?.content_blocks.some(b => b.type === 'quiz')
  const quizBlockId = currentSection?.content_blocks.find(b => b.type === 'quiz')?.id
  const canComplete = !hasQuiz || (quizBlockId ? quizPassed.has(quizBlockId) : true)

  const markSectionComplete = async () => {
    if (!currentSection || completedSections.has(currentSection.id)) {
      goNext()
      return
    }
    if (!canComplete) {
      toast.error('Please pass the quiz before completing this section')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('section_progress')
      .upsert({ user_id: activeUserId, section_id: currentSection.id }, { onConflict: 'user_id,section_id' })

    if (error) { toast.error('Failed to save progress'); setSaving(false); return }

    setCompletedSections(prev => new Set([...prev, currentSection.id]))
    setSaving(false)

    if (isLastSection) {
      toast.success('Training complete! Great job!')
    } else {
      goNext()
    }
  }

  const goNext = () => {
    if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex(i => i + 1)
      window.scrollTo(0, 0)
    }
  }

  const goPrev = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(i => i - 1)
      window.scrollTo(0, 0)
    }
  }

  if (totalSections === 0) {
    return (
      <div className="flex items-center justify-center h-full p-12 text-center">
        <div>
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No content yet</p>
          <p className="text-slate-400 text-sm">This module has no sections yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar: section list */}
      <div className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ backgroundColor: getCategoryColor(module.category) }}
            >
              {module.title.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm truncate">{module.title}</p>
              <p className="text-xs text-slate-400">{getCategoryLabel(module.category)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{completedCount} of {totalSections} sections</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress
              value={progressPercent}
              indicatorClassName={progressPercent === 100 ? 'bg-green-500' : undefined}
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {sections.map((section, i) => {
            const isComplete = completedSections.has(section.id)
            const isCurrent = i === currentSectionIndex
            return (
              <button
                key={section.id}
                onClick={() => setCurrentSectionIndex(i)}
                className={cn(
                  'w-full text-left flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isCurrent ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {isComplete ? (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className={cn('h-5 w-5 shrink-0', isCurrent ? 'text-blue-500' : 'text-slate-300')} />
                )}
                <span className={cn('line-clamp-2', isCurrent && 'font-medium')}>{section.title}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {isAllComplete ? (
          <div className="flex flex-col items-center justify-center min-h-full p-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-6">
              <Trophy className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Training Complete!</h2>
            <p className="text-slate-500 mb-6">
              You've completed all {totalSections} sections of <strong>{module.title}</strong>.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentSectionIndex(0)}>Review from Start</Button>
              <Button onClick={() => router.push('/training')}>Back to Catalog</Button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-8 space-y-6">
            {/* Section header */}
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <span>Section {currentSectionIndex + 1} of {totalSections}</span>
                {completedSections.has(currentSection.id) && (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Completed
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{currentSection.title}</h1>
            </div>

            {/* Content blocks */}
            {currentSection.content_blocks.map((block) => (
              <div key={block.id}>
                {block.type === 'text' && <TextViewer content={block.content as any} />}
                {block.type === 'video' && <VideoViewer content={block.content as any} />}
                {block.type === 'quiz' && (
                  <QuizViewer
                    block={block}
                    userId={activeUserId}
                    onPass={() => setQuizPassed(prev => new Set([...prev, block.id]))}
                  />
                )}
              </div>
            ))}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <Button variant="outline" onClick={goPrev} disabled={currentSectionIndex === 0}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>

              <Button
                onClick={markSectionComplete}
                loading={saving}
                disabled={!canComplete && !completedSections.has(currentSection.id)}
                className={completedSections.has(currentSection.id) ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {completedSections.has(currentSection.id)
                  ? isLastSection ? 'Completed ✓' : 'Next Section'
                  : isLastSection ? 'Complete Training' : 'Mark Complete & Continue'
                }
                {!completedSections.has(currentSection.id) && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>

            {hasQuiz && !quizPassed.has(quizBlockId ?? '') && !completedSections.has(currentSection.id) && (
              <p className="text-sm text-amber-600 text-center">
                Complete the quiz above to unlock this section
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
