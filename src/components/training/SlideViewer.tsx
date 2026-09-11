'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SlidesContent } from '@/types'

interface Props {
  content: SlidesContent
}

// Narrated slide deck. Narration audio isn't pre-generated or stored anywhere —
// it's synthesized live in the browser via the free built-in Web Speech API
// (window.speechSynthesis), so this works with zero backend cost or setup.
// Voice quality depends on the browser/OS; not all browsers support it, so
// the deck is fully usable without narration too.
export function SlideViewer({ content }: Props) {
  const slides = content?.slides ?? []
  const [index, setIndex] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(true)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
  }, [])

  const stop = () => {
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  // Stop narration whenever the slide changes or the component unmounts.
  useEffect(() => {
    stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])
  useEffect(() => () => stop(), [])

  const playNarration = () => {
    if (!supported) return
    const slide = slides[index]
    if (!slide?.narration) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(slide.narration)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  const toggleNarration = () => {
    if (speaking) stop()
    else playNarration()
  }

  const goTo = (i: number) => {
    if (i < 0 || i >= slides.length) return
    setIndex(i)
  }

  if (slides.length === 0) {
    return (
      <div className="rounded-xl bg-slate-100 p-8 text-center text-slate-400">
        No slides yet
      </div>
    )
  }

  const slide = slides[index]

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 min-h-[280px] flex flex-col">
        <h3 className="text-xl font-bold text-slate-900 mb-4">{slide.title}</h3>
        <ul className="space-y-2.5 flex-1">
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2.5 text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        {supported && slide.narration && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" size="sm" onClick={toggleNarration}>
              {speaking ? <Pause className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              {speaking ? 'Pause narration' : 'Play narration'}
            </Button>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              {speaking ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {speaking ? 'Playing...' : 'Narration available'}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => goTo(index + 1)} disabled={index === slides.length - 1}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      <p className="text-xs text-slate-400 text-center">Slide {index + 1} of {slides.length}</p>
    </div>
  )
}
