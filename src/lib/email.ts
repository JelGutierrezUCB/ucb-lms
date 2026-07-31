import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Falls back to Resend's shared sandbox sender until a custom domain is verified.
// See https://resend.com/domains
const FROM = process.env.RESEND_FROM_EMAIL ?? 'UCB Training <onboarding@resend.dev>'

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping email send:', opts.subject, 'to', opts.to)
    return { skipped: true }
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    if (error) console.error('Email send failed:', error)
    return { skipped: false, error }
  } catch (err) {
    console.error('Email send threw:', err)
    return { skipped: false, error: err }
  }
}

const wrapper = (title: string, body: string) => `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="color: #1e293b; margin: 0 0 16px;">${title}</h2>
  ${body}
  <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    UCB Training Portal
  </p>
</div>
`

export function welcomeEmailHtml(opts: { fullName: string; email: string; password: string; loginUrl: string }) {
  return wrapper('Welcome to UCB Training', `
    <p style="color: #475569; line-height: 1.6;">Hi ${opts.fullName},</p>
    <p style="color: #475569; line-height: 1.6;">An account has been created for you on the UCB Training Portal. Here are your login details:</p>
    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0; color: #1e293b;"><strong>Email:</strong> ${opts.email}</p>
      <p style="margin: 4px 0; color: #1e293b;"><strong>Temporary password:</strong> ${opts.password}</p>
    </div>
    <a href="${opts.loginUrl}" style="display: inline-block; background: #1e40af; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 500;">Log In</a>
  `)
}

export function notificationEmailHtml(opts: { fullName: string; title: string; message: string; link: string }) {
  return wrapper(opts.title, `
    <p style="color: #475569; line-height: 1.6;">Hi ${opts.fullName},</p>
    <p style="color: #475569; line-height: 1.6;">${opts.message}</p>
    <a href="${opts.link}" style="display: inline-block; background: #1e40af; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 500;">View in Training Portal</a>
  `)
}
