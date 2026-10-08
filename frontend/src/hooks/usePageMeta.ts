import { useEffect } from 'react'

export const SITE_URL = 'https://formpilot.app'
const DEFAULT_TITLE = 'FormPilot — One Profile. Every Application.'
const DEFAULT_DESCRIPTION =
  'Your reusable application profile for the web. Build it once, verify it once, and fill forms on any website, with your review before anything is filled.'

function setMeta(selector: string, value: string) {
  document.querySelector(selector)?.setAttribute('content', value)
}

/** Sets the title, description, canonical URL and social preview text for the current route. */
export function usePageMeta({ title, description, path }: { title?: string; description?: string; path: string }) {
  useEffect(() => {
    const fullTitle = title ? `${title} · FormPilot` : DEFAULT_TITLE
    const text = description ?? DEFAULT_DESCRIPTION
    const url = `${SITE_URL}${path}`
    document.title = fullTitle
    setMeta('meta[name="description"]', text)
    setMeta('meta[property="og:title"]', fullTitle)
    setMeta('meta[property="og:description"]', text)
    setMeta('meta[property="og:url"]', url)
    setMeta('meta[name="twitter:title"]', fullTitle)
    setMeta('meta[name="twitter:description"]', text)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
  }, [title, description, path])
}
