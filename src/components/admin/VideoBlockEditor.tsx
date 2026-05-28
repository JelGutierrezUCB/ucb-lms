'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { extractYoutubeId } from '@/lib/utils'
import type { VideoContent } from '@/types'

interface Props {
  content: VideoContent
  onChange: (content: VideoContent) => void
}

export function VideoBlockEditor({ content, onChange }: Props) {
  const [previewId, setPreviewId] = useState(content.youtube_id)

  const handleUrlChange = (url: string) => {
    const id = extractYoutubeId(url) ?? ''
    setPreviewId(id)
    onChange({ ...content, youtube_url: url, youtube_id: id })
  }

  return (
    <div className="space-y-4">
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
      </div>

      {previewId && (
        <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${previewId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
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
