import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserPath } from '@/lib/learning-paths'

// Compact "you are here" strip for a learning journey: done steps are green,
// the current step is blue, the rest are grey, joined by a line.
export function JourneyDots({ steps, max = 8 }: { steps: UserPath['steps']; max?: number }) {
  const firstOpen = steps.findIndex(s => s.percent < 100)
  const shown = steps.slice(0, max)
  const hidden = steps.length - shown.length

  return (
    <div className="flex items-center" aria-hidden>
      {shown.map((s, i) => {
        const done = s.percent === 100
        const current = i === firstOpen
        return (
          <div key={s.module.id} className="flex items-center">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                done && 'border-green-500 bg-green-500 text-white',
                current && 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100',
                !done && !current && 'border-slate-300 bg-white text-slate-400'
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {(i < shown.length - 1 || hidden > 0) && (
              <div className={cn('h-0.5 w-5 sm:w-8', done ? 'bg-green-500' : 'bg-slate-200')} />
            )}
          </div>
        )
      })}
      {hidden > 0 && <span className="ml-1 text-xs text-slate-400">+{hidden}</span>}
    </div>
  )
}
