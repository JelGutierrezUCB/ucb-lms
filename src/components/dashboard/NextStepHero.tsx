import Link from 'next/link'
import { AlertTriangle, ArrowRight, PartyPopper, PlayCircle, Route, Sparkles } from 'lucide-react'
import { ProgressRing } from '@/components/ui/progress-ring'
import { cn } from '@/lib/utils'
import type { Dict } from '@/lib/i18n/dictionaries'

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

const REASON_STYLE: Record<NextActionReason, { icon: React.ElementType; chip: string; card: string }> = {
  overdue: { icon: AlertTriangle, chip: 'bg-red-100 text-red-800', card: 'from-red-700 to-red-600' },
  onboarding: { icon: Sparkles, chip: 'bg-white/20 text-white', card: 'from-blue-700 to-indigo-600' },
  continue: { icon: PlayCircle, chip: 'bg-white/20 text-white', card: 'from-blue-700 to-blue-600' },
  journey: { icon: Route, chip: 'bg-white/20 text-white', card: 'from-blue-700 to-blue-600' },
  start: { icon: PlayCircle, chip: 'bg-white/20 text-white', card: 'from-blue-700 to-blue-600' },
}

export function NextStepHero({ action, t }: { action: NextAction | null; t: Dict }) {
  const reasonLabel: Record<NextActionReason, string> = {
    overdue: t.dashboard.reasonOverdue,
    onboarding: t.dashboard.reasonOnboarding,
    continue: t.dashboard.reasonContinue,
    journey: t.dashboard.reasonJourney,
    start: t.dashboard.reasonStart,
  }

  if (!action) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 sm:p-6 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
          <PartyPopper className="h-6 w-6 text-green-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-green-900">{t.dashboard.allCaughtUp}</p>
          <p className="text-sm text-green-800/80">{t.dashboard.allCaughtUpBody}</p>
        </div>
        <Link
          href="/training"
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
        >
          {t.dashboard.browseCourses} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  const r = REASON_STYLE[action.reason]
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
              <Icon className="h-3.5 w-3.5" /> {reasonLabel[action.reason]}
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
