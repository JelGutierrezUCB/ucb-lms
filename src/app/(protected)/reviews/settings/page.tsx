import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { HolidayManager, type HolidayRow } from '@/components/reviews/HolidayManager'

export const dynamic = 'force-dynamic'

export default async function ReviewSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/reviews')

  const { data: holidays } = await supabase.from('holidays').select('id, region, holiday_date, name').order('holiday_date')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Review Settings" />
      <main className="flex-1 p-6 space-y-4">
        <Link href="/reviews" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Introductory reviews
        </Link>
        <HolidayManager initial={(holidays ?? []) as unknown as HolidayRow[]} />
      </main>
    </div>
  )
}
