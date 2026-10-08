import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, CircleDashed, MessageSquareText, Pencil, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { api } from '../../lib/api'
import type { SavedAnswer } from '../../types/api'
import { useWorkspace, WorkspaceError } from '../workspace'
import { profileCompleteness, timeAgo } from '../selectors'
import type { ProfileField, ProfileSection, Verification } from '../types'
import { Badge, Card, ConfidenceBar, EmptyState, ErrorPanel, PageHeader, ProgressRing, SourceChip } from '../ui'

const SECTIONS: { id: ProfileSection; title: string }[] = [
  { id: 'personal', title: 'Personal Information' },
  { id: 'contact', title: 'Contact Information' },
  { id: 'education', title: 'Education' },
  { id: 'experience', title: 'Work Experience' },
  { id: 'skills', title: 'Skills' },
  { id: 'projects', title: 'Projects' },
  { id: 'achievements', title: 'Achievements' },
  { id: 'certifications', title: 'Certifications' },
  { id: 'links', title: 'Professional Links' },
  { id: 'addresses', title: 'Addresses' },
]

/** Details that aren't required for completeness but belong in a full profile, shown so they can be added. */
const OPTIONAL_FIELDS: { key: string; label: string; section: ProfileSection }[] = [
  { key: 'graduation_year', label: 'Graduation year', section: 'education' },
  { key: 'projects', label: 'Projects', section: 'projects' },
  { key: 'achievements', label: 'Achievements', section: 'achievements' },
  { key: 'certifications', label: 'Certifications', section: 'certifications' },
  { key: 'linkedin', label: 'LinkedIn', section: 'links' },
  { key: 'github', label: 'GitHub', section: 'links' },
  { key: 'address', label: 'Address', section: 'addresses' },
]

/** List fields: shown one item per line, stored with these separators. */
const LIST_SEPARATOR: Record<string, string> = { skills: ', ', projects: '; ', achievements: '; ', certifications: '; ' }

const VERIFICATION: Record<Verification, { label: string; hint: (f: ProfileField) => string }> = {
  confirmed_by_you: { label: 'Verified', hint: () => 'Confirmed by you' },
  multiple_documents: { label: 'Verified', hint: (f) => `Found in ${f.sources.length} documents` },
  high_confidence: { label: 'Verified', hint: () => 'Read with high confidence' },
  unverified: { label: 'Check this', hint: () => 'Low-confidence extraction' },
}

function splitList(key: string, value: string): string[] {
  const sep = LIST_SEPARATOR[key]?.trim()
  return sep ? value.split(sep).map((s) => s.trim()).filter(Boolean) : [value]
}

function FieldRow({ field }: { field: ProfileField }) {
  const { updateProfileValue, resolveConflict } = useWorkspace()
  const isList = field.key in LIST_SEPARATOR
  const toDraft = (v: string) => (isList ? splitList(field.key, v).join('\n') : v)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(toDraft(field.value))
  const [error, setError] = useState<WorkspaceError | null>(null)
  const [saving, setSaving] = useState(false)
  const inputId = `profile-${field.key}`

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const value = isList
      ? draft.split('\n').map((s) => s.trim()).filter(Boolean).join(LIST_SEPARATOR[field.key])
      : draft.trim()
    if (!value) {
      setError(new WorkspaceError('Invalid field.', `${field.label} can’t be empty.`, 'retry'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateProfileValue(field.key, value)
      setEditing(false)
    } catch (err) {
      setError(err as WorkspaceError)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'min-w-0 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-field px-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'
  const verification = VERIFICATION[field.verification]

  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start sm:gap-6">
      <p className="text-[14px] text-muted sm:pt-0.5">{field.label}</p>

      <div className="min-w-0">
        {editing ? (
          <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <label htmlFor={inputId} className="sr-only">
              {field.label}
            </label>
            {isList ? (
              <textarea
                id={inputId}
                autoFocus
                rows={4}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="One per line"
                aria-invalid={error ? true : undefined}
                className={`${inputClass} py-2`}
              />
            ) : (
              <input
                id={inputId}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-invalid={error ? true : undefined}
                className={`${inputClass} h-10`}
              />
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setDraft(toDraft(field.value)); setError(null) }}>
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
            {field.key === 'skills' ? (
              <p className="break-words">
                {splitList('skills', field.value).map((s) => (
                  <span key={s} className="mr-1.5 mb-1.5 inline-block rounded-md border border-line bg-canvas px-2 py-0.5 text-[13px] text-ink">
                    {s}
                  </span>
                ))}
              </p>
            ) : isList ? (
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink">
                {splitList(field.key, field.value).map((item) => (
                  <li key={item} className="break-words">{item}</li>
                ))}
              </ul>
            ) : (
              <p className="break-words text-[15px] text-ink">{field.value}</p>
            )}
            <dl className="mt-2 grid gap-x-5 gap-y-1.5 text-[12px] sm:grid-cols-[auto_auto_auto_minmax(0,140px)] sm:items-center">
              <div className="flex flex-wrap items-center gap-1.5">
                <dt className="sr-only">Source</dt>
                {(field.sources.length ? field.sources : [null]).map((s) => (
                  <dd key={s ?? 'you'}>
                    <SourceChip source={s} />
                  </dd>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Status</dt>
                <dd title={verification.hint(field)}>
                  {field.verified ? (
                    <Badge tone="success" icon={BadgeCheck}>{verification.label}</Badge>
                  ) : (
                    <Badge tone="warning">{verification.label}</Badge>
                  )}
                </dd>
                <dd className="text-subtle">{verification.hint(field)}</dd>
              </div>
              {field.updatedAt && (
                <div className="text-subtle">
                  <dt className="inline">Updated </dt>
                  <dd className="inline">{timeAgo(field.updatedAt)}</dd>
                </div>
              )}
              <div>
                <dt className="sr-only">Confidence</dt>
                <dd>
                  <ConfidenceBar value={field.confidence} />
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-[14px] text-subtle">
            <CircleDashed className="size-4" aria-hidden />
            Not added yet. Add it once and FormPilot reuses it everywhere.
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
          <Button variant="secondary" size="sm" onClick={() => { setDraft(toDraft(field.value)); setEditing(true) }} aria-label={`Edit ${field.label}`}>
            <Pencil className="size-3.5" aria-hidden />
            {field.value ? 'Edit' : 'Add'}
          </Button>
        </div>
      )}
    </div>
  )
}

function CommonQuestions() {
  const [answers, setAnswers] = useState<SavedAnswer[] | null>(null)
  useEffect(() => {
    api.answers.list().then(setAnswers, () => setAnswers([]))
  }, [])
  return (
    <Card className="px-5 sm:px-6">
      <div className="flex items-center justify-between gap-3 border-b border-line py-4">
        <h2 className="text-[16px] font-semibold text-ink">Common Application Questions</h2>
        <Button to="/vault?tab=answers" variant="secondary" size="sm">
          Manage
        </Button>
      </div>
      {answers === null ? (
        <p className="py-4 text-[14px] text-muted">Loading…</p>
      ) : answers.length === 0 ? (
        <p className="flex items-center gap-1.5 py-4 text-[14px] text-subtle">
          <MessageSquareText className="size-4" aria-hidden />
          Save answers to questions like “Why this company?” or “Work authorization” and reuse them on every form.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {answers.slice(0, 5).map((a) => (
            <li key={a.id} className="grid gap-1 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
              <p className="text-[14px] text-muted">{a.question}</p>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[15px] text-ink">{a.answer}</p>
                <p className="mt-1 text-[12px] text-subtle">
                  Updated {timeAgo(a.updated_at)}
                  {a.use_count > 0 && ` · reused ${a.use_count}×`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function ProfilePage() {
  usePageMeta({ title: 'Master Profile', path: '/profile' })
  const { data } = useWorkspace()
  if (!data) return null
  const completion = profileCompleteness(data.profile)
  const verified = data.profile.filter((f) => f.verified && f.value).length
  const conflicts = data.profile.filter((f) => f.conflict?.length).length
  const usedDocs = new Set(data.profile.flatMap((f) => f.sources))
  const rows: ProfileField[] = [
    ...data.profile,
    ...OPTIONAL_FIELDS.filter((o) => !data.profile.some((f) => f.key === o.key)).map((o) => ({
      ...o,
      value: '',
      source: null,
      confidence: 0,
      verified: false,
      verification: 'unverified' as const,
      sources: [],
      updatedAt: null,
    })),
  ]

  if (data.profile.every((f) => !f.value && !f.conflict?.length) && data.documents.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Master Profile" description="Build it once, verify it once, reuse it on every application." />
        <EmptyState
          icon={UserRound}
          title="Your Master Profile is empty."
          description="Upload your resume or a certificate and FormPilot builds your profile from it."
          action={<Button to="/documents?upload=1" size="sm">Upload Document</Button>}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Profile"
        description="Your reusable application identity. Every detail shows where it came from, whether it’s verified, and when it last changed. Change a value here and every open application updates."
      />

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
        const fields = rows.filter((f) => f.section === section.id)
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

      <CommonQuestions />

      <Card className="p-5 sm:p-6">
        <h2 className="text-[16px] font-semibold text-ink">Uploaded Documents</h2>
        <p className="mt-1 text-[14px] text-muted">Your profile is built from these files.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.documents.map((d) => (
            <Link key={d.id} to={`/documents?doc=${d.id}`} className="rounded-md">
              <SourceChip source={d.name} />
            </Link>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-subtle">Edits are saved to your FormPilot account and encrypted at rest.</p>
      </Card>
    </div>
  )
}
