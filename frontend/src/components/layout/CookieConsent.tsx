import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { analyticsConfigured, CONSENT_EVENT, getConsent, loadAnalytics, saveConsent, trackPageview, type Consent } from '../../lib/analytics'
import { Button } from '../ui/Button'

export function CookieConsent() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const consent = getConsent()
    if (consent === 'accepted') loadAnalytics()
    else if (consent === null) setOpen(true)

    const reopen = () => setOpen(true)
    window.addEventListener(CONSENT_EVENT, reopen)
    return () => window.removeEventListener(CONSENT_EVENT, reopen)
  }, [])

  // Page views are sent only after consent (trackPageview is a no-op otherwise).
  useEffect(() => {
    trackPageview()
  }, [location.pathname])

  const choose = (consent: Consent) => {
    saveConsent(consent)
    if (consent === 'accepted') trackPageview()
    setOpen(false)
  }

  if (!open) return null

  return (
    <section
      aria-label="Cookie preferences"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-[540px] rounded-[var(--radius-panel)] border border-line-strong bg-surface p-5 shadow-[var(--shadow-panel)] sm:inset-x-6"
    >
      <h2 className="text-[15px] font-medium text-ink">Cookies on FormPilot</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
        We use one essential cookie to keep you signed in.
        {analyticsConfigured
          ? ' With your OK, we’ll also count page visits using privacy-friendly analytics that don’t use cookies or track you across sites.'
          : ' We don’t use advertising or tracking cookies.'}{' '}
        <Link to="/privacy" className="text-accent underline underline-offset-2">
          Privacy Policy
        </Link>
      </p>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {analyticsConfigured ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => choose('essential')}>
              Essential only
            </Button>
            <Button size="sm" onClick={() => choose('accepted')}>
              Accept analytics
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => choose('essential')}>
            Got it
          </Button>
        )}
      </div>
    </section>
  )
}
