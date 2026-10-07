import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { getPortalView } from '@/lib/view'
import { getProxyTarget } from '@/lib/proxy'
import { getDict } from '@/lib/i18n/get-locale'
import { MySkillsView } from '@/components/training/MySkillsView'
import type { Profile, Skill, JobRole, JobRoleSkill, ModuleSkill, Module, EmployeeSkillAssessment } from '@/types'

export const dynamic = 'force-dynamic'

export default async function MySkillsPage() {
  const t = await getDict()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single() as { data: Profile | null }
  if (!profile) redirect('/login')

  const proxyTarget = await getProxyTarget(user.id, profile.role)
  const effectiveUserId = proxyTarget?.id ?? user.id
  const effectiveJobRoleId = proxyTarget?.job_role_id ?? profile.job_role_id ?? null

  if (!proxyTarget && (await getPortalView(profile.role)) === 'admin') {
    if (profile.role === 'admin') redirect('/admin')
    if (profile.role === 'manager') redirect('/manager')
  }

  const [
    { data: skills },
    { data: jobRoleSkills },
    { data: moduleSkills },
    { data: modules },
    { data: assessments },
    { data: jobRole },
  ] = await Promise.all([
    supabase.from('skills').select('*') as unknown as Promise<{ data: Skill[] | null }>,
    supabase.from('job_role_skills').select('*') as unknown as Promise<{ data: JobRoleSkill[] | null }>,
    supabase.from('module_skills').select('*') as unknown as Promise<{ data: ModuleSkill[] | null }>,
    supabase.from('modules').select('id, title, category, estimated_minutes').eq('is_published', true).eq('is_archived', false) as unknown as Promise<{ data: Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>[] | null }>,
    supabase.from('employee_skill_assessments').select('*').eq('user_id', effectiveUserId).order('assessed_at', { ascending: false }) as unknown as Promise<{ data: EmployeeSkillAssessment[] | null }>,
    effectiveJobRoleId
      ? supabase.from('job_roles').select('*').eq('id', effectiveJobRoleId).single() as unknown as Promise<{ data: JobRole | null }>
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={t.skillsPage.title} />
      <main className="flex-1 p-4 sm:p-6 space-y-4">
        <p className="text-sm text-slate-500">{t.skillsPage.subtitle}</p>
        <MySkillsView
          userId={effectiveUserId}
          jobRole={jobRole ?? null}
          skills={skills ?? []}
          jobRoleSkills={jobRoleSkills ?? []}
          moduleSkills={moduleSkills ?? []}
          modules={modules ?? []}
          assessments={assessments ?? []}
          t={t}
        />
      </main>
    </div>
  )
}
