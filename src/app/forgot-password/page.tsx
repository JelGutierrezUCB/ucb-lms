'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, ArrowLeft, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const appUrl = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    })

    setLoading(false)

    // Always show the same success state, whether or not the email exists —
    // this avoids leaking which addresses have accounts.
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
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
          {sent ? (
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                <MailCheck className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
              <p className="text-slate-500 text-sm">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900">Reset your password</h2>
                <p className="text-slate-500 text-sm">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@ucb.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" loading={loading}>
                  Send reset link
                </Button>
              </form>
            </>
          )}

          <Link
            href="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
