import type {
  ApplicationTemplate,
  AutofillFieldInput,
  AutofillResponse,
  Capabilities,
  ExtensionConnection,
  ContactPayload,
  DocumentRecord,
  MappingResponse,
  Profile,
  SavedAnswer,
  SignInPayload,
  SmartAnswer,
  TemplateField,
  TemplateMatch,
  SignUpPayload,
  User,
  Webhook,
  WebhookEvent,
  WorkflowRun,
} from '../types/api'

/**
 * Thin client for the FormPilot FastAPI backend.
 * Auth uses an httpOnly session cookie set by the API, so no tokens are stored in the browser.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const API_ROOT = `${BASE_URL}/api`

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const NETWORK_ERROR = "We couldn't reach FormPilot. Check your connection and try again."

async function parseError(res: Response): Promise<ApiError> {
  let message = 'Something went wrong. Please try again.'
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string') message = body.detail
    else if (Array.isArray(body?.detail) && body.detail[0]?.msg) message = body.detail[0].msg
  } catch {
    // Non-JSON error body (e.g. proxy error page); keep the generic message.
    if (res.status >= 500) message = NETWORK_ERROR
  }
  return new ApiError(message, res.status)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_ROOT}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(NETWORK_ERROR, 0)
  }
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function uploadWithProgress(file: File, onProgress?: (percent: number) => void): Promise<DocumentRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)

    xhr.open('POST', `${API_ROOT}/documents`)
    xhr.withCredentials = true
    xhr.responseType = 'json'
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as DocumentRecord)
        return
      }
      const detail = xhr.response?.detail
      reject(new ApiError(typeof detail === 'string' ? detail : "We couldn't process this document.", xhr.status))
    }
    xhr.onerror = () => reject(new ApiError(NETWORK_ERROR, 0))
    xhr.send(form)
  })
}

export const api = {
  auth: {
    me: () => request<User>('/auth/me'),
    session: () => request<{ user: User | null }>('/auth/session'),
    signUp: (payload: SignUpPayload) =>
      request<User>('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
    signIn: (payload: SignInPayload) =>
      request<User>('/auth/signin', { method: 'POST', body: JSON.stringify(payload) }),
    signOut: () => request<void>('/auth/signout', { method: 'POST' }),
    deleteAccount: () => request<void>('/auth/me', { method: 'DELETE' }),
    providers: () => request<{ google: boolean }>('/auth/providers'),
    forgotPassword: (email: string) =>
      request<{ ok: boolean; expires_minutes: number; email_enabled: boolean }>('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    checkResetToken: (token: string) =>
      request<{ valid: boolean; email: string | null }>(`/auth/password/reset?token=${encodeURIComponent(token)}`),
    resetPassword: (token: string, password: string) =>
      request<{ valid: boolean; email: string | null }>('/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, password }) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<void>('/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      }),
    /** Full-page navigation: the browser goes to Google and comes back signed in. */
    googleSignInUrl: `${API_ROOT}/auth/oauth/google/start`,
  },
  documents: {
    list: () => request<DocumentRecord[]>('/documents'),
    upload: uploadWithProgress,
    remove: (id: string) => request<void>(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    /** The original file, for attaching vault documents to a form. */
    download: async (id: string): Promise<Blob> => {
      let res: Response
      try {
        res = await fetch(`${API_ROOT}/documents/${encodeURIComponent(id)}/file`, { credentials: 'include' })
      } catch {
        throw new ApiError(NETWORK_ERROR, 0)
      }
      if (!res.ok) throw await parseError(res)
      return res.blob()
    },
  },
  profile: {
    get: () => request<Profile>('/profile'),
    resolveConflict: (key: string, value: string) =>
      request<Profile>('/profile/conflicts/resolve', { method: 'POST', body: JSON.stringify({ key, value }) }),
  },
  mapping: {
    match: (fields: string[], applicationId?: string) =>
      request<MappingResponse>('/mapping', { method: 'POST', body: JSON.stringify({ fields, application_id: applicationId }) }),
  },
  applications: {
    list: <T,>() => request<T[]>('/applications'),
    save: <T extends { id: string },>(app: T) =>
      request<T>(`/applications/${encodeURIComponent(app.id)}`, { method: 'PUT', body: JSON.stringify(app) }),
    remove: (id: string) => request<void>(`/applications/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  answers: {
    list: () => request<SavedAnswer[]>('/answers'),
    create: (question: string, answer: string) =>
      request<SavedAnswer>('/answers', { method: 'POST', body: JSON.stringify({ question, answer }) }),
    update: (id: string, question: string, answer: string) =>
      request<SavedAnswer>(`/answers/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ question, answer }) }),
    remove: (id: string) => request<void>(`/answers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    suggest: (question: string, context: { organization?: string; role?: string } = {}) =>
      request<SmartAnswer>('/answers/suggest', { method: 'POST', body: JSON.stringify({ question, ...context }) }),
  },
  templates: {
    list: () => request<ApplicationTemplate[]>('/templates'),
    create: (payload: { name: string; application_type: string; organization?: string; fields: TemplateField[]; documents: string[] }) =>
      request<ApplicationTemplate>('/templates', { method: 'POST', body: JSON.stringify(payload) }),
    remove: (id: string) => request<void>(`/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    match: (labels: string[]) =>
      request<TemplateMatch | null>('/templates/match', { method: 'POST', body: JSON.stringify({ labels }) }),
    use: (id: string) => request<ApplicationTemplate>(`/templates/${encodeURIComponent(id)}/use`, { method: 'POST' }),
  },
  autofill: {
    /** What the browser extension sends: the fields it detected on another website's form. */
    suggest: (payload: { fields: AutofillFieldInput[]; page_url?: string; page_title?: string; organization?: string; role?: string }) =>
      request<AutofillResponse>('/autofill/suggest', { method: 'POST', body: JSON.stringify(payload) }),
  },
  extension: {
    list: () => request<ExtensionConnection[]>('/extension/tokens'),
    connect: (name: string) => request<ExtensionConnection>('/extension/tokens', { method: 'POST', body: JSON.stringify({ name }) }),
    disconnect: (id: string) => request<void>(`/extension/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  workflows: {
    list: (subjectId?: string) =>
      request<WorkflowRun[]>(`/workflows${subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : ''}`),
  },
  integrations: {
    list: () => request<Webhook[]>('/integrations/webhooks'),
    create: (url: string, events: WebhookEvent[]) =>
      request<Webhook>('/integrations/webhooks', { method: 'POST', body: JSON.stringify({ url, events }) }),
    remove: (id: string) => request<void>(`/integrations/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  system: {
    capabilities: () => request<Capabilities>('/system/capabilities'),
  },
  contact: {
    send: (payload: ContactPayload) =>
      request<{ ok: boolean }>('/contact', { method: 'POST', body: JSON.stringify(payload) }),
  },
}
