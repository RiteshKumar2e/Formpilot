import { AlertTriangle, CircleDashed, PauseCircle } from 'lucide-react'
import { Container, Section, SectionHeader } from '../ui/primitives'

const POINTS = [
  { title: 'Conflicting values', body: 'The same detail differs between two of your documents.' },
  { title: 'Missing information', body: 'A form needs something your profile doesn’t have yet.' },
  { title: 'Low-confidence matches', body: 'Uncertain answers are flagged for a quick check.' },
]

export function ValidationPreview() {
  return (
    <Section id="validation" labelledBy="validation-title" className="border-t border-line bg-sunken/50">
      <Container className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <SectionHeader
            id="validation-title"
            eyebrow="Validation"
            title="Catch the mistake before it reaches the application."
            description="FormPilot cross-checks every detail across your documents and pauses approval until you decide."
          />
          <dl className="mt-10 space-y-5">
            {POINTS.map((p) => (
              <div key={p.title} className="border-l-2 border-line-strong pl-4">
                <dt className="text-[16px] font-medium text-ink">{p.title}</dt>
                <dd className="mt-1 text-[15px] text-muted">{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="space-y-4" aria-label="Example validation results">
          <div className="rounded-[var(--radius-panel)] border border-warning-line bg-surface p-5 shadow-[var(--shadow-raised)]">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <AlertTriangle className="size-5 text-warning" aria-hidden />
              Potential Conflict Detected
            </p>
            <dl className="mt-4 grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-[14px]">
              <dt className="text-muted">Field</dt>
              <dd className="font-medium text-ink">Date of Graduation</dd>
              <dt className="text-muted">Resume</dt>
              <dd className="text-ink">May 2026</dd>
              <dt className="text-muted">Certificate</dt>
              <dd className="text-ink">June 2026</dd>
            </dl>
            <div aria-hidden className="mt-4 flex flex-wrap gap-2 text-[13px]">
              <span className="rounded-[var(--radius-control)] border border-line-strong px-3 py-1.5 text-ink">Use Resume Value</span>
              <span className="rounded-[var(--radius-control)] border border-line-strong px-3 py-1.5 text-ink">Use Certificate Value</span>
              <span className="rounded-[var(--radius-control)] border border-line-strong px-3 py-1.5 text-ink">Edit Manually</span>
            </div>
            <p className="mt-4 flex items-center gap-1.5 rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-[13px] text-ink-2">
              <PauseCircle className="size-4 shrink-0 text-warning" aria-hidden />
              Application submission is paused until this issue is resolved.
            </p>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-danger-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <CircleDashed className="size-5 text-danger" aria-hidden />
              Missing: Emergency Contact
            </p>
            <p className="mt-1.5 text-[14px] text-ink-2">Status: Required before submission</p>
            <span aria-hidden className="mt-3 inline-block rounded-[var(--radius-control)] bg-accent px-3 py-1.5 text-[13px] font-medium text-white">
              Add Information
            </span>
          </div>
          <figcaption className="text-[13px] text-subtle">Illustration with sample data.</figcaption>
        </figure>
      </Container>
    </Section>
  )
}
