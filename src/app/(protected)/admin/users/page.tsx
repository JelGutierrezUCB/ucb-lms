import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { UserManagement } from '@/components/admin/UserManagement'
import type { Profile } from '@/types'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profile?.role ?? '')) redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name') as { data: Profile[] | null }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="User Management" />
      <main className="flex-1 p-6">
        <UserManagement
          initialProfiles={profiles ?? []}
          currentUserRole={profile?.role ?? 'employee'}
          currentUserId={user.id}
        />
      </main>
    </div>
  )
}
