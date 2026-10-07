import { Suspense } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, FileText, ShieldCheck } from 'lucide-react'
import { LogoMark } from '../ui/Logo'
import { CookieConsent } from './CookieConsent'
import { ScrollManager, SkipLink } from './SiteLayout'

const SIGN_IN_POINTS = [
  'Your profile is ready the moment you sign in',
  'Every answer shows the document it came from',
  'Nothing is submitted without your approval',
]

const SIGN_UP_STEPS = [
  { title: 'Create your account', body: 'Your profile is private to you.' },
  { title: 'Upload your documents', body: 'Resume, certificates, transcripts and IDs.' },
  { title: 'Fill applications', body: 'Review every answer and approve when you’re ready.' },
]

function BackHome({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link
      to="/"
      className={
        onDark
          ? 'inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-white/25 px-3 text-[14px] font-medium text-white hover:bg-white/10 focus-visible:outline-white'
          : 'inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px] font-medium text-ink hover:border-accent'
      }
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to home
    </Link>
  )
}

/** A small, real-looking slice of the product for the brand panel. */
function ProductSnippet() {
  return (
    <figure aria-label="Example: a form field answered from a degree certificate" className="rounded-[10px] bg-white p-5 text-ink shadow-[0_24px_48px_-24px_rgb(0_0_0_/_0.55)]">
      <div aria-hidden>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-medium tracking-[0.06em] text-subtle uppercase">Application form</p>
          <span className="inline-flex items-center gap-1 rounded-full border border-success-line bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
            <Check className="size-3" />
            Mapped
          </span>
        </div>
        <p className="mt-3 text-[13px] text-muted">Highest Qualification</p>
        <p className="mt-0.5 text-[16px] font-medium text-ink">B.Tech in Computer Science</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink-2">
            <FileText className="size-3 shrink-0" />
            <span className="truncate">Degree_Certificate.pdf</span>
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
            <div className="h-full w-[98%] rounded-full bg-success" />
          </div>
          <span className="font-mono text-[11px] text-ink-2">98%</span>
        </div>
      </div>
    </figure>
  )
}

/** Sign-in and sign-up: brand panel on the left, focused form on the right. */
export function AuthLayout() {
  const { pathname } = useLocation()
  const signUp = pathname.startsWith('/signup')

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ScrollManager />

      {/* Brand panel (desktop) */}
      <aside className="relative hidden flex-col overflow-hidden bg-accent px-10 py-8 text-white lg:flex xl:px-14">
        <div className="flex items-center gap-4">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="FormPilot home">
            <LogoMark inverted />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">FormPilot</span>
          </Link>
          <span aria-hidden className="h-6 w-px bg-white/25" />
          <BackHome onDark />
        </div>

        <div className="flex flex-1 items-center py-12">
          <div className="max-w-[460px]">
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-highlight">
              <span aria-hidden className="h-0.5 w-6 bg-highlight" />
              One profile. Every application.
            </p>
            <h2 className="mt-4 text-[36px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance xl:text-[42px]">
              {signUp ? 'Set up once. Apply anywhere.' : 'Fill every application from documents you already have.'}
            </h2>

            {signUp ? (
              <ol className="mt-8 space-y-5">
                {SIGN_UP_STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-4">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight font-mono text-[13px] font-semibold text-ink">{i + 1}</span>
                    <div>
                      <p className="text-[16px] font-medium">{s.title}</p>
                      <p className="mt-0.5 text-[15px] text-white/70">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="mt-8 space-y-3.5">
                {SIGN_IN_POINTS.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-[16px] text-white/90">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-highlight text-ink">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-10">
              <ProductSnippet />
            </div>
          </div>
        </div>

        <p className="flex items-center gap-2 text-[13px] text-white/60">
          <ShieldCheck className="size-4 text-highlight" aria-hidden />
          Files are encrypted at rest. Your data is never sold.
        </p>
      </aside>

      {/* Form side */}
      <div className="flex min-h-dvh flex-col">
        <SkipLink />
        <header className="flex h-16 items-center gap-4 px-4 sm:px-8 lg:hidden">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="FormPilot home">
            <LogoMark />
            <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">FormPilot</span>
          </Link>
          <span aria-hidden className="h-6 w-px bg-line-strong" />
          <BackHome />
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:py-16">
          <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
            <Outlet />
          </Suspense>
        </main>

        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 pb-6 text-[13px] text-subtle">
          <span>© 2026 FormPilot</span>
          <Link to="/privacy" className="hover:text-ink">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-ink">
            Terms of Service
          </Link>
          <Link to="/contact" className="hover:text-ink">
            Contact
          </Link>
        </footer>
      </div>

      <CookieConsent />
    </div>
  )
}
