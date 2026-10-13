'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ExternalLink, Library, Pencil, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { RESOURCE_TYPES } from '@/types'
import type { LearningResource, ResourceSkill, ResourceType, Skill } from '@/types'

interface Props {
  resources: LearningResource[]
  resourceSkills: ResourceSkill[]
  skills: Skill[]
  currentUserId: string
}

export function LearningResourcesManager({ resources, resourceSkills, skills, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState<LearningResource | 'new' | null>(null)
  const skillById = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills])
  const typeLabel = (t: ResourceType) => RESOURCE_TYPES.find(r => r.value === t)?.label ?? t

  async function remove(r: LearningResource) {
    if (!confirm(`Delete "${r.title}"? It stops being recommended and anyone's "completed" mark for it is removed.`)) return
    const { error } = await supabase.from('learning_resources').delete().eq('id', r.id)
    if (error) { toast.error(error.message); return }
    toast.success('Resource deleted')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500 max-w-2xl">
          Public courses, lessons and recorded webinars from outside the portal. Tag them with the skills they build —
          they&apos;re recommended to people who have a gap in those skills, or when a supervisor recommends one.
        </p>
        <Button onClick={() => setEditing('new')} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" /> New resource
        </Button>
      </div>

      {resources.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <Library className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No external resources yet</p>
            <p className="text-slate-400 text-sm mt-1">Add a link to a public course, lesson or webinar recording.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {resources.map(r => {
            const tagged = resourceSkills.filter(rs => rs.resource_id === r.id).map(rs => skillById.get(rs.skill_id)).filter((s): s is Skill => !!s)
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{r.title}</p>
                      <a
                        href={r.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline max-w-full"
                      >
                        <span className="truncate">{r.url}</span> <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditing(r)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(r)} className="p-1 text-slate-400 hover:text-red-600" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{typeLabel(r.resource_type)}</Badge>
                    {r.provider && <Badge variant="outline">{r.provider}</Badge>}
                    {r.estimated_minutes ? <Badge variant="outline">{r.estimated_minutes} min</Badge> : null}
                    <Badge variant={r.is_published ? 'success' : 'outline'}>{r.is_published ? 'Published' : 'Draft'}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {tagged.length > 0 ? `Builds: ${tagged.map(s => s.name).join(', ')}` : 'No skills tagged — only recommendable by a supervisor'}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <ResourceEditor
          key={editing === 'new' ? 'new' : editing.id}
          resource={editing === 'new' ? null : editing}
          initialSkillIds={editing === 'new' ? [] : resourceSkills.filter(rs => rs.resource_id === editing.id).map(rs => rs.skill_id)}
          skills={skills}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ResourceEditor({
  resource, initialSkillIds, skills, currentUserId, onClose,
}: {
  resource: LearningResource | null
  initialSkillIds: string[]
  skills: Skill[]
  currentUserId: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState(resource?.title ?? '')
  const [url, setUrl] = useState(resource?.url ?? '')
  const [provider, setProvider] = useState(resource?.provider ?? '')
  const [type, setType] = useState<ResourceType>(resource?.resource_type ?? 'course')
  const [minutes, setMinutes] = useState(resource?.estimated_minutes ? String(resource.estimated_minutes) : '')
  const [description, setDescription] = useState(resource?.description ?? '')
  const [published, setPublished] = useState(resource?.is_published ?? true)
  const [skillIds, setSkillIds] = useState<string[]>(initialSkillIds)
  const [saving, setSaving] = useState(false)

  const skillById = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills])
  const available = skills.filter(s => !skillIds.includes(s.id))

  async function save() {
    if (!title.trim()) { toast.error('Give it a title'); return }
    let cleanUrl: string
    try {
      const parsed = new URL(url.trim())
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error()
      cleanUrl = parsed.toString()
    } catch {
      toast.error('Enter a full link starting with http:// or https://')
      return
    }

    setSaving(true)
    try {
      const fields = {
        title: title.trim(),
        url: cleanUrl,
        provider: provider.trim() || null,
        resource_type: type,
        estimated_minutes: minutes.trim() ? Math.max(1, parseInt(minutes, 10) || 0) || null : null,
        description: description.trim() || null,
        is_published: published,
      }
      let resourceId = resource?.id
      if (resourceId) {
        const { error } = await supabase.from('learning_resources').update(fields).eq('id', resourceId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('learning_resources')
          .insert({ ...fields, created_by: currentUserId })
          .select('id')
          .single()
        if (error) throw error
        resourceId = data.id
      }

      const { error: delError } = await supabase.from('resource_skills').delete().eq('resource_id', resourceId)
      if (delError) throw delError
      if (skillIds.length > 0) {
        const { error } = await supabase
          .from('resource_skills')
          .insert(skillIds.map(skill_id => ({ resource_id: resourceId, skill_id })))
        if (error) throw error
      }

      toast.success(resource ? 'Resource updated' : 'Resource added')
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save resource')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resource ? 'Edit resource' : 'New external resource'}</DialogTitle>
          <DialogDescription>A link people open in a new tab — progress outside the portal is self-reported.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Forklift Safety Basics" />
          </div>
          <div className="space-y-1.5">
            <Label>Link</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={v => setType(v as ResourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Minutes (optional)</Label>
              <Input type="number" min={1} value={minutes} onChange={e => setMinutes(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Provider (optional)</Label>
            <Input value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. OSHA, Coursera, YouTube" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Skills this builds</Label>
            {skillIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {skillIds.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-600 py-1 pl-3 pr-1.5 text-sm text-white">
                    {skillById.get(id)?.name ?? 'Unknown'}
                    <button
                      type="button"
                      onClick={() => setSkillIds(prev => prev.filter(s => s !== id))}
                      className="rounded-full p-0.5 hover:bg-blue-700"
                      aria-label="Remove skill"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Select value="" onValueChange={v => { if (v) setSkillIds(prev => [...prev, v]) }}>
              <SelectTrigger disabled={available.length === 0}>
                <SelectValue placeholder={skills.length === 0 ? 'Add skills in the Skill Library first' : available.length === 0 ? 'Every skill tagged' : 'Add a skill…'} />
              </SelectTrigger>
              <SelectContent>
                {available.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <Checkbox checked={published} onCheckedChange={v => setPublished(v === true)} />
            Published (recommendable to employees)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>{resource ? 'Save changes' : 'Add resource'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
