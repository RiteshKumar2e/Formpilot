/**
 * Consent-gated, privacy-friendly analytics (Plausible: cookie-free, no personal data).
 * Nothing loads unless VITE_PLAUSIBLE_DOMAIN is set AND the visitor accepts analytics.
 */

type PlausibleFn = ((event: string, options?: { u?: string }) => void) & { q?: unknown[] }

declare global {
  interface Window {
    plausible?: PlausibleFn
  }
}

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN
const SCRIPT_SRC = import.meta.env.VITE_PLAUSIBLE_SRC || 'https://plausible.io/js/script.manual.js'
const CONSENT_KEY = 'fp-consent'
export const CONSENT_EVENT = 'fp:open-consent'

export type Consent = 'accepted' | 'essential'

export const analyticsConfigured = Boolean(DOMAIN)

export function getConsent(): Consent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'accepted' || value === 'essential' ? value : null
  } catch {
    return null
  }
}

export function saveConsent(consent: Consent) {
  try {
    localStorage.setItem(CONSENT_KEY, consent)
  } catch {
    // Storage blocked: the choice applies to this visit only.
  }
  if (consent === 'accepted') loadAnalytics()
}

let loaded = false

export function loadAnalytics() {
  if (!DOMAIN || loaded || typeof document === 'undefined') return
  loaded = true
  window.plausible =
    window.plausible ||
    (function (this: unknown, ...args: unknown[]) {
      ;(window.plausible!.q = window.plausible!.q || []).push(args)
    } as PlausibleFn)
  const script = document.createElement('script')
  script.defer = true
  script.dataset.domain = DOMAIN
  script.src = SCRIPT_SRC
  document.head.appendChild(script)
}

export function trackPageview() {
  if (loaded) window.plausible?.('pageview', { u: window.location.origin + window.location.pathname })
}

/** Lets any "Cookie settings" link reopen the consent banner. */
export function openConsentSettings() {
  window.dispatchEvent(new Event(CONSENT_EVENT))
}
