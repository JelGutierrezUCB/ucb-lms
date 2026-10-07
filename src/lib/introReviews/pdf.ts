import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { requiredSignerRoles } from './actions'
import { fmtDateOnly, fmtInTz } from './time'
import type { Bundle } from './server'
import { RATING_LABELS, RECOMMENDATION_LABELS, type Recommendation, type SignerRole } from './types'

// Standard PDF fonts only encode Latin-1 + a handful of typographic marks —
// anything else (emoji, CJK…) would throw, so swap it for "?".
const ALLOWED_EXTRA = /[‘’“”–—…•€™]/
const safe = (s: string) =>
  Array.from(s)
    .map(ch => {
      const c = ch.codePointAt(0)!
      if (c === 10 || c === 9 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || ALLOWED_EXTRA.test(ch)) return ch
      return '?'
    })
    .join('')

const NAVY = rgb(0.141, 0.106, 0.306)
const GREEN = rgb(0.298, 0.604, 0.165)
const GRAY = rgb(0.4, 0.42, 0.46)
const INK = rgb(0.1, 0.1, 0.12)
const RED = rgb(0.75, 0.15, 0.15)

const ROLE_LABEL: Record<SignerRole, string> = {
  reviewee: 'Reviewee',
  supervisor: 'Supervisor',
  evaluator: 'Evaluator',
}

const stamp = (iso: string) => iso.replace('T', ' ').slice(0, 16) + ' UTC'

export async function generateReviewPdf(b: Bundle, firstDay: string | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const script = await doc.embedFont(StandardFonts.TimesRomanItalic)

  const W = 612
  const H = 792
  const M = 50
  const BOTTOM = 56
  let page: PDFPage = doc.addPage([W, H])
  let y = H - M

  const newPage = () => {
    page = doc.addPage([W, H])
    y = H - M
  }
  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) newPage()
  }

  const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
    const lines: string[] = []
    for (const para of safe(text).split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test
        else {
          if (line) lines.push(line)
          line = word
        }
      }
      lines.push(line)
    }
    return lines
  }

  const write = (
    text: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}
  ) => {
    const font = opts.font ?? regular
    const size = opts.size ?? 10
    const indent = opts.indent ?? 0
    const lineH = size * 1.35
    for (const line of wrap(text, font, size, W - M * 2 - indent)) {
      ensure(lineH)
      page.drawText(line, { x: M + indent, y: y - size, size, font, color: opts.color ?? INK })
      y -= lineH
    }
    y -= opts.gap ?? 0
  }

  const rule = () => {
    ensure(10)
    page.drawLine({ start: { x: M, y: y - 2 }, end: { x: W - M, y: y - 2 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.85) })
    y -= 10
  }

  const section = (title: string) => {
    ensure(90) // keep a heading together with the start of its content
    y -= 6
    write(title, { font: bold, size: 12, color: NAVY, gap: 2 })
    rule()
  }

  const { review, reviewee, supervisor, evaluator, signatures } = b
  const tpl = review.template_snapshot
  const required = requiredSignerRoles(review)
  const signedRoles = signatures.map(s => s.role)
  const pending = required.filter(r => !signedRoles.includes(r))

  // ── Header ──
  page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: NAVY })
  page.drawRectangle({ x: 0, y: H - 18, width: W, height: 4, color: GREEN })
  y = H - 44
  write('UCB Training Portal', { font: bold, size: 10, color: GREEN })
  write('Introductory Review', { font: bold, size: 22, color: NAVY })
  write(`${tpl.title}  ·  People Analyzer / Right Person, Right Seat (RPRS)`, { size: 10, color: GRAY, gap: 6 })

  if (review.status !== 'completed') {
    write(
      pending.length > 0
        ? `NOT FULLY SIGNED — waiting on: ${pending.map(r => ROLE_LABEL[r]).join(', ')}`
        : 'NOT FINAL — review not yet complete',
      { font: bold, size: 10, color: RED, gap: 4 }
    )
  }

  // ── Details ──
  const detail = (label: string, value: string) => {
    ensure(16)
    page.drawText(safe(label), { x: M, y: y - 10, size: 9, font: bold, color: GRAY })
    page.drawText(safe(value || '—'), { x: M + 130, y: y - 10, size: 10, font: regular, color: INK })
    y -= 16
  }
  detail('Name of Reviewee', reviewee.full_name)
  detail('Reviewee Job Title', reviewee.job_title ?? '')
  detail('Supervisor Name', supervisor?.full_name ?? '')
  detail('First Day', firstDay ? fmtDateOnly(firstDay) : '')
  detail('Evaluator Name', evaluator?.full_name ?? '')
  detail('Evaluator Job Title', evaluator?.job_title ?? '')
  detail('Review due', fmtDateOnly(review.due_date))
  if (review.call_at) detail('Review call', fmtInTz(new Date(review.call_at), reviewee.timezone))
  y -= 4

  // ── Ratings ──
  const selfR = review.self_answers?.ratings ?? {}
  const evalR = review.evaluator_answers?.ratings ?? {}
  section('Core Values & Right Person, Right Seat')
  write(
    'Rating key:  Most of the time = exhibits the core value MOST of the time  ·  Some of the time = SOME of the time  ·  Does not exhibit = DOES NOT exhibit core values',
    { size: 8, color: GRAY, gap: 6 }
  )

  let lastGroup = ''
  for (const item of tpl.ratingItems) {
    if (item.group !== lastGroup) {
      lastGroup = item.group
      ensure(24)
      write(item.group === 'core' ? 'UCBE Core Values' : 'Right Person, Right Seat', { font: bold, size: 10, color: GREEN, gap: 2 })
    }
    ensure(44)
    write(item.label, { font: bold, size: 10 })
    write(item.description, { size: 8, color: GRAY })
    const selfLabel = selfR[item.id] ? RATING_LABELS[selfR[item.id]] : 'Not submitted'
    const evalLabel = evalR[item.id] ? RATING_LABELS[evalR[item.id]] : 'Not submitted'
    ensure(16)
    page.drawText(safe(`Reviewee: ${selfLabel}`), { x: M + 10, y: y - 9, size: 9, font: regular, color: NAVY })
    page.drawText(safe(`Evaluator: ${evalLabel}`), { x: M + 270, y: y - 9, size: 9, font: regular, color: NAVY })
    y -= 20
  }

  // ── Questions ──
  const evalQ = tpl.questions.filter(q => q.audience === 'evaluator')
  const selfQ = tpl.questions.filter(q => q.audience === 'reviewee')
  if (evalQ.length > 0) {
    section('Evaluator Questions')
    for (const q of evalQ) {
      write(q.text, { font: bold, size: 9, gap: 1 })
      write(review.evaluator_answers?.answers?.[q.id] || '—', { size: 10, indent: 10, gap: 6 })
    }
  }
  if (selfQ.length > 0) {
    section('Reviewee Questions')
    for (const q of selfQ) {
      write(q.text, { font: bold, size: 9, gap: 1 })
      write(review.self_answers?.answers?.[q.id] || '—', { size: 10, indent: 10, gap: 6 })
    }
  }

  section('Reviewee’s Comments')
  write(review.self_answers?.comments || (review.self_answers ? '—' : 'Self-review not submitted.'), { gap: 4 })
  section('Evaluator’s Narrative')
  write(review.evaluator_answers?.narrative || '—', { gap: 4 })

  if (tpl.hasRecommendation) {
    section('Recommendation')
    const chosen = review.evaluator_answers?.recommendation
    for (const key of Object.keys(RECOMMENDATION_LABELS) as Recommendation[]) {
      const label =
        key === 'extend_period' && chosen === key && review.evaluator_answers?.extendDays
          ? `Extend introductory period for another ${review.evaluator_answers.extendDays} days.`
          : RECOMMENDATION_LABELS[key]
      write(`${chosen === key ? '[ X ]' : '[   ]'}  ${label}`, {
        font: chosen === key ? bold : regular,
        size: 10,
        gap: 2,
      })
    }
    y -= 4
  }

  // ── Signatures ──
  section('Signatures')
  write(tpl.consentText, { size: 9, color: GRAY, gap: 8 })

  for (const role of required) {
    const sig = signatures.find(s => s.role === role)
    ensure(78)
    write(ROLE_LABEL[role], { font: bold, size: 10, color: NAVY })
    if (!sig) {
      write('Not yet signed', { size: 10, color: RED, indent: 10, gap: 8 })
      continue
    }
    if (sig.signature_type === 'drawn' && sig.signature_image) {
      try {
        const bytes = Buffer.from(sig.signature_image.split(',')[1] ?? '', 'base64')
        const img = await doc.embedPng(bytes)
        const scale = Math.min(170 / img.width, 48 / img.height, 1)
        const w = img.width * scale
        const h = img.height * scale
        page.drawImage(img, { x: M + 10, y: y - h - 2, width: w, height: h })
        y -= h + 6
      } catch {
        write('(drawn signature on file)', { size: 10, font: script, indent: 10 })
      }
    } else {
      write(sig.signature_text ?? sig.signer_name, { font: script, size: 20, indent: 10, gap: 2 })
    }
    write(`${sig.signer_name}  ·  signed ${stamp(sig.signed_at)}  ·  ${sig.signature_type === 'drawn' ? 'drawn' : 'typed'} e-signature`, {
      size: 8,
      color: GRAY,
      indent: 10,
      gap: 8,
    })
  }

  if (signatures.length > 0) {
    ensure(40)
    rule()
    write(
      `Electronically signed through the UCB Training Portal. Each signature records the signer’s account, time, IP address and browser. Content fingerprint (SHA-256): ${signatures[0].content_hash}`,
      { size: 7, color: GRAY }
    )
    write(`Review ID: ${review.id}`, { size: 7, color: GRAY })
  }

  // Page numbers
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W - M - 50, y: 28, size: 8, font: regular, color: GRAY })
    p.drawText(safe(`${reviewee.full_name} — ${tpl.title}`), { x: M, y: 28, size: 8, font: regular, color: GRAY })
  })

  return doc.save()
}
