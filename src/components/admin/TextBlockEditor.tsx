'use client'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { TextContent } from '@/types'

interface Props {
  content: TextContent
  onChange: (content: TextContent) => void
}

export function TextBlockEditor({ content, onChange }: Props) {
  const text = content.html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const handleChange = (value: string) => {
    const lines = value.split('\n')
    const html = lines
      .map(line => {
        if (!line.trim()) return ''
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
        if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
        if (line.startsWith('• ') || line.startsWith('- ')) return `<li>${line.slice(2)}</li>`
        if (line.startsWith('* ')) return `<li>${line.slice(2)}</li>`
        return `<p>${line}</p>`
      })
      .filter(Boolean)
      .join('\n')

    onChange({ html: html || '<p></p>' })
  }

  return (
    <div className="space-y-2">
      <Label>Content (supports Markdown-like formatting)</Label>
      <Textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        rows={8}
        placeholder={`# Heading 1\n## Heading 2\n\nRegular paragraph text here.\n\n- Bullet point 1\n- Bullet point 2\n\nAnother paragraph...`}
      />
      <p className="text-xs text-slate-400">
        Use # for headings, - or • for bullets. Preview shows the formatted version.
      </p>
    </div>
  )
}
