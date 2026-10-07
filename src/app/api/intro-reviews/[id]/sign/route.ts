import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthedUser, loadBundle } from '@/lib/introReviews/server'
import { requiredSignerRoles, signerRolesFor } from '@/lib/introReviews/actions'
import { notifyCompleted, notifySigned } from '@/lib/introReviews/notify'
import type { PersonLite, SignerRole } from '@/lib/introReviews/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

// E-signature. Identity comes from the signed-in account itself (never a
// "view as" proxy); each signature records the exact acknowledgment text,
// a hash of the locked review content, the time, IP address and browser.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getAuthedUser()
  if (!user) return fail('Unauthorized', 401)

  const body = await req.json()
  const db = createAdminClient()
  const b = await loadBundle(db, id)
  if (!b) return fail('Review not found', 404)
  const { review } = b

  if (review.status !== 'awaiting_signatures') {
    return fail(
      review.status === 'completed' ? 'This review is already fully signed.' : 'This review is not ready to be signed yet.',
      409
    )
  }

  const signed = b.signatures.map(s => s.role)
  const myRoles = signerRolesFor(review, user.id).filter(role => !signed.includes(role))
  if (myRoles.length === 0) {
    return fail(
      signerRolesFor(review, user.id).length > 0 ? 'You have already signed this review.' : 'You are not a required signer on this review.',
      signerRolesFor(review, user.id).length > 0 ? 409 : 403
    )
  }

  if (body.consent !== true) return fail('Please confirm the acknowledgment before signing.')

  const type = body.signatureType
  let signatureText: string | null = null
  let signatureImage: string | null = null
  if (type === 'typed') {
    const t = typeof body.typedName === 'string' ? body.typedName.trim() : ''
    if (t.length < 2 || t.length > 100) return fail('Type your full name to sign.')
    signatureText = t
  } else if (type === 'drawn') {
    const img = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : ''
    if (!img.startsWith('data:image/png;base64,') || img.length > 300_000) return fail('Your drawn signature could not be read. Please try again.')
    signatureImage = img
  } else {
    return fail('Choose how to sign.')
  }

  const contentHash = createHash('sha256')
    .update(
      JSON.stringify({
        review: review.id,
        day: review.review_day,
        template: review.template_snapshot,
        self: review.self_answers,
        evaluator: review.evaluator_answers,
      })
    )
    .digest('hex')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null

  for (const role of myRoles) {
    const { error } = await db.from('intro_review_signatures').insert({
      review_id: id,
      signer_id: user.id,
      role,
      signer_name: user.full_name,
      signature_type: type,
      signature_text: signatureText,
      signature_image: signatureImage,
      consent_text: review.template_snapshot.consentText,
      content_hash: contentHash,
      ip_address: ip,
      user_agent: userAgent,
    })
    if (error) {
      return fail(error.code === '23505' ? 'This role has already been signed.' : error.message, error.code === '23505' ? 409 : 500)
    }
  }

  // Fully signed? Flip the status once — conditional, so simultaneous final
  // signatures can't both trigger the completion emails.
  const fresh = await loadBundle(db, id)
  if (!fresh) return NextResponse.json({ ok: true })
  const nowSigned: SignerRole[] = fresh.signatures.map(s => s.role)
  const missing = requiredSignerRoles(review).filter(role => !nowSigned.includes(role))

  if (missing.length === 0) {
    const { data: flipped } = await db
      .from('intro_reviews')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'awaiting_signatures')
      .select('id')
    if (flipped && flipped.length > 0) {
      const completed = await loadBundle(db, id)
      if (completed) await notifyCompleted(db, completed)
    }
    return NextResponse.json({ ok: true, completed: true })
  }

  const personFor = (role: SignerRole): PersonLite | null =>
    role === 'reviewee' ? fresh.reviewee : role === 'supervisor' ? fresh.supervisor : fresh.evaluator
  const remaining = missing.map(personFor).filter(Boolean) as PersonLite[]
  await notifySigned(db, fresh, user.full_name, remaining)
  return NextResponse.json({ ok: true, completed: false })
}
