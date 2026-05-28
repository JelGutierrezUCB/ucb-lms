import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ReportsView } from '@/components/reports/ReportsView'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single() as { data: Profile | null }
  if (!['admin', 'manager'].includes(profile?.role ?? '')) redirect('/dashboard')

  // Employees: managers see their own, admins see all
  const employeesQuery = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('full_name')

  if (profile?.role === 'manager') employeesQuery.eq('manager_id', user.id)

  const { data: employees } = await employeesQuery as { data: Profile[] | null }
  const employeeIds = (employees ?? []).map(e => e.id)

  const [
    { data: modules },
    { data: assignments },
    { data: sections },
    { data: allProgress },
    { data: quizAttempts },
  ] = await Promise.all([
    supabase.from('modules').select('*').eq('is_published', true).order('title'),
    supabase.from('assignments')
      .select('id, user_id, module_id, assigned_at, due_date')
      .in('user_id', employeeIds.length ? employeeIds : ['']),
    supabase.from('sections').select('id, module_id, title, order_index'),
    supabase.from('section_progress')
      .select('user_id, section_id, completed_at, sections!inner(module_id)')
      .in('user_id', employeeIds.length ? employeeIds : ['']),
    supabase.from('quiz_attempts')
      .select('id, user_id, content_block_id, score, max_score, completed_at')
      .in('user_id', employeeIds.length ? employeeIds : [''])
      .order('completed_at', { ascending: false }),
  ])

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Training Reports" />
      <main className="flex-1 p-6">
        <ReportsView
          employees={employees ?? []}
          modules={modules ?? []}
          assignments={(assignments ?? []) as any[]}
          sections={(sections ?? []) as any[]}
          progress={(allProgress ?? []) as any[]}
          quizAttempts={(quizAttempts ?? []) as any[]}
          viewerRole={profile?.role ?? 'manager'}
        />
      </main>
    </div>
  )
}
