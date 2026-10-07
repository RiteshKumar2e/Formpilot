import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, FileText, ShieldCheck } from 'lucide-react'
import { cn } from '../../lib/utils'

type DocId = 'resume' | 'degree' | 'certificate'

const DOCS: { id: DocId; name: string; meta: string }[] = [
  { id: 'resume', name: 'Resume.pdf', meta: '2 pages' },
  { id: 'degree', name: 'Degree.pdf', meta: 'Verified' },
  { id: 'certificate', name: 'Certificate.pdf', meta: 'Verified' },
]

const NAMES: Record<DocId, string> = { resume: 'Resume.pdf', degree: 'Degree.pdf', certificate: 'Certificate.pdf' }

const FIELDS: { label: string; value: string; source: DocId; confidence: number }[] = [
  { label: 'Full Name', value: 'Ritesh Kumar', source: 'resume', confidence: 99 },
  { label: 'Email', value: 'ritesh@example.com', source: 'resume', confidence: 99 },
  { label: 'Highest Qualification', value: 'B.Tech Computer Science', source: 'degree', confidence: 98 },
  { label: 'Skills', value: 'Python, React, FastAPI, Machine Learning', source: 'resume', confidence: 96 },
  { label: 'Certifications', value: 'TensorFlow Developer Certificate', source: 'certificate', confidence: 97 },
]

/** Illustration of FormPilot filling an application form from three source documents. */
export function HeroVisual() {
  const reduce = useReducedMotion()
  const [filled, setFilled] = useState(reduce ? FIELDS.length : 0)
  const [active, setActive] = useState(reduce ? 2 : -1)

  useEffect(() => {
    if (reduce) return
    if (filled < FIELDS.length) {
      const t = setTimeout(() => {
        setActive(filled)
        setFilled((f) => f + 1)
      }, filled === 0 ? 700 : 650)
      return () => clearTimeout(t)
    }
    const t = setInterval(() => setActive((a) => (a + 1) % FIELDS.length), 2400)
    return () => clearInterval(t)
  }, [filled, reduce])

  const activeDoc = active >= 0 ? FIELDS[active].source : null
  const done = filled === FIELDS.length

  return (
    <figure aria-label="Illustration: FormPilot filling an application form from a resume, a degree and a certificate">
      <div aria-hidden>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {DOCS.map((d) => (
            <div
              key={d.id}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-[var(--radius-panel)] border bg-surface p-2 shadow-[var(--shadow-card)] transition-colors duration-300 sm:p-2.5',
                activeDoc === d.id ? 'border-accent' : 'border-line',
              )}
            >
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md transition-colors sm:size-8', activeDoc === d.id ? 'bg-accent text-white' : 'bg-sunken text-ink-2')}>
                <FileText className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-medium text-ink sm:text-[13px]">{d.name}</span>
                <span className="hidden text-[11px] text-subtle sm:block">{d.meta}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="grid h-7 grid-cols-3 gap-2 sm:h-9 sm:gap-3">
          {DOCS.map((d) => (
            <div key={d.id} className="flex justify-center">
              <span className={cn('h-full w-px transition-colors duration-300', activeDoc === d.id ? 'bg-accent' : 'bg-line-strong')} />
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-panel)]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Application form</p>
              <p className="truncate text-[15px] font-semibold text-ink">Software Engineer · Northwind Labs</p>
            </div>
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium', done ? 'border-success-line bg-success-soft text-success' : 'border-accent-line bg-accent-soft text-accent')}>
              {done ? `${FIELDS.length} of ${FIELDS.length} mapped` : 'Mapping…'}
            </span>
          </div>

          <ul className="space-y-2 p-3 sm:p-4">
            {FIELDS.map((f, i) => {
              const isFilled = i < filled
              const isActive = i === active
              return (
                <li
                  key={f.label}
                  className={cn(
                    'rounded-[var(--radius-control)] border px-3 py-2.5 transition-colors duration-300',
                    isActive ? 'border-accent bg-accent-soft/40' : 'border-line',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-ink-2">{f.label}</span>
                    {isFilled && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                        <CheckCircle2 className="size-3" />
                        Mapped
                      </span>
                    )}
                  </div>
                  {isFilled ? (
                    <motion.div initial={reduce ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                      <p className="mt-1 truncate text-[14px] text-ink">{f.value}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-subtle">
                        {NAMES[f.source]} · {f.confidence}%
                      </p>
                    </motion.div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      <div className="skeleton h-3 w-2/5" />
                      <div className="skeleton h-2.5 w-1/4" />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="flex items-center gap-2 border-t border-line bg-canvas px-4 py-2.5 text-[12px] text-muted sm:px-5">
            <ShieldCheck className="size-3.5 text-success" />
            You review and approve before anything is submitted
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-[13px] text-subtle">Illustration with sample data.</figcaption>
    </figure>
  )
}
