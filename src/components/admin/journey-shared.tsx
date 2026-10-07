import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Module, Profile } from '@/types'

// Bits shared by the journey list, the step-by-step wizard and the enroll dialog.

export type ModuleLite = Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>
export type PersonLite = Pick<Profile, 'id' | 'full_name' | 'department' | 'company' | 'role' | 'manager_id' | 'job_role_id' | 'is_active'>

export const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: 'employee', label: 'Employees' },
  { value: 'manager', label: 'Managers' },
  { value: 'admin', label: 'Admins' },
]

export interface AudienceFilters {
  companies: string[]
  departments: string[]
  roleIds: string[]
  supervisorIds: string[]
  accountTypes: string[]
}

// Same rule the database uses: every kind of filter that has a selection must
// match (any one value within a kind); no filters at all matches nobody.
export function matchesAudience(p: PersonLite, f: AudienceFilters) {
  if (!f.companies.length && !f.departments.length && !f.roleIds.length && !f.supervisorIds.length && !f.accountTypes.length) return false
  return (
    (!f.companies.length || (p.company != null && f.companies.includes(p.company))) &&
    (!f.departments.length || (p.department != null && f.departments.includes(p.department))) &&
    (!f.roleIds.length || (p.job_role_id != null && f.roleIds.includes(p.job_role_id))) &&
    (!f.supervisorIds.length || (p.manager_id != null && f.supervisorIds.includes(p.manager_id))) &&
    (!f.accountTypes.length || f.accountTypes.includes(p.role))
  )
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors text-left',
        on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      )}
    >
      {on && <Check className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  )
}
