'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { COMPANIES, COMPANY_DEPARTMENTS } from '@/types'
import type { JobRole } from '@/types'
import { ACCOUNT_TYPES, Chip, matchesAudience, type PersonLite } from './journey-shared'

// Who an assignment applies to: filters on the details in Users, plus people
// chosen one by one. Used by assignment rules.
export interface AudienceValue {
  companies: string[]
  departments: string[]
  roleIds: string[]
  managerIds: string[]
  accountTypes: string[]
  personIds: string[]
}

export const emptyAudience: AudienceValue = {
  companies: [], departments: [], roleIds: [], managerIds: [], accountTypes: [], personIds: [],
}

// Same rule the database uses: chosen individuals always match; otherwise every
// kind of filter with a selection must match. Nothing selected matches nobody.
export function audienceMatches(p: PersonLite, a: AudienceValue) {
  if (a.personIds.includes(p.id)) return true
  return matchesAudience(p, {
    companies: a.companies, departments: a.departments, roleIds: a.roleIds,
    supervisorIds: a.managerIds, accountTypes: a.accountTypes,
  })
}

export function AudiencePicker({
  value, onChange, people, roles,
}: {
  value: AudienceValue
  onChange: (next: AudienceValue) => void
  people: PersonLite[]
  roles: JobRole[]
}) {
  const [query, setQuery] = useState('')
  const set = (patch: Partial<AudienceValue>) => onChange({ ...value, ...patch })
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const companyOptions = useMemo(
    () => [...new Set([...COMPANIES, ...people.map(p => p.company).filter((c): c is string => !!c)])].sort(),
    [people]
  )
  const departmentOptions = useMemo(() => {
    const inScope = (c: string | null | undefined) => value.companies.length === 0 || (!!c && value.companies.includes(c))
    const configured = (value.companies.length ? value.companies : Object.keys(COMPANY_DEPARTMENTS)).flatMap(c => COMPANY_DEPARTMENTS[c] ?? [])
    const inUse = people.filter(p => inScope(p.company)).map(p => p.department).filter((d): d is string => !!d)
    return [...new Set([...configured, ...inUse, ...value.departments])].sort()
  }, [value.companies, value.departments, people])
  const managerOptions = useMemo(() => {
    const ids = new Set([...people.map(p => p.manager_id).filter((id): id is string => !!id), ...value.managerIds])
    return [...ids]
      .map(id => ({ id, name: people.find(p => p.id === id)?.full_name ?? 'Unknown', team: people.filter(p => p.manager_id === id).length }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [people, value.managerIds])

  const nameById = useMemo(() => new Map(people.map(p => [p.id, p.full_name])), [people])
  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return people.filter(p => !value.personIds.includes(p.id) && p.full_name.toLowerCase().includes(q)).slice(0, 6)
  }, [people, query, value.personIds])

  const hasAudience = Object.values(value).some(list => list.length > 0)
  const matchCount = useMemo(() => people.filter(p => audienceMatches(p, value)).length, [people, value])

  return (
    <div className="space-y-4">
      <Group title="Company">
        {companyOptions.map(c => (
          <Chip key={c} on={value.companies.includes(c)} onClick={() => set({ companies: toggle(value.companies, c) })}>{c}</Chip>
        ))}
      </Group>

      <Group title="Department / facility">
        {departmentOptions.map(d => (
          <Chip key={d} on={value.departments.includes(d)} onClick={() => set({ departments: toggle(value.departments, d) })}>{d}</Chip>
        ))}
      </Group>

      <Group title="Job role" empty={roles.length === 0 ? 'No job roles yet — add them on the Users page.' : undefined}>
        {roles.map(r => (
          <Chip key={r.id} on={value.roleIds.includes(r.id)} onClick={() => set({ roleIds: toggle(value.roleIds, r.id) })}>{r.name}</Chip>
        ))}
      </Group>

      <Group title="Manager (their team)" empty={managerOptions.length === 0 ? 'No managers assigned yet — set a manager on a user in the Users page.' : undefined}>
        {managerOptions.map(m => (
          <Chip key={m.id} on={value.managerIds.includes(m.id)} onClick={() => set({ managerIds: toggle(value.managerIds, m.id) })}>
            {m.name} <span className="opacity-60">({m.team})</span>
          </Chip>
        ))}
      </Group>

      <Group title="Account type">
        {ACCOUNT_TYPES.map(a => (
          <Chip key={a.value} on={value.accountTypes.includes(a.value)} onClick={() => set({ accountTypes: toggle(value.accountTypes, a.value) })}>{a.label}</Chip>
        ))}
      </Group>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-700">Individual people <span className="font-normal text-slate-400">(always included)</span></p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a name to add" className="pl-9" aria-label="Search people to add" />
        </div>
        {found.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {found.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { set({ personIds: [...value.personIds, p.id] }); setQuery('') }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">{p.full_name}</span>
                <span className="truncate pl-3 text-xs text-slate-400">{[p.company, p.department].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
        )}
        {value.personIds.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {value.personIds.map(id => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-600 py-1 pl-3 pr-1.5 text-sm text-white">
                {nameById.get(id) ?? 'Unknown'}
                <button
                  type="button"
                  onClick={() => set({ personIds: value.personIds.filter(x => x !== id) })}
                  className="rounded-full p-0.5 hover:bg-blue-700"
                  aria-label={`Remove ${nameById.get(id) ?? 'person'}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className={`rounded-lg px-3 py-2 text-sm ${hasAudience ? 'bg-blue-50 text-blue-800' : 'bg-slate-50 text-slate-500'}`}>
        {hasAudience
          ? `${matchCount} current ${matchCount === 1 ? 'person matches' : 'people match'} this audience. A person needs to match every filter group you fill in (any one choice within a group counts); individually chosen people are always included.`
          : 'Nothing selected — no one is assigned automatically.'}
      </p>
    </div>
  )
}

function Group({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {empty ? <p className="text-xs text-slate-400">{empty}</p> : <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
