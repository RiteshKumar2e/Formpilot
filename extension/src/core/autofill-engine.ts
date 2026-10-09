/**
 * Autofill engine: puts values into a web page's fields so the page's own code notices them.
 *
 * Setting `input.value` directly is invisible to React, Vue and Angular, which track values
 * themselves. Values are written through the browser's native setter, then the input/change/blur
 * events a person's typing would fire are dispatched. Radios and checkboxes are clicked, like a person
 * would. Nothing here submits a form.
 */

import { clean, typeOf, type DetectedField, type FieldElement } from './field-detector'

export interface FillResult {
  ok: boolean
  reason?: string
}

function fire(el: Element, type: string) {
  el.dispatchEvent(new Event(type, { bubbles: true, composed: true }))
}

/** Writes a value through the native setter and fires the events typing would. */
export function setNativeValue(el: FieldElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  el.focus({ preventScroll: true })
  if (setter) setter.call(el, value)
  else el.value = value
  fire(el, 'input')
  fire(el, 'change')
  el.blur() // fires blur/focusout itself, for sites that validate on blur
}

const same = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase()

export function selectOption(el: HTMLSelectElement, option: string): FillResult {
  const match = Array.from(el.options).find((o) => same(o.text, option) || same(o.value, option))
  if (!match) return { ok: false, reason: 'That option isn’t in the list.' }
  setNativeValue(el, match.value)
  return { ok: true }
}

export function checkRadio(radios: HTMLInputElement[], option: string): FillResult {
  const target = radios.find((r) => {
    const label = Array.from(r.labels ?? []).map((l) => l.textContent ?? '').join(' ') || r.getAttribute('aria-label') || ''
    return same(label, option) || same(r.value, option)
  })
  if (!target) return { ok: false, reason: 'That option isn’t in the list.' }
  if (!target.checked) target.click() // a real click, so the page's handlers run
  if (!target.checked) {
    target.checked = true
    fire(target, 'input')
    fire(target, 'change')
  }
  return { ok: true }
}

export function attachFile(el: HTMLInputElement, file: File): FillResult {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  el.files = transfer.files
  fire(el, 'input')
  fire(el, 'change')
  return { ok: true }
}

// --- Dates --------------------------------------------------------------------------------------

const DATE_PATTERNS: { re: RegExp; format: (y: string, m: string, d: string) => string }[] = [
  { re: /yyyy[-/.]mm[-/.]dd/i, format: (y, m, d) => `${y}-${m}-${d}` },
  { re: /dd[-/.]mm[-/.]yyyy/i, format: (y, m, d) => `${d}/${m}/${y}` },
  { re: /mm[-/.]dd[-/.]yyyy/i, format: (y, m, d) => `${m}/${d}/${y}` },
  { re: /dd[-/.]mm[-/.]yy\b/i, format: (y, m, d) => `${d}/${m}/${y.slice(2)}` },
  { re: /mm[-/.]dd[-/.]yy\b/i, format: (y, m, d) => `${m}/${d}/${y.slice(2)}` },
]

/** Separator used in the hint ("DD-MM-YYYY" -> "-"), so the value is typed the way the field shows it. */
function separatorIn(hint: string): string {
  return hint.match(/(?:dd|mm|yyyy)([-/.])/i)?.[1] ?? '/'
}

/**
 * The date in the format this field expects, or null when the field gives no hint and a guess could
 * swap day and month (then the person confirms the format).
 */
export function formatDateFor(el: FieldElement, iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [, y, mo, d] = m
  const type = typeOf(el)
  if (type === 'date') return iso
  if (type === 'month') return `${y}-${mo}`
  if (type === 'datetime-local') return `${iso}T00:00`
  const hints = [
    'placeholder' in el ? el.placeholder : '',
    el.getAttribute('pattern') ?? '',
    el.getAttribute('aria-label') ?? '',
    el.getAttribute('title') ?? '',
    ...Array.from(el.labels ?? []).map((l) => l.textContent ?? ''),
  ].join(' ')
  for (const p of DATE_PATTERNS) {
    if (p.re.test(hints)) return p.format(y, mo, d).replace(/[/]/g, separatorIn(hints.match(p.re)![0]))
  }
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * '22/03/2005', '22-03-2005', '22 Mar 2005', '2005-03-22' -> '2005-03-22'. Numeric dates are read
 * day first, as on Indian documents. Null when the text isn't a real date.
 */
export function toIsoDate(value: string): string | null {
  const text = value.trim().replace(/,/g, ' ').replace(/\s+/g, ' ')
  let y: number, mo: number, d: number
  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]]
  else if ((m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3]]
  else if ((m = text.match(/^(\d{1,2})(?:st|nd|rd|th)?[ -/.]([A-Za-z]+)[ -/.](\d{4})$/))) [d, mo, y] = [+m[1], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[3]]
  else if ((m = text.match(/^([A-Za-z]+) (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/))) [mo, d, y] = [MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2], +m[3]]
  else return null
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (!mo || date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Both readings of an ambiguous date, for the person to choose between. */
export function dateChoices(iso: string): { label: string; value: string }[] {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return []
  const [, y, mo, d] = m
  return [
    { label: `${d}/${mo}/${y} (day first)`, value: `${d}/${mo}/${y}` },
    { label: `${mo}/${d}/${y} (month first)`, value: `${mo}/${d}/${y}` },
    { label: `${y}-${mo}-${d}`, value: `${y}-${mo}-${d}` },
  ]
}

// --- Filling a detected field --------------------------------------------------------------------

export interface FillRequest {
  value: string
  /** For dropdowns and radio groups: the option to pick. */
  option?: string | null
  /** For dates: YYYY-MM-DD, formatted for the field here. */
  iso?: string | null
}

export function fill(field: DetectedField, request: FillRequest): FillResult {
  const el = field.element
  if (!el.isConnected) return { ok: false, reason: 'This field is no longer on the page.' }
  if (field.type === 'radio' && field.radios) return checkRadio(field.radios, request.option ?? request.value)
  if (el instanceof HTMLSelectElement) return selectOption(el, request.option ?? request.value)
  if (field.type === 'checkbox' || field.type === 'file') return { ok: false, reason: 'Choose this yourself.' }
  let value = request.value
  // Date inputs only accept YYYY-MM-DD, whatever format the profile stores the date in.
  const iso = request.iso ?? (['date', 'month', 'datetime-local'].includes(typeOf(el)) ? toIsoDate(value) : null)
  if (iso) {
    const formatted = formatDateFor(el, iso)
    // No format hint: day and month could be swapped, so the person picks the format (see dateChoices).
    if (formatted === null) return { ok: false, reason: 'Confirm the date format.' }
    value = formatted
  }
  setNativeValue(el, value)
  return { ok: true }
}

/** A brief outline on a field FormPilot just filled, so the person can see what changed. */
export function highlight(el: Element): void {
  const target = el as HTMLElement
  const previous = target.style.boxShadow
  target.style.boxShadow = '0 0 0 2px rgba(14, 14, 98, 0.45)'
  window.setTimeout(() => {
    target.style.boxShadow = previous
  }, 2500)
}
