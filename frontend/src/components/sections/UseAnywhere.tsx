import { AlertTriangle, ArrowDown, BadgeCheck, FileText, Lock } from 'lucide-react'
import { Button } from '../ui/Button'
import { LogoMark } from '../ui/Logo'
import { Container, Section, SectionHeader } from '../ui/primitives'

const FLOW = [
  { step: 'External website', note: 'A job portal, a scholarship form, an admissions site' },
  { step: 'Detect form fields', note: 'The extension finds every input and its label' },
  { step: 'Understand field meaning', note: '“University / College attended” means your institution' },
  { step: 'Retrieve profile data', note: 'From your verified Master Profile and documents' },
  { step: 'Show suggested values', note: 'With source and confidence for each one' },
  { step: 'You review', note: 'Uncertain values are flagged, never chosen for you' },
  { step: 'Fill form', note: 'Only what you approve. You press Submit yourself.' },
]

const READY = [
  { field: 'Full Name', value: 'Ritesh Kumar' },
  { field: 'Email', value: 'ritesh@example.com' },
  { field: 'University', value: 'Arka Jain University' },
  { field: 'Skills', value: 'Python, React, FastAPI' },
]

/** A realistic mockup of the extension panel, with sample data. */
export function ExtensionMockup() {
  return (
    <figure>
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line-strong bg-surface shadow-[var(--shadow-raised)]">
        <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-2">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-surface px-3 py-0.5 text-[11px] text-ink-2">
            <Lock className="size-3 text-success" aria-hidden />
            <span className="truncate">careerhub.example/jobs/apply</span>
          </span>
          <span className="relative" aria-hidden>
            <LogoMark className="size-6" />
            <span className="absolute -top-1 -right-1.5 rounded-full bg-highlight px-1 font-mono text-[9px] font-bold text-ink">12</span>
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <LogoMark className="size-6" />
              <span className="text-[12px] font-bold tracking-[0.08em] text-ink">FORMPILOT</span>
            </span>
            <span className="text-[12px] text-subtle">Form detected</span>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[var(--radius-control)] bg-canvas py-2">
              <dt className="text-[11px] text-subtle">Fields</dt>
              <dd className="text-[18px] font-semibold text-ink">12</dd>
            </div>
            <div className="rounded-[var(--radius-control)] bg-success-soft py-2">
              <dt className="text-[11px] text-success">Ready</dt>
              <dd className="text-[18px] font-semibold text-success">10</dd>
            </div>
            <div className="rounded-[var(--radius-control)] bg-warning-soft py-2">
              <dt className="text-[11px] text-warning">Need review</dt>
              <dd className="text-[18px] font-semibold text-warning">2</dd>
            </div>
          </dl>

          <ul className="mt-4 divide-y divide-line rounded-[var(--radius-control)] border border-line text-[13px]">
            {READY.map((r) => (
              <li key={r.field} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-subtle">{r.field}</span>
                <span className="truncate text-ink">✓ {r.value}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-[var(--radius-control)] border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-ink">Highest Qualification</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                <BadgeCheck className="size-3" aria-hidden />
                Verified
              </span>
            </div>
            <p className="mt-1 text-[13px] text-ink-2">
              <span className="text-subtle">Suggested: </span>B.Tech Computer Science
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-subtle">
              <span className="inline-flex items-center gap-1 font-mono">
                <FileText className="size-3" aria-hidden />
                Degree_Certificate.pdf
              </span>
              <span>Confidence 98%</span>
            </p>
            <span className="mt-2 inline-flex h-7 items-center rounded-[var(--radius-control)] border border-accent-line bg-panel px-2.5 text-[12px] text-accent">Use this value</span>
          </div>

          <div className="mt-2 rounded-[var(--radius-control)] border border-warning-line bg-warning-soft/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-ink">Date of Birth</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
                <AlertTriangle className="size-3" aria-hidden />
                Needs Review
              </span>
            </div>
            <p className="mt-1 text-[12px] text-ink-2">Your documents disagree: 12 May 2002 (Resume.pdf) and 12 May 2003 (Degree.pdf). FormPilot won’t choose for you.</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <span className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] bg-accent text-[14px] font-medium text-white">Fill with FormPilot</span>
            <span className="inline-flex h-10 items-center justify-center rounded-[var(--radius-control)] border border-accent-line bg-panel text-[14px] text-accent">Review First</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-2.5 text-[13px] text-subtle">The FormPilot extension on an external job portal. Illustration with sample data.</figcaption>
    </figure>
  )
}

export function UseAnywhere() {
  return (
    <Section id="anywhere" labelledBy="anywhere-title" className="border-t border-line bg-band">
      <Container>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <SectionHeader
              id="anywhere-title"
              eyebrow="Use FormPilot anywhere"
              title="Use FormPilot anywhere."
              description="Take your verified profile with you across supported web applications. The FormPilot browser extension understands the form in front of you, fills what it can, flags what it can’t, and leaves the final decision to you."
            />
            <ol className="mt-10 space-y-1">
              {FLOW.map((f, i) => (
                <li key={f.step}>
                  <div className="flex gap-3">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[12px] ${i === 5 ? 'bg-highlight text-ink' : 'bg-accent-soft text-accent'}`}
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">
                      <span className="block text-[15px] font-medium text-ink">{f.step}</span>
                      <span className="block text-[13px] text-subtle">{f.note}</span>
                    </span>
                  </div>
                  {i < FLOW.length - 1 && <ArrowDown className="my-1 ml-1.5 size-4 text-line-strong" aria-hidden />}
                </li>
              ))}
            </ol>
            <p className="mt-8 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3 text-[14px] text-ink-2">
              <strong className="text-ink">You stay in control.</strong> FormPilot never silently submits an application. Uncertain information is flagged for
              review, not chosen automatically.
            </p>
            <div className="mt-6">
              <Button to="/anywhere" variant="secondary">
                Try the live demo
              </Button>
            </div>
          </div>
          <ExtensionMockup />
        </div>
      </Container>
    </Section>
  )
}
