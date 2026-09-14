'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Loader2, Upload, FileText, X, ExternalLink, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { DocumentContent } from '@/types'

interface Props {
  content: DocumentContent
  onChange: (content: DocumentContent) => void
}

type Source = 'upload' | 'link'

export function DocumentBlockEditor({ content, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [source, setSource] = useState<Source>(content.link_url ? 'link' : 'upload')
  const supabase = createClient()

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('training-source-docs').upload(path, file)
      if (error) throw error
      onChange({ storage_path: path, file_name: file.name, mime_type: file.type || undefined })
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: uploading,
    // No accept restriction — any file type (PDF, Word, or anything else).
  })

  const removeFile = async () => {
    if (content.storage_path) {
      await supabase.storage.from('training-source-docs').remove([content.storage_path])
    }
    onChange({ storage_path: '', file_name: '' })
  }

  const removeLink = () => {
    onChange({ storage_path: '', file_name: '', link_url: undefined })
  }

  const viewFile = async () => {
    if (!content.storage_path) return
    const { data, error } = await supabase.storage
      .from('training-source-docs')
      .createSignedUrl(content.storage_path, 3600)
    if (error || !data) { toast.error('Could not open file'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  // Purely a display toggle — must NOT touch `content`. It used to clear
  // whichever mode's data wasn't currently shown, which meant just clicking
  // "Link to URL" on an already-uploaded file silently wiped storage_path in
  // memory, and clicking back to "Upload File" never restored it since there
  // was no link_url to detect. Saving after that broke the file reference
  // permanently even though the file itself was still sitting in storage.
  const setSourceMode = (next: Source) => setSource(next)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setSourceMode('upload')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            source === 'upload' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
          )}
        >
          <Upload className="h-4 w-4" /> Upload File
        </button>
        <button
          type="button"
          onClick={() => setSourceMode('link')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            source === 'link' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
          )}
        >
          <Link2 className="h-4 w-4" /> Link to URL
        </button>
      </div>

      {source === 'link' ? (
        content.link_url ? (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={content.file_name}
                onChange={e => onChange({ ...content, file_name: e.target.value })}
                placeholder="e.g. UCB Standard Office Training SOP"
              />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Link2 className="h-6 w-6 text-slate-400 shrink-0" />
              <p className="text-slate-500 text-sm flex-1 truncate">{content.link_url}</p>
              <a
                href={content.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View
              </a>
              <Button type="button" variant="outline" size="sm" onClick={removeLink}>
                <X className="h-3.5 w-3.5 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={content.file_name}
                onChange={e => onChange({ ...content, file_name: e.target.value })}
                placeholder="e.g. UCB Standard Office Training SOP"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL</Label>
              <Input
                value={content.link_url ?? ''}
                onChange={e => onChange({ storage_path: '', file_name: content.file_name, link_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <p className="text-xs text-slate-400">
              For an SOP or file already hosted in your own system — employees get a link, not a copy of the file.
            </p>
          </div>
        )
      ) : content.storage_path ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <FileText className="h-6 w-6 text-slate-400 shrink-0" />
          <p className="font-medium text-slate-900 text-sm flex-1 truncate">{content.file_name}</p>
          <button
            type="button"
            onClick={viewFile}
            className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View
          </button>
          <Button type="button" variant="outline" size="sm" onClick={removeFile}>
            <X className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 mx-auto text-slate-400 animate-spin mb-2" />
              <p className="text-sm text-slate-500">Uploading…</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">
                Drag & drop a file, or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">PDF, Word, or any other file type — no size limit</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
