import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { useAuth } from '../../hooks/useAuth'
import { api, ApiError } from '../../lib/api'
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

function readPrefs() {
  try {
    return { ...{ review: true, processed: true, weekly: false }, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { review: true, processed: true, weekly: false }
  }
}

export function SettingsPage() {
  usePageMeta({ title: 'Settings', path: '/settings' })
  const { data, mode, resetDemo, leave } = useWorkspace()
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [prefs, setPrefs] = useState(readPrefs)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState(false)
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
      leave()
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
        <Row label="Account type">{mode === 'demo' ? <Badge tone="warning">Demo Mode</Badge> : <Badge tone="success">FormPilot account</Badge>}</Row>
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
          <span className="text-[14px] text-ink-2">{mode === 'demo' ? 'Local demo session' : 'Active'}</span>
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
        <Row label="Stored files" hint="Uploaded files are encrypted at rest.">
          <Badge tone="success">Encrypted</Badge>
        </Row>
        {mode === 'demo' ? (
          <Row label="Demo data" hint="Restore the original sample profile, documents and applications.">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                resetDemo()
                setResetDone(true)
              }}
            >
              {resetDone ? 'Demo data reset' : 'Reset demo data'}
            </Button>
          </Row>
        ) : (
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
        )}
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
