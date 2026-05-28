import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ModuleEditor } from '@/components/admin/ModuleEditor'

export default async function NewModulePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Create New Module" />
      <main className="flex-1 p-6">
        <ModuleEditor createdBy={user.id} />
      </main>
    </div>
  )
}
