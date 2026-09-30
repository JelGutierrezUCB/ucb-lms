import { createClient } from '@/lib/supabase/server'
import { ProgramManager } from '@/components/admin/ProgramManager'
import { isProtectedModule } from '@/lib/protected-modules'
import { AlertTriangle } from 'lucide-react'
import type { Module, Program } from '@/types'

type ProgramModuleRow = { program_id: string; module_id: string }

// "Programs" tab: group related courses for browsing and reporting.
export async function ProgramsContent({ userId }: { userId: string }) {
  const supabase = await createClient()

  const [
    { data: programs, error: programsError },
    { data: programModules },
    { data: modules },
  ] = await Promise.all([
    supabase.from('programs').select('*').order('name'),
    supabase.from('program_modules').select('program_id, module_id'),
    supabase.from('modules').select('id, title, category, estimated_minutes').eq('is_archived', false).order('title'),
  ])

  // If the programs migration hasn't been applied yet this table doesn't exist.
  if (programsError) {
    return (
      <div className="max-w-2xl space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-5">
        <p className="flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5" /> Programs aren&apos;t set up in the database yet
        </p>
        <p className="text-sm text-amber-900/80">
          Run <code className="rounded bg-amber-100 px-1">supabase/migrations/20261001_programs.sql</code> once
          in the Supabase SQL editor, then reload this page.
        </p>
        <p className="text-xs text-amber-900/60">{programsError.message}</p>
      </div>
    )
  }

  return (
    <ProgramManager
      programs={(programs ?? []) as Program[]}
      programModules={(programModules ?? []) as ProgramModuleRow[]}
      modules={((modules ?? []) as Pick<Module, 'id' | 'title' | 'category' | 'estimated_minutes'>[]).filter(m => !isProtectedModule(m.id))}
      currentUserId={userId}
    />
  )
}
