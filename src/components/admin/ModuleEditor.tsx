'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Type, Video, HelpCircle, Save, ArrowLeft, Eye, EyeOff, Folder, FolderOpen, Check, X,
  Presentation, FileText, UserPlus, Archive, ArchiveRestore,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TextBlockEditor } from './TextBlockEditor'
import { VideoBlockEditor } from './VideoBlockEditor'
import { QuizBlockEditor } from './QuizBlockEditor'
import { SlideBlockEditor } from './SlideBlockEditor'
import { DocumentBlockEditor } from './DocumentBlockEditor'
import { AssignModuleDialog } from './AssignModuleDialog'
import { extractYoutubeId } from '@/lib/utils'
import type { Module, Section, ContentBlock, ContentBlockType, QuizContent, TextContent, VideoContent, SlidesContent, Group } from '@/types'
import { MODULE_CATEGORIES } from '@/types'

interface SectionWithBlocks extends Section {
  content_blocks: ContentBlock[]
}

interface Props {
  module?: Module
  initialGroups?: Group[]
  initialSections?: SectionWithBlocks[]
  createdBy: string
}

function generateId() {
  return `temp_${Math.random().toString(36).slice(2)}`
}

const UNGROUPED = '__ungrouped__'

type DurationUnit = 'minutes' | 'hours' | 'days'
const MINUTES_PER_UNIT: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 60 * 24 }
// estimated_minutes is always the value stored in the DB — these just convert
// what's displayed/typed in the "Estimated Duration" field to/from that.
const minutesToUnit = (minutes: number, unit: DurationUnit) => {
  const value = minutes / MINUTES_PER_UNIT[unit]
  return Math.round(value * 100) / 100 // up to 2 decimals, no float noise
}
const unitToMinutes = (value: number, unit: DurationUnit) => Math.max(1, Math.round(value * MINUTES_PER_UNIT[unit]))

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ')
const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

// Recommends a total duration from the module's actual content: real video
// file length where known, reading time from text, speaking time from
// narration scripts, and a per-question allowance for quizzes. Falls back to
// a flat estimate for content it can't measure (YouTube links, documents).
function estimateMinutesFromContent(sections: SectionWithBlocks[]): number {
  const READING_WPM = 200
  const NARRATION_WPM = 150
  const FALLBACK_VIDEO_MINUTES = 5
  const MINUTES_PER_QUIZ_QUESTION = 0.75
  const FALLBACK_DOCUMENT_MINUTES = 5

  let total = 0
  for (const section of sections) {
    if (section.is_archived) continue
    for (const block of section.content_blocks) {
      if (block.type === 'text') {
        total += wordCount(stripHtml((block.content as TextContent).html ?? '')) / READING_WPM
      } else if (block.type === 'video') {
        const vc = block.content as VideoContent
        total += vc.duration_seconds != null ? vc.duration_seconds / 60 : FALLBACK_VIDEO_MINUTES
      } else if (block.type === 'quiz') {
        total += ((block.content as QuizContent).questions?.length ?? 0) * MINUTES_PER_QUIZ_QUESTION
      } else if (block.type === 'slides') {
        for (const slide of (block.content as SlidesContent).slides ?? []) {
          total += wordCount(slide.narration ?? '') / NARRATION_WPM + 0.25 // + time to read bullets
        }
      } else if (block.type === 'document') {
        total += FALLBACK_DOCUMENT_MINUTES
      }
    }
  }
  return Math.max(1, Math.round(total))
}

export function ModuleEditor({ module: existingModule, initialGroups = [], initialSections = [], createdBy }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(existingModule?.title ?? '')
  const [description, setDescription] = useState(existingModule?.description ?? '')
  const [category, setCategory] = useState(existingModule?.category ?? 'general')
  const [estimatedMinutes, setEstimatedMinutes] = useState(existingModule?.estimated_minutes ?? 30)
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days'>('minutes')
  const [isPublished, setIsPublished] = useState(existingModule?.is_published ?? false)
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [sections, setSections] = useState<SectionWithBlocks[]>(initialSections)
  const recommendedMinutes = useMemo(() => estimateMinutesFromContent(sections), [sections])
  const [saving, setSaving] = useState(false)
  const [assigningSectionId, setAssigningSectionId] = useState<string | null>(null)
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(initialSections.map(s => s.id))
  )
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(initialGroups.map(g => g.id))
  )
  // Per-block collapse, independent of the training (section) it's in — lets
  // an admin fold up blocks they're done with so a training with many blocks
  // doesn't become an unwieldy wall of open editors while adding more.
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set())
  const toggleBlockCollapsed = (blockId: string) => {
    setCollapsedBlocks(prev => {
      const next = new Set(prev)
      next.has(blockId) ? next.delete(blockId) : next.add(blockId)
      return next
    })
  }
  const pendingScrollId = useRef<string | null>(null)

  useEffect(() => {
    if (!pendingScrollId.current) return
    const id = pendingScrollId.current
    pendingScrollId.current = null
    requestAnimationFrame(() => {
      document.getElementById(`training-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [sections])

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Groups ──────────────────────────────────────────────
  const addGroup = () => {
    const id = generateId()
    const newGroup: Group = {
      id,
      module_id: existingModule?.id ?? '',
      title: `Group ${groups.length + 1}`,
      order_index: groups.length,
      created_at: new Date().toISOString(),
    }
    setGroups(prev => [...prev, newGroup])
    setExpandedGroups(prev => new Set([...prev, id]))
  }

  const updateGroupTitle = (id: string, title: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, title } : g))
  }

  const removeGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id))
    // Un-assign sections rather than deleting them
    setSections(prev => prev.map(s => s.group_id === id ? { ...s, group_id: null } : s))
  }

  const moveGroupUp = (index: number) => {
    if (index === 0) return
    setGroups(prev => {
      const arr = [...prev]
      ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
      return arr
    })
  }

  const moveGroupDown = (index: number) => {
    setGroups(prev => {
      if (index >= prev.length - 1) return prev
      const arr = [...prev]
      ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
      return arr
    })
  }

  // ── Sections ────────────────────────────────────────────
  const addSection = (groupId: string | null) => {
    const id = generateId()
    const newSection: SectionWithBlocks = {
      id,
      module_id: existingModule?.id ?? '',
      group_id: groupId,
      title: `Training ${sections.length + 1}`,
      order_index: sections.length,
      is_archived: false,
      created_at: new Date().toISOString(),
      content_blocks: [],
    }
    setSections(prev => [...prev, newSection])
    setExpandedSections(prev => new Set([...prev, id]))
    pendingScrollId.current = id
  }

  // Jump straight into adding a training when arriving via the "Add Training" button on the module list.
  // We clean the "?addTraining=1" param with the plain History API (not router.replace) so we don't
  // trigger a Next.js navigation — that would re-fetch this page from the server and wipe out the
  // training we just added locally, since it hasn't been saved yet.
  const searchParams = useSearchParams()
  const autoAddedRef = useRef(false)
  useEffect(() => {
    if (autoAddedRef.current) return
    if (searchParams.get('addTraining') === '1') {
      autoAddedRef.current = true
      addSection(null)
      const cleanUrl = existingModule ? `/admin/modules/${existingModule.id}/edit` : '/admin/modules/new'
      window.history.replaceState(null, '', cleanUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const updateSection = (id: string, title: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, title } : s))
  }

  const moveSectionToGroup = (id: string, groupId: string | null) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, group_id: groupId } : s))
  }

  // Archiving hides a training from employees and progress/certificate
  // calculations without deleting it — it stays in `sections` (so its
  // content, completion history, and any assignments survive) and just
  // moves into the "Archived" list below, restorable at any time.
  const archiveSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, is_archived: true } : s))
  }

  const restoreSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, is_archived: false } : s))
  }

  // Only reachable from the Archived list — this is the actual, permanent
  // delete (removes the row entirely on next save).
  const deleteSectionPermanently = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id))
  }

  // Move within the section's own group (or within the ungrouped list) only
  const moveSection = (id: string, direction: 'up' | 'down') => {
    setSections(prev => {
      const section = prev.find(s => s.id === id)
      if (!section) return prev
      const siblings = prev.filter(s => (s.group_id ?? null) === (section.group_id ?? null) && !s.is_archived)
      const siblingIdx = siblings.findIndex(s => s.id === id)
      const swapWith = direction === 'up' ? siblings[siblingIdx - 1] : siblings[siblingIdx + 1]
      if (!swapWith) return prev
      const arr = [...prev]
      const i1 = arr.findIndex(s => s.id === id)
      const i2 = arr.findIndex(s => s.id === swapWith.id)
      ;[arr[i1], arr[i2]] = [arr[i2], arr[i1]]
      return arr
    })
  }

  const addBlock = (sectionId: string, type: ContentBlockType) => {
    const defaultContent = {
      text: { html: '<p>Enter your content here...</p>' },
      video: { source: 'youtube', youtube_url: '', youtube_id: '', caption: '' },
      quiz: { questions: [], passing_score: 70 } as QuizContent,
      slides: { slides: [] },
      document: { storage_path: '', file_name: '' },
    }
    const block: ContentBlock = {
      id: generateId(),
      section_id: sectionId,
      type,
      order_index: 0,
      title: '',
      content: defaultContent[type] as any,
      created_at: new Date().toISOString(),
    }
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, content_blocks: [...s.content_blocks, { ...block, order_index: s.content_blocks.length }] }
        : s
    ))
  }

  const updateBlock = (sectionId: string, blockId: string, content: any) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? {
            ...s,
            content_blocks: s.content_blocks.map(b =>
              b.id === blockId ? { ...b, content } : b
            )
          }
        : s
    ))
  }

  const updateBlockTitle = (sectionId: string, blockId: string, title: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? {
            ...s,
            content_blocks: s.content_blocks.map(b =>
              b.id === blockId ? { ...b, title } : b
            )
          }
        : s
    ))
  }

  const removeBlock = (sectionId: string, blockId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, content_blocks: s.content_blocks.filter(b => b.id !== blockId) }
        : s
    ))
  }

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Module title is required'); return }

    // Guard: verify session is still valid before trying to write
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Session expired — please log in again.')
      router.push('/login')
      return
    }

    setSaving(true)

    try {
      let moduleId = existingModule?.id

      if (moduleId) {
        const { error } = await supabase
          .from('modules')
          .update({ title, description, category, estimated_minutes: estimatedMinutes, is_published: isPublished })
          .eq('id', moduleId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('modules')
          .insert({ title, description, category, estimated_minutes: estimatedMinutes, is_published: isPublished, created_by: createdBy })
          .select()
          .single()
        if (error) throw error
        moduleId = data.id
      }

      // Upsert groups/sections/blocks by id instead of delete-everything-and-
      // recreate — the old approach gave every section and content block a
      // fresh id on every single save, which (via on-delete-cascade FKs)
      // silently wiped employee completion progress, per-training
      // assignments, and quiz attempt history each time a module was edited.
      const initialGroupIds = new Set(initialGroups.map(g => g.id))
      const currentGroupIds = new Set(groups.map(g => g.id))
      const removedGroupIds = [...initialGroupIds].filter(id => !currentGroupIds.has(id))
      if (removedGroupIds.length > 0) {
        await supabase.from('groups').delete().in('id', removedGroupIds)
      }

      const initialSectionIds = new Set(initialSections.map(s => s.id))
      const currentSectionIds = new Set(sections.map(s => s.id))
      const removedSectionIds = [...initialSectionIds].filter(id => !currentSectionIds.has(id))
      if (removedSectionIds.length > 0) {
        // Cascades to that section's own content_blocks — those genuinely
        // shouldn't survive a permanent delete.
        await supabase.from('sections').delete().in('id', removedSectionIds)
      }

      const groupIdMap: Record<string, string> = {}
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi]
        if (group.id.startsWith('temp_')) {
          const { data: groupData, error } = await supabase
            .from('groups')
            .insert({ module_id: moduleId, title: group.title, order_index: gi })
            .select()
            .single()
          if (error) throw error
          groupIdMap[group.id] = groupData.id
        } else {
          const { error } = await supabase
            .from('groups')
            .update({ title: group.title, order_index: gi })
            .eq('id', group.id)
          if (error) throw error
        }
      }

      const initialSectionById = new Map(initialSections.map(s => [s.id, s]))

      for (let si = 0; si < sections.length; si++) {
        const section = sections[si]
        const resolvedGroupId = section.group_id ? (groupIdMap[section.group_id] ?? section.group_id) : null
        let sectionId: string

        if (section.id.startsWith('temp_')) {
          const { data: sectionData, error } = await supabase
            .from('sections')
            .insert({ module_id: moduleId, group_id: resolvedGroupId, title: section.title, order_index: si, is_archived: section.is_archived })
            .select()
            .single()
          if (error) throw error
          sectionId = sectionData.id
        } else {
          sectionId = section.id
          const { error } = await supabase
            .from('sections')
            .update({ group_id: resolvedGroupId, title: section.title, order_index: si, is_archived: section.is_archived })
            .eq('id', sectionId)
          if (error) throw error
        }

        // Same upsert treatment for this section's content blocks.
        const initialBlockIds = new Set((initialSectionById.get(section.id)?.content_blocks ?? []).map(b => b.id))
        const currentBlockIds = new Set(section.content_blocks.map(b => b.id))
        const removedBlockIds = [...initialBlockIds].filter(id => !currentBlockIds.has(id))
        if (removedBlockIds.length > 0) {
          await supabase.from('content_blocks').delete().in('id', removedBlockIds)
        }

        for (let bi = 0; bi < section.content_blocks.length; bi++) {
          const block = section.content_blocks[bi]
          let content = block.content

          // Process video blocks to extract youtube ID
          if (block.type === 'video') {
            const vc = content as any
            const ytId = vc.source === 'upload' ? vc.youtube_id : (extractYoutubeId(vc.youtube_url ?? '') ?? '')
            content = { ...vc, youtube_id: ytId ?? '' }
          }

          if (block.id.startsWith('temp_')) {
            const { error } = await supabase
              .from('content_blocks')
              .insert({ section_id: sectionId, type: block.type, order_index: bi, title: block.title || null, content })
            if (error) throw error
          } else {
            const { error } = await supabase
              .from('content_blocks')
              .update({ order_index: bi, title: block.title || null, content })
              .eq('id', block.id)
            if (error) throw error
          }
        }
      }

      toast.success(existingModule ? 'Module saved!' : 'Module created!')
      if (!existingModule) {
        router.push(`/admin/modules/${moduleId}/edit`)
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const blockTypeIcons = {
    text: <Type className="h-4 w-4" />,
    video: <Video className="h-4 w-4" />,
    quiz: <HelpCircle className="h-4 w-4" />,
    slides: <Presentation className="h-4 w-4" />,
    document: <FileText className="h-4 w-4" />,
  }

  const blockTypeLabels = { text: 'Text', video: 'Video', quiz: 'Quiz', slides: 'Slides', document: 'File' }

  const presenceBadges = (section: SectionWithBlocks) => {
    const has = {
      text: section.content_blocks.some(b => b.type === 'text'),
      video: section.content_blocks.some(b => b.type === 'video'),
      quiz: section.content_blocks.some(b => b.type === 'quiz'),
      slides: section.content_blocks.some(b => b.type === 'slides'),
      document: section.content_blocks.some(b => b.type === 'document'),
    }
    const items: { key: keyof typeof has; label: string }[] = [
      { key: 'text', label: 'Read' },
      { key: 'video', label: 'Video' },
      { key: 'quiz', label: 'Quiz' },
      { key: 'slides', label: 'Slides' },
      { key: 'document', label: 'File' },
    ]
    return (
      <div className="flex items-center gap-2.5 shrink-0">
        {items.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1 text-xs text-slate-400" title={label}>
            {has[key]
              ? <Check className="h-3.5 w-3.5 text-green-500" />
              : <X className="h-3.5 w-3.5 text-slate-300" />}
            <span className="hidden sm:inline">{label}</span>
          </span>
        ))}
      </div>
    )
  }

  const renderSection = (section: SectionWithBlocks, siblings: SectionWithBlocks[]) => {
    const isExpanded = expandedSections.has(section.id)
    const siblingIdx = siblings.findIndex(s => s.id === section.id)
    return (
      <Card key={section.id} id={`training-${section.id}`}>
        {/* Section header */}
        <div
          className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 rounded-xl"
          onClick={() => toggleSection(section.id)}
        >
          <GripVertical className="h-5 w-5 text-slate-300 shrink-0" />
          <div className="flex-1 min-w-0">
            <Input
              value={section.title}
              onChange={e => { e.stopPropagation(); updateSection(section.id, e.target.value) }}
              onClick={e => e.stopPropagation()}
              className="border-0 bg-transparent p-0 h-auto text-base font-semibold focus:ring-0 focus:outline-none"
              placeholder="Training title..."
            />
          </div>
          {presenceBadges(section)}
          <div className="flex items-center gap-1">
            {existingModule && !section.id.startsWith('temp_') && (
              <button
                onClick={e => { e.stopPropagation(); setAssigningSectionId(section.id) }}
                title="Assign this training to employees"
                className="p-1 rounded text-slate-400 hover:text-blue-600 mr-1"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); moveSection(section.id, 'up') }}
              disabled={siblingIdx === 0}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); moveSection(section.id, 'down') }}
              disabled={siblingIdx === siblings.length - 1}
              className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); archiveSection(section.id) }}
              title="Archive this training — hides it from employees, keeps its content and history, restorable anytime"
              className="p-1 rounded text-slate-400 hover:text-amber-600 ml-1"
            >
              <Archive className="h-4 w-4" />
            </button>
            {isExpanded
              ? <ChevronUp className="h-4 w-4 text-slate-400 ml-1" />
              : <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
            }
          </div>
        </div>

        {/* Section content */}
        {isExpanded && (
          <div className="px-5 pb-5 space-y-4">
            <Separator />

            {groups.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500 shrink-0">Group</Label>
                <Select
                  value={section.group_id ?? UNGROUPED}
                  onValueChange={v => moveSectionToGroup(section.id, v === UNGROUPED ? null : v)}
                >
                  <SelectTrigger className="h-8 w-56 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNGROUPED}>No group (top-level)</SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {section.content_blocks.map((block, bi) => {
              const isBlockCollapsed = collapsedBlocks.has(block.id)
              return (
              <div key={block.id} className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Block header */}
                <div
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 cursor-pointer"
                  onClick={() => toggleBlockCollapsed(block.id)}
                >
                  <span className="text-slate-400">{blockTypeIcons[block.type]}</span>
                  <span className="text-sm font-medium text-slate-700">{blockTypeLabels[block.type]}</span>
                  <span className="text-xs text-slate-400 ml-1">Block {bi + 1}</span>
                  {block.title && (
                    <span className="text-xs text-slate-400 truncate max-w-xs">— {block.title}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); removeBlock(section.id, block.id) }}
                      className="p-1 rounded text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isBlockCollapsed
                      ? <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
                      : <ChevronUp className="h-4 w-4 text-slate-400 ml-1" />
                    }
                  </div>
                </div>

                {/* Block editor */}
                {!isBlockCollapsed && (
                <div className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title shown to employees (optional)</Label>
                    <Input
                      value={block.title ?? ''}
                      onChange={e => updateBlockTitle(section.id, block.id, e.target.value)}
                      placeholder={
                        block.type === 'document'
                          ? 'e.g. Standard Office Training SOP'
                          : `e.g. describe this ${blockTypeLabels[block.type].toLowerCase()} block...`
                      }
                    />
                  </div>
                  {block.type === 'text' && (
                    <TextBlockEditor
                      content={block.content as any}
                      onChange={c => updateBlock(section.id, block.id, c)}
                    />
                  )}
                  {block.type === 'video' && (
                    <VideoBlockEditor
                      content={block.content as any}
                      onChange={c => updateBlock(section.id, block.id, c)}
                    />
                  )}
                  {block.type === 'quiz' && (
                    <QuizBlockEditor
                      content={block.content as any}
                      onChange={c => updateBlock(section.id, block.id, c)}
                    />
                  )}
                  {block.type === 'slides' && (
                    <SlideBlockEditor
                      content={block.content as any}
                      onChange={c => updateBlock(section.id, block.id, c)}
                    />
                  )}
                  {block.type === 'document' && (
                    <DocumentBlockEditor
                      content={block.content as any}
                      onChange={c => updateBlock(section.id, block.id, c)}
                    />
                  )}
                </div>
                )}
              </div>
              )
            })}

            {/* Add block buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-500 mr-1">Add block:</span>
              {(['text', 'video', 'quiz', 'slides', 'document'] as ContentBlockType[]).map(type => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => addBlock(section.id, type)}
                >
                  {blockTypeIcons[type]}
                  <span className="ml-1.5">{blockTypeLabels[type]}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
    )
  }

  const ungroupedSections = sections.filter(s => !s.group_id && !s.is_archived)
  const archivedSections = sections.filter(s => s.is_archived)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/admin/modules')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Modules
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsPublished(p => !p)}>
            {isPublished ? <><EyeOff className="h-4 w-4 mr-2" />Unpublish</> : <><Eye className="h-4 w-4 mr-2" />Publish</>}
          </Button>
          <Button loading={saving} onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Module
          </Button>
        </div>
      </div>

      {/* Module metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Module Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Warehouse Safety Training" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of what this training covers..."
              rows={3}
            />
          </div>
          <div className="space-y-1.5 max-w-lg">
            <Label>Estimated Duration</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                type="number"
                min={0.01}
                step="any"
                value={minutesToUnit(estimatedMinutes, durationUnit)}
                onChange={e => setEstimatedMinutes(unitToMinutes(Number(e.target.value), durationUnit))}
                className="max-w-[7rem]"
              />
              <Select value={durationUnit} onValueChange={v => setDurationUnit(v as DurationUnit)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
              {recommendedMinutes !== estimatedMinutes && (
                <button
                  type="button"
                  onClick={() => setEstimatedMinutes(recommendedMinutes)}
                  className="text-xs text-blue-700 hover:underline whitespace-nowrap"
                >
                  Use recommended: {recommendedMinutes} min
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Recommendation is based on actual video length (uploaded files only), reading time,
              quiz length, and narrated slides currently in this module.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isPublished ? 'success' : 'outline'}>
              {isPublished ? 'Published — visible to employees' : 'Draft — not visible to employees'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Groups + Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Trainings <span className="text-slate-400 font-normal">({sections.length - archivedSections.length} training{sections.length - archivedSections.length !== 1 ? 's' : ''}{groups.length > 0 ? `, ${groups.length} group${groups.length !== 1 ? 's' : ''}` : ''})</span>
          </h2>
          <div className="flex items-center gap-2">
            <Button onClick={() => addSection(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Training
            </Button>
            <Button variant="outline" onClick={addGroup}>
              <Folder className="h-4 w-4 mr-2" />
              Add Group
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-500 -mt-2">
          A <strong>training</strong> is a lesson employees complete (text, video, and/or a quiz). A <strong>group</strong> is
          an optional folder for organizing many trainings — only add one if you have several related trainings to cluster together.
        </p>

        {sections.length === 0 && groups.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-500">No trainings yet. Add your first training to get started.</p>
              <Button className="mt-4" onClick={() => addSection(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Training
              </Button>
            </div>
          </Card>
        )}

        {/* Groups (collapsible folders) */}
        {groups.map((group, gi) => {
          const isExpanded = expandedGroups.has(group.id)
          const groupSections = sections.filter(s => s.group_id === group.id && !s.is_archived)
          return (
            <Card key={group.id} className="overflow-hidden">
              <div
                className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50"
                onClick={() => toggleGroup(group.id)}
              >
                {isExpanded
                  ? <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
                  : <Folder className="h-5 w-5 text-amber-500 shrink-0" />}
                <Input
                  value={group.title}
                  onChange={e => { e.stopPropagation(); updateGroupTitle(group.id, e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  className="border-0 bg-transparent p-0 h-auto flex-1 text-base font-bold focus:ring-0 focus:outline-none"
                />
                <Badge variant="outline" className="shrink-0">
                  {groupSections.length} training{groupSections.length !== 1 ? 's' : ''}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); moveGroupUp(gi) }}
                    disabled={gi === 0}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); moveGroupDown(gi) }}
                    disabled={gi === groups.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); removeGroup(group.id) }}
                    className="p-1 rounded text-slate-400 hover:text-red-600 ml-1"
                    title="Delete group (trainings move to top-level)"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-3 bg-slate-50/60">
                  {groupSections.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">No trainings in this group yet.</p>
                  ) : groupSections.map(s => renderSection(s, groupSections))}
                  <Button variant="outline" size="sm" onClick={() => addSection(group.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Add Training to Group
                  </Button>
                </div>
              )}
            </Card>
          )
        })}

        {/* Ungrouped sections */}
        {ungroupedSections.map(s => renderSection(s, ungroupedSections))}
      </div>

      {archivedSections.length > 0 && (
        <Card>
          <div
            className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 rounded-xl"
            onClick={() => setArchivedExpanded(o => !o)}
          >
            <Archive className="h-5 w-5 text-slate-400 shrink-0" />
            <p className="font-semibold text-slate-700 flex-1">
              Archived Trainings ({archivedSections.length})
            </p>
            <span className="text-xs text-slate-400">
              Hidden from employees — content and completion history are kept
            </span>
            {archivedExpanded
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />
            }
          </div>
          {archivedExpanded && (
            <div className="px-5 pb-5 space-y-2">
              <Separator />
              {archivedSections.map(section => (
                <div
                  key={section.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <p className="flex-1 min-w-0 truncate text-sm text-slate-600">{section.title || 'Untitled training'}</p>
                  <span className="text-xs text-slate-400 shrink-0">
                    {section.content_blocks.length} block{section.content_blocks.length !== 1 ? 's' : ''}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => restoreSection(section.id)}>
                    <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" /> Restore
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 border-red-200 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`Permanently delete "${section.title || 'this training'}"? This can't be undone.`)) {
                        deleteSectionPermanently(section.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Permanently
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {(sections.length > 0 || groups.length > 0) && (
        <div className="flex justify-end pb-8">
          <Button size="lg" loading={saving} onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Module
          </Button>
        </div>
      )}

      {existingModule && assigningSectionId && (
        <AssignModuleDialog
          moduleId={existingModule.id}
          moduleTitle={existingModule.title}
          preselectSectionId={assigningSectionId}
          open={!!assigningSectionId}
          onOpenChange={open => !open && setAssigningSectionId(null)}
        />
      )}
    </div>
  )
}
