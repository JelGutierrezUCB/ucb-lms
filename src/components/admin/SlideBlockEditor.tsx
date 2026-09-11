'use client'

import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import type { SlidesContent, Slide } from '@/types'

interface Props {
  content: SlidesContent
  onChange: (content: SlidesContent) => void
}

export function SlideBlockEditor({ content, onChange }: Props) {
  const slides = content?.slides ?? []

  const updateSlide = (i: number, updates: Partial<Slide>) => {
    onChange({ slides: slides.map((s, si) => si === i ? { ...s, ...updates } : s) })
  }

  const addSlide = () => {
    const newSlide: Slide = { title: '', bullets: [''], narration: '' }
    onChange({ slides: [...slides, newSlide] })
  }

  const removeSlide = (i: number) => {
    onChange({ slides: slides.filter((_, si) => si !== i) })
  }

  const moveSlide = (i: number, dir: 'up' | 'down') => {
    const j = dir === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= slides.length) return
    const next = [...slides]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange({ slides: next })
  }

  const updateBullet = (si: number, bi: number, value: string) => {
    const bullets = [...slides[si].bullets]
    bullets[bi] = value
    updateSlide(si, { bullets })
  }

  const addBullet = (si: number) => {
    updateSlide(si, { bullets: [...slides[si].bullets, ''] })
  }

  const removeBullet = (si: number, bi: number) => {
    updateSlide(si, { bullets: slides[si].bullets.filter((_, i) => i !== bi) })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Each slide shows its title and bullets, with an optional narration script read aloud
        in the browser when the employee clicks "Play narration" — no audio file is generated or stored.
      </p>

      {slides.map((slide, si) => (
        <div key={si} className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 shrink-0">Slide {si + 1}</span>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => moveSlide(si, 'up')} disabled={si === 0} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => moveSlide(si, 'down')} disabled={si === slides.length - 1} className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => removeSlide(si)} className="p-1 rounded text-slate-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={slide.title} onChange={e => updateSlide(si, { title: e.target.value })} placeholder="Slide title..." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Bullets</Label>
            {slide.bullets.map((bullet, bi) => (
              <div key={bi} className="flex items-center gap-2">
                <Input
                  value={bullet}
                  onChange={e => updateBullet(si, bi, e.target.value)}
                  placeholder="Bullet point..."
                />
                <button type="button" onClick={() => removeBullet(si, bi)} className="p-1 rounded text-slate-400 hover:text-red-600 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => addBullet(si)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add bullet
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Narration script (optional)</Label>
            <Textarea
              value={slide.narration}
              onChange={e => updateSlide(si, { narration: e.target.value })}
              placeholder="What should be read aloud when this slide is shown..."
              rows={2}
            />
          </div>
        </div>
      ))}

      <Separator />

      <Button type="button" variant="outline" onClick={addSlide}>
        <Plus className="h-4 w-4 mr-1.5" /> Add Slide
      </Button>
    </div>
  )
}
