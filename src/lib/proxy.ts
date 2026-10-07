import { cookies } from 'next/headers'
import { createClient } from './supabase/server'
import { PROXY_COOKIE } from './proxy-shared'
import type { Profile } from '@/types'

// The person whose learner portal the current admin/manager is viewing, if
// any — used by every learner-facing page (dashboard, training, journeys,
// history) to decide whose data to show. Returns null when there's no active
// proxy, the viewer's role can't proxy anyone, or the target isn't someone
// this viewer is allowed to view:
//   - admins may view anyone active
//   - managers may only view their own direct reports
//   - employees can never proxy
export async function getProxyTarget(
  viewerId: string,
  viewerRole: string | null | undefined
): Promise<Profile | null> {
  if (viewerRole !== 'admin' && viewerRole !== 'manager') return null

  const store = await cookies()
  const targetId = store.get(PROXY_COOKIE)?.value
  if (!targetId || targetId === viewerId) return null

  const supabase = await createClient()
  const { data: target } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetId)
    .single() as { data: Profile | null }

  if (!target || target.is_active === false) return null
  if (viewerRole === 'admin') return target
  if (target.manager_id === viewerId) return target
  return null
}
