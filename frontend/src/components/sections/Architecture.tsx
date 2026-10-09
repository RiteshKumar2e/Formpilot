import type { ReactNode } from 'react'
import { ArrowDown } from 'lucide-react'
import { Container, Section, SectionHeader } from '../ui/primitives'

function Node({ title, note, tone = 'plain' }: { title: string; note?: string; tone?: 'plain' | 'accent' | 'highlight' }) {
  const styles = {
    plain: 'border-line bg-surface',
    accent: 'border-accent bg-accent text-white',
    highlight: 'border-warning-line bg-warning-soft',
  }[tone]
  return (
    <div className={`rounded-[var(--radius-control)] border px-4 py-2.5 text-center shadow-[var(--shadow-card)] ${styles}`}>
      <p className={`text-[14px] font-semibold ${tone === 'accent' ? 'text-white' : 'text-ink'}`}>{title}</p>
      {note && <p className={`text-[12px] ${tone === 'accent' ? 'text-white/75' : 'text-subtle'}`}>{note}</p>}
    </div>
  )
}

function Down() {
  return <ArrowDown className="mx-auto my-1.5 size-4 text-line-strong" aria-hidden />
}

function Stack({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[420px]">{children}</div>
}

/** The production architecture, from the Master Profile to a form on another website. */
export function Architecture() {
  return (
    <Section id="architecture" labelledBy="architecture-title" className="border-t border-line bg-band">
      <Container>
        <SectionHeader
          id="architecture-title"
          eyebrow="Technical architecture"
          title="One profile in. Any form out."
          description="Everything FormPilot knows lives in your Master Profile. Retrieval and semantic mapping turn it into answers, the FormPilot API serves them, and the browser extension carries them to other websites, always through your review."
          align="center"
        />
        <figure className="mt-14" aria-label="FormPilot architecture diagram">
          <Stack>
            <Node title="FormPilot" tone="accent" />
            <Down />
            <Node title="Master Application Profile" note="Verified details with source, status and confidence" />
            <Down />
          </Stack>
          <div className="mx-auto grid max-w-[640px] grid-cols-3 gap-3">
            <Node title="Documents" note="Encrypted files" />
            <Node title="Profile" note="Merged and verified" />
            <Node title="Templates" note="Answers to reuse" />
          </div>
          <Stack>
            <Down />
            <Node title="RAG / Vector DB" note="Qdrant vector database, passage retrieval" />
            <Down />
            <Node title="Semantic Mapping" note="Wording + meaning, LLM answers checked against sources" />
            <Down />
            <Node title="FormPilot API" note="POST /api/autofill/suggest" />
            <Down />
            <Node title="Browser Extension" note="Detects fields on the page" />
            <Down />
            <Node title="External Web Applications" note="Job portals, scholarships, admissions" />
            <Down />
            <Node title="User Review" note="Uncertain values flagged, AI answers are suggestions" tone="highlight" />
            <Down />
            <Node title="Fill Form" note="Never submitted for you" />
          </Stack>
          <figcaption className="mt-6 text-center text-[13px] text-subtle">
            The Chrome/Edge extension (Manifest V3) is the integration layer for any website. The in-app CareerHub demo runs the same detection and fill code on a simulated portal.
          </figcaption>
        </figure>
      </Container>
    </Section>
  )
}
