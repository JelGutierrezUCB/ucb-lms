'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Loader2, Upload, User, Save, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const { refreshProfile } = useAuth()

  const [fullName, setFullName] = useState(profile.full_name)
  const [savingName, setSavingName] = useState(false)

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const handleSaveName = async () => {
    if (!fullName.trim()) { toast.error('Name cannot be empty'); return }
    setSavingName(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id)
    setSavingName(false)
    if (error) { toast.error(error.message); return }
    toast.success('Name updated')
    refreshProfile()
  }

  const onDropPhoto = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id)
      if (updateError) throw updateError
      setAvatarUrl(data.publicUrl)
      toast.success('Photo updated')
      refreshProfile()
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed')
    } finally {
      setUploadingPhoto(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropPhoto,
    accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'], 'image/gif': ['.gif'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled: uploadingPhoto,
  })

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password changed')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Photo */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white text-2xl font-bold overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={profile.full_name} className="h-full w-full object-cover" />
            ) : (
              profile.full_name.charAt(0).toUpperCase()
            )}
          </div>
          <div
            {...getRootProps()}
            className={cn(
              'flex-1 border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300',
              uploadingPhoto && 'pointer-events-none opacity-60'
            )}
          >
            <input {...getInputProps()} />
            {uploadingPhoto ? (
              <>
                <Loader2 className="h-6 w-6 mx-auto text-slate-400 animate-spin mb-1.5" />
                <p className="text-sm text-slate-500">Uploading…</p>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto text-slate-400 mb-1.5" />
                <p className="text-sm text-slate-500">Drag & drop a photo, or click to browse</p>
                <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WebP, or GIF — up to 5MB</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-4 w-4 text-slate-400" /> Name & Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email} disabled className="bg-slate-50 text-slate-400" />
            <p className="text-xs text-slate-400">Contact an admin to change your email.</p>
          </div>
          <Button onClick={handleSaveName} loading={savingName} disabled={fullName.trim() === profile.full_name}>
            <Save className="h-4 w-4 mr-2" /> Save Name
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-slate-400" /> Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={handleChangePassword} loading={savingPassword} disabled={!newPassword || !confirmPassword}>
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
