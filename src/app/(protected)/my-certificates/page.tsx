import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Award } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getPortalView } from '@/lib/view'
import { getProxyTarget } from '@/lib/proxy'
import { getDict } from '@/lib/i18n/get-locale'
import { fmt } from '@/lib/i18n/dictionaries'
import { CertificatePreviewButton } from '@/components/certificates/CertificatePreviewButton'
import type { Profile, Certificate, JourneyCertificate } from '@/types'

export const dynamic = 'force-dynamic'

export default async function MyCertificatesPage() {
  const t = await getDict()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single() as { data: Profile | null }
  if (!profile) redirect('/login')

  // Admin/manager viewing someone else's learner portal — show that
  // person's certificates instead of the signed-in admin/manager's own.
  const proxyTarget = await getProxyTarget(user.id, profile.role)
  const effectiveUserId = proxyTarget?.id ?? user.id

  // Admins/managers not currently in the learner view have their own
  // console's Certificates registry (org-wide) — this page is their
  // personal one, same as the dashboard.
  if (!proxyTarget && (await getPortalView(profile.role)) === 'admin') {
    if (profile.role === 'admin') redirect('/admin')
    if (profile.role === 'manager') redirect('/manager')
  }

  const [{ data: myCertificates }, { data: myJourneyCertificates }] = await Promise.all([
    supabase
      .from('certificates')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('issued_at', { ascending: false }) as unknown as Promise<{ data: Certificate[] | null }>,
    supabase
      .from('journey_certificates')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('issued_at', { ascending: false }) as unknown as Promise<{ data: JourneyCertificate[] | null }>,
  ])

  const certificates = myCertificates ?? []
  const journeyCerts = myJourneyCertificates ?? []
  const isEmpty = certificates.length === 0 && journeyCerts.length === 0

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Header title={t.certificatesPage.title} />
      <main className="flex-1 p-4 sm:p-6 space-y-4">
        <p className="text-sm text-slate-500">{t.certificatesPage.subtitle}</p>

        {isEmpty ? (
          <div className="text-center py-20">
            <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{t.certificatesPage.noCertificatesYet}</p>
            <p className="text-slate-400 text-sm mt-1">{t.certificatesPage.noCertificatesBody}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {journeyCerts.map(jc => (
              <div key={jc.id} className="flex flex-col rounded-xl border border-amber-200 bg-amber-50/50 p-5 gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Award className="h-5 w-5 text-amber-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{jc.journey_title}</p>
                    <span className="inline-block mt-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                      {t.certificatesPage.journey}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {t.history.completed} {formatDate(jc.completed_at)} · {fmt(t.certificatesPage.allCoursesCompleted, { count: jc.courses_count })}
                </p>
                <div className="flex items-center gap-3 mt-auto pt-2 border-t border-amber-200/70">
                  <CertificatePreviewButton
                    href={`/api/certificate?journeyCertificateId=${jc.id}`}
                    label={t.common.preview}
                    downloadLabel={t.common.download}
                    className="text-sm"
                  />
                  <a
                    href={`/api/certificate?journeyCertificateId=${jc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t.common.download}
                  </a>
                </div>
              </div>
            ))}

            {certificates.map(cert => (
              <div key={cert.id} className="flex flex-col rounded-xl border border-slate-200 p-5 gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <Award className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{cert.module_title}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {t.history.completed} {formatDate(cert.completed_at)}
                  {cert.max_score ? ` · ${t.history.score}: ${cert.score}/${cert.max_score}` : ''}
                </p>
                <div className="flex items-center gap-3 mt-auto pt-2 border-t border-slate-100">
                  <CertificatePreviewButton
                    href={`/api/certificate?certificateId=${cert.id}`}
                    label={t.common.preview}
                    downloadLabel={t.common.download}
                    className="text-sm"
                  />
                  <a
                    href={`/api/certificate?certificateId=${cert.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t.common.download}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
