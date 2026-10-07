'use client'

import { cn } from '@/lib/utils'
import { RATING_LABELS, RATING_SYMBOLS, type ReviewRating } from '@/lib/introReviews/types'

const OPTIONS: { value: ReviewRating; active: string }[] = [
  { value: 'x', active: 'bg-red-500 border-red-500 text-white' },
  { value: 'check', active: 'bg-amber-500 border-amber-500 text-white' },
  { value: 'check_plus', active: 'bg-green-600 border-green-600 text-white' },
]

export function RatingScale({
  value,
  onChange,
  disabled,
}: {
  value: ReviewRating | undefined
  onChange?: (v: ReviewRating) => void
  disabled?: boolean
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={RATING_LABELS[o.value]}
          title={RATING_LABELS[o.value]}
          disabled={disabled}
          onClick={() => onChange?.(o.value)}
          className={cn(
            'h-9 min-w-[2.75rem] px-2 rounded-md border text-sm font-semibold transition-colors',
            value === o.value ? o.active : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400',
            disabled && 'cursor-default opacity-90'
          )}
        >
          {RATING_SYMBOLS[o.value]}
        </button>
      ))}
    </div>
  )
}

export function RatingChip({ value }: { value: ReviewRating | undefined }) {
  if (!value) return <span className="text-xs text-slate-400">Not rated</span>
  const tone = value === 'x' ? 'bg-red-100 text-red-700' : value === 'check' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tone)}>
      <span className="font-bold">{RATING_SYMBOLS[value]}</span> {RATING_LABELS[value]}
    </span>
  )
}
