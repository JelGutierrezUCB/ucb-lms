'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Loader2, Upload, FileText, X, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { DocumentContent } from '@/types'

interface Props {
  content: DocumentContent
  onChange: (content: DocumentContent) => void
}

export function DocumentBlockEditor({ content, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
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

  const viewFile = async () => {
    if (!content.storage_path) return
    const { data, error } = await supabase.storage
      .from('training-source-docs')
      .createSignedUrl(content.storage_path, 3600)
    if (error || !data) { toast.error('Could not open file'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-1.5">
      {content.storage_path ? (
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
