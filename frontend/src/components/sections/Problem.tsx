import { Container, Section } from '../ui/primitives'

const PORTALS = [
  { portal: 'University admissions', label: 'Name of applicant' },
  { portal: 'Merit scholarship', label: 'Full legal name' },
  { portal: 'Job application', label: 'Candidate name' },
]

const POINTS = [
  { title: 'Repeated typing', body: 'Every portal asks for your name, contact details and education again.' },
  { title: 'Scattered documents', body: 'The details live across resumes, certificates and transcripts.' },
  { title: 'Costly slips', body: 'A mistyped date or email can put a good application at risk.' },
]

/** Three portals asking the same question in different words. */
function PortalsIllustration() {
  return (
    <figure>
      <div aria-hidden className="relative mx-auto max-w-[460px] pb-10 pr-10 sm:pb-14 sm:pr-14">
        {PORTALS.map((p, i) => (
          <div
            key={p.portal}
            className="rounded-[var(--radius-panel)] border border-line bg-surface p-4 sm:p-5"
            style={{
              marginTop: i === 0 ? 0 : '-0.75rem',
              marginLeft: `${i * 3}rem`,
              position: 'relative',
              boxShadow: '0 1px 0 rgb(26 26 24 / 0.04), 0 14px 30px -22px rgb(26 26 24 / 0.35)',
            }}
          >
            <p className="text-[12px] font-medium text-subtle">{p.portal}</p>
            <p className="mt-3 text-[14px] font-medium text-ink-2">{p.label}</p>
            <div className="mt-1.5 flex h-10 items-center rounded-[var(--radius-control)] border border-line-strong bg-field px-3 text-[15px] text-ink">
              Ritesh Kumar
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-center text-[13px] text-subtle">Illustration: one answer, asked three ways.</figcaption>
    </figure>
  )
}

export function Problem() {
  return (
    <Section labelledBy="problem-title" className="border-t border-line">
      <Container className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <p className="eyebrow mb-3">Why FormPilot</p>
          <h2 id="problem-title" className="heading text-[32px] text-ink sm:text-[40px] lg:text-[46px]">
            The same answers, typed into every portal.
          </h2>
          <p className="mt-5 text-[18px] leading-relaxed text-muted">
            Each form words its questions differently, so copy and paste never quite works. FormPilot recognizes the question
            and answers it from your profile.
          </p>
          <dl className="mt-10 grid gap-6 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {POINTS.map((p) => (
              <div key={p.title} className="border-t border-line pt-4">
                <dt className="text-[16px] font-medium text-ink">{p.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>
        <PortalsIllustration />
      </Container>
    </Section>
  )
}
