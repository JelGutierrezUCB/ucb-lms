import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { CertificatesTable } from '@/components/certificates/CertificatesTable'
import type { Profile, Certificate } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CertificatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as { data: Profile | null }
  if (!['admin', 'manager'].includes(profile?.role ?? '')) redirect('/dashboard')

  // RLS already scopes this to "all" for admins and "my employees" for
  // managers — no extra filtering needed here.
  const { data: certificates } = await supabase
    .from('certificates')
    .select('*')
    .order('issued_at', { ascending: false }) as { data: Certificate[] | null }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Certificates" />
      <main className="flex-1 p-6">
        <CertificatesTable certificates={certificates ?? []} />
      </main>
    </div>
  )
}
