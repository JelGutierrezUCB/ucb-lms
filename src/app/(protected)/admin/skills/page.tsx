import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { SkillsTabs, type SkillsTab } from '@/components/admin/SkillsTabs'
import { SkillLibraryManager } from '@/components/admin/SkillLibraryManager'
import { JobRoleSkillsManager } from '@/components/admin/JobRoleSkillsManager'
import { LearningResourcesManager } from '@/components/admin/LearningResourcesManager'
import { isProtectedModule } from '@/lib/protected-modules'
import type { JobRole, JobRoleSkill, LearningResource, Module, ModuleSkill, ResourceSkill, Skill } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminSkillsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { tab } = await searchParams
  const active: SkillsTab = tab === 'requirements' ? 'requirements' : tab === 'resources' ? 'resources' : 'library'

  const [
    { data: skills }, { data: jobRoles }, { data: jobRoleSkills }, { data: modules }, { data: moduleSkills },
    { data: resources }, { data: resourceSkills },
  ] = await Promise.all([
    supabase.from('skills').select('*').order('category').order('name') as unknown as Promise<{ data: Skill[] | null }>,
    supabase.from('job_roles').select('*').order('name') as unknown as Promise<{ data: JobRole[] | null }>,
    supabase.from('job_role_skills').select('*') as unknown as Promise<{ data: JobRoleSkill[] | null }>,
    supabase.from('modules').select('id, title').eq('is_archived', false).order('title') as unknown as Promise<{ data: Pick<Module, 'id' | 'title'>[] | null }>,
    supabase.from('module_skills').select('*') as unknown as Promise<{ data: ModuleSkill[] | null }>,
    supabase.from('learning_resources').select('*').order('created_at', { ascending: false }) as unknown as Promise<{ data: LearningResource[] | null }>,
    supabase.from('resource_skills').select('*') as unknown as Promise<{ data: ResourceSkill[] | null }>,
  ])
  const taggableModules = (modules ?? []).filter(m => !isProtectedModule(m.id))

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Skills" />
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        <SkillsTabs active={active} />
        {active === 'library' && (
          <SkillLibraryManager
            skills={skills ?? []}
            modules={taggableModules}
            moduleSkills={moduleSkills ?? []}
            currentUserId={user.id}
          />
        )}
        {active === 'requirements' && (
          <JobRoleSkillsManager jobRoles={jobRoles ?? []} skills={skills ?? []} jobRoleSkills={jobRoleSkills ?? []} />
        )}
        {active === 'resources' && (
          <LearningResourcesManager
            resources={resources ?? []}
            resourceSkills={resourceSkills ?? []}
            skills={skills ?? []}
            currentUserId={user.id}
          />
        )}
      </main>
    </div>
  )
}
