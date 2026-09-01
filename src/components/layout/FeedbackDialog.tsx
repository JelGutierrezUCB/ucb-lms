'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: Props) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const close = () => {
    onOpenChange(false)
    setMessage('')
  }

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Please enter your feedback first')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Thanks for the feedback!')
      close()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send feedback')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tell Us What You Think</DialogTitle>
          <DialogDescription>
            Suggestions, bugs, or anything else about the Training Portal — we read every message.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          rows={5}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button loading={loading} onClick={handleSubmit}>Send Feedback</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
