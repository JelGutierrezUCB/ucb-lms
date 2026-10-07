'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { Upload, CheckCircle2, XCircle, FileSpreadsheet, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

interface ParsedRow {
  full_name: string
  email: string
  role: string
  company: string
  department: string
  manager_email: string
}

interface RowResult {
  email: string
  success: boolean
  error?: string
}

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  name: 'full_name',
  full_name: 'full_name',
  fullname: 'full_name',
  email: 'email',
  role: 'role',
  company: 'company',
  department: 'department',
  location: 'department',
  manager: 'manager_email',
  manager_email: 'manager_email',
  manageremail: 'manager_email',
}

const SAMPLE_CSV = 'full_name,email,role,company,department,manager_email\nJane Smith,jane@ucb.com,employee,UCBEnvironmental,Human Resources,manager@ucb.com\n'

export function CsvImportDialog({ open, onOpenChange, onImported }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)

  const reset = () => {
    setRows([])
    setFileName('')
    setResults(null)
  }

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setFileName(file.name)
    setResults(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: res => {
        const parsed: ParsedRow[] = res.data.map(raw => {
          const row: ParsedRow = { full_name: '', email: '', role: 'employee', company: '', department: '', manager_email: '' }
          for (const [key, value] of Object.entries(raw)) {
            const mapped = HEADER_MAP[key]
            if (mapped && value) row[mapped] = value.trim()
          }
          if (!row.role) row.role = 'employee'
          return row
        }).filter(r => r.full_name || r.email)
        setRows(parsed)
        if (parsed.length === 0) toast.error('No valid rows found in CSV')
      },
      error: err => toast.error(err.message),
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  const invalidCount = rows.filter(r => !r.full_name || !r.email).length

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResults(data.results)
      const successCount = data.results.filter((r: RowResult) => r.success).length
      if (successCount > 0) {
        toast.success(`${successCount} user${successCount !== 1 ? 's' : ''} imported`)
        onImported()
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ucb-lms-users-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Users from CSV</DialogTitle>
          <DialogDescription>
            Columns: full_name, email, role (admin/manager/employee), company, department, manager_email (optional).
            Each user gets a generated password emailed to them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!results && (
            <>
              {rows.length === 0 ? (
                <div
                  {...getRootProps()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                    isDragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500">Drag & drop a .csv file, or click to browse</p>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); downloadSample() }}
                    className="mt-3 text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> Download sample CSV
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <FileSpreadsheet className="h-4 w-4" />
                      {fileName} — {rows.length} row{rows.length !== 1 ? 's' : ''}
                      {invalidCount > 0 && <span className="text-red-500">({invalidCount} missing name/email)</span>}
                    </div>
                    <Button variant="outline" size="sm" onClick={reset}>Choose different file</Button>
                  </div>
                  <div className="border rounded-lg overflow-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Name</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Email</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Role</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Company</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Department</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Manager Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((row, i) => (
                          <tr key={i} className={!row.full_name || !row.email ? 'bg-red-50' : ''}>
                            <td className="px-3 py-1.5">{row.full_name || <span className="text-red-400">missing</span>}</td>
                            <td className="px-3 py-1.5">{row.email || <span className="text-red-400">missing</span>}</td>
                            <td className="px-3 py-1.5">{row.role}</td>
                            <td className="px-3 py-1.5">{row.company || '—'}</td>
                            <td className="px-3 py-1.5">{row.department || '—'}</td>
                            <td className="px-3 py-1.5">{row.manager_email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {results && (
            <div className="border rounded-lg divide-y divide-slate-100 max-h-96 overflow-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {r.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className="font-medium text-slate-800">{r.email}</span>
                  {!r.success && <span className="text-red-500 text-xs">{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {results ? 'Close' : 'Cancel'}
          </Button>
          {!results && rows.length > 0 && (
            <Button loading={importing} disabled={rows.length - invalidCount === 0} onClick={handleImport}>
              Import {rows.length - invalidCount} User{rows.length - invalidCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
