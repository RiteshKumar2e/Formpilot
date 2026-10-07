import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Briefcase, CheckCircle2, FileUp, GraduationCap, Landmark, Loader2, PenLine, School } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/FormControls'
import { usePageMeta } from '../../hooks/usePageMeta'
import { cn } from '../../lib/utils'
import { TEMPLATE_FIELDS, useWorkspace, WorkspaceError } from '../workspace'
import type { ApplicationType } from '../types'
import { Card, ErrorPanel, PageHeader } from '../ui'

const TYPES: { id: ApplicationType; label: string; description: string; icon: typeof Briefcase; title: string; org: string }[] = [
  { id: 'job', label: 'Job Application', description: 'Roles, internships and fellowships', icon: Briefcase, title: 'Backend Engineer', org: 'Harbor Systems' },
  { id: 'scholarship', label: 'Scholarship', description: 'Merit and need-based awards', icon: GraduationCap, title: 'STEM Excellence Scholarship', org: 'Lakeview Foundation' },
  { id: 'admission', label: 'Admission', description: 'University and graduate programs', icon: School, title: 'M.Tech in Artificial Intelligence', org: 'Eastgate University' },
  { id: 'government', label: 'Government Form', description: 'IDs, certificates and registrations', icon: Landmark, title: 'Address Change Request', org: 'Municipal Services' },
  { id: 'custom', label: 'Custom Form', description: 'Any other form you need to fill', icon: PenLine, title: '', org: '' },
]

const ANALYSIS = ['Understanding application…', 'Detecting fields…', 'Retrieving relevant profile data…', 'Mapping information…']

export function NewApplicationPage() {
  usePageMeta({ title: 'New Application', path: '/applications/new' })
  const { createApplication } = useWorkspace()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [type, setType] = useState<ApplicationType | null>(null)
  const [title, setTitle] = useState('')
  const [org, setOrg] = useState('')
  const [labels, setLabels] = useState('')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [analysis, setAnalysis] = useState(0)
  const [error, setError] = useState<WorkspaceError | null>(null)

  const chooseType = (t: (typeof TYPES)[number]) => {
    setType(t.id)
    setTitle(t.title)
    setOrg(t.org)
    setLabels(TEMPLATE_FIELDS[t.id].join('\n'))
  }

  const readFormFile = (file: File | undefined) => {
    if (!file) return
    if (!/\.(txt|csv)$/i.test(file.name)) {
      setErrors({ labels: 'Upload a .txt or .csv list of field labels. Reading PDF forms directly needs the form-parsing API, which isn’t available yet.' })
      return
    }
    file.text().then((text) => {
      const parsed = text
        .split(/[\n,]/)
        .map((l) => l.trim())
        .filter(Boolean)
      setLabels(parsed.join('\n'))
      setErrors({})
    })
  }

  const analyze = async (e: FormEvent) => {
    e.preventDefault()
    const fieldList = labels.split('\n').map((l) => l.trim()).filter(Boolean)
    const next = {
      title: title.trim() ? undefined : 'Enter the application name.',
      labels: fieldList.length ? undefined : 'Add at least one form field, one per line.',
    }
    setErrors(next)
    if (next.title || next.labels || !type) return
    setStep(3)
    setError(null)
    try {
      // The stages are paced so each one is readable; the mapping itself runs during them.
      const work = createApplication({ title: title.trim(), organization: org.trim(), type, labels: fieldList })
      for (let i = 0; i < ANALYSIS.length; i++) {
        setAnalysis(i)
        await new Promise((r) => setTimeout(r, 550))
      }
      const id = await work
      setAnalysis(ANALYSIS.length)
      await new Promise((r) => setTimeout(r, 300))
      navigate(`/applications/${id}`)
    } catch (err) {
      setError(err instanceof WorkspaceError ? err : new WorkspaceError('Couldn’t map this application.', 'Something unexpected happened.', 'retry'))
      setStep(2)
    }
  }

  const fieldCount = labels.split('\n').filter((l) => l.trim()).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="New application" description="Tell FormPilot what you’re applying for. It maps every field to your profile." />

      <ol className="flex items-center gap-2 text-[13px]" aria-label="Progress">
        {['Choose type', 'Add the form', 'Analyze'].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={step === i + 1 ? 'step' : undefined}
              className={cn('flex size-6 items-center justify-center rounded-full font-mono text-[12px]', step > i + 1 ? 'bg-success text-white' : step === i + 1 ? 'bg-accent text-white' : 'bg-sunken text-subtle')}
            >
              {step > i + 1 ? <CheckCircle2 className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={step >= i + 1 ? 'text-ink' : 'text-subtle'}>{label}</span>
            {i < 2 && <span aria-hidden className="mx-1 h-px w-6 bg-line-strong sm:w-10" />}
          </li>
        ))}
      </ol>

      {error && <ErrorPanel error={error} onRetry={() => setError(null)} />}

      {step === 1 && (
        <Card className="p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold text-ink">Choose application type</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {TYPES.map((t) => {
              const Icon = t.icon
              const active = type === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => chooseType(t)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-start gap-3 rounded-[var(--radius-panel)] border p-4 text-left transition-colors',
                    active ? 'border-accent bg-accent-soft/50 ring-1 ring-accent' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]', active ? 'bg-accent text-white' : 'bg-sunken text-ink-2')}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-ink">{t.label}</span>
                    <span className="block text-[13px] text-subtle">{t.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setStep(2)} disabled={!type}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <form onSubmit={analyze} noValidate>
          <Card className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Application name" value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} placeholder="Software Engineer" />
              <TextField label="Organization (optional)" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Company, university or office" />
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
                <label htmlFor="form-fields" className="text-[14px] font-medium text-ink-2">
                  Form fields <span className="font-normal text-subtle">· one per line, as written on the form</span>
                </label>
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
                  <FileUp className="size-3.5" aria-hidden />
                  Upload a field list
                </button>
                <input ref={fileRef} type="file" accept=".txt,.csv" className="sr-only" tabIndex={-1} aria-label="Upload a field list" onChange={(e) => { readFormFile(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              <textarea
                id="form-fields"
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
                rows={10}
                aria-invalid={errors.labels ? true : undefined}
                aria-describedby={errors.labels ? 'labels-error' : 'labels-hint'}
                className={cn(
                  'w-full rounded-[var(--radius-control)] border bg-field px-3.5 py-3 font-mono text-[14px] leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/15',
                  errors.labels ? 'border-danger' : 'border-line-strong',
                )}
              />
              {errors.labels ? (
                <p id="labels-error" className="mt-1.5 text-[14px] text-danger">{errors.labels}</p>
              ) : (
                <p id="labels-hint" className="mt-1.5 text-[13px] text-subtle">
                  {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}. Typical fields for this type are filled in; edit or paste your own.
                </p>
              )}
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit">Analyze application</Button>
            </div>
          </Card>
        </form>
      )}

      {step === 3 && (
        <Card className="p-6 sm:p-8">
          <h2 className="text-[16px] font-semibold text-ink">Analyzing {title}</h2>
          <ol className="mt-5 space-y-3" aria-live="polite">
            {ANALYSIS.map((label, i) => {
              const done = i < analysis
              const active = i === analysis
              return (
                <motion.li key={label} initial={{ opacity: 0, x: -6 }} animate={{ opacity: i <= analysis ? 1 : 0.45, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3">
                  <span className={cn('flex size-6 items-center justify-center rounded-full', done ? 'bg-success text-white' : active ? 'bg-accent-soft text-accent' : 'bg-sunken text-subtle')}>
                    {done ? <CheckCircle2 className="size-4" aria-hidden /> : active ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <span className="size-1.5 rounded-full bg-current" />}
                  </span>
                  <span className="text-[15px] text-ink">
                    {label}
                    {label.startsWith('Detecting') && done && <span className="text-subtle"> {fieldCount} found</span>}
                  </span>
                </motion.li>
              )
            })}
          </ol>
        </Card>
      )}
    </div>
  )
}
