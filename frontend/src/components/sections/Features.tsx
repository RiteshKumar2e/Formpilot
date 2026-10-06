import { Container, Section, SectionHeader, Status } from '../ui/primitives'

/** How a single answer looks in FormPilot: value, source, confidence. */
function AnswerCard() {
  return (
    <figure className="mt-10">
      <div className="rounded-[14px] bg-sunken p-2 sm:p-3">
        <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-5">
          <p className="text-[13px] text-subtle">Form field</p>
          <p className="mt-1 text-[16px] font-medium text-ink">Latest degree earned</p>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[13px] text-subtle">FormPilot’s answer</p>
            <p className="mt-1 text-[18px] text-ink">B.Tech in Computer Science</p>
            <dl className="mt-3 grid grid-cols-[6rem_minmax(0,1fr)] gap-y-1.5 text-[13px]">
              <dt className="text-subtle">Sources</dt>
              <dd className="truncate font-mono text-[12px] text-ink-2">Resume.pdf, Degree_Certificate.pdf</dd>
              <dt className="text-subtle">Confidence</dt>
              <dd>
                <Status tone="success">90%</Status>
              </dd>
            </dl>
          </div>
        </div>
      </div>
      <figcaption className="mt-2.5 text-[13px] text-subtle">An answer as it appears in the workspace, with sample data.</figcaption>
    </figure>
  )
}

const FEATURES = [
  {
    term: 'Document extraction',
    detail: 'Reads the text in your PDFs. Scanned pages and photos are supported when text recognition is enabled on the server.',
  },
  {
    term: 'Field matching',
    detail: 'Knows the many ways forms phrase the same question, from “Name of applicant” to “Full legal name”, and answers from your profile.',
  },
  {
    term: 'Conflict detection',
    detail: 'Compares each detail across your documents and asks you to choose when they differ.',
  },
  {
    term: 'Sources and confidence',
    detail: 'Every answer names the document it came from and shows how closely the field matched.',
  },
  {
    term: 'One reusable profile',
    detail: 'Your documents and decisions are saved, so the next application starts where the last one finished.',
  },
  {
    term: 'You stay in control',
    detail: 'FormPilot prepares answers for you to review. It never submits a form on your behalf.',
  },
]

export function Features() {
  return (
    <Section id="features" labelledBy="features-title" className="border-t border-line">
      <Container className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div>
          <SectionHeader
            id="features-title"
            eyebrow="Features"
            title="Built to get each answer right."
            description="What FormPilot does today, in the version you can use now."
          />
          <AnswerCard />
        </div>
        <div>
          <dl className="border-t border-line">
          {FEATURES.map((f) => (
            <div key={f.term} className="grid gap-1.5 border-b border-line py-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-8">
              <dt className="text-[17px] font-medium text-ink">{f.term}</dt>
              <dd className="text-[16px] leading-relaxed text-muted">{f.detail}</dd>
            </div>
          ))}
          </dl>
          <p className="py-6 text-[14px] leading-relaxed text-muted">
            <span className="font-medium text-ink-2">In development:</span> model-assisted extraction for unusual layouts,
            retrieval over your full documents, and filling forms directly on application sites.
          </p>
        </div>
      </Container>
    </Section>
  )
}
