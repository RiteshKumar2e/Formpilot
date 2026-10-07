import { motion } from 'framer-motion'
import { ArrowDown, ArrowRight, FileText } from 'lucide-react'
import { Container, Section, SectionHeader } from '../ui/primitives'

const EXAMPLE = {
  field: 'Highest Educational Qualification',
  value: 'B.Tech Computer Science',
  source: 'Degree_Certificate.pdf',
  confidence: 98,
}

const ROWS = [
  { field: 'Full Name', value: 'Ritesh Kumar', source: 'Resume.pdf', confidence: 99 },
  { field: 'University', value: 'Northfield Institute of Technology', source: 'Degree.pdf', confidence: 97 },
  { field: 'Skills', value: 'Python, React, FastAPI, TensorFlow', source: 'Resume.pdf', confidence: 96 },
  { field: 'Experience', value: 'Research Intern, Machine Vision Lab', source: 'Experience_Letter.pdf', confidence: 94 },
]

const STAGES = [
  { label: 'Understand', note: 'What is this field asking for?' },
  { label: 'Retrieve', note: 'Search your verified documents (RAG)' },
  { label: 'Match by meaning', note: 'Compare embeddings, not keywords' },
  { label: 'Score', note: 'Confidence and source for every answer' },
]

function Bar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
        <motion.div
          className="h-full rounded-full bg-success"
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="w-9 text-right font-mono text-[12px] text-ink-2">{value}%</span>
    </div>
  )
}

export function SemanticMapping() {
  return (
    <Section id="mapping" labelledBy="mapping-title" className="border-t border-line">
      <Container>
        <SectionHeader
          id="mapping-title"
          eyebrow="Semantic field mapping"
          title="FormPilot understands meaning, not just text."
          description="Forms ask for the same thing in different words. FormPilot retrieves the right fact from your documents and shows exactly where it came from."
        />

        <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* One worked example */}
          <div className="rounded-[var(--radius-panel)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
            <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Application field</p>
            <p className="mt-1 text-[18px] font-medium text-ink">“{EXAMPLE.field}”</p>
            <ArrowDown className="my-3 size-5 text-subtle" aria-hidden />
            <p className="text-[11px] font-medium tracking-[0.06em] text-accent uppercase">FormPilot match</p>
            <p className="mt-1 text-[18px] text-ink">{EXAMPLE.value}</p>
            <ArrowDown className="my-3 size-5 text-subtle" aria-hidden />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Source</p>
                <p className="mt-1 flex items-center gap-1.5 font-mono text-[13px] text-ink-2">
                  <FileText className="size-3.5" aria-hidden />
                  {EXAMPLE.source}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Confidence</p>
                <div className="mt-1.5">
                  <Bar value={EXAMPLE.confidence} />
                </div>
              </div>
            </div>
            <ol className="mt-6 grid gap-2 border-t border-line pt-5 sm:grid-cols-2">
              {STAGES.map((s, i) => (
                <li key={s.label} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] text-accent">{i + 1}</span>
                  <span>
                    <span className="block text-[13px] font-medium text-ink">{s.label}</span>
                    <span className="block text-[12px] text-subtle">{s.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Several fields at a glance */}
          <div className="rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-card)]">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px] gap-3 border-b border-line px-5 py-3 text-[12px] font-medium text-subtle">
              <span>Field → match</span>
              <span>Source</span>
              <span>Confidence</span>
            </div>
            <ul className="divide-y divide-line">
              {ROWS.map((r) => (
                <li key={r.field} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px] items-center gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
                      {r.field}
                      <ArrowRight className="size-3.5 text-subtle" aria-hidden />
                    </p>
                    <p className="truncate text-[13px] text-muted">{r.value}</p>
                  </div>
                  <p className="truncate font-mono text-[12px] text-ink-2">{r.source}</p>
                  <Bar value={r.confidence} />
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-[12px] text-subtle">Illustration with sample data.</p>
          </div>
        </div>
      </Container>
    </Section>
  )
}
