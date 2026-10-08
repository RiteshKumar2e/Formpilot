import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, CircleDashed, FileSearch, PauseCircle, Pencil, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { cn } from '../../lib/utils'
import { SmartAnswerCard } from '../SmartAnswer'
import { isOpenQuestion } from '../questions'
import { useWorkspace, WorkspaceError } from '../workspace'
import { isBlocking, sectionsOf, summary } from '../selectors'
import type { Application, ApplicationField } from '../types'
import { ApplicationStatusBadge, Card, ConfidenceBar, Drawer, EmptyState, FieldStatusBadge, SourceChip } from '../ui'

/** "Degree_Certificate.pdf" -> "Certificate", "Resume.pdf" -> "Resume". */
export function shortSource(source: string): string {
  const s = source.toLowerCase()
  if (s.includes('certificate')) return 'Certificate'
  if (s.includes('resume') || s.includes('cv')) return 'Resume'
  if (s.includes('transcript')) return 'Transcript'
  if (s.includes('letter')) return 'Letter'
  return source.replace(/\.\w+$/, '').replace(/_/g, ' ')
}

// ---------- source viewer ----------

export function SourceViewer({ source, highlight, onClose }: { source: string | null; highlight?: string; onClose: () => void }) {
  const { data } = useWorkspace()
  const doc = data?.documents.find((d) => d.name === source)
  return (
    <Drawer open={Boolean(source)} onClose={onClose} title={source ?? 'Source'}>
      {!doc ? (
        <p className="text-[14px] text-muted">This value was entered by you, so there’s no source document.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-[14px] text-muted">
            {doc.category} · {doc.fileType} · {doc.status === 'processed' ? 'Processed' : doc.status === 'needs_review' ? 'Needs review' : doc.status}
          </p>
          <h3 className="text-[15px] font-semibold text-ink">Extracted from this document</h3>
          {doc.extracted.length === 0 ? (
            <p className="text-[14px] text-muted">No details were extracted from this document.</p>
          ) : (
            <ul className="divide-y divide-line rounded-[var(--radius-panel)] border border-line">
              {doc.extracted.map((e) => {
                const hit = highlight && (e.value.toLowerCase().includes(highlight.toLowerCase()) || highlight.toLowerCase().includes(e.value.toLowerCase()))
                return (
                  <li key={`${e.label}-${e.value}`} className={cn('grid gap-1 px-4 py-3 sm:grid-cols-[100px_minmax(0,1fr)_100px] sm:items-center sm:gap-3', hit && 'bg-accent-soft')}>
                    <span className="text-[13px] text-subtle">{e.label}</span>
                    <span className="break-words text-[14px] text-ink">
                      {e.value}
                      {hit && <span className="ml-2 text-[12px] font-medium text-accent">Used for this field</span>}
                    </span>
                    <ConfidenceBar value={e.confidence} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  )
}

// ---------- assistant ----------

function AssistantPanel({ app, field }: { app: Application; field: ApplicationField }) {
  const { acceptField, updateField, resolveConflict, updateProfileValue } = useWorkspace()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(field.value)
  const [viewSource, setViewSource] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [suggesting, setSuggesting] = useState(false)
  const locked = app.status === 'prepared'
  const openQuestion = isOpenQuestion(field.label, field.profileKey)

  const applySuggestedAnswer = (answer: string) => {
    updateField(app.id, field.id, {
      value: answer,
      source: 'Smart Answer',
      status: 'confirmed',
      confidence: 1,
      reasoning: 'Suggested by FormPilot from your profile and documents, then reviewed and accepted by you.',
    })
    setSuggesting(false)
    setEditing(false)
  }

  useEffect(() => {
    setEditing(field.status === 'missing' && !isOpenQuestion(field.label, field.profileKey))
    setSuggesting(false)
    setDraft(field.value)
    setError(null)
  }, [field.id, field.status, field.value, field.label, field.profileKey])

  const saveManual = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) {
      setError(`${field.label} can’t be empty.`)
      return
    }
    try {
      if (field.status === 'conflict' && field.profileKey) {
        await resolveConflict(field.profileKey, draft.trim(), null)
      } else if (saveToProfile && field.profileKey) {
        await updateProfileValue(field.profileKey, draft.trim())
        updateField(app.id, field.id, { value: draft.trim(), source: null, status: 'confirmed', confidence: 1, reasoning: 'Entered by you and saved to your profile.' })
      } else {
        updateField(app.id, field.id, { value: draft.trim(), source: null, status: 'confirmed', confidence: 1, reasoning: 'Entered by you for this application.' })
      }
      setEditing(false)
    } catch (err) {
      setError(err instanceof WorkspaceError ? `${err.message} ${err.reason}` : 'Couldn’t save this value.')
    }
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[12px] font-medium tracking-[0.06em] text-accent uppercase">
        <Sparkles className="size-3.5" aria-hidden />
        FormPilot Assistant
      </p>

      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-[12px] font-medium tracking-[0.06em] text-subtle uppercase">Field</dt>
          <dd className="mt-1 text-[16px] font-medium text-ink">“{field.label}”</dd>
        </div>

        {field.status !== 'conflict' && (
          <div>
            <dt className="text-[12px] font-medium tracking-[0.06em] text-subtle uppercase">Matched value</dt>
            <dd className="mt-1 text-[15px] break-words text-ink">{field.value || <span className="text-danger">Not found in your profile</span>}</dd>
          </div>
        )}

        {field.value && field.status !== 'conflict' && (
          <>
            <div>
              <dt className="text-[12px] font-medium tracking-[0.06em] text-subtle uppercase">Source</dt>
              <dd className="mt-1">
                <SourceChip source={field.source} onClick={field.source ? () => setViewSource(field.source) : undefined} />
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-medium tracking-[0.06em] text-subtle uppercase">Confidence</dt>
              <dd className="mt-1.5">
                <ConfidenceBar value={field.confidence} />
              </dd>
            </div>
          </>
        )}

        <div>
          <dt className="text-[12px] font-medium tracking-[0.06em] text-subtle uppercase">Why this match?</dt>
          <dd className="mt-1 text-[14px] leading-relaxed text-ink-2">{field.reasoning}</dd>
        </div>
      </dl>

      {/* Conflict */}
      {field.status === 'conflict' && !locked && (
        <div className="mt-5 rounded-[var(--radius-panel)] border border-warning-line bg-warning-soft p-4">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <AlertTriangle className="size-4 text-warning" aria-hidden />
            Potential conflict detected
          </p>
          <ul className="mt-3 space-y-2">
            {field.candidates.map((c) => (
              <li key={`${c.value}-${c.source}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[14px] text-ink">{c.value}</span>
                  <span className="block truncate font-mono text-[11px] text-subtle">{c.source}</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => field.profileKey && void resolveConflict(field.profileKey, c.value, c.source)}>
                  Use {shortSource(c.source)} value
                </Button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setEditing(true)} className="mt-3 text-[13px] text-accent underline underline-offset-2">
            Edit manually
          </button>
          <p className="mt-3 flex items-start gap-1.5 text-[13px] text-ink-2">
            <PauseCircle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            Application approval is paused until this issue is resolved.
          </p>
        </div>
      )}

      {/* Smart Answers: open questions get a suggested answer the person reviews */}
      {openQuestion && !locked && !editing && (!field.value || suggesting) && (
        <div className="mt-5 space-y-3">
          <SmartAnswerCard
            key={field.id}
            question={field.label}
            organization={app.organization || undefined}
            role={app.title}
            onUse={applySuggestedAnswer}
          />
          <button type="button" onClick={() => setEditing(true)} className="text-[13px] text-accent underline underline-offset-2">
            Write it myself
          </button>
        </div>
      )}

      {/* Manual entry: missing values, conflicts edited manually, or Change */}
      {editing && !locked && (
        <form onSubmit={saveManual} className="mt-5 space-y-3" noValidate>
          <label htmlFor={`edit-${field.id}`} className="block text-[13px] font-medium text-ink-2">
            {field.status === 'missing' ? (field.required ? 'Required before approval' : 'Add information') : 'Enter the correct value'}
          </label>
          <input
            id={`edit-${field.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `edit-${field.id}-error` : undefined}
            placeholder={field.label}
            className={cn('h-10 w-full rounded-[var(--radius-control)] border bg-field px-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15', error ? 'border-danger' : 'border-line-strong')}
          />
          {error && (
            <p id={`edit-${field.id}-error`} className="text-[13px] text-danger">
              {error}
            </p>
          )}
          {field.profileKey && field.status !== 'conflict' && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={saveToProfile} onChange={(e) => setSaveToProfile(e.target.checked)} className="size-4 accent-accent" />
              Save to my profile for future applications
            </label>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {field.status === 'missing' ? 'Add Information' : 'Save'}
            </Button>
            {field.status !== 'missing' && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      {/* Normal actions */}
      {!editing && !locked && field.value && field.status !== 'conflict' && (
        <div className="mt-5 flex flex-wrap gap-2">
          {field.status !== 'confirmed' ? (
            <Button size="sm" onClick={() => acceptField(app.id, field.id)}>
              <Check className="size-4" aria-hidden />
              Accept
            </Button>
          ) : (
            <span className="inline-flex h-9 items-center gap-1.5 text-[14px] text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              Accepted
            </span>
          )}
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden />
            Change
          </Button>
          {openQuestion && !suggesting && (
            <Button size="sm" variant="secondary" onClick={() => setSuggesting(true)}>
              <Sparkles className="size-3.5" aria-hidden />
              Suggest an answer
            </Button>
          )}
          {field.source && (
            <Button size="sm" variant="secondary" onClick={() => setViewSource(field.source)}>
              <FileSearch className="size-3.5" aria-hidden />
              View Source
            </Button>
          )}
        </div>
      )}

      {locked && <p className="mt-5 text-[13px] text-subtle">This application is approved. Edit it from the review page to make changes.</p>}

      {/* Retrieval trace */}
      {field.candidates.length > 0 && field.status !== 'conflict' && (
        <details className="group mt-6 rounded-[var(--radius-panel)] border border-line bg-canvas">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-medium text-ink-2">
            <Search className="size-3.5" aria-hidden />
            How FormPilot found this
          </summary>
          <div className="border-t border-line px-4 py-3">
            <p className="text-[12px] text-subtle">Top profile candidates retrieved for this question, by similarity:</p>
            <ol className="mt-2 space-y-2">
              {field.candidates.map((c, i) => (
                <li key={`${c.value}-${i}`} className="flex items-center gap-3">
                  <span className="w-4 font-mono text-[12px] text-subtle">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[13px]', i === 0 ? 'font-medium text-ink' : 'text-ink-2')}>{c.value}</span>
                    <span className="block truncate font-mono text-[11px] text-subtle">{c.source}</span>
                  </span>
                  <span className="font-mono text-[12px] text-ink-2">{c.score.toFixed(2)}</span>
                </li>
              ))}
            </ol>
          </div>
        </details>
      )}

      <SourceViewer source={viewSource} highlight={field.value} onClose={() => setViewSource(null)} />
    </div>
  )
}

// ---------- page ----------

export function ApplicationWorkspacePage() {
  const { id } = useParams()
  const { data } = useWorkspace()
  const navigate = useNavigate()
  const app = data?.applications.find((a) => a.id === id)
  usePageMeta({ title: app ? app.title : 'Application', path: `/applications/${id}` })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [section, setSection] = useState<string | 'all'>('all')

  const sections = useMemo(() => (app ? sectionsOf(app) : []), [app])
  const visible = app ? (section === 'all' ? app.fields : app.fields.filter((f) => f.section === section)) : []
  const selected = app?.fields.find((f) => f.id === selectedId) ?? null

  // Select the first field needing attention, or the first field, when the page opens.
  useEffect(() => {
    if (!app || selectedId) return
    const first = app.fields.find((f) => f.status !== 'mapped' && f.status !== 'confirmed') ?? app.fields[0]
    if (first) setSelectedId(first.id)
  }, [app, selectedId])

  if (!data) return null
  if (!app) {
    return (
      <EmptyState
        icon={FileSearch}
        title="Application not found."
        description="It may have been deleted, or the link is out of date."
        action={<Button to="/applications">Back to applications</Button>}
      />
    )
  }

  const s = summary(app)
  const blocking = app.fields.filter(isBlocking)

  const fieldButton = (f: ApplicationField) => {
    const active = f.id === selectedId
    return (
      <button
        type="button"
        onClick={() => setSelectedId(f.id)}
        aria-pressed={active}
        className={cn(
          'w-full rounded-[var(--radius-control)] border p-3.5 text-left transition-[border-color,background-color,box-shadow]',
          active ? 'border-accent bg-accent-soft/40 ring-2 ring-accent/15' : 'border-line bg-surface hover:border-line-strong',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-2">
            {f.label}
            {f.required && <span className="text-danger" aria-label="required"> *</span>}
          </span>
          <FieldStatusBadge status={f.status} required={f.required} />
        </div>
        <div className={cn('mt-2 min-h-9 rounded-[var(--radius-control)] border px-3 py-2 text-[14px]', f.value ? 'border-line bg-field text-ink' : 'border-dashed border-line-strong bg-canvas text-subtle')}>
          {f.value ? <span className="break-words">{f.value}</span> : f.status === 'conflict' ? 'Choose between conflicting values' : 'Not filled'}
        </div>
        {f.value && (
          <p className="mt-1.5 truncate font-mono text-[11px] text-subtle">
            {f.source ?? 'Entered by you'} · {Math.round(f.confidence * 100)}%
          </p>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/applications" className="inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />
          Applications
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[26px]">{app.title}</h1>
              <ApplicationStatusBadge status={app.status} />
            </div>
            <p className="mt-1 text-[14px] text-muted">
              {app.organization ? `${app.organization} · ` : ''}
              {s.completed} of {s.total} fields complete · {s.issues.length} {s.issues.length === 1 ? 'issue' : 'issues'}
            </p>
            <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-ink/[0.07]">
              <motion.div className={cn('h-full rounded-full', s.progress === 100 ? 'bg-success' : 'bg-accent')} animate={{ width: `${s.progress}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button to={`/mapping?app=${app.id}`} variant="secondary" size="sm">
              Field Mapping
            </Button>
            <Button to={`/validation?app=${app.id}`} variant="secondary" size="sm">
              <ShieldCheck className="size-4" aria-hidden />
              Validation
            </Button>
            <Button size="sm" onClick={() => navigate(`/applications/${app.id}/review`)}>
              Review
            </Button>
          </div>
        </div>
      </div>

      {blocking.length > 0 && app.status !== 'prepared' && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-warning-line bg-warning-soft p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-[14px] text-ink">
            <span className="font-medium">{blocking.length} {blocking.length === 1 ? 'issue blocks' : 'issues block'} approval.</span>{' '}
            {blocking.map((b) => b.label).join(', ')}.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setSelectedId(blocking[0].id)}>
            Resolve next issue
          </Button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:grid-cols-[200px_minmax(0,1fr)_minmax(0,360px)]">
        {/* LEFT: structure (column on xl, chips above the form otherwise) */}
        <nav aria-label="Application structure" className="order-3 lg:order-none lg:col-span-2 xl:col-span-1">
          <p className="mb-2 hidden text-[12px] font-medium tracking-[0.06em] text-subtle uppercase xl:block">Structure</p>
          <ul className="flex flex-wrap gap-1.5 xl:sticky xl:top-24 xl:flex-col xl:gap-0.5">
            {[{ id: 'all', label: 'All fields' }, ...sections.map((x) => ({ id: x, label: x }))].map((item) => {
              const fields = item.id === 'all' ? app.fields : app.fields.filter((f) => f.section === item.id)
              const issues = fields.filter((f) => f.status === 'conflict' || f.status === 'needs_review' || (f.status === 'missing' && f.required)).length
              const active = section === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSection(item.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-[13px] xl:rounded-[var(--radius-control)] xl:border-0 xl:px-3 xl:py-2 xl:text-[14px]',
                      active ? 'border-ink bg-ink text-white xl:bg-surface xl:font-medium xl:text-ink xl:shadow-[var(--shadow-card)] xl:ring-1 xl:ring-line' : 'border-line bg-surface text-ink-2 xl:bg-transparent hover:xl:bg-ink/[0.04]',
                    )}
                  >
                    <span className="flex-1 truncate">{item.label}</span>
                    {issues > 0 ? (
                      <span className="flex items-center gap-0.5 text-[12px] text-warning">
                        <AlertTriangle className="size-3" aria-hidden />
                        {issues}
                      </span>
                    ) : (
                      <CheckCircle2 className={cn('size-3.5', active ? 'text-current' : 'text-success')} aria-hidden />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* CENTER: form */}
        <section aria-label="Application form" className="order-1 min-w-0 lg:order-none">
          <Card className="p-4 sm:p-5">
            {sections
              .filter((sec) => section === 'all' || sec === section)
              .map((sec) => {
                const fields = visible.filter((f) => f.section === sec)
                if (!fields.length) return null
                return (
                  <div key={sec} className="mb-6 last:mb-0">
                    <h2 className="mb-3 text-[14px] font-semibold text-ink">{sec}</h2>
                    <ul className="space-y-2.5">
                      {fields.map((f) => (
                        <li key={f.id}>
                          {fieldButton(f)}
                          {/* Inline assistant below the selected field on smaller screens */}
                          <AnimatePresence initial={false}>
                            {f.id === selectedId && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden lg:hidden"
                              >
                                <div className="mt-2 rounded-[var(--radius-control)] border border-accent-line bg-surface p-4">
                                  <AssistantPanel app={app} field={f} />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            {app.fields.length === 0 && <p className="py-8 text-center text-[14px] text-muted">This application has no fields yet.</p>}
          </Card>
        </section>

        {/* RIGHT: assistant */}
        <aside aria-label="FormPilot Assistant" className="hidden lg:block">
          <div className="sticky top-24">
            <Card className="p-5">
              {selected ? (
                <AnimatePresence mode="wait">
                  <motion.div key={selected.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <AssistantPanel app={app} field={selected} />
                  </motion.div>
                </AnimatePresence>
              ) : (
                <p className="flex items-center gap-2 text-[14px] text-muted">
                  <CircleDashed className="size-4" aria-hidden />
                  Select a field to see how it was mapped.
                </p>
              )}
            </Card>
          </div>
        </aside>
      </div>

      {app.status === 'ready' && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-success-line bg-success-soft p-4 sm:flex-row sm:items-center">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          <p className="flex-1 text-[14px] text-ink">
            <span className="font-medium">All fields are complete.</span> Review the application and approve it when you’re ready.
          </p>
          <Button size="sm" to={`/applications/${app.id}/review`}>
            Review Application
          </Button>
        </div>
      )}
    </div>
  )
}

