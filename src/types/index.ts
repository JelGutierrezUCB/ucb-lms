export type Role = 'admin' | 'manager' | 'employee'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  manager_id: string | null
  department: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Module {
  id: string
  title: string
  description: string | null
  category: string
  thumbnail_color: string
  is_published: boolean
  created_by: string | null
  estimated_minutes: number
  created_at: string
  updated_at: string
}

export interface Section {
  id: string
  module_id: string
  title: string
  order_index: number
  created_at: string
  content_blocks?: ContentBlock[]
}

export type ContentBlockType = 'text' | 'video' | 'quiz'

export interface TextContent {
  html: string
}

export interface VideoContent {
  youtube_url: string
  youtube_id: string
  caption?: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correct_index: number
  explanation?: string
}

export interface QuizContent {
  questions: QuizQuestion[]
  passing_score: number
}

export type BlockContent = TextContent | VideoContent | QuizContent

export interface ContentBlock {
  id: string
  section_id: string
  type: ContentBlockType
  order_index: number
  content: BlockContent
  created_at: string
}

export interface Assignment {
  id: string
  user_id: string
  module_id: string
  assigned_by: string
  assigned_at: string
  due_date: string | null
  module?: Module
  user?: Profile
}

export interface SectionProgress {
  id: string
  user_id: string
  section_id: string
  completed_at: string
}

export interface QuizAttempt {
  id: string
  user_id: string
  content_block_id: string
  score: number
  max_score: number
  answers: number[]
  completed_at: string
}

export interface ModuleWithProgress extends Module {
  sections: Section[]
  completed_sections: number
  total_sections: number
  progress_percent: number
  is_assigned?: boolean
}

export const MODULE_CATEGORIES = [
  { value: 'onboarding', label: 'Onboarding', color: '#7c3aed' },
  { value: 'sales', label: 'Sales', color: '#0891b2' },
  { value: 'warehouse', label: 'Warehouse', color: '#b45309' },
  { value: 'ucbzerowaste', label: 'UCBZeroWaste', color: '#15803d' },
  { value: 'general', label: 'General', color: '#1e40af' },
] as const
