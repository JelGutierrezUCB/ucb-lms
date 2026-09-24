import Link from 'next/link'
import { ArrowRight, Award, Check, Clock, Download, Lock, Sparkles, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ProgressRing } from '@/components/ui/progress-ring'
import { cn, formatDate, getCategoryLabel } from '@/lib/utils'
import type { PathStep, UserPath } from '@/lib/learning-paths'

// Colors for phases (the signposts on the road), cycled in order.
const PHASE_COLORS = [
  { pin: 'bg-blue-500 border-blue-700', sign: 'border-blue-600 text-blue-900', pole: 'bg-blue-500' },
  { pin: 'bg-purple-500 border-purple-700', sign: 'border-purple-600 text-purple-900', pole: 'bg-purple-500' },
  { pin: 'bg-orange-500 border-orange-700', sign: 'border-orange-500 text-orange-900', pole: 'bg-orange-500' },
  { pin: 'bg-teal-500 border-teal-700', sign: 'border-teal-600 text-teal-900', pole: 'bg-teal-500' },
  { pin: 'bg-rose-500 border-rose-700', sign: 'border-rose-500 text-rose-900', pole: 'bg-rose-500' },
] as const

type Row =
  | { kind: 'phase'; label: string; color: number }
  | { kind: 'step'; step: PathStep; index: number; color: number }
  | { kind: 'finish' }

const ROW_H = { step: 150, phase: 96, finish: 190 } as const
const TOP = 36
const LEFT_X = 27
const RIGHT_X = 73

// One learning journey as a winding road: a pin for every course along it, a
// signpost where each phase starts, a short note beside each course, and a
// finish line where the journey certificate is earned.
export function JourneyRoadmap({ journey }: { journey: UserPath }) {
  const { path, steps, percent, completedSteps, dueDate, nextStep, minutesLeft, certificate } = journey
  const complete = percent === 100

  // Rows along the road, with phase signposts inserted where the phase changes.
  const rows: Row[] = []
  let phaseIndex = -1
  let currentPhase: string | null = null
  steps.forEach((step, index) => {
    if (step.phase && step.phase !== currentPhase) {
      currentPhase = step.phase
      phaseIndex += 1
      rows.push({ kind: 'phase', label: step.phase, color: phaseIndex })
    }
    rows.push({ kind: 'step', step, index, color: Math.max(phaseIndex, 0) })
  })
  rows.push({ kind: 'finish' })

  // Vertical position (centre) and horizontal side of each row.
  let cursor = TOP
  const placed = rows.map((row, i) => {
    const h = ROW_H[row.kind]
    const y = cursor + h / 2
    cursor += h
    return { row, y, x: i % 2 === 0 ? LEFT_X : RIGHT_X }
  })
  const height = cursor + 44

  // Smooth S-curves through every row, entering from the top centre and
  // leaving through the bottom centre.
  const first = placed[0]
  let d = `M 50 0 C 50 ${first.y / 2} ${first.x} ${first.y / 2} ${first.x} ${first.y}`
  for (let i = 1; i < placed.length; i++) {
    const a = placed[i - 1]
    const b = placed[i]
    const mid = (a.y + b.y) / 2
    d += ` C ${a.x} ${mid} ${b.x} ${mid} ${b.x} ${b.y}`
  }
  const lastP = placed[placed.length - 1]
  d += ` C ${lastP.x} ${lastP.y + 50} 50 ${height - 50} 50 ${height}`

  const stateOf = (step: PathStep) =>
    step.percent === 100 ? 'done' : nextStep?.module.id === step.module.id ? 'current' : 'upcoming'

  return (
    <Card className={cn('overflow-hidden', path.kind === 'onboarding' && !complete && 'border-blue-200 ring-1 ring-blue-100')}>
      {/* Header: overall progress and the main action */}
      <div className="flex items-start gap-4 border-b border-slate-100 p-4 sm:p-6">
        <ProgressRing percent={percent} size={64} stroke={7} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{path.title}</h2>
            {path.kind === 'onboarding' && (
              <Badge className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> New hire onboarding</Badge>
            )}
            {complete && <Badge variant="success">Journey complete</Badge>}
          </div>
          {path.description && <p className="text-sm text-slate-500">{path.description}</p>}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span>{completedSteps} of {steps.length} courses done</span>
            {!complete && minutesLeft > 0 && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> about {minutesLeft} min left</span>
            )}
            {dueDate && !complete && <span>Due {formatDate(dueDate)}</span>}
          </p>
          {!complete && (
            <p className="text-xs text-slate-500">
              Complete all {steps.length} {steps.length === 1 ? 'course' : 'courses'} to earn your journey certificate.
            </p>
          )}
        </div>
        {nextStep ? (
          <Link
            href={`/training/${nextStep.module.id}`}
            className="hidden sm:inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {nextStep.percent > 0 ? 'Continue' : 'Start'} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : certificate ? (
          <a
            href={`/api/certificate?journeyCertificateId=${certificate.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex shrink-0 items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
          >
            <Download className="h-4 w-4" /> Certificate
          </a>
        ) : null}
      </div>

      {/* The road */}
      <div className="relative overflow-hidden" style={{ height }}>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-lime-200 to-lime-300" />
        <div className="absolute -left-1/4 top-[14%] h-72 w-[95%] rounded-full bg-lime-300/70" />
        <div className="absolute -right-1/3 top-[42%] h-80 w-[105%] rounded-full bg-green-300/60" />
        <div className="absolute -left-1/3 bottom-[6%] h-72 w-[105%] rounded-full bg-emerald-300/50" />

        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
          <path d={d} fill="none" stroke="rgba(15,23,42,0.28)" strokeWidth={40} strokeLinecap="round" vectorEffect="non-scaling-stroke" transform="translate(0.6 4)" />
          <path d={d} fill="none" stroke="#cbd5e1" strokeWidth={36} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={d} fill="none" stroke="#475569" strokeWidth={30} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={d} fill="none" stroke="#f8fafc" strokeWidth={2.5} strokeDasharray="10 10" strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
        </svg>

        {placed.map(({ row, y, x }, i) => {
          const onLeft = x < 50
          // Text sits on the open side of the pin, away from the road's next bend.
          const textStyle: React.CSSProperties = onLeft
            ? { left: `calc(${x}% + 34px)`, right: '3%', top: y - 62 }
            : { right: `calc(${100 - x}% + 34px)`, left: '3%', top: y - 62, textAlign: 'right' }

          if (row.kind === 'phase') {
            const c = PHASE_COLORS[row.color % PHASE_COLORS.length]
            return (
              <div key={`phase-${i}`} className="absolute -translate-x-1/2" style={{ left: `${100 - x}%`, top: y - 54 }}>
                <div className={cn('w-36 rounded-xl border-4 bg-white px-3 py-2 text-center text-base font-extrabold leading-tight shadow-md sm:w-52 sm:text-lg', c.sign)}>
                  {row.label}
                </div>
                <div className={cn('mx-auto h-11 w-2 rounded-b', c.pole)} />
              </div>
            )
          }

          if (row.kind === 'step') {
            const state = stateOf(row.step)
            const c = PHASE_COLORS[row.color % PHASE_COLORS.length]
            return (
              <div key={`step-${row.step.module.id}`}>
                <RoadPin x={x} y={y} className={cn(
                  state === 'done' && 'bg-green-500 border-green-700',
                  state === 'current' && cn(c.pin, 'ring-4 ring-white/80 animate-pulse'),
                  state === 'upcoming' && cn(c.pin, 'opacity-70 saturate-75')
                )}>
                  {state === 'done' ? <Check className="h-5 w-5" /> : row.index + 1}
                </RoadPin>

                <div className="absolute" style={textStyle}>
                  <Link
                    href={`/training/${row.step.module.id}`}
                    className={cn(
                      'block rounded-xl bg-white/90 p-2.5 shadow-sm ring-1 ring-black/5 transition hover:bg-white hover:shadow-md',
                      state === 'current' && 'ring-2 ring-blue-500'
                    )}
                  >
                    <p className={cn('text-sm font-semibold leading-snug', state === 'done' ? 'text-slate-500' : 'text-slate-900')}>
                      {row.step.module.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {getCategoryLabel(row.step.module.category)} · {row.step.module.estimated_minutes} min ·{' '}
                      <span className={cn('font-medium', state === 'done' && 'text-green-700', state === 'current' && 'text-blue-700')}>
                        {state === 'done' ? 'Completed' : state === 'current' ? (row.step.percent > 0 ? `${row.step.percent}% done` : 'Up next') : 'Upcoming'}
                      </span>
                    </p>
                    {row.step.note && <p className="mt-1 line-clamp-3 text-xs text-slate-600">{row.step.note}</p>}
                    {state === 'current' && row.step.percent > 0 && <Progress value={row.step.percent} className="mt-2 h-1.5" />}
                  </Link>
                </div>
              </div>
            )
          }

          // Finish line: the journey certificate
          return (
            <div key="finish">
              <RoadPin
                x={x}
                y={y}
                size={52}
                className={cn(
                  complete && certificate ? 'bg-amber-500 border-amber-700 ring-4 ring-white/80' : complete ? 'bg-green-500 border-green-700' : 'bg-slate-400 border-slate-600'
                )}
              >
                {complete ? <Trophy className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
              </RoadPin>
              <div className="absolute" style={textStyle}>
                <div className="rounded-xl bg-white/90 p-3 shadow-sm ring-1 ring-black/5">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900" style={{ justifyContent: onLeft ? 'flex-start' : 'flex-end' }}>
                    <Award className="h-4 w-4 text-amber-600" /> Journey certificate
                  </p>
                  {certificate ? (
                    <>
                      <p className="mt-0.5 text-xs text-slate-500">Earned {formatDate(certificate.issuedAt)}. Well done!</p>
                      <a
                        href={`/api/certificate?journeyCertificateId=${certificate.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800"
                      >
                        <Download className="h-3.5 w-3.5" /> Download certificate
                      </a>
                    </>
                  ) : complete ? (
                    <p className="mt-0.5 text-xs text-slate-500">All courses done — your certificate is being prepared. Refresh in a moment.</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Finish all {steps.length} {steps.length === 1 ? 'course' : 'courses'} to unlock it ({steps.length - completedSteps} to go).
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Phones: the main action sits at the bottom, under the road */}
      {nextStep && (
        <div className="border-t border-slate-100 p-4 sm:hidden">
          <Link
            href={`/training/${nextStep.module.id}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {nextStep.percent > 0 ? 'Continue' : 'Start'}: {nextStep.module.title} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </Card>
  )
}

// A map-style pin whose tip touches the road at (x%, y px).
function RoadPin({
  x, y, size = 44, className, children,
}: {
  x: number
  y: number
  size?: number
  className?: string
  children: React.ReactNode
}) {
  const tip = Math.round(size * 1.207) // height of a square rotated 45° with its corner pointing down
  return (
    <>
      <span
        aria-hidden
        className="absolute rounded-full bg-black/30"
        style={{ left: `${x}%`, top: y, width: size * 0.7, height: 8, transform: 'translate(-50%, -50%)' }}
      />
      <div
        className="absolute"
        style={{ left: `${x}%`, top: y, width: size, height: tip, transform: 'translate(-50%, -100%)' }}
        aria-hidden
      >
        <div
          className={cn('absolute left-0 top-0 rotate-45 rounded-full rounded-br-none border-[3px] shadow-lg', className)}
          style={{ width: size, height: size }}
        />
        <div
          className="absolute left-0 top-0 flex items-center justify-center text-sm font-bold text-white"
          style={{ width: size, height: size }}
        >
          {children}
        </div>
      </div>
    </>
  )
}
