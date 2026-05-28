import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.txt')) {
    return buffer.toString('utf-8')
  }

  if (fileName.endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return result.text
  }

  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const category = formData.get('category') as string || 'general'
  const context = formData.get('context') as string || ''

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  let documentText: string
  try {
    documentText = await extractText(file)
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to parse file: ${err.message}` }, { status: 400 })
  }

  if (!documentText.trim()) {
    return NextResponse.json({ error: 'Document appears to be empty or unreadable' }, { status: 400 })
  }

  const truncatedText = documentText.slice(0, 40000)

  const anthropic = new Anthropic({ apiKey: process.env.UCB_AI_KEY })

  const systemPrompt = `You are an expert instructional designer. Create a structured training module from the provided document content. Return ONLY valid JSON matching the exact schema specified, no other text.`

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
        {
          "type": "text",
          "content": {
            "html": "string - HTML content with <h2>, <p>, <ul><li>, <strong> tags"
          }
        },
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
        }
      ]
    }
  ]
}

Rules:
- Create 3-7 sections based on document length and complexity
- Each section MUST have at least one text block with the actual content
- Add a quiz block at the end of sections where it makes sense (not every section needs one)
- Quiz questions should test understanding of the section content, not trivia
- Each quiz question must have 3-4 options with exactly one correct answer
- HTML content should be well-structured and readable
- Use the document content faithfully, don't invent information
- estimated_minutes should reflect actual reading/learning time`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type')

    const jsonText = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const moduleData = JSON.parse(jsonText)

    return NextResponse.json({ module: moduleData })
  } catch (err: any) {
    console.error('Generation error:', err)
    return NextResponse.json({ error: 'Failed to generate module: ' + err.message }, { status: 500 })
  }
}
