import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyUsers } from '@/lib/notifications'

// Apply an assignment rule to everyone who matches it now, then notify the
// people who were newly assigned. The DB function re-checks that the caller is
// an admin and never overrides an existing assignment.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ruleId } = await req.json()
  if (!ruleId) return NextResponse.json({ error: 'Missing rule' }, { status: 400 })

  const { data: assigned, error } = await supabase.rpc('apply_course_rule', { p_rule: ruleId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const newlyAssigned = (assigned as string[] | null) ?? []
  if (newlyAssigned.length > 0) {
    const { data: rule } = await supabase
      .from('course_rules')
      .select('module_id, requirement, due_mode, due_date, due_days')
      .eq('id', ruleId)
      .single()
    const { data: mod } = rule
      ? await supabase.from('modules').select('title').eq('id', rule.module_id).single()
      : { data: null }

    if (rule && mod) {
      const dueText =
        rule.due_mode === 'fixed' && rule.due_date ? ` It's due by ${new Date(rule.due_date).toLocaleDateString()}.`
        : rule.due_mode === 'relative' && rule.due_days ? ` It's due in ${rule.due_days} days.`
        : ''
      await notifyUsers(newlyAssigned, {
        type: 'assignment',
        title: rule.requirement === 'optional' ? 'New optional training available' : 'New training assigned',
        message: `You've been assigned "${mod.title}"${rule.requirement === 'optional' ? ' (optional)' : ''}.${dueText}`,
        link: `/training/${rule.module_id}`,
      })
    }
  }

  return NextResponse.json({ success: true, assigned: newlyAssigned.length })
}
