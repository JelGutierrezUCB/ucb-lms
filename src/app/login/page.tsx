'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, Leaf } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const msg = error.message.includes('Invalid login')
        ? 'Incorrect email or password. Please try again.'
        : error.message
      setErrorMsg(msg)
      toast.error(msg)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <span className="text-white font-bold text-xl">UCB Training Portal</span>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Learn. Grow.<br />
              <span className="text-blue-400">Succeed.</span>
            </h1>
            <p className="text-slate-400 text-lg">
              Your all-in-one learning platform for onboarding, compliance, and professional development.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Training Modules', value: '10+' },
              { label: 'Team Members', value: '50+' },
              { label: 'Avg. Completion', value: '94%' },
              { label: 'Categories', value: '5' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-slate-800 p-4">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Leaf className="h-4 w-4 text-green-500" />
          <span>UCBZeroWaste — Building a sustainable future together</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">UCB Training Portal</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500">Sign in to access your training dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@ucb.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg('') }}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorMsg('') }}
                required
                autoComplete="current-password"
              />
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Need an account? Contact your manager or admin.
          </p>
        </div>
      </div>
    </div>
  )
}
