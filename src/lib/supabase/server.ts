import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// A true service-role client — NOT wired to request cookies. This matters:
// createServerClient() (used above) reads the caller's own session from
// cookies and, when one exists, uses ITS access token for every request's
// Authorization header instead of the key passed to it — so a "createServerClient
// with the service-role key" only bypasses RLS when there's no session, or the
// session already happens to be privileged enough (e.g. an admin testing it
// themselves). For any other signed-in user it silently degrades to acting as
// THAT user, which is exactly what let a real employee get RLS-blocked (as an
// opaque storage "Object not found") on documents this client is meant to
// unconditionally serve regardless of who's asking. Building it from the base
// supabase-js client instead, with no session storage at all, means it always
// authenticates as the service role.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
