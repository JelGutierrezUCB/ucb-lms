'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  WorkScheduleFields,
  saveScheduleValues,
  summarize,
  valuesFromProfile,
  type ScheduleValues,
} from './WorkScheduleFields'
import type { Profile } from '@/types'

type Person = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'role' | 'manager_id' | 'job_title' | 'timezone' | 'holiday_region' | 'work_schedule' | 'start_date'
>

const SAME = '__same__'

function PersonCard({
  title,
  person,
  value,
  onChange,
}: {
  title: string
  person: Person
  value: ScheduleValues
  onChange: (v: ScheduleValues) => void
}) {
  const [open, setOpen] = useState(!value.timezone)
  const missing = !value.timezone
  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 rounded-lg"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">
            {title}: {person.full_name}
          </p>
          <p className={`text-xs flex items-center gap-1 ${missing ? 'text-amber-600' : 'text-slate-500'}`}>
            {missing && <AlertTriangle className="h-3 w-3" />}
            {summarize(value)}
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 p-3">
          <WorkScheduleFields value={value} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

export function StartReviewsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [employeeId, setEmployeeId] = useState('')
  const [firstDay, setFirstDay] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [evaluatorId, setEvaluatorId] = useState(SAME)
  const [values, setValues] = useState<Record<string, ScheduleValues>>({})

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, manager_id, job_title, timezone, holiday_region, work_schedule, start_date, is_active')
        .order('full_name')
      if (cancelled) return
      setPeople(((data ?? []) as (Person & { is_active?: boolean | null })[]).filter(p => p.is_active !== false))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, supabase])

  const byId = useMemo(() => new Map(people.map(p => [p.id, p])), [people])
  const employee = employeeId ? byId.get(employeeId) : undefined
  const supervisor = supervisorId ? byId.get(supervisorId) : undefined
  const evaluator = evaluatorId !== SAME ? byId.get(evaluatorId) : undefined

  const valueFor = (p: Person): ScheduleValues => values[p.id] ?? valuesFromProfile(p)
  const setValueFor = (p: Person, v: ScheduleValues) => setValues(prev => ({ ...prev, [p.id]: v }))

  const pickEmployee = (id: string) => {
    setEmployeeId(id)
    const p = byId.get(id)
    if (p?.start_date) setFirstDay(p.start_date)
    if (p?.manager_id) setSupervisorId(p.manager_id)
  }

  const everyone = [employee, supervisor, evaluator].filter(Boolean) as Person[]
  const unique = everyone.filter((p, i) => everyone.findIndex(o => o.id === p.id) === i)
  const missingTz = unique.filter(p => !valueFor(p).timezone)

  const submit = async () => {
    if (!employee || !supervisor || !firstDay) {
      toast.error('Choose the employee, their First Day and a supervisor.')
      return
    }
    if (missingTz.length > 0) {
      toast.error(`Set a timezone for ${missingTz.map(p => p.full_name).join(', ')} — it’s needed to schedule calls.`)
      return
    }
    setSaving(true)
    try {
      for (const p of unique) {
        const err = await saveScheduleValues(supabase, p.id, valueFor(p))
        if (err) throw new Error(err)
      }
      const res = await fetch('/api/intro-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: employee.id,
          startDate: firstDay,
          supervisorId: supervisor.id,
          evaluatorId: evaluatorId === SAME ? supervisor.id : evaluatorId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not start the reviews')
      toast.success(
        json.created > 0
          ? `Reviews scheduled for ${employee.full_name}. Everyone involved was emailed.`
          : `Review dates updated for ${employee.full_name}.`
      )
      onOpenChange(false)
      setEmployeeId('')
      setFirstDay('')
      setSupervisorId('')
      setEvaluatorId(SAME)
      setValues({})
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start introductory reviews</DialogTitle>
          <DialogDescription>
            Creates the 7, 30, 60 and 90 business-day reviews from the employee’s First Day (First Day counts as day 1),
            skipping weekends and their holiday calendar, and emails everyone involved.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select value={employeeId || undefined} onValueChange={pickEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>First Day</Label>
                <Input type="date" value={firstDay} onChange={e => setFirstDay(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Supervisor</Label>
                <Select value={supervisorId || undefined} onValueChange={setSupervisorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {people
                      .filter(p => p.id !== employeeId)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Evaluator</Label>
                <Select value={evaluatorId} onValueChange={setEvaluatorId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SAME}>Same as supervisor</SelectItem>
                    {people
                      .filter(p => p.id !== employeeId)
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {employee && supervisor && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Time zones &amp; working hours
                </p>
                <PersonCard title="Employee" person={employee} value={valueFor(employee)} onChange={v => setValueFor(employee, v)} />
                <PersonCard title="Supervisor" person={supervisor} value={valueFor(supervisor)} onChange={v => setValueFor(supervisor, v)} />
                {evaluator && evaluator.id !== supervisor.id && (
                  <PersonCard title="Evaluator" person={evaluator} value={valueFor(evaluator)} onChange={v => setValueFor(evaluator, v)} />
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={loading}>
            Start reviews
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
