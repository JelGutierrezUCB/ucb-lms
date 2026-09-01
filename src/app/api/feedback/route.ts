import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, feedbackEmailHtml } from '@/lib/email'

const FEEDBACK_TO = 'recruiting@ucbenvironmental.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()

  const { message } = await req.json()
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Feedback message is required' }, { status: 400 })
  }

  await sendEmail({
    to: FEEDBACK_TO,
    subject: `Training Portal feedback from ${profile?.full_name ?? 'a user'}`,
    html: feedbackEmailHtml({
      fullName: profile?.full_name ?? 'Unknown user',
      email: profile?.email ?? user.email ?? 'unknown',
      message: message.trim(),
    }),
  })

  return NextResponse.json({ success: true })
}
