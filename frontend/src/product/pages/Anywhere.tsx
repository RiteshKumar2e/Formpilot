import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookmarkCheck,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileText,
  Loader2,
  Lock,
  MapPin,
  RotateCw,
  X,
} from 'lucide-react'
import { LogoMark } from '../../components/ui/Logo'
import { Button } from '../../components/ui/Button'
import { usePageMeta } from '../../hooks/usePageMeta'
import { api, ApiError } from '../../lib/api'
import { cn } from '../../lib/utils'
import type { AutofillResponse, AutofillSuggestion } from '../../types/api'
import { attachFile, detectFields, fill, toMeta, type DetectedField } from '../extension/dom'
import { SmartAnswerCard } from '../SmartAnswer'
import { PageHeader } from '../ui'

const PAGE_URL = 'https://careerhub.example/jobs/machine-learning-engineer/apply'
const PAGE_TITLE = 'Machine Learning Engineer · CareerHub'
const ORGANIZATION = 'CareerHub'
const ROLE = 'Machine Learning Engineer'

const FLOW = ['External website', 'Detect form fields', 'Understand meaning', 'Retrieve profile data', 'Suggest values', 'You review', 'Fill form']

// ---------------------------------------------------------------------------------------------
// The external website: a fictional job portal. It's an ordinary (uncontrolled) HTML form, like a
// real third-party site, so FormPilot has to find and fill its fields through the DOM.
// ---------------------------------------------------------------------------------------------

function PortalField({ id, label, required, children }: { id: string; label: string; required?: boolean; children?: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-[#1f2937]">
        {label}
        {required && <span className="text-[#b91c1c]"> *</span>}
      </label>
      {children}
    </div>
  )
}

const portalInput =
  'mt-1 w-full rounded-md border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] text-[#111827] outline-none transition-colors focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20'

function CareerHubPortal({
  formRef,
  status,
  onSubmitAttempt,
}: {
  formRef: React.RefObject<HTMLFormElement | null>
  status: 'editing' | 'complete'
  onSubmitAttempt: () => void
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmitAttempt()
  }
  return (
    <div className="min-h-full bg-[#f1f5f9] text-[#111827]">
      <header className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-3">
        <span className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-[#0f766e]">
          <Briefcase className="size-5" aria-hidden />
          CareerHub
        </span>
        <span className="hidden text-[13px] text-[#64748b] sm:block">Jobs · Companies · Salaries</span>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <p className="text-[12px] font-semibold tracking-wide text-[#0f766e] uppercase">Northwind AI · Bengaluru</p>
        <h2 className="mt-1 text-[22px] font-bold text-[#0f172a]">Machine Learning Engineer</h2>
        <p className="mt-1 flex items-center gap-1 text-[13px] text-[#64748b]">
          <MapPin className="size-3.5" aria-hidden />
          Hybrid · Full-time · Posted 2 days ago
        </p>

        {status === 'complete' && (
          <div role="status" className="mt-4 flex items-start gap-2 rounded-md border border-[#86efac] bg-[#f0fdf4] px-3 py-2.5 text-[14px] text-[#166534]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Your application is ready.</strong> Review before submitting. FormPilot never submits for you.
            </span>
          </div>
        )}

        <form ref={formRef} onSubmit={submit} className="mt-5 space-y-4 rounded-lg border border-[#e2e8f0] bg-white p-5" noValidate>
          <h3 className="text-[15px] font-semibold text-[#0f172a]">Apply for this job</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <PortalField id="ch-name" label="Full Name" required>
              <input id="ch-name" name="fullName" required className={portalInput} />
            </PortalField>
            <PortalField id="ch-email" label="Email" required>
              <input id="ch-email" name="email" type="email" required className={portalInput} />
            </PortalField>
            <PortalField id="ch-phone" label="Phone">
              <input id="ch-phone" name="phone" type="tel" className={portalInput} />
            </PortalField>
            <PortalField id="ch-dob" label="Date of Birth">
              <input id="ch-dob" name="dob" type="date" className={portalInput} />
            </PortalField>
            <PortalField id="ch-university" label="University">
              <input id="ch-university" name="university" className={portalInput} />
            </PortalField>
            <PortalField id="ch-degree" label="Degree">
              <input id="ch-degree" name="degree" className={portalInput} />
            </PortalField>
            <PortalField id="ch-year" label="Graduation Year">
              <input id="ch-year" name="graduationYear" inputMode="numeric" className={portalInput} />
            </PortalField>
            <PortalField id="ch-linkedin" label="LinkedIn Profile">
              <input id="ch-linkedin" name="linkedin" type="url" className={portalInput} />
            </PortalField>
          </div>
          <PortalField id="ch-skills" label="Skills">
            <input id="ch-skills" name="skills" className={portalInput} />
          </PortalField>
          <PortalField id="ch-experience" label="Experience">
            <input id="ch-experience" name="experience" className={portalInput} />
          </PortalField>
          <PortalField id="ch-resume" label="Resume Upload" required>
            <input id="ch-resume" name="resume" type="file" accept=".pdf" required className={cn(portalInput, 'file:mr-3 file:rounded file:border-0 file:bg-[#ccfbf1] file:px-2 file:py-1 file:text-[#0f766e]')} />
          </PortalField>
          <PortalField id="ch-why" label="Why do you want to join us?" required>
            <textarea id="ch-why" name="whyJoin" rows={5} required className={portalInput} />
          </PortalField>
          <button type="submit" className="rounded-md bg-[#0f766e] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#115e59]">
            Submit application
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The FormPilot extension panel
// ---------------------------------------------------------------------------------------------

function percent(n: number) {
  return `${Math.round(n * 100)}%`
}

function StatusBadge({ s, filled }: { s: AutofillSuggestion; filled: boolean }) {
  if (filled) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success"><CheckCircle2 className="size-3" aria-hidden />Filled</span>
  if (s.status === 'ready')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
        {s.verified ? <BadgeCheck className="size-3" aria-hidden /> : <CheckCircle2 className="size-3" aria-hidden />}
        {s.verified ? 'Verified' : 'Ready'}
      </span>
    )
  if (s.status === 'needs_review')
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning"><AlertTriangle className="size-3" aria-hidden />Needs review</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-subtle"><CircleDashed className="size-3" aria-hidden />Missing</span>
}

function FieldCard({
  s,
  filled,
  onUse,
  onFocus,
}: {
  s: AutofillSuggestion
  filled: boolean
  onUse: (s: AutofillSuggestion, value?: string) => void
  onFocus: (id: string) => void
}) {
  return (
    <li className={cn('rounded-[var(--radius-control)] border p-3', s.status === 'needs_review' && !filled ? 'border-warning-line bg-warning-soft/40' : 'border-line bg-surface')}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => onFocus(s.id)} className="text-left text-[13px] font-semibold text-ink hover:text-accent">
          {s.label}
        </button>
        <StatusBadge s={s} filled={filled} />
      </div>

      {s.kind === 'answer' && s.value && !filled ? (
        <div className="mt-2">
          <SmartAnswerCard
            compact
            question={s.label}
            organization={ORGANIZATION}
            role={ROLE}
            initial={{ answer: s.value, method: (s.method as 'llm_rag' | 'saved_answer' | 'profile_draft') ?? 'profile_draft', sources: s.sources, is_suggestion: true }}
            onUse={(answer) => onUse(s, answer)}
          />
        </div>
      ) : s.value ? (
        <>
          <p className="mt-1 line-clamp-2 text-[13px] break-words text-ink-2">
            <span className="text-subtle">Suggested: </span>
            {s.value}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-subtle">
            {s.source && (
              <span className="inline-flex items-center gap-1 font-mono">
                <FileText className="size-3" aria-hidden />
                {s.source}
              </span>
            )}
            {s.kind !== 'document' && s.confidence > 0 && <span>Confidence {percent(s.confidence)}</span>}
          </p>
          {s.status === 'needs_review' && !filled && <p className="mt-1 text-[12px] text-ink-2">{s.reasoning}</p>}
          {!filled && (
            <Button size="sm" variant={s.status === 'ready' ? 'secondary' : 'primary'} className="mt-2 h-8" onClick={() => onUse(s)}>
              {s.kind === 'document' ? `Attach ${s.value}` : 'Use this value'}
            </Button>
          )}
        </>
      ) : (
        <p className="mt-1 text-[12px] text-subtle">{s.reasoning} Fill it on the page.</p>
      )}
    </li>
  )
}

function ExtensionPanel({
  detected,
  result,
  loading,
  error,
  filled,
  complete,
  onRetry,
  onUse,
  onFillReady,
  onUseTemplate,
  onFocus,
  onComplete,
  onClose,
}: {
  detected: number
  result: AutofillResponse | null
  loading: boolean
  error: string | null
  filled: Set<string>
  complete: boolean
  onRetry: () => void
  onUse: (s: AutofillSuggestion, value?: string) => void
  onFillReady: () => void
  onUseTemplate: () => void
  onFocus: (id: string) => void
  onComplete: () => void
  onClose: () => void
}) {
  const [reviewing, setReviewing] = useState(false)
  const s = result?.summary
  const pending = result?.fields.filter((f) => !filled.has(f.id) && f.status !== 'missing') ?? []
  const readyLeft = result?.fields.some((f) => f.status === 'ready' && !f.sensitive && !filled.has(f.id)) ?? false
  const templateFields = result?.fields.filter((f) => f.method === 'template' && !filled.has(f.id)) ?? []

  return (
    <aside aria-label="FormPilot extension" className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="flex items-center gap-2">
          <LogoMark />
          <span className="text-[13px] font-bold tracking-[0.08em] text-ink">FORMPILOT</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Close FormPilot" className="inline-flex size-7 items-center justify-center rounded-md text-subtle hover:bg-sunken hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <p className="text-[15px] font-semibold text-ink">Form detected</p>
          <p className="text-[12px] text-subtle">careerhub.example · {detected} fields</p>
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Understanding fields and retrieving your profile…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-[var(--radius-control)] border border-danger-line bg-danger-soft p-3 text-[13px] text-ink-2">
            {error}
            <button type="button" onClick={onRetry} className="ml-2 font-medium text-accent underline underline-offset-2">
              Try again
            </button>
          </div>
        )}

        {s && result && (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[var(--radius-control)] bg-canvas px-2 py-2">
                <dt className="text-[11px] text-subtle">Detected</dt>
                <dd className="text-[18px] font-semibold text-ink">{s.detected}</dd>
              </div>
              <div className="rounded-[var(--radius-control)] bg-success-soft px-2 py-2">
                <dt className="text-[11px] text-success">Ready</dt>
                <dd className="text-[18px] font-semibold text-success">{s.ready}</dd>
              </div>
              <div className="rounded-[var(--radius-control)] bg-warning-soft px-2 py-2">
                <dt className="text-[11px] text-warning">Need review</dt>
                <dd className="text-[18px] font-semibold text-warning">{s.needs_review + s.missing}</dd>
              </div>
            </dl>
            <p className="text-[12px] text-ink-2">
              {s.verified} verified · confidence {percent(s.confidence)} on ready fields. Uncertain values are never filled automatically.
            </p>

            {result.template && templateFields.length > 0 && (
              <div className="rounded-[var(--radius-control)] border border-accent-line bg-panel p-3">
                <p className="flex items-start gap-1.5 text-[13px] text-ink">
                  <BookmarkCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  Reuse your “{result.template.name}” template?
                </p>
                <Button size="sm" className="mt-2 h-8" onClick={onUseTemplate}>
                  Use Template
                </Button>
              </div>
            )}

            {complete ? (
              <div role="status" className="rounded-[var(--radius-control)] border border-success-line bg-success-soft p-3 text-[13px] text-ink">
                <p className="flex items-center gap-1.5 font-semibold text-success">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Review complete
                </p>
                <p className="mt-1">Your application is ready. Review it on the page, then submit it yourself.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {readyLeft && (
                  <Button onClick={() => { onFillReady(); setReviewing(true) }}>Fill with FormPilot</Button>
                )}
                {!reviewing && (
                  <Button variant="secondary" onClick={() => setReviewing(true)}>
                    Review First
                  </Button>
                )}
                {reviewing && !readyLeft && (
                  <Button variant={pending.length ? 'secondary' : 'primary'} onClick={onComplete}>
                    Review Complete
                  </Button>
                )}
              </div>
            )}

            {reviewing ? (
              <ul className="space-y-2">
                {result.fields.map((f) => (
                  <FieldCard key={f.id} s={f} filled={filled.has(f.id)} onUse={onUse} onFocus={onFocus} />
                ))}
              </ul>
            ) : (
              <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
                {result.fields.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-[12px] text-subtle">{f.label}</span>
                      <span className="block truncate text-[13px] text-ink">
                        {f.status === 'ready' ? '✓ ' : f.status === 'needs_review' ? '⚠ ' : ''}
                        {f.kind === 'answer' ? 'Suggested answer ready to review' : f.value ?? 'Not in your profile'}
                      </span>
                    </span>
                    <StatusBadge s={f} filled={filled.has(f.id)} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[11px] text-subtle">FormPilot fills only what you approve and never submits a form.</p>
    </aside>
  )
}

// ---------------------------------------------------------------------------------------------
// The demo: a browser window with the portal and the extension
// ---------------------------------------------------------------------------------------------

function BrowserDemo() {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [fields, setFields] = useState<DetectedField[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [result, setResult] = useState<AutofillResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filled, setFilled] = useState<Set<string>>(new Set())
  const [complete, setComplete] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [runKey, setRunKey] = useState(0)

  // The extension scans the page shortly after it loads.
  useEffect(() => {
    const timer = window.setTimeout(() => formRef.current && setFields(detectFields(formRef.current)), 700)
    return () => window.clearTimeout(timer)
  }, [runKey])

  const byId = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields])

  const suggest = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.autofill.suggest({
        fields: toMeta(fields), // the same metadata the browser extension sends
        page_url: PAGE_URL,
        page_title: PAGE_TITLE,
        organization: ORGANIZATION,
        role: ROLE,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'FormPilot couldn’t read this form.')
    } finally {
      setLoading(false)
    }
  }

  const open = () => {
    setPanelOpen(true)
    if (!result && !loading) void suggest()
  }

  const highlight = (el: HTMLElement) => {
    el.style.backgroundColor = '#eef1fd'
    el.style.borderColor = '#0e0e62'
  }

  const use = async (s: AutofillSuggestion, override?: string) => {
    const field = byId.get(s.id)
    if (!field) return
    try {
      if (s.kind === 'document' && s.document_id && field.element instanceof HTMLInputElement) {
        const blob = await api.documents.download(s.document_id)
        attachFile(field.element, new File([blob], s.value ?? 'document.pdf', { type: blob.type || 'application/pdf' }))
      } else {
        const result = fill(field, override ? { value: override } : { value: s.value ?? '', option: s.option, iso: s.value_iso })
        if (!result.ok) {
          setError(result.reason ?? `Couldn’t fill “${s.label}”.`)
          return
        }
      }
      highlight(field.element)
      setFilled((prev) => new Set(prev).add(s.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Couldn’t fill “${s.label}”.`)
    }
  }

  const fillReady = () => {
    // Sensitive fields (date of birth, address) wait for the person's own click, as in the extension.
    result?.fields.filter((f) => f.status === 'ready' && !f.sensitive && !filled.has(f.id)).forEach((f) => void use(f))
  }

  const useTemplate = () => {
    result?.fields.filter((f) => f.method === 'template' && !filled.has(f.id)).forEach((f) => void use(f))
  }

  const focus = (id: string) => {
    const el = byId.get(id)?.element
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }

  const reset = () => {
    formRef.current?.reset()
    formRef.current?.querySelectorAll<HTMLElement>('input, textarea').forEach((el) => {
      el.style.backgroundColor = ''
      el.style.borderColor = ''
    })
    setResult(null)
    setFilled(new Set())
    setComplete(false)
    setNotice(null)
    setPanelOpen(false)
    setFields([])
    setRunKey((k) => k + 1)
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line-strong bg-surface shadow-[var(--shadow-raised)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-2">
        <span className="hidden gap-1.5 sm:flex" aria-hidden>
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex text-subtle" aria-hidden>
          <ChevronLeft className="size-4" />
          <ChevronRight className="size-4" />
        </span>
        <button type="button" onClick={reset} aria-label="Reload the page" className="text-subtle hover:text-ink">
          <RotateCw className="size-4" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[12px] text-ink-2">
          <Lock className="size-3 shrink-0 text-success" aria-hidden />
          <span className="truncate">{PAGE_URL}</span>
        </div>
        <button
          type="button"
          onClick={() => (panelOpen ? setPanelOpen(false) : open())}
          aria-label={`FormPilot extension${fields.length ? `, ${fields.length} fields detected` : ''}`}
          aria-expanded={panelOpen}
          className="relative inline-flex size-8 items-center justify-center rounded-md hover:bg-surface"
        >
          <LogoMark />
          {fields.length > 0 && (
            <span className="absolute -top-1 -right-1 rounded-full bg-highlight px-1 font-mono text-[10px] font-bold text-ink">{fields.length}</span>
          )}
        </button>
      </div>

      <div className="relative grid lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative max-h-[760px] overflow-y-auto">
          <CareerHubPortal
            formRef={formRef}
            status={complete ? 'complete' : 'editing'}
            onSubmitAttempt={() => setNotice('This is a demo portal, so nothing was sent. On a real website you press Submit yourself, after reviewing.')}
          />
          <AnimatePresence>
            {fields.length > 0 && !panelOpen && !result && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-3 right-3 z-10 flex max-w-[280px] items-center gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-3 shadow-[var(--shadow-raised)]"
                role="status"
              >
                <LogoMark />
                <span className="text-[13px] text-ink">
                  <strong>Form detected</strong>
                  <span className="block text-ink-2">{fields.length} fields FormPilot can help with</span>
                </span>
                <Button size="sm" className="h-8 shrink-0" onClick={open}>
                  Open
                </Button>
              </motion.div>
            )}
            {notice && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
                className="sticky bottom-3 mx-3 mb-3 flex items-start gap-2 rounded-[var(--radius-control)] border border-line bg-surface p-3 text-[13px] text-ink-2 shadow-[var(--shadow-raised)]"
              >
                <span className="flex-1">{notice}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-subtle hover:text-ink">
                  <X className="size-4" aria-hidden />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {panelOpen && (
          <div className="max-h-[760px] border-t border-line lg:w-[380px] lg:border-t-0 lg:border-l">
            <ExtensionPanel
              detected={fields.length}
              result={result}
              loading={loading}
              error={error}
              filled={filled}
              complete={complete}
              onRetry={() => void suggest()}
              onUse={(s, value) => void use(s, value)}
              onFillReady={fillReady}
              onUseTemplate={useTemplate}
              onFocus={focus}
              onComplete={() => setComplete(true)}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function AnywherePage() {
  usePageMeta({ title: 'Use FormPilot Anywhere', path: '/anywhere' })
  return (
    <div className="space-y-6">
      <PageHeader
        title="Use FormPilot anywhere"
        description="Build your profile once. Fill forms anywhere. This demo runs the browser extension’s own detection and fill code on CareerHub, a fictional job portal, with your real profile. Install the extension to do the same on any website."
        actions={<Button to="/extension">Get the extension</Button>}
      />
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px]" aria-label="How the extension works">
        {FLOW.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className={cn('rounded-full border px-2.5 py-1', i === 5 ? 'border-warning-line bg-warning-soft text-ink' : 'border-line bg-surface text-ink-2')}>{step}</span>
            {i < FLOW.length - 1 && <ArrowRight className="size-3.5 text-subtle" aria-hidden />}
          </li>
        ))}
      </ol>
      <BrowserDemo />
      <p className="text-[13px] text-subtle">
        The browser extension is FormPilot’s integration layer for other websites. This demo runs the same field detection and filling code on a simulated
        portal, against the same API an extension calls (<code>POST /api/autofill/suggest</code>). Nothing is ever submitted for you.
      </p>
    </div>
  )
}
