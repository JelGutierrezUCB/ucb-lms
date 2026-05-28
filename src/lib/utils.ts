import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getRoleLabel(role: string): string {
  return { admin: 'Admin', manager: 'Manager', employee: 'Employee' }[role] ?? role
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    onboarding: '#7c3aed',
    sales: '#0891b2',
    warehouse: '#b45309',
    ucbzerowaste: '#15803d',
    general: '#1e40af',
  }
  return colors[category] ?? '#1e40af'
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    onboarding: 'Onboarding',
    sales: 'Sales',
    warehouse: 'Warehouse',
    ucbzerowaste: 'UCBZeroWaste',
    general: 'General',
  }
  return labels[category] ?? category
}
