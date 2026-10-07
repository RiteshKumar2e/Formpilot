import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, CircleDashed, PauseCircle, ShieldCheck } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { cn } from '../../lib/utils'
import { useWorkspace } from '../workspace'
import { isIssue, sectionsOf, summary } from '../selectors'
import type { Application, ApplicationField } from '../types'
import { Card, EmptyState, PageHeader, ProgressRing, SourceChip } from '../ui'
import { shortSource } from './ApplicationWorkspace'

function ManualForm({ field, submitLabel, onSave }: { field: ApplicationField; submitLabel: string; onSave: (value: string) => Promise<void> | void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = `fix-${field.id}`
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!value.trim()) {
      setError(`Enter ${field.label.toLowerCase()} to continue.`)
      return
    }
    setError(null)
    await onSave(value.trim())
  }
  return (
    <form onSubmit={submit} noValidate className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label htmlFor={id} className="sr-only">
          {field.label}
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={field.label === 'Emergency Contact' ? 'Name and phone number' : field.label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('h-10 w-full rounded-[var(--radius-control)] border bg-field px-3 text-[15px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15', error ? 'border-danger' : 'border-line-strong')}
        />
        {error && (
          <p id={`${id}-error`} className="mt-1 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="sm" className="sm:mt-0.5">
        {submitLabel}
      </Button>
    </form>
  )
}

function IssueCard({ app, field }: { app: Application; field: ApplicationField }) {
  const { resolveConflict, updateProfileValue, updateField, acceptField } = useWorkspace()
  const [manual, setManual] = useState(false)

  if (field.status === 'conflict') {
    return (
      <Card className="border-warning-line p-5">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <AlertTriangle className="size-5 text-warning" aria-hidden />
          Potential Conflict Detected
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
          <dt className="text-[14px] text-muted">Field</dt>
          <dd className="text-[15px] font-medium text-ink">{field.label}</dd>
          {field.candidates.map((c) => (
            <div key={c.source} className="contents">
              <dt className="text-[14px] text-muted">{shortSource(c.source)}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] text-ink">{c.value}</span>
                <SourceChip source={c.source} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[14px] text-ink-2">FormPilot has detected inconsistent information across your documents.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {field.candidates.map((c) => (
            <Button key={c.source} size="sm" variant="secondary" onClick={() => field.profileKey && void resolveConflict(field.profileKey, c.value, c.source)}>
              Use {shortSource(c.source)} Value
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setManual((v) => !v)} aria-expanded={manual}>
            Edit Manually
          </Button>
        </div>
        {manual && <ManualForm field={field} submitLabel="Save" onSave={(v) => (field.profileKey ? resolveConflict(field.profileKey, v, null) : undefined)} />}
        <p className="mt-4 flex items-center gap-1.5 rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-[13px] text-ink-2">
          <PauseCircle className="size-4 shrink-0 text-warning" aria-hidden />
          Application submission is paused until this issue is resolved.
        </p>
      </Card>
    )
  }

  if (field.status === 'missing') {
    return (
      <Card className="border-danger-line p-5">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <CircleDashed className="size-5 text-danger" aria-hidden />
          Missing: {field.label}
        </p>
        <p className="mt-2 text-[14px] text-ink-2">
          Status: <span className="font-medium">{field.required ? 'Required before submission' : 'Optional'}</span>
        </p>
        <p className="mt-1 text-[14px] text-muted">{field.reasoning}</p>
        <ManualForm
          field={field}
          submitLabel="Add Information"
          onSave={async (v) => {
            if (field.profileKey) await updateProfileValue(field.profileKey, v)
            updateField(app.id, field.id, { value: v, source: null, status: 'confirmed', confidence: 1, reasoning: field.profileKey ? 'Entered by you and saved to your profile.' : 'Entered by you for this application.' })
          }}
        />
      </Card>
    )
  }

  // Low confidence match
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <AlertTriangle className="size-5 text-warning" aria-hidden />
        Check this match: {field.label}
      </p>
      <p className="mt-2 text-[15px] text-ink">{field.value}</p>
      <p className="mt-1 text-[14px] text-muted">
        Confidence {Math.round(field.confidence * 100)}% · {field.source ?? 'Entered by you'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => acceptField(app.id, field.id)}>
          Accept
        </Button>
        <Button size="sm" variant="secondary" to={`/applications/${app.id}`}>
          Change in workspace
        </Button>
      </div>
    </Card>
  )
}

export function ValidationPage() {
  usePageMeta({ title: 'Validation', path: '/validation' })
  const { data } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const issuesRef = useRef<HTMLDivElement>(null)
  const apps = data?.applications.filter((a) => a.status !== 'prepared') ?? []
  const app = data?.applications.find((a) => a.id === params.get('app')) ?? apps.find((a) => a.status === 'needs_review') ?? apps[0] ?? data?.applications[0]

  // Pin the chosen application in the URL so resolving its issues doesn't switch to another one.
  useEffect(() => {
    if (app && !params.get('app')) setParams({ app: app.id }, { replace: true })
  }, [app, params, setParams])

  if (!data) return null

  if (!app) {
    return (
      <div className="space-y-6">
        <PageHeader title="Application Validation" description="Checks every application for missing and conflicting information." />
        <EmptyState icon={ShieldCheck} title="No applications to validate." description="Create an application to run validation." action={<Button to="/applications/new">Create Application</Button>} />
      </div>
    )
  }

  const s = summary(app)
  const issues = app.fields.filter(isIssue)
  const sections = sectionsOf(app)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application Validation"
        description="FormPilot identifies inconsistencies before they reach your application."
        actions={
          <>
            <label htmlFor="validation-app" className="sr-only">
              Application
            </label>
            <select
              id="validation-app"
              value={app.id}
              onChange={(e) => setParams({ app: e.target.value }, { replace: true })}
              className="h-10 max-w-[260px] rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px] text-ink"
            >
              {data.applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <ProgressRing value={s.progress} size={64} />
              <div>
                <p className="text-[15px] font-semibold text-ink">{app.title}</p>
                <p className="text-[13px] text-subtle">{app.organization}</p>
              </div>
            </div>
            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-muted">Fields completed</dt>
                <dd className="font-medium text-ink">
                  {s.completed} / {s.total}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Verified</dt>
                <dd className="font-medium text-success">{s.verified}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Need review</dt>
                <dd className={cn('font-medium', issues.length ? 'text-warning' : 'text-ink')}>{issues.length}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink">Checklist</h2>
            <ul className="mt-3 space-y-2.5">
              {sections.map((sec) => {
                const bad = app.fields.filter((f) => f.section === sec && isIssue(f)).length
                return (
                  <li key={sec} className="flex items-center gap-2.5 text-[14px]">
                    {bad ? <AlertTriangle className="size-4 text-warning" aria-label="Needs attention" /> : <CheckCircle2 className="size-4 text-success" aria-label="Complete" />}
                    <span className={bad ? 'text-ink' : 'text-ink-2'}>{sec}</span>
                    {bad > 0 && <span className="ml-auto text-[12px] text-warning">{bad}</span>}
                  </li>
                )
              })}
            </ul>
            {issues.length > 0 ? (
              <Button className="mt-5 w-full" onClick={() => issuesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Resolve Issues
              </Button>
            ) : (
              <Button className="mt-5 w-full" to={`/applications/${app.id}/review`}>
                Continue to Review
              </Button>
            )}
          </Card>
        </div>

        <div ref={issuesRef} className="scroll-mt-24 space-y-4">
          <AnimatePresence mode="popLayout">
            {issues.length === 0 ? (
              <motion.div key="ok" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="border-success-line p-8 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                    <CheckCircle2 className="size-6" aria-hidden />
                  </span>
                  <p className="mt-4 text-[17px] font-semibold text-ink" role="status">
                    All checks passed
                  </p>
                  <p className="mt-1 text-[14px] text-muted">
                    {s.completed} of {s.total} fields complete, with no conflicts or missing required information.
                  </p>
                  <Button className="mt-5" to={`/applications/${app.id}/review`}>
                    Review Application
                  </Button>
                </Card>
              </motion.div>
            ) : (
              issues.map((f) => (
                <motion.div key={f.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}>
                  <IssueCard app={app} field={f} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
          {issues.length > 0 && (
            <p className="text-[13px] text-subtle">
              Resolving a conflict here updates your profile, so every other application that asks for the same detail is fixed too.{' '}
              <Link to="/profile" className="text-accent underline underline-offset-2">
                View profile
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
