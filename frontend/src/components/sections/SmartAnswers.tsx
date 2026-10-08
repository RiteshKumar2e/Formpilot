import { FileText, MessageSquareText, Pencil, RefreshCw, Sparkles, UserRound } from 'lucide-react'
import { Container, Section, SectionHeader } from '../ui/primitives'

const SOURCES = [
  { icon: UserRound, label: 'Your Master Profile' },
  { icon: UserRound, label: 'Experience and projects' },
  { icon: FileText, label: 'Your resume and documents' },
  { icon: MessageSquareText, label: 'Answers you saved before' },
]

export function SmartAnswers() {
  return (
    <Section id="smart-answers" labelledBy="smart-answers-title" className="border-t border-line">
      <Container>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <SectionHeader
              id="smart-answers-title"
              eyebrow="Smart Answers"
              title="Open questions, answered from what’s true about you."
              description="When a form asks “Why are you interested in this role?”, FormPilot retrieves the relevant facts from your own records and drafts a suggestion. It never invents experience, and it never uses an answer you haven’t approved."
            />
            <ul className="mt-8 space-y-3">
              {SOURCES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-[15px] text-ink">
                  <span className="flex size-8 items-center justify-center rounded-[var(--radius-control)] bg-accent-soft text-accent">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <figure>
            <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
              <p className="text-[13px] text-subtle">Form question</p>
              <p className="mt-1 text-[17px] font-medium text-ink">“Why are you interested in this role?”</p>
              <div className="mt-5 rounded-[var(--radius-panel)] border border-accent-line bg-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
                    <Sparkles className="size-4" aria-hidden />
                    Suggested Answer
                  </p>
                  <span className="rounded-full border border-warning-line bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">Review before using</span>
                </div>
                <p className="mt-3 text-[14px] leading-relaxed text-ink">
                  “I am interested in this opportunity because it builds directly on my research internship in machine vision, where I trained and
                  deployed image models in Python. My FormPilot project taught me to ship end-to-end products with React and FastAPI, and I’d like to
                  bring both to your team.”
                </p>
                <p className="mt-3 text-[12px] font-medium text-subtle">Source context</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5 text-[12px]">
                  {['Research Experience', 'Project Experience', 'Skills'].map((s) => (
                    <li key={s} className="rounded-md border border-line bg-surface px-2 py-0.5 text-ink-2">
                      {s}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                  <span className="inline-flex h-8 items-center rounded-[var(--radius-control)] bg-accent px-3 font-medium text-white">Use Answer</span>
                  <span className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-control)] border border-accent-line bg-surface px-3 text-accent">
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </span>
                  <span className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-control)] border border-accent-line bg-surface px-3 text-accent">
                    <RefreshCw className="size-3.5" aria-hidden />
                    Regenerate
                  </span>
                </div>
              </div>
            </div>
            <figcaption className="mt-2.5 text-[13px] text-subtle">AI-generated answers are always suggestions. Illustration with sample data.</figcaption>
          </figure>
        </div>
      </Container>
    </Section>
  )
}
