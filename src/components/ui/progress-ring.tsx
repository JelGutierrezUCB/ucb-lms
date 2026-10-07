import { cn } from '@/lib/utils'

// Circular progress indicator with the percentage in the middle.
// Server-component friendly (no hooks); colors are overridable so it works on
// both light cards and the blue hero.
export function ProgressRing({
  percent,
  size = 56,
  stroke = 6,
  className,
  trackClassName = 'text-slate-200',
  barClassName,
  labelClassName = 'text-slate-700',
}: {
  percent: number
  size?: number
  stroke?: number
  className?: string
  trackClassName?: string
  barClassName?: string
  labelClassName?: string
}) {
  const value = Math.max(0, Math.min(100, percent))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className={trackClassName} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className={cn(barClassName ?? (value === 100 ? 'text-green-500' : 'text-blue-600'), 'transition-all')}
        />
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center text-xs font-semibold', labelClassName)}>
        {value}%
      </span>
    </div>
  )
}
