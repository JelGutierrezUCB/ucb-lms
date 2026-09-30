import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { EmployeeSkillsView } from '@/components/admin/EmployeeSkillsView'
import type { Profile, Skill, JobRole, JobRoleSkill, ModuleSkill, Module, EmployeeSkillAssessment } from '@/types'

export const dynamic = 'force-dynamic'

export default async function EmployeeSkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single() as { data: Profile | null }
  if (!['admin', 'manager'].includes(profile?.role ?? '')) redirect('/dashboard')

  const employeesQuery = supabase
    .from('profiles')
    .select('id, full_name, department, job_role_id')
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('full_name')
  if (profile?.role === 'manager') employeesQuery.eq('manager_id', user.id)
  const { data: employees } = await employeesQuery as { data: { id: string; full_name: string; department: string | null; job_role_id: string | null }[] | null }

  const { userId } = await searchParams
  const selectedId = userId && employees?.some(e => e.id === userId) ? userId : (employees?.[0]?.id ?? null)

  const [
    { data: skills },
    { data: jobRoles },
    { data: jobRoleSkills },
    { data: moduleSkills },
    { data: modules },
  ] = await Promise.all([
    supabase.from('skills').select('*') as unknown as Promise<{ data: Skill[] | null }>,
    supabase.from('job_roles').select('*') as unknown as Promise<{ data: JobRole[] | null }>,
    supabase.from('job_role_skills').select('*') as unknown as Promise<{ data: JobRoleSkill[] | null }>,
    supabase.from('module_skills').select('*') as unknown as Promise<{ data: ModuleSkill[] | null }>,
    supabase.from('modules').select('id, title, category, estimated_minutes').eq('is_published', true).eq('is_archived', false) as unknown as Promise<{ data: Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>[] | null }>,
  ])

  let assessments: EmployeeSkillAssessment[] = []
  if (selectedId) {
    const { data } = await supabase
      .from('employee_skill_assessments')
      .select('*')
      .eq('user_id', selectedId)
      .order('assessed_at', { ascending: false }) as { data: EmployeeSkillAssessment[] | null }
    assessments = data ?? []
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Team Skills" />
      <main className="flex-1 p-4 sm:p-6">
        <EmployeeSkillsView
          employees={employees ?? []}
          selectedId={selectedId}
          skills={skills ?? []}
          jobRoles={jobRoles ?? []}
          jobRoleSkills={jobRoleSkills ?? []}
          moduleSkills={moduleSkills ?? []}
          modules={modules ?? []}
          assessments={assessments}
          currentUserId={user.id}
        />
      </main>
    </div>
  )
}
