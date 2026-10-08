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

export type Verification = 'confirmed_by_you' | 'multiple_documents' | 'high_confidence' | 'unverified'

export interface ProfileField {
  key: string
  label: string
  value: string
  confidence: number
  source_filename: string
  sources: string[]
  verification: Verification
  verified: boolean
  updated_at: string | null
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
  /** How the value was found: LLM + retrieved passages, embeddings, word overlap, or not at all. */
  method: 'llm_rag' | 'semantic' | 'lexical' | 'none'
  reasoning: string | null
  /** The passage from the user's documents that best supports the value. */
  evidence: string | null
}

export interface MappingResponse {
  matches: FieldMatch[]
  workflow_id: string | null
}

export interface WorkflowStep {
  name: string
  status: 'running' | 'completed' | 'failed' | 'skipped'
  detail: string | null
  duration_ms: number
}

export interface WorkflowRun {
  id: string
  workflow: 'document_ingestion' | 'form_mapping' | string
  subject_id: string | null
  status: string
  steps: WorkflowStep[]
  started_at: string
  finished_at: string | null
}

export type WebhookEvent = 'document.processed' | 'application.created' | 'application.approved' | 'application.deleted'

export interface WebhookDelivery {
  event: string
  ok: boolean
  status_code: number | null
  error: string | null
  created_at: string
}

export interface Webhook {
  id: string
  url: string
  events: WebhookEvent[]
  active: boolean
  created_at: string
  /** Only returned once, when the webhook is created. */
  secret: string | null
  recent_deliveries: WebhookDelivery[]
}

export interface Capabilities {
  llm: { enabled: boolean; provider: string; model: string }
  embeddings: { provider: string; semantic: boolean }
  vector_store: string
  database: string
  ocr: boolean
  oauth: { google: boolean }
}

export interface SavedAnswer {
  id: string
  question: string
  answer: string
  use_count: number
  created_at: string
  updated_at: string
}

export interface SmartAnswerSource {
  type: 'profile' | 'document' | 'saved_answer'
  label: string
  detail: string | null
}

export interface SmartAnswer {
  answer: string
  method: 'llm_rag' | 'saved_answer' | 'profile_draft' | 'none'
  sources: SmartAnswerSource[]
  is_suggestion: true
}

export interface TemplateField {
  label: string
  value: string
  section?: string | null
  profileKey?: string | null
}

export interface ApplicationTemplate {
  id: string
  name: string
  application_type: string
  organization: string | null
  fields: TemplateField[]
  documents: string[]
  common_answers: TemplateField[]
  completed: number
  total: number
  use_count: number
  created_at: string
}

export interface TemplateMatch {
  id: string
  name: string
  score: number
  reusable: number
}

/** Field metadata sent to /api/autofill/suggest; the extension's FieldMeta (extension/src/core/field-detector.ts). */
export type { FieldMeta as AutofillFieldInput } from '../../extension/src/core/field-detector'

/** One suggestion from /api/autofill/suggest; shared with the browser extension. */
export type { Suggestion as AutofillSuggestion, SuggestResponse as AutofillResponse } from '../../extension/src/core/types'

export interface ExtensionConnection {
  id: string
  name: string
  created_at: string
  expires_at: string
  last_used_at: string | null
  /** Only when the browser is first connected. */
  token: string | null
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
  /** Stay signed in for 30 days instead of until the browser closes. */
  remember?: boolean
}

export interface ContactPayload {
  name: string
  email: string
  message: string
  website?: string // honeypot
}
