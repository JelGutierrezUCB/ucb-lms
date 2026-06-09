'use client'

import { useState } from 'react'
import { Users, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BulkAssignDialog } from './BulkAssignDialog'
import { ManualCompletionDialog } from './ManualCompletionDialog'
import type { Profile, Module } from '@/types'

interface Props {
  employees: Profile[]
  modules: Module[]
  currentUserId: string
}

export function AdminActionButtons({ employees, modules, currentUserId }: Props) {
  const [showBulkAssign, setShowBulkAssign] = useState(false)
  const [showManualCompletion, setShowManualCompletion] = useState(false)

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setShowBulkAssign(true)}>
        <Users className="h-4 w-4" />
        Bulk Assign
      </Button>
      <Button variant="outline" className="gap-2" onClick={() => setShowManualCompletion(true)}>
        <ClipboardList className="h-4 w-4" />
        Manual Completion
      </Button>

      {showBulkAssign && (
        <BulkAssignDialog
          employees={employees}
          modules={modules}
          currentUserId={currentUserId}
          onClose={() => setShowBulkAssign(false)}
        />
      )}
      {showManualCompletion && (
        <ManualCompletionDialog
          employees={employees}
          modules={modules}
          currentUserId={currentUserId}
          onClose={() => setShowManualCompletion(false)}
        />
      )}
    </>
  )
}
