import type { TextContent } from '@/types'

export function TextViewer({ content }: { content: TextContent }) {
  return (
    <div
      className="prose max-w-none text-slate-800"
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  )
}
