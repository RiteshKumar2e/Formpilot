import { usePageMeta } from '../hooks/usePageMeta'
import { Hero } from '../components/sections/Hero'
import { Problem } from '../components/sections/Problem'
import { HowItWorks } from '../components/sections/HowItWorks'
import { ProductPreview } from '../components/sections/ProductPreview'
import { SemanticMapping } from '../components/sections/SemanticMapping'
import { ValidationPreview } from '../components/sections/ValidationPreview'
import { UseCases } from '../components/sections/UseCases'
import { Security } from '../components/sections/Security'
import { FinalCTA } from '../components/sections/FinalCTA'

export function HomePage() {
  usePageMeta({ path: '/' })
  return (
    <>
      <Hero />
      <Problem />
      <HowItWorks />
      <ProductPreview />
      <SemanticMapping />
      <ValidationPreview />
      <UseCases />
      <Security />
      <FinalCTA />
    </>
  )
}
