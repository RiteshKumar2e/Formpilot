import { Button } from '../ui/Button'
import { Container } from '../ui/primitives'

const FACTS = ['Files encrypted at rest', 'A source for every answer', 'Never submits for you']

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden pt-12 pb-20 sm:pt-16 lg:pt-20 lg:pb-28">
      <Container className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
        <div>
          <p className="eyebrow">Application autofill from your own documents</p>
          <h1 id="hero-title" className="display mt-4 text-[44px] text-ink sm:text-[58px] lg:text-[48px] xl:text-[56px]">
            One profile.
            <br />
            Every application.
          </h1>
          <p className="mt-6 max-w-[520px] text-[18px] leading-relaxed text-muted text-pretty">
            Upload your resume and certificates once. FormPilot builds a verified profile from them, answers each form field,
            and shows which document every answer came from.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
            <Button to="/get-started" size="lg">
              Create your profile
            </Button>
            <Button to="/#how-it-works" variant="quiet">
              See how it works
            </Button>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-[14px] text-ink-2">
            {FACTS.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <figure className="rounded-[14px] bg-sunken p-2 sm:p-3">
          <div className="mx-auto max-w-[560px] overflow-hidden rounded-[var(--radius-panel)] shadow-[var(--shadow-panel)]">
            <picture>
              <source media="(max-width: 640px)" srcSet="/screens/answers-mobile.jpg" width={716} height={1280} />
              <img
                src="/screens/answers.jpg"
                width={1144}
                height={1384}
                fetchPriority="high"
                decoding="async"
                alt="FormPilot answering five application form fields. Each answer, such as Ritesh Kumar for Name of applicant, lists the documents it came from and a confidence score."
                className="block h-auto w-full"
              />
            </picture>
          </div>
          <figcaption className="mx-auto max-w-[560px] px-1 pt-2.5 text-[13px] text-subtle">
            FormPilot filling a form from two sample documents. The person and documents are fictional.
          </figcaption>
        </figure>
      </Container>
    </section>
  )
}
