import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (id === user.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

  const admin = await createAdminClient()

  const { error: profileError } = await admin.from('profiles').delete().eq('id', id)
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  const { error: authError } = await admin.auth.admin.deleteUser(id)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
