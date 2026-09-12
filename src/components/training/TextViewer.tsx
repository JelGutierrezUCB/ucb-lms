import type { TextContent } from '@/types'
import { openLinksInNewTab } from '@/lib/openLinksInNewTab'

export function TextViewer({ content }: { content: TextContent }) {
  return (
    <div
      className="prose max-w-none text-slate-800"
      onClick={openLinksInNewTab}
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  )
}
