'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Clock, Download, PenLine, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { REVIEW_CLOSING_NOTE } from '@/lib/introReviews/templates'
import type { PersonLite, ReviewRow, SignatureRow, SignerRole } from '@/lib/introReviews/types'

const ROLE_LABEL: Record<SignerRole, string> = {
  reviewee: 'Reviewee',
  supervisor: 'Supervisor',
  evaluator: 'Evaluator',
}

// A small drawing surface; exports a PNG data URL (only if something was drawn)
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * ratio
    c.height = c.offsetHeight * ratio
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    ref.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = ref.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = ref.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    setEmpty(false)
    onChange(ref.current!.toDataURL('image/png'))
  }
  const clear = () => {
    const c = ref.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-32 rounded-lg border-2 border-dashed border-slate-300 bg-white touch-none cursor-crosshair"
      />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{empty ? 'Draw your signature above' : 'Looks good?'}</span>
        <button type="button" onClick={clear} className="text-slate-500 hover:text-slate-800 underline">
          Clear
        </button>
      </div>
    </div>
  )
}

interface Props {
  review: ReviewRow
  reviewee: PersonLite
  supervisor: PersonLite | null
  evaluator: PersonLite | null
  signatures: SignatureRow[]
  requiredRoles: SignerRole[]
  // roles the viewer still has to sign as (empty = nothing to sign)
  myUnsignedRoles: SignerRole[]
  viewerIsReviewee: boolean
  viewerFullName: string
}

export function SignaturePanel({
  review,
  reviewee,
  supervisor,
  evaluator,
  signatures,
  requiredRoles,
  myUnsignedRoles,
  viewerIsReviewee,
  viewerFullName,
}: Props) {
  const router = useRouter()
  const [type, setType] = useState<'typed' | 'drawn'>('typed')
  const [typedName, setTypedName] = useState(viewerFullName)
  const [image, setImage] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)

  const personFor = (role: SignerRole) => (role === 'reviewee' ? reviewee : role === 'supervisor' ? supervisor : evaluator)
  const canSign = review.status === 'awaiting_signatures' && myUnsignedRoles.length > 0

  const sign = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/intro-reviews/${review.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureType: type,
          typedName: type === 'typed' ? typedName : undefined,
          imageDataUrl: type === 'drawn' ? image : undefined,
          consent,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not sign')
      toast.success(json.completed ? 'Signed — the review is now complete' : 'Signed')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Could not sign')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-blue-600" /> Signatures
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {requiredRoles.map(role => {
            const sig = signatures.find(s => s.role === role)
            const person = personFor(role)
            return (
              <div key={role} className={`rounded-lg border p-3 ${sig ? 'border-green-200 bg-green-50/50' : 'border-slate-200'}`}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{ROLE_LABEL[role]}</p>
                <p className="text-sm font-medium text-slate-900">{person?.full_name ?? '—'}</p>
                {sig ? (
                  <div className="mt-2 space-y-1">
                    {sig.signature_type === 'drawn' && sig.signature_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sig.signature_image} alt={`${sig.signer_name}'s signature`} className="h-12 object-contain" />
                    ) : (
                      <p className="text-2xl text-slate-900" style={{ fontFamily: "'Brush Script MT', 'Snell Roundhand', cursive" }}>
                        {sig.signature_text ?? sig.signer_name}
                      </p>
                    )}
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Signed {new Date(sig.signed_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {review.status === 'awaiting_signatures' ? 'Waiting for signature' : 'Not signed yet'}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {canSign && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-4">
            <div>
              <p className="font-semibold text-slate-900">
                Sign as {myUnsignedRoles.map(r => ROLE_LABEL[r]).join(' & ')}
              </p>
              <p className="text-xs text-slate-500">Read the review above, then sign below.</p>
            </div>

            <div className="flex gap-2 rounded-lg bg-slate-100 p-1 w-fit">
              {(
                [
                  ['typed', 'Type your name'],
                  ['drawn', 'Draw it'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${type === key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {type === 'typed' ? (
              <div className="space-y-2">
                <Input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder="Type your full name" />
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 min-h-[3.5rem]">
                  <p className="text-3xl text-slate-900" style={{ fontFamily: "'Brush Script MT', 'Snell Roundhand', cursive" }}>
                    {typedName || ' '}
                  </p>
                </div>
              </div>
            ) : (
              <SignaturePad onChange={setImage} />
            )}

            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)} />
              <span>{review.template_snapshot.consentText}</span>
            </label>

            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={sign} loading={busy} disabled={!consent || (type === 'typed' ? typedName.trim().length < 2 : !image)}>
                <PenLine className="h-4 w-4 mr-1.5" /> Sign review
              </Button>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Your signature is recorded with the time, your account, and a fingerprint of this review.
              </p>
            </div>
          </div>
        )}

        {review.status === 'awaiting_signatures' && !canSign && (
          <p className="text-sm text-slate-500">
            {myUnsignedRoles.length === 0 && requiredRoles.some(r => !signatures.find(s => s.role === r))
              ? 'Waiting for the other signatures. You’ll be emailed when the review is complete.'
              : null}
          </p>
        )}

        {(review.status === 'completed' || review.status === 'awaiting_signatures') && (
          <div className="flex items-center gap-3 flex-wrap">
            <a href={`/api/intro-reviews/${review.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-1.5" />
                {review.status === 'completed' ? 'Download signed PDF' : 'Preview PDF'}
              </Button>
            </a>
            {review.status === 'completed' && review.completed_at && (
              <p className="text-xs text-slate-400">
                Completed {new Date(review.completed_at).toLocaleDateString([], { dateStyle: 'medium' })}
              </p>
            )}
          </div>
        )}

        {review.status === 'completed' && review.review_day === 90 && viewerIsReviewee && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
            <p className="text-sm text-slate-600 leading-relaxed">{REVIEW_CLOSING_NOTE}</p>
            <div className="flex gap-3 text-sm">
              <a href="https://www.glassdoor.com" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                Glassdoor →
              </a>
              <a href="https://www.indeed.com" target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                Indeed →
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
