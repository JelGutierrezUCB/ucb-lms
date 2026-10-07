'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fmtDateOnly } from '@/lib/introReviews/time'
import type { HolidayRegion } from '@/types'

export interface HolidayRow {
  id: string
  region: HolidayRegion
  holiday_date: string
  name: string
}

const REGION_LABEL: Record<HolidayRegion, string> = { US: 'United States', PH: 'Philippines' }

export function HolidayManager({ initial }: { initial: HolidayRow[] }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [rows, setRows] = useState(initial)
  const [region, setRegion] = useState<HolidayRegion>('US')
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!date || !name.trim()) {
      toast.error('Enter a date and a name.')
      return
    }
    setBusy(true)
    const { data, error } = await supabase
      .from('holidays')
      .insert({ region, holiday_date: date, name: name.trim() })
      .select()
      .single()
    setBusy(false)
    if (error) {
      toast.error(error.code === '23505' ? 'That date is already on this calendar.' : error.message)
      return
    }
    setRows(r => [...r, data as HolidayRow])
    setDate('')
    setName('')
    toast.success('Holiday added')
    router.refresh()
  }

  const remove = async (row: HolidayRow) => {
    const { error } = await supabase.from('holidays').delete().eq('id', row.id)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows(r => r.filter(x => x.id !== row.id))
    router.refresh()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Holiday calendars</CardTitle>
          <p className="text-sm text-slate-500">
            Review due dates count business days — weekdays that aren’t on the person’s holiday calendar — and calls are never
            offered on these days. Dates for 2026–2027 are pre-loaded; remove any your company doesn’t observe and add
            holidays declared by proclamation (e.g. Eid’l Fitr and Eid’l Adha in the Philippines). Changing a holiday does not
            move dates on reviews already created — to re-date an employee, use “Start reviews” again with the same First Day.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Calendar</Label>
              <Select value={region} onValueChange={v => setRegion(v as HolidayRegion)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="PH">Philippines</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Eid’l Fitr" />
            </div>
            <Button onClick={add} loading={busy}>
              <Plus className="h-4 w-4 mr-1.5" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(['US', 'PH'] as HolidayRegion[]).map(r => (
          <Card key={r}>
            <CardHeader>
              <CardTitle>{REGION_LABEL[r]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {rows
                .filter(h => h.region === r)
                .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
                .map(h => (
                  <div key={h.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-slate-100 last:border-0">
                    <div className="min-w-0">
                      <p className="text-slate-800 truncate">{h.name}</p>
                      <p className="text-xs text-slate-400">{fmtDateOnly(h.holiday_date)}</p>
                    </div>
                    <button type="button" onClick={() => remove(h)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${h.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              {rows.filter(h => h.region === r).length === 0 && <p className="text-sm text-slate-400">No holidays yet.</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
