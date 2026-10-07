import type { RatingItem, ReviewDay, ReviewQuestion, TemplateSnapshot } from './types'

// Content mirrors the "UCBE 7-90 Day Introductory Review Form" — the same
// People Analyzer / Right Person, Right Seat grid on every review, plus a
// question set that changes by review day.

export const CONSENT_TEXT =
  'In signing this evaluation, I acknowledge that I have had the opportunity to discuss it with my supervisor and/or the evaluator(s).'

export const RATING_ITEMS: RatingItem[] = [
  {
    id: 'reliability',
    group: 'core',
    label: 'Reliability',
    description:
      'We do what we are supposed to do, when we are supposed to do it, or we communicate otherwise in advance.',
  },
  {
    id: 'integrity',
    group: 'core',
    label: 'Transparent Integrity',
    description: 'Mistakes happen, but when we mess up, we fess up…openly and honestly.',
  },
  {
    id: 'innovation',
    group: 'core',
    label: 'Innovation',
    description:
      'We proactively seek new information and perspective so we can apply it to our current and future marketplace, thus continuing to always pioneer.',
  },
  {
    id: 'passion',
    group: 'core',
    label: 'Bold, Relentless Passion',
    description:
      'We are confident in our abilities and proactively seek opportunities to create synergies with suppliers, customers, partners, and employees. We know that rarely the first attempt is successful, and we are not afraid to try countless times if we believe value can be created.',
  },
  {
    id: 'sustainability',
    group: 'core',
    label: 'Sustainable Sustainability',
    description:
      'We believe in sustainability programs that last. Our work focuses on financial results, in addition to environmental.',
  },
  {
    id: 'gets_it',
    group: 'rprs',
    label: 'Gets it.',
    description: 'Does the employee understand what UCB is all about, and what is expected out of the role?',
  },
  {
    id: 'wants_it',
    group: 'rprs',
    label: 'Wants it.',
    description:
      'Does the employee want to be a part of UCB, and want to perform the responsibilities of the job?',
  },
  {
    id: 'capacity',
    group: 'rprs',
    label: 'Has the Capacity to do it.',
    description: 'Does the person have the skills, knowledge, resources, and bandwidth to do the job well?',
  },
]

const q = (id: string, text: string, extra: Partial<ReviewQuestion> = {}): ReviewQuestion => ({
  id,
  text,
  audience: 'evaluator',
  ...extra,
})

const QUESTIONS: Record<ReviewDay, ReviewQuestion[]> = {
  7: [
    q('q1', 'Has the individual demonstrated a willingness to learn their assigned job responsibilities?'),
    q('q2', 'Has the individual demonstrated the capacity to learn tasks assigned to them?'),
    q('q3', 'Is the individual effectively communicating with management and others?'),
    q('q4', 'Has the individual completed all onboarding tasks as required by HR?', { hint: 'HR to confirm.' }),
    q('q5', 'Has the individual demonstrated consistent punctuality and been present for times scheduled?'),
    q(
      'q6',
      'Have you logged in to your CoAdvantage portal? (US) / Have you started tracking time in Upwork? (PH)',
      { audience: 'reviewee' }
    ),
  ],
  30: [
    q('q1', 'Does the individual have a clear understanding of their job responsibilities and tasks?'),
    q('q2', 'In which job responsibilities or tasks does the individual excel?'),
    q('q3', 'In which job responsibilities or tasks does the individual need improvement?'),
    q(
      'q4',
      'Does the individual cooperate with immediate supervisor to accomplish work assignments effectively and efficiently?'
    ),
    q('q5', 'Does the individual demonstrate effective communication skills, both written and oral?'),
    q('q6', 'Does the individual apply consistently good judgement in objectively analyzing work situations?'),
    q('q7', 'Does the individual demonstrate competent technical skills in applications relating to their job?'),
  ],
  60: [
    q(
      'q1',
      'Is the individual capable of working with minimal direction and supervision; and demonstrates a willingness to assume difficult assignments and work against tight schedules?'
    ),
    q(
      'q2',
      'Has the individual effectively developed positive interpersonal working relationships with colleagues and helped to create a supportive work environment?'
    ),
    q('q3', 'Has the individual demonstrated punctuality and strong attendance?'),
    q('q4', 'Are the individual’s work methods/approach to accomplishing their job both effective and efficient?'),
    q('q5', 'Does the individual appear to be motivated by their tasks/responsibilities?'),
    q('q6', 'Has the individual demonstrated continuous improvement in their job-related tasks?'),
    q('q7', 'Has the individual measured favorably against their scorecard goals and performance KPIs?'),
  ],
  90: [
    q('q1', 'Has the individual demonstrated a comprehensive understanding of UCB policies and procedures?'),
    q('q2', 'When the individual works with co-workers, what interpersonal skills do they demonstrate?'),
    q(
      'q3',
      'Has the individual demonstrated the ability to carry out instructions and job duties in a dependable and reliable manner?'
    ),
    q('q4', 'Has the individual shown the ability to analyze problems, solve those problems and make sound decisions?'),
    q('q5', 'What are the individual’s professional strengths?'),
    q('q6', 'What are the individual’s professional weaknesses?'),
    q('q7', 'Has the individual been punctual with a strong attendance record?'),
    q(
      'q8',
      'Does the individual effectively and professionally communicate with upper management and/or direct supervisor?'
    ),
    q('q9', 'Is the individual showing confidence in their job assignments?'),
    q('q10', 'Is the individual the right person in the right seat?'),
  ],
}

export function buildTemplateSnapshot(day: ReviewDay): TemplateSnapshot {
  return {
    day,
    title: `${day} Day Review`,
    ratingItems: RATING_ITEMS,
    questions: QUESTIONS[day],
    hasRecommendation: day === 90,
    consentText: CONSENT_TEXT,
  }
}

// The 90-day form has no separate Evaluator signature line.
export function requiredRoles(day: ReviewDay): ('reviewee' | 'supervisor' | 'evaluator')[] {
  return day === 90 ? ['reviewee', 'supervisor'] : ['reviewee', 'supervisor', 'evaluator']
}

export const REVIEW_CLOSING_NOTE =
  'Also, we believe that the most trusted form of advertising, aside from a personal recommendation, is an online review. That is why we are asking you to provide us some feedback on Glassdoor and Indeed. Your feedback is vital to our recruitment team and senior leaders so we can better serve our employees, and it helps job seekers considering working here. Please take a moment to share an anonymous review about your work experience over the last 90 days. It only takes a few minutes.'
