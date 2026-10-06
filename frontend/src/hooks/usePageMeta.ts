import { useEffect } from 'react'

export const SITE_URL = 'https://formpilot.app'
const DEFAULT_TITLE = 'FormPilot: One profile. Every application.'
const DEFAULT_DESCRIPTION =
  'FormPilot turns your resume and certificates into a verified profile, then answers application form fields from it and shows the source of every answer.'

/** Sets the document title, description and canonical URL for the current route. */
export function usePageMeta({ title, description, path }: { title?: string; description?: string; path: string }) {
  useEffect(() => {
    document.title = title ? `${title} · FormPilot` : DEFAULT_TITLE
    document.querySelector('meta[name="description"]')?.setAttribute('content', description ?? DEFAULT_DESCRIPTION)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${SITE_URL}${path}`)
  }, [title, description, path])
}
