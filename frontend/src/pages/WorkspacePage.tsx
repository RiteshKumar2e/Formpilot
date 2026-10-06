import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { usePageMeta } from '../hooks/usePageMeta'
import type { DocumentRecord, FieldMatch, Profile } from '../types/api'
import { DocumentUploader } from '../components/product/DocumentUploader'
import { Alert, TextArea } from '../components/ui/FormControls'
import { Button } from '../components/ui/Button'
import { Container, ProgressBar, Status } from '../components/ui/primitives'

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[19px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
      {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <div className="skeleton h-1.5 w-full" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[150px_1fr] sm:gap-4">
          <div className="skeleton h-3.5 w-24" />
          <div className="space-y-1.5">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ProfilePanel({ profile, onResolve }: { profile: Profile | null; onResolve: (key: string, value: string) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null)

  return (
    <Panel title="Your profile" description="Built from your documents. Every value lists where it came from.">
      {!profile ? (
        <>
          <span className="sr-only" role="status">
            Loading your profile…
          </span>
          <ProfileSkeleton />
        </>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ProgressBar value={Math.round(profile.completeness * 100)} label="Profile completeness" className="flex-1" />
            <span className="font-mono text-[13px] text-ink">{Math.round(profile.completeness * 100)}% complete</span>
          </div>

          {profile.conflicts.map((c) => (
            <div key={c.key} className="mt-6 border-l-2 border-warning bg-warning-soft px-4 py-4">
              <p className="text-[15px] font-medium text-ink">{c.label}: your documents disagree</p>
              <p className="mt-0.5 text-[14px] text-ink-2">Choose the correct value. It will be used for every form.</p>
              <ul className="mt-3 space-y-2">
                {c.values.map((v) => (
                  <li
                    key={`${v.value}-${v.source_filename}`}
                    className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-field p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-ink">{v.value}</p>
                      <p className="truncate font-mono text-[12px] text-subtle">{v.source_filename}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === c.key}
                      onClick={async () => {
                        setBusy(c.key)
                        try {
                          await onResolve(c.key, v.value)
                        } finally {
                          setBusy(null)
                        }
                      }}
                    >
                      Use this value
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {profile.fields.length === 0 ? (
            <p className="mt-6 border border-dashed border-line-strong px-5 py-6 text-center text-[15px] text-muted">
              Details extracted from your documents will appear here.
            </p>
          ) : (
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {profile.fields.map((f) => (
                <div key={f.key} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:gap-4">
                  <dt className="text-[14px] text-subtle">{f.label}</dt>
                  <dd className="min-w-0">
                    <p className="break-words text-[15px] text-ink">{f.value}</p>
                    <p className="mt-0.5 truncate font-mono text-[12px] text-subtle">
                      {f.source_filename} · {Math.round(f.confidence * 100)}%
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </Panel>
  )
}

function MappingTester() {
  const [input, setInput] = useState('Name of applicant\nContact email\nHighest qualification\nMobile number')
  const [matches, setMatches] = useState<FieldMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const fields = input.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!fields.length) {
      setError('Add at least one form field label, one per line.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      setMatches((await api.mapping.match(fields)).matches)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title="Fill a form" description="Paste the field labels from any application form, one per line.">
      <form onSubmit={onSubmit} noValidate>
        <TextArea label="Form field labels" value={input} onChange={(e) => setInput(e.target.value)} error={error ?? undefined} rows={4} />
        <Button type="submit" size="sm" className="mt-3" disabled={loading}>
          {loading ? 'Matching…' : 'Find answers'}
        </Button>
      </form>
      {matches && (
        <ul className="mt-5 divide-y divide-line border-y border-line" aria-live="polite">
          {matches.map((m) => (
            <li key={m.form_label} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:gap-4">
              <p className="text-[14px] text-subtle sm:w-[170px] sm:shrink-0">{m.form_label}</p>
              {m.value ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[15px] text-ink">{m.value}</p>
                    <p className="truncate font-mono text-[12px] text-subtle">{m.source_filename}</p>
                  </div>
                  <Status tone={m.confidence >= 0.8 ? 'success' : 'warning'}>{Math.round(m.confidence * 100)}%</Status>
                </>
              ) : (
                <p className="text-[15px] text-warning">
                  {m.needs_review ? 'Your documents disagree on this. Resolve it in your profile first.' : 'No matching detail in your profile yet'}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function DangerZone({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.auth.deleteAccount()
      onDeleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete your account. Please try again.')
      setBusy(false)
    }
  }

  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="text-[16px] font-medium text-ink">Delete account</h2>
      <p className="mt-1 text-[15px] text-muted">Permanently removes your profile, documents and all extracted data.</p>
      {error && (
        <p role="alert" className="mt-3 text-[14px] text-danger">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-[15px] text-ink sm:mr-4">This can’t be undone. Delete everything?</p>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={() => void remove()} disabled={busy}>
            {busy ? 'Deleting…' : 'Yes, delete my account'}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" className="mt-4 text-danger" onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      )}
    </section>
  )
}

export function WorkspacePage() {
  usePageMeta({ title: 'Workspace', path: '/app' })
  const { user, loading, signOut, setUser } = useAuth()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await api.profile.get())
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Couldn’t load your profile.')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    api.documents
      .list()
      .then(setDocuments)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Couldn’t load your documents.'))
      .finally(() => setDocumentsLoading(false))
    void refreshProfile()
  }, [user, refreshProfile])

  if (loading) {
    return (
      <Container className="py-24">
        <p role="status" className="sr-only">
          Loading your workspace…
        </p>
        <div aria-hidden className="space-y-4">
          <div className="skeleton h-8 w-64" />
          <div className="skeleton h-4 w-40" />
        </div>
      </Container>
    )
  }
  if (!user) return <Navigate to="/signin?next=/app" replace />

  const needsAttention = documents.filter((d) => d.status === 'needs_review').length + (profile?.conflicts.length ?? 0)

  return (
    <Container className="py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="heading text-[30px] text-ink sm:text-[36px]">Welcome, {user.full_name.split(' ')[0]}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {documentsLoading
              ? 'Loading your documents…'
              : `${documents.length} ${documents.length === 1 ? 'document' : 'documents'}${
                  needsAttention > 0 ? ` · ${needsAttention} ${needsAttention === 1 ? 'item needs' : 'items need'} your attention` : ''
                }`}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await signOut()
            navigate('/')
          }}
        >
          Sign out
        </Button>
      </div>

      {loadError && (
        <div className="mt-6">
          <Alert tone="danger" title="Something didn’t load">
            {loadError}
          </Alert>
        </div>
      )}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel title="Documents" description="Upload resumes, certificates, transcripts and IDs.">
          <DocumentUploader
            documents={documents}
            loading={documentsLoading}
            onUploaded={(doc) => {
              setDocuments((list) => [doc, ...list])
              void refreshProfile()
            }}
            onRemoved={(id) => {
              setDocuments((list) => list.filter((d) => d.id !== id))
              void refreshProfile()
            }}
          />
        </Panel>
        <div className="space-y-6">
          <ProfilePanel
            profile={profile}
            onResolve={async (key, value) => {
              try {
                setProfile(await api.profile.resolveConflict(key, value))
              } catch (err) {
                setLoadError(err instanceof ApiError ? err.message : 'Couldn’t save your choice.')
              }
            }}
          />
          <MappingTester />
        </div>
      </div>

      <DangerZone
        onDeleted={() => {
          setUser(null)
          navigate('/')
        }}
      />
    </Container>
  )
}
