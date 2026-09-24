import { cookies } from 'next/headers'
import { VIEW_COOKIE, type PortalView } from './view-shared'

// The view to render for this person. The choice is remembered in a cookie;
// admins and managers default to their own console.
export async function getPortalView(role: string | null | undefined): Promise<PortalView> {
  if (role !== 'admin' && role !== 'manager') return 'learner'
  const store = await cookies()
  return store.get(VIEW_COOKIE)?.value === 'learner' ? 'learner' : 'admin'
}
