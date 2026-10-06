// Shared types mirroring the FastAPI response schemas (backend/app/schemas.py).

export interface User {
  id: string
  full_name: string
  email: string
  created_at: string
}

export type DocumentStatus = 'processing' | 'processed' | 'needs_review' | 'failed'

export interface ExtractedField {
  key: string
  label: string
  value: string
  confidence: number
}

export interface DocumentRecord {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  page_count: number | null
  status: DocumentStatus
  message: string | null
  extracted: ExtractedField[]
  created_at: string
}

export interface ProfileField {
  key: string
  label: string
  value: string
  confidence: number
  source_filename: string
}

export interface ConflictValue {
  value: string
  source_filename: string
}

export interface Conflict {
  key: string
  label: string
  values: ConflictValue[]
}

export interface Profile {
  fields: ProfileField[]
  conflicts: Conflict[]
  completeness: number
}

export interface FieldMatch {
  form_label: string
  key: string | null
  value: string | null
  confidence: number
  source_filename: string | null
  needs_review: boolean
}

export interface SignUpPayload {
  full_name: string
  email: string
  password: string
  website?: string // honeypot
}

export interface SignInPayload {
  email: string
  password: string
}

export interface ContactPayload {
  name: string
  email: string
  message: string
  website?: string // honeypot
}
