'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, ExternalLink, Loader2 } from 'lucide-react'
import type { DocumentContent } from '@/types'
import { openLinksInNewTab } from '@/lib/openLinksInNewTab'

interface Props {
  blockId: string
  content: DocumentContent
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i
const OFFICE_EXT = /\.(pptx?|xlsx?)$/i
const TEXT_EXT = /\.(txt|csv|md|log)$/i

// Turns bare "https://..." runs in plain text into real clickable links,
// since a .txt/.csv file has no markup to carry hyperlinks of its own.
function linkifyPlainText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export function DocumentViewer({ blockId, content }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (content.link_url) { setLoading(false); return } // external link — nothing to fetch

    let cancelled = false
    setLoading(true)
    setError(null)
    setHtml(null)
    setText(null)

    fetch('/api/training-document-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentBlockId: blockId }),
    })
      .then(res => res.json())
      .then(async data => {
        if (cancelled) return
        if (data.error) { setError(data.error); return }
        setUrl(data.url)
        if (data.html) {
          setHtml(data.html)
        } else if (TEXT_EXT.test(content.file_name)) {
          try {
            const res = await fetch(data.url)
            if (!cancelled) setText(await res.text())
          } catch {
            // Falls back to the Open/Download row below.
          }
        }
      })
      .catch(() => { if (!cancelled) setError('Failed to load document') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [blockId, content.file_name, content.link_url])

  if (!content?.storage_path && !content?.link_url) {
    return (
      <div className="rounded-xl bg-slate-100 p-8 text-center text-slate-400">
        No document attached
      </div>
    )
  }

  if (content.link_url) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <FileText className="h-6 w-6 text-slate-400 shrink-0" />
        <p className="font-medium text-slate-900 text-sm flex-1 truncate">{content.file_name || content.link_url}</p>
        <a
          href={content.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline shrink-0"
        >
          <ExternalLink className="h-4 w-4" /> Open
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 p-8 text-center">
        <Loader2 className="h-6 w-6 text-slate-400 animate-spin mx-auto mb-2" />
        <p className="text-sm text-slate-400">Loading document...</p>
      </div>
    )
  }

  if (error || !url) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600">
        {error ?? 'Could not load this document'}
      </div>
    )
  }

  const isPdf = content.mime_type === 'application/pdf' || content.file_name.toLowerCase().endsWith('.pdf')
  const isImage = IMAGE_EXT.test(content.file_name)
  const isOffice = OFFICE_EXT.test(content.file_name)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <FileText className="h-6 w-6 text-slate-400 shrink-0" />
        <p className="font-medium text-slate-900 text-sm flex-1 truncate">{content.file_name}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline shrink-0"
        >
          <ExternalLink className="h-4 w-4" /> Open
        </a>
        <a
          href={url}
          download={content.file_name}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 shrink-0"
        >
          <Download className="h-4 w-4" /> Download
        </a>
      </div>

      {isPdf && (
        <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '85vh' }}>
          {/* Fragment params tell the browser's built-in PDF viewer to fit the
              page to the frame's width and hide its toolbar/thumbnail sidebar —
              without this it defaults to a small zoom that needs scrolling.
              NOTE: sandboxing this iframe (tried, to stop a link-inside-the-PDF
              from hijacking the top-level tab) makes Chrome's built-in PDF
              viewer refuse to render at all — worse than the problem it fixed,
              so this stays unsandboxed. A link click inside a PDF can still
              navigate the whole portal tab; there's no reliable in-app fix for
              that without dropping Chrome's native viewer entirely. */}
          <iframe
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            className="w-full h-full"
            title={content.file_name}
          />
        </div>
      )}

      {isImage && (
        <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
          <img src={url} alt={content.file_name} className="max-w-full max-h-[75vh] object-contain" />
        </div>
      )}

      {html && (
        <div
          onClick={openLinksInNewTab}
          className="rounded-xl border border-slate-200 bg-white p-6 max-h-[75vh] overflow-y-auto prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {text != null && (
        <pre className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-h-[75vh] overflow-auto text-sm text-slate-700 whitespace-pre-wrap break-words">
          {linkifyPlainText(text)}
        </pre>
      )}

      {isOffice && !html && (
        <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '70vh' }}>
          {/* Same reasoning as the PDF viewer above — not sandboxed, since
              Microsoft's viewer is complex enough that sandboxing risks
              breaking it entirely rather than just constraining navigation. */}
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
            className="w-full h-full"
            title={content.file_name}
          />
          <p className="text-xs text-slate-400 text-center py-1.5 bg-slate-50 border-t border-slate-200">
            Viewed via Microsoft Office Online — use Open above if this doesn't load
          </p>
        </div>
      )}
    </div>
  )
}
