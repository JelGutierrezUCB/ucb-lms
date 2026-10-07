'use client'

import { Languages } from 'lucide-react'
import { useLocale } from '@/contexts/LocaleContext'
import { cn } from '@/lib/utils'

// EN / ES toggle. Only the learner-facing pages (dashboard, catalog, player,
// journeys, history, login) are translated — admin console screens stay in
// English regardless of this setting.
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()

  return (
    <div
      className={cn('flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 text-xs font-semibold', className)}
      role="group"
      aria-label="Language"
    >
      <Languages className="ml-1.5 h-3.5 w-3.5 text-slate-400" aria-hidden />
      {(['en', 'es'] as const).map(l => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cn(
            'rounded-full px-2 py-1 transition-colors',
            locale === l ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
