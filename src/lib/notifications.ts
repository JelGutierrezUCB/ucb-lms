import { createAdminClient } from './supabase/server'
import { sendEmail, notificationEmailHtml } from './email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ucb-lms-kappa.vercel.app'

export async function notifyUsers(
  userIds: string[],
  opts: { type: string; title: string; message: string; link?: string }
) {
  if (userIds.length === 0) return

  const admin = await createAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  await admin.from('notifications').insert(
    userIds.map(userId => ({
      user_id: userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
    }))
  )

  await Promise.all(
    (profiles ?? []).map(profile =>
      profile.email
        ? sendEmail({
            to: profile.email,
            subject: opts.title,
            html: notificationEmailHtml({
              fullName: profile.full_name ?? 'there',
              title: opts.title,
              message: opts.message,
              link: opts.link ? `${APP_URL}${opts.link}` : APP_URL,
            }),
          })
        : Promise.resolve()
    )
  )
}
