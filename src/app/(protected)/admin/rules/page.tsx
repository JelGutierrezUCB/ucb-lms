import { redirect } from 'next/navigation'

// Assignment Rules now live in Learning Management (kept so old links still work).
export default function AssignmentRulesRedirect() {
  redirect('/admin/learning?tab=rules')
}
