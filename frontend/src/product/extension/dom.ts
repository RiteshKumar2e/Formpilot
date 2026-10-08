/**
 * What the FormPilot browser extension does on another website's page: find the form's fields, work
 * out what each one is called, and fill values in a way the site's own scripts notice.
 *
 * The in-app demo runs this same code against a simulated external portal. Nothing here submits a
 * form; filling and submitting stay with the user.
 */

export type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

export interface DetectedField {
  id: string
  label: string
  type: string
  required: boolean
  element: FieldElement
}

const SKIPPED_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'password', 'search'])

function clean(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\(required\)|\(optional\)|[*:]+\s*$/gi, '')
    .trim()
}

function humanize(name: string): string {
  return name
    .replace(/[_\-.]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

/** The text a person would read as this field's label. */
export function labelOf(el: FieldElement): string {
  const fromLabel = el.labels?.[0]?.textContent
  if (clean(fromLabel)) return clean(fromLabel)
  const aria = el.getAttribute('aria-label')
  if (clean(aria)) return clean(aria)
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
    if (clean(text)) return clean(text)
  }
  if ('placeholder' in el && clean(el.placeholder)) return clean(el.placeholder)
  return humanize(el.name || el.id || 'Field')
}

function typeOf(el: FieldElement): string {
  if (el instanceof HTMLTextAreaElement) return 'textarea'
  if (el instanceof HTMLSelectElement) return 'select'
  return (el.type || 'text').toLowerCase()
}

export function detectFields(root: ParentNode): DetectedField[] {
  const elements = Array.from(root.querySelectorAll<FieldElement>('input, textarea, select'))
  return elements
    .filter((el) => !el.disabled && !(el as HTMLInputElement).readOnly && !SKIPPED_TYPES.has(typeOf(el)))
    .map((el, i) => {
      const id = el.dataset.formpilotId || el.id || el.name || `formpilot-field-${i}`
      el.dataset.formpilotId = id
      return { id, label: labelOf(el), type: typeOf(el), required: el.required, element: el }
    })
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Converts a value to what the input accepts, e.g. "12 May 2002" -> "2002-05-12" for date inputs. */
export function toInputValue(type: string, value: string): string {
  if (type !== 'date') return value
  const m = value.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
  const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1
  if (!month) return ''
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/**
 * Sets a value the way typing would, so frameworks that track input state (React, Vue, Angular) see
 * the change: the native value setter, then input and change events.
 */
export function setFieldValue(el: FieldElement, value: string): boolean {
  const next = toInputValue(typeOf(el), value)
  if (!next) return false
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, next)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

/** Attaches a file to a file input, as if the user had chosen it. */
export function attachFile(el: HTMLInputElement, file: File): void {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  el.files = transfer.files
  el.dispatchEvent(new Event('change', { bubbles: true }))
}
