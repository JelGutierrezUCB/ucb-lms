import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { EmployeeSkillsView } from '@/components/admin/EmployeeSkillsView'
import { isProtectedModule } from '@/lib/protected-modules'
import type {
  Profile, Skill, JobRole, JobRoleSkill, ModuleSkill, Module, EmployeeSkillAssessment, LearningResource, TrainingRecommendation,
} from '@/types'

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
    { data: modulesRaw },
    { data: resources },
  ] = await Promise.all([
    supabase.from('skills').select('*') as unknown as Promise<{ data: Skill[] | null }>,
    supabase.from('job_roles').select('*') as unknown as Promise<{ data: JobRole[] | null }>,
    supabase.from('job_role_skills').select('*') as unknown as Promise<{ data: JobRoleSkill[] | null }>,
    supabase.from('module_skills').select('*') as unknown as Promise<{ data: ModuleSkill[] | null }>,
    supabase.from('modules').select('id, title, category, estimated_minutes').eq('is_published', true).eq('is_archived', false) as unknown as Promise<{ data: Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>[] | null }>,
    supabase.from('learning_resources').select('id, title, provider, resource_type').eq('is_published', true).order('title') as unknown as Promise<{ data: Pick<LearningResource, 'id' | 'title' | 'provider' | 'resource_type'>[] | null }>,
  ])
  const modules = (modulesRaw ?? []).filter(m => !isProtectedModule(m.id))

  let assessments: EmployeeSkillAssessment[] = []
  let recommendations: TrainingRecommendation[] = []
  if (selectedId) {
    const [{ data: a }, { data: r }] = await Promise.all([
      supabase
        .from('employee_skill_assessments')
        .select('*')
        .eq('user_id', selectedId)
        .order('assessed_at', { ascending: false }) as unknown as Promise<{ data: EmployeeSkillAssessment[] | null }>,
      supabase
        .from('training_recommendations')
        .select('*')
        .eq('user_id', selectedId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }) as unknown as Promise<{ data: TrainingRecommendation[] | null }>,
    ])
    assessments = a ?? []
    recommendations = r ?? []
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
          modules={modules}
          resources={resources ?? []}
          recommendations={recommendations}
          assessments={assessments}
          currentUserId={user.id}
        />
      </main>
    </div>
  )
}
