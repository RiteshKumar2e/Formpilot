import { Suspense, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { CookieConsent } from './CookieConsent'
import { Logo } from '../ui/Logo'
import { ArrowLeftIcon } from '../ui/Icons'
import { Container } from '../ui/primitives'

/** Scrolls to the hash target after navigation, or to the top on page change. */
function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      return
    }
    // Wait a frame so the target section has rendered after a route change.
    const frame = requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])

  return null
}

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
    >
      Skip to content
    </a>
  )
}

export function SiteLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      <Navbar />
      <main id="main" className="flex-1">
        <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <CookieConsent />
    </div>
  )
}

/** Sign-in and sign-up: no site navigation, just a way back home. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      <header className="relative">
        <SkipLink />
        <Container className="flex h-16 items-center gap-4">
          <Logo />
          <span aria-hidden className="h-6 w-px bg-line-strong" />
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-field px-3 text-[14px] font-medium text-ink hover:border-ink/40"
          >
            <ArrowLeftIcon className="size-4" />
            Back to home
          </Link>
        </Container>
      </header>
      <main id="main" className="flex-1">
        <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
      <CookieConsent />
    </div>
  )
}
