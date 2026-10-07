import { useNavigate } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { Button } from '../ui/Button'
import { Container } from '../ui/primitives'
import { HeroVisual } from '../product/HeroVisual'
import { useWorkspace } from '../../product/workspace'

export function Hero() {
  const { startDemo } = useWorkspace()
  const navigate = useNavigate()

  return (
    <section aria-labelledby="hero-title" className="overflow-hidden pt-12 pb-20 sm:pt-16 lg:pt-20 lg:pb-28">
      <Container className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <p className="eyebrow">Application automation</p>
          <h1 id="hero-title" className="display mt-4 text-[44px] text-ink sm:text-[58px] lg:text-[46px] xl:text-[54px]">
            Your information.
            <br />
            <span className="text-muted">Ready when you are.</span>
          </h1>
          <p className="mt-6 max-w-[540px] text-[18px] leading-relaxed text-muted text-pretty">
            Store your information once and reuse it across applications. FormPilot understands your documents, maps the
            right data to every field, and keeps you in control before submission.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button to="/signup" size="lg">
              Get Started
            </Button>
            <Button to="/how-it-works" variant="secondary" size="lg">
              See How It Works
            </Button>
          </div>
          <button
            type="button"
            onClick={() => {
              startDemo()
              navigate('/dashboard')
            }}
            className="mt-5 inline-flex items-center gap-2 text-left text-[15px] font-medium text-accent hover:underline"
          >
            <FlaskConical className="size-4 shrink-0" aria-hidden />
            Start Product Demo: explore with a sample profile, no account needed
          </button>
        </div>
        <HeroVisual />
      </Container>
    </section>
  )
}
