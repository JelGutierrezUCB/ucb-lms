import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ProfileSettingsForm } from '@/components/profile/ProfileSettingsForm'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null }

  if (!profile) redirect('/login')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Profile Settings" />
      <main className="flex-1 p-6">
        <ProfileSettingsForm profile={profile} />
      </main>
    </div>
  )
}
