/**
 * Field detector: finds the fillable fields on any web page and describes each one the way a person
 * reads it (its label, the section it sits in, its options), without knowing anything about the site.
 *
 * Only this metadata ever leaves the page. Values already typed into the form, and the page's other
 * text, are never collected.
 */

export type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

/** What the FormPilot API receives for one field (see AutofillFieldIn in backend/app/schemas.py). */
export interface FieldMeta {
  id: string
  label: string
  type: string
  required: boolean
  name?: string
  html_id?: string
  placeholder?: string
  aria_label?: string
  autocomplete?: string
  section?: string
  options: string[]
}

export interface DetectedField extends FieldMeta {
  /** The input to fill. For a radio group, its first radio. */
  element: FieldElement
  /** Every radio in the group, for radio fields. */
  radios?: HTMLInputElement[]
}

const SKIPPED_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password', 'search', 'range', 'color'])
const SKIPPED_NAMES = /captcha|recaptcha|otp|one[-_ ]?time|verification[-_ ]?code|csrf|token|honeypot/i
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, legend, [role="heading"]'
const MAX_TEXT = 160

let counter = 0

export function clean(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\(required\)|\(optional\)/gi, '')
    .replace(/[*:]+\s*$/g, '')
    .trim()
    .slice(0, MAX_TEXT)
}

/** Visible text of an element, without the text of controls inside it (e.g. a <label> wrapping a <select>). */
function ownText(el: Element): string {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('input, select, textarea, option, button, script, style').forEach((n) => n.remove())
  return clean(copy.textContent)
}

export function typeOf(el: FieldElement): string {
  if (el instanceof HTMLTextAreaElement) return 'textarea'
  if (el instanceof HTMLSelectElement) return 'select'
  return (el.type || 'text').toLowerCase()
}

function isVisible(el: HTMLElement): boolean {
  if (el.closest('[aria-hidden="true"], [hidden]')) return false
  const check = (el as HTMLElement & { checkVisibility?: (o?: object) => boolean }).checkVisibility
  if (typeof check === 'function') return check.call(el, { checkVisibilityCSS: true })
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const style = node.ownerDocument.defaultView?.getComputedStyle(node)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false
  }
  return true
}

/** Text right before the field: "<div>Full name</div><input>" or "Full name <input>". */
function precedingText(el: Element): string {
  let node: Element | null = el
  for (let depth = 0; node && depth < 3; depth++) {
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.matches('input, select, textarea') || sib.querySelector('input, select, textarea')) return ''
      const text = ownText(sib)
      if (text) return text
    }
    const prevText = node.previousSibling
    if (prevText && prevText.nodeType === Node.TEXT_NODE && clean(prevText.textContent)) return clean(prevText.textContent)
    node = node.parentElement
    if (node && node.querySelectorAll('input, select, textarea').length > 1) break
  }
  return ''
}

/** The label a person reads for this field. */
export function labelOf(el: FieldElement): string {
  for (const label of Array.from(el.labels ?? [])) {
    const text = ownText(label)
    if (text) return text
  }
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = clean(labelledBy.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '').join(' '))
    if (text) return text
  }
  const aria = clean(el.getAttribute('aria-label'))
  if (aria) return aria
  const before = precedingText(el)
  if (before) return before
  if ('placeholder' in el && clean(el.placeholder)) return clean(el.placeholder)
  return clean(el.getAttribute('title'))
}

/** The heading or fieldset legend the field sits under, e.g. "Emergency contact". */
export function sectionOf(el: Element): string {
  const legend = el.closest('fieldset')?.querySelector('legend')
  if (legend && clean(legend.textContent)) return clean(legend.textContent)
  let node: Element | null = el
  for (let depth = 0; node && depth < 8; depth++) {
    for (let sib = node.previousElementSibling, steps = 0; sib && steps < 12; sib = sib.previousElementSibling, steps++) {
      if (sib.matches(HEADING_SELECTOR)) return clean(sib.textContent)
      const inner = sib.querySelectorAll(HEADING_SELECTOR)
      if (inner.length) return clean(inner[inner.length - 1].textContent)
    }
    node = node.parentElement
  }
  return ''
}

function radioGroupLabel(radios: HTMLInputElement[]): string {
  const first = radios[0]
  const group = first.closest('fieldset, [role="radiogroup"]')
  if (group) {
    const legend = group.querySelector('legend')
    if (legend && clean(legend.textContent)) return clean(legend.textContent)
    const aria = clean(group.getAttribute('aria-label'))
    if (aria) return aria
    const labelledBy = group.getAttribute('aria-labelledby')
    if (labelledBy) return clean(first.ownerDocument.getElementById(labelledBy)?.textContent)
  }
  // The container holding all the radios, then the text before it.
  let container: Element | null = first.parentElement
  while (container && !radios.every((r) => container!.contains(r))) container = container.parentElement
  return container ? precedingText(container) : ''
}

function optionLabel(radio: HTMLInputElement): string {
  return labelOf(radio) || clean(radio.value)
}

function fieldId(el: HTMLElement): string {
  if (!el.dataset.formpilotId) el.dataset.formpilotId = `fp${++counter}`
  return el.dataset.formpilotId
}

function meta(el: FieldElement, label: string, type: string, options: string[]): FieldMeta {
  const out: FieldMeta = { id: fieldId(el), label, type, required: el.required || el.getAttribute('aria-required') === 'true', options }
  if (el.name) out.name = el.name.slice(0, 200)
  if (el.id) out.html_id = el.id.slice(0, 200)
  if ('placeholder' in el && el.placeholder) out.placeholder = clean(el.placeholder)
  const aria = el.getAttribute('aria-label')
  if (aria) out.aria_label = clean(aria)
  const autocomplete = el.getAttribute('autocomplete')
  if (autocomplete && autocomplete !== 'off' && autocomplete !== 'on') out.autocomplete = autocomplete.slice(0, 100)
  const section = sectionOf(el)
  if (section && section !== label) out.section = section
  return out
}

/** Every fillable field under `root`, in page order. Radio buttons sharing a name become one field. */
export function detectFields(root: ParentNode = document): DetectedField[] {
  const elements = Array.from(root.querySelectorAll<FieldElement>('input, textarea, select'))
  const fields: DetectedField[] = []
  const radioGroups = new Map<string, HTMLInputElement[]>()

  for (const el of elements) {
    const type = typeOf(el)
    if (SKIPPED_TYPES.has(type) || el.disabled || (el as HTMLInputElement).readOnly) continue
    if (SKIPPED_NAMES.test(`${el.name} ${el.id}`) || !isVisible(el)) continue
    if (el.closest('form[role="search"], [role="search"]')) continue

    if (type === 'radio') {
      const input = el as HTMLInputElement
      const key = `${input.form ? Array.from(document.forms).indexOf(input.form) : 'page'}:${input.name || fieldId(input)}`
      const group = radioGroups.get(key)
      if (group) {
        group.push(input)
        continue
      }
      radioGroups.set(key, [input])
      fields.push({ ...meta(input, '', 'radio', []), element: input, radios: radioGroups.get(key)! })
      continue
    }

    const options = el instanceof HTMLSelectElement ? Array.from(el.options).map((o) => clean(o.text)).filter(Boolean) : []
    fields.push({ ...meta(el, labelOf(el), type, options), element: el })
  }

  for (const field of fields) {
    if (field.type !== 'radio' || !field.radios) continue
    field.label = radioGroupLabel(field.radios)
    field.options = field.radios.map(optionLabel)
    // The group's name is shared; give every radio the group's id so any of them maps back to it.
    field.radios.forEach((r) => (r.dataset.formpilotId = field.id))
  }
  return fields
}

/** The metadata to send to the API: no elements, no values. */
export function toMeta(fields: DetectedField[]): FieldMeta[] {
  return fields.map(({ element: _element, radios: _radios, ...rest }) => rest)
}

/** A short signature of the page's current fields, to notice when a form changes (SPA, multi-step). */
export function signature(fields: DetectedField[]): string {
  return fields.map((f) => `${f.id}:${f.label}`).join('|')
}
