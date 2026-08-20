export type Role = 'admin' | 'manager' | 'employee'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  manager_id: string | null
  department: string | null
  company: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Departments available per company, shown in cascading dropdowns when assigning a user.
export const COMPANY_DEPARTMENTS: Record<string, string[]> = {
  UCBEnvironmental: ['Human Resources', 'Information & Technology', 'Office of the CEO'],
  UsedCardboardBoxes: ['Sales & Marketing', 'Facilities', 'Supply Chain'],
  UCBZeroWaste: ['Operations Finance & Data', 'Implementation', 'Business Development'],
  UCBPalletSolutions: ['Sales/Sourcing', 'Operations'],
}

export const COMPANIES = Object.keys(COMPANY_DEPARTMENTS)

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

export interface Group {
  id: string
  module_id: string
  title: string
  order_index: number
  created_at: string
}

export interface Section {
  id: string
  module_id: string
  group_id?: string | null
  title: string
  order_index: number
  created_at: string
  content_blocks?: ContentBlock[]
}

export type ContentBlockType = 'text' | 'video' | 'quiz'

export interface TextContent {
  html: string
}

export type VideoSource = 'youtube' | 'upload'

export interface VideoContent {
  source?: VideoSource
  youtube_url: string
  youtube_id: string
  upload_url?: string
  upload_path?: string
  caption?: string
}

export type QuestionType = 'multiple_choice' | 'long_answer'

export interface QuizQuestion {
  id: string
  type?: QuestionType // defaults to 'multiple_choice' when absent, for backward compatibility
  question: string
  // multiple_choice only:
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
  answers: (number | string | undefined)[] // number = MC option index, string = long-answer text
  completed_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
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
