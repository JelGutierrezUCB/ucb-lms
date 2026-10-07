'use client'

import { useMemo, useState } from 'react'
import { Award, Search, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { Certificate } from '@/types'

export function CertificatesTable({ certificates }: { certificates: Certificate[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return certificates
    return certificates.filter(c =>
      c.employee_name.toLowerCase().includes(q) ||
      c.module_title.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q)
    )
  }, [certificates, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-slate-600">{certificates.length} certificate{certificates.length !== 1 ? 's' : ''} issued</p>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, company, or training…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No certificates yet</p>
            <p className="text-slate-400 text-sm mt-1">
              {certificates.length === 0
                ? 'Certificates are issued automatically the moment someone completes every training in a module and passes its quiz.'
                : 'No certificates match your search.'}
            </p>
          </div>
        ) : (
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Training</th>
                    <th className="px-4 py-3 font-medium text-center">Score</th>
                    <th className="px-4 py-3 font-medium">Completed</th>
                    <th className="px-4 py-3 font-medium">Issued</th>
                    <th className="px-4 py-3 font-medium text-right">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(cert => {
                    const pct = cert.max_score && cert.max_score > 0
                      ? Math.round(((cert.score ?? 0) / cert.max_score) * 100)
                      : null
                    return (
                      <tr key={cert.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{cert.employee_name}</td>
                        <td className="px-4 py-3 text-slate-500">{cert.company ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{cert.module_title}</td>
                        <td className="px-4 py-3 text-center">
                          {pct != null ? (
                            <Badge variant={pct >= 70 ? 'success' : 'warning'}>{cert.score}/{cert.max_score} ({pct}%)</Badge>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(cert.completed_at)}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(cert.issued_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/api/certificate?certificateId=${cert.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-700 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
