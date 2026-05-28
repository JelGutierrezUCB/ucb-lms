import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ModuleList } from '@/components/admin/ModuleList'
import type { Module } from '@/types'

export default async function ModulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: modules } = await supabase
    .from('modules')
    .select('*')
    .order('created_at', { ascending: false }) as { data: Module[] | null }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Training Modules" />
      <main className="flex-1 p-6">
        <ModuleList initialModules={modules ?? []} />
      </main>
    </div>
  )
}
