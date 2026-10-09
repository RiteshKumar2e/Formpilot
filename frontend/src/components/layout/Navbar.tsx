import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from '../ui/Logo'
import { Button } from '../ui/Button'
import { CloseIcon, MenuIcon } from '../ui/Icons'
import { Container } from '../ui/primitives'
import { useAuth } from '../../hooks/useAuth'

export const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Features', to: '/features' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Team', to: '/team' },
  { label: 'Contact', to: '/contact' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()

  useEffect(() => setOpen(false), [location.pathname, location.hash])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // "Home" on the home page doesn't change the route, so scroll to the top ourselves.
  const onNavClick = (to: string) => {
    if (to === '/' && location.pathname === '/' && !location.hash) window.scrollTo({ top: 0 })
    setOpen(false)
  }

  const inApp = Boolean(user)
  const primary = inApp ? { to: '/dashboard', label: 'Open dashboard' } : { to: '/signup', label: 'Get Started' }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-sm">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-6">
        <Logo />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link to={link.to} onClick={() => onNavClick(link.to)} className="text-[15px] text-ink-2 hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          {!inApp && (
            <>
              <Link to="/login" className="text-[15px] text-ink-2 hover:text-ink">
                Sign In
              </Link>
            </>
          )}
          <Button to={primary.to} size="sm" variant={inApp ? 'primary' : 'highlight'}>
            {primary.label}
          </Button>
        </div>

        <button
          type="button"
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-ink lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </Container>

      <div id="mobile-nav" hidden={!open} className="border-t border-line bg-surface lg:hidden">
        <Container className="pb-6 pt-2">
          <nav aria-label="Mobile">
            <ul className="divide-y divide-line">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} onClick={() => onNavClick(link.to)} className="flex py-3.5 text-[17px] text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
              {!inApp && (
                <li>
                  <Link to="/login" className="flex py-3.5 text-[17px] text-ink">
                    Sign In
                  </Link>
                </li>
              )}
            </ul>
          </nav>
          <Button to={primary.to} className="mt-4 w-full" variant={inApp ? 'primary' : 'highlight'}>
            {primary.label}
          </Button>
        </Container>
      </div>
    </header>
  )
}
