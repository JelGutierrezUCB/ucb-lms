'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowRight, BookOpen, CheckCircle2, Clock, ExternalLink, MessageSquare, Sparkles, Target, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, getCategoryColor } from '@/lib/utils'
import { fmt, type Dict } from '@/lib/i18n/dictionaries'
import { reasonText } from '@/lib/recommendation-text'
import type { Recommendation, ReasonKind } from '@/lib/recommendations'

const GROUPS: { key: string; titleKey: keyof Dict['learnNext']; kinds: ReasonKind[] }[] = [
  { key: 'required', titleKey: 'groupRequired', kinds: ['overdue', 'required'] },
  { key: 'supervisor', titleKey: 'groupSupervisor', kinds: ['supervisor'] },
  { key: 'review', titleKey: 'groupReview', kinds: ['lowScore'] },
  { key: 'continue', titleKey: 'groupContinue', kinds: ['inProgress', 'journey'] },
  { key: 'gap', titleKey: 'groupGap', kinds: ['skillGap'] },
  { key: 'role', titleKey: 'groupRole', kinds: ['jobRole'] },
  { key: 'build', titleKey: 'groupBuild', kinds: ['program', 'category'] },
]

interface Props {
  userId: string
  items: Recommendation[]
  jobRoleName: string | null
  skillGapCount: number
  t: Dict
}

export function LearnNextView({ userId, items, jobRoleName, skillGapCount, t }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState<string | null>(null)
  // Dismissed/completed this session — hidden immediately, the server agrees on refresh.
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const visible = items.filter(i => !hidden.has(i.key))
  const hero = visible[0] ?? null
  const rest = visible.slice(1)

  async function markCompleted(item: Recommendation) {
    setBusy(item.key)
    const { error } = await supabase.from('resource_completions').insert({ user_id: userId, resource_id: item.id })
    setBusy(null)
    if (error && error.code !== '23505') { toast.error(error.message); return }
    toast.success(t.learnNext.markedCompleted)
    setHidden(prev => new Set(prev).add(item.key))
    router.refresh()
  }

  async function dismiss(item: Recommendation) {
    setBusy(item.key)
    const { error } = await supabase
      .from('training_recommendations')
      .update({ status: 'dismissed' })
      .in('id', item.supervisorRecIds)
    setBusy(null)
    if (error) { toast.error(error.message); return }
    toast.success(t.learnNext.dismissed)
    setHidden(prev => new Set(prev).add(item.key))
    router.refresh()
  }

  if (visible.length === 0) {
    return (
      <div className="text-center py-20 rounded-xl border border-green-200 bg-green-50">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
        <p className="font-semibold text-green-900">{t.learnNext.allCaughtUp}</p>
        <p className="text-sm text-green-800/80 mt-1">{t.learnNext.allCaughtUpBody}</p>
        <Link href="/training" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800">
          {t.learnNext.browseCatalog} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {skillGapCount > 0 && jobRoleName && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>
            {fmt(t.learnNext.gapsSummary, { count: skillGapCount, plural: skillGapCount === 1 ? '' : 's', role: jobRoleName })}
          </span>
          <Link href="/my-skills" className="inline-flex items-center gap-1 font-medium underline">
            <Target className="h-3.5 w-3.5" /> {t.learnNext.viewSkills}
          </Link>
        </div>
      )}

      {hero && (
        <div className="rounded-2xl bg-gradient-to-r from-[#281D73] to-[#402EB8] p-5 sm:p-6 text-white">
          <p className="text-xs uppercase tracking-widest text-[#E25820] font-semibold mb-1">{t.learnNext.startHere}</p>
          <ItemBody item={hero} t={t} dark />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PrimaryAction item={hero} t={t} onDark />
            <SecondaryActions item={hero} t={t} busy={busy === hero.key} onComplete={markCompleted} onDismiss={dismiss} onDark />
          </div>
        </div>
      )}

      {GROUPS.map(g => {
        const groupItems = rest.filter(i => g.kinds.includes(i.primary))
        if (groupItems.length === 0) return null
        return (
          <section key={g.key} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{t.learnNext[g.titleKey] as string}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {groupItems.map(item => (
                <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <ItemBody item={item} t={t} />
                  <div className="flex flex-wrap items-center gap-3">
                    <PrimaryAction item={item} t={t} />
                    <SecondaryActions item={item} t={t} busy={busy === item.key} onComplete={markCompleted} onDismiss={dismiss} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ItemBody({ item, t, dark }: { item: Recommendation; t: Dict; dark?: boolean }) {
  const muted = dark ? 'text-white/70' : 'text-slate-500'
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: item.category ? getCategoryColor(item.category) : '#714F36' }}
        >
          {item.external ? <ExternalLink className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold leading-snug', dark ? 'text-xl text-white' : 'text-slate-900')}>{item.title}</p>
          <div className={cn('mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs', muted)}>
            {item.external ? (
              <>
                <span>{item.resourceType ? t.learnNext.resourceTypes[item.resourceType] : t.learnNext.external}</span>
                {item.provider && <span>· {item.provider}</span>}
                <Badge variant="outline" className={dark ? 'border-white/40 text-white' : ''}>{t.learnNext.external}</Badge>
              </>
            ) : (
              <span>{t.learnNext.inPortal}</span>
            )}
            {item.isAiGenerated && (
              <Badge variant="outline" className={cn('flex items-center gap-1', dark ? 'border-white/40 text-white' : '')}>
                <Sparkles className="h-3 w-3" /> {t.learnNext.aiGenerated}
              </Badge>
            )}
            {item.minutes ? (
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {item.minutes} {t.common.minutes}</span>
            ) : null}
          </div>
        </div>
      </div>

      {item.description && <p className={cn('text-sm line-clamp-2', muted)}>{item.description}</p>}

      <ul className="space-y-1">
        {item.reasons.map((r, i) => (
          <li key={i} className={cn('text-sm flex items-start gap-1.5', dark ? 'text-white/90' : 'text-slate-700')}>
            {r.kind === 'supervisor'
              ? <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              : <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" />}
            <span>
              {reasonText(t, r)}
              {r.kind === 'supervisor' && r.note && <em className="block opacity-80">&ldquo;{r.note}&rdquo;</em>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PrimaryAction({ item, t, onDark }: { item: Recommendation; t: Dict; onDark?: boolean }) {
  const cls = onDark
    ? 'bg-white text-slate-900 hover:bg-slate-100'
    : 'bg-blue-600 text-white hover:bg-blue-700'
  const base = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors'

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={cn(base, cls)}>
        {t.learnNext.openResource} <ExternalLink className="h-4 w-4" />
      </a>
    )
  }
  return (
    <Link href={item.href} className={cn(base, cls)}>
      {item.percent > 0 ? t.learnNext.continue : t.learnNext.start} <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

function SecondaryActions({
  item, t, busy, onComplete, onDismiss, onDark,
}: {
  item: Recommendation
  t: Dict
  busy: boolean
  onComplete: (i: Recommendation) => void
  onDismiss: (i: Recommendation) => void
  onDark?: boolean
}) {
  const link = onDark ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-slate-800'
  return (
    <>
      {item.external && (
        <Button
          variant="ghost" size="sm" disabled={busy}
          onClick={() => onComplete(item)}
          className={cn('gap-1.5', link, onDark && 'hover:bg-white/10')}
        >
          <CheckCircle2 className="h-4 w-4" /> {t.learnNext.markCompleted}
        </Button>
      )}
      {item.supervisorRecIds.length > 0 && (
        <Button
          variant="ghost" size="sm" disabled={busy}
          onClick={() => onDismiss(item)}
          className={cn('gap-1.5', link, onDark && 'hover:bg-white/10')}
        >
          <X className="h-4 w-4" /> {t.learnNext.dismiss}
        </Button>
      )}
    </>
  )
}
