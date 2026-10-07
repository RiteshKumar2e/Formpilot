/**
 * Workspace state for the product. One interface, two data sources:
 *  - Demo Mode: a local, fictional dataset (src/product/demoData.ts). Processing is simulated and labelled.
 *  - Account mode: documents, profile, conflicts and field mapping come from the FastAPI backend.
 *    Applications are not stored by the API yet, so in account mode they are saved in this browser.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import type { DocumentRecord, FieldMatch, Profile as ApiProfile } from '../types/api'
import { buildFields, createDemoWorkspace, documentFields, TEMPLATE_FIELDS } from './demoData'
import { deriveStatus } from './selectors'
import type {
  ActivityItem,
  ActivityKind,
  Application,
  ApplicationField,
  ApplicationType,
  DataMode,
  DocumentCategory,
  DocumentItem,
  ProfileField,
  ProfileSection,
  WorkspaceData,
} from './types'

const DEMO_KEY = 'fp-demo-workspace'
const MODE_KEY = 'fp-mode'
const ACCOUNT_APPS_KEY = (email: string) => `fp-apps:${email}`

export type UploadStage = 'uploading' | 'ocr' | 'extracting' | 'validating' | 'ready'
export const UPLOAD_STAGES: { id: UploadStage; label: string }[] = [
  { id: 'uploading', label: 'Uploading' },
  { id: 'ocr', label: 'Reading text (OCR)' },
  { id: 'extracting', label: 'Extracting information' },
  { id: 'validating', label: 'Validating against your profile' },
  { id: 'ready', label: 'Ready' },
]

export class WorkspaceError extends Error {
  reason: string
  action: 'retry' | 'signin' | 'choose_file'

  constructor(message: string, reason: string, action: WorkspaceError['action']) {
    super(message)
    this.reason = reason
    this.action = action
  }
}

interface NewApplication {
  title: string
  organization: string
  type: ApplicationType
  labels: string[]
}

interface WorkspaceContextValue {
  mode: DataMode | null
  data: WorkspaceData | null
  loading: boolean
  error: WorkspaceError | null
  startDemo: () => void
  resetDemo: () => void
  enterAccount: (user: { full_name: string; email: string }) => void
  leave: () => void
  reload: () => Promise<void>
  uploadDocument: (file: File, onStage: (stage: UploadStage, percent?: number) => void) => Promise<DocumentItem>
  deleteDocument: (id: string) => Promise<void>
  updateProfileValue: (key: string, value: string) => Promise<void>
  resolveConflict: (key: string, value: string, source: string | null) => Promise<void>
  createApplication: (input: NewApplication) => Promise<string>
  updateField: (appId: string, fieldId: string, patch: Partial<ApplicationField>) => void
  acceptField: (appId: string, fieldId: string) => void
  approveApplication: (appId: string) => void
  deleteApplication: (appId: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

// ---------- helpers ----------

const now = () => new Date().toISOString()
let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function activity(kind: ActivityKind, title: string, detail: string, applicationId?: string): ActivityItem {
  return { id: uid('act'), kind, title, detail, at: now(), applicationId }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: state still works for this session.
  }
}

export function guessCategory(name: string): DocumentCategory {
  const n = name.toLowerCase()
  if (/resume|cv/.test(n)) return 'Resume'
  if (/degree|transcript|marksheet|mark_sheet|diploma|grade/.test(n)) return 'Education'
  if (/experience|offer|employment|internship|relieving/.test(n)) return 'Experience'
  if (/passport|national|aadhaar|id_|_id|licen|photo/.test(n)) return 'Identity'
  if (/certificate|certification|course/.test(n)) return 'Certificates'
  return 'Other'
}

const SECTION_FOR: Record<string, ProfileSection> = {
  full_name: 'personal',
  date_of_birth: 'personal',
  email: 'contact',
  phone: 'contact',
  linkedin: 'contact',
  github: 'contact',
  highest_qualification: 'education',
  institution: 'education',
  graduation_year: 'education',
  experience: 'experience',
  skills: 'skills',
}

function fromApiProfile(p: ApiProfile): ProfileField[] {
  const fields: ProfileField[] = p.fields.map((f) => ({
    key: f.key,
    label: f.label,
    section: SECTION_FOR[f.key] ?? 'personal',
    value: f.value,
    source: f.source_filename,
    confidence: f.confidence,
    verified: f.confidence >= 0.9 || f.source_filename.includes('confirmed by you'),
  }))
  for (const c of p.conflicts) {
    fields.push({
      key: c.key,
      label: c.label,
      section: SECTION_FOR[c.key] ?? 'personal',
      value: '',
      source: null,
      confidence: 0,
      verified: false,
      conflict: c.values.map((v) => ({ value: v.value, source: v.source_filename })),
    })
  }
  return fields
}

function fromApiDocument(d: DocumentRecord): DocumentItem {
  const ext = d.content_type === 'application/pdf' ? 'PDF' : d.content_type === 'image/png' ? 'PNG' : 'JPG'
  return {
    id: d.id,
    name: d.filename,
    category: guessCategory(d.filename),
    fileType: ext,
    sizeKb: Math.max(1, Math.round(d.size_bytes / 1024)),
    pages: d.page_count,
    status: d.status,
    verified: d.status === 'processed',
    uploadedAt: d.created_at,
    message: d.message,
    extracted: d.extracted.map((e) => ({ label: e.label, value: e.value, confidence: e.confidence })),
  }
}

function fromApiMatch(m: FieldMatch, profile: ProfileField[]): ApplicationField {
  const conflict = m.needs_review ? profile.find((p) => p.key === m.key)?.conflict : undefined
  const base = {
    id: uid('f'),
    section: 'Additional Information',
    label: m.form_label,
    required: true,
    profileKey: m.key,
    candidates: conflict ? conflict.map((c) => ({ ...c, score: 1 })) : [],
  }
  const section =
    m.key && SECTION_FOR[m.key]
      ? ({ personal: 'Personal Information', contact: 'Personal Information', education: 'Education', experience: 'Experience', skills: 'Skills' } as const)[SECTION_FOR[m.key]]
      : 'Additional Information'
  if (conflict) {
    return { ...base, section, value: '', status: 'conflict', source: null, confidence: 0, reasoning: 'Your documents disagree on this value, so FormPilot needs you to choose.' }
  }
  if (!m.value) {
    return { ...base, section, value: '', status: 'missing', source: null, confidence: 0, reasoning: `No profile detail matches “${m.form_label}” yet.` }
  }
  return {
    ...base,
    section,
    value: m.value,
    status: m.confidence >= 0.8 ? 'mapped' : 'needs_review',
    source: m.source_filename,
    confidence: m.confidence,
    reasoning: `Matched by the FormPilot API to your ${m.key?.replace(/_/g, ' ')}, extracted from ${m.source_filename}.`,
  }
}

function toWorkspaceError(err: unknown, fallback: string): WorkspaceError {
  if (err instanceof WorkspaceError) return err
  if (err instanceof ApiError) {
    if (err.status === 401) return new WorkspaceError('Your session expired.', 'For your security, sessions end after 12 hours.', 'signin')
    if (err.status === 0) return new WorkspaceError('Network error.', 'FormPilot couldn’t reach the server. Check your connection.', 'retry')
    if (err.status === 415) return new WorkspaceError('Unsupported file.', err.message, 'choose_file')
    if (err.status === 413) return new WorkspaceError('File too large.', err.message, 'choose_file')
    if (err.status === 429) return new WorkspaceError('Too many attempts.', err.message, 'retry')
    return new WorkspaceError(fallback, err.message, 'retry')
  }
  return new WorkspaceError(fallback, 'Something unexpected happened.', 'retry')
}

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg']

function validateFile(file: File) {
  if (!ACCEPTED.includes(file.type)) {
    throw new WorkspaceError('Unsupported file.', `${file.name} isn’t a PDF, JPG or PNG.`, 'choose_file')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new WorkspaceError('File too large.', `${file.name} is larger than 10 MB. Try a compressed or single-page version.`, 'choose_file')
  }
  if (file.size === 0) throw new WorkspaceError('Empty file.', `${file.name} has no content.`, 'choose_file')
}

/** Applies a profile value to every open application that maps to that key. */
function propagate(apps: Application[], key: string, value: string, source: string | null): Application[] {
  return apps.map((app) => {
    if (app.status === 'prepared') return app
    let changed = false
    const fields = app.fields.map((f) => {
      if (f.profileKey !== key || f.status === 'confirmed') return f
      changed = true
      return { ...f, value, source, status: 'confirmed' as const, confidence: 1, reasoning: source ? `Confirmed by you from ${source}.` : 'Entered by you.' }
    })
    if (!changed) return app
    const next = { ...app, fields, updatedAt: now() }
    return { ...next, status: deriveStatus(next) }
  })
}

// ---------- provider ----------

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DataMode | null>(() => (readJson<DataMode>(MODE_KEY) === 'demo' ? 'demo' : null))
  // If Demo Mode is on but its saved data is gone (cleared storage, private window), start fresh.
  const [data, setData] = useState<WorkspaceData | null>(() =>
    readJson<DataMode>(MODE_KEY) === 'demo' ? (readJson<WorkspaceData>(DEMO_KEY) ?? createDemoWorkspace()) : null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<WorkspaceError | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  // Persist: demo data to its own key, account applications per user.
  useEffect(() => {
    if (!data) return
    if (mode === 'demo') writeJson(DEMO_KEY, data)
    if (mode === 'account') writeJson(ACCOUNT_APPS_KEY(data.user.email), data.applications)
  }, [data, mode])

  const update = useCallback((fn: (d: WorkspaceData) => WorkspaceData) => {
    setData((d) => (d ? fn(d) : d))
  }, [])

  const startDemo = useCallback(() => {
    const saved = readJson<WorkspaceData>(DEMO_KEY)
    writeJson(MODE_KEY, 'demo')
    setError(null)
    setMode('demo')
    setData(saved ?? createDemoWorkspace())
  }, [])

  const resetDemo = useCallback(() => {
    const fresh = createDemoWorkspace()
    writeJson(DEMO_KEY, fresh)
    writeJson(MODE_KEY, 'demo')
    setMode('demo')
    setError(null)
    setData(fresh)
  }, [])

  const loadAccount = useCallback(async (user: { name: string; email: string }) => {
    setLoading(true)
    setError(null)
    try {
      const [docs, profile] = await Promise.all([api.documents.list(), api.profile.get()])
      setData({
        user,
        profile: fromApiProfile(profile),
        documents: docs.map(fromApiDocument),
        applications: readJson<Application[]>(ACCOUNT_APPS_KEY(user.email)) ?? [],
        activity: docs.map((d) => activity('document_uploaded', 'Document uploaded', d.filename)).map((a, i) => ({ ...a, at: docs[i].created_at })),
      })
    } catch (err) {
      setError(toWorkspaceError(err, 'Couldn’t load your workspace.'))
    } finally {
      setLoading(false)
    }
  }, [])

  const enterAccount = useCallback(
    (user: { full_name: string; email: string }) => {
      writeJson(MODE_KEY, 'account')
      setMode('account')
      void loadAccount({ name: user.full_name, email: user.email })
    },
    [loadAccount],
  )

  const leave = useCallback(() => {
    try {
      localStorage.removeItem(MODE_KEY)
    } catch {
      /* ignore */
    }
    setMode(null)
    setData(null)
    setError(null)
  }, [])

  const reload = useCallback(async () => {
    if (mode === 'account' && dataRef.current) await loadAccount(dataRef.current.user)
  }, [mode, loadAccount])

  const refreshAccountProfile = useCallback(async () => {
    const profile = fromApiProfile(await api.profile.get())
    update((d) => ({ ...d, profile }))
  }, [update])

  const uploadDocument = useCallback<WorkspaceContextValue['uploadDocument']>(
    async (file, onStage) => {
      validateFile(file)
      if (mode === 'demo') {
        // Demo Mode: no file content is read. Stages are simulated and the UI says so.
        for (const stage of UPLOAD_STAGES) {
          onStage(stage.id, stage.id === 'uploading' ? 100 : undefined)
          await wait(stage.id === 'ready' ? 150 : 650)
        }
        const doc: DocumentItem = {
          id: uid('doc'),
          name: file.name,
          category: guessCategory(file.name),
          fileType: file.type === 'application/pdf' ? 'PDF' : file.type === 'image/png' ? 'PNG' : 'JPG',
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
          pages: null,
          status: 'processed',
          verified: false,
          uploadedAt: now(),
          message: 'Processing was simulated in Demo Mode, so no details were read from this file. Sign in to extract real details.',
          extracted: [],
        }
        update((d) => ({
          ...d,
          documents: [doc, ...d.documents],
          activity: [activity('document_uploaded', 'Document uploaded', `${file.name} (Demo Mode)`), ...d.activity],
        }))
        return doc
      }

      try {
        const record = await api.documents.upload(file, (p) => onStage('uploading', p))
        onStage('extracting')
        const doc = fromApiDocument(record)
        onStage('ready')
        update((d) => ({
          ...d,
          documents: [doc, ...d.documents],
          activity: [
            doc.status === 'failed'
              ? activity('document_failed', 'Document processing failed', file.name)
              : activity('information_extracted', `${file.name} processed`, `${doc.extracted.length} details extracted`),
            ...d.activity,
          ],
        }))
        await refreshAccountProfile()
        return doc
      } catch (err) {
        const e = toWorkspaceError(err, 'We couldn’t process this document.')
        if (e.action === 'signin') setError(e)
        throw e
      }
    },
    [mode, update, refreshAccountProfile],
  )

  const deleteDocument = useCallback(
    async (id: string) => {
      if (mode === 'account') {
        try {
          await api.documents.remove(id)
          await refreshAccountProfile()
        } catch (err) {
          throw toWorkspaceError(err, 'Couldn’t delete this document.')
        }
      }
      update((d) => ({ ...d, documents: d.documents.filter((doc) => doc.id !== id) }))
    },
    [mode, update, refreshAccountProfile],
  )

  const resolveConflict = useCallback(
    async (key: string, value: string, source: string | null) => {
      if (mode === 'account') {
        try {
          const profile = fromApiProfile(await api.profile.resolveConflict(key, value))
          update((d) => ({ ...d, profile }))
        } catch (err) {
          throw toWorkspaceError(err, 'Couldn’t save your choice.')
        }
      }
      update((d) => {
        const field = d.profile.find((f) => f.key === key)
        return {
          ...d,
          profile:
            mode === 'demo'
              ? d.profile.map((f) => (f.key === key ? { ...f, value, source, confidence: 1, verified: true, conflict: undefined } : f))
              : d.profile,
          applications: propagate(d.applications, key, value, source),
          activity: [activity('issue_resolved', 'Issue resolved', `${field?.label ?? key} set to ${value}${source ? ` from ${source}` : ''}`), ...d.activity],
        }
      })
    },
    [mode, update],
  )

  const updateProfileValue = useCallback(
    async (key: string, value: string) => {
      if (mode === 'account') {
        try {
          const profile = fromApiProfile(await api.profile.resolveConflict(key, value))
          update((d) => ({ ...d, profile }))
        } catch (err) {
          throw toWorkspaceError(err, 'Couldn’t save this change.')
        }
      }
      update((d) => {
        const field = d.profile.find((f) => f.key === key)
        return {
          ...d,
          profile:
            mode === 'demo'
              ? d.profile.map((f) => (f.key === key ? { ...f, value, source: null, confidence: 1, verified: true, conflict: undefined } : f))
              : d.profile,
          applications: propagate(d.applications, key, value, null),
          activity: [activity('profile_updated', 'Profile updated', `${field?.label ?? key} edited`), ...d.activity],
        }
      })
    },
    [mode, update],
  )

  const createApplication = useCallback(
    async ({ title, organization, type, labels }: NewApplication) => {
      const current = dataRef.current
      if (!current) throw new WorkspaceError('No workspace loaded.', 'Start the demo or sign in first.', 'signin')
      const cleaned = labels.map((l) => l.trim()).filter(Boolean)
      if (!cleaned.length) throw new WorkspaceError('No fields to map.', 'Add at least one form field.', 'retry')

      let fields: ApplicationField[]
      if (mode === 'account') {
        try {
          const { matches } = await api.mapping.match(cleaned)
          fields = matches.map((m) => fromApiMatch(m, current.profile))
        } catch (err) {
          throw toWorkspaceError(err, 'Couldn’t map this application.')
        }
      } else {
        fields = buildFields(cleaned, current.profile)
        if (type === 'job' || type === 'admission') {
          const docs = current.documents.filter((d) => d.category === 'Resume' || d.category === 'Education').map((d) => d.name)
          fields = [...fields, ...documentFields(docs.slice(0, 3))]
        }
      }

      const id = uid('app')
      const app: Application = {
        id,
        title,
        organization,
        type,
        status: 'needs_review',
        createdAt: now(),
        updatedAt: now(),
        reference: null,
        preparedAt: null,
        fields,
      }
      app.status = deriveStatus(app)
      const mapped = fields.filter((f) => f.value).length
      const conflicts = fields.filter((f) => f.status === 'conflict')
      update((d) => ({
        ...d,
        applications: [app, ...d.applications],
        activity: [
          ...conflicts.map((f) => activity('conflict_detected', 'Conflict detected', `${f.label} differs between your documents`, id)),
          activity('fields_mapped', 'Fields mapped', `${mapped} of ${fields.length} fields mapped for ${title}`, id),
          activity('application_created', 'Application created', `${title}${organization ? ` at ${organization}` : ''}`, id),
          ...d.activity,
        ],
      }))
      return id
    },
    [mode, update],
  )

  const updateField = useCallback(
    (appId: string, fieldId: string, patch: Partial<ApplicationField>) => {
      update((d) => ({
        ...d,
        applications: d.applications.map((a) => {
          if (a.id !== appId) return a
          const next = {
            ...a,
            status: a.status === 'prepared' ? ('ready' as const) : a.status,
            reference: a.status === 'prepared' ? null : a.reference,
            fields: a.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
            updatedAt: now(),
          }
          return { ...next, status: deriveStatus(next) }
        }),
      }))
    },
    [update],
  )

  const acceptField = useCallback(
    (appId: string, fieldId: string) => updateField(appId, fieldId, { status: 'confirmed' }),
    [updateField],
  )

  const approveApplication = useCallback(
    (appId: string) => {
      update((d) => {
        const app = d.applications.find((a) => a.id === appId)
        if (!app) return d
        const reference = `FP-2026-${String(124 + d.applications.filter((a) => a.reference).length).padStart(5, '0')}`
        return {
          ...d,
          applications: d.applications.map((a) => (a.id === appId ? { ...a, status: 'prepared', reference, preparedAt: now(), updatedAt: now() } : a)),
          activity: [activity('application_approved', 'Application approved', `${app.title} is ready for submission (${reference})`, appId), ...d.activity],
        }
      })
    },
    [update],
  )

  const deleteApplication = useCallback(
    (appId: string) => update((d) => ({ ...d, applications: d.applications.filter((a) => a.id !== appId) })),
    [update],
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      mode,
      data,
      loading,
      error,
      startDemo,
      resetDemo,
      enterAccount,
      leave,
      reload,
      uploadDocument,
      deleteDocument,
      updateProfileValue,
      resolveConflict,
      createApplication,
      updateField,
      acceptField,
      approveApplication,
      deleteApplication,
    }),
    [mode, data, loading, error, startDemo, resetDemo, enterAccount, leave, reload, uploadDocument, deleteDocument, updateProfileValue, resolveConflict, createApplication, updateField, acceptField, approveApplication, deleteApplication],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}

export { TEMPLATE_FIELDS }
