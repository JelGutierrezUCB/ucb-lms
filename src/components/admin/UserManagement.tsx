'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, UserCheck } from 'lucide-react'
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
import { getRoleLabel, formatDate } from '@/lib/utils'

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
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'employee' as Role,
    department: '',
    manager_id: '',
  })

  const supabase = createClient()
  const managers = profiles.filter(p => p.role === 'manager' || p.role === 'admin')
  const filtered = profiles.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  )

  const resetForm = () => setForm({ full_name: '', email: '', password: '', role: 'employee', department: '', manager_id: '' })

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
          department: form.department || null,
          manager_id: form.manager_id || null,
        })
        .eq('id', editUser.id)
        .select()
        .single()

      if (error) throw error
      setProfiles(prev => prev.map(p => p.id === editUser.id ? data : p))
      setEditUser(null)
      resetForm()
      toast.success('User updated')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
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
      department: user.department ?? '',
      manager_id: user.manager_id ?? '',
    })
    setEditUser(user)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {currentUserRole === 'admin' && (
          <Button onClick={() => { resetForm(); setShowCreate(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
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
                  <td colSpan={7} className="text-center py-10 text-slate-400">No users found</td>
                </tr>
              ) : (
                filtered.map(user => {
                  const manager = profiles.find(p => p.id === user.manager_id)
                  return (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {user.full_name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={roleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                      </td>
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
                            {user.id !== currentUserId && (
                              <button
                                onClick={() => setDeleteUser(user)}
                                className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Temporary password" />
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
              <Label>Department (optional)</Label>
              <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Warehouse, Sales..." />
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
              Are you sure you want to delete <strong>{deleteUser?.full_name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="danger" loading={loading} onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
