import { createClient } from '@/lib/supabase/server'
import { RuleManager } from '@/components/admin/RuleManager'
import { isProtectedModule } from '@/lib/protected-modules'
import { AlertTriangle } from 'lucide-react'
import type { CourseRule, CourseRuleTarget, JobRole, Module, Profile } from '@/types'

type RuleModuleRow = Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes' | 'is_published'>
type PersonRow = Pick<Profile, 'id' | 'full_name' | 'department' | 'company' | 'role' | 'manager_id' | 'job_role_id' | 'is_active'>

// "Assignment Rules" tab: assign courses to audiences automatically.
export async function AssignmentRulesContent({ userId }: { userId: string }) {
  const supabase = await createClient()

  const [
    { data: rules, error: rulesError },
    { data: targets },
    { data: modules },
    { data: roles },
    { data: people },
    { data: ruleAssignments },
  ] = await Promise.all([
    supabase.from('course_rules').select('*').order('created_at', { ascending: false }),
    supabase.from('course_rule_targets').select('rule_id, kind, value'),
    supabase.from('modules').select('id, title, category, estimated_minutes, is_published').order('title'),
    supabase.from('job_roles').select('*').order('name'),
    supabase.from('profiles').select('id, full_name, department, company, role, manager_id, job_role_id, is_active').order('full_name'),
    supabase.from('assignments').select('source_rule_id').not('source_rule_id', 'is', null),
  ])

  // If the assignment-rules migration hasn't been applied yet these tables don't exist.
  if (rulesError) {
    return (
      <div className="max-w-2xl space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-5">
        <p className="flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5" /> Assignment rules aren&apos;t set up in the database yet
        </p>
        <p className="text-sm text-amber-900/80">
          Run <code className="rounded bg-amber-100 px-1">supabase/migrations/20260929_course_assignment_rules.sql</code> once in the Supabase SQL editor, then reload.
        </p>
        <p className="text-xs text-amber-900/60">{rulesError.message}</p>
      </div>
    )
  }

  const assignedCounts: Record<string, number> = {}
  for (const a of ruleAssignments ?? []) {
    if (a.source_rule_id) assignedCounts[a.source_rule_id] = (assignedCounts[a.source_rule_id] ?? 0) + 1
  }

  return (
    <RuleManager
      rules={(rules ?? []) as CourseRule[]}
      targets={(targets ?? []) as CourseRuleTarget[]}
      assignedCounts={assignedCounts}
      modules={((modules ?? []) as RuleModuleRow[]).filter(m => !isProtectedModule(m.id))}
      roles={(roles ?? []) as JobRole[]}
      people={((people ?? []) as PersonRow[]).filter(p => p.is_active !== false)}
      currentUserId={userId}
    />
  )
}
