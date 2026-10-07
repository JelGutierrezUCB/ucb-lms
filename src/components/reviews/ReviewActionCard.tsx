import Link from 'next/link'
import { AlertCircle, ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReviewActionItem } from '@/lib/introReviews/dashboard'

// "Reviews needing your action" — renders nothing when there's nothing to do.
export function ReviewActionCard({ items, orgOverdue = 0 }: { items: ReviewActionItem[]; orgOverdue?: number }) {
  if (items.length === 0 && orgOverdue === 0) return null

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-5 w-5 text-amber-600" />
          Introductory reviews
          {items.length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{items.length}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.slice(0, 5).map(item => (
          <Link
            key={item.id}
            href={`/reviews/${item.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
              <p className={`text-xs ${item.overdue ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                {item.overdue ? 'Overdue · ' : ''}
                {item.subtitle}
              </p>
            </div>
            <span className="text-sm font-medium text-blue-700 shrink-0">{item.action} →</span>
          </Link>
        ))}
        {items.length > 5 && <p className="text-xs text-slate-400">+ {items.length - 5} more</p>}
        {orgOverdue > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> {orgOverdue} review{orgOverdue === 1 ? ' is' : 's are'} overdue across the company.
          </p>
        )}
        <Link href="/reviews" className="inline-block text-sm text-blue-700 hover:underline">
          View all reviews
        </Link>
      </CardContent>
    </Card>
  )
}
