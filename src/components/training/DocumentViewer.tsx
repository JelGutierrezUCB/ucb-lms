'use client'

import { useEffect, useState } from 'react'
import { FileText, Download, ExternalLink, Loader2 } from 'lucide-react'
import type { DocumentContent } from '@/types'

interface Props {
  blockId: string
  content: DocumentContent
}

export function DocumentViewer({ blockId, content }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/training-document-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentBlockId: blockId }),
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.error) { setError(data.error); return }
        setUrl(data.url)
      })
      .catch(() => { if (!cancelled) setError('Failed to load document') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [blockId])

  if (!content?.storage_path) {
    return (
      <div className="rounded-xl bg-slate-100 p-8 text-center text-slate-400">
        No document attached
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
        <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '70vh' }}>
          <iframe src={url} className="w-full h-full" title={content.file_name} />
        </div>
      )}
    </div>
  )
}
