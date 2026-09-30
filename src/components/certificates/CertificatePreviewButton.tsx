'use client'

import { useState } from 'react'
import { Eye, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Props {
  // The /api/certificate?... URL for this certificate (personal or journey).
  href: string
  label?: string
  downloadLabel?: string
  className?: string
}

// Small "Preview" trigger + modal, used anywhere a certificate is listed
// (admin Certificates table, dashboard, training history) so people can look
// at it inline before deciding to download it.
export function CertificatePreviewButton({ href, label = 'Preview', downloadLabel = 'Download', className }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('inline-flex items-center gap-1.5 text-blue-600 hover:underline shrink-0', className)}
      >
        <Eye className="h-3.5 w-3.5" /> {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Certificate Preview</DialogTitle>
          </DialogHeader>
          <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm" style={{ height: '65vh' }}>
            <iframe
              src={`${href}#toolbar=0&navpanes=0&view=FitH`}
              className="w-full h-full"
              title="Certificate preview"
            />
          </div>
          <DialogFooter>
            <a href={href} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> {downloadLabel}
              </Button>
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
