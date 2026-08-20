'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, UserX, UserCheck, EyeOff, Eye, Upload, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Profile, Role } from '@/types'
import { COMPANIES, COMPANY_DEPARTMENTS } from '@/types'
import { getRoleLabel, formatDate } from '@/lib/utils'
import { CsvImportDialog } from './CsvImportDialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'

interface Props {
  initialProfiles: Profile[]
  currentUserRole: string
  currentUserId: string
}

const roleBadgeVariant = (role: string) =>
  role === 'admin' ? 'default' : role === 'manager' ? 'warning' : 'outline'

export function UserManagement({ initialProfiles, currentUserRole, currentUserId }: Props) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'employee' as Role,
    company: '',
    department: '',
    manager_id: '',
    is_active: true,
  })

  const supabase = createClient()
  const managers = profiles.filter(p => p.role === 'manager' || p.role === 'admin')

  const filtered = profiles.filter(p => {
    const matchesSearch =
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = showInactive ? true : (p.is_active !== false)
    return matchesSearch && matchesStatus
  })

  const inactiveCount = profiles.filter(p => p.is_active === false).length

  const resetForm = () => setForm({
    full_name: '', email: '', password: '', role: 'employee', company: '', department: '', manager_id: '', is_active: true,
  })

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast.error('Name, email, and password are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setProfiles(prev => [...prev, data.profile])
      setShowCreate(false)
      resetForm()
      toast.success('User created successfully')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editUser) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          role: form.role,
          company: form.company || null,
          department: form.department || null,
          manager_id: form.manager_id || null,
          is_active: form.is_active,
        })
        .eq('id', editUser.id)
        .select()
        .single()

      if (error) throw error
      setProfiles(prev => prev.map(p => p.id === editUser.id ? data : p))
      setEditUser(null)
      resetForm()

      const statusChanged = editUser.is_active !== form.is_active
      if (statusChanged) {
        toast.success(form.is_active ? `${form.full_name} reactivated` : `${form.full_name} marked as inactive`)
      } else {
        toast.success('User updated')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Quick toggle active/inactive without opening dialog
  const handleToggleActive = async (user: Profile) => {
    const newActive = !user.is_active
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: newActive })
        .eq('id', user.id)
        .select()
        .single()
      if (error) throw error
      setProfiles(prev => prev.map(p => p.id === user.id ? data : p))
      toast.success(newActive ? `${user.full_name} reactivated` : `${user.full_name} marked as inactive`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setProfiles(prev => prev.filter(p => p.id !== deleteUser.id))
      setDeleteUser(null)
      toast.success('User deleted')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (user: Profile) => {
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
      company: user.company ?? '',
      department: user.department ?? '',
      manager_id: user.manager_id ?? '',
      is_active: user.is_active !== false,
    })
    setEditUser(user)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showInactive ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setShowInactive(v => !v)}
            className="gap-1.5 shrink-0"
          >
            {showInactive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showInactive ? 'Hide Inactive' : `Show Inactive${inactiveCount > 0 ? ` (${inactiveCount})` : ''}`}
          </Button>
        </div>
        {currentUserRole === 'admin' && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={() => { resetForm(); setShowCreate(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Role</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Company</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Department</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Manager</th>
                <th className="text-left px-4 py-3 text-slate-600 font-medium">Joined</th>
                {currentUserRole === 'admin' && (
                  <th className="text-right px-4 py-3 text-slate-600 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">No users found</td>
                </tr>
              ) : (
                filtered.map(user => {
                  const manager = profiles.find(p => p.id === user.manager_id)
                  const isInactive = user.is_active === false
                  return (
                    <tr key={user.id} className={`hover:bg-slate-50 ${isInactive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0 ${isInactive ? 'bg-slate-400' : 'bg-blue-700'}`}>
                            {user.full_name.charAt(0)}
                          </div>
                          <div>
                            <span className={`font-medium ${isInactive ? 'text-slate-400' : 'text-slate-900'}`}>{user.full_name}</span>
                            {isInactive && (
                              <span className="ml-2 text-xs bg-slate-200 text-slate-500 rounded-full px-2 py-0.5 font-medium">Inactive</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={roleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.company ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{user.department ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{manager?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                      {currentUserRole === 'admin' && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(user)}
                              className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setResetPasswordUser(user)}
                              className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Reset password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            {user.id !== currentUserId && (
                              <>
                                <button
                                  onClick={() => handleToggleActive(user)}
                                  className={`p-1.5 rounded transition-colors ${
                                    isInactive
                                      ? 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                                      : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  }`}
                                  title={isInactive ? 'Reactivate employee' : 'Mark as inactive (terminated)'}
                                >
                                  {isInactive ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                                </button>
                                <button
                                  onClick={() => setDeleteUser(user)}
                                  className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Delete permanently"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate || !!editUser} onOpenChange={open => { if (!open) { setShowCreate(false); setEditUser(null); resetForm() }}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Create New User'}</DialogTitle>
            <DialogDescription>
              {editUser ? 'Update user information.' : 'Create a new account. The user will log in with their email and password.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" />
            </div>
            {!editUser && (
              <>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@ucb.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Temporary password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Company (optional)</Label>
              <Select
                value={form.company || '__none__'}
                onValueChange={v => setForm(f => ({
                  ...f,
                  company: v === '__none__' ? '' : v,
                  // Clear department if it doesn't belong to the newly chosen company
                  department: v !== '__none__' && COMPANY_DEPARTMENTS[v]?.includes(f.department) ? f.department : '',
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No company</SelectItem>
                  {COMPANIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department (optional)</Label>
              <Select
                value={form.department || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, department: v === '__none__' ? '' : v }))}
                disabled={!form.company}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.company ? 'Select a department' : 'Select a company first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No department</SelectItem>
                  {(COMPANY_DEPARTMENTS[form.company] ?? []).map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role === 'employee' && (
              <div className="space-y-1.5">
                <Label>Manager (optional)</Label>
                <Select
                  value={form.manager_id || '__none__'}
                  onValueChange={v => setForm(f => ({ ...f, manager_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Assign a manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No manager</SelectItem>
                    {managers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Active / Inactive — only show when editing, and not for yourself */}
            {editUser && editUser.id !== currentUserId && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Employee Status</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {form.is_active ? 'Active — can log in and be assigned training' : 'Inactive — excluded from assignments and reports'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    form.is_active ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditUser(null); resetForm() }}>Cancel</Button>
            <Button loading={loading} onClick={editUser ? handleUpdate : handleCreate}>
              {editUser ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteUser} onOpenChange={open => !open && setDeleteUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deleteUser?.full_name}</strong>? All their training history will be lost.
              <span className="block mt-2 text-amber-600 font-medium">Tip: marking them Inactive preserves their history.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="danger" loading={loading} onClick={handleDelete}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog
        user={resetPasswordUser}
        onOpenChange={open => !open && setResetPasswordUser(null)}
      />

      <CsvImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={async () => {
          const { data } = await supabase.from('profiles').select('*').order('full_name')
          if (data) setProfiles(data)
        }}
      />
    </div>
  )
}
