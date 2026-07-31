import type { VideoContent } from '@/types'

export function VideoViewer({ content }: { content: VideoContent }) {
  const source = content.source ?? 'youtube'
  const hasVideo = source === 'upload' ? !!content.upload_url : !!content.youtube_id

  if (!hasVideo) {
    return (
      <div className="rounded-xl bg-slate-100 p-8 text-center text-slate-400">
        No video configured
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video bg-black">
        {source === 'upload' ? (
          <video src={content.upload_url} className="w-full h-full" controls />
        ) : (
          <iframe
            src={`https://www.youtube.com/embed/${content.youtube_id}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      {content.caption && (
        <p className="text-sm text-slate-500 text-center">{content.caption}</p>
      )}
    </div>
  )
}
