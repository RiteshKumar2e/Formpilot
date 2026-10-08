// Domain model for the FormPilot product, built from FastAPI responses (see src/product/workspace.tsx).

export type ProfileSection =
  | 'personal'
  | 'contact'
  | 'education'
  | 'experience'
  | 'skills'
  | 'projects'
  | 'achievements'
  | 'certifications'
  | 'links'
  | 'addresses'

export type Verification = 'confirmed_by_you' | 'multiple_documents' | 'high_confidence' | 'unverified'

export interface ProfileField {
  key: string
  label: string
  section: ProfileSection
  value: string
  /** Document the value was extracted from, or null if entered by the user. */
  source: string | null
  confidence: number // 0..1
  verified: boolean
  /** Why the value is trusted (or not). */
  verification: Verification
  /** Every document the value was found in. */
  sources: string[]
  updatedAt: string | null
  /** Present while documents disagree on this value and the user hasn't chosen yet. */
  conflict?: { value: string; source: string }[]
}

export type DocumentCategory = 'Resume' | 'Education' | 'Experience' | 'Identity' | 'Certificates' | 'Other'
export type DocumentStatus = 'processing' | 'processed' | 'needs_review' | 'failed'

export interface ExtractedItem {
  label: string
  value: string
  confidence: number
}

export interface DocumentItem {
  id: string
  name: string
  category: DocumentCategory
  fileType: 'PDF' | 'JPG' | 'PNG'
  sizeKb: number
  pages: number | null
  status: DocumentStatus
  verified: boolean
  uploadedAt: string // ISO
  message: string | null
  extracted: ExtractedItem[]
}

export type ApplicationType = 'job' | 'scholarship' | 'admission' | 'government' | 'custom'
export type ApplicationStatus = 'draft' | 'processing' | 'needs_review' | 'ready' | 'prepared'

export type FieldStatus = 'mapped' | 'confirmed' | 'needs_review' | 'conflict' | 'missing'

export interface Candidate {
  value: string
  source: string
  score: number // retrieval similarity 0..1
}

export interface ApplicationField {
  id: string
  section: string
  label: string
  required: boolean
  value: string
  status: FieldStatus
  profileKey: string | null
  source: string | null
  confidence: number
  reasoning: string
  /** Ranked retrieval results the mapping chose from. */
  candidates: Candidate[]
}

export interface Application {
  id: string
  title: string
  organization: string
  type: ApplicationType
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
  reference: string | null
  preparedAt: string | null
  fields: ApplicationField[]
}

export type ActivityKind =
  | 'document_uploaded'
  | 'information_extracted'
  | 'profile_updated'
  | 'application_created'
  | 'fields_mapped'
  | 'conflict_detected'
  | 'issue_resolved'
  | 'application_approved'
  | 'document_failed'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  title: string
  detail: string
  at: string // ISO
  applicationId?: string
}

export interface WorkspaceData {
  user: { name: string; email: string }
  profile: ProfileField[]
  documents: DocumentItem[]
  applications: Application[]
  activity: ActivityItem[]
}

