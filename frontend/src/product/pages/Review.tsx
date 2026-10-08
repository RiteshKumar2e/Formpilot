import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, BookmarkPlus, CheckCircle2, ClipboardCheck, FileSearch, Info } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { api, ApiError } from '../../lib/api'
import { cn } from '../../lib/utils'
import { useWorkspace } from '../workspace'
import { formatDateTime, isBlocking, sectionsOf, STATUS_LABEL, summary } from '../selectors'
import type { Application } from '../types'
import { Card, EmptyState, FieldStatusBadge, SourceChip } from '../ui'

/** Document filenames an application's answers came from (not Smart Answers or templates). */
function documentsUsed(app: Application): string[] {
  const names = app.fields.flatMap((f) => (f.source ?? '').split(',').map((s) => s.replace(/\(confirmed by you\)/i, '').trim()))
  return [...new Set(names.filter((n) => /\.(pdf|png|jpe?g)$/i.test(n)))]
}

function SaveTemplate({ app }: { app: Application }) {
  const [name, setName] = useState(`${app.title} Application`)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Give the template a name.')
    setSaving(true)
    setError(null)
    try {
      await api.templates.create({
        name: name.trim(),
        application_type: app.type,
        organization: app.organization || undefined,
        fields: app.fields.map((f) => ({ label: f.label, value: f.value, section: f.section, profileKey: f.profileKey })),
        documents: documentsUsed(app),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t save the template.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <p role="status" className="mt-6 flex items-center justify-center gap-2 text-[14px] text-success">
        <CheckCircle2 className="size-4" aria-hidden />
        Saved to your <Link to="/vault?tab=templates" className="font-medium underline underline-offset-2">Application Vault</Link>
      </p>
    )
  }
  return (
    <form onSubmit={save} className="mt-6 rounded-[var(--radius-panel)] border border-accent-line bg-panel p-4 text-left" noValidate>
      <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
        <BookmarkPlus className="size-4 text-accent" aria-hidden />
        Save this application as a reusable template?
      </p>
      <p className="mt-1 text-[13px] text-ink-2">
        Next time a similar form appears, FormPilot offers to reuse its answers, documents and preferences. You still review what’s specific to the new application.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="template-name" className="sr-only">
          Template name
        </label>
        <input
          id="template-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-field px-3 text-[14px] outline-none focus:border-accent"
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save Template'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </form>
  )
}

function Success({ app }: { app: Application }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-xl">
      <Card className="p-8 text-center sm:p-10">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success"
        >
          <CheckCircle2 className="size-7" aria-hidden />
        </motion.span>
        <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-ink" role="status">
          Application completed ✓
        </h1>
        <dl className="mx-auto mt-6 max-w-sm space-y-3 text-left text-[15px]">
          <div className="flex justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Application</dt>
            <dd className="text-right font-medium text-ink">{app.title}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Status</dt>
            <dd className="font-medium text-success">{STATUS_LABEL.prepared}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Timestamp</dt>
            <dd className="text-right text-ink">{app.preparedAt ? formatDateTime(app.preparedAt) : ''}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Reference</dt>
            <dd className="font-mono text-ink">{app.reference}</dd>
          </div>
        </dl>
        <p className="mt-6 flex items-start gap-2 rounded-[var(--radius-control)] bg-canvas px-3 py-2.5 text-left text-[13px] text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          FormPilot has not sent anything. Your answers are ready to submit through {app.organization || 'the organization'}’s application portal.
        </p>
        <SaveTemplate app={app} />
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button to={`/applications/${app.id}`} variant="secondary">
            View Application
          </Button>
          <Button to="/dashboard">Back to Dashboard</Button>
        </div>
      </Card>
    </motion.div>
  )
}

export function ReviewPage() {
  const { id } = useParams()
  const { data, approveApplication } = useWorkspace()
  const app = data?.applications.find((a) => a.id === id)
  usePageMeta({ title: app ? `Review ${app.title}` : 'Review', path: `/applications/${id}/review` })
  const [confirmed, setConfirmed] = useState(false)

  if (!data) return null
  if (!app) {
    return <EmptyState icon={FileSearch} title="Application not found." description="It may have been deleted, or the link is out of date." action={<Button to="/applications">Back to applications</Button>} />
  }
  if (app.status === 'prepared') return <Success app={app} />

  const s = summary(app)
  const blocking = app.fields.filter(isBlocking)
  const ready = blocking.length === 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to={`/applications/${app.id}`} className="inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Back to application
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', ready ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
            {ready ? <ClipboardCheck className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
          </span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{ready ? 'Application Ready' : 'Almost ready'}</h1>
            <p className="mt-1 text-[15px] text-muted">
              {ready ? 'Review everything before continuing.' : `Resolve ${blocking.length} ${blocking.length === 1 ? 'issue' : 'issues'} before you can approve.`}
            </p>
            <p className="mt-1 text-[14px] text-subtle">
              {app.title}
              {app.organization ? ` · ${app.organization}` : ''}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
          <div>
            <dt className="text-[13px] text-muted">Fields completed</dt>
            <dd className="mt-1 text-[20px] font-semibold text-ink">
              {s.completed}/{s.total}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">Documents verified</dt>
            <dd className="mt-1 text-[20px] font-semibold text-ink">{s.documents}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">Critical errors</dt>
            <dd className={cn('mt-1 text-[20px] font-semibold', blocking.length ? 'text-danger' : 'text-success')}>{blocking.length}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-muted">Optional warnings</dt>
            <dd className="mt-1 text-[20px] font-semibold text-ink">{s.warnings.length}</dd>
          </div>
        </dl>
      </Card>

      {!ready && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-warning-line bg-warning-soft p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-[14px] text-ink">Approval is paused: {blocking.map((b) => b.label).join(', ')}.</p>
          <Button size="sm" to={`/validation?app=${app.id}`}>
            Resolve Issues
          </Button>
        </div>
      )}

      {sectionsOf(app).map((sec) => (
        <Card key={sec} className="px-5 sm:px-6">
          <h2 className="border-b border-line py-4 text-[16px] font-semibold text-ink">{sec === 'Personal Information' ? 'Profile information' : sec}</h2>
          <dl className="divide-y divide-line">
            {app.fields
              .filter((f) => f.section === sec)
              .map((f) => (
                <div key={f.id} className="grid gap-1.5 py-3.5 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                  <dt className="text-[14px] text-muted">{f.label}</dt>
                  <dd className="min-w-0">
                    {f.value ? <p className="break-words text-[15px] text-ink">{f.value}</p> : <p className="text-[15px] text-danger">Not provided</p>}
                    {f.value && f.section !== 'Documents' && (
                      <div className="mt-1">
                        <SourceChip source={f.source} />
                      </div>
                    )}
                  </dd>
                  <dd>
                    <FieldStatusBadge status={f.status} required={f.required} />
                  </dd>
                </div>
              ))}
          </dl>
        </Card>
      ))}

      <Card className="p-5 sm:p-6">
        <label className={cn('flex items-start gap-3 text-[15px]', ready ? 'text-ink' : 'text-subtle')}>
          <input type="checkbox" disabled={!ready} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 size-4 shrink-0 accent-accent" />
          I’ve reviewed every field and confirm this information is accurate.
        </label>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button to={`/applications/${app.id}`} variant="secondary">
            Edit Application
          </Button>
          <Button onClick={() => approveApplication(app.id)} disabled={!ready || !confirmed}>
            Approve &amp; Continue
          </Button>
        </div>
        <p className="mt-4 text-[13px] text-subtle">Approving marks this application ready for submission. FormPilot never submits anything on your behalf.</p>
      </Card>
    </div>
  )
}
