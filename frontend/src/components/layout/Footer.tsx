import { Link } from 'react-router-dom'
import { LogoMark } from '../ui/Logo'
import { Container } from '../ui/primitives'
import { CONTACT_EMAIL, GITHUB_URL, LINKEDIN_URL } from '../../config/site'
import { openConsentSettings } from '../../lib/analytics'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Product', to: '/#product' },
      { label: 'How It Works', to: '/how-it-works' },
      { label: 'Features', to: '/features' },
      { label: 'Security', to: '/security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
    ],
  },
]

const linkClass = 'text-[14px] text-muted hover:text-ink'

export function Footer() {
  return (
    <footer className="border-t border-line">
      <Container className="py-14">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="FormPilot home">
              <LogoMark />
              <span className="text-[17px] font-semibold tracking-[-0.02em]">FormPilot</span>
            </Link>
            <p className="mt-3 text-[14px] text-muted">One profile. Every application.</p>
            <ul className="mt-5 space-y-1.5">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  GitHub<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  LinkedIn<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-[14px] font-medium text-ink">{col.title}</h2>
                <ul className="mt-3 space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  {col.title === 'Legal' && (
                    <li>
                      <button type="button" onClick={openConsentSettings} className={linkClass}>
                        Cookie settings
                      </button>
                    </li>
                  )}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <p className="mt-12 border-t border-line pt-6 text-[13px] text-subtle">© 2026 FormPilot</p>
      </Container>
    </footer>
  )
}
