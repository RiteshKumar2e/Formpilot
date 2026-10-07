import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, CircleDashed, Pencil, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { useWorkspace, WorkspaceError } from '../workspace'
import { profileCompleteness } from '../selectors'
import type { ProfileField, ProfileSection } from '../types'
import { Badge, Card, EmptyState, ErrorPanel, PageHeader, ProgressRing, SourceChip } from '../ui'

const SECTIONS: { id: ProfileSection; title: string }[] = [
  { id: 'personal', title: 'Personal Information' },
  { id: 'contact', title: 'Contact Information' },
  { id: 'education', title: 'Education' },
  { id: 'experience', title: 'Experience' },
  { id: 'skills', title: 'Skills' },
]

function FieldRow({ field }: { field: ProfileField }) {
  const { updateProfileValue, resolveConflict } = useWorkspace()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(field.value)
  const [error, setError] = useState<WorkspaceError | null>(null)
  const [saving, setSaving] = useState(false)
  const inputId = `profile-${field.key}`

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) {
      setError(new WorkspaceError('Invalid field.', `${field.label} can’t be empty.`, 'retry'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateProfileValue(field.key, draft.trim())
      setEditing(false)
    } catch (err) {
      setError(err as WorkspaceError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start sm:gap-6">
      <p className="text-[14px] text-muted sm:pt-0.5">{field.label}</p>

      <div className="min-w-0">
        {editing ? (
          <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={inputId} className="sr-only">
              {field.label}
            </label>
            <input
              id={inputId}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={error ? true : undefined}
              className="h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-field px-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setDraft(field.value); setError(null) }}>
                Cancel
              </Button>
            </div>
          </form>
        ) : field.conflict?.length ? (
          <div className="rounded-[var(--radius-control)] border border-warning-line bg-warning-soft p-3">
            <p className="flex items-center gap-1.5 text-[14px] font-medium text-warning">
              <AlertTriangle className="size-4" aria-hidden />
              Your documents disagree
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {field.conflict.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => void resolveConflict(field.key, c.value, c.source)}
                  className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-1.5 text-left hover:border-accent"
                >
                  <span className="block text-[14px] text-ink">Use {c.value}</span>
                  <span className="block font-mono text-[11px] text-subtle">{c.source}</span>
                </button>
              ))}
            </div>
          </div>
        ) : field.value ? (
          <>
            <p className="break-words text-[15px] text-ink">
              {field.section === 'skills'
                ? field.value.split(',').map((s) => (
                    <span key={s} className="mr-1.5 mb-1.5 inline-block rounded-md border border-line bg-canvas px-2 py-0.5 text-[13px]">
                      {s.trim()}
                    </span>
                  ))
                : field.value}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <SourceChip source={field.source} />
              {field.verified ? <Badge tone="success" icon={BadgeCheck}>Verified</Badge> : <Badge tone="warning">Not verified</Badge>}
            </div>
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-[14px] text-danger">
            <CircleDashed className="size-4" aria-hidden />
            Missing. Add it once and FormPilot reuses it everywhere.
          </p>
        )}
        {error && (
          <div className="mt-2">
            <ErrorPanel error={error} onRetry={() => setError(null)} />
          </div>
        )}
      </div>

      {!editing && !field.conflict?.length && (
        <div className="sm:pt-0.5">
          <Button variant="secondary" size="sm" onClick={() => { setDraft(field.value); setEditing(true) }} aria-label={`Edit ${field.label}`}>
            <Pencil className="size-3.5" aria-hidden />
            {field.value ? 'Edit' : 'Add'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function ProfilePage() {
  usePageMeta({ title: 'My Profile', path: '/profile' })
  const { data } = useWorkspace()
  if (!data) return null
  const completion = profileCompleteness(data.profile)
  const verified = data.profile.filter((f) => f.verified && f.value).length
  const conflicts = data.profile.filter((f) => f.conflict?.length).length
  const usedDocs = new Set(data.profile.map((f) => f.source).filter(Boolean))

  if (data.profile.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="The single source of truth FormPilot uses for every application." />
        <EmptyState
          icon={UserRound}
          title="Your profile is empty."
          description="Upload your resume or a certificate and FormPilot builds your profile from it."
          action={<Button to="/documents?upload=1" size="sm">Upload Document</Button>}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="The single source of truth FormPilot uses for every application. Change a value here and every open application updates." />

      <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <ProgressRing value={completion} size={64} />
        <div className="grid flex-1 grid-cols-3 gap-4">
          <div>
            <p className="text-[13px] text-muted">Verified details</p>
            <p className="text-[20px] font-semibold text-ink">{verified}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted">Conflicts</p>
            <p className={`text-[20px] font-semibold ${conflicts ? 'text-warning' : 'text-ink'}`}>{conflicts}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted">Source documents</p>
            <p className="text-[20px] font-semibold text-ink">{usedDocs.size}</p>
          </div>
        </div>
      </Card>

      {SECTIONS.map((section) => {
        const fields = data.profile.filter((f) => f.section === section.id)
        if (!fields.length) return null
        return (
          <Card key={section.id} className="px-5 sm:px-6">
            <h2 className="border-b border-line py-4 text-[16px] font-semibold text-ink">{section.title}</h2>
            <div className="divide-y divide-line">
              {fields.map((f) => (
                <FieldRow key={`${f.key}-${f.value}-${f.conflict?.length ?? 0}`} field={f} />
              ))}
            </div>
          </Card>
        )
      })}

      <Card className="p-5 sm:p-6">
        <h2 className="text-[16px] font-semibold text-ink">Documents</h2>
        <p className="mt-1 text-[14px] text-muted">Your profile is built from these files.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...usedDocs].map((d) => (
            <Link key={d} to="/documents" className="rounded-md">
              <SourceChip source={d} />
            </Link>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-subtle">Edits are saved to your FormPilot account.</p>
      </Card>
    </div>
  )
}
