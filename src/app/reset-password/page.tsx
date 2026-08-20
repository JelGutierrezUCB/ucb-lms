'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Supabase's client processes the recovery token from the URL and fires this
    // event once a temporary recovery session is established.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    // In case the event already fired before this listener attached, also check directly.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) setInvalidLink(true)
      })
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }
    setDone(true)
    setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-3 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">UCB Training Portal</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
          {done ? (
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Password updated</h2>
              <p className="text-slate-500 text-sm">Taking you to your dashboard...</p>
            </div>
          ) : invalidLink ? (
            <div className="text-center space-y-3">
              <h2 className="text-xl font-bold text-slate-900">Link expired</h2>
              <p className="text-slate-500 text-sm">
                This password reset link is invalid or has expired. Request a new one to continue.
              </p>
              <Link href="/forgot-password">
                <Button className="w-full mt-2">Request a new link</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900">Set a new password</h2>
                <p className="text-slate-500 text-sm">Choose a new password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={!ready}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    disabled={!ready}
                  />
                </div>
                <Button type="submit" className="w-full" loading={loading} disabled={!ready}>
                  {ready ? 'Update password' : 'Verifying link...'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
