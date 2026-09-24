import { redirect } from 'next/navigation'

// Journey Builder now lives in Learning Management (kept so old links still work).
export default function PathBuilderRedirect() {
  redirect('/admin/learning?tab=builder')
}
