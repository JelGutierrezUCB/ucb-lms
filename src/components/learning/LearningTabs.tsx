import Link from 'next/link'
import { Layers, ListChecks, Route } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LearningTab = 'builder' | 'rules' | 'my'

const TABS: { key: LearningTab; label: string; icon: React.ElementType }[] = [
  { key: 'builder', label: 'Journey Builder', icon: Layers },
  { key: 'rules', label: 'Assignment Rules', icon: ListChecks },
  { key: 'my', label: 'My Journeys', icon: Route },
]

// Tab bar for the Learning Management section. Each tab is a link (?tab=...),
// so the page for a tab is server-rendered and can be bookmarked or shared.
export function LearningTabs({ active }: { active: LearningTab }) {
  return (
    <nav aria-label="Learning management sections" className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <Link
              href={`/admin/learning?tab=${key}`}
              aria-current={active === key ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                active === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
