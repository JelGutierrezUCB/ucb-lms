'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Eye, EyeOff, BookOpen, Clock, UserPlus, Archive, ArchiveRestore, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { getCategoryColor, getCategoryLabel, formatDate } from '@/lib/utils'
import { isProtectedModule } from '@/lib/protected-modules'
import { AssignModuleDialog } from './AssignModuleDialog'
import type { Module } from '@/types'

export function ModuleList({ initialModules }: { initialModules: Module[] }) {
  const [modules, setModules] = useState(initialModules)
  const [deleteModule, setDeleteModule] = useState<Module | null>(null)
  const [assigningModule, setAssigningModule] = useState<Module | null>(null)
  const [loading, setLoading] = useState(false)
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const supabase = createClient()

  const activeModules = modules.filter(m => !m.is_archived)
  const archivedModules = modules.filter(m => m.is_archived)

  const handleTogglePublish = async (mod: Module) => {
    const { data, error } = await supabase
      .from('modules')
      .update({ is_published: !mod.is_published })
      .eq('id', mod.id)
      .select()
      .single()

    if (error) { toast.error(error.message); return }
    setModules(prev => prev.map(m => m.id === mod.id ? data : m))
    toast.success(data.is_published ? 'Module published' : 'Module unpublished')
  }

  // Archiving retires a course from active use: it drops out of the catalog,
  // assignment rules, and journey builder (forcing it unpublished covers all
  // of those at once), but its content, history, and certificates stay put —
  // unlike Delete, this is fully reversible.
  const handleArchive = async (mod: Module) => {
    const { data, error } = await supabase
      .from('modules')
      .update({ is_archived: true, is_published: false })
      .eq('id', mod.id)
      .select()
      .single()

    if (error) { toast.error(error.message); return }
    setModules(prev => prev.map(m => m.id === mod.id ? data : m))
    toast.success('Module archived')
  }

  const handleRestore = async (mod: Module) => {
    const { data, error } = await supabase
      .from('modules')
      .update({ is_archived: false })
      .eq('id', mod.id)
      .select()
      .single()

    if (error) { toast.error(error.message); return }
    setModules(prev => prev.map(m => m.id === mod.id ? data : m))
    toast.success('Module restored — republish it when it\'s ready for employees')
  }

  const handleDelete = async () => {
    if (!deleteModule) return
    setLoading(true)
    const { error } = await supabase.from('modules').delete().eq('id', deleteModule.id)
    if (error) { toast.error(error.message) }
    else {
      setModules(prev => prev.filter(m => m.id !== deleteModule.id))
      toast.success('Module deleted')
    }
    setDeleteModule(null)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-600">{activeModules.length} module{activeModules.length !== 1 ? 's' : ''} total</p>
        <Link href="/admin/modules/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Module
          </Button>
        </Link>
      </div>

      {activeModules.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No modules yet</p>
            <p className="text-slate-400 text-sm mt-1">Create your first training module to get started</p>
            <Link href="/admin/modules/new">
              <Button className="mt-4">Create Module</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeModules.map(mod => (
            <Card key={mod.id} className="flex flex-col">
              {/* Color bar */}
              <div
                className="h-2 rounded-t-xl"
                style={{ backgroundColor: getCategoryColor(mod.category) }}
              />
              <div className="flex flex-col flex-1 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{mod.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        style={{ backgroundColor: `${getCategoryColor(mod.category)}20`, color: getCategoryColor(mod.category) }}
                      >
                        {getCategoryLabel(mod.category)}
                      </Badge>
                      {mod.module_type === 'checklist' && (
                        <Badge variant="outline">Checklist</Badge>
                      )}
                      <Badge variant={mod.is_published ? 'success' : 'outline'}>
                        {mod.is_published ? 'Published' : 'Draft'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {mod.description && (
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{mod.description}</p>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {mod.estimated_minutes} min
                  </span>
                  <span>Created {formatDate(mod.created_at)}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/modules/${mod.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit Module
                      </Button>
                    </Link>
                    <Link href={`/admin/modules/${mod.id}/edit?addTraining=1`}>
                      <Button size="sm" title="Add Training" className="px-2.5">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssigningModule(mod)}
                      title={mod.is_published ? 'Assign to employees' : 'Assign to employees (won\'t be visible to them until published)'}
                      className="gap-1.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Assign
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTogglePublish(mod)}
                      title={mod.is_published ? 'Unpublish' : 'Publish'}
                      className="gap-1.5"
                    >
                      {mod.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {mod.is_published ? 'Unpublish' : 'Publish'}
                    </Button>
                    {!isProtectedModule(mod.id) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(mod)}
                        title="Archive — hides it from employees and admin pickers, keeps its content and history, restorable anytime"
                        className="gap-1.5 ml-auto"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteModule(mod)}
                      className={`gap-1.5 text-red-500 border-red-200 hover:text-red-600 hover:bg-red-50 ${isProtectedModule(mod.id) ? 'ml-auto' : ''}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove Module
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {archivedModules.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setArchivedExpanded(o => !o)}
            className="w-full flex items-center gap-2 px-5 py-3.5 text-left"
          >
            <Archive className="h-5 w-5 text-slate-400 shrink-0" />
            <span className="flex-1 font-medium text-slate-700">
              Archived Courses ({archivedModules.length})
            </span>
            {archivedExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          {archivedExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 px-5 pb-5">
              {archivedModules.map(mod => (
                <Card key={mod.id} className="flex flex-col opacity-80">
                  <div className="h-2 rounded-t-xl bg-slate-300" />
                  <div className="flex flex-col flex-1 p-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{mod.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          style={{ backgroundColor: `${getCategoryColor(mod.category)}20`, color: getCategoryColor(mod.category) }}
                        >
                          {getCategoryLabel(mod.category)}
                        </Badge>
                        <Badge variant="outline">Archived</Badge>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(mod)}
                        className="gap-1.5 flex-1"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteModule(mod)}
                        className="gap-1.5 text-red-500 border-red-200 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {assigningModule && (
        <AssignModuleDialog
          moduleId={assigningModule.id}
          moduleTitle={assigningModule.title}
          open={!!assigningModule}
          onOpenChange={open => !open && setAssigningModule(null)}
        />
      )}

      <Dialog open={!!deleteModule} onOpenChange={open => !open && setDeleteModule(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Module</DialogTitle>
            <DialogDescription>
              Delete <strong>{deleteModule?.title}</strong>? All trainings, content, and progress will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModule(null)}>Cancel</Button>
            <Button variant="danger" loading={loading} onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
