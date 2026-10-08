import { BadgeCheck, BookmarkCheck, ClipboardList, FileText, MessageSquareText, UserRound } from 'lucide-react'
import { Container, Section, SectionHeader } from '../ui/primitives'

const VAULT = [
  { icon: UserRound, title: 'Master Profile', body: 'Personal, contact, education, work experience, skills, projects, achievements, certifications, links and addresses.' },
  { icon: FileText, title: 'Documents', body: 'The resumes and certificates every detail was read from, encrypted at rest.' },
  { icon: ClipboardList, title: 'Saved Applications', body: 'Every application you prepared, with the answers you approved.' },
  { icon: BookmarkCheck, title: 'Application Templates', body: 'Completed applications saved for reuse on similar forms.' },
  { icon: MessageSquareText, title: 'Common Answers', body: '“Why this company?”, work authorization, relocation preference. Answer once.' },
]

const PROFILE_SAMPLE = [
  { field: 'University', value: 'Arka Jain University', source: 'Degree_Certificate.pdf', status: 'Verified', updated: '2 days ago', confidence: 97 },
  { field: 'Skills', value: 'Python, React, FastAPI', source: 'Resume.pdf', status: 'Verified', updated: '2 days ago', confidence: 94 },
  { field: 'Projects', value: 'FormPilot, Plant disease detector', source: 'Resume.pdf', status: 'Check this', updated: '2 days ago', confidence: 75 },
]

export function BuildOnce() {
  return (
    <Section id="vault" labelledBy="vault-title" className="border-t border-line">
      <Container>
        <SectionHeader
          id="vault-title"
          eyebrow="Your reusable application profile"
          title={
            <>
              Build once. Verify once.
              <br />
              Reuse everywhere.
            </>
          }
          description="FormPilot is not another form filler. It is an application identity you own: one Master Profile, where every detail shows its source, whether it’s verified, when it last changed and how confident FormPilot is."
        />

        <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <figure>
            <div className="rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-card)]">
              <p className="border-b border-line px-5 py-3 text-[13px] font-semibold text-ink">Master Profile</p>
              <ul className="divide-y divide-line">
                {PROFILE_SAMPLE.map((r) => (
                  <li key={r.field} className="px-5 py-4">
                    <p className="text-[12px] text-subtle">{r.field}</p>
                    <p className="mt-0.5 text-[16px] text-ink">{r.value}</p>
                    <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                      <div className="flex items-center gap-1">
                        <dt className="text-subtle">Source</dt>
                        <dd className="font-mono text-ink-2">{r.source}</dd>
                      </div>
                      <div className="flex items-center gap-1">
                        <dt className="sr-only">Status</dt>
                        <dd className={r.status === 'Verified' ? 'flex items-center gap-1 font-medium text-success' : 'font-medium text-warning'}>
                          {r.status === 'Verified' && <BadgeCheck className="size-3.5" aria-hidden />}
                          {r.status}
                        </dd>
                      </div>
                      <div className="flex items-center gap-1">
                        <dt className="text-subtle">Updated</dt>
                        <dd className="text-ink-2">{r.updated}</dd>
                      </div>
                      <div className="flex items-center gap-1">
                        <dt className="text-subtle">Confidence</dt>
                        <dd className="font-mono text-ink-2">{r.confidence}%</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
            <figcaption className="mt-2.5 text-[13px] text-subtle">Illustration with sample data.</figcaption>
          </figure>

          <div>
            <h3 className="text-[18px] font-semibold text-ink">The Application Vault</h3>
            <ul className="mt-4 space-y-4">
              {VAULT.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-ink">{title}</span>
                    <span className="block text-[14px] text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-[var(--radius-panel)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <p className="text-[13px] text-subtle">Template</p>
              <p className="mt-0.5 text-[16px] font-semibold text-ink">“Software Engineer Application”</p>
              <dl className="mt-3 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-y-1.5 text-[13px]">
                <dt className="text-subtle">Fields completed</dt>
                <dd className="text-ink">18/18</dd>
                <dt className="text-subtle">Documents</dt>
                <dd className="font-mono text-[12px] text-ink-2">Resume.pdf, Degree.pdf</dd>
                <dt className="text-subtle">Common answers</dt>
                <dd className="text-ink-2">Why this company? · Work authorization · Relocation preference</dd>
              </dl>
              <p className="mt-4 rounded-[var(--radius-control)] bg-panel px-3 py-2 text-[13px] text-ink">
                Next time a similar form appears: <strong>“Reuse your Software Engineer template?”</strong> You still review what’s specific to the new
                application.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
