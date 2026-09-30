import Link from 'next/link'
import { ListTree, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SkillsTab = 'library' | 'requirements'

const TABS: { key: SkillsTab; label: string; icon: React.ElementType }[] = [
  { key: 'library', label: 'Skill Library', icon: ListTree },
  { key: 'requirements', label: 'Job Role Requirements', icon: UserCog },
]

export function SkillsTabs({ active }: { active: SkillsTab }) {
  return (
    <nav aria-label="Skills sections" className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <Link
              href={`/admin/skills?tab=${key}`}
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
