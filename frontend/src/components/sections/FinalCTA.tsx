import { Link } from 'react-router-dom'
import { CONTACT_EMAIL, GITHUB_URL, LINKEDIN_URL } from '../../config/site'
import { Container } from '../ui/primitives'

export function FinalCTA() {
  return (
    <section id="contact" aria-labelledby="cta-title" className="border-t border-line py-24 sm:py-28">
      <Container>
        <div className="rounded-[14px] bg-accent px-6 py-14 text-center sm:px-12 sm:py-20">
          <h2 id="cta-title" className="display mx-auto max-w-[760px] text-[36px] text-white sm:text-[50px]">
            Stop filling the same information again.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[18px] leading-relaxed text-white/85">
            Build your profile once. Let FormPilot handle the repetition.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex h-12 items-center justify-center rounded-[var(--radius-control)] bg-white px-6 text-[16px] font-medium text-accent hover:bg-white/90 focus-visible:outline-white"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center rounded-[var(--radius-control)] border border-white/40 px-6 text-[16px] font-medium text-white hover:bg-white/10 focus-visible:outline-white"
            >
              Sign In
            </Link>
          </div>
          <Link to="/how-it-works" className="mt-6 inline-block text-[15px] text-white/85 underline underline-offset-4 hover:text-white">
            Explore How It Works
          </Link>
        </div>

        <div className="mt-12 flex flex-col gap-4 text-[15px] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink">Questions or feedback?</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-muted">
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-accent">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                GitHub<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                LinkedIn<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </div>
      </Container>
    </section>
  )
}
