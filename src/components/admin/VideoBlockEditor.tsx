'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Loader2, Upload, Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { extractYoutubeId } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { VideoContent, VideoSource } from '@/types'

interface Props {
  content: VideoContent
  onChange: (content: VideoContent) => void
}

const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB, matches storage bucket limit

export function VideoBlockEditor({ content, onChange }: Props) {
  const source: VideoSource = content.source ?? 'youtube'
  const [previewId, setPreviewId] = useState(content.youtube_id)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const handleUrlChange = (url: string) => {
    const id = extractYoutubeId(url) ?? ''
    setPreviewId(id)
    onChange({ ...content, source: 'youtube', youtube_url: url, youtube_id: id })
  }

  const setSource = (next: VideoSource) => {
    onChange({ ...content, source: next })
  }

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('training-videos').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('training-videos').getPublicUrl(path)
      onChange({ ...content, source: 'upload', upload_url: data.publicUrl, upload_path: path })
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, onChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/webm': ['.webm'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
    },
    maxFiles: 1,
    maxSize: MAX_VIDEO_SIZE,
    disabled: uploading,
  })

  const removeUpload = async () => {
    if (content.upload_path) {
      await supabase.storage.from('training-videos').remove([content.upload_path])
    }
    onChange({ ...content, upload_url: undefined, upload_path: undefined })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setSource('youtube')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            source === 'youtube' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
          )}
        >
          <Video className="h-4 w-4" /> YouTube Link
        </button>
        <button
          type="button"
          onClick={() => setSource('upload')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            source === 'upload' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
          )}
        >
          <Upload className="h-4 w-4" /> Upload File
        </button>
      </div>

      {source === 'youtube' && (
        <div className="space-y-1.5">
          <Label>YouTube URL</Label>
          <Input
            value={content.youtube_url}
            onChange={e => handleUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          {content.youtube_url && !previewId && (
            <p className="text-xs text-red-500">Could not extract YouTube ID from this URL</p>
          )}
          {previewId && (
            <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video mt-2">
              <iframe
                src={`https://www.youtube.com/embed/${previewId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}

      {source === 'upload' && (
        <div className="space-y-1.5">
          <Label>Video File</Label>
          {content.upload_url ? (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video bg-black">
                <video src={content.upload_url} className="w-full h-full" controls />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={removeUpload}>
                <X className="h-3.5 w-3.5 mr-1" /> Remove video
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
                    Drag & drop a video, or click to browse
                  </p>
                  <p className="text-xs text-slate-400 mt-1">MP4, WebM, MOV, AVI — up to 100MB</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Caption (optional)</Label>
        <Input
          value={content.caption ?? ''}
          onChange={e => onChange({ ...content, caption: e.target.value })}
          placeholder="Brief description of the video content..."
        />
      </div>
    </div>
  )
}
