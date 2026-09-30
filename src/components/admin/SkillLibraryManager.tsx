'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ListTree, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { X } from 'lucide-react'
import type { Module, ModuleSkill, Skill } from '@/types'

type ModuleLite = Pick<Module, 'id' | 'title'>

interface Props {
  skills: Skill[]
  modules: ModuleLite[]
  moduleSkills: ModuleSkill[]
  currentUserId: string
}

export function SkillLibraryManager({ skills, modules, moduleSkills, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Skill | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Skill | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const categories = useMemo(() => [...new Set(skills.map(s => s.category).filter(Boolean))].sort() as string[], [skills])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return skills
    return skills.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.category ?? '').toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q)
    )
  }, [skills, query])

  const grouped = useMemo(() => {
    const map: Record<string, Skill[]> = {}
    for (const s of filtered) {
      const cat = s.category || 'Uncategorized'
      if (!map[cat]) map[cat] = []
      map[cat].push(s)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  async function deleteSkill() {
    if (!deleting) return
    setDeleteLoading(true)
    const { error } = await supabase.from('skills').delete().eq('id', deleting.id)
    if (error) { toast.error(error.message) } else { toast.success('Skill deleted'); router.refresh() }
    setDeleting(null)
    setDeleteLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search skills…" className="pl-9" />
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4 mr-2" /> New skill
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <ListTree className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No skills yet</p>
            <p className="text-slate-400 text-sm mt-1">Build out the skill library, then set required levels per job role.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{category}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {items.map(skill => (
                  <Card key={skill.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900">{skill.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setEditing(skill)} className="p-1 text-slate-400 hover:text-slate-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleting(skill)} className="p-1 text-slate-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {skill.description && <p className="text-sm text-slate-500 line-clamp-2">{skill.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SkillEditor
          key={editing === 'new' ? 'new' : editing.id}
          skill={editing === 'new' ? null : editing}
          categories={categories}
          modules={modules}
          moduleSkills={editing === 'new' ? [] : moduleSkills.filter(ms => ms.skill_id === editing.id)}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete skill</DialogTitle>
            <DialogDescription>
              Delete <strong>{deleting?.name}</strong>? It's removed from any job role requirements and training
              tags, and from anyone's skill history. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={deleteLoading} onClick={deleteSkill}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------

function SkillEditor({
  skill, categories, modules, moduleSkills, currentUserId, onClose,
}: {
  skill: Skill | null
  categories: string[]
  modules: ModuleLite[]
  moduleSkills: ModuleSkill[]
  currentUserId: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState(skill?.name ?? '')
  const [category, setCategory] = useState(skill?.category ?? '')
  const [description, setDescription] = useState(skill?.description ?? '')
  const [moduleIds, setModuleIds] = useState<string[]>(moduleSkills.map(ms => ms.module_id))
  const [saving, setSaving] = useState(false)

  const moduleById = useMemo(() => new Map(modules.map(m => [m.id, m])), [modules])
  const available = modules.filter(m => !moduleIds.includes(m.id))

  async function save() {
    if (!name.trim()) { toast.error('Give the skill a name'); return }
    setSaving(true)
    try {
      const fields = { name: name.trim(), category: category.trim() || null, description: description.trim() || null }
      let skillId = skill?.id
      if (skillId) {
        const { error } = await supabase.from('skills').update(fields).eq('id', skillId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('skills').insert({ ...fields, created_by: currentUserId }).select('id').single()
        if (error) throw error
        skillId = data.id
      }

      // Replace the set of trainings that build this skill: delete then
      // re-insert, never per-row, so a half-saved set can't happen.
      const { error: delError } = await supabase.from('module_skills').delete().eq('skill_id', skillId)
      if (delError) throw delError
      if (moduleIds.length > 0) {
        const { error } = await supabase
          .from('module_skills')
          .insert(moduleIds.map(module_id => ({ module_id, skill_id: skillId })))
        if (error) throw error
      }

      toast.success(skill ? 'Skill updated' : 'Skill created')
      onClose()
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save skill')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{skill ? 'Edit skill' : 'New skill'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Forklift Operation" />
          </div>
          <div className="space-y-1.5">
            <Label>Category (optional)</Label>
            <Input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Warehouse Safety"
              list="skill-categories"
            />
            <datalist id="skill-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Trainings that build this skill</Label>
            {moduleIds.length > 0 && (
              <ul className="rounded-lg border border-slate-200 divide-y divide-slate-100 mb-2">
                {moduleIds.map(id => (
                  <li key={id} className="flex items-center gap-2 px-3 py-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-800">{moduleById.get(id)?.title ?? 'Unavailable course'}</p>
                    <button
                      type="button"
                      onClick={() => setModuleIds(prev => prev.filter(m => m !== id))}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      aria-label="Remove training"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Select value="" onValueChange={v => { if (v) setModuleIds(prev => [...prev, v]) }}>
              <SelectTrigger disabled={available.length === 0}>
                <SelectValue placeholder={available.length === 0 ? 'Every training already tagged' : 'Add a training…'} />
              </SelectTrigger>
              <SelectContent>
                {available.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>{skill ? 'Save changes' : 'Create skill'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
