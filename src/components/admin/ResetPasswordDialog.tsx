'use client'

import { useState } from 'react'
import { Eye, EyeOff, Dices } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import type { Profile } from '@/types'

interface Props {
  user: Profile | null
  onOpenChange: (open: boolean) => void
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

export function ResetPasswordDialog({ user, onOpenChange }: Props) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [notifyUser, setNotifyUser] = useState(true)
  const [loading, setLoading] = useState(false)

  const close = () => {
    onOpenChange(false)
    setPassword('')
    setNotifyUser(true)
  }

  const handleSubmit = async () => {
    if (!user) return
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, notifyUser }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(notifyUser ? `Password reset — emailed to ${user.full_name}` : 'Password reset')
      close()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={open => !open && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for <strong>{user?.full_name}</strong>. They&apos;ll need it to log in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
              <Button type="button" variant="outline" size="icon" title="Generate password" onClick={() => { setPassword(generatePassword()); setShowPassword(true) }}>
                <Dices className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox checked={notifyUser} onCheckedChange={v => setNotifyUser(!!v)} />
            Email the new password to {user?.full_name ?? 'this user'}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button loading={loading} onClick={handleSubmit}>Reset Password</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
