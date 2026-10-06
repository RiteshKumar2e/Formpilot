import type { ReactNode } from 'react'
import { FileIcon } from '../ui/Icons'
import { Container, Section, SectionHeader, Status } from '../ui/primitives'

/* Small renderings of FormPilot's own UI, one per step. */

function UploadFragment() {
  return (
    <div className="space-y-2">
      {[
        ['Resume.pdf', 'Processed'],
        ['Degree_Certificate.pdf', 'Processed'],
      ].map(([name, status]) => (
        <div key={name} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-field px-2.5 py-2">
          <FileIcon className="size-4 shrink-0 text-subtle" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{name}</span>
          <Status tone="success" className="text-[12px]">
            {status}
          </Status>
        </div>
      ))}
    </div>
  )
}

function ExtractFragment() {
  return (
    <dl className="divide-y divide-line rounded-[var(--radius-control)] border border-line bg-field px-3 text-[13px]">
      {[
        ['Full name', 'Ritesh Kumar'],
        ['Degree', 'B.Tech in Computer Science'],
        ['Phone', '+91 98765 43210'],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-1.5">
          <dt className="shrink-0 text-subtle">{k}</dt>
          <dd className="truncate text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function ResolveFragment() {
  return (
    <div className="rounded-[var(--radius-control)] border-l-2 border-warning bg-warning-soft p-3">
      <p className="text-[12.5px] font-medium text-ink">Date of birth: documents disagree</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-[var(--radius-control)] border-2 border-accent bg-field px-2 py-1.5">
          <p className="text-[13px] text-ink">12 May 2003</p>
          <p className="truncate font-mono text-[11px] text-subtle">Certificate</p>
        </div>
        <div className="rounded-[var(--radius-control)] border border-line bg-field px-2 py-1.5">
          <p className="text-[13px] text-ink">12 May 2002</p>
          <p className="truncate font-mono text-[11px] text-subtle">Resume</p>
        </div>
      </div>
    </div>
  )
}

function FillFragment() {
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-field p-3">
      <p className="text-[12.5px] text-subtle">Latest degree earned</p>
      <p className="mt-1 text-[14px] text-ink">B.Tech in Computer Science</p>
      <p className="mt-0.5 truncate font-mono text-[11px] text-subtle">Resume.pdf, Degree_Certificate.pdf · 90%</p>
    </div>
  )
}

const STEPS: { title: string; body: string; visual: ReactNode }[] = [
  {
    title: 'Upload',
    body: 'Add your resume, certificates and transcripts. Each file is encrypted before it is stored.',
    visual: <UploadFragment />,
  },
  {
    title: 'Extract',
    body: 'FormPilot reads every document and pulls out names, contact details, dates, education and skills.',
    visual: <ExtractFragment />,
  },
  {
    title: 'Resolve',
    body: 'When documents disagree, you choose the right value once. FormPilot remembers it.',
    visual: <ResolveFragment />,
  },
  {
    title: 'Fill',
    body: 'Paste a form’s field labels. Each answer comes back with the document it came from.',
    visual: <FillFragment />,
  },
]

export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-title" className="border-t border-line bg-sunken/50">
      <Container>
        <SectionHeader
          id="how-title"
          eyebrow="How it works"
          title="From documents to answers in four steps."
          description="You upload and you decide. FormPilot does the reading, matching and cross-checking in between."
        />
        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col rounded-[var(--radius-panel)] border border-line bg-surface">
              <div aria-hidden className="flex min-h-[148px] flex-col justify-center border-b border-line bg-canvas/70 p-4">
                {step.visual}
              </div>
              <div className="p-5">
                <p className="font-mono text-[12px] text-accent">Step {i + 1}</p>
                <h3 className="mt-1.5 text-[20px] font-medium tracking-[-0.015em] text-ink">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
