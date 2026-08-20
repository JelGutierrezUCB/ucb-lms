import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail, welcomeEmailHtml } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ucb-lms-kappa.vercel.app'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

interface Row {
  full_name: string
  email: string
  role?: string
  company?: string
  department?: string
  manager_email?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: requester } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (requester?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { users }: { users: Row[] } = await req.json()
  if (!Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }
  if (users.length > 500) {
    return NextResponse.json({ error: 'Max 500 users per import' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: existingProfiles } = await admin.from('profiles').select('id, email')
  const emailToId = new Map((existingProfiles ?? []).map(p => [p.email.toLowerCase(), p.id]))

  const results: { email: string; success: boolean; error?: string }[] = []

  for (const row of users) {
    const full_name = (row.full_name ?? '').trim()
    const email = (row.email ?? '').trim().toLowerCase()
    const role = (['admin', 'manager', 'employee'].includes(row.role ?? '') ? row.role : 'employee') as string
    const company = (row.company ?? '').trim() || null
    const department = (row.department ?? '').trim() || null
    const managerEmail = (row.manager_email ?? '').trim().toLowerCase()
    const manager_id = managerEmail ? emailToId.get(managerEmail) ?? null : null

    if (!full_name || !email) {
      results.push({ email: email || '(missing)', success: false, error: 'Missing name or email' })
      continue
    }
    if (emailToId.has(email)) {
      results.push({ email, success: false, error: 'User already exists' })
      continue
    }

    const password = generatePassword()

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      results.push({ email, success: false, error: authError?.message ?? 'Failed to create account' })
      continue
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: authData.user.id,
      email,
      full_name,
      role,
      company,
      department,
      manager_id,
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      results.push({ email, success: false, error: profileError.message })
      continue
    }

    emailToId.set(email, authData.user.id)
    results.push({ email, success: true })

    sendEmail({
      to: email,
      subject: 'Welcome to UCB Training',
      html: welcomeEmailHtml({ fullName: full_name, email, password, loginUrl: `${APP_URL}/login` }),
    }).catch(() => {})
  }

  return NextResponse.json({ results })
}
