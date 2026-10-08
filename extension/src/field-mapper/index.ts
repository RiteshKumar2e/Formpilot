/**
 * Field mapper (client side). Understanding what a field means happens on the FormPilot API, which
 * already does semantic mapping and RAG for the whole product. This module prepares the request from
 * the detected fields and decides, for each suggestion, whether it can be filled as is on this page.
 */

import { formatDateFor } from '../core/autofill-engine'
import { toMeta, type DetectedField } from '../core/field-detector'
import type { Suggestion } from '../core/types'
import type { Request } from '../shared/messages'

/** A short organization name for Smart Answers, from the page's own metadata. */
function organization(): string | undefined {
  const site = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content
  if (site) return site.slice(0, 200)
  const host = location.hostname.replace(/^www\./, '').split('.')
  return host.length > 1 ? host[host.length - 2].replace(/^\w/, (c) => c.toUpperCase()) : undefined
}

export function suggestRequest(fields: DetectedField[]): Extract<Request, { type: 'suggest' }> {
  return {
    type: 'suggest',
    fields: toMeta(fields),
    pageOrigin: location.origin,
    pageTitle: document.title,
    organization: organization(),
  }
}

/** True when the suggestion can be written into its field without asking anything. */
export function fillableAsIs(s: Suggestion, field: DetectedField | undefined): boolean {
  if (!field || s.status !== 'ready' || !s.value) return false
  if (s.kind !== 'value' && s.kind !== 'choice') return false
  if (s.value_iso && formatDateFor(field.element, s.value_iso) === null) return false // ambiguous date format
  return true
}

/** Ready fields are pre-selected for Autofill, except sensitive ones, which the person ticks themselves. */
export function selectedByDefault(s: Suggestion, field: DetectedField | undefined): boolean {
  return fillableAsIs(s, field) && !s.sensitive
}

export const TIER_LABEL: Record<Suggestion['tier'], string> = {
  safe: 'Safe match',
  review: 'Review recommended',
  uncertain: 'Needs review',
  none: 'No match',
}
