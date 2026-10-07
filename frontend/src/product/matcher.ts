/**
 * Field matcher used in Demo Mode. For each form label it scores every profile field
 * (retrieval), keeps the top candidates, and picks the best one (mapping).
 *
 * This is a lexical matcher: known phrasings + token overlap + character trigrams. The production
 * design swaps the scoring function for embeddings and a vector index behind the same interface
 * (see backend/app/services/mapping.py, `Embedder`).
 */
import type { ApplicationField, Candidate, ProfileField } from './types'

// The many ways application forms ask for each profile field.
export const PHRASINGS: Record<string, string[]> = {
  full_name: ['full name', 'name', 'name of applicant', 'applicant name', 'candidate name', 'legal name', 'full legal name', 'student name'],
  date_of_birth: ['date of birth', 'dob', 'birth date', 'birthday'],
  nationality: ['nationality', 'citizenship', 'country of citizenship'],
  email: ['email', 'email address', 'e-mail', 'contact email', 'email id'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'telephone'],
  address: ['address', 'current address', 'residential address', 'city', 'location', 'permanent address'],
  emergency_contact: ['emergency contact', 'emergency contact number', 'guardian contact', 'next of kin'],
  highest_qualification: [
    'highest qualification', 'highest educational qualification', 'education', 'degree', 'latest degree',
    'latest degree earned', 'education level', 'qualification', 'academic qualification',
  ],
  university: ['university', 'college', 'institution', 'name of institution', 'school', 'university name', 'institute'],
  graduation_date: ['graduation date', 'date of graduation', 'year of passing', 'graduation year', 'expected graduation', 'completion date'],
  cgpa: ['cgpa', 'gpa', 'grade', 'percentage', 'academic score', 'marks', 'aggregate'],
  experience: ['experience', 'professional experience', 'work experience', 'current role', 'most recent position', 'employment history', 'internship'],
  skills: ['skills', 'technical skills', 'key skills', 'core competencies', 'technologies', 'areas of expertise'],
  projects: ['projects', 'key projects', 'academic projects', 'portfolio', 'project work'],
  linkedin: ['linkedin', 'linkedin profile', 'linkedin url'],
  github: ['github', 'github profile', 'code repository'],
}

const STOPWORDS = new Set(['the', 'a', 'an', 'your', 'you', 'please', 'enter', 'provide', 'of', 's', 'current', 'full'])

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t)))
}

function trigrams(text: string): Set<string> {
  const s = `  ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
  const out = new Set<string>()
  for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3))
  return out
}

function overlap<T>(a: Set<T>, b: Set<T>): number {
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n
}

export function similarity(a: string, b: string): number {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return 1
  const ta = tokens(a)
  const tb = tokens(b)
  const tokenScore = ta.size && tb.size ? overlap(ta, tb) / (ta.size + tb.size - overlap(ta, tb)) : 0
  const ga = trigrams(a)
  const gb = trigrams(b)
  const trigramScore = ga.size && gb.size ? (2 * overlap(ga, gb)) / (ga.size + gb.size) : 0
  return 0.6 * tokenScore + 0.4 * trigramScore
}

/** How well a form label matches a profile key, using every known phrasing for that key. */
function labelScore(label: string, key: string, profileLabel: string): { score: number; phrase: string } {
  let best = { score: similarity(label, profileLabel), phrase: profileLabel.toLowerCase() }
  for (const phrase of PHRASINGS[key] ?? []) {
    const score = similarity(label, phrase)
    if (score > best.score) best = { score, phrase }
  }
  return best
}

const MIN_SCORE = 0.45

export interface MatchResult {
  field: ProfileField | null
  score: number
  phrase: string | null
  candidates: Candidate[]
}

/** Retrieval: rank profile fields for a label and return the top three. */
export function retrieve(label: string, profile: ProfileField[]): MatchResult {
  const ranked = profile
    .map((f) => ({ field: f, ...labelScore(label, f.key, f.label) }))
    .sort((a, b) => b.score - a.score)
  const candidates = ranked.slice(0, 3).map((r) => ({
    value: r.field.value || '(empty)',
    source: r.field.source ?? 'Entered by you',
    score: Math.round(r.score * 100) / 100,
  }))
  const top = ranked[0]
  if (!top || top.score < MIN_SCORE) return { field: null, score: top?.score ?? 0, phrase: null, candidates }
  return { field: top.field, score: top.score, phrase: top.phrase, candidates }
}

let counter = 0
const fieldId = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`

const SECTION_FOR_KEY: Record<string, string> = {
  full_name: 'Personal Information',
  date_of_birth: 'Personal Information',
  nationality: 'Personal Information',
  email: 'Personal Information',
  phone: 'Personal Information',
  address: 'Personal Information',
  emergency_contact: 'Additional Information',
  highest_qualification: 'Education',
  university: 'Education',
  graduation_date: 'Education',
  cgpa: 'Education',
  experience: 'Experience',
  projects: 'Experience',
  skills: 'Skills',
  linkedin: 'Additional Information',
  github: 'Additional Information',
}

/** Builds an application field for one form label from the profile. */
export function mapField(label: string, profile: ProfileField[], required = true): ApplicationField {
  const match = retrieve(label, profile)
  const base = { id: fieldId(), label, required, candidates: match.candidates }

  if (!match.field) {
    return {
      ...base,
      section: 'Additional Information',
      value: '',
      status: 'missing',
      profileKey: null,
      source: null,
      confidence: 0,
      reasoning: `No profile detail matches “${label}” closely enough. Add it once and FormPilot will reuse it.`,
    }
  }

  const f = match.field
  const section = SECTION_FOR_KEY[f.key] ?? 'Additional Information'
  const phraseNote =
    match.score >= 0.999
      ? `“${label}” is a known way of asking for your ${f.label.toLowerCase()}.`
      : `“${label}” closely matches “${match.phrase}”, a known way of asking for your ${f.label.toLowerCase()}.`

  if (f.conflict?.length) {
    return {
      ...base,
      section,
      value: '',
      status: 'conflict',
      profileKey: f.key,
      source: null,
      confidence: 0,
      reasoning: `${phraseNote} Your documents disagree on this value, so FormPilot needs you to choose.`,
      candidates: f.conflict.map((c) => ({ value: c.value, source: c.source, score: 1 })),
    }
  }

  if (!f.value) {
    return {
      ...base,
      section,
      value: '',
      status: 'missing',
      profileKey: f.key,
      source: null,
      confidence: 0,
      reasoning: `${phraseNote} Your profile doesn’t have this detail yet.`,
    }
  }

  const confidence = Math.round(Math.min(1, match.score) * f.confidence * 100) / 100
  const verifiedNote = f.verified ? `It is verified on ${f.source}.` : f.source ? `It was extracted from ${f.source}.` : 'You entered it yourself.'
  return {
    ...base,
    section,
    value: f.value,
    status: confidence >= 0.8 ? 'mapped' : 'needs_review',
    profileKey: f.key,
    source: f.source,
    confidence,
    reasoning: `${phraseNote} ${verifiedNote}`,
  }
}
