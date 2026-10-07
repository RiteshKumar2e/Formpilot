import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Container, Section, SectionHeader } from '../ui/primitives'
import { useWorkspace } from '../../product/workspace'

const VIEWS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    src: '/screens/dashboard.jpg',
    mobile: '/screens/dashboard-mobile.jpg',
    size: [2560, 1600],
    alt: 'FormPilot dashboard with profile completion, documents, applications needing review, recent applications and activity.',
    note: 'Profile completion, documents and every application at a glance.',
  },
  {
    id: 'workspace',
    label: 'Application workspace',
    src: '/screens/workspace.jpg',
    mobile: '/screens/workspace-mobile.jpg',
    size: [2560, 1600],
    alt: 'FormPilot application workspace: application structure on the left, mapped form fields in the center, and the assistant panel showing the source, confidence and reasoning for the selected field.',
    note: 'Every field with its status. Select one to see its source, confidence and why it matched.',
  },
] as const

export function ProductPreview() {
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('workspace')
  const { startDemo } = useWorkspace()
  const navigate = useNavigate()
  const current = VIEWS.find((v) => v.id === view)!

  return (
    <Section id="product" labelledBy="product-title" className="border-t border-line">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            id="product-title"
            eyebrow="The product"
            title="One profile. Every application."
            description="These are real screenshots of FormPilot running in Demo Mode with a fictional applicant."
          />
          <Button
            variant="secondary"
            onClick={() => {
              startDemo()
              navigate('/dashboard')
            }}
          >
            <FlaskConical className="size-4" aria-hidden />
            Open it yourself
          </Button>
        </div>

        <div role="tablist" aria-label="Product screens" className="mt-10 inline-flex rounded-[var(--radius-control)] border border-line bg-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              id={`tab-${v.id}`}
              aria-selected={view === v.id}
              aria-controls={`panel-${v.id}`}
              onClick={() => setView(v.id)}
              className={cn('rounded-[6px] px-3.5 py-1.5 text-[14px] transition-colors', view === v.id ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink')}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div id={`panel-${current.id}`} role="tabpanel" aria-labelledby={`tab-${current.id}`} className="mt-5">
          <figure>
            <div className="rounded-[14px] bg-sunken p-2 sm:p-3">
              <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-panel)]">
                <picture>
                  <source media="(max-width: 640px)" srcSet={current.mobile} width={780} height={1560} />
                  <img src={current.src} width={current.size[0]} height={current.size[1]} loading="lazy" decoding="async" alt={current.alt} className="block h-auto w-full" />
                </picture>
              </div>
            </div>
            <figcaption className="mt-3 text-[14px] text-muted">{current.note}</figcaption>
          </figure>
        </div>
      </Container>
    </Section>
  )
}
