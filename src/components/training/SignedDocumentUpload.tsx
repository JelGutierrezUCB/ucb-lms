'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Loader2, Upload, FileCheck, ExternalLink, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { DocumentUpload } from '@/types'

interface Props {
  blockId: string
  userId: string
  // Notifies the parent (TrainingPlayer) so it can gate "Mark Complete" on
  // every required upload in the section being present — kept in sync on
  // mount (existing upload found or not) and on every upload/replace/remove.
  onStatusChange: (uploaded: boolean) => void
}

// Fixed, extension-less path per (user, block) — re-uploading overwrites the
// same storage object via upsert instead of accumulating orphaned files.
const pathFor = (userId: string, blockId: string) => `${userId}/${blockId}`

export function SignedDocumentUpload({ blockId, userId, onStatusChange }: Props) {
  const [existing, setExisting] = useState<DocumentUpload | null | undefined>(undefined) // undefined = still loading
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    supabase
      .from('document_uploads')
      .select('*')
      .eq('user_id', userId)
      .eq('content_block_id', blockId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setExisting(data as DocumentUpload | null)
        onStatusChange(!!data)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, userId])

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setUploading(true)
    try {
      const path = pathFor(userId, blockId)
      const { error: uploadError } = await supabase.storage
        .from('signed-documents')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data, error: dbError } = await supabase
        .from('document_uploads')
        .upsert(
          { user_id: userId, content_block_id: blockId, storage_path: path, file_name: file.name, uploaded_at: new Date().toISOString() },
          { onConflict: 'user_id,content_block_id' }
        )
        .select()
        .single()
      if (dbError) throw dbError

      setExisting(data as DocumentUpload)
      onStatusChange(true)
      toast.success('Signed document uploaded')
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, userId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    disabled: uploading,
  })

  const viewFile = async () => {
    if (!existing) return
    const { data, error } = await supabase.storage
      .from('signed-documents')
      .createSignedUrl(existing.storage_path, 3600)
    if (error || !data) { toast.error('Could not open file'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  if (existing === undefined) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (existing) {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-4 space-y-2">
        <div className="flex items-center gap-3">
          <FileCheck className="h-6 w-6 text-green-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 text-sm truncate">{existing.file_name}</p>
            <p className="text-xs text-slate-500">
              Signed copy uploaded {new Date(existing.uploaded_at).toLocaleDateString()}
            </p>
          </div>
          <button
            type="button"
            onClick={viewFile}
            className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View
          </button>
        </div>
        <div
          {...getRootProps()}
          className={cn(
            'flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer w-fit',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <RotateCcw className="h-3.5 w-3.5" /> Replace with a different file
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-blue-400 bg-blue-50' : 'border-amber-300 bg-amber-50/50 hover:border-amber-400',
        uploading && 'pointer-events-none opacity-60'
      )}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <>
          <Loader2 className="h-7 w-7 mx-auto text-slate-400 animate-spin mb-2" />
          <p className="text-sm text-slate-500">Uploading…</p>
        </>
      ) : (
        <>
          <Upload className="h-7 w-7 mx-auto text-amber-500 mb-2" />
          <p className="text-sm font-medium text-slate-700">
            Upload your signed copy of this document
          </p>
          <p className="text-xs text-slate-400 mt-1">Drag & drop, or click to browse — required to complete this training</p>
        </>
      )}
    </div>
  )
}
