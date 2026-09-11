import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase()

  if (lower.endsWith('.txt')) {
    return buffer.toString('utf-8')
  }

  if (lower.endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return result.text
  }

  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
    const officeParser = await import('officeparser')
    const text = await new Promise<string>((resolve, reject) => {
      officeParser.parseOffice(buffer, (err: any, data: string) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
    return text
  }

  throw new Error(`Unsupported file type: ${fileName}`)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const {
    storagePath, fileName, category = 'general', context = '',
    includeText = true, includeSlides = false, retainDocument = false,
  } = await req.json()
  if (!storagePath || !fileName) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Uploaded directly to Storage from the browser (bypasses the serverless
  // function's request-body limit), so download it here instead of parsing
  // a multipart body. Admin client since the bucket is private.
  const admin = await createAdminClient()
  const { data: fileBlob, error: downloadError } = await admin.storage
    .from('training-source-docs')
    .download(storagePath)

  if (downloadError || !fileBlob) {
    return NextResponse.json({ error: `Failed to retrieve uploaded file: ${downloadError?.message ?? 'not found'}` }, { status: 400 })
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer())

  let documentText: string
  try {
    documentText = await extractText(buffer, fileName)
  } catch (err: any) {
    if (!retainDocument) await admin.storage.from('training-source-docs').remove([storagePath]).catch(() => {})
    return NextResponse.json({ error: `Failed to parse file: ${err.message}` }, { status: 400 })
  }

  // Source document is only needed transiently for text extraction — clean it
  // up now, unless the admin chose to retain it as an attached resource (in
  // which case save-generated-module wires storagePath into a document block).
  if (!retainDocument) {
    await admin.storage.from('training-source-docs').remove([storagePath]).catch(() => {})
  }

  if (!documentText.trim()) {
    return NextResponse.json({ error: 'Document appears to be empty or unreadable' }, { status: 400 })
  }

  const truncatedText = documentText.slice(0, 40000)

  const anthropic = new Anthropic({ apiKey: process.env.UCB_AI_KEY })

  const systemPrompt = `You are an expert instructional designer. Create a structured training module from the provided document content. Return ONLY valid JSON matching the exact schema specified, no other text.`

  const slidesBlockSchema = `,
        {
          "type": "slides",
          "content": {
            "slides": [
              {
                "title": "string - slide title",
                "bullets": ["string - short bullet point", "..."],
                "narration": "string - a short spoken narration script for this slide, written in a natural speaking voice to be read aloud (2-4 sentences)"
              }
            ]
          }
        }`

  const userPrompt = `Create a training module from this document.
Category: ${category}
${context ? `Additional context: ${context}` : ''}

Document content:
---
${truncatedText}
---

Return a JSON object with this exact structure:
{
  "title": "string - compelling module title",
  "description": "string - 2-3 sentence overview",
  "category": "${category}",
  "estimated_minutes": number,
  "sections": [
    {
      "title": "string - section title",
      "content_blocks": [
        ${includeText ? `{
          "type": "text",
          "content": {
            "html": "string - HTML content with <h2>, <p>, <ul><li>, <strong> tags"
          }
        },` : ''}
        {
          "type": "quiz",
          "content": {
            "passing_score": 70,
            "questions": [
              {
                "id": "q1",
                "question": "string",
                "options": ["option A", "option B", "option C", "option D"],
                "correct_index": 0,
                "explanation": "string - why this is correct"
              }
            ]
          }
        }${includeSlides ? slidesBlockSchema : ''}
      ]
    }
  ]
}

Rules:
- Create 3-7 sections based on document length and complexity
${includeText ? '- Each section MUST have at least one text block with the actual content' : '- Sections do not need text blocks in this case — focus on the other content types requested below'}
- Add a quiz block at the end of sections where it makes sense (not every section needs one)
- Quiz questions should test understanding of the section content, not trivia
- Each quiz question must have 3-4 options with exactly one correct answer
${includeText ? '- HTML content should be well-structured and readable' : ''}
${includeSlides ? `- EVERY section MUST also include a "slides" block: break the section's content into 3-6 slides, each with a short title, 2-4 bullets, and a natural-sounding narration script (this is read aloud by the browser, so write it as spoken language, not bullet fragments)` : ''}
- Use the document content faithfully, don't invent information
- estimated_minutes should reflect actual reading/learning time`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: includeSlides ? 24000 : 16000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const jsonText = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const moduleData = JSON.parse(jsonText)

    return NextResponse.json({
      module: moduleData,
      retainedDocument: retainDocument ? { storagePath, fileName, mimeType: (fileBlob as any).type } : null,
    })
  } catch (err: any) {
    console.error('Generation error:', err)
    // Generation failed — don't leave a retained document orphaned in storage.
    if (retainDocument) await admin.storage.from('training-source-docs').remove([storagePath]).catch(() => {})
    return NextResponse.json({ error: 'Failed to generate module: ' + err.message }, { status: 500 })
  }
}
