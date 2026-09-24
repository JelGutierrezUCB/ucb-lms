import Link from 'next/link'
import { AlertTriangle, ArrowRight, PartyPopper, PlayCircle, Route, Sparkles } from 'lucide-react'
import { ProgressRing } from '@/components/ui/progress-ring'
import { cn } from '@/lib/utils'

export type NextActionReason = 'overdue' | 'onboarding' | 'continue' | 'journey' | 'start'

// The single most useful thing for this person to do right now.
export interface NextAction {
  reason: NextActionReason
  title: string
  subtitle?: string
  meta?: string
  href: string
  percent: number
  cta: string
}

const REASON: Record<NextActionReason, { label: string; icon: React.ElementType; chip: string; card: string }> = {
  overdue: {
    label: 'Overdue — start here',
    icon: AlertTriangle,
    chip: 'bg-red-100 text-red-800',
    card: 'from-red-700 to-red-600',
  },
  onboarding: {
    label: 'Your onboarding journey',
    icon: Sparkles,
    chip: 'bg-white/20 text-white',
    card: 'from-blue-700 to-indigo-600',
  },
  continue: {
    label: 'Pick up where you left off',
    icon: PlayCircle,
    chip: 'bg-white/20 text-white',
    card: 'from-blue-700 to-blue-600',
  },
  journey: {
    label: 'Next in your learning journey',
    icon: Route,
    chip: 'bg-white/20 text-white',
    card: 'from-blue-700 to-blue-600',
  },
  start: {
    label: 'Start here',
    icon: PlayCircle,
    chip: 'bg-white/20 text-white',
    card: 'from-blue-700 to-blue-600',
  },
}

export function NextStepHero({ action }: { action: NextAction | null }) {
  if (!action) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 sm:p-6 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
          <PartyPopper className="h-6 w-6 text-green-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-green-900">You&apos;re all caught up</p>
          <p className="text-sm text-green-800/80">Nothing is waiting on you right now. Browse the course catalog to keep learning.</p>
        </div>
        <Link
          href="/training"
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          Browse courses <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  const r = REASON[action.reason]
  const Icon = r.icon
  return (
    <Link href={action.href} className="group block">
      <div className={cn('rounded-2xl bg-gradient-to-r p-5 sm:p-6 text-white shadow-sm transition-shadow group-hover:shadow-md', r.card)}>
        <div className="flex items-center gap-4 sm:gap-6">
          <ProgressRing
            percent={action.percent}
            size={72}
            stroke={7}
            trackClassName="text-white/25"
            barClassName="text-white"
            labelClassName="text-white"
            className="hidden sm:block"
          />
          <div className="flex-1 min-w-0 space-y-1.5">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', r.chip)}>
              <Icon className="h-3.5 w-3.5" /> {r.label}
            </span>
            <p className="text-xl sm:text-2xl font-bold leading-tight">{action.title}</p>
            {action.subtitle && <p className="text-sm text-white/85 truncate">{action.subtitle}</p>}
            {action.meta && <p className="text-xs text-white/70">{action.meta}</p>}
          </div>
          <span className="hidden sm:inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 group-hover:bg-slate-100">
            {action.cta} <ArrowRight className="h-4 w-4" />
          </span>
        </div>
        {/* Phones: full-width button under the text */}
        <span className="mt-4 flex sm:hidden items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900">
          {action.cta} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}
