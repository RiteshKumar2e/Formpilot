/** Shapes of the FormPilot API responses the extension uses (backend/app/schemas.py). */

export interface SmartAnswerSource {
  type: 'profile' | 'document' | 'saved_answer'
  label: string
  detail: string | null
}

export interface Suggestion {
  id: string
  label: string
  key: string | null
  kind: 'value' | 'choice' | 'answer' | 'document' | 'consent'
  status: 'ready' | 'needs_review' | 'missing'
  value: string | null
  source: string | null
  confidence: number
  tier: 'safe' | 'review' | 'uncertain' | 'none'
  verified: boolean
  sensitive: boolean
  reasoning: string
  method: string | null
  option: string | null
  value_iso: string | null
  alternatives: { value: string; source: string | null }[]
  document_id: string | null
  sources: SmartAnswerSource[]
}

export interface SuggestResponse {
  fields: Suggestion[]
  summary: { detected: number; ready: number; needs_review: number; missing: number; verified: number; confidence: number }
  template: { id: string; name: string; score: number; reusable: number } | null
  workflow_id: string
  documents: { id: string; filename: string }[]
  profile: { key: string; label: string; value: string }[]
}

export interface SmartAnswer {
  answer: string
  method: 'llm_rag' | 'saved_answer' | 'profile_draft' | 'none'
  sources: SmartAnswerSource[]
}
