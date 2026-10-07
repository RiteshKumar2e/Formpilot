import type { Application, ApplicationField, ApplicationStatus, ProfileField, WorkspaceData } from './types'

export const isComplete = (f: ApplicationField) => Boolean(f.value) && (f.status === 'mapped' || f.status === 'confirmed')
export const isIssue = (f: ApplicationField) => f.status === 'conflict' || f.status === 'needs_review' || (f.status === 'missing' && f.required)
export const isBlocking = (f: ApplicationField) => f.status === 'conflict' || (f.status === 'missing' && f.required)

export function progress(app: Application): number {
  if (!app.fields.length) return 0
  return Math.round((app.fields.filter(isComplete).length / app.fields.length) * 100)
}

export function summary(app: Application) {
  const total = app.fields.length
  const completed = app.fields.filter(isComplete).length
  const verified = app.fields.filter((f) => isComplete(f) && (f.status === 'confirmed' || f.confidence >= 0.9)).length
  const issues = app.fields.filter(isIssue)
  const blocking = app.fields.filter(isBlocking)
  const warnings = app.fields.filter((f) => f.status === 'needs_review' || (f.status === 'missing' && !f.required))
  const documents = app.fields.filter((f) => f.section === 'Documents' && f.value).length
  return { total, completed, verified, issues, blocking, warnings, documents, progress: progress(app) }
}

/** Status after a change: issues keep it in review; a clean draft or review becomes ready. */
export function deriveStatus(app: Application): ApplicationStatus {
  if (app.status === 'prepared' || app.status === 'processing') return app.status
  if (!app.fields.length) return 'draft'
  const { issues } = summary(app)
  if (issues.length === 0) return 'ready'
  return app.status === 'draft' ? 'draft' : 'needs_review'
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  processing: 'Processing',
  needs_review: 'Needs attention',
  ready: 'Ready for review',
  prepared: 'Ready for Submission',
}

const CORE_KEYS = ['full_name', 'email', 'phone', 'date_of_birth', 'highest_qualification', 'institution', 'experience', 'skills']

/** Share of the core profile details that have a value. */
export function profileCompleteness(profile: ProfileField[]): number {
  const filled = CORE_KEYS.filter((k) => profile.some((f) => f.key === k && f.value)).length
  return Math.round((filled / CORE_KEYS.length) * 100)
}

export function needsReviewCount(data: WorkspaceData): number {
  return data.applications.filter((a) => a.status === 'needs_review').length
}

export function sectionsOf(app: Application): string[] {
  const order = ['Personal Information', 'Education', 'Experience', 'Skills', 'Documents', 'Additional Information']
  const present = new Set(app.fields.map((f) => f.section))
  return order.filter((s) => present.has(s))
}

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'just now'
  if (abs < 3600) return RTF.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return RTF.format(Math.round(diff / 3600), 'hour')
  return RTF.format(Math.round(diff / 86400), 'day')
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const time = d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`
  return `${d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`
}
