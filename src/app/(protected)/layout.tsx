export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProxyProvider } from '@/contexts/ProxyContext'
import { MobileNavProvider } from '@/contexts/MobileNavContext'
import { ViewProvider } from '@/contexts/ViewContext'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { getPortalView } from '@/lib/view'
import { getLocale } from '@/lib/i18n/get-locale'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Profile } from '@/types'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as { data: Profile | null }

  const initialView = await getPortalView(profile?.role)
  const initialLocale = await getLocale()

  return (
    <AuthProvider initialProfile={profile}>
      <ProxyProvider currentUserId={user.id}>
        <ViewProvider initialView={initialView}>
          <LocaleProvider initialLocale={initialLocale}>
            <MobileNavProvider>
              <div className="flex h-screen overflow-hidden bg-slate-100">
                <Sidebar />
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  {children}
                </div>
              </div>
            </MobileNavProvider>
          </LocaleProvider>
        </ViewProvider>
      </ProxyProvider>
    </AuthProvider>
  )
}
