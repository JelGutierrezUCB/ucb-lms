import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { PathManager } from '@/components/admin/PathManager'
import { isProtectedModule } from '@/lib/protected-modules'
import { AlertTriangle } from 'lucide-react'
import type { JobRole, LearningPath, LearningPathTarget, Module, Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function PathBuilderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [
    { data: paths, error: pathsError },
    { data: roles, error: rolesError },
    { data: items },
    { data: pathTargets },
    { data: enrollments },
    { data: modules },
    { data: people },
  ] = await Promise.all([
    supabase.from('learning_paths').select('*').order('created_at', { ascending: false }),
    supabase.from('job_roles').select('*').order('name'),
    supabase.from('learning_path_items').select('path_id, module_id, order_index').order('order_index'),
    supabase.from('learning_path_targets').select('path_id, kind, value'),
    supabase.from('learning_path_enrollments').select('path_id'),
    supabase.from('modules').select('id, title, category, estimated_minutes').order('title'),
    supabase.from('profiles').select('id, full_name, department, company, role, job_role_id, is_active').order('full_name'),
  ])

  // If the Phase 2 migration hasn't been applied yet these tables don't exist.
  if (pathsError || rolesError) {
    return (
      <div className="flex flex-col flex-1 overflow-auto">
        <Header title="Path Builder" />
        <main className="flex-1 p-4 sm:p-6">
          <div className="max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle className="h-5 w-5" /> Learning paths aren&apos;t set up in the database yet
            </p>
            <p className="text-sm text-amber-900/80">
              Run <code className="rounded bg-amber-100 px-1">supabase/migrations/20260924_learning_paths.sql</code> once
              in the Supabase SQL editor, then reload this page.
            </p>
            <p className="text-xs text-amber-900/60">{(pathsError ?? rolesError)?.message}</p>
          </div>
        </main>
      </div>
    )
  }

  const enrollmentCounts: Record<string, number> = {}
  for (const e of enrollments ?? []) enrollmentCounts[e.path_id] = (enrollmentCounts[e.path_id] ?? 0) + 1

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title="Path Builder" />
      <main className="flex-1 p-4 sm:p-6">
        <PathManager
          paths={(paths ?? []) as LearningPath[]}
          items={items ?? []}
          pathTargets={(pathTargets ?? []) as LearningPathTarget[]}
          enrollmentCounts={enrollmentCounts}
          roles={(roles ?? []) as JobRole[]}
          modules={((modules ?? []) as Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>[]).filter(m => !isProtectedModule(m.id))}
          people={((people ?? []) as Pick<Profile, 'id' | 'full_name' | 'department' | 'company' | 'role' | 'job_role_id' | 'is_active'>[]).filter(p => p.is_active !== false)}
          currentUserId={user.id}
        />
      </main>
    </div>
  )
}
