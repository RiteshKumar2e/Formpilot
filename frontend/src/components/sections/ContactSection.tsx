import { Link } from 'react-router-dom'
import { CONTACT_EMAIL, GITHUB_URL, LINKEDIN_URL } from '../../config/site'
import { GitHubIcon, LinkedInIcon } from '../ui/Icons'
import { Container } from '../ui/primitives'

const display = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

export function ContactSection() {
  const links = [
    { label: 'Email', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, icon: null, external: false },
    { label: 'GitHub', value: display(GITHUB_URL), href: GITHUB_URL, icon: GitHubIcon, external: true },
    { label: 'LinkedIn', value: display(LINKEDIN_URL), href: LINKEDIN_URL, icon: LinkedInIcon, external: true },
  ]

  return (
    <section id="contact" aria-labelledby="cta-title" className="border-t border-line py-24 sm:py-28">
      <Container>
        {/* Call to action */}
        <div className="rounded-[14px] bg-accent px-6 py-14 text-center sm:px-12 sm:py-20">
          <h2 id="cta-title" className="display mx-auto max-w-[720px] text-[38px] text-white sm:text-[54px]">
            Build your profile once.
          </h2>
          <p className="mx-auto mt-5 max-w-[520px] text-[18px] leading-relaxed text-white/85">
            Start with your resume and one certificate. Your profile is ready as soon as they are processed.
          </p>
          <Link
            to="/get-started"
            className="mt-9 inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-control)] bg-white px-6 text-[16px] font-medium text-accent transition-colors hover:bg-white/90 focus-visible:outline-white sm:w-auto"
          >
            Create your profile
          </Link>
        </div>

        {/* Contact */}
        <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,2.3fr)] lg:gap-12">
          <div>
            <h3 className="heading text-[26px] text-ink">Questions or feedback?</h3>
            <p className="mt-2 text-[16px] text-muted">
              Reach out directly, or{' '}
              <Link to="/contact" className="text-accent underline underline-offset-2">
                send a message
              </Link>
              .
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {links.map(({ label, value, href, icon: Icon, external }) => (
              <li key={label}>
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="group block h-full rounded-[var(--radius-panel)] border border-line bg-surface p-4 transition-colors hover:border-ink/30"
                >
                  <span className="flex items-center gap-2 text-[13px] text-subtle">
                    {Icon && <Icon className="size-4 text-ink-2" />}
                    {label}
                  </span>
                  <span className="mt-1.5 block truncate text-[14px] text-ink group-hover:text-accent">{value}</span>
                  {external && <span className="sr-only">(opens in a new tab)</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}
