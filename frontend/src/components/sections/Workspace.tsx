import { Container, Section, SectionHeader } from '../ui/primitives'

// Callout centers, as percentages of the framed desktop screenshot. They sit in the gutters beside each area.
const NOTES = [
  {
    title: 'Every document, with its status',
    body: 'See whether each upload was processed, needs your attention or couldn’t be read, and exactly what was extracted.',
    at: { left: '1%', top: '52%' },
  },
  {
    title: 'Conflicts you settle once',
    body: 'When documents disagree, both values wait for your decision. Your choice applies to every form after that.',
    at: { left: '47.6%', top: '35.5%' },
  },
  {
    title: 'A profile you can check',
    body: 'Every value lists the documents it came from and a confidence score, so you can verify it in seconds.',
    at: { left: '47.6%', top: '64%' },
  },
]

function Marker({ n }: { n: number }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-accent font-mono text-[13px] font-medium text-white ring-4 ring-accent/20">
      {n}
    </span>
  )
}

export function Workspace() {
  return (
    <Section id="product" labelledBy="workspace-title" className="border-t border-line">
      <Container>
        <SectionHeader
          id="workspace-title"
          eyebrow="Your workspace"
          title="Your documents and profile, side by side."
          description="This is the real FormPilot workspace with two sample documents uploaded."
        />
        <figure className="mt-14">
          <div className="relative rounded-[14px] bg-sunken p-2 sm:p-3">
            <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
              <picture>
                <source media="(max-width: 640px)" srcSet="/screens/workspace-mobile.jpg" width={780} height={1560} />
                <img
                  src="/screens/workspace.jpg"
                  width={2328}
                  height={1720}
                  loading="lazy"
                  decoding="async"
                  alt="FormPilot workspace. On the left, two uploaded documents with their processing status and extracted details. On the right, the profile shows a date of birth conflict between Resume.pdf and Degree_Certificate.pdf, followed by extracted details with their source documents and confidence."
                  className="block h-auto w-full"
                />
              </picture>
            </div>
            {NOTES.map((n, i) => (
              <span key={n.title} aria-hidden className="absolute hidden -translate-x-1/2 -translate-y-1/2 md:block" style={n.at}>
                <Marker n={i + 1} />
              </span>
            ))}
          </div>
          <figcaption className="mt-3 text-[13px] text-subtle">Screenshot of the FormPilot workspace with fictional sample documents.</figcaption>
        </figure>
        <ol className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-3">
          {NOTES.map((n, i) => (
            <li key={n.title} className="flex gap-4">
              <span className="hidden md:block">
                <Marker n={i + 1} />
              </span>
              <div>
                <h3 className="text-[17px] font-medium text-ink">{n.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{n.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
