import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { EmployeeManager } from '@/components/manager/EmployeeManager'
import type { Profile, Module, Assignment } from '@/types'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single() as { data: Profile | null }
  if (!['admin', 'manager'].includes(profile?.role ?? '')) redirect('/dashboard')

  // Admins see all employees, managers see their own
  const employeesQuery = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'employee')
    .order('full_name')

  if (profile?.role === 'manager') {
    employeesQuery.eq('manager_id', user.id)
  }

  const { data: employees } = await employeesQuery as { data: Profile[] | null }

  const { data: modules } = await supabase
    .from('modules')
    .select('*')
    .eq('is_published', true)
    .order('title') as { data: Module[] | null }

  const employeeIds = (employees ?? []).map(e => e.id)
  const { data: assignments } = await supabase
    .from('assignments')
    .select('*')
    .in('user_id', employeeIds.length ? employeeIds : ['']) as { data: Assignment[] | null }

  // Get progress per employee per module
  const { data: sectionCounts } = await supabase
    .from('sections')
    .select('id, module_id')
    .in('module_id', (modules ?? []).map(m => m.id))

  const { data: progress } = await supabase
    .from('section_progress')
    .select('user_id, section_id, sections!inner(module_id)')
    .in('user_id', employeeIds.length ? employeeIds : [''])

  const totalByModule: Record<string, number> = {}
  for (const s of sectionCounts ?? []) {
    totalByModule[s.module_id] = (totalByModule[s.module_id] ?? 0) + 1
  }

  const completedByUserModule: Record<string, number> = {}
  for (const p of (progress ?? []) as any[]) {
    const key = `${p.user_id}_${p.sections?.module_id}`
    completedByUserModule[key] = (completedByUserModule[key] ?? 0) + 1
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Employee Training" />
      <main className="flex-1 p-6">
        <EmployeeManager
          employees={employees ?? []}
          modules={modules ?? []}
          assignments={assignments ?? []}
          totalByModule={totalByModule}
          completedByUserModule={completedByUserModule}
          managerId={user.id}
        />
      </main>
    </div>
  )
}
