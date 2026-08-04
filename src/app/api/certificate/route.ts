import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

async function generateCertificatePdf(opts: {
  employeeName: string
  moduleTitle: string
  date: string
  scoreLine?: string
}) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([792, 612]) // landscape letter
  const { width, height } = page.getSize()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const navy = rgb(0.12, 0.25, 0.68)
  const gray = rgb(0.45, 0.45, 0.45)
  const ink = rgb(0.1, 0.1, 0.12)

  page.drawRectangle({
    x: 24, y: 24, width: width - 48, height: height - 48,
    borderColor: navy, borderWidth: 3,
  })
  page.drawRectangle({
    x: 34, y: 34, width: width - 68, height: height - 68,
    borderColor: navy, borderWidth: 0.75,
  })

  const centered = (text: string, y: number, font = regular, size = 14, color = ink) => {
    const w = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: (width - w) / 2, y, size, font, color })
  }

  centered('Certificate of Completion', height - 130, bold, 30, navy)
  centered('This certifies that', height - 190, regular, 14, gray)
  centered(opts.employeeName, height - 235, bold, 26, ink)
  centered('has successfully completed', height - 275, regular, 14, gray)
  centered(opts.moduleTitle, height - 315, bold, 20, ink)
  if (opts.scoreLine) centered(opts.scoreLine, height - 350, regular, 12, gray)
  centered(`Completed on ${opts.date}`, height - 380, regular, 12, gray)
  centered('UCB Training Portal', 55, regular, 10, gray)

  return doc.save()
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = req.nextUrl.searchParams.get('userId')
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!userId || !moduleId) {
    return NextResponse.json({ error: 'Missing userId or moduleId' }, { status: 400 })
  }

  const { data: requester } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const admin = await createAdminClient()

  // Authorization: admin, the employee's manager, or the employee themselves
  if (requester?.role !== 'admin' && user.id !== userId) {
    const { data: target } = await admin.from('profiles').select('manager_id').eq('id', userId).single()
    if (target?.manager_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { data: profile } = await admin.from('profiles').select('full_name').eq('id', userId).single()
  const { data: mod } = await admin.from('modules').select('title').eq('id', moduleId).single()
  if (!profile || !mod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Prefer a manually recorded completion (e.g. in-person/proxy training)
  const { data: manual } = await admin
    .from('manual_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .order('completion_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (manual) {
    if (manual.file_url) {
      return NextResponse.redirect(manual.file_url)
    }
    const scoreLine = manual.max_score > 0 ? `Score: ${manual.score}/${manual.max_score}` : undefined
    const pdf = await generateCertificatePdf({
      employeeName: profile.full_name,
      moduleTitle: mod.title,
      date: formatDate(manual.completion_date),
      scoreLine,
    })
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="certificate-${mod.title.replace(/[^a-z0-9]+/gi, '-')}.pdf"`,
      },
    })
  }

  // Otherwise check normal section-by-section completion
  const { data: sections } = await admin.from('sections').select('id').eq('module_id', moduleId)
  const sectionIds = (sections ?? []).map(s => s.id)
  if (sectionIds.length === 0) return NextResponse.json({ error: 'Not completed' }, { status: 404 })

  const { data: sectionProgress } = await admin
    .from('section_progress')
    .select('section_id, completed_at')
    .eq('user_id', userId)
    .in('section_id', sectionIds)

  const doneCount = sectionProgress?.length ?? 0
  if (doneCount < sectionIds.length) {
    return NextResponse.json({ error: 'Not completed' }, { status: 404 })
  }

  const completedAt = (sectionProgress ?? []).reduce(
    (max, p) => (p.completed_at > max ? p.completed_at : max),
    (sectionProgress ?? [])[0]?.completed_at ?? new Date().toISOString()
  )

  const { data: quizBlocks } = await admin
    .from('content_blocks')
    .select('id')
    .in('section_id', sectionIds)
    .eq('type', 'quiz')
  const quizBlockIds = (quizBlocks ?? []).map(b => b.id)

  let scoreLine: string | undefined
  if (quizBlockIds.length > 0) {
    const { data: attempts } = await admin
      .from('quiz_attempts')
      .select('score, max_score')
      .eq('user_id', userId)
      .in('content_block_id', quizBlockIds)
    const best = (attempts ?? []).reduce<{ score: number; max: number } | null>((acc, a) => {
      if (a.max_score <= 0) return acc
      const pct = a.score / a.max_score
      if (!acc || pct > acc.score / acc.max) return { score: a.score, max: a.max_score }
      return acc
    }, null)
    if (best) scoreLine = `Score: ${best.score}/${best.max} (${Math.round((best.score / best.max) * 100)}%)`
  }

  const pdf = await generateCertificatePdf({
    employeeName: profile.full_name,
    moduleTitle: mod.title,
    date: formatDate(completedAt),
    scoreLine,
  })

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificate-${mod.title.replace(/[^a-z0-9]+/gi, '-')}.pdf"`,
    },
  })
}
