/**
 * Workspace state for the signed-in user.
 * Documents, profile, conflicts, field mapping and applications live in the FastAPI backend
 * (applications are stored encrypted). Only the activity log is kept in this browser.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import type { ApplicationTemplate, DocumentRecord, FieldMatch, Profile as ApiProfile } from '../types/api'
import { deriveStatus } from './selectors'
import type {
  ActivityItem,
  ActivityKind,
  Application,
  ApplicationField,
  ApplicationType,
  DocumentCategory,
  DocumentItem,
  ProfileField,
  ProfileSection,
  WorkspaceData,
} from './types'

const APPS_KEY = (email: string) => `fp-apps:${email}`
const ACTIVITY_KEY = (email: string) => `fp-activity:${email}`

export type UploadStage = 'uploading' | 'extracting' | 'ready'
export const UPLOAD_STAGES: { id: UploadStage; label: string }[] = [
  { id: 'uploading', label: 'Uploading' },
  { id: 'extracting', label: 'Extracting information' },
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
  /** A saved template whose answers fill fields the profile doesn't cover. */
  templateId?: string
}

const normLabel = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Fills still-empty fields from a template; every reused value is left for the user to review. */
function applyTemplate(fields: ApplicationField[], template: ApplicationTemplate): ApplicationField[] {
  const byLabel = new Map(template.fields.filter((f) => f.value).map((f) => [normLabel(f.label), f]))
  return fields.map((f) => {
    if (f.value || f.status === 'conflict') return f
    const saved = byLabel.get(normLabel(f.label))
    if (!saved) return f
    return {
      ...f,
      value: saved.value,
      status: 'needs_review',
      source: `Template: ${template.name}`,
      confidence: 0.7,
      reasoning: `Reused from your “${template.name}” template. Check it fits this application.`,
    }
  })
}

interface WorkspaceContextValue {
  data: WorkspaceData | null
  loading: boolean
  error: WorkspaceError | null
  open: (user: { full_name: string; email: string }) => void
  close: () => void
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
  linkedin: 'links',
  github: 'links',
  highest_qualification: 'education',
  institution: 'education',
  graduation_year: 'education',
  experience: 'experience',
  skills: 'skills',
  projects: 'projects',
  achievements: 'achievements',
  certifications: 'certifications',
  address: 'addresses',
}

const FORM_SECTION: Record<ProfileSection, string> = {
  personal: 'Personal Information',
  contact: 'Personal Information',
  education: 'Education',
  experience: 'Experience',
  skills: 'Skills',
  projects: 'Experience',
  achievements: 'Experience',
  certifications: 'Education',
  links: 'Personal Information',
  addresses: 'Personal Information',
}

/** Details every profile should have; mirrors CORE_FIELDS in backend/app/services/fields.py. */
export const CORE_FIELDS: { key: string; label: string }[] = [
  { key: 'full_name', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'date_of_birth', label: 'Date of birth' },
  { key: 'highest_qualification', label: 'Highest qualification' },
  { key: 'institution', label: 'Institution' },
  { key: 'experience', label: 'Professional experience' },
  { key: 'skills', label: 'Skills' },
]

function fromApiProfile(p: ApiProfile): ProfileField[] {
  const fields: ProfileField[] = p.fields.map((f) => ({
    key: f.key,
    label: f.label,
    section: SECTION_FOR[f.key] ?? 'personal',
    value: f.value,
    source: f.source_filename,
    confidence: f.confidence,
    verified: f.verified,
    verification: f.verification,
    sources: f.sources,
    updatedAt: f.updated_at,
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
      verification: 'unverified',
      sources: c.values.map((v) => v.source_filename),
      updatedAt: null,
      conflict: c.values.map((v) => ({ value: v.value, source: v.source_filename })),
    })
  }
  // Core details not found in any document appear as empty rows the user can fill in.
  for (const core of CORE_FIELDS) {
    if (!fields.some((f) => f.key === core.key)) {
      fields.push({
        key: core.key,
        label: core.label,
        section: SECTION_FOR[core.key],
        value: '',
        source: null,
        confidence: 0,
        verified: false,
        verification: 'unverified',
        sources: [],
        updatedAt: null,
      })
    }
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
  // Only keys stored in the profile can be saved back to it (address, emergency contact etc. stay per application).
  const profileKey = m.key && SECTION_FOR[m.key] ? m.key : null
  const conflict = m.needs_review ? profile.find((p) => p.key === m.key)?.conflict : undefined
  const section = m.key && SECTION_FOR[m.key] ? FORM_SECTION[SECTION_FOR[m.key]] : 'Additional Information'
  const base = {
    id: uid('f'),
    section,
    label: m.form_label,
    // Profile links are usually optional on real forms; everything else is treated as required.
    required: !/linkedin|github|portfolio|website/i.test(m.form_label),
    profileKey,
    candidates: conflict ? conflict.map((c) => ({ ...c, score: 1 })) : [],
  }
  if (conflict) {
    return { ...base, value: '', status: 'conflict', source: null, confidence: 0, reasoning: 'Your documents disagree on this value, so FormPilot needs you to choose.' }
  }
  if (!m.value) {
    return {
      ...base,
      value: '',
      status: 'missing',
      source: null,
      confidence: 0,
      reasoning: m.key
        ? `“${m.form_label}” asks for your ${m.key.replace(/_/g, ' ')}, which isn’t in your profile yet.`
        : `No profile detail matches “${m.form_label}”. Add it here and it will be kept for this application.`,
    }
  }
  const how =
    m.method === 'semantic' ? ' by meaning' : m.method === 'llm_rag' ? ' by AI, checked against your documents' : ''
  return {
    ...base,
    value: m.value,
    status: m.confidence >= 0.8 ? 'mapped' : 'needs_review',
    source: m.source_filename,
    confidence: m.confidence,
    reasoning:
      m.reasoning ??
      `“${m.form_label}” was matched${how} to your ${m.key?.replace(/_/g, ' ') ?? 'details'}, from ${m.source_filename}.`,
  }
}

function toWorkspaceError(err: unknown, fallback: string): WorkspaceError {
  if (err instanceof WorkspaceError) return err
  if (err instanceof ApiError) {
    if (err.status === 401) return new WorkspaceError('Your session expired.', 'Sign in again to continue. Sessions end after a while, or when your password changes.', 'signin')
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
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<WorkspaceError | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  // The activity log is kept per account in this browser.
  useEffect(() => {
    if (!data) return
    writeJson(ACTIVITY_KEY(data.user.email), data.activity)
  }, [data])

  // Applications are saved to the API shortly after they change. `synced` holds what the server has.
  const synced = useRef(new Map<string, string>())
  useEffect(() => {
    if (!data) return
    const timer = window.setTimeout(() => {
      const current = new Map(data.applications.map((a) => [a.id, JSON.stringify(a)]))
      for (const app of data.applications) {
        const json = current.get(app.id)!
        if (synced.current.get(app.id) === json) continue
        api.applications
          .save(app)
          .then(() => synced.current.set(app.id, json))
          .catch(() => {
            /* Kept in memory; retried with the next change. */
          })
      }
      for (const id of [...synced.current.keys()]) {
        if (current.has(id)) continue
        api.applications
          .remove(id)
          .then(() => synced.current.delete(id))
          .catch((err) => {
            if (err instanceof ApiError && err.status === 404) synced.current.delete(id)
          })
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [data])

  // Clean up storage left by earlier builds that had a demo mode.
  useEffect(() => {
    try {
      localStorage.removeItem('fp-demo-workspace')
      localStorage.removeItem('fp-mode')
    } catch {
      /* ignore */
    }
  }, [])

  const update = useCallback((fn: (d: WorkspaceData) => WorkspaceData) => {
    setData((d) => (d ? fn(d) : d))
  }, [])

  const load = useCallback(async (user: { name: string; email: string }) => {
    setLoading(true)
    setError(null)
    try {
      const [docs, profile, remoteApps] = await Promise.all([
        api.documents.list(),
        api.profile.get(),
        api.applications.list<Application>(),
      ])
      const saved = readJson<ActivityItem[]>(ACTIVITY_KEY(user.email))
      // Earlier versions kept applications only in this browser: move them to the server once.
      const localApps = readJson<Application[]>(APPS_KEY(user.email)) ?? []
      const remoteIds = new Set(remoteApps.map((a) => a.id))
      const toMigrate = localApps.filter((a) => !remoteIds.has(a.id))
      const migrated = await Promise.allSettled(toMigrate.map((a) => api.applications.save(a)))
      if (migrated.every((r) => r.status === 'fulfilled')) {
        try {
          localStorage.removeItem(APPS_KEY(user.email))
        } catch {
          /* ignore */
        }
      }
      const applications = [...remoteApps, ...toMigrate]
      synced.current = new Map(
        applications
          .filter((_app, i) => i < remoteApps.length || migrated[i - remoteApps.length]?.status === 'fulfilled')
          .map((a) => [a.id, JSON.stringify(a)]),
      )
      setData({
        user,
        profile: fromApiProfile(profile),
        documents: docs.map(fromApiDocument),
        applications,
        activity: saved ?? docs.map((d) => ({ ...activity('document_uploaded', 'Document uploaded', d.filename), at: d.created_at })),
      })
    } catch (err) {
      setError(toWorkspaceError(err, 'Couldn’t load your workspace.'))
    } finally {
      setLoading(false)
    }
  }, [])

  const open = useCallback(
    (user: { full_name: string; email: string }) => {
      if (dataRef.current?.user.email === user.email) return
      void load({ name: user.full_name, email: user.email })
    },
    [load],
  )

  const close = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  const reload = useCallback(async () => {
    if (dataRef.current) await load(dataRef.current.user)
  }, [load])

  const refreshProfile = useCallback(async () => {
    const profile = fromApiProfile(await api.profile.get())
    update((d) => ({ ...d, profile }))
  }, [update])

  const uploadDocument = useCallback<WorkspaceContextValue['uploadDocument']>(
    async (file, onStage) => {
      validateFile(file)
      try {
        const record = await api.documents.upload(file, (p) => {
          onStage('uploading', p)
          if (p >= 100) onStage('extracting')
        })
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
        await refreshProfile()
        return doc
      } catch (err) {
        const e = toWorkspaceError(err, 'We couldn’t process this document.')
        if (e.action === 'signin') setError(e)
        throw e
      }
    },
    [update, refreshProfile],
  )

  const deleteDocument = useCallback(
    async (id: string) => {
      try {
        await api.documents.remove(id)
        await refreshProfile()
      } catch (err) {
        throw toWorkspaceError(err, 'Couldn’t delete this document.')
      }
      update((d) => ({ ...d, documents: d.documents.filter((doc) => doc.id !== id) }))
    },
    [update, refreshProfile],
  )

  const saveProfileValue = useCallback(
    async (key: string, value: string, source: string | null, kind: ActivityKind, title: string) => {
      try {
        const profile = fromApiProfile(await api.profile.resolveConflict(key, value))
        update((d) => {
          const label = d.profile.find((f) => f.key === key)?.label ?? key.replace(/_/g, ' ')
          return {
            ...d,
            profile,
            applications: propagate(d.applications, key, value, source),
            activity: [activity(kind, title, `${label} set to ${value}${source ? ` from ${source}` : ''}`), ...d.activity],
          }
        })
      } catch (err) {
        throw toWorkspaceError(err, 'Couldn’t save this change.')
      }
    },
    [update],
  )

  const resolveConflict = useCallback(
    (key: string, value: string, source: string | null) => saveProfileValue(key, value, source, 'issue_resolved', 'Issue resolved'),
    [saveProfileValue],
  )

  const updateProfileValue = useCallback(
    (key: string, value: string) => saveProfileValue(key, value, null, 'profile_updated', 'Profile updated'),
    [saveProfileValue],
  )

  const createApplication = useCallback(
    async ({ title, organization, type, labels, templateId }: NewApplication) => {
      const current = dataRef.current
      if (!current) throw new WorkspaceError('Your workspace isn’t loaded.', 'Sign in again to continue.', 'signin')
      const cleaned = labels.map((l) => l.trim()).filter(Boolean)
      if (!cleaned.length) throw new WorkspaceError('No fields to map.', 'Add at least one form field.', 'retry')

      const id = uid('app')
      let fields: ApplicationField[]
      try {
        const { matches } = await api.mapping.match(cleaned, id)
        fields = matches.map((m) => fromApiMatch(m, current.profile))
        if (templateId) fields = applyTemplate(fields, await api.templates.use(templateId))
      } catch (err) {
        throw toWorkspaceError(err, 'Couldn’t map this application.')
      }

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
    [update],
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

  const acceptField = useCallback((appId: string, fieldId: string) => updateField(appId, fieldId, { status: 'confirmed' }), [updateField])

  const approveApplication = useCallback(
    (appId: string) => {
      update((d) => {
        const app = d.applications.find((a) => a.id === appId)
        if (!app) return d
        const year = new Date().getFullYear()
        const reference = `FP-${year}-${String(d.applications.filter((a) => a.reference).length + 1).padStart(5, '0')}`
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
      data,
      loading,
      error,
      open,
      close,
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
    [data, loading, error, open, close, reload, uploadDocument, deleteDocument, updateProfileValue, resolveConflict, createApplication, updateField, acceptField, approveApplication, deleteApplication],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return ctx
}
