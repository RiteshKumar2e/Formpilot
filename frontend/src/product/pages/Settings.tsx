import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { useAuth } from '../../hooks/useAuth'
import { api, ApiError } from '../../lib/api'
import type { Capabilities, Webhook, WebhookEvent } from '../../types/api'
import { cn } from '../../lib/utils'
import { useWorkspace } from '../workspace'
import { Badge, Card, PageHeader } from '../ui'

const PREFS_KEY = 'fp-notification-prefs'

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="grid gap-4 p-5 sm:p-6 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-[14px] text-muted">{description}</p>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div>
        <p className="text-[15px] text-ink">{label}</p>
        {hint && <p className="text-[13px] text-subtle">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-accent' : 'bg-line-strong')}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  )
}

function AiEngine() {
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api.system.capabilities().then(setCaps, () => setFailed(true))
  }, [])

  if (failed) return <p className="text-[14px] text-muted">Couldn’t load the AI engine status.</p>
  if (!caps) return <p className="text-[14px] text-muted">Loading…</p>
  return (
    <>
      <Row label="Language model" hint={caps.llm.enabled ? `${caps.llm.provider} · ${caps.llm.model}` : 'Rule-based extraction is used instead.'}>
        <Badge tone={caps.llm.enabled ? 'success' : 'neutral'}>{caps.llm.enabled ? 'Active' : 'Not configured'}</Badge>
      </Row>
      <Row label="Semantic search (embeddings)" hint={caps.embeddings.provider}>
        <Badge tone={caps.embeddings.semantic ? 'success' : 'warning'}>{caps.embeddings.semantic ? 'Active' : 'Spelling only'}</Badge>
      </Row>
      <Row label="Retrieval (RAG)" hint={caps.vector_store}>
        <Badge tone="success">Active</Badge>
      </Row>
      <Row label="Database" hint={caps.database}>
        <Badge tone="success">Connected</Badge>
      </Row>
      <Row label="Text recognition (OCR)" hint="For scanned PDFs and photos of documents.">
        <Badge tone={caps.ocr ? 'success' : 'neutral'}>{caps.ocr ? 'Active' : 'Not installed'}</Badge>
      </Row>
    </>
  )
}

const EVENTS: { id: WebhookEvent; label: string }[] = [
  { id: 'document.processed', label: 'Document processed' },
  { id: 'application.created', label: 'Application created' },
  { id: 'application.approved', label: 'Application approved' },
  { id: 'application.deleted', label: 'Application deleted' },
]

function Integrations() {
  const [hooks, setHooks] = useState<Webhook[] | null>(null)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEvent[]>(['application.approved'])
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Webhook | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.integrations.list().then(setHooks, () => setError('Couldn’t load your webhooks.'))
  }, [])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!events.length) return setError('Choose at least one event.')
    setSaving(true)
    try {
      const hook = await api.integrations.create(url.trim(), events)
      setCreated(hook)
      setHooks((h) => [...(h ?? []), { ...hook, secret: null }])
      setUrl('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t add this webhook.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.integrations.remove(id)
      setHooks((h) => h?.filter((x) => x.id !== id) ?? null)
      if (created?.id === id) setCreated(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t remove this webhook.')
    }
  }

  return (
    <div className="space-y-4">
      {hooks?.map((hook) => {
        const last = hook.recent_deliveries[0]
        return (
          <div key={hook.id} className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-ink">{hook.url}</p>
              <p className="text-[13px] text-subtle">
                {hook.events.join(', ')}
                {last && ` · last delivery ${last.ok ? 'succeeded' : `failed${last.status_code ? ` (${last.status_code})` : ''}`}`}
              </p>
            </div>
            <Button variant="secondary" size="sm" className="text-danger" onClick={() => void remove(hook.id)}>
              Remove
            </Button>
          </div>
        )
      })}
      {created?.secret && (
        <div role="status" className="rounded-[var(--radius-control)] border border-success-line bg-success-soft p-3 text-[14px] text-ink-2">
          <p className="font-medium text-ink">Signing secret (shown once)</p>
          <code className="mt-1 block break-all text-[13px]">{created.secret}</code>
          <p className="mt-1 text-[13px]">Verify the X-FormPilot-Signature header (HMAC-SHA256 of the body) with this secret.</p>
        </div>
      )}
      <form onSubmit={add} className="space-y-3" noValidate>
        <label className="block">
          <span className="text-[14px] text-ink">Endpoint URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/formpilot-events"
            className="mt-1 h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px] text-ink"
            required
          />
        </label>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="mb-1 text-[14px] text-ink">Send these events</legend>
          {EVENTS.map((ev) => (
            <label key={ev.id} className="flex items-center gap-2 text-[14px] text-ink-2">
              <input
                type="checkbox"
                checked={events.includes(ev.id)}
                onChange={(e) => setEvents((cur) => (e.target.checked ? [...cur, ev.id] : cur.filter((x) => x !== ev.id)))}
              />
              {ev.label}
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="sm" disabled={saving || !url.trim()}>
          {saving ? 'Adding…' : 'Add webhook'}
        </Button>
      </form>
      <p className="text-[13px] text-subtle">
        Approved applications can also be read as label/value pairs from <code>{'GET /api/applications/{id}/autofill'}</code>.
      </p>
    </div>
  )
}

function readPrefs() {
  try {
    return { ...{ review: true, processed: true, weekly: false }, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { review: true, processed: true, weekly: false }
  }
}

export function SettingsPage() {
  usePageMeta({ title: 'Settings', path: '/settings' })
  const { data, close } = useWorkspace()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [prefs, setPrefs] = useState(readPrefs)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  if (!data) return null

  const setPref = (key: 'review' | 'processed' | 'weekly', value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const deleteAccount = async () => {
    setDeleteError(null)
    try {
      await api.auth.deleteAccount()
      setUser(null)
      close()
      navigate('/')
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Couldn’t delete your account. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, security and how FormPilot uses your data." />

      <Section title="Profile" description="How you appear in FormPilot.">
        <Row label="Name">
          <span className="text-[15px] text-ink-2">{data.user.name}</span>
        </Row>
        <Row label="Email">
          <span className="text-[15px] text-ink-2">{data.user.email}</span>
        </Row>
        <Row label="Account type">
          <Badge tone="success">FormPilot account</Badge>
        </Row>
      </Section>

      <Section title="Security" description="Protect access to your documents.">
        <Row label="Password" hint="Hashed with scrypt. Never stored in plain text.">
          <Badge>Change password: planned</Badge>
        </Row>
        <Row label="Two-factor authentication" hint="An extra code when you sign in.">
          <div className="flex items-center gap-3">
            <Badge>Planned</Badge>
            <Toggle checked={false} disabled label="Two-factor authentication" />
          </div>
        </Row>
        <Row label="Session" hint="Sessions expire after 12 hours.">
          <span className="text-[14px] text-ink-2">Active</span>
        </Row>
      </Section>

      <Section title="Notifications" description="Choose what FormPilot tells you about. Saved in this browser.">
        <Row label="Applications needing review">
          <Toggle checked={prefs.review} onChange={(v) => setPref('review', v)} label="Applications needing review" />
        </Row>
        <Row label="Document processed">
          <Toggle checked={prefs.processed} onChange={(v) => setPref('processed', v)} label="Document processed" />
        </Row>
        <Row label="Weekly summary">
          <Toggle checked={prefs.weekly} onChange={(v) => setPref('weekly', v)} label="Weekly summary" />
        </Row>
      </Section>

      <Section title="Privacy" description="Your data, your decisions.">
        <Row label="Data use" hint="Your documents are used only to build your profile and prepare your applications.">
          <Badge tone="success">Not shared</Badge>
        </Row>
        <Row label="Stored data" hint="Uploaded files, extracted details and applications are encrypted at rest.">
          <Badge tone="success">Encrypted</Badge>
        </Row>
        <div className="py-3.5">
          <Row label="Delete account" hint="Permanently removes your profile, documents and extracted data.">
            {confirmDelete ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={() => void deleteAccount()}>
                  Delete everything
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
                Delete account
              </Button>
            )}
          </Row>
          {deleteError && (
            <p role="alert" className="mt-2 text-[14px] text-danger">
              {deleteError}
            </p>
          )}
        </div>
      </Section>

      <Section title="AI engine" description="What reads your documents and fills your forms on this server.">
        <AiEngine />
      </Section>

      <Section title="Integrations" description="Send FormPilot events to your own systems with signed webhooks.">
        <Integrations />
      </Section>

      <Section title="Connected Services" description="Import documents from where they already live.">
        {['Google Drive', 'DigiLocker', 'LinkedIn'].map((s) => (
          <Row key={s} label={s}>
            <Badge>Planned</Badge>
          </Row>
        ))}
      </Section>
    </div>
  )
}
