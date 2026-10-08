import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, BookmarkCheck, ClipboardList, FileText, MessageSquareText, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { api, ApiError } from '../../lib/api'
import { cn } from '../../lib/utils'
import type { ApplicationTemplate, SavedAnswer } from '../../types/api'
import { useWorkspace } from '../workspace'
import { profileCompleteness, summary, timeAgo } from '../selectors'
import { ApplicationStatusBadge, Badge, Card, DocumentStatusBadge, EmptyState, PageHeader, ProgressRing, SourceChip } from '../ui'

const TABS = [
  { id: 'profile', label: 'Master Profile', icon: UserRound },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'applications', label: 'Saved Applications', icon: ClipboardList },
  { id: 'templates', label: 'Application Templates', icon: BookmarkCheck },
  { id: 'answers', label: 'Common Answers', icon: MessageSquareText },
] as const
type Tab = (typeof TABS)[number]['id']

const COMMON_QUESTIONS = ['Why this company?', 'Work authorization', 'Relocation preference', 'Notice period', 'Expected salary', 'Tell us about yourself']

function ProfileTab() {
  const { data } = useWorkspace()
  if (!data) return null
  const filled = data.profile.filter((f) => f.value)
  const verified = filled.filter((f) => f.verified)
  return (
    <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
      <ProgressRing value={profileCompleteness(data.profile)} size={72} />
      <div className="flex-1">
        <h2 className="text-[17px] font-semibold text-ink">Your Master Profile</h2>
        <p className="mt-1 text-[14px] text-muted">
          {filled.length} details, {verified.length} verified, from {new Set(data.profile.flatMap((f) => f.sources)).size} documents. Every application starts from here.
        </p>
      </div>
      <Button to="/profile">Open Master Profile</Button>
    </Card>
  )
}

function DocumentsTab() {
  const { data } = useWorkspace()
  if (!data) return null
  if (!data.documents.length) {
    return <EmptyState icon={FileText} title="No documents yet." description="Upload a resume or certificate to build your profile." action={<Button to="/documents?upload=1" size="sm">Upload Document</Button>} />
  }
  return (
    <Card className="divide-y divide-line">
      {data.documents.map((d) => (
        <Link key={d.id} to={`/documents?doc=${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-canvas">
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium text-ink">{d.name}</span>
            <span className="text-[13px] text-subtle">
              {d.category} · {d.extracted.length} details · {timeAgo(d.uploadedAt)}
            </span>
          </span>
          <DocumentStatusBadge status={d.status} />
        </Link>
      ))}
    </Card>
  )
}

function ApplicationsTab() {
  const { data } = useWorkspace()
  if (!data) return null
  if (!data.applications.length) {
    return <EmptyState icon={ClipboardList} title="No saved applications." description="Applications you prepare are kept here." action={<Button to="/applications/new" size="sm">New Application</Button>} />
  }
  return (
    <Card className="divide-y divide-line">
      {data.applications.map((a) => {
        const s = summary(a)
        return (
          <Link key={a.id} to={`/applications/${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-canvas">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-ink">{a.title}</span>
              <span className="text-[13px] text-subtle">
                {a.fields.filter((f) => f.value).length}/{s.total} fields · updated {timeAgo(a.updatedAt)}
              </span>
            </span>
            <ApplicationStatusBadge status={a.status} />
          </Link>
        )
      })}
    </Card>
  )
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<ApplicationTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.templates.list().then(setTemplates, () => setError('Couldn’t load your templates.'))
  }, [])

  const remove = async (id: string) => {
    if (!window.confirm('Delete this template? Applications made from it are not affected.')) return
    try {
      await api.templates.remove(id)
      setTemplates((t) => t?.filter((x) => x.id !== id) ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete the template.')
    }
  }

  if (error) return <p role="alert" className="text-[14px] text-danger">{error}</p>
  if (!templates) return <p className="text-[14px] text-muted">Loading…</p>
  if (!templates.length) {
    return (
      <EmptyState
        icon={BookmarkCheck}
        title="No templates yet."
        description="After you approve an application, save it as a template. Similar forms can then reuse its answers and documents."
        action={<Button to="/applications" size="sm">Your applications</Button>}
      />
    )
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {templates.map((t) => (
        <li key={t.id}>
          <Card className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-ink">“{t.name}”</h3>
                <p className="text-[13px] text-subtle">
                  {t.organization ? `${t.organization} · ` : ''}saved {timeAgo(t.created_at)}
                  {t.use_count > 0 && ` · reused ${t.use_count}×`}
                </p>
              </div>
              <button type="button" onClick={() => void remove(t.id)} aria-label={`Delete ${t.name}`} className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-danger-soft hover:text-danger">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <dl className="mt-4 space-y-3 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Fields completed</dt>
                <dd className="font-medium text-ink">
                  {t.completed}/{t.total}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Documents</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {t.documents.length ? t.documents.map((d) => <SourceChip key={d} source={d} />) : <span className="text-subtle">None</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Common answers</dt>
                <dd className="mt-1">
                  {t.common_answers.length ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-ink-2">
                      {t.common_answers.map((a) => (
                        <li key={a.label}>{a.label}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-subtle">None</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function AnswerForm({ initial, onSave, onCancel }: { initial?: SavedAnswer; onSave: (q: string, a: string) => Promise<void>; onCancel?: () => void }) {
  const [question, setQuestion] = useState(initial?.question ?? '')
  const [answer, setAnswer] = useState(initial?.answer ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (question.trim().length < 3 || !answer.trim()) return setError('Add a question and an answer.')
    setSaving(true)
    setError(null)
    try {
      await onSave(question.trim(), answer.trim())
      if (!initial) {
        setQuestion('')
        setAnswer('')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t save this answer.')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full rounded-[var(--radius-control)] border border-line-strong bg-field px-3 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <label className="block">
        <span className="text-[13px] font-medium text-ink-2">Question</span>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Why this company?" className={cn(input, 'mt-1 h-10')} />
      </label>
      {!initial && (
        <div className="flex flex-wrap gap-1.5">
          {COMMON_QUESTIONS.map((q) => (
            <button key={q} type="button" onClick={() => setQuestion(q)} className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-2 hover:border-accent hover:text-accent">
              {q}
            </button>
          ))}
        </div>
      )}
      <label className="block">
        <span className="text-[13px] font-medium text-ink-2">Your answer</span>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} className={cn(input, 'mt-1 py-2')} />
      </label>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save' : 'Add answer'}
        </Button>
        {onCancel && (
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

function AnswersTab() {
  const [answers, setAnswers] = useState<SavedAnswer[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => api.answers.list().then(setAnswers, () => setError('Couldn’t load your answers.')), [])
  useEffect(() => {
    void load()
  }, [load])

  const remove = async (id: string) => {
    if (!window.confirm('Delete this saved answer?')) return
    try {
      await api.answers.remove(id)
      setAnswers((a) => a?.filter((x) => x.id !== id) ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t delete the answer.')
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
        {answers === null ? (
          <p className="text-[14px] text-muted">Loading…</p>
        ) : answers.length === 0 ? (
          <EmptyState icon={MessageSquareText} title="No saved answers yet." description="Answer common questions once. Smart Answers reuses them when a form asks something similar." />
        ) : (
          answers.map((a) => (
            <Card key={a.id} className="p-5">
              {editing === a.id ? (
                <AnswerForm
                  initial={a}
                  onCancel={() => setEditing(null)}
                  onSave={async (q, ans) => {
                    const saved = await api.answers.update(a.id, q, ans)
                    setAnswers((list) => list?.map((x) => (x.id === a.id ? saved : x)) ?? null)
                    setEditing(null)
                  }}
                />
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">{a.question}</p>
                    <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-line text-ink-2">{a.answer}</p>
                    <p className="mt-2 text-[12px] text-subtle">
                      Updated {timeAgo(a.updated_at)}
                      {a.use_count > 0 && ` · reused ${a.use_count}×`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setEditing(a.id)} aria-label={`Edit ${a.question}`} className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-panel hover:text-accent">
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => void remove(a.id)} aria-label={`Delete ${a.question}`} className="inline-flex size-8 items-center justify-center rounded-[var(--radius-control)] text-subtle hover:bg-danger-soft hover:text-danger">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
      <Card className="h-fit p-5">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          <Plus className="size-4" aria-hidden />
          Add a common answer
        </h3>
        <div className="mt-4">
          <AnswerForm
            onSave={async (q, a) => {
              const saved = await api.answers.create(q, a)
              setAnswers((list) => [saved, ...(list ?? [])])
            }}
          />
        </div>
      </Card>
    </div>
  )
}

export function VaultPage() {
  usePageMeta({ title: 'Application Vault', path: '/vault' })
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'profile') as Tab

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application Vault"
        description="Everything you reuse across applications: your Master Profile, documents, saved applications, templates and common answers."
        actions={
          <Button to="/anywhere" variant="secondary">
            <Archive className="size-4" aria-hidden />
            Use it anywhere
          </Button>
        }
      />
      <div role="tablist" aria-label="Vault sections" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setParams(t.id === 'profile' ? {} : { tab: t.id }, { replace: true })}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors',
                tab === t.id ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'documents' && <DocumentsTab />}
        {tab === 'applications' && <ApplicationsTab />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'answers' && <AnswersTab />}
      </div>
      <p className="text-[13px] text-subtle">
        <Badge tone="success">Encrypted</Badge> <span className="ml-1">Everything in the vault is stored encrypted on your FormPilot account.</span>
      </p>
    </div>
  )
}
