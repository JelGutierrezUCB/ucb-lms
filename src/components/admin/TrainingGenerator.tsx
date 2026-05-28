'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import {
  Upload, FileText, FileSpreadsheet, File, Sparkles,
  CheckCircle, ArrowRight, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MODULE_CATEGORIES } from '@/types'

interface GeneratedModule {
  title: string
  description: string
  category: string
  estimated_minutes: number
  sections: {
    title: string
    content_blocks: {
      type: 'text' | 'quiz'
      content: any
    }[]
  }[]
}

interface Props {
  userId: string
}

const fileIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-8 w-8 text-red-500" />,
  docx: <FileText className="h-8 w-8 text-blue-500" />,
  doc: <FileText className="h-8 w-8 text-blue-500" />,
  pptx: <FileSpreadsheet className="h-8 w-8 text-orange-500" />,
  ppt: <FileSpreadsheet className="h-8 w-8 text-orange-500" />,
  txt: <FileText className="h-8 w-8 text-slate-500" />,
}

export function TrainingGenerator({ userId }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [additionalContext, setAdditionalContext] = useState('')
  const [category, setCategory] = useState('general')
  const [step, setStep] = useState<'upload' | 'generating' | 'preview' | 'saving'>('upload')
  const [generated, setGenerated] = useState<GeneratedModule | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
  })

  const getFileExt = (name: string) => name.split('.').pop()?.toLowerCase() ?? 'file'

  const handleGenerate = async () => {
    if (!file) { toast.error('Please upload a file'); return }
    setStep('generating')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', category)
    formData.append('context', additionalContext)

    try {
      const res = await fetch('/api/generate-training', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Generation failed')

      setGenerated(data.module)
      setStep('preview')
    } catch (err: any) {
      toast.error(err.message)
      setStep('upload')
    }
  }

  const handleSave = async () => {
    if (!generated) return
    setSaving(true)
    setStep('saving')

    try {
      const res = await fetch('/api/save-generated-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: generated, userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Training module created!')
      router.push(`/admin/modules/${data.moduleId}/edit`)
    } catch (err: any) {
      toast.error(err.message)
      setStep('preview')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-purple-700 p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-6 w-6" />
          <h2 className="text-xl font-bold">AI Training Generator</h2>
        </div>
        <p className="text-blue-100">
          Upload a PDF, Word document, or PowerPoint and Claude AI will automatically create a structured training module with sections, content, and quiz questions.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[
          { key: 'upload', label: '1. Upload' },
          { key: 'generating', label: '2. Generating' },
          { key: 'preview', label: '3. Preview & Save' },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
              step === s.key ? 'bg-blue-700 text-white' :
              (step === 'preview' && s.key === 'upload') || (step === 'saving' && s.key !== 'saving') ? 'bg-green-500 text-white' :
              'bg-slate-200 text-slate-500'
            )}>
              {(step === 'preview' && s.key === 'upload') ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn('text-sm', step === s.key ? 'font-semibold text-slate-900' : 'text-slate-400')}>
              {s.label}
            </span>
            {i < 2 && <ArrowRight className="h-4 w-4 text-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              )}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  {fileIcons[getFileExt(file.name)] ?? <File className="h-8 w-8 text-slate-400" />}
                  <p className="font-semibold text-slate-900">{file.name}</p>
                  <p className="text-sm text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null) }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-slate-300" />
                  <div>
                    <p className="font-semibold text-slate-700">
                      {isDragActive ? 'Drop your file here' : 'Drop a file or click to browse'}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">PDF, Word (.docx), PowerPoint (.pptx), or TXT — up to 20MB</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODULE_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Additional Context (optional)</Label>
              <Textarea
                value={additionalContext}
                onChange={e => setAdditionalContext(e.target.value)}
                placeholder="e.g. 'Focus on safety procedures', 'Target audience is new warehouse hires', 'Include a quiz on every section'..."
                rows={3}
              />
            </div>

            <Button className="w-full" size="lg" disabled={!file} onClick={handleGenerate}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Training Module
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Generating */}
      {step === 'generating' && (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold text-slate-900">Generating your training module...</p>
            <p className="text-slate-500 mt-2">
              Claude AI is reading your document and creating a structured training with sections, content, and quiz questions.
            </p>
            <p className="text-sm text-slate-400 mt-4">This usually takes 15–30 seconds</p>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {(step === 'preview' || step === 'saving') && generated && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Generated Module Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-xs text-slate-500 font-medium">TITLE</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{generated.title}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">ESTIMATED DURATION</p>
                  <p className="font-semibold text-slate-900 mt-0.5">{generated.estimated_minutes} minutes</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 font-medium">DESCRIPTION</p>
                  <p className="text-slate-700 mt-0.5">{generated.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">{generated.sections.length} Sections:</p>
                {generated.sections.map((section, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{section.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {section.content_blocks.length} block{section.content_blocks.length !== 1 ? 's' : ''}
                        {section.content_blocks.some(b => b.type === 'quiz') && ' · includes quiz'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep('upload'); setGenerated(null) }}>
              Start Over
            </Button>
            <Button
              className="flex-1"
              size="lg"
              loading={saving}
              onClick={handleSave}
            >
              Save Module & Open Editor
            </Button>
          </div>
          <p className="text-sm text-slate-400 text-center">
            After saving, you can review and edit all content in the module editor.
          </p>
        </div>
      )}
    </div>
  )
}
