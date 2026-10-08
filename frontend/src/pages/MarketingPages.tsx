import { usePageMeta } from '../hooks/usePageMeta'
import { Container } from '../components/ui/primitives'
import { HowItWorks } from '../components/sections/HowItWorks'
import { SemanticMapping } from '../components/sections/SemanticMapping'
import { ValidationPreview } from '../components/sections/ValidationPreview'
import { Features } from '../components/sections/Features'
import { Security } from '../components/sections/Security'
import { FinalCTA } from '../components/sections/FinalCTA'
import { UseAnywhere } from '../components/sections/UseAnywhere'
import { BuildOnce } from '../components/sections/BuildOnce'
import { SmartAnswers } from '../components/sections/SmartAnswers'
import { Architecture } from '../components/sections/Architecture'

const PAGES = {
  'how-it-works': {
    title: 'How It Works',
    heading: 'From your documents to any application.',
    intro: 'Build your verified profile once. FormPilot maps it to every form by meaning, on FormPilot or any website, flags what doesn’t add up, and waits for your approval.',
    description: 'How FormPilot builds a verified profile, maps it to application fields on any website, and validates it before you approve.',
    body: (
      <>
        <HowItWorks />
        <Architecture />
        <SemanticMapping />
        <ValidationPreview />
      </>
    ),
  },
  features: {
    title: 'Features',
    heading: 'One verified profile for every application.',
    intro: 'A Master Profile and Application Vault you own, the FormPilot extension for other websites, Smart Answers, templates, conflict detection and human approval.',
    description: 'FormPilot features: Master Profile, Application Vault, browser extension, Smart Answers, templates, semantic mapping and human approval.',
    body: (
      <>
        <BuildOnce />
        <UseAnywhere />
        <SmartAnswers />
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
