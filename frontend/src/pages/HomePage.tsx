import { usePageMeta } from '../hooks/usePageMeta'
import { Hero } from '../components/sections/Hero'
import { Problem } from '../components/sections/Problem'
import { HowItWorks } from '../components/sections/HowItWorks'
import { Workspace } from '../components/sections/Workspace'
import { Features } from '../components/sections/Features'
import { Security } from '../components/sections/Security'
import { UseCases } from '../components/sections/UseCases'
import { ContactSection } from '../components/sections/ContactSection'

export function HomePage() {
  usePageMeta({ path: '/' })
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <Workspace />
      <Features />
      <Security />
      <UseCases />
      <ContactSection />
    </>
  )
}
