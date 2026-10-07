import { usePageMeta } from '../hooks/usePageMeta'
import { Container } from '../components/ui/primitives'
import { HowItWorks } from '../components/sections/HowItWorks'
import { SemanticMapping } from '../components/sections/SemanticMapping'
import { ValidationPreview } from '../components/sections/ValidationPreview'
import { Features } from '../components/sections/Features'
import { Security } from '../components/sections/Security'
import { FinalCTA } from '../components/sections/FinalCTA'

const PAGES = {
  'how-it-works': {
    title: 'How It Works',
    heading: 'From your documents to a ready application.',
    intro: 'Upload once, build a reusable profile, map every form field by meaning, resolve what doesn’t add up, and approve.',
    description: 'How FormPilot extracts your information, maps it to application fields and validates it before you approve.',
    body: (
      <>
        <HowItWorks />
        <SemanticMapping />
        <ValidationPreview />
      </>
    ),
  },
  features: {
    title: 'Features',
    heading: 'Everything you need to apply with confidence.',
    intro: 'Extraction, semantic mapping, conflict detection and human approval in one workspace.',
    description: 'FormPilot features: document extraction, semantic field mapping, conflict detection, reusable profile and human approval.',
    body: (
      <>
        <Features />
        <SemanticMapping />
      </>
    ),
  },
  security: {
    title: 'Security',
    heading: 'Your information deserves serious protection.',
    intro: 'Applications carry your identity, education and history. Here is how FormPilot protects them today.',
    description: 'How FormPilot protects your documents: encryption at rest, HTTPS, secure sessions, account isolation and real deletion.',
    body: <Security />,
  },
} as const

export function MarketingPage({ page }: { page: keyof typeof PAGES }) {
  const p = PAGES[page]
  usePageMeta({ title: p.title, path: `/${page}`, description: p.description })
  return (
    <>
      <Container className="pt-16 pb-6 sm:pt-20">
        <p className="eyebrow">{p.title}</p>
        <h1 className="display mt-3 max-w-[780px] text-[40px] text-ink sm:text-[54px]">{p.heading}</h1>
        <p className="mt-5 max-w-[620px] text-[18px] leading-relaxed text-muted">{p.intro}</p>
      </Container>
      {p.body}
      <FinalCTA />
    </>
  )
}
